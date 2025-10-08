// Importa i pacchetti necessari
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // Importa il gestore di connessioni di PostgreSQL

// Inizializza l'applicazione Express
const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURAZIONE DATABASE ---
// Crea un nuovo "pool" di connessioni usando l'URL dal file di ambiente
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necessario per le connessioni su Render
  }
});

// --- MIDDLEWARE ---
app.use(cors()); // Abilita CORS per tutte le richieste
app.use(express.json());


// --- ROUTES (i tuoi futuri endpoint API) ---
app.get('/api', (req, res) => {
  res.json({ message: "Ciao! L'API del sistema di ticketing è funzionante." });
});

// Endpoint di test per verificare la connessione al database
app.get('/api/db-test', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()'); // Esegue una semplice query
        res.json({ success: true, time: result.rows[0] });
        client.release(); // Rilascia il client al pool
    } catch (err) {
        console.error('Errore connessione DB', err);
        res.status(500).json({ success: false, error: 'Impossibile connettersi al database.' });
    }
});


// --- AVVIO DEL SERVER ---
// Funzione asincrona per avviare il server
const startServer = async () => {
  try {
    // Prova a connetterti al database prima di avviare il server
    await pool.connect();
    console.log("✅ Connessione al database riuscita!");

    app.listen(PORT, () => {
      console.log(`🚀 Server backend in ascolto sulla porta ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Errore critico - Impossibile connettersi al database:", err);
    process.exit(1); // Esce dal processo se la connessione al DB fallisce
  }
};

startServer(); // Avvia la funzione