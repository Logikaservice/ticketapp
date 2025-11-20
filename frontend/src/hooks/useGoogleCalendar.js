import { useState } from 'react';

export const useGoogleCalendar = (getAuthHeader) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sincronizzazione automatica con Service Account (per backend)
  const syncTicketToCalendarBackend = async (ticket, action = 'create') => {
    try {
      // Invia ticket al backend per sincronizzazione automatica
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sync-google-calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Errore sincronizzazione backend');
      }

      const result = await response.json();
      console.log('Ticket #' + ticket.id + ' sincronizzato via backend:', result);
      return result;
    } catch (err) {
      console.error('Errore sincronizzazione backend ticket #' + ticket.id + ':', err);
      return false;
    }
  };

  // Disabilita notifiche calendario per utente
  const disableCalendarNotifications = async (userEmail) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/disable-calendar-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userEmail })
      });

      if (!response.ok) {
        throw new Error('Errore disabilitazione notifiche');
      }

      const result = await response.json();
      console.log('Notifiche calendario disabilitate:', result);
      return result;
    } catch (err) {
      console.error('Errore disabilitazione notifiche calendario:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    syncTicketToCalendarBackend,
    disableCalendarNotifications
  };
};