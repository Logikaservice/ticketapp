// src/hooks/useTickets.js
import { useState, useEffect, useCallback } from 'react';

// Passiamo l'utente corrente e la funzione di notifica come dipendenze
export function useTickets(currentUser, showNotification) {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Usiamo useCallback per evitare che la funzione venga ricreata ad ogni render
  const fetchTickets = useCallback(async () => {
    if (!currentUser) return;

    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/tickets');
      if (!response.ok) throw new Error("Errore nel caricare i ticket");
      const data = await response.json();
      setTickets(data);
    } catch (error) {
      console.error("Errore nel caricare i dati:", error);
      showNotification(error.message, "error");
    }
  }, [currentUser, showNotification]); // Dipendenze di useCallback

  // useEffect per caricare i ticket quando l'utente cambia
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const selectTicket = (ticket) => {
    // Logica per marcare il ticket come letto se necessario
    if (ticket && ticket.isNew && currentUser.ruolo === 'tecnico') {
        setTickets(prev => prev.map(tk => (tk.id === ticket.id ? { ...tk, isNew: false } : tk)));
    }
    setSelectedTicket(prev => (prev && prev.id === ticket.id ? null : ticket));
  };
  
  const createTicket = async (ticketData) => {
    // Qui andrebbe la logica di handleConfirmUrgentCreation
    try {
        const response = await fetch(process.env.REACT_APP_API_URL + '/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ticketData)
        });
        if (!response.ok) throw new Error('Errore creazione ticket');
        const nuovoTicket = await response.json();
        setTickets(prev => [nuovoTicket, ...prev]);
        showNotification('Ticket creato!', 'success');
        return nuovoTicket;
    } catch (error) {
        showNotification('Impossibile creare il ticket.', 'error');
        return null;
    }
  };

  const deleteTicket = async (id) => {
    // ... logica di handleDeleteTicket
    // Per brevità, ometto le altre funzioni (update, changeStatus, ecc.)
    // ma andrebbero aggiunte qui con lo stesso pattern.
  };

  // Funzione per resettare lo stato quando si fa logout
  const resetTickets = () => {
    setTickets([]);
    setSelectedTicket(null);
  };

  return {
    tickets,
    setTickets, // Esponiamo anche il set per manipolazioni dirette se serve
    selectedTicket,
    setSelectedTicket,
    selectTicket,
    createTicket,
    deleteTicket,
    fetchTickets, // Potrebbe servire per un refresh manuale
    resetTickets
  };
}