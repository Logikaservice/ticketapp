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
app.use(cors());
app.use(express.json());

// --- ROUTES ---
app.get('/api', (req, res) => {
  res.json({ message: "API del sistema di ticketing funzionante." });
});

app.get('/api/db-test', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        res.json({ success: true, time: result.rows[0] });
        client.release();
    } catch (err) {
        console.error('Errore connessione DB', err);
        res.status(500).json({ success: false, error: 'Impossibile connettersi al database.' });
    }
});

// ENDPOINT: Prende tutti i ticket dal database
app.get('/api/tickets', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM tickets ORDER BY dataApertura DESC');
        res.json(result.rows);
        client.release();
    } catch (err) {
        console.error('Errore nel prendere i ticket', err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// NUOVO ENDPOINT: Crea un nuovo ticket nel database
app.post('/api/tickets', async (req, res) => {
    // Prende i dati inviati dal frontend
    const { clienteId, titolo, descrizione, stato, priorita, nomeRichiedente } = req.body;

    // Genera un numero di ticket (logica semplificata)
    const numero = `TKT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

    try {
        const client = await pool.connect();
        const query = `
            INSERT INTO tickets (numero, clienteId, titolo, descrizione, stato, priorita, nomeRichiedente) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING *;
        `;
        const values = [numero, clienteId, titolo, descrizione, stato, priorita, nomeRichiedente];
        const result = await client.query(query, values);
        
        res.status(201).json(result.rows[0]); // Risponde con il ticket appena creato
        client.release();
    } catch (err) {
        console.error('Errore nella creazione del ticket', err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// --- AVVIO DEL SERVER ---
const startServer = async () => {
  try {
    await pool.connect();
    console.log("✅ Connessione al database riuscita!");
    app.listen(PORT, () => {
      console.log(`🚀 Server backend in ascolto sulla porta ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Errore critico - Impossibile connettersi al database:", err);
    process.exit(1);
  }
};

startServer();