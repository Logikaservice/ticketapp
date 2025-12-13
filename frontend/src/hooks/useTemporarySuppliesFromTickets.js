// hooks/useTemporarySuppliesFromTickets.js

import { useState, useEffect } from 'react';
import { buildApiUrl } from '../utils/apiConfig';

export const useTemporarySuppliesFromTickets = (getAuthHeader) => {
  const [temporarySupplies, setTemporarySupplies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carica tutte le forniture temporanee dai ticket
  const fetchTemporarySupplies = async () => {
    if (!getAuthHeader) return; // Evita chiamate se non c'è autenticazione
    
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl('/api/tickets/forniture/all'), {
        headers: {
          ...getAuthHeader()
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTemporarySupplies(data);
      } else {
        // Non loggare errori CORS o di rete come errori critici
        if (response.status !== 0 && response.status !== 403) {
          console.error('Errore nel caricare le forniture temporanee:', response.status);
        }
      }
    } catch (error) {
      // Non loggare errori CORS come errori critici (sono normali se il backend non è raggiungibile)
      if (error.name !== 'TypeError' || !error.message.includes('Failed to fetch')) {
        console.error('Errore nel caricare le forniture temporanee:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Rimuovi una fornitura temporanea (restituisci)
  const removeTemporarySupply = async (supplyId) => {
    try {
      const response = await fetch(buildApiUrl(`/api/tickets/forniture/${supplyId}`), {
        method: 'DELETE',
        headers: {
          ...getAuthHeader()
        }
      });

      if (response.ok) {
        setTemporarySupplies(prev => prev.filter(supply => supply.id !== supplyId));
        return true;
      } else {
        throw new Error('Errore nell\'eliminare la fornitura');
      }
    } catch (error) {
      console.error('Errore nell\'eliminare la fornitura:', error);
      throw error;
    }
  };

  // Carica le forniture al mount e quando getAuthHeader cambia
  useEffect(() => {
    if (getAuthHeader) {
      fetchTemporarySupplies();
    }
  }, [getAuthHeader]);

  return {
    temporarySupplies,
    loading,
    fetchTemporarySupplies,
    removeTemporarySupply,
    refreshTemporarySupplies: fetchTemporarySupplies
  };
};
