// Script per sincronizzare direttamente gli interventi mancanti su Google Calendar
// Esegue il codice direttamente sul server senza passare per HTTP
// Uso: node backend/scripts/sync-missing-interventi-direct.js

// Prova a caricare .env da diverse posizioni
const path = require('path');
const fs = require('fs');

// Prova backend/.env prima
const backendEnvPath = path.join(__dirname, '../.env');
if (fs.existsSync(backendEnvPath)) {
  require('dotenv').config({ path: backendEnvPath });
} else {
  // Prova root/.env
  const rootEnvPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(rootEnvPath)) {
    require('dotenv').config({ path: rootEnvPath });
  } else {
    // Fallback: carica da process.env (variabili d'ambiente del sistema)
    console.log('⚠️ File .env non trovato, uso variabili d\'ambiente del sistema');
  }
}

const { Pool } = require('pg');
const { google } = require('googleapis');

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

// Configurazione Google Calendar
const getAuth = () => {
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.log('⚠️ Credenziali Google Service Account non complete');
    return null;
  }
  
  try {
    return new google.auth.GoogleAuth({
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
  } catch (err) {
    console.error('❌ Errore inizializzazione Google Auth:', err);
    return null;
  }
};

async function syncMissingInterventi() {
  try {
    console.log('=== SINCRONIZZAZIONE INTERVENTI MANCANTI ===\n');
    
    // Verifica credenziali
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.log('❌ Google Service Account non configurato');
      return;
    }

    const authInstance = getAuth();
    if (!authInstance) {
      console.log('❌ Google Auth non configurato');
      return;
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
        console.log(`✅ Trovato calendario: ${ticketAppCalendar.summary} (${calendarId})`);
      } else if (calendarList.data.items && calendarList.data.items.length > 0) {
        calendarId = calendarList.data.items[0].id;
        console.log(`✅ Usando calendario: ${calendarList.data.items[0].summary} (${calendarId})`);
      }
    } catch (calErr) {
      console.error('❌ Errore ricerca calendario:', calErr.message);
    }

    // Recupera tutti i ticket con timelogs
    // Leggiamo timelogs come testo per evitare errori JSON PostgreSQL
    const client = await pool.connect();
    const ticketsResult = await client.query(`
      SELECT t.id, t.numero, t.titolo, t.descrizione, t.stato, t.priorita, 
             t.clienteid, t.dataapertura, t.categoria,
             t.timelogs::text as timelogs_text, u.azienda 
      FROM tickets t 
      LEFT JOIN users u ON t.clienteid = u.id 
      WHERE t.timelogs IS NOT NULL 
        AND t.timelogs::text != '[]' 
        AND t.timelogs::text != ''
        AND t.timelogs::text != 'null'
      ORDER BY t.dataapertura DESC
    `);
    client.release();

    // Parsa timelogs in JavaScript con gestione errori
    const tickets = ticketsResult.rows.map(row => {
      const ticket = { ...row };
      try {
        ticket.timelogs = JSON.parse(row.timelogs_text || '[]');
      } catch (err) {
        console.warn(`⚠️  Ticket #${row.numero || row.id}: timelogs JSON invalido, salto`);
        ticket.timelogs = [];
      }
      delete ticket.timelogs_text;
      return ticket;
    }).filter(t => Array.isArray(t.timelogs) && t.timelogs.length > 0);
    console.log(`📋 Trovati ${tickets.length} ticket con timelogs da verificare\n`);

    if (tickets.length === 0) {
      console.log('✅ Nessun ticket con timelogs trovato');
      return;
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
      descInterventoText += `🔗 Link Ticket: ${process.env.FRONTEND_URL || 'https://ticket.logikaservice.it'}/ticket/${ticket.id}\n\n`;
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
          url: `${process.env.FRONTEND_URL || 'https://ticket.logikaservice.it'}/ticket/${ticket.id}`
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
          console.error(`❌ Errore ricerca eventi per ticket #${ticket.numero}:`, searchErr.message);
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

    console.log(`\n=== SINCRONIZZAZIONE INTERVENTI COMPLETATA ===`);
    console.log(`✅ Eventi creati: ${syncedCount}`);
    console.log(`❌ Errori: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️ Dettagli errori:`);
      errors.forEach((error, idx) => {
        console.log(`  ${idx + 1}. Ticket #${error.numero || error.ticketId}${error.interventoIndex ? `, Intervento #${error.interventoIndex}` : ''}: ${error.error}`);
      });
    }

    await pool.end();
  } catch (err) {
    console.error('❌ Errore sincronizzazione interventi mancanti:', err);
    await pool.end();
    process.exit(1);
  }
}

syncMissingInterventi();
