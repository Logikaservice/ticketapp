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

// ENDPOINT: Login utente
// NOTA BENE: Salvare password in chiaro è insicuro. In un progetto reale, bisognerebbe usare una libreria come bcrypt per "crittografarle".
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
        client.release();

        if (result.rows.length > 0) {
            const user = result.rows[0];
            // Per sicurezza, non inviare mai la password al frontend
            delete user.password;
            res.json(user);
        } else {
            // Se non trova l'utente, risponde con un errore di "Non autorizzato"
            res.status(401).json({ error: 'Credenziali non valide' });
        }
    } catch (err) {
        console.error('Errore durante il login:', err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// ENDPOINT: Prende tutti i ticket dal database
app.get('/api/tickets', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM tickets ORDER BY dataapertura DESC');
        res.json(result.rows);
        client.release();
    } catch (err) {
        console.error('Errore nel prendere i ticket:', err);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// ENDPOINT: Crea un nuovo ticket nel database
app.post('/api/tickets', async (req, res) => {
    const { clienteid, titolo, descrizione, stato, priorita, nomerichiedente } = req.body;
    const numero = `TKT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    try {
        const client = await pool.connect();
        const query = `
            INSERT INTO tickets (numero, clienteid, titolo, descrizione, stato, priorita, nomerichiedente) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING *;
        `;
        const values = [numero, clienteid, titolo, descrizione, stato, priorita, nomerichiedente];
        const result = await client.query(query, values);
        res.status(201).json(result.rows[0]);
        client.release();
    } catch (err) {
        console.error('Errore nella creazione del ticket:', err);
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

