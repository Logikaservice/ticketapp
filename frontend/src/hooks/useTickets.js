import { useState, useEffect, useCallback } from 'react';

export function useTickets(currentUser, showNotification) {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const fetchTickets = useCallback(async () => {
    if (!currentUser) return;
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets`);
      if (!response.ok) throw new Error("Errore nel caricare i ticket");
      const data = await response.json();
      setTickets(data);
    } catch (error) {
      showNotification(error.message, "error");
    }
  }, [currentUser, showNotification]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const selectTicket = (ticket) => {
    setSelectedTicket(prev => (prev && prev.id === ticket.id ? null : ticket));
  };

  const createTicket = async (ticketData) => {
    // Logica per creare un ticket...
  };

  const changeStatus = async (id, status) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status })
      });
      if (!response.ok) throw new Error('Errore aggiornamento stato');
      const updatedTicket = await response.json();
      setTickets(prev => prev.map(t => (t.id === id ? updatedTicket : t)));
      showNotification('Stato del ticket aggiornato!', 'success');
      if (status === 'chiuso' || status === 'risolto') {
        setSelectedTicket(null);
      }
    } catch (error) {
      showNotification('Impossibile aggiornare lo stato.', 'error');
    }
  };

  const deleteTicket = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo ticket?')) return;
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Errore nell\'eliminazione');
      setTickets(prev => prev.filter(t => t.id !== id));
      if (selectedTicket && selectedTicket.id === id) {
        setSelectedTicket(null);
      }
      showNotification('Ticket eliminato!', 'success');
    } catch (error) {
      showNotification('Impossibile eliminare il ticket.', 'error');
    }
  };
  
  const resetTickets = () => {
    setTickets([]);
    setSelectedTicket(null);
  };

  // Esponiamo tutte le funzioni che servono
  return {
    tickets,
    selectedTicket,
    selectTicket,
    createTicket,
    changeStatus,
    deleteTicket,
    resetTickets,
    // E qualsiasi altra funzione ti serva...
  };
}