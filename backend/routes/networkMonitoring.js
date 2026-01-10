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
        console.log('✅ Tabelle network monitoring già esistenti');
        return;
      }

      // Carica e esegui lo script SQL
      const fs = require('fs');
      const path = require('path');
      const sqlPath = path.join(__dirname, '../scripts/init-network-monitoring.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      
      // Rimuovi commenti e divide per statement (gestendo correttamente $$)
      let cleanedSql = sql.replace(/--.*$/gm, ''); // Rimuovi commenti inline
      
      // Esegui lo script completo (PostgreSQL supporta multipli statement se separati correttamente)
      // Dividi solo per ; che non sono dentro $$
      const statements = [];
      let currentStatement = '';
      let inDollarQuote = false;
      let dollarTag = '';
      
      for (let i = 0; i < cleanedSql.length; i++) {
        const char = cleanedSql[i];
        const nextChars = cleanedSql.substring(i, i + 2);
        
        if (nextChars === '$$') {
          inDollarQuote = !inDollarQuote;
          if (inDollarQuote) {
            // Trova il tag dopo $$
            const tagMatch = cleanedSql.substring(i + 2).match(/^([a-zA-Z0-9_]*)\$/);
            if (tagMatch) {
              dollarTag = tagMatch[1];
              currentStatement += '$$' + dollarTag;
              i += 2 + dollarTag.length;
              continue;
            }
          } else {
            dollarTag = '';
          }
          currentStatement += '$$';
          i++;
        } else if (!inDollarQuote && char === ';') {
          const trimmed = currentStatement.trim();
          if (trimmed && trimmed.length > 0) {
            statements.push(trimmed);
          }
          currentStatement = '';
        } else {
          currentStatement += char;
        }
      }
      
      // Aggiungi l'ultimo statement se presente
      if (currentStatement.trim().length > 0) {
        statements.push(currentStatement.trim());
      }
      
      // Esegui ogni statement
      for (const statement of statements) {
        if (statement.trim() && statement.trim().length > 0) {
          try {
            await pool.query(statement);
          } catch (err) {
            // Ignora errori "already exists" - tabelle potrebbero già esistere
            if (!err.message.includes('already exists') && 
                !err.message.includes('duplicate') &&
                !err.message.includes('does not exist')) {
              console.warn('⚠️ Errore esecuzione statement:', err.message);
              console.warn('⚠️ Statement:', statement.substring(0, 100) + '...');
            }
          }
        }
      }
      
      console.log('✅ Tabelle network monitoring inizializzate');
    } catch (err) {
      console.error('❌ Errore inizializzazione tabelle network monitoring:', err.message);
      // Non bloccare l'esecuzione se le tabelle esistono già
    }
  };

  // Inizializza tabelle al primo accesso
  let tablesInitialized = false;
  const ensureTables = async () => {
    if (!tablesInitialized) {
      await initTables();
      tablesInitialized = true;
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
