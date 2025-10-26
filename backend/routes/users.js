// routes/users.js

const express = require('express');
const { hashPassword } = require('../utils/passwordUtils');
const router = express.Router();

module.exports = (pool) => {
  // ENDPOINT: Prende tutti gli utenti (per il tecnico)
  router.get('/', async (req, res) => {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT id, email, password, ruolo, nome, cognome, telefono, azienda FROM users');
      
      // Per il tecnico, mostra sempre la password in chiaro
      const usersWithPlainPasswords = result.rows.map(user => ({
        ...user,
        password: user.password || ''
      }));
      
      client.release();
      res.json(usersWithPlainPasswords);
    } catch (err) {
      console.error('Errore nel prendere gli utenti', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Prende un singolo utente per ID
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const client = await pool.connect();
      const result = await client.query('SELECT id, email, password, ruolo, nome, cognome, telefono, azienda FROM users WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        client.release();
        return res.status(404).json({ error: 'Utente non trovato' });
      }
      
      const user = result.rows[0];
      // Per il tecnico, mostra sempre la password in chiaro
      const userWithPlainPassword = {
        ...user,
        password: user.password || ''
      };
      
      client.release();
      res.json(userWithPlainPassword);
    } catch (err) {
      console.error('Errore nel prendere l\'utente', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Crea un nuovo cliente (utente) - SICURO con hash password
  router.post('/', async (req, res) => {
    const { email, password, telefono, azienda, ruolo, nome, cognome } = req.body;

    if (!email || !password || !azienda) {
      return res.status(400).json({ error: 'Email, password e azienda sono obbligatori' });
    }

    if (!nome || !cognome) {
      return res.status(400).json({ error: 'Nome e cognome sono obbligatori' });
    }

    try {
      // Salva la password in chiaro per permettere la visualizzazione
      console.log(`🔓 Password salvata in chiaro per nuovo utente: ${email}`);
      
      const client = await pool.connect();
      const query = `
        INSERT INTO users (email, password, telefono, azienda, ruolo, nome, cognome) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id, email, ruolo, nome, cognome, telefono, azienda;
      `;
      const values = [email, password, telefono || null, azienda, ruolo || 'cliente', nome, cognome];
      const result = await client.query(query, values);
      client.release();
      
      // Condividi il calendario con il nuovo cliente
      if (result.rows[0] && result.rows[0].ruolo === 'cliente') {
        try {
          const shareResponse = await fetch(`${process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`}/api/share-calendar-with-client`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              clientEmail: result.rows[0].email
            })
          });
          
          if (shareResponse.ok) {
            console.log(`✅ Calendario condiviso con nuovo cliente: ${result.rows[0].email}`);
          } else {
            console.log(`⚠️ Errore condivisione calendario con nuovo cliente: ${result.rows[0].email}`);
          }
        } catch (shareErr) {
          console.log('⚠️ Errore condivisione calendario nuovo cliente:', shareErr.message);
        }
      }
      
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('ERRORE NELLA CREAZIONE DEL CLIENTE:', err);
      res.status(500).json({ error: 'Errore interno del server durante la creazione del cliente' });
    }
  });

  // ENDPOINT: Aggiorna un utente/cliente - SICURO con hash password
  router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, cognome, email, telefono, azienda, password } = req.body;
    
    try {
      const client = await pool.connect();
      
      let query, values;
      if (password && password.trim() !== '') {
        // Salva la password in chiaro per il tecnico (non hashata)
        console.log(`🔓 Password salvata in chiaro per aggiornamento utente ID: ${id}`);
        
        query = `
          UPDATE users 
          SET nome = $1, cognome = $2, email = $3, telefono = $4, azienda = $5, password = $6
          WHERE id = $7 
          RETURNING id, email, ruolo, nome, cognome, telefono, azienda, password;
        `;
        values = [nome, cognome, email, telefono, azienda, password, id];
      } else {
        query = `
          UPDATE users 
          SET nome = $1, cognome = $2, email = $3, telefono = $4, azienda = $5 
          WHERE id = $6 
          RETURNING id, email, ruolo, nome, cognome, telefono, azienda, password;
        `;
        values = [nome, cognome, email, telefono, azienda, id];
      }
      
      const result = await client.query(query, values);
      client.release();
      
      if (result.rows.length > 0) {
        console.log(`✅ Cliente aggiornato: ID ${id}`);
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Cliente non trovato' });
      }
    } catch (err) {
      console.error('❌ Errore nell\'aggiornamento del cliente:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Elimina un utente/cliente
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
      const client = await pool.connect();
      const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
      client.release();

      if (result.rowCount > 0) {
        console.log(`✅ Cliente eliminato: ID ${id}`);
        res.status(200).json({ 
          message: 'Cliente eliminato con successo', 
          user: result.rows[0] 
        });
      } else {
        res.status(404).json({ error: 'Cliente non trovato' });
      }
    } catch (err) {
      console.error('❌ Errore nell\'eliminazione del cliente:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  return router;
};
