// index.js - Deploy test 2025-12-05 00:25

// Carica variabili d'ambiente da .env
// Specifica il percorso esplicito per funzionare anche con PM2
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { Pool } = require('pg');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// --- CONFIGURAZIONE DATABASE ---
// ✅ FIX: Parsa l'URL e passa parametri separati per gestire password con caratteri speciali
let poolConfig = {
  ssl: {
    rejectUnauthorized: false
  }
};

if (process.env.DATABASE_URL) {
  try {
    // ✅ FIX: Usa URL() invece di url.parse() per parsing più robusto
    const dbUrl = new URL(process.env.DATABASE_URL);
    poolConfig.host = dbUrl.hostname || 'localhost';
    poolConfig.port = dbUrl.port ? parseInt(dbUrl.port) : 5432;
    poolConfig.database = dbUrl.pathname ? dbUrl.pathname.replace(/^\//, '') : 'ticketapp';
    
    // Estrai e decodifica user e password
    if (dbUrl.username) {
      poolConfig.user = decodeURIComponent(dbUrl.username);
    }
    if (dbUrl.password) {
      // Decodifica la password (gestisce %21 per !, ecc.)
      poolConfig.password = decodeURIComponent(dbUrl.password);
    }
    
    console.log('✅ DATABASE_URL parsato correttamente:', {
      host: poolConfig.host,
      port: poolConfig.port,
      database: poolConfig.database,
      user: poolConfig.user,
      password: poolConfig.password ? '***' : undefined
    });
  } catch (e) {
    console.error('❌ Errore parsing DATABASE_URL:', e.message);
    console.warn('⚠️ Uso connectionString come fallback');
    poolConfig.connectionString = process.env.DATABASE_URL;
  }
} else {
  poolConfig.connectionString = process.env.DATABASE_URL;
}

const pool = new Pool(poolConfig);

// --- CONFIGURAZIONE DATABASE VIVALDI (separato) ---
let vivaldiDbUrl = process.env.DATABASE_URL_VIVALDI ||
  process.env.DATABASE_URL?.replace(/\/[^\/]+$/, '/vivaldi_db');

let poolVivaldi = null;
if (vivaldiDbUrl) {
  // ✅ FIX: Usa URL() invece di url.parse() per parsing più robusto
  let vivaldiConfig = {
    ssl: {
      rejectUnauthorized: false
    }
  };
  
  try {
    const dbUrl = new URL(vivaldiDbUrl);
    vivaldiConfig.host = dbUrl.hostname || 'localhost';
    vivaldiConfig.port = dbUrl.port ? parseInt(dbUrl.port) : 5432;
    vivaldiConfig.database = dbUrl.pathname ? dbUrl.pathname.replace(/^\//, '') : 'vivaldi_db';
    
    if (dbUrl.username) {
      vivaldiConfig.user = decodeURIComponent(dbUrl.username);
    }
    if (dbUrl.password) {
      vivaldiConfig.password = decodeURIComponent(dbUrl.password);
    }
  } catch (e) {
    console.warn('⚠️ Errore parsing DATABASE_URL_VIVALDI, uso connectionString:', e.message);
    vivaldiConfig.connectionString = vivaldiDbUrl;
  }
  
  poolVivaldi = new Pool(vivaldiConfig);
} else {
  console.warn('⚠️ DATABASE_URL_VIVALDI non configurato! Vivaldi non sarà disponibile.');
  poolVivaldi = null;
}

// --- CONFIGURAZIONE DATABASE PACKVISION (separato) ---
// Tenta di connettersi a packvision_db, se fallisce (es. non esiste), poolPackVision sarà null
// e le route restituiranno 503 Service Unavailable
let packvisionDbUrl = process.env.DATABASE_URL?.replace(/\/[^\/]+$/, '/packvision_db');

let poolPackVision = null;

if (packvisionDbUrl) {
  // ✅ FIX: Usa URL() invece di url.parse() per parsing più robusto
  let packvisionConfig = {
    ssl: {
      rejectUnauthorized: false
    }
  };
  
  try {
    const dbUrl = new URL(packvisionDbUrl);
    packvisionConfig.host = dbUrl.hostname || 'localhost';
    packvisionConfig.port = dbUrl.port ? parseInt(dbUrl.port) : 5432;
    packvisionConfig.database = dbUrl.pathname ? dbUrl.pathname.replace(/^\//, '') : 'packvision_db';
    
    if (dbUrl.username) {
      packvisionConfig.user = decodeURIComponent(dbUrl.username);
    }
    if (dbUrl.password) {
      packvisionConfig.password = decodeURIComponent(dbUrl.password);
    }
  } catch (e) {
    console.warn('⚠️ Errore parsing packvisionDbUrl, uso connectionString:', e.message);
    packvisionConfig.connectionString = packvisionDbUrl;
  }
  
  // Non creiamo subito il pool, o meglio lo creiamo ma gestiamo errori di connessione nelle route
  poolPackVision = new Pool(packvisionConfig);

  // Gestione errori idle client per evitare crash se il DB non esiste
  poolPackVision.on('error', (err, client) => {
    console.error('Errore inatteso su client PackVision (probabilmente DB non esiste):', err.message);
  });
}

// Crea tabella access_logs se non esiste
const ensureAccessLogsTable = async () => {
  try {
    // Prima crea la tabella senza last_activity_at (per compatibilità)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS access_logs (
        session_id TEXT PRIMARY KEY,
        user_id INTEGER,
        user_email TEXT,
        user_name TEXT,
        user_company TEXT,
        user_role TEXT,
        login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        logout_at TIMESTAMPTZ,
        login_ip TEXT,
        logout_ip TEXT,
        user_agent TEXT
      )
    `);

    // Crea gli indici base
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_access_logs_login_at ON access_logs(login_at)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_access_logs_logout_at ON access_logs(logout_at)`);
    } catch (idxErr) {
      console.log("⚠️ Errore creazione indici (potrebbero già esistere):", idxErr.message);
    }

    // Aggiungi colonna last_activity_at se non esiste (IMPORTANTE: deve essere fatto sempre)
    try {
      // Verifica prima se la colonna esiste
      const checkColumn = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'access_logs' 
          AND column_name = 'last_activity_at'
      `);

      if (checkColumn.rows.length === 0) {
        // La colonna non esiste, aggiungila
        await pool.query(`
          ALTER TABLE access_logs 
          ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT NOW()
        `);
        console.log("✅ Colonna last_activity_at aggiunta a access_logs");

        // Crea l'indice per last_activity_at
        try {
          await pool.query(`CREATE INDEX IF NOT EXISTS idx_access_logs_last_activity ON access_logs(last_activity_at)`);
        } catch (idxErr) {
          console.log("⚠️ Errore creazione indice last_activity_at:", idxErr.message);
        }
      } else {
        console.log("✅ Colonna last_activity_at già presente in access_logs");
      }
    } catch (alterErr) {
      console.error("❌ Errore critico aggiunta colonna last_activity_at:", alterErr.message);
      console.error("❌ Stack:", alterErr.stack);
      // Non bloccare l'avvio, ma logga l'errore
    }

    console.log('✅ Tabella access_logs pronta');
  } catch (err) {
    console.error('❌ Errore creazione tabella access_logs:', err);
    console.error('❌ Stack:', err.stack);
  }
};

const extractClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
};

const { randomUUID } = require('crypto');

const recordAccessLog = async (user, req) => {
  const sessionId = randomUUID();
  const loginIp = extractClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    await pool.query(
      `INSERT INTO access_logs (
        session_id, user_id, user_email, user_name, user_company, user_role,
        login_ip, user_agent, last_activity_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        sessionId,
        user.id,
        user.email,
        `${user.nome || ''} ${user.cognome || ''}`.trim(),
        user.azienda || null,
        user.ruolo,
        loginIp,
        userAgent
      ]
    );
    console.log(`✅ Access log registrato per: ${user.email} (session: ${sessionId})`);
    return sessionId;
  } catch (err) {
    console.error('❌ Errore registrazione access log:', err);
    return null;
  }
};

// Crea tabella all'avvio
ensureAccessLogsTable();

// --- MIDDLEWARE ---
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow any subdomain of logikaservice.it
    if (origin.endsWith('.logikaservice.it') || origin === 'https://logikaservice.it') {
      return callback(null, true);
    }

    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);

    console.error(`❌ CORS blocked origin: ${origin}`);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  }
}));
app.use(express.json());

// --- CONFIGURAZIONE SOCKET.IO ---
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Importa JWT_SECRET da jwtUtils per usare lo stesso secret
const { JWT_SECRET } = require('./utils/jwtUtils');

// Middleware per autenticazione WebSocket
io.use(async (socket, next) => {
  try {
    // Prova a ottenere il token da più fonti
    const token = socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
      socket.handshake.headers?.Authorization?.replace('Bearer ', '');

    if (!token) {
      console.error('❌ WebSocket: Token mancante nell\'handshake');
      return next(new Error('Token mancante'));
    }

    // Verifica JWT token usando lo stesso JWT_SECRET di jwtUtils
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);

    socket.userId = decoded.id || decoded.userId;
    socket.userRole = decoded.ruolo;
    next();
  } catch (err) {
    console.error('❌ Errore autenticazione WebSocket:', err.message);
    console.error('❌ Stack:', err.stack);
    if (err.name === 'JsonWebTokenError') {
      console.error('❌ Token JWT non valido o malformato');
    } else if (err.name === 'TokenExpiredError') {
      console.error('❌ Token JWT scaduto');
    }
    next(new Error('Autenticazione fallita'));
  }
});

// Gestione connessioni WebSocket
io.on('connection', (socket) => {
  console.log(`✅ WebSocket connesso: ${socket.userId} (${socket.userRole})`);

  // Unisciti alle room per ricevere notifiche
  socket.join(`user:${socket.userId}`);
  socket.join(`role:${socket.userRole}`);

  // Allow joining crypto dashboard room (for real-time bot notifications)
  socket.on('crypto:join-dashboard', () => {
    socket.join('crypto:dashboard');
    console.log(`✅ Socket ${socket.userId} joined crypto:dashboard room`);
    socket.emit('crypto:joined', { room: 'crypto:dashboard' });
  });

  socket.on('crypto:leave-dashboard', () => {
    socket.leave('crypto:dashboard');
    console.log(`✅ Socket ${socket.userId} left crypto:dashboard room`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ WebSocket disconnesso: ${socket.userId}`);
  });

  // Ping/Pong per mantenere la connessione attiva
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// Esporta io per uso in altri moduli
module.exports.io = io;

// --- CONFIGURAZIONE MULTER PER UPLOAD FILE ---
const storageAlerts = multer.diskStorage({
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

const uploadAlerts = multer({
  storage: storageAlerts,
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

// Configurazione Multer per foto ticket
const storageTicketPhotos = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const uploadPath = path.join(__dirname, 'uploads', 'tickets', 'photos');

      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      // Verifica che la directory sia scrivibile
      try {
        fs.accessSync(uploadPath, fs.constants.W_OK);
      } catch (accessErr) {
        console.error('❌ Directory upload non scrivibile:', accessErr.message);
        return cb(new Error('Directory upload non scrivibile: ' + accessErr.message));
      }

      cb(null, uploadPath);
    } catch (err) {
      console.error('❌ Errore creazione directory upload:', err.message);
      cb(new Error('Errore creazione directory upload: ' + err.message));
    }
  },
  filename: (req, file, cb) => {
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname || '');
      const filename = `ticket-photo-${uniqueSuffix}${ext}`;
      cb(null, filename);
    } catch (err) {
      console.error('❌ Errore generazione nome file:', err.message);
      cb(new Error('Errore generazione nome file: ' + err.message));
    }
  }
});

const uploadTicketPhotos = multer({
  storage: storageTicketPhotos,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit per file ticket
  }
  // Rimossa restrizione fileFilter: accetta qualsiasi tipo di file
});

// Configurazione Multer per documenti Offerta (qualsiasi tipo comune)
const storageOffertaDocs = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads', 'tickets', 'offerte');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `offerta-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadOffertaDocs = multer({
  storage: storageOffertaDocs,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
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

// ENDPOINT: Login utente (TEMPORANEO senza JWT per debug)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  // Rileva il dominio/progetto richiesto dall'header Host
  // Supporta anche parametro ?domain=orari/vivaldi per test locali
  const host = req.get('host') || '';
  const testDomain = req.query.domain;
  const isOrariDomain = testDomain === 'orari' || testDomain === 'turni' ||
    host.includes('orari') || host.includes('turni');
  const isVivaldiDomain = testDomain === 'vivaldi' || host.includes('vivaldi');
  const requestedProject = isOrariDomain ? 'orari' : (isVivaldiDomain ? 'vivaldi' : 'ticket');

  try {
    const client = await pool.connect();

    // Prima cerca l'utente per email, includendo admin_companies, inactivity_timeout_minutes e enabled_projects
    const result = await client.query('SELECT id, email, password, ruolo, nome, cognome, telefono, azienda, COALESCE(admin_companies, \'[]\'::jsonb) as admin_companies, COALESCE(inactivity_timeout_minutes, 3) as inactivity_timeout_minutes, COALESCE(enabled_projects, \'["ticket"]\'::jsonb) as enabled_projects FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      client.release();
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const user = result.rows[0];

    // Verifica permessi progetto
    let enabledProjects = [];
    try {
      if (user.enabled_projects) {
        if (Array.isArray(user.enabled_projects)) {
          enabledProjects = user.enabled_projects;
        } else if (typeof user.enabled_projects === 'string') {
          enabledProjects = JSON.parse(user.enabled_projects);
        } else {
          enabledProjects = user.enabled_projects;
        }
        if (!Array.isArray(enabledProjects)) {
          enabledProjects = ['ticket']; // Default
        }
      } else {
        enabledProjects = ['ticket']; // Default se non presente
      }
    } catch (e) {
      console.error('Errore parsing enabled_projects:', e);
      enabledProjects = ['ticket'];
    }

    // Se l'utente non ha accesso al progetto richiesto, nega l'accesso
    // ECCEZIONE: Gli admin e i tecnici hanno sempre accesso a tutto
    if (user.ruolo !== 'admin' && user.ruolo !== 'tecnico' && !enabledProjects.includes(requestedProject)) {
      client.release();
      return res.status(403).json({
        error: `Accesso negato. Non hai i permessi per accedere a ${requestedProject === 'orari' ? 'Orari e Turni' : requestedProject === 'vivaldi' ? 'Vivaldi' : 'Ticket'}. Contatta l'amministratore.`
      });
    }

    const storedPassword = user.password;

    // Verifica se la password è già hashata
    let isValidPassword = false;

    if (storedPassword && storedPassword.startsWith('$2b$')) {
      // Password già hashata - verifica con bcrypt
      console.log('🔐 Verifica password hashata');
      isValidPassword = await verifyPassword(password, storedPassword);
    } else {
      // Password in chiaro (sistema attuale)
      isValidPassword = password === storedPassword;

      // Non migrare più le password - mantenere sempre in chiaro
    }

    client.release();

    if (isValidPassword) {
      // Non eliminare la password per permettere la visualizzazione nelle impostazioni

      // Registra access log
      const sessionId = await recordAccessLog(user, req);

      // Ripristina JWT token e refresh token
      try {
        console.log('🔐 Generazione JWT per utente:', user.email);
        const loginResponse = generateLoginResponse(user);
        console.log('✅ JWT generato con successo');
        console.log('Token length:', loginResponse.token ? loginResponse.token.length : 'N/A');
        console.log('Refresh token length:', loginResponse.refreshToken ? loginResponse.refreshToken.length : 'N/A');

        // Aggiungi sessionId alla risposta
        loginResponse.sessionId = sessionId;
        res.json(loginResponse);
      } catch (jwtErr) {
        console.error('❌ Errore generazione JWT:', jwtErr);
        console.error('❌ Stack trace JWT:', jwtErr.stack);
        // Fallback senza JWT se c'è errore
        // Assicurati che admin_companies sia incluso
        let adminCompanies = [];
        try {
          if (user.admin_companies) {
            if (Array.isArray(user.admin_companies)) {
              adminCompanies = user.admin_companies;
            } else if (typeof user.admin_companies === 'string') {
              adminCompanies = JSON.parse(user.admin_companies);
            } else {
              adminCompanies = user.admin_companies;
            }
            if (!Array.isArray(adminCompanies)) {
              adminCompanies = [];
            }
          }
        } catch (e) {
          adminCompanies = [];
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            ruolo: user.ruolo,
            nome: user.nome,
            cognome: user.cognome,
            telefono: user.telefono,
            azienda: user.azienda,
            password: user.password,
            admin_companies: adminCompanies,
            enabled_projects: enabledProjects,
            inactivity_timeout_minutes: user.inactivity_timeout_minutes || 3
          },
          sessionId
        });
      }
    } else {
      console.log(`❌ Login fallito per: ${email}`);
      res.status(401).json({ error: 'Credenziali non valide' });
    }
  } catch (err) {
    console.error('❌ Errore durante il login:', err);
    console.error('❌ Stack trace:', err.stack);
    res.status(500).json({
      error: 'Errore interno del server',
      details: err.message,
      stack: err.stack
    });
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

// ENDPOINT: Logout
app.post('/api/logout', async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.json({ success: true });
  }

  try {
    const logoutIp = extractClientIp(req);
    await pool.query(
      `UPDATE access_logs 
       SET logout_at = NOW(), logout_ip = $1 
       WHERE session_id = $2 AND logout_at IS NULL`,
      [logoutIp, sessionId]
    );
    console.log(`✅ Logout registrato per session: ${sessionId}`);
  } catch (err) {
    console.error('❌ Errore registrazione logout:', err);
  }

  res.json({ success: true });
});

// Importa middleware di autenticazione
const { authenticateToken, requireRole } = require('./middleware/authMiddleware');

// --- IMPORTA LE ROUTES ---
const usersRoutes = require('./routes/users')(pool);
const ticketsRoutes = require('./routes/tickets')(pool, uploadTicketPhotos, uploadOffertaDocs, io);
const alertsRoutes = require('./routes/alerts')(pool);
const googleCalendarRoutes = require('./routes/googleCalendar')(pool);
const googleAuthRoutes = require('./routes/googleAuth')(pool);
const emailNotificationsRoutes = require('./routes/emailNotifications')(pool);
const tempLoginRoutes = require('./routes/tempLogin')(pool);
const availabilityRoutes = require('./routes/availability')(pool);
const keepassRoutes = require('./routes/keepass')(pool);
const analyticsRoutes = require('./routes/analytics')(pool);
const accessLogsRoutes = require('./routes/accessLogs')(pool);
// Route per Orari e Turni (usa stesso pool ma tabella separata orari_data)
const orariRoutes = require('./routes/orari')(pool);

// Route per Vivaldi (database separato) - solo se pool disponibile
const vivaldiRoutes = poolVivaldi ? require('./routes/vivaldi')(poolVivaldi) : null;
const packvisionRoutes = require('./routes/packvision')(poolPackVision, io);

app.use('/api/packvision', packvisionRoutes);

// Route per Crypto Dashboard (database SQLite separato)
const cryptoRoutes = require('./routes/cryptoRoutes');
// Pass Socket.io instance to crypto routes for real-time notifications
cryptoRoutes.setSocketIO(io);
app.use('/api/crypto', cryptoRoutes);

// 🤖 Start Professional Trading Bot
console.log('🤖 [INIT] Starting Professional Crypto Trading Bot...');
try {
  const TradingBot = require('./services/TradingBot');
  console.log('✅ [INIT] Professional Trading Bot started successfully');
} catch (botError) {
  console.error('❌ [INIT] Error starting Trading Bot:', botError.message);
  console.error('❌ [INIT] Stack:', botError.stack);
}

// Rotte temporanee per debug (senza autenticazione) - DEVE ESSERE PRIMA
app.use('/api/temp', tempLoginRoutes);

// Endpoint pubblico per invii email server-to-server (es. quick-request senza login)
// DEVE essere montato PRIMA di qualsiasi route protetta che inizia con /api
app.use('/api/public-email', emailNotificationsRoutes);

// Endpoint pubblico per ottenere solo i clienti (per auto-rilevamento azienda)
app.get('/clients', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT id, email, nome, cognome, azienda FROM users WHERE ruolo = \'cliente\'');
    client.release();
    res.json(result.rows);
  } catch (err) {
    console.error('Errore nel prendere i clienti:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint pubblico per testare la connessione al database
app.get('/api/health', async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: err.message
    });
  }
});

// Endpoint pubblico per ottenere i giorni non disponibili (solo lettura)
app.get('/api/availability/public', async (req, res) => {
  let client;
  try {
    // Timeout per evitare connessioni bloccate
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database timeout')), 8000);
    });

    const dbPromise = (async () => {
      client = await pool.connect();

      // Crea la tabella se non esiste
      await client.query(`
        CREATE TABLE IF NOT EXISTS unavailable_days (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL UNIQUE,
          reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const result = await client.query(`
        SELECT date, reason, created_at, updated_at 
        FROM unavailable_days 
        ORDER BY date ASC
      `);

      return result.rows;
    })();

    const result = await Promise.race([dbPromise, timeoutPromise]);

    if (client) {
      client.release();
    }

    res.json(result);
  } catch (err) {
    if (client) {
      client.release();
    }
    console.error('Errore nel recuperare i giorni non disponibili (pubblico):', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Funzione helper per generare il footer HTML con link al login
const getEmailFooter = () => {
  const frontendUrl = process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com';
  return `
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #6b7280; font-size: 11px; margin: 0 0 8px 0;">
        <a href="${frontendUrl}" 
           style="color: #4caf50; text-decoration: none; font-weight: 500; font-size: 12px;">
          🔐 Accedi al sistema TicketApp
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 10px; margin: 0;">
        Questa email è stata inviata automaticamente dal sistema TicketApp
      </p>
    </div>
  `;
};

// Endpoint pubblico per richiesta assistenza veloce (senza login)
app.post('/api/tickets/quick-request', uploadTicketPhotos.array('photos', 10), async (req, res) => {
  // Gestisce sia JSON che multipart/form-data
  const titolo = req.body.titolo;
  const descrizione = req.body.descrizione;
  const priorita = req.body.priorita;
  const nomerichiedente = req.body.nomerichiedente;
  const email = req.body.email;
  const telefono = req.body.telefono;
  const azienda = req.body.azienda;
  const photos = req.files || [];

  if (!titolo || !descrizione || !email || !nomerichiedente) {
    return res.status(400).json({ error: 'Titolo, descrizione, email e nome sono obbligatori' });
  }

  try {
    const client = await pool.connect();

    let clienteid = null;

    // Controlla se esiste già un cliente con questa email esatta
    const existingByEmail = await client.query(
      'SELECT id FROM users WHERE email = $1 AND ruolo = \'cliente\' LIMIT 1',
      [email]
    );

    if (existingByEmail.rows.length > 0) {
      // Email esistente: usa il cliente esistente
      clienteid = existingByEmail.rows[0].id;
    } else {
      // Email non esistente: crea sempre un nuovo cliente (anche se l'azienda esiste già)
      const newClientQuery = `
        INSERT INTO users (email, password, telefono, azienda, ruolo, nome, cognome) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id;
      `;
      const newClientValues = [
        email,
        'quick_request_' + Date.now(),
        telefono || null,
        azienda || null,
        'cliente',
        nomerichiedente.split(' ')[0] || nomerichiedente,
        nomerichiedente.split(' ').slice(1).join(' ') || ''
      ];
      const newClientResult = await client.query(newClientQuery, newClientValues);
      clienteid = newClientResult.rows[0].id;
    }

    // Genera numero ticket
    const countResult = await client.query('SELECT COUNT(*) FROM tickets');
    const count = parseInt(countResult.rows[0].count) + 1;
    const numero = `TKT-2025-${count.toString().padStart(3, '0')}`;

    // Salva le foto se presenti
    // Nota: per quick-request non c'è req.user, quindi uploadedById sarà null
    let photosArray = [];
    if (photos && photos.length > 0) {
      photosArray = photos.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: `/uploads/tickets/photos/${file.filename}`,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: new Date().toISOString(),
        uploadedById: null // Quick request non ha autenticazione
      }));
    }

    // Crea il ticket
    const query = `
      INSERT INTO tickets (numero, clienteid, titolo, descrizione, stato, priorita, nomerichiedente, categoria, dataapertura, last_read_by_client, last_read_by_tecnico, photos) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() AT TIME ZONE 'Europe/Rome', NOW(), NOW(), $9) 
      RETURNING *;
    `;

    const values = [numero, clienteid, titolo, descrizione, 'aperto', priorita, nomerichiedente, 'assistenza', photosArray.length > 0 ? JSON.stringify(photosArray) : null];
    const result = await client.query(query, values);
    client.release();

    if (result.rows[0]) {
      const createdTicket = result.rows[0];

      // Invia email direttamente senza passare attraverso HTTP
      // 1) Email al cliente che ha inviato la richiesta
      try {
        const nodemailer = require('nodemailer');
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;

        if (emailUser && emailPass) {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: emailUser, pass: emailPass }
          });

          const mailOptions = {
            from: emailUser,
            to: email,
            subject: `Ticket creato #${createdTicket.numero} - ${createdTicket.titolo}`,
            text: `Ciao ${azienda || 'Cliente'},\n\nIl tuo ticket è stato creato con successo.\n\nNumero: ${createdTicket.numero}\nTitolo: ${createdTicket.titolo}\nDescrizione: ${createdTicket.descrizione}\nPriorità: ${createdTicket.priorita}\nStato: ${createdTicket.stato}\nData apertura: ${new Date(createdTicket.dataapertura).toLocaleDateString('it-IT')}\n\nGrazie,\nTicketApp`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 20px; text-align: center;">
                  <h1 style="margin: 0;">TicketApp</h1>
                  <p style="margin: 10px 0 0 0;">Ticket Creato con Successo</p>
                </div>
                <div style="padding: 30px; background: #f8f9fa;">
                  <h2 style="color: #333; margin-top: 0;">Ciao ${azienda || 'Cliente'}!</h2>
                  <p>Hai creato con successo un nuovo ticket di assistenza:</p>
                  <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #4caf50;">
                    <h3 style="color: #4caf50; margin-top: 0;">📋 Dettagli Ticket</h3>
                    <p><strong>Numero:</strong> ${createdTicket.numero}</p>
                    <p><strong>Titolo:</strong> ${createdTicket.titolo}</p>
                    <p><strong>Descrizione:</strong> ${createdTicket.descrizione}</p>
                    <p><strong>Priorità:</strong> ${createdTicket.priorita.toUpperCase()}</p>
                    <p><strong>Stato:</strong> ${createdTicket.stato}</p>
                    <p><strong>Data apertura:</strong> ${new Date(createdTicket.dataapertura).toLocaleDateString('it-IT')}</p>
                  </div>
                  <div style="background: #e8f5e8; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; color: #2e7d32;">
                      <strong>✅ Il tuo ticket è stato creato e aggiunto al calendario!</strong><br>
                      Il nostro team tecnico lo esaminerà al più presto.
                    </p>
                  </div>
                  ${getEmailFooter()}
                </div>
              </div>
            `
          };

          await transporter.sendMail(mailOptions);
        }
      } catch (clientEmailErr) {
        console.error('Errore invio email al richiedente:', clientEmailErr);
      }

      // 2) Email agli amministratori dell'azienda (se presenti e diversi dal cliente stesso)
      if (azienda) {
        try {
          // Trova tutti gli amministratori dell'azienda (admin_companies contiene l'azienda)
          // Usa ?| per controllare se l'array JSONB contiene il valore specificato
          const adminsResult = await pool.query(
            `SELECT id, email, nome, cognome, admin_companies 
             FROM users 
             WHERE ruolo = 'cliente' 
             AND email IS NOT NULL 
             AND admin_companies ?| $1::text[]`,
            [[azienda]]
          );

          if (adminsResult.rows.length > 0) {
            const nodemailer = require('nodemailer');
            const emailUser = process.env.EMAIL_USER;
            const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;

            if (emailUser && emailPass) {
              const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: emailUser, pass: emailPass }
              });

              for (const admin of adminsResult.rows) {
                // Evita doppio invio se l'amministratore è lo stesso cliente che ha creato il ticket
                if (admin.email === email) {
                  continue;
                }

                // Verifica che l'amministratore abbia email valida
                if (!admin.email || !admin.email.includes('@')) {
                  continue;
                }

                try {
                  const mailOptions = {
                    from: emailUser,
                    to: admin.email,
                    subject: `👑 Notifica Amministratore - Nuovo Ticket #${createdTicket.numero}`,
                    text: `Ciao ${admin.nome || 'Amministratore'},\n\nUn nuovo ticket è stato creato da ${nomerichiedente} (${email}) per l'azienda ${azienda}.\n\nNumero: ${createdTicket.numero}\nTitolo: ${createdTicket.titolo}\nDescrizione: ${createdTicket.descrizione}\nPriorità: ${createdTicket.priorita}\nStato: ${createdTicket.stato}\nData apertura: ${new Date(createdTicket.dataapertura).toLocaleDateString('it-IT')}\n\nGrazie,\nTicketApp`,
                    html: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; text-align: center;">
                          <h1 style="margin: 0;">👑 TicketApp</h1>
                          <p style="margin: 10px 0 0 0;">Notifica Amministratore</p>
                        </div>
                        <div style="padding: 30px; background: #f8f9fa;">
                          <h2 style="color: #333; margin-top: 0;">Ciao ${admin.nome || 'Amministratore'}!</h2>
                          <p>Un nuovo ticket è stato creato da <strong>${nomerichiedente}</strong> (${email}) per l'azienda <strong>${azienda}</strong>.</p>
                          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                            <h3 style="color: #f59e0b; margin-top: 0;">📋 Dettagli Ticket</h3>
                            <p><strong>Numero:</strong> ${createdTicket.numero}</p>
                            <p><strong>Titolo:</strong> ${createdTicket.titolo}</p>
                            <p><strong>Descrizione:</strong> ${createdTicket.descrizione}</p>
                            <p><strong>Priorità:</strong> ${createdTicket.priorita.toUpperCase()}</p>
                            <p><strong>Stato:</strong> ${createdTicket.stato}</p>
                            <p><strong>Data apertura:</strong> ${new Date(createdTicket.dataapertura).toLocaleDateString('it-IT')}</p>
                            <p><strong>Creato da:</strong> ${nomerichiedente} (${email})</p>
                          </div>
                          <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                            <p style="margin: 0; color: #92400e;">
                              <strong>👑 Notifica Amministratore:</strong><br>
                              Ricevi questa email perché sei amministratore dell'azienda ${azienda}.
                            </p>
                          </div>
                          ${getEmailFooter()}
                        </div>
                      </div>
                    `
                  };

                  await transporter.sendMail(mailOptions);
                } catch (adminEmailErr) {
                  console.error(`Errore invio email amministratore ${admin.email}:`, adminEmailErr);
                }
              }
            }
          }
        } catch (adminErr) {
          console.error('Errore invio email agli amministratori:', adminErr);
        }
      }

      // 3) Email ai tecnici
      try {
        const techniciansData = await pool.query('SELECT email, nome, cognome FROM users WHERE ruolo = \'tecnico\' AND email IS NOT NULL');
        const nodemailer = require('nodemailer');
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;

        if (emailUser && emailPass) {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: emailUser, pass: emailPass }
          });

          for (const technician of techniciansData.rows) {
            try {
              const mailOptions = {
                from: emailUser,
                to: technician.email,
                subject: `🎫 Nuovo Ticket #${createdTicket.numero} - ${createdTicket.titolo}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 20px; text-align: center;">
                      <h1 style="margin: 0;">🎫 TicketApp</h1>
                      <p style="margin: 10px 0 0 0;">Nuovo Ticket di Assistenza</p>
                    </div>
                    <div style="padding: 30px; background: #f8f9fa;">
                      <h2 style="color: #333; margin-top: 0;">Ciao ${technician.nome || 'Tecnico'}!</h2>
                      <p>È stato creato un nuovo ticket di assistenza:</p>
                      <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                        <h3 style="color: #3b82f6; margin-top: 0;">📋 Dettagli Ticket</h3>
                        <p><strong>Numero:</strong> ${createdTicket.numero}</p>
                        <p><strong>Titolo:</strong> ${createdTicket.titolo}</p>
                        <p><strong>Descrizione:</strong> ${createdTicket.descrizione}</p>
                        <p><strong>Priorità:</strong> ${createdTicket.priorita.toUpperCase()}</p>
                        <p><strong>Stato:</strong> ${createdTicket.stato}</p>
                        <p><strong>Data apertura:</strong> ${new Date(createdTicket.dataapertura).toLocaleDateString('it-IT')}</p>
                        <p><strong>Richiedente:</strong> ${createdTicket.nomerichiedente}</p>
                      </div>
                      <div style="background: #e0f2f7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #0288d1;">
                          <strong>🔔 Nuovo ticket da gestire!</strong><br>
                          Il ticket è stato aggiunto al calendario e richiede la tua attenzione.
                        </p>
                      </div>
                      ${getEmailFooter()}
                    </div>
                  </div>
                `
              };

              await transporter.sendMail(mailOptions);
            } catch (techEmailErr) {
              console.error('Errore invio email tecnico:', techEmailErr);
            }
          }
        }
      } catch (techErr) {
        console.error('Errore invio email ai tecnici:', techErr);
      }

      res.status(201).json({
        success: true,
        message: 'Richiesta inviata con successo',
        ticket: createdTicket
      });
    } else {
      res.status(500).json({ error: 'Errore nella creazione del ticket' });
    }
  } catch (err) {
    console.error('Errore quick request:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint pubblico: elenco clienti (id, email, azienda, nome, cognome)
// Usato per suggerimenti 'Azienda' nella Richiesta Assistenza Veloce
app.get('/clients', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      `SELECT id, email, azienda, nome, cognome
       FROM users
       WHERE ruolo = 'cliente'`
    );
    client.release();
    res.json(result.rows || []);
  } catch (err) {
    console.error('Errore nel recuperare la lista clienti:', err);
    res.status(500).json([]);
  }
});

// Endpoint pubblico per invii server-to-server (es. quick-request senza login)
// DEVE essere montato PRIMA di qualsiasi app.use('/api', authenticateToken, ...)
app.use('/api/public-email', emailNotificationsRoutes);

// Endpoint di test per verificare che il server risponda
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rotte protette con autenticazione JWT
app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/tickets', authenticateToken, ticketsRoutes);
app.use('/api/alerts', authenticateToken, alertsRoutes);
app.use('/api/keepass', authenticateToken, keepassRoutes);
app.use('/api', authenticateToken, googleCalendarRoutes);
app.use('/api', authenticateToken, googleAuthRoutes);
app.use('/api/email', authenticateToken, emailNotificationsRoutes);
app.use('/api/availability', authenticateToken, availabilityRoutes);
app.use('/api/analytics', authenticateToken, requireRole('tecnico'), analyticsRoutes);
app.use('/api/access-logs', accessLogsRoutes);
// Route Orari e Turni (per tecnico/admin e clienti con permesso progetto orari)
// Endpoint /debug accessibile senza autenticazione per diagnostica
app.use('/api/orari', authenticateToken, (req, res, next) => {
  // Permetti tecnico e admin sempre
  if (req.user && (req.user.ruolo === 'tecnico' || req.user.ruolo === 'admin')) {
    return next();
  }

  // Per clienti, verifica che abbiano il progetto "orari" abilitato nel token
  if (req.user && req.user.ruolo === 'cliente') {
    // Il token JWT dovrebbe contenere enabled_projects, ma se non c'è, verifica dal database
    let enabledProjects = req.user.enabled_projects || [];

    // Se non è nel token, prova a leggerlo dal database (fallback)
    if (!enabledProjects || enabledProjects.length === 0) {
      // Non possiamo fare query async qui, quindi se non c'è nel token, nega l'accesso
      // L'utente dovrà rifare login per aggiornare il token
      console.log(`⚠️ enabled_projects non presente nel token per ${req.user.email}`);
    }

    if (Array.isArray(enabledProjects) &&
      (enabledProjects.includes('orari') || enabledProjects.includes('turni'))) {
      console.log(`✅ Cliente ${req.user.email} ha accesso a orari/turni`);
      return next();
    }
  }

  // Accesso negato
  console.log(`❌ Accesso negato a /api/orari per ${req.user?.email} (${req.user?.ruolo})`);
  return res.status(403).json({
    error: 'Accesso negato. Non hai i permessi per accedere a Orari e Turni.'
  });
}, orariRoutes);

// Route Vivaldi (per tecnico/admin e clienti con permesso progetto vivaldi)
// ✅ FIX: Monta le route solo se vivaldiRoutes non è null per evitare crash
if (vivaldiRoutes) {
  app.use('/api/vivaldi', authenticateToken, (req, res, next) => {
    // Tecnici e admin hanno sempre accesso
    if (req.user?.ruolo === 'tecnico' || req.user?.ruolo === 'admin') {
      console.log(`✅ Accesso Vivaldi autorizzato per STAFF ${req.user.email}`);
      return next();
    }

    // Per clienti, verifica che abbiano il progetto "vivaldi" abilitato nel token
    if (req.user?.ruolo === 'cliente') {
      const enabledProjects = req.user?.enabled_projects || ['ticket'];

      if (Array.isArray(enabledProjects) && enabledProjects.includes('vivaldi')) {
        console.log(`✅ Cliente ${req.user.email} ha accesso a Vivaldi`);
        return next();
      }
    }

    // Accesso negato
    console.log(`❌ Accesso negato a /api/vivaldi per ${req.user?.email} (${req.user?.ruolo})`);
    return res.status(403).json({
      error: 'Accesso negato. Non hai i permessi per accedere a Vivaldi.'
    });
  }, vivaldiRoutes);
} else {
  // ✅ FIX: Se Vivaldi non è disponibile, restituisci 503 per tutte le richieste
  app.use('/api/vivaldi', authenticateToken, (req, res) => {
    res.status(503).json({
      error: 'Vivaldi non disponibile: DATABASE_URL_VIVALDI non configurato'
    });
  });
}

// Gestione route non trovate (404) - DEVE essere DOPO tutte le route ma PRIMA del middleware errori
app.use((req, res, next) => {
  // Solo per route API non trovate
  if (req.path.startsWith('/api/') && !res.headersSent) {
    console.log(`⚠️ Route API non trovata: ${req.method} ${req.path}`);
    return res.status(404).json({ error: 'Route non trovata', path: req.path });
  }
  // Per altre route (static files, etc.), passa al prossimo middleware
  next();
});

// Middleware di gestione errori globale (DEVE essere l'ultimo middleware con 4 parametri)
app.use((err, req, res, next) => {
  // Se la risposta è già stata inviata, passa al prossimo
  if (res.headersSent) {
    return next(err);
  }

  console.error('❌ Errore non gestito:', err);
  console.error('❌ Stack:', err.stack);
  console.error('❌ Route:', req.method, req.path);

  // Non esporre dettagli dell'errore in produzione
  const isDevelopment = process.env.NODE_ENV !== 'production';

  res.status(err.status || 500).json({
    error: err.message || 'Errore interno del server',
    ...(isDevelopment && { stack: err.stack, details: err })
  });
});

// Gestione errori non catturati - IMPORTANTE: non fare exit per evitare crash
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('❌ Reason:', reason);
  if (reason instanceof Error) {
    console.error('❌ Stack:', reason.stack);
  }
  // NON fare exit - il backend deve continuare a funzionare
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('❌ Stack:', error.stack);
  // NON fare exit - il backend deve continuare a funzionare
  // In produzione, potresti voler fare exit(1) qui, ma per ora manteniamo il server attivo
});


// Funzione per chiusura automatica ticket risolti da più di 5 giorni
const closeExpiredTickets = async () => {
  try {
    const client = await pool.connect();

    // Trova tutti i ticket risolti da più di 5 giorni (usando data_risoluzione come riferimento)
    const query = `
      UPDATE tickets 
      SET stato = 'chiuso', datachiusura = NOW()
      WHERE stato = 'risolto' 
      AND data_risoluzione IS NOT NULL
      AND data_risoluzione < NOW() - INTERVAL '5 days'
      RETURNING id, numero, titolo, data_risoluzione, clienteid;
    `;

    const result = await client.query(query);
    client.release();

    if (result.rows.length > 0) {
      console.log(`🔄 Chiusi automaticamente ${result.rows.length} ticket scaduti`);

      // Log dei ticket chiusi e invia email di notifica
      for (const ticket of result.rows) {
        console.log(`✅ Ticket ${ticket.numero} chiuso automaticamente (risolto il: ${ticket.data_risoluzione})`);

        // Invia email di notifica per ogni ticket chiuso
        try {
          // Recupera i dati del cliente
          const clientData = await pool.query('SELECT email, nome, cognome FROM users WHERE id = $1', [ticket.clienteid]);

          if (clientData.rows.length > 0 && clientData.rows[0].email) {
            const client = clientData.rows[0];

            // Invia notifica email
            const emailResponse = await fetch(`${process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`}/api/email/notify-automatic-closure`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                ticket: ticket,
                clientEmail: client.email,
                clientName: `${client.nome} ${client.cognome}`
              })
            });

            if (emailResponse.ok) {
              console.log(`✅ Email chiusura automatica inviata per ticket ${ticket.numero}`);
            } else {
              console.log(`⚠️ Errore invio email chiusura automatica per ticket ${ticket.numero}:`, emailResponse.status);
            }
          }
        } catch (emailErr) {
          console.log(`⚠️ Errore invio email chiusura automatica per ticket ${ticket.numero}:`, emailErr.message);
        }
      }
    }
  } catch (err) {
    console.error('❌ Errore chiusura automatica ticket:', err);
  }
};

// Funzione per aggiornare data_risoluzione per ticket già risolti che non ce l'hanno
const updateMissingDataRisoluzione = async () => {
  try {
    const client = await pool.connect();
    // Per i ticket già risolti che non hanno data_risoluzione, usa dataapertura come fallback
    const updateQuery = `
      UPDATE tickets 
      SET data_risoluzione = dataapertura
      WHERE stato = 'risolto' 
      AND data_risoluzione IS NULL
      AND dataapertura IS NOT NULL;
    `;
    const result = await client.query(updateQuery);
    client.release();
    if (result.rowCount > 0) {
      console.log(`✅ Aggiornata data_risoluzione per ${result.rowCount} ticket già risolti`);
    }
  } catch (err) {
    console.error('❌ Errore aggiornamento data_risoluzione:', err);
  }
};

// Avvia chiusura automatica ogni ora
setInterval(closeExpiredTickets, 60 * 60 * 1000); // Ogni ora
// Esegui anche all'avvio del server
setTimeout(() => {
  updateMissingDataRisoluzione().then(() => {
    setTimeout(closeExpiredTickets, 2000); // Dopo 2 secondi dall'aggiornamento
  });
}, 5000); // Dopo 5 secondi dall'avvio

// Endpoint per chiusura automatica ticket (senza autenticazione per cron job)
app.post('/api/tickets/close-expired', async (req, res) => {
  try {
    await closeExpiredTickets();
    res.json({
      success: true,
      message: 'Chiusura automatica ticket eseguita'
    });
  } catch (err) {
    console.error('❌ Errore chiusura automatica ticket:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// --- ENDPOINT PER INIZIALIZZARE IL DATABASE ---
app.post('/api/init-db', async (req, res) => {
  try {
    // Crea tabella alerts se non esiste
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'warning' CHECK (level IN ('warning', 'danger', 'info', 'features')),
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

    // Aggiorna il constraint CHECK per includere 'features' se la tabella esiste già
    try {
      // Rimuovi il constraint esistente (se presente)
      await pool.query(`ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_level_check`);
      // Aggiungi il nuovo constraint con 'features'
      await pool.query(`ALTER TABLE alerts ADD CONSTRAINT alerts_level_check CHECK (level IN ('warning', 'danger', 'info', 'features'))`);
      console.log("✅ Constraint CHECK aggiornato per includere 'features'");
    } catch (constraintErr) {
      console.log("⚠️ Errore aggiornamento constraint (potrebbe non essere necessario):", constraintErr.message);
    }

    // Aggiungi colonna googlecalendareventid alla tabella tickets se non esiste
    try {
      await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS googlecalendareventid TEXT`);
      console.log("✅ Colonna googlecalendareventid aggiunta alla tabella tickets");
    } catch (alterErr) {
      console.log("⚠️ Errore aggiunta colonna googlecalendareventid (potrebbe già esistere):", alterErr.message);
    }

    // Aggiungi colonna photos alla tabella tickets se non esiste (JSONB per array di foto)
    try {
      await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb`);
      console.log("✅ Colonna photos aggiunta alla tabella tickets");
    } catch (alterErr) {
      console.log("⚠️ Errore aggiunta colonna photos (potrebbe già esistere):", alterErr.message);
    }

    // Aggiungi colonna data_risoluzione alla tabella tickets se non esiste
    try {
      await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS data_risoluzione TIMESTAMP`);
      console.log("✅ Colonna data_risoluzione aggiunta alla tabella tickets");
    } catch (alterErr) {
      console.log("⚠️ Errore aggiunta colonna data_risoluzione (potrebbe già esistere):", alterErr.message);
    }

    // Aggiungi colonna admin_companies alla tabella users se non esiste
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_companies JSONB DEFAULT '[]'::jsonb`);
      console.log("✅ Colonna admin_companies aggiunta alla tabella users");
    } catch (alterErr) {
      console.log("⚠️ Errore aggiunta colonna admin_companies (potrebbe già esistere):", alterErr.message);
    }

    // Aggiungi colonna inactivity_timeout_minutes alla tabella users se non esiste
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS inactivity_timeout_minutes INTEGER DEFAULT 3`);
      console.log("✅ Colonna inactivity_timeout_minutes aggiunta alla tabella users");
    } catch (alterErr) {
      console.log("⚠️ Errore aggiunta colonna inactivity_timeout_minutes (potrebbe già esistere):", alterErr.message);
    }

    // Aggiungi colonna enabled_projects alla tabella users se non esiste (JSONB array di progetti abilitati)
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled_projects JSONB DEFAULT '["ticket"]'::jsonb`);
      console.log("✅ Colonna enabled_projects aggiunta alla tabella users");
    } catch (alterErr) {
      console.log("⚠️ Errore aggiunta colonna enabled_projects (potrebbe già esistere):", alterErr.message);
    }

    // Crea tabella unavailable_days se non esiste
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS unavailable_days (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL UNIQUE,
          reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("✅ Tabella unavailable_days creata/verificata");
    } catch (unavailableErr) {
      console.log("⚠️ Errore creazione tabella unavailable_days:", unavailableErr.message);
    }

    // Crea tabella keepass_groups se non esiste
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS keepass_groups (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          parent_id INTEGER REFERENCES keepass_groups(id) ON DELETE CASCADE,
          client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          uuid TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("✅ Tabella keepass_groups creata/verificata");

      // Aggiungi colonna client_id se non esiste (per tabelle create prima dell'aggiornamento)
      try {
        await pool.query(`
          ALTER TABLE keepass_groups 
          ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES users(id) ON DELETE CASCADE
        `);
        console.log("✅ Colonna client_id verificata/aggiunta a keepass_groups");
      } catch (alterErr) {
        console.log("⚠️ Errore aggiunta colonna client_id (potrebbe già esistere):", alterErr.message);
      }

      // Aggiungi colonna uuid se non esiste (per tabelle create prima dell'aggiornamento)
      try {
        await pool.query(`
          ALTER TABLE keepass_groups 
          ADD COLUMN IF NOT EXISTS uuid TEXT
        `);
        console.log("✅ Colonna uuid verificata/aggiunta a keepass_groups");
      } catch (alterErr) {
        console.log("⚠️ Errore aggiunta colonna uuid (potrebbe già esistere):", alterErr.message);
      }

      // Aggiungi colonna notes se non esiste (per tabelle create prima dell'aggiornamento)
      try {
        await pool.query(`
          ALTER TABLE keepass_groups 
          ADD COLUMN IF NOT EXISTS notes TEXT
        `);
        console.log("✅ Colonna notes verificata/aggiunta a keepass_groups");
      } catch (alterErr) {
        console.log("⚠️ Errore aggiunta colonna notes (potrebbe già esistere):", alterErr.message);
      }
    } catch (keepassGroupsErr) {
      console.log("⚠️ Errore creazione tabella keepass_groups:", keepassGroupsErr.message);
    }

    // Crea tabella keepass_entries se non esiste
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS keepass_entries (
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES keepass_groups(id) ON DELETE CASCADE,
          title TEXT,
          username TEXT,
          password_encrypted TEXT NOT NULL,
          url TEXT,
          notes TEXT,
          uuid TEXT,
          icon_id INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Aggiungi colonna icon_id se non esiste
      try {
        await pool.query(`ALTER TABLE keepass_entries ADD COLUMN IF NOT EXISTS icon_id INTEGER DEFAULT 0`);
      } catch (alterErr) {
        // Colonna già esistente, ignora
      }
      console.log("✅ Tabella keepass_entries creata/verificata");
    } catch (keepassEntriesErr) {
      console.log("⚠️ Errore creazione tabella keepass_entries:", keepassEntriesErr.message);
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

    // Connessione database Vivaldi
    try {
      if (poolVivaldi && vivaldiDbUrl) {
        const client = await poolVivaldi.connect();

        // Verifica che siamo nel database corretto
        const dbCheck = await client.query('SELECT current_database()');
        const currentDb = dbCheck.rows[0].current_database;
        console.log(`✅ Connessione al database Vivaldi riuscita! (Database: ${currentDb})`);

        if (currentDb !== 'vivaldi_db') {
          console.error(`❌ ERRORE: Pool Vivaldi connesso al database sbagliato: ${currentDb}`);
          console.error(`   Atteso: vivaldi_db`);
          console.error(`   Verifica DATABASE_URL_VIVALDI nel file .env`);
        }

        // Verifica che le tabelle esistano
        try {
          const testQuery = await poolVivaldi.query('SELECT COUNT(*) FROM annunci_queue');
          console.log("✅ Tabelle Vivaldi verificate");
        } catch (tableErr) {
          console.warn("⚠️ Avviso: Tabelle Vivaldi non trovate. Esegui: node scripts/init-vivaldi-db.js");
          console.warn("   Errore:", tableErr.message);
        }

        client.release();
      } else {
        console.warn("⚠️ DATABASE_URL_VIVALDI non configurato. Vivaldi non sarà disponibile.");
      }
    } catch (vivaldiErr) {
      console.warn("⚠️ Avviso: Database Vivaldi non disponibile.");
      console.warn("   Errore:", vivaldiErr.message);
      console.warn("   Assicurati che DATABASE_URL_VIVALDI sia configurato nel file .env");
      console.warn("   Il sistema continuerà a funzionare, ma Vivaldi non sarà disponibile.");
    }

    // Inizializza automaticamente il database
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS alerts (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          level TEXT NOT NULL DEFAULT 'warning' CHECK (level IN ('warning', 'danger', 'info', 'features')),
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

      // Aggiorna il constraint CHECK per includere 'features' se la tabella esiste già
      try {
        // Rimuovi il constraint esistente (se presente)
        await pool.query(`ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_level_check`);
        // Aggiungi il nuovo constraint con 'features'
        await pool.query(`ALTER TABLE alerts ADD CONSTRAINT alerts_level_check CHECK (level IN ('warning', 'danger', 'info', 'features'))`);
        console.log("✅ Constraint CHECK aggiornato per includere 'features' (auto-init)");
      } catch (constraintErr) {
        console.log("⚠️ Errore aggiornamento constraint (auto-init):", constraintErr.message);
      }
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

    // Aggiungi colonna photos alla tabella tickets se non esiste (JSONB per array di foto)
    try {
      await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb`);
      console.log("✅ Colonna photos aggiunta alla tabella tickets (auto-init)");
    } catch (alterErr) {
      console.log("⚠️ Errore aggiunta colonna photos (auto-init):", alterErr.message);
    }

    // Aggiungi colonna data_risoluzione alla tabella tickets se non esiste
    try {
      await pool.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS data_risoluzione TIMESTAMP`);
      console.log("✅ Colonna data_risoluzione aggiunta alla tabella tickets (auto-init)");
    } catch (alterErr) {
      console.log("⚠️ Errore aggiunta colonna data_risoluzione (auto-init):", alterErr.message);
    }

    // Aggiungi colonna admin_companies alla tabella users se non esiste (auto-init)
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_companies JSONB DEFAULT '[]'::jsonb`);
      console.log("✅ Colonna admin_companies aggiunta alla tabella users (auto-init)");
    } catch (alterErr) {
      console.log("⚠️ Errore aggiunta colonna admin_companies (auto-init):", alterErr.message);
    }

    // Aggiungi colonna inactivity_timeout_minutes alla tabella users se non esiste (auto-init)
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS inactivity_timeout_minutes INTEGER DEFAULT 3`);
      console.log("✅ Colonna inactivity_timeout_minutes aggiunta alla tabella users (auto-init)");
    } catch (alterErr) {
      console.log("⚠️ Errore aggiunta colonna inactivity_timeout_minutes (auto-init):", alterErr.message);
    }

    // Aggiungi colonna enabled_projects alla tabella users se non esiste (auto-init)
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled_projects JSONB DEFAULT '["ticket"]'::jsonb`);
      console.log("✅ Colonna enabled_projects aggiunta alla tabella users (auto-init)");
    } catch (alterErr) {
      console.log("⚠️ Errore aggiunta colonna enabled_projects (auto-init):", alterErr.message);
    }

    // Crea tabella unavailable_days se non esiste (auto-init)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS unavailable_days (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL UNIQUE,
          reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("✅ Tabella unavailable_days creata/verificata (auto-init)");
    } catch (unavailableErr) {
      console.log("⚠️ Errore creazione tabella unavailable_days (auto-init):", unavailableErr.message);
    }

    // Crea tabella keepass_groups se non esiste (auto-init)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS keepass_groups (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          parent_id INTEGER REFERENCES keepass_groups(id) ON DELETE CASCADE,
          client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          uuid TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("✅ Tabella keepass_groups creata/verificata (auto-init)");

      // Aggiungi colonna client_id se non esiste (per tabelle create prima dell'aggiornamento)
      try {
        await pool.query(`
          ALTER TABLE keepass_groups 
          ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES users(id) ON DELETE CASCADE
        `);
        console.log("✅ Colonna client_id verificata/aggiunta a keepass_groups (auto-init)");
      } catch (alterErr) {
        console.log("⚠️ Errore aggiunta colonna client_id (potrebbe già esistere):", alterErr.message);
      }

      // Aggiungi colonna uuid se non esiste (per tabelle create prima dell'aggiornamento)
      try {
        await pool.query(`
          ALTER TABLE keepass_groups 
          ADD COLUMN IF NOT EXISTS uuid TEXT
        `);
        console.log("✅ Colonna uuid verificata/aggiunta a keepass_groups (auto-init)");
      } catch (alterErr) {
        console.log("⚠️ Errore aggiunta colonna uuid (potrebbe già esistere):", alterErr.message);
      }

      // Aggiungi colonna notes se non esiste (per tabelle create prima dell'aggiornamento)
      try {
        await pool.query(`
          ALTER TABLE keepass_groups 
          ADD COLUMN IF NOT EXISTS notes TEXT
        `);
        console.log("✅ Colonna notes verificata/aggiunta a keepass_groups (auto-init)");
      } catch (alterErr) {
        console.log("⚠️ Errore aggiunta colonna notes (potrebbe già esistere):", alterErr.message);
      }
    } catch (keepassGroupsErr) {
      console.log("⚠️ Errore creazione tabella keepass_groups (auto-init):", keepassGroupsErr.message);
    }

    // Crea tabella keepass_entries se non esiste (auto-init)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS keepass_entries (
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES keepass_groups(id) ON DELETE CASCADE,
          title TEXT,
          username TEXT,
          password_encrypted TEXT NOT NULL,
          url TEXT,
          notes TEXT,
          uuid TEXT,
          icon_id INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Aggiungi colonna icon_id se non esiste
      try {
        await pool.query(`ALTER TABLE keepass_entries ADD COLUMN IF NOT EXISTS icon_id INTEGER DEFAULT 0`);
      } catch (alterErr) {
        // Colonna già esistente, ignora
      }
      console.log("✅ Tabella keepass_entries creata/verificata (auto-init)");
    } catch (keepassEntriesErr) {
      console.log("⚠️ Errore creazione tabella keepass_entries (auto-init):", keepassEntriesErr.message);
    }

    // Avvia Vivaldi Scheduler se il database è disponibile
    try {
      if (poolVivaldi) {
        const VivaldiScheduler = require('./cron/vivaldiScheduler');
        const vivaldiScheduler = new VivaldiScheduler(poolVivaldi);
        vivaldiScheduler.start();
        console.log("✅ Vivaldi Scheduler avviato");
      } else {
        console.warn("⚠️ Vivaldi Scheduler non avviato: poolVivaldi non disponibile");
      }
    } catch (schedulerErr) {
      console.warn("⚠️ Avviso: Vivaldi Scheduler non avviato:", schedulerErr.message);
    }

    server.listen(PORT, () => {
      console.log(`🚀 Server backend OTTIMIZZATO in ascolto sulla porta ${PORT}`);
      console.log(`📁 Routes organizzate in moduli separati`);
      console.log(`🔌 WebSocket server attivo`);
    });
  } catch (err) {
    console.error("❌ Errore critico - Impossibile connettersi al database:", err);
    process.exit(1);
  }
};

startServer();