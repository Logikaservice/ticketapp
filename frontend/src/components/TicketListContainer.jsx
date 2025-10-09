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
    const usersMap = Object