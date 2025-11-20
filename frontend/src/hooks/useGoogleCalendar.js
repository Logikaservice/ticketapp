import { useState } from 'react';

export const useGoogleCalendar = (getAuthHeader) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sincronizzazione automatica con Service Account (per backend)
  const syncTicketToCalendarBackend = async (ticket, action = 'create') => {
    try {
      console.log(`[GOOGLE-CALENDAR] Sincronizzazione automatica ticket #${ticket.id} (${action}) via Service Account`);
      console.log(`[GOOGLE-CALENDAR] Ticket completo:`, {
        id: ticket.id,
        numero: ticket.numero,
        titolo: ticket.titolo,
        hasTimelogs: !!ticket.timelogs,
        timelogsType: typeof ticket.timelogs,
        timelogsIsArray: Array.isArray(ticket.timelogs),
        timelogsLength: Array.isArray(ticket.timelogs) ? ticket.timelogs.length : (typeof ticket.timelogs === 'string' ? ticket.timelogs.length : 'N/A')
      });
      
      if (ticket.timelogs) {
        console.log(`[GOOGLE-CALENDAR] Timelogs presenti:`, Array.isArray(ticket.timelogs) ? ticket.timelogs : 'Stringa o altro tipo');
        if (Array.isArray(ticket.timelogs) && ticket.timelogs.length > 0) {
          console.log(`[GOOGLE-CALENDAR] Primo timelog:`, ticket.timelogs[0]);
        }
      } else {
        console.warn(`[GOOGLE-CALENDAR] ⚠️ Nessun timelog nel ticket!`);
      }
      
      const payload = {
        ticket: ticket,
        action: action
      };
      
      console.log(`[GOOGLE-CALENDAR] Payload da inviare:`, {
        ticketId: payload.ticket.id,
        action: payload.action,
        hasTimelogs: !!payload.ticket.timelogs,
        timelogsPreview: Array.isArray(payload.ticket.timelogs) ? 
          payload.ticket.timelogs.map(tl => ({ data: tl.data, modalita: tl.modalita })) : 
          (typeof payload.ticket.timelogs === 'string' ? payload.ticket.timelogs.substring(0, 100) : 'N/A')
      });
      
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