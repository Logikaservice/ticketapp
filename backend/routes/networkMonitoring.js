// routes/networkMonitoring.js
// Route per il Network Monitoring - ricezione dati dagli agent PowerShell

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const keepassDriveService = require('../utils/keepassDriveService');
const telegramService = require('../services/TelegramService');

module.exports = (pool, io) => {
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
        // Tabelle già esistenti, ma verifica che network_device_types esista (per migrazione)
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
          UNIQUE(azienda_id, agent_id)
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
        // Tutte le tabelle necessarie esistono, non fare nulla
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
      
      const { azienda_id, agent_name, network_ranges, scan_interval_minutes } = req.body;

      if (!azienda_id) {
        return res.status(400).json({ error: 'azienda_id richiesto' });
      }

      // Genera API key univoca
      const apiKey = crypto.randomBytes(32).toString('hex');

      const result = await pool.query(
        `INSERT INTO network_agents (azienda_id, api_key, agent_name, network_ranges, scan_interval_minutes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, api_key, agent_name, created_at`,
        [
          azienda_id,
          apiKey,
          agent_name || `Agent ${new Date().toISOString()}`,
          network_ranges || [],
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
      let agentPackageVersion = "1.0.0";
      try {
        const projectRoot = path.resolve(__dirname, '..', '..');
        const agentDir = path.join(projectRoot, 'agent');
        const servicePath = path.join(agentDir, 'NetworkMonitorService.ps1');
        if (fs.existsSync(servicePath)) {
          const serviceContent = fs.readFileSync(servicePath, 'utf8');
          const versionMatch = serviceContent.match(/\$SCRIPT_VERSION\s*=\s*"([\d\.]+)"/);
          if (versionMatch) {
            agentPackageVersion = versionMatch[1];
          }
        }
      } catch (versionErr) {
        // Non bloccare la risposta se non riusciamo a leggere la versione
        console.warn('⚠️ Impossibile leggere versione pacchetto agent:', versionErr.message);
      }
      
      const result = await pool.query(
        `SELECT id, agent_name, network_ranges, scan_interval_minutes, enabled 
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
        scan_interval_minutes: agent.scan_interval_minutes || 15
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
      const { version, system_uptime, network_issue_detected, network_issue_duration } = req.body;

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

      res.json({ success: true, timestamp: new Date().toISOString(), uninstall: false });
    } catch (err) {
      // Non loggare come errore se è solo la tabella network_agent_events mancante (già gestito nel catch interno)
      if (err.code !== '42P01' || !err.message.includes('network_agent_events')) {
        console.error('❌ Errore heartbeat:', err);
      }
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Funzione helper per inviare notifiche Telegram
  async function sendTelegramNotification(agentId, aziendaId, messageType, data) {
    try {
      // Ottieni configurazione Telegram per questo agent/azienda
      const configResult = await pool.query(
        `SELECT bot_token, chat_id, enabled, 
                notify_agent_offline, notify_ip_changes, 
                notify_mac_changes, notify_status_changes
         FROM network_telegram_config
         WHERE (agent_id = $1 OR azienda_id = $2)
           AND enabled = true
         ORDER BY agent_id DESC NULLS LAST
         LIMIT 1`,
        [agentId, aziendaId]
      );

      if (configResult.rows.length === 0) {
        return false; // Nessuna configurazione Telegram
      }

      const config = configResult.rows[0];
      
      // Verifica se questo tipo di notifica è abilitato
      let shouldNotify = false;
      let message = '';

      switch (messageType) {
        case 'agent_offline':
          shouldNotify = config.notify_agent_offline;
          if (shouldNotify) {
            message = telegramService.formatAgentOfflineMessage(
              data.agentName,
              data.lastHeartbeat
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
      telegramService.initialize(config.bot_token, config.chat_id);

      // Invia messaggio
      return await telegramService.sendMessage(message);
    } catch (error) {
      console.error('❌ Errore invio notifica Telegram:', error);
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
      const receivedIPs = new Set(); // Traccia gli IP ricevuti in questa scansione
      
      for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        let { ip_address, mac_address, hostname, vendor, status, has_ping_failures } = device;
        // device_type non viene più inviato dall'agent, sarà gestito manualmente
        
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
          // Se non ha il formato corretto, prova a convertirlo
          if (normalizedMacForSearch.length === 12 && !normalizedMacForSearch.includes('-') && !normalizedMacForSearch.includes(':')) {
            // Formato senza separatori, aggiungi trattini ogni 2 caratteri
            normalizedMacForSearch = normalizedMacForSearch.replace(/(..)(..)(..)(..)(..)(..)/, '$1-$2-$3-$4-$5-$6');
          }
          // Verifica che sia un MAC valido (17 caratteri con trattini)
          if (normalizedMacForSearch.length !== 17 || !/^([0-9A-F]{2}-){5}[0-9A-F]{2}$/i.test(normalizedMacForSearch)) {
            normalizedMacForSearch = null;
          }
        }

        // SEMPLIFICAZIONE: Cerca PRIMA per IP (più affidabile per matching immediato)
        // Se non trova per IP, cerca per MAC (per gestire cambi di IP)
        // Questo evita confusione e duplicati
        
        // 1. Cerca PRIMA per IP (priorità massima - l'agent ha trovato questo IP ora)
        existingQuery = `SELECT id, ip_address, mac_address, hostname, vendor, status, is_static, previous_ip, previous_mac, accepted_ip, accepted_mac, has_ping_failures
                         FROM network_devices 
                         WHERE agent_id = $1 AND REGEXP_REPLACE(ip_address, '[{}"]', '', 'g') = $2
                         LIMIT 1`;
        existingParams = [agentId, normalizedIpForSearch];
        
        let existingResult = await pool.query(existingQuery, existingParams);
        existingDevice = existingResult.rows[0];
        
        // 2. Se non trovato per IP E abbiamo MAC, cerca per MAC (per gestire cambi di IP)
        if (!existingDevice && normalizedMacForSearch && normalizedMacForSearch !== '') {
          existingQuery = `SELECT id, ip_address, mac_address, hostname, vendor, status, is_static, previous_ip, previous_mac, accepted_ip, accepted_mac, has_ping_failures
                           FROM network_devices 
                           WHERE agent_id = $1 AND mac_address = $2
                           LIMIT 1`;
          existingParams = [agentId, normalizedMacForSearch];
          existingResult = await pool.query(existingQuery, existingParams);
          existingDevice = existingResult.rows[0];
          
          if (existingDevice) {
            console.log(`  🔄 Dispositivo trovato per MAC ${normalizedMacForSearch}, ma IP cambiato: ${existingDevice.ip_address} -> ${ip_address}`);
          }
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
              // Prendi solo i primi 17 caratteri (formato standard MAC: XX-XX-XX-XX-XX-XX)
              normalizedMac = normalizedMac.substring(0, 17);
            }
            // Se non ha il formato corretto, prova a convertirlo
            if (normalizedMac.length === 12 && !normalizedMac.includes('-') && !normalizedMac.includes(':')) {
              // Formato senza separatori, aggiungi trattini ogni 2 caratteri
              normalizedMac = normalizedMac.replace(/(..)(..)(..)(..)(..)(..)/, '$1-$2-$3-$4-$5-$6');
            }
            // Verifica che sia un MAC valido (17 caratteri con trattini)
            if (normalizedMac.length !== 17 || !/^([0-9A-F]{2}-){5}[0-9A-F]{2}$/i.test(normalizedMac)) {
              normalizedMac = null;
            }
          }

          // Rileva cambiamenti IP su dispositivi statici
          const normalizedCurrentIp = normalizedIpForSearch;
          const existingIp = existingDevice.ip_address ? existingDevice.ip_address.replace(/[{}"]/g, '').trim() : null;
          if (existingDevice.is_static && normalizedCurrentIp !== existingIp) {
            // Controlla se il nuovo IP è quello accettato dall'utente
            const acceptedIp = existingDevice.accepted_ip ? existingDevice.accepted_ip.replace(/[{}"]/g, '').trim() : null;
            if (acceptedIp && normalizedCurrentIp === acceptedIp) {
              // L'IP è quello accettato dall'utente, non mostrare warning
              console.log(`  ℹ️ IP cambiato ma accettato dall'utente: ${existingIp} -> ${normalizedCurrentIp} (accettato)`);
              // Aggiorna solo l'IP, non salvare previous_ip
              updates.push(`ip_address = $${paramIndex++}`);
              values.push(normalizedCurrentIp);
            } else {
              // Dispositivo statico con IP cambiato - salva valore precedente
              console.log(`  ⚠️ IP CAMBIATO per dispositivo statico ${existingIp} -> ${normalizedCurrentIp}`);
              updates.push(`previous_ip = $${paramIndex++}`);
              values.push(existingIp);
              // Aggiorna anche l'IP
              updates.push(`ip_address = $${paramIndex++}`);
              values.push(normalizedCurrentIp);
              
              // Invia notifica Telegram
              try {
                const agentInfo = await pool.query(
                  'SELECT agent_name, azienda_id FROM network_agents WHERE id = $1',
                  [agentId]
                );
                
                if (agentInfo.rows.length > 0) {
                  await sendTelegramNotification(
                    agentId,
                    agentInfo.rows[0].azienda_id,
                    'ip_changed',
                    {
                      hostname: existingDevice.hostname,
                      mac: existingDevice.mac_address,
                      oldIP: existingIp,
                      newIP: normalizedCurrentIp,
                      agentName: agentInfo.rows[0].agent_name
                    }
                  );
                }
              } catch (telegramErr) {
                console.error('❌ Errore invio notifica Telegram per cambio IP:', telegramErr);
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
                
                // Invia notifica Telegram
                try {
                  const agentInfo = await pool.query(
                    'SELECT agent_name, azienda_id FROM network_agents WHERE id = $1',
                    [agentId]
                  );
                  
                  if (agentInfo.rows.length > 0) {
                    await sendTelegramNotification(
                      agentId,
                      agentInfo.rows[0].azienda_id,
                      'mac_changed',
                      {
                        hostname: existingDevice.hostname,
                        ip: existingDevice.ip_address,
                        oldMAC: existingDevice.mac_address,
                        newMAC: normalizedMac,
                        agentName: agentInfo.rows[0].agent_name
                      }
                    );
                  }
                } catch (telegramErr) {
                  console.error('❌ Errore invio notifica Telegram per cambio MAC:', telegramErr);
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
          
          // Usa hostname già normalizzato (troncato a max 100 caratteri)
          if (hostname && hostname !== existingDevice.hostname) {
            updates.push(`hostname = $${paramIndex++}`);
            values.push(hostname); // hostname già normalizzato e troncato sopra
          }
          // Nota: se hostname non viene fornito, preserva quello esistente (non lo cancella)
          if (vendor && vendor !== existingDevice.vendor) {
            updates.push(`vendor = $${paramIndex++}`);
            values.push(vendor || null);
          }
          // Ricerca automatica MAC in KeePass per impostare device_type
          // IMPORTANTE: Cerca sempre in KeePass se il MAC è disponibile, anche se device_type esiste già
          if (normalizedMac && process.env.KEEPASS_PASSWORD) {
            try {
            const keepassResult = await keepassDriveService.findMacTitle(normalizedMac, process.env.KEEPASS_PASSWORD);
            if (keepassResult) {
              // Estrai solo l'ultimo elemento del percorso (es: "gestione > logikaservice.it > Pippo2" -> "Pippo2")
              const lastPathElement = keepassResult.path ? keepassResult.path.split(' > ').pop() : null;
              // Aggiorna sempre il device_type e device_path con i valori da KeePass (sovrascrive quelli esistenti)
              console.log(`  🔍 MAC ${normalizedMac} trovato in KeePass -> Imposto device_type: "${keepassResult.title}", device_path: "${lastPathElement}"`);
              updates.push(`device_type = $${paramIndex++}`);
              values.push(keepassResult.title);
              updates.push(`device_path = $${paramIndex++}`);
              values.push(lastPathElement);
            } else {
              // MAC non trovato in KeePass: resetta i valori se erano presenti
              // Questo gestisce il caso in cui un MAC è stato rimosso da KeePass
              if (existingDevice.device_type !== null || existingDevice.device_path !== null) {
                console.log(`  🔍 MAC ${normalizedMac} NON trovato in KeePass -> Reset device_type e device_path`);
                updates.push(`device_type = $${paramIndex++}`);
                values.push(null);
                updates.push(`device_path = $${paramIndex++}`);
                values.push(null);
              }
            }
            } catch (keepassErr) {
              // Non bloccare il processo se c'è un errore con KeePass
              console.warn(`  ⚠️ Errore ricerca MAC ${normalizedMac} in KeePass:`, keepassErr.message);
            }
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
                // Prendi solo i primi 17 caratteri (formato standard MAC: XX-XX-XX-XX-XX-XX)
                normalizedMac = normalizedMac.substring(0, 17);
              }
              // Se non ha il formato corretto, prova a convertirlo
              if (normalizedMac.length === 12 && !normalizedMac.includes('-') && !normalizedMac.includes(':')) {
                // Formato senza separatori, aggiungi trattini ogni 2 caratteri
                normalizedMac = normalizedMac.replace(/(..)(..)(..)(..)(..)(..)/, '$1-$2-$3-$4-$5-$6');
              }
              // Verifica che sia un MAC valido (17 caratteri con trattini)
              if (normalizedMac.length !== 17 || !/^([0-9A-F]{2}-){5}[0-9A-F]{2}$/i.test(normalizedMac)) {
                normalizedMac = null;
              }
            }

            // Ricerca automatica MAC in KeePass per impostare device_type e device_path
            let deviceTypeFromKeepass = null;
            let devicePathFromKeepass = null;
            if (normalizedMac && process.env.KEEPASS_PASSWORD) {
              try {
                const keepassResult = await keepassDriveService.findMacTitle(normalizedMac, process.env.KEEPASS_PASSWORD);
                if (keepassResult) {
                  deviceTypeFromKeepass = keepassResult.title;
                  // Estrai solo l'ultimo elemento del percorso (es: "gestione > logikaservice.it > Pippo2" -> "Pippo2")
                  devicePathFromKeepass = keepassResult.path ? keepassResult.path.split(' > ').pop() : null;
                  console.log(`  🔍 MAC ${normalizedMac} trovato in KeePass -> Imposto device_type: "${keepassResult.title}", device_path: "${devicePathFromKeepass}"`);
                }
              } catch (keepassErr) {
                // Non bloccare il processo se c'è un errore con KeePass
                console.warn(`  ⚠️ Errore ricerca MAC ${normalizedMac} in KeePass:`, keepassErr.message);
              }
            }

            const insertResult = await pool.query(
              `INSERT INTO network_devices (agent_id, ip_address, mac_address, hostname, vendor, device_type, device_path, status, has_ping_failures)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING id`,
              [
                agentId,
                ip_address,
                normalizedMac,
                hostname || null, // hostname già normalizzato e troncato sopra
                (vendor && vendor.trim() !== '') ? vendor.trim() : null,
                deviceTypeFromKeepass || null, // device_type da KeePass se trovato
                devicePathFromKeepass || null, // device_path da KeePass se trovato
                status || 'online',
                has_ping_failures === true // has_ping_failures (default false)
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
          'SELECT id, ip_address, status FROM network_devices WHERE agent_id = $1',
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
            await pool.query(
              'UPDATE network_devices SET status = $1 WHERE id = $2',
              ['offline', device.id]
            );
            console.log(`    📴 Dispositivo ${device.ip_address} marcato come offline`);
            
            // Invia notifica Telegram se dispositivo statico
            if (device.is_static) {
              try {
                const agentInfo = await pool.query(
                  'SELECT agent_name, azienda_id FROM network_agents WHERE id = $1',
                  [agentId]
                );
                
                if (agentInfo.rows.length > 0) {
                  await sendTelegramNotification(
                    agentId,
                    agentInfo.rows[0].azienda_id,
                    'status_changed',
                    {
                      hostname: device.hostname,
                      ip: device.ip_address,
                      mac: device.mac_address,
                      oldStatus: 'online',
                      status: 'offline',
                      agentName: agentInfo.rows[0].agent_name
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
            
            // Invia notifica Telegram se dispositivo statico
            if (device.is_static) {
              try {
                const agentInfo = await pool.query(
                  'SELECT agent_name, azienda_id FROM network_agents WHERE id = $1',
                  [agentId]
                );
                
                if (agentInfo.rows.length > 0) {
                  await sendTelegramNotification(
                    agentId,
                    agentInfo.rows[0].azienda_id,
                    'status_changed',
                    {
                      hostname: device.hostname,
                      ip: device.ip_address,
                      mac: device.mac_address,
                      oldStatus: 'offline',
                      status: 'online',
                      agentName: agentInfo.rows[0].agent_name
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
            
            // Verifica se è un dispositivo statico e invia notifica Telegram
            try {
              const deviceCheck = await pool.query(
                'SELECT is_static, hostname, ip_address, mac_address, status FROM network_devices WHERE id = $1',
                [deviceId]
              );
              
              if (deviceCheck.rows.length > 0 && deviceCheck.rows[0].is_static) {
                const device = deviceCheck.rows[0];
                const agentInfo = await pool.query(
                  'SELECT agent_name, azienda_id FROM network_agents WHERE id = $1',
                  [agentId]
                );
                
                if (agentInfo.rows.length > 0) {
                  await sendTelegramNotification(
                    agentId,
                    agentInfo.rows[0].azienda_id,
                    'status_changed',
                    {
                      hostname: device.hostname,
                      ip: device.ip_address,
                      mac: device.mac_address,
                      oldStatus: change_type === 'device_offline' ? 'online' : 'offline',
                      status: change_type === 'device_offline' ? 'offline' : 'online',
                      agentName: agentInfo.rows[0].agent_name
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
          nd.device_type, nd.device_path, nd.device_username, nd.status, nd.is_static, nd.first_seen, nd.last_seen,
          nd.previous_ip, nd.previous_mac, nd.has_ping_failures,
          na.agent_name, na.last_heartbeat as agent_last_seen, na.status as agent_status
         FROM network_devices nd
         INNER JOIN network_agents na ON nd.agent_id = na.id
         WHERE na.azienda_id = $1
         ORDER BY 
           CAST(split_part(REGEXP_REPLACE(nd.ip_address, '[{}"]', '', 'g'), '.', 1) AS INTEGER),
           CAST(split_part(REGEXP_REPLACE(nd.ip_address, '[{}"]', '', 'g'), '.', 2) AS INTEGER),
           CAST(split_part(REGEXP_REPLACE(nd.ip_address, '[{}"]', '', 'g'), '.', 3) AS INTEGER),
           CAST(split_part(REGEXP_REPLACE(nd.ip_address, '[{}"]', '', 'g'), '.', 4) AS INTEGER) ASC`,
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
        if (row.mac_address && keepassMap) {
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
      console.error('❌ Errore recupero dispositivi:', err);
      res.status(500).json({ error: 'Errore interno del server' });
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
          nd.device_type, nd.device_path, nd.device_username, nd.status, nd.is_static, nd.first_seen, nd.last_seen,
          nd.previous_ip, nd.previous_mac, nd.has_ping_failures,
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

        // Cerca MAC nella mappa KeePass (già caricata)
        if (row.mac_address && keepassMap) {
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
    
    // Se richiesto, conta i cambiamenti delle ultime 24 ore
    // IMPORTANTE: Esegui questa query PRIMA della query principale per evitare timeout
    let count24h = null;
    if (req.query.count24h === 'true') {
      try {
        // Costruisci la condizione per le ultime 24 ore (non da mezzanotte!)
        let count24hCondition = '';
        let countParams = [];
        
        if (searchConditions) {
          // Se c'è già una condizione WHERE, aggiungi AND per le ultime 24 ore
          count24hCondition = searchConditions + ` AND nc.detected_at >= NOW() - INTERVAL '24 hours'`;
          countParams = queryParams.slice(0, -1); // Rimuovi il limit dai params
        } else {
          // Altrimenti crea una nuova condizione WHERE per le ultime 24 ore
          count24hCondition = `WHERE nc.detected_at >= NOW() - INTERVAL '24 hours'`;
          countParams = [];
        }
        
        // Query semplificata e veloce con timeout
        const countQuery = `
          SELECT COUNT(*) as count
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
                '["\s]+$', ''
              )
            WHEN LENGTH(nd.hostname) > 100 THEN LEFT(nd.hostname, 97) || '...'
            ELSE REGEXP_REPLACE(nd.hostname, '^[{\s"]+', '')  -- Rimuovi caratteri JSON iniziali
          END as hostname,
          nd.vendor, nd.device_type, nd.is_static,
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
      // Filtra solo le aziende che hanno almeno un agent
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
      
      // Filtra solo le aziende che hanno almeno un agent
      const companiesWithAgentsFiltered = companiesWithAgents.filter(company => company.agents_count > 0);
      
      res.json(companiesWithAgentsFiltered);
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
      
      const result = await pool.query(
        `SELECT 
          na.id, na.agent_name, 
          CASE 
            WHEN na.last_heartbeat IS NULL THEN 'offline'
            WHEN na.last_heartbeat > NOW() - INTERVAL '10 minutes' THEN 'online'
            ELSE 'offline'
          END as status,
          na.last_heartbeat, 
          na.version, na.network_ranges, na.scan_interval_minutes, na.enabled,
          na.created_at, na.azienda_id, na.api_key,
          u.azienda
         FROM network_agents na
         LEFT JOIN users u ON na.azienda_id = u.id
         WHERE na.deleted_at IS NULL
         ORDER BY na.created_at DESC`
      );

      res.json(result.rows);
    } catch (err) {
      console.error('❌ Errore recupero agent:', err);
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

      // Leggi versione dal file NetworkMonitorService.ps1 se disponibile
      let agentVersion = "1.0.0"; // Default
      if (fs.existsSync(servicePath)) {
        try {
          const serviceContent = fs.readFileSync(servicePath, 'utf8');
          // Cerca $SCRIPT_VERSION = "X.Y.Z"
          const versionMatch = serviceContent.match(/\$SCRIPT_VERSION\s*=\s*"([\d\.]+)"/);
          if (versionMatch) {
            agentVersion = versionMatch[1];
            console.log(`✅ Versione agent letta da NetworkMonitorService.ps1: ${agentVersion}`);
          } else {
            // Fallback: cerca nel commento "Versione: X.Y.Z"
            const commentMatch = serviceContent.match(/Versione:\s*([\d\.]+)/);
            if (commentMatch) {
              agentVersion = commentMatch[1];
              console.log(`✅ Versione agent letta da commento: ${agentVersion}`);
            }
          }
        } catch (versionErr) {
          console.warn(`⚠️  Impossibile leggere versione da NetworkMonitorService.ps1: ${versionErr.message}`);
        }
      }

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

      // Aggiungi file al ZIP (SOLO FILE ESSENZIALI)
      try {
        // File principali (obbligatori)
        archive.append(JSON.stringify(configJson, null, 2), { name: 'config.json' });
        console.log('✅ Aggiunto config.json');
        
        // NetworkMonitorService.ps1 (script principale servizio)
        if (fs.existsSync(servicePath)) {
          const serviceContent = fs.readFileSync(servicePath, 'utf8');
          archive.append(serviceContent, { name: 'NetworkMonitorService.ps1' });
          console.log('✅ Aggiunto NetworkMonitorService.ps1');
        }
        
        // NetworkMonitorTrayIcon.ps1 (tray icon)
        const trayIconPath = path.join(agentDir, 'NetworkMonitorTrayIcon.ps1');
        if (fs.existsSync(trayIconPath)) {
          const trayIconContent = fs.readFileSync(trayIconPath, 'utf8');
          archive.append(trayIconContent, { name: 'NetworkMonitorTrayIcon.ps1' });
          console.log('✅ Aggiunto NetworkMonitorTrayIcon.ps1');
        }
        
        // Start-TrayIcon-Hidden.vbs (launcher tray icon)
        const startTrayIconPath = path.join(agentDir, 'Start-TrayIcon-Hidden.vbs');
        if (fs.existsSync(startTrayIconPath)) {
          const startTrayIconContent = fs.readFileSync(startTrayIconPath, 'utf8');
          archive.append(startTrayIconContent, { name: 'Start-TrayIcon-Hidden.vbs' });
          console.log('✅ Aggiunto Start-TrayIcon-Hidden.vbs');
        }
        
        // Installa-Agent.bat (installer unico - SOLO COMANDI NATIVI, NO POWERSHELL)
        const installAgentBatPath = path.join(agentDir, 'Installa-Agent.bat');
        if (fs.existsSync(installAgentBatPath)) {
          const installAgentBatContent = fs.readFileSync(installAgentBatPath, 'utf8');
          archive.append(installAgentBatContent, { name: 'Installa-Agent.bat' });
          console.log('✅ Aggiunto Installa-Agent.bat');
        }
        
        // Installa-Agent.ps1 (backup, opzionale)
        const installAgentPath = path.join(agentDir, 'Installa-Agent.ps1');
        if (fs.existsSync(installAgentPath)) {
          const installAgentContent = fs.readFileSync(installAgentPath, 'utf8');
          archive.append(installAgentContent, { name: 'Installa-Agent.ps1' });
          console.log('✅ Aggiunto Installa-Agent.ps1 (backup)');
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
      
      // Assicurati che la colonna is_static esista (migrazione)
      try {
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS is_static BOOLEAN DEFAULT false;
        `);
      } catch (migrationErr) {
        // Ignora errore se colonna esiste già
        if (!migrationErr.message.includes('already exists') && !migrationErr.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonna is_static in PATCH static:', migrationErr.message);
        }
      }
      
      const { id } = req.params;
      const { is_static } = req.body;

      // Verifica che il dispositivo esista
      const deviceCheck = await pool.query(
        'SELECT id FROM network_devices WHERE id = $1',
        [id]
      );

      if (deviceCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Dispositivo non trovato' });
      }

      // Aggiorna il dispositivo
      const result = await pool.query(
        'UPDATE network_devices SET is_static = $1 WHERE id = $2 RETURNING id, ip_address, is_static',
        [is_static === true || is_static === 'true', id]
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


      // Aggiorna il dispositivo
      const result = await pool.query(
        'UPDATE network_devices SET device_type = $1 WHERE id = $2 RETURNING id, ip_address, device_type',
        [device_type?.trim() || null, id]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error('❌ Errore aggiornamento tipo dispositivo:', err);
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
        `SELECT id, mac_address, device_type, device_path, device_username 
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
            const needsUpdate = 
              (device.device_type !== keepassResult.title) || 
              (device.device_path !== lastPathElement) ||
              (device.device_username !== (keepassResult.username || null)) ||
              (device.device_type === null && keepassResult.title !== null) ||
              (device.device_path === null && lastPathElement !== null) ||
              (device.device_username === null && keepassResult.username !== null && keepassResult.username !== '');
            
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
            if (device.device_type !== null || device.device_path !== null || device.device_username !== null) {
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
            'SELECT azienda_id FROM network_agents WHERE id = $1',
            [agent.id]
          );
          
          if (agentInfo.rows.length > 0) {
            await sendTelegramNotification(
              agent.id,
              agentInfo.rows[0].azienda_id,
              'agent_offline',
              {
                agentName: agent.agent_name,
                lastHeartbeat: agent.last_heartbeat
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
      const sent = await telegramService.sendMessage(message);
      
      if (sent) {
        console.log(`✅ Test notifica: Messaggio inviato con successo per config ID ${id}`);
        res.json({ 
          success: true, 
          message: 'Notifica di test inviata con successo! Controlla Telegram.',
          notification_type,
          test_data: testData
        });
      } else {
        console.error(`❌ Test notifica: Errore invio messaggio per config ID ${id}`);
        res.status(500).json({ 
          error: 'Errore invio notifica di test',
          details: 'Controlla i log del backend per dettagli. Verifica che il bot token e chat ID siano corretti e che il bot possa inviare messaggi al chat ID specificato.'
        });
      }
    } catch (err) {
      console.error('❌ Errore test notifica Telegram:', err);
      res.status(500).json({ 
        error: 'Errore interno del server',
        details: err.message 
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

  return router;
};
