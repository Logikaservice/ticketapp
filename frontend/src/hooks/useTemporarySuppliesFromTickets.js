// hooks/useTemporarySuppliesFromTickets.js

import React, { useState, useEffect, useRef } from 'react';
import { buildApiUrl } from '../utils/apiConfig';

export const useTemporarySuppliesFromTickets = (getAuthHeader, enabled = true) => {
  const [temporarySupplies, setTemporarySupplies] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ LOCK per evitare chiamate simultanee
  const fetchingRef = useRef(false);
  const lastAuthKeyRef = useRef(null);

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
        // Evita spam console: 502 può capitare durante deploy/riavvii backend
        if (response.status !== 0 && response.status !== 403 && response.status !== 502) {
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

  // Carica le forniture al mount e quando getAuthHeader diventa disponibile
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!getAuthHeader) return;

    // Evita loop: in alcune parti dell'app getAuthHeader può cambiare riferimento a ogni render.
    // Qui triggeriamo il fetch solo quando cambiano davvero i dati di auth (es. token).
    let authKey = null;
    try {
      const h = getAuthHeader();
      authKey = (h && (h.Authorization || h.authorization))
        ? String(h.Authorization || h.authorization)
        : JSON.stringify(h || {});
    } catch (_) {
      authKey = null;
    }

    if (!authKey) return;
    if (lastAuthKeyRef.current === authKey) return;
    lastAuthKeyRef.current = authKey;

    fetchTemporarySupplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAuthHeader, enabled]);

  return {
    temporarySupplies,
    loading,
    fetchTemporarySupplies,
    removeTemporarySupply,
    refreshTemporarySupplies: fetchTemporarySupplies
  };
};
