import { useState } from 'react';

export const useGoogleCalendar = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sincronizzazione automatica con Service Account (per backend)
  const syncTicketToCalendarBackend = async (ticket, action = 'create') => {
    try {
      console.log(`Sincronizzazione automatica ticket #${ticket.id} (${action}) via Service Account`);
      
      // Invia ticket al backend per sincronizzazione automatica
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sync-google-calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket: ticket,
          action: action
        })
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

  return {
    loading,
    error,
    syncTicketToCalendarBackend
  };
};