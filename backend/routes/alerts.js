// backend/routes/alerts.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

module.exports = function createAlertsRouter(pool) {
  const router = express.Router();

  // Configurazione multer per upload allegati
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '..', 'uploads', 'alerts');
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
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Solo file immagine sono permessi!'), false);
      }
    }
  });

  // GET /api/alerts - lista avvisi
  router.get('/', async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, title, body, level, ticket_id as "ticketId", created_at as "createdAt", created_by as "createdBy", clients, is_permanent as "isPermanent", days_to_expire as "daysToExpire", attachments FROM alerts ORDER BY created_at DESC'
      );
      
      // Parsa correttamente il campo clients (JSONB) per ogni avviso
      const parsedRows = rows.map(row => {
        let clients = [];
        try {
          if (row.clients) {
            // Se è già un array, usalo direttamente
            if (Array.isArray(row.clients)) {
              clients = row.clients;
            } 
            // Se è una stringa JSON, parsala
            else if (typeof row.clients === 'string') {
              clients = JSON.parse(row.clients);
            }
            // Se è un oggetto JSONB di PostgreSQL, può già essere un array
            else {
              clients = row.clients;
            }
            // Assicurati che sia un array
            if (!Array.isArray(clients)) {
              clients = [];
            }
          }
        } catch (e) {
          console.error('Errore parsing clients:', e);
          clients = [];
        }
        
        // Parsa anche attachments se necessario
        let attachments = [];
        try {
          if (row.attachments) {
            if (Array.isArray(row.attachments)) {
              attachments = row.attachments;
            } else if (typeof row.attachments === 'string') {
              attachments = JSON.parse(row.attachments);
            } else {
              attachments = row.attachments;
            }
            if (!Array.isArray(attachments)) {
              attachments = [];
            }
          }
        } catch (e) {
          console.error('Errore parsing attachments:', e);
          attachments = [];
        }
        
        return {
          ...row,
          clients: clients,
          attachments: attachments
        };
      });
      
      res.json(parsedRows);
    } catch (err) {
      console.error('Errore GET /alerts:', err);
      res.status(500).json({ error: 'Errore nel recupero degli avvisi' });
    }
  });

  // POST /api/alerts - crea avviso (solo tecnico)
  router.post('/', upload.array('attachments', 5), async (req, res) => {
    try {
      const { title, body, level, ticketId, createdBy, clients, isPermanent, daysToExpire, emailOption, emailCompany, emailCompanies } = req.body || {};
      if (!title || !body) return res.status(400).json({ error: 'title e body sono obbligatori' });

      // Converti isPermanent in booleano (FormData invia stringhe)
      const isPermanentBool = isPermanent === true || isPermanent === 'true' || isPermanent === '1';

      // Controllo ruolo semplice da body (in attesa di auth reale)
      // In produzione sostituire con auth token/sessione
      if (!req.headers['x-user-role'] && !req.body?.role) {
        return res.status(401).json({ error: 'Ruolo mancante' });
      }
      const role = (req.headers['x-user-role'] || req.body.role || '').toString();
      if (role !== 'tecnico') return res.status(403).json({ error: 'Solo i tecnici possono creare avvisi' });

      // Gestione allegati
      let attachments = [];
      if (req.files && req.files.length > 0) {
        attachments = req.files.map(file => ({
          filename: file.filename,
          originalName: file.originalname,
          path: `/uploads/alerts/${file.filename}`,
          size: file.size,
          mimetype: file.mimetype
        }));
      }

      // Gestione clients: può essere già una stringa JSON o un array/oggetto
      let clientsJson = '[]';
      try {
        if (clients) {
          if (typeof clients === 'string') {
            // Se è già una stringa, verifica che sia JSON valido
            JSON.parse(clients);
            clientsJson = clients;
          } else {
            // Se è un oggetto/array, stringificalo
            clientsJson = JSON.stringify(clients);
          }
        }
      } catch (e) {
        console.error('Errore parsing clients:', e);
        clientsJson = '[]';
      }

      const { rows } = await pool.query(
        'INSERT INTO alerts (title, body, level, ticket_id, created_by, clients, is_permanent, days_to_expire, attachments) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, title, body, level, ticket_id as "ticketId", created_at as "createdAt", created_by as "createdBy", clients, is_permanent as "isPermanent", days_to_expire as "daysToExpire", attachments',
        [title, body, level || 'warning', ticketId || null, createdBy || null, clientsJson, isPermanentBool, daysToExpire || 7, JSON.stringify(attachments)]
      );
      
      // Gestione invio email in base all'opzione selezionata
      if (emailOption && emailOption !== 'none') {
        try {
          const nodemailer = require('nodemailer');
          const emailUser = process.env.EMAIL_USER;
          const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;
          
          if (emailUser && emailPass) {
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: { user: emailUser, pass: emailPass }
            });

            // Determina i destinatari in base all'opzione
            let recipients = [];
            
            // Parsa i clienti selezionati (possono essere una stringa JSON o un array)
            let selectedClientsIds = [];
            try {
              if (clients) {
                let parsedClients = clients;
                if (typeof clients === 'string') {
                  parsedClients = JSON.parse(clients);
                }
                if (Array.isArray(parsedClients)) {
                  // Se è un array di ID, usalo direttamente
                  selectedClientsIds = parsedClients.map(c => typeof c === 'object' ? c.id || c : c).filter(id => id != null);
                } else if (typeof parsedClients === 'object' && parsedClients !== null) {
                  // Se è un oggetto, prova a estrarre gli ID
                  selectedClientsIds = [parsedClients.id || parsedClients].filter(id => id != null);
                }
              }
            } catch (e) {
              console.error('Errore parsing clients:', e);
              selectedClientsIds = [];
            }
            
            if (emailOption === 'all') {
              if (selectedClientsIds.length > 0) {
                // Se ci sono clienti selezionati, invia a tutti i clienti delle loro aziende
                // Prima ottieni le aziende dei clienti selezionati
                const selectedClientsResult = await pool.query(
                  'SELECT DISTINCT azienda FROM users WHERE id = ANY($1::int[]) AND azienda IS NOT NULL AND azienda != \'\'',
                  [selectedClientsIds]
                );
                const selectedCompanies = selectedClientsResult.rows.map(r => r.azienda);
                
                if (selectedCompanies.length > 0) {
                  // Invia a tutti i clienti delle aziende selezionate
                  const allClientsResult = await pool.query(
                    'SELECT email, nome, cognome, azienda, admin_companies FROM users WHERE ruolo = $1 AND azienda = ANY($2::text[]) AND email IS NOT NULL AND email != \'\'',
                    ['cliente', selectedCompanies]
                  );
                  recipients = allClientsResult.rows;
                } else {
                  // Se non ci sono aziende, invia solo ai clienti selezionati
                  const allClientsResult = await pool.query(
                    'SELECT email, nome, cognome, azienda, admin_companies FROM users WHERE id = ANY($1::int[]) AND email IS NOT NULL AND email != \'\'',
                    [selectedClientsIds]
                  );
                  recipients = allClientsResult.rows;
                }
              } else {
                // Se non ci sono clienti selezionati, invia a tutti i clienti
                const allClientsResult = await pool.query(
                  'SELECT email, nome, cognome, azienda, admin_companies FROM users WHERE ruolo = $1 AND email IS NOT NULL AND email != \'\'',
                  ['cliente']
                );
                recipients = allClientsResult.rows;
              }
            } else if (emailOption === 'admins') {
              if (selectedClientsIds.length > 0) {
                // Se ci sono clienti selezionati, invia solo agli amministratori delle loro aziende
                // Prima ottieni le aziende dei clienti selezionati
                const selectedClientsResult = await pool.query(
                  'SELECT DISTINCT azienda FROM users WHERE id = ANY($1::int[]) AND azienda IS NOT NULL AND azienda != \'\'',
                  [selectedClientsIds]
                );
                const selectedCompanies = selectedClientsResult.rows.map(r => r.azienda);
                
                if (selectedCompanies.length > 0) {
                  // Invia solo agli amministratori delle aziende selezionate
                  const adminsResult = await pool.query(
                    'SELECT email, nome, cognome, azienda, admin_companies FROM users WHERE ruolo = $1 AND azienda = ANY($2::text[]) AND admin_companies IS NOT NULL AND jsonb_array_length(admin_companies::jsonb) > 0 AND email IS NOT NULL AND email != \'\'',
                    ['cliente', selectedCompanies]
                  );
                  recipients = adminsResult.rows;
                } else {
                  // Se non ci sono aziende, invia solo agli amministratori tra i clienti selezionati
                  const adminsResult = await pool.query(
                    'SELECT email, nome, cognome, azienda, admin_companies FROM users WHERE id = ANY($1::int[]) AND admin_companies IS NOT NULL AND jsonb_array_length(admin_companies::jsonb) > 0 AND email IS NOT NULL AND email != \'\'',
                    [selectedClientsIds]
                  );
                  recipients = adminsResult.rows;
                }
              } else {
                // Se non ci sono clienti selezionati, invia a tutti gli amministratori
                const adminsResult = await pool.query(
                  'SELECT email, nome, cognome, azienda, admin_companies FROM users WHERE ruolo = $1 AND admin_companies IS NOT NULL AND jsonb_array_length(admin_companies::jsonb) > 0 AND email IS NOT NULL AND email != \'\'',
                  ['cliente']
                );
                recipients = adminsResult.rows;
              }
            } else if (emailOption === 'company') {
              // Gestisci array di aziende (nuovo formato) o singola azienda (formato legacy)
              let companiesToSend = [];
              
              if (emailCompanies) {
                // Nuovo formato: array di aziende
                try {
                  const parsedCompanies = typeof emailCompanies === 'string' 
                    ? JSON.parse(emailCompanies) 
                    : emailCompanies;
                  if (Array.isArray(parsedCompanies) && parsedCompanies.length > 0) {
                    companiesToSend = parsedCompanies;
                  }
                } catch (e) {
                  console.error('Errore parsing emailCompanies:', e);
                }
              } else if (emailCompany) {
                // Formato legacy: singola azienda
                companiesToSend = [emailCompany];
              }
              
              if (companiesToSend.length > 0) {
                // Invia a tutti i clienti delle aziende specificate
                const placeholders = companiesToSend.map((_, index) => `$${index + 2}`).join(', ');
                const companyClientsResult = await pool.query(
                  `SELECT email, nome, cognome, azienda, admin_companies FROM users WHERE ruolo = $1 AND azienda IN (${placeholders}) AND email IS NOT NULL AND email != ''`,
                  ['cliente', ...companiesToSend]
                );
                recipients = companyClientsResult.rows;
              }
            }

            // Invia email a tutti i destinatari
            const frontendUrl = process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com';
            const levelColors = {
              'info': '#3b82f6',
              'warning': '#f59e0b',
              'danger': '#ef4444',
              'features': '#10b981'
            };
            const levelLabels = {
              'info': 'Informazione',
              'warning': 'Avviso',
              'danger': 'Critico',
              'features': 'Nuove funzionalità'
            };
            const color = levelColors[level] || levelColors['warning'];
            const label = levelLabels[level] || levelLabels['warning'];

            for (const recipient of recipients) {
              if (!recipient.email || !recipient.email.includes('@')) continue;
              
              try {
                const mailOptions = {
                  from: emailUser,
                  to: recipient.email,
                  subject: `[${label}] ${title}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                      <div style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); padding: 20px; border-radius: 8px 8px 0 0; color: white;">
                        <h1 style="margin: 0; font-size: 24px;">${title}</h1>
                        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">${label}</p>
                      </div>
                      <div style="background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                        <div style="white-space: pre-wrap; line-height: 1.6; color: #374151;">${body}</div>
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                          <a href="${frontendUrl}" style="display: inline-block; padding: 12px 24px; background: ${color}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Accedi al sistema TicketApp</a>
                        </div>
                        <p style="margin-top: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                          Questa email è stata inviata automaticamente dal sistema TicketApp
                        </p>
                      </div>
                    </div>
                  `
                };
                
                await transporter.sendMail(mailOptions);
                console.log(`📧 Email inviata a ${recipient.email} per avviso "${title}"`);
              } catch (emailErr) {
                console.error(`❌ Errore invio email a ${recipient.email}:`, emailErr);
              }
            }
            
            console.log(`📧 Invio email completato per avviso "${title}" - ${recipients.length} destinatari`);
          }
        } catch (emailErr) {
          console.error('❌ Errore gestione invio email avviso:', emailErr);
          // Non bloccare la creazione dell'avviso se l'invio email fallisce
        }
      }
      
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Errore POST /alerts:', err);
      // Fornisci un messaggio di errore più dettagliato per aiutare il debug
      const errorMessage = err.message || 'Errore interno del server';
      res.status(500).json({ 
        error: 'Errore nella creazione dell\'avviso',
        details: errorMessage
      });
    }
  });

  // PUT /api/alerts/:id - modifica avviso (solo tecnico)
  router.put('/:id', upload.array('attachments', 5), async (req, res) => {
    try {
      const { id } = req.params;
      const { title, body, level, ticketId, createdBy, clients, isPermanent, daysToExpire, existingAttachments } = req.body || {};
      
      if (!id) return res.status(400).json({ error: 'ID mancante' });
      if (!title || !body) return res.status(400).json({ error: 'title e body sono obbligatori' });

      // Converti isPermanent in booleano (FormData invia stringhe)
      const isPermanentBool = isPermanent === true || isPermanent === 'true' || isPermanent === '1';

      const role = (req.headers['x-user-role'] || req.body?.role || '').toString();
      if (role !== 'tecnico') return res.status(403).json({ error: 'Solo i tecnici possono modificare avvisi' });

      // Gestione allegati esistenti e nuovi
      let attachments = [];
      try {
        attachments = existingAttachments ? JSON.parse(existingAttachments) : [];
      } catch (e) {
        attachments = [];
      }

      // Aggiungi nuovi allegati
      if (req.files && req.files.length > 0) {
        const newAttachments = req.files.map(file => ({
          filename: file.filename,
          originalName: file.originalname,
          path: `/uploads/alerts/${file.filename}`,
          size: file.size,
          mimetype: file.mimetype
        }));
        attachments = [...attachments, ...newAttachments];
      }

      const { rows } = await pool.query(
        'UPDATE alerts SET title = $1, body = $2, level = $3, ticket_id = $4, created_by = $5, clients = $6, is_permanent = $7, days_to_expire = $8, attachments = $9 WHERE id = $10 RETURNING id, title, body, level, ticket_id as "ticketId", created_at as "createdAt", created_by as "createdBy", clients, is_permanent as "isPermanent", days_to_expire as "daysToExpire", attachments',
        [title, body, level || 'warning', ticketId || null, createdBy || null, JSON.stringify(clients || []), isPermanentBool, daysToExpire || 7, JSON.stringify(attachments), id]
      );
      
      if (rows.length === 0) return res.status(404).json({ error: 'Avviso non trovato' });
      res.json(rows[0]);
    } catch (err) {
      console.error('Errore PUT /alerts/:id:', err);
      res.status(500).json({ error: 'Errore nella modifica dell\'avviso' });
    }
  });

  // DELETE /api/alerts/:id - elimina avviso (solo tecnico)
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'ID mancante' });

      const role = (req.headers['x-user-role'] || req.body?.role || '').toString();
      if (role !== 'tecnico') return res.status(403).json({ error: 'Solo i tecnici possono eliminare avvisi' });

      await pool.query('DELETE FROM alerts WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Errore DELETE /alerts/:id:', err);
      res.status(500).json({ error: 'Errore nell\'eliminazione dell\'avviso' });
    }
  });

  return router;
};


