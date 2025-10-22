import { useState, useEffect } from 'react';
import { GOOGLE_CONFIG, PRIORITY_COLORS } from '../config/googleConfig';

export const useGoogleCalendar = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Carica Google Calendar API
  useEffect(() => {
    const loadGoogleAPI = () => {
      return new Promise((resolve, reject) => {
        if (window.gapi) {
          resolve();
          return;
        }

            // Verifica se le credenziali sono configurate
            if (!GOOGLE_CONFIG.CLIENT_ID) {
              console.error('Google Client ID non configurato:', GOOGLE_CONFIG.CLIENT_ID);
              setError('Google Calendar non configurato. Contatta l\'amministratore per configurare le credenziali Google.');
              reject(new Error('Google Client ID non configurato. Verifica le variabili d\'ambiente.'));
              return;
            }
        
        console.log('Google Client ID configurato:', GOOGLE_CONFIG.CLIENT_ID);

        // Carica Google API script
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.async = true;
        script.defer = true;
        
        // Carica anche Google Identity Services
        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.async = true;
        gisScript.defer = true;
        let scriptsLoaded = 0;
        const totalScripts = 2;
        
        const checkAllLoaded = () => {
          scriptsLoaded++;
          if (scriptsLoaded === totalScripts) {
            console.log('Tutti gli script Google caricati con successo');
            
            // Inizializza solo il client, senza auth2
            window.gapi.load('client', () => {
              console.log('Google API client caricato');
              window.gapi.client.init({
                apiKey: process.env.REACT_APP_GOOGLE_API_KEY,
                clientId: GOOGLE_CONFIG.CLIENT_ID,
                discoveryDocs: GOOGLE_CONFIG.DISCOVERY_DOCS,
                scope: GOOGLE_CONFIG.SCOPES
              }).then(() => {
                console.log('Google API client inizializzato con successo');
                resolve();
              }).catch((err) => {
                console.error('Errore inizializzazione Google API:', err);
                reject(err);
              });
            });
          }
        };
        
        script.onload = () => {
          console.log('Google API script caricato con successo');
          checkAllLoaded();
        };
        script.onerror = (err) => {
          console.error('Errore caricamento script Google API:', err);
          reject(new Error('Impossibile caricare Google API script'));
        };
        
        gisScript.onload = () => {
          console.log('Google Identity Services script caricato con successo');
          checkAllLoaded();
        };
        gisScript.onerror = (err) => {
          console.error('Errore caricamento script Google Identity Services:', err);
          reject(new Error('Impossibile caricare Google Identity Services script'));
        };
        
        document.head.appendChild(script);
        document.head.appendChild(gisScript);
      });
    };

    loadGoogleAPI().catch(err => {
      console.error('Errore caricamento Google API:', err);
      setError(`Errore nel caricamento di Google Calendar API: ${err.message}`);
    });
  }, []);

  // Autenticazione
  const authenticate = async () => {
    try {
      setLoading(true);
      setError(null);

      // Usa Google Identity Services invece di auth2
      if (window.google && window.google.accounts) {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CONFIG.CLIENT_ID,
          scope: GOOGLE_CONFIG.SCOPES,
          callback: (tokenResponse) => {
            if (tokenResponse.error) {
              console.error('Errore autenticazione:', tokenResponse.error);
              setError('Errore durante l\'autenticazione con Google');
              return;
            }
            
            // Imposta il token per le chiamate API
            window.gapi.client.setToken(tokenResponse);
            setIsAuthenticated(true);
            loadEvents();
          },
        });
        
        tokenClient.requestAccessToken();
      } else {
        throw new Error('Google Identity Services non disponibile');
      }
    } catch (err) {
      console.error('Errore autenticazione:', err);
      setError('Errore durante l\'autenticazione con Google');
    } finally {
      setLoading(false);
    }
  };

  // Disconnessione
  const signOut = async () => {
    try {
      const authInstance = window.gapi.auth2.getAuthInstance();
      await authInstance.signOut();
      setIsAuthenticated(false);
      setEvents([]);
    } catch (err) {
      console.error('Errore disconnessione:', err);
    }
  };

  // Carica eventi da Google Calendar
  const loadEvents = async (startDate = null, endDate = null) => {
    try {
      setLoading(true);
      setError(null);

      if (!startDate) {
        startDate = new Date();
        startDate.setDate(1); // Primo giorno del mese
      }
      
      if (!endDate) {
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0); // Ultimo giorno del mese
      }

      const response = await window.gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      const googleEvents = response.result.items.map(event => ({
        id: event.id,
        title: event.summary || 'Senza titolo',
        description: event.description || '',
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        allDay: !event.start.dateTime,
        source: 'google',
        color: '#4285f4' // Colore blu per eventi Google
      }));

      setEvents(googleEvents);
    } catch (err) {
      console.error('Errore caricamento eventi:', err);
      setError('Errore nel caricamento degli eventi da Google Calendar');
    } finally {
      setLoading(false);
    }
  };

  // Sincronizza ticket con Google Calendar
  const syncTicketToCalendar = async (ticket) => {
    try {
      if (!isAuthenticated) {
        throw new Error('Non autenticato con Google Calendar');
      }

      // Debug: controlla il formato della data
      console.log('Ticket #' + ticket.id + ' - dataApertura:', ticket.dataApertura, 'Tipo:', typeof ticket.dataApertura);
      
      // Gestisci diversi formati di data
      let startDate;
      if (ticket.dataApertura) {
        // Prova diversi formati di data
        const dateFormats = [
          ticket.dataApertura, // Formato originale
          new Date(ticket.dataApertura), // Formato standard
          new Date(ticket.dataApertura.replace(/-/g, '/')), // Formato con slash
          new Date(ticket.dataApertura + 'T00:00:00'), // Aggiungi ora se manca
        ];
        
        for (const dateFormat of dateFormats) {
          const testDate = new Date(dateFormat);
          if (!isNaN(testDate.getTime())) {
            startDate = testDate;
            console.log('Data valida trovata per ticket #' + ticket.id + ':', startDate.toISOString());
            break;
          }
        }
        
        // Se nessun formato funziona, usa la data corrente
        if (!startDate || isNaN(startDate.getTime())) {
          console.warn('Nessun formato data valido per ticket #' + ticket.id + ':', ticket.dataApertura);
          startDate = new Date();
        }
      } else {
        console.warn('Nessuna dataApertura per ticket #' + ticket.id);
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
          url: `${window.location.origin}/ticket/${ticket.id}`
        }
      };

      const response = await window.gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event
      });

      return response.result;
    } catch (err) {
      console.error('Errore sincronizzazione ticket:', err);
      throw err;
    }
  };

  // Aggiorna evento Google Calendar
  const updateCalendarEvent = async (eventId, ticket) => {
    try {
      if (!isAuthenticated) {
        throw new Error('Non autenticato con Google Calendar');
      }

      const event = {
        summary: `Ticket #${ticket.id} - ${ticket.titolo}`,
        description: `Ticket: ${ticket.titolo}\nCliente: ${ticket.cliente}\nPriorità: ${ticket.priorita}\nStato: ${ticket.stato}\nDescrizione: ${ticket.descrizione}`,
        colorId: getPriorityColorId(ticket.priorita)
      };

      const response = await window.gapi.client.calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        resource: event
      });

      return response.result;
    } catch (err) {
      console.error('Errore aggiornamento evento:', err);
      throw err;
    }
  };

  // Elimina evento Google Calendar
  const deleteCalendarEvent = async (eventId) => {
    try {
      if (!isAuthenticated) {
        throw new Error('Non autenticato con Google Calendar');
      }

      await window.gapi.client.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId
      });

      return true;
    } catch (err) {
      console.error('Errore eliminazione evento:', err);
      throw err;
    }
  };

  // Ottieni color ID basato sulla priorità
  const getPriorityColorId = (priorita) => {
    return PRIORITY_COLORS[priorita?.toLowerCase()] || '1';
  };

  // Controlla se Google Calendar è già connesso (token salvato)
  const checkExistingConnection = async () => {
    try {
      if (window.gapi && window.gapi.client) {
        const token = window.gapi.client.getToken();
        if (token && token.access_token) {
          console.log('Token Google esistente trovato, verifica validità...');
          
          // Verifica se il token è ancora valido
          try {
            await window.gapi.client.calendar.calendarList.list();
            console.log('Token Google valido, connessione automatica riuscita');
            setIsAuthenticated(true);
            return true;
          } catch (err) {
            console.log('Token Google scaduto, richiesta nuova autenticazione');
            return false;
          }
        }
      }
      return false;
    } catch (err) {
      console.log('Nessuna connessione Google esistente');
      return false;
    }
  };

  // Sincronizza automaticamente un ticket quando viene preso in carico
  const autoSyncTicket = async (ticket) => {
    try {
      if (!isAuthenticated) {
        console.log('Google Calendar non connesso, sincronizzazione automatica saltata');
        return false;
      }

      // Sincronizza solo se il ticket è in lavorazione
      if (ticket.stato === 'in_lavorazione') {
        console.log('Sincronizzazione automatica ticket #' + ticket.id);
        await syncTicketToCalendar(ticket);
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Errore sincronizzazione automatica:', err);
      return false;
    }
  };

  // Aggiorna evento Google Calendar quando cambia un ticket
  const updateTicketInCalendar = async (ticket, eventId) => {
    try {
      if (!isAuthenticated) {
        console.log('Google Calendar non connesso, aggiornamento saltato');
        return false;
      }

      if (!eventId) {
        console.log('Nessun eventId fornito per ticket #' + ticket.id);
        return false;
      }

      console.log('Aggiornamento evento Google Calendar per ticket #' + ticket.id);
      
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
          console.warn('Data non valida per aggiornamento ticket #' + ticket.id);
          startDate = new Date();
        }
      } else {
        startDate = new Date();
      }

      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

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
        colorId: getPriorityColorId(ticket.priorita)
      };

      const response = await window.gapi.client.calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        resource: event
      });

      console.log('Evento Google Calendar aggiornato per ticket #' + ticket.id);
      return response.result;
    } catch (err) {
      console.error('Errore aggiornamento evento Google Calendar:', err);
      return false;
    }
  };

  return {
    isAuthenticated,
    events,
    loading,
    error,
    authenticate,
    signOut,
    loadEvents,
    syncTicketToCalendar,
    updateCalendarEvent,
    deleteCalendarEvent,
    autoSyncTicket,
    updateTicketInCalendar,
    checkExistingConnection
  };
};
