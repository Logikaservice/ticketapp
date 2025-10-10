import React, { useState, useMemo } from 'react';
import { FileText, PlayCircle, CheckCircle, Send, FileCheck2, Archive } from 'lucide-react';
import TicketItem from './TicketItem';

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
  unreadCounts
}) => {
  const statusIcons = {
    aperto: <FileText size={14} />,
    in_lavorazione: <PlayCircle size={14} />,
    risolto: <CheckCircle size={14} />,
    chiuso: <Archive size={14} />,
    inviato: <Send size={14} />,
    fatturato: <FileCheck2 size={14} />,
  };

  // Definisce l'ordine esatto dei pulsanti come richiesto
  const TASTI_TECNICO = ['aperto', 'in_lavorazione', 'risolto', 'chiuso', 'inviato', 'fatturato'];

  // Logica per il Cliente
  if (currentUser.ruolo === 'cliente') {
    // Per il cliente, usiamo un ordine fisso che ha senso per lui
    const TASTI_CLIENTE = ['aperto', 'in_lavorazione', 'risolto', 'chiuso'];
    return (
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        {TASTI_CLIENTE.map(status => {
          if (counts[status] === undefined) return null;
          const unreadCount = unreadCounts[status] || 0;
          return (
            <button
              key={status}
              onClick={() => setViewState(status)}
              className={`flex flex-1 items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg capitalize ${
                viewState === status ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              {statusIcons[status]}
              <span>{status.replace('_', ' ')} ({counts[status]})</span>
              {unreadCount > 0 && <span className="ml-1">💬</span>}
            </button>
          );
        })}
      </div>
    );
  }

  // Logica per il Tecnico
  return (
    <>
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg mb-4">
        {TASTI_TECNICO.map(status => {
          if (counts[status] === undefined) return null;
          
          const count = counts[status];
          const unreadCount = unreadCounts[status] || 0;

          return (
            <button
              key={status}
              onClick={() => setViewState(status)}
              className={`flex flex-1 items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg capitalize ${
                viewState === status ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              {statusIcons[status]}
              <span>{status.replace('_', ' ')} ({count})</span>
              {unreadCount > 0 && <span className="ml-1">💬</span>}
            </button>
          );
        })}
      </div>

      {['inviato', 'fatturato'].includes(viewState) && (
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
  );
};

// ====================================================================
// COMPONENTE PRINCIPALE
// ====================================================================
const TicketListContainer = ({ currentUser, tickets, users, selectedTicket, handlers, getUnreadCount }) => {
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

export default TicketListContainer;
