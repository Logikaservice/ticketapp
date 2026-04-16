const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

let poolConfig = {};
if (process.env.DATABASE_URL) {
    try {
        const dbUrl = process.env.DATABASE_URL;
        const match = dbUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
        if (match) {
            poolConfig.user = decodeURIComponent(match[1]);
            poolConfig.password = decodeURIComponent(match[2]);
            if (typeof poolConfig.password !== 'string') {
                poolConfig.password = String(poolConfig.password);
            }
            poolConfig.host = match[3];
            poolConfig.port = parseInt(match[4]);
            poolConfig.database = match[5];
            
            if (poolConfig.host === 'localhost' || poolConfig.host === '127.0.0.1') {
                poolConfig.ssl = false;
            } else {
                poolConfig.ssl = { rejectUnauthorized: false };
            }
        }
    } catch (e) {
        poolConfig.connectionString = process.env.DATABASE_URL;
    }
}

const pool = new Pool(poolConfig);

const { authenticateToken } = require('../middleware/authMiddleware');

// Initialize new tables
const ensureLSightTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lsight_assignments (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                agent_id INTEGER REFERENCES comm_agents(id) ON DELETE CASCADE,
                assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, agent_id)
            )
        `);
        console.log('✅ Tabella lsight_assignments pronta');

        // Settings addizionali per agenti L-Sight (es. password del client video, porta, ecc)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lsight_agent_config (
                agent_id INTEGER PRIMARY KEY REFERENCES comm_agents(id) ON DELETE CASCADE,
                remote_passwd VARCHAR(255),
                enabled BOOLEAN DEFAULT false,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log('✅ Tabella lsight_agent_config pronta');
    } catch (e) {
        console.error('❌ Errore creazione tabelle L-Sight:', e);
    }
};

ensureLSightTables();

// Middleware di autenticazione per tutte le route
router.use(authenticateToken);

// Middleware tecnico (solo tecnico può gestire assegnazioni globali)
const verifyTecnico = (req, res, next) => {
    if (req.user && req.user.ruolo === 'tecnico') {
        next();
    } else {
        res.status(403).json({ error: 'Accesso negato: Solo i tecnici possono eseguire questa operazione.' });
    }
};

/**
 * Recupera tutti gli agenti e la lista degli utenti a cui sono assegnati.
 * SOLO TECNICO
 */
router.get('/admin/assignments', verifyTecnico, async (req, res) => {
    try {
        const query = `
            SELECT ca.id as agent_id, ca.machine_name, ca.os_info, ca.status,
                   u.id as user_id, u.nome, u.cognome, u.email, u.azienda,
                   la.id as assignment_id
            FROM comm_agents ca
            LEFT JOIN lsight_assignments la ON ca.id = la.agent_id
            LEFT JOIN users u ON la.user_id = u.id
            ORDER BY ca.machine_name, u.azienda
        `;
        const { rows } = await pool.query(query);
        res.json({ success: true, assignments: rows });
    } catch (err) {
        console.error('Errore fetch assignments:', err);
        res.status(500).json({ error: 'Errore interno server' });
    }
});

/**
 * Assegna un PC a un Utente.
 * SOLO TECNICO
 */
router.post('/admin/assignments', verifyTecnico, async (req, res) => {
    const { user_id, agent_id } = req.body;
    if (!user_id || !agent_id) return res.status(400).json({ error: 'user_id e agent_id richiesti' });
    
    try {
        await pool.query(
            `INSERT INTO lsight_assignments (user_id, agent_id, assigned_by) 
             VALUES ($1, $2, $3) 
             ON CONFLICT DO NOTHING`,
            [user_id, agent_id, req.user.id]
        );
        res.json({ success: true, message: 'Assegnazione creata con successo' });
    } catch (err) {
        console.error('Errore creazione assignment:', err);
        res.status(500).json({ error: 'Errore interno server' });
    }
});

/**
 * Rimuove un'assegnazione
 * SOLO TECNICO
 */
router.delete('/admin/assignments', verifyTecnico, async (req, res) => {
    const { user_id, agent_id } = req.query;
    if (!user_id || !agent_id) return res.status(400).json({ error: 'user_id e agent_id richiesti' });
    
    try {
        await pool.query(
            `DELETE FROM lsight_assignments WHERE user_id = $1 AND agent_id = $2`,
            [user_id, agent_id]
        );
        res.json({ success: true, message: 'Assegnazione rimossa' });
    } catch (err) {
        console.error('Errore rimozione assignment:', err);
        res.status(500).json({ error: 'Errore interno server' });
    }
});

/**
 * Recupera i PC L-Sight assegnati all'utente corrente.
 * PERTUTTI GLI UTENTI
 */
router.get('/my-agents', async (req, res) => {
    try {
        let query;
        let params = [];
        
        if (req.user.ruolo === 'tecnico') {
            query = `
                SELECT ca.id as agent_id, ca.machine_name, ca.os_info, ca.status, ca.last_heartbeat,
                       u.azienda, u.nome as user_nome, u.cognome as user_cognome,
                       lc.enabled, lc.remote_passwd
                FROM comm_agents ca
                LEFT JOIN users u ON ca.user_id = u.id
                LEFT JOIN lsight_agent_config lc ON ca.id = lc.agent_id
                ORDER BY u.azienda, ca.machine_name
            `;
        } else {
            query = `
                SELECT ca.id as agent_id, ca.machine_name, ca.os_info, ca.status, ca.last_heartbeat,
                       u.azienda, u.nome as user_nome, u.cognome as user_cognome,
                       lc.enabled, lc.remote_passwd
                FROM lsight_assignments la
                JOIN comm_agents ca ON la.agent_id = ca.id
                LEFT JOIN users u ON ca.user_id = u.id
                LEFT JOIN lsight_agent_config lc ON ca.id = lc.agent_id
                WHERE la.user_id = $1
                ORDER BY u.azienda, ca.machine_name
            `;
            params = [req.user.id];
        }
        
        const { rows } = await pool.query(query, params);
        res.json({ success: true, agents: rows });
    } catch (err) {
        console.error('Errore fetch my-agents:', err);
        res.status(500).json({ error: 'Errore interno server' });
    }
});

module.exports = router;
