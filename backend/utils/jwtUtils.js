// utils/jwtUtils.js

const jwt = require('jsonwebtoken');

// Configurazione JWT
const JWT_SECRET = process.env.JWT_SECRET || 'ticketapp-super-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'; // 24 ore
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'; // 7 giorni

/**
 * Genera un JWT token per un utente
 * @param {Object} user - Dati utente
 * @param {string} user.id - ID utente
 * @param {string} user.email - Email utente
 * @param {string} user.ruolo - Ruolo utente
 * @param {string} user.nome - Nome utente
 * @param {string} user.cognome - Cognome utente
 * @returns {string} - JWT token
 */
const generateToken = (user) => {
  try {
    const payload = {
      id: user.id,
      email: user.email,
      ruolo: user.ruolo,
      nome: user.nome,
      cognome: user.cognome,
      iat: Math.floor(Date.now() / 1000), // Issued at
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // Expires in 24h
    };
    
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    console.log(`🔐 JWT token generato per: ${user.email} (${user.ruolo})`);
    return token;
  } catch (error) {
    console.error('❌ Errore generazione JWT token:', error);
    throw new Error('Errore generazione token');
  }
};

/**
 * Genera un refresh token per un utente
 * @param {Object} user - Dati utente
 * @returns {string} - Refresh token
 */
const generateRefreshToken = (user) => {
  try {
    const payload = {
      id: user.id,
      email: user.email,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // Expires in 7 days
    };
    
    const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
    console.log(`🔄 Refresh token generato per: ${user.email}`);
    return refreshToken;
  } catch (error) {
    console.error('❌ Errore generazione refresh token:', error);
    throw new Error('Errore generazione refresh token');
  }
};

/**
 * Verifica e decodifica un JWT token
 * @param {string} token - JWT token da verificare
 * @returns {Object} - Payload decodificato
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log(`✅ JWT token verificato per: ${decoded.email}`);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('⚠️ JWT token scaduto');
      throw new Error('Token scaduto');
    } else if (error.name === 'JsonWebTokenError') {
      console.log('⚠️ JWT token non valido');
      throw new Error('Token non valido');
    } else {
      console.error('❌ Errore verifica JWT token:', error);
      throw new Error('Errore verifica token');
    }
  }
};

/**
 * Verifica un refresh token
 * @param {string} refreshToken - Refresh token da verificare
 * @returns {Object} - Payload decodificato
 */
const verifyRefreshToken = (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      throw new Error('Token non è un refresh token');
    }
    
    console.log(`✅ Refresh token verificato per: ${decoded.email}`);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log('⚠️ Refresh token scaduto');
      throw new Error('Refresh token scaduto');
    } else if (error.name === 'JsonWebTokenError') {
      console.log('⚠️ Refresh token non valido');
      throw new Error('Refresh token non valido');
    } else {
      console.error('❌ Errore verifica refresh token:', error);
      throw new Error('Errore verifica refresh token');
    }
  }
};

/**
 * Estrae il token dall'header Authorization
 * @param {Object} req - Request object
 * @returns {string|null} - Token estratto o null
 */
const extractTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  // Formato: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};

/**
 * Genera una risposta di login completa con token
 * @param {Object} user - Dati utente
 * @returns {Object} - Risposta con token e dati utente
 */
const generateLoginResponse = (user) => {
  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);
  
  return {
    success: true,
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      ruolo: user.ruolo,
      nome: user.nome,
      cognome: user.cognome,
      telefono: user.telefono,
      azienda: user.azienda
    }
  };
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  extractTokenFromHeader,
  generateLoginResponse,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
