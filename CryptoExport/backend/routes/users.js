// routes/users.js

const express = require('express');
const { hashPassword } = require('../utils/passwordUtils');
const router = express.Router();

module.exports = (pool) => {
  // ENDPOINT: Prende tutti gli utenti (per il tecnico)
  router.get('/', async (req, res) => {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT id, email, password, ruolo, nome, cognome, telefono, azienda, COALESCE(admin_companies, \'[]\'::jsonb) as admin_companies, COALESCE(enabled_projects, \'["ticket"]\'::jsonb) as enabled_projects FROM users');
      
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
      const result = await client.query('SELECT id, email, password, ruolo, nome, cognome, telefono, azienda, COALESCE(admin_companies, \'[]\'::jsonb) as admin_companies, COALESCE(enabled_projects, \'["ticket"]\'::jsonb) as enabled_projects FROM users WHERE id = $1', [id]);
      
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
    const { email, password, telefono, azienda, ruolo, nome, cognome, admin_companies, enabled_projects } = req.body;

    if (!email || !password || !azienda) {
      return res.status(400).json({ error: 'Email, password e azienda sono obbligatori' });
    }

    if (!nome || !cognome) {
      return res.status(400).json({ error: 'Nome e cognome sono obbligatori' });
    }

    try {
      const sanitizedAdminCompanies = Array.isArray(admin_companies)
        ? admin_companies.filter(Boolean)
        : [];
      const adminCompaniesJsonb = JSON.stringify(sanitizedAdminCompanies);
      
      // Gestisci enabled_projects: default ['ticket'] se non specificato
      const sanitizedEnabledProjects = Array.isArray(enabled_projects)
        ? enabled_projects.filter(Boolean)
        : ['ticket']; // Default: tutti hanno accesso a ticket
      const enabledProjectsJsonb = JSON.stringify(sanitizedEnabledProjects);

      // Salva la password in chiaro per permettere la visualizzazione
      console.log(`🔓 Password salvata in chiaro per nuovo utente: ${email}`);
      
      const client = await pool.connect();
      const query = `
        INSERT INTO users (email, password, telefono, azienda, ruolo, nome, cognome, admin_companies, enabled_projects) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb) 
        RETURNING id, email, ruolo, nome, cognome, telefono, azienda, COALESCE(admin_companies, '[]'::jsonb) as admin_companies, COALESCE(enabled_projects, '["ticket"]'::jsonb) as enabled_projects;
      `;
      const values = [email, password, telefono || null, azienda, ruolo || 'cliente', nome, cognome, adminCompaniesJsonb, enabledProjectsJsonb];
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
    const { nome, cognome, email, telefono, azienda, password, admin_companies, enabled_projects, inactivity_timeout_minutes } = req.body;
    
    try {
      const client = await pool.connect();
      
      let query, values;
      
      // Converti admin_companies in JSONB se fornito
      const adminCompaniesJsonb = admin_companies !== undefined && admin_companies !== null 
        ? JSON.stringify(Array.isArray(admin_companies) ? admin_companies : []) 
        : null;
      
      // Converti enabled_projects in JSONB se fornito
      const enabledProjectsJsonb = enabled_projects !== undefined && enabled_projects !== null
        ? JSON.stringify(Array.isArray(enabled_projects) ? enabled_projects : ['ticket'])
        : null;
      
      // Costruisci query dinamica per gestire tutti i campi opzionali
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      if (nome !== undefined) {
        updateFields.push(`nome = $${paramIndex++}`);
        updateValues.push(nome);
      }
      if (cognome !== undefined) {
        updateFields.push(`cognome = $${paramIndex++}`);
        updateValues.push(cognome);
      }
      if (email !== undefined) {
        updateFields.push(`email = $${paramIndex++}`);
        updateValues.push(email);
      }
      if (telefono !== undefined) {
        updateFields.push(`telefono = $${paramIndex++}`);
        updateValues.push(telefono);
      }
      if (azienda !== undefined) {
        updateFields.push(`azienda = $${paramIndex++}`);
        updateValues.push(azienda);
      }
      if (password && password.trim() !== '') {
        updateFields.push(`password = $${paramIndex++}`);
        updateValues.push(password);
        console.log(`🔓 Password salvata in chiaro per aggiornamento utente ID: ${id}`);
      }
        if (adminCompaniesJsonb !== null) {
        updateFields.push(`admin_companies = $${paramIndex++}::jsonb`);
        updateValues.push(adminCompaniesJsonb);
      }
      if (enabledProjectsJsonb !== null) {
        updateFields.push(`enabled_projects = $${paramIndex++}::jsonb`);
        updateValues.push(enabledProjectsJsonb);
        }
      if (inactivity_timeout_minutes !== undefined && inactivity_timeout_minutes !== null) {
        updateFields.push(`inactivity_timeout_minutes = $${paramIndex++}`);
        updateValues.push(inactivity_timeout_minutes);
      }
      
      if (updateFields.length === 0) {
        client.release();
        return res.status(400).json({ error: 'Nessun campo da aggiornare' });
      }
      
      updateValues.push(id);
          query = `
            UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, email, ruolo, nome, cognome, telefono, azienda, password, COALESCE(admin_companies, '[]'::jsonb) as admin_companies, COALESCE(enabled_projects, '["ticket"]'::jsonb) as enabled_projects, COALESCE(inactivity_timeout_minutes, 3) as inactivity_timeout_minutes;
          `;
      values = updateValues;
      
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
