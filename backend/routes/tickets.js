// routes/tickets.js

const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // ENDPOINT: Prende tutti i ticket
  router.get('/', async (req, res) => {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM tickets ORDER BY dataapertura DESC');
      
      // Parse dei campi JSON
      const tickets = result.rows.map(ticket => ({
        ...ticket,
        timelogs: ticket.timelogs ? (typeof ticket.timelogs === 'string' ? JSON.parse(ticket.timelogs) : ticket.timelogs) : null,
        messaggi: ticket.messaggi ? (typeof ticket.messaggi === 'string' ? JSON.parse(ticket.messaggi) : ticket.messaggi) : []
      }));
      
      client.release();
      res.json(tickets);
    } catch (err) {
      console.error('Errore nel prendere i ticket:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Crea un nuovo ticket
  router.post('/', async (req, res) => {
    const { clienteid, titolo, descrizione, stato, priorita, nomerichiedente, categoria } = req.body;
    const numero = `TKT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    try {
      const client = await pool.connect();
      const query = `
        INSERT INTO tickets (numero, clienteid, titolo, descrizione, stato, priorita, nomerichiedente, categoria, last_read_by_client, last_read_by_tecnico) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) 
        RETURNING *;
      `;
      const values = [numero, clienteid, titolo, descrizione, stato, priorita, nomerichiedente, categoria || 'assistenza'];
      const result = await client.query(query, values);
      client.release();
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Errore nella creazione del ticket:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Modifica un ticket completo
  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { titolo, descrizione, categoria, priorita, nomerichiedente, clienteid, dataapertura } = req.body;
    
    try {
      const client = await pool.connect();
      const query = `
        UPDATE tickets 
        SET titolo = $1, descrizione = $2, categoria = $3, priorita = $4, nomerichiedente = $5, clienteid = $6, dataapertura = $7
        WHERE id = $8 
        RETURNING *;
      `;
      const values = [titolo, descrizione, categoria, priorita, nomerichiedente, clienteid, dataapertura, id];
      const result = await client.query(query, values);
      client.release();

      if (result.rows.length > 0) {
        console.log(`✅ Ticket aggiornato: ID ${id}`);
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error('❌ Errore nell\'aggiornamento del ticket:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Aggiorna lo stato di un ticket
  router.patch('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const client = await pool.connect();
      const query = 'UPDATE tickets SET stato = $1 WHERE id = $2 RETURNING *;';
      const result = await client.query(query, [status, id]);
      client.release();

      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error(`Errore nell'aggiornare il ticket ${id}`, err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Aggiungi un messaggio a un ticket
  router.post('/:id/messages', async (req, res) => {
    const { id } = req.params;
    const { autore, contenuto, reclamo } = req.body;
    
    try {
      const client = await pool.connect();
      const ticketResult = await client.query('SELECT messaggi FROM tickets WHERE id = $1', [id]);
      
      if (ticketResult.rows.length === 0) {
        client.release();
        return res.status(404).json({ error: 'Ticket non trovato' });
      }
      
      let messaggi = ticketResult.rows[0].messaggi || [];
      const newMessage = {
        id: messaggi.length + 1,
        autore,
        contenuto,
        data: new Date().toISOString(),
        reclamo: reclamo || false
      };
      messaggi.push(newMessage);
      
      await client.query('UPDATE tickets SET messaggi = $1 WHERE id = $2', [JSON.stringify(messaggi), id]);
      client.release();
      
      res.status(201).json(newMessage);
    } catch (err) {
      console.error('Errore nel salvare il messaggio:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Marca i messaggi come letti
  router.patch('/:id/mark-read', async (req, res) => {
    const { id } = req.params;
    const { ruolo } = req.body;
    
    try {
      const client = await pool.connect();
      const column = ruolo === 'cliente' ? 'last_read_by_client' : 'last_read_by_tecnico';
      const query = `UPDATE tickets SET ${column} = NOW() WHERE id = $1 RETURNING *;`;
      const result = await client.query(query, [id]);
      client.release();
      
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error('Errore nel marcare come letto:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Salva i timelogs in un ticket
  router.post('/:id/timelogs', async (req, res) => {
    const { id } = req.params;
    const { timeLogs } = req.body;
    
    try {
      const client = await pool.connect();
      const query = 'UPDATE tickets SET timelogs = $1 WHERE id = $2 RETURNING *;';
      const result = await client.query(query, [JSON.stringify(timeLogs), id]);
      client.release();

      if (result.rows.length > 0) {
        console.log(`✅ Timelogs salvati per ticket ID ${id}`);
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error('❌ Errore nel salvare i timelogs:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Elimina un ticket
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const client = await pool.connect();
      const result = await client.query('DELETE FROM tickets WHERE id = $1', [id]);
      client.release();

      if (result.rowCount > 0) {
        res.status(200).json({ message: 'Ticket eliminato con successo' });
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error('Errore nell\'eliminazione del ticket:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Prende forniture temporanee di un ticket
  router.get('/:id/forniture', async (req, res) => {
    const { id } = req.params;
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'SELECT * FROM forniture_temporanee WHERE ticket_id = $1 ORDER BY data_prestito DESC',
        [id]
      );
      client.release();
      res.json(result.rows);
    } catch (err) {
      console.error('Errore nel recuperare le forniture:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Aggiungi fornitura temporanea
  router.post('/:id/forniture', async (req, res) => {
    const { id } = req.params;
    const { materiale, quantita } = req.body;
    
    if (!materiale || !quantita) {
      return res.status(400).json({ error: 'Materiale e quantità sono obbligatori' });
    }
    
    try {
      const client = await pool.connect();
      const query = `
        INSERT INTO forniture_temporanee (ticket_id, materiale, quantita) 
        VALUES ($1, $2, $3) 
        RETURNING *;
      `;
      const result = await client.query(query, [id, materiale, parseInt(quantita)]);
      client.release();
      
      console.log(`✅ Fornitura aggiunta al ticket ${id}`);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Errore nell\'aggiungere la fornitura:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Elimina fornitura temporanea (restituita)
  router.delete('/forniture/:fornituraId', async (req, res) => {
    const { fornituraId } = req.params;
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'DELETE FROM forniture_temporanee WHERE id = $1 RETURNING *',
        [fornituraId]
      );
      client.release();
      
      if (result.rowCount > 0) {
        console.log(`✅ Fornitura ${fornituraId} restituita`);
        res.json({ message: 'Fornitura restituita con successo' });
      } else {
        res.status(404).json({ error: 'Fornitura non trovata' });
      }
    } catch (err) {
      console.error('Errore nell\'eliminare la fornitura:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  return router;
};
