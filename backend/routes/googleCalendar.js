// routes/googleCalendar.js

const express = require('express');
const { google } = require('googleapis');

module.exports = (pool) => {
  const router = express.Router();

  // Configurazione Google Calendar API
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000'
  );

  // Imposta le credenziali (token di servizio)
  oauth2Client.setCredentials({
    access_token: process.env.GOOGLE_ACCESS_TOKEN,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  // ENDPOINT: Sincronizza ticket con Google Calendar
  router.post('/sync-google-calendar', async (req, res) => {
    try {
      const { ticket, action } = req.body;

      if (!ticket) {
        return res.status(400).json({ error: 'Ticket non fornito' });
      }

      // Crea evento Google Calendar
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Gestisci diversi formati di data
      let startDate;
      if (ticket.dataApertura) {
        const dateFormats = [
          ticket.dataApertura,
          new Date(ticket.dataApertura),
          new Date(ticket.dataApertura.replace(/-/g, '/')),
          new Date(ticket.dataApertura + 'T00:00:00'),
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
      } else {
        startDate = new Date();
      }

      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 ora dopo

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

      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event
      });

      console.log('Ticket #' + ticket.id + ' sincronizzato con Google Calendar via backend');
      
      res.json({
        success: true,
        eventId: response.data.id,
        message: 'Ticket sincronizzato con Google Calendar'
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
