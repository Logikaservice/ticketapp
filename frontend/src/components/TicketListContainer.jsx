// src/components/TicketListContainer.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { FileText, PlayCircle, CheckCircle, Send, FileCheck2, Archive, ChevronDown, ChevronRight, Crown, Building, Mail } from 'lucide-react';
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
  
  const clientiAttivi = users.filter(u => u.ruolo === 'cliente');
  
  // Stati per il dropdown clienti ad albero
  const [isDropdownOpen1, setIsDropdownOpen1] = useState(false);
  const [isDropdownOpen2, setIsDropdownOpen2] = useState(false);
  const [expandedCompanies, setExpandedCompanies] = useState(() => {
    const companies = new Set(clientiAttivi.map(c => c.azienda || 'Senza azienda'));
    return companies;
  });

  // Helper per verificare se un cliente è admin della sua azienda
  const isAdminOfCompany = (cliente) => {
    if (!cliente.admin_companies || !Array.isArray(cliente.admin_companies)) return false;
    const azienda = cliente.azienda || '';
    return cliente.admin_companies.includes(azienda);
  };

  // Raggruppa clienti per azienda, con amministratori per primi
  const clientiPerAzienda = useMemo(() => {
    const grouped = {};
    clientiAttivi.forEach(cliente => {
      const azienda = cliente.azienda || 'Senza azienda';
      if (!grouped[azienda]) {
        grouped[azienda] = [];
      }
      grouped[azienda].push(cliente);
    });
    
    // Ordina i clienti dentro ogni azienda: prima gli amministratori, poi gli altri
    Object.keys(grouped).forEach(azienda => {
      grouped[azienda].sort((a, b) => {
        const aIsAdmin = isAdminOfCompany(a);
        const bIsAdmin = isAdminOfCompany(b);
        
        // Prima gli amministratori
        if (aIsAdmin && !bIsAdmin) return -1;
        if (!aIsAdmin && bIsAdmin) return 1;
        
        // Poi ordina per nome
        const nomeA = `${a.nome || ''} ${a.cognome || ''}`.trim().toLowerCase();
        const nomeB = `${b.nome || ''} ${b.cognome || ''}`.trim().toLowerCase();
        return nomeA.localeCompare(nomeB);
      });
    });
    
    // Ordina le aziende alfabeticamente
    return Object.keys(grouped)
      .sort((a, b) => {
        if (a === 'Senza azienda') return 1;
        if (b === 'Senza azienda') return -1;
        return a.toLowerCase().localeCompare(b.toLowerCase());
      })
      .reduce((acc, azienda) => {
        acc[azienda] = grouped[azienda];
        return acc;
      }, {});
  }, [clientiAttivi]);

  const toggleCompany = (azienda) => {
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(azienda)) {
        next.delete(azienda);
      } else {
        next.add(azienda);
      }
      return next;
    });
  };

  const handleSelectClient = (clientId, dropdownNum) => {
    setSelectedClientFilter(clientId === 'all' ? 'all' : clientId.toString());
    if (dropdownNum === 1) setIsDropdownOpen1(false);
    if (dropdownNum === 2) setIsDropdownOpen2(false);
  };

  const handleSelectCompany = (companyName, dropdownNum) => {
    // Usa un formato speciale per identificare che è un'azienda: "company:azienda"
    setSelectedClientFilter(`company:${companyName}`);
    if (dropdownNum === 1) setIsDropdownOpen1(false);
    if (dropdownNum === 2) setIsDropdownOpen2(false);
  };

  const isCompanyFilter = selectedClientFilter.startsWith('company:');
  const selectedCompanyName = isCompanyFilter ? selectedClientFilter.replace('company:', '') : null;
  const selectedClient = !isCompanyFilter && selectedClientFilter !== 'all' 
    ? clientiAttivi.find(c => c.id.toString() === selectedClientFilter)
    : null;
  const selectedClientName = selectedClientFilter === 'all'
    ? 'Tutti i clienti'
    : isCompanyFilter
      ? selectedCompanyName === 'Senza azienda' ? 'Senza azienda' : selectedCompanyName
      : selectedClient
        ? `${selectedClient.azienda || 'Senza azienda'}${selectedClient.email ? ` - ${selectedClient.email}` : ''}`
        : 'Tutti i clienti';

  const { displayTickets, ticketCounts, usersMap } = useMemo(() => {
    const usersMap = Object.fromEntries(users.map(user => [user.id, user]));

    // Funzione helper per trovare tutti i clienti ID di cui l'utente è amministratore
    const getCompanyClientIds = () => {
      if (currentUser.ruolo !== 'cliente') return null;
      
      // Verifica se è amministratore
      const isAdmin = currentUser.admin_companies && 
                     Array.isArray(currentUser.admin_companies) && 
                     currentUser.admin_companies.length > 0;
      
      if (!isAdmin) return null;
      
      // Trova tutti i clienti che appartengono alle aziende di cui è amministratore
      const companyNames = currentUser.admin_companies;
      const companyClients = users.filter(u => 
        u.ruolo === 'cliente' && 
        u.azienda && 
        companyNames.includes(u.azienda)
      );
      
      return companyClients.map(c => c.id);
    };

    const filterTickets = () => {
      let filtered = tickets;
      if (currentUser.ruolo === 'cliente') {
        // Se è amministratore, mostra i ticket di tutti i clienti della sua azienda
        const companyClientIds = getCompanyClientIds();
        
        if (companyClientIds && companyClientIds.length > 0) {
          // Include sia i ticket del cliente stesso che quelli degli altri clienti dell'azienda
          filtered = tickets.filter(t => {
            const ticketClientId = Number(t.clienteid);
            const matches = companyClientIds.some(id => Number(id) === ticketClientId);
            return matches;
          });
        } else {
          // Non è amministratore, mostra solo i suoi ticket
          // IMPORTANTE: Converti entrambi a Number per confronto corretto
          const currentUserId = Number(currentUser.id);
          
          filtered = tickets.filter(t => {
            const ticketClientId = Number(t.clienteid);
            const matches = ticketClientId === currentUserId;
            return matches;
          });
        }
      } else {
        if (selectedClientFilter.startsWith('company:')) {
          // Filtro per azienda
          const companyName = selectedClientFilter.replace('company:', '');
          const companyClients = clientiAttivi.filter(c => 
            (c.azienda || 'Senza azienda') === companyName
          );
          const companyClientIds = companyClients.map(c => c.id);
          filtered = tickets.filter(t => {
            const ticketClientId = Number(t.clienteid);
            return companyClientIds.some(id => Number(id) === ticketClientId);
          });
        } else if (selectedClientFilter !== 'all') {
          // Filtro per cliente specifico
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
      
      const finalFiltered = filtered.filter(t => t.stato === viewState);
      
      return finalFiltered;
    };

    const countTickets = (arr) => ({
      aperto: arr.filter(t => t.stato === 'aperto').length,
      in_lavorazione: arr.filter(t => t.stato === 'in_lavorazione').length,
      risolto: arr.filter(t => t.stato === 'risolto').length,
      chiuso: arr.filter(t => t.stato === 'chiuso').length,
      inviato: arr.filter(t => t.stato === 'inviato').length,
      fatturato: arr.filter(t => t.stato === 'fatturato').length
    });

    // Per i conteggi, usa la stessa logica
    const relevantTicketsForCounts = (() => {
      if (currentUser.ruolo === 'cliente') {
        const companyClientIds = getCompanyClientIds();
        if (companyClientIds && companyClientIds.length > 0) {
          return tickets.filter(t => {
            const ticketClientId = Number(t.clienteid);
            return companyClientIds.some(id => Number(id) === ticketClientId);
          });
        } else {
          // IMPORTANTE: Converti entrambi a Number per confronto corretto
          const currentUserId = Number(currentUser.id);
          const filtered = tickets.filter(t => Number(t.clienteid) === currentUserId);
          
          // Log per debug
          const inLavorazione = filtered.filter(t => t.stato === 'in_lavorazione');
          if (inLavorazione.length > 0) {
            console.log('🔍 CONTEGGI: Ticket "in_lavorazione" per cliente:', inLavorazione.map(t => ({
              id: t.id,
              clienteid: t.clienteid,
              stato: t.stato
            })));
          }
          
          return filtered;
        }
      }
      return tickets;
    })();

    return { 
      displayTickets: filterTickets(), 
      ticketCounts: countTickets(relevantTicketsForCounts), 
      usersMap
    };
  }, [tickets, currentUser, users, selectedClientFilter, selectedMonth, selectedYear, viewState]);

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

  // Scroll automatico al ticket selezionato
  useEffect(() => {
    if (selectedTicket) {
      // Aspetta che il DOM si aggiorni
      setTimeout(() => {
        const ticketElement = document.querySelector(`[data-ticket-id="${selectedTicket.id}"]`);
        if (ticketElement) {
          ticketElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          // Evidenzia temporaneamente il ticket
          ticketElement.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
          setTimeout(() => {
            ticketElement.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50');
          }, 2000);
        }
      }, 100);
    }
  }, [selectedTicket]);

  const markAsViewed = (status) => {
    const newLastSeen = {
      ...lastSeenCounts,
      [status]: ticketCounts[status]
    };
    setLastSeenCounts(newLastSeen);
    localStorage.setItem(`lastSeenCounts_${currentUser.id}`, JSON.stringify(newLastSeen));
    setChangedStates(prev => prev.filter(s => s !== status));
  };
  
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

          {/* Pulsante Genera Report + Filtri (Cliente: solo Inviato) */}
          {currentUser.ruolo === 'cliente' && viewState === 'inviato' && handlers.handleGenerateSentReport && (
            <div className="mt-3 flex gap-3 items-end">
              <button
                onClick={() => handlers.handleGenerateSentReport(displayTickets)}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg bg-gray-600 hover:bg-gray-700 whitespace-nowrap"
              >
                <FileText size={18} />
                Genera Report
              </button>
              <div className="w-36 md:w-40 flex-shrink-0">
                <label className="block text-sm font-medium mb-2">Mese</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-2 py-2 border rounded-lg text-sm"
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
              <div className="w-36 md:w-40 flex-shrink-0">
                <label className="block text-sm font-medium mb-2">Anno</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-2 py-2 border rounded-lg text-sm"
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

          {/* Filtri per cliente (altri stati) */}
          {currentUser.ruolo === 'cliente' && viewState !== 'inviato' && (
            <div className="mt-3 flex flex-col md:flex-row md:items-end md:gap-4">
              <div className="w-36 md:w-40 flex-shrink-0">
                <label className="block text-sm font-medium mb-2">Mese</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-2 py-2 border rounded-lg text-sm"
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
              <div className="w-36 md:w-40 flex-shrink-0">
                <label className="block text-sm font-medium mb-2">Anno</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-2 py-2 border rounded-lg text-sm"
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
                  onClick={() => handlers.handleGenerateSentReport(displayTickets)}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg bg-gray-600 hover:bg-gray-700 whitespace-nowrap"
                >
                  <FileText size={18} />
                  Genera Report
                </button>
              )}
              {viewState === 'fatturato' && handlers.handleGenerateInvoiceReport && (
                <button
                  onClick={() => handlers.handleGenerateInvoiceReport(displayTickets)}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap"
                >
                  <FileText size={18} />
                  Genera Lista Fatture
                </button>
              )}
              <div className="flex-1 min-w-0 relative">
                <label className="block text-sm font-medium mb-2">Filtra per cliente</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen1(!isDropdownOpen1)}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition min-w-0"
                  >
                    <span className={`${selectedClientFilter === 'all' ? 'text-gray-500' : 'text-gray-900'} flex items-center gap-2 flex-1 min-w-0`}>
                      {!isCompanyFilter && selectedClientFilter !== 'all' && selectedClient && isAdminOfCompany(selectedClient) && (
                        <Crown size={16} className="text-yellow-500 flex-shrink-0" />
                      )}
                      {isCompanyFilter && <Building size={16} className="text-blue-500 flex-shrink-0" />}
                      <span className="truncate">{selectedClientName}</span>
                    </span>
                    <ChevronDown 
                      size={20} 
                      className={`text-gray-400 transition-transform flex-shrink-0 ${isDropdownOpen1 ? 'rotate-180' : ''}`} 
                    />
                  </button>

                  {isDropdownOpen1 && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsDropdownOpen1(false)}
                      ></div>
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => handleSelectClient('all', 1)}
                          className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition flex items-center gap-3 border-l-2 ${
                            selectedClientFilter === 'all'
                              ? 'bg-blue-50 border-blue-500' 
                              : 'border-transparent'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium ${selectedClientFilter === 'all' ? 'text-blue-700' : 'text-gray-900'}`}>
                              Tutti i clienti
                            </span>
                          </div>
                          {selectedClientFilter === 'all' && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          )}
                        </button>
                        {Object.entries(clientiPerAzienda).map(([azienda, clientiAzienda]) => {
                          const isExpanded = expandedCompanies.has(azienda);
                          const isNoCompany = azienda === 'Senza azienda';
                          const isCompanySelected = selectedClientFilter === `company:${azienda}`;
                          
                          return (
                            <div key={azienda} className="border-b border-gray-100 last:border-b-0">
                              <div className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() => handleSelectCompany(azienda, 1)}
                                  className={`flex-1 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all flex items-center justify-between text-left ${
                                    isCompanySelected ? 'ring-2 ring-blue-500' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                      {isNoCompany ? <Building size={12} /> : azienda.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-sm font-bold text-gray-800 truncate">
                                        {isNoCompany ? 'Senza azienda' : azienda}
                                      </h3>
                                      <p className="text-xs text-gray-600">
                                        {clientiAzienda.length} {clientiAzienda.length === 1 ? 'cliente' : 'clienti'}
                                      </p>
                                    </div>
                                  </div>
                                  {isCompanySelected && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCompany(azienda);
                                  }}
                                  className="px-2 py-2 text-gray-500 hover:text-gray-700 transition"
                                >
                                  {isExpanded ? (
                                    <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
                                  )}
                                </button>
                              </div>
                              
                              {isExpanded && (
                                <div className="bg-gray-50">
                                  {clientiAzienda.map((cliente) => {
                                    const isAdmin = isAdminOfCompany(cliente);
                                    const isSelected = cliente.id.toString() === selectedClientFilter;
                                    const ticketsForThisClient = displayTickets.filter(t => t.clienteid === cliente.id).length;
                                    
                                    return (
                                      <button
                                        key={cliente.id}
                                        type="button"
                                        onClick={() => handleSelectClient(cliente.id, 1)}
                                        className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition flex items-center gap-3 border-l-2 ${
                                          isSelected 
                                            ? 'bg-blue-50 border-blue-500' 
                                            : 'border-transparent'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          {/* Spazio fisso per la corona: sempre presente, visibile solo se admin */}
                                          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                            {isAdmin && (
                                              <Crown size={16} className="text-yellow-500" />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                                                {cliente.nome} {cliente.cognome}
                                              </span>
                                              <span className="text-xs text-gray-500">({ticketsForThisClient})</span>
                                            </div>
                                            {cliente.email && (
                                              <div className="flex items-center gap-1 mt-0.5">
                                                <Mail size={12} className="text-gray-400" />
                                                <span className="text-xs text-gray-600 truncate">
                                                  {cliente.email}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        {isSelected && (
                                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="w-36 md:w-40 flex-shrink-0">
                <label className="block text-sm font-medium mb-2">Mese</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-2 py-2 border rounded-lg text-sm"
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
              <div className="w-36 md:w-40 flex-shrink-0">
                <label className="block text-sm font-medium mb-2">Anno</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-2 py-2 border rounded-lg text-sm"
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
              <div className="flex-1 min-w-0 relative">
                <label className="block text-sm font-medium mb-2">Filtra per cliente</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen2(!isDropdownOpen2)}
                    className="w-full px-3 py-2 border rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition min-w-0"
                  >
                    <span className={`${selectedClientFilter === 'all' ? 'text-gray-500' : 'text-gray-900'} flex items-center gap-2 flex-1 min-w-0`}>
                      {!isCompanyFilter && selectedClientFilter !== 'all' && selectedClient && isAdminOfCompany(selectedClient) && (
                        <Crown size={16} className="text-yellow-500 flex-shrink-0" />
                      )}
                      {isCompanyFilter && <Building size={16} className="text-blue-500 flex-shrink-0" />}
                      <span className="truncate">{selectedClientName}</span>
                    </span>
                    <ChevronDown 
                      size={20} 
                      className={`text-gray-400 transition-transform flex-shrink-0 ${isDropdownOpen2 ? 'rotate-180' : ''}`} 
                    />
                  </button>

                  {isDropdownOpen2 && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsDropdownOpen2(false)}
                      ></div>
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => handleSelectClient('all', 2)}
                          className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition flex items-center gap-3 border-l-2 ${
                            selectedClientFilter === 'all'
                              ? 'bg-blue-50 border-blue-500' 
                              : 'border-transparent'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium ${selectedClientFilter === 'all' ? 'text-blue-700' : 'text-gray-900'}`}>
                              Tutti i clienti
                            </span>
                          </div>
                          {selectedClientFilter === 'all' && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          )}
                        </button>
                        {Object.entries(clientiPerAzienda).map(([azienda, clientiAzienda]) => {
                          const isExpanded = expandedCompanies.has(azienda);
                          const isNoCompany = azienda === 'Senza azienda';
                          const isCompanySelected = selectedClientFilter === `company:${azienda}`;
                          
                          return (
                            <div key={azienda} className="border-b border-gray-100 last:border-b-0">
                              <div className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() => handleSelectCompany(azienda, 2)}
                                  className={`flex-1 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all flex items-center justify-between text-left ${
                                    isCompanySelected ? 'ring-2 ring-blue-500' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                      {isNoCompany ? <Building size={12} /> : azienda.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-sm font-bold text-gray-800 truncate">
                                        {isNoCompany ? 'Senza azienda' : azienda}
                                      </h3>
                                      <p className="text-xs text-gray-600">
                                        {clientiAzienda.length} {clientiAzienda.length === 1 ? 'cliente' : 'clienti'}
                                      </p>
                                    </div>
                                  </div>
                                  {isCompanySelected && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCompany(azienda);
                                  }}
                                  className="px-2 py-2 text-gray-500 hover:text-gray-700 transition"
                                >
                                  {isExpanded ? (
                                    <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
                                  )}
                                </button>
                              </div>
                              
                              {isExpanded && (
                                <div className="bg-gray-50">
                                  {clientiAzienda.map((cliente) => {
                                    const isAdmin = isAdminOfCompany(cliente);
                                    const isSelected = cliente.id.toString() === selectedClientFilter;
                                    const ticketsForThisClient = displayTickets.filter(t => t.clienteid === cliente.id).length;
                                    
                                    return (
                                      <button
                                        key={cliente.id}
                                        type="button"
                                        onClick={() => handleSelectClient(cliente.id, 2)}
                                        className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition flex items-center gap-3 border-l-2 ${
                                          isSelected 
                                            ? 'bg-blue-50 border-blue-500' 
                                            : 'border-transparent'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          {/* Spazio fisso per la corona: sempre presente, visibile solo se admin */}
                                          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                            {isAdmin && (
                                              <Crown size={16} className="text-yellow-500" />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                                                {cliente.nome} {cliente.cognome}
                                              </span>
                                              <span className="text-xs text-gray-500">({ticketsForThisClient})</span>
                                            </div>
                                            {cliente.email && (
                                              <div className="flex items-center gap-1 mt-0.5">
                                                <Mail size={12} className="text-gray-400" />
                                                <span className="text-xs text-gray-600 truncate">
                                                  {cliente.email}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        {isSelected && (
                                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="w-36 md:w-40 flex-shrink-0">
                <label className="block text-sm font-medium mb-2">Mese</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-2 py-2 border rounded-lg text-sm"
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
              <div className="w-36 md:w-40 flex-shrink-0">
                <label className="block text-sm font-medium mb-2">Anno</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-2 py-2 border rounded-lg text-sm"
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
                  users={users}
                />
              ))
          )}
        </div>
      </div>
    </>
  );
};

export default TicketListContainer;
