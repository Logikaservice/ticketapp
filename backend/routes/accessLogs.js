const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  const router = express.Router();

  const buildFilters = (query) => {
    const conditions = [];
    const values = [];

    if (query.search) {
      values.push(`%${query.search}%`);
      conditions.push(`(
        LOWER(al.user_email) LIKE LOWER($${values.length}) OR
        LOWER(al.user_name) LIKE LOWER($${values.length}) OR
        LOWER(al.user_company) LIKE LOWER($${values.length})
      )`);
    }

    if (query.company) {
      values.push(`%${query.company}%`);
      conditions.push(`LOWER(al.user_company) LIKE LOWER($${values.length})`);
    }

    if (query.email) {
      values.push(`%${query.email}%`);
      conditions.push(`LOWER(al.user_email) LIKE LOWER($${values.length})`);
    }

    if (query.startDate) {
      values.push(query.startDate);
      conditions.push(`al.login_at >= $${values.length}`);
    }

    if (query.endDate) {
      values.push(query.endDate);
      conditions.push(`al.login_at <= $${values.length}`);
    }

    // onlyActive verrà gestito dopo il JOIN nella query principale
    // Non lo aggiungiamo qui perché richiede la tabella u che viene JOINata dopo

    return { conditions, values, onlyActive: query.onlyActive === 'true' };
  };

  router.get(
    '/',
    authenticateToken,
    requireRole(['tecnico']),
    async (req, res) => {
      try {
        const pageSize = Math.min(parseInt(req.query.limit, 10) || 50, 100);
        const currentPage = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const offset = (currentPage - 1) * pageSize;

        const { conditions, values, onlyActive } = buildFilters(req.query);
        
        // Aggiungi la condizione onlyActive dopo il JOIN
        let whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        if (onlyActive) {
          // Usa INTERVAL standard PostgreSQL
          const activeCondition = `al.logout_at IS NULL AND (
            COALESCE(u.inactivity_timeout_minutes, 3) = 0
            OR
            (al.last_activity_at IS NOT NULL AND al.last_activity_at > NOW() - COALESCE(u.inactivity_timeout_minutes, 3) * INTERVAL '1 minute')
          )`;
          whereClause = whereClause 
            ? `${whereClause} AND ${activeCondition}`
            : `WHERE ${activeCondition}`;
        }

        const dataQuery = `
          SELECT 
            al.session_id,
            al.user_id,
            al.user_email,
            al.user_name,
            al.user_company,
            al.user_role,
            al.login_at,
            al.logout_at,
            al.login_ip,
            al.logout_ip,
            al.user_agent,
            EXTRACT(EPOCH FROM (COALESCE(al.logout_at, NOW()) - al.login_at)) AS duration_seconds,
            al.last_activity_at,
            COALESCE(u.inactivity_timeout_minutes, 3) AS user_inactivity_timeout_minutes
          FROM access_logs al
          LEFT JOIN users u ON u.id = al.user_id
          ${whereClause}
          ORDER BY al.login_at DESC
          LIMIT $${values.length + 1}
          OFFSET $${values.length + 2}
        `;

        // Query semplificata per le statistiche - calcoliamo active_sessions separatamente per performance
        // Prima eseguiamo la query dei dati, poi calcoliamo le statistiche
        console.log('🔍 Debug access logs query:', { 
          whereClause, 
          valuesCount: values.length, 
          pageSize, 
          offset,
          onlyActive 
        });

        // Esegui prima la query dei dati
        const dataResult = await pool.query(dataQuery, [...values, pageSize, offset]);
        
        // Query semplificata per il conteggio totale (senza calcolo complesso di active_sessions)
        const countQuery = `
          SELECT 
            COUNT(*) AS total,
            COUNT(DISTINCT COALESCE(al.user_email, al.user_id::text)) AS unique_users
          FROM access_logs al
          LEFT JOIN users u ON u.id = al.user_id
          ${whereClause}
        `;
        
        const countResult = await pool.query(countQuery, values);
        
        // Calcola active_sessions separatamente solo se necessario (più veloce)
        let activeSessions = 0;
        try {
          // Costruisci la query per active_sessions con gli stessi filtri base
          const activeConditions = [...conditions];
          const activeValues = [...values];
          
          // Aggiungi la condizione per sessioni attive
          activeConditions.push(`al.logout_at IS NULL AND (
            COALESCE(u.inactivity_timeout_minutes, 3) = 0
            OR
            (al.last_activity_at IS NOT NULL AND al.last_activity_at > NOW() - COALESCE(u.inactivity_timeout_minutes, 3) * INTERVAL '1 minute')
          )`);
          
          const activeWhereClause = activeConditions.length ? `WHERE ${activeConditions.join(' AND ')}` : '';
          
          const activeQuery = `
            SELECT COUNT(*) AS active_count
            FROM access_logs al
            LEFT JOIN users u ON u.id = al.user_id
            ${activeWhereClause}
          `;
          
          const activeResult = await pool.query(activeQuery, activeValues);
          activeSessions = Number(activeResult.rows[0]?.active_count || 0);
        } catch (activeErr) {
          console.warn('⚠️ Errore calcolo active_sessions (ignorato):', activeErr.message);
          // Se fallisce, usa un calcolo approssimativo basato sui dati caricati
          activeSessions = dataResult.rows.filter(row => {
            if (row.logout_at) return false;
            const timeout = row.user_inactivity_timeout_minutes || 3;
            if (timeout === 0) return true;
            if (!row.last_activity_at) return false;
            const lastActivity = new Date(row.last_activity_at);
            const now = new Date();
            const diffMinutes = (now - lastActivity) / (1000 * 60);
            return diffMinutes < timeout;
          }).length;
        }

        const summary = countResult.rows[0] || { total: 0, unique_users: 0 };

        res.json({
          logs: dataResult.rows,
          total: Number(summary.total || 0),
          activeSessions: activeSessions,
          uniqueUsers: Number(summary.unique_users || 0),
          page: currentPage,
          pageSize,
          filters: req.query
        });
      } catch (error) {
        console.error('❌ Errore recupero access logs:', error);
        console.error('❌ Stack trace:', error.stack);
        console.error('❌ Query params:', { conditions, values, onlyActive, whereClause });
        res.status(500).json({ 
          error: 'Errore nel recupero dei log di accesso',
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    }
  );

  // POST /api/access-logs/heartbeat - Aggiorna last_activity_at per la sessione corrente
  router.post('/heartbeat', authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        console.error('❌ Heartbeat: userId non trovato in req.user');
        return res.status(200).json({ success: false, error: 'Utente non autenticato' });
      }

      // Trova prima la sessione più recente senza logout
      const findSession = await pool.query(
        `SELECT session_id 
         FROM access_logs 
         WHERE user_id = $1 
           AND logout_at IS NULL 
         ORDER BY login_at DESC 
         LIMIT 1`,
        [userId]
      );

      if (findSession.rows.length === 0) {
        // Nessuna sessione attiva trovata - non è un errore
        return res.status(200).json({ success: false, message: 'Nessuna sessione attiva trovata' });
      }

      const sessionId = findSession.rows[0].session_id;

      // Aggiorna last_activity_at per questa sessione
      const updateResult = await pool.query(
        `UPDATE access_logs 
         SET last_activity_at = NOW() 
         WHERE session_id = $1 
           AND user_id = $2
           AND logout_at IS NULL
         RETURNING session_id`,
        [sessionId, userId]
      );

      if (updateResult.rowCount > 0) {
        res.status(200).json({ success: true, sessionId: updateResult.rows[0].session_id });
      } else {
        res.status(200).json({ success: false, message: 'Sessione non trovata o già chiusa' });
      }
    } catch (error) {
      console.error('❌ Errore heartbeat access log:', error);
      console.error('❌ Stack trace:', error.stack);
      // Restituisci sempre 200 per non bloccare l'app, ma con success: false
      res.status(200).json({ 
        success: false, 
        error: 'Errore interno del server',
        message: error.message 
      });
    }
  });

  return router;
};

