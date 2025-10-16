// src/components/TicketListContainer.jsx

import React, { useState, useMemo, useEffect } from 'react';
import { FileText, PlayCircle, CheckCircle, Send, FileCheck2, Archive } from 'lucide-react';
import TicketItem from './TicketItem';
import NotificationModal from './NotificationModal';

// ====================================================================
// COMPONENTE ESTRATTO PER I FILTRI
// ====================================================================
const FilterControls = ({ 
  currentUser, 
  counts, 
  viewState, 
  setViewState, 
  clientiAttivi, 
  selectedClient, 
  setSelectedClient,
  onGenerateReport,
  tickets,
  changedStates,
  markAsViewed
}) => {
  const statusIcons = {
    aperto: <FileText size={14} />,
    in_lavorazione: <PlayCircle size={14} />,
    risolto: <CheckCircle size={14} />,
    chiuso: <Archive size={14} />,
    inviato: <Send size={14} />,
    fatturato: <FileCheck2 size={14} />,
  };

  const TASTI_TECNICO = ['aperto', 'in_lavorazione', 'risolto', 'chiuso', 'inviato', 'fatturato'];
  const TASTI_CLIENTE = ['aperto', 'in_lavorazione', 'risolto', 'chiuso', 'inviato', 'fatturato'];

  const buttonsToRender = currentUser.ruolo === 'cliente' ? TASTI_CLIENTE : TASTI_TECNICO;

  return (
    <>
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg mb-4 flex-wrap">
        {buttonsToRender.map(status => {
          if (counts[status] === undefined) return null;
          const hasChanged = changedStates.includes(status);
          const hasTickets = counts[status] > 0;
          
          return (
            <button
              key={status}
              onClick={() => {
                if (hasTickets) {
                  setViewState(status);
                  markAsViewed(status);
                }
              }}
              disabled={!hasTickets}
              className={`flex flex-1 items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg capitalize ${
                viewState === status && hasTickets
                  ? 'bg-blue-600 text-white shadow' 
                  : hasTickets 
                    ? 'text-gray-700 hover:bg-gray-200 cursor-pointer'
                    : 'text-gray-400 cursor-not-allowed bg-gray-50'
              }`}
            >
              {statusIcons[status]}
              <span>
                {status.replace('_', ' ')}{' '}
                <span className={hasChanged ? 'count-badge-changed' : ''}>
                  ({counts[status]})
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {currentUser.ruolo === 'tecnico' && (
        <>
            {['inviato', 'fatturato'].includes(viewState) && onGenerateReport && (
                <button
                onClick={onGenerateReport}
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg mb-3 ${
                    viewState === 'inviato' ? 'bg-gray-600' : 'bg-indigo-600'
                }`}
                >
                <FileText size={18} />
                {viewState === 'inviato' ? 'Genera Report' : 'Genera Lista Fatture'}
                </button>
            )}

            <div className="mb-3">
                <label className="block text-sm font-medium mb-2">Filtra per cliente</label>
                <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                >
                <option value="all">Tutti i clienti</option>
                {clientiAttivi.map(c => (
                    <option key={c.id} value={c.id}>
                    {c.azienda} ({tickets.filter(t => t.clienteid === c.id).length})
                    </option>
                ))}
                </select>
            </div>
        </>
      )}
    </>
  );
};

// ====================================================================
// COMPONENTE PRINCIPALE
// ====================================================================
const TicketListContainer = ({ currentUser, tickets, users, selectedTicket, setSelectedTicket, handlers, getUnreadCount }) => {
  const [viewState, setViewState] = useState('aperto');
  const [selectedClientFilter, setSelectedClientFilter] = useState('all');
  const [notificationTicket, setNotificationTicket] = useState(null);
  const [previousUnreadCounts, setPreviousUnreadCounts] = useState({});
  const [snoozedNotifications, setSnoozedNotifications] = useState(() => {
    const saved = localStorage.getItem('snoozedNotifications');
    return saved ? JSON.parse(saved) : [];
  });
  const [hasShownSnoozedOnMount, setHasShownSnoozedOnMount] = useState(false);
  const [lastSeenCounts, setLastSeenCounts] = useState(() => {
    const saved = localStorage.getItem(`lastSeenCounts_${currentUser.id}`);
    return saved ? JSON.parse(saved) : {};
  });
  const [changedStates, setChangedStates] = useState([]);

  // Carica notifiche posticipate al mount (solo una volta)
  useEffect(() => {
    if (!hasShownSnoozedOnMount && snoozedNotifications.length > 0 && tickets.length > 0) {
      const ticketToShow = snoozedNotifications[0];
      const ticket = tickets.find(t => t.id === ticketToShow);
      
      if (ticket && getUnreadCount(ticket) > 0) {
        const cliente = users.find(u => u.id === ticket.clienteid);
        setNotificationTicket({
          id: ticket.id,
          titolo: ticket.titolo,
          clientName: cliente ? cliente.azienda : ticket.nomerichiedente,
          unreadCount: getUnreadCount(ticket)
        });
        
        const newSnoozed = snoozedNotifications.filter(id => id !== ticketToShow);
        setSnoozedNotifications(newSnoozed);
        localStorage.setItem('snoozedNotifications', JSON.stringify(newSnoozed));
      }
      setHasShownSnoozedOnMount(true);
    }
  }, [hasShownSnoozedOnMount, tickets, users, getUnreadCount, snoozedNotifications]);

  // Monitora nuovi messaggi
  useEffect(() => {
    tickets.forEach(ticket => {
      const previousCount = previousUnreadCounts[ticket.id] || 0;
      const currentCount = getUnreadCount(ticket);
      
      if (currentCount > previousCount && currentCount > 0 && !snoozedNotifications.includes(ticket.id) && !notificationTicket) {
        const cliente = users.find(u => u.id === ticket.clienteid);
        setNotificationTicket({
          id: ticket.id,
          titolo: ticket.titolo,
          clientName: cliente ? cliente.azienda : ticket.nomerichiedente,
          unreadCount: currentCount
        });
      }
      
      if (currentCount === 0 && snoozedNotifications.includes(ticket.id)) {
        const newSnoozed = snoozedNotifications.filter(id => id !== ticket.id);
        setSnoozedNotifications(newSnoozed);
        localStorage.setItem('snoozedNotifications', JSON.stringify(newSnoozed));
      }
    });
    
    const newCounts = {};
    tickets.forEach(t => {
      newCounts[t.id] = getUnreadCount(t);
    });
    setPreviousUnreadCounts(newCounts);
  }, [tickets, getUnreadCount, users]);
  
  const { displayTickets, ticketCounts, usersMap } = useMemo(() => {
    const usersMap = Object.fromEntries(users.map(user => [user.id, user]));

    const filterTickets = () => {
      let filtered = tickets;
      if (currentUser.ruolo === 'cliente') {
        filtered = tickets.filter(t => t.clienteid === currentUser.id);
      } else {
        if (selectedClientFilter !== 'all') {
          filtered = tickets.filter(t => t.clienteid === parseInt(selectedClientFilter));
        }
      }
      return filtered.filter(t => t.stato === viewState);
    };

    const countTickets = (arr) => ({
      aperto: arr.filter(t => t.stato === 'aperto').length,
      in_lavorazione: arr.filter(t => t.stato === 'in_lavorazione').length,
      risolto: arr.filter(t => t.stato === 'risolto').length,
      chiuso: arr.filter(t => t.stato === 'chiuso').length,
      inviato: arr.filter(t => t.stato === 'inviato').length,
      fatturato: arr.filter(t => t.stato === 'fatturato').length
    });

    const relevantTicketsForCounts = currentUser.ruolo === 'cliente'
      ? tickets.filter(t => t.clienteid === currentUser.id)
      : tickets;

    return { 
      displayTickets: filterTickets(), 
      ticketCounts: countTickets(relevantTicketsForCounts), 
      usersMap
    };
  }, [tickets, users, currentUser, viewState, selectedClientFilter]);

  // Confronta contatori con ultima visita
  useEffect(() => {
    const changed = [];
    Object.keys(ticketCounts).forEach(status => {
      const lastSeen = lastSeenCounts[status];
      const current = ticketCounts[status];
      
      if (lastSeen !== undefined && lastSeen !== current) {
        changed.push(status);
      }
    });
    setChangedStates(changed);
  }, [ticketCounts, lastSeenCounts]);

  // Auto-switch quando lo stato corrente ha 0 ticket
  useEffect(() => {
    if (ticketCounts[viewState] === 0) {
      // Trova il primo stato con ticket > 0
      const availableStates = Object.keys(ticketCounts).filter(s => ticketCounts[s] > 0);
      if (availableStates.length > 0) {
        setViewState(availableStates[0]);
      }
    }
  }, [ticketCounts, viewState]);

  const markAsViewed = (status) => {
    const newLastSeen = {
      ...lastSeenCounts,
      [status]: ticketCounts[status]
    };
    setLastSeenCounts(newLastSeen);
    localStorage.setItem(`lastSeenCounts_${currentUser.id}`, JSON.stringify(newLastSeen));
    setChangedStates(prev => prev.filter(s => s !== status));
  };

  const handleOpenTicketFromNotification = (ticketId) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      setViewState(ticket.stato);
      handlers.handleSelectTicket(ticket);
    }
  };

  const handleSnoozeNotification = (ticketId) => {
    const newSnoozed = [...snoozedNotifications, ticketId];
    setSnoozedNotifications(newSnoozed);
    localStorage.setItem('snoozedNotifications', JSON.stringify(newSnoozed));
  };
  
  const clientiAttivi = users.filter(u => u.ruolo === 'cliente');
  
  return (
    <>
      <NotificationModal
        ticket={notificationTicket}
        onClose={() => setNotificationTicket(null)}
        onOpenTicket={handleOpenTicketFromNotification}
        onSnooze={handleSnoozeNotification}
      />

      <div className="bg-white rounded-xl shadow-lg">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold mb-3">
            {currentUser.ruolo === 'cliente' ? 'I Miei Interventi' : 'Lista Ticket'}
          </h2>
          
          <FilterControls
            currentUser={currentUser}
            counts={ticketCounts}
            viewState={viewState}
            setViewState={setViewState}
            clientiAttivi={clientiAttivi}
            selectedClient={selectedClientFilter}
            setSelectedClient={setSelectedClientFilter}
            tickets={tickets}
            changedStates={changedStates}
            markAsViewed={markAsViewed}
          />
        </div>

        <div className="divide-y">
          {displayTickets.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText size={48} className="mx-auto mb-3 opacity-30" />
              <p>Nessun intervento con lo stato selezionato.</p>
            </div>
          ) : (
            displayTickets
              .sort((a, b) => new Date(b.dataapertura) - new Date(a.dataapertura))
              .filter(t => t && t.id)
              .map(t => (
                <TicketItem
                  key={t.id}
                  ticket={t}
                  cliente={usersMap[t.clienteid]}
                  currentUser={currentUser}
                  selectedTicket={selectedTicket}
                  handlers={handlers}
                  getUnreadCount={getUnreadCount}
                />
              ))
          )}
        </div>
      </div>
    </>
  );
};

export default TicketListContainer;
