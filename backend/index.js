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