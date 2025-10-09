import React, { useState, useMemo } from 'react';
import { FileText } from 'lucide-react';
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
  tickets
}) => {
  if (currentUser.ruolo === 'cliente') {
    return (
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        {Object.keys(counts).map(status => (
          <button
            key={status}
            onClick={() => setViewState(status)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg capitalize ${
              viewState === status ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.replace('_', ' ')} ({counts[status]})
          </button>
        ))}
      </div>
    );
  }

  // Controlli per il Tecnico
  return (
    <>
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg mb-4">
        {Object.keys(counts).map(status => (
          <button
            key={status}
            onClick={() => setViewState(status)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg capitalize ${
              viewState === status ? 'bg-blue-600 text-white shadow' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.replace('_', ' ')} ({counts[status]})
          </button>
        ))}
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
const TicketListContainer = ({ currentUser, tickets, users, selectedTicket, handlers }) => {
  const [viewState, setViewState] = useState(currentUser.ruolo === 'cliente' ? 'aperto' : 'tutti');
  const [selectedClientFilter, setSelectedClientFilter] = useState('all');
  
  const { displayTickets, ticketCounts, usersMap } = useMemo(() => {
    const usersMap = Object.fromEntries(users.map(user => [user.id, user]));

    const filterTickets = () => {
      if (currentUser.ruolo === 'cliente') {
        return tickets.filter(t => t.clienteid === currentUser.id && t.stato === viewState);
      }
      const clientFiltered = selectedClientFilter === 'all'
        ? tickets
        : tickets.filter(t => t.clienteid === parseInt(selectedClientFilter));
      
      return viewState === 'tutti'
        ? clientFiltered
        : clientFiltered.filter(t => t.stato === viewState);
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

    const counts = countTickets(relevantTicketsForCounts);
    if (currentUser.ruolo === 'tecnico') {
      counts.tutti = relevantTicketsForCounts.length;
    }

    return { displayTickets: filterTickets(), ticketCounts: counts, usersMap };
  }, [tickets, users, currentUser, viewState, selectedClientFilter]);
  
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
              />
            ))
        )}
      </div>
    </div>
  );
};

export default TicketListContainer;