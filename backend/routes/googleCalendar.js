// routes/googleCalendar.js

const express = require('express');
const { google } = require('googleapis');

module.exports = (pool) => {
  const router = express.Router();

  // Configurazione Google Calendar API con OAuth2 (temporanea)
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://ticketapp-frontend-ton5.onrender.com'
  );

  // ENDPOINT: Sincronizza ticket con Google Calendar
  router.post('/sync-google-calendar', async (req, res) => {
    try {
      const { ticket, action, tokens } = req.body;

      if (!ticket) {
        return res.status(400).json({ error: 'Ticket non fornito' });
      }

      // Verifica che le credenziali OAuth2 siano configurate
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.log('Credenziali Google OAuth2 non configurate, sincronizzazione saltata');
        return res.json({
          success: false,
          message: 'Google OAuth2 non configurato'
        });
      }

      // Usa OAuth2 client per sincronizzazione
      const oauth2Client = auth;
      
      // Imposta i token OAuth2 se forniti
      if (tokens) {
        oauth2Client.setCredentials(tokens);
        console.log('OAuth2 tokens impostati per l\'utente');
      } else {
        console.log('Nessun token OAuth2 fornito, usando credenziali di default');
      }
      
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Verifica il Calendar ID reale
      console.log('Using calendarId: primary');
      console.log('OAuth2 client email:', oauth2Client.credentials?.client_email);

      // Gestisci diversi formati di data
      let startDate;
      if (ticket.dataapertura) {
        const dateFormats = [
          ticket.dataapertura,
          new Date(ticket.dataapertura),
          new Date(ticket.dataapertura.replace(/-/g, '/')),
          new Date(ticket.dataapertura + 'T00:00:00'),
        ];
        
        for (const dateFormat of dateFormats) {
          const testDate = new Date(dateFormat);
          if (!isNaN(testDate.getTime())) {
            startDate = testDate;
            break;
          }
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
      if (action === 'create') {
        // Test: prova a ottenere la lista dei calendari per verificare l'accesso
        try {
          const calendarList = await calendar.calendarList.list();
          console.log('Available calendars:', calendarList.data.items?.map(cal => ({
            id: cal.id,
            summary: cal.summary,
            primary: cal.primary
          })));
        } catch (err) {
          console.log('Error getting calendar list:', err.message);
        }

        result = await calendar.events.insert({
          calendarId: 'primary',
          resource: event
        });
      } else if (action === 'update' && ticket.googleCalendarEventId) {
        result = await calendar.events.update({
          calendarId: 'primary',
          eventId: ticket.googleCalendarEventId,
          resource: event
        });
      } else if (action === 'delete' && ticket.googleCalendarEventId) {
        // Cancella l'evento da Google Calendar
        result = await calendar.events.delete({
          calendarId: 'primary',
          eventId: ticket.googleCalendarEventId
        });
        console.log('Evento cancellato da Google Calendar:', ticket.googleCalendarEventId);
      } else {
        return res.status(400).json({ error: 'Azione non valida o ID evento mancante' });
      }

      console.log('Ticket #' + ticket.id + ' sincronizzato con Google Calendar via backend');
      console.log('Event details:', {
        summary: event.summary,
        start: event.start,
        end: event.end,
        calendarId: 'primary',
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

  return router;
};
