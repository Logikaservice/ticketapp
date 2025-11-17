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
        LOWER(user_email) LIKE LOWER($${values.length}) OR
        LOWER(user_name) LIKE LOWER($${values.length}) OR
        LOWER(user_company) LIKE LOWER($${values.length})
      )`);
    }

    if (query.company) {
      values.push(`%${query.company}%`);
      conditions.push(`LOWER(user_company) LIKE LOWER($${values.length})`);
    }

    if (query.email) {
      values.push(`%${query.email}%`);
      conditions.push(`LOWER(user_email) LIKE LOWER($${values.length})`);
    }

    if (query.startDate) {
      values.push(query.startDate);
      conditions.push(`login_at >= $${values.length}`);
    }

    if (query.endDate) {
      values.push(query.endDate);
      conditions.push(`login_at <= $${values.length}`);
    }

    if (query.onlyActive === 'true') {
      conditions.push(`logout_at IS NULL`);
    }

    return { conditions, values };
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

        const { conditions, values } = buildFilters(req.query);
        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const dataQuery = `
          SELECT 
            session_id,
            user_id,
            user_email,
            user_name,
            user_company,
            user_role,
            login_at,
            logout_at,
            login_ip,
            logout_ip,
            user_agent,
            EXTRACT(EPOCH FROM (COALESCE(logout_at, NOW()) - login_at)) AS duration_seconds
          FROM access_logs
          ${whereClause}
          ORDER BY login_at DESC
          LIMIT $${values.length + 1}
          OFFSET $${values.length + 2}
        `;

        const countQuery = `
          SELECT 
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE logout_at IS NULL) AS active_sessions,
            COUNT(DISTINCT COALESCE(user_email, user_id::text)) AS unique_users
          FROM access_logs
          ${whereClause}
        `;

        const dataResult = await pool.query(dataQuery, [...values, pageSize, offset]);
        const countResult = await pool.query(countQuery, values);

        const summary = countResult.rows[0] || { total: 0, active_sessions: 0, unique_users: 0 };

        res.json({
          logs: dataResult.rows,
          total: Number(summary.total || 0),
          activeSessions: Number(summary.active_sessions || 0),
          uniqueUsers: Number(summary.unique_users || 0),
          page: currentPage,
          pageSize,
          filters: req.query
        });
      } catch (error) {
        console.error('❌ Errore recupero access logs:', error);
        res.status(500).json({ error: 'Errore nel recupero dei log di accesso' });
      }
    }
  );

  return router;
};

