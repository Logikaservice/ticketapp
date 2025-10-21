// index.js

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
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());

// --- ROUTES ---
app.get('/api', (req, res) => {
  res.json({ message: "API del sistema di ticketing funzionante." });
});

// ENDPOINT: Keepalive per Supabase
app.get('/api/keepalive', async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    res.json({ 
      status: 'Database attivo', 
      timestamp: new Date().toISOString() 
    });
  } catch (err) {
    console.error('Errore keepalive:', err);
    res.status(500).json({ error: 'Errore keepalive' });
  }
});

// ENDPOINT: Login utente
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
    client.release();

    if (result.rows.length > 0) {
      const user = result.rows[0];
      delete user.password;
      res.json(user);
    } else {
      res.status(401).json({ error: 'Credenziali non valide' });
    }
  } catch (err) {
    console.error('Errore durante il login:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- IMPORTA LE ROUTES ---
const usersRoutes = require('./routes/users')(pool);
const ticketsRoutes = require('./routes/tickets')(pool);
const alertsRoutes = require('./routes/alerts')(pool);

app.use('/api/users', usersRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/alerts', alertsRoutes);

// --- ENDPOINT PER INIZIALIZZARE IL DATABASE ---
app.post('/api/init-db', async (req, res) => {
  try {
    // Crea tabella alerts se non esiste
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'warning' CHECK (level IN ('warning', 'danger', 'info')),
        ticket_id INTEGER,
        created_by TEXT,
        clients JSONB DEFAULT '[]',
        is_permanent BOOLEAN DEFAULT true,
        days_to_expire INTEGER DEFAULT 7,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log("✅ Tabella alerts creata/verificata");
    res.json({ message: 'Database inizializzato con successo' });
  } catch (err) {
    console.error('❌ Errore inizializzazione database:', err);
    res.status(500).json({ error: 'Errore nell\'inizializzazione del database' });
  }
});

// --- AVVIO DEL SERVER ---
const startServer = async () => {
  try {
    await pool.connect();
    console.log("✅ Connessione al database riuscita!");
    
    // Inizializza automaticamente il database
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS alerts (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          level TEXT NOT NULL DEFAULT 'warning' CHECK (level IN ('warning', 'danger', 'info')),
          ticket_id INTEGER,
          created_by TEXT,
          clients JSONB DEFAULT '[]',
          is_permanent BOOLEAN DEFAULT true,
          days_to_expire INTEGER DEFAULT 7,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("✅ Tabella alerts inizializzata automaticamente");
    } catch (initErr) {
      console.log("⚠️ Tabella alerts già esistente o errore:", initErr.message);
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Server backend OTTIMIZZATO in ascolto sulla porta ${PORT}`);
      console.log(`📁 Routes organizzate in moduli separati`);
    });
  } catch (err) {
    console.error("❌ Errore critico - Impossibile connettersi al database:", err);
    process.exit(1);
  }
};

startServer();
