import { useState } from 'react';
import { buildApiUrl } from '../utils/apiConfig';

export const useGoogleCalendar = (getAuthHeader) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sincronizzazione automatica con Service Account (per backend)
  const syncTicketToCalendarBackend = async (ticket, action = 'create') => {
    try {
      const payload = {
        ticket: ticket,
        action: action
      };
      
      // Invia ticket al backend per sincronizzazione automatica
      const response = await fetch(buildApiUrl('/api/sync-google-calendar'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GOOGLE-CALENDAR] Errore risposta backend:', response.status, errorText);
        throw new Error('Errore sincronizzazione backend');
      }

      const result = await response.json();
      console.log('[GOOGLE-CALENDAR] Ticket #' + ticket.id + ' sincronizzato via backend:', result);
      return result;
    } catch (err) {
      console.error('[GOOGLE-CALENDAR] Errore sincronizzazione backend ticket #' + ticket.id + ':', err);
      return false;
    }
  };

  // Disabilita notifiche calendario per utente
  const disableCalendarNotifications = async (userEmail) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(buildApiUrl('/api/disable-calendar-notifications'), {
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