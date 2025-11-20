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

      // Funzione helper per formattare date e ore
      const formatDateTime = (date) => {
        return date.toLocaleString('it-IT', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Rome'
        });
      };

      // Recupera il nome dell'azienda dal clienteid
      let clientName = 'Cliente Sconosciuto';
      if (ticket.clienteid) {
        try {
          const clientQuery = 'SELECT azienda FROM users WHERE id = $1';
          const clientResult = await pool.query(clientQuery, [ticket.clienteid]);
          if (clientResult.rows.length > 0) {
            clientName = clientResult.rows[0].azienda || 'Cliente Sconosciuto';
          }
        } catch (err) {
          console.error('Errore recupero nome cliente:', err);
        }
      }

      // Costruisci la descrizione dettagliata (include registro intervento, materiali e offerte)
      let description = `TITOLO: ${ticket.titolo}\n`;
      description += `PRIORITÀ: ${ticket.priorita?.toUpperCase()}\n`;
      description += `STATO: ${ticket.stato?.toUpperCase()}\n`;
      description += `DESCRIZIONE: ${ticket.descrizione || ''}\n`;
      description += `APERTURA: ${formatDateTime(startDate)}\n`;

      // Se disponibile, aggiungi il registro intervento con dettagli
      try {
        let timelogs = ticket.timelogs;
        if (typeof timelogs === 'string') {
          try { timelogs = JSON.parse(timelogs); } catch { timelogs = []; }
        }
        if (Array.isArray(timelogs) && timelogs.length > 0) {
          description += `\n— REGISTRO INTERVENTO —\n`;
          timelogs.forEach((log, idx) => {
            const modalita = log.modalita || '';
            const dataLog = log.data || '';
            const oraInizio = log.oraInizio || '';
            const oraFine = log.oraFine || '';
            const desc = (log.descrizione || '').replace(/\n/g, ' ');
            const ore = parseFloat(log.oreIntervento) || 0;
            const costoUnit = parseFloat(log.costoUnitario) || 0;
            const sconto = parseFloat(log.sconto) || 0;
            const lavoroTot = ore * costoUnit * (1 - sconto / 100);

            // Materiali
            const materials = Array.isArray(log.materials) ? log.materials : [];
            const matsStr = materials
              .filter(m => m && m.nome)
              .map(m => {
                const q = parseFloat(m.quantita) || 0;
                const c = parseFloat(m.costo) || 0;
                return `${m.nome} x${q} (${(q * c).toFixed(2)}€)`;
              })
              .join(', ');
            const matsTot = materials.reduce((sum, m) => sum + ((parseFloat(m.quantita) || 0) * (parseFloat(m.costo) || 0)), 0);

            // Offerte
            const offerte = Array.isArray(log.offerte) ? log.offerte : [];
            const offerteStr = offerte
              .map(o => {
                const tot = parseFloat(o.totale) || 0;
                return `${o.numeroOfferta || 'Offerta'}: ${tot.toFixed(2)}€`;
              })
              .join(', ');
            const offerteTot = offerte.reduce((sum, o) => sum + (parseFloat(o.totale) || 0), 0);

            const totaleLog = lavoroTot + matsTot + offerteTot;

            description += `#${idx + 1} ${modalita} — ${dataLog} ${oraInizio ? `(${oraInizio}` : ''}${oraFine ? `-${oraFine})` : (oraInizio ? ')' : '')}\n`;
            if (desc) description += `  Descrizione: ${desc}\n`;
            description += `  Lavoro: ${ore}h x ${(costoUnit || 0).toFixed(2)}€ (-${(sconto || 0)}%) = ${lavoroTot.toFixed(2)}€\n`;
            if (matsStr) description += `  Materiali: ${matsStr} — Tot: ${matsTot.toFixed(2)}€\n`;
            if (offerteStr) description += `  Offerte: ${offerteStr} — Tot: ${offerteTot.toFixed(2)}€\n`;
            description += `  Totale riga: ${totaleLog.toFixed(2)}€\n`;
          });
        }
      } catch (_) {}
      
      // Aggiungi data di chiusura se il ticket è chiuso
      if (ticket.stato === 'chiuso' && ticket.dataChiusura) {
        const chiusuraDate = new Date(ticket.dataChiusura);
        description += `CHIUSURA: ${formatDateTime(chiusuraDate)}\n`;
      }

      const event = {
        summary: `Ticket ${ticket.numero} - ${clientName}`,
        description: description,
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
        
        // Crea eventi separati per ogni intervento (timelog)
        try {
          let timelogs = ticket.timelogs;
          if (typeof timelogs === 'string') {
            try { timelogs = JSON.parse(timelogs); } catch { timelogs = []; }
          }
          if (Array.isArray(timelogs) && timelogs.length > 0) {
            console.log(`Creazione eventi per ${timelogs.length} interventi...`);
            
            for (const [idx, log] of timelogs.entries()) {
              if (!log.data) {
                console.log(`Intervento #${idx + 1} senza data, saltato`);
                continue;
              }
              
              // Prepara data e ora dell'intervento
              let interventoStartDate;
              let interventoEndDate;
              
              if (log.data.includes('T')) {
                // Se ha già timestamp completo
                interventoStartDate = new Date(log.data);
              } else {
                // Se è solo data, aggiungi l'ora di inizio
                const oraInizio = log.oraInizio || '09:00';
                interventoStartDate = new Date(log.data + 'T' + oraInizio + ':00+02:00');
              }
              
              if (isNaN(interventoStartDate.getTime())) {
                console.log(`Intervento #${idx + 1} data non valida, saltato`);
                continue;
              }
              
              // Calcola data fine: usa oraFine se disponibile, altrimenti aggiungi le ore di intervento
              if (log.oraFine) {
                const oraFine = log.oraFine;
                const dateStr = log.data.includes('T') ? log.data.split('T')[0] : log.data;
                interventoEndDate = new Date(dateStr + 'T' + oraFine + ':00+02:00');
              } else {
                const ore = parseFloat(log.oreIntervento) || 1;
                interventoEndDate = new Date(interventoStartDate.getTime() + ore * 60 * 60 * 1000);
              }
              
              if (isNaN(interventoEndDate.getTime())) {
                interventoEndDate = new Date(interventoStartDate.getTime() + 60 * 60 * 1000); // Default 1 ora
              }
              
              // Costruisci descrizione intervento
              const modalita = log.modalita || 'Intervento';
              const descIntervento = log.descrizione || '';
              const oreIntervento = parseFloat(log.oreIntervento) || 0;
              
              let descInterventoText = `═══════════════════════════════════\n`;
              descInterventoText += `🔧 INTERVENTO ESEGUITO\n`;
              descInterventoText += `═══════════════════════════════════\n\n`;
              descInterventoText += `📋 TICKET: #${ticket.numero}\n`;
              descInterventoText += `📝 Titolo Ticket: ${ticket.titolo || 'N/A'}\n`;
              descInterventoText += `👤 Cliente: ${clientName}\n`;
              descInterventoText += `🔗 Link Ticket: ${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}/ticket/${ticket.id}\n\n`;
              descInterventoText += `───────────────────────────────────\n`;
              descInterventoText += `DETTAGLI INTERVENTO:\n`;
              descInterventoText += `───────────────────────────────────\n`;
              descInterventoText += `📅 Data: ${log.data}\n`;
              if (log.oraInizio) descInterventoText += `⏰ Ora Inizio: ${log.oraInizio}\n`;
              if (log.oraFine) descInterventoText += `⏰ Ora Fine: ${log.oraFine}\n`;
              descInterventoText += `🔧 Modalità: ${modalita}\n`;
              descInterventoText += `⏱️ Ore: ${oreIntervento}h\n`;
              if (descIntervento) {
                descInterventoText += `\n📄 Descrizione Intervento:\n${descIntervento}\n`;
              }
              
              // Materiali
              if (log.materials && Array.isArray(log.materials) && log.materials.length > 0) {
                const materials = log.materials.filter(m => m && m.nome && m.nome.trim() !== '0' && m.nome.trim() !== '');
                if (materials.length > 0) {
                  descInterventoText += `\n📦 Materiali Utilizzati:\n`;
                  materials.forEach(m => {
                    const q = parseFloat(m.quantita) || 0;
                    const c = parseFloat(m.costo) || 0;
                    descInterventoText += `- ${m.nome} x${q} (€${(q * c).toFixed(2)})\n`;
                  });
                }
              }
              
              // Crea evento per l'intervento
              const interventoEvent = {
                summary: `🔧 Ticket #${ticket.numero}: ${ticket.titolo || 'Intervento'} - ${modalita}`,
                description: descInterventoText,
                start: {
                  dateTime: interventoStartDate.toISOString(),
                  timeZone: 'Europe/Rome'
                },
                end: {
                  dateTime: interventoEndDate.toISOString(),
                  timeZone: 'Europe/Rome'
                },
                colorId: '10', // Colore viola per gli interventi
                source: {
                  title: 'TicketApp - Intervento',
                  url: `${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}/ticket/${ticket.id}`
                },
                extendedProperties: {
                  private: {
                    ticketId: ticket.id.toString(),
                    timelogIndex: idx.toString(),
                    isIntervento: 'true'
                  }
                }
              };
              
              try {
                const interventoResult = await calendar.events.insert({
                  calendarId: calendarId,
                  resource: interventoEvent,
                  sendUpdates: 'none',
                  conferenceDataVersion: 0
                });
                console.log(`✅ Evento intervento #${idx + 1} creato: ${interventoResult.data.id}`);
              } catch (interventoErr) {
                console.log(`⚠️ Errore creazione evento intervento #${idx + 1}:`, interventoErr.message);
              }
            }
          }
        } catch (interventiErr) {
          console.log('⚠️ Errore creazione eventi interventi:', interventiErr.message);
        }
        
      } else if (action === 'update') {
        // Per UPDATE, NON aggiorniamo l'evento principale del ticket
        // L'evento principale deve rimanere sempre alla data di apertura originale
        // Gestiamo solo gli interventi (timelogs)
        
        // Verifica se esiste già un evento principale
        let eventId = ticket.googleCalendarEventId || ticket.googlecalendareventid;
        if (!eventId && ticket.id) {
          try {
            const dbRes = await pool.query('SELECT googlecalendareventid FROM tickets WHERE id = $1', [ticket.id]);
            eventId = dbRes.rows?.[0]?.googlecalendareventid || null;
          } catch (e) {}
        }

        // Se non esiste evento principale, crealo (solo alla prima sincronizzazione)
        if (!eventId) {
          // Cerca il calendario corretto
          try {
            const updateCalendarList = await calendar.calendarList.list();
            const ticketAppCalendar = updateCalendarList.data.items?.find(cal => cal.summary === 'TicketApp Test Calendar');
            if (ticketAppCalendar) {
              calendarId = ticketAppCalendar.id;
            } else if (updateCalendarList.data.items && updateCalendarList.data.items.length > 0) {
              calendarId = updateCalendarList.data.items[0].id;
            } else {
              calendarId = 'primary';
            }
          } catch (calErr) {
            calendarId = 'primary';
          }
          
          result = await calendar.events.insert({
            calendarId: calendarId,
            resource: event,
            sendUpdates: 'none',
            conferenceDataVersion: 0
          });
          if (result.data?.id && ticket.id) {
            try {
              await pool.query('UPDATE tickets SET googlecalendareventid = $1 WHERE id = $2', [result.data.id, ticket.id]);
            } catch (_) {}
          }
        } else {
          // Evento principale già esiste, non lo aggiorniamo
          // Usa il risultato esistente per la risposta
          result = { data: { id: eventId } };
        }
        
        // Invia risposta HTTP IMMEDIATAMENTE (non attendere la creazione eventi intervento)
        res.json({
          success: true,
          eventId: result.data?.id,
          message: 'Interventi sincronizzati con Google Calendar',
          eventDetails: {
            summary: event.summary,
            start: event.start,
            end: event.end
          }
        });
        
        // Crea eventi intervento in background (NON bloccare la risposta HTTP)
        setImmediate(async () => {
          try {
            // Cerca il calendario corretto per gli interventi
            let interventiCalendarId = 'primary';
            try {
              const updateCalendarList = await calendar.calendarList.list();
              const ticketAppCalendar = updateCalendarList.data.items?.find(cal => cal.summary === 'TicketApp Test Calendar');
              if (ticketAppCalendar) {
                interventiCalendarId = ticketAppCalendar.id;
              } else if (updateCalendarList.data.items && updateCalendarList.data.items.length > 0) {
                interventiCalendarId = updateCalendarList.data.items[0].id;
              }
            } catch (calErr) {
              interventiCalendarId = 'primary';
            }
            
            let timelogs = ticket.timelogs;
            
            if (typeof timelogs === 'string') {
              try { 
                timelogs = JSON.parse(timelogs); 
              } catch (parseErr) { 
                console.error(`[UPDATE] Errore parsing timelogs:`, parseErr.message);
                timelogs = []; 
              }
            }
            
            if (Array.isArray(timelogs) && timelogs.length > 0) {
              // Cerca eventi esistenti per questo ticket
              let existingInterventiEvents = [];
              try {
                const eventsList = await calendar.events.list({
                  calendarId: calendarId,
                  timeMin: new Date(new Date().getFullYear() - 1, 0, 1).toISOString(),
                  timeMax: new Date(new Date().getFullYear() + 1, 11, 31).toISOString(),
                  maxResults: 2500,
                  singleEvents: true
                });
                
                existingInterventiEvents = eventsList.data.items?.filter(e => 
                  e.extendedProperties?.private?.ticketId === ticket.id.toString() &&
                  e.extendedProperties?.private?.isIntervento === 'true'
                ) || [];
              } catch (searchErr) {
                console.error(`[UPDATE] Errore ricerca eventi intervento esistenti:`, searchErr.message);
              }
              
              for (const [idx, log] of timelogs.entries()) {
                try {
                  if (!log.data) {
                    continue;
                  }
                  
                  // Prepara data e ora dell'intervento
                  let interventoStartDate;
                  let interventoEndDate;
                
                if (log.data.includes('T')) {
                  interventoStartDate = new Date(log.data);
                } else {
                  const oraInizio = log.oraInizio || '09:00';
                  interventoStartDate = new Date(log.data + 'T' + oraInizio + ':00+02:00');
                }
                
                if (isNaN(interventoStartDate.getTime())) {
                  console.error(`[UPDATE] ❌ Intervento #${idx + 1} data non valida:`, log.data);
                  continue;
                }
              
                if (log.oraFine) {
                  const oraFine = log.oraFine;
                  const dateStr = log.data.includes('T') ? log.data.split('T')[0] : log.data;
                  interventoEndDate = new Date(dateStr + 'T' + oraFine + ':00+02:00');
                } else {
                  const ore = parseFloat(log.oreIntervento) || 1;
                  interventoEndDate = new Date(interventoStartDate.getTime() + ore * 60 * 60 * 1000);
                }
                
                if (isNaN(interventoEndDate.getTime())) {
                  interventoEndDate = new Date(interventoStartDate.getTime() + 60 * 60 * 1000);
                }
                
                const modalita = log.modalita || 'Intervento';
                const descIntervento = log.descrizione || '';
                const oreIntervento = parseFloat(log.oreIntervento) || 0;
                
                let descInterventoText = `═══════════════════════════════════\n`;
                descInterventoText += `🔧 INTERVENTO ESEGUITO\n`;
                descInterventoText += `═══════════════════════════════════\n\n`;
                descInterventoText += `📋 TICKET: #${ticket.numero}\n`;
                descInterventoText += `📝 Titolo Ticket: ${ticket.titolo || 'N/A'}\n`;
                descInterventoText += `👤 Cliente: ${clientName}\n`;
                descInterventoText += `🔗 Link Ticket: ${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}/ticket/${ticket.id}\n\n`;
                descInterventoText += `───────────────────────────────────\n`;
                descInterventoText += `DETTAGLI INTERVENTO:\n`;
                descInterventoText += `───────────────────────────────────\n`;
                descInterventoText += `📅 Data: ${log.data}\n`;
                if (log.oraInizio) descInterventoText += `⏰ Ora Inizio: ${log.oraInizio}\n`;
                if (log.oraFine) descInterventoText += `⏰ Ora Fine: ${log.oraFine}\n`;
                descInterventoText += `🔧 Modalità: ${modalita}\n`;
                descInterventoText += `⏱️ Ore: ${oreIntervento}h\n`;
                if (descIntervento) {
                  descInterventoText += `\n📄 Descrizione Intervento:\n${descIntervento}\n`;
                }
                
                if (log.materials && Array.isArray(log.materials) && log.materials.length > 0) {
                  const materials = log.materials.filter(m => m && m.nome && m.nome.trim() !== '0' && m.nome.trim() !== '');
                  if (materials.length > 0) {
                    descInterventoText += `\n📦 Materiali Utilizzati:\n`;
                    materials.forEach(m => {
                      const q = parseFloat(m.quantita) || 0;
                      const c = parseFloat(m.costo) || 0;
                      descInterventoText += `- ${m.nome} x${q} (€${(q * c).toFixed(2)})\n`;
                    });
                  }
                }
                
                const interventoEvent = {
                  summary: `🔧 Ticket #${ticket.numero}: ${ticket.titolo || 'Intervento'} - ${modalita}`,
                  description: descInterventoText,
                  start: {
                    dateTime: interventoStartDate.toISOString(),
                    timeZone: 'Europe/Rome'
                  },
                  end: {
                    dateTime: interventoEndDate.toISOString(),
                    timeZone: 'Europe/Rome'
                  },
                  colorId: '10', // Colore viola per gli interventi
                  source: {
                    title: 'TicketApp - Intervento',
                    url: `${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}/ticket/${ticket.id}`
                  },
                  extendedProperties: {
                    private: {
                      ticketId: ticket.id.toString(),
                      timelogIndex: idx.toString(),
                      isIntervento: 'true'
                    }
                  }
                };
                
                // Cerca se esiste già un evento per questo intervento
                const existingEvent = existingInterventiEvents.find(e => 
                  e.extendedProperties?.private?.timelogIndex === idx.toString()
                );
                
                try {
                  if (existingEvent) {
                    await calendar.events.update({
                      calendarId: interventiCalendarId,
                      eventId: existingEvent.id,
                      resource: interventoEvent,
                      sendUpdates: 'none'
                    });
                  } else {
                    const interventoResult = await calendar.events.insert({
                      calendarId: interventiCalendarId,
                      resource: interventoEvent,
                      sendUpdates: 'none',
                      conferenceDataVersion: 0
                    });
                    console.log(`✅ Evento intervento creato per ticket #${ticket.numero}: ${interventoResult.data.id}`);
                  }
                } catch (interventoErr) {
                  console.error(`[UPDATE] Errore creazione evento intervento:`, interventoErr.message);
                }
              } catch (logErr) {
                console.error(`[UPDATE] Errore elaborazione intervento:`, logErr.message);
              }
              }
              
              // Rimuovi eventi intervento che non esistono più nei timelogs
              const validIndices = timelogs.map((_, idx) => idx.toString());
              const eventsToDelete = existingInterventiEvents.filter(e => 
                !validIndices.includes(e.extendedProperties?.private?.timelogIndex)
              );
              
              for (const eventToDelete of eventsToDelete) {
                try {
                  await calendar.events.delete({
                    calendarId: calendarId,
                    eventId: eventToDelete.id,
                    sendUpdates: 'none'
                  });
                } catch (deleteErr) {
                  console.error(`[UPDATE] Errore rimozione evento intervento:`, deleteErr.message);
                }
              }
            }
        } catch (interventiErr) {
          console.error(`[UPDATE] Errore gestione eventi interventi:`, interventiErr.message);
        }
      }); // Fine setImmediate - eventi intervento creati in background
      
      } else if (action === 'delete') {
        // Normalizza eventId da payload o DB
        let eventId = ticket.googleCalendarEventId || ticket.googlecalendareventid;
        if (!eventId && ticket.id) {
          try {
            const dbRes = await pool.query('SELECT googlecalendareventid FROM tickets WHERE id = $1', [ticket.id]);
            eventId = dbRes.rows?.[0]?.googlecalendareventid || null;
          } catch (e) {}
        }
        if (!eventId) {
          return res.status(400).json({ error: 'ID evento mancante per cancellazione' });
        }
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
          eventId
        });
        console.log('Evento cancellato da Google Calendar:', eventId, 'dal calendario:', deleteCalendarId);
        
        // Cancella anche tutti gli eventi intervento associati a questo ticket
        try {
          const eventsList = await calendar.events.list({
            calendarId: deleteCalendarId,
            timeMin: new Date(new Date().getFullYear() - 1, 0, 1).toISOString(),
            timeMax: new Date(new Date().getFullYear() + 1, 11, 31).toISOString(),
            maxResults: 2500,
            singleEvents: true
          });
          
          const interventiEvents = eventsList.data.items?.filter(e => 
            e.extendedProperties?.private?.ticketId === ticket.id.toString() &&
            e.extendedProperties?.private?.isIntervento === 'true'
          ) || [];
          
          console.log(`Trovati ${interventiEvents.length} eventi intervento da cancellare per ticket #${ticket.id}`);
          
          for (const interventoEvent of interventiEvents) {
            try {
              await calendar.events.delete({
                calendarId: deleteCalendarId,
                eventId: interventoEvent.id,
                sendUpdates: 'none'
              });
              console.log(`✅ Evento intervento cancellato: ${interventoEvent.id}`);
            } catch (deleteErr) {
              console.log(`⚠️ Errore cancellazione evento intervento:`, deleteErr.message);
            }
          }
        } catch (interventiErr) {
          console.log('⚠️ Errore cancellazione eventi intervento:', interventiErr.message);
        }
      } else {
        return res.status(400).json({ error: 'Azione non valida o ID evento mancante' });
      }

      // NOTA: La risposta HTTP per 'update' è già stata inviata sopra, prima del setImmediate
      // Per 'create' e 'delete', la risposta viene inviata qui sotto
      if (action === 'create') {
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
      } else if (action === 'delete') {
        res.json({
          success: true,
          message: 'Ticket eliminato da Google Calendar'
        });
      }

    } catch (err) {
      console.error('❌ Errore sincronizzazione Google Calendar:', err);
      console.error('❌ Stack trace:', err.stack);
      console.error('❌ Ticket ID:', ticket?.id);
      console.error('❌ Action:', action);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error code:', err.code);
      res.status(500).json({ 
        success: false,
        error: 'Errore sincronizzazione Google Calendar',
        details: err.message,
        ticketId: ticket?.id,
        action: action
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

  // ENDPOINT: Sincronizza tutti i ticket esistenti con Google Calendar (aggiorna i titoli)
  router.post('/bulk-sync-google-calendar', async (req, res) => {
    try {
      console.log('=== RICHIESTA SINCRONIZZAZIONE MASSA GOOGLE CALENDAR ===');
      
      // Verifica che le credenziali Service Account siano configurate
      if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        console.log('ERRORE: Credenziali Google Service Account non configurate');
        return res.json({
          success: false,
          message: 'Google Service Account non configurato'
        });
      }

      // Inizializza Google Auth
      const authInstance = getAuth();
      if (!authInstance) {
        console.log('ERRORE: Google Auth non disponibile');
        return res.json({
          success: false,
          message: 'Google Auth non configurato'
        });
      }

      const authClient = await authInstance.getClient();
      const calendar = google.calendar({ version: 'v3', auth: authClient });

      // Recupera tutti i ticket dal database
      const client = await pool.connect();
      const ticketsResult = await client.query(`
        SELECT t.*, u.azienda 
        FROM tickets t 
        LEFT JOIN users u ON t.clienteid = u.id 
        WHERE t.googlecalendareventid IS NOT NULL 
        ORDER BY t.dataapertura DESC
      `);
      client.release();

      const tickets = ticketsResult.rows;
      console.log(`Trovati ${tickets.length} ticket con eventi Google Calendar da aggiornare`);

      if (tickets.length === 0) {
        return res.json({
          success: true,
          message: 'Nessun ticket con eventi Google Calendar trovato',
          updated: 0
        });
      }

      // Trova il calendario TicketApp
      let calendarId = 'primary';
      try {
        const calendarList = await calendar.calendarList.list();
        const ticketAppCalendar = calendarList.data.items?.find(cal => cal.summary === 'TicketApp Test Calendar');
        if (ticketAppCalendar) {
          calendarId = ticketAppCalendar.id;
          console.log('Trovato TicketApp Test Calendar:', calendarId);
        }
      } catch (err) {
        console.log('Errore ricerca calendario:', err.message);
      }

      let updatedCount = 0;
      let errorCount = 0;
      const errors = [];

      // Funzione helper per formattare date e ore
      const formatDateTime = (date) => {
        return date.toLocaleString('it-IT', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Rome'
        });
      };

      // Funzione per ottenere il colore della priorità
      const getPriorityColorId = (priorita) => {
        switch (priorita?.toLowerCase()) {
          case 'urgente': return '11'; // Rosso
          case 'alta': return '6'; // Arancione
          case 'media': return '5'; // Giallo
          case 'bassa': return '10'; // Verde
          default: return '1'; // Blu
        }
      };

      // Aggiorna ogni ticket
      for (const ticket of tickets) {
        try {
          console.log(`Aggiornando ticket #${ticket.numero} (${ticket.azienda || 'Cliente Sconosciuto'})...`);
          
          // Prepara le date (robusto come nel singolo endpoint)
          let startDate;
          if (ticket.dataapertura) {
            if (typeof ticket.dataapertura === 'string') {
              if (ticket.dataapertura.includes('T') && ticket.dataapertura.includes('+')) {
                startDate = new Date(ticket.dataapertura);
              } else if (ticket.dataapertura.includes('T')) {
                startDate = new Date(ticket.dataapertura + '+02:00');
              } else {
                startDate = new Date(ticket.dataapertura + 'T00:00:00+02:00');
              }
            } else {
              // Oggetto Date o altro tipo: fallback
              try { startDate = new Date(ticket.dataapertura); } catch { startDate = new Date(); }
            }
            if (!startDate || isNaN(startDate.getTime())) {
              startDate = new Date();
            }
          } else if (ticket.created_at) {
            startDate = new Date(ticket.created_at);
            if (isNaN(startDate.getTime())) {
              startDate = new Date();
            }
          } else {
            startDate = new Date();
          }

          const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000)); // +2 ore

          // Costruisci la descrizione dettagliata (include registro intervento, materiali e offerte)
          let description = `TITOLO: ${ticket.titolo}\n`;
          description += `PRIORITÀ: ${ticket.priorita?.toUpperCase()}\n`;
          description += `STATO: ${ticket.stato?.toUpperCase()}\n`;
          description += `DESCRIZIONE: ${ticket.descrizione || ''}\n`;
          description += `APERTURA: ${formatDateTime(startDate)}\n`;

          try {
            let timelogs = ticket.timelogs;
            if (typeof timelogs === 'string') {
              try { timelogs = JSON.parse(timelogs); } catch { timelogs = []; }
            }
            if (Array.isArray(timelogs) && timelogs.length > 0) {
              description += `\n— REGISTRO INTERVENTO —\n`;
              timelogs.forEach((log, idx) => {
                const modalita = log.modalita || '';
                const dataLog = log.data || '';
                const oraInizio = log.oraInizio || '';
                const oraFine = log.oraFine || '';
                const desc = (log.descrizione || '').replace(/\n/g, ' ');
                const ore = parseFloat(log.oreIntervento) || 0;
                const costoUnit = parseFloat(log.costoUnitario) || 0;
                const sconto = parseFloat(log.sconto) || 0;
                const lavoroTot = ore * costoUnit * (1 - sconto / 100);

                const materials = Array.isArray(log.materials) ? log.materials : [];
                const matsStr = materials
                  .filter(m => m && m.nome)
                  .map(m => {
                    const q = parseFloat(m.quantita) || 0;
                    const c = parseFloat(m.costo) || 0;
                    return `${m.nome} x${q} (${(q * c).toFixed(2)}€)`;
                  })
                  .join(', ');
                const matsTot = materials.reduce((sum, m) => sum + ((parseFloat(m.quantita) || 0) * (parseFloat(m.costo) || 0)), 0);

                const offerte = Array.isArray(log.offerte) ? log.offerte : [];
                const offerteStr = offerte
                  .map(o => {
                    const tot = parseFloat(o.totale) || 0;
                    return `${o.numeroOfferta || 'Offerta'}: ${tot.toFixed(2)}€`;
                  })
                  .join(', ');
                const offerteTot = offerte.reduce((sum, o) => sum + (parseFloat(o.totale) || 0), 0);

                const totaleLog = lavoroTot + matsTot + offerteTot;

                description += `#${idx + 1} ${modalita} — ${dataLog} ${oraInizio ? `(${oraInizio}` : ''}${oraFine ? `-${oraFine})` : (oraInizio ? ')' : '')}\n`;
                if (desc) description += `  Descrizione: ${desc}\n`;
                description += `  Lavoro: ${ore}h x ${(costoUnit || 0).toFixed(2)}€ (-${(sconto || 0)}%) = ${lavoroTot.toFixed(2)}€\n`;
                if (matsStr) description += `  Materiali: ${matsStr} — Tot: ${matsTot.toFixed(2)}€\n`;
                if (offerteStr) description += `  Offerte: ${offerteStr} — Tot: ${offerteTot.toFixed(2)}€\n`;
                description += `  Totale riga: ${totaleLog.toFixed(2)}€\n`;
              });
            }
          } catch (_) {}
          
          // Aggiungi data di chiusura se il ticket è chiuso
          if (ticket.stato === 'chiuso' && ticket.dataChiusura) {
            const chiusuraDate = new Date(ticket.dataChiusura);
            description += `CHIUSURA: ${formatDateTime(chiusuraDate)}\n`;
          }

          // NON aggiorniamo l'evento principale - deve rimanere sempre alla data di apertura originale
          // Solo gestiamo gli interventi (timelogs)
          console.log(`✅ Ticket #${ticket.numero} - gestione interventi`);
          
          // Crea/Aggiorna eventi per gli interventi (timelogs)
          try {
            let timelogs = ticket.timelogs;
            if (typeof timelogs === 'string') {
              try { timelogs = JSON.parse(timelogs); } catch { timelogs = []; }
            }
            if (Array.isArray(timelogs) && timelogs.length > 0) {
              console.log(`  Creazione/Aggiornamento eventi per ${timelogs.length} interventi...`);
              
              // Cerca eventi intervento esistenti per questo ticket
              let existingInterventiEvents = [];
              try {
                const eventsList = await calendar.events.list({
                  calendarId: calendarId,
                  timeMin: new Date(new Date().getFullYear() - 1, 0, 1).toISOString(),
                  timeMax: new Date(new Date().getFullYear() + 1, 11, 31).toISOString(),
                  maxResults: 2500,
                  singleEvents: true
                });
                
                existingInterventiEvents = eventsList.data.items?.filter(e => 
                  e.extendedProperties?.private?.ticketId === ticket.id.toString() &&
                  e.extendedProperties?.private?.isIntervento === 'true'
                ) || [];
                console.log(`  Trovati ${existingInterventiEvents.length} eventi intervento esistenti`);
              } catch (searchErr) {
                console.log(`  ⚠️ Errore ricerca eventi intervento esistenti:`, searchErr.message);
              }
              
              const clientName = ticket.azienda || 'Cliente Sconosciuto';
              
              for (const [idx, log] of timelogs.entries()) {
                if (!log.data) {
                  continue;
                }
                
                // Prepara data e ora dell'intervento
                let interventoStartDate;
                let interventoEndDate;
                
                if (log.data.includes('T')) {
                  interventoStartDate = new Date(log.data);
                } else {
                  const oraInizio = log.oraInizio || '09:00';
                  interventoStartDate = new Date(log.data + 'T' + oraInizio + ':00+02:00');
                }
                
                if (isNaN(interventoStartDate.getTime())) {
                  continue;
                }
                
                if (log.oraFine) {
                  const oraFine = log.oraFine;
                  const dateStr = log.data.includes('T') ? log.data.split('T')[0] : log.data;
                  interventoEndDate = new Date(dateStr + 'T' + oraFine + ':00+02:00');
                } else {
                  const ore = parseFloat(log.oreIntervento) || 1;
                  interventoEndDate = new Date(interventoStartDate.getTime() + ore * 60 * 60 * 1000);
                }
                
                if (isNaN(interventoEndDate.getTime())) {
                  interventoEndDate = new Date(interventoStartDate.getTime() + 60 * 60 * 1000);
                }
                
                const modalita = log.modalita || 'Intervento';
                const descIntervento = log.descrizione || '';
                const oreIntervento = parseFloat(log.oreIntervento) || 0;
                
                let descInterventoText = `INTERVENTO ESEGUITO\n`;
                descInterventoText += `Ticket: #${ticket.numero}\n`;
                descInterventoText += `Cliente: ${clientName}\n`;
                descInterventoText += `Modalità: ${modalita}\n`;
                descInterventoText += `Ore: ${oreIntervento}h\n`;
                if (descIntervento) {
                  descInterventoText += `Descrizione: ${descIntervento}\n`;
                }
                
                if (log.materials && Array.isArray(log.materials) && log.materials.length > 0) {
                  const materials = log.materials.filter(m => m && m.nome && m.nome.trim() !== '0' && m.nome.trim() !== '');
                  if (materials.length > 0) {
                    descInterventoText += `\nMateriali:\n`;
                    materials.forEach(m => {
                      const q = parseFloat(m.quantita) || 0;
                      const c = parseFloat(m.costo) || 0;
                      descInterventoText += `- ${m.nome} x${q} (€${(q * c).toFixed(2)})\n`;
                    });
                  }
                }
                
                const interventoEvent = {
                  summary: `🔧 Intervento: Ticket #${ticket.numero} - ${modalita}`,
                  description: descInterventoText,
                  start: {
                    dateTime: interventoStartDate.toISOString(),
                    timeZone: 'Europe/Rome'
                  },
                  end: {
                    dateTime: interventoEndDate.toISOString(),
                    timeZone: 'Europe/Rome'
                  },
                  colorId: '10', // Colore viola per gli interventi
                  source: {
                    title: 'TicketApp - Intervento',
                    url: `${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}/ticket/${ticket.id}`
                  },
                  extendedProperties: {
                    private: {
                      ticketId: ticket.id.toString(),
                      timelogIndex: idx.toString(),
                      isIntervento: 'true'
                    }
                  }
                };
                
                // Cerca se esiste già un evento per questo intervento
                const existingEvent = existingInterventiEvents.find(e => 
                  e.extendedProperties?.private?.timelogIndex === idx.toString()
                );
                
                try {
                  if (existingEvent) {
                    // Aggiorna evento esistente
                    await calendar.events.update({
                      calendarId: calendarId,
                      eventId: existingEvent.id,
                      resource: interventoEvent,
                      sendUpdates: 'none'
                    });
                    console.log(`  ✅ Evento intervento #${idx + 1} aggiornato`);
                  } else {
                    // Crea nuovo evento
                    const interventoResult = await calendar.events.insert({
                      calendarId: calendarId,
                      resource: interventoEvent,
                      sendUpdates: 'none',
                      conferenceDataVersion: 0
                    });
                    console.log(`  ✅ Evento intervento #${idx + 1} creato: ${interventoResult.data.id}`);
                  }
                } catch (interventoErr) {
                  console.log(`  ⚠️ Errore aggiornamento/creazione evento intervento #${idx + 1}:`, interventoErr.message);
                }
              }
              
              // Rimuovi eventi intervento che non esistono più nei timelogs
              const validIndices = timelogs.map((_, idx) => idx.toString());
              const eventsToDelete = existingInterventiEvents.filter(e => 
                !validIndices.includes(e.extendedProperties?.private?.timelogIndex)
              );
              
              for (const eventToDelete of eventsToDelete) {
                try {
                  await calendar.events.delete({
                    calendarId: calendarId,
                    eventId: eventToDelete.id,
                    sendUpdates: 'none'
                  });
                  console.log(`  ✅ Evento intervento rimosso: ${eventToDelete.id}`);
                } catch (deleteErr) {
                  console.log(`  ⚠️ Errore rimozione evento intervento:`, deleteErr.message);
                }
              }
            }
          } catch (interventiErr) {
            console.log(`  ⚠️ Errore gestione eventi interventi:`, interventiErr.message);
          }
          
          updatedCount++;
          
          // Piccola pausa per evitare rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (err) {
          console.error(`❌ Errore aggiornamento ticket #${ticket.numero}:`, err.message);
          errors.push({
            ticketId: ticket.id,
            numero: ticket.numero,
            error: err.message
          });
          errorCount++;
        }
      }

      console.log(`=== SINCRONIZZAZIONE MASSA COMPLETATA ===`);
      console.log(`Aggiornati: ${updatedCount}`);
      console.log(`Errori: ${errorCount}`);

      res.json({
        success: true,
        message: `Sincronizzazione massa completata`,
        updated: updatedCount,
        errors: errorCount,
        errorDetails: errors
      });

    } catch (err) {
      console.error('Errore sincronizzazione massa Google Calendar:', err);
      res.status(500).json({
        success: false,
        message: 'Errore interno del server',
        error: err.message
      });
    }
  });

  // ENDPOINT: Sincronizza interventi mancanti (timelogs senza eventi Google Calendar)
  router.post('/sync-missing-interventi', async (req, res) => {
    try {
      console.log('=== SINCRONIZZAZIONE INTERVENTI MANCANTI ===');
      
      // Verifica credenziali
      if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        return res.json({
          success: false,
          message: 'Google Service Account non configurato'
        });
      }

      const authInstance = getAuth();
      if (!authInstance) {
        return res.json({
          success: false,
          message: 'Google Auth non configurato'
        });
      }

      const authClient = await authInstance.getClient();
      const calendar = google.calendar({ version: 'v3', auth: authClient });

      // Trova calendario corretto
      let calendarId = 'primary';
      try {
        const calendarList = await calendar.calendarList.list();
        const ticketAppCalendar = calendarList.data.items?.find(cal => cal.summary === 'TicketApp Test Calendar');
        if (ticketAppCalendar) {
          calendarId = ticketAppCalendar.id;
        } else if (calendarList.data.items && calendarList.data.items.length > 0) {
          calendarId = calendarList.data.items[0].id;
        }
      } catch (calErr) {
        console.error('Errore ricerca calendario:', calErr.message);
      }

      // Recupera tutti i ticket con timelogs
      const client = await pool.connect();
      const ticketsResult = await client.query(`
        SELECT t.*, u.azienda 
        FROM tickets t 
        LEFT JOIN users u ON t.clienteid = u.id 
        WHERE t.timelogs IS NOT NULL 
          AND t.timelogs != '[]' 
          AND t.timelogs != ''
        ORDER BY t.dataapertura DESC
      `);
      client.release();

      const tickets = ticketsResult.rows;
      console.log(`Trovati ${tickets.length} ticket con timelogs da verificare`);

      if (tickets.length === 0) {
        return res.json({
          success: true,
          message: 'Nessun ticket con timelogs trovato',
          synced: 0,
          errors: 0
        });
      }

      let syncedCount = 0;
      let errorCount = 0;
      const errors = [];

      // Funzione helper per creare evento intervento
      const createInterventoEvent = async (ticket, log, idx, clientName) => {
        if (!log.data) return null;

        let interventoStartDate;
        if (log.data.includes('T')) {
          interventoStartDate = new Date(log.data);
        } else {
          const oraInizio = log.oraInizio || '09:00';
          interventoStartDate = new Date(log.data + 'T' + oraInizio + ':00+02:00');
        }

        if (isNaN(interventoStartDate.getTime())) return null;

        let interventoEndDate;
        if (log.oraFine) {
          const dateStr = log.data.includes('T') ? log.data.split('T')[0] : log.data;
          interventoEndDate = new Date(dateStr + 'T' + log.oraFine + ':00+02:00');
        } else {
          const ore = parseFloat(log.oreIntervento) || 1;
          interventoEndDate = new Date(interventoStartDate.getTime() + ore * 60 * 60 * 1000);
        }

        if (isNaN(interventoEndDate.getTime())) {
          interventoEndDate = new Date(interventoStartDate.getTime() + 60 * 60 * 1000);
        }

        const modalita = log.modalita || 'Intervento';
        const descIntervento = log.descrizione || '';
        const oreIntervento = parseFloat(log.oreIntervento) || 0;

        let descInterventoText = `═══════════════════════════════════\n`;
        descInterventoText += `🔧 INTERVENTO ESEGUITO\n`;
        descInterventoText += `═══════════════════════════════════\n\n`;
        descInterventoText += `📋 TICKET: #${ticket.numero}\n`;
        descInterventoText += `📝 Titolo Ticket: ${ticket.titolo || 'N/A'}\n`;
        descInterventoText += `👤 Cliente: ${clientName}\n`;
        descInterventoText += `🔗 Link Ticket: ${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}/ticket/${ticket.id}\n\n`;
        descInterventoText += `───────────────────────────────────\n`;
        descInterventoText += `DETTAGLI INTERVENTO:\n`;
        descInterventoText += `───────────────────────────────────\n`;
        descInterventoText += `📅 Data: ${log.data}\n`;
        if (log.oraInizio) descInterventoText += `⏰ Ora Inizio: ${log.oraInizio}\n`;
        if (log.oraFine) descInterventoText += `⏰ Ora Fine: ${log.oraFine}\n`;
        descInterventoText += `🔧 Modalità: ${modalita}\n`;
        descInterventoText += `⏱️ Ore: ${oreIntervento}h\n`;
        if (descIntervento) {
          descInterventoText += `\n📄 Descrizione Intervento:\n${descIntervento}\n`;
        }

        if (log.materials && Array.isArray(log.materials) && log.materials.length > 0) {
          const materials = log.materials.filter(m => m && m.nome && m.nome.trim() !== '0' && m.nome.trim() !== '');
          if (materials.length > 0) {
            descInterventoText += `\n📦 Materiali Utilizzati:\n`;
            materials.forEach(m => {
              const q = parseFloat(m.quantita) || 0;
              const c = parseFloat(m.costo) || 0;
              descInterventoText += `- ${m.nome} x${q} (€${(q * c).toFixed(2)})\n`;
            });
          }
        }

        const interventoEvent = {
          summary: `🔧 Ticket #${ticket.numero}: ${ticket.titolo || 'Intervento'} - ${modalita}`,
          description: descInterventoText,
          start: {
            dateTime: interventoStartDate.toISOString(),
            timeZone: 'Europe/Rome'
          },
          end: {
            dateTime: interventoEndDate.toISOString(),
            timeZone: 'Europe/Rome'
          },
          colorId: '10',
          source: {
            title: 'TicketApp - Intervento',
            url: `${process.env.FRONTEND_URL || 'https://ticketapp-frontend-ton5.onrender.com'}/ticket/${ticket.id}`
          },
          extendedProperties: {
            private: {
              ticketId: ticket.id.toString(),
              timelogIndex: idx.toString(),
              isIntervento: 'true'
            }
          }
        };

        return await calendar.events.insert({
          calendarId: calendarId,
          resource: interventoEvent,
          sendUpdates: 'none',
          conferenceDataVersion: 0
        });
      };

      // Per ogni ticket, verifica e crea eventi intervento mancanti
      for (const ticket of tickets) {
        try {
          // Parsa timelogs
          let timelogs = ticket.timelogs;
          if (typeof timelogs === 'string') {
            try {
              timelogs = JSON.parse(timelogs);
            } catch {
              continue;
            }
          }

          if (!Array.isArray(timelogs) || timelogs.length === 0) {
            continue;
          }

          // Cerca eventi intervento esistenti per questo ticket
          let existingInterventiEvents = [];
          try {
            const eventsList = await calendar.events.list({
              calendarId: calendarId,
              timeMin: new Date(new Date().getFullYear() - 1, 0, 1).toISOString(),
              timeMax: new Date(new Date().getFullYear() + 1, 11, 31).toISOString(),
              maxResults: 2500,
              singleEvents: true
            });

            existingInterventiEvents = eventsList.data.items?.filter(e =>
              e.extendedProperties?.private?.ticketId === ticket.id.toString() &&
              e.extendedProperties?.private?.isIntervento === 'true'
            ) || [];
          } catch (searchErr) {
            console.error(`Errore ricerca eventi per ticket #${ticket.numero}:`, searchErr.message);
            continue;
          }

          const clientName = ticket.azienda || 'Cliente Sconosciuto';
          let ticketSynced = 0;

          // Crea eventi per timelogs che non hanno ancora un evento
          for (const [idx, log] of timelogs.entries()) {
            const existingEvent = existingInterventiEvents.find(e =>
              e.extendedProperties?.private?.timelogIndex === idx.toString()
            );

            if (!existingEvent && log.data) {
              try {
                await createInterventoEvent(ticket, log, idx, clientName);
                ticketSynced++;
                syncedCount++;
                console.log(`✅ Evento intervento creato per ticket #${ticket.numero}, intervento #${idx + 1}`);
              } catch (createErr) {
                errorCount++;
                errors.push({
                  ticketId: ticket.id,
                  numero: ticket.numero,
                  interventoIndex: idx + 1,
                  error: createErr.message
                });
                console.error(`❌ Errore creazione evento per ticket #${ticket.numero}, intervento #${idx + 1}:`, createErr.message);
              }
            }
          }

          if (ticketSynced > 0) {
            console.log(`✅ Ticket #${ticket.numero}: creati ${ticketSynced} eventi intervento`);
          }
        } catch (ticketErr) {
          errorCount++;
          errors.push({
            ticketId: ticket.id,
            numero: ticket.numero,
            error: ticketErr.message
          });
          console.error(`❌ Errore elaborazione ticket #${ticket.numero}:`, ticketErr.message);
        }
      }

      console.log(`=== SINCRONIZZAZIONE INTERVENTI COMPLETATA ===`);
      console.log(`Eventi creati: ${syncedCount}`);
      console.log(`Errori: ${errorCount}`);

      res.json({
        success: true,
        message: 'Sincronizzazione interventi completata',
        synced: syncedCount,
        errors: errorCount,
        errorDetails: errors.length > 0 ? errors : undefined
      });
    } catch (err) {
      console.error('Errore sincronizzazione interventi mancanti:', err);
      res.status(500).json({
        success: false,
        message: 'Errore interno del server',
        error: err.message
      });
    }
  });

  // ENDPOINT: Risincronizza tutti gli eventi ticket alla data di apertura originale
  router.post('/resync-tickets-to-original-date', async (req, res) => {
    try {
      console.log('=== RISINCRONIZZAZIONE EVENTI TICKET ALLA DATA ORIGINALE ===');
      
      // Verifica credenziali
      if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        return res.json({
          success: false,
          message: 'Google Service Account non configurato'
        });
      }

      const authInstance = getAuth();
      if (!authInstance) {
        return res.json({
          success: false,
          message: 'Google Auth non configurato'
        });
      }

      const authClient = await authInstance.getClient();
      const calendar = google.calendar({ version: 'v3', auth: authClient });

      // Trova calendario corretto
      let calendarId = 'primary';
      try {
        const calendarList = await calendar.calendarList.list();
        const ticketAppCalendar = calendarList.data.items?.find(cal => cal.summary === 'TicketApp Test Calendar');
        if (ticketAppCalendar) {
          calendarId = ticketAppCalendar.id;
        } else if (calendarList.data.items && calendarList.data.items.length > 0) {
          calendarId = calendarList.data.items[0].id;
        }
      } catch (calErr) {
        console.error('Errore ricerca calendario:', calErr.message);
      }

      // Recupera tutti i ticket con eventi Google Calendar
      const client = await pool.connect();
      const ticketsResult = await client.query(`
        SELECT t.*, u.azienda 
        FROM tickets t 
        LEFT JOIN users u ON t.clienteid = u.id 
        WHERE t.googlecalendareventid IS NOT NULL 
        ORDER BY t.dataapertura DESC
      `);
      client.release();

      const tickets = ticketsResult.rows;
      console.log(`Trovati ${tickets.length} ticket con eventi Google Calendar da risincronizzare`);

      if (tickets.length === 0) {
        return res.json({
          success: true,
          message: 'Nessun ticket con eventi Google Calendar trovato',
          resynced: 0
        });
      }

      let resyncedCount = 0;
      let errorCount = 0;
      const errors = [];

      // Funzione helper per formattare date
      const formatDateTime = (date) => {
        return date.toLocaleString('it-IT', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Rome'
        });
      };

      // Funzione per ottenere il colore della priorità
      const getPriorityColorId = (priorita) => {
        switch (priorita?.toLowerCase()) {
          case 'urgente': return '11';
          case 'alta': return '6';
          case 'media': return '5';
          case 'bassa': return '10';
          default: return '1';
        }
      };

      // Risincronizza ogni ticket alla data di apertura originale
      for (const ticket of tickets) {
        try {
          // Prepara la data di apertura originale
          let startDate;
          if (ticket.dataapertura) {
            if (typeof ticket.dataapertura === 'string') {
              if (ticket.dataapertura.includes('T') && ticket.dataapertura.includes('+')) {
                startDate = new Date(ticket.dataapertura);
              } else if (ticket.dataapertura.includes('T')) {
                startDate = new Date(ticket.dataapertura + '+02:00');
              } else {
                startDate = new Date(ticket.dataapertura + 'T00:00:00+02:00');
              }
            } else {
              try { startDate = new Date(ticket.dataapertura); } catch { startDate = new Date(); }
            }
            if (!startDate || isNaN(startDate.getTime())) {
              startDate = new Date();
            }
          } else if (ticket.created_at) {
            startDate = new Date(ticket.created_at);
            if (isNaN(startDate.getTime())) {
              startDate = new Date();
            }
          } else {
            startDate = new Date();
          }

          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 ora dopo

          // Costruisci descrizione (solo info base, senza stato aggiornato)
          let description = `TITOLO: ${ticket.titolo}\n`;
          description += `PRIORITÀ: ${ticket.priorita?.toUpperCase()}\n`;
          description += `DESCRIZIONE: ${ticket.descrizione || ''}\n`;
          description += `APERTURA: ${formatDateTime(startDate)}\n`;

          // Aggiungi timelogs se presenti (solo per info, non per creare eventi)
          try {
            let timelogs = ticket.timelogs;
            if (typeof timelogs === 'string') {
              try { timelogs = JSON.parse(timelogs); } catch { timelogs = []; }
            }
            if (Array.isArray(timelogs) && timelogs.length > 0) {
              description += `\n— REGISTRO INTERVENTO —\n`;
              timelogs.forEach((log, idx) => {
                const modalita = log.modalita || '';
                const dataLog = log.data || '';
                const oraInizio = log.oraInizio || '';
                const oraFine = log.oraFine || '';
                const desc = (log.descrizione || '').replace(/\n/g, ' ');
                const ore = parseFloat(log.oreIntervento) || 0;
                description += `#${idx + 1} ${modalita} — ${dataLog} ${oraInizio ? `(${oraInizio}` : ''}${oraFine ? `-${oraFine})` : (oraInizio ? ')' : '')}\n`;
                if (desc) description += `  Descrizione: ${desc}\n`;
                description += `  Ore: ${ore}h\n`;
              });
            }
          } catch (_) {}

          const event = {
            summary: `Ticket ${ticket.numero} - ${ticket.azienda || 'Cliente Sconosciuto'}`,
            description: description,
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

          // Aggiorna l'evento alla data di apertura originale
          await calendar.events.update({
            calendarId: calendarId,
            eventId: ticket.googlecalendareventid,
            resource: event
          });

          console.log(`✅ Ticket #${ticket.numero} risincronizzato alla data originale: ${formatDateTime(startDate)}`);
          resyncedCount++;

          // Piccola pausa per evitare rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`❌ Errore risincronizzazione ticket #${ticket.numero}:`, err.message);
          errors.push({
            ticketId: ticket.id,
            numero: ticket.numero,
            error: err.message
          });
          errorCount++;
        }
      }

      console.log(`=== RISINCRONIZZAZIONE COMPLETATA ===`);
      console.log(`Risincronizzati: ${resyncedCount}`);
      console.log(`Errori: ${errorCount}`);

      res.json({
        success: true,
        message: 'Risincronizzazione completata',
        resynced: resyncedCount,
        errors: errorCount,
        errorDetails: errors.length > 0 ? errors : undefined
      });
    } catch (err) {
      console.error('Errore risincronizzazione eventi ticket:', err);
      res.status(500).json({
        success: false,
        message: 'Errore interno del server',
        error: err.message
      });
    }
  });

  return router;
};
