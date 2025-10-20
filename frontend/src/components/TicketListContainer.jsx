// src/components/TicketListContainer.jsx

import React, { useState, useMemo, useEffect } from 'react';
import { FileText, PlayCircle, CheckCircle, Send, FileCheck2, Archive } from 'lucide-react';
import TicketItem from './TicketItem';

// ====================================================================
// COMPONENTE PRINCIPALE
// ====================================================================
const TicketListContainer = ({ currentUser, tickets, users, selectedTicket, setSelectedTicket, handlers, getUnreadCount, showFilters = true, externalViewState }) => {
  const [viewState, setViewState] = useState(externalViewState || 'aperto');
  useEffect(() => {
    if (externalViewState && externalViewState !== viewState) {
      setViewState(externalViewState);
    }
  }, [externalViewState]);
  const [selectedClientFilter, setSelectedClientFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [lastSeenCounts, setLastSeenCounts] = useState(() => {
    const saved = localStorage.getItem(`lastSeenCounts_${currentUser.id}`);
    return saved ? JSON.parse(saved) : {};
  });
  const [changedStates, setChangedStates] = useState([]);

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

      // Filtro per mese e anno (per tecnici e clienti)
      filtered = filtered.filter(t => {
        const openedAt = new Date(t.dataapertura);
        if (Number.isNaN(openedAt.getTime())) return true; // se data non valida, non filtrare
        
        const monthMatch = selectedMonth === 'all' || openedAt.getMonth() + 1 === parseInt(selectedMonth);
        const yearMatch = selectedYear === 'all' || openedAt.getFullYear() === parseInt(selectedYear);
        
        return monthMatch && yearMatch;
      });
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
  }, [tickets, users, currentUser, viewState, selectedClientFilter, selectedMonth, selectedYear]);

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

  const clientiAttivi = users.filter(u => u.ruolo === 'cliente');
  
  return (
    <>
      <div className="bg-white rounded-xl shadow-lg">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold mb-3">
            {currentUser.ruolo === 'cliente' ? 'I Miei Interventi' : 'Lista Ticket'}
          </h2>
          
          {showFilters && (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {['aperto','in_lavorazione','risolto','chiuso','inviato','fatturato'].map(status => {
                const count = ticketCounts[status] || 0;
                const disabled = count === 0;
                const active = viewState === status;
                return (
                  <button
                    key={status}
                    onClick={() => !disabled && setViewState(status)}
                    disabled={disabled}
                    className={`p-4 rounded-xl border text-center ${disabled ? 'opacity-50 cursor-not-allowed bg-white' : active ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-gray-50'}`}
                  >
                    <div className="text-sm text-gray-500 mb-1 capitalize flex items-center justify-center gap-2">
                      {status === 'aperto' && <FileText size={14} />}
                      {status === 'in_lavorazione' && <PlayCircle size={14} />}
                      {status === 'risolto' && <CheckCircle size={14} />}
                      {status === 'chiuso' && <Archive size={14} />}
                      {status === 'inviato' && <Send size={14} />}
                      {status === 'fatturato' && <FileCheck2 size={14} />}
                      <span>{status.replace('_',' ')}</span>
                    </div>
                    <div className="text-3xl font-extrabold gradient-text">{count}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pulsante Genera Report (Cliente: solo Inviato) */}
          {currentUser.ruolo === 'cliente' && viewState === 'inviato' && handlers.handleGenerateSentReport && (
            <button
              onClick={handlers.handleGenerateSentReport}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg mt-3 bg-gray-600 hover:bg-gray-700 whitespace-nowrap"
            >
              <FileText size={18} />
              Genera Report
            </button>
          )}

          {/* Filtri per cliente (tutti gli stati) */}
          {currentUser.ruolo === 'cliente' && (
            <div className="mt-3 flex flex-col md:flex-row md:items-end md:gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Mese</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">Tutti i mesi</option>
                  <option value="1">Gennaio</option>
                  <option value="2">Febbraio</option>
                  <option value="3">Marzo</option>
                  <option value="4">Aprile</option>
                  <option value="5">Maggio</option>
                  <option value="6">Giugno</option>
                  <option value="7">Luglio</option>
                  <option value="8">Agosto</option>
                  <option value="9">Settembre</option>
                  <option value="10">Ottobre</option>
                  <option value="11">Novembre</option>
                  <option value="12">Dicembre</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Anno</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">Tutti gli anni</option>
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    const years = [];
                    for (let year = currentYear; year >= currentYear - 5; year--) {
                      years.push(year);
                    }
                    return years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ));
                  })()}
                </select>
              </div>
            </div>
          )}

          {/* Pulsante Genera Report / Lista Fatture + Filtro Cliente (Tecnico: Inviato/Fatturato) */}
          {currentUser.ruolo === 'tecnico' && ['inviato', 'fatturato'].includes(viewState) && (
            <div className="mt-3 flex gap-3 items-end">
              {viewState === 'inviato' && handlers.handleGenerateSentReport && (
                <button
                  onClick={handlers.handleGenerateSentReport}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg bg-gray-600 hover:bg-gray-700 whitespace-nowrap"
                >
                  <FileText size={18} />
                  Genera Report
                </button>
              )}
              {viewState === 'fatturato' && handlers.handleGenerateInvoiceReport && (
                <button
                  onClick={handlers.handleGenerateInvoiceReport}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap"
                >
                  <FileText size={18} />
                  Genera Lista Fatture
                </button>
              )}
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Filtra per cliente</label>
                <select
                  value={selectedClientFilter}
                  onChange={(e) => setSelectedClientFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">Tutti i clienti</option>
                  {clientiAttivi
                    .slice()
                    .sort((a, b) => (a.azienda || '').localeCompare(b.azienda || '', 'it', { sensitivity: 'base' }))
                    .map(c => {
                      const ticketsForThisClient = displayTickets.filter(t => t.clienteid === c.id).length;
                      return (
                        <option key={c.id} value={c.id}>
                          {c.azienda} ({ticketsForThisClient})
                        </option>
                      );
                    })
                  }
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Mese</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">Tutti i mesi</option>
                  <option value="1">Gennaio</option>
                  <option value="2">Febbraio</option>
                  <option value="3">Marzo</option>
                  <option value="4">Aprile</option>
                  <option value="5">Maggio</option>
                  <option value="6">Giugno</option>
                  <option value="7">Luglio</option>
                  <option value="8">Agosto</option>
                  <option value="9">Settembre</option>
                  <option value="10">Ottobre</option>
                  <option value="11">Novembre</option>
                  <option value="12">Dicembre</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Anno</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">Tutti gli anni</option>
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    const years = [];
                    for (let year = currentYear; year >= currentYear - 5; year--) {
                      years.push(year);
                    }
                    return years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ));
                  })()}
                </select>
              </div>
            </div>
          )}

          {/* Filtri per tecnico (negli altri stati) */}
          {currentUser.ruolo === 'tecnico' && !['inviato', 'fatturato'].includes(viewState) && (
            <div className="mt-3 flex flex-col md:flex-row md:items-end md:gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Filtra per cliente</label>
                <select
                  value={selectedClientFilter}
                  onChange={(e) => setSelectedClientFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">Tutti i clienti</option>
                  {clientiAttivi
                    .slice()
                    .sort((a, b) => (a.azienda || '').localeCompare(b.azienda || '', 'it', { sensitivity: 'base' }))
                    .map(c => {
                      const ticketsForThisClient = displayTickets.filter(t => t.clienteid === c.id).length;
                      return (
                        <option key={c.id} value={c.id}>
                          {c.azienda} ({ticketsForThisClient})
                        </option>
                      );
                    })
                  }
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Mese</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">Tutti i mesi</option>
                  <option value="1">Gennaio</option>
                  <option value="2">Febbraio</option>
                  <option value="3">Marzo</option>
                  <option value="4">Aprile</option>
                  <option value="5">Maggio</option>
                  <option value="6">Giugno</option>
                  <option value="7">Luglio</option>
                  <option value="8">Agosto</option>
                  <option value="9">Settembre</option>
                  <option value="10">Ottobre</option>
                  <option value="11">Novembre</option>
                  <option value="12">Dicembre</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Anno</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">Tutti gli anni</option>
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    const years = [];
                    for (let year = currentYear; year >= currentYear - 5; year--) {
                      years.push(year);
                    }
                    return years.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ));
                  })()}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="divide-y" style={{ scrollBehavior: 'auto' }}>
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
