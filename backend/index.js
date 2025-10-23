// index.js

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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

// --- CONFIGURAZIONE MULTER PER UPLOAD FILE ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads', 'alerts');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `alert-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accetta solo immagini
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file immagine sono permessi!'), false);
    }
  }
});

// --- SERVIRE FILE STATICI ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
const googleCalendarRoutes = require('./routes/googleCalendar')(pool);
const googleAuthRoutes = require('./routes/googleAuth')(pool);

app.use('/api/users', usersRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api', googleCalendarRoutes);
app.use('/api', googleAuthRoutes);

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
        attachments JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Aggiungi colonne mancanti se la tabella esiste già
    try {
      await pool.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS clients JSONB DEFAULT '[]'`);
      await pool.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN DEFAULT true`);
      await pool.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS days_to_expire INTEGER DEFAULT 7`);
      await pool.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'`);
      console.log("✅ Colonne aggiunte alla tabella alerts esistente");
    } catch (alterErr) {
      console.log("⚠️ Errore aggiunta colonne (potrebbero già esistere):", alterErr.message);
    }
    
    // Aggiungi colonna googlecalendareventid alla tabella tickets se non esiste
    try {
      await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS googlecalendareventid TEXT`);
      console.log("✅ Colonna googlecalendareventid aggiunta alla tabella tickets");
    } catch (alterErr) {
      console.log("⚠️ Errore aggiunta colonna googlecalendareventid (potrebbe già esistere):", alterErr.message);
    }
    
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
          attachments JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("✅ Tabella alerts inizializzata automaticamente");
    } catch (initErr) {
      console.log("⚠️ Tabella alerts già esistente o errore:", initErr.message);
    }
    
    // Aggiungi colonna googlecalendareventid alla tabella tickets se non esiste
    try {
      await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS googlecalendareventid TEXT`);
      console.log("✅ Colonna googlecalendareventid aggiunta alla tabella tickets (auto-init)");
    } catch (alterErr) {
      console.log("⚠️ Errore aggiunta colonna googlecalendareventid (auto-init):", alterErr.message);
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
