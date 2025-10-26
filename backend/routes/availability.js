// routes/availability.js

const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // ENDPOINT: Ottieni tutti i giorni non disponibili
  router.get('/', async (req, res) => {
    try {
      const client = await pool.connect();
      const result = await client.query(`
        SELECT date, reason, created_at, updated_at 
        FROM unavailable_days 
        ORDER BY date ASC
      `);
      
      client.release();
      res.json(result.rows);
    } catch (err) {
      console.error('Errore nel recuperare i giorni non disponibili:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Aggiungi o aggiorna un giorno non disponibile
  router.post('/', async (req, res) => {
    const { date, reason } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'La data è obbligatoria' });
    }

    try {
      const client = await pool.connect();
      
      // Verifica se il giorno esiste già
      const existingDay = await client.query(
        'SELECT id FROM unavailable_days WHERE date = $1',
        [date]
      );

      if (existingDay.rows.length > 0) {
        // Aggiorna il giorno esistente
        const updateResult = await client.query(
          'UPDATE unavailable_days SET reason = $1, updated_at = NOW() WHERE date = $2 RETURNING *',
          [reason || null, date]
        );
        client.release();
        res.json({
          success: true,
          message: 'Giorno non disponibile aggiornato',
          day: updateResult.rows[0]
        });
      } else {
        // Crea un nuovo giorno non disponibile
        const insertResult = await client.query(
          'INSERT INTO unavailable_days (date, reason, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
          [date, reason || null]
        );
        client.release();
        res.json({
          success: true,
          message: 'Giorno non disponibile aggiunto',
          day: insertResult.rows[0]
        });
      }
    } catch (err) {
      console.error('Errore nel salvare il giorno non disponibile:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Rimuovi un giorno non disponibile
  router.delete('/:date', async (req, res) => {
    const { date } = req.params;
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'DELETE FROM unavailable_days WHERE date = $1 RETURNING *',
        [date]
      );
      client.release();
      
      if (result.rows.length > 0) {
        res.json({
          success: true,
          message: 'Giorno non disponibile rimosso',
          day: result.rows[0]
        });
      } else {
        res.status(404).json({ error: 'Giorno non disponibile non trovato' });
      }
    } catch (err) {
      console.error('Errore nel rimuovere il giorno non disponibile:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Verifica se una data è non disponibile
  router.get('/check/:date', async (req, res) => {
    const { date } = req.params;
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'SELECT * FROM unavailable_days WHERE date = $1',
        [date]
      );
      client.release();
      
      res.json({
        isUnavailable: result.rows.length > 0,
        day: result.rows[0] || null
      });
    } catch (err) {
      console.error('Errore nel verificare la disponibilità:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  return router;
};
