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
        console.error('Errore nel caricare le forniture temporanee');
      }
    } catch (error) {
      console.error('Errore nel caricare le forniture temporanee:', error);
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

  // Carica le forniture al mount
  useEffect(() => {
    fetchTemporarySupplies();
  }, []);

  return {
    temporarySupplies,
    loading,
    fetchTemporarySupplies,
    removeTemporarySupply,
    refreshTemporarySupplies: fetchTemporarySupplies
  };
};
