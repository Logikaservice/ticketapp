// middleware/authMiddleware.js

const { verifyToken, extractTokenFromHeader } = require('../utils/jwtUtils');

/**
 * Middleware di autenticazione JWT
 * Verifica se l'utente è autenticato tramite JWT token
 */
const authenticateToken = (req, res, next) => {
  try {
    // Estrai il token dall'header Authorization
    const token = extractTokenFromHeader(req);
    
    if (!token) {
      console.log('❌ Token JWT mancante');
      return res.status(401).json({ 
        error: 'Token di autenticazione richiesto',
        code: 'MISSING_TOKEN'
      });
    }
    
    // Verifica il token
    const decoded = verifyToken(token);
    
    // Aggiungi i dati utente alla richiesta
    // Gestisci admin_companies dal token
    let adminCompanies = [];
    try {
      if (decoded.admin_companies) {
        if (Array.isArray(decoded.admin_companies)) {
          adminCompanies = decoded.admin_companies;
        } else if (typeof decoded.admin_companies === 'string') {
          adminCompanies = JSON.parse(decoded.admin_companies);
        } else {
          adminCompanies = decoded.admin_companies;
        }
        if (!Array.isArray(adminCompanies)) {
          adminCompanies = [];
        }
      }
    } catch (e) {
      console.error('Errore parsing admin_companies nel middleware:', e);
      adminCompanies = [];
    }
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      ruolo: decoded.ruolo,
      nome: decoded.nome,
      cognome: decoded.cognome,
      telefono: decoded.telefono,
      azienda: decoded.azienda,
      enabled_projects: decoded.enabled_projects || ['ticket'], // Includi progetti abilitati dal token
      admin_companies: adminCompanies // Includi aziende di cui è amministratore
    };
    
    console.log(`🔐 Utente autenticato: ${req.user.email} (${req.user.ruolo})`);
    next();
    
  } catch (error) {
    console.log(`❌ Errore autenticazione: ${error.message}`);
    return res.status(401).json({ 
      error: error.message,
      code: 'INVALID_TOKEN'
    });
  }
};

/**
 * Middleware per verificare il ruolo dell'utente
 * @param {string|Array} allowedRoles - Ruoli consentiti
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Utente non autenticato',
        code: 'NOT_AUTHENTICATED'
      });
    }
    
    const userRole = req.user.ruolo;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(userRole)) {
      console.log(`❌ Accesso negato: ${req.user.email} (${userRole}) non ha permessi per questa risorsa`);
      return res.status(403).json({ 
        error: 'Accesso negato: permessi insufficienti',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: userRole
      });
    }
    
    console.log(`✅ Accesso autorizzato: ${req.user.email} (${userRole})`);
    next();
  };
};

/**
 * Middleware per verificare se l'utente può accedere a una risorsa specifica
 * @param {string} resourceId - ID della risorsa
 * @param {string} resourceType - Tipo di risorsa (ticket, user, etc.)
 */
const requireOwnershipOrRole = (resourceId, resourceType = 'resource') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Utente non autenticato',
        code: 'NOT_AUTHENTICATED'
      });
    }
    
    const userRole = req.user.ruolo;
    const userId = req.user.id;
    
    // Admin e tecnici possono accedere a tutto
    if (userRole === 'admin' || userRole === 'tecnico') {
      console.log(`✅ Accesso admin/tecnico: ${req.user.email} (${userRole})`);
      return next();
    }
    
    // I clienti possono accedere solo alle proprie risorse
    if (userRole === 'cliente') {
      // Verifica se l'ID della risorsa corrisponde all'ID dell'utente
      if (resourceId === userId) {
        console.log(`✅ Accesso proprietario: ${req.user.email} alla propria risorsa`);
        return next();
      } else {
        console.log(`❌ Accesso negato: ${req.user.email} non può accedere alla risorsa ${resourceId}`);
        return res.status(403).json({ 
          error: 'Accesso negato: puoi accedere solo alle tue risorse',
          code: 'RESOURCE_ACCESS_DENIED'
        });
      }
    }
    
    // Ruolo non riconosciuto
    console.log(`❌ Ruolo non riconosciuto: ${userRole}`);
    return res.status(403).json({ 
      error: 'Ruolo utente non valido',
      code: 'INVALID_ROLE'
    });
  };
};

/**
 * Middleware opzionale per autenticazione
 * Non blocca la richiesta se il token è mancante o invalido
 */
const optionalAuth = (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req);
    
    if (token) {
      const decoded = verifyToken(token);
      req.user = {
        id: decoded.id,
        email: decoded.email,
        ruolo: decoded.ruolo,
        nome: decoded.nome,
        cognome: decoded.cognome
      };
      console.log(`🔐 Utente opzionalmente autenticato: ${req.user.email}`);
    } else {
      console.log('ℹ️ Nessun token fornito - accesso anonimo');
    }
    
    next();
  } catch (error) {
    console.log(`⚠️ Token invalido ma accesso consentito: ${error.message}`);
    next();
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireOwnershipOrRole,
  optionalAuth
};
