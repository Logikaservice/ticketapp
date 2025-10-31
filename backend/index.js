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

// ENDPOINT: Login utente (TEMPORANEO senza JWT per debug)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('🔍 LOGIN DEBUG - Senza JWT');
  console.log('Email:', email);
  console.log('Password length:', password ? password.length : 0);
  
  try {
    const client = await pool.connect();
    
    // Prima cerca l'utente per email
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    console.log('Utenti trovati:', result.rows.length);
    
    if (result.rows.length === 0) {
      client.release();
      console.log('❌ Utente non trovato');
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    
    const user = result.rows[0];
    const storedPassword = user.password;
    console.log('Password stored length:', storedPassword ? storedPassword.length : 0);
    console.log('Password is hashed:', storedPassword && storedPassword.startsWith('$2b$'));
    
    // Verifica se la password è già hashata
    let isValidPassword = false;
    
    if (storedPassword && storedPassword.startsWith('$2b$')) {
      // Password già hashata - verifica con bcrypt
      console.log('🔐 Verifica password hashata');
      isValidPassword = await verifyPassword(password, storedPassword);
    } else {
      // Password in chiaro (sistema attuale)
      console.log('🔓 Verifica password in chiaro');
      isValidPassword = password === storedPassword;
      
      // Non migrare più le password - mantenere sempre in chiaro
      console.log('🔓 Password mantenuta in chiaro per visualizzazione');
    }
    
    client.release();
    
    if (isValidPassword) {
      // Non eliminare la password per permettere la visualizzazione nelle impostazioni
      console.log(`✅ Login riuscito per: ${email}`);
      
      // Ripristina JWT token e refresh token
      try {
        console.log('🔐 Generazione JWT per utente:', user.email);
        const loginResponse = generateLoginResponse(user);
        console.log('✅ JWT generato con successo');
        console.log('Token length:', loginResponse.token ? loginResponse.token.length : 'N/A');
        console.log('Refresh token length:', loginResponse.refreshToken ? loginResponse.refreshToken.length : 'N/A');
        res.json(loginResponse);
      } catch (jwtErr) {
        console.error('❌ Errore generazione JWT:', jwtErr);
        console.error('❌ Stack trace JWT:', jwtErr.stack);
        // Fallback senza JWT se c'è errore
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
            password: user.password
          }
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

// Importa middleware di autenticazione
const { authenticateToken, requireRole } = require('./middleware/authMiddleware');

// --- IMPORTA LE ROUTES ---
const usersRoutes = require('./routes/users')(pool);
const ticketsRoutes = require('./routes/tickets')(pool);
const alertsRoutes = require('./routes/alerts')(pool);
const googleCalendarRoutes = require('./routes/googleCalendar')(pool);
const googleAuthRoutes = require('./routes/googleAuth')(pool);
const emailNotificationsRoutes = require('./routes/emailNotifications')(pool);
const tempLoginRoutes = require('./routes/tempLogin')(pool);
const availabilityRoutes = require('./routes/availability')(pool);

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

// Endpoint pubblico per richiesta assistenza veloce (senza login)
app.post('/api/tickets/quick-request', async (req, res) => {
  console.log('🔍 DEBUG QUICK REQUEST: Endpoint chiamato');
  const { titolo, descrizione, priorita, nomerichiedente, email, telefono, azienda } = req.body;
  
  console.log('🔍 DEBUG QUICK REQUEST: Dati ricevuti:', { titolo, descrizione, priorita, nomerichiedente, email, telefono, azienda });
  
  if (!titolo || !descrizione || !email || !nomerichiedente) {
    console.log('🔍 DEBUG QUICK REQUEST: Campi obbligatori mancanti');
    return res.status(400).json({ error: 'Titolo, descrizione, email e nome sono obbligatori' });
  }
  
  try {
    console.log('🔍 DEBUG QUICK REQUEST: Connessione al database');
    const client = await pool.connect();
    
    let clienteid = null;
    
    // 1. Controlla se esiste già un cliente con la stessa azienda
    if (azienda) {
      console.log('🔍 DEBUG QUICK REQUEST: Controllo azienda esistente:', azienda);
      const existingClient = await client.query(
        'SELECT id FROM users WHERE azienda = $1 AND ruolo = \'cliente\' LIMIT 1', 
        [azienda]
      );
      
      console.log('🔍 DEBUG QUICK REQUEST: Risultato ricerca cliente:', existingClient.rows);
      
      if (existingClient.rows.length > 0) {
        // Azienda riconosciuta: usa il cliente esistente
        clienteid = existingClient.rows[0].id;
        console.log(`✅ Azienda riconosciuta: ${azienda} -> Cliente ID: ${clienteid}`);
      } else {
        // Azienda non riconosciuta: crea nuovo cliente
        console.log('🔍 DEBUG QUICK REQUEST: Creazione nuovo cliente');
        const newClientQuery = `
          INSERT INTO users (email, password, telefono, azienda, ruolo, nome, cognome) 
          VALUES ($1, $2, $3, $4, $5, $6, $7) 
          RETURNING id;
        `;
        const newClientValues = [
          email, 
          'quick_request_' + Date.now(), // Password temporanea
          telefono || null, 
          azienda, 
          'cliente', 
          nomerichiedente.split(' ')[0] || nomerichiedente, // Nome
          nomerichiedente.split(' ').slice(1).join(' ') || '' // Cognome
        ];
        
        console.log('🔍 DEBUG QUICK REQUEST: Valori nuovo cliente:', newClientValues);
        const newClientResult = await client.query(newClientQuery, newClientValues);
        clienteid = newClientResult.rows[0].id;
        console.log(`✅ Nuovo cliente creato: ${azienda} -> Cliente ID: ${clienteid}`);
      }
    } else {
      console.log('🔍 DEBUG QUICK REQUEST: Nessuna azienda specificata');
    }
    
    // Genera numero ticket
    console.log('🔍 DEBUG QUICK REQUEST: Generazione numero ticket');
    const countResult = await client.query('SELECT COUNT(*) FROM tickets');
    const count = parseInt(countResult.rows[0].count) + 1;
    const numero = `TKT-2025-${count.toString().padStart(3, '0')}`;
    console.log('🔍 DEBUG QUICK REQUEST: Numero ticket generato:', numero);
    
    // Crea il ticket
    console.log('🔍 DEBUG QUICK REQUEST: Creazione ticket');
    const query = `
      INSERT INTO tickets (numero, clienteid, titolo, descrizione, stato, priorita, nomerichiedente, categoria, dataapertura, last_read_by_client, last_read_by_tecnico) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() AT TIME ZONE 'Europe/Rome', NOW(), NOW()) 
      RETURNING *;
    `;
    
    const values = [numero, clienteid, titolo, descrizione, 'aperto', priorita, nomerichiedente, 'assistenza'];
    console.log('🔍 DEBUG QUICK REQUEST: Valori ticket:', values);
    console.log('🔍 DEBUG QUICK REQUEST: Query SQL:', query);
    const result = await client.query(query, values);
    console.log('🔍 DEBUG QUICK REQUEST: Ticket creato:', result.rows[0]);
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
            subject: `🎫 Ticket Creato #${createdTicket.numero} - ${createdTicket.titolo}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 20px; text-align: center;">
                  <h1 style="margin: 0;">🎫 TicketApp</h1>
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
                </div>
              </div>
            `
          };
          
          const info = await transporter.sendMail(mailOptions);
          console.log(`✅ Email di conferma inviata al richiedente: ${email} (${info.messageId})`);
        } else {
          console.log('⚠️ Configurazione email mancante per invio email al richiedente');
        }
      } catch (clientEmailErr) {
        console.log('⚠️ Errore invio email al richiedente:', clientEmailErr.message);
        console.error(clientEmailErr);
      }

      // 2) Email ai tecnici
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
                    </div>
                  </div>
                `
              };
              
              const info = await transporter.sendMail(mailOptions);
              console.log(`✅ Email notifica inviata al tecnico: ${technician.email} (${info.messageId})`);
            } catch (techEmailErr) {
              console.log(`⚠️ Errore invio email tecnico ${technician.email}:`, techEmailErr.message);
              console.error(techEmailErr);
            }
          }
        } else {
          console.log('⚠️ Configurazione email mancante per invio email ai tecnici');
        }
      } catch (techErr) {
        console.log('⚠️ Errore invio email ai tecnici:', techErr.message);
        console.error(techErr);
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
    console.error('🔍 DEBUG QUICK REQUEST: ERRORE:', err);
    console.error('🔍 DEBUG QUICK REQUEST: Stack trace:', err.stack);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint pubblico per invii server-to-server (es. quick-request senza login)
// DEVE essere montato PRIMA di qualsiasi app.use('/api', authenticateToken, ...)
app.use('/api/public-email', emailNotificationsRoutes);

// Rotte protette con autenticazione JWT
app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/tickets', authenticateToken, ticketsRoutes);
app.use('/api/alerts', authenticateToken, alertsRoutes);
app.use('/api', authenticateToken, googleCalendarRoutes);
app.use('/api', authenticateToken, googleAuthRoutes);
app.use('/api/email', authenticateToken, emailNotificationsRoutes);
app.use('/api/availability', authenticateToken, availabilityRoutes);

// Endpoint per chiusura automatica ticket (senza autenticazione per cron job)
app.post('/api/tickets/close-expired', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Trova tutti i ticket risolti da più di 5 giorni (usando dataapertura come riferimento)
    const query = `
      UPDATE tickets 
      SET stato = 'chiuso'
      WHERE stato = 'risolto' 
      AND dataapertura < NOW() - INTERVAL '5 days'
      RETURNING id, numero, titolo, dataapertura;
    `;
    
    const result = await client.query(query);
    client.release();
    
    console.log(`🔄 Chiusi automaticamente ${result.rows.length} ticket scaduti`);
    
    // Log dei ticket chiusi e invia email di notifica
    for (const ticket of result.rows) {
      console.log(`✅ Ticket ${ticket.numero} chiuso automaticamente (apertura: ${ticket.dataapertura})`);
      
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
    
    res.json({
      success: true,
      closedCount: result.rows.length,
      closedTickets: result.rows,
      message: `Chiusi automaticamente ${result.rows.length} ticket scaduti`
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
