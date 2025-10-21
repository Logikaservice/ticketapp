// routes/alerts.js

module.exports = (pool) => {
  const express = require('express');
  const router = express.Router();

  // GET /api/alerts - Ottieni tutti gli avvisi
  router.get('/', async (req, res) => {
    try {
      const client = await pool.connect();
      const result = await client.query(`
        SELECT 
          id,
          title,
          body,
          level,
          ticket_id,
          created_by,
          created_at
        FROM alerts 
        ORDER BY created_at DESC
      `);
      client.release();
      
      res.json(result.rows);
    } catch (err) {
      console.error('Errore nel recuperare gli avvisi:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // POST /api/alerts - Crea nuovo avviso
  router.post('/', async (req, res) => {
    const { title, body, level = 'warning', ticket_id = null, created_by } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({ error: 'Title e body sono obbligatori' });
    }

    try {
      const client = await pool.connect();
      const result = await client.query(`
        INSERT INTO alerts (title, body, level, ticket_id, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title, body, level, ticket_id, created_by, created_at
      `, [title, body, level, ticket_id, created_by]);
      client.release();
      
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Errore nel creare l\'avviso:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // PUT /api/alerts/:id - Aggiorna avviso
  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { title, body, level, ticket_id } = req.body;
    
    try {
      const client = await pool.connect();
      const result = await client.query(`
        UPDATE alerts 
        SET title = $1, body = $2, level = $3, ticket_id = $4
        WHERE id = $5
        RETURNING id, title, body, level, ticket_id, created_by, created_at
      `, [title, body, level, ticket_id, id]);
      client.release();
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Avviso non trovato' });
      }
      
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Errore nell\'aggiornare l\'avviso:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // DELETE /api/alerts/:id - Elimina avviso
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
      const client = await pool.connect();
      const result = await client.query('DELETE FROM alerts WHERE id = $1 RETURNING id', [id]);
      client.release();
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Avviso non trovato' });
      }
      
      res.json({ message: 'Avviso eliminato con successo' });
    } catch (err) {
      console.error('Errore nell\'eliminare l\'avviso:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  return router;
};