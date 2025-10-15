// src/components/TicketListContainer.jsx

import React, { useState, useEffect } from 'react';
import TicketItem from './TicketItem';
import NotificationModal from './NotificationModal';

export default function TicketListContainer({ 
  currentUser, 
  tickets, 
  users, 
  selectedTicket, 
  setSelectedTicket,
  getUnreadCount, 
  handlers 
}) {
  const [filter, setFilter] = useState('tutti');
  const [notificationTicket, setNotificationTicket] = useState(null);
  const [previousUnreadCounts, setPreviousUnreadCounts] = useState({});

  // Monitora i cambiamenti nei messaggi non letti
  useEffect(() => {
    tickets.forEach(ticket => {
      const previousCount = previousUnreadCounts[ticket.id] || 0;
      const currentCount = getUnreadCount(ticket);
      
      // Mostra notifica solo se aumentano i messaggi non letti
      if (currentCount > previousCount && currentCount > 0) {
        const cliente = users.find(u => u.id === ticket.clienteid);
        setNotificationTicket({
          id: ticket.id,
          titolo: ticket.titolo,
          clientName: cliente ? cliente.azienda : ticket.nomerichiedente,
          unreadCount: currentCount
        });
      }
    });
    
    // Aggiorna il contatore precedente
    const newCounts = {};
    tickets.forEach(t => {
      newCounts[t.id] = getUnreadCount(t);
    });
    setPreviousUnreadCounts(newCounts);
  }, [tickets, getUnreadCount, users, previousUnreadCounts]);

  const handleOpenTicketFromNotification = (ticketId) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      handlers.handleSelectTicket(ticket);
    }
  };

  // Filtra i ticket in base al ruolo e al filtro selezionato
  const getFilteredTickets = () => {
    let filtered = tickets;
    
    if (currentUser.ruolo === 'cliente') {
      filtered = tickets.filter(t => t.clienteid === currentUser.id);
    }
    
    switch (filter) {
      case 'aperti':
        return filtered.filter(t => ['aperto', 'in_lavorazione'].includes(t.stato));
      case 'risolti':
        return filtered.filter(t => t.stato === 'risolto');
      case 'chiusi':
        return filtered.filter(t => ['chiuso', 'inviato', 'fatturato'].includes(t.stato));
      default:
        return filtered;
    }
  };

  const filteredTickets = getFilteredTickets();

  return (
    <>
      <NotificationModal
        ticket={notificationTicket}
        onClose={() => setNotificationTicket(null)}
        onOpenTicket={handleOpenTicketFromNotification}
      />

      <div className="mb-6">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('tutti')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'tutti'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Tutti ({tickets.filter(t => currentUser.ruolo === 'tecnico' || t.clienteid === currentUser.id).length})
          </button>
          <button
            onClick={() => setFilter('aperti')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'aperti'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Aperti ({tickets.filter(t => (currentUser.ruolo === 'tecnico' || t.clienteid === currentUser.id) && ['aperto', 'in_lavorazione'].includes(t.stato)).length})
          </button>
          <button
            onClick={() => setFilter('risolti')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'risolti'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Risolti ({tickets.filter(t => (currentUser.ruolo === 'tecnico' || t.clienteid === currentUser.id) && t.stato === 'risolto').length})
          </button>
          <button
            onClick={() => setFilter('chiusi')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'chiusi'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Chiusi ({tickets.filter(t => (currentUser.ruolo === 'tecnico' || t.clienteid === currentUser.id) && ['chiuso', 'inviato', 'fatturato'].includes(t.stato)).length})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {filteredTickets.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nessun ticket trovato
          </div>
        ) : (
          filteredTickets.map(ticket => {
            const cliente = users.find(u => u.id === ticket.clienteid);
            return (
              <TicketItem
                key={ticket.id}
                ticket={ticket}
                cliente={cliente}
                currentUser={currentUser}
                selectedTicket={selectedTicket}
                handlers={handlers}
                getUnreadCount={getUnreadCount}
              />
            );
          })
        )}
      </div>
    </>
  );
}
