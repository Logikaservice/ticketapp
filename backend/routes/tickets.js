// routes/tickets.js

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

module.exports = (pool, uploadTicketPhotos) => {
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
  
  // ENDPOINT: Prende tutti i ticket
  router.get('/', async (req, res) => {
    try {
      const client = await pool.connect();
      // JOIN con users per includere l'azienda del cliente
      const result = await client.query(`
        SELECT 
          t.*,
          u.azienda as cliente_azienda
        FROM tickets t
        LEFT JOIN users u ON t.clienteid = u.id
        ORDER BY t.dataapertura DESC
      `);
      
      // Parse dei campi JSON
      const tickets = result.rows.map(ticket => {
        let photos = [];
        try {
          if (ticket.photos) {
            photos = typeof ticket.photos === 'string' ? JSON.parse(ticket.photos) : ticket.photos;
            if (!Array.isArray(photos)) photos = [];
          }
        } catch (e) {
          photos = [];
        }
        
        return {
          ...ticket,
          timelogs: ticket.timelogs ? (typeof ticket.timelogs === 'string' ? JSON.parse(ticket.timelogs) : ticket.timelogs) : null,
          messaggi: ticket.messaggi ? (typeof ticket.messaggi === 'string' ? JSON.parse(ticket.messaggi) : ticket.messaggi) : [],
          photos: photos
        };
      });
      
      client.release();
      res.json(tickets);
    } catch (err) {
      console.error('Errore nel prendere i ticket:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Crea un nuovo ticket (gestisce sia JSON che multipart/form-data)
  router.post('/', uploadTicketPhotos.array('photos', 10), async (req, res) => {
    // Gestisce sia JSON che multipart/form-data
    let clienteid = req.body.clienteid;
    let titolo = req.body.titolo;
    let descrizione = req.body.descrizione;
    let stato = req.body.stato;
    let priorita = req.body.priorita;
    let nomerichiedente = req.body.nomerichiedente;
    let categoria = req.body.categoria;
    let dataapertura = req.body.dataapertura;
    let sendEmail = req.body.sendEmail;
    const photos = req.files || [];
    
    // Se clienteid è una stringa, convertila a numero
    if (clienteid && typeof clienteid === 'string') {
      clienteid = parseInt(clienteid);
      if (isNaN(clienteid)) clienteid = null;
    }
    
    // Conversione esplicita di sendEmail a boolean
    if (sendEmail === 'false' || sendEmail === '0') {
      sendEmail = false;
    } else if (sendEmail === 'true' || sendEmail === '1') {
      sendEmail = true;
    }
    
    console.log('🔍 DEBUG BACKEND: sendEmail =', sendEmail, 'tipo:', typeof sendEmail);
    console.log('🔍 DEBUG BACKEND: dataapertura =', dataapertura, 'tipo:', typeof dataapertura);
    console.log('🔍 DEBUG BACKEND: Body completo =', JSON.stringify(req.body, null, 2));
    
    try {
      const client = await pool.connect();
      
      // Genera ID semplice e pulito
      let numero;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (!isUnique && attempts < maxAttempts) {
        // Genera numero semplice: anno + numero sequenziale
        const year = new Date().getFullYear();
        const randomNum = Math.floor(Math.random() * 999) + 1; // 1-999
        numero = `TKT-${year}-${randomNum}`;
        
        // Verifica se l'ID esiste già
        const checkQuery = 'SELECT id FROM tickets WHERE numero = $1';
        const checkResult = await client.query(checkQuery, [numero]);
        
        if (checkResult.rows.length === 0) {
          isUnique = true;
        } else {
          attempts++;
          console.log(`⚠️ ID duplicato ${numero}, tentativo ${attempts + 1}`);
        }
      }
      
      if (!isUnique) {
        client.release();
        throw new Error('Impossibile generare ID unico dopo 10 tentativi');
      }
      
      console.log(`✅ ID ticket generato: ${numero}`);
      
      // Gestisci dataapertura: valida e usa se fornita, altrimenti usa data corrente
      let dataAperturaValue;
      if (dataapertura && typeof dataapertura === 'string' && dataapertura.trim() !== '') {
        // Valida formato YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dataapertura)) {
          dataAperturaValue = dataapertura + 'T00:00:00+02:00'; // Aggiungi orario e timezone
          console.log('🔍 DEBUG BACKEND: Usando dataapertura personalizzata:', dataAperturaValue);
        } else {
          dataAperturaValue = new Date().toISOString();
          console.log('🔍 DEBUG BACKEND: dataapertura non valida, usando data corrente:', dataAperturaValue);
        }
      } else {
        dataAperturaValue = new Date().toISOString();
        console.log('🔍 DEBUG BACKEND: Nessuna dataapertura fornita, usando data corrente:', dataAperturaValue);
      }
      
      // Salva le foto se presenti
      let photosArray = [];
      if (photos && photos.length > 0) {
        photosArray = photos.map(file => ({
          filename: file.filename,
          originalName: file.originalname,
          path: `/uploads/tickets/photos/${file.filename}`,
          size: file.size,
          mimetype: file.mimetype,
          uploadedAt: new Date().toISOString()
        }));
      }
      
      const query = `
        INSERT INTO tickets (numero, clienteid, titolo, descrizione, stato, priorita, nomerichiedente, categoria, dataapertura, last_read_by_client, last_read_by_tecnico, photos) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), $10) 
        RETURNING *;
      `;
      const values = [numero, clienteid, titolo, descrizione, stato, priorita, nomerichiedente, categoria || 'assistenza', dataAperturaValue, photosArray.length > 0 ? JSON.stringify(photosArray) : null];
      const result = await client.query(query, values);
      client.release();
      
      // Invia notifica email al cliente (solo se sendEmail è true o undefined)
      console.log('🔍 DEBUG BACKEND: Controllo invio email - sendEmail =', sendEmail, 'tipo:', typeof sendEmail, 'result.rows[0] =', !!result.rows[0]);
      console.log('🔍 DEBUG BACKEND: Condizione sendEmail !== false =', sendEmail !== false);
      console.log('🔍 DEBUG BACKEND: sendEmail === false =', sendEmail === false);
      console.log('🔍 DEBUG BACKEND: sendEmail === true =', sendEmail === true);
      
      // Controllo più rigoroso: invia email solo se sendEmail è esplicitamente true
      // Se sendEmail è undefined (comportamento legacy), invia email per compatibilità
      if (result.rows[0] && (sendEmail === true || sendEmail === undefined)) {
        try {
          console.log('📧 === INVIO NOTIFICA EMAIL CLIENTE ===');
          console.log('📧 Ticket creato:', result.rows[0].id, result.rows[0].titolo);
          console.log('📧 Cliente ID:', clienteid);
          console.log('📧 SendEmail:', sendEmail);
          
          // Ottieni i dati del cliente
          const clientData = await pool.query('SELECT email, nome, cognome FROM users WHERE id = $1', [clienteid]);
          console.log('📧 Dati cliente trovati:', clientData.rows.length > 0);
          
          if (clientData.rows.length > 0 && clientData.rows[0].email) {
            const client = clientData.rows[0];
            console.log('📧 Email cliente:', client.email);
            console.log('📧 Nome cliente:', client.nome, client.cognome);
            
            // Determina il tipo di notifica
            const isSelfCreated = req.body.createdBy === 'cliente' || req.body.selfCreated;
            const emailType = isSelfCreated ? 'notify-ticket-created' : 'notify-ticket-assigned';
            console.log('📧 Tipo notifica:', emailType, '(isSelfCreated:', isSelfCreated, ')');
            
            // Invia email di notifica
            const emailUrl = `${process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`}/api/email/${emailType}`;
            console.log('📧 URL email:', emailUrl);
            console.log('📧 API_URL configurato:', process.env.API_URL ? 'SÌ' : 'NO');
            
            // Estrai il token JWT dall'header della richiesta originale
            const authHeader = req.headers.authorization;
            
            const emailResponse = await fetch(emailUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
              },
              body: JSON.stringify({
                ticket: result.rows[0],
                clientEmail: client.email,
                clientName: `${client.nome} ${client.cognome}`,
                clientAzienda: client.azienda,
                isSelfCreated: isSelfCreated
              })
            });
            
            if (emailResponse.ok) {
              const responseData = await emailResponse.json();
              console.log(`✅ Email notifica inviata al cliente: ${client.email} (${emailType})`);
              console.log('📧 Risposta email:', responseData);
            } else {
              const errorText = await emailResponse.text();
              console.log(`❌ Errore invio email al cliente: ${client.email}`);
              console.log('📧 Status:', emailResponse.status);
              console.log('📧 Errore:', errorText);
            }
          }
        } catch (emailErr) {
          console.log('⚠️ Errore invio email notifica:', emailErr.message);
        }
      } else if (result.rows[0] && sendEmail === false) {
        console.log('🔍 DEBUG BACKEND: Email notifica NON inviata al cliente (sendEmail = false)');
      } else {
        console.log('🔍 DEBUG BACKEND: Email non inviata per altri motivi - sendEmail =', sendEmail, 'tipo:', typeof sendEmail, 'result.rows[0] =', !!result.rows[0]);
        console.log('🔍 DEBUG BACKEND: Condizione finale - sendEmail === true =', sendEmail === true, 'sendEmail === undefined =', sendEmail === undefined);
      }
      
      // Invia notifica email ai tecnici (solo se sendEmail è true o undefined)
      if (sendEmail === true || sendEmail === undefined) {
        try {
          console.log('📧 === INVIO NOTIFICA EMAIL TECNICI ===');
          const techniciansData = await pool.query('SELECT email, nome, cognome FROM users WHERE ruolo = \'tecnico\' AND email IS NOT NULL');
          console.log('📧 Tecnici trovati:', techniciansData.rows.length);
        
        for (const technician of techniciansData.rows) {
          try {
            console.log('📧 Invio email a tecnico:', technician.email);
            const techEmailUrl = `${process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`}/api/email/notify-technician-new-ticket`;
            console.log('📧 URL tecnico:', techEmailUrl);
            
            // Estrai il token JWT dall'header della richiesta originale
            const authHeader = req.headers.authorization;
            
            const technicianEmailResponse = await fetch(techEmailUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
              },
              body: JSON.stringify({
                ticket: result.rows[0],
                technicianEmail: technician.email,
                technicianName: `${technician.nome} ${technician.cognome}`
              })
            });
            
            if (technicianEmailResponse.ok) {
              const responseData = await technicianEmailResponse.json();
              console.log(`✅ Email notifica inviata al tecnico: ${technician.email}`);
              console.log('📧 Risposta tecnico:', responseData);
            } else {
              const errorText = await technicianEmailResponse.text();
              console.log(`❌ Errore invio email al tecnico: ${technician.email}`);
              console.log('📧 Status tecnico:', technicianEmailResponse.status);
              console.log('📧 Errore tecnico:', errorText);
            }
          } catch (techEmailErr) {
            console.log(`⚠️ Errore invio email tecnico ${technician.email}:`, techEmailErr.message);
          }
        }
      } catch (techErr) {
        console.log('⚠️ Errore invio email ai tecnici:', techErr.message);
      }
      } else {
        console.log('🔍 DEBUG BACKEND: Email notifica NON inviata ai tecnici (sendEmail = false)');
      }
      
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Errore nella creazione del ticket:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Modifica un ticket completo
  router.put('/:id', async (req, res) => {
    const { id } = req.params;
    let { titolo, descrizione, categoria, priorita, nomerichiedente, clienteid, dataapertura, sendEmail } = req.body;
    
    // Log di debug per la data di apertura
    console.log('🔍 DEBUG BACKEND UPDATE: dataapertura ricevuta =', dataapertura, 'tipo:', typeof dataapertura);
    console.log('🔍 DEBUG BACKEND UPDATE: body completo =', JSON.stringify(req.body, null, 2));
    
    // Conversione esplicita di sendEmail a boolean
    if (sendEmail === 'false' || sendEmail === '0') {
      sendEmail = false;
    } else if (sendEmail === 'true' || sendEmail === '1') {
      sendEmail = true;
    }
    
    try {
      const client = await pool.connect();
      const query = `
        UPDATE tickets 
        SET titolo = $1, descrizione = $2, categoria = $3, priorita = $4, nomerichiedente = $5, clienteid = $6, dataapertura = $7
        WHERE id = $8 
        RETURNING *;
      `;
      const values = [titolo, descrizione, categoria, priorita, nomerichiedente, clienteid, dataapertura, id];
      const result = await client.query(query, values);
      client.release();

      if (result.rows.length > 0) {
        console.log(`✅ Ticket aggiornato: ID ${id}`);
        console.log('🔍 DEBUG BACKEND UPDATE: dataapertura salvata nel DB =', result.rows[0].dataapertura);
        
        // Invia notifica email per aggiornamento ticket (solo se sendEmail è true o undefined)
        console.log('🔍 DEBUG BACKEND UPDATE: sendEmail =', sendEmail, 'tipo:', typeof sendEmail);
        console.log('🔍 DEBUG BACKEND UPDATE: sendEmail === true =', sendEmail === true, 'sendEmail === undefined =', sendEmail === undefined);
        
        if (sendEmail === true || sendEmail === undefined) {
          try {
            const clientData = await pool.query('SELECT email, nome, cognome FROM users WHERE id = $1', [result.rows[0].clienteid]);
            
            if (clientData.rows.length > 0 && clientData.rows[0].email) {
            const client = clientData.rows[0];
            
            // Estrai il token JWT dall'header della richiesta originale
            const authHeader = req.headers.authorization;
            
            const emailResponse = await fetch(`${process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`}/api/email/notify-ticket-updated`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
              },
              body: JSON.stringify({
                ticket: result.rows[0],
                clientEmail: client.email,
                clientName: `${client.nome} ${client.cognome}`,
                clientAzienda: client.azienda,
                changes: 'Ticket aggiornato'
              })
            });
            
            if (emailResponse.ok) {
              console.log(`✅ Email aggiornamento inviata al cliente: ${client.email}`);
            }
          }
          } catch (emailErr) {
            console.log('⚠️ Errore invio email aggiornamento:', emailErr.message);
          }
        } else {
          console.log('🔍 DEBUG BACKEND UPDATE: Email aggiornamento NON inviata al cliente (sendEmail =', sendEmail, 'tipo:', typeof sendEmail, ')');
        }
        
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error('❌ Errore nell\'aggiornamento del ticket:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Aggiorna lo stato di un ticket
  router.patch('/:id/status', async (req, res) => {
    const { id } = req.params;
    let { status, sendEmail } = req.body;
    
    // Conversione esplicita di sendEmail a boolean
    if (sendEmail === 'false' || sendEmail === '0') {
      sendEmail = false;
    } else if (sendEmail === 'true' || sendEmail === '1') {
      sendEmail = true;
    }
    
    console.log('🔍 DEBUG BACKEND STATUS: sendEmail =', sendEmail, 'tipo:', typeof sendEmail);
    console.log('🔍 DEBUG BACKEND STATUS: req.body completo =', JSON.stringify(req.body));
    console.log('🔍 DEBUG BACKEND STATUS: sendEmail === false =', sendEmail === false);
    try {
      const client = await pool.connect();
      
      // Ottieni il ticket corrente per confrontare lo stato
      const currentTicketQuery = 'SELECT * FROM tickets WHERE id = $1';
      const currentTicketResult = await client.query(currentTicketQuery, [id]);
      
      if (currentTicketResult.rows.length === 0) {
        client.release();
        return res.status(404).json({ error: 'Ticket non trovato' });
      }
      
      const currentTicket = currentTicketResult.rows[0];
      const oldStatus = currentTicket.stato;
      
      // Aggiorna lo stato (per ora senza tracciare data_risoluzione)
      const query = 'UPDATE tickets SET stato = $1 WHERE id = $2 RETURNING *;';
      const result = await client.query(query, [status, id]);
      client.release();

      if (result.rows.length > 0) {
        const updatedTicket = result.rows[0];
        
        // Invia notifica email per le azioni specifiche (solo se sendEmail è true o undefined)
        console.log('🔍 DEBUG BACKEND STATUS: Controllo invio email - sendEmail =', sendEmail, 'tipo:', typeof sendEmail);
        console.log('🔍 DEBUG BACKEND STATUS: Condizione sendEmail === true =', sendEmail === true, 'sendEmail === undefined =', sendEmail === undefined);
        
        if (oldStatus !== status && (sendEmail === true || sendEmail === undefined)) {
          try {
            // Ottieni i dati del cliente (con azienda)
            const clientData = await pool.query('SELECT email, nome, cognome, azienda FROM users WHERE id = $1', [updatedTicket.clienteid]);
            
            if (clientData.rows.length > 0 && clientData.rows[0].email) {
              const client = clientData.rows[0];
              
              // Funzione helper per inviare email agli amministratori dell'azienda
              const sendEmailToAdmins = async (ticket, clientAzienda, clientEmail, subjectPrefix, statusDescription) => {
                if (!clientAzienda) return;
                
                try {
                  // Trova tutti gli amministratori dell'azienda
                  const adminsResult = await pool.query(
                    `SELECT id, email, nome, cognome 
                     FROM users 
                     WHERE ruolo = 'cliente' 
                     AND email IS NOT NULL 
                     AND email != $1
                     AND admin_companies ?| $2::text[]`,
                    [clientEmail, [clientAzienda]]
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
                        if (!admin.email || !admin.email.includes('@')) continue;
                        
                        try {
                          const mailOptions = {
                            from: emailUser,
                            to: admin.email,
                            subject: `👑 ${subjectPrefix} Ticket #${ticket.numero}`,
                            text: `Ciao ${admin.nome || 'Amministratore'},\n\nIl ticket #${ticket.numero} (${ticket.titolo}) per l'azienda ${clientAzienda} è stato ${statusDescription}.\n\nNumero: ${ticket.numero}\nTitolo: ${ticket.titolo}\nStato: ${ticket.stato}\nCliente: ${client.nome} ${client.cognome} (${client.email})\n\nGrazie,\nTicketApp`,
                            html: `
                              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; text-align: center;">
                                  <h1 style="margin: 0;">👑 TicketApp</h1>
                                  <p style="margin: 10px 0 0 0;">Notifica Amministratore</p>
                                </div>
                                <div style="padding: 30px; background: #f8f9fa;">
                                  <h2 style="color: #333; margin-top: 0;">Ciao ${admin.nome || 'Amministratore'}!</h2>
                                  <p>Il ticket #${ticket.numero} (<strong>${ticket.titolo}</strong>) per l'azienda <strong>${clientAzienda}</strong> è stato <strong>${statusDescription}</strong>.</p>
                                  <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                                    <h3 style="color: #f59e0b; margin-top: 0;">📋 Dettagli Ticket</h3>
                                    <p><strong>Numero:</strong> ${ticket.numero}</p>
                                    <p><strong>Titolo:</strong> ${ticket.titolo}</p>
                                    <p><strong>Stato:</strong> ${ticket.stato}</p>
                                    <p><strong>Cliente:</strong> ${client.nome} ${client.cognome} (${client.email})</p>
                                  </div>
                                  <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                                    <p style="margin: 0; color: #92400e;">
                                      <strong>👑 Notifica Amministratore:</strong><br>
                                      Ricevi questa email perché sei amministratore dell'azienda ${clientAzienda}.
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
              };
              const authHeader = req.headers.authorization;
              
              // Determina quale notifica inviare basandosi sul ruolo di chi fa l'azione
              const userRole = req.user?.ruolo; // Dal JWT token
              
              if (oldStatus === 'aperto' && status === 'in_lavorazione') {
                // Tecnico prende in carico → Notifica SOLO amministratori (NON il cliente)
                console.log(`📧 Invio notifica amministratori per cambio stato: ${oldStatus} → ${status}`);
                
                // Notifica amministratori quando tecnico prende in carico
                await sendEmailToAdmins(updatedTicket, client.azienda, client.email, 'Ticket preso in carico', 'preso in carico dal tecnico');
                
              } else if (oldStatus === 'in_lavorazione' && status === 'risolto') {
                // Tecnico risolve → Notifica SOLO amministratori (NON il cliente)
                console.log(`📧 Invio notifica amministratori per cambio stato: ${oldStatus} → ${status}`);
                
                // Notifica amministratori quando tecnico risolve
                await sendEmailToAdmins(updatedTicket, client.azienda, client.email, 'Ticket risolto', 'risolto dal tecnico');
                
              } else if (oldStatus === 'risolto' && status === 'chiuso') {
                // Chiusura ticket - dipende da chi chiude
                if (userRole === 'cliente') {
                  // Cliente chiude → Notifica tecnico
                  console.log(`📧 Cliente ha chiuso il ticket - Notifica tecnico`);
                  
                  const emailResponse = await fetch(`${process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`}/api/email/notify-technician-acceptance`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(authHeader ? { 'Authorization': authHeader } : {})
                    },
                    body: JSON.stringify({
                      ticket: updatedTicket,
                      clientEmail: client.email,
                      clientName: `${client.nome} ${client.cognome}`
                    })
                  });
                  
                  if (emailResponse.ok) {
                    console.log(`✅ Email accettazione inviata al tecnico`);
                  } else {
                    console.log(`⚠️ Errore invio email accettazione:`, emailResponse.status);
                  }
                  
                } else if (userRole === 'tecnico') {
                  // Tecnico chiude → Notifica SOLO amministratori (NON il cliente)
                  console.log(`📧 Tecnico ha chiuso il ticket - Notifica amministratori`);
                  
                  // Notifica amministratori quando tecnico chiude
                  await sendEmailToAdmins(updatedTicket, client.azienda, client.email, 'Ticket chiuso', 'chiuso dal tecnico');
                }
              }
            }
          } catch (emailErr) {
            console.log('⚠️ Errore invio notifica email:', emailErr.message);
          }
        } else if (oldStatus !== status && sendEmail === false) {
          console.log('🔍 DEBUG BACKEND STATUS: Email notifica NON inviata per cambio stato (sendEmail = false)');
        } else {
          console.log('🔍 DEBUG BACKEND STATUS: Email non inviata per altri motivi - oldStatus =', oldStatus, 'status =', status, 'sendEmail =', sendEmail);
        }
        
        res.json(updatedTicket);
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error(`Errore nell'aggiornare il ticket ${id}`, err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Chiude automaticamente i ticket risolti da più di 5 giorni
  router.post('/close-expired', async (req, res) => {
    try {
      const client = await pool.connect();
      
      // Trova tutti i ticket risolti da più di 5 giorni
      const query = `
        UPDATE tickets 
        SET stato = 'chiuso', data_chiusura_automatica = NOW()
        WHERE stato = 'risolto' 
        AND data_risoluzione IS NOT NULL 
        AND data_risoluzione < NOW() - INTERVAL '5 days'
        RETURNING id, numero, titolo, data_risoluzione;
      `;
      
      const result = await client.query(query);
      client.release();
      
      console.log(`🔄 Chiusi automaticamente ${result.rows.length} ticket scaduti`);
      
      // Log dei ticket chiusi
      result.rows.forEach(ticket => {
        console.log(`✅ Ticket ${ticket.numero} chiuso automaticamente (risolto il ${ticket.data_risoluzione})`);
      });
      
      res.json({
        success: true,
        closedCount: result.rows.length,
        closedTickets: result.rows
      });
      
    } catch (err) {
      console.error('❌ Errore chiusura automatica ticket:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Aggiungi un messaggio a un ticket
  router.post('/:id/messages', async (req, res) => {
    const { id } = req.params;
    const { autore, contenuto, reclamo } = req.body;
    
    try {
      const client = await pool.connect();
      const ticketResult = await client.query('SELECT messaggi FROM tickets WHERE id = $1', [id]);
      
      if (ticketResult.rows.length === 0) {
        client.release();
        return res.status(404).json({ error: 'Ticket non trovato' });
      }
      
      let messaggi = ticketResult.rows[0].messaggi || [];
      const newMessage = {
        id: messaggi.length + 1,
        autore,
        contenuto,
        data: new Date().toISOString(),
        reclamo: reclamo || false
      };
      messaggi.push(newMessage);
      
      await client.query('UPDATE tickets SET messaggi = $1 WHERE id = $2', [JSON.stringify(messaggi), id]);
      client.release();
      
      res.status(201).json(newMessage);
    } catch (err) {
      console.error('Errore nel salvare il messaggio:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Marca i messaggi come letti
  router.patch('/:id/mark-read', async (req, res) => {
    const { id } = req.params;
    const { ruolo } = req.body;
    
    try {
      const client = await pool.connect();
      const column = ruolo === 'cliente' ? 'last_read_by_client' : 'last_read_by_tecnico';
      const query = `UPDATE tickets SET ${column} = NOW() WHERE id = $1 RETURNING *;`;
      const result = await client.query(query, [id]);
      client.release();
      
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error('Errore nel marcare come letto:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Salva i timelogs in un ticket
  router.post('/:id/timelogs', async (req, res) => {
    const { id } = req.params;
    const { timeLogs } = req.body;
    
    try {
      const client = await pool.connect();
      const query = 'UPDATE tickets SET timelogs = $1 WHERE id = $2 RETURNING *;';
      const result = await client.query(query, [JSON.stringify(timeLogs), id]);
      client.release();

      if (result.rows.length > 0) {
        console.log(`✅ Timelogs salvati per ticket ID ${id}`);
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error('❌ Errore nel salvare i timelogs:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Elimina un ticket
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const client = await pool.connect();
      
      // Prima ottieni il ticket per recuperare l'ID dell'evento Google Calendar
      const ticketResult = await client.query('SELECT * FROM tickets WHERE id = $1', [id]);
      
      if (ticketResult.rows.length === 0) {
        client.release();
        return res.status(404).json({ error: 'Ticket non trovato' });
      }
      
      const ticket = ticketResult.rows[0];
      console.log(`🗑️ Ticket #${ticket.id} da eliminare - Google Calendar Event ID: ${ticket.googlecalendareventid || 'NON PRESENTE'}`);
      
      // Elimina il ticket dal database
      const result = await client.query('DELETE FROM tickets WHERE id = $1', [id]);
      client.release();

      if (result.rowCount > 0) {
        // Se il ticket ha un ID evento Google Calendar, sincronizza la cancellazione
        if (ticket.googlecalendareventid) {
          console.log(`🗑️ Ticket #${ticket.id} eliminato, sincronizzazione cancellazione Google Calendar...`);
          
          // Chiama la sincronizzazione Google Calendar
          try {
            // Estrai il token JWT dall'header della richiesta originale
            const authHeader = req.headers.authorization;
            
            const syncResponse = await fetch(`${process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`}/api/sync-google-calendar`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authHeader ? { 'Authorization': authHeader } : {})
              },
              body: JSON.stringify({
                ticket: {
                  ...ticket,
                  googleCalendarEventId: ticket.googlecalendareventid
                },
                action: 'delete'
              })
            });
            
            if (syncResponse.ok) {
              console.log(`✅ Evento Google Calendar cancellato per ticket #${ticket.id}`);
            } else {
              console.log(`⚠️ Errore cancellazione evento Google Calendar per ticket #${ticket.id}`);
            }
          } catch (syncErr) {
            console.log(`⚠️ Errore sincronizzazione cancellazione Google Calendar:`, syncErr.message);
          }
        }
        
        res.status(200).json({ message: 'Ticket eliminato con successo' });
      } else {
        res.status(404).json({ error: 'Ticket non trovato' });
      }
    } catch (err) {
      console.error('Errore nell\'eliminazione del ticket:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Prende forniture temporanee di un ticket
  router.get('/:id/forniture', async (req, res) => {
    const { id } = req.params;
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'SELECT * FROM forniture_temporanee WHERE ticket_id = $1 ORDER BY data_prestito DESC',
        [id]
      );
      client.release();
      res.json(result.rows);
    } catch (err) {
      console.error('Errore nel recuperare le forniture:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Aggiungi fornitura temporanea
  router.post('/:id/forniture', async (req, res) => {
    const { id } = req.params;
    const { materiale, quantita, nota } = req.body;
    
    console.log('🔍 DEBUG BACKEND FORNITURE: Ricevuta richiesta POST');
    console.log('🔍 DEBUG BACKEND FORNITURE: Ticket ID:', id);
    console.log('🔍 DEBUG BACKEND FORNITURE: Materiale:', materiale);
    console.log('🔍 DEBUG BACKEND FORNITURE: Quantità:', quantita);
    console.log('🔍 DEBUG BACKEND FORNITURE: Body completo:', req.body);
    
    if (!materiale || !quantita) {
      console.log('🔍 DEBUG BACKEND FORNITURE: Errore - Materiale o quantità mancanti');
      return res.status(400).json({ error: 'Materiale e quantità sono obbligatori' });
    }
    
    try {
      const client = await pool.connect();
      const query = `
        INSERT INTO forniture_temporanee (ticket_id, materiale, quantita, nota) 
        VALUES ($1, $2, $3, $4) 
        RETURNING *;
      `;
      const result = await client.query(query, [id, materiale, parseInt(quantita), nota || '']);
      client.release();
      
      console.log('🔍 DEBUG BACKEND FORNITURE: Query eseguita con successo');
      console.log('🔍 DEBUG BACKEND FORNITURE: Risultato:', result.rows[0]);
      console.log(`✅ Fornitura aggiunta al ticket ${id}`);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('🔍 DEBUG BACKEND FORNITURE: Errore nell\'aggiungere la fornitura:', err);
      console.error('Errore nell\'aggiungere la fornitura:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Elimina fornitura temporanea (restituita)
  router.delete('/forniture/:fornituraId', async (req, res) => {
    const { fornituraId } = req.params;
    
    try {
      const client = await pool.connect();
      const result = await client.query(
        'DELETE FROM forniture_temporanee WHERE id = $1 RETURNING *',
        [fornituraId]
      );
      client.release();
      
      if (result.rowCount > 0) {
        console.log(`✅ Fornitura ${fornituraId} restituita`);
        res.json({ message: 'Fornitura restituita con successo' });
      } else {
        res.status(404).json({ error: 'Fornitura non trovata' });
      }
    } catch (err) {
      console.error('Errore nell\'eliminare la fornitura:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Ottieni tutte le forniture temporanee da tutti i ticket
  router.get('/forniture/all', async (req, res) => {
    try {
      const client = await pool.connect();
      const query = `
        SELECT 
          ft.*,
          t.numero as ticket_numero,
          t.titolo as ticket_titolo,
          u.azienda,
          u.nome as cliente_nome
        FROM forniture_temporanee ft
        LEFT JOIN tickets t ON ft.ticket_id = t.id
        LEFT JOIN users u ON t.clienteid = u.id
        ORDER BY ft.data_prestito DESC
      `;
      const result = await client.query(query);
      client.release();
      
      res.json(result.rows);
    } catch (err) {
      console.error('Errore nel recuperare tutte le forniture temporanee:', err);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // ENDPOINT: Upload foto per ticket
  router.post('/:id/photos', uploadTicketPhotos.array('photos', 10), async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      
      // Verifica che il ticket esista
      const ticketCheck = await pool.query('SELECT id, stato FROM tickets WHERE id = $1', [ticketId]);
      if (ticketCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket non trovato' });
      }
      
      const ticket = ticketCheck.rows[0];
      
      // Verifica che lo stato permetta l'upload foto
      const allowedStates = ['aperto', 'in_lavorazione', 'risolto'];
      if (!allowedStates.includes(ticket.stato)) {
        return res.status(403).json({ error: 'Non puoi aggiungere foto a ticket in stato: ' + ticket.stato });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Nessuna foto caricata' });
      }
      
      // Recupera le foto esistenti
      const currentTicket = await pool.query('SELECT photos FROM tickets WHERE id = $1', [ticketId]);
      let existingPhotos = [];
      try {
        if (currentTicket.rows[0].photos) {
          existingPhotos = typeof currentTicket.rows[0].photos === 'string' 
            ? JSON.parse(currentTicket.rows[0].photos) 
            : currentTicket.rows[0].photos;
          if (!Array.isArray(existingPhotos)) existingPhotos = [];
        }
      } catch (e) {
        existingPhotos = [];
      }
      
      // Aggiungi le nuove foto
      const newPhotos = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: `/uploads/tickets/photos/${file.filename}`,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: new Date().toISOString()
      }));
      
      const updatedPhotos = [...existingPhotos, ...newPhotos];
      
      // Salva nel database
      await pool.query(
        'UPDATE tickets SET photos = $1 WHERE id = $2',
        [JSON.stringify(updatedPhotos), ticketId]
      );
      
      res.json({ 
        success: true, 
        message: `${newPhotos.length} foto caricata/e con successo`,
        photos: updatedPhotos
      });
    } catch (err) {
      console.error('Errore upload foto ticket:', err);
      res.status(500).json({ error: 'Errore durante il caricamento delle foto' });
    }
  });

  // ENDPOINT: Elimina foto di un ticket
  router.delete('/:id/photos/:photoFilename', async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const photoFilename = req.params.photoFilename;
      
      // Recupera le foto esistenti
      const ticketResult = await pool.query('SELECT photos FROM tickets WHERE id = $1', [ticketId]);
      if (ticketResult.rows.length === 0) {
        return res.status(404).json({ error: 'Ticket non trovato' });
      }
      
      let photos = [];
      try {
        if (ticketResult.rows[0].photos) {
          photos = typeof ticketResult.rows[0].photos === 'string' 
            ? JSON.parse(ticketResult.rows[0].photos) 
            : ticketResult.rows[0].photos;
          if (!Array.isArray(photos)) photos = [];
        }
      } catch (e) {
        photos = [];
      }
      
      // Trova e rimuovi la foto
      const photoIndex = photos.findIndex(p => p.filename === photoFilename);
      if (photoIndex === -1) {
        return res.status(404).json({ error: 'Foto non trovata' });
      }
      
      const photoToDelete = photos[photoIndex];
      
      // Elimina il file dal filesystem
      const photoPath = path.join(__dirname, '..', 'uploads', 'tickets', 'photos', photoFilename);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
      
      // Rimuovi dalla lista
      photos.splice(photoIndex, 1);
      
      // Salva nel database
      await pool.query(
        'UPDATE tickets SET photos = $1 WHERE id = $2',
        [JSON.stringify(photos), ticketId]
      );
      
      res.json({ success: true, message: 'Foto eliminata con successo', photos: photos });
    } catch (err) {
      console.error('Errore eliminazione foto ticket:', err);
      res.status(500).json({ error: 'Errore durante l\'eliminazione della foto' });
    }
  });

  return router;
};
