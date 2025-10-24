// routes/googleCalendar.js

const express = require('express');
const { google } = require('googleapis');

module.exports = (pool) => {
  const router = express.Router();

  // Configurazione Google Calendar API con Service Account (lazy loading)
  let auth = null;
  
  const getAuth = () => {
    if (!auth) {
      // Verifica che le credenziali essenziali siano presenti
      if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        console.log('⚠️ Credenziali Google Service Account non complete - Google Calendar non disponibile');
        return null;
      }
      
      try {
        auth = new google.auth.GoogleAuth({
          credentials: {
            type: "service_account",
            project_id: process.env.GOOGLE_PROJECT_ID || "ticketapp-b2a2a",
            private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            client_id: process.env.GOOGLE_CLIENT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
            universe_domain: "googleapis.com"
          },
          scopes: ['https://www.googleapis.com/auth/calendar']
        });
        console.log('✅ Google Auth inizializzato correttamente');
      } catch (err) {
        console.error('❌ Errore inizializzazione Google Auth:', err);
        return null;
      }
    }
    return auth;
  };

  // ENDPOINT: Sincronizza ticket con Google Calendar
  router.post('/sync-google-calendar', async (req, res) => {
    try {
      console.log('=== RICHIESTA SINCRONIZZAZIONE GOOGLE CALENDAR ===');
      const { ticket, action, tokens } = req.body;
      
      console.log('Ticket ricevuto:', ticket ? `#${ticket.id} - ${ticket.titolo}` : 'Nessun ticket');
      console.log('Azione:', action || 'create');

      if (!ticket) {
        console.log('ERRORE: Ticket non fornito');
        return res.status(400).json({ error: 'Ticket non fornito' });
      }

      // Verifica che le credenziali Service Account siano configurate
      console.log('Verifica credenziali Service Account...');
      console.log('GOOGLE_CLIENT_EMAIL:', process.env.GOOGLE_CLIENT_EMAIL ? 'Configurato' : 'Mancante');
      console.log('GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? 'Configurato' : 'Mancante');
      
      if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        console.log('ERRORE: Credenziali Google Service Account non configurate');
        return res.json({
          success: false,
          message: 'Google Service Account non configurato'
        });
      }

      // Usa Service Account per sincronizzazione automatica
      console.log('Inizializzazione Google Auth...');
      const authInstance = getAuth();
      if (!authInstance) {
        console.log('ERRORE: Google Auth non disponibile');
        return res.json({
          success: false,
          message: 'Google Auth non configurato'
        });
      }
      
          console.log('Ottenimento client Google Auth...');
          const authClient = await authInstance.getClient();
          console.log('Client Google Auth ottenuto:', authClient.credentials?.client_email);
          
          // Log di debug per le credenziali
          if (!authClient.credentials?.client_email) {
            console.log('⚠️ ATTENZIONE: Service Account email non disponibile, ma procedo comunque');
          }
      
      const calendar = google.calendar({ version: 'v3', auth: authClient });
      console.log('Google Calendar API inizializzata');

      // Verifica il Calendar ID reale
      console.log('Using calendarId: primary');
      console.log('Service Account email:', authClient.credentials?.client_email);

      // Gestisci diversi formati di data con timezone corretto
      let startDate;
      if (ticket.dataapertura) {
        // Se è in formato ISO con timezone, usa direttamente
        if (ticket.dataapertura.includes('T') && ticket.dataapertura.includes('+')) {
          startDate = new Date(ticket.dataapertura);
        } else if (ticket.dataapertura.includes('T')) {
          // Se è ISO senza timezone, aggiungi timezone Europe/Rome
          startDate = new Date(ticket.dataapertura + '+02:00');
        } else {
          // Se è solo data, aggiungi time locale
          startDate = new Date(ticket.dataapertura + 'T00:00:00+02:00');
        }
        
        if (!startDate || isNaN(startDate.getTime())) {
          startDate = new Date();
        }
      } else if (ticket.created_at) {
        // Usa la data di creazione del ticket se disponibile
        startDate = new Date(ticket.created_at);
        if (isNaN(startDate.getTime())) {
          startDate = new Date();
        }
      } else {
        startDate = new Date();
      }

      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 ora dopo

      // Log della data utilizzata
      console.log('Ticket date info:', {
        ticketId: ticket.id,
        dataapertura: ticket.dataapertura,
        created_at: ticket.created_at,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const event = {
        summary: `Ticket #${ticket.id} - ${ticket.titolo}`,
        description: `Ticket: ${ticket.titolo}\nCliente: ${ticket.cliente}\nPriorità: ${ticket.priorita}\nStato: ${ticket.stato}\nDescrizione: ${ticket.descrizione}\nData apertura: ${startDate.toLocaleDateString('it-IT')}`,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: 'Europe/Rome'
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: 'Europe/Rome'
        },
        colorId: getPriorityColorId(ticket.priorita),
        source: {
          title: 'TicketApp',
          url: `${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}/ticket/${ticket.id}`
        }
      };

      let result;
      let calendarId = 'primary'; // Default to primary, will be updated if a TicketApp calendar is found/created
      let calendarList = null; // Inizializza calendarList fuori dal blocco try

      if (action === 'create') {
        console.log('Creazione evento Google Calendar...');
        console.log('Evento da creare:', {
          summary: event.summary,
          start: event.start,
          end: event.end
        });
        
        // Test: prova a ottenere la lista dei calendari per verificare l'accesso
        try {
          console.log('Test accesso calendari...');
          calendarList = await calendar.calendarList.list();
          console.log('Available calendars:', calendarList.data.items?.map(cal => ({
            id: cal.id,
            summary: cal.summary,
            primary: cal.primary
          })));
          
          // Se non ci sono calendari, prova a creare un calendario di test
          if (!calendarList.data.items || calendarList.data.items.length === 0) {
            console.log('Nessun calendario accessibile, creazione calendario di test...');
            try {
              const testCalendar = await calendar.calendars.insert({
                resource: {
                  summary: 'TicketApp Test Calendar',
                  description: 'Calendario di test per TicketApp',
                  timeZone: 'Europe/Rome'
                }
              });
              console.log('Calendario di test creato:', testCalendar.data.id);
              
              // Condividi il calendario con l'account principale
              const userEmail = process.env.GOOGLE_USER_EMAIL;
              if (userEmail && userEmail !== 'YOUR_EMAIL@gmail.com') {
                console.log('Tentativo condivisione calendario con:', userEmail);
                
                    try {
                      const shareResult = await calendar.acl.insert({
                        calendarId: testCalendar.data.id,
                        resource: {
                          role: 'writer',
                          scope: {
                            type: 'user',
                            value: userEmail
                          }
                        },
                        sendNotifications: false // Disabilita notifiche email
                      });
                    console.log('Calendario condiviso con permessi di SCRITTURA:', shareResult.data);
                    console.log('IMPORTANTE: Ora puoi modificare gli eventi nel "TicketApp Test Calendar"');
                  } catch (shareErr) {
                    console.log('ERRORE condivisione calendario:', shareErr.message);
                  }
              } else {
                console.log('GOOGLE_USER_EMAIL non configurato. Aggiungi la variabile su Render con il tuo email.');
              }
              
              // Condividi il calendario con tutti i clienti
              try {
                console.log('Condivisione calendario con tutti i clienti...');
                const clientEmails = await pool.query('SELECT email FROM users WHERE ruolo = \'cliente\' AND email IS NOT NULL');
                
                for (const client of clientEmails.rows) {
                    try {
                      const clientShareResult = await calendar.acl.insert({
                        calendarId: testCalendar.data.id,
                        resource: {
                          role: 'reader', // I clienti possono solo leggere
                          scope: {
                            type: 'user',
                            value: client.email
                          }
                        },
                        sendNotifications: false // Disabilita notifiche email
                      });
                    console.log(`✅ Calendario condiviso con cliente: ${client.email}`);
                  } catch (clientShareErr) {
                    console.log(`⚠️ Errore condivisione con cliente ${client.email}:`, clientShareErr.message);
                  }
                }
              } catch (shareErr) {
                console.log('⚠️ Errore condivisione con clienti:', shareErr.message);
              }
            } catch (err) {
              console.log('ERRORE creazione calendario di test:', err.message);
            }
          }
        } catch (err) {
          console.log('ERRORE accesso calendari:', err.message);
        }

        console.log('Inserimento evento nel calendario...');
        
        // Usa il calendario del Service Account invece di 'primary'
        calendarId = calendarList && calendarList.data && calendarList.data.items && calendarList.data.items.length > 0 
          ? calendarList.data.items[0].id 
          : 'primary';
          
        console.log('Usando calendarId:', calendarId);
        
        // Condividi il calendario esistente con l'utente se non è già condiviso
        if (calendarId !== 'primary' && calendarList && calendarList.data && calendarList.data.items && calendarList.data.items.length > 0) {
          const userEmail = process.env.GOOGLE_USER_EMAIL;
          if (userEmail && userEmail !== 'YOUR_EMAIL@gmail.com') {
            console.log('Verifica condivisione calendario esistente con:', userEmail);
            try {
              // Prova a condividere il calendario esistente con permessi di scrittura
              const shareResult = await calendar.acl.insert({
                calendarId: calendarId,
                resource: {
                  role: 'writer',
                  scope: {
                    type: 'user',
                    value: userEmail
                  }
                },
                sendNotifications: false, // Disabilita notifiche email
                sendUpdates: 'none' // Disabilita aggiornamenti email
              });
              console.log('Calendario esistente condiviso con permessi di SCRITTURA:', shareResult.data);
            } catch (shareErr) {
              if (shareErr.message.includes('already exists')) {
                console.log('Calendario già condiviso con questo utente - aggiornamento permessi a WRITER');
                // Prova ad aggiornare i permessi esistenti
                try {
                  const updateResult = await calendar.acl.update({
                    calendarId: calendarId,
                    ruleId: `user:${userEmail}`,
                    resource: {
                      role: 'writer',
                      scope: {
                        type: 'user',
                        value: userEmail
                      }
                    },
                    sendNotifications: false, // Disabilita notifiche email
                    sendUpdates: 'none' // Disabilita aggiornamenti email
                  });
                  console.log('Permessi aggiornati a WRITER:', updateResult.data);
                } catch (updateErr) {
                  console.log('Errore aggiornamento permessi:', updateErr.message);
                }
              } else {
                console.log('ERRORE condivisione calendario esistente:', shareErr.message);
              }
            }
          }
        }
        
        result = await calendar.events.insert({
          calendarId: calendarId,
          resource: event,
          sendUpdates: 'none', // Disabilita inviti email automatici
          conferenceDataVersion: 0 // Disabilita notifiche di conferenza
        });
        console.log('Evento creato con successo:', result.data.id);
        console.log('Evento creato nel calendario:', result.data.htmlLink);
        console.log('Evento creato con data:', result.data.start?.dateTime || result.data.start?.date);
        
        // Salva l'ID dell'evento Google Calendar nel database SOLO per la creazione
        if (result.data?.id) {
          try {
            const client = await pool.connect();
            await client.query(
              'UPDATE tickets SET googlecalendareventid = $1 WHERE id = $2',
              [result.data.id, ticket.id]
            );
            client.release();
            console.log(`✅ ID evento Google Calendar salvato per ticket #${ticket.id}: ${result.data.id}`);
          } catch (dbErr) {
            console.log('⚠️ Errore salvataggio ID evento Google Calendar:', dbErr.message);
          }
        }
        
      } else if (action === 'update' && ticket.googleCalendarEventId) {
        result = await calendar.events.update({
          calendarId: calendarId,
          eventId: ticket.googleCalendarEventId,
          resource: event
        });
      } else if (action === 'delete' && ticket.googleCalendarEventId) {
        // Per la cancellazione, devo trovare il calendario corretto
        let deleteCalendarId = 'primary'; // Default
        
        try {
          console.log('Ricerca calendario per cancellazione evento...');
          const calendarList = await calendar.calendarList.list();
          const ticketAppCalendar = calendarList.data.items?.find(cal => cal.summary === 'TicketApp Test Calendar');
          
          if (ticketAppCalendar) {
            deleteCalendarId = ticketAppCalendar.id;
            console.log('Trovato TicketApp Test Calendar per cancellazione:', deleteCalendarId);
          } else {
            console.log('TicketApp Test Calendar non trovato, uso primary');
          }
        } catch (err) {
          console.log('Errore ricerca calendario per cancellazione:', err.message);
        }
        
        // Cancella l'evento da Google Calendar
        result = await calendar.events.delete({
          calendarId: deleteCalendarId,
          eventId: ticket.googleCalendarEventId
        });
        console.log('Evento cancellato da Google Calendar:', ticket.googleCalendarEventId, 'dal calendario:', deleteCalendarId);
      } else {
        return res.status(400).json({ error: 'Azione non valida o ID evento mancante' });
      }

      console.log('Ticket #' + ticket.id + ' sincronizzato con Google Calendar via backend');
      console.log('Event details:', {
        summary: event.summary,
        start: event.start,
        end: event.end,
        calendarId: calendarId,
        eventId: result.data?.id
      });
          
          res.json({
            success: true,
            eventId: result.data?.id,
            message: 'Ticket sincronizzato con Google Calendar',
            eventDetails: {
              summary: event.summary,
              start: event.start,
              end: event.end
            }
          });

    } catch (err) {
      console.error('Errore sincronizzazione Google Calendar:', err);
      res.status(500).json({ 
        error: 'Errore sincronizzazione Google Calendar',
        details: err.message 
      });
    }
  });

  // Funzione helper per ottenere color ID basato sulla priorità
  const getPriorityColorId = (priorita) => {
    const colors = {
      'urgente': '11', // Rosso
      'alta': '6',     // Arancione
      'media': '9',    // Blu
      'bassa': '8',    // Grigio
    };
    return colors[priorita?.toLowerCase()] || '1';
  };

  // ENDPOINT: Disabilita notifiche calendario per utente
  router.post('/disable-calendar-notifications', async (req, res) => {
    try {
      const { userEmail } = req.body;
      
      if (!userEmail) {
        return res.status(400).json({ error: 'Email utente richiesta' });
      }

      const auth = getAuth();
      if (!auth) {
        return res.status(500).json({ error: 'Google Calendar non configurato' });
      }

      const calendar = google.calendar({ version: 'v3', auth });
      
      // Ottieni lista calendari
      const calendarList = await calendar.calendarList.list();
      console.log('Calendari trovati:', calendarList.data.items?.length || 0);
      
      let updatedCalendars = [];
      
      for (const cal of calendarList.data.items || []) {
        if (cal.summary && cal.summary.includes('TicketApp')) {
          console.log(`Disabilitazione notifiche per: ${cal.summary} (${cal.id})`);
          
          try {
            // Disabilita notifiche per questo calendario
            const updateResult = await calendar.acl.update({
              calendarId: cal.id,
              ruleId: `user:${userEmail}`,
              resource: {
                role: 'writer',
                scope: {
                  type: 'user',
                  value: userEmail
                }
              },
              sendNotifications: false, // Disabilita notifiche email
              sendUpdates: 'none' // Disabilita aggiornamenti email
            });
            
            console.log(`✅ Notifiche disabilitate per ${cal.summary}:`, updateResult.data);
            updatedCalendars.push({
              name: cal.summary,
              id: cal.id,
              status: 'notifications_disabled'
            });
          } catch (updateErr) {
            console.log(`❌ Errore disabilitazione notifiche per ${cal.summary}:`, updateErr.message);
            updatedCalendars.push({
              name: cal.summary,
              id: cal.id,
              status: 'error',
              error: updateErr.message
            });
          }
        }
      }
      
      res.json({
        success: true,
        message: 'Notifiche calendario disabilitate',
        updatedCalendars: updatedCalendars
      });
      
    } catch (err) {
      console.error('❌ Errore disabilitazione notifiche calendario:', err);
      res.status(500).json({ 
        error: 'Errore disabilitazione notifiche calendario',
        details: err.message 
      });
    }
  });

  // ENDPOINT: Forza aggiornamento permessi calendario
  router.post('/force-update-permissions', async (req, res) => {
    try {
      console.log('=== FORZA AGGIORNAMENTO PERMESSI CALENDARIO ===');
      
      const userEmail = process.env.GOOGLE_USER_EMAIL;
      if (!userEmail || userEmail === 'YOUR_EMAIL@gmail.com') {
        return res.json({
          success: false,
          message: 'GOOGLE_USER_EMAIL non configurato correttamente'
        });
      }
      
      console.log('Email utente:', userEmail);
      
      // Inizializza Google Auth
      const authInstance = getAuth();
      if (!authInstance) {
        return res.json({
          success: false,
          message: 'Google Auth non disponibile'
        });
      }
      
      const authClient = await authInstance.getClient();
      const calendar = google.calendar({ version: 'v3', auth: authClient });
      
      // Ottieni lista calendari
      const calendarList = await calendar.calendarList.list();
      console.log('Calendari disponibili:', calendarList.data.items?.length || 0);
      
      let updatedCalendars = [];
      
      for (const cal of calendarList.data.items || []) {
        if (cal.summary && cal.summary.includes('TicketApp')) {
          console.log(`Aggiornamento permessi per: ${cal.summary} (${cal.id})`);
          
          try {
            // Prova ad aggiornare i permessi
            const updateResult = await calendar.acl.update({
              calendarId: cal.id,
              ruleId: `user:${userEmail}`,
              resource: {
                role: 'writer',
                scope: {
                  type: 'user',
                  value: userEmail
                }
              },
              sendNotifications: false, // Disabilita notifiche email
              sendUpdates: 'none' // Disabilita aggiornamenti email
            });
            
            console.log(`✅ Permessi aggiornati per ${cal.summary}:`, updateResult.data);
            updatedCalendars.push({
              name: cal.summary,
              id: cal.id,
              status: 'updated'
            });
          } catch (updateErr) {
            if (updateErr.message.includes('not found')) {
              // Se la regola non esiste, creala
              try {
                const createResult = await calendar.acl.insert({
                  calendarId: cal.id,
                  resource: {
                    role: 'writer',
                    scope: {
                      type: 'user',
                      value: userEmail
                    }
                  },
                  sendNotifications: false, // Disabilita notifiche email
                  sendUpdates: 'none' // Disabilita aggiornamenti email
                });
                
                console.log(`✅ Permessi creati per ${cal.summary}:`, createResult.data);
                updatedCalendars.push({
                  name: cal.summary,
                  id: cal.id,
                  status: 'created'
                });
              } catch (createErr) {
                console.log(`❌ Errore creazione permessi per ${cal.summary}:`, createErr.message);
                updatedCalendars.push({
                  name: cal.summary,
                  id: cal.id,
                  status: 'error',
                  error: createErr.message
                });
              }
            } else {
              console.log(`❌ Errore aggiornamento permessi per ${cal.summary}:`, updateErr.message);
              updatedCalendars.push({
                name: cal.summary,
                id: cal.id,
                status: 'error',
                error: updateErr.message
              });
            }
          }
        }
      }
      
      res.json({
        success: true,
        message: 'Aggiornamento permessi completato',
        userEmail: userEmail,
        updatedCalendars: updatedCalendars
      });
      
    } catch (err) {
      console.error('Errore aggiornamento permessi:', err);
      res.status(500).json({ 
        error: 'Errore aggiornamento permessi',
        details: err.message 
      });
    }
  });

      // ENDPOINT: Condividi calendario con un nuovo cliente
      router.post('/share-calendar-with-client', async (req, res) => {
        try {
          const { clientEmail } = req.body;
          
          if (!clientEmail) {
            return res.status(400).json({ error: 'Email cliente obbligatoria' });
          }
          
          // Inizializza Google Auth
          const authInstance = getAuth();
          if (!authInstance) {
            return res.json({
              success: false,
              message: 'Google Auth non disponibile'
            });
          }
          
          const authClient = await authInstance.getClient();
          const calendar = google.calendar({ version: 'v3', auth: authClient });
          
          // Trova il TicketApp Test Calendar
          const calendarList = await calendar.calendarList.list();
          const ticketAppCalendar = calendarList.data.items?.find(cal => cal.summary === 'TicketApp Test Calendar');
          
          if (!ticketAppCalendar) {
            return res.json({
              success: false,
              message: 'TicketApp Test Calendar non trovato'
            });
          }
          
          // Condividi il calendario con il cliente
          try {
            const shareResult = await calendar.acl.insert({
              calendarId: ticketAppCalendar.id,
              resource: {
                role: 'reader',
                scope: {
                  type: 'user',
                  value: clientEmail
                }
              },
              sendNotifications: false // Disabilita notifiche email
            });
            
            console.log(`✅ Calendario condiviso con nuovo cliente: ${clientEmail}`);
            
            res.json({
              success: true,
              message: `Calendario condiviso con ${clientEmail}`,
              calendarId: ticketAppCalendar.id
            });
            
          } catch (shareErr) {
            console.log(`⚠️ Errore condivisione con cliente ${clientEmail}:`, shareErr.message);
            res.json({
              success: false,
              message: `Errore condivisione con ${clientEmail}: ${shareErr.message}`
            });
          }
          
        } catch (err) {
          console.error('Errore condivisione calendario con cliente:', err);
          res.status(500).json({ 
            error: 'Errore condivisione calendario',
            details: err.message 
          });
        }
      });

      return router;
    };
