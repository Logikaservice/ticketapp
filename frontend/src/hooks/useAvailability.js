import { useState, useEffect } from 'react';

export const useAvailability = (getAuthHeader) => {
  const [unavailableDays, setUnavailableDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Carica tutti i giorni non disponibili
  const loadUnavailableDays = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/availability`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUnavailableDays(data);
      } else {
        throw new Error('Errore nel caricamento dei giorni non disponibili');
      }
    } catch (err) {
      console.error('Errore nel caricamento dei giorni non disponibili:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Aggiungi o aggiorna un giorno non disponibile
  const setDayUnavailable = async (date, reason = null) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ date, reason })
      });

      if (response.ok) {
        const data = await response.json();
        // Aggiorna la lista locale
        setUnavailableDays(prev => {
          const existing = prev.find(day => day.date === date);
          if (existing) {
            return prev.map(day => day.date === date ? data.day : day);
          } else {
            return [...prev, data.day];
          }
        });
        return { success: true, day: data.day };
      } else {
        throw new Error('Errore nel salvare il giorno non disponibile');
      }
    } catch (err) {
      console.error('Errore nel salvare il giorno non disponibile:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Rimuovi un giorno non disponibile
  const setDayAvailable = async (date) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/availability/${date}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        }
      });

      if (response.ok) {
        // Rimuovi dalla lista locale
        setUnavailableDays(prev => prev.filter(day => day.date !== date));
        return { success: true };
      } else {
        throw new Error('Errore nel rimuovere il giorno non disponibile');
      }
    } catch (err) {
      console.error('Errore nel rimuovere il giorno non disponibile:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Verifica se una data è non disponibile
  const isDateUnavailable = (date) => {
    const dateString = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return unavailableDays.some(day => day.date === dateString);
  };

  // Ottieni il motivo per cui una data è non disponibile
  const getUnavailableReason = (date) => {
    const dateString = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const day = unavailableDays.find(day => day.date === dateString);
    return day ? day.reason : null;
  };

  // Carica i giorni non disponibili al mount
  useEffect(() => {
    if (getAuthHeader) {
      loadUnavailableDays();
    }
  }, [getAuthHeader]);

  return {
    unavailableDays,
    loading,
    error,
    loadUnavailableDays,
    setDayUnavailable,
    setDayAvailable,
    isDateUnavailable,
    getUnavailableReason
  };
};
