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
      const { version } = req.body;

      // Verifica se l'agent è eliminato o disabilitato
      const agentCheck = await pool.query(
        'SELECT enabled, deleted_at FROM network_agents WHERE id = $1',
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

      // Agent abilitato e non eliminato -> aggiorna heartbeat normalmente
      await pool.query(
        `UPDATE network_agents 
         SET last_heartbeat = NOW(), status = 'online', version = COALESCE($1, version)
         WHERE id = $2`,
        [version, agentId]
      );

      res.json({ success: true, timestamp: new Date().toISOString(), uninstall: false });
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

      console.log(`📥 Scan results ricevuti da agent ${agentId}: ${devices?.length || 0} dispositivi, ${changes?.length || 0} cambiamenti`);

      if (!devices || !Array.isArray(devices)) {
        console.error('❌ devices non è un array:', typeof devices, devices);
        return res.status(400).json({ error: 'devices deve essere un array' });
      }

      // Aggiorna/inserisci dispositivi
      const deviceResults = [];
      
      for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        const { ip_address, mac_address, hostname, vendor, device_type, status } = device;
        
        if (!ip_address) {
          console.warn(`⚠️ Dispositivo ${i + 1}/${devices.length} senza IP, saltato:`, JSON.stringify(device));
          continue;
        }

        // Log dettagliato per debug
        if (i === 0 || i === devices.length - 1) {
          console.log(`  📱 Dispositivo ${i + 1}/${devices.length}: IP=${ip_address}, MAC=${mac_address || 'N/A'}, Hostname=${hostname || 'N/A'}`);
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
            // Normalizza MAC address: rimuovi spazi e converti in formato standard
            let normalizedMac = null;
            if (mac_address && mac_address.trim() !== '' && mac_address.trim() !== '00-00-00-00-00-00') {
              normalizedMac = mac_address.trim().replace(/\s+/g, '').toUpperCase();
              // Se non ha il formato corretto, prova a convertirlo
              if (normalizedMac.length === 12 && !normalizedMac.includes('-') && !normalizedMac.includes(':')) {
                // Formato senza separatori, aggiungi trattini ogni 2 caratteri
                normalizedMac = normalizedMac -replace '(..)(..)(..)(..)(..)(..)', '$1-$2-$3-$4-$5-$6'
              }
            }

            const insertResult = await pool.query(
              `INSERT INTO network_devices (agent_id, ip_address, mac_address, hostname, vendor, device_type, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id`,
              [
                agentId,
                ip_address,
                normalizedMac,
                (hostname && hostname.trim() !== '') ? hostname.trim() : null,
                (vendor && vendor.trim() !== '') ? vendor.trim() : null,
                device_type || 'unknown',
                status || 'online'
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
          na.id, na.agent_name, na.status, na.last_heartbeat, 
          na.version, na.network_ranges, na.scan_interval_minutes, na.enabled,
          na.created_at, na.azienda_id, na.api_key,
          u.azienda
         FROM network_agents na
         LEFT JOIN users u ON na.azienda_id = u.id
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

      // Aggiungi file al ZIP
      try {
        archive.append(JSON.stringify(configJson, null, 2), { name: 'config.json' });
        console.log('✅ Aggiunto config.json');
        
        archive.append(networkMonitorContent, { name: 'NetworkMonitor.ps1' });
        console.log('✅ Aggiunto NetworkMonitor.ps1');
        
        archive.append(installerContent, { name: 'InstallerCompleto.ps1' });
        console.log('✅ Aggiunto InstallerCompleto.ps1');
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
- NetworkMonitor.ps1: Script principale agent
- InstallerCompleto.ps1: Installer automatico

## Installazione:

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

      // Finalizza ZIP
      await archive.finalize();

    } catch (err) {
      console.error('❌ Errore download pacchetto agent:', err);
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

  return router;
};
