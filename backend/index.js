// index.js (backend)

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors({ origin: 'https://ticketapp-frontend-ton5.onrender.com' }));
app.use(express.json());

// --- ROUTES ---
app.get('/api/users', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT id, email, ruolo, nome, cognome, telefono, azienda FROM users');
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error('Errore nel prendere gli utenti', err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

app.post('/api/users', async (req, res) => {
    const { email, password, telefono, azienda, ruolo } = req.body;
    if (!email || !password || !azienda) {
        return res.status(400).json({ error: 'Email, password e azienda sono obbligatori' });
    }
    try {
        const client = await pool.connect();
        const query = `
            INSERT INTO users (email, password, telefono, azienda, ruolo, nome, cognome) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING id, email, ruolo, nome, cognome, telefono, azienda;
        `;
        const values = [email, password, telefono || null, azienda, ruolo || 'cliente', 'Non', 'Specificato'];
        const result = await client.query(query, values);
        client.release();
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('ERRORE CREAZIONE CLIENTE:', err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// ====================================================================
// --- ENDPOINT MODIFICATO PER GESTIRE L'AGGIORNAMENTO ---
// ====================================================================
app.patch('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, email, password, cognome, telefono, azienda } = req.body;

    const fields = [];
    const values = [];
    let queryIndex = 1;

    // Costruisce la query dinamicamente in base ai campi forniti
    if (nome !== undefined) { fields.push(`nome = $${queryIndex++}`); values.push(nome); }
    if (email !== undefined) { fields.push(`email = $${queryIndex++}`); values.push(email); }
    if (password !== undefined && password !== '') { fields.push(`password = $${queryIndex++}`); values.push(password); }
    if (cognome !== undefined) { fields.push(`cognome = $${queryIndex++}`); values.push(cognome); }
    if (telefono !== undefined) { fields.push(`telefono = $${queryIndex++}`); values.push(telefono); }
    if (azienda !== undefined) { fields.push(`azienda = $${queryIndex++}`); values.push(azienda); }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'Nessun campo da aggiornare' });
    }

    values.push(id);
    const query = `
        UPDATE users SET ${fields.join(', ')} WHERE id = $${queryIndex} 
        RETURNING id, email, ruolo, nome, cognome, telefono, azienda;
    `;

    try {
        const client = await pool.connect();
        const result = await client.query(query, values);
        client.release();
        if (result.rows.length > 0) {
            console.log(`✅ Utente aggiornato: ID ${id}`);
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Utente non trovato' });
        }
    } catch (err) {
        console.error(`❌ Errore aggiornamento utente ${id}:`, err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const client = await pool.connect();
        const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
        client.release();
        if (result.rowCount > 0) {
            console.log(`✅ Cliente eliminato: ID ${id}`);
            res.status(200).json({ message: 'Cliente eliminato con successo', user: result.rows[0] });
        } else {
            res.status(404).json({ error: 'Cliente non trovato' });
        }
    } catch (err) {
        console.error('❌ Errore nell\'eliminazione del cliente:', err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// ... (tutte le altre tue rotte per tickets, etc. rimangono invariate)
app.get('/api/tickets', async (req, res) => { /* ... */ });
app.post('/api/tickets', async (req, res) => { /* ... */ });
app.patch('/api/tickets/:id/status', async (req, res) => { /* ... */ });
app.post('/api/tickets/:id/messages', async (req, res) => { /* ... */ });
app.patch('/api/tickets/:id/mark-read', async (req, res) => { /* ... */ });
app.delete('/api/tickets/:id', async (req, res) => { /* ... */ });

// --- AVVIO DEL SERVER ---
const startServer = async () => {
  try {
    await pool.connect();
    console.log("✅ Connessione al database riuscita!");
    app.listen(PORT, () => {
      console.log(`🚀 Server backend in ascolto sulla porta ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Errore critico:", err);
    process.exit(1);
  }
};

startServer();
