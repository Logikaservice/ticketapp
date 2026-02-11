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

    const ensureTables = async () => {
        if (tablesReady) return;
        try {
            // Tabella agent di comunicazione
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

            // Tabella messaggi
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

            // Tabella consegna messaggi (tracking per-agent)
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

            // Indici
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_agents_user ON comm_agents(user_id);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_agents_status ON comm_agents(status);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_agents_api_key ON comm_agents(api_key);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_messages_sender ON comm_messages(sender_id);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_messages_target ON comm_messages(target_type);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_message_delivery_agent ON comm_message_delivery(agent_id);`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_comm_message_delivery_status ON comm_message_delivery(status);`);

            tablesReady = true;
            console.log('✅ Tabelle Communication Agent inizializzate');
        } catch (err) {
            console.error('❌ Errore inizializzazione tabelle comm_agent:', err.message);
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
            const { version } = req.body;

            // Aggiorna status e last_heartbeat
            await pool.query(
                `UPDATE comm_agents SET status = 'online', last_heartbeat = NOW(), version = COALESCE($1, version) WHERE id = $2`,
                [version, agentId]
            );

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
            console.error('❌ Errore heartbeat comm agent:', err);
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
            const { target_type, target_agent_id, target_company, title, body, priority, category } = req.body;

            if (!title || !body) {
                return res.status(400).json({ error: 'Titolo e corpo messaggio richiesti' });
            }

            if (!['single', 'group', 'broadcast'].includes(target_type)) {
                return res.status(400).json({ error: 'Tipo target non valido (single/group/broadcast)' });
            }

            // Inserisci il messaggio
            const msgResult = await pool.query(
                `INSERT INTO comm_messages (sender_id, target_type, target_agent_id, target_company, title, body, priority, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`,
                [req.user.id, target_type, target_agent_id || null, target_company || null, title, body, priority || 'normal', category || 'info']
            );

            const messageId = msgResult.rows[0].id;

            // Determina gli agent target
            let targetAgents = [];
            if (target_type === 'single' && target_agent_id) {
                targetAgents = [{ id: target_agent_id }];
            } else if (target_type === 'group' && target_company) {
                const groupResult = await pool.query(
                    `SELECT ca.id FROM comm_agents ca
           JOIN users u ON ca.user_id = u.id
           WHERE TRIM(LOWER(u.azienda)) = TRIM(LOWER($1))`,
                    [target_company]
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
            // Supporta autenticazione via query parameter (per window.open) o header
            const token = req.query.token || (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
            if (!token) {
                return res.status(401).json({ error: 'Token richiesto' });
            }

            const jwt = require('jsonwebtoken');
            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET || 'logika-secret-key');
            } catch (err) {
                return res.status(401).json({ error: 'Token non valido' });
            }

            // Il package include gli script dell'agent
            const agentDir = path.join(__dirname, '..', '..', 'agent', 'CommAgent');

            if (!fs.existsSync(agentDir)) {
                return res.status(404).json({ error: 'File agent non trovati' });
            }

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename="LogikaCommAgent.zip"');

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
        res.json({ version: '1.0.0' });
    });

    return router;
};
