import { useState, useEffect, useRef } from 'react';
import { buildApiUrl } from '../utils/apiConfig';

export const useAvailability = (getAuthHeader) => {
  const [unavailableDays, setUnavailableDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastLoadTime = useRef(0);
  const LOAD_DEBOUNCE_MS = 5000; // 5 secondi di debounce

  // Funzione per retry con backoff (ridotto per evitare sovraccarico)
  const retryWithBackoff = async (fn, maxRetries = 2, baseDelay = 2000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  // Carica tutti i giorni non disponibili
  const loadUnavailableDays = async () => {
    // Evita chiamate multiple simultanee
    if (loading) {
      return;
    }
    
    // Debounce: evita chiamate troppo frequenti
    const now = Date.now();
    if (now - lastLoadTime.current < LOAD_DEBOUNCE_MS) {
      return;
    }
    lastLoadTime.current = now;
    
    setLoading(true);
    setError(null);
    
    try {
      // Prima prova con endpoint pubblico (più affidabile)
      
      const response = await retryWithBackoff(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout di 10 secondi
        
        try {
          const res = await fetch(buildApiUrl('/api/availability/public'), {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          
          return res;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      });
      
      const data = await response.json();
      setUnavailableDays(data);
      
    } catch (publicError) {
      
      try {
        // Fallback: prova con endpoint autenticato
        const authHeaders = getAuthHeader();
        
        const response = await retryWithBackoff(async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout di 10 secondi
          
          try {
            const res = await fetch(buildApiUrl('/api/availability'), {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                ...authHeaders
              },
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            
            return res;
          } catch (err) {
            clearTimeout(timeoutId);
            throw err;
          }
        });
        
        const data = await response.json();
        setUnavailableDays(data);
        
      } catch (authError) {
        setError(`Errore nel caricamento: ${authError.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Aggiungi o aggiorna un giorno non disponibile
  const setDayUnavailable = async (date, reason = null) => {
    try {
      const authHeaders = getAuthHeader();
      
      const response = await retryWithBackoff(async () => {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/availability`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify({ date, reason })
        });
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        return res;
      });

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
      
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Rimuovi un giorno non disponibile
  const setDayAvailable = async (date) => {
    try {
      const response = await fetch(buildApiUrl(`/api/availability/${date}`), {
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
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Verifica se una data è non disponibile
  const isDateUnavailable = (date) => {
    const dateString = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return unavailableDays.some(day => {
      const dayDatePart = day.date.split('T')[0]; // Estrae solo la parte YYYY-MM-DD
      return dayDatePart === dateString; // Confronto esatto
    });
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
  }, []); // Rimuovo getAuthHeader dalla dipendenza per evitare chiamate eccessive

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
