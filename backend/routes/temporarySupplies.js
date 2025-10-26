// routes/temporarySupplies.js

const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // ENDPOINT: Ottieni tutte le forniture temporanee
  router.get('/', async (req, res) => {
    try {
      const client = await pool.connect();
      const query = `
        SELECT 
          ft.*,
          u.azienda,
          u.nome as cliente_nome
        FROM forniture_temporanee_standalone ft
        LEFT JOIN users u ON ft.cliente_id = u.id
        ORDER BY ft.created_at DESC
      `;
      const result = await client.query(query);
      client.release();
      
      res.json(result.rows);
    } catch (err) {
      console.error('Errore nel recuperare le forniture temporanee:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Aggiungi una nuova fornitura temporanea
  router.post('/', async (req, res) => {
    const { materiale, quantita, cliente_id, note } = req.body;

    if (!materiale || !quantita || !cliente_id) {
      return res.status(400).json({ 
        error: 'Materiale, quantità e cliente sono obbligatori' 
      });
    }

    try {
      const client = await pool.connect();
      const query = `
        INSERT INTO forniture_temporanee_standalone (materiale, quantita, cliente_id, note) 
        VALUES ($1, $2, $3, $4) 
        RETURNING *;
      `;
      const values = [materiale, parseInt(quantita), cliente_id, note || ''];
      const result = await client.query(query, values);
      client.release();
      
      console.log(`✅ Fornitura temporanea aggiunta: ${materiale} per cliente ${cliente_id}`);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Errore nell\'aggiungere la fornitura temporanea:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Elimina una fornitura temporanea
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'DELETE FROM forniture_temporanee_standalone WHERE id = $1 RETURNING *',
        [id]
      );
      client.release();
      
      if (result.rowCount > 0) {
        console.log(`✅ Fornitura temporanea ${id} eliminata`);
        res.json({ message: 'Fornitura temporanea eliminata con successo' });
      } else {
        res.status(404).json({ error: 'Fornitura temporanea non trovata' });
      }
    } catch (err) {
      console.error('Errore nell\'eliminare la fornitura temporanea:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  return router;
};
