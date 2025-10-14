// src/components/TicketListContainer.jsx

import React, { useState, useMemo } from 'react';
import { FileText, PlayCircle, CheckCircle, Send, FileCheck2, Archive } from 'lucide-react';
import TicketItem from './TicketItem';

// ====================================================================
// COMPONENTE ESTRATTO PER I FILTRI (INVARIATO)
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
  unreadCounts
}) => {
  // ... (Tutto il codice di questo componente rimane esattamente come prima)
};


// ====================================================================
// COMPONENTE PRINCIPALE
// ====================================================================
const TicketListContainer = ({ currentUser, tickets, users, selectedTicket, handlers, getUnreadCount }) => {
  
  // --- UNICA MODIFICA: Aggiunto questo controllo di sicurezza ---
  if (!currentUser) {
    // Se i dati dell'utente non sono ancora pronti, non mostrare nulla per evitare errori
    return null;
  }
  // --- FINE DELLA MODIFICA ---

  const [viewState, setViewState] = useState('aperto');
  const [selectedClientFilter, setSelectedClientFilter] = useState('all');
  
  const { displayTickets, ticketCounts, usersMap, unreadCounts } = useMemo(() => {
    const usersMap = Object.fromEntries(users.map(user => [user.id, user]));

    const filterTickets = () => {
      if (currentUser.ruolo === 'cliente') {
        return tickets.filter(t => t.clienteid === currentUser.id && t.stato === viewState);
      }
      
      const clientFiltered = selectedClientFilter === 'all'
        ? tickets
        : tickets.filter(t => t.clienteid === parseInt(selectedClientFilter));
      
      return clientFiltered.filter(t => t.stato === viewState);
    };

    const countTickets = (arr) => ({
      aperto: arr.filter(t => t.stato === 'aperto').length,
      in_lavorazione: arr.filter(t => t.stato === 'in_lavorazione').length,
      risolto: arr.filter(t => t.stato === 'risolto').length,
      chiuso: arr.filter(t => t.stato === 'chiuso').length,
      inviato: arr.filter(t => t.stato === 'inviato').length,
      fatturato: arr.filter(t => t.stato === 'fatturato').length
    });

    const countUnreadByStatus = (arr) => {
      const counts = {};
      if (!getUnreadCount) return counts;
      arr.forEach(ticket => {
        if (getUnreadCount(ticket) > 0) {
          counts[ticket.stato] = (counts[ticket.stato] || 0) + 1;
        }
      });
      return counts;
    };

    const relevantTicketsForCounts = currentUser.ruolo === 'cliente'
      ? tickets.filter(t => t.clienteid === currentUser.id)
      : tickets;

    const counts = countTickets(relevantTicketsForCounts);
    const unreadCounts = countUnreadByStatus(relevantTicketsForCounts);

    return { 
      displayTickets: filterTickets(), 
      ticketCounts: counts, 
      usersMap,
      unreadCounts
    };
  }, [tickets, users, currentUser, viewState, selectedClientFilter, getUnreadCount]);
  
  const clientiAttivi = users.filter(u => u.ruolo === 'cliente');
  
  const handleGenerateReport = () => {
    if (!handlers) return;
    if (viewState === 'inviato' && handlers.handleGenerateSentReport) {
      handlers.handleGenerateSentReport(displayTickets);
    } else if (viewState === 'fatturato' && handlers.handleGenerateInvoiceReport) {
      handlers.handleGenerateInvoiceReport(displayTickets);
    }
  };

  return (
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
          onGenerateReport={handleGenerateReport}
          tickets={tickets}
          unreadCounts={unreadCounts}
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
  );
};

// Ho rimesso il codice completo di FilterControls per sicurezza
FilterControls.defaultProps = {
    onGenerateReport: () => {},
    unreadCounts: {}
};

export default TicketListContainer;
