// routes/networkMonitoring.js
// Route per il Network Monitoring - ricezione dati dagli agent PowerShell

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const keepassDriveService = require('../utils/keepassDriveService');
const telegramService = require('../services/TelegramService');
// Use dynamic import for node-fetch since it's ESM
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const https = require('https');

module.exports = (pool, io) => {
  // Mappe in-memory per test Unifi delegato all'agent (IP privati: VPS non raggiunge 192.168.x.x)
  const pendingUnifiTests = new Map(); // agentId -> { test_id, url, username, password, created_at }
  const unifiTestResults = new Map();  // test_id -> { success, message, at }

  // Funzione helper per inizializzare le tabelle se non esistono
  const initTables = async () => {
    try {
      // Verifica se le tabelle esistono già
      const checkResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'network_agents'
        );
      `);

      if (checkResult.rows[0].exists) {
        // Tabelle già esistenti: esegui solo migrazioni (nuove colonne, nuove tabelle)
        try {
          const deviceTypesCheck = await pool.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'network_device_types'
            );
          `);
          if (!deviceTypesCheck.rows[0].exists) {
            // Crea solo network_device_types se non esiste
            await pool.query(`
              CREATE TABLE IF NOT EXISTS network_device_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
              );
            `);
            // Inserisci tipi di default
            const defaultTypes = [
              { name: 'workstation', description: 'Computer desktop o laptop' },
              { name: 'server', description: 'Server' },
              { name: 'router', description: 'Router o gateway' },
              { name: 'switch', description: 'Switch di rete' },
              { name: 'printer', description: 'Stampante di rete' },
              { name: 'camera', description: 'Telecamera IP' },
              { name: 'unknown', description: 'Tipo sconosciuto' }
            ];
            for (const type of defaultTypes) {
              await pool.query(
                'INSERT INTO network_device_types (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
                [type.name, type.description]
              );
            }
            console.log('✅ Tabella network_device_types creata (migrazione)');
          }
        } catch (migrationErr) {
          console.warn('⚠️ Errore migrazione network_device_types:', migrationErr.message);
        }

        // Migrazione: aggiungi unifi_config a network_agents se non esiste (evita "column unifi_config does not exist")
        try {
          await pool.query(`
            ALTER TABLE network_agents 
            ADD COLUMN IF NOT EXISTS unifi_config JSONB;
          `);
        } catch (err) {
          if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
            console.warn('⚠️ Avviso aggiunta colonna unifi_config (migrazione):', err.message);
          }
        }
        try {
          await pool.query(`ALTER TABLE network_agents ADD COLUMN IF NOT EXISTS unifi_last_ok BOOLEAN;`);
          await pool.query(`ALTER TABLE network_agents ADD COLUMN IF NOT EXISTS unifi_last_check_at TIMESTAMPTZ;`);
        } catch (err) {
          if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
            console.warn('⚠️ Avviso aggiunta colonne unifi_last_* (migrazione):', err.message);
          }
        }

        // Migrazione: aggiungi upgrade_available a network_devices se non esiste
        try {
          await pool.query(`
            ALTER TABLE network_devices 
            ADD COLUMN IF NOT EXISTS upgrade_available BOOLEAN DEFAULT false;
          `);
        } catch (err) {
          if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
            console.warn('⚠️ Avviso aggiunta colonna upgrade_available (migrazione):', err.message);
          }
        }

        return;
      }

      // Se le tabelle non esistono, creale usando query dirette (più affidabile)
      // Crea tabella network_agents
      await pool.query(`
        CREATE TABLE IF NOT EXISTS network_agents (
          id SERIAL PRIMARY KEY,
          azienda_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          api_key VARCHAR(255) UNIQUE NOT NULL,
          agent_name VARCHAR(255),
          installed_on TIMESTAMP DEFAULT NOW(),
          last_heartbeat TIMESTAMP,
          status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error')),
          version VARCHAR(50),
          network_ranges TEXT[],
          scan_interval_minutes INTEGER DEFAULT 15,
          enabled BOOLEAN DEFAULT true,
          deleted_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Aggiungi colonna deleted_at se non esiste (migrazione)
      try {
        await pool.query(`
          ALTER TABLE network_agents 
          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
        `);
      } catch (err) {
        // Ignora errore se colonna esiste già
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonna deleted_at:', err.message);
        }
      }

      // Aggiungi colonna network_ranges_config per nomi delle reti (migrazione)
      try {
        await pool.query(`
          ALTER TABLE network_agents 
          ADD COLUMN IF NOT EXISTS network_ranges_config JSONB;
        `);
      } catch (err) {
        // Ignora errore se colonna esiste già
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonna network_ranges_config:', err.message);
        }
      }

      // Crea tabella network_devices
      await pool.query(`
        CREATE TABLE IF NOT EXISTS network_devices (
          id SERIAL PRIMARY KEY,
          agent_id INTEGER REFERENCES network_agents(id) ON DELETE CASCADE,
          ip_address VARCHAR(45) NOT NULL,
          mac_address VARCHAR(17),
          hostname VARCHAR(255),
          vendor VARCHAR(255),
          device_type VARCHAR(100),
          status VARCHAR(20) DEFAULT 'online' CHECK (status IN ('online', 'offline')),
          is_static BOOLEAN DEFAULT false,
          first_seen TIMESTAMP DEFAULT NOW(),
          last_seen TIMESTAMP DEFAULT NOW(),
          UNIQUE(agent_id, ip_address, mac_address)
        );
      `);

      // Aggiungi colonna is_static se non esiste (migrazione)
      try {
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS is_static BOOLEAN DEFAULT false;
        `);
      } catch (err) {
        // Ignora errore se colonna esiste già
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonna is_static:', err.message);
        }
      }

      // Aggiungi colonne previous_ip e previous_mac per tracciare cambiamenti su dispositivi statici
      try {
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS previous_ip VARCHAR(45);
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS previous_mac VARCHAR(17);
        `);
      } catch (err) {
        // Ignora errore se colonna esiste già
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonne previous_ip/previous_mac:', err.message);
        }
      }

      // Aggiungi colonna has_ping_failures per tracciare dispositivi con ping intermittenti
      try {
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS has_ping_failures BOOLEAN DEFAULT false;
        `);
      } catch (err) {
        // Ignora errore se colonna esiste già
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonna has_ping_failures:', err.message);
        }
      }

      // Aggiungi colonna device_username per memorizzare il Nome Utente da KeePass
      try {
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS device_username TEXT;
        `);
      } catch (err) {
        // Ignora errore se colonna esiste già
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonna device_username:', err.message);
        }
      }

      // Aggiungi colonne accepted_ip e accepted_mac per tracciare IP/MAC accettati dall'utente
      try {
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS accepted_ip VARCHAR(45);
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS accepted_mac VARCHAR(17);
        `);
      } catch (err) {
        // Ignora errore se colonna esiste già
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonne accepted_ip/accepted_mac:', err.message);
        }
      }

      // Aggiungi colonna notes per note utente (es. per switch virtuali)
      try {
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS notes TEXT;
        `);
      } catch (err) {
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonna notes:', err.message);
        }
      }

      // Crea tabella network_changes
      await pool.query(`
        CREATE TABLE IF NOT EXISTS network_changes (
          id SERIAL PRIMARY KEY,
          device_id INTEGER REFERENCES network_devices(id) ON DELETE CASCADE,
          agent_id INTEGER REFERENCES network_agents(id) ON DELETE CASCADE,
          change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('new_device', 'device_offline', 'device_online', 'ip_changed', 'mac_changed', 'hostname_changed', 'vendor_changed')),
          old_value TEXT,
          new_value TEXT,
          detected_at TIMESTAMP DEFAULT NOW(),
          notified BOOLEAN DEFAULT false,
          notification_ip VARCHAR(45),
          ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL
        );
      `);

      // Crea tabella network_notification_config
      await pool.query(`
        CREATE TABLE IF NOT EXISTS network_notification_config (
          id SERIAL PRIMARY KEY,
          agent_id INTEGER REFERENCES network_agents(id) ON DELETE CASCADE,
          ip_address VARCHAR(45) NOT NULL,
          enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(agent_id, ip_address)
        );
      `);

      // Crea tabella network_telegram_config (configurazione notifiche Telegram)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS network_telegram_config (
          id SERIAL PRIMARY KEY,
          azienda_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          agent_id INTEGER REFERENCES network_agents(id) ON DELETE CASCADE,
          bot_token VARCHAR(255) NOT NULL,
          chat_id VARCHAR(50) NOT NULL,
          enabled BOOLEAN DEFAULT true,
          notify_agent_offline BOOLEAN DEFAULT true,
          notify_ip_changes BOOLEAN DEFAULT true,
          notify_mac_changes BOOLEAN DEFAULT true,
          notify_status_changes BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(azienda_id, agent_id)
        );
      `);

      // Aggiungi colonna unifi_config a network_agents (migrazione)
      try {
        await pool.query(`
          ALTER TABLE network_agents 
          ADD COLUMN IF NOT EXISTS unifi_config JSONB;
        `);
      } catch (err) {
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonna unifi_config:', err.message);
        }
      }

      // Aggiungi colonna upgrade_available a network_devices (migrazione)
      try {
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS upgrade_available BOOLEAN DEFAULT false;
        `);
      } catch (err) {
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonna upgrade_available:', err.message);
        }
      }

      // Aggiungi colonna unifi_config a network_agents (migrazione)
      try {
        await pool.query(`
          ALTER TABLE network_agents 
          ADD COLUMN IF NOT EXISTS unifi_config JSONB;
        `);
      } catch (err) {
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonna unifi_config:', err.message);
        }
      }

      // Aggiungi colonna upgrade_available a network_devices (migrazione)
      try {
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS upgrade_available BOOLEAN DEFAULT false;
        `);
      } catch (err) {
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonna upgrade_available:', err.message);
        }
      }

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_network_telegram_config_azienda 
        ON network_telegram_config(azienda_id);
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_network_telegram_config_agent 
        ON network_telegram_config(agent_id);
      `);

      // Crea tabella network_device_types (tipi personalizzati dispositivi)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS network_device_types (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Crea tabella network_agent_events per tracciare eventi agent (offline, online, riavvio, problemi rete)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS network_agent_events (
          id SERIAL PRIMARY KEY,
          agent_id INTEGER REFERENCES network_agents(id) ON DELETE CASCADE,
          event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('offline', 'online', 'reboot', 'network_issue')),
          event_data JSONB,
          detected_at TIMESTAMP DEFAULT NOW(),
          resolved_at TIMESTAMP,
          notified BOOLEAN DEFAULT FALSE,
          read_by INTEGER[] DEFAULT ARRAY[]::INTEGER[],
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Inserisci tipi di default se la tabella è vuota
      const typesCheck = await pool.query('SELECT COUNT(*) FROM network_device_types');
      if (parseInt(typesCheck.rows[0].count) === 0) {
        const defaultTypes = [
          { name: 'workstation', description: 'Computer desktop o laptop' },
          { name: 'server', description: 'Server' },
          { name: 'router', description: 'Router o gateway' },
          { name: 'switch', description: 'Switch di rete' },
          { name: 'printer', description: 'Stampante di rete' },
          { name: 'camera', description: 'Telecamera IP' },
          { name: 'unknown', description: 'Tipo sconosciuto' }
        ];
        for (const type of defaultTypes) {
          await pool.query(
            'INSERT INTO network_device_types (name, description) VALUES ($1, $2)',
            [type.name, type.description]
          );
        }
      }

      // Crea indici
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_network_agents_azienda ON network_agents(azienda_id);',
        'CREATE INDEX IF NOT EXISTS idx_network_agents_api_key ON network_agents(api_key);',
        'CREATE INDEX IF NOT EXISTS idx_network_agents_status ON network_agents(status);',
        'CREATE INDEX IF NOT EXISTS idx_network_devices_agent ON network_devices(agent_id);',
        'CREATE INDEX IF NOT EXISTS idx_network_devices_ip ON network_devices(ip_address);',
        'CREATE INDEX IF NOT EXISTS idx_network_devices_mac ON network_devices(mac_address);',
        'CREATE INDEX IF NOT EXISTS idx_network_devices_last_seen ON network_devices(last_seen);',
        'CREATE INDEX IF NOT EXISTS idx_network_devices_status ON network_devices(status);',
        'CREATE INDEX IF NOT EXISTS idx_network_changes_agent ON network_changes(agent_id);',
        'CREATE INDEX IF NOT EXISTS idx_network_changes_detected ON network_changes(detected_at DESC);',
        'CREATE INDEX IF NOT EXISTS idx_network_changes_notified ON network_changes(notified);',
        'CREATE INDEX IF NOT EXISTS idx_network_changes_change_type ON network_changes(change_type);',
        'CREATE INDEX IF NOT EXISTS idx_network_notification_config_agent ON network_notification_config(agent_id);',
        'CREATE INDEX IF NOT EXISTS idx_network_notification_config_ip ON network_notification_config(ip_address);',
        'CREATE INDEX IF NOT EXISTS idx_network_device_types_name ON network_device_types(name);',
        'CREATE INDEX IF NOT EXISTS idx_network_agent_events_agent_id ON network_agent_events(agent_id);',
        'CREATE INDEX IF NOT EXISTS idx_network_agent_events_detected_at ON network_agent_events(detected_at DESC);',
        'CREATE INDEX IF NOT EXISTS idx_network_agent_events_notified ON network_agent_events(notified) WHERE notified = FALSE;',
        'CREATE INDEX IF NOT EXISTS idx_network_agent_events_type ON network_agent_events(event_type);'
      ];

      for (const indexSql of indexes) {
        try {
          await pool.query(indexSql);
        } catch (err) {
          // Ignora errori "already exists"
          if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
            console.warn('⚠️ Errore creazione indice:', err.message);
          }
        }
      }

      // Crea funzione e trigger (solo se non esistono)
      // Prima verifica se la funzione esiste già
      try {
        const functionExists = await pool.query(`
          SELECT EXISTS (
            SELECT FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND p.proname = 'update_network_agents_updated_at'
          );
        `);

        if (!functionExists.rows[0].exists) {
          // Solo se la funzione non esiste, creala
          await pool.query(`
            CREATE FUNCTION update_network_agents_updated_at()
            RETURNS TRIGGER AS $func$
            BEGIN
              NEW.updated_at = NOW();
              RETURN NEW;
            END;
            $func$ LANGUAGE plpgsql;
          `);
        }

        // Crea trigger (sempre con IF NOT EXISTS equivalente)
        await pool.query(`
          DROP TRIGGER IF EXISTS trigger_update_network_agents_updated_at ON network_agents;
          CREATE TRIGGER trigger_update_network_agents_updated_at
            BEFORE UPDATE ON network_agents
            FOR EACH ROW
            EXECUTE FUNCTION update_network_agents_updated_at();
        `);
      } catch (err) {
        // Ignora errori se funzione/trigger esistono già o altri errori non critici
        if (!err.message.includes('already exists') &&
          !err.message.includes('duplicate') &&
          !err.message.includes('does not exist')) {
          console.warn('⚠️ Errore creazione funzione/trigger:', err.message);
        }
      }

      // Crea tabella mappatura_nodes se non esiste (persisistenza layout mappe)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS mappatura_nodes (
          azienda_id INTEGER NOT NULL,
          device_id INTEGER NOT NULL,
          x DOUBLE PRECISION,
          y DOUBLE PRECISION,
          PRIMARY KEY (azienda_id, device_id)
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_mappatura_nodes_azienda ON mappatura_nodes(azienda_id);`);

      console.log('✅ Tabelle network monitoring inizializzate');
    } catch (err) {
      console.error('❌ Errore inizializzazione tabelle network monitoring:', err.message);
      // Non bloccare l'esecuzione se le tabelle esistono già
    }
  };

  // Inizializza tabelle al primo accesso (cache per evitare chiamate multiple)
  let tablesCheckDone = false;
  let tablesCheckInProgress = false;
  const ensureTables = async () => {
    // Se una verifica è già in corso, aspetta
    if (tablesCheckInProgress) {
      // Aspetta fino a 5 secondi che la verifica finisca
      let waitCount = 0;
      while (tablesCheckInProgress && waitCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      // Dopo l'attesa, ricontrolla se le tabelle esistono (potrebbero essere state create)
      if (tablesCheckDone) {
        return;
      }
    }

    tablesCheckInProgress = true;
    try {
      // Verifica rapida se le tabelle principali esistono già (più veloce che eseguire initTables)
      const checkResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'network_agents'
        ) as agents_exists,
        EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'network_agent_events'
        ) as events_exists;
      `);

      const agentsExists = checkResult.rows && checkResult.rows[0] && checkResult.rows[0].agents_exists;
      const eventsExists = checkResult.rows && checkResult.rows[0] && checkResult.rows[0].events_exists;

      if (agentsExists && eventsExists) {
        // Tutte le tabelle necessarie esistono; esegui solo migrazioni colonne (unifi_config, upgrade_available)
        try {
          await pool.query(`ALTER TABLE network_agents ADD COLUMN IF NOT EXISTS unifi_config JSONB;`);
          await pool.query(`ALTER TABLE network_agents ADD COLUMN IF NOT EXISTS unifi_last_ok BOOLEAN;`);
          await pool.query(`ALTER TABLE network_agents ADD COLUMN IF NOT EXISTS unifi_last_check_at TIMESTAMPTZ;`);
          await pool.query(`ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS upgrade_available BOOLEAN DEFAULT false;`);
          await pool.query(`ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS notes TEXT;`);
          await pool.query(`ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS is_manual_type BOOLEAN DEFAULT false;`);
          await pool.query(`
            CREATE TABLE IF NOT EXISTS managed_switches (
              id SERIAL PRIMARY KEY,
              azienda_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              ip VARCHAR(45) NOT NULL,
              snmp_community VARCHAR(128) DEFAULT 'public',
              snmp_version VARCHAR(10) DEFAULT '2c',
              name VARCHAR(255),
              created_at TIMESTAMPTZ DEFAULT NOW(),
              UNIQUE(azienda_id, ip)
            );
          `);
          await pool.query(`CREATE INDEX IF NOT EXISTS idx_managed_switches_azienda ON managed_switches(azienda_id);`);
          // Tabella per cache MAC→porta degli switch (per analisi switch collegati)
          await pool.query(`
            CREATE TABLE IF NOT EXISTS switch_mac_port_cache (
              id SERIAL PRIMARY KEY,
              managed_switch_id INTEGER NOT NULL REFERENCES managed_switches(id) ON DELETE CASCADE,
              switch_device_id INTEGER REFERENCES network_devices(id) ON DELETE CASCADE,
              mac_address VARCHAR(17) NOT NULL,
              port INTEGER NOT NULL,
              updated_at TIMESTAMPTZ DEFAULT NOW(),
              UNIQUE(managed_switch_id, mac_address)
            );
          `);
          await pool.query(`CREATE INDEX IF NOT EXISTS idx_switch_mac_port_cache_switch ON switch_mac_port_cache(managed_switch_id);`);
          await pool.query(`CREATE INDEX IF NOT EXISTS idx_switch_mac_port_cache_mac ON switch_mac_port_cache(mac_address);`);
          await pool.query(`CREATE INDEX IF NOT EXISTS idx_switch_mac_port_cache_port ON switch_mac_port_cache(managed_switch_id, port);`);
          await pool.query(`
            CREATE TABLE IF NOT EXISTS mappatura_nodes (
              azienda_id INTEGER NOT NULL,
              device_id INTEGER NOT NULL,
              x DOUBLE PRECISION,
              y DOUBLE PRECISION,
              is_locked BOOLEAN DEFAULT false,
              PRIMARY KEY (azienda_id, device_id)
            );
          `);
          try { await pool.query(`ALTER TABLE mappatura_nodes ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;`); } catch (e) { }
          await pool.query(`CREATE INDEX IF NOT EXISTS idx_mappatura_nodes_azienda ON mappatura_nodes(azienda_id);`);
        } catch (migErr) {
          if (!migErr.message?.includes('does not exist')) {
            console.warn('⚠️ Migrazione colonne network_*:', migErr.message);
          }
        }
        tablesCheckDone = true;
        tablesCheckInProgress = false;
        return;
      }

      // Se manca almeno una tabella, resetta il flag e inizializza (creerà tutte le tabelle necessarie)
      tablesCheckDone = false; // Reset per forzare la ricreazione
      await initTables();
      tablesCheckDone = true;
    } catch (err) {
      // Ignora errori di verifica - le tabelle verranno create al primo accesso
      // Non loggare come errore se è solo un problema di verifica
      if (!err.message.includes('network_agents')) {
        console.warn('⚠️ Verifica tabelle network monitoring fallita:', err.message);
      }
      tablesCheckDone = true; // Evita loop infiniti
    } finally {
      tablesCheckInProgress = false;
    }
  };

  // Middleware per autenticazione agent via API Key
  const authenticateAgent = async (req, res, next) => {
    try {
      const apiKey = req.headers['x-api-key'] || req.body.api_key || req.query.api_key;

      if (!apiKey) {
        return res.status(401).json({ error: 'API Key richiesta' });
      }

      await ensureTables();

      const result = await pool.query(
        'SELECT id, azienda_id, agent_name, enabled, deleted_at FROM network_agents WHERE api_key = $1 AND deleted_at IS NULL',
        [apiKey]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'API Key non valida' });
      }

      const agent = result.rows[0];

      if (!agent.enabled) {
        return res.status(403).json({ error: 'Agent disabilitato' });
      }

      req.agent = agent;
      next();
    } catch (err) {
      console.error('❌ Errore autenticazione agent:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  };

  // POST /api/network-monitoring/agent/register
  // Registra un nuovo agent (richiede autenticazione tecnico/admin)
  router.post('/agent/register', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();

      const { azienda_id, agent_name, network_ranges, network_ranges_config, scan_interval_minutes } = req.body;

      if (!azienda_id) {
        return res.status(400).json({ error: 'azienda_id richiesto' });
      }

      // Genera API key univoca
      const apiKey = crypto.randomBytes(32).toString('hex');

      // Se abbiamo network_ranges_config (nuovo formato con nomi), usalo
      // Altrimenti usa network_ranges (vecchio formato, solo range)
      let rangesConfig = null;
      let rangesArray = [];

      if (network_ranges_config && Array.isArray(network_ranges_config)) {
        // Nuovo formato: array di oggetti {range: "192.168.1.0/24", name: "LAN Principale"}
        rangesConfig = network_ranges_config;
        rangesArray = network_ranges_config.map(r => r.range);
      } else if (network_ranges && Array.isArray(network_ranges)) {
        // Vecchio formato: array di stringhe ["192.168.1.0/24"]
        rangesArray = network_ranges;
        // Crea config di default senza nomi
        rangesConfig = network_ranges.map(range => ({ range, name: null }));
      }

      const result = await pool.query(
        `INSERT INTO network_agents (azienda_id, api_key, agent_name, network_ranges, network_ranges_config, scan_interval_minutes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, api_key, agent_name, created_at`,
        [
          azienda_id,
          apiKey,
          agent_name || `Agent ${new Date().toISOString()}`,
          rangesArray,
          rangesConfig ? JSON.stringify(rangesConfig) : null,
          scan_interval_minutes || 15
        ]
      );

      console.log(`✅ Agent registrato: ID=${result.rows[0].id}, Azienda=${azienda_id}`);
      res.json({ success: true, agent: result.rows[0] });
    } catch (err) {
      console.error('❌ Errore registrazione agent:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/agent/config
  // Ottieni configurazione agent via API Key (per installer)
  router.get('/agent/config', async (req, res) => {
    try {
      const apiKey = req.query.api_key || req.headers['x-api-key'];

      if (!apiKey) {
        return res.status(400).json({ error: 'API Key richiesta' });
      }

      await ensureTables();

      // Versione "ufficiale" pacchetto agent sul server (presa dai file in /agent)
      // Serve per far capire all'installer quale versione dovrebbe risultare installata.
      const CURRENT_AGENT_VERSION = '2.6.0'; // Versione di fallback (allineata a $SCRIPT_VERSION)
      let agentPackageVersion = CURRENT_AGENT_VERSION;
      try {
        const projectRoot = path.resolve(__dirname, '..', '..');
        const agentDir = path.join(projectRoot, 'agent');
        const servicePath = path.join(agentDir, 'NetworkMonitorService.ps1');
        if (fs.existsSync(servicePath)) {
          // Leggi file rimuovendo BOM se presente
          let serviceContent = fs.readFileSync(servicePath, 'utf8');
          if (serviceContent.charCodeAt(0) === 0xFEFF) {
            serviceContent = serviceContent.slice(1);
          }

          // Cerca versione con pattern multipli
          const versionPatterns = [
            /\$SCRIPT_VERSION\s*=\s*["']([\d\.]+)["']/,
            /\$SCRIPT_VERSION\s*=\s*[""]([\d\.]+)[""]/,
            /SCRIPT_VERSION\s*=\s*["']([\d\.]+)["']/,
            /Versione[:\s]+([\d\.]+)/i,
            /Version[:\s]+([\d\.]+)/i
          ];

          for (const pattern of versionPatterns) {
            const versionMatch = serviceContent.match(pattern);
            if (versionMatch && versionMatch[1]) {
              agentPackageVersion = versionMatch[1];
              break;
            }
          }
        }
      } catch (versionErr) {
        // Non bloccare la risposta se non riusciamo a leggere la versione
        console.warn('⚠️ Impossibile leggere versione pacchetto agent:', versionErr.message);
        console.warn(`⚠️ Uso versione fallback: ${CURRENT_AGENT_VERSION}`);
      }

      const result = await pool.query(
        `SELECT id, agent_name, network_ranges, scan_interval_minutes, enabled, unifi_config 
         FROM network_agents 
         WHERE api_key = $1`,
        [apiKey]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'API Key non valida' });
      }

      const agent = result.rows[0];

      if (!agent.enabled) {
        return res.status(403).json({ error: 'Agent disabilitato' });
      }

      // Restituisci configurazione per l'installer
      res.json({
        api_key: apiKey, // Restituisci la stessa API key per comodità
        agent_name: agent.agent_name,
        version: agentPackageVersion,
        network_ranges: agent.network_ranges || [],
        scan_interval_minutes: agent.scan_interval_minutes || 15,
        unifi_config: agent.unifi_config
      });
    } catch (err) {
      console.error('❌ Errore recupero configurazione agent:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // POST /api/network-monitoring/agent/heartbeat
  // Agent invia heartbeat per segnalare che è online
  // Se l'agent è eliminato (deleted_at IS NOT NULL), restituisce comando di disinstallazione
  // Se l'agent è solo disabilitato (enabled=false), rifiuta i dati ma non disinstalla
  router.post('/agent/heartbeat', authenticateAgent, async (req, res) => {
    try {
      const agentId = req.agent.id;
      const { version, system_uptime, network_issue_detected, network_issue_duration, unifi_last_ok, unifi_last_check_at } = req.body;

      // Verifica se l'agent è eliminato o disabilitato
      const agentCheck = await pool.query(
        'SELECT enabled, deleted_at, last_heartbeat, status FROM network_agents WHERE id = $1',
        [agentId]
      );

      if (agentCheck.rows.length === 0) {
        // Agent non esiste più -> comando disinstallazione
        return res.json({
          success: false,
          uninstall: true,
          message: 'Agent non trovato nel database'
        });
      }

      const agentEnabled = agentCheck.rows[0].enabled;
      const agentDeletedAt = agentCheck.rows[0].deleted_at;
      const lastHeartbeat = agentCheck.rows[0].last_heartbeat;
      const previousStatus = agentCheck.rows[0].status; // Status PRIMA dell'aggiornamento

      // Se l'agent è eliminato (soft delete) -> comando disinstallazione
      if (agentDeletedAt) {
        console.log(`🗑️ Agent ${agentId} eliminato - comando disinstallazione`);
        return res.json({
          success: false,
          uninstall: true,
          message: 'Agent eliminato dal server'
        });
      }

      // Se l'agent è disabilitato ma non eliminato -> rifiuta heartbeat (non aggiorna, non disinstalla)
      if (!agentEnabled) {
        console.log(`🔴 Agent ${agentId} disabilitato - rifiuto heartbeat (non disinstallo)`);
        return res.status(403).json({
          success: false,
          uninstall: false,
          error: 'Agent disabilitato',
          message: 'L\'agent è disabilitato ma non disinstallato. I dati non verranno accettati.'
        });
      }

      // Rileva se c'è stato un riavvio (system_uptime < 5 minuti e last_heartbeat > 10 minuti fa)
      let rebootDetected = false;
      if (system_uptime !== undefined && system_uptime !== null) {
        const uptimeMinutes = system_uptime / 60; // Converti secondi in minuti
        if (uptimeMinutes < 5 && lastHeartbeat) {
          const lastHeartbeatTime = new Date(lastHeartbeat);
          const minutesSinceLastHeartbeat = (Date.now() - lastHeartbeatTime.getTime()) / 60000;
          if (minutesSinceLastHeartbeat > 10) {
            rebootDetected = true;
            console.log(`🔄 Rilevato riavvio per agent ${agentId} (uptime: ${uptimeMinutes.toFixed(2)} min, ultimo heartbeat: ${minutesSinceLastHeartbeat.toFixed(2)} min fa)`);
          }
        }
      }

      // Rileva se l'agent era offline e ora è tornato online
      // Controlla sia lo status nel database che il tempo dall'ultimo heartbeat
      const wasOfflineByStatus = previousStatus === 'offline';
      const wasOfflineByTime = lastHeartbeat ? (Date.now() - new Date(lastHeartbeat).getTime()) > 10 * 60 * 1000 : true;
      const wasOffline = wasOfflineByStatus || wasOfflineByTime;
      const isNowOnline = true; // Se riceviamo heartbeat, è online

      // Agent abilitato e non eliminato -> aggiorna heartbeat normalmente
      await pool.query(
        `UPDATE network_agents 
         SET last_heartbeat = NOW(), status = 'online', version = COALESCE($1, version)
         WHERE id = $2`,
        [version, agentId]
      );

      // Stato Unifi (l'agent invia unifi_last_ok / unifi_last_check_at dopo ogni scan con Unifi)
      if (typeof unifi_last_ok === 'boolean' && unifi_last_check_at) {
        const at = new Date(unifi_last_check_at);
        if (!isNaN(at.getTime())) {
          await pool.query(
            `UPDATE network_agents SET unifi_last_ok = $1, unifi_last_check_at = $2 WHERE id = $3`,
            [unifi_last_ok, at, agentId]
          );
        }
      }

      // Log per debug
      if (wasOfflineByStatus) {
        console.log(`🟢 Agent ${agentId} (${req.agent.agent_name || 'N/A'}) tornato online (era offline nel database)`);
      } else if (wasOfflineByTime) {
        console.log(`🟢 Agent ${agentId} (${req.agent.agent_name || 'N/A'}) tornato online (ultimo heartbeat > 10 min fa)`);
      } else {
        // Log ogni heartbeat per debug (anche se già online)
        const minutesSinceLastHeartbeat = lastHeartbeat
          ? Math.floor((Date.now() - new Date(lastHeartbeat).getTime()) / 60000)
          : 'N/A';
        console.log(`💓 Heartbeat ricevuto da agent ${agentId} (${req.agent.agent_name || 'N/A'}) - ultimo: ${minutesSinceLastHeartbeat} min fa`);
      }

      // Emetti evento WebSocket per aggiornare la lista agenti in tempo reale
      if (io && wasOffline) {
        io.to(`role:tecnico`).to(`role:admin`).emit('network-monitoring-update', {
          type: 'agent-status-changed',
          agentId,
          status: 'online'
        });
      }

      // Invia notifica Telegram quando agent torna online
      if (wasOffline && isNowOnline) {
        try {
          const agentInfo = await pool.query(
            'SELECT na.agent_name, na.azienda_id, u.azienda as azienda_name FROM network_agents na LEFT JOIN users u ON na.azienda_id = u.id WHERE na.id = $1',
            [agentId]
          );

          if (agentInfo.rows.length > 0) {
            await sendTelegramNotification(
              agentId,
              agentInfo.rows[0].azienda_id,
              'status_changed',
              {
                hostname: agentInfo.rows[0].agent_name,
                deviceType: 'Agent',
                ip: 'N/A',
                mac: 'N/A',
                status: 'online',
                agentName: agentInfo.rows[0].agent_name,
                aziendaName: agentInfo.rows[0].azienda_name
              }
            );
            console.log(`📱 Notifica Telegram inviata: Agent ${agentInfo.rows[0].agent_name} tornato online`);
          }
        } catch (telegramErr) {
          console.error('❌ Errore invio notifica Telegram per agent online:', telegramErr);
        }
      }

      // Crea eventi se necessario (proteggiamo tutte le operazioni con try-catch)
      try {
        // Assicurati che la tabella esista prima di usarla
        await ensureTables();

        if (rebootDetected) {
          // Verifica se esiste già un evento riavvio recente (ultimi 5 minuti)
          const existingReboot = await pool.query(
            `SELECT id FROM network_agent_events 
             WHERE agent_id = $1 
               AND event_type = 'reboot' 
               AND detected_at > NOW() - INTERVAL '5 minutes'
             LIMIT 1`,
            [agentId]
          );

          if (existingReboot.rows.length === 0) {
            // Crea evento riavvio
            await pool.query(
              `INSERT INTO network_agent_events (agent_id, event_type, event_data, detected_at, notified)
               VALUES ($1, 'reboot', $2, NOW(), FALSE)`,
              [agentId, JSON.stringify({
                system_uptime_seconds: system_uptime,
                system_uptime_minutes: (system_uptime / 60).toFixed(2),
                last_heartbeat_before: lastHeartbeat,
                detected_at: new Date().toISOString()
              })]
            );

            // Emetti evento WebSocket
            if (io) {
              io.to(`role:tecnico`).to(`role:admin`).emit('agent-event', {
                agentId,
                eventType: 'reboot',
                message: `Agent ${req.agent.agent_name || agentId} riavviato`,
                detectedAt: new Date().toISOString()
              });
            }
          }
        }

        if (wasOffline && isNowOnline) {
          // Risolvi eventuali eventi offline precedenti
          await pool.query(
            `UPDATE network_agent_events 
             SET resolved_at = NOW()
             WHERE agent_id = $1 
               AND event_type = 'offline' 
               AND resolved_at IS NULL`,
            [agentId]
          );

          // Crea evento "tornato online"
          const offlineDuration = lastHeartbeat ? Math.floor((Date.now() - new Date(lastHeartbeat).getTime()) / 60000) : 0;

          // Verifica se esiste già un evento online recente (ultimi 2 minuti)
          const existingOnline = await pool.query(
            `SELECT id FROM network_agent_events 
             WHERE agent_id = $1 
               AND event_type = 'online' 
               AND detected_at > NOW() - INTERVAL '2 minutes'
             LIMIT 1`,
            [agentId]
          );

          if (existingOnline.rows.length === 0) {
            await pool.query(
              `INSERT INTO network_agent_events (agent_id, event_type, event_data, detected_at, notified)
               VALUES ($1, 'online', $2, NOW(), FALSE)`,
              [agentId, JSON.stringify({
                offline_duration_minutes: offlineDuration,
                last_heartbeat_before: lastHeartbeat,
                detected_at: new Date().toISOString()
              })]
            );

            // Emetti evento WebSocket
            if (io) {
              io.to(`role:tecnico`).to(`role:admin`).emit('agent-event', {
                agentId,
                eventType: 'online',
                message: `Agent ${req.agent.agent_name || agentId} tornato online (era offline da ${offlineDuration} minuti)`,
                detectedAt: new Date().toISOString()
              });
            }
          }
        }

        // Rileva problema rete se indicato dall'agent
        if (network_issue_detected === true && network_issue_duration !== undefined) {
          // Verifica se esiste già un evento network_issue recente (ultimi 5 minuti)
          const existingNetworkIssue = await pool.query(
            `SELECT id FROM network_agent_events 
             WHERE agent_id = $1 
               AND event_type = 'network_issue' 
               AND detected_at > NOW() - INTERVAL '5 minutes'
             LIMIT 1`,
            [agentId]
          );

          if (existingNetworkIssue.rows.length === 0) {
            await pool.query(
              `INSERT INTO network_agent_events (agent_id, event_type, event_data, detected_at, notified, resolved_at)
               VALUES ($1, 'network_issue', $2, NOW(), FALSE, NOW())`,
              [agentId, JSON.stringify({
                issue_duration_minutes: network_issue_duration,
                detected_at: new Date().toISOString(),
                resolved_at: new Date().toISOString()
              })]
            );

            // Emetti evento WebSocket
            if (io) {
              io.to(`role:tecnico`).to(`role:admin`).emit('agent-event', {
                agentId,
                eventType: 'network_issue',
                message: `Agent ${req.agent.agent_name || agentId} - problema rete rilevato (durata: ${network_issue_duration} minuti)`,
                detectedAt: new Date().toISOString()
              });
            }
          }
        }
      } catch (eventsErr) {
        // Se la tabella non esiste, prova a crearla direttamente
        if (eventsErr.code === '42P01') {
          console.log(`⚠️ Heartbeat: tabella network_agent_events non disponibile, tentativo creazione...`);
          try {
            await pool.query(`
              CREATE TABLE IF NOT EXISTS network_agent_events (
                id SERIAL PRIMARY KEY,
                agent_id INTEGER REFERENCES network_agents(id) ON DELETE CASCADE,
                event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('offline', 'online', 'reboot', 'network_issue')),
                event_data JSONB,
                detected_at TIMESTAMP DEFAULT NOW(),
                resolved_at TIMESTAMP,
                notified BOOLEAN DEFAULT FALSE,
                read_by INTEGER[] DEFAULT ARRAY[]::INTEGER[],
                created_at TIMESTAMP DEFAULT NOW()
              );
            `);
            console.log(`✅ Heartbeat: tabella network_agent_events creata con successo`);
            // Resetta il flag per forzare la ricreazione al prossimo heartbeat
            tablesCheckDone = false;
          } catch (createErr) {
            console.error(`❌ Heartbeat: errore creazione tabella network_agent_events:`, createErr.message);
          }
        } else {
          console.error(`❌ Errore creazione eventi heartbeat:`, eventsErr.message);
        }
      }

      const resp = { success: true, timestamp: new Date().toISOString(), uninstall: false };
      const pt = pendingUnifiTests.get(agentId);
      if (pt) {
        resp.pending_unifi_test = { test_id: pt.test_id, url: pt.url, username: pt.username, password: pt.password };
        pendingUnifiTests.delete(agentId);
      }
      res.json(resp);
    } catch (err) {
      // Non loggare come errore se è solo la tabella network_agent_events mancante (già gestito nel catch interno)
      if (err.code !== '42P01' || !err.message.includes('network_agent_events')) {
        console.error('❌ Errore heartbeat:', err);
      }
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/agent/managed-switches
  // Restituisce gli switch gestiti per l'azienda dell'agent (l'agent esegue SNMP in locale)
  router.get('/agent/managed-switches', authenticateAgent, async (req, res) => {
    try {
      await ensureTables();
      const aziendaId = req.agent.azienda_id;
      const r = await pool.query(
        'SELECT id, ip, snmp_community, snmp_version, name FROM managed_switches WHERE azienda_id = $1 ORDER BY name, ip',
        [aziendaId]
      );
      res.json(r.rows);
    } catch (err) {
      console.error('❌ Errore GET agent/managed-switches:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // POST /api/network-monitoring/agent/switch-address-table
  // L'agent invia la tabella MAC→porta letta via snmpwalk in locale; il backend abbina e aggiorna parent/port
  router.post('/agent/switch-address-table', authenticateAgent, async (req, res) => {
    try {
      await ensureTables();
      const aziendaId = req.agent.azienda_id;
      const { managed_switch_id, switch_ip, mac_to_port } = req.body;
      if (!managed_switch_id || !switch_ip || !mac_to_port || typeof mac_to_port !== 'object') {
        return res.status(400).json({ error: 'managed_switch_id, switch_ip e mac_to_port (oggetto) richiesti' });
      }
      const sw = await pool.query(
        'SELECT id FROM managed_switches WHERE id = $1 AND azienda_id = $2',
        [managed_switch_id, aziendaId]
      );
      if (sw.rows.length === 0) {
        return res.status(404).json({ error: 'Switch gestito non trovato o non appartenente all\'azienda' });
      }
      const ip = String(switch_ip).trim();
      const macToPort = new Map();
      for (const [k, v] of Object.entries(mac_to_port)) {
        const mac = String(k).replace(/[\s:.-]/g, '').toUpperCase();
        const port = typeof v === 'number' ? v : parseInt(v, 10);
        if (mac && mac.length >= 12 && !isNaN(port)) macToPort.set(mac, port);
      }
      // Trova o crea network_device per lo switch (IP)
      let switchDeviceId;
      let dev = await pool.query(
        `SELECT nd.id FROM network_devices nd
         INNER JOIN network_agents na ON nd.agent_id = na.id
         WHERE na.azienda_id = $1 AND TRIM(REGEXP_REPLACE(nd.ip_address, '[{}"]', '', 'g')) = $2
         LIMIT 1`,
        [aziendaId, ip]
      );
      if (dev.rows.length > 0) {
        switchDeviceId = dev.rows[0].id;
      } else {
        const ag = await pool.query('SELECT id FROM network_agents WHERE azienda_id = $1 AND deleted_at IS NULL ORDER BY id LIMIT 1', [aziendaId]);
        if (ag.rows.length === 0) return res.status(400).json({ error: 'Nessun agent trovato per questa azienda' });
        const ins = await pool.query(
          `INSERT INTO network_devices (agent_id, ip_address, device_type, status) VALUES ($1, $2, 'switch', 'online')
           RETURNING id`,
          [ag.rows[0].id, ip]
        );
        switchDeviceId = ins.rows[0].id;
      }
      // Dispositivi azienda con mac_address: match e aggiorna parent_device_id, port
      const devices = await pool.query(
        `SELECT nd.id, nd.mac_address FROM network_devices nd
         INNER JOIN network_agents na ON nd.agent_id = na.id
         WHERE na.azienda_id = $1 AND nd.mac_address IS NOT NULL AND nd.mac_address != ''`,
        [aziendaId]
      );
      const normalizeMac = (m) => (m || '').replace(/[\s:.-]/g, '').toUpperCase();
      let updated = 0;
      for (const d of devices.rows) {
        const n = normalizeMac(d.mac_address);
        if (!n || n.length < 12) continue;
        const port = macToPort.get(n);
        if (port == null) continue;
        await pool.query('UPDATE network_devices SET parent_device_id = $1, port = $2 WHERE id = $3', [switchDeviceId, port, d.id]);
        updated++;
      }

      // Salva la tabella MAC→porta nella cache (per analisi switch collegati)
      // Prima cancella la cache vecchia per questo switch
      await pool.query('DELETE FROM switch_mac_port_cache WHERE managed_switch_id = $1', [managed_switch_id]);
      // Poi inserisci tutti i MAC→porta
      for (const [mac, port] of macToPort.entries()) {
        const macFormatted = mac.length === 12 ? `${mac.substring(0, 2)}:${mac.substring(2, 4)}:${mac.substring(4, 6)}:${mac.substring(6, 8)}:${mac.substring(8, 10)}:${mac.substring(10, 12)}`.toUpperCase() : mac;
        await pool.query(
          'INSERT INTO switch_mac_port_cache (managed_switch_id, switch_device_id, mac_address, port) VALUES ($1, $2, $3, $4) ON CONFLICT (managed_switch_id, mac_address) DO UPDATE SET port = $4, updated_at = NOW()',
          [managed_switch_id, switchDeviceId, macFormatted, port]
        );
      }

      console.log(`📥 switch-address-table: switch_ip=${ip}, managed_switch_id=${managed_switch_id}, macs_found=${macToPort.size}, macs_matched=${updated}`);
      if (macToPort.size > 0 && updated === 0) {
        console.warn(`⚠️ SNMP: ${macToPort.size} MAC letti dallo switch ma 0 match con network_devices. Verificare: 1) dispositivi scoperti dall'agent con mac_address, 2) formato MAC (entrambi normalizzati senza :.-).`);
      }

      // Analizza switch collegati (porte con più MAC = switch collegato)
      await analyzeConnectedSwitches(aziendaId);

      res.json({ success: true, macs_found: macToPort.size, macs_matched: updated, switch_device_id: switchDeviceId });
    } catch (err) {
      console.error('❌ Errore POST agent/switch-address-table:', err);
      res.status(500).json({ error: err.message || 'Errore interno del server' });
    }
  });

  // POST /api/network-monitoring/clients/:aziendaId/calculate-topology
  // Rotta manuale per triggerare il calcolo della topologia (analisi switch collegati)
  router.post('/clients/:aziendaId/calculate-topology', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      const { aziendaId } = req.params;
      console.log(`📡 Richiesta calcolo topologia per azienda ${aziendaId}`);
      await analyzeConnectedSwitches(aziendaId);
      res.json({ success: true, message: 'Topologia calcolata con successo' });
    } catch (err) {
      console.error('❌ Errore API calculate-topology:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Funzione helper per analizzare switch collegati
  // Identifica porte con più MAC (indica switch collegato) e verifica se quei MAC sono su altri switch gestiti
  const analyzeConnectedSwitches = async (aziendaId) => {
    try {
      // Recupera tutti gli switch gestiti e i loro network_devices
      const switches = await pool.query(
        `SELECT ms.id, ms.ip, ms.name, nd.id as switch_device_id
         FROM managed_switches ms
         LEFT JOIN network_devices nd ON TRIM(REGEXP_REPLACE(nd.ip_address, '[{}"]', '', 'g')) = ms.ip AND nd.device_type = 'switch'
         LEFT JOIN network_agents na ON nd.agent_id = na.id AND na.azienda_id = $1
         WHERE ms.azienda_id = $1`,
        [aziendaId]
      );

      if (switches.rows.length === 0) return;

      const normalizeMac = (m) => (m || '').replace(/[\s:.-]/g, '').toUpperCase();

      // 1. PRIMA PASSA: Ricollega tutti i dispositivi singoli ai loro switch gestiti (Reset collegamenti base)
      // Utile se l'utente ha spostato cavi o se i dispositivi sono stati resettati
      for (const sw of switches.rows) {
        if (!sw.switch_device_id) continue;
        const macPorts = await pool.query('SELECT mac_address, port FROM switch_mac_port_cache WHERE managed_switch_id = $1', [sw.id]);

        for (const row of macPorts.rows) {
          const macNorm = normalizeMac(row.mac_address);
          if (!macNorm || macNorm.length < 12) continue;

          // Trova device con questo MAC e collegalo a questo switch
          // Nota: questo sovrascrive eventuali parent manuali se il MAC viene rilevato dallo switch
          await pool.query(
            `UPDATE network_devices 
                  SET parent_device_id = $1, port = $2 
                  WHERE agent_id = (SELECT agent_id FROM network_devices WHERE id = $1)
                  AND REPLACE(REPLACE(REPLACE(REPLACE(UPPER(mac_address), ':', ''), '-', ''), '.', ''), ' ', '') = $3`,
            [sw.switch_device_id, row.port, macNorm]
          );
        }
      }

      // 2. SECONDA PASSA: Analisi porte multiple (Uplink o Switch Virtuali)
      for (const sw of switches.rows) {
        if (!sw.switch_device_id) continue;

        // Recupera tutte le MAC→porta per questo switch
        const macPorts = await pool.query(
          'SELECT mac_address, port FROM switch_mac_port_cache WHERE managed_switch_id = $1',
          [sw.id]
        );

        // Raggruppa per porta: porta -> [mac1, mac2, ...]
        const portToMacs = new Map();
        for (const row of macPorts.rows) {
          const macNorm = normalizeMac(row.mac_address);
          if (!macNorm || macNorm.length < 12) continue;
          const port = row.port;
          if (!portToMacs.has(port)) portToMacs.set(port, []);
          portToMacs.get(port).push(macNorm);
        }

        // Trova porte con più MAC (indica switch collegato)
        for (const [port, macs] of portToMacs.entries()) {
          if (macs.length <= 1) continue; // Porta con più MAC = switch collegato

          // Verifica se questi MAC sono presenti su un altro switch gestito
          let foundOnOtherSwitch = null;
          for (const otherSw of switches.rows) {
            if (otherSw.id === sw.id || !otherSw.switch_device_id) continue;

            // Verifica se almeno uno di questi MAC è presente sull'altro switch
            const otherMacs = await pool.query(
              'SELECT mac_address FROM switch_mac_port_cache WHERE managed_switch_id = $1',
              [otherSw.id]
            );
            const otherMacSet = new Set();
            for (const row of otherMacs.rows) {
              otherMacSet.add(normalizeMac(row.mac_address));
            }

            // Se almeno un MAC è presente sull'altro switch, significa che questo switch è collegato a quello
            const matchingMacs = macs.filter(m => otherMacSet.has(m));
            if (matchingMacs.length > 0) {
              foundOnOtherSwitch = otherSw;
              break;
            }
          }

          if (foundOnOtherSwitch) {
            // Collega questo switch all'altro switch (parent_device_id)
            await pool.query(
              'UPDATE network_devices SET parent_device_id = $1 WHERE id = $2 AND parent_device_id IS NULL',
              [foundOnOtherSwitch.switch_device_id, sw.switch_device_id]
            );
            console.log(`🔗 Switch collegati: ${sw.ip} (porta ${port}) → ${foundOnOtherSwitch.ip} (${macs.length} MAC sulla porta)`);
          } else {
            // MAC non trovati su altri switch gestiti = switch virtuale/non gestito
            // Crea uno switch virtuale e collega questi MAC a quello switch virtuale
            // Prima verifica se esiste già uno switch virtuale per questa porta
            const virtualIp = `virtual-switch-${sw.id}-port-${port}`;
            const existingVirtual = await pool.query(
              `SELECT nd.id FROM network_devices nd
               INNER JOIN network_agents na ON nd.agent_id = na.id
               WHERE na.azienda_id = $1 AND nd.device_type = 'switch' AND TRIM(REGEXP_REPLACE(nd.ip_address, '[{}"]', '', 'g')) = $2`,
              [aziendaId, virtualIp]
            );

            let virtualSwitchId;
            if (existingVirtual.rows.length > 0) {
              virtualSwitchId = existingVirtual.rows[0].id;
            } else {
              // Crea nuovo switch virtuale
              const ag = await pool.query('SELECT id FROM network_agents WHERE azienda_id = $1 AND deleted_at IS NULL ORDER BY id LIMIT 1', [aziendaId]);
              if (ag.rows.length === 0) continue;
              const ins = await pool.query(
                `INSERT INTO network_devices (agent_id, ip_address, device_type, status, parent_device_id, port, notes)
                 VALUES ($1, $2, 'unmanaged_switch', 'online', $3, $4, $5)
                 RETURNING id`,
                [ag.rows[0].id, virtualIp, sw.switch_device_id, port, `Switch Virtuale (Porta ${port} su ${sw.name || sw.ip})`]
              );
              virtualSwitchId = ins.rows[0].id;
            }

            // Collega i dispositivi con questi MAC allo switch virtuale
            for (const mac of macs) {
              await pool.query(
                `UPDATE network_devices SET parent_device_id = $1
                 WHERE id IN (
                   SELECT nd.id FROM network_devices nd
                   INNER JOIN network_agents na ON nd.agent_id = na.id
                   WHERE na.azienda_id = $2 AND REPLACE(REPLACE(REPLACE(REPLACE(UPPER(nd.mac_address), ':', ''), '-', ''), '.', ''), ' ', '') = $3
                 )`,
                [virtualSwitchId, aziendaId, mac]
              );
            }
            console.log(`🔌 Switch virtuale creato: porta ${port} di ${sw.ip} → switch virtuale (${macs.length} MAC)`);
          }
        }
      }
    } catch (err) {
      console.error('❌ Errore analyzeConnectedSwitches:', err);
    }
  };

  // ========================================
  // FUNZIONI HELPER PER MONITORING SCHEDULE
  // ========================================

  /**
   * Verifica se siamo nella finestra di monitoraggio schedulato
   * @param {Object} schedule - {enabled, days, expected_time, grace_minutes}
   * @returns {boolean} - true se siamo nella finestra
   */
  function isWithinMonitoringWindow(schedule) {
    if (!schedule || !schedule.enabled) {
      return false; // Nessuno schedule = modalità continua
    }

    const now = new Date();
    const currentDay = now.getDay(); // 0=Domenica, 1=Lunedì, ...
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Minuti da mezzanotte

    // Controlla se oggi è un giorno di monitoraggio
    if (!schedule.days || !Array.isArray(schedule.days) || !schedule.days.includes(currentDay)) {
      return false;
    }

    // Parse expected_time (formato "HH:MM")
    const [expectedHours, expectedMinutes] = (schedule.expected_time || '00:00').split(':').map(Number);
    const expectedTime = expectedHours * 60 + expectedMinutes;
    const graceMinutes = schedule.grace_minutes || 60;

    // Finestra: expected_time fino a expected_time + grace_minutes
    const windowStart = expectedTime;
    const windowEnd = expectedTime + graceMinutes;

    return currentTime >= windowStart && currentTime <= windowEnd;
  }

  /**
   * Determina se inviare notifica basandosi sulla modalità (continua vs schedulata)
   * @param {Object} device - Dispositivo con notify_telegram e monitoring_schedule
   * @param {string} eventType - 'status_changed', 'ip_changed', 'mac_changed'
   * @returns {boolean} - true se deve notificare
   */
  function shouldNotifyForEvent(device, eventType) {
    if (!device.notify_telegram) {
      return false; // Notifiche disabilitate
    }

    const schedule = device.monitoring_schedule;

    // MODALITÀ CONTINUA (schedule NULL o disabled)
    if (!schedule || !schedule.enabled) {
      return true; // Notifica sempre per ogni evento
    }

    // MODALITÀ SCHEDULATA
    // Per status_changed (online/offline): NON notificare (è normale che si accenda/spenga)
    if (eventType === 'status_changed') {
      return false;
    }

    // Per ip_changed e mac_changed: notifica SOLO se siamo nella finestra di monitoraggio
    if (eventType === 'ip_changed' || eventType === 'mac_changed') {
      return isWithinMonitoringWindow(schedule);
    }

    return false;
  }

  // Funzione helper per inviare notifiche Telegram
  async function sendTelegramNotification(agentId, aziendaId, messageType, data) {
    try {
      // Ottieni configurazione Telegram per questo agent/azienda
      // Cerca prima una configurazione specifica, poi una globale (NULL)
      const configResult = await pool.query(
        `SELECT bot_token, chat_id, enabled, 
                notify_agent_offline, notify_ip_changes, 
                notify_mac_changes, notify_status_changes
         FROM network_telegram_config
         WHERE enabled = true
           AND (
             (agent_id = $1 AND azienda_id = $2)
             OR (agent_id = $1 AND azienda_id IS NULL)
             OR (agent_id IS NULL AND azienda_id = $2)
             OR (agent_id IS NULL AND azienda_id IS NULL)
           )
         ORDER BY 
           CASE WHEN agent_id IS NOT NULL AND azienda_id IS NOT NULL THEN 1
                WHEN agent_id IS NOT NULL THEN 2
                WHEN azienda_id IS NOT NULL THEN 3
                ELSE 4
           END
         LIMIT 1`,
        [agentId, aziendaId]
      );

      if (configResult.rows.length === 0) {
        console.log(`⚠️ Nessuna configurazione Telegram trovata per agent ${agentId}, azienda ${aziendaId}`);
        return false; // Nessuna configurazione Telegram
      }

      const config = configResult.rows[0];
      console.log(`📋 Configurazione Telegram trovata per agent ${agentId}, azienda ${aziendaId}:`, {
        enabled: config.enabled,
        notify_agent_offline: config.notify_agent_offline,
        notify_ip_changes: config.notify_ip_changes,
        notify_mac_changes: config.notify_mac_changes,
        notify_status_changes: config.notify_status_changes,
        bot_token: config.bot_token ? `${config.bot_token.substring(0, 10)}...` : 'N/A',
        chat_id: config.chat_id || 'N/A'
      });

      // Verifica se questo tipo di notifica è abilitato
      let shouldNotify = false;
      let message = '';

      switch (messageType) {
        case 'agent_offline':
          shouldNotify = config.notify_agent_offline;
          if (shouldNotify) {
            message = telegramService.formatAgentOfflineMessage(
              data.agentName,
              data.lastHeartbeat,
              data.aziendaName
            );
          }
          break;

        case 'ip_changed':
          shouldNotify = config.notify_ip_changes;
          if (shouldNotify) {
            message = telegramService.formatIPChangedMessage(data);
          }
          break;

        case 'mac_changed':
          shouldNotify = config.notify_mac_changes;
          if (shouldNotify) {
            message = telegramService.formatMACChangedMessage(data);
          }
          break;

        case 'status_changed':
          shouldNotify = config.notify_status_changes;
          if (shouldNotify) {
            message = telegramService.formatDeviceStatusMessage(data);
          }
          break;

        default:
          return false;
      }

      if (!shouldNotify || !message) {
        return false;
      }

      // Inizializza bot se non già fatto o aggiorna se token/chat cambiati
      const initResult = telegramService.initialize(config.bot_token, config.chat_id);
      if (!initResult) {
        console.error('❌ Errore inizializzazione TelegramService per agent', agentId, 'azienda', aziendaId);
        return false;
      }

      // Invia messaggio
      console.log(`📤 Invio notifica Telegram (${messageType}) per agent ${agentId}, azienda ${aziendaId}`);
      const result = await telegramService.sendMessage(message);

      if (result && result.success) {
        console.log(`✅ Notifica Telegram inviata con successo (${messageType})`);
        return true;
      } else {
        console.error(`❌ Errore invio notifica Telegram (${messageType}):`, result?.error || 'Errore sconosciuto');
        return false;
      }
    } catch (error) {
      console.error('❌ Errore invio notifica Telegram:', error.message, error.stack);
      return false;
    }
  }

  // POST /api/network-monitoring/agent/scan-results
  // Agent invia risultati della scansione (dispositivi rilevati)
  router.post('/agent/scan-results', authenticateAgent, async (req, res) => {
    try {
      const agentId = req.agent.id;
      const { devices, changes } = req.body; // devices: array, changes: array (opzionale)

      console.log(`📥 Scan results ricevuti da agent ${agentId}: ${devices?.length || 0} dispositivi, ${changes?.length || 0} cambiamenti`);

      if (!devices || !Array.isArray(devices)) {
        console.error('❌ devices non è un array:', typeof devices, devices);
        return res.status(400).json({ error: 'devices deve essere un array' });
      }

      // Aggiorna/inserisci dispositivi
      const deviceResults = [];
      console.log(`📥 Ricevuto payload scan-results: ${devices.length} dispositivi, ${changes ? changes.length : 0} cambiamenti`);

      // DEBUG UNIFI NAME
      const devicesWithUnifiName = devices.filter(d => d.unifi_name);
      console.log(`🔎 DEBUG: Dispositivi con unifi_name nel payload: ${devicesWithUnifiName.length} su ${devices.length}`);
      if (devicesWithUnifiName.length > 0) {
        const sample = devicesWithUnifiName[0];
        console.log(`🔎 DEBUG SAMPLE: IP=${sample.ip_address}, MAC=${sample.mac_address}, UnifiName="${sample.unifi_name}", Hostname="${sample.hostname}"`);
      } else {
        console.log(`🔎 DEBUG: Nessun unifi_name ricevuto. Verifica se l'agent è aggiornato (2.5.8+) e se Check-UnifiUpdates funziona.`);
      }

      const receivedIPs = new Set(); // Traccia gli IP ricevuti in questa scansione

      for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        let { ip_address, mac_address, hostname, vendor, status, has_ping_failures, ping_responsive, upgrade_available, unifi_name } = device;

        // Determina l'hostname effettivo (Unifi Name > Hostname rilevato)
        let effectiveHostname = unifi_name || hostname;

        // device_type non viene più inviato dall'agent, sarà gestito manualmente
        // ping_responsive (nuovo): true se risponde al ping, false se presente solo via ARP
        // upgrade_available (nuovo): true se il device ha un aggiornamento firmware disponibile (via Unifi)

        // Normalizza hostname: potrebbe essere stringa, array, o oggetto JSON
        if (hostname) {
          if (typeof hostname === 'string') {
            hostname = hostname.trim();

            // Se sembra un array JSON come stringa (es: {"Android_RPRTJQAR.local", "Android_RPRTJQAR.local", ...})
            // Prova a estrarre il primo valore valido
            if (hostname.startsWith('{') || hostname.includes('", "')) {
              // Prova a parsare come JSON array
              try {
                // Rimuovi le parentesi graffe e le virgolette, poi prendi il primo elemento
                const cleaned = hostname.replace(/^[{\s"]+/, '').replace(/[}\s"]+$/, '');
                const parts = cleaned.split(/",\s*"/);
                if (parts.length > 0 && parts[0]) {
                  hostname = parts[0].replace(/^["\s]+/, '').replace(/["\s]+$/, '').trim();
                }
              } catch (e) {
                // Se il parsing fallisce, rimuovi solo i caratteri JSON
                hostname = hostname.replace(/[{}"]/g, '').trim();
                // Prendi solo la prima parte prima della prima virgola se presente
                const firstPart = hostname.split(',')[0].trim();
                if (firstPart) {
                  hostname = firstPart;
                }
              }
            } else {
              // Rimuovi caratteri JSON errati se presenti
              hostname = hostname.replace(/[{}"]/g, '').trim();
            }
          } else if (Array.isArray(hostname)) {
            // Se è un array, prendi il primo elemento valido (non vuoto e non duplicato)
            const validHostnames = hostname
              .filter(h => h && typeof h === 'string' && h.trim() !== '')
              .map(h => h.trim().replace(/[{}"]/g, ''))
              .filter(h => h !== '' && !h.startsWith('_') && !h.includes('._tcp.local')); // Filtra nomi tecnici

            hostname = validHostnames.length > 0 ? validHostnames[0] : null;
          } else if (typeof hostname === 'object') {
            // Se è un oggetto, prova a convertirlo in stringa o prendi il primo valore
            const firstValue = Object.values(hostname)[0];
            if (firstValue && typeof firstValue === 'string') {
              hostname = firstValue.trim().replace(/[{}"]/g, '').trim();
            } else {
              hostname = String(hostname).replace(/[{}"]/g, '').trim();
            }
          }

          // Rimuovi prefissi tecnici comuni (es: "I013Q1b8n14AAA._FC9F5ED42C8A._tcp.local")
          if (hostname && (hostname.includes('._tcp.local') || hostname.startsWith('_'))) {
            // Se contiene solo nomi tecnici, prova a trovare un nome più leggibile
            const parts = hostname.split(/[,\s]+/);
            const readablePart = parts.find(p => p && !p.startsWith('_') && !p.includes('._tcp.local') && p.includes('.local'));
            if (readablePart) {
              hostname = readablePart.trim();
            } else {
              // Se non c'è un nome leggibile, prendi il primo che non inizia con underscore
              const nonTechPart = parts.find(p => p && !p.startsWith('_'));
              if (nonTechPart) {
                hostname = nonTechPart.trim();
              }
            }
          }

          // Tronca hostname troppo lungo (max 100 caratteri per evitare problemi di impaginazione)
          if (hostname && hostname.length > 100) {
            hostname = hostname.substring(0, 97) + '...';
          }

          // Rimuovi stringhe vuote o invalide
          if (hostname === '' || hostname === 'null' || hostname === 'undefined' || hostname === '-') {
            hostname = null;
          }
        }

        // Normalizza ip_address: potrebbe essere stringa, array, o oggetto JSON
        if (ip_address) {
          if (typeof ip_address === 'string') {
            ip_address = ip_address.trim();
            // Rimuovi caratteri JSON errati se presenti (es: {"192.168.100.2"} -> 192.168.100.2)
            ip_address = ip_address.replace(/[{}"]/g, '').trim();
          } else if (Array.isArray(ip_address)) {
            // Se è un array, prendi il primo elemento valido
            ip_address = ip_address.find(ip => ip && typeof ip === 'string' && ip.trim() !== '')?.trim() || null;
            if (ip_address) {
              ip_address = ip_address.replace(/[{}"]/g, '').trim();
            }
          } else if (typeof ip_address === 'object') {
            // Se è un oggetto, prova a convertirlo in stringa o prendi il primo valore
            const firstValue = Object.values(ip_address)[0];
            if (firstValue && typeof firstValue === 'string') {
              ip_address = firstValue.trim().replace(/[{}"]/g, '').trim();
            } else {
              ip_address = String(ip_address).replace(/[{}"]/g, '').trim();
            }
          }
        }

        if (!ip_address || ip_address === '') {
          console.warn(`⚠️ Dispositivo ${i + 1}/${devices.length} senza IP valido, saltato:`, JSON.stringify(device));
          continue;
        }

        // Traccia IP ricevuto
        receivedIPs.add(ip_address);

        // Log dettagliato per debug
        if (i === 0 || i === devices.length - 1) {
          console.log(`  📱 Dispositivo ${i + 1}/${devices.length}: IP=${ip_address}, MAC=${mac_address || 'N/A'}, Hostname=${hostname || 'N/A'}`);
        }

        // Cerca dispositivo esistente (per IP+MAC o solo IP se MAC non disponibile)
        let existingDevice;

        // Normalizza mac_address: potrebbe essere stringa, array, o altro
        let macAddressStr = null;
        if (mac_address) {
          if (typeof mac_address === 'string') {
            macAddressStr = mac_address.trim();
          } else if (Array.isArray(mac_address)) {
            // Se è un array, prendi il primo elemento valido
            macAddressStr = mac_address.find(m => m && typeof m === 'string' && m.trim() !== '')?.trim() || null;
          } else if (typeof mac_address === 'object') {
            // Se è un oggetto, prova a convertirlo in stringa
            macAddressStr = String(mac_address).trim();
          }
          // Rimuovi stringhe vuote o MAC invalidi
          if (macAddressStr === '' || macAddressStr === '00-00-00-00-00-00') {
            macAddressStr = null;
          }
        }

        // Normalizza anche l'IP per la ricerca (rimuovi caratteri JSON se presenti)
        const normalizedIpForSearch = ip_address.replace(/[{}"]/g, '').trim();

        // Cerca dispositivo esistente: sempre per IP, opzionalmente anche per MAC se disponibile
        let existingQuery;
        let existingParams;

        // Normalizza MAC address PRIMA della query per confronti corretti
        let normalizedMacForSearch = null;
        if (macAddressStr && macAddressStr !== '') {
          // Rimuovi spazi, virgole, e converti in maiuscolo
          normalizedMacForSearch = macAddressStr.replace(/\s+/g, '').replace(/,/g, '').toUpperCase();
          // Se contiene duplicati separati, prendi solo i primi 17 caratteri
          if (normalizedMacForSearch.length > 17) {
            normalizedMacForSearch = normalizedMacForSearch.substring(0, 17);
          }
          // Converti trattini in due punti per uniformità
          if (normalizedMacForSearch.length > 17) normalizedMacForSearch = normalizedMacForSearch.substring(0, 17);
          normalizedMacForSearch = normalizedMacForSearch.replace(/-/g, ':'); // PROMOTING COLONS
        }

        // ==========================================================================================
        // NUOVA LOGICA DI ABBINAMENTO (MAC-FIRST) PER EVITARE DUPLICATI
        // ==========================================================================================

        // 1. Cerca TUTTI i record con questo MAC (se disponibile)
        let matchingDevices = [];
        if (normalizedMacForSearch && normalizedMacForSearch.length >= 12) {
          const macQuery = `
            SELECT id, ip_address, mac_address, hostname, is_static, last_seen, ip_history, device_type, device_path, device_username, is_manual_type, vendor, status, has_ping_failures, accepted_ip, accepted_mac, ping_responsive, upgrade_available
            FROM network_devices 
            WHERE agent_id = $1 
            AND REPLACE(REPLACE(UPPER(mac_address), ':', ''), '-', '') = REPLACE(REPLACE(UPPER($2), ':', ''), '-', '')
            ORDER BY is_static DESC, last_seen DESC, id DESC
          `;
          const macResult = await pool.query(macQuery, [agentId, normalizedMacForSearch]);
          matchingDevices = macResult.rows;
        }

        // 2. Se non abbiamo trovato per MAC, cerchiamo per IP (per gestire dispositivi senza MAC o nuovi)
        let ipMatch = null;

        if (matchingDevices.length === 0) {
          const ipQuery = `
             SELECT id, ip_address, mac_address, hostname, is_static, last_seen, ip_history, device_type, device_path, device_username, is_manual_type, vendor, status, has_ping_failures, accepted_ip, accepted_mac, ping_responsive, upgrade_available
             FROM network_devices
             WHERE agent_id = $1 AND REGEXP_REPLACE(ip_address, '[{}"]', '', 'g') = $2
             ORDER BY is_static DESC, last_seen DESC
           `;
          const ipResult = await pool.query(ipQuery, [agentId, normalizedIpForSearch]);
          if (ipResult.rows.length > 0) {
            ipMatch = ipResult.rows[0];
          }
        }

        // 3. Determina il dispositivo "vincente" da aggiornare
        if (matchingDevices.length > 0) {
          // Abbiamo trovato uno o più dispositivi con questo MAC.
          // Il primo della lista è il "migliore" (Statico > Recente > ID alto)
          existingDevice = matchingDevices[0];

          // Se ci sono altri duplicati con lo stesso MAC, DOBBIAMO eliminarli per rispettare "One MAC = One Record"
          if (matchingDevices.length > 1) {
            console.warn(`  ⚠️ Unificazione MAC ${normalizedMacForSearch}: Trovati ${matchingDevices.length} record. Mantengo ID ${existingDevice.id}, elimino gli altri.`);
            const idsToDelete = matchingDevices.slice(1).map(d => d.id);

            // Recupera info utili dai duplicati prima di ucciderli (opzionale: unire history)
            // Per semplicità, eliminiamo
            await pool.query('DELETE FROM network_devices WHERE id = ANY($1)', [idsToDelete]);
          }

          // GESTIONE CAMBIO IP E STORICO
          const oldIp = existingDevice.ip_address ? existingDevice.ip_address.replace(/[{}"]/g, '', 'g').trim() : null;

          if (oldIp && oldIp !== normalizedIpForSearch) {
            console.log(`  🔄 Dispositivo MAC ${normalizedMacForSearch} ha cambiato IP: ${oldIp} -> ${normalizedIpForSearch}`);

            // Aggiungi vecchio IP allo storico
            let history = existingDevice.ip_history || [];
            if (!Array.isArray(history)) history = [];

            // Aggiungi solo se non è l'ultimo (evita spam se rimbalza)
            const lastEntry = history.length > 0 ? history[history.length - 1] : null;
            if (!lastEntry || lastEntry.ip !== oldIp) {
              history.push({
                ip: oldIp,
                seen_at: existingDevice.last_seen || new Date().toISOString()
              });
              // Limita lo storico agli ultimi 10 cambi
              if (history.length > 10) history = history.slice(-10);

              // Aggiorna l'oggetto in memoria per il successivo UPDATE
              existingDevice.ip_history = history;
            }

            // IMPORTANTE: Controlla se c'è un "fantasma" che occupa il NUOVO IP ma ha MAC diverso o nullo?
            // Se esiste un record sul nuovo IP che NON è quello che stiamo aggiornando, è un conflitto.
            // Se ha MAC diverso, è un conflitto IP. Se non ha MAC, lo sovrascriviamo/eliminiamo?
            // Per sicurezza puliamo record sul nuovo IP che non hanno MAC (sono placeholder instabili)
            await pool.query(`
               DELETE FROM network_devices 
               WHERE agent_id = $1 AND REGEXP_REPLACE(ip_address, '[{}"]', '', 'g') = $2 
               AND (mac_address IS NULL OR mac_address = '') 
               AND id != $3
             `, [agentId, normalizedIpForSearch, existingDevice.id]);
          }

        } else if (ipMatch) {
          // Non trovato per MAC, ma trovato per IP.
          // Potrebbe essere un dispositivo che non aveva MAC registrato e ora lo invia.
          // OPPURE un dispositivo diverso che ha preso quell'IP.

          // Se quello su DB non ha MAC, ci impossessiamo del record (è lo stesso dispositivo che si è identificato meglio)
          if (!ipMatch.mac_address) {
            console.log(`  ➕ Arricchimento dispositivo IP ${normalizedIpForSearch}: Assegnato MAC ${normalizedMacForSearch}`);
            existingDevice = ipMatch;
          } else {
            // Se quello su DB HA un MAC, ed è DIVERSO dal nostro... CONFLITTO.
            // IP 192.168.1.15 era MAC AA:AA... ora arriva MAC BB:BB...
            // Secondo la logica "One MAC = One Record", questo è un NUOVO dispositivo.
            // Il vecchio dispositivo a quell'IP ora è offline o ha cambiato IP (ma non lo sappiamo ancora).
            // Non tocchiamo il vecchio record (rimarrà al suo posto, diventerà offline se non risponde).
            // Creiamo un NUOVO record per il nostro MAC corrente.
            existingDevice = null;
          }
        } else {
          // Nessun match per MAC né per IP. È un nuovo dispositivo.
          existingDevice = null;
        }

        if (existingDevice) {
          // Aggiorna dispositivo esistente
          const updates = [];
          const values = [];
          let paramIndex = 1;

          // Normalizza MAC address (stessa logica di INSERT per coerenza)
          let normalizedMac = null;
          if (macAddressStr) {
            // Rimuovi spazi, virgole, e converti in maiuscolo
            normalizedMac = macAddressStr.replace(/\s+/g, '').replace(/,/g, '').toUpperCase();
            // Se contiene duplicati separati (es: "60-83-E7-BF-4C-AF60-83-E7-BF-4C-AF"), prendi solo i primi 17 caratteri
            if (normalizedMac.length > 17) {
              // Prendi solo i primi 17 caratteri (formato standard MAC: XX:XX:XX:XX:XX:XX)
              normalizedMac = normalizedMac.substring(0, 17);
            }
            // Converti trattini in due punti per uniformità (FIX: uniforma a :)
            normalizedMac = normalizedMac.replace(/-/g, ':');

            // Se non ha il formato corretto, prova a convertirlo
            if (normalizedMac.length === 12 && !normalizedMac.includes(':')) {
              // Formato senza separatori, aggiungi due punti ogni 2 caratteri
              normalizedMac = normalizedMac.replace(/(..)(..)(..)(..)(..)(..)/, '$1:$2:$3:$4:$5:$6');
            }
            // Verifica che sia un MAC valido (17 caratteri con due punti)
            if (normalizedMac.length !== 17 || !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(normalizedMac)) {
              normalizedMac = null;
            }
          }

          // Rileva cambiamenti IP su dispositivi statici O quando trovato per MAC
          const normalizedCurrentIp = normalizedIpForSearch;
          const existingIp = existingDevice.ip_address ? existingDevice.ip_address.replace(/[{}"]/g, '').trim() : null;
          const ipChanged = normalizedCurrentIp !== existingIp;

          // Gestisci cambio IP se: dispositivo statico O trovato per MAC con IP diverso
          if (ipChanged && (existingDevice.is_static || foundByMac)) {
            // Controlla se il nuovo IP è quello accettato dall'utente
            const acceptedIp = existingDevice.accepted_ip ? existingDevice.accepted_ip.replace(/[{}"]/g, '').trim() : null;
            if (acceptedIp && normalizedCurrentIp === acceptedIp) {
              // L'IP è quello accettato dall'utente, non mostrare warning
              console.log(`  ℹ️ IP cambiato ma accettato dall'utente: ${existingIp} -> ${normalizedCurrentIp} (accettato)`);
              // Aggiorna solo l'IP, non salvare previous_ip
              updates.push(`ip_address = $${paramIndex++}`);
              values.push(normalizedCurrentIp);
            } else {
              // Dispositivo con IP cambiato - salva valore precedente
              console.log(`  ⚠️ IP CAMBIATO ${existingIp} -> ${normalizedCurrentIp} (${foundByMac ? 'trovato per MAC' : 'dispositivo statico'})`);
              updates.push(`previous_ip = $${paramIndex++}`);
              values.push(existingIp);
              // Aggiorna anche l'IP
              updates.push(`ip_address = $${paramIndex++}`);
              values.push(normalizedCurrentIp);

              // Aggiorna storico IP se presente (aggiunto dalla logica MAC-first)
              if (existingDevice.ip_history) {
                updates.push(`ip_history = $${paramIndex++}`);
                values.push(JSON.stringify(existingDevice.ip_history));
              }

              // Invia notifica Telegram (controlla modalità continua vs schedulata)
              if (shouldNotifyForEvent(existingDevice, 'ip_changed')) {
                try {
                  const agentInfo = await pool.query(
                    'SELECT na.agent_name, na.azienda_id, u.azienda as azienda_name FROM network_agents na LEFT JOIN users u ON na.azienda_id = u.id WHERE na.id = $1',
                    [agentId]
                  );

                  if (agentInfo.rows.length > 0) {
                    await sendTelegramNotification(
                      agentId,
                      agentInfo.rows[0].azienda_id,
                      'ip_changed',
                      {
                        hostname: existingDevice.hostname,
                        deviceType: existingDevice.device_type,
                        mac: existingDevice.mac_address,
                        oldIP: existingIp,
                        newIP: normalizedCurrentIp,
                        agentName: agentInfo.rows[0].agent_name,
                        aziendaName: agentInfo.rows[0].azienda_name
                      }
                    );
                  }
                } catch (telegramErr) {
                  console.error('❌ Errore invio notifica Telegram per cambio IP:', telegramErr);
                }
              }
            }
          }

          // Aggiorna MAC se disponibile e diverso (anche se era NULL prima)
          // IMPORTANTE: Normalizza anche il MAC esistente per confronto corretto (ignora differenze formato : vs -)
          const existingMacNormalized = existingDevice.mac_address ? existingDevice.mac_address.toUpperCase().replace(/[:-]/g, '-') : null;
          const newMacNormalized = normalizedMac ? normalizedMac.toUpperCase().replace(/[:-]/g, '-') : null;

          if (normalizedMac && newMacNormalized !== existingMacNormalized) {
            // Se il dispositivo è statico e il MAC cambia, controlla se è quello accettato
            if (existingDevice.is_static && existingDevice.mac_address) {
              const acceptedMac = existingDevice.accepted_mac ? existingDevice.accepted_mac.toUpperCase().replace(/[:-]/g, '-') : null;
              if (acceptedMac && newMacNormalized === acceptedMac) {
                // Il MAC è quello accettato dall'utente, non mostrare warning
                console.log(`  ℹ️ MAC cambiato ma accettato dall'utente: ${existingDevice.mac_address} -> ${normalizedMac} (accettato)`);
                // Aggiorna solo il MAC, non salvare previous_mac
                updates.push(`mac_address = $${paramIndex++}`);
                values.push(normalizedMac);
              } else {
                // Dispositivo statico con MAC cambiato - salva valore precedente
                console.log(`  ⚠️ MAC CAMBIATO per dispositivo statico ${existingDevice.mac_address} -> ${normalizedMac}`);
                updates.push(`previous_mac = $${paramIndex++}`);
                values.push(existingDevice.mac_address);
                updates.push(`mac_address = $${paramIndex++}`);
                values.push(normalizedMac);

                // Invia notifica Telegram (controlla modalità continua vs schedulata)
                if (shouldNotifyForEvent(existingDevice, 'mac_changed')) {
                  try {
                    const agentInfo = await pool.query(
                      'SELECT na.agent_name, na.azienda_id, u.azienda as azienda_name FROM network_agents na LEFT JOIN users u ON na.azienda_id = u.id WHERE na.id = $1',
                      [agentId]
                    );

                    if (agentInfo.rows.length > 0) {
                      await sendTelegramNotification(
                        agentId,
                        agentInfo.rows[0].azienda_id,
                        'mac_changed',
                        {
                          hostname: existingDevice.hostname,
                          deviceType: existingDevice.device_type,
                          ip: existingDevice.ip_address,
                          oldMAC: existingDevice.mac_address,
                          newMAC: normalizedMac,
                          agentName: agentInfo.rows[0].agent_name,
                          aziendaName: agentInfo.rows[0].azienda_name
                        }
                      );
                    }
                  } catch (telegramErr) {
                    console.error('❌ Errore invio notifica Telegram per cambio MAC:', telegramErr);
                  }
                }
              }
            } else {
              // Dispositivo non statico o senza MAC precedente, aggiorna normalmente
              console.log(`  🔄 Aggiornamento MAC per ${ip_address}: ${existingDevice.mac_address || 'NULL'} -> ${normalizedMac}`);
              updates.push(`mac_address = $${paramIndex++}`);
              values.push(normalizedMac);
            }
          } else if (normalizedMac && !existingDevice.mac_address) {
            // Se il dispositivo non aveva MAC e ora lo abbiamo, aggiornalo
            console.log(`  ➕ Aggiunta MAC per ${ip_address}: NULL -> ${normalizedMac}`);
            updates.push(`mac_address = $${paramIndex++}`);
            values.push(normalizedMac);
          } else if (normalizedMac && newMacNormalized === existingMacNormalized) {
            // MAC è lo stesso (anche se formato diverso), non serve aggiornare
            console.log(`  ℹ️ MAC per ${ip_address} già corretto: ${normalizedMac} (formato normalizzato: ${newMacNormalized})`);
          }

          // Aggiorna has_ping_failures se presente nei dati
          if (has_ping_failures !== undefined && has_ping_failures !== existingDevice.has_ping_failures) {
            updates.push(`has_ping_failures = $${paramIndex++}`);
            values.push(has_ping_failures === true);
          }

          // Aggiorna upgrade_available se presente (nuovo: Unifi Integration)
          if (upgrade_available !== undefined) {
            updates.push(`upgrade_available = $${paramIndex++}`);
            values.push(upgrade_available === true);
          }

          // Aggiorna ping_responsive se presente nei dati (nuovo: Trust ARP)
          if (ping_responsive !== undefined && ping_responsive !== existingDevice.ping_responsive) {
            updates.push(`ping_responsive = $${paramIndex++}`);
            values.push(ping_responsive === true);
          }

          // Usa hostname già normalizzato (troncato a max 100 caratteri)
          // PRIORITÀ: Unifi Name > Hostname da scansione
          if (effectiveHostname && effectiveHostname !== existingDevice.hostname) {
            updates.push(`hostname = $${paramIndex++}`);
            values.push(effectiveHostname);
          }
          // Nota: se hostname non viene fornito, preserva quello esistente (non lo cancella)
          if (vendor && vendor !== existingDevice.vendor) {
            updates.push(`vendor = $${paramIndex++}`);
            values.push(vendor || null);
          }
          // Ricerca automatica MAC in KeePass per impostare device_type
          // IMPORTANTE: NON sovrascrivere device_type se è stato modificato manualmente (is_manual_type = true)
          // Cerca sempre in KeePass se il MAC è disponibile, ma rispetta le modifiche manuali
          if (normalizedMac && process.env.KEEPASS_PASSWORD && !existingDevice.is_manual_type) {
            try {
              const keepassResult = await keepassDriveService.findMacTitle(normalizedMac, process.env.KEEPASS_PASSWORD);
              if (keepassResult) {
                // Estrai solo l'ultimo elemento del percorso (es: "gestione > logikaservice.it > Pippo2" -> "Pippo2")
                const lastPathElement = keepassResult.path ? keepassResult.path.split(' > ').pop() : null;
                // Aggiorna device_type e device_path con i valori da KeePass (solo se non modificato manualmente)
                // Se trovato per MAC con IP cambiato, aggiorna anche device_username
                console.log(`  🔍 MAC ${normalizedMac} trovato in KeePass -> Imposto device_type: "${keepassResult.title}", device_path: "${lastPathElement}"`);
                updates.push(`device_type = $${paramIndex++}`);
                values.push(keepassResult.title);
                updates.push(`device_path = $${paramIndex++}`);
                values.push(lastPathElement);
                if (foundByMac && ipChanged) {
                  // Se trovato per MAC con IP cambiato, aggiorna anche device_username da KeePass
                  updates.push(`device_username = $${paramIndex++}`);
                  values.push(keepassResult.username || null);
                  console.log(`  📝 Aggiornato anche device_username da KeePass: "${keepassResult.username || 'NULL'}"`);
                }
              } else {
                // MAC non trovato in KeePass.
                // Fallback: Se abbiamo un Unifi Name, usalo come device_type (Titolo).
                // Altrimenti resetta a NULL.
                const newDeviceType = unifi_name || null;

                // Aggiorna solo se il valore è diverso
                if (existingDevice.device_type !== newDeviceType || existingDevice.device_path !== null) {
                  console.log(`  🔍 MAC ${normalizedMac} NON in KeePass -> Fallback device_type: "${newDeviceType || 'NULL'}"`);
                  updates.push(`device_type = $${paramIndex++}`);
                  values.push(newDeviceType);
                  updates.push(`device_path = $${paramIndex++}`);
                  values.push(null);
                }
                // Se trovato per MAC con IP cambiato ma non in KeePass, svuota anche device_username
                if (foundByMac && ipChanged) {
                  updates.push(`device_username = $${paramIndex++}`);
                  values.push(null);
                }
              }
            } catch (keepassErr) {
              console.warn(`  ⚠️ Errore ricerca MAC ${normalizedMac} in KeePass:`, keepassErr.message);
            }
          } else if (existingDevice.is_manual_type) {
            console.log(`  ℹ️ Device_type per ${ip_address} modificato manualmente, mantengo valore esistente: "${existingDevice.device_type}"`);
          }

          // last_seen viene SEMPRE aggiornato quando il dispositivo viene rilevato nella scansione
          updates.push(`last_seen = NOW()`);
          updates.push(`status = $${paramIndex++}`);
          values.push(status || 'online');

          values.push(existingDevice.id);

          // Esegui sempre l'UPDATE (almeno last_seen e status sono sempre presenti)
          await pool.query(
            `UPDATE network_devices SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            values
          );

          deviceResults.push({ action: 'updated', id: existingDevice.id, ip: ip_address });
        } else {
          // Inserisci nuovo dispositivo
          // Nota: ON CONFLICT non funziona bene con mac_address NULL, quindi gestiamo manualmente
          try {
            // Normalizza MAC address usando macAddressStr già processato
            let normalizedMac = null;
            if (macAddressStr) {
              // Rimuovi spazi, virgole, e converti in maiuscolo
              normalizedMac = macAddressStr.replace(/\s+/g, '').replace(/,/g, '').toUpperCase();
              // Se contiene duplicati separati (es: "60-83-E7-BF-4C-AF60-83-E7-BF-4C-AF"), prendi solo i primi 17 caratteri
              if (normalizedMac.length > 17) {
                // Prendi solo i primi 17 caratteri (formato standard MAC: XX:XX:XX:XX:XX:XX)
                normalizedMac = normalizedMac.substring(0, 17);
              }
              // Converti trattini in due punti per uniformità
              normalizedMac = normalizedMac.replace(/-/g, ':');
              // Se non ha il formato corretto, prova a convertirlo
              if (normalizedMac.length === 12 && !normalizedMac.includes(':')) {
                // Formato senza separatori, aggiungi due punti ogni 2 caratteri
                normalizedMac = normalizedMac.replace(/(..)(..)(..)(..)(..)(..)/, '$1:$2:$3:$4:$5:$6');
              }
              // Verifica che sia un MAC valido (17 caratteri con due punti)
              if (normalizedMac.length !== 17 || !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(normalizedMac)) {
                normalizedMac = null;
              }
            }

            // Prima di inserire, controlla se c'è un dispositivo offline con lo stesso MAC
            // Se sì, trasferisci i dati e svuota il vecchio
            let previousIpFromOldDevice = null;
            if (normalizedMac) {
              const oldDeviceWithSameMacResult = await pool.query(
                `SELECT id, ip_address, device_type, device_path, device_username, status, previous_ip
                 FROM network_devices 
                 WHERE agent_id = $1 
                 AND REPLACE(REPLACE(UPPER(mac_address), ':', ''), '-', '') = REPLACE(REPLACE(UPPER($2), ':', ''), '-', '')
                 AND id NOT IN (SELECT id FROM network_devices WHERE agent_id = $1 AND REGEXP_REPLACE(ip_address, '[{}"]', '', 'g') = $3)
                 LIMIT 1`,
                [agentId, normalizedMac, ip_address]
              );

              if (oldDeviceWithSameMacResult.rows.length > 0) {
                const oldDevice = oldDeviceWithSameMacResult.rows[0];
                console.log(`  🔄 Trovato dispositivo offline con stesso MAC ${normalizedMac}: IP vecchio ${oldDevice.ip_address} -> nuovo IP ${ip_address}`);

                // Usa previous_ip del vecchio dispositivo o il suo IP come previous_ip
                previousIpFromOldDevice = oldDevice.previous_ip || oldDevice.ip_address.replace(/[{}"]/g, '').trim();

                // Svuota i dati del vecchio dispositivo (mantieni solo MAC)
                await pool.query(
                  `UPDATE network_devices 
                   SET device_type = NULL, device_path = NULL, device_username = NULL, hostname = NULL, vendor = NULL
                   WHERE id = $1`,
                  [oldDevice.id]
                );
                console.log(`  🧹 Dati svuotati per dispositivo vecchio IP ${oldDevice.ip_address}`);
              }
            }

            // Ricerca automatica MAC in KeePass per impostare device_type e device_path
            // NOTA: Per i nuovi dispositivi, usiamo sempre KeePass se disponibile
            // (non c'è is_manual_type perché è un nuovo dispositivo)
            let deviceTypeFromKeepass = null;
            let devicePathFromKeepass = null;
            let deviceUsernameFromKeepass = null;
            if (normalizedMac && process.env.KEEPASS_PASSWORD) {
              try {
                const keepassResult = await keepassDriveService.findMacTitle(normalizedMac, process.env.KEEPASS_PASSWORD);
                if (keepassResult) {
                  deviceTypeFromKeepass = keepassResult.title;
                  devicePathFromKeepass = keepassResult.path ? keepassResult.path.split(' > ').pop() : null;
                  deviceUsernameFromKeepass = keepassResult.username || null;
                  console.log(`  🔍 MAC ${normalizedMac} trovato in KeePass -> Imposto device_type: "${keepassResult.title}", device_path: "${devicePathFromKeepass}", device_username: "${deviceUsernameFromKeepass}"`);
                }
              } catch (keepassErr) {
                console.warn(`  ⚠️ Errore ricerca MAC ${normalizedMac} in KeePass:`, keepassErr.message);
              }
            }

            // Fallback: Se non trovato in KeePass, usa Unifi Name se presente
            if (!deviceTypeFromKeepass && unifi_name) {
              deviceTypeFromKeepass = unifi_name;
              console.log(`  🏷️ NUOVO DISPOSITIVO: Uso Unifi Name come device_type: "${unifi_name}"`);
            }

            const insertResult = await pool.query(
              `INSERT INTO network_devices (agent_id, ip_address, mac_address, hostname, vendor, device_type, device_path, device_username, previous_ip, status, has_ping_failures, ping_responsive, upgrade_available)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING id`,
              [
                agentId,
                ip_address,
                normalizedMac,
                effectiveHostname || null, // Hostname con priorità Unifi
                (vendor && vendor.trim() !== '') ? vendor.trim() : null,
                deviceTypeFromKeepass || null, // device_type da KeePass o fallback Unifi
                devicePathFromKeepass || null,
                deviceUsernameFromKeepass || null,
                previousIpFromOldDevice || null, // previous_ip se c'era un dispositivo vecchio con stesso MAC
                status || 'online',
                has_ping_failures === true,
                ping_responsive !== false,
                upgrade_available === true
              ]
            );

            deviceResults.push({ action: 'created', id: insertResult.rows[0].id, ip: ip_address });
          } catch (insertErr) {
            // Se fallisce per conflitto, prova a fare UPDATE
            if (insertErr.code === '23505' || insertErr.message.includes('duplicate')) {
              console.log(`  ℹ️ Dispositivo ${ip_address} già esistente, aggiorno...`);
              const updateResult = await pool.query(
                `UPDATE network_devices 
                 SET last_seen = NOW(), status = $1 
                 WHERE agent_id = $2 AND ip_address = $3
                 RETURNING id`,
                [status || 'online', agentId, ip_address]
              );
              if (updateResult.rows.length > 0) {
                deviceResults.push({ action: 'updated', id: updateResult.rows[0].id, ip: ip_address });
              }
            } else {
              console.error(`❌ Errore inserimento dispositivo ${ip_address}:`, insertErr.message);
              console.error(`   Codice errore: ${insertErr.code}`);
              console.error(`   Dettagli: ${insertErr.detail}`);
              console.error(`   Stack: ${insertErr.stack}`);
              // Non interrompere il loop, continua con gli altri dispositivi
            }
          }
        }
      }

      // Marca come offline i dispositivi dell'agent che non sono nella lista ricevuta
      // (cioè non sono stati rilevati nella scansione corrente)
      try {
        const allAgentDevices = await pool.query(
          'SELECT id, ip_address, status, is_static, notify_telegram FROM network_devices WHERE agent_id = $1',
          [agentId]
        );

        // Normalizza gli IP ricevuti per il confronto (rimuovi caratteri JSON)
        const normalizedReceivedIPs = new Set();
        receivedIPs.forEach(ip => {
          normalizedReceivedIPs.add(ip.replace(/[{}"]/g, '').trim());
        });

        const devicesToMarkOffline = allAgentDevices.rows.filter(device => {
          const normalizedDeviceIp = (device.ip_address || '').replace(/[{}"]/g, '').trim();
          return !normalizedReceivedIPs.has(normalizedDeviceIp) && device.status === 'online';
        });

        if (devicesToMarkOffline.length > 0) {
          console.log(`  ⚠️ Marcatura ${devicesToMarkOffline.length} dispositivi come offline (non trovati nella scansione)`);

          for (const device of devicesToMarkOffline) {
            // Prima di marcare offline, controlla se c'è un conflitto IP (stesso MAC con IP diverso online)
            // Se sì, trasferisci i dati al nuovo dispositivo e svuota il vecchio
            if (device.mac_address) {
              const conflictDeviceResult = await pool.query(
                `SELECT id, ip_address, device_type, device_path, device_username, hostname, vendor, status
                 FROM network_devices 
                 WHERE agent_id = $1 
                 AND REPLACE(REPLACE(UPPER(mac_address), ':', ''), '-', '') = REPLACE(REPLACE(UPPER($2), ':', ''), '-', '')
                 AND id != $3 AND status = 'online'
                 LIMIT 1`,
                [agentId, device.mac_address, device.id]
              );

              if (conflictDeviceResult.rows.length > 0) {
                const conflictDevice = conflictDeviceResult.rows[0];
                console.log(`  🔄 Conflitto IP rilevato: stesso MAC ${device.mac_address} con IP diverso online (${conflictDevice.ip_address})`);
                console.log(`    📤 Trasferimento dati da ${device.ip_address} (offline) a ${conflictDevice.ip_address} (online)`);

                // Trasferisci i dati al dispositivo online (solo se non ha già dati)
                const updatesConflict = [];
                const valuesConflict = [];
                let paramIndexConflict = 1;

                // Ottieni i dati del dispositivo offline
                const offlineDeviceData = await pool.query(
                  `SELECT device_type, device_path, device_username, hostname, vendor, previous_ip
                   FROM network_devices WHERE id = $1`,
                  [device.id]
                );

                if (offlineDeviceData.rows.length > 0) {
                  const offlineData = offlineDeviceData.rows[0];

                  // Trasferisci device_type se il dispositivo online non ce l'ha
                  if (offlineData.device_type && !conflictDevice.device_type) {
                    updatesConflict.push(`device_type = $${paramIndexConflict++}`);
                    valuesConflict.push(offlineData.device_type);
                  }

                  // Trasferisci device_path se il dispositivo online non ce l'ha
                  if (offlineData.device_path && !conflictDevice.device_path) {
                    updatesConflict.push(`device_path = $${paramIndexConflict++}`);
                    valuesConflict.push(offlineData.device_path);
                  }

                  // Trasferisci device_username se il dispositivo online non ce l'ha
                  if (offlineData.device_username && !conflictDevice.device_username) {
                    updatesConflict.push(`device_username = $${paramIndexConflict++}`);
                    valuesConflict.push(offlineData.device_username);
                  }

                  // Imposta previous_ip sul dispositivo online se non ce l'ha
                  if (offlineData.previous_ip && !conflictDevice.previous_ip) {
                    updatesConflict.push(`previous_ip = $${paramIndexConflict++}`);
                    valuesConflict.push(offlineData.previous_ip);
                  } else if (!conflictDevice.previous_ip) {
                    // Se non c'era previous_ip, usa l'IP del dispositivo offline
                    updatesConflict.push(`previous_ip = $${paramIndexConflict++}`);
                    valuesConflict.push(device.ip_address.replace(/[{}"]/g, '').trim());
                  }

                  // Aggiorna il dispositivo online con i dati trasferiti
                  if (updatesConflict.length > 0) {
                    valuesConflict.push(conflictDevice.id);
                    await pool.query(
                      `UPDATE network_devices SET ${updatesConflict.join(', ')} WHERE id = $${paramIndexConflict}`,
                      valuesConflict
                    );
                    console.log(`    ✅ Dati trasferiti al dispositivo ${conflictDevice.ip_address}`);
                  }
                }

                // Svuota i dati del dispositivo offline (mantieni solo MAC e previous_ip se presente)
                await pool.query(
                  `UPDATE network_devices 
                   SET status = 'offline', device_type = NULL, device_path = NULL, device_username = NULL, hostname = NULL, vendor = NULL
                   WHERE id = $1`,
                  [device.id]
                );
                console.log(`    🧹 Dati svuotati per dispositivo offline ${device.ip_address}`);
              } else {
                // Nessun conflitto, marca semplicemente offline
                await pool.query(
                  'UPDATE network_devices SET status = $1 WHERE id = $2',
                  ['offline', device.id]
                );
                console.log(`    📴 Dispositivo ${device.ip_address} marcato come offline`);
              }
            } else {
              // Nessun MAC, marca semplicemente offline
              await pool.query(
                'UPDATE network_devices SET status = $1 WHERE id = $2',
                ['offline', device.id]
              );
              console.log(`    📴 Dispositivo ${device.ip_address} marcato come offline`);
            }

            // Invia notifica Telegram (controlla modalità continua vs schedulata)
            if (shouldNotifyForEvent(device, 'status_changed')) {
              try {
                const agentInfo = await pool.query(
                  'SELECT na.agent_name, na.azienda_id, u.azienda as azienda_name FROM network_agents na LEFT JOIN users u ON na.azienda_id = u.id WHERE na.id = $1',
                  [agentId]
                );

                if (agentInfo.rows.length > 0) {
                  await sendTelegramNotification(
                    agentId,
                    agentInfo.rows[0].azienda_id,
                    'status_changed',
                    {
                      hostname: device.hostname,
                      deviceType: device.device_type,
                      ip: device.ip_address,
                      mac: device.mac_address,
                      oldStatus: 'online',
                      status: 'offline',
                      agentName: agentInfo.rows[0].agent_name,
                      aziendaName: agentInfo.rows[0].azienda_name
                    }
                  );
                }
              } catch (telegramErr) {
                console.error('❌ Errore invio notifica Telegram per dispositivo offline:', telegramErr);
              }
            }
          }
        }

        // Rileva dispositivi tornati online (erano offline e ora sono nella scansione)
        const devicesToMarkOnline = allAgentDevices.rows.filter(device => {
          const normalizedDeviceIp = (device.ip_address || '').replace(/[{}"]/g, '').trim();
          return normalizedReceivedIPs.has(normalizedDeviceIp) && device.status === 'offline';
        });

        if (devicesToMarkOnline.length > 0) {
          console.log(`  🟢 Marcatura ${devicesToMarkOnline.length} dispositivi come online (tornati online)`);

          for (const device of devicesToMarkOnline) {
            await pool.query(
              'UPDATE network_devices SET status = $1, last_seen = NOW() WHERE id = $2',
              ['online', device.id]
            );
            console.log(`    ✅ Dispositivo ${device.ip_address} marcato come online`);

            // Invia notifica Telegram (controlla modalità continua vs schedulata)
            if (shouldNotifyForEvent(device, 'status_changed')) {
              try {
                const agentInfo = await pool.query(
                  'SELECT na.agent_name, na.azienda_id, u.azienda as azienda_name FROM network_agents na LEFT JOIN users u ON na.azienda_id = u.id WHERE na.id = $1',
                  [agentId]
                );

                if (agentInfo.rows.length > 0) {
                  await sendTelegramNotification(
                    agentId,
                    agentInfo.rows[0].azienda_id,
                    'status_changed',
                    {
                      hostname: device.hostname,
                      deviceType: device.device_type,
                      ip: device.ip_address,
                      mac: device.mac_address,
                      oldStatus: 'offline',
                      status: 'online',
                      agentName: agentInfo.rows[0].agent_name,
                      aziendaName: agentInfo.rows[0].azienda_name
                    }
                  );
                }
              } catch (telegramErr) {
                console.error('❌ Errore invio notifica Telegram per dispositivo online:', telegramErr);
              }
            }
          }
        }
      } catch (offlineErr) {
        console.error('❌ Errore durante marcatura dispositivi offline:', offlineErr);
        // Non interrompere il processo, continua con i cambiamenti
      }

      // Gestisci cambiamenti (se forniti dall'agent)
      let changeResults = [];
      if (changes && Array.isArray(changes)) {
        for (const change of changes) {
          const { device_ip, change_type, old_value, new_value } = change;

          // Trova device_id dal IP
          const deviceResult = await pool.query(
            'SELECT id FROM network_devices WHERE agent_id = $1 AND ip_address = $2',
            [agentId, device_ip]
          );

          if (deviceResult.rows.length > 0) {
            const deviceId = deviceResult.rows[0].id;

            // Aggiorna status del dispositivo se il cambiamento è device_offline o device_online
            if (change_type === 'device_offline') {
              await pool.query(
                'UPDATE network_devices SET status = $1 WHERE id = $2',
                ['offline', deviceId]
              );
            } else if (change_type === 'device_online') {
              await pool.query(
                'UPDATE network_devices SET status = $1, last_seen = NOW() WHERE id = $2',
                ['online', deviceId]
              );
            }

            // Verifica se è un dispositivo con notifiche Telegram attive
            try {
              const deviceCheck = await pool.query(
                'SELECT notify_telegram, hostname, ip_address, mac_address, status, device_type FROM network_devices WHERE id = $1',
                [deviceId]
              );

              if (deviceCheck.rows.length > 0 && deviceCheck.rows[0].notify_telegram) {
                const device = deviceCheck.rows[0];
                const agentInfo = await pool.query(
                  'SELECT na.agent_name, na.azienda_id, u.username as azienda_name FROM network_agents na LEFT JOIN users u ON na.azienda_id = u.id WHERE na.id = $1',
                  [agentId]
                );

                if (agentInfo.rows.length > 0) {
                  await sendTelegramNotification(
                    agentId,
                    agentInfo.rows[0].azienda_id,
                    'status_changed',
                    {
                      hostname: device.hostname,
                      deviceType: device.device_type,
                      ip: device.ip_address,
                      mac: device.mac_address,
                      oldStatus: change_type === 'device_offline' ? 'online' : 'offline',
                      status: change_type === 'device_offline' ? 'offline' : 'online',
                      agentName: agentInfo.rows[0].agent_name,
                      aziendaName: agentInfo.rows[0].azienda_name
                    }
                  );
                }
              }
            } catch (telegramErr) {
              console.error('❌ Errore invio notifica Telegram per cambio status:', telegramErr);
            }

            // Verifica se questo IP è configurato per notifiche
            const notificationConfig = await pool.query(
              'SELECT enabled FROM network_notification_config WHERE agent_id = $1 AND ip_address = $2',
              [agentId, device_ip]
            );

            const shouldNotify = notificationConfig.rows.length > 0 && notificationConfig.rows[0].enabled;

            const changeResult = await pool.query(
              `INSERT INTO network_changes (device_id, agent_id, change_type, old_value, new_value, notification_ip)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id`,
              [
                deviceId,
                agentId,
                change_type,
                old_value || null,
                new_value || null,
                shouldNotify ? device_ip : null
              ]
            );

            changeResults.push({ id: changeResult.rows[0].id, change_type, notified: shouldNotify });
          }
        }
      }

      // Aggiorna sempre last_heartbeat quando arrivano scan-results (l'agent è attivo)
      // Se l'agent può inviare dati, significa che è online
      try {
        const agentStatusCheck = await pool.query(
          'SELECT status, last_heartbeat FROM network_agents WHERE id = $1',
          [agentId]
        );

        if (agentStatusCheck.rows.length > 0) {
          const previousStatus = agentStatusCheck.rows[0].status;
          const lastHeartbeat = agentStatusCheck.rows[0].last_heartbeat;
          const wasOffline = previousStatus === 'offline';

          // Aggiorna SEMPRE last_heartbeat quando arrivano scan-results (indica attività)
          // Aggiorna status a 'online' solo se era offline
          if (wasOffline) {
            await pool.query(
              `UPDATE network_agents 
               SET status = 'online', last_heartbeat = NOW(), updated_at = NOW()
               WHERE id = $1`,
              [agentId]
            );

            console.log(`🟢 Agent ${agentId} (${req.agent.agent_name || 'N/A'}) aggiornato a online tramite scan-results (era offline)`);

            // Emetti evento WebSocket per aggiornare la lista agenti in tempo reale
            if (io) {
              io.to(`role:tecnico`).to(`role:admin`).emit('network-monitoring-update', {
                type: 'agent-status-changed',
                agentId,
                status: 'online'
              });
            }
          } else {
            // Se era già online, aggiorna solo last_heartbeat (per evitare che checkOfflineAgents lo marchi come offline)
            await pool.query(
              `UPDATE network_agents 
               SET last_heartbeat = NOW(), updated_at = NOW()
               WHERE id = $1`,
              [agentId]
            );
          }

          // Crea evento "tornato online" nella tabella network_agent_events solo se era offline
          if (wasOffline) {
            try {
              await ensureTables();

              // Risolvi eventuali eventi offline precedenti
              await pool.query(
                `UPDATE network_agent_events 
                 SET resolved_at = NOW()
                 WHERE agent_id = $1 
                   AND event_type = 'offline' 
                   AND resolved_at IS NULL`,
                [agentId]
              );

              // Calcola durata offline
              const offlineDuration = lastHeartbeat ? Math.floor((Date.now() - new Date(lastHeartbeat).getTime()) / 60000) : 0;

              // Verifica se esiste già un evento online recente (ultimi 2 minuti)
              const existingOnline = await pool.query(
                `SELECT id FROM network_agent_events 
                 WHERE agent_id = $1 
                   AND event_type = 'online' 
                   AND detected_at > NOW() - INTERVAL '2 minutes'
                 LIMIT 1`,
                [agentId]
              );

              if (existingOnline.rows.length === 0) {
                await pool.query(
                  `INSERT INTO network_agent_events (agent_id, event_type, event_data, detected_at, notified)
                   VALUES ($1, 'online', $2, NOW(), FALSE)`,
                  [agentId, JSON.stringify({
                    offline_duration_minutes: offlineDuration,
                    last_heartbeat_before: lastHeartbeat,
                    detected_at: new Date().toISOString(),
                    source: 'scan-results'
                  })]
                );

                console.log(`📝 Evento "Agent Online" creato per agent ${agentId} (era offline da ${offlineDuration} min)`);

                // Emetti evento WebSocket
                if (io) {
                  io.to(`role:tecnico`).to(`role:admin`).emit('agent-event', {
                    agentId,
                    eventType: 'online',
                    message: `Agent ${req.agent.agent_name || agentId} tornato online`,
                    detectedAt: new Date().toISOString()
                  });
                }
              }
            } catch (eventErr) {
              console.error('❌ Errore creazione evento agent online da scan-results:', eventErr);
              // Non bloccare il processo, continua
            }
          }
        }
      } catch (statusErr) {
        console.error('❌ Errore aggiornamento status agent da scan-results:', statusErr);
        // Non bloccare il processo, continua
      }

      // Emetti evento WebSocket per aggiornare dashboard in tempo reale
      if (io && (deviceResults.length > 0 || changeResults.length > 0)) {
        io.emit('network-monitoring-update', {
          agent_id: agentId,
          azienda_id: req.agent.azienda_id,
          devices: deviceResults,
          changes: changeResults
        });
      }

      console.log(`✅ Scan results processati: ${deviceResults.length} dispositivi, ${changeResults.length} cambiamenti`);
      res.json({
        success: true,
        devices_processed: deviceResults.length,
        changes_processed: changeResults.length
      });
    } catch (err) {
      console.error('❌ Errore ricezione scan results:', err);
      console.error('   Messaggio:', err.message);
      console.error('   Codice:', err.code);
      console.error('   Dettagli:', err.detail);
      console.error('   Stack:', err.stack);
      console.error('   Agent ID:', req.agent?.id);
      console.error('   Devices count:', req.body?.devices?.length);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/clients
  // Ottieni lista aziende che hanno almeno un agent attivo
  router.get('/clients', authenticateToken, async (req, res) => {
    try {
      await ensureTables();

      const result = await pool.query(`
        SELECT DISTINCT u.id, u.azienda 
        FROM network_agents na 
        INNER JOIN users u ON na.azienda_id = u.id 
        WHERE na.deleted_at IS NULL
        ORDER BY u.azienda
      `);

      res.json(result.rows);
    } catch (err) {
      console.error('❌ Errore recupero clienti monitoring:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/clients/:aziendaId/devices
  // Ottieni lista dispositivi per un'azienda (per frontend)
  router.get('/clients/:aziendaId/devices', async (req, res) => {
    try {
      await ensureTables();

      // Assicurati che le colonne is_static, device_path, previous_ip, previous_mac, device_username esistano (migrazione)
      try {
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS is_static BOOLEAN DEFAULT false;
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS device_path TEXT;
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS previous_ip VARCHAR(45);
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS previous_mac VARCHAR(17);
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS device_username TEXT;
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS accepted_ip VARCHAR(45);
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS accepted_mac VARCHAR(17);
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS is_gateway BOOLEAN DEFAULT false;
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS parent_device_id INTEGER REFERENCES network_devices(id) ON DELETE SET NULL;
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS port INTEGER;
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS notes TEXT;
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS is_manual_type BOOLEAN DEFAULT false;
        `);
      } catch (migrationErr) {
        // Ignora errore se colonna esiste già
        if (!migrationErr.message.includes('already exists') && !migrationErr.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonne in clients/:aziendaId/devices:', migrationErr.message);
        }
      }

      // Migrazione: pulisci IP nel formato JSON errato e rimuovi duplicati
      try {
        // 1. Pulisci IP nel formato errato {"192.168.100.2"} -> 192.168.100.2
        await pool.query(`
          UPDATE network_devices 
          SET ip_address = REGEXP_REPLACE(ip_address, '[{}"]', '', 'g')
          WHERE ip_address ~ '[{}"]';
        `);

        // 2. Rimuovi duplicati: mantieni il dispositivo più recente o quello con più dati
        await pool.query(`
          DELETE FROM network_devices nd1
          WHERE EXISTS (
            SELECT 1 FROM network_devices nd2
            WHERE nd2.agent_id = nd1.agent_id
              AND REGEXP_REPLACE(nd2.ip_address, '[{}"]', '', 'g') = REGEXP_REPLACE(nd1.ip_address, '[{}"]', '', 'g')
              AND nd2.id > nd1.id
              AND (
                nd2.last_seen > nd1.last_seen
                OR (nd2.last_seen = nd1.last_seen AND nd2.id > nd1.id)
                OR (nd2.mac_address IS NOT NULL AND nd1.mac_address IS NULL)
                OR (nd2.hostname IS NOT NULL AND nd1.hostname IS NULL)
              )
          );
        `);

        // 3. Rimuovi eventuali duplicati rimanenti mantenendo solo quello con ID maggiore
        await pool.query(`
          DELETE FROM network_devices nd1
          WHERE EXISTS (
            SELECT 1 FROM network_devices nd2
            WHERE nd2.agent_id = nd1.agent_id
              AND nd2.ip_address = nd1.ip_address
              AND nd2.id > nd1.id
          );
        `);
      } catch (migrationErr) {
        console.warn('⚠️ Avviso pulizia IP duplicati:', migrationErr.message);
      }

      const aziendaIdParam = req.params.aziendaId;
      console.log('🔍 Route /clients/:aziendaId/devices - aziendaIdParam:', aziendaIdParam, 'type:', typeof aziendaIdParam);
      const aziendaId = parseInt(aziendaIdParam, 10);
      console.log('🔍 Route /clients/:aziendaId/devices - aziendaId parsed:', aziendaId, 'type:', typeof aziendaId, 'isNaN:', isNaN(aziendaId));

      if (isNaN(aziendaId) || aziendaId <= 0) {
        console.error('❌ ID azienda non valido:', aziendaIdParam, 'parsed:', aziendaId);
        return res.status(400).json({ error: 'ID azienda non valido' });
      }

      console.log('🔍 Eseguendo query con aziendaId:', aziendaId);

      // MIGRATION (AUTO-FIX): Normalizza MAC address nel DB (da - a :) per coerenza immediata
      try {
        await pool.query(`
          UPDATE network_devices 
          SET mac_address = REPLACE(mac_address, '-', ':') 
          WHERE mac_address LIKE '%-%' 
          AND agent_id IN (SELECT id FROM network_agents WHERE azienda_id = $1)
        `, [aziendaId]);
      } catch (e) { console.error('Error normalizing MACs:', e); }

      const result = await pool.query(
        `SELECT 
          nd.id, nd.ip_address, REPLACE(nd.mac_address, '-', ':') as mac_address, 
          CASE 
            WHEN nd.hostname IS NULL OR nd.hostname = '' THEN NULL
            WHEN nd.hostname LIKE '{%' THEN 
              -- Estrae il primo valore da array JSON come stringa (es: {"Android_RPRTJQAR.local", ...})
              REGEXP_REPLACE(
                SPLIT_PART(REGEXP_REPLACE(nd.hostname, '^[{\s"]+', ''), '",', 1),
                '["\s]+$', ''
              )
            WHEN LENGTH(nd.hostname) > 100 THEN LEFT(nd.hostname, 97) || '...'
            ELSE REGEXP_REPLACE(nd.hostname, '^[{\s"]+', '')  -- Rimuovi caratteri JSON iniziali
          END as hostname,
          nd.vendor, 
          nd.device_type, nd.device_path, nd.device_username, nd.status, nd.is_static, nd.notify_telegram, nd.monitoring_schedule, nd.first_seen, nd.last_seen,
          nd.previous_ip, nd.previous_mac, nd.has_ping_failures, nd.ping_responsive, nd.upgrade_available, nd.is_gateway, nd.parent_device_id, nd.port, nd.notes, nd.is_manual_type,
          na.agent_name, na.last_heartbeat as agent_last_seen, na.status as agent_status
         FROM network_devices nd
         INNER JOIN network_agents na ON nd.agent_id = na.id
         WHERE na.azienda_id = $1
         ORDER BY 
           CASE WHEN nd.is_gateway = true THEN 0 ELSE 1 END,
           -- Ordina prima gli IP validi (IPv4), poi gli altri (virtuali)
           CASE WHEN nd.ip_address ~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' THEN 0 ELSE 1 END,
           -- Ordinamento numerico ottetti IP
           CASE WHEN nd.ip_address ~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' THEN CAST(split_part(nd.ip_address, '.', 1) AS INTEGER) ELSE 0 END,
           CASE WHEN nd.ip_address ~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' THEN CAST(split_part(nd.ip_address, '.', 2) AS INTEGER) ELSE 0 END,
           CASE WHEN nd.ip_address ~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' THEN CAST(split_part(nd.ip_address, '.', 3) AS INTEGER) ELSE 0 END,
           CASE WHEN nd.ip_address ~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' THEN CAST(split_part(nd.ip_address, '.', 4) AS INTEGER) ELSE 0 END ASC`,
        [aziendaId]
      );

      // Ottimizzazione: carica la mappa KeePass UNA SOLA VOLTA invece di per ogni dispositivo
      const keepassPassword = process.env.KEEPASS_PASSWORD;
      let keepassMap = null;
      if (keepassPassword) {
        try {
          console.log('📥 Caricamento mappa KeePass (una volta per tutti i dispositivi)...');
          keepassMap = await keepassDriveService.getMacToTitleMap(keepassPassword);
          console.log(`✅ Mappa KeePass caricata: ${keepassMap.size} MAC address disponibili`);
        } catch (keepassErr) {
          console.warn('⚠️ Errore caricamento mappa KeePass:', keepassErr.message);
        }
      }

      // Processa i dispositivi in modo sincrono (veloce, senza chiamate async per ogni dispositivo)
      const processedRows = result.rows.map((row) => {
        // Post-processa hostname se necessario
        if (row.hostname && typeof row.hostname === 'string' && row.hostname.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(row.hostname);
            row.hostname = parsed._ !== undefined ? String(parsed._ || '') : row.hostname;
          } catch {
            // Mantieni originale se non è JSON valido
          }
        }

        // Cerca MAC nella mappa KeePass (già caricata)
        // IMPORTANTE: NON sovrascrivere device_type se è stato modificato manualmente (is_manual_type = true)
        if (row.mac_address && keepassMap && !row.is_manual_type) {
          try {
            // Normalizza il MAC per la ricerca
            const normalizedMac = row.mac_address.replace(/[:-]/g, '').toUpperCase();
            const keepassResult = keepassMap.get(normalizedMac);

            if (keepassResult) {
              // Estrai solo l'ultimo elemento del percorso
              const lastPathElement = keepassResult.path ? keepassResult.path.split(' > ').pop() : null;
              // NON sovrascrivere device_type se è stato modificato manualmente
              row.device_type = keepassResult.title;
              row.device_path = lastPathElement;
              row.device_username = keepassResult.username || null;
            }
            // Se non trovato, mantieni i valori esistenti dal database
          } catch (keepassErr) {
            // Non bloccare il processo se c'è un errore
            console.error(`❌ Errore ricerca MAC ${row.mac_address} in mappa KeePass:`, keepassErr.message);
          }
        }

        return row;
      });

      res.json(processedRows);
    } catch (err) {
      console.error('❌ Errore recupero dispositivi:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // PUT /api/network-monitoring/clients/:aziendaId/set-gateway/:deviceId
  // Imposta un dispositivo come Gateway Principale (e rimuovi flag dagli altri)
  router.put('/clients/:aziendaId/set-gateway/:deviceId', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
      const { aziendaId, deviceId } = req.params;

      // Trova l'agent ID dal dispositivo
      const deviceCheck = await client.query('SELECT agent_id FROM network_devices WHERE id = $1', [deviceId]);
      if (deviceCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Dispositivo non trovato' });
      }
      const agentId = deviceCheck.rows[0].agent_id;

      await client.query('BEGIN');

      // 1. Rimuovi is_gateway da tutti i dispositivi dell'agent
      await client.query('UPDATE network_devices SET is_gateway = false WHERE agent_id = $1', [agentId]);

      // 2. Imposta il nuovo gateway
      await client.query('UPDATE network_devices SET is_gateway = true WHERE id = $1', [deviceId]);

      await client.query('COMMIT');

      res.json({ success: true, message: 'Gateway impostato con successo' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Errore impostazione Gateway:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    } finally {
      client.release();
    }
  });

  // PUT /api/network-monitoring/clients/:aziendaId/set-parent/:childId
  // Imposta un dispositivo genitore per un altro dispositivo (Topologia manuale)
  router.put('/clients/:aziendaId/set-parent/:childId', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
      const { aziendaId, childId } = req.params;
      let parentIp = (req.body.parentIp || '').trim(); // IP del genitore desiderato

      // 1. Trova il device figlio e il suo agent_id
      const childResult = await client.query('SELECT id, agent_id FROM network_devices WHERE id = $1', [childId]);
      if (childResult.rows.length === 0) {
        return res.status(404).json({ error: 'Dispositivo figlio non trovato' });
      }
      const childDevice = childResult.rows[0];
      const agentId = childDevice.agent_id;

      let newParentId = null;

      if (parentIp) {
        // 2. Trova il device genitore tramite IP nello stesso agent
        // Gestiamo casi con {} o " nei vecchi dati se necessario, ma assumiamo IP puliti
        const parentResult = await client.query(
          `SELECT id FROM network_devices 
              WHERE agent_id = $1 
              AND REGEXP_REPLACE(ip_address, '[{}"]', '', 'g') = $2`,
          [agentId, parentIp]
        );

        if (parentResult.rows.length === 0) {
          return res.status(404).json({ error: `Nessun dispositivo trovato con IP ${parentIp}` });
        }

        if (parentResult.rows[0].id === parseInt(childId)) {
          return res.status(400).json({ error: 'Un dispositivo non può essere genitore di se stesso' });
        }

        newParentId = parentResult.rows[0].id;
      }

      await client.query('BEGIN');
      await client.query('UPDATE network_devices SET parent_device_id = $1 WHERE id = $2', [newParentId, childId]);
      await client.query('COMMIT');

      res.json({ success: true, message: 'Relazione parentela aggiornata', parent_id: newParentId });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Errore impostazione Parent:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    } finally {
      client.release();
    }
  });

  // --- Mappatura: nodi sulla mappa (persistenza) ---
  const ensureMappaturaNodesTable = async () => {
    try {
      // Prima verifica se la tabella esiste
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'mappatura_nodes'
        );
      `);

      const exists = tableExists.rows[0]?.exists;

      if (!exists) {
        // Crea tabella nuova con mac_address come chiave
        await pool.query(`
          CREATE TABLE mappatura_nodes (
            azienda_id INTEGER NOT NULL,
            mac_address VARCHAR(17) NOT NULL,
            x DOUBLE PRECISION,
            y DOUBLE PRECISION,
            is_locked BOOLEAN DEFAULT false,
            PRIMARY KEY (azienda_id, mac_address)
          );
        `);
      } else {
        // Tabella esiste: migra da device_id a mac_address se necessario
        try {
          // Verifica se esiste colonna mac_address
          const macColumnExists = await pool.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = 'mappatura_nodes' 
              AND column_name = 'mac_address'
            );
          `);

          if (!macColumnExists.rows[0]?.exists) {
            console.log('🔄 Migrazione mappatura_nodes: aggiungo colonna mac_address...');

            // Aggiungi colonna mac_address
            await pool.query(`ALTER TABLE mappatura_nodes ADD COLUMN mac_address VARCHAR(17)`);

            // Migra i dati: popola mac_address dai device_id esistenti
            await pool.query(`
              UPDATE mappatura_nodes mn
              SET mac_address = COALESCE(nd.mac_address, '')
              FROM network_devices nd
              WHERE mn.device_id = nd.id
                AND mn.mac_address IS NULL
            `);

            // Rimuovi righe senza MAC (non possono essere identificate)
            await pool.query(`
              DELETE FROM mappatura_nodes 
              WHERE mac_address IS NULL OR mac_address = ''
            `);

            // Imposta NOT NULL dopo aver popolato i dati
            await pool.query(`ALTER TABLE mappatura_nodes ALTER COLUMN mac_address SET NOT NULL`);

            // Rimuovi vecchia PRIMARY KEY se esiste
            try {
              await pool.query(`ALTER TABLE mappatura_nodes DROP CONSTRAINT IF EXISTS mappatura_nodes_pkey`);
            } catch (e) {
              // Ignora se non esiste
            }

            // Crea nuova PRIMARY KEY con mac_address
            await pool.query(`
              ALTER TABLE mappatura_nodes 
              ADD PRIMARY KEY (azienda_id, mac_address)
            `);

            // Rimuovi colonna device_id (non più necessaria)
            try {
              await pool.query(`ALTER TABLE mappatura_nodes DROP COLUMN IF EXISTS device_id`);
            } catch (e) {
              console.warn('⚠️ Impossibile rimuovere colonna device_id:', e.message);
            }

            console.log('✅ Migrazione mappatura_nodes completata: ora usa mac_address come chiave');
          }
        } catch (migrateErr) {
          console.warn('⚠️ Errore migrazione mappatura_nodes:', migrateErr.message);
        }
      }

      // Self-healing: ensure columns exist
      try {
        await pool.query(`ALTER TABLE mappatura_nodes ADD COLUMN IF NOT EXISTS azienda_id INTEGER`);
        await pool.query(`ALTER TABLE mappatura_nodes ADD COLUMN IF NOT EXISTS mac_address VARCHAR(17)`);
        await pool.query(`ALTER TABLE mappatura_nodes ADD COLUMN IF NOT EXISTS x DOUBLE PRECISION`);
        await pool.query(`ALTER TABLE mappatura_nodes ADD COLUMN IF NOT EXISTS y DOUBLE PRECISION`);
        await pool.query(`ALTER TABLE mappatura_nodes ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false`);
      } catch (alterErr) {
        console.warn('⚠️ ensureMappaturaNodesTable (alter):', alterErr.message);
      }

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_mappatura_nodes_azienda ON mappatura_nodes(azienda_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_mappatura_nodes_mac ON mappatura_nodes(mac_address);`);
    } catch (e) {
      if (!e.message?.includes('already exists') && !e.message?.includes('duplicate')) {
        console.warn('⚠️ ensureMappaturaNodesTable:', e.message, 'code:', e.code);
      }
    }
  };

  // GET /api/network-monitoring/clients/:aziendaId/mappatura-nodes
  router.get('/clients/:aziendaId/mappatura-nodes', authenticateToken, async (req, res) => {
    try {
      await ensureTables();
      await ensureMappaturaNodesTable();
      const aziendaId = parseInt(req.params.aziendaId, 10);
      if (isNaN(aziendaId) || aziendaId <= 0) return res.status(400).json({ error: 'ID azienda non valido' });

      // Normalizza MAC per il matching (rimuovi separatori)
      const normalizeMacForQuery = (mac) => {
        if (!mac) return null;
        return mac.replace(/[:-]/g, '').toUpperCase();
      };

      // Prima pulisci i nodi orfani (record in mappatura_nodes che non corrispondono a dispositivi attuali)
      await pool.query(
        `DELETE FROM mappatura_nodes mn
         WHERE mn.azienda_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM network_devices nd
             INNER JOIN network_agents na ON na.id = nd.agent_id AND na.azienda_id = $1
             WHERE REPLACE(REPLACE(REPLACE(REPLACE(UPPER(nd.mac_address), ':', ''), '-', ''), '.', ''), ' ', '') = 
                   REPLACE(REPLACE(REPLACE(REPLACE(UPPER(mn.mac_address), ':', ''), '-', ''), '.', ''), ' ', '')
               AND nd.mac_address IS NOT NULL
               AND nd.mac_address != ''
           )`,
        [aziendaId]
      );

      // Poi carica solo i nodi che corrispondono a dispositivi attuali
      const r = await pool.query(
        `SELECT mn.mac_address, mn.x, mn.y, mn.is_locked
         FROM mappatura_nodes mn
         INNER JOIN network_devices nd ON REPLACE(REPLACE(REPLACE(REPLACE(UPPER(nd.mac_address), ':', ''), '-', ''), '.', ''), ' ', '') = REPLACE(REPLACE(REPLACE(REPLACE(UPPER(mn.mac_address), ':', ''), '-', ''), '.', ''), ' ', '')
         INNER JOIN network_agents na ON na.id = nd.agent_id AND na.azienda_id = $1
         WHERE mn.azienda_id = $1
           AND nd.mac_address IS NOT NULL
           AND nd.mac_address != ''`,
        [aziendaId]
      );
      res.json(r.rows);
    } catch (err) {
      console.error('❌ Errore GET mappatura-nodes:', err.message, 'code:', err.code, 'detail:', err.detail);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // POST /api/network-monitoring/clients/:aziendaId/mappatura-nodes
  router.post('/clients/:aziendaId/mappatura-nodes', authenticateToken, async (req, res) => {
    try {
      await ensureTables();
      await ensureMappaturaNodesTable();
      const aziendaId = parseInt(req.params.aziendaId, 10);
      if (isNaN(aziendaId) || aziendaId <= 0) return res.status(400).json({ error: 'ID azienda non valido' });

      // Normalizza MAC per il matching
      const normalizeMac = (mac) => {
        if (!mac) return null;
        return mac.replace(/[:-]/g, '').toUpperCase();
      };

      // Normalizza input: array 'nodes' o singolo oggetto body
      let nodes = [];
      if (req.body.nodes && Array.isArray(req.body.nodes)) {
        nodes = req.body.nodes;
      } else if (req.body.mac_address || req.body.device_id) {
        nodes.push(req.body);
      } else {
        return res.status(400).json({ error: 'Parametri non validi (nodi richiesti)' });
      }

      for (const node of nodes) {
        // Cerca MAC address: può essere passato direttamente o recuperato da device_id
        let macAddress = node.mac_address;

        if (!macAddress && (node.id || node.device_id)) {
          // Se non c'è MAC ma c'è device_id, recuperalo dal database
          const deviceId = parseInt(node.id || node.device_id, 10);
          if (!isNaN(deviceId)) {
            const deviceResult = await pool.query(
              `SELECT mac_address FROM network_devices 
               WHERE id = $1 AND mac_address IS NOT NULL AND mac_address != ''`,
              [deviceId]
            );
            if (deviceResult.rows.length > 0) {
              macAddress = deviceResult.rows[0].mac_address;
            }
          }
        }

        if (!macAddress) {
          console.warn('⚠️ POST mappatura-nodes: MAC address non trovato per nodo', node);
          continue;
        }

        // Normalizza MAC
        const normalizedMac = normalizeMac(macAddress);
        if (!normalizedMac) continue;

        // Se undefined, passiamo null per usare COALESCE nel DB e mantenere valore attuale
        const x = node.x !== undefined ? parseFloat(node.x) : null;
        const y = node.y !== undefined ? parseFloat(node.y) : null;
        // Mappa 'locked' (frontend) a 'is_locked' (db)
        const isLocked = node.locked !== undefined ? !!node.locked : (node.is_locked !== undefined ? !!node.is_locked : null);

        // Upsert intelligente: mantiene i valori esistenti se i nuovi sono null (grazie a COALESCE)
        // Usa mac_address normalizzato come chiave
        // IMPORTANTE: Se x e y sono null (non specificati), mantiene i valori esistenti
        // Se x e y sono specificati (anche 0), aggiorna i valori
        await pool.query(
          `INSERT INTO mappatura_nodes (azienda_id, mac_address, x, y, is_locked)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (azienda_id, mac_address) 
           DO UPDATE SET 
             x = CASE WHEN EXCLUDED.x IS NOT NULL THEN EXCLUDED.x ELSE mappatura_nodes.x END,
             y = CASE WHEN EXCLUDED.y IS NOT NULL THEN EXCLUDED.y ELSE mappatura_nodes.y END,
             is_locked = COALESCE(EXCLUDED.is_locked, mappatura_nodes.is_locked)`,
          [aziendaId, normalizedMac, x, y, isLocked]
        );

        console.log(`💾 POST mappatura-nodes: salvato nodo per aziendaId=${aziendaId}, macAddress=${normalizedMac}, x=${x}, y=${y}, locked=${isLocked}`);
      }

      res.status(201).json({ success: true, processed: nodes.length });
    } catch (err) {
      console.error('❌ Errore POST mappatura-nodes:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // DELETE /api/network-monitoring/clients/:aziendaId/mappatura-nodes/:macAddress
  router.delete('/clients/:aziendaId/mappatura-nodes/:macAddress', authenticateToken, async (req, res) => {
    try {
      await ensureTables();
      await ensureMappaturaNodesTable();
      const aziendaId = parseInt(req.params.aziendaId, 10);
      let macAddress = req.params.macAddress;
      if (isNaN(aziendaId) || !macAddress) return res.status(400).json({ error: 'Parametri non validi' });

      // Decodifica il MAC dall'URL (potrebbe essere stato codificato con encodeURIComponent)
      macAddress = decodeURIComponent(macAddress);

      // Normalizza MAC (rimuovi separatori e converti in maiuscolo)
      const normalizedMac = macAddress.replace(/[:-]/g, '').toUpperCase();

      console.log(`🗑️ DELETE mappatura-nodes: aziendaId=${aziendaId}, macAddress=${macAddress}, normalizedMac=${normalizedMac}`);

      // Elimina usando normalizzazione flessibile per gestire qualsiasi formato di MAC nel database
      // Questo gestisce sia MAC salvati con separatori che senza
      const r = await pool.query(
        `DELETE FROM mappatura_nodes 
         WHERE azienda_id = $1 
         AND REPLACE(REPLACE(REPLACE(REPLACE(UPPER(mac_address), ':', ''), '-', ''), '.', ''), ' ', '') = $2 
         RETURNING mac_address`,
        [aziendaId, normalizedMac]
      );

      if (r.rows.length === 0) {
        console.warn(`⚠️ DELETE mappatura-nodes: nodo non trovato per aziendaId=${aziendaId}, macAddress=${normalizedMac}`);
        // Prova anche con il MAC esatto (per sicurezza)
        const r2 = await pool.query(
          'DELETE FROM mappatura_nodes WHERE azienda_id = $1 AND mac_address = $2 RETURNING mac_address',
          [aziendaId, normalizedMac]
        );
        if (r2.rows.length === 0) {
          return res.status(404).json({ error: 'Nodo mappatura non trovato' });
        }
        console.log(`✅ DELETE mappatura-nodes: nodo eliminato con successo (trovato con match esatto), macAddress=${r2.rows[0].mac_address}`);
        return res.json({ success: true });
      }

      console.log(`✅ DELETE mappatura-nodes: nodo eliminato con successo, macAddress=${r.rows[0].mac_address}`);
      res.json({ success: true });
    } catch (err) {
      console.error('❌ Errore DELETE mappatura-nodes:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // PUT /api/network-monitoring/clients/:aziendaId/mappatura-nodes/layout
  router.put('/clients/:aziendaId/mappatura-nodes/layout', authenticateToken, async (req, res) => {
    try {
      await ensureTables();
      await ensureMappaturaNodesTable();
      const aziendaId = parseInt(req.params.aziendaId, 10);
      if (isNaN(aziendaId) || aziendaId <= 0) return res.status(400).json({ error: 'ID azienda non valido' });

      // Normalizza MAC
      const normalizeMac = (mac) => {
        if (!mac) return null;
        return mac.replace(/[:-]/g, '').toUpperCase();
      };

      const nodes = Array.isArray(req.body.nodes) ? req.body.nodes : [];
      for (const n of nodes) {
        // Cerca MAC: può essere passato direttamente o recuperato da device_id/id
        let macAddress = n.mac_address;

        if (!macAddress && (n.id || n.device_id)) {
          // Se non c'è MAC ma c'è device_id, recuperalo dal database
          const deviceId = parseInt(n.id || n.device_id, 10);
          if (!isNaN(deviceId)) {
            const deviceResult = await pool.query(
              `SELECT mac_address FROM network_devices 
               WHERE id = $1 AND mac_address IS NOT NULL AND mac_address != ''`,
              [deviceId]
            );
            if (deviceResult.rows.length > 0) {
              macAddress = deviceResult.rows[0].mac_address;
            }
          }
        }

        if (!macAddress) continue;

        const normalizedMac = normalizeMac(macAddress);
        if (!normalizedMac) continue;

        const x = n.x != null ? parseFloat(n.x) : null;
        const y = n.y != null ? parseFloat(n.y) : null;
        await pool.query(
          `UPDATE mappatura_nodes SET x = $1, y = $2 WHERE azienda_id = $3 AND mac_address = $4`,
          [x, y, aziendaId, normalizedMac]
        );
      }
      res.json({ success: true });
    } catch (err) {
      console.error('❌ Errore PUT mappatura-nodes layout:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // --- Dispositivi gestiti (Switch SNMP) per topologia ---
  // GET /api/network-monitoring/clients/:aziendaId/managed-switches
  router.get('/clients/:aziendaId/managed-switches', authenticateToken, async (req, res) => {
    try {
      await ensureTables();
      const aziendaId = parseInt(req.params.aziendaId, 10);
      if (isNaN(aziendaId) || aziendaId <= 0) {
        return res.status(400).json({ error: 'ID azienda non valido' });
      }
      const r = await pool.query(
        'SELECT id, ip, snmp_community, snmp_version, name, created_at FROM managed_switches WHERE azienda_id = $1 ORDER BY name, ip',
        [aziendaId]
      );
      res.json(r.rows);
    } catch (err) {
      console.error('❌ Errore list managed-switches:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // POST /api/network-monitoring/clients/:aziendaId/managed-switches
  router.post('/clients/:aziendaId/managed-switches', authenticateToken, async (req, res) => {
    try {
      await ensureTables();
      const aziendaId = parseInt(req.params.aziendaId, 10);
      if (isNaN(aziendaId) || aziendaId <= 0) {
        return res.status(400).json({ error: 'ID azienda non valido' });
      }
      const ip = String(req.body.ip || '').trim();
      if (!ip) return res.status(400).json({ error: 'IP obbligatorio' });
      const snmp_community = String(req.body.snmp_community || 'public').trim() || 'public';
      const snmp_version = String(req.body.snmp_version || '2c').trim() || '2c';
      const name = req.body.name ? String(req.body.name).trim() : null;
      // UPSERT: se l'IP esiste già per questa azienda, aggiorna community/name invece di dare errore
      const r = await pool.query(
        `INSERT INTO managed_switches (azienda_id, ip, snmp_community, snmp_version, name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (azienda_id, ip) 
         DO UPDATE SET snmp_community = EXCLUDED.snmp_community, 
                        snmp_version = EXCLUDED.snmp_version,
                        name = EXCLUDED.name
         RETURNING id, ip, snmp_community, snmp_version, name, created_at`,
        [aziendaId, ip, snmp_community, snmp_version, name || null]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) {
      console.error('❌ Errore add managed-switches:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // DELETE /api/network-monitoring/clients/:aziendaId/managed-switches/:id
  router.delete('/clients/:aziendaId/managed-switches/:id', authenticateToken, async (req, res) => {
    try {
      await ensureTables();
      const aziendaId = parseInt(req.params.aziendaId, 10);
      const id = parseInt(req.params.id, 10);
      if (isNaN(aziendaId) || isNaN(id)) return res.status(400).json({ error: 'Parametri non validi' });
      const r = await pool.query('DELETE FROM managed_switches WHERE id = $1 AND azienda_id = $2 RETURNING id', [id, aziendaId]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Dispositivo gestito non trovato' });
      res.json({ success: true });
    } catch (err) {
      console.error('❌ Errore delete managed-switches:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // POST /api/network-monitoring/clients/:aziendaId/managed-switches/:id/sync
  // La sincronizzazione SNMP è eseguita dall'agent in locale (stessa LAN dello switch); il backend non può
  // raggiungere IP privati (es. 192.168.x) dal VPS. L'agent legge dot1dTpFdbPort e invia a
  // POST /agent/switch-address-table. Qui si restituisce solo un messaggio informativo.
  router.post('/clients/:aziendaId/managed-switches/:id/sync', authenticateToken, async (req, res) => {
    try {
      await ensureTables();
      const aziendaId = parseInt(req.params.aziendaId, 10);
      const id = parseInt(req.params.id, 10);
      if (isNaN(aziendaId) || isNaN(id)) return res.status(400).json({ error: 'Parametri non validi' });
      const sw = await pool.query('SELECT id FROM managed_switches WHERE id = $1 AND azienda_id = $2', [id, aziendaId]);
      if (sw.rows.length === 0) return res.status(404).json({ error: 'Dispositivo gestito non trovato' });

      res.json({
        success: true,
        message: "La sincronizzazione SNMP viene eseguita dall'agent sulla rete locale. I dati saranno aggiornati al prossimo ciclo (di solito entro pochi minuti). Ricaricare la mappa."
      });
    } catch (err) {
      console.error('❌ Errore sync managed-switch:', err);
      res.status(500).json({ error: err.message || 'Errore durante la sincronizzazione' });
    }
  });

  // GET /api/network-monitoring/clients/:aziendaId/changes
  // Ottieni storico cambiamenti per un'azienda (per frontend)
  router.get('/clients/:aziendaId/changes', async (req, res) => {
    try {
      await ensureTables();

      const { aziendaId } = req.params;
      const limit = parseInt(req.query.limit) || 100;

      const result = await pool.query(
        `SELECT 
          nc.id, nc.change_type, nc.old_value, nc.new_value, nc.detected_at, nc.notified,
          nd.ip_address, nd.mac_address, 
          CASE 
            WHEN nd.hostname IS NULL OR nd.hostname = '' THEN NULL
            WHEN nd.hostname LIKE '{%' THEN 
              -- Estrae il primo valore da array JSON come stringa (es: {"Android_RPRTJQAR.local", ...})
              REGEXP_REPLACE(
                SPLIT_PART(REGEXP_REPLACE(nd.hostname, '^[{\s"]+', ''), '",', 1),
                '["\s]+$', ''
              )
            WHEN LENGTH(nd.hostname) > 100 THEN LEFT(nd.hostname, 97) || '...'
            ELSE REGEXP_REPLACE(nd.hostname, '^[{\s"]+', '')  -- Rimuovi caratteri JSON iniziali
          END as hostname,
          nd.vendor,
          na.agent_name
         FROM network_changes nc
         INNER JOIN network_devices nd ON nc.device_id = nd.id
         INNER JOIN network_agents na ON nc.agent_id = na.id
         WHERE na.azienda_id = $1
         ORDER BY nc.detected_at DESC
         LIMIT $2`,
        [aziendaId, limit]
      );

      res.json(result.rows);
    } catch (err) {
      console.error('❌ Errore recupero cambiamenti:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/clients/:aziendaId/status
  // Ottieni status agent per un'azienda (per frontend)
  router.get('/clients/:aziendaId/status', async (req, res) => {
    try {
      await ensureTables();

      const { aziendaId } = req.params;

      const result = await pool.query(
        `SELECT 
          id, agent_name, status, last_heartbeat, version, 
          network_ranges, scan_interval_minutes, enabled, created_at
         FROM network_agents
         WHERE azienda_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [aziendaId]
      );

      res.json(result.rows);
    } catch (err) {
      console.error('❌ Errore recupero status agent:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/all/devices
  // Ottieni tutti i dispositivi di tutte le aziende (per dashboard principale)
  router.get('/all/devices', async (req, res) => {
    try {
      await ensureTables();

      // Assicurati che le colonne device_path, is_static, previous_ip, previous_mac esistano (migrazione)
      try {
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS device_path TEXT;
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS is_static BOOLEAN DEFAULT false;
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS previous_ip VARCHAR(45);
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS previous_mac VARCHAR(17);
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS has_ping_failures BOOLEAN DEFAULT false;
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS device_username TEXT;
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS accepted_ip VARCHAR(45);
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS accepted_mac VARCHAR(17);
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS is_gateway BOOLEAN DEFAULT false;
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS port INTEGER;
        `);
      } catch (migrationErr) {
        // Ignora errore se colonna esiste già
        if (!migrationErr.message.includes('already exists') && !migrationErr.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonne in all/devices:', migrationErr.message);
        }
      }

      const result = await pool.query(
        `SELECT 
          nd.id, nd.ip_address, nd.mac_address, 
          CASE 
            WHEN nd.hostname IS NULL OR nd.hostname = '' THEN NULL
            WHEN nd.hostname LIKE '{%' THEN 
              -- Estrae il primo valore da array JSON come stringa (es: {"Android_RPRTJQAR.local", ...})
              REGEXP_REPLACE(
                SPLIT_PART(REGEXP_REPLACE(nd.hostname, '^[{\s"]+', ''), '",', 1),
                '["\s]+$', ''
              )
            WHEN LENGTH(nd.hostname) > 100 THEN LEFT(nd.hostname, 97) || '...'
            ELSE REGEXP_REPLACE(nd.hostname, '^[{\s"]+', '')  -- Rimuovi caratteri JSON iniziali
          END as hostname,
          nd.vendor, 
          nd.device_type, nd.device_path, nd.device_username, nd.status, nd.is_static, nd.notify_telegram, nd.is_manual_type, nd.monitoring_schedule, nd.first_seen, nd.last_seen,
          nd.previous_ip, nd.previous_mac, nd.has_ping_failures, nd.ping_responsive, nd.upgrade_available, nd.notes,
          na.agent_name, na.azienda_id, na.last_heartbeat as agent_last_seen, na.status as agent_status,
          u.azienda
         FROM network_devices nd
         INNER JOIN network_agents na ON nd.agent_id = na.id
         LEFT JOIN users u ON na.azienda_id = u.id
         ORDER BY nd.last_seen DESC
         LIMIT 500`
      );

      // Ottimizzazione: carica la mappa KeePass UNA SOLA VOLTA invece di per ogni dispositivo
      const keepassPassword = process.env.KEEPASS_PASSWORD;
      let keepassMap = null;
      if (keepassPassword) {
        try {
          console.log('📥 Caricamento mappa KeePass (una volta per tutti i dispositivi)...');
          keepassMap = await keepassDriveService.getMacToTitleMap(keepassPassword);
          console.log(`✅ Mappa KeePass caricata: ${keepassMap.size} MAC address disponibili`);
        } catch (keepassErr) {
          console.warn('⚠️ Errore caricamento mappa KeePass:', keepassErr.message);
        }
      }

      // Processa i dispositivi in modo sincrono (veloce, senza chiamate async per ogni dispositivo)
      const processedRows = result.rows.map((row) => {
        // Post-processa hostname se necessario
        if (row.hostname && typeof row.hostname === 'string' && row.hostname.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(row.hostname);
            row.hostname = parsed._ !== undefined ? String(parsed._ || '') : row.hostname;
          } catch {
            // Mantieni originale se non è JSON valido
          }
        }

        // Cerca MAC nella mappa KeePass (già caricata) - SOLO se non è stato impostato manualmente
        if (row.mac_address && keepassMap && !row.is_manual_type) {
          try {
            // Normalizza il MAC per la ricerca
            const normalizedMac = row.mac_address.replace(/[:-]/g, '').toUpperCase();
            const keepassResult = keepassMap.get(normalizedMac);

            if (keepassResult) {
              // Estrai solo l'ultimo elemento del percorso
              const lastPathElement = keepassResult.path ? keepassResult.path.split(' > ').pop() : null;
              row.device_type = keepassResult.title;
              row.device_path = lastPathElement;
              row.device_username = keepassResult.username || null;
            }
            // Se non trovato, mantieni i valori esistenti dal database
          } catch (keepassErr) {
            // Non bloccare il processo se c'è un errore
            console.error(`❌ Errore ricerca MAC ${row.mac_address} in mappa KeePass:`, keepassErr.message);
          }
        }

        return row;
      });

      res.json(processedRows);
    } catch (err) {
      console.error('❌ Errore recupero tutti dispositivi:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/all/changes
  // Ottieni tutti i cambiamenti recenti (per dashboard principale)
  router.get('/all/changes', async (req, res) => {
    try {
      await ensureTables();

      const limit = parseInt(req.query.limit) || 200;
      const searchTerm = req.query.search ? req.query.search.trim() : '';
      const aziendaId = req.query.azienda_id ? parseInt(req.query.azienda_id) : null;

      // Assicurati che la colonna is_static esista (migrazione)
      try {
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS is_static BOOLEAN DEFAULT false;
        `);
      } catch (migrationErr) {
        // Ignora errore se colonna esiste già
        if (!migrationErr.message.includes('already exists') && !migrationErr.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonna is_static in all/changes:', migrationErr.message);
        }
      }

      // Costruisci condizioni di ricerca
      let searchConditions = '';
      let queryParams = [];
      let paramIndex = 1;

      if (searchTerm) {
        const searchPattern = `%${searchTerm}%`;
        // Normalizza il MAC per la ricerca (rimuove separatori)
        const normalizedMacSearch = searchTerm.replace(/[:-]/g, '').toUpperCase();
        const macSearchPattern = normalizedMacSearch.length >= 6 ? `%${normalizedMacSearch}%` : null;

        // Se il termine di ricerca sembra un MAC (almeno 6 caratteri esadecimali), cerca anche nel MAC normalizzato
        if (macSearchPattern) {
          searchConditions = `WHERE (
            nd.ip_address::text ILIKE $1 OR
            nd.mac_address ILIKE $1 OR
            REPLACE(REPLACE(UPPER(nd.mac_address), ':', ''), '-', '') ILIKE $2 OR
            nd.hostname ILIKE $1 OR
            nc.change_type::text ILIKE $1 OR
            nc.old_value ILIKE $1 OR
            nc.new_value ILIKE $1 OR
            na.agent_name ILIKE $1 OR
            COALESCE(u.azienda, '') ILIKE $1 OR
            nd.device_type ILIKE $1
          )`;
          queryParams.push(searchPattern, macSearchPattern);
        } else {
          searchConditions = `WHERE (
            nd.ip_address::text ILIKE $1 OR
            nd.mac_address ILIKE $1 OR
            nd.hostname ILIKE $1 OR
            nc.change_type::text ILIKE $1 OR
            nc.old_value ILIKE $1 OR
            nc.new_value ILIKE $1 OR
            na.agent_name ILIKE $1 OR
            COALESCE(u.azienda, '') ILIKE $1 OR
            nd.device_type ILIKE $1
          )`;
          queryParams.push(searchPattern);
        }
      }

      // Aggiungi filtro per azienda se specificato
      if (aziendaId) {
        if (searchConditions) {
          // Se c'è già una condizione WHERE, aggiungi AND per l'azienda
          searchConditions += ` AND na.azienda_id = $${queryParams.length + 1}`;
          queryParams.push(aziendaId);
        } else {
          // Altrimenti crea una nuova condizione WHERE per l'azienda
          searchConditions = `WHERE na.azienda_id = $1`;
          queryParams.push(aziendaId);
        }
      }

      // Se richiesto, conta i cambiamenti delle ultime 24 ore
      // IMPORTANTE: Esegui questa query PRIMA della query principale per evitare timeout
      let count24h = null;
      if (req.query.count24h === 'true') {
        try {
          // Costruisci la condizione per le ultime 24 ore (non da mezzanotte!)
          // Usa NOW() - INTERVAL '24 hours' per calcolare esattamente le ultime 24 ore
          // Riutilizza searchConditions che già include il filtro azienda se presente
          let count24hCondition = '';
          let countParams = [];

          if (searchConditions) {
            // Se c'è già una condizione WHERE (con ricerca e/o filtro azienda), aggiungi AND per le ultime 24 ore
            count24hCondition = searchConditions + ` AND nc.detected_at >= NOW() - INTERVAL '24 hours'`;
            countParams = [...queryParams];
          } else {
            // Altrimenti crea una nuova condizione WHERE per le ultime 24 ore
            // Se c'è un filtro azienda, aggiungilo anche qui
            const conditions = [];
            if (aziendaId) {
              conditions.push(`na.azienda_id = $1`);
              countParams.push(aziendaId);
            }
            conditions.push(`nc.detected_at >= NOW() - INTERVAL '24 hours'`);
            count24hCondition = `WHERE ${conditions.join(' AND ')}`;
          }

          // Query semplificata e veloce con COUNT DISTINCT per evitare duplicati
          // Conta solo cambiamenti unici basati su id, device_id, change_type e detected_at
          const countQuery = `
          SELECT COUNT(DISTINCT nc.id) as count
          FROM network_changes nc
          INNER JOIN network_devices nd ON nc.device_id = nd.id
          INNER JOIN network_agents na ON nc.agent_id = na.id
          LEFT JOIN users u ON na.azienda_id = u.id
          ${count24hCondition}
        `;

          // Timeout di 5 secondi per evitare 502
          const countPromise = pool.query(countQuery, countParams);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout dopo 5 secondi')), 5000)
          );

          const countResult = await Promise.race([countPromise, timeoutPromise]);
          count24h = parseInt(countResult.rows[0].count, 10);

          console.log(`📊 Conteggio cambiamenti ultime 24h: ${count24h} (query eseguita alle ${new Date().toISOString()})`);
        } catch (countErr) {
          console.warn('⚠️ Errore conteggio 24h (non critico):', countErr.message);
          // Non bloccare la risposta principale se il conteggio fallisce
          count24h = null;
        }
      }

      const result = await pool.query(
        `SELECT 
          nc.id, nc.change_type, nc.old_value, nc.new_value, nc.detected_at, nc.notified,
          nd.ip_address, nd.mac_address, 
          CASE 
            WHEN nd.hostname IS NULL OR nd.hostname = '' THEN NULL
            WHEN nd.hostname LIKE '{%' THEN 
              -- Estrae il primo valore da array JSON come stringa (es: {"Android_RPRTJQAR.local", ...})
              REGEXP_REPLACE(
                SPLIT_PART(REGEXP_REPLACE(nd.hostname, '^[{\s"]+', ''), '",', 1),
                '["\\s]+$', ''
              )
            WHEN LENGTH(nd.hostname) > 100 THEN LEFT(nd.hostname, 97) || '...'
            ELSE REGEXP_REPLACE(nd.hostname, '^[{\s"]+', '')  -- Rimuovi caratteri JSON iniziali
          END as hostname,
          nd.vendor, nd.device_type, nd.is_static,
          nd.device_path, nd.device_username,
          nd.device_type as keepass_title,
          nd.device_username as keepass_username,
          na.agent_name, na.azienda_id,
          u.azienda
         FROM network_changes nc
         INNER JOIN network_devices nd ON nc.device_id = nd.id
         INNER JOIN network_agents na ON nc.agent_id = na.id
         LEFT JOIN users u ON na.azienda_id = u.id
         ${searchConditions}
         ORDER BY nc.detected_at DESC
         LIMIT $${queryParams.length + 1}`,
        [...queryParams, limit]
      );


      // Restituisci anche il conteggio se richiesto
      if (count24h !== null) {
        res.json({ changes: result.rows, count24h });
      } else {
        res.json(result.rows);
      }
    } catch (err) {
      console.error('❌ Errore recupero tutti cambiamenti:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/all/events
  // Ottieni tutti gli eventi unificati (dispositivi + agent) con filtri avanzati
  router.get('/all/events', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();

      const limit = parseInt(req.query.limit) || 200;
      const searchTerm = req.query.search ? req.query.search.trim() : '';
      const aziendaId = req.query.azienda_id ? parseInt(req.query.azienda_id) : null;
      const networkParam = req.query.network ? req.query.network.trim() : '';
      const eventType = req.query.event_type || ''; // all, device, agent
      const count24h = req.query.count24h === 'true';

      // Query per eventi dispositivi (network_changes)
      const deviceEventsQuery = `
        SELECT 
          'device' as event_category,
          nc.id,
          nc.change_type as event_type,
          nc.detected_at,
          nd.ip_address,
          nd.mac_address,
          nd.hostname,
          nd.vendor,
          nd.device_type,
          nd.device_path,
          nd.device_username,
          nd.is_static,
          nd.has_ping_failures,
          nd.device_type as keepass_title,
          nd.device_username as keepass_username,
          nc.old_value,
          nc.new_value,
          na.agent_name,
          na.azienda_id,
          u.azienda,
          CASE 
            WHEN nc.change_type = 'new_device' THEN 'info'
            WHEN nc.change_type IN ('device_offline', 'mac_changed', 'ip_changed') THEN 'warning'
            WHEN nc.change_type = 'device_online' THEN 'info'
            ELSE 'info'
          END as severity,
          CASE
            -- Verifica se questo è il PRIMO evento ONLINE per questo MAC su questa rete
            -- Un dispositivo è "Nuovo" solo se è la prima volta che va online
            -- Gli eventi "Offline" NON contano per determinare se è nuovo
            WHEN nc.change_type IN ('new_device', 'device_online') AND NOT EXISTS (
              SELECT 1 
              FROM network_changes nc2
              INNER JOIN network_devices nd2 ON nc2.device_id = nd2.id
              WHERE nd2.mac_address = nd.mac_address
                AND nd2.agent_id = na.id
                AND nc2.detected_at < nc.detected_at
                AND nc2.change_type IN ('new_device', 'device_online')
            ) THEN true
            ELSE false
          END as is_new_device
        FROM network_changes nc
        INNER JOIN network_devices nd ON nc.device_id = nd.id
        INNER JOIN network_agents na ON nc.agent_id = na.id
        LEFT JOIN users u ON na.azienda_id = u.id
        WHERE 1=1
      `;

      // Query per eventi agent (network_agent_events)
      const agentEventsQuery = `
        SELECT 
          'agent' as event_category,
          nae.id,
          nae.event_type,
          nae.detected_at,
          NULL as ip_address,
          NULL as mac_address,
          NULL as hostname,
          NULL as vendor,
          NULL as device_type,
          NULL as device_path,
          NULL as device_username,
          false as is_static,
          false as has_ping_failures,
          NULL as keepass_title,
          NULL as keepass_username,
          NULL as old_value,
          NULL as new_value,
          na.agent_name,
          na.azienda_id,
          u.azienda,
          CASE 
            WHEN nae.event_type = 'offline' THEN 'critical'
            WHEN nae.event_type = 'online' THEN 'info'
            WHEN nae.event_type = 'reboot' THEN 'warning'
            WHEN nae.event_type = 'network_issue' THEN 'warning'
            ELSE 'info'
          END as severity,
          false as is_new_device
        FROM network_agent_events nae
        INNER JOIN network_agents na ON nae.agent_id = na.id
        LEFT JOIN users u ON na.azienda_id = u.id
        WHERE na.deleted_at IS NULL
      `;

      // Costruisci filtri
      let deviceFilters = '';
      let agentFilters = '';
      const params = [];
      let paramIndex = 1;

      // Filtro azienda
      if (aziendaId) {
        deviceFilters += ` AND na.azienda_id = $${paramIndex}`;
        agentFilters += ` AND na.azienda_id = $${paramIndex}`;
        params.push(aziendaId);
        paramIndex++;
      }

      // Filtro rete (network range)
      if (networkParam) {
        // Per i dispositivi, controlla se l'IP è nel range
        deviceFilters += ` AND nd.ip_address::inet <<= $${paramIndex}::inet`;

        // Per gli agent, controlla se l'agent monitora quella rete
        agentFilters += ` AND $${paramIndex} = ANY(na.network_ranges)`;

        params.push(networkParam);
        paramIndex++;
      }

      // Filtro ricerca
      if (searchTerm) {
        const searchPattern = `%${searchTerm}%`;
        deviceFilters += ` AND (
          nd.ip_address::text ILIKE $${paramIndex} OR
          nd.mac_address ILIKE $${paramIndex} OR
          nd.hostname ILIKE $${paramIndex} OR
          nc.change_type::text ILIKE $${paramIndex} OR
          na.agent_name ILIKE $${paramIndex} OR
          COALESCE(u.azienda, '') ILIKE $${paramIndex}
        )`;
        agentFilters += ` AND (
          nae.event_type::text ILIKE $${paramIndex} OR
          na.agent_name ILIKE $${paramIndex} OR
          COALESCE(u.azienda, '') ILIKE $${paramIndex}
        )`;
        params.push(searchPattern);
        paramIndex++;
      }

      // Query unificata
      let unifiedQuery = '';

      if (eventType === 'device') {
        unifiedQuery = deviceEventsQuery + deviceFilters;
      } else if (eventType === 'agent') {
        unifiedQuery = agentEventsQuery + agentFilters;
      } else {
        // Unisci entrambi
        unifiedQuery = `
          (${deviceEventsQuery}${deviceFilters})
          UNION ALL
          (${agentEventsQuery}${agentFilters})
        `;
      }

      // Ordina e limita
      unifiedQuery = `
        SELECT * FROM (${unifiedQuery}) as all_events
        ORDER BY detected_at DESC
        LIMIT $${paramIndex}
      `;
      params.push(limit);

      // DEBUG: Log query generata
      console.log('🔍 DEBUG Query unificata:', unifiedQuery);
      console.log('🔍 DEBUG Params:', params);

      // Esegui query
      const result = await pool.query(unifiedQuery, params);

      // Conta eventi ultime 24h se richiesto
      let count24hResult = null;
      if (count24h) {
        try {
          const count24hQuery = `
            SELECT COUNT(*) as count FROM (
              (${deviceEventsQuery}${deviceFilters} AND nc.detected_at >= NOW() - INTERVAL '24 hours')
              UNION ALL
              (${agentEventsQuery}${agentFilters} AND nae.detected_at >= NOW() - INTERVAL '24 hours')
            ) as recent_events
          `;
          const countResult = await pool.query(count24hQuery, params.slice(0, -1)); // Rimuovi limit
          count24hResult = parseInt(countResult.rows[0].count, 10);
        } catch (countErr) {
          console.warn('⚠️ Errore conteggio 24h eventi unificati:', countErr.message);
        }
      }

      // Restituisci risultati
      if (count24hResult !== null) {
        res.json({ events: result.rows, count24h: count24hResult });
      } else {
        res.json(result.rows);
      }
    } catch (err) {
      console.error('❌ Errore recupero eventi unificati:', err);
      res.status(500).json({ error: 'Errore interno del server', details: err.message });
    }
  });


  // GET /api/network-monitoring/companies
  // Ottieni lista aziende uniche dal progetto ticket (solo tecnici/admin)
  router.get('/companies', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      // Recupera tutte le aziende distinte dalla tabella users del progetto ticket
      // Query semplificata compatibile con tutte le versioni PostgreSQL
      const companiesResult = await pool.query(
        `SELECT DISTINCT 
          u.azienda,
          MIN(u.id) as id
         FROM users u
         WHERE u.azienda IS NOT NULL AND u.azienda != '' AND u.azienda != 'Senza azienda'
         GROUP BY u.azienda
         ORDER BY u.azienda ASC`
      );

      // Per ogni azienda, conta gli agent associati (solo quelli non cancellati)
      const companiesWithAgents = await Promise.all(
        companiesResult.rows.map(async (row) => {
          const agentCount = await pool.query(
            `SELECT COUNT(*) as count 
             FROM network_agents na
             INNER JOIN users u ON na.azienda_id = u.id
             WHERE u.azienda = $1 AND na.deleted_at IS NULL`,
            [row.azienda]
          );
          const count = parseInt(agentCount.rows[0].count) || 0;
          return {
            id: row.id,
            azienda: row.azienda,
            agents_count: count
          };
        })
      );

      // Restituisci TUTTE le aziende (anche quelle senza agent)
      res.json(companiesWithAgents);
    } catch (err) {
      console.error('❌ Errore recupero aziende:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/agents
  // Ottieni lista agent registrati (solo tecnici/admin)
  router.get('/agents', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();

      let result;
      try {
        // Prova prima con network_ranges_config
        result = await pool.query(
          `SELECT 
            na.id, na.agent_name, 
            COALESCE(na.status, 
              CASE WHEN na.last_heartbeat IS NOT NULL AND na.last_heartbeat > NOW() - INTERVAL '10 minutes' THEN 'online' ELSE 'offline' END
            ) as status,
            na.last_heartbeat, 
            na.version, na.network_ranges, na.network_ranges_config, na.scan_interval_minutes, na.unifi_config, na.enabled,
            na.unifi_last_ok, na.unifi_last_check_at,
            na.created_at, na.azienda_id, na.api_key,
            u.azienda
           FROM network_agents na
           LEFT JOIN users u ON na.azienda_id = u.id
           WHERE na.deleted_at IS NULL
           ORDER BY na.created_at DESC`
        );
      } catch (queryErr) {
        // Se la colonna network_ranges_config non esiste, usa solo network_ranges
        if (queryErr.message && queryErr.message.includes('network_ranges_config')) {
          console.warn('⚠️ Colonna network_ranges_config non trovata, uso solo network_ranges');
          result = await pool.query(
            `SELECT 
              na.id, na.agent_name, 
              COALESCE(na.status, 
                CASE WHEN na.last_heartbeat IS NOT NULL AND na.last_heartbeat > NOW() - INTERVAL '10 minutes' THEN 'online' ELSE 'offline' END
              ) as status,
              na.last_heartbeat, 
              na.version, na.network_ranges, na.scan_interval_minutes, na.enabled,
              na.unifi_last_ok, na.unifi_last_check_at,
              na.created_at, na.azienda_id, na.api_key,
              u.azienda
             FROM network_agents na
             LEFT JOIN users u ON na.azienda_id = u.id
             WHERE na.deleted_at IS NULL
             ORDER BY na.created_at DESC`
          );
        } else {
          throw queryErr;
        }
      }

      res.json(result.rows);
    } catch (err) {
      console.error('❌ Errore recupero agent:', err);
      console.error('❌ Stack trace:', err.stack);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // PUT /api/network-monitoring/agent/:id
  // Aggiorna un agent esistente (solo tecnici/admin)
  router.put('/agent/:id', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();

      const agentId = parseInt(req.params.id);
      const { agent_name, network_ranges_config, scan_interval_minutes, unifi_config } = req.body;

      if (!agentId) {
        return res.status(400).json({ error: 'ID agent richiesto' });
      }

      // Verifica che l'agent esista
      const checkResult = await pool.query(
        'SELECT id FROM network_agents WHERE id = $1 AND deleted_at IS NULL',
        [agentId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Agent non trovato' });
      }

      // Prepara i dati per l'aggiornamento
      let rangesConfig = null;
      let rangesArray = [];

      if (network_ranges_config && Array.isArray(network_ranges_config)) {
        // Nuovo formato: array di oggetti {range: "192.168.1.0/24", name: "LAN Principale"}
        rangesConfig = network_ranges_config;
        rangesArray = network_ranges_config.map(r => r.range);
      }

      // unifi_config: null se disabilitato, altrimenti oggetto { url, username, password } in JSONB
      const unifiPayload = (unifi_config === null || unifi_config === undefined)
        ? null
        : (typeof unifi_config === 'object' ? unifi_config : null);

      // Aggiorna l'agent
      const result = await pool.query(
        `UPDATE network_agents 
         SET agent_name = $1,
             network_ranges = $2,
             network_ranges_config = $3,
             scan_interval_minutes = $4,
             unifi_config = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING id, agent_name, network_ranges, network_ranges_config, scan_interval_minutes, unifi_config, unifi_last_ok, unifi_last_check_at, updated_at`,
        [
          agent_name || null,
          rangesArray,
          rangesConfig ? JSON.stringify(rangesConfig) : null,
          scan_interval_minutes || 15,
          unifiPayload,
          agentId
        ]
      );

      console.log(`✅ Agent aggiornato: ID=${agentId}`);
      res.json({ success: true, agent: result.rows[0] });
    } catch (err) {
      console.error('❌ Errore aggiornamento agent:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/company/:aziendaId/networks
  // Ottieni tutte le reti configurate per un'azienda (solo tecnici/admin)
  router.get('/company/:aziendaId/networks', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();

      const aziendaId = parseInt(req.params.aziendaId);

      if (!aziendaId) {
        return res.status(400).json({ error: 'ID azienda richiesto' });
      }

      // Ottieni tutti gli agent dell'azienda con le loro reti
      const result = await pool.query(
        `SELECT 
          na.id as agent_id,
          na.agent_name,
          na.network_ranges_config
         FROM network_agents na
         INNER JOIN users u ON na.azienda_id = u.id
         WHERE u.id = $1 AND na.deleted_at IS NULL
         ORDER BY na.agent_name`,
        [aziendaId]
      );

      // Estrai tutte le reti uniche da tutti gli agent
      const networksMap = new Map();

      result.rows.forEach(agent => {
        if (agent.network_ranges_config && Array.isArray(agent.network_ranges_config)) {
          agent.network_ranges_config.forEach(netConfig => {
            const key = netConfig.range;
            if (!networksMap.has(key)) {
              networksMap.set(key, {
                range: netConfig.range,
                name: netConfig.name || null,
                agent_name: agent.agent_name
              });
            }
          });
        }
      });

      // Converti la Map in array
      const networks = Array.from(networksMap.values());

      res.json(networks);
    } catch (err) {
      console.error('❌ Errore recupero reti azienda:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/agent/:id/config
  // Ottieni configurazione completa agent per download (solo tecnici/admin)
  router.get('/agent/:id/config', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);

      if (!agentId) {
        return res.status(400).json({ error: 'ID agent richiesto' });
      }

      await ensureTables();

      const result = await pool.query(
        `SELECT 
          na.id, na.agent_name, na.api_key, na.network_ranges, 
          na.scan_interval_minutes, na.created_at
         FROM network_agents na
         WHERE na.id = $1`,
        [agentId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Agent non trovato' });
      }

      const agent = result.rows[0];

      // Restituisci configurazione per download
      res.json({
        agent_id: agent.id,
        api_key: agent.api_key,
        agent_name: agent.agent_name,
        network_ranges: agent.network_ranges || [],
        scan_interval_minutes: agent.scan_interval_minutes || 15,
        created_at: agent.created_at
      });
    } catch (err) {
      console.error('❌ Errore recupero configurazione agent:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/agent/:id/download
  // Scarica pacchetto completo (ZIP con config.json + script .ps1)
  router.get('/agent/:id/download', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);

      if (!agentId) {
        return res.status(400).json({ error: 'ID agent richiesto' });
      }

      await ensureTables();

      const result = await pool.query(
        `SELECT 
          na.id, na.agent_name, na.api_key, na.network_ranges, 
          na.scan_interval_minutes
         FROM network_agents na
         WHERE na.id = $1`,
        [agentId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Agent non trovato' });
      }

      const agent = result.rows[0];

      // Path dei file agent (relativo alla root del progetto)
      // __dirname è backend/routes, quindi risaliamo di 2 livelli per arrivare alla root
      const projectRoot = path.resolve(__dirname, '..', '..');
      const agentDir = path.join(projectRoot, 'agent');
      const networkMonitorPath = path.join(agentDir, 'NetworkMonitor.ps1');
      const installerPath = path.join(agentDir, 'InstallerCompleto.ps1');
      const servicePath = path.join(agentDir, 'NetworkMonitorService.ps1');
      const trayIconPath = path.join(agentDir, 'NetworkMonitorTrayIcon.ps1');
      const installServicePath = path.join(agentDir, 'Installa-Servizio.ps1');
      const removeServicePath = path.join(agentDir, 'Rimuovi-Servizio.ps1');
      const installAutoPath = path.join(agentDir, 'Installa-Automatico.ps1');
      const installBatPath = path.join(agentDir, 'Installa.bat');
      const installServizioBatPath = path.join(agentDir, 'Installa-Servizio.bat');
      const installServizioBatchBatPath = path.join(agentDir, 'Installa-Servizio-Batch.bat');
      const readmeServicePath = path.join(agentDir, 'README_SERVICE.md');
      const guidaInstallazionePath = path.join(agentDir, 'GUIDA_INSTALLAZIONE_SERVIZIO.md');
      const diagnosticaPath = path.join(agentDir, 'Diagnostica-Agent.ps1');
      const diagnosticaServizioPath = path.join(agentDir, 'Diagnostica-Servizio.ps1');
      const riparaServizioPath = path.join(agentDir, 'Ripara-Servizio.ps1');
      const verificaServizioPath = path.join(agentDir, 'Verifica-Servizio.ps1');
      const disinstallaTuttoBatPath = path.join(agentDir, 'Disinstalla-Tutto.bat');
      const generaReportPath = path.join(agentDir, 'Genera-Report-Diagnostico.ps1');
      const diagnosticaRapidaPath = path.join(agentDir, 'Diagnostica-Rapida.ps1');
      const avviaTrayIconBatPath = path.join(agentDir, 'Avvia-TrayIcon.bat');

      console.log('📦 Download pacchetto agent - Path ricerca file:');
      console.log('  __dirname:', __dirname);
      console.log('  process.cwd():', process.cwd());
      console.log('  Project root:', projectRoot);
      console.log('  Agent dir:', agentDir);
      console.log('  NetworkMonitor.ps1:', networkMonitorPath);
      console.log('    exists:', fs.existsSync(networkMonitorPath));
      console.log('  InstallerCompleto.ps1:', installerPath);
      console.log('    exists:', fs.existsSync(installerPath));

      // Prova multiple path per trovare i file (fallback robusto)
      const possiblePaths = [
        { network: networkMonitorPath, installer: installerPath, label: 'path __dirname (default)' },
        { network: path.join(process.cwd(), 'agent', 'NetworkMonitor.ps1'), installer: path.join(process.cwd(), 'agent', 'InstallerCompleto.ps1'), label: 'path process.cwd()' },
        { network: path.join(projectRoot, 'agent', 'NetworkMonitor.ps1'), installer: path.join(projectRoot, 'agent', 'InstallerCompleto.ps1'), label: 'path projectRoot' }
      ];

      let networkMonitorContent, installerContent;
      let filesFound = false;
      let usedPath = null;

      for (const pathSet of possiblePaths) {
        console.log(`🔍 Tentativo path: ${pathSet.label}`);
        console.log(`   NetworkMonitor: ${pathSet.network} (exists: ${fs.existsSync(pathSet.network)})`);
        console.log(`   InstallerCompleto: ${pathSet.installer} (exists: ${fs.existsSync(pathSet.installer)})`);

        if (fs.existsSync(pathSet.network) && fs.existsSync(pathSet.installer)) {
          try {
            console.log(`✅ File trovati usando: ${pathSet.label}`);
            networkMonitorContent = fs.readFileSync(pathSet.network, 'utf8');
            installerContent = fs.readFileSync(pathSet.installer, 'utf8');
            filesFound = true;
            usedPath = pathSet.label;
            console.log(`✅ File letti con successo: NetworkMonitor.ps1 (${networkMonitorContent.length} caratteri), InstallerCompleto.ps1 (${installerContent.length} caratteri)`);
            break;
          } catch (readErr) {
            console.error(`❌ Errore lettura file da ${pathSet.label}:`, readErr.message);
            continue;
          }
        }
      }

      if (!filesFound) {
        const errorMsg = `File agent non trovati in nessuno dei path provati. Verifica che i file NetworkMonitor.ps1 e InstallerCompleto.ps1 siano presenti nella cartella agent/ del progetto.`;
        console.error('❌', errorMsg);
        console.error('  Path provati:');
        possiblePaths.forEach(p => {
          console.error(`    - ${p.label}: NetworkMonitor=${fs.existsSync(p.network)}, Installer=${fs.existsSync(p.installer)}`);
        });
        return res.status(500).json({ error: errorMsg });
      }

      // Versione agent per ZIP e config.json incluso (allineata a NetworkMonitorService.ps1 $SCRIPT_VERSION)
      const CURRENT_AGENT_VERSION = '2.6.0';
      const agentVersion = CURRENT_AGENT_VERSION;
      console.log(`ℹ️ Versione agent per ZIP: ${agentVersion}`);

      /* LOGICA LETTURA FILE DISABILITATA TEMPORANEAMENTE PER RISOLVERE PROBLEMA VERSIONE
      if (fs.existsSync(servicePath)) {
        // ... (codice rimosso per garantire l'update) ...
      } 
      */

      // Crea config.json
      const configJson = {
        server_url: req.protocol + '://' + req.get('host'),
        api_key: agent.api_key,
        agent_name: agent.agent_name,
        version: agentVersion,
        network_ranges: agent.network_ranges || [],
        scan_interval_minutes: agent.scan_interval_minutes || 15
      };

      // Nome file ZIP con versione
      const zipFileName = `NetworkMonitor-Agent-${agent.agent_name.replace(/\s+/g, '-')}-v${agentVersion}.zip`;

      console.log('📦 Creazione ZIP:', zipFileName);

      // Configura headers per download ZIP
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

      // Crea ZIP
      const archive = archiver('zip', {
        zlib: { level: 9 } // Massima compressione
      });

      console.log('✅ Archivio creato, aggiungo file...');

      // Gestisci errori
      archive.on('error', (err) => {
        console.error('❌ Errore creazione ZIP:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: `Errore creazione pacchetto: ${err.message}` });
        }
      });

      // Gestisci errori di risposta
      res.on('error', (err) => {
        console.error('❌ Errore invio risposta:', err);
        archive.abort();
      });

      // Pipe ZIP alla risposta
      archive.pipe(res);

      // Aggiungi file al ZIP - SOLO 4 FILE ESSENZIALI (tray, riparazione, ecc. si possono aggiungere dopo)
      try {
        // 1. config.json (generato)
        archive.append(JSON.stringify(configJson, null, 2), { name: 'config.json' });
        console.log('✅ Aggiunto config.json');

        // 2. NetworkMonitorService.ps1 (script principale servizio)
        if (fs.existsSync(servicePath)) {
          let serviceContent = fs.readFileSync(servicePath, 'utf8');
          if (serviceContent.charCodeAt(0) === 0xFEFF) { serviceContent = serviceContent.slice(1); }
          const openBraces = (serviceContent.match(/{/g) || []).length;
          const closeBraces = (serviceContent.match(/}/g) || []).length;
          if (openBraces !== closeBraces) {
            console.error(`❌ Parentesi graffe sbilanciate in NetworkMonitorService.ps1 (${openBraces}/${closeBraces})`);
          }
          archive.append(serviceContent, { name: 'NetworkMonitorService.ps1' });
          console.log('✅ Aggiunto NetworkMonitorService.ps1');
        }

        // 3. Installa-Agent.bat (entry point: doppio clic per installare)
        const installAgentBatPath = path.join(agentDir, 'Installa-Agent.bat');
        if (fs.existsSync(installAgentBatPath)) {
          archive.append(fs.readFileSync(installAgentBatPath, 'utf8'), { name: 'Installa-Agent.bat' });
          console.log('✅ Aggiunto Installa-Agent.bat');
        }

        // 4. nssm.exe (necessario per il servizio Windows)
        const nssmPath = path.join(agentDir, 'nssm.exe');
        if (fs.existsSync(nssmPath)) {
          archive.append(fs.readFileSync(nssmPath), { name: 'nssm.exe' });
          console.log('✅ Aggiunto nssm.exe');
        } else {
          console.warn('⚠️  nssm.exe non trovato! Installazione servizio potrebbe fallire.');
        }

      } catch (appendErr) {
        console.error('❌ Errore aggiunta file allo ZIP:', appendErr);
        if (!res.headersSent) {
          return res.status(500).json({ error: `Errore creazione ZIP: ${appendErr.message}` });
        }
      }

      // Aggiungi README
      const readmeContent = `# Network Monitor Agent - Installazione

## ⚠️ IMPORTANTE: Directory Installazione

I file devono rimanere nella directory di installazione dopo l'installazione!
Se cancelli questi file, l'agent smetterà di funzionare.

### Consigli:
- Estrai lo ZIP in una directory PERMANENTE (es: C:\\ProgramData\\NetworkMonitorAgent\\)
- NON nella cartella Download (viene spesso pulita automaticamente)
- Dopo l'installazione, NON cancellare i file

## File inclusi:
- config.json: Configurazione agent (API Key, reti, intervallo scansione)
- NetworkMonitor.ps1: Script principale agent (compatibilità)
- InstallerCompleto.ps1: Installer automatico (Scheduled Task - metodo vecchio)
- NetworkMonitorService.ps1: Script servizio Windows (NUOVO)
- Installa-Servizio.ps1: Installer servizio Windows (NUOVO - consigliato)
- Rimuovi-Servizio.ps1: Disinstaller servizio Windows (NUOVO)
- Installa-Automatico.ps1: Installer automatico completo (NUOVO)
- Installa.bat: Installer batch (doppio click - NUOVO)
- README_SERVICE.md: Documentazione servizio Windows (NUOVO)

## Installazione (3 metodi):

### Metodo 1: Installazione Automatica (PIÙ SEMPLICE - NUOVO! 🎉)
**Fai solo doppio click e segui le istruzioni!**

1. Estrai il ZIP in una directory (anche Desktop va bene)
2. **Fai doppio click su "Installa.bat"**
3. Clicca "Sì" quando Windows chiede autorizzazioni amministratore
4. Segui le istruzioni a schermo (premi invio quando richiesto)
5. Fine! Il servizio è installato in C:\\ProgramData\\NetworkMonitorAgent\\ automaticamente

**Cosa fa automaticamente:**
- ✅ Richiede privilegi admin (automatico)
- ✅ Copia tutti i file in C:\\ProgramData\\NetworkMonitorAgent\\
- ✅ Rimuove il vecchio Scheduled Task (se presente)
- ✅ Installa e avvia il servizio Windows
- ✅ Tutto senza aprire PowerShell manualmente!

### Metodo 2: Servizio Windows (Manuale)
Il servizio rimane sempre attivo, anche dopo riavvio, con icona nella system tray.

1. Estrarre tutti i file in una directory permanente (es: C:\\ProgramData\\NetworkMonitorAgent\\)
2. Esegui PowerShell come Amministratore
3. Esegui: .\\Installa-Servizio.ps1 -RemoveOldTask
4. Il servizio verrà installato e avviato automaticamente
5. (Opzionale) Per mostrare l'icona nella system tray: .\\NetworkMonitorService.ps1

Vedi README_SERVICE.md per dettagli completi.

### Metodo 3: Scheduled Task (Vecchio metodo - non consigliato)
Per compatibilità con installazioni esistenti.

1. Estrarre tutti i file in una directory permanente (es: C:\\ProgramData\\NetworkMonitorAgent\\)
2. Tasto destro su "InstallerCompleto.ps1" → "Esegui con PowerShell"
3. Inserire l'API Key quando richiesto (già presente in config.json, ma l'installer la richiederà per verifica)
4. L'installer configurerà tutto automaticamente

⚠️ NON cancellare i file dopo l'installazione! Devono rimanere nella directory.

## Configurazione Agent:
- Nome: ${agent.agent_name}
- Reti: ${(agent.network_ranges || []).join(', ')}
- Intervallo scansione: ${agent.scan_interval_minutes || 15} minuti

## Disinstallazione:

Usa la funzione "Elimina" nella dashboard TicketApp, oppure:
1. Apri PowerShell come Amministratore
2. Esegui: Unregister-ScheduledTask -TaskName "NetworkMonitorAgent" -Confirm:$false
3. Cancella la directory di installazione
`;
      archive.append(readmeContent, { name: 'README.txt' });
      console.log('✅ Aggiunto README.txt');

      // Crea installer batch con versione nel nome - SOLO COMANDI NATIVI, NO POWERSHELL
      const installBatFileName = `Installa-Agent-v${agentVersion}.bat`;

      // Leggi il contenuto di Installa-Agent.bat e sostituisci la versione
      let installBatContent;
      const installAgentBatPath = path.join(agentDir, 'Installa-Agent.bat');
      if (fs.existsSync(installAgentBatPath)) {
        installBatContent = fs.readFileSync(installAgentBatPath, 'utf8');
        // Sostituisci la versione nel file
        installBatContent = installBatContent.replace(/set "AGENT_VERSION=.*"/, `set "AGENT_VERSION=${agentVersion}"`);
      } else {
        // Fallback: crea un wrapper semplice che chiama Installa-Agent.bat
        installBatContent = `@echo off
REM Installa-Agent-v${agentVersion}.bat
REM Installer unico per Network Monitor Agent v${agentVersion}
REM SOLO COMANDI NATIVI WINDOWS - NO POWERSHELL

REM Verifica privilegi admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo Richiesta autorizzazioni amministratore...
    echo.
    powershell -Command "Start-Process '%~f0' -Verb RunAs -Wait"
    exit /b %errorLevel%
)

REM Esegui installer batch nativo
call "%~dp0Installa-Agent.bat"

pause
`;
      }
      archive.append(installBatContent, { name: installBatFileName });
      console.log(`✅ Aggiunto ${installBatFileName}`);

      // File servizio Windows - SOLO FILE ESSENZIALI
      try {
        // NetworkMonitorService.ps1
        if (fs.existsSync(servicePath)) {
          const serviceContent = fs.readFileSync(servicePath, 'utf8');
          archive.append(serviceContent, { name: 'NetworkMonitorService.ps1' });
          console.log('✅ Aggiunto NetworkMonitorService.ps1');
        } else {
          console.warn('⚠️  NetworkMonitorService.ps1 non trovato!');
        }

        // Rimuovi-Servizio.ps1 (utile per disinstallazione)
        if (fs.existsSync(removeServicePath)) {
          const removeServiceContent = fs.readFileSync(removeServicePath, 'utf8');
          archive.append(removeServiceContent, { name: 'Rimuovi-Servizio.ps1' });
          console.log('✅ Aggiunto Rimuovi-Servizio.ps1');
        }

        // Tray icon: necessari per riavviare l'icona dopo update o se non compare
        if (fs.existsSync(trayIconPath)) {
          archive.append(fs.readFileSync(trayIconPath, 'utf8'), { name: 'NetworkMonitorTrayIcon.ps1' });
          console.log('✅ Aggiunto NetworkMonitorTrayIcon.ps1');
        }
        const vbsTrayPath = path.join(agentDir, 'Start-TrayIcon-Hidden.vbs');
        if (fs.existsSync(vbsTrayPath)) {
          archive.append(fs.readFileSync(vbsTrayPath, 'utf8'), { name: 'Start-TrayIcon-Hidden.vbs' });
          console.log('✅ Aggiunto Start-TrayIcon-Hidden.vbs');
        }
        if (fs.existsSync(avviaTrayIconBatPath)) {
          archive.append(fs.readFileSync(avviaTrayIconBatPath, 'utf8'), { name: 'Avvia-TrayIcon.bat' });
          console.log('✅ Aggiunto Avvia-TrayIcon.bat');
        }

      } catch (serviceErr) {
        console.error('❌ Errore aggiunta file servizio allo ZIP:', serviceErr);
        // Non bloccare se i file servizio non sono disponibili (compatibilità)
      }

      // nssm.exe (CRITICO - AGGIUNTO FUORI DAL TRY-CATCH PER ESSERE SEMPRE ESEGUITO)
      console.log('');
      console.log('🔍 ===== AGGIUNTA NSSM.EXE =====');
      const possibleNssmPaths = [
        path.join(agentDir, 'nssm.exe'),
        path.join(projectRoot, 'agent', 'nssm.exe'),
        path.join(process.cwd(), 'agent', 'nssm.exe'),
        path.join(__dirname, '..', 'agent', 'nssm.exe')
      ];

      let nssmPath = null;
      let nssmAdded = false;

      console.log('🔍 Verifica nssm.exe in multiple percorsi:');
      for (const testPath of possibleNssmPaths) {
        const exists = fs.existsSync(testPath);
        console.log(`   ${exists ? '✅' : '❌'} ${testPath} (exists: ${exists})`);
        if (exists && !nssmPath) {
          nssmPath = testPath;
        }
      }

      if (nssmPath && fs.existsSync(nssmPath)) {
        try {
          console.log(`📦 Leggo nssm.exe da: ${nssmPath}`);
          const nssmContent = fs.readFileSync(nssmPath); // Legge come Buffer binario
          const nssmSize = nssmContent.length;
          console.log(`   Dimensione file: ${nssmSize} bytes`);
          console.log(`   Tipo: ${Buffer.isBuffer(nssmContent) ? 'Buffer' : typeof nssmContent}`);

          if (nssmSize === 0) {
            throw new Error('File nssm.exe è vuoto!');
          }

          if (!Buffer.isBuffer(nssmContent)) {
            throw new Error('Contenuto nssm.exe non è un Buffer!');
          }

          // Aggiungi come Buffer (stesso metodo degli altri file)
          archive.append(nssmContent, { name: 'nssm.exe' });
          console.log('✅✅✅ AGGIUNTO nssm.exe al ZIP (dimensione: ' + nssmSize + ' bytes) ✅✅✅');
          nssmAdded = true;
        } catch (nssmErr) {
          console.error('❌❌❌ ERRORE CRITICO aggiunta nssm.exe:', nssmErr);
          console.error('   Messaggio:', nssmErr.message);
          console.error('   Stack:', nssmErr.stack);
          throw new Error(`IMPOSSIBILE AGGIUNGERE nssm.exe: ${nssmErr.message}`);
        }
      } else {
        console.error('❌❌❌ ERRORE CRITICO: nssm.exe non trovato!');
        console.error('   Percorso cercato:', nssmPath);
        console.error('   Percorsi verificati:');
        possibleNssmPaths.forEach(p => {
          const exists = fs.existsSync(p);
          console.error(`     - ${p} (exists: ${exists})`);
        });
        console.error('   Agent dir:', agentDir);
        console.error('   Project root:', projectRoot);
        console.error('   Process cwd:', process.cwd());
        console.error('   __dirname:', __dirname);
        throw new Error('nssm.exe NON TROVATO in nessun percorso! Il pacchetto ZIP non può essere generato senza questo file.');
      }

      if (!nssmAdded) {
        throw new Error('nssm.exe NON AGGIUNTO al ZIP!');
      }

      console.log('🔍 ===== FINE AGGIUNTA NSSM.EXE =====');
      console.log('');

      // Finalizza ZIP
      await archive.finalize();

    } catch (err) {
      console.error('❌ Errore download pacchetto agent:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Errore interno del server' });
      }
    }
  });

  // GET /api/network-monitoring/agent/:id/diagnostics
  // Endpoint di diagnostica per capire perché un agent risulta offline
  router.get('/agent/:id/diagnostics', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();
      const agentId = parseInt(req.params.id);

      if (!agentId) {
        return res.status(400).json({ error: 'ID agent richiesto' });
      }

      // Recupera info agent
      const agentResult = await pool.query(
        `SELECT id, agent_name, status, last_heartbeat, enabled, deleted_at, 
                version, network_ranges, scan_interval_minutes, created_at, updated_at
         FROM network_agents
         WHERE id = $1`,
        [agentId]
      );

      if (agentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Agent non trovato' });
      }

      const agent = agentResult.rows[0];

      // Calcola minuti dall'ultimo heartbeat
      const minutesSinceLastHeartbeat = agent.last_heartbeat
        ? Math.floor((Date.now() - new Date(agent.last_heartbeat).getTime()) / 60000)
        : null;

      // Verifica se ci sono eventi offline non risolti
      let offlineEvents = [];
      try {
        const eventsResult = await pool.query(
          `SELECT id, event_type, detected_at, resolved_at, event_data
           FROM network_agent_events
           WHERE agent_id = $1 AND event_type = 'offline' AND resolved_at IS NULL
           ORDER BY detected_at DESC
           LIMIT 5`,
          [agentId]
        );
        offlineEvents = eventsResult.rows;
      } catch (eventsErr) {
        // Se la tabella non esiste, ignora
        if (eventsErr.code !== '42P01') {
          console.error('Errore query eventi offline:', eventsErr);
        }
      }

      // Verifica se l'agent dovrebbe essere offline secondo la logica di checkOfflineAgents
      const shouldBeOffline = agent.enabled && !agent.deleted_at && (
        (agent.status === 'online' && (agent.last_heartbeat === null || minutesSinceLastHeartbeat > 8)) ||
        (agent.status === 'offline' && offlineEvents.length === 0)
      );

      const diagnostics = {
        agent: {
          id: agent.id,
          name: agent.agent_name,
          status: agent.status,
          enabled: agent.enabled,
          deleted: agent.deleted_at !== null,
          version: agent.version,
          network_ranges: agent.network_ranges,
          scan_interval_minutes: agent.scan_interval_minutes,
          created_at: agent.created_at,
          updated_at: agent.updated_at
        },
        heartbeat: {
          last_heartbeat: agent.last_heartbeat,
          minutes_ago: minutesSinceLastHeartbeat,
          is_stale: minutesSinceLastHeartbeat === null || minutesSinceLastHeartbeat > 8,
          expected_interval_minutes: 5 // Agent invia ogni 5 minuti
        },
        events: {
          unresolved_offline_count: offlineEvents.length,
          unresolved_offline_events: offlineEvents.map(e => ({
            id: e.id,
            detected_at: e.detected_at,
            event_data: e.event_data
          }))
        },
        analysis: {
          should_be_offline: shouldBeOffline,
          reason: shouldBeOffline
            ? (agent.status === 'online' && minutesSinceLastHeartbeat > 8
              ? `Agent online ma senza heartbeat da ${minutesSinceLastHeartbeat} minuti (soglia: 8 min)`
              : `Agent offline ma senza evento offline non risolto`)
            : 'Agent dovrebbe essere online (heartbeat recente o evento offline risolto)',
          recommendation: minutesSinceLastHeartbeat === null || minutesSinceLastHeartbeat > 8
            ? `L'agent non sta inviando heartbeat. Verifica: 1) Il servizio è in esecuzione? 2) La connessione internet funziona? 3) L'API key è corretta? 4) Il server URL è raggiungibile?`
            : 'L\'agent sta inviando heartbeat regolarmente. Se risulta offline, potrebbe essere un problema di sincronizzazione del database.'
        }
      };

      res.json(diagnostics);
    } catch (err) {
      console.error('❌ Errore diagnostica agent:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // PUT /api/network-monitoring/agent/:id/disable
  // Disabilita un agent (blocca ricezione dati, ma NON disinstalla l'agent dal client)
  router.put('/agent/:id/disable', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);

      if (!agentId) {
        return res.status(400).json({ error: 'ID agent richiesto' });
      }

      await ensureTables();

      const result = await pool.query(
        `UPDATE network_agents 
         SET enabled = false, status = 'offline', updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id, agent_name, enabled`,
        [agentId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Agent non trovato o già eliminato' });
      }

      console.log(`🔴 Agent ${agentId} disabilitato (ricezione dati bloccata, agent rimane installato)`);
      res.json({ success: true, agent: result.rows[0], message: 'Agent disabilitato. I dati non verranno più accettati, ma l\'agent rimane installato sul client.' });
    } catch (err) {
      console.error('❌ Errore disabilitazione agent:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // PUT /api/network-monitoring/agent/:id/enable
  // Riabilita un agent (riprende ricezione dati)
  router.put('/agent/:id/enable', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);

      if (!agentId) {
        return res.status(400).json({ error: 'ID agent richiesto' });
      }

      await ensureTables();

      const result = await pool.query(
        `UPDATE network_agents 
         SET enabled = true, updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id, agent_name, enabled`,
        [agentId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Agent non trovato o eliminato' });
      }

      console.log(`✅ Agent ${agentId} riabilitato`);
      res.json({ success: true, agent: result.rows[0], message: 'Agent riabilitato. I dati verranno nuovamente accettati.' });
    } catch (err) {
      console.error('❌ Errore riabilitazione agent:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // PUT /api/network-monitoring/agent/:id
  // Aggiorna configurazione agent (nome, reti, intervallo scansione)
  router.put('/agent/:id', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);

      if (!agentId) {
        return res.status(400).json({ error: 'ID agent richiesto' });
      }

      await ensureTables();

      const { agent_name, network_ranges, scan_interval_minutes } = req.body;

      // Costruisci query dinamica per aggiornare solo i campi forniti
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (agent_name !== undefined) {
        updateFields.push(`agent_name = $${paramIndex++}`);
        updateValues.push(agent_name);
      }

      if (network_ranges !== undefined) {
        // Assicurati che network_ranges sia un array
        const rangesArray = Array.isArray(network_ranges) ? network_ranges : [];
        updateFields.push(`network_ranges = $${paramIndex++}`);
        updateValues.push(rangesArray);
      }

      if (scan_interval_minutes !== undefined) {
        const interval = parseInt(scan_interval_minutes);
        if (isNaN(interval) || interval < 1) {
          return res.status(400).json({ error: 'Intervallo scansione deve essere un numero positivo' });
        }
        updateFields.push(`scan_interval_minutes = $${paramIndex++}`);
        updateValues.push(interval);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Nessun campo da aggiornare fornito' });
      }

      // Incrementa automaticamente la versione quando viene modificato un agent
      // La versione è nel formato "MAJOR.MINOR.PATCH" (es: "1.1.1")
      // Incrementiamo il PATCH (ultimo numero)
      const currentVersionResult = await pool.query(
        'SELECT version FROM network_agents WHERE id = $1',
        [agentId]
      );

      let newVersion = '1.0.1'; // Default se non esiste versione
      if (currentVersionResult.rows.length > 0 && currentVersionResult.rows[0].version) {
        const currentVersion = currentVersionResult.rows[0].version;
        const versionParts = currentVersion.split('.');
        if (versionParts.length === 3) {
          const patch = parseInt(versionParts[2]) || 0;
          newVersion = `${versionParts[0]}.${versionParts[1]}.${patch + 1}`;
        } else {
          // Se formato non valido, incrementa come se fosse 1.0.0
          newVersion = '1.0.1';
        }
      }

      updateFields.push(`version = $${paramIndex++}`);
      updateValues.push(newVersion);

      // Aggiungi updated_at
      updateFields.push(`updated_at = NOW()`);
      updateValues.push(agentId);

      const query = `
        UPDATE network_agents 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND deleted_at IS NULL
        RETURNING id, agent_name, network_ranges, scan_interval_minutes, enabled, status, version, updated_at
      `;

      const result = await pool.query(query, updateValues);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Agent non trovato o eliminato' });
      }

      console.log(`✅ Agent ${agentId} aggiornato: ${updateFields.join(', ')} (versione: ${newVersion})`);
      res.json({
        success: true,
        agent: result.rows[0],
        message: `Configurazione agent aggiornata (versione: ${newVersion}). Le modifiche saranno applicate al prossimo heartbeat dell'agent.`
      });
    } catch (err) {
      console.error('❌ Errore aggiornamento agent:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // DELETE /api/network-monitoring/agent/:id
  // Elimina un agent (soft delete - marca come eliminato, mantiene dati, invia comando disinstallazione)
  router.delete('/agent/:id', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);

      if (!agentId) {
        return res.status(400).json({ error: 'ID agent richiesto' });
      }

      await ensureTables();

      // Verifica che l'agent esista e non sia già eliminato
      const checkResult = await pool.query(
        'SELECT id, agent_name, deleted_at FROM network_agents WHERE id = $1',
        [agentId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Agent non trovato' });
      }

      if (checkResult.rows[0].deleted_at) {
        return res.status(400).json({ error: 'Agent già eliminato' });
      }

      // Soft delete: marca come eliminato (mantiene tutti i dati per i ticket)
      await pool.query(
        `UPDATE network_agents 
         SET deleted_at = NOW(), enabled = false, status = 'offline', updated_at = NOW()
         WHERE id = $1`,
        [agentId]
      );

      console.log(`🗑️ Agent ${agentId} eliminato (soft delete - dati mantenuti, comando disinstallazione al prossimo heartbeat)`);
      res.json({ success: true, message: 'Agent eliminato. I dati sono stati mantenuti. L\'agent si disinstallerà automaticamente dal client al prossimo heartbeat.' });
    } catch (err) {
      console.error('❌ Errore eliminazione agent:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });


  // PATCH /api/network-monitoring/devices/:id/static
  // Aggiorna stato statico per un dispositivo specifico
  router.patch('/devices/:id/static', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();

      // Assicurati che le colonne is_static e notify_telegram esistano (migrazione)
      try {
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS is_static BOOLEAN DEFAULT false;
        `);
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS notify_telegram BOOLEAN DEFAULT false;
        `);
      } catch (migrationErr) {
        // Ignora errore se colonna esiste già
        if (!migrationErr.message.includes('already exists') && !migrationErr.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonne in PATCH static:', migrationErr.message);
        }
      }

      const { id } = req.params;
      const { is_static, notify_telegram, monitoring_schedule } = req.body;

      // Verifica che il dispositivo esista
      const deviceCheck = await pool.query(
        'SELECT id FROM network_devices WHERE id = $1',
        [id]
      );

      if (deviceCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Dispositivo non trovato' });
      }

      // Costruisci query dinamica basata sui campi forniti
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (is_static !== undefined) {
        updates.push(`is_static = $${paramIndex++}`);
        values.push(is_static === true || is_static === 'true');
      }

      if (notify_telegram !== undefined) {
        updates.push(`notify_telegram = $${paramIndex++}`);
        values.push(notify_telegram === true || notify_telegram === 'true');
      }

      if (monitoring_schedule !== undefined) {
        updates.push(`monitoring_schedule = $${paramIndex++}`);
        values.push(monitoring_schedule ? JSON.stringify(monitoring_schedule) : null);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Nessun campo da aggiornare' });
      }

      values.push(id); // WHERE id = $N
      const result = await pool.query(
        `UPDATE network_devices SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, ip_address, is_static, notify_telegram, monitoring_schedule`,
        values
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error('❌ Errore aggiornamento stato statico:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // PATCH /api/network-monitoring/devices/:id/reset-warnings
  // Resetta i warning per un dispositivo (salva IP/MAC attuale come accettato e pulisce previous_ip e previous_mac)
  router.patch('/devices/:id/reset-warnings', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();

      const { id } = req.params;

      // Verifica che il dispositivo esista e ottieni IP/MAC attuali
      const deviceCheck = await pool.query(
        'SELECT id, ip_address, mac_address, previous_ip, previous_mac FROM network_devices WHERE id = $1',
        [id]
      );

      if (deviceCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Dispositivo non trovato' });
      }

      const device = deviceCheck.rows[0];

      // Salva l'IP/MAC attuale come accettato (così non verrà più mostrato il warning per questo valore)
      // Se c'era un previous_ip, accetta l'IP attuale; se c'era un previous_mac, accetta il MAC attuale
      const acceptedIp = device.previous_ip ? device.ip_address : device.accepted_ip || null;
      const acceptedMac = device.previous_mac ? device.mac_address : device.accepted_mac || null;

      // Reset dei warning (pulisce previous_ip e previous_mac) e salva IP/MAC accettati
      const result = await pool.query(
        `UPDATE network_devices 
         SET previous_ip = NULL, previous_mac = NULL, 
             accepted_ip = COALESCE($1, accepted_ip), 
             accepted_mac = COALESCE($2, accepted_mac)
         WHERE id = $3 
         RETURNING id, ip_address, mac_address, previous_ip, previous_mac, accepted_ip, accepted_mac`,
        [acceptedIp, acceptedMac, id]
      );

      console.log(`✅ Warning reset per dispositivo ${id} - IP accettato: ${acceptedIp || 'N/A'}, MAC accettato: ${acceptedMac || 'N/A'}`);

      res.json(result.rows[0]);
    } catch (err) {
      console.error('❌ Errore reset warning:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // PATCH /api/network-monitoring/devices/:id/type
  // Aggiorna tipo dispositivo per un dispositivo specifico
  router.patch('/devices/:id/type', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();
      const { id } = req.params;
      const { device_type } = req.body;

      // Verifica che il dispositivo esista
      const deviceCheck = await pool.query(
        'SELECT id FROM network_devices WHERE id = $1',
        [id]
      );

      if (deviceCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Dispositivo non trovato' });
      }


      // Aggiorna il dispositivo e imposta flag manuale
      const result = await pool.query(
        'UPDATE network_devices SET device_type = $1, is_manual_type = true WHERE id = $2 RETURNING id, ip_address, device_type, is_manual_type',
        [device_type?.trim() || null, id]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error('❌ Errore aggiornamento tipo dispositivo:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // DELETE /api/network-monitoring/devices/:id
  // Elimina un dispositivo (pensato per switch virtuali/unmanaged)
  router.delete('/devices/:id', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();
      const { id } = req.params;

      // Verifica che sia uno switch virtuale/unmanaged o comunque eliminabile
      // Per sicurezza, potremmo limitare l'eliminazione solo a 'unmanaged_switch' o 'manual'
      const dev = await pool.query('SELECT device_type FROM network_devices WHERE id = $1', [id]);
      if (dev.rows.length === 0) return res.status(404).json({ error: 'Dispositivo non trovato' });

      if (dev.rows[0].device_type !== 'unmanaged_switch') {
        return res.status(400).json({ error: 'Solo gli switch virtuali/unmanaged possono essere eliminati manualmente.' });
      }

      await pool.query('DELETE FROM network_devices WHERE id = $1', [id]);
      res.json({ success: true, message: 'Dispositivo eliminato' });
    } catch (err) {
      console.error('❌ Errore eliminazione dispositivo:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // PATCH /api/network-monitoring/devices/:id/port
  // Imposta Port (mostrato come IP #port in topologia)
  router.patch('/devices/:id/port', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();
      const { id } = req.params;
      let { port } = req.body;
      if (port === '' || port === undefined) port = null;
      else {
        port = parseInt(port, 10);
        if (isNaN(port) || port < 1 || port > 65535) port = null;
      }
      const deviceCheck = await pool.query('SELECT id FROM network_devices WHERE id = $1', [id]);
      if (deviceCheck.rows.length === 0) return res.status(404).json({ error: 'Dispositivo non trovato' });
      const result = await pool.query('UPDATE network_devices SET port = $1 WHERE id = $2 RETURNING id, ip_address, port', [port, id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error('❌ Errore aggiornamento port:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });



  // PATCH /api/network-monitoring/devices/:id/notes
  // Aggiorna le note di un dispositivo
  router.patch('/devices/:id/notes', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body; // Può essere stringa o null

      await pool.query(
        'UPDATE network_devices SET notes = $1 WHERE id = $2',
        [notes, id]
      );

      res.json({ success: true, notes: notes });
    } catch (err) {
      console.error('❌ Errore aggiornamento note:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // POST /api/network-monitoring/clients/:aziendaId/manual-device
  // Crea un dispositivo manuale (es. Switch Virtuale)
  router.post('/clients/:aziendaId/manual-device', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      const { aziendaId } = req.params;
      const { ip_address, name, device_type, parent_id, port, x, y } = req.body;

      // Trova un agent attivo per questa azienda
      const agentResult = await pool.query(
        'SELECT id FROM network_agents WHERE azienda_id = $1 AND deleted_at IS NULL ORDER BY last_heartbeat DESC LIMIT 1',
        [aziendaId]
      );

      if (agentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Nessun agent attivo trovato per questa azienda' });
      }
      const agentId = agentResult.rows[0].id;

      let finalIp = ip_address;
      if (!finalIp) {
        // Genera IP virtuale univoco
        finalIp = `virtual-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }

      // Inserisci il dispositivo
      const result = await pool.query(
        `INSERT INTO network_devices (
          agent_id, ip_address, hostname, device_type, status, is_static, parent_device_id, port, notes
        ) VALUES ($1, $2, $3, $4, 'online', true, $5, $6, $7)
        RETURNING id, ip_address, hostname, device_type, status, is_static, parent_device_id, port, notes`,
        [agentId, finalIp, name || 'Virtual Device', device_type || 'unmanaged_switch', parent_id || null, port || null, name ? name : 'Switch Virtuale']
      );

      res.json({ success: true, device: result.rows[0] });
    } catch (err) {
      console.error('❌ Errore creazione dispositivo manuale:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // POST /api/network-monitoring/invalidate-keepass-cache - Forza invalidazione cache KeePass
  router.post('/invalidate-keepass-cache', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      keepassDriveService.invalidateCache();
      res.json({
        success: true,
        message: 'Cache KeePass invalidata con successo. Il prossimo caricamento ricaricherà i dati da Google Drive.'
      });
    } catch (err) {
      console.error('❌ Errore invalidazione cache KeePass:', err);
      res.status(500).json({ error: 'Errore interno del server', details: err.message });
    }
  });

  // POST /api/network-monitoring/refresh-keepass-data - Aggiorna tutti i dispositivi da KeePass
  router.post('/refresh-keepass-data', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();

      const keepassPassword = process.env.KEEPASS_PASSWORD;
      if (!keepassPassword) {
        return res.status(400).json({
          error: 'KEEPASS_PASSWORD non configurato',
          updated: 0
        });
      }

      console.log('🔄 Inizio aggiornamento dispositivi da KeePass...');

      // Invalida la cache per forzare il ricaricamento
      console.log('🗑️ Invalidazione cache KeePass...');
      keepassDriveService.invalidateCache();

      // Carica la mappa KeePass (forza il ricaricamento)
      console.log('📥 Caricamento mappa KeePass da Google Drive...');
      const keepassMap = await keepassDriveService.getMacToTitleMap(keepassPassword);
      console.log(`✅ Mappa KeePass caricata: ${keepassMap.size} MAC address disponibili`);

      // Verifica se il MAC specifico è presente (per debug)
      const testMac = '101331CDFF6C';
      if (keepassMap.has(testMac)) {
        const testResult = keepassMap.get(testMac);
        console.log(`✅ MAC ${testMac} trovato in mappa Keepass: Titolo="${testResult.title}", Path="${testResult.path}"`);
      } else {
        console.log(`⚠️ MAC ${testMac} NON trovato in mappa Keepass`);
        // Mostra MAC simili per debug
        const similarMacs = Array.from(keepassMap.keys()).filter(mac => mac.includes('101331') || mac.includes('CDFF6C'));
        if (similarMacs.length > 0) {
          console.log(`   MAC simili trovati: ${similarMacs.join(', ')}`);
        }
      }

      // Ottieni tutti i dispositivi con MAC address
      const devicesResult = await pool.query(
        `SELECT id, mac_address, device_type, device_path, device_username, is_manual_type 
         FROM network_devices 
         WHERE mac_address IS NOT NULL AND mac_address != ''`
      );

      console.log(`📊 Trovati ${devicesResult.rows.length} dispositivi con MAC address da verificare`);

      // Debug: mostra alcuni MAC dalla mappa Keepass per verifica
      if (keepassMap.size > 0) {
        const sampleMacs = Array.from(keepassMap.keys()).slice(0, 5);
        console.log(`📋 Esempi MAC nella mappa Keepass (primi 5): ${sampleMacs.join(', ')}`);
      }

      let updatedCount = 0;
      let notFoundCount = 0;
      let unchangedCount = 0;

      // Per ogni dispositivo, controlla se il MAC è in KeePass e aggiorna se necessario
      for (const device of devicesResult.rows) {
        try {
          // Normalizza il MAC per la ricerca
          const normalizedMac = device.mac_address.replace(/[:-]/g, '').toUpperCase();

          // Debug per MAC specifico che l'utente sta cercando
          if (normalizedMac === '101331CDFF6C' || device.mac_address.toLowerCase().includes('10:13:31:cd:ff:6c')) {
            console.log(`🔍 DEBUG MAC ${device.mac_address}:`);
            console.log(`   - MAC originale nel DB: "${device.mac_address}"`);
            console.log(`   - MAC normalizzato: "${normalizedMac}"`);
            console.log(`   - Presente nella mappa Keepass: ${keepassMap.has(normalizedMac)}`);
            console.log(`   - device_type attuale: "${device.device_type}"`);
            console.log(`   - device_path attuale: "${device.device_path}"`);
          }

          // Cerca nella mappa KeePass
          const keepassResult = keepassMap.get(normalizedMac);

          if (keepassResult) {
            // Estrai solo l'ultimo elemento del percorso
            const lastPathElement = keepassResult.path ? keepassResult.path.split(' > ').pop() : null;

            // Debug per MAC specifico
            if (normalizedMac === '101331CDFF6C') {
              console.log(`  🔍 MAC ${device.mac_address} trovato in Keepass:`);
              console.log(`     - Titolo da Keepass: "${keepassResult.title}"`);
              console.log(`     - Path da Keepass: "${keepassResult.path}"`);
              console.log(`     - LastPathElement: "${lastPathElement}"`);
              console.log(`     - device_type attuale: "${device.device_type}"`);
              console.log(`     - device_path attuale: "${device.device_path}"`);
            }

            // Verifica se i valori sono diversi da quelli attuali
            // IMPORTANTE: considera anche il caso in cui i valori attuali sono NULL
            // Inoltre: NON aggiornare se il tipo è stato impostato manualmente dall'utente
            const needsUpdate = !device.is_manual_type && (
              (device.device_type !== keepassResult.title) ||
              (device.device_path !== lastPathElement) ||
              (device.device_username !== (keepassResult.username || null)) ||
              (device.device_type === null && keepassResult.title !== null) ||
              (device.device_path === null && lastPathElement !== null) ||
              (device.device_username === null && keepassResult.username !== null && keepassResult.username !== '')
            );

            if (needsUpdate) {
              // Aggiorna il dispositivo nel database
              await pool.query(
                `UPDATE network_devices 
                 SET device_type = $1, device_path = $2, device_username = $3 
                 WHERE id = $4`,
                [keepassResult.title, lastPathElement, keepassResult.username || null, device.id]
              );

              if (normalizedMac === '101331CDFF6C') {
                console.log(`  ✅✅✅ MAC ${device.mac_address} AGGIORNATO: device_type="${keepassResult.title}", device_path="${lastPathElement}", device_username="${keepassResult.username || ''}"`);
              } else {
                console.log(`  ✅ Dispositivo ID ${device.id} (MAC: ${device.mac_address}) aggiornato: device_type="${keepassResult.title}", device_path="${lastPathElement}", device_username="${keepassResult.username || ''}"`);
              }
              updatedCount++;
            } else {
              if (normalizedMac === '101331CDFF6C') {
                console.log(`  ℹ️ MAC ${device.mac_address} già aggiornato, nessuna modifica necessaria`);
              }
              unchangedCount++;
            }
          } else {
            // MAC non trovato in KeePass: resetta i valori se erano presenti
            // SOLO se non è manuale
            if (!device.is_manual_type && (device.device_type !== null || device.device_path !== null || device.device_username !== null)) {
              console.log(`  🔍 MAC ${device.mac_address} (normalizzato: ${normalizedMac}) NON trovato in KeePass`);
              console.log(`     Valori attuali: device_type="${device.device_type}", device_path="${device.device_path}", device_username="${device.device_username}"`);
              console.log(`     Reset in corso...`);

              await pool.query(
                `UPDATE network_devices 
                 SET device_type = NULL, device_path = NULL, device_username = NULL 
                 WHERE id = $1`,
                [device.id]
              );

              console.log(`  ✅ Dispositivo ID ${device.id} (MAC: ${device.mac_address}) - MAC non trovato in KeePass, valori resettati`);
              updatedCount++;
            } else {
              console.log(`  ℹ️ MAC ${device.mac_address} (normalizzato: ${normalizedMac}) non trovato in KeePass, ma valori già NULL`);
            }
            notFoundCount++;
          }
        } catch (deviceErr) {
          console.error(`  ⚠️ Errore aggiornamento dispositivo ID ${device.id}:`, deviceErr.message);
        }
      }

      console.log(`✅ Aggiornamento completato: ${updatedCount} aggiornati, ${unchangedCount} invariati, ${notFoundCount} non trovati in KeePass`);

      res.json({
        success: true,
        message: `Aggiornamento completato: ${updatedCount} dispositivi aggiornati da KeePass`,
        updated: updatedCount,
        unchanged: unchangedCount,
        notFound: notFoundCount,
        total: devicesResult.rows.length
      });
    } catch (err) {
      console.error('❌ Errore aggiornamento dispositivi da KeePass:', err);
      res.status(500).json({
        error: 'Errore interno del server',
        details: err.message,
        updated: 0
      });
    }
  });

  // GET /api/network-monitoring/agent-events - Ottieni eventi agent (offline, online, riavvio, problemi rete)
  router.get('/agent-events', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables(); // Assicura che le tabelle esistano
      const { limit = 50, unread_only = false } = req.query;
      const userId = req.user.id;

      let query = `
        SELECT 
          nae.id,
          nae.agent_id,
          na.agent_name,
          nae.event_type,
          nae.event_data,
          nae.detected_at,
          nae.resolved_at,
          nae.notified,
          CASE WHEN $1 = ANY(nae.read_by) THEN TRUE ELSE FALSE END as is_read,
          u.azienda
        FROM network_agent_events nae
        INNER JOIN network_agents na ON nae.agent_id = na.id
        LEFT JOIN users u ON na.azienda_id = u.id
        WHERE na.deleted_at IS NULL
      `;
      const params = [userId];
      let paramIndex = 2;

      if (unread_only === 'true') {
        query += ` AND ($1 = ANY(nae.read_by) IS FALSE OR nae.read_by IS NULL)`;
      }

      query += ` ORDER BY nae.detected_at DESC LIMIT $${paramIndex}`;
      params.push(parseInt(limit) || 50);

      const result = await pool.query(query, params);

      res.json(result.rows);
    } catch (err) {
      // Se la tabella non esiste, restituisci array vuoto invece di errore
      if (err.message && (err.message.includes('does not exist') || err.message.includes('relation') && err.message.includes('network_agent_events'))) {
        console.log('ℹ️ Tabella network_agent_events non ancora creata, restituisco array vuoto');
        res.json([]);
      } else {
        console.error('❌ Errore recupero eventi agent:', err);
        res.status(500).json({ error: 'Errore interno del server' });
      }
    }
  });

  // POST /api/network-monitoring/agent-events/:id/read - Marca evento come letto
  router.post('/agent-events/:id/read', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.user.id;

      await pool.query(
        `UPDATE network_agent_events 
         SET read_by = array_append(COALESCE(read_by, ARRAY[]::INTEGER[]), $1)
         WHERE id = $2 AND ($1 = ANY(read_by) IS FALSE OR read_by IS NULL)`,
        [userId, eventId]
      );

      res.json({ success: true });
    } catch (err) {
      console.error('❌ Errore marcatura evento come letto:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/agent-events/unread-count - Conta eventi non letti
  router.get('/agent-events/unread-count', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables(); // Assicura che le tabelle esistano
      const userId = req.user.id;

      const result = await pool.query(
        `SELECT COUNT(*) as count
         FROM network_agent_events nae
         INNER JOIN network_agents na ON nae.agent_id = na.id
         WHERE na.deleted_at IS NULL
           AND ($1 = ANY(nae.read_by) IS FALSE OR nae.read_by IS NULL)`,
        [userId]
      );

      res.json({ count: parseInt(result.rows[0].count, 10) });
    } catch (err) {
      // Se la tabella non esiste, restituisci 0 invece di errore
      if (err.message && (err.message.includes('does not exist') || err.message.includes('relation') && err.message.includes('network_agent_events'))) {
        console.log('ℹ️ Tabella network_agent_events non ancora creata, restituisco 0');
        res.json({ count: 0 });
      } else {
        console.error('❌ Errore conteggio eventi non letti:', err);
        res.status(500).json({ error: 'Errore interno del server' });
      }
    }
  });

  // DELETE /api/network-monitoring/agent-events/clear
  // "Pulisci" nel triangolo notifiche: NON cancella lo storico.
  // Segna invece tutti gli eventi come letti per l'utente corrente (così in menu restano visibili).
  router.delete('/agent-events/clear', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables(); // Assicura che le tabelle esistano
      const userId = req.user.id;

      // Marca come letto tutto ciò che è "non letto" per questo utente
      const result = await pool.query(
        `UPDATE network_agent_events nae
         SET read_by = CASE
           WHEN nae.read_by IS NULL THEN ARRAY[$1]::INTEGER[]
           WHEN NOT ($1 = ANY(nae.read_by)) THEN array_append(nae.read_by, $1)
           ELSE nae.read_by
         END
         FROM network_agents na
         WHERE nae.agent_id = na.id
           AND na.deleted_at IS NULL
           AND (nae.read_by IS NULL OR NOT ($1 = ANY(nae.read_by)))`,
        [userId]
      );

      res.json({ success: true, marked_read: result.rowCount });
    } catch (err) {
      // Se la tabella non esiste, restituisci successo comunque
      if (err.message && (err.message.includes('does not exist') || err.message.includes('relation') && err.message.includes('network_agent_events'))) {
        console.log('ℹ️ Tabella network_agent_events non ancora creata, restituisco successo');
        res.json({ success: true, marked_read: 0 });
      } else {
        console.error('❌ Errore cancellazione notifiche:', err);
        res.status(500).json({ error: 'Errore interno del server' });
      }
    }
  });

  // Funzione per rilevare agent offline (chiamata periodicamente)
  const checkOfflineAgents = async () => {
    try {
      // Verifica che pool sia disponibile
      if (!pool) {
        console.log('⚠️ checkOfflineAgents: pool non disponibile');
        return;
      }

      // Verifica se la tabella network_agent_events esiste, se non esiste la crea
      try {
        const tableCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'network_agent_events'
          );
        `);

        if (!tableCheck || !tableCheck.rows || !tableCheck.rows[0] || !tableCheck.rows[0].exists) {
          // Tabella non esiste, creala chiamando initTables
          console.log('⚠️ checkOfflineAgents: tabella network_agent_events non esiste, creazione...');
          await initTables();
          console.log('✅ checkOfflineAgents: tabella network_agent_events creata');
        }
      } catch (tableCheckErr) {
        // Se la verifica della tabella fallisce, prova a crearla comunque
        console.log('⚠️ checkOfflineAgents: errore verifica tabella, tentativo creazione:', tableCheckErr.message);
        try {
          await initTables();
        } catch (initErr) {
          console.log('❌ checkOfflineAgents: errore creazione tabella:', initErr.message);
          return;
        }
      }

      // Prima, vediamo tutti gli agent per capire perché non vengono trovati
      const allAgents = await pool.query(
        `SELECT id, agent_name, last_heartbeat, status, enabled, deleted_at
         FROM network_agents
         WHERE deleted_at IS NULL`
      );

      console.log(`🔍 checkOfflineAgents: totale agent nel database: ${allAgents.rows.length}`);
      allAgents.rows.forEach(agent => {
        const lastHeartbeatStr = agent.last_heartbeat ? new Date(agent.last_heartbeat).toISOString() : 'NULL';
        const minutesAgo = agent.last_heartbeat
          ? Math.floor((Date.now() - new Date(agent.last_heartbeat).getTime()) / 60000)
          : 'N/A';
        console.log(`  - Agent ${agent.id} (${agent.agent_name}): status=${agent.status}, enabled=${agent.enabled}, last_heartbeat=${lastHeartbeatStr} (${minutesAgo} min fa)`);
      });

      // Trova agent che:
      // 1. Sono online ma non hanno inviato heartbeat da più di 2 minuti (devono essere marcati offline)
      // 2. Sono già offline ma non hanno ancora un evento offline non risolto (devono creare evento)
      // NOTA: Controlliamo solo agent enabled=TRUE per evitare di creare eventi per agent disattivati manualmente
      console.log('🔍 checkOfflineAgents: controllo agent offline...');
      let offlineAgents;
      try {
        offlineAgents = await pool.query(
          `SELECT na.id, na.agent_name, na.last_heartbeat, na.status, na.enabled
           FROM network_agents na
           WHERE na.deleted_at IS NULL
             AND na.enabled = TRUE
             AND (
               -- Caso 1: Agent online ma senza heartbeat da più di 8 minuti (agent invia ogni 5 minuti, quindi 8 minuti dà margine per ritardi)
               (na.status = 'online' AND (na.last_heartbeat IS NULL OR na.last_heartbeat < NOW() - INTERVAL '8 minutes'))
               OR
               -- Caso 2: Agent già offline ma senza evento offline non risolto
               (na.status = 'offline' AND NOT EXISTS (
                 SELECT 1 FROM network_agent_events nae
                 WHERE nae.agent_id = na.id
                   AND nae.event_type = 'offline'
                   AND nae.resolved_at IS NULL
               ))
             )`
        );
      } catch (queryErr) {
        // Se la tabella network_agent_events non esiste, usa una query semplificata
        if (queryErr.code === '42P01') {
          console.log('ℹ️ checkOfflineAgents: tabella network_agent_events non disponibile, uso query semplificata');
          offlineAgents = await pool.query(
            `SELECT na.id, na.agent_name, na.last_heartbeat, na.status, na.enabled
             FROM network_agents na
             WHERE na.deleted_at IS NULL
               AND na.enabled = TRUE
               AND na.status = 'online'
               AND (na.last_heartbeat IS NULL OR na.last_heartbeat < NOW() - INTERVAL '8 minutes')`
          );
        } else {
          // Rilancia altri errori
          throw queryErr;
        }
      }

      console.log(`🔍 checkOfflineAgents: trovati ${offlineAgents.rows.length} agent offline`);
      if (offlineAgents.rows.length > 0) {
        offlineAgents.rows.forEach(agent => {
          console.log(`  - Agent ${agent.id} (${agent.agent_name}): last_heartbeat = ${agent.last_heartbeat}, status = ${agent.status}`);
        });
      } else {
        console.log('⚠️ checkOfflineAgents: nessun agent trovato offline. Verifica i filtri della query.');
        // Debug: verifica se ci sono agent offline con eventi esistenti
        try {
          const offlineAgentsWithEvents = await pool.query(
            `SELECT na.id, na.agent_name, na.status, na.enabled,
                    (SELECT COUNT(*) FROM network_agent_events nae 
                     WHERE nae.agent_id = na.id 
                       AND nae.event_type = 'offline' 
                       AND nae.resolved_at IS NULL) as event_count
             FROM network_agents na
             WHERE na.deleted_at IS NULL
               AND na.enabled = TRUE
               AND na.status = 'offline'`
          );
          if (offlineAgentsWithEvents.rows.length > 0) {
            console.log(`🔍 checkOfflineAgents: trovati ${offlineAgentsWithEvents.rows.length} agent offline con enabled=TRUE:`);
            offlineAgentsWithEvents.rows.forEach(agent => {
              console.log(`  - Agent ${agent.id} (${agent.agent_name}): status=${agent.status}, eventi offline non risolti=${agent.event_count}`);
            });
          }
        } catch (debugErr) {
          // Se la tabella non esiste ancora, ignora l'errore di debug
          if (debugErr.code === '42P01') {
            console.log('ℹ️ checkOfflineAgents: tabella network_agent_events non ancora disponibile per debug');
          } else {
            console.log(`⚠️ checkOfflineAgents: errore query debug: ${debugErr.message}`);
          }
        }
      }

      for (const agent of offlineAgents.rows) {
        console.log(`🔄 checkOfflineAgents: aggiornamento agent ${agent.id} (${agent.agent_name}) a offline...`);

        // Aggiorna status a offline
        await pool.query(
          `UPDATE network_agents SET status = 'offline' WHERE id = $1`,
          [agent.id]
        );

        console.log(`✅ checkOfflineAgents: agent ${agent.id} aggiornato a offline nel database`);

        // Invia notifica Telegram
        try {
          const agentInfo = await pool.query(
            'SELECT na.azienda_id, u.azienda as azienda_name FROM network_agents na LEFT JOIN users u ON na.azienda_id = u.id WHERE na.id = $1',
            [agent.id]
          );

          if (agentInfo.rows.length > 0) {
            await sendTelegramNotification(
              agent.id,
              agentInfo.rows[0].azienda_id,
              'agent_offline',
              {
                agentName: agent.agent_name,
                lastHeartbeat: agent.last_heartbeat,
                aziendaName: agentInfo.rows[0].azienda_name
              }
            );
          }
        } catch (telegramErr) {
          console.error('❌ Errore invio notifica Telegram per agent offline:', telegramErr);
        }

        // Emetti evento WebSocket per aggiornare la lista agenti in tempo reale
        if (io) {
          console.log(`📡 checkOfflineAgents: emissione evento WebSocket per agent ${agent.id}`);
          io.to(`role:tecnico`).to(`role:admin`).emit('network-monitoring-update', {
            type: 'agent-status-changed',
            agentId: agent.id,
            status: 'offline'
          });
        } else {
          console.log('⚠️ checkOfflineAgents: io (WebSocket) non disponibile');
        }

        // Verifica se esiste già un evento offline non risolto (proteggiamo con try-catch)
        try {
          // Assicurati che la tabella esista prima di usarla
          await ensureTables();

          const existingEvent = await pool.query(
            `SELECT id FROM network_agent_events 
             WHERE agent_id = $1 
               AND event_type = 'offline' 
               AND resolved_at IS NULL
             ORDER BY detected_at DESC LIMIT 1`,
            [agent.id]
          );

          if (existingEvent.rows.length === 0) {
            // Crea nuovo evento offline
            const offlineDuration = agent.last_heartbeat
              ? Math.floor((Date.now() - new Date(agent.last_heartbeat).getTime()) / 60000)
              : null;

            await pool.query(
              `INSERT INTO network_agent_events (agent_id, event_type, event_data, detected_at, notified)
               VALUES ($1, 'offline', $2, NOW(), FALSE)`,
              [agent.id, JSON.stringify({
                last_heartbeat: agent.last_heartbeat,
                offline_duration_minutes: offlineDuration,
                detected_at: new Date().toISOString()
              })]
            );

            // Emetti evento WebSocket
            if (io) {
              io.to(`role:tecnico`).to(`role:admin`).emit('agent-event', {
                agentId: agent.id,
                eventType: 'offline',
                message: `Agent ${agent.agent_name || agent.id} offline`,
                detectedAt: new Date().toISOString()
              });
            }

            console.log(`🔴 Agent ${agent.id} (${agent.agent_name}) rilevato offline`);
          }
        } catch (eventErr) {
          // Se la tabella non esiste, prova a crearla direttamente
          if (eventErr.code === '42P01') {
            console.log(`⚠️ checkOfflineAgents: tabella network_agent_events non disponibile, tentativo creazione...`);
            try {
              await pool.query(`
                CREATE TABLE IF NOT EXISTS network_agent_events (
                  id SERIAL PRIMARY KEY,
                  agent_id INTEGER REFERENCES network_agents(id) ON DELETE CASCADE,
                  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('offline', 'online', 'reboot', 'network_issue')),
                  event_data JSONB,
                  detected_at TIMESTAMP DEFAULT NOW(),
                  resolved_at TIMESTAMP,
                  notified BOOLEAN DEFAULT FALSE,
                  read_by INTEGER[] DEFAULT ARRAY[]::INTEGER[],
                  created_at TIMESTAMP DEFAULT NOW()
                );
              `);
              console.log(`✅ checkOfflineAgents: tabella network_agent_events creata con successo`);
              // Resetta il flag per forzare la ricreazione al prossimo controllo
              tablesCheckDone = false;
            } catch (createErr) {
              console.error(`❌ checkOfflineAgents: errore creazione tabella network_agent_events:`, createErr.message);
            }
          } else {
            console.error(`❌ checkOfflineAgents: errore creazione evento offline per agent ${agent.id}:`, eventErr.message);
          }
        }
      }
    } catch (err) {
      // Non loggare come errore se è solo la tabella network_agent_events mancante (già gestito nei catch interni)
      if (err.code !== '42P01' || !err.message.includes('network_agent_events')) {
        console.error('❌ Errore controllo agent offline:', err);
      }
    }
  };

  // Avvia job periodico per controllare agent offline (ogni minuto)
  // Wrappato in try-catch per evitare crash se pool non è ancora disponibile
  try {
    // Esegui subito un controllo (con delay per assicurarsi che tutto sia inizializzato)
    setTimeout(() => {
      checkOfflineAgents().catch(err => {
        console.error('❌ Errore controllo iniziale agent offline:', err);
      });
    }, 5000); // Aspetta 5 secondi dopo l'avvio del server

    // Avvia job periodico
    console.log('⏰ checkOfflineAgents: avvio job periodico (ogni 60 secondi)');
    setInterval(() => {
      console.log('⏰ checkOfflineAgents: esecuzione job periodico...');
      checkOfflineAgents().catch(err => {
        console.error('❌ Errore controllo periodico agent offline:', err);
      });
    }, 60 * 1000);
  } catch (err) {
    console.error('❌ Errore inizializzazione job controllo agent offline:', err);
  }

  // GET /api/network-monitoring/test-keepass - Test connessione e lettura KeePass da Google Drive
  router.get('/test-keepass', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      const { mac, password } = req.query;

      if (!password) {
        return res.status(400).json({
          error: 'Password richiesta',
          message: 'Fornisci la password del file KeePass come parametro ?password=...'
        });
      }

      console.log('🧪 Test connessione KeePass da Google Drive...');

      // Test 1: Verifica credenziali Google
      let googleAuthOk = false;
      try {
        await keepassDriveService.getDriveAuth();
        googleAuthOk = true;
        console.log('✅ Credenziali Google OK');
      } catch (err) {
        console.error('❌ Errore credenziali Google:', err.message);
        return res.status(500).json({
          error: 'Credenziali Google non configurate',
          details: err.message,
          step: 'google_auth'
        });
      }

      // Test 2: Download file da Google Drive
      let fileDownloaded = false;
      let fileSize = 0;
      try {
        const fileBuffer = await keepassDriveService.downloadKeepassFile(password);
        fileDownloaded = true;
        fileSize = fileBuffer.length;
        console.log(`✅ File scaricato: ${(fileSize / 1024).toFixed(2)} KB`);
      } catch (err) {
        console.error('❌ Errore download file:', err.message);
        return res.status(500).json({
          error: 'Errore download file da Google Drive',
          details: err.message,
          step: 'file_download',
          googleAuthOk
        });
      }

      // Test 3: Caricamento e parsing KDBX
      let kdbxLoaded = false;
      let macCount = 0;
      try {
        const macMap = await keepassDriveService.loadMacToTitleMap(password);
        kdbxLoaded = true;
        macCount = macMap.size;
        console.log(`✅ File KDBX caricato: ${macCount} MAC address trovati`);
      } catch (err) {
        console.error('❌ Errore caricamento KDBX:', err.message);
        return res.status(500).json({
          error: 'Errore caricamento file KDBX',
          details: err.message,
          step: 'kdbx_load',
          googleAuthOk,
          fileDownloaded,
          fileSize
        });
      }

      // Test 4: Ricerca MAC specifico (se fornito)
      let macFound = null;
      let macTitle = null;
      if (mac) {
        try {
          macTitle = await keepassDriveService.findMacTitle(mac, password);
          macFound = macTitle !== null;
          if (macFound) {
            console.log(`✅ MAC ${mac} trovato -> Titolo: "${macTitle}"`);
          } else {
            console.log(`ℹ️ MAC ${mac} non trovato nel file`);
          }
        } catch (err) {
          console.error(`❌ Errore ricerca MAC ${mac}:`, err.message);
        }
      }

      // Risultato completo
      res.json({
        success: true,
        tests: {
          googleAuth: googleAuthOk,
          fileDownload: fileDownloaded,
          fileSize: fileSize,
          kdbxLoad: kdbxLoaded,
          macCount: macCount
        },
        macSearch: mac ? {
          mac: mac,
          found: macFound,
          title: macTitle
        } : null,
        message: 'Tutti i test completati con successo!'
      });

    } catch (err) {
      console.error('❌ Errore test KeePass:', err);
      res.status(500).json({
        error: 'Errore durante il test',
        details: err.message
      });
    }
  });

  // POST /api/network-monitoring/telegram/config
  // Configura notifiche Telegram per un'azienda o agent
  router.post('/telegram/config', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();

      const { azienda_id, agent_id, bot_token, chat_id, enabled,
        notify_agent_offline, notify_ip_changes,
        notify_mac_changes, notify_status_changes } = req.body;

      if (!bot_token || !chat_id) {
        return res.status(400).json({ error: 'bot_token e chat_id sono obbligatori' });
      }

      // Normalizza valori NULL
      const normalizedAziendaId = azienda_id && azienda_id !== '' ? parseInt(azienda_id) : null;
      const normalizedAgentId = agent_id && agent_id !== '' ? parseInt(agent_id) : null;

      // Verifica che la tabella esista (se non esiste, creala)
      try {
        await pool.query('SELECT 1 FROM network_telegram_config LIMIT 1');
      } catch (tableErr) {
        // Tabella non esiste, creala
        console.log('⚠️ Tabella network_telegram_config non esiste, creazione...');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS network_telegram_config (
            id SERIAL PRIMARY KEY,
            azienda_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            agent_id INTEGER REFERENCES network_agents(id) ON DELETE CASCADE,
            bot_token VARCHAR(255) NOT NULL,
            chat_id VARCHAR(50) NOT NULL,
            enabled BOOLEAN DEFAULT true,
            notify_agent_offline BOOLEAN DEFAULT true,
            notify_ip_changes BOOLEAN DEFAULT true,
            notify_mac_changes BOOLEAN DEFAULT true,
            notify_status_changes BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_network_telegram_config_azienda 
          ON network_telegram_config(azienda_id);
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_network_telegram_config_agent 
          ON network_telegram_config(agent_id);
        `);
        console.log('✅ Tabella network_telegram_config creata');
      }

      // Verifica se esiste già una configurazione con gli stessi valori
      const existingCheck = await pool.query(
        `SELECT id FROM network_telegram_config 
         WHERE (azienda_id = $1 OR (azienda_id IS NULL AND $1 IS NULL))
           AND (agent_id = $2 OR (agent_id IS NULL AND $2 IS NULL))`,
        [normalizedAziendaId, normalizedAgentId]
      );

      let result;
      if (existingCheck.rows.length > 0) {
        // Update esistente
        result = await pool.query(
          `UPDATE network_telegram_config 
           SET bot_token = $1,
               chat_id = $2,
               enabled = $3,
               notify_agent_offline = $4,
               notify_ip_changes = $5,
               notify_mac_changes = $6,
               notify_status_changes = $7,
               updated_at = NOW()
           WHERE id = $8
           RETURNING id, azienda_id, agent_id, bot_token, chat_id, enabled, 
                     notify_agent_offline, notify_ip_changes, 
                     notify_mac_changes, notify_status_changes, 
                     created_at, updated_at`,
          [
            bot_token,
            chat_id,
            enabled !== false,
            notify_agent_offline !== false,
            notify_ip_changes !== false,
            notify_mac_changes !== false,
            notify_status_changes !== false,
            existingCheck.rows[0].id
          ]
        );
      } else {
        // Insert nuovo
        result = await pool.query(
          `INSERT INTO network_telegram_config 
           (azienda_id, agent_id, bot_token, chat_id, enabled,
            notify_agent_offline, notify_ip_changes, notify_mac_changes, notify_status_changes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, azienda_id, agent_id, bot_token, chat_id, enabled, 
                     notify_agent_offline, notify_ip_changes, 
                     notify_mac_changes, notify_status_changes, 
                     created_at, updated_at`,
          [
            normalizedAziendaId,
            normalizedAgentId,
            bot_token,
            chat_id,
            enabled !== false,
            notify_agent_offline !== false,
            notify_ip_changes !== false,
            notify_mac_changes !== false,
            notify_status_changes !== false
          ]
        );
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error('❌ Errore configurazione Telegram:', err);
      console.error('❌ Stack trace:', err.stack);
      res.status(500).json({
        error: 'Errore interno del server',
        details: err.message
      });
    }
  });

  // GET /api/network-monitoring/telegram/config
  // Ottieni configurazione Telegram
  router.get('/telegram/config', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();

      const { azienda_id, agent_id } = req.query;

      let query = `SELECT id, azienda_id, agent_id, bot_token, chat_id, enabled, 
                          notify_agent_offline, notify_ip_changes, 
                          notify_mac_changes, notify_status_changes, 
                          created_at, updated_at
                   FROM network_telegram_config WHERE 1=1`;
      const params = [];
      let paramIndex = 1;

      if (azienda_id) {
        query += ` AND azienda_id = $${paramIndex++}`;
        params.push(azienda_id);
      }

      if (agent_id) {
        query += ` AND agent_id = $${paramIndex++}`;
        params.push(agent_id);
      }

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error('❌ Errore recupero configurazione Telegram:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // POST /api/network-monitoring/telegram/config/:id/test
  // Testa invio notifica Telegram
  router.post('/telegram/config/:id/test', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      // Verifica che telegramService sia disponibile
      if (!telegramService) {
        console.error('❌ Test notifica: telegramService non disponibile');
        return res.status(500).json({
          error: 'Servizio Telegram non disponibile',
          details: 'Il modulo telegramService non è stato caricato correttamente. Verifica che node-telegram-bot-api sia installato.'
        });
      }

      await ensureTables();

      const { id } = req.params;
      const { notification_type } = req.body; // 'agent_offline', 'ip_changed', 'mac_changed', 'status_changed_online', 'status_changed_offline'

      if (!notification_type) {
        return res.status(400).json({ error: 'notification_type è obbligatorio' });
      }

      // Ottieni configurazione
      const configResult = await pool.query(
        'SELECT * FROM network_telegram_config WHERE id = $1',
        [id]
      );

      if (configResult.rows.length === 0) {
        return res.status(404).json({ error: 'Configurazione non trovata' });
      }

      const config = configResult.rows[0];

      if (!config.enabled) {
        return res.status(400).json({ error: 'Configurazione non abilitata' });
      }

      if (!config.bot_token || !config.chat_id) {
        return res.status(400).json({ error: 'Bot Token o Chat ID mancanti nella configurazione' });
      }

      // Inizializza bot
      console.log(`🔧 Test notifica: Inizializzazione bot per config ID ${id}, tipo: ${notification_type}`);
      const initialized = telegramService.initialize(config.bot_token, config.chat_id);
      if (!initialized) {
        console.error(`❌ Test notifica: Errore inizializzazione bot per config ID ${id}`);
        return res.status(500).json({
          error: 'Errore inizializzazione bot Telegram',
          details: 'Verifica che il bot token e chat ID siano corretti. Controlla i log del backend per dettagli.'
        });
      }
      console.log(`✅ Test notifica: Bot inizializzato correttamente per config ID ${id}`);

      // Crea dati di test in base al tipo
      let testData = {};
      let message = '';

      switch (notification_type) {
        case 'agent_offline':
          if (!config.notify_agent_offline) {
            return res.status(400).json({ error: 'Notifica agent offline non abilitata' });
          }
          testData = {
            agentName: 'Agent di Test',
            lastHeartbeat: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minuti fa
          };
          message = telegramService.formatAgentOfflineMessage(testData.agentName, testData.lastHeartbeat);
          break;

        case 'ip_changed':
          if (!config.notify_ip_changes) {
            return res.status(400).json({ error: 'Notifica cambio IP non abilitata' });
          }
          testData = {
            hostname: 'Dispositivo di Test',
            mac: 'AA-BB-CC-DD-EE-FF',
            oldIP: '192.168.1.100',
            newIP: '192.168.1.200',
            agentName: 'Agent di Test'
          };
          message = telegramService.formatIPChangedMessage(testData);
          break;

        case 'mac_changed':
          if (!config.notify_mac_changes) {
            return res.status(400).json({ error: 'Notifica cambio MAC non abilitata' });
          }
          testData = {
            hostname: 'Dispositivo di Test',
            ip: '192.168.1.100',
            oldMAC: 'AA-BB-CC-DD-EE-FF',
            newMAC: '11-22-33-44-55-66',
            agentName: 'Agent di Test'
          };
          message = telegramService.formatMACChangedMessage(testData);
          break;

        case 'status_changed_online':
          if (!config.notify_status_changes) {
            return res.status(400).json({ error: 'Notifica cambio status non abilitata' });
          }
          testData = {
            hostname: 'Dispositivo di Test',
            ip: '192.168.1.100',
            mac: 'AA-BB-CC-DD-EE-FF',
            oldStatus: 'offline',
            status: 'online',
            agentName: 'Agent di Test'
          };
          message = telegramService.formatDeviceStatusMessage(testData);
          break;

        case 'status_changed_offline':
          if (!config.notify_status_changes) {
            return res.status(400).json({ error: 'Notifica cambio status non abilitata' });
          }
          testData = {
            hostname: 'Dispositivo di Test',
            ip: '192.168.1.100',
            mac: 'AA-BB-CC-DD-EE-FF',
            oldStatus: 'online',
            status: 'offline',
            agentName: 'Agent di Test'
          };
          message = telegramService.formatDeviceStatusMessage(testData);
          break;

        default:
          return res.status(400).json({ error: 'Tipo di notifica non valido' });
      }

      // Invia messaggio di test
      console.log(`📤 Test notifica: Invio messaggio per config ID ${id}, tipo: ${notification_type}`);
      const result = await telegramService.sendMessage(message);

      if (result && result.success) {
        console.log(`✅ Test notifica: Messaggio inviato con successo per config ID ${id}`);
        res.json({
          success: true,
          message: 'Notifica di test inviata con successo! Controlla Telegram.',
          notification_type,
          test_data: testData
        });
      } else {
        console.error(`❌ Test notifica: Errore invio messaggio per config ID ${id}`);
        const errorMsg = result && result.error
          ? result.error
          : 'Errore invio notifica di test';
        const errorDetails = result && result.details
          ? result.details
          : 'Verifica che il bot token e chat ID siano corretti e che il bot possa inviare messaggi al chat ID specificato.';

        res.status(500).json({
          error: errorMsg,
          details: errorDetails
        });
      }
    } catch (err) {
      console.error('❌ Errore test notifica Telegram:', err);
      console.error('❌ Stack trace completo:', err.stack);

      // Fornisci dettagli più specifici sull'errore
      let errorDetails = err.message || 'Errore sconosciuto';
      if (err.message && err.message.includes('Cannot find module')) {
        errorDetails = 'Il modulo node-telegram-bot-api non è stato trovato. Esegui "npm install node-telegram-bot-api" e riavvia il backend.';
      } else if (err.message && err.message.includes('telegramService')) {
        errorDetails = 'Il servizio Telegram non è disponibile. Verifica che backend/services/TelegramService.js esista e sia accessibile.';
      }

      res.status(500).json({
        error: 'Errore interno del server',
        details: errorDetails,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  });

  // DELETE /api/network-monitoring/telegram/config/:id
  // Rimuovi configurazione Telegram
  router.delete('/telegram/config/:id', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      await ensureTables();

      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM network_telegram_config WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Configurazione non trovata' });
      }

      res.json({ message: 'Configurazione rimossa', id: result.rows[0].id });
    } catch (err) {
      console.error('❌ Errore rimozione configurazione Telegram:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // POST /api/network-monitoring/telegram/simulate-event
  // Simula un evento reale per testare le notifiche Telegram
  router.post('/telegram/simulate-event', authenticateToken, requireRole('tecnico'), async (req, res) => {
    try {
      const { event_type, agent_id, azienda_id } = req.body;

      if (!event_type) {
        return res.status(400).json({ error: 'event_type richiesto' });
      }

      // Ottieni agent_id e azienda_id se non forniti
      let finalAgentId = agent_id;
      let finalAziendaId = azienda_id;

      if (!finalAgentId || !finalAziendaId) {
        // Prendi il primo agent disponibile
        const agentResult = await pool.query(
          'SELECT id, azienda_id, agent_name FROM network_agents WHERE deleted_at IS NULL AND enabled = true LIMIT 1'
        );

        if (agentResult.rows.length === 0) {
          return res.status(404).json({ error: 'Nessun agent disponibile per il test' });
        }

        finalAgentId = finalAgentId || agentResult.rows[0].id;
        finalAziendaId = finalAziendaId || agentResult.rows[0].azienda_id;
      }

      console.log(`🧪 Simulazione evento ${event_type} per agent ${finalAgentId}, azienda ${finalAziendaId}`);

      // Prepara dati di test in base al tipo di evento
      let testData = {};

      switch (event_type) {
        case 'agent_offline':
          const agentInfo = await pool.query(
            'SELECT agent_name, last_heartbeat FROM network_agents WHERE id = $1',
            [finalAgentId]
          );
          testData = {
            agentName: agentInfo.rows[0]?.agent_name || 'Test Agent',
            lastHeartbeat: agentInfo.rows[0]?.last_heartbeat || new Date()
          };
          break;

        case 'ip_changed':
          testData = {
            hostname: 'Test Device',
            mac: 'AA:BB:CC:DD:EE:FF',
            oldIP: '192.168.1.100',
            newIP: '192.168.1.101',
            agentName: 'Test Agent'
          };
          break;

        case 'mac_changed':
          testData = {
            hostname: 'Test Device',
            ip: '192.168.1.100',
            oldMAC: 'AA:BB:CC:DD:EE:FF',
            newMAC: '11:22:33:44:55:66',
            agentName: 'Test Agent'
          };
          break;

        case 'status_changed':
          testData = {
            hostname: 'Test Device',
            ip: '192.168.1.100',
            mac: 'AA:BB:CC:DD:EE:FF',
            oldStatus: 'offline',
            status: 'online',
            agentName: 'Test Agent'
          };
          break;

        default:
          return res.status(400).json({ error: `Tipo evento non valido: ${event_type}` });
      }

      // Chiama la funzione di notifica come se fosse un evento reale
      const result = await sendTelegramNotification(finalAgentId, finalAziendaId, event_type, testData);

      if (result) {
        res.json({
          success: true,
          message: `Evento ${event_type} simulato e notifica inviata`,
          event_type,
          agent_id: finalAgentId,
          azienda_id: finalAziendaId
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Notifica non inviata. Verifica la configurazione Telegram e i log del backend.',
          event_type,
          agent_id: finalAgentId,
          azienda_id: finalAziendaId
        });
      }
    } catch (err) {
      console.error('❌ Errore simulazione evento Telegram:', err);
      res.status(500).json({
        error: 'Errore interno del server',
        details: err.message
      });
    }
  });

  // GET /api/network-monitoring/agent-version
  // Restituisce la versione corrente dell'agent disponibile per download.
  // Gli agent chiamano quest'endpoint, confrontano con la loro versione, e se diversa
  // scaricano da /download/agent/NetworkMonitorService.ps1 e si riavviano (auto-update).
  router.get('/agent-version', async (req, res) => {
    try {
      const CURRENT_AGENT_VERSION = '2.6.1'; // dot1q fallback, parsing OID simbolici, C:\usr, MIB
      const baseUrl = process.env.BASE_URL || 'https://ticket.logikaservice.it';

      res.json({
        version: CURRENT_AGENT_VERSION,
        download_url: `${baseUrl}/api/network-monitoring/download/agent/NetworkMonitor.ps1`,
        release_date: '2026-01-26',
        features: [
          'Switch gestiti - Sync SNMP dot1d + dot1q (fallback), parsing OID simbolici, C:\\usr, MIB',
          'Switch gestiti - dot1dTpFdbPort e dot1qTpFdbPort (Q-BRIDGE) da snmpwalk in locale',
          'Auto-Update System - Aggiornamento automatico trasparente',
          'Unifi - Rilevamento aggiornamenti firmware da Cloud Key/Controller (credenziali da server, mai su disco)',
          'Hybrid Discovery - Ping + TCP Scan per rilevare dispositivi firewalled',
          'Trust ARP - Rilevamento immediato da cache ARP',
          'System Tray Icon - Monitorstato locale',
          'Security - Rimozione emoji per compatibilità Windows Server'
        ]
      });
    } catch (err) {
      console.error('❌ Errore endpoint agent-version:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/download/agent/NetworkMonitor.ps1
  // Serve il file NetworkMonitor.ps1 per download
  router.get('/download/agent/NetworkMonitor.ps1', async (req, res) => {
    try {
      const path = require('path');
      const fs = require('fs').promises;

      // Percorso al file agent (nella stessa repo, directory agent)
      const agentFilePath = path.join(__dirname, '../../agent/NetworkMonitor.ps1');

      // Verifica che il file esista
      try {
        await fs.access(agentFilePath);
      } catch (err) {
        console.error('❌ File agent non trovato:', agentFilePath);
        return res.status(404).json({ error: 'File agent non trovato' });
      }

      // Log download
      const clientIp = req.ip || req.connection.remoteAddress;
      console.log(`📥 Download agent richiesto da: ${clientIp}`);

      // Imposta headers per download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="NetworkMonitor.ps1"');

      // Invia file
      res.sendFile(agentFilePath);
    } catch (err) {
      console.error('❌ Errore download agent:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/download/agent/NetworkMonitorService.ps1
  // Serve il file NetworkMonitorService.ps1 per download
  router.get('/download/agent/NetworkMonitorService.ps1', async (req, res) => {
    try {
      const path = require('path');
      const fs = require('fs').promises;

      // Percorso al file agent (nella stessa repo, directory agent)
      const agentFilePath = path.join(__dirname, '../../agent/NetworkMonitorService.ps1');

      // Verifica che il file esista
      try {
        await fs.access(agentFilePath);
      } catch (err) {
        console.error('❌ File NetworkMonitorService.ps1 non trovato:', agentFilePath);
        return res.status(404).json({ error: 'File NetworkMonitorService.ps1 non trovato' });
      }

      // Log download
      const clientIp = req.ip || req.connection.remoteAddress;
      console.log(`📥 Download NetworkMonitorService.ps1 richiesto da: ${clientIp}`);

      // Imposta headers per download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="NetworkMonitorService.ps1"');

      // Invia file
      res.sendFile(agentFilePath);
    } catch (err) {
      console.error('❌ Errore download NetworkMonitorService.ps1:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/download/agent/Avvia-Agent-Manuale.ps1
  router.get('/download/agent/Avvia-Agent-Manuale.ps1', async (req, res) => {
    try {
      const path = require('path');
      const agentFilePath = path.join(__dirname, '../../agent/Avvia-Agent-Manuale.ps1');
      try { await require('fs').promises.access(agentFilePath); } catch (e) { return res.status(404).json({ error: 'File non trovato' }); }
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="Avvia-Agent-Manuale.ps1"');
      res.sendFile(agentFilePath);
    } catch (err) { console.error('❌ Errore download Avvia-Agent-Manuale.ps1:', err); res.status(500).json({ error: 'Errore interno del server' }); }
  });

  // GET /api/network-monitoring/download/agent/Reinstalla-Servizio-Quick.ps1
  router.get('/download/agent/Reinstalla-Servizio-Quick.ps1', async (req, res) => {
    try {
      const path = require('path');
      const agentFilePath = path.join(__dirname, '../../agent/Reinstalla-Servizio-Quick.ps1');
      try { await require('fs').promises.access(agentFilePath); } catch (e) { return res.status(404).json({ error: 'File non trovato' }); }
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="Reinstalla-Servizio-Quick.ps1"');
      res.sendFile(agentFilePath);
    } catch (err) { console.error('❌ Errore download Reinstalla-Servizio-Quick.ps1:', err); res.status(500).json({ error: 'Errore interno del server' }); }
  });

  // GET /api/network-monitoring/download/agent/Avvia-TrayIcon.bat
  router.get('/download/agent/Avvia-TrayIcon.bat', async (req, res) => {
    try {
      const path = require('path');
      const agentFilePath = path.join(__dirname, '../../agent/Avvia-TrayIcon.bat');
      try { await require('fs').promises.access(agentFilePath); } catch (e) { return res.status(404).json({ error: 'File non trovato' }); }
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="Avvia-TrayIcon.bat"');
      res.sendFile(agentFilePath);
    } catch (err) { console.error('❌ Errore download Avvia-TrayIcon.bat:', err); res.status(500).json({ error: 'Errore interno del server' }); }
  });

  // GET /api/network-monitoring/download/agent/NetworkMonitorTrayIcon.ps1
  router.get('/download/agent/NetworkMonitorTrayIcon.ps1', async (req, res) => {
    try {
      const path = require('path');
      const agentFilePath = path.join(__dirname, '../../agent/NetworkMonitorTrayIcon.ps1');
      try { await require('fs').promises.access(agentFilePath); } catch (e) { return res.status(404).json({ error: 'File non trovato' }); }
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="NetworkMonitorTrayIcon.ps1"');
      res.sendFile(agentFilePath);
    } catch (err) { console.error('❌ Errore download NetworkMonitorTrayIcon.ps1:', err); res.status(500).json({ error: 'Errore interno del server' }); }
  });

  // GET /api/network-monitoring/download/agent/Start-TrayIcon-Hidden.vbs
  router.get('/download/agent/Start-TrayIcon-Hidden.vbs', async (req, res) => {
    try {
      const path = require('path');
      const agentFilePath = path.join(__dirname, '../../agent/Start-TrayIcon-Hidden.vbs');
      try { await require('fs').promises.access(agentFilePath); } catch (e) { return res.status(404).json({ error: 'File non trovato' }); }
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="Start-TrayIcon-Hidden.vbs"');
      res.sendFile(agentFilePath);
    } catch (err) { console.error('❌ Errore download Start-TrayIcon-Hidden.vbs:', err); res.status(500).json({ error: 'Errore interno del server' }); }
  });

  // Prova connessione Unifi (url/username/password dal body, per test da form prima di salvare)
  // Se l'URL è su rete locale (192.168.x, 10.x, 172.16–31.x) la VPS non può raggiungerlo:
  // il test viene delegato all'agent (riceve il comando al prossimo heartbeat e invia l'esito).
  router.post('/test-unifi', authenticateToken, async (req, res) => {
    const { agent_id, url, username, password } = req.body || {};
    if (!url || !username || !password) {
      return res.status(400).json({ error: 'Inserisci URL, username e password del controller Unifi' });
    }
    const baseUrl = String(url).trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(baseUrl)) {
      return res.status(400).json({ error: 'L\'URL deve iniziare con http:// o https://' });
    }

    // Rileva se l'URL è su rete privata/locale (la VPS non può raggiungerlo)
    const isPrivate = /^(https?:\/\/)?(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(baseUrl) ||
      /^(https?:\/\/)?(localhost|127\.|\[?::1\]?)/i.test(baseUrl);

    if (isPrivate) {
      if (!agent_id) {
        return res.status(400).json({ error: 'Per un controller su rete locale (es. 192.168.x) il test viene eseguito dall\'agent. Seleziona l\'agent e riprova.' });
      }
      const testId = 'ut-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
      pendingUnifiTests.set(Number(agent_id), { test_id: testId, url: baseUrl, username: String(username).trim(), password: String(password), created_at: Date.now() });
      return res.json({ test_id: testId, deferred: true, message: 'L\'agent eseguirà il test sulla rete locale. Attendi fino a 5 minuti (prossimo heartbeat).' });
    }

    // URL pubblico: la VPS può connettersi direttamente
    try {
      const agent = new https.Agent({ rejectUnauthorized: false });
      let loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: String(username).trim(), password: String(password) }),
        agent
      });
      if (loginRes.status === 404) {
        loginRes = await fetch(`${baseUrl}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: String(username).trim(), password: String(password) }),
          agent
        });
      }
      if (!loginRes.ok) throw new Error(`Login fallito (${loginRes.status}): credenziali errate o controller non raggiungibile`);
      const cookies = loginRes.headers.get('set-cookie');
      if (!cookies) throw new Error('Il controller non ha restituito i cookie di sessione');
      let devicesRes = await fetch(`${baseUrl}/api/s/default/stat/device`, { headers: { 'Cookie': cookies }, agent });
      if (devicesRes.status === 404) {
        devicesRes = await fetch(`${baseUrl}/proxy/network/api/s/default/stat/device`, { headers: { 'Cookie': cookies }, agent });
      }
      if (!devicesRes.ok) throw new Error('Impossibile accedere alle API del controller (stat/device)');
      res.json({ success: true, message: 'Connessione OK' });
    } catch (err) {
      console.error('❌ Test Unifi (VPS):', err);
      res.status(500).json({ error: err.message || 'Errore di connessione al controller Unifi' });
    }
  });

  // L'agent invia l'esito del test Unifi (dopo aver ricevuto pending_unifi_test nel heartbeat)
  router.post('/agent/unifi-test-result', authenticateAgent, async (req, res) => {
    const { test_id, success, message } = req.body || {};
    if (!test_id) return res.status(400).json({ error: 'test_id richiesto' });
    unifiTestResults.set(test_id, { success: !!success, message: String(message || ''), at: Date.now() });
    res.json({ ok: true });
  });

  // Il frontend interroga l'esito del test (per test delegati all'agent)
  router.get('/unifi-test-result/:test_id', authenticateToken, async (req, res) => {
    const r = unifiTestResults.get(req.params.test_id);
    if (!r) return res.json({ status: 'pending' });
    if (Date.now() - r.at > 10 * 60 * 1000) {
      unifiTestResults.delete(req.params.test_id);
      return res.json({ status: 'pending' });
    }
    res.json({ status: r.success ? 'ok' : 'error', message: r.message });
  });

  // Endpoint per sincronizzare manualmente Unifi
  router.post('/agent/:id/sync-unifi', authenticateToken, async (req, res) => {
    const agentId = req.params.id;
    try {
      // 1. Recupera configurazione Unifi
      const agentResult = await pool.query(
        'SELECT unifi_config FROM network_agents WHERE id = $1',
        [agentId]
      );

      if (agentResult.rows.length === 0) return res.status(404).json({ error: 'Agent non trovato' });

      const config = agentResult.rows[0].unifi_config;
      if (!config || !config.url || !config.username || !config.password) {
        return res.status(400).json({ error: 'Configurazione Unifi mancante' });
      }

      // 2. Tenta la connessione (ignora certificati self-signed per IP locali)
      const agent = new https.Agent({ rejectUnauthorized: false });
      const baseUrl = config.url.replace(/\/$/, '');

      // Login
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: config.username, password: config.password }),
        agent
      });

      // Supporto per vecchi controller (senza /auth/)
      let finalLoginRes = loginRes;
      if (loginRes.status === 404) {
        finalLoginRes = await fetch(`${baseUrl}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: config.username, password: config.password }),
          agent
        });
      }

      if (!finalLoginRes.ok) {
        throw new Error(`Login Unifi fallito: ${finalLoginRes.statusText}`);
      }

      // Estrai cookie
      const cookies = finalLoginRes.headers.get('set-cookie');

      // 3. Recupera devices (site default)
      // Controller classico: /api/s/default/stat/device
      // UDM Pro / UCG Max: /proxy/network/api/s/default/stat/device
      let devicesRes = await fetch(`${baseUrl}/api/s/default/stat/device`, {
        headers: { 'Cookie': cookies },
        agent
      });
      if (devicesRes.status === 404) {
        devicesRes = await fetch(`${baseUrl}/proxy/network/api/s/default/stat/device`, {
          headers: { 'Cookie': cookies },
          agent
        });
      }
      if (!devicesRes.ok) throw new Error('Impossibile recuperare lista devices');

      const { data } = await devicesRes.json();

      // 4. Aggiorna DB (match MAC normalizzato: senza separatori, maiuscolo)
      const norm = (v) => String(v || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
      let updatedCount = 0;
      for (const uDevice of data || []) {
        if (!uDevice.mac) continue;
        const upgradable = uDevice.upgradable === true || uDevice.need_upgrade === true;
        const macNorm = norm(uDevice.mac);
        if (!macNorm) continue;
        const result = await pool.query(
          `UPDATE network_devices 
            SET upgrade_available = $1 
            WHERE agent_id = $2 AND REPLACE(REPLACE(REPLACE(UPPER(COALESCE(mac_address,'')), ':', ''), '-', ''), ' ', '') = $3`,
          [upgradable, agentId, macNorm]
        );
        if (result.rowCount > 0) updatedCount++;
      }

      res.json({ success: true, message: `Sincronizzazione completata. ${updatedCount} dispositivi aggiornati.` });

    } catch (err) {
      console.error('❌ Errore Sync Unifi:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/network-monitoring/tools/ping
  // Streaming ping output via fetch/chunked encoding
  router.get('/tools/ping', authenticateToken, (req, res) => {
    const { target } = req.query;
    if (!target) return res.status(400).end('Target required');
    // Simple validation (IP or hostname)
    if (!/^[\w.-]+$/.test(target)) return res.status(400).end('Invalid target');

    // Headers for streaming
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const isWindows = process.platform === 'win32';
    // Windows requires -t to run indefinitely. Linux runs indefinitely by default.
    const args = isWindows ? ['-t', target] : [target];

    const child = spawn('ping', args);

    child.stdout.on('data', (data) => {
      res.write(data);
    });

    child.stderr.on('data', (data) => {
      res.write(`Error: ${data}`);
    });

    child.on('close', (code) => {
      res.write(`\n[Process exited with code ${code}]`);
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      child.kill();
    });
  });

  return router;
};
