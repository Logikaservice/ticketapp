// routes/networkMonitoring.js
// Route per il Network Monitoring - ricezione dati dagli agent PowerShell

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

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
        // Tabelle già esistenti, non fare nulla
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
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

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
          first_seen TIMESTAMP DEFAULT NOW(),
          last_seen TIMESTAMP DEFAULT NOW(),
          UNIQUE(agent_id, ip_address, mac_address)
        );
      `);

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
        'CREATE INDEX IF NOT EXISTS idx_network_notification_config_ip ON network_notification_config(ip_address);'
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
    // Se già verificato, esci subito
    if (tablesCheckDone) {
      return;
    }
    
    // Se una verifica è già in corso, aspetta
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
      // Verifica rapida se le tabelle esistono già (più veloce che eseguire initTables)
      const checkResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'network_agents'
        );
      `);
      
      if (checkResult.rows && checkResult.rows[0] && checkResult.rows[0].exists) {
        // Tabelle già esistenti, non fare nulla - NON chiamare initTables
        tablesCheckDone = true;
        tablesCheckInProgress = false;
        return;
      }
      
      // Solo se non esistono, inizializza
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
        'SELECT id, azienda_id, agent_name, enabled FROM network_agents WHERE api_key = $1',
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
  router.post('/agent/register', async (req, res) => {
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

  // POST /api/network-monitoring/agent/heartbeat
  // Agent invia heartbeat per segnalare che è online
  router.post('/agent/heartbeat', authenticateAgent, async (req, res) => {
    try {
      const agentId = req.agent.id;
      const { version } = req.body;

      await pool.query(
        `UPDATE network_agents 
         SET last_heartbeat = NOW(), status = 'online', version = COALESCE($1, version)
         WHERE id = $2`,
        [version, agentId]
      );

      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error('❌ Errore heartbeat:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // POST /api/network-monitoring/agent/scan-results
  // Agent invia risultati della scansione (dispositivi rilevati)
  router.post('/agent/scan-results', authenticateAgent, async (req, res) => {
    try {
      const agentId = req.agent.id;
      const { devices, changes } = req.body; // devices: array, changes: array (opzionale)

      if (!devices || !Array.isArray(devices)) {
        return res.status(400).json({ error: 'devices deve essere un array' });
      }

      // Aggiorna/inserisci dispositivi
      const deviceResults = [];
      
      for (const device of devices) {
        const { ip_address, mac_address, hostname, vendor, device_type, status } = device;
        
        if (!ip_address) {
          console.warn('⚠️ Dispositivo senza IP, saltato');
          continue;
        }

        // Cerca dispositivo esistente (per IP+MAC o solo IP se MAC non disponibile)
        let existingDevice;
        
        if (mac_address && mac_address.trim() !== '') {
          const existing = await pool.query(
            `SELECT id, ip_address, mac_address, hostname, vendor, status 
             FROM network_devices 
             WHERE agent_id = $1 AND (ip_address = $2 OR mac_address = $3)`,
            [agentId, ip_address, mac_address]
          );
          existingDevice = existing.rows[0];
        } else {
          const existing = await pool.query(
            `SELECT id, ip_address, mac_address, hostname, vendor, status 
             FROM network_devices 
             WHERE agent_id = $1 AND ip_address = $2 AND (mac_address IS NULL OR mac_address = '')`,
            [agentId, ip_address]
          );
          existingDevice = existing.rows[0];
        }

        if (existingDevice) {
          // Aggiorna dispositivo esistente
          const updates = [];
          const values = [];
          let paramIndex = 1;

          if (mac_address && mac_address !== existingDevice.mac_address) {
            updates.push(`mac_address = $${paramIndex++}`);
            values.push(mac_address || null);
          }
          if (hostname && hostname !== existingDevice.hostname) {
            updates.push(`hostname = $${paramIndex++}`);
            values.push(hostname || null);
          }
          if (vendor && vendor !== existingDevice.vendor) {
            updates.push(`vendor = $${paramIndex++}`);
            values.push(vendor || null);
          }
          if (device_type && device_type !== existingDevice.device_type) {
            updates.push(`device_type = $${paramIndex++}`);
            values.push(device_type || null);
          }

          updates.push(`last_seen = NOW()`);
          updates.push(`status = $${paramIndex++}`);
          values.push(status || 'online');

          values.push(existingDevice.id);

          if (updates.length > 1) { // Almeno last_seen e status
            await pool.query(
              `UPDATE network_devices SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
              values
            );
          }

          deviceResults.push({ action: 'updated', id: existingDevice.id, ip: ip_address });
        } else {
          // Inserisci nuovo dispositivo
          // Nota: ON CONFLICT non funziona bene con mac_address NULL, quindi gestiamo manualmente
          try {
            const insertResult = await pool.query(
              `INSERT INTO network_devices (agent_id, ip_address, mac_address, hostname, vendor, device_type, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id`,
              [
                agentId,
                ip_address,
                mac_address || null,
                hostname || null,
                vendor || null,
                device_type || 'unknown',
                status || 'online'
              ]
            );

          deviceResults.push({ action: 'created', id: insertResult.rows[0].id, ip: ip_address });
          } catch (insertErr) {
            // Se fallisce per conflitto, prova a fare UPDATE
            if (insertErr.code === '23505' || insertErr.message.includes('duplicate')) {
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
              console.warn(`⚠️ Errore inserimento dispositivo ${ip_address}:`, insertErr.message);
            }
          }
        }
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

      console.log(`✅ Scan results ricevuti: ${deviceResults.length} dispositivi, ${changeResults.length} cambiamenti`);
      res.json({ 
        success: true, 
        devices_processed: deviceResults.length,
        changes_processed: changeResults.length
      });
    } catch (err) {
      console.error('❌ Errore ricezione scan results:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // GET /api/network-monitoring/clients/:aziendaId/devices
  // Ottieni lista dispositivi per un'azienda (per frontend)
  router.get('/clients/:aziendaId/devices', async (req, res) => {
    try {
      await ensureTables();
      
      const { aziendaId } = req.params;

      const result = await pool.query(
        `SELECT 
          nd.id, nd.ip_address, nd.mac_address, nd.hostname, nd.vendor, 
          nd.device_type, nd.status, nd.first_seen, nd.last_seen,
          na.agent_name, na.last_heartbeat as agent_last_seen, na.status as agent_status
         FROM network_devices nd
         INNER JOIN network_agents na ON nd.agent_id = na.id
         WHERE na.azienda_id = $1
         ORDER BY nd.last_seen DESC`,
        [aziendaId]
      );

      res.json(result.rows);
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
         WHERE azienda_id = $1
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

      const result = await pool.query(
        `SELECT 
          nc.id, nc.change_type, nc.old_value, nc.new_value, nc.detected_at, nc.notified,
          nd.ip_address, nd.mac_address, nd.hostname, nd.vendor,
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
      console.error('❌ Errore recupero tutti cambiamenti:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  return router;
};
