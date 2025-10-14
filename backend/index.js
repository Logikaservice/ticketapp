// index.js (backend)

// Importa i pacchetti necessari
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
app.get('/api', (req, res) => { /* ... codice invariato ... */ });
app.get('/api/keepalive', async (req, res) => { /* ... codice invariato ... */ });
app.post('/api/login', async (req, res) => { /* ... codice invariato ... */ });
app.get('/api/users', async (req, res) => { /* ... codice invariato ... */ });
app.post('/api/users', async (req, res) => { /* ... codice invariato ... */ });
app.patch('/api/users/:id', async (req, res) => { /* ... codice invariato ... */ });
app.delete('/api/users/:id', async (req, res) => { /* ... codice invariato ... */ });
app.get('/api/tickets', async (req, res) => { /* ... codice invariato ... */ });
app.post('/api/tickets', async (req, res) => { /* ... codice invariato ... */ });


// ====================================================================
// --- UNICA MODIFICA: Corretto l'endpoint per modificare un ticket ---
// ====================================================================
app.patch('/api/tickets/:id', async (req, res) => {
    const { id } = req.params;
    const { titolo, descrizione, categoria, priorita, nomerichiedente, clienteid } = req.body;
    
    const fields = [];
    const values = [];
    let queryIndex = 1;

    if (titolo !== undefined) { fields.push(`titolo = $${queryIndex++}`); values.push(titolo); }
    if (descrizione !== undefined) { fields.push(`descrizione = $${queryIndex++}`); values.push(descrizione); }
    if (categoria !== undefined) { fields.push(`categoria = $${queryIndex++}`); values.push(categoria); }
    if (priorita !== undefined) { fields.push(`priorita = $${queryIndex++}`); values.push(priorita); }
    if (nomerichiedente !== undefined) { fields.push(`nomerichiedente = $${queryIndex++}`); values.push(nomerichiedente); }
    if (clienteid !== undefined) { fields.push(`clienteid = $${queryIndex++}`); values.push(clienteid); }

    if (fields.length === 0) {
        return res.status(400).json({ error: 'Nessun campo da aggiornare' });
    }

    values.push(id);
    const query = `
        UPDATE tickets SET ${fields.join(', ')} WHERE id = $${queryIndex} 
        RETURNING *;
    `;
    
    try {
        const client = await pool.connect();
        const result = await client.query(query, values);
        client.release();

        if (result.rows.length > 0) {
            console.log(`✅ Ticket aggiornato: ID ${id}`);
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Ticket non trovato' });
        }
    } catch (err) {
        console.error(`❌ Errore nell\'aggiornamento del ticket: ${id}`, err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});
// ====================================================================


app.patch('/api/tickets/:id/status', async (req, res) => { /* ... codice invariato ... */ });
app.post('/api/tickets/:id/messages', async (req, res) => { /* ... codice invariato ... */ });
app.patch('/api/tickets/:id/mark-read', async (req, res) => { /* ... codice invariato ... */ });
app.delete('/api/tickets/:id', async (req, res) => { /* ... codice invariato ... */ });

// --- AVVIO DEL SERVER ---
const startServer = async () => { /* ... codice invariato ... */ };
startServer();
