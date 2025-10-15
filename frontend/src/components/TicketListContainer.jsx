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
  recentChanges
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
          const change = recentChanges[status];
          
          return (
            <button
              key={status}
              onClick={() => setViewState(status)}
              className={`flex flex-1 items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg capitalize relative ${
                viewState === status ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              {statusIcons[status]}
              <span className="flex items-center gap-1">
                {status.replace('_', ' ')} ({counts[status]})
                {change && (
                  <span className={`badge-change ${change > 0 ? 'badge-increase' : 'badge-decrease'}`}>
                    {change > 0 ? '+' : ''}{change}
                  </span>
                )}
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
  const [previousTicketCounts, setPreviousTicketCounts] = useState({});
  const [recentCountChanges, setRecentCountChanges] = useState({});

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
        
        // Rimuovi dalla lista delle posticipate
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
      
      // Mostra notifica SOLO se:
      // 1. Il conteggio è aumentato
      // 2. Ci sono messaggi non letti
      // 3. Il ticket NON è in snoozed
      // 4. Non c'è già una notifica in mostra
      if (currentCount > previousCount && currentCount > 0 && !snoozedNotifications.includes(ticket.id) && !notificationTicket) {
        const cliente = users.find(u => u.id === ticket.clienteid);
        setNotificationTicket({
          id: ticket.id,
          titolo: ticket.titolo,
          clientName: cliente ? cliente.azienda : ticket.nomerichiedente,
          unreadCount: currentCount
        });
      }
      
      // Se l'utente ha letto il messaggio, rimuovi da snoozed
      if (currentCount === 0 && snoozedNotifications.includes(ticket.id)) {
        const newSnoozed = snoozedNotifications.filter(id => id !== ticket.id);
        setSnoozedNotifications(newSnoozed);
        localStorage.setItem('snoozedNotifications', JSON.stringify(newSnoozed));
      }
    });
    
    // Aggiorna contatori
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

  // Monitora cambiamenti nei contatori
  useEffect(() => {
    const changes = {};
    let hasChanges = false;

    Object.keys(ticketCounts).forEach(status => {
      const previous = previousTicketCounts[status] || 0;
      const current = ticketCounts[status];
      
      if (previous !== current) {
        changes[status] = current - previous;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setRecentCountChanges(changes);
      setPreviousTicketCounts(ticketCounts);

      // Rimuovi l'indicatore dopo 1 secondo
      setTimeout(() => {
        setRecentCountChanges({});
      }, 1000);
    }
  }, [ticketCounts]);

  const handleOpenTicketFromNotification = (ticketId) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      // Cambia la vista al stato del ticket
      setViewState(ticket.stato);
      // Apri il ticket
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
            recentChanges={recentCountChanges}
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
