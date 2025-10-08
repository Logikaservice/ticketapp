import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import TicketItem from './TicketItem';

const TicketListContainer = ({ currentUser, tickets, users, selectedTicket, handlers }) => {
  const [clientViewState, setClientViewState] = useState('aperto');
  const [technicianViewState, setTechnicianViewState] = useState('tutti');
  const [selectedClientFilter, setSelectedClientFilter] = useState('all');

  let displayTickets;
  
  if (currentUser.ruolo === 'cliente') {
    displayTickets = tickets.filter(t => t.clienteid === currentUser.id && t.stato === clientViewState);
  } else {
    let filtered = selectedClientFilter === 'all' 
      ? tickets 
      : tickets.filter(t => t.clienteid === parseInt(selectedClientFilter));
    displayTickets = technicianViewState === 'tutti' 
      ? filtered 
      : filtered.filter(t => t.stato === technicianViewState);
  }

  const counts = (arr) => ({
    aperto: arr.filter(t => t.stato === 'aperto').length,
    in_lavorazione: arr.filter(t => t.stato === 'in_lavorazione').length,
    risolto: arr.filter(t => t.stato === 'risolto').length,
    chiuso: arr.filter(t => t.stato === 'chiuso').length,
    inviato: arr.filter(t => t.stato === 'inviato').length,
    fatturato: arr.filter(t => t.stato === 'fatturato').length
  });

  const clientTicketCounts = counts(tickets.filter(t => t.clienteid === currentUser.id));
  const technicianTicketCounts = { ...counts(tickets), tutti: tickets.length };
  const clientiAttivi = users.filter(u => u.ruolo === 'cliente');

  return (
    <div className="bg-white rounded-xl shadow-lg">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold mb-3">
          {currentUser.ruolo === 'cliente' ? 'I Miei Interventi' : 'Lista Ticket'}
        </h2>

        {currentUser.ruolo === 'tecnico' && (
          <>
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg mb-4">
              {Object.keys(technicianTicketCounts).map(s => (
                <button
                  key={s}
                  onClick={() => setTechnicianViewState(s)}
                  className={'flex-1 px-3 py-2 text-xs font-medium rounded-lg capitalize ' + 
                    (technicianViewState === s 
                      ? 'bg-blue-600 text-white shadow' 
                      : 'text-gray-700 hover:bg-gray-200')}
                >
                  {s.replace('_', ' ')} ({technicianTicketCounts[s]})
                </button>
              ))}
            </div>

            {technicianViewState === 'inviato' && (
              <button
                onClick={() => handlers.handleGenerateSentReport(displayTickets)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg mb-3"
              >
                <FileText size={18} />
                Genera Report
              </button>
            )}

            {technicianViewState === 'fatturato' && (
              <button
                onClick={() => handlers.handleGenerateInvoiceReport(displayTickets)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg mb-3"
              >
                <FileText size={18} />
                Genera Lista Fatture
              </button>
            )}

            <div className="mb-3">
              <label className="block text-sm font-medium mb-2">Filtra per cliente</label>
              <select
                value={selectedClientFilter}
                onChange={(e) => setSelectedClientFilter(e.target.value)}
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

        {currentUser.ruolo === 'cliente' && (
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            {Object.keys(clientTicketCounts).map(s => (
              <button
                key={s}
                onClick={() => setClientViewState(s)}
                className={'flex-1 px-3 py-2 text-xs font-medium rounded-lg capitalize ' + 
                  (clientViewState === s 
                    ? 'bg-blue-600 text-white shadow' 
                    : 'text-gray-700 hover:bg-gray-200')}
              >
                {s.replace('_', ' ')} ({clientTicketCounts[s]})
              </button>
            ))}
          </div>
        )}
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
                cliente={users.find(u => u.id === t.clienteid)}
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