// index.js - Crypto Project Standalone
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// --- CONFIGURAZIONE DATABASE ---
let poolConfig = {};

if (process.env.DATABASE_URL) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    const match = dbUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);

    if (match) {
      poolConfig.user = decodeURIComponent(match[1]);
      poolConfig.password = decodeURIComponent(match[2]);
      poolConfig.host = match[3];
      poolConfig.port = parseInt(match[4]);
      poolConfig.database = match[5];

      if (poolConfig.host === 'localhost' || poolConfig.host === '127.0.0.1') {
        poolConfig.ssl = false;
      } else {
        poolConfig.ssl = { rejectUnauthorized: false };
      }
    } else {
      poolConfig.connectionString = process.env.DATABASE_URL;
    }
  } catch (e) {
    console.warn('⚠️ Uso connectionString come fallback');
    poolConfig.connectionString = process.env.DATABASE_URL;
  }
} else {
  console.error('❌ DATABASE_URL non trovato!');
  process.exit(1);
}

const pool = new Pool(poolConfig);

// --- MIDDLEWARE ---
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow all for now in standalone mode or check allowedOrigins
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

// --- CONFIGURAZIONE SOCKET.IO ---
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const { JWT_SECRET } = require('./utils/jwtUtils');

// Middleware WebSocket
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Token mancante'));
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.id;
    socket.userRole = decoded.ruolo;
    next();
  } catch (err) {
    next(new Error('Autenticazione fallita'));
  }
});

io.on('connection', (socket) => {
  console.log(`✅ WebSocket connesso: ${socket.userId}`);
  socket.join('crypto:dashboard'); // Auto-join per tutti gli utenti autenticati in questo progetto
  socket.on('disconnect', () => console.log(`❌ WebSocket disconnesso: ${socket.userId}`));
});

// --- SERVICES ---
// ✅ TradingBot.js viene importato solo per esportare SYMBOL_TO_PAIR (usato da altri servizi)
// Il bot loop automatico è stato disabilitato - il bot principale ora è in cryptoRoutes.js
console.log('🤖 [INIT] Loading TradingBot utilities (SYMBOL_TO_PAIR export)...');
try {
  const TradingBot = require('./services/TradingBot');
  console.log('✅ [INIT] TradingBot utilities loaded (bot loop disabled, using cryptoRoutes.js instead)');
} catch (e) {
  console.error('❌ [INIT] TradingBot utilities error:', e.message);
}

// Start Price WebSocket
console.log('📡 [INIT] Starting Price WebSocket...');
try {
  const priceWebSocketService = require('./services/PriceWebSocketService');
  priceWebSocketService.setSocketIO(io);
  priceWebSocketService.start();
  console.log('✅ [INIT] Price WebSocket started');
} catch (e) {
  console.error('❌ [INIT] Price WebSocket error:', e.message);
}

// --- ROUTES ---
const { authenticateToken } = require('./middleware/authMiddleware');

// Auth Routes (Login, etc)
// Implementazione inline semplificata o importata
const { generateLoginResponse, verifyRefreshToken, generateToken } = require('./utils/jwtUtils');
const { verifyPassword } = require('./utils/passwordUtils');

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    client.release();

    if (result.rows.length === 0) return res.status(401).json({ error: 'Credenziali non valide' });
    const user = result.rows[0];

    // Verifica password (in chiaro come da progetto originale per ora, o hash)
    let isValid = false;
    if (user.password.startsWith('$2b$')) {
      isValid = await verifyPassword(password, user.password);
    } else {
      isValid = password === user.password;
    }

    if (isValid) {
      const loginResponse = generateLoginResponse(user);
      res.json(loginResponse);
    } else {
      res.status(401).json({ error: 'Credenziali non valide' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Refresh Token
app.post('/api/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token mancante' });
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const newToken = generateToken({ id: decoded.id, email: decoded.email, role: decoded.ruolo });
    res.json({ success: true, token: newToken });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

// Crypto Routes
const cryptoRoutes = require('./routes/cryptoRoutes');
cryptoRoutes.setSocketIO(io);
app.use('/api/crypto', cryptoRoutes); // Mount senza auth globale, gestita dentro o aggiungi authenticateToken qui se vuoi proteggere tutto

// Server
server.listen(PORT, () => {
  console.log(`🚀 Crypto Server running on port ${PORT}`);
});