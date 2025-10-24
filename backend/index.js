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

// Importa utility per hash delle password e JWT
const { verifyPassword, migratePassword } = require('./utils/passwordUtils');
const { generateLoginResponse, verifyRefreshToken, generateToken } = require('./utils/jwtUtils');

// ENDPOINT: Login utente (SICURO con hash delle password)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const client = await pool.connect();
    
    // Prima cerca l'utente per email
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      client.release();
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    
    const user = result.rows[0];
    const storedPassword = user.password;
    
    // Verifica se la password è già hashata
    let isValidPassword = false;
    
    if (storedPassword && storedPassword.startsWith('$2b$')) {
      // Password già hashata - verifica con bcrypt
      isValidPassword = await verifyPassword(password, storedPassword);
    } else {
      // Password in chiaro (compatibilità con sistema esistente)
      isValidPassword = password === storedPassword;
      
      // Se il login è valido, migra la password a hash
      if (isValidPassword) {
        try {
          const hashedPassword = await migratePassword(password);
          await client.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);
          console.log(`✅ Password migrata per utente: ${email}`);
        } catch (migrateErr) {
          console.log('⚠️ Errore migrazione password:', migrateErr.message);
        }
      }
    }
    
    client.release();
    
    if (isValidPassword) {
      delete user.password;
      console.log(`✅ Login riuscito per: ${email}`);
      
      // Genera JWT token e refresh token
      const loginResponse = generateLoginResponse(user);
      res.json(loginResponse);
    } else {
      console.log(`❌ Login fallito per: ${email}`);
      res.status(401).json({ error: 'Credenziali non valide' });
    }
  } catch (err) {
    console.error('❌ Errore durante il login:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ENDPOINT: Refresh token
app.post('/api/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token richiesto' });
  }
  
  try {
    // Verifica il refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    // Genera un nuovo access token
    const newToken = generateToken({
      id: decoded.id,
      email: decoded.email,
      ruolo: decoded.ruolo,
      nome: decoded.nome,
      cognome: decoded.cognome
    });
    
    console.log(`🔄 Token rinnovato per: ${decoded.email}`);
    res.json({
      success: true,
      token: newToken
    });
    
  } catch (error) {
    console.log(`❌ Errore refresh token: ${error.message}`);
    res.status(401).json({ 
      error: error.message,
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
});

// Importa middleware di autenticazione
const { authenticateToken, requireRole } = require('./middleware/authMiddleware');

// --- IMPORTA LE ROUTES ---
const usersRoutes = require('./routes/users')(pool);
const ticketsRoutes = require('./routes/tickets')(pool);
const alertsRoutes = require('./routes/alerts')(pool);
const googleCalendarRoutes = require('./routes/googleCalendar')(pool);
const googleAuthRoutes = require('./routes/googleAuth')(pool);
const emailNotificationsRoutes = require('./routes/emailNotifications')(pool);

// Rotte protette con autenticazione JWT
app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/tickets', authenticateToken, ticketsRoutes);
app.use('/api/alerts', authenticateToken, alertsRoutes);
app.use('/api', authenticateToken, googleCalendarRoutes);
app.use('/api', authenticateToken, googleAuthRoutes);
app.use('/api/email', authenticateToken, emailNotificationsRoutes);

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

// --- ENDPOINT PER VERIFICARE LO SCHEMA DEL DATABASE ---
app.get('/api/check-schema', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Verifica se la colonna googlecalendareventid esiste
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tickets' AND column_name = 'googlecalendareventid'
    `);
    
    client.release();
    
    if (result.rows.length > 0) {
      res.json({ 
        success: true, 
        message: 'Colonna googlecalendareventid esiste',
        column: result.rows[0]
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Colonna googlecalendareventid NON esiste',
        suggestion: 'Chiama /api/init-db per aggiungere la colonna'
      });
    }
  } catch (err) {
    console.error('❌ Errore verifica schema:', err);
    res.status(500).json({ error: 'Errore nella verifica dello schema' });
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
