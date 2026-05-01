const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  normalizeCompanyName,
  ensureLsightCompanyAccessTable,
} = require('../utils/lsightAccess');

/**
 * Router L-Sight — usa il pool Postgres condiviso da index.js (nessun Pool duplicato).
 */
module.exports = (pool) => {
  const router = express.Router();

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
      await pool.query(`
        CREATE TABLE IF NOT EXISTS lsight_agent_config (
            agent_id INTEGER PRIMARY KEY REFERENCES comm_agents(id) ON DELETE CASCADE,
            remote_passwd VARCHAR(255),
            enabled BOOLEAN DEFAULT false,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await ensureLsightCompanyAccessTable(pool);
    } catch (e) {
      console.error('Errore migrazioni L-Sight:', e);
    }
  };

  ensureLSightTables();

  router.use(authenticateToken);

  const verifyTecnico = (req, res, next) => {
    if (req.user && req.user.ruolo === 'tecnico') {
      next();
    } else {
      res.status(403).json({ error: 'Accesso negato: solo i tecnici possono eseguire questa operazione.' });
    }
  };

  /**
   * Aziende distinte dai PC con Comm Agent (per select assegnazioni).
   */
  router.get('/admin/company-names', verifyTecnico, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT DISTINCT TRIM(u.azienda) AS azienda
         FROM comm_agents ca
         JOIN users u ON ca.user_id = u.id
         WHERE TRIM(COALESCE(u.azienda, '')) <> ''
         ORDER BY 1 ASC`
      );
      res.json({ success: true, companies: rows.map((r) => r.azienda) });
    } catch (err) {
      console.error('Errore company-names lsight:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  /**
   * Autorizzazioni per azienda + utente (email): tutti gli agent di quell’azienda (owner).
   */
  router.get('/admin/access-grants', verifyTecnico, async (_req, res) => {
    try {
      await ensureLsightCompanyAccessTable(pool);
      const { rows } = await pool.query(
        `SELECT g.id, g.user_id, g.company_azienda, g.created_at,
                u.email, u.nome, u.cognome, u.azienda AS user_azienda
         FROM lsight_company_access g
         JOIN users u ON g.user_id = u.id
         ORDER BY g.created_at DESC`
      );
      res.json({ success: true, grants: rows });
    } catch (err) {
      console.error('Errore access-grants:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  router.post('/admin/access-grants', verifyTecnico, async (req, res) => {
    const rawEmail = (req.body?.email || '').trim();
    const rawAzienda = (req.body?.azienda || '').trim();
    if (!rawEmail || !rawAzienda) {
      return res.status(400).json({ error: 'email e azienda sono obbligatori' });
    }
    try {
      await ensureLsightCompanyAccessTable(pool);
      const { rows: agentsCheck } = await pool.query(
        `SELECT 1 FROM comm_agents ca
         JOIN users u ON ca.user_id = u.id
         WHERE LOWER(TRIM(u.azienda)) = LOWER(TRIM($1))
         LIMIT 1`,
        [rawAzienda]
      );
      if (agentsCheck.length === 0) {
        return res.status(400).json({ error: 'Nessun Comm Agent registrato per questa azienda' });
      }

      const { rows: userRows } = await pool.query(
        `SELECT id, email, ruolo, azienda FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1`,
        [rawEmail]
      );
      if (!userRows.length) {
        return res.status(404).json({ error: 'Utente con questa email non trovato' });
      }
      const u = userRows[0];

      const companyKey = normalizeCompanyName(rawAzienda);
      if (!companyKey) {
        return res.status(400).json({ error: 'Azienda non valida' });
      }

      if (u.ruolo !== 'cliente') {
        return res.status(400).json({
          error: 'L-Sight può essere autorizzato solo per utenti con ruolo cliente',
        });
      }
      const userCompanyKey = normalizeCompanyName(u.azienda);
      if (!userCompanyKey || userCompanyKey !== companyKey) {
        return res.status(400).json({
          error:
            `L’email selezionata non appartiene all’azienda indicata (${rawAzienda}). Verifica cliente e campo azienda nel profilo utente.`,
        });
      }

      await pool.query(
        `INSERT INTO lsight_company_access (user_id, company_azienda, assigned_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, company_azienda) DO NOTHING`,
        [u.id, companyKey, req.user.id]
      );
      res.json({ success: true, message: 'Autorizzazione salvata (tutti i PC dell’azienda per questo cliente)' });
    } catch (err) {
      console.error('Errore POST access-grants:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  router.delete('/admin/access-grants/:id', verifyTecnico, async (req, res) => {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'id non valido' });
    try {
      await pool.query(`DELETE FROM lsight_company_access WHERE id = $1 RETURNING id`, [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Errore DELETE access-grants:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  /** Lista legacy assignment per troubleshooting (compatibilità DB). */
  router.get('/admin/assignments', verifyTecnico, async (_req, res) => {
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

  router.post('/admin/assignments', verifyTecnico, async (req, res) => {
    const { user_id, agent_id } = req.body;
    if (!user_id || !agent_id) return res.status(400).json({ error: 'user_id e agent_id richiesti' });
    try {
      await pool.query(
        `INSERT INTO lsight_assignments (user_id, agent_id, assigned_by)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (
           SELECT 1 FROM lsight_assignments WHERE user_id = $1 AND agent_id = $2
         )`,
        [user_id, agent_id, req.user.id]
      );
      res.json({ success: true, message: 'Assegnazione creata' });
    } catch (err) {
      console.error('Errore creazione assignment:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  router.delete('/admin/assignments', verifyTecnico, async (req, res) => {
    const { user_id, agent_id } = req.query;
    if (!user_id || !agent_id) return res.status(400).json({ error: 'user_id e agent_id richiesti' });
    try {
      await pool.query(`DELETE FROM lsight_assignments WHERE user_id = $1 AND agent_id = $2`, [
        user_id,
        agent_id,
      ]);
      res.json({ success: true, message: 'Assegnazione rimossa' });
    } catch (err) {
      console.error('Errore rimozione assignment:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  router.get('/my-agents', async (req, res) => {
    try {
      let query;
      const params = [];

      if (req.user.ruolo === 'tecnico' || req.user.ruolo === 'admin') {
        query = `
            SELECT ca.id as agent_id, ca.machine_name, ca.os_info, ca.status, ca.last_heartbeat,
                   owner.azienda,
                   owner.nome as user_nome, owner.cognome as user_cognome,
                   lc.enabled, lc.remote_passwd
            FROM comm_agents ca
            LEFT JOIN users owner ON ca.user_id = owner.id
            LEFT JOIN lsight_agent_config lc ON ca.id = lc.agent_id
            ORDER BY owner.azienda NULLS LAST, ca.machine_name
        `;
      } else {
        await ensureLsightCompanyAccessTable(pool);
        params.push(req.user.id);
        query = `
            SELECT ca.id as agent_id, ca.machine_name, ca.os_info, ca.status, ca.last_heartbeat,
                   owner.azienda,
                   owner.nome as user_nome, owner.cognome as user_cognome,
                   lc.enabled, lc.remote_passwd
            FROM comm_agents ca
            LEFT JOIN users owner ON ca.user_id = owner.id
            LEFT JOIN lsight_agent_config lc ON ca.id = lc.agent_id
            WHERE EXISTS (
               SELECT 1 FROM lsight_assignments la
               WHERE la.user_id = $1 AND la.agent_id = ca.id
            )
            OR EXISTS (
               SELECT 1 FROM lsight_company_access g
               WHERE g.user_id = $1
                 AND owner.azienda IS NOT NULL AND TRIM(owner.azienda) <> ''
                 AND LOWER(TRIM(g.company_azienda)) = LOWER(TRIM(owner.azienda))
            )
            ORDER BY owner.azienda NULLS LAST, ca.machine_name
        `;
      }

      const { rows } = await pool.query(query, params);
      res.json({ success: true, agents: rows });
    } catch (err) {
      console.error('Errore fetch my-agents:', err);
      res.status(500).json({ error: 'Errore interno server' });
    }
  });

  return router;
};
