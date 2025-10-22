import { useState, useEffect } from 'react';

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

        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
          window.gapi.load('client:auth2', () => {
            window.gapi.client.init({
              apiKey: process.env.REACT_APP_GOOGLE_API_KEY,
              clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
              scope: 'https://www.googleapis.com/auth/calendar.readonly'
            }).then(() => {
              resolve();
            }).catch(reject);
          });
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    loadGoogleAPI().catch(err => {
      console.error('Errore caricamento Google API:', err);
      setError('Errore nel caricamento di Google Calendar API');
    });
  }, []);

  // Autenticazione
  const authenticate = async () => {
    try {
      setLoading(true);
      setError(null);

      const authInstance = window.gapi.auth2.getAuthInstance();
      const user = await authInstance.signIn();
      
      if (user.isSignedIn()) {
        setIsAuthenticated(true);
        await loadEvents();
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

  return {
    isAuthenticated,
    events,
    loading,
    error,
    authenticate,
    signOut,
    loadEvents
  };
};
