// index.js (backend)

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURAZIONE DATABASE ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- MIDDLEWARE ---
const corsOptions = {
  origin: 'https://ticketapp-frontend-ton5.onrender.com'
};
app.use(cors(corsOptions));
app.use(express.json());

// --- ROUTES ---
app.get('/api', (req, res) => {
  res.json({ message: "API del sistema di ticketing funzionante." });
});

app.get('/api/keepalive', async (req, res) => { /* ... (codice invariato) ... */ });

app.post('/api/login', async (req, res) => { /* ... (codice invariato) ... */ });

app.get('/api/users', async (req, res) => { /* ... (codice invariato) ... */ });

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
        console.error('ERRORE NELLA CREAZIONE DEL CLIENTE:', err);
        res.status(500).json({ error: 'Errore interno del server durante la creazione del cliente' });
    }
});

// ====================================================================
// --- UNICA MODIFICA: AGGIUNTO QUESTO BLOCCO PER LE IMPOSTAZIONI ---
// ====================================================================
app.patch('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, email, password } = req.body;

    const fields = [];
    const values = [];
    let queryIndex = 1;

    if (nome !== undefined) { fields.push(`nome = $${queryIndex++}`); values.push(nome); }
    if (email !== undefined) { fields.push(`email = $${queryIndex++}`); values.push(email); }
    if (password !== undefined && password !== '') { fields.push(`password = $${queryIndex++}`); values.push(password); }

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
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Utente non trovato' });
        }
    } catch (err) {
        console.error(`Errore aggiornamento utente ${id}:`, err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});
// ====================================================================

app.delete('/api/users/:id', async (req, res) => { /* ... (codice invariato) ... */ });
app.get('/api/tickets', async (req, res) => { /* ... (codice invariato) ... */ });
app.post('/api/tickets', async (req, res) => { /* ... (codice invariato) ... */ });
app.patch('/api/tickets/:id/status', async (req, res) => { /* ... (codice invariato) ... */ });
app.post('/api/tickets/:id/messages', async (req, res) => { /* ... (codice invariato) ... */ });
app.patch('/api/tickets/:id/mark-read', async (req, res) => { /* ... (codice invariato) ... */ });
app.delete('/api/tickets/:id', async (req, res) => { /* ... (codice invariato) ... */ });

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
