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
app.get('/api/users', async (req, res) => { /* ... (codice invariato) ... */ });
app.post('/api/users', async (req, res) => { /* ... (codice invariato) ... */ });

// ====================================================================
// --- UNICA MODIFICA: Questo endpoint ora funziona correttamente ---
// ====================================================================
app.patch('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, email, password } = req.body;

    const fields = [];
    const values = [];
    let queryIndex = 1;

    // Costruisce la query dinamicamente in base ai campi forniti
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

app.delete('/api/users/:id', async (req, res) => { /* ... (codice invariato) ... */ });

// ... (tutte le altre tue rotte per tickets, login, etc. rimangono invariate)
app.get('/api/tickets', async (req, res) => { /* ... */ });
app.post('/api/tickets', async (req, res) => { /* ... */ });
app.put('/api/tickets/:id', async (req, res) => { /* ... */ });
app.patch('/api/tickets/:id/status', async (req, res) => { /* ... */ });
app.post('/api/tickets/:id/messages', async (req, res) => { /* ... */ });
app.patch('/api/tickets/:id/mark-read', async (req, res) => { /* ... */ });
app.delete('/api/tickets/:id', async (req, res) => { /* ... */ });

// --- AVVIO DEL SERVER ---
const startServer = async () => { /* ... (codice invariato) ... */ };
startServer();
