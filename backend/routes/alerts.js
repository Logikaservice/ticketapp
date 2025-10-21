// backend/routes/alerts.js

const express = require('express');

module.exports = function createAlertsRouter(pool) {
  const router = express.Router();

  // GET /api/alerts - lista avvisi
  router.get('/', async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, title, body, level, ticket_id as "ticketId", created_at as "createdAt", created_by as "createdBy", clients, is_permanent as "isPermanent", days_to_expire as "daysToExpire" FROM alerts ORDER BY created_at DESC'
      );
      res.json(rows);
    } catch (err) {
      console.error('Errore GET /alerts:', err);
      res.status(500).json({ error: 'Errore nel recupero degli avvisi' });
    }
  });

  // POST /api/alerts - crea avviso (solo tecnico)
  router.post('/', async (req, res) => {
    try {
      const { title, body, level, ticketId, createdBy, clients, isPermanent, daysToExpire } = req.body || {};
      if (!title || !body) return res.status(400).json({ error: 'title e body sono obbligatori' });

      // Controllo ruolo semplice da body (in attesa di auth reale)
      // In produzione sostituire con auth token/sessione
      if (!req.headers['x-user-role'] && !req.body?.role) {
        return res.status(401).json({ error: 'Ruolo mancante' });
      }
      const role = (req.headers['x-user-role'] || req.body.role || '').toString();
      if (role !== 'tecnico') return res.status(403).json({ error: 'Solo i tecnici possono creare avvisi' });

      const { rows } = await pool.query(
        'INSERT INTO alerts (title, body, level, ticket_id, created_by, clients, is_permanent, days_to_expire) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, title, body, level, ticket_id as "ticketId", created_at as "createdAt", created_by as "createdBy", clients, is_permanent as "isPermanent", days_to_expire as "daysToExpire"',
        [title, body, level || 'warning', ticketId || null, createdBy || null, JSON.stringify(clients || []), isPermanent !== false, daysToExpire || 7]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Errore POST /alerts:', err);
      res.status(500).json({ error: 'Errore nella creazione dell\'avviso' });
    }
  });

  // PUT /api/alerts/:id - modifica avviso (solo tecnico)
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title, body, level, ticketId, createdBy, clients, isPermanent, daysToExpire } = req.body || {};
      
      if (!id) return res.status(400).json({ error: 'ID mancante' });
      if (!title || !body) return res.status(400).json({ error: 'title e body sono obbligatori' });

      const role = (req.headers['x-user-role'] || req.body?.role || '').toString();
      if (role !== 'tecnico') return res.status(403).json({ error: 'Solo i tecnici possono modificare avvisi' });

      const { rows } = await pool.query(
        'UPDATE alerts SET title = $1, body = $2, level = $3, ticket_id = $4, created_by = $5, clients = $6, is_permanent = $7, days_to_expire = $8 WHERE id = $9 RETURNING id, title, body, level, ticket_id as "ticketId", created_at as "createdAt", created_by as "createdBy", clients, is_permanent as "isPermanent", days_to_expire as "daysToExpire"',
        [title, body, level || 'warning', ticketId || null, createdBy || null, JSON.stringify(clients || []), isPermanent !== false, daysToExpire || 7, id]
      );
      
      if (rows.length === 0) return res.status(404).json({ error: 'Avviso non trovato' });
      res.json(rows[0]);
    } catch (err) {
      console.error('Errore PUT /alerts/:id:', err);
      res.status(500).json({ error: 'Errore nella modifica dell\'avviso' });
    }
  });

  // DELETE /api/alerts/:id - elimina avviso (solo tecnico)
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'ID mancante' });

      const role = (req.headers['x-user-role'] || req.body?.role || '').toString();
      if (role !== 'tecnico') return res.status(403).json({ error: 'Solo i tecnici possono eliminare avvisi' });

      await pool.query('DELETE FROM alerts WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Errore DELETE /alerts/:id:', err);
      res.status(500).json({ error: 'Errore nell\'eliminazione dell\'avviso' });
    }
  });

  return router;
};


