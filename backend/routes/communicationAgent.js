// routes/communicationAgent.js
// Sistema di Comunicazione Agent - Notifiche push ai client
// Permette al tecnico di inviare messaggi ai PC dei clienti

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

module.exports = (pool, io) => {

    // ============================================
    // INIZIALIZZAZIONE TABELLE
    // ============================================
    let tablesReady = false;
    let tableInitError = null;

    const ensureTables = async () => {
        if (tablesReady) return;

        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS comm_agents (
                  id SERIAL PRIMARY KEY,
                  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                  machine_name VARCHAR(255),
                  machine_id VARCHAR(255),
                  api_key VARCHAR(255) UNIQUE NOT NULL,
                  status VARCHAR(20) DEFAULT 'offline',
                  last_heartbeat TIMESTAMPTZ,
                  version VARCHAR(50) DEFAULT '1.0.0',
                  os_info TEXT,
                  ip_address VARCHAR(45),
                  installed_at TIMESTAMPTZ DEFAULT NOW(),
                  created_at TIMESTAMPTZ DEFAULT NOW(),
                  UNIQUE(user_id, machine_id)
                );
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS comm_messages (
                  id SERIAL PRIMARY KEY,
                  sender_id INTEGER REFERENCES users(id),
                  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('single', 'group', 'broadcast')),
                  target_agent_id INTEGER REFERENCES comm_agents(id) ON DELETE SET NULL,
                  target_company VARCHAR(255),
                  title VARCHAR(500) NOT NULL,
                  body TEXT NOT NULL,
                  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
                  category VARCHAR(50) DEFAULT 'info' CHECK (category IN ('info', 'warning', 'maintenance', 'update', 'urgent')),
                  created_at TIMESTAMPTZ DEFAULT NOW(),
                  expires_at TIMESTAMPTZ
                );
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS comm_message_delivery (
                  id SERIAL PRIMARY KEY,
                  message_id INTEGER REFERENCES comm_messages(id) ON DELETE CASCADE,
                  agent_id INTEGER REFERENCES comm_agents(id) ON DELETE CASCADE,
                  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'read')),
                  delivered_at TIMESTAMPTZ,
                  read_at TIMESTAMPTZ,
                  UNIQUE(message_id, agent_id)
                );
            `);

            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_agents_user ON comm_agents(user_id);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_agents_status ON comm_agents(status);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_agents_api_key ON comm_agents(api_key);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_messages_sender ON comm_messages(sender_id);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_messages_target ON comm_messages(target_type);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_message_delivery_agent ON comm_message_delivery(agent_id);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_message_delivery_status ON comm_message_delivery(status);`);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS comm_device_info (
                  id SERIAL PRIMARY KEY,
                  agent_id INTEGER NOT NULL REFERENCES comm_agents(id) ON DELETE CASCADE UNIQUE,
                  mac VARCHAR(48),
                  device_name VARCHAR(255),
                  ip_addresses TEXT,
                  primary_ip VARCHAR(512),
                  os_name VARCHAR(255),
                  os_version VARCHAR(255),
                  os_arch VARCHAR(32),
                  os_install_date TIMESTAMPTZ,
                  manufacturer VARCHAR(255),
                  model VARCHAR(255),
                  device_type VARCHAR(32),
                  cpu_name VARCHAR(255),
                  cpu_cores INTEGER,
                  cpu_clock_mhz INTEGER,
                  gpu_name VARCHAR(255),
                  gpus_json JSONB,
                  ram_total_gb NUMERIC(10,2),
                  ram_free_gb NUMERIC(10,2),
                  disks_json JSONB,
                  "current_user" VARCHAR(255),
                  battery_status VARCHAR(64),
                  battery_percent INTEGER,
                  battery_charging BOOLEAN,
                  antivirus_name VARCHAR(255),
                  antivirus_state VARCHAR(64),
                  updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            `);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_device_info_agent ON comm_device_info(agent_id);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_device_info_mac ON comm_device_info(mac);`);

            // MIGRATION
            try {
                await pool.query(`
                    ALTER TABLE comm_device_info 
                    ADD COLUMN IF NOT EXISTS primary_ip VARCHAR(512),
                    ADD COLUMN IF NOT EXISTS os_install_date TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS model VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS device_type VARCHAR(32),
                    ADD COLUMN IF NOT EXISTS cpu_name VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS cpu_cores INTEGER,
                    ADD COLUMN IF NOT EXISTS cpu_clock_mhz INTEGER,
                    ADD COLUMN IF NOT EXISTS gpu_name VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS gpus_json JSONB,
                    ADD COLUMN IF NOT EXISTS ram_total_gb NUMERIC(10,2),
                    ADD COLUMN IF NOT EXISTS ram_free_gb NUMERIC(10,2),
                    ADD COLUMN IF NOT EXISTS disks_json JSONB,
                    ADD COLUMN IF NOT EXISTS "current_user" VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS battery_status VARCHAR(64),
                    ADD COLUMN IF NOT EXISTS battery_percent INTEGER,
                    ADD COLUMN IF NOT EXISTS battery_charging BOOLEAN,
                    ADD COLUMN IF NOT EXISTS antivirus_name VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS antivirus_state VARCHAR(64);
                `);
            } catch (migErr) {
                console.error("Migration fallita:", migErr);
                tableInitError = migErr.message;
            }

            tablesReady = true;
            console.log('✅ Tabelle Communication Agent inizializzate');
        } catch (err) {
            console.error('❌ Errore inizializzazione tabelle comm_agent:', err.message);
            tableInitError = err.message;
            throw err;
        }
    };

    // ============================================
    // MIDDLEWARE AUTENTICAZIONE AGENT
    // ============================================
    const authenticateCommAgent = async (req, res, next) => {
        try {
            const apiKey = req.headers['x-comm-api-key'];
            if (!apiKey) {
                return res.status(401).json({ error: 'API Key comunicazione richiesta' });
            }
            await ensureTables();
            const result = await pool.query(
                'SELECT ca.id, ca.user_id, ca.machine_name, ca.machine_id, ca.status, u.email, u.nome, u.cognome, u.azienda FROM comm_agents ca JOIN users u ON ca.user_id = u.id WHERE ca.api_key = $1',
                [apiKey]
            );
            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'API Key comunicazione non valida' });
            }
            req.commAgent = result.rows[0];
            next();
        } catch (err) {
            console.error('❌ Errore auth comm agent:', err);
            res.status(500).json({ error: 'Errore interno' });
        }
    };

    // ============================================
    // REGISTRAZIONE AGENT (l'agent si registra con email/password)
    // ============================================
    router.post('/agent/register', async (req, res) => {
        try {
            await ensureTables();
            const { email, password, machine_name, machine_id, os_info } = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email e password richiesti' });
            }

            // Verifica credenziali utente
            const userResult = await pool.query(
                'SELECT id, email, password, nome, cognome, azienda, ruolo FROM users WHERE email = $1',
                [email]
            );

            if (userResult.rows.length === 0) {
                return res.status(401).json({ error: 'Email non trovata' });
            }

            const user = userResult.rows[0];

            // Verifica password (in chiaro nel sistema attuale)
            if (user.password !== password) {
                return res.status(401).json({ error: 'Password non valida' });
            }

            // Genera API key unica
            const apiKey = 'COMM-' + crypto.randomBytes(32).toString('hex');

            // Se machine_id già esistente per questo utente, aggiorna
            const existingAgent = await pool.query(
                'SELECT id FROM comm_agents WHERE user_id = $1 AND machine_id = $2',
                [user.id, machine_id || 'default']
            );

            let agentId;
            if (existingAgent.rows.length > 0) {
                // Aggiorna agent esistente
                const updateResult = await pool.query(
                    `UPDATE comm_agents SET api_key = $1, machine_name = $2, os_info = $3, status = 'online', last_heartbeat = NOW()
           WHERE user_id = $4 AND machine_id = $5 RETURNING id`,
                    [apiKey, machine_name || '', os_info || '', user.id, machine_id || 'default']
                );
                agentId = updateResult.rows[0].id;
            } else {
                // Crea nuovo agent
                const insertResult = await pool.query(
                    `INSERT INTO comm_agents (user_id, machine_name, machine_id, api_key, os_info, status, last_heartbeat)
           VALUES ($1, $2, $3, $4, $5, 'online', NOW()) RETURNING id`,
                    [user.id, machine_name || '', machine_id || 'default', apiKey, os_info || '']
                );
                agentId = insertResult.rows[0].id;
            }

            console.log(`✅ Comm Agent registrato: ${email} su ${machine_name || 'N/A'} (ID: ${agentId})`);

            res.json({
                success: true,
                agent_id: agentId,
                api_key: apiKey,
                user: {
                    email: user.email,
                    nome: user.nome,
                    cognome: user.cognome,
                    azienda: user.azienda
                }
            });

        } catch (err) {
            console.error('❌ Errore registrazione comm agent:', err);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    });

    // ============================================
    // HEARTBEAT AGENT (polling per messaggi pendenti)
    // ============================================
    router.post('/agent/heartbeat', authenticateCommAgent, async (req, res) => {
        try {
            const agentId = req.commAgent.id;
            const { version, device_info: deviceInfo } = req.body;

            // Log versione ricevuta per debug
            if (version) {
                console.log(`📦 CommAgent heartbeat ${agentId}: versione ricevuta = ${version}`);
            } else {
                console.log(`⚠️ CommAgent heartbeat ${agentId}: versione NON presente nel payload`);
            }

            // Aggiorna status e last_heartbeat
            const updateResult = await pool.query(
                `UPDATE comm_agents SET status = 'online', last_heartbeat = NOW(), version = COALESCE($1, version) WHERE id = $2 RETURNING version`,
                [version || null, agentId]
            );

            // Log versione salvata per debug
            const savedVersion = updateResult.rows[0]?.version;
            if (version && savedVersion) {
                console.log(`💾 CommAgent heartbeat ${agentId}: versione salvata nel DB = ${savedVersion}`);
            }

            // Salva/aggiorna inventario dispositivo se presente
            if (deviceInfo && typeof deviceInfo === 'object') {
                const d = deviceInfo;
                const osInstallDate = d.os_install_date ? (isNaN(Date.parse(d.os_install_date)) ? null : new Date(d.os_install_date)) : null;
                await pool.query(
                    `INSERT INTO comm_device_info (
            agent_id, mac, device_name, ip_addresses, primary_ip, os_name, os_version, os_arch, os_install_date,
            manufacturer, model, device_type, cpu_name, cpu_cores, cpu_clock_mhz, gpu_name, gpus_json,
            ram_total_gb, ram_free_gb, disks_json, "current_user",
            battery_status, battery_percent, battery_charging, antivirus_name, antivirus_state, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW())
          ON CONFLICT (agent_id) DO UPDATE SET
            mac = EXCLUDED.mac, device_name = EXCLUDED.device_name, ip_addresses = EXCLUDED.ip_addresses, primary_ip = EXCLUDED.primary_ip,
            os_name = EXCLUDED.os_name, os_version = EXCLUDed.os_version, os_arch = EXCLUDED.os_arch, os_install_date = EXCLUDED.os_install_date,
            manufacturer = EXCLUDED.manufacturer, model = EXCLUDED.model, device_type = EXCLUDED.device_type,
            cpu_name = EXCLUDED.cpu_name, cpu_cores = EXCLUDED.cpu_cores, cpu_clock_mhz = EXCLUDED.cpu_clock_mhz, gpu_name = EXCLUDED.gpu_name, gpus_json = EXCLUDED.gpus_json,
            ram_total_gb = EXCLUDED.ram_total_gb, ram_free_gb = EXCLUDED.ram_free_gb, disks_json = EXCLUDED.disks_json,
            "current_user" = EXCLUDED."current_user", battery_status = EXCLUDED.battery_status, battery_percent = EXCLUDED.battery_percent,
            battery_charging = EXCLUDED.battery_charging, antivirus_name = EXCLUDED.antivirus_name, antivirus_state = EXCLUDED.antivirus_state,
            updated_at = NOW()`,
                    [
                        agentId,
                        d.mac || null,
                        d.device_name || null,
                        typeof d.ip_addresses === 'string' ? d.ip_addresses : (Array.isArray(d.ip_addresses) ? d.ip_addresses.join(', ') : null),
                        d.primary_ip || null,
                        d.os_name || null,
                        d.os_version || null,
                        d.os_arch || null,
                        osInstallDate,
                        d.manufacturer || null,
                        d.model || null,
                        d.device_type || null,
                        d.cpu_name || null,
                        d.cpu_cores != null ? parseInt(d.cpu_cores, 10) : null,
                        d.cpu_clock_mhz != null ? parseInt(d.cpu_clock_mhz, 10) : null,
                        d.gpu_name || null,
                        d.gpus ? (Array.isArray(d.gpus) ? JSON.stringify(d.gpus) : JSON.stringify(d.gpus)) : null,
                        d.ram_total_gb != null ? parseFloat(d.ram_total_gb) : null,
                        d.ram_free_gb != null ? parseFloat(d.ram_free_gb) : null,
                        d.disks ? JSON.stringify(Array.isArray(d.disks) ? d.disks : d.disks) : null,
                        d.current_user || null,
                        d.battery_status || null,
                        d.battery_percent != null ? parseInt(d.battery_percent, 10) : null,
                        d.battery_charging === true || d.battery_charging === 'true',
                        d.antivirus_name || null,
                        d.antivirus_state || null
                    ]
                );

                // Sincronizza antivirus in lista Gestione Anti-Virus: trova network_devices stessa azienda (MAC o IP) e aggiorna antivirus_info
                try {
                    const aziendaRes = await pool.query(
                        'SELECT TRIM(u.azienda) AS azienda FROM comm_agents ca JOIN users u ON ca.user_id = u.id WHERE ca.id = $1',
                        [agentId]
                    );
                    const azienda = aziendaRes.rows[0]?.azienda;
                    if (!azienda) return;

                    const macNorm = (d.mac || '').replace(/[:\-\s]/g, '').toLowerCase().slice(0, 12);
                    const primaryIp = (d.primary_ip || '').trim() || null;

                    const ndRes = await pool.query(
                        `SELECT nd.id FROM network_devices nd
                         INNER JOIN network_agents na ON nd.agent_id = na.id
                         INNER JOIN users u ON na.azienda_id = u.id
                         WHERE LOWER(TRIM(COALESCE(u.azienda, ''))) = LOWER($1)
                         AND (
                           (LENGTH($2) >= 12 AND REPLACE(REPLACE(LOWER(COALESCE(nd.mac_address, '')), ':', ''), '-', '') = $2)
                           OR ($3 IS NOT NULL AND nd.ip_address = $3)
                         )`,
                        [azienda, macNorm.length >= 12 ? macNorm : null, primaryIp]
                    );

                    if (ndRes.rows.length === 0) return;

                    const isActive = /attivo|enabled|on|attiva/i.test(String(d.antivirus_state || ''));
                    const productName = (d.antivirus_name || '').trim() || null;

                    for (const row of ndRes.rows) {
                        await pool.query(
                            `INSERT INTO antivirus_info (device_id, is_active, product_name, expiration_date, device_type, sort_order, updated_at)
                             VALUES ($1, $2, $3, NULL, 'pc', 0, NOW())
                             ON CONFLICT (device_id) DO UPDATE SET
                               is_active = EXCLUDED.is_active,
                               product_name = COALESCE(EXCLUDED.product_name, antivirus_info.product_name),
                               updated_at = NOW()`,
                            [row.id, isActive, productName]
                        );
                    }
                } catch (syncErr) {
                    console.warn('⚠️ Sync antivirus CommAgent -> antivirus_info:', syncErr.message);
                }
            }

            // Recupera messaggi pendenti per questo agent
            const pendingMessages = await pool.query(
                `SELECT cm.id, cm.title, cm.body, cm.priority, cm.category, cm.created_at,
                u.nome as sender_nome, u.cognome as sender_cognome, u.email as sender_email
         FROM comm_message_delivery cmd
         JOIN comm_messages cm ON cmd.message_id = cm.id
         LEFT JOIN users u ON cm.sender_id = u.id
         WHERE cmd.agent_id = $1 AND cmd.status = 'pending'
         AND (cm.expires_at IS NULL OR cm.expires_at > NOW())
         ORDER BY cm.created_at ASC
         LIMIT 10`,
                [agentId]
            );

            // Segna come delivered i messaggi restituiti
            if (pendingMessages.rows.length > 0) {
                const messageIds = pendingMessages.rows.map(m => m.id);
                await pool.query(
                    `UPDATE comm_message_delivery SET status = 'delivered', delivered_at = NOW()
           WHERE agent_id = $1 AND message_id = ANY($2::int[])`,
                    [agentId, messageIds]
                );
            }

            res.json({
                success: true,
                messages: pendingMessages.rows,
                timestamp: new Date().toISOString()
            });

        } catch (err) {
            console.error('❌ Errore heartbeat comm agent:');
            console.error('   Messaggio:', err.message);
            console.error('   Codice DB:', err.code);
            console.error('   Dettaglio:', err.detail);
            console.error('   Stack:', err.stack);
            res.status(500).json({ error: 'Errore interno' });
        }
    });

    // ============================================
    // MARCA MESSAGGIO COME LETTO
    // ============================================
    router.post('/agent/message-read', authenticateCommAgent, async (req, res) => {
        try {
            const { message_id } = req.body;
            await pool.query(
                `UPDATE comm_message_delivery SET status = 'read', read_at = NOW()
         WHERE agent_id = $1 AND message_id = $2`,
                [req.commAgent.id, message_id]
            );
            res.json({ success: true });
        } catch (err) {
            console.error('❌ Errore mark read:', err);
            res.status(500).json({ error: 'Errore interno' });
        }
    });

    // ============================================
    // INVIO MESSAGGIO (solo tecnico)
    // ============================================
    router.post('/messages/send', authenticateToken, requireRole('tecnico'), async (req, res) => {
        try {
            await ensureTables();
            const { target_type, target_agent_id, target_company, target_companies, title, body, priority, category } = req.body;

            if (!title || !body) {
                return res.status(400).json({ error: 'Titolo e corpo messaggio richiesti' });
            }

            if (!['single', 'group', 'broadcast'].includes(target_type)) {
                return res.status(400).json({ error: 'Tipo target non valido (single/group/broadcast)' });
            }

            // Supporta sia target_company (singola) che target_companies (array)
            const companiesList = target_companies || (target_company ? [target_company] : []);

            // Inserisci il messaggio
            const msgResult = await pool.query(
                `INSERT INTO comm_messages (sender_id, target_type, target_agent_id, target_company, title, body, priority, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`,
                [req.user.id, target_type, target_agent_id || null, companiesList.join(', ') || null, title, body, priority || 'normal', category || 'info']
            );

            const messageId = msgResult.rows[0].id;

            // Determina gli agent target
            let targetAgents = [];
            if (target_type === 'single' && target_agent_id) {
                targetAgents = [{ id: target_agent_id }];
            } else if (target_type === 'group' && companiesList.length > 0) {
                const groupResult = await pool.query(
                    `SELECT ca.id FROM comm_agents ca
           JOIN users u ON ca.user_id = u.id
           WHERE TRIM(LOWER(u.azienda)) = ANY($1::text[])`,
                    [companiesList.map(c => c.trim().toLowerCase())]
                );
                targetAgents = groupResult.rows;
            } else if (target_type === 'broadcast') {
                const allResult = await pool.query('SELECT id FROM comm_agents');
                targetAgents = allResult.rows;
            }

            // Crea record di consegna per ogni agent
            for (const agent of targetAgents) {
                await pool.query(
                    `INSERT INTO comm_message_delivery (message_id, agent_id, status)
           VALUES ($1, $2, 'pending') ON CONFLICT (message_id, agent_id) DO NOTHING`,
                    [messageId, agent.id]
                );
            }

            console.log(`📨 Messaggio inviato: "${title}" a ${targetAgents.length} agent (tipo: ${target_type})`);

            // Emit WebSocket per notifica real-time (se l'agent è connesso al socket)
            if (io) {
                io.emit('comm-message-sent', {
                    messageId,
                    title,
                    targetType: target_type,
                    targetCount: targetAgents.length,
                    sentAt: new Date().toISOString()
                });
            }

            res.json({
                success: true,
                message_id: messageId,
                delivered_to: targetAgents.length,
                created_at: msgResult.rows[0].created_at
            });

        } catch (err) {
            console.error('❌ Errore invio messaggio:', err);
            res.status(500).json({ error: 'Errore interno del server' });
        }
    });

    // ============================================
    // LISTA AGENT (per il tecnico)
    // ============================================
    router.get('/agents', authenticateToken, requireRole('tecnico'), async (req, res) => {
        try {
            await ensureTables();
            const result = await pool.query(
                `SELECT ca.id, ca.user_id, ca.machine_name, ca.machine_id, ca.status, ca.last_heartbeat, ca.version, ca.os_info, ca.ip_address, ca.installed_at,
                u.email, u.nome, u.cognome, u.azienda,
                CASE WHEN ca.last_heartbeat > NOW() - INTERVAL '2 minutes' THEN 'online' ELSE 'offline' END as real_status
         FROM comm_agents ca
         JOIN users u ON ca.user_id = u.id
         ORDER BY u.azienda, u.cognome, u.nome`
            );

            // Aggiorna status in base al tempo dall'ultimo heartbeat
            for (const agent of result.rows) {
                if (agent.real_status !== agent.status) {
                    await pool.query('UPDATE comm_agents SET status = $1 WHERE id = $2', [agent.real_status, agent.id]);
                    agent.status = agent.real_status;
                }
            }

            res.json(result.rows);
        } catch (err) {
            console.error('❌ Errore lista comm agents:', err);
            res.status(500).json({ error: 'Errore interno' });
        }
    });

    // ============================================
    // LISTA AZIENDE (per il dropdown invio)
    // ============================================
    router.get('/companies', authenticateToken, requireRole('tecnico'), async (req, res) => {
        try {
            await ensureTables();
            const result = await pool.query(
                `SELECT DISTINCT TRIM(u.azienda) as azienda, COUNT(ca.id) as agent_count
         FROM comm_agents ca
         JOIN users u ON ca.user_id = u.id
         WHERE u.azienda IS NOT NULL AND TRIM(u.azienda) != ''
         GROUP BY TRIM(u.azienda)
         ORDER BY azienda`
            );
            res.json(result.rows);
        } catch (err) {
            console.error('❌ Errore lista aziende comm:', err);
            res.status(500).json({ error: 'Errore interno' });
        }
    });

    // ============================================
    // DEVICE INFO / INVENTARIO (tecnico, per Dispositivi aziendali)
    // ============================================
    router.get('/device-info', authenticateToken, requireRole('tecnico'), async (req, res) => {
        try {
            await ensureTables();
            const { azienda: aziendaFilter } = req.query;
            const aziendaParam = aziendaFilter && String(aziendaFilter).trim() ? String(aziendaFilter).trim() : null;

            let query = `
                SELECT ca.id as agent_id, ca.machine_name, ca.machine_id, ca.status, ca.last_heartbeat, ca.version,
                       CASE WHEN ca.last_heartbeat > NOW() - INTERVAL '2 minutes' THEN 'online' ELSE 'offline' END as real_status,
                       u.email, u.nome, u.cognome, u.azienda,
                        d.mac, d.device_name, d.ip_addresses, d.primary_ip, d.os_name, d.os_version, d.os_arch, d.os_install_date,
                       d.manufacturer, d.model, d.device_type, d.cpu_name, d.cpu_cores, d.cpu_clock_mhz, d.gpu_name, d.gpus_json,
                       d.ram_total_gb, d.ram_free_gb, d.disks_json, d."current_user",
                       d.battery_status, d.battery_percent, d.battery_charging, d.antivirus_name, d.antivirus_state, d.updated_at as device_info_updated_at
                FROM comm_agents ca
                JOIN users u ON ca.user_id = u.id
                LEFT JOIN comm_device_info d ON d.agent_id = ca.id
            `;
            const params = [];
            if (aziendaParam) {
                params.push(aziendaParam);
                query += ` WHERE LOWER(TRIM(COALESCE(u.azienda, ''))) = LOWER($1)`;
            }
            query += ` ORDER BY u.azienda, u.cognome, u.nome, ca.machine_name`;

            let result = await pool.query(query, params);

            console.log(`📋 [device-info] Richiesta per azienda: "${aziendaParam || 'TUTTE'}" -> Trovati: ${result.rows.length}`);
            if (result.rows.length === 0) {
                const debugAgents = await pool.query('SELECT ca.id, u.email, u.azienda, ca.machine_name FROM comm_agents ca JOIN users u ON ca.user_id = u.id');
                console.log(`📋 [device-info] DEBUG: Ci sono in totale ${debugAgents.rows.length} agent nel DB.`);

                const uniqueCompanies = [...new Set(debugAgents.rows.map(r => String(r.azienda).trim()))];
                console.log(`📋 [device-info] DEBUG: Aziende presenti nei DB agent:`, uniqueCompanies);

                if (debugAgents.rows.length > 0) {
                    console.log(`📋 [device-info] DEBUG Sample:`, debugAgents.rows.slice(0, 5));
                }
            }

            res.json(result.rows || []);
        } catch (err) {
            const isMissingTable = err.code === '42P01' || (err.message && String(err.message).includes('comm_device_info'));
            if (isMissingTable) {
                try {
                    await pool.query(`
                        CREATE TABLE IF NOT EXISTS comm_device_info (
                            id SERIAL PRIMARY KEY,
                            agent_id INTEGER NOT NULL REFERENCES comm_agents(id) ON DELETE CASCADE UNIQUE,
                            mac VARCHAR(48),
                            device_name VARCHAR(255),
                            ip_addresses TEXT,
                            primary_ip VARCHAR(512),
                            os_name VARCHAR(255),
                            os_version VARCHAR(255),
                            os_arch VARCHAR(32),
                            os_install_date TIMESTAMPTZ,
                            manufacturer VARCHAR(255),
                            model VARCHAR(255),
                            device_type VARCHAR(32),
                            cpu_name VARCHAR(255),
                            cpu_cores INTEGER,
                            cpu_clock_mhz INTEGER,
                            gpu_name VARCHAR(255),
                            gpus_json JSONB,
                            ram_total_gb NUMERIC(10,2),
                            ram_free_gb NUMERIC(10,2),
                            disks_json JSONB,
                            "current_user" VARCHAR(255),
                            battery_status VARCHAR(64),
                            battery_percent INTEGER,
                            battery_charging BOOLEAN,
                            antivirus_name VARCHAR(255),
                            antivirus_state VARCHAR(64),
                            updated_at TIMESTAMPTZ DEFAULT NOW()
                        );
                    `);
                    await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_device_info_agent ON comm_device_info(agent_id);`);
                    await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_device_info_mac ON comm_device_info(mac);`);

                    // MIGRATION: Assicurati che tutti i campi esistano
                    await pool.query(`
                        ALTER TABLE comm_device_info 
                        ADD COLUMN IF NOT EXISTS primary_ip VARCHAR(512),
                        ADD COLUMN IF NOT EXISTS os_install_date TIMESTAMPTZ,
                        ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255),
                        ADD COLUMN IF NOT EXISTS model VARCHAR(255),
                        ADD COLUMN IF NOT EXISTS device_type VARCHAR(32),
                        ADD COLUMN IF NOT EXISTS cpu_name VARCHAR(255),
                        ADD COLUMN IF NOT EXISTS cpu_cores INTEGER,
                        ADD COLUMN IF NOT EXISTS cpu_clock_mhz INTEGER,
                        ADD COLUMN IF NOT EXISTS gpu_name VARCHAR(255),
                        ADD COLUMN IF NOT EXISTS gpus_json JSONB,
                        ADD COLUMN IF NOT EXISTS ram_total_gb NUMERIC(10,2),
                        ADD COLUMN IF NOT EXISTS ram_free_gb NUMERIC(10,2),
                        ADD COLUMN IF NOT EXISTS disks_json JSONB,
                        ADD COLUMN IF NOT EXISTS "current_user" VARCHAR(255),
                        ADD COLUMN IF NOT EXISTS battery_status VARCHAR(64),
                        ADD COLUMN IF NOT EXISTS battery_percent INTEGER,
                        ADD COLUMN IF NOT EXISTS battery_charging BOOLEAN,
                        ADD COLUMN IF NOT EXISTS antivirus_name VARCHAR(255),
                        ADD COLUMN IF NOT EXISTS antivirus_state VARCHAR(64);
                    `);
                    const retry = await pool.query(query, params);
                    return res.json(retry.rows || []);
                } catch (e2) {
                    console.error('❌ device-info: tabella comm_device_info mancante e creazione fallita:', e2.message);
                    console.error('   Eseguire manualmente: node backend/migrations/create_comm_device_info.js');
                    return res.json([]);
                }
            }
            console.error('❌ Errore device-info:', err.message || err);
            res.status(500).json({ error: 'Errore interno', details: process.env.NODE_ENV === 'development' ? (err.message || String(err)) : undefined });
        }
    });

    // ============================================
    // STORICO MESSAGGI (tecnico)
    // ============================================
    router.get('/messages', authenticateToken, requireRole('tecnico'), async (req, res) => {
        try {
            await ensureTables();
            const { limit = 50, offset = 0 } = req.query;

            const result = await pool.query(
                `SELECT cm.id, cm.title, cm.body, cm.priority, cm.category, cm.target_type, cm.target_company, cm.created_at,
                u.nome as sender_nome, u.cognome as sender_cognome,
                ca.machine_name as target_machine,
                tu.email as target_email, tu.azienda as target_azienda,
                (SELECT COUNT(*) FROM comm_message_delivery WHERE message_id = cm.id) as total_targets,
                (SELECT COUNT(*) FROM comm_message_delivery WHERE message_id = cm.id AND status = 'delivered') as delivered_count,
                (SELECT COUNT(*) FROM comm_message_delivery WHERE message_id = cm.id AND status = 'read') as read_count
         FROM comm_messages cm
         LEFT JOIN users u ON cm.sender_id = u.id
         LEFT JOIN comm_agents ca ON cm.target_agent_id = ca.id
         LEFT JOIN users tu ON ca.user_id = tu.id
         ORDER BY cm.created_at DESC
         LIMIT $1 OFFSET $2`,
                [parseInt(limit), parseInt(offset)]
            );

            res.json(result.rows);
        } catch (err) {
            console.error('❌ Errore storico messaggi:', err);
            res.status(500).json({ error: 'Errore interno' });
        }
    });

    // ============================================
    // DOWNLOAD AGENT PACKAGE
    // ============================================
    router.get('/download-agent', async (req, res) => {
        try {
            // Supporta auth via Token (query/header) OPPURE API Key (header)
            const token = req.query.token || (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
            const apiKey = req.headers['x-comm-api-key'];

            if (!token && !apiKey) {
                return res.status(401).json({ error: 'Autenticazione richiesta (Token o API Key)' });
            }

            let userEmail = null;
            let userPassword = null;

            if (token) {
                const jwt = require('jsonwebtoken');
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'logika-secret-key');
                    // Se il token è valido, estrai email e password dell'utente per precompilare install_config.json
                    if (decoded.email) {
                        await ensureTables();
                        const userResult = await pool.query(
                            'SELECT email, password FROM users WHERE id = $1',
                            [decoded.id]
                        );
                        if (userResult.rows.length > 0) {
                            userEmail = userResult.rows[0].email;
                            userPassword = userResult.rows[0].password; // Password in chiaro nel sistema attuale
                        }
                    }
                } catch (err) {
                    return res.status(401).json({ error: 'Token non valido' });
                }
            } else if (apiKey) {
                // Verifica API Key nel DB e estrai email/password dell'utente associato
                await ensureTables();
                const agentResult = await pool.query(
                    'SELECT ca.user_id, u.email, u.password FROM comm_agents ca JOIN users u ON ca.user_id = u.id WHERE ca.api_key = $1',
                    [apiKey]
                );
                if (agentResult.rows.length === 0) {
                    return res.status(401).json({ error: 'API Key non valida' });
                }
                // Estrai email e password per includere install_config.json anche durante aggiornamento automatico
                if (agentResult.rows[0].email && agentResult.rows[0].password) {
                    userEmail = agentResult.rows[0].email;
                    userPassword = agentResult.rows[0].password;
                    console.log(`✅ Package agent con credenziali precompilate per aggiornamento automatico: ${userEmail}`);
                }
            }

            // Il package include gli script dell'agent
            const agentDir = path.join(__dirname, '..', '..', 'agent', 'CommAgent');

            if (!fs.existsSync(agentDir)) {
                return res.status(404).json({ error: 'File agent non trovati' });
            }

            // Leggi versione dallo script
            let version = '1.0.0';
            try {
                const serviceContent = fs.readFileSync(path.join(agentDir, 'CommAgentService.ps1'), 'utf8');
                const match = serviceContent.match(/\$SCRIPT_VERSION = "([^"]+)"/);
                if (match) version = match[1];
            } catch (e) {
                console.error('Errore lettura versione agent:', e);
            }

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="LogikaCommAgent-v${version}.zip"`);

            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.pipe(res);

            // Aggiungi tutti i file dalla directory CommAgent
            const files = fs.readdirSync(agentDir);
            for (const file of files) {
                const filePath = path.join(agentDir, file);
                if (fs.statSync(filePath).isFile()) {
                    archive.file(filePath, { name: file });
                }
            }

            // Crea e aggiungi VBS launcher se non esiste già nel package
            const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""CommAgentService.ps1""", 0, False`;
            archive.append(vbsContent, { name: 'Start-CommAgent-Hidden.vbs' });

            // Se abbiamo email e password dal token, crea install_config.json precompilato
            if (userEmail && userPassword) {
                const baseUrl = process.env.BASE_URL || 'https://ticket.logikaservice.it';
                const installConfig = {
                    server_url: baseUrl,
                    email: userEmail,
                    password: userPassword
                };
                archive.append(JSON.stringify(installConfig, null, 2), { name: 'install_config.json' });
                console.log(`✅ Package agent con credenziali precompilate per: ${userEmail}`);
            }

            await archive.finalize();

        } catch (err) {
            console.error('❌ Errore download agent package:', err);
            res.status(500).json({ error: 'Errore generazione package' });
        }
    });

    // Serve file singoli dell'agent (per auto-update)
    router.get('/download/agent/:filename', (req, res) => {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, '..', '..', 'agent', 'CommAgent', filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File non trovato' });
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.sendFile(filePath);
    });

    // ============================================
    // ELIMINA AGENT
    // ============================================
    router.delete('/agents/:id', authenticateToken, requireRole('tecnico'), async (req, res) => {
        try {
            await ensureTables();
            const { id } = req.params;
            await pool.query('DELETE FROM comm_agents WHERE id = $1', [id]);
            res.json({ success: true });
        } catch (err) {
            console.error('❌ Errore eliminazione comm agent:', err);
            res.status(500).json({ error: 'Errore interno' });
        }
    });

    // ============================================
    // VERSIONE AGENT (per auto-update)
    // ============================================
    router.get('/agent-version', (req, res) => {
        try {
            // Leggi versione reale dallo script CommAgentService.ps1
            const agentDir = path.join(__dirname, '..', '..', 'agent', 'CommAgent');
            let version = '1.0.0'; // Fallback
            try {
                const serviceFile = path.join(agentDir, 'CommAgentService.ps1');
                if (fs.existsSync(serviceFile)) {
                    const serviceContent = fs.readFileSync(serviceFile, 'utf8');
                    const match = serviceContent.match(/\$SCRIPT_VERSION\s*=\s*"([^"]+)"/);
                    if (match && match[1]) {
                        version = match[1].trim();
                    }
                }
            } catch (e) {
                console.error('⚠️ Errore lettura versione CommAgent:', e.message);
            }
            res.json({ version });
        } catch (err) {
            console.error('❌ Errore endpoint agent-version:', err);
            res.json({ version: '1.0.0' }); // Fallback
        }
    });

    // ============================================
    // DEBUG ENDPOINT FOR DIAGNOSTICS (TEMPORARY)
    // ============================================
    router.get('/debug-state', async (req, res) => {
        try {
            await ensureTables();

            const results = {};

            const agents = await pool.query('SELECT ca.id, ca.machine_name, ca.status, ca.last_heartbeat, u.email, u.azienda FROM comm_agents ca LEFT JOIN users u ON ca.user_id = u.id');
            results.agents = agents.rows;

            if (tablesReady) {
                const devicesInfo = await pool.query('SELECT agent_id, device_name, os_name, "current_user", updated_at FROM comm_device_info');
                results.devicesInfo = devicesInfo.rows;
                results.devicesInfoCount = devicesInfo.rows.length;
            } else {
                results.devicesInfo = [];
                results.devicesInfoCount = 0;
            }

            res.json({
                success: true,
                currentTime: new Date().toISOString(),
                tablesReady,
                tableInitError,
                agentsCount: agents.rows.length,
                devicesInfoCount: results.devicesInfoCount,
                data: results
            });
        } catch (e) {
            res.json({ success: false, error: e.message, stack: e.stack, tablesReady, tableInitError });
        }
    });

    return router;
};
