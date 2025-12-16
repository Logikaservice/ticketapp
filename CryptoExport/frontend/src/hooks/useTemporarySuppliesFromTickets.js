// hooks/useTemporarySuppliesFromTickets.js

import React, { useState, useEffect, useRef } from 'react';
import { buildApiUrl } from '../utils/apiConfig';

export const useTemporarySuppliesFromTickets = (getAuthHeader) => {
  const [temporarySupplies, setTemporarySupplies] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ LOCK per evitare chiamate simultanee
  const fetchingRef = useRef(false);

  // Carica tutte le forniture temporanee dai ticket
  const fetchTemporarySupplies = async () => {
    if (!getAuthHeader || fetchingRef.current) return; // Evita chiamate se non c'è autenticazione o già in corso

    try {
      fetchingRef.current = true;
      setLoading(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // ✅ Timeout 5 secondi

      const response = await fetch(buildApiUrl('/api/tickets/forniture/all'), {
        headers: {
          ...getAuthHeader()
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

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
      // ✅ Ignora errori di aborto e timeout (normali per richieste interrotte)
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        // Silenzia questi errori - sono normali
        return;
      }
      // Non loggare errori CORS come errori critici (sono normali se il backend non è raggiungibile)
      if (error.name !== 'TypeError' || !error.message.includes('Failed to fetch')) {
        console.error('Errore nel caricare le forniture temporanee:', error);
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
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
    // Carica solo una volta al mount
    fetchTemporarySupplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    temporarySupplies,
    loading,
    fetchTemporarySupplies,
    removeTemporarySupply,
    refreshTemporarySupplies: fetchTemporarySupplies
  };
};
