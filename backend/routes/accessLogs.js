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
      const startTime = Date.now();
      console.log('🔍 [ACCESS LOGS] Inizio richiesta:', new Date().toISOString());
      console.log('🔍 [ACCESS LOGS] Query params:', req.query);
      
      try {
        const pageSize = Math.min(parseInt(req.query.limit, 10) || 50, 100);
        const currentPage = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const offset = (currentPage - 1) * pageSize;

        // Aggiungi limite di date di default (ultimi 30 giorni) se non specificato
        // Questo evita di caricare troppi dati e causa timeout
        if (!req.query.startDate && !req.query.endDate) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          req.query.startDate = thirtyDaysAgo.toISOString().split('T')[0];
          console.log('🔍 [ACCESS LOGS] Aggiunto limite default 30 giorni:', req.query.startDate);
        }

        const buildFiltersStart = Date.now();
        const { conditions, values, onlyActive } = buildFilters(req.query);
        console.log('🔍 [ACCESS LOGS] buildFilters completato in', Date.now() - buildFiltersStart, 'ms');
        console.log('🔍 [ACCESS LOGS] Conditions:', conditions);
        console.log('🔍 [ACCESS LOGS] Values count:', values.length);
        console.log('🔍 [ACCESS LOGS] OnlyActive:', onlyActive);
        
        // Aggiungi la condizione onlyActive dopo il JOIN
        const whereClauseStart = Date.now();
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
        console.log('🔍 [ACCESS LOGS] whereClause costruito in', Date.now() - whereClauseStart, 'ms');
        console.log('🔍 [ACCESS LOGS] whereClause:', whereClause);

        // Semplifica la query: usa JOIN solo se necessario (onlyActive o filtri su users)
        let dataQuery = '';
        let dataQueryValues = [];
        
        if (onlyActive || conditions.some(c => c.includes('u.'))) {
          // Query con JOIN solo se necessario
          dataQuery = `
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
          dataQueryValues = [...values, pageSize, offset];
        } else {
          // Query semplificata senza JOIN per massima velocità
          const simpleConditions = conditions.filter(c => !c.includes('u.'));
          const simpleWhereClause = simpleConditions.length ? `WHERE ${simpleConditions.join(' AND ')}` : '';
          dataQuery = `
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
              EXTRACT(EPOCH FROM (COALESCE(logout_at, NOW()) - login_at)) AS duration_seconds,
              last_activity_at,
              3 AS user_inactivity_timeout_minutes
            FROM access_logs
            ${simpleWhereClause}
            ORDER BY login_at DESC
            LIMIT $${simpleConditions.length + 1}
            OFFSET $${simpleConditions.length + 2}
          `;
          dataQueryValues = [...values.filter((v, i) => {
            const condition = conditions[i];
            return condition && !condition.includes('u.');
          }), pageSize, offset];
        }

        console.log('🔍 [ACCESS LOGS] dataQuery costruita');
        console.log('🔍 [ACCESS LOGS] dataQuery params:', [...values, pageSize, offset]);

        // Query semplificata per il conteggio totale (senza JOIN users per velocità)
        // Usa solo access_logs per total e unique_users
        let countQuery = '';
        let countValues = [];
        
        // Se ci sono filtri che richiedono il JOIN con users, usali, altrimenti semplifica
        if (onlyActive || conditions.some(c => c.includes('u.'))) {
          // Query con JOIN solo se necessario
          countQuery = `
            SELECT 
              COUNT(*) AS total,
              COUNT(DISTINCT COALESCE(al.user_email, al.user_id::text)) AS unique_users
            FROM access_logs al
            LEFT JOIN users u ON u.id = al.user_id
            ${whereClause}
          `;
          countValues = values;
        } else {
          // Query semplificata senza JOIN per massima velocità
          const simpleConditions = conditions.filter(c => !c.includes('u.'));
          const simpleWhereClause = simpleConditions.length ? `WHERE ${simpleConditions.join(' AND ')}` : '';
          
          // Verifica se la colonna last_activity_at esiste prima di usarla
          // Per ora usiamo solo le colonne base che sappiamo esistere
          countQuery = `
            SELECT 
              COUNT(*) AS total,
              COUNT(DISTINCT COALESCE(user_email, user_id::text)) AS unique_users
            FROM access_logs
            ${simpleWhereClause}
          `;
          // Filtra i valori per rimuovere quelli relativi a users
          countValues = values.filter((v, i) => {
            const condition = conditions[i];
            return condition && !condition.includes('u.');
          });
        }
        
        // Esegui le query in parallelo per velocità
        console.log('🔍 [ACCESS LOGS] Inizio esecuzione query parallele...');
        const queryStart = Date.now();
        
        let dataResult, countResult;
        try {
          [dataResult, countResult] = await Promise.all([
            (async () => {
              const start = Date.now();
              console.log('🔍 [ACCESS LOGS] Inizio dataQuery...');
              console.log('🔍 [ACCESS LOGS] dataQuery SQL:', dataQuery.substring(0, 200) + '...');
              console.log('🔍 [ACCESS LOGS] dataQuery params:', dataQueryValues);
              
              // Aggiungi timeout di 10 secondi alla query
              const queryPromise = pool.query(dataQuery, dataQueryValues);
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Query timeout dopo 10 secondi')), 10000)
              );
              
              const result = await Promise.race([queryPromise, timeoutPromise]);
              console.log('✅ [ACCESS LOGS] dataQuery completata in', Date.now() - start, 'ms, rows:', result.rows.length);
              return result;
            })(),
            (async () => {
              const start = Date.now();
              console.log('🔍 [ACCESS LOGS] Inizio countQuery...');
              console.log('🔍 [ACCESS LOGS] countQuery:', countQuery);
              console.log('🔍 [ACCESS LOGS] countValues:', countValues);
              
              // Aggiungi timeout di 10 secondi alla query
              const queryPromise = pool.query(countQuery, countValues);
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Query timeout dopo 10 secondi')), 10000)
              );
              
              const result = await Promise.race([queryPromise, timeoutPromise]);
              console.log('✅ [ACCESS LOGS] countQuery completata in', Date.now() - start, 'ms');
              return result;
            })()
          ]);
          console.log('✅ [ACCESS LOGS] Query parallele completate in', Date.now() - queryStart, 'ms');
        } catch (queryErr) {
          console.error('❌ [ACCESS LOGS] Errore durante esecuzione query:', queryErr);
          console.error('❌ [ACCESS LOGS] Stack:', queryErr.stack);
          throw queryErr;
        }
        
        // Calcola active_sessions in modo semplificato e opzionale
        // Se fallisce o è troppo lento, usa un valore approssimativo
        let activeSessions = 0;
        const activeStart = Date.now();
        try {
          console.log('🔍 [ACCESS LOGS] Inizio calcolo active_sessions...');
          // Calcolo semplificato: conta solo le sessioni senza logout che hanno last_activity_at recente
          // Usa un timeout fisso di 5 minuti per evitare query complesse
          const simpleActiveQuery = `
            SELECT COUNT(*) AS active_count
            FROM access_logs
            WHERE logout_at IS NULL 
              AND last_activity_at IS NOT NULL 
              AND last_activity_at > NOW() - INTERVAL '5 minutes'
          `;
          
          const activeResult = await pool.query(simpleActiveQuery, []);
          activeSessions = Number(activeResult.rows[0]?.active_count || 0);
          console.log('✅ [ACCESS LOGS] active_sessions calcolato in', Date.now() - activeStart, 'ms:', activeSessions);
        } catch (activeErr) {
          console.warn('⚠️ [ACCESS LOGS] Errore calcolo active_sessions (ignorato) dopo', Date.now() - activeStart, 'ms:', activeErr.message);
          console.warn('⚠️ [ACCESS LOGS] Stack:', activeErr.stack);
          // Calcolo approssimativo basato sui dati già caricati
          activeSessions = dataResult.rows.filter(row => {
            if (row.logout_at) return false;
            if (!row.last_activity_at) return false;
            const lastActivity = new Date(row.last_activity_at);
            const now = new Date();
            const diffMinutes = (now - lastActivity) / (1000 * 60);
            // Usa il timeout dell'utente se disponibile, altrimenti 3 minuti
            const timeout = row.user_inactivity_timeout_minutes || 3;
            return timeout === 0 || diffMinutes < timeout;
          }).length;
          console.log('⚠️ [ACCESS LOGS] active_sessions approssimativo:', activeSessions);
        }

        const summary = countResult.rows[0] || { total: 0, unique_users: 0 };
        
        const totalTime = Date.now() - startTime;
        console.log('✅ [ACCESS LOGS] Richiesta completata in', totalTime, 'ms');
        console.log('✅ [ACCESS LOGS] Risultati:', {
          logsCount: dataResult.rows.length,
          total: summary.total,
          activeSessions,
          uniqueUsers: summary.unique_users
        });

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
        const totalTime = Date.now() - startTime;
        console.error('❌ [ACCESS LOGS] Errore dopo', totalTime, 'ms');
        console.error('❌ [ACCESS LOGS] Errore:', error.message);
        console.error('❌ [ACCESS LOGS] Stack trace:', error.stack);
        
        // Usa variabili locali invece di quelle che potrebbero non essere definite
        let errorDetails = {};
        try {
          const { conditions: localConditions, values: localValues, onlyActive: localOnlyActive } = buildFilters(req.query || {});
          let localWhereClause = localConditions.length ? `WHERE ${localConditions.join(' AND ')}` : '';
          errorDetails = {
            conditions: localConditions || 'N/A',
            values: localValues || 'N/A',
            onlyActive: localOnlyActive || 'N/A',
            whereClause: localWhereClause || 'N/A'
          };
        } catch (buildErr) {
          errorDetails = { error: 'Impossibile costruire dettagli errore' };
        }
        
        console.error('❌ [ACCESS LOGS] Query params:', errorDetails);
        
        // Se l'errore è "column does not exist", suggerisci di eseguire la migrazione
        if (error.message && error.message.includes('does not exist')) {
          console.error('❌ [ACCESS LOGS] Colonna mancante nel database. Esegui la migrazione!');
        }
        
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

  // Endpoint di test semplice per verificare se il problema è la query complessa
  router.get('/test', authenticateToken, requireRole(['tecnico']), async (req, res) => {
    try {
      console.log('🔍 [TEST] Endpoint test chiamato');
      const startTime = Date.now();
      
      // Query semplicissima: conta solo i record
      const result = await pool.query('SELECT COUNT(*) as total FROM access_logs');
      
      console.log('✅ [TEST] Query completata in', Date.now() - startTime, 'ms');
      
      res.json({
        success: true,
        total: result.rows[0].total,
        time: Date.now() - startTime
      });
    } catch (error) {
      console.error('❌ [TEST] Errore:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};

