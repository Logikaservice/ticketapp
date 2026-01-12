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
        'CREATE INDEX IF NOT EXISTS idx_network_device_types_name ON network_device_types(name);'
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
      const receivedIPs = new Set(); // Traccia gli IP ricevuti in questa scansione
      
      for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        let { ip_address, mac_address, hostname, vendor, status } = device;
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
        
        if (macAddressStr && macAddressStr !== '') {
          // Se abbiamo MAC, cerca per IP O MAC (per gestire cambi di IP)
          existingQuery = `SELECT id, ip_address, mac_address, hostname, vendor, status 
                           FROM network_devices 
                           WHERE agent_id = $1 AND (REGEXP_REPLACE(ip_address, '[{}"]', '', 'g') = $2 OR mac_address = $3)
                           ORDER BY CASE WHEN REGEXP_REPLACE(ip_address, '[{}"]', '', 'g') = $2 THEN 1 ELSE 2 END
                           LIMIT 1`;
          existingParams = [agentId, normalizedIpForSearch, macAddressStr];
        } else {
          // Se non abbiamo MAC, cerca SOLO per IP (senza vincolo su mac_address)
          // Questo evita di perdere dispositivi che avevano MAC prima ma ora non vengono trovati
          existingQuery = `SELECT id, ip_address, mac_address, hostname, vendor, status 
                           FROM network_devices 
                           WHERE agent_id = $1 AND REGEXP_REPLACE(ip_address, '[{}"]', '', 'g') = $2
                           LIMIT 1`;
          existingParams = [agentId, normalizedIpForSearch];
        }
        
        const existing = await pool.query(existingQuery, existingParams);
        existingDevice = existing.rows[0];

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

          // Aggiorna MAC se disponibile e diverso (anche se era NULL prima)
          if (normalizedMac && normalizedMac !== existingDevice.mac_address) {
            console.log(`  🔄 Aggiornamento MAC per ${ip_address}: ${existingDevice.mac_address || 'NULL'} -> ${normalizedMac}`);
            updates.push(`mac_address = $${paramIndex++}`);
            values.push(normalizedMac);
          } else if (normalizedMac && !existingDevice.mac_address) {
            // Se il dispositivo non aveva MAC e ora lo abbiamo, aggiornalo
            console.log(`  ➕ Aggiunta MAC per ${ip_address}: NULL -> ${normalizedMac}`);
            updates.push(`mac_address = $${paramIndex++}`);
            values.push(normalizedMac);
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
              // Aggiorna sempre il device_type e device_path con i valori da KeePass (sovrascrive quelli esistenti)
              console.log(`  🔍 MAC ${normalizedMac} trovato in KeePass -> Imposto device_type: "${keepassResult.title}", device_path: "${keepassResult.path}"`);
              updates.push(`device_type = $${paramIndex++}`);
              values.push(keepassResult.title);
              updates.push(`device_path = $${paramIndex++}`);
              values.push(keepassResult.path);
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
                  devicePathFromKeepass = keepassResult.path;
                  console.log(`  🔍 MAC ${normalizedMac} trovato in KeePass -> Imposto device_type: "${keepassResult.title}", device_path: "${keepassResult.path}"`);
                }
              } catch (keepassErr) {
                // Non bloccare il processo se c'è un errore con KeePass
                console.warn(`  ⚠️ Errore ricerca MAC ${normalizedMac} in KeePass:`, keepassErr.message);
              }
            }

            const insertResult = await pool.query(
              `INSERT INTO network_devices (agent_id, ip_address, mac_address, hostname, vendor, device_type, device_path, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING id`,
              [
                agentId,
                ip_address,
                normalizedMac,
                hostname || null, // hostname già normalizzato e troncato sopra
                (vendor && vendor.trim() !== '') ? vendor.trim() : null,
                deviceTypeFromKeepass || null, // device_type da KeePass se trovato
                devicePathFromKeepass || null, // device_path da KeePass se trovato
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
      
      // Assicurati che la colonna is_static esista (migrazione)
      try {
        await pool.query(`
          ALTER TABLE network_devices 
          ADD COLUMN IF NOT EXISTS is_static BOOLEAN DEFAULT false;
        `);
      } catch (migrationErr) {
        // Ignora errore se colonna esiste già
        if (!migrationErr.message.includes('already exists') && !migrationErr.message.includes('duplicate column')) {
          console.warn('⚠️ Avviso aggiunta colonna is_static in clients/:aziendaId/devices:', migrationErr.message);
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
          nd.device_type, nd.device_path, nd.status, nd.is_static, nd.first_seen, nd.last_seen,
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

      // Cerca titoli da KeePass per ogni dispositivo con MAC
      const keepassPassword = process.env.KEEPASS_PASSWORD;
      if (!keepassPassword) {
        console.warn('⚠️ KEEPASS_PASSWORD non impostata - ricerca MAC in KeePass disabilitata');
      }
      
      const processedRows = await Promise.all(result.rows.map(async (row) => {
        // Post-processa hostname se necessario
        if (row.hostname && typeof row.hostname === 'string' && row.hostname.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(row.hostname);
            row.hostname = parsed._ !== undefined ? String(parsed._ || '') : row.hostname;
          } catch {
            // Mantieni originale se non è JSON valido
          }
        }

        // Cerca MAC nel file KeePass se disponibile
        if (row.mac_address && keepassPassword) {
          try {
            console.log(`🔍 Cercando MAC ${row.mac_address} in KeePass...`);
            const keepassResult = await keepassDriveService.findMacTitle(row.mac_address, keepassPassword);
            if (keepassResult) {
              // Il titolo e il percorso da KeePass sovrascrivono sempre i valori esistenti
              console.log(`✅ MAC ${row.mac_address} trovato in KeePass -> Titolo: "${keepassResult.title}", Percorso: "${keepassResult.path}"`);
              row.device_type = keepassResult.title;
              row.device_path = keepassResult.path;
            } else {
              console.log(`ℹ️ MAC ${row.mac_address} non trovato in KeePass`);
              // Se non trovato, rimuovi eventuali valori precedenti
              row.device_path = null;
            }
          } catch (keepassErr) {
            // Non bloccare il processo se c'è un errore con KeePass
            console.error(`❌ Errore ricerca MAC ${row.mac_address} in KeePass:`, keepassErr.message);
            console.error('Stack:', keepassErr.stack);
          }
        } else if (row.mac_address && !keepassPassword) {
          console.log(`⚠️ MAC ${row.mac_address} presente ma KEEPASS_PASSWORD non configurata`);
        }

        return row;
      }));

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
          nd.device_type, nd.status, nd.first_seen, nd.last_seen,
          na.agent_name, na.azienda_id, na.last_heartbeat as agent_last_seen, na.status as agent_status,
          u.azienda
         FROM network_devices nd
         INNER JOIN network_agents na ON nd.agent_id = na.id
         LEFT JOIN users u ON na.azienda_id = u.id
         ORDER BY nd.last_seen DESC
         LIMIT 500`
      );

      // Cerca titoli da KeePass per ogni dispositivo con MAC
      const keepassPassword = process.env.KEEPASS_PASSWORD;
      if (!keepassPassword) {
        console.warn('⚠️ KEEPASS_PASSWORD non impostata - ricerca MAC in KeePass disabilitata');
      }
      
      const processedRows = await Promise.all(result.rows.map(async (row) => {
        // Post-processa hostname se necessario
        if (row.hostname && typeof row.hostname === 'string' && row.hostname.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(row.hostname);
            row.hostname = parsed._ !== undefined ? String(parsed._ || '') : row.hostname;
          } catch {
            // Mantieni originale se non è JSON valido
          }
        }

        // Cerca MAC nel file KeePass se disponibile
        if (row.mac_address && keepassPassword) {
          try {
            console.log(`🔍 Cercando MAC ${row.mac_address} in KeePass...`);
            const keepassResult = await keepassDriveService.findMacTitle(row.mac_address, keepassPassword);
            if (keepassResult) {
              // Il titolo e il percorso da KeePass sovrascrivono sempre i valori esistenti
              console.log(`✅ MAC ${row.mac_address} trovato in KeePass -> Titolo: "${keepassResult.title}", Percorso: "${keepassResult.path}"`);
              row.device_type = keepassResult.title;
              row.device_path = keepassResult.path;
            } else {
              console.log(`ℹ️ MAC ${row.mac_address} non trovato in KeePass`);
              // Se non trovato, rimuovi eventuali valori precedenti
              row.device_path = null;
            }
          } catch (keepassErr) {
            // Non bloccare il processo se c'è un errore con KeePass
            console.error(`❌ Errore ricerca MAC ${row.mac_address} in KeePass:`, keepassErr.message);
            console.error('Stack:', keepassErr.stack);
          }
        } else if (row.mac_address && !keepassPassword) {
          console.log(`⚠️ MAC ${row.mac_address} presente ma KEEPASS_PASSWORD non configurata`);
        }

        return row;
      }));

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
      const readmeServicePath = path.join(agentDir, 'README_SERVICE.md');
      const guidaInstallazionePath = path.join(agentDir, 'GUIDA_INSTALLAZIONE_SERVIZIO.md');
      const diagnosticaPath = path.join(agentDir, 'Diagnostica-Agent.ps1');

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
        // File principali (obbligatori)
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

      // File servizio Windows (NUOVO) - Aggiungi dopo README per non interrompere il flusso
      try {
        // NetworkMonitorService.ps1
        if (fs.existsSync(servicePath)) {
          const serviceContent = fs.readFileSync(servicePath, 'utf8');
          archive.append(serviceContent, { name: 'NetworkMonitorService.ps1' });
          console.log('✅ Aggiunto NetworkMonitorService.ps1');
        } else {
          console.warn('⚠️  NetworkMonitorService.ps1 non trovato!');
        }

        // Installa-Servizio.ps1
        if (fs.existsSync(installServicePath)) {
          const installServiceContent = fs.readFileSync(installServicePath, 'utf8');
          archive.append(installServiceContent, { name: 'Installa-Servizio.ps1' });
          console.log('✅ Aggiunto Installa-Servizio.ps1');
        } else {
          console.warn('⚠️  Installa-Servizio.ps1 non trovato!');
        }

        // Rimuovi-Servizio.ps1
        if (fs.existsSync(removeServicePath)) {
          const removeServiceContent = fs.readFileSync(removeServicePath, 'utf8');
          archive.append(removeServiceContent, { name: 'Rimuovi-Servizio.ps1' });
          console.log('✅ Aggiunto Rimuovi-Servizio.ps1');
        } else {
          console.warn('⚠️  Rimuovi-Servizio.ps1 non trovato!');
        }

        // Installa-Automatico.ps1 (INSTALLER AUTOMATICO)
        if (fs.existsSync(installAutoPath)) {
          const installAutoContent = fs.readFileSync(installAutoPath, 'utf8');
          archive.append(installAutoContent, { name: 'Installa-Automatico.ps1' });
          console.log('✅ Aggiunto Installa-Automatico.ps1');
        } else {
          console.warn('⚠️  Installa-Automatico.ps1 non trovato!');
        }

        // Installa.bat (INSTALLER BATCH - DOPPIO CLICK)
        if (fs.existsSync(installBatPath)) {
          const installBatContent = fs.readFileSync(installBatPath, 'utf8');
          archive.append(installBatContent, { name: 'Installa.bat' });
          console.log('✅ Aggiunto Installa.bat');
        } else {
          console.warn('⚠️  Installa.bat non trovato!');
        }

        // README_SERVICE.md
        if (fs.existsSync(readmeServicePath)) {
          const readmeServiceContent = fs.readFileSync(readmeServicePath, 'utf8');
          archive.append(readmeServiceContent, { name: 'README_SERVICE.md' });
          console.log('✅ Aggiunto README_SERVICE.md');
        }

        // GUIDA_INSTALLAZIONE_SERVIZIO.md
        if (fs.existsSync(guidaInstallazionePath)) {
          const guidaContent = fs.readFileSync(guidaInstallazionePath, 'utf8');
          archive.append(guidaContent, { name: 'GUIDA_INSTALLAZIONE_SERVIZIO.md' });
          console.log('✅ Aggiunto GUIDA_INSTALLAZIONE_SERVIZIO.md');
        }

        // Diagnostica-Agent.ps1
        if (fs.existsSync(diagnosticaPath)) {
          const diagnosticaContent = fs.readFileSync(diagnosticaPath, 'utf8');
          archive.append(diagnosticaContent, { name: 'Diagnostica-Agent.ps1' });
          console.log('✅ Aggiunto Diagnostica-Agent.ps1');
        }
        
        // NetworkMonitorTrayIcon.ps1 (tray icon separata per avvio automatico)
        if (fs.existsSync(trayIconPath)) {
          const trayIconContent = fs.readFileSync(trayIconPath, 'utf8');
          archive.append(trayIconContent, { name: 'NetworkMonitorTrayIcon.ps1' });
          console.log('✅ Aggiunto NetworkMonitorTrayIcon.ps1');
        } else {
          console.warn('⚠️  NetworkMonitorTrayIcon.ps1 non trovato!');
        }
        
        // Disinstalla-Tutto.ps1 e .bat
        const disinstallaTuttoPath = path.join(agentDir, 'Disinstalla-Tutto.ps1');
        const disinstallaTuttoBatPath = path.join(agentDir, 'Disinstalla-Tutto.bat');
        
        if (fs.existsSync(disinstallaTuttoPath)) {
          const disinstallaTuttoContent = fs.readFileSync(disinstallaTuttoPath, 'utf8');
          archive.append(disinstallaTuttoContent, { name: 'Disinstalla-Tutto.ps1' });
          console.log('✅ Aggiunto Disinstalla-Tutto.ps1');
        }
        
        if (fs.existsSync(disinstallaTuttoBatPath)) {
          const disinstallaTuttoBatContent = fs.readFileSync(disinstallaTuttoBatPath, 'utf8');
          archive.append(disinstallaTuttoBatContent, { name: 'Disinstalla-Tutto.bat' });
          console.log('✅ Aggiunto Disinstalla-Tutto.bat');
        }
        
        // nssm.exe (incluso nel pacchetto - non serve download esterno)
        const nssmPath = path.join(agentDir, 'nssm.exe');
        console.log('🔍 Verifica nssm.exe:', nssmPath);
        console.log('   Esiste:', fs.existsSync(nssmPath));
        if (fs.existsSync(nssmPath)) {
          try {
            const nssmContent = fs.readFileSync(nssmPath);
            archive.append(nssmContent, { name: 'nssm.exe' });
            console.log('✅ Aggiunto nssm.exe al ZIP');
          } catch (nssmErr) {
            console.error('❌ Errore lettura nssm.exe:', nssmErr);
            console.warn('⚠️  nssm.exe non aggiunto al ZIP a causa di errore');
          }
        } else {
          console.warn('⚠️  nssm.exe non trovato in:', nssmPath);
          console.warn('   Agent dir:', agentDir);
          console.warn('   Assicurati che nssm.exe sia presente in agent/nssm.exe sul server');
        }
      } catch (serviceErr) {
        console.error('❌ Errore aggiunta file servizio allo ZIP:', serviceErr);
        // Non bloccare se i file servizio non sono disponibili (compatibilità)
      }

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

      console.log(`✅ Agent ${agentId} aggiornato: ${updateFields.join(', ')}`);
      res.json({ 
        success: true, 
        agent: result.rows[0], 
        message: 'Configurazione agent aggiornata. Le modifiche saranno applicate al prossimo heartbeat dell\'agent.' 
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

  return router;
};
