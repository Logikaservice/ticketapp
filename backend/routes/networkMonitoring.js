// routes/networkMonitoring.js
// Route per il Network Monitoring - ricezione dati dagli agent PowerShell

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

module.exports = (pool, io) => {
  // Funzione helper per inizializzare le tabelle se non esistono
  const initTables = async () => {
    try {
      // Verifica se le tabelle esistono giÃ 
      const checkResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'network_agents'
        );
      `);

      if (checkResult.rows[0].exists) {
        // Tabelle giÃ  esistenti, ma verifica che network_device_types esista (per migrazione)
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
            console.log('âœ… Tabella network_device_types creata (migrazione)');
          }
        } catch (migrationErr) {
          console.warn('âš ï¸ Errore migrazione network_device_types:', migrationErr.message);
        }
        return;
      }

      // Se le tabelle non esistono, creale usando query dirette (piÃ¹ affidabile)
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
        // Ignora errore se colonna esiste giÃ 
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
          console.warn('âš ï¸ Avviso aggiunta colonna deleted_at:', err.message);
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
        // Ignora errore se colonna esiste giÃ 
        if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
          console.warn('âš ï¸ Avviso aggiunta colonna is_static:', err.message);
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

      // Inserisci tipi di default se la tabella Ã¨ vuota
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
        'CREATE INDEX IF NOT EXISTS idx_network_device_types_name ON network_device_types(name);'
      ];

      for (const indexSql of indexes) {
        try {
          await pool.query(indexSql);
        } catch (err) {
          // Ignora errori "already exists"
          if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
            console.warn('âš ï¸ Errore creazione indice:', err.message);
          }
        }
      }

      // Crea funzione e trigger (solo se non esistono)
      // Prima verifica se la funzione esiste giÃ 
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
        // Ignora errori se funzione/trigger esistono giÃ  o altri errori non critici
        if (!err.message.includes('already exists') &&
          !err.message.includes('duplicate') &&
          !err.message.includes('does not exist')) {
          console.warn('âš ï¸ Errore creazione funzione/trigger:', err.message);
        }
      }

      console.log('âœ… Tabelle network monitoring inizializzate');
    } catch (err) {
      console.error('âŒ Errore inizializzazione tabelle network monitoring:', err.message);
      // Non bloccare l'esecuzione se le tabelle esistono giÃ 
    }
  };

  // Inizializza tabelle al primo accesso (cache per evitare chiamate multiple)
  let tablesCheckDone = false;
  let tablesCheckInProgress = false;
  const ensureTables = async () => {
    // Se giÃ  verificato, esci subito
    if (tablesCheckDone) {
      return;
    }

    // Se una verifica Ã¨ giÃ  in corso, aspetta
    if (tablesCheckInProgress) {
      // Aspetta fino a 5 secondi che la verifica finisca
      let waitCount = 0;
      while (tablesCheckInProgress && waitCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      return;
    }

    tablesCheckInProgress = true;
    try {
      // Verifica rapida se le tabelle esistono giÃ  (piÃ¹ veloce che eseguire initTables)
      const checkResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'network_agents'
        );
      `);

      if (checkResult.rows && checkResult.rows[0] && checkResult.rows[0].exists) {
        // Tabelle giÃ  esistenti, non fare nulla - NON chiamare initTables
        tablesCheckDone = true;
        tablesCheckInProgress = false;
        return;
      }

      // Solo se non esistono, inizializza
      await initTables();
      tablesCheckDone = true;
    } catch (err) {
      // Ignora errori di verifica - le tabelle verranno create al primo accesso
      // Non loggare come errore se Ã¨ solo un problema di verifica
      if (!err.message.includes('network_agents')) {
        console.warn('âš ï¸ Verifica tabelle network monitoring fallita:', err.message);
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
      console.error('âŒ Errore autenticazione agent:', err);
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

      console.log(`âœ… Agent registrato: ID=${result.rows[0].id}, Azienda=${azienda_id}`);
      res.json({ success: true, agent: result.rows[0] });
    } catch (err) {
      console.error('âŒ Errore registrazione agent:', err);
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
        api_key: apiKey, // Restituisci la stessa API key per comoditÃ 
        agent_name: agent.agent_name,
        network_ranges: agent.network_ranges || [],
        scan_interval_minutes: agent.scan_interval_minutes || 15
      });
    } catch (err) {
      console.error('âŒ Errore recupero configurazione agent:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // POST /api/network-monitoring/agent/heartbeat
  // Agent invia heartbeat per segnalare che Ã¨ online
  // Se l'agent Ã¨ eliminato (deleted_at IS NOT NULL), restituisce comando di disinstallazione
  // Se l'agent Ã¨ solo disabilitato (enabled=false), rifiuta i dati ma non disinstalla
  router.post('/agent/heartbeat', authenticateAgent, async (req, res) => {
    try {
      const agentId = req.agent.id;
      const { version } = req.body;

      // Verifica se l'agent Ã¨ eliminato o disabilitato
      const agentCheck = await pool.query(
        'SELECT enabled, deleted_at FROM network_agents WHERE id = $1',
        [agentId]
      );

      if (agentCheck.rows.length === 0) {
        // Agent non esiste piÃ¹ -> comando disinstallazione
        return res.json({
          success: false,
          uninstall: true,
          message: 'Agent non trovato nel database'
        });
      }

      const agentEnabled = agentCheck.rows[0].enabled;
      const agentDeletedAt = agentCheck.rows[0].deleted_at;

      // Se l'agent Ã¨ eliminato (soft delete) -> comando disinstallazione
      if (agentDeletedAt) {
        console.log(`ðŸ—‘ï¸ Agent ${agentId} eliminato - comando disinstallazione`);
        return res.json({
          success: false,
          uninstall: true,
          message: 'Agent eliminato dal server'
        });
      }

      // Se l'agent Ã¨ disabilitato ma non eliminato -> rifiuta heartbeat (non aggiorna, non disinstalla)
      if (!agentEnabled) {
        console.log(`ðŸ”´ Agent ${agentId} disabilitato - rifiuto heartbeat (non disinstallo)`);
        return res.status(403).json({
          success: false,
          uninstall: false,
          error: 'Agent disabilitato',
          message: 'L\'agent Ã¨ disabilitato ma non disinstallato. I dati non verranno accettati.'
        });
      }

      // Agent abilitato e non eliminato -> aggiorna heartbeat normalmente
      await pool.query(
        `UPDATE network_agents 
         SET last_heartbeat = NOW(), status = 'online', version = COALESCE($1, version)
         WHERE id = $2`,
        [version, agentId]
      );

      res.json({ success: true, timestamp: new Date().toISOString(), uninstall: false });
    } catch (err) {
      console.error('âŒ Errore heartbeat:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // POST /api/network-monitoring/agent/scan-results
  // Agent invia risultati della scansione (dispositivi rilevati)
  // POST /api/network-monitoring/agent/scan-results - DISABLED
  router.post('/agent/scan-results', authenticateAgent, async (req, res) => {
    res.status(503).json({error: 'Disabled due to syntax error'});
  });

// GET /api/network-monitoring/clients/:aziendaId/devices
// Ottieni lista dispositivi per un'azienda (per frontend)
router.get('/clients/:aziendaId/devices', async (req, res) => {
  try {
    await ensureTables();

    // Assicurati che la colonna is_static esista (migrazione)
    try {
      await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS is_static BOOLEAN DEFAULT false;
        `);
    } catch (migrationErr) {
      // Ignora errore se colonna esiste giÃ 
      if (!migrationErr.message.includes('already exists') && !migrationErr.message.includes('duplicate column')) {
        console.warn('âš ï¸ Avviso aggiunta colonna is_static in clients/:aziendaId/devices:', migrationErr.message);
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

      // 2. Rimuovi duplicati: mantieni il dispositivo piÃ¹ recente o quello con piÃ¹ dati
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
      console.warn('âš ï¸ Avviso pulizia IP duplicati:', migrationErr.message);
    }

    const aziendaIdParam = req.params.aziendaId;
    console.log('ðŸ” Route /clients/:aziendaId/devices - aziendaIdParam:', aziendaIdParam, 'type:', typeof aziendaIdParam);
    const aziendaId = parseInt(aziendaIdParam, 10);
    console.log('ðŸ” Route /clients/:aziendaId/devices - aziendaId parsed:', aziendaId, 'type:', typeof aziendaId, 'isNaN:', isNaN(aziendaId));

    if (isNaN(aziendaId) || aziendaId <= 0) {
      console.error('âŒ ID azienda non valido:', aziendaIdParam, 'parsed:', aziendaId);
      return res.status(400).json({ error: 'ID azienda non valido' });
    }

    console.log('ðŸ” Eseguendo query con aziendaId:', aziendaId);
    const result = await pool.query(
      `SELECT 
          nd.id, nd.ip_address, nd.mac_address, nd.hostname, nd.vendor, 
          nd.device_type, nd.status, nd.is_static, nd.first_seen, nd.last_seen,
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

    res.json(result.rows);
  } catch (err) {
    console.error('âŒ Errore recupero dispositivi:', err);
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
          nd.ip_address, nd.mac_address, nd.hostname, nd.vendor,
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
    console.error('âŒ Errore recupero cambiamenti:', err);
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
    console.error('âŒ Errore recupero status agent:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/network-monitoring/all/devices
// Ottieni tutti i dispositivi di tutte le aziende (per dashboard principale)
router.get('/all/devices', async (req, res) => {
  try {
    await ensureTables();

    const result = await pool.query(
      `SELECT 
          nd.id, nd.ip_address, nd.mac_address, nd.hostname, nd.vendor, 
          nd.device_type, nd.status, nd.first_seen, nd.last_seen,
          na.agent_name, na.azienda_id, na.last_heartbeat as agent_last_seen, na.status as agent_status,
          u.azienda
         FROM network_devices nd
         INNER JOIN network_agents na ON nd.agent_id = na.id
         LEFT JOIN users u ON na.azienda_id = u.id
         ORDER BY nd.last_seen DESC
         LIMIT 500`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('âŒ Errore recupero tutti dispositivi:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/network-monitoring/all/changes
// Ottieni tutti i cambiamenti recenti (per dashboard principale)
router.get('/all/changes', async (req, res) => {
  try {
    await ensureTables();

    const limit = parseInt(req.query.limit) || 200;

    // Assicurati che la colonna is_static esista (migrazione)
    try {
      await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS is_static BOOLEAN DEFAULT false;
        `);
    } catch (migrationErr) {
      // Ignora errore se colonna esiste giÃ 
      if (!migrationErr.message.includes('already exists') && !migrationErr.message.includes('duplicate column')) {
        console.warn('âš ï¸ Avviso aggiunta colonna is_static in all/changes:', migrationErr.message);
      }
    }

    const result = await pool.query(
      `SELECT 
          nc.id, nc.change_type, nc.old_value, nc.new_value, nc.detected_at, nc.notified,
          nd.ip_address, nd.mac_address, nd.hostname, nd.vendor, nd.device_type, nd.is_static,
          na.agent_name, na.azienda_id,
          u.azienda
         FROM network_changes nc
         INNER JOIN network_devices nd ON nc.device_id = nd.id
         INNER JOIN network_agents na ON nc.agent_id = na.id
         LEFT JOIN users u ON na.azienda_id = u.id
         ORDER BY nc.detected_at DESC
         LIMIT $1`,
      [limit]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('âŒ Errore recupero tutti cambiamenti:', err);
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

    // Per ogni azienda, conta gli agent associati
    const companiesWithAgents = await Promise.all(
      companiesResult.rows.map(async (row) => {
        const agentCount = await pool.query(
          `SELECT COUNT(*) as count 
             FROM network_agents na
             INNER JOIN users u ON na.azienda_id = u.id
             WHERE u.azienda = $1`,
          [row.azienda]
        );
        return {
          id: row.id,
          azienda: row.azienda,
          agents_count: parseInt(agentCount.rows[0].count) || 0
        };
      })
    );

    res.json(companiesWithAgents);
  } catch (err) {
    console.error('âŒ Errore recupero aziende:', err);
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
    console.error('âŒ Errore recupero agent:', err);
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
    console.error('âŒ Errore recupero configurazione agent:', err);
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
    // __dirname Ã¨ backend/routes, quindi risaliamo di 2 livelli per arrivare alla root
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
    const readmeServicePath = path.join(agentDir, 'README_SERVICE.md');
    const guidaInstallazionePath = path.join(agentDir, 'GUIDA_INSTALLAZIONE_SERVIZIO.md');
    const diagnosticaPath = path.join(agentDir, 'Diagnostica-Agent.ps1');

    console.log('ðŸ“¦ Download pacchetto agent - Path ricerca file:');
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
      console.log(`ðŸ” Tentativo path: ${pathSet.label}`);
      console.log(`   NetworkMonitor: ${pathSet.network} (exists: ${fs.existsSync(pathSet.network)})`);
      console.log(`   InstallerCompleto: ${pathSet.installer} (exists: ${fs.existsSync(pathSet.installer)})`);

      if (fs.existsSync(pathSet.network) && fs.existsSync(pathSet.installer)) {
        try {
          console.log(`âœ… File trovati usando: ${pathSet.label}`);
          networkMonitorContent = fs.readFileSync(pathSet.network, 'utf8');
          installerContent = fs.readFileSync(pathSet.installer, 'utf8');
          filesFound = true;
          usedPath = pathSet.label;
          console.log(`âœ… File letti con successo: NetworkMonitor.ps1 (${networkMonitorContent.length} caratteri), InstallerCompleto.ps1 (${installerContent.length} caratteri)`);
          break;
        } catch (readErr) {
          console.error(`âŒ Errore lettura file da ${pathSet.label}:`, readErr.message);
          continue;
        }
      }
    }

    if (!filesFound) {
      const errorMsg = `File agent non trovati in nessuno dei path provati. Verifica che i file NetworkMonitor.ps1 e InstallerCompleto.ps1 siano presenti nella cartella agent/ del progetto.`;
      console.error('âŒ', errorMsg);
      console.error('  Path provati:');
      possiblePaths.forEach(p => {
        console.error(`    - ${p.label}: NetworkMonitor=${fs.existsSync(p.network)}, Installer=${fs.existsSync(p.installer)}`);
      });
      return res.status(500).json({ error: errorMsg });
    }

    // Crea config.json
    const configJson = {
      server_url: req.protocol + '://' + req.get('host'),
      api_key: agent.api_key,
      agent_name: agent.agent_name,
      version: "1.0.0",
      network_ranges: agent.network_ranges || [],
      scan_interval_minutes: agent.scan_interval_minutes || 15
    };

    // Nome file ZIP
    const zipFileName = `NetworkMonitor-Agent-${agent.agent_name.replace(/\s+/g, '-')}.zip`;

    console.log('ðŸ“¦ Creazione ZIP:', zipFileName);

    // Configura headers per download ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

    // Crea ZIP
    const archive = archiver('zip', {
      zlib: { level: 9 } // Massima compressione
    });

    console.log('âœ… Archivio creato, aggiungo file...');

    // Gestisci errori
    archive.on('error', (err) => {
      console.error('âŒ Errore creazione ZIP:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: `Errore creazione pacchetto: ${err.message}` });
      }
    });

    // Gestisci errori di risposta
    res.on('error', (err) => {
      console.error('âŒ Errore invio risposta:', err);
      archive.abort();
    });

    // Pipe ZIP alla risposta
    archive.pipe(res);

    // Aggiungi file al ZIP
    try {
      // File principali (obbligatori)
      archive.append(JSON.stringify(configJson, null, 2), { name: 'config.json' });
      console.log('âœ… Aggiunto config.json');

      archive.append(networkMonitorContent, { name: 'NetworkMonitor.ps1' });
      console.log('âœ… Aggiunto NetworkMonitor.ps1');

      archive.append(installerContent, { name: 'InstallerCompleto.ps1' });
      console.log('âœ… Aggiunto InstallerCompleto.ps1');
    } catch (appendErr) {
      console.error('âŒ Errore aggiunta file allo ZIP:', appendErr);
      if (!res.headersSent) {
        return res.status(500).json({ error: `Errore creazione ZIP: ${appendErr.message}` });
      }
    }

    // Aggiungi README
    const readmeContent = `# Network Monitor Agent - Installazione

## âš ï¸ IMPORTANTE: Directory Installazione

I file devono rimanere nella directory di installazione dopo l'installazione!
Se cancelli questi file, l'agent smetterÃ  di funzionare.

### Consigli:
- Estrai lo ZIP in una directory PERMANENTE (es: C:\\ProgramData\\NetworkMonitorAgent\\)
- NON nella cartella Download (viene spesso pulita automaticamente)
- Dopo l'installazione, NON cancellare i file

## File inclusi:
- config.json: Configurazione agent (API Key, reti, intervallo scansione)
- NetworkMonitor.ps1: Script principale agent (compatibilitÃ )
- InstallerCompleto.ps1: Installer automatico (Scheduled Task - metodo vecchio)
- NetworkMonitorService.ps1: Script servizio Windows (NUOVO)
- Installa-Servizio.ps1: Installer servizio Windows (NUOVO - consigliato)
- Rimuovi-Servizio.ps1: Disinstaller servizio Windows (NUOVO)
- Installa-Automatico.ps1: Installer automatico completo (NUOVO)
- Installa.bat: Installer batch (doppio click - NUOVO)
- README_SERVICE.md: Documentazione servizio Windows (NUOVO)

## Installazione (3 metodi):

### Metodo 1: Installazione Automatica (PIÃ™ SEMPLICE - NUOVO! ðŸŽ‰)
**Fai solo doppio click e segui le istruzioni!**

1. Estrai il ZIP in una directory (anche Desktop va bene)
2. **Fai doppio click su "Installa.bat"**
3. Clicca "SÃ¬" quando Windows chiede autorizzazioni amministratore
4. Segui le istruzioni a schermo (premi invio quando richiesto)
5. Fine! Il servizio Ã¨ installato in C:\\ProgramData\\NetworkMonitorAgent\\ automaticamente

**Cosa fa automaticamente:**
- âœ… Richiede privilegi admin (automatico)
- âœ… Copia tutti i file in C:\\ProgramData\\NetworkMonitorAgent\\
- âœ… Rimuove il vecchio Scheduled Task (se presente)
- âœ… Installa e avvia il servizio Windows
- âœ… Tutto senza aprire PowerShell manualmente!

### Metodo 2: Servizio Windows (Manuale)
Il servizio rimane sempre attivo, anche dopo riavvio, con icona nella system tray.

1. Estrarre tutti i file in una directory permanente (es: C:\\ProgramData\\NetworkMonitorAgent\\)
2. Esegui PowerShell come Amministratore
3. Esegui: .\\Installa-Servizio.ps1 -RemoveOldTask
4. Il servizio verrÃ  installato e avviato automaticamente
5. (Opzionale) Per mostrare l'icona nella system tray: .\\NetworkMonitorService.ps1

Vedi README_SERVICE.md per dettagli completi.

### Metodo 3: Scheduled Task (Vecchio metodo - non consigliato)
Per compatibilitÃ  con installazioni esistenti.

1. Estrarre tutti i file in una directory permanente (es: C:\\ProgramData\\NetworkMonitorAgent\\)
2. Tasto destro su "InstallerCompleto.ps1" â†’ "Esegui con PowerShell"
3. Inserire l'API Key quando richiesto (giÃ  presente in config.json, ma l'installer la richiederÃ  per verifica)
4. L'installer configurerÃ  tutto automaticamente

âš ï¸ NON cancellare i file dopo l'installazione! Devono rimanere nella directory.

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
    console.log('âœ… Aggiunto README.txt');

    // File servizio Windows (NUOVO) - Aggiungi dopo README per non interrompere il flusso
    try {
      // NetworkMonitorService.ps1
      if (fs.existsSync(servicePath)) {
        const serviceContent = fs.readFileSync(servicePath, 'utf8');
        archive.append(serviceContent, { name: 'NetworkMonitorService.ps1' });
        console.log('âœ… Aggiunto NetworkMonitorService.ps1');
      } else {
        console.warn('âš ï¸  NetworkMonitorService.ps1 non trovato!');
      }

      // Installa-Servizio.ps1
      if (fs.existsSync(installServicePath)) {
        const installServiceContent = fs.readFileSync(installServicePath, 'utf8');
        archive.append(installServiceContent, { name: 'Installa-Servizio.ps1' });
        console.log('âœ… Aggiunto Installa-Servizio.ps1');
      } else {
        console.warn('âš ï¸  Installa-Servizio.ps1 non trovato!');
      }

      // Rimuovi-Servizio.ps1
      if (fs.existsSync(removeServicePath)) {
        const removeServiceContent = fs.readFileSync(removeServicePath, 'utf8');
        archive.append(removeServiceContent, { name: 'Rimuovi-Servizio.ps1' });
        console.log('âœ… Aggiunto Rimuovi-Servizio.ps1');
      } else {
        console.warn('âš ï¸  Rimuovi-Servizio.ps1 non trovato!');
      }

      // Installa-Automatico.ps1 (INSTALLER AUTOMATICO)
      if (fs.existsSync(installAutoPath)) {
        const installAutoContent = fs.readFileSync(installAutoPath, 'utf8');
        archive.append(installAutoContent, { name: 'Installa-Automatico.ps1' });
        console.log('âœ… Aggiunto Installa-Automatico.ps1');
      } else {
        console.warn('âš ï¸  Installa-Automatico.ps1 non trovato!');
      }

      // Installa.bat (INSTALLER BATCH - DOPPIO CLICK)
      if (fs.existsSync(installBatPath)) {
        const installBatContent = fs.readFileSync(installBatPath, 'utf8');
        archive.append(installBatContent, { name: 'Installa.bat' });
        console.log('âœ… Aggiunto Installa.bat');
      } else {
        console.warn('âš ï¸  Installa.bat non trovato!');
      }

      // README_SERVICE.md
      if (fs.existsSync(readmeServicePath)) {
        const readmeServiceContent = fs.readFileSync(readmeServicePath, 'utf8');
        archive.append(readmeServiceContent, { name: 'README_SERVICE.md' });
        console.log('âœ… Aggiunto README_SERVICE.md');
      }

      // GUIDA_INSTALLAZIONE_SERVIZIO.md
      if (fs.existsSync(guidaInstallazionePath)) {
        const guidaContent = fs.readFileSync(guidaInstallazionePath, 'utf8');
        archive.append(guidaContent, { name: 'GUIDA_INSTALLAZIONE_SERVIZIO.md' });
        console.log('âœ… Aggiunto GUIDA_INSTALLAZIONE_SERVIZIO.md');
      }

      // Diagnostica-Agent.ps1
      if (fs.existsSync(diagnosticaPath)) {
        const diagnosticaContent = fs.readFileSync(diagnosticaPath, 'utf8');
        archive.append(diagnosticaContent, { name: 'Diagnostica-Agent.ps1' });
        console.log('âœ… Aggiunto Diagnostica-Agent.ps1');
      }

      // NetworkMonitorTrayIcon.ps1 (tray icon separata per avvio automatico)
      if (fs.existsSync(trayIconPath)) {
        const trayIconContent = fs.readFileSync(trayIconPath, 'utf8');
        archive.append(trayIconContent, { name: 'NetworkMonitorTrayIcon.ps1' });
        console.log('âœ… Aggiunto NetworkMonitorTrayIcon.ps1');
      } else {
        console.warn('âš ï¸  NetworkMonitorTrayIcon.ps1 non trovato!');
      }

      // Disinstalla-Tutto.ps1 e .bat
      const disinstallaTuttoPath = path.join(agentDir, 'Disinstalla-Tutto.ps1');
      const disinstallaTuttoBatPath = path.join(agentDir, 'Disinstalla-Tutto.bat');

      if (fs.existsSync(disinstallaTuttoPath)) {
        const disinstallaTuttoContent = fs.readFileSync(disinstallaTuttoPath, 'utf8');
        archive.append(disinstallaTuttoContent, { name: 'Disinstalla-Tutto.ps1' });
        console.log('âœ… Aggiunto Disinstalla-Tutto.ps1');
      }

      if (fs.existsSync(disinstallaTuttoBatPath)) {
        const disinstallaTuttoBatContent = fs.readFileSync(disinstallaTuttoBatPath, 'utf8');
        archive.append(disinstallaTuttoBatContent, { name: 'Disinstalla-Tutto.bat' });
        console.log('âœ… Aggiunto Disinstalla-Tutto.bat');
      }

      // nssm.exe (incluso nel pacchetto - non serve download esterno)
      const nssmPath = path.join(agentDir, 'nssm.exe');
      console.log('ðŸ” Verifica nssm.exe:', nssmPath);
      console.log('   Esiste:', fs.existsSync(nssmPath));
      if (fs.existsSync(nssmPath)) {
        try {
          const nssmContent = fs.readFileSync(nssmPath);
          archive.append(nssmContent, { name: 'nssm.exe' });
          console.log('âœ… Aggiunto nssm.exe al ZIP');
        } catch (nssmErr) {
          console.error('âŒ Errore lettura nssm.exe:', nssmErr);
          console.warn('âš ï¸  nssm.exe non aggiunto al ZIP a causa di errore');
        }
      } else {
        console.warn('âš ï¸  nssm.exe non trovato in:', nssmPath);
        console.warn('   Agent dir:', agentDir);
        console.warn('   Assicurati che nssm.exe sia presente in agent/nssm.exe sul server');
      }
    } catch (serviceErr) {
      console.error('âŒ Errore aggiunta file servizio allo ZIP:', serviceErr);
      // Non bloccare se i file servizio non sono disponibili (compatibilitÃ )
    }

    // Finalizza ZIP
    await archive.finalize();

  } catch (err) {
    console.error('âŒ Errore download pacchetto agent:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Errore interno del server' });
    }
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
      return res.status(404).json({ error: 'Agent non trovato o giÃ  eliminato' });
    }

    console.log(`ðŸ”´ Agent ${agentId} disabilitato (ricezione dati bloccata, agent rimane installato)`);
    res.json({ success: true, agent: result.rows[0], message: 'Agent disabilitato. I dati non verranno piÃ¹ accettati, ma l\'agent rimane installato sul client.' });
  } catch (err) {
    console.error('âŒ Errore disabilitazione agent:', err);
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

    console.log(`âœ… Agent ${agentId} riabilitato`);
    res.json({ success: true, agent: result.rows[0], message: 'Agent riabilitato. I dati verranno nuovamente accettati.' });
  } catch (err) {
    console.error('âŒ Errore riabilitazione agent:', err);
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

    // Aggiungi updated_at
    updateFields.push(`updated_at = NOW()`);
    updateValues.push(agentId);

    const query = `
        UPDATE network_agents 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND deleted_at IS NULL
        RETURNING id, agent_name, network_ranges, scan_interval_minutes, enabled, status, updated_at
      `;

    const result = await pool.query(query, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent non trovato o eliminato' });
    }

    console.log(`âœ… Agent ${agentId} aggiornato: ${updateFields.join(', ')}`);
    res.json({
      success: true,
      agent: result.rows[0],
      message: 'Configurazione agent aggiornata. Le modifiche saranno applicate al prossimo heartbeat dell\'agent.'
    });
  } catch (err) {
    console.error('âŒ Errore aggiornamento agent:', err);
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

    // Verifica che l'agent esista e non sia giÃ  eliminato
    const checkResult = await pool.query(
      'SELECT id, agent_name, deleted_at FROM network_agents WHERE id = $1',
      [agentId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Agent non trovato' });
    }

    if (checkResult.rows[0].deleted_at) {
      return res.status(400).json({ error: 'Agent giÃ  eliminato' });
    }

    // Soft delete: marca come eliminato (mantiene tutti i dati per i ticket)
    await pool.query(
      `UPDATE network_agents 
         SET deleted_at = NOW(), enabled = false, status = 'offline', updated_at = NOW()
         WHERE id = $1`,
      [agentId]
    );

    console.log(`ðŸ—‘ï¸ Agent ${agentId} eliminato (soft delete - dati mantenuti, comando disinstallazione al prossimo heartbeat)`);
    res.json({ success: true, message: 'Agent eliminato. I dati sono stati mantenuti. L\'agent si disinstallerÃ  automaticamente dal client al prossimo heartbeat.' });
  } catch (err) {
    console.error('âŒ Errore eliminazione agent:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ========================================
// API TIPI DISPOSITIVI (Device Types)
// ========================================

// GET /api/network-monitoring/device-types
// Ottieni lista tipi dispositivi
router.get('/device-types', authenticateToken, requireRole('tecnico'), async (req, res) => {
  try {
    await ensureTables();
    const result = await pool.query(
      'SELECT id, name, description, created_at, updated_at FROM network_device_types ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('âŒ Errore recupero tipi dispositivi:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// POST /api/network-monitoring/device-types
// Crea nuovo tipo dispositivo
router.post('/device-types', authenticateToken, requireRole('tecnico'), async (req, res) => {
  try {
    await ensureTables();

    // Assicurati che la tabella network_device_types esista (migrazione)
    try {
      const deviceTypesCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'network_device_types'
          );
        `);
      if (!deviceTypesCheck.rows[0].exists) {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS network_device_types (
              id SERIAL PRIMARY KEY,
              name VARCHAR(100) UNIQUE NOT NULL,
              description TEXT,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            );
          `);
      }
    } catch (migrationErr) {
      console.warn('âš ï¸ Avviso migrazione network_device_types in POST:', migrationErr.message);
    }

    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Nome tipo richiesto' });
    }

    const result = await pool.query(
      'INSERT INTO network_device_types (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at, updated_at',
      [name.trim(), description?.trim() || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Tipo dispositivo giÃ  esistente' });
    }
    console.error('âŒ Errore creazione tipo dispositivo:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// PUT /api/network-monitoring/device-types/:id
// Aggiorna tipo dispositivo
router.put('/device-types/:id', authenticateToken, requireRole('tecnico'), async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Nome tipo richiesto' });
    }

    const result = await pool.query(
      'UPDATE network_device_types SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING id, name, description, created_at, updated_at',
      [name.trim(), description?.trim() || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tipo dispositivo non trovato' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Tipo dispositivo giÃ  esistente' });
    }
    console.error('âŒ Errore aggiornamento tipo dispositivo:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// DELETE /api/network-monitoring/device-types/:id
// Elimina tipo dispositivo
router.delete('/device-types/:id', authenticateToken, requireRole('tecnico'), async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;

    // Verifica se il tipo Ã¨ usato da qualche dispositivo
    const devicesCheck = await pool.query(
      'SELECT COUNT(*) FROM network_devices WHERE device_type = (SELECT name FROM network_device_types WHERE id = $1)',
      [id]
    );

    if (parseInt(devicesCheck.rows[0].count) > 0) {
      return res.status(409).json({ error: 'Impossibile eliminare: tipo in uso da dispositivi' });
    }

    const result = await pool.query(
      'DELETE FROM network_device_types WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tipo dispositivo non trovato' });
    }

    res.json({ success: true, message: 'Tipo dispositivo eliminato' });
  } catch (err) {
    console.error('âŒ Errore eliminazione tipo dispositivo:', err);
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
      // Ignora errore se colonna esiste giÃ 
      if (!migrationErr.message.includes('already exists') && !migrationErr.message.includes('duplicate column')) {
        console.warn('âš ï¸ Avviso aggiunta colonna is_static in PATCH static:', migrationErr.message);
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
    console.error('âŒ Errore aggiornamento stato statico:', err);
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

    // Se device_type Ã¨ specificato, verifica che esista nella tabella tipi
    if (device_type && device_type.trim() !== '') {
      const typeCheck = await pool.query(
        'SELECT id FROM network_device_types WHERE name = $1',
        [device_type.trim()]
      );

      if (typeCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Tipo dispositivo non valido' });
      }
    }

    // Aggiorna il dispositivo
    const result = await pool.query(
      'UPDATE network_devices SET device_type = $1 WHERE id = $2 RETURNING id, ip_address, device_type',
      [device_type?.trim() || null, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('âŒ Errore aggiornamento tipo dispositivo:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

return router;
};
