// src/components/Dashboard.jsx

import React, { useEffect } from 'react';
import { AlertTriangle, FileText, PlayCircle, CheckCircle, Archive, Send, FileCheck2, Copy, X, Info, Users, Trash2, Sparkles, Building, Search, User, Globe, Key, Eye, EyeOff, Lock, ChevronDown, Clock, Hourglass, Monitor, Paperclip } from 'lucide-react';
import TicketListContainer from './TicketListContainer';
import TicketsCalendar from './TicketsCalendar';
import TemporarySuppliesPanel from './TemporarySuppliesPanel';
import ContractTimelineCard from './ContractTimelineCard';


import { formatDate } from '../utils/formatters';
import { buildApiUrl } from '../utils/apiConfig';

const StatCard = ({ title, value, icon, highlight = null, onClick, disabled, cardKey = null }) => {
  const ringClass = highlight
    ? highlight.type === 'up'
      ? 'ring-pulse-green'
      : highlight.type === 'down'
        ? 'ring-pulse-red'
        : 'ring-pulse-green'
    : '';

  // Mappa colori per ogni stato (colori del pannello rapido - sfondo bianco pulito e solo bordo superiore)
  const colorMap = {
    'aperto': { border: 'border-top-emerald' }, // Nuove funzionalità
    'in_lavorazione': { border: 'border-top-cyan' }, // Gestione Clienti
    'risolto': { border: 'border-top-sky' }, // Sky (colore simile)
    'chiuso': { border: 'border-top-purple' }, // Analytics
    'inviato': { border: 'border-top-amber' }, // Impostazioni
    'fatturato': { border: 'border-top-orange' } // Log accessi
  };

  const colors = cardKey && colorMap[cardKey] ? colorMap[cardKey] : { border: '' };

  return (
    <button onClick={onClick} disabled={disabled} className={`card-hover text-center w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className={`p-5 rounded-xl relative overflow-hidden ${colors.border} bg-white shadow-md hover:shadow-xl transition-shadow ${ringClass}`}>
        <div className="text-sm font-medium text-gray-600 mb-3 flex items-center justify-center gap-2">{icon}<span>{title}</span></div>
        <div className="text-5xl font-extrabold gradient-text animate-pulse-strong leading-none">{value}</div>
        {/* Frecce rimosse su richiesta */}
        {highlight && highlight.type === 'up' && (
          <div className={`absolute left-4 right-4 -bottom-1 h-2 rounded-full bg-green-400 blur-md opacity-80`}></div>
        )}
        {highlight && highlight.type === 'down' && (
          <div className={`absolute left-4 right-4 -bottom-1 h-2 rounded-full bg-red-400 blur-md opacity-80`}></div>
        )}
      </div>
    </button>
  );
};


const AlertsPanel = ({ alerts = [], onOpenTicket, onCreateTicketFromAlert, onDelete, isEditable, onManageAlerts, onEditAlert, currentUser, users = [], setModalState }) => {
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const formatDateTime = (dateValue) => {
    if (!dateValue) return 'Data non disponibile';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'Data non disponibile';
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCountdown = (alert) => {
    if (alert.isPermanent) {
      return { label: 'Avviso permanente', isExpired: false };
    }
    const createdAt = alert.createdAt || alert.created_at;
    const createdDate = new Date(createdAt);
    if (Number.isNaN(createdDate.getTime())) {
      return { label: 'Data creazione non valida', isExpired: false };
    }
    const daysToExpire = alert.daysToExpire || 7;
    const expirationDate = new Date(createdDate);
    expirationDate.setDate(expirationDate.getDate() + daysToExpire);

    const diffMs = expirationDate.getTime() - now;
    if (diffMs <= 0) {
      return { label: 'Scaduto', isExpired: true };
    }

    const diffMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(diffMinutes / (60 * 24));
    const hours = Math.floor((diffMinutes % (60 * 24)) / 60);
    const minutes = diffMinutes % 60;

    if (days > 0) {
      return { label: `Scade tra ${days}g ${hours}h`, isExpired: false };
    }
    if (hours > 0) {
      return { label: `Scade tra ${hours}h ${minutes}m`, isExpired: false };
    }
    return { label: `Scade tra ${minutes}m`, isExpired: false };
  };
  // Verifica di sicurezza per users
  if (!users || !Array.isArray(users)) {
    users = [];
  }

  return (
    <div className="bg-white rounded-xl border">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Avvisi Importanti</h3>
        <div className="flex items-center gap-2">
          {currentUser?.ruolo === 'tecnico' && (
            <button
              onClick={onManageAlerts}
              className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
            >
              Gestione Avvisi
            </button>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3">
        {alerts.length === 0 && (
          <div className="text-sm text-gray-500">Nessun avviso presente.</div>
        )}
        {alerts.map(avv => {
          // Determina il colore in base alla priorità
          const getAlertColor = (level) => {
            switch (level) {
              case 'danger':
                return 'border-red-300 bg-red-50 text-red-800';
              case 'warning':
                return 'border-yellow-300 bg-yellow-50 text-yellow-800';
              case 'info':
                return 'border-blue-300 bg-blue-50 text-blue-800';
              case 'features':
                return 'border-green-300 bg-green-50 text-green-800';
              default:
                return 'border-yellow-300 bg-yellow-50 text-yellow-800';
            }
          };

          const countdownInfo = getCountdown(avv);

          return (
            <div key={avv.id} className={`w-full p-3 rounded-lg border ${getAlertColor(avv.level)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-bold flex items-center gap-2">
                    {avv.level === 'danger' ? (
                      <AlertTriangle size={16} className="text-red-600" />
                    ) : avv.level === 'info' ? (
                      <Info size={16} className="text-blue-600" />
                    ) : avv.level === 'features' ? (
                      <Sparkles size={16} className="text-green-600" />
                    ) : (
                      <AlertTriangle size={16} className="text-yellow-600" />
                    )}
                    {avv.title}
                  </div>
                  {avv.level === 'features' ? (
                    <div className="text-sm mt-1 text-justify">
                      {(() => {
                        // Mostra sempre solo 3 righe per gli avvisi features
                        const textLength = avv.body ? avv.body.length : 0;
                        const textLines = avv.body ? avv.body.split('\n').length : 0;
                        const shouldShowMore = textLength > 150 || textLines > 3;

                        if (shouldShowMore) {
                          return (
                            <div className="relative">
                              <div className="line-clamp-3 whitespace-pre-wrap pr-16">{avv.body}</div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  if (setModalState) {
                                    setModalState({ type: 'alertsHistory', data: { alertId: avv.id } });
                                  }
                                }}
                                className="text-green-600 hover:text-green-700 font-semibold text-sm absolute bottom-0 right-0 bg-white pl-1 cursor-pointer"
                              >
                                ...altro
                              </button>
                            </div>
                          );
                        } else {
                          return <div className="whitespace-pre-wrap">{avv.body}</div>;
                        }
                      })()}
                    </div>
                  ) : (
                    <div className="text-sm mt-1 whitespace-pre-wrap text-justify">{avv.body}</div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      <span>Creato il {formatDateTime(avv.createdAt || avv.created_at)}</span>
                    </div>
                    <div className={`flex items-center gap-1 ${countdownInfo.isExpired ? 'text-red-600 font-semibold' : ''}`}>
                      <Hourglass size={12} />
                      <span>{countdownInfo.label}</span>
                    </div>
                    {!avv.isPermanent && avv.daysToExpire && countdownInfo?.label && !/scad/i.test(countdownInfo.label) && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <Info size={12} />
                        <span>Durata {avv.daysToExpire} giorni</span>
                      </div>
                    )}
                  </div>

                  {/* Informazioni destinatari - solo per avvisi non features */}
                  {avv.level !== 'features' && (
                    <>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Users size={12} />
                          <span>
                            {(() => {
                              // Parsa clients se necessario
                              let clients = [];
                              try {
                                if (avv.clients) {
                                  if (Array.isArray(avv.clients)) {
                                    clients = avv.clients;
                                  } else if (typeof avv.clients === 'string') {
                                    clients = JSON.parse(avv.clients);
                                  } else {
                                    clients = avv.clients;
                                  }
                                  if (!Array.isArray(clients)) {
                                    clients = [];
                                  }
                                }
                              } catch (e) {
                                clients = [];
                              }

                              // Se ci sono clienti specifici, mostra il numero
                              if (clients.length > 0) {
                                return clients.length === 1
                                  ? `Condiviso con 1 cliente`
                                  : `Condiviso con ${clients.length} clienti`;
                              }
                              // Se non ci sono clienti specifici, è per tutti gli amministratori
                              return 'Condiviso con tutti gli amministratori';
                            })()}
                          </span>
                        </div>
                        {(() => {
                          // Parsa clients per la lista dettagliata
                          let clients = [];
                          try {
                            if (avv.clients) {
                              if (Array.isArray(avv.clients)) {
                                clients = avv.clients;
                              } else if (typeof avv.clients === 'string') {
                                clients = JSON.parse(avv.clients);
                              } else {
                                clients = avv.clients;
                              }
                              if (!Array.isArray(clients)) {
                                clients = [];
                              }
                            }
                          } catch (e) {
                            clients = [];
                          }

                          return clients.length > 0 && clients.length <= 3 && users && users.length > 0 ? (
                            <div className="text-xs text-blue-600">
                              ({clients.map(c => {
                                const user = users.find(u => u.id === c);
                                return user ? (user.azienda || `${user.nome} ${user.cognome}`) : 'Cliente';
                              }).join(', ')})
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </>
                  )}

                  {/* Visualizza allegati se presenti */}
                  {avv.attachments && avv.attachments.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs text-gray-500 mb-2">Allegati:</div>
                      <div className="flex flex-wrap gap-2">
                        {avv.attachments.map((attachment, index) => (
                          <div key={index} className="relative">
                            <img
                              src={attachment.path.startsWith('http') ? attachment.path : attachment.path}
                              alt={attachment.originalName}
                              className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80 transition"
                              onClick={() => window.open(attachment.path.startsWith('http') ? attachment.path : attachment.path, '_blank')}
                              title={attachment.originalName}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pulsante per creare ticket dall'avviso - solo per clienti, solo per avvisi Informazione, Avviso e Critico */}
                  {currentUser?.ruolo === 'cliente' && onCreateTicketFromAlert && (avv.level === 'info' || avv.level === 'warning' || avv.level === 'danger') && (
                    <div className="mt-3">
                      <button
                        onClick={() => onCreateTicketFromAlert(avv)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md"
                        title="Crea un ticket basato su questo avviso. Potrai modificare e aggiungere informazioni prima di inviarlo."
                      >
                        <FileText size={16} />
                        Crea Ticket da questo Avviso
                      </button>
                    </div>
                  )}
                </div>
                {isEditable && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEditAlert && onEditAlert(avv)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Modifica
                    </button>
                    <button
                      onClick={() => onDelete && onDelete(avv.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Rimuovi avviso"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              {avv.ticketId && (
                <div className="mt-2">
                  <button onClick={() => onOpenTicket && onOpenTicket({ id: avv.ticketId })} className="text-xs text-blue-700 hover:underline">Apri ticket collegato</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Dashboard = ({ currentUser, tickets, users = [], selectedTicket, setSelectedTicket, setModalState, onCreateTicketFromAlert, handlers, getUnreadCount, onOpenState, externalHighlights, alertsRefreshTrigger, getAuthHeader, temporarySupplies, temporarySuppliesLoading, onRemoveTemporarySupply, onRefreshTemporarySupplies, notify }) => {
  // Stati per la ricerca
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);

  // Stati per la ricerca per azienda (solo tecnico)
  const [selectedCompany, setSelectedCompany] = React.useState('');
  const [companyTickets, setCompanyTickets] = React.useState([]);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = React.useState(false);
  const [companySearchTerm, setCompanySearchTerm] = React.useState('');




  // Estrai lista aziende uniche dai clienti
  const companies = React.useMemo(() => {
    if (currentUser?.ruolo !== 'tecnico') return [];
    const clienti = users.filter(u => u.ruolo === 'cliente');
    const aziendeSet = new Set();
    clienti.forEach(c => {
      if (c.azienda && c.azienda.trim() !== '') {
        aziendeSet.add(c.azienda);
      }
    });
    return Array.from(aziendeSet).sort((a, b) => a.localeCompare(b));
  }, [users, currentUser]);

  // Filtra i ticket per azienda selezionata
  React.useEffect(() => {
    if (currentUser?.ruolo !== 'tecnico' || !selectedCompany) {
      setCompanyTickets([]);
      return;
    }

    // Trova tutti i clienti dell'azienda selezionata
    const companyClients = users.filter(u =>
      u.ruolo === 'cliente' &&
      u.azienda === selectedCompany
    );
    const companyClientIds = companyClients.map(c => c.id);

    // Filtra i ticket di questi clienti
    const filtered = tickets.filter(t => {
      const ticketClientId = Number(t.clienteid);
      return companyClientIds.some(id => Number(id) === ticketClientId);
    });

    setCompanyTickets(filtered);
  }, [selectedCompany, tickets, users, currentUser]);

  // Raggruppa i ticket per stato
  const companyTicketsByState = React.useMemo(() => {
    const grouped = {
      aperto: [],
      in_lavorazione: [],
      risolto: [],
      chiuso: [],
      inviato: [],
      fatturato: []
    };

    companyTickets.forEach(ticket => {
      const stato = ticket.stato || 'aperto';
      if (grouped[stato]) {
        grouped[stato].push(ticket);
      }
    });

    return grouped;
  }, [companyTickets]);

  const companyCounts = React.useMemo(() => ({
    aperto: companyTicketsByState.aperto.length,
    in_lavorazione: companyTicketsByState.in_lavorazione.length,
    risolto: companyTicketsByState.risolto.length,
    chiuso: companyTicketsByState.chiuso.length,
    inviato: companyTicketsByState.inviato.length,
    fatturato: companyTicketsByState.fatturato.length,
    totale: companyTickets.length
  }), [companyTicketsByState, companyTickets.length]);

  const visibleTickets = React.useMemo(() => {
    if (currentUser?.ruolo === 'cliente') {
      // Verifica se è amministratore
      const isAdmin = currentUser.admin_companies &&
        Array.isArray(currentUser.admin_companies) &&
        currentUser.admin_companies.length > 0;

      if (isAdmin) {
        // Se è amministratore, mostra i ticket di tutti i clienti delle sue aziende
        const companyNames = currentUser.admin_companies;
        const companyClients = users.filter(u =>
          u.ruolo === 'cliente' &&
          u.azienda &&
          companyNames.includes(u.azienda)
        );
        const companyClientIds = companyClients.map(c => c.id);

        if (companyClientIds.length > 0) {
          return tickets.filter(t => {
            const ticketClientId = Number(t.clienteid);
            return companyClientIds.some(id => Number(id) === ticketClientId);
          });
        }
      }

      // Non è amministratore, mostra TUTTI i suoi ticket (non solo "aperto")
      // IMPORTANTE: Converti entrambi a Number per confronto corretto
      const currentUserId = Number(currentUser.id);
      return tickets.filter(t => Number(t.clienteid) === currentUserId);
    }
    if (currentUser?.ruolo === 'tecnico') {
      if (selectedCompany) {
        return companyTickets;
      }
      return tickets;
    }
    return tickets;
  }, [tickets, currentUser, users, selectedCompany, companyTickets]);

  const counts = React.useMemo(() => ({
    aperto: visibleTickets.filter(t => t.stato === 'aperto').length,
    in_lavorazione: visibleTickets.filter(t => t.stato === 'in_lavorazione').length,
    risolto: visibleTickets.filter(t => t.stato === 'risolto').length,
    chiuso: visibleTickets.filter(t => t.stato === 'chiuso').length,
    inviato: visibleTickets.filter(t => t.stato === 'inviato').length,
    fatturato: visibleTickets.filter(t => t.stato === 'fatturato').length
  }), [visibleTickets]);

  // Filtra le forniture temporanee in base al ruolo dell'utente
  const filteredTemporarySupplies = React.useMemo(() => {
    if (!temporarySupplies || temporarySupplies.length === 0) {
      return [];
    }

    // I tecnici vedono tutte le forniture
    if (currentUser?.ruolo === 'tecnico') {
      return temporarySupplies;
    }

    // I clienti vedono solo le forniture della loro azienda
    if (currentUser?.ruolo === 'cliente') {
      // Verifica se è amministratore
      const isAdmin = currentUser.admin_companies &&
        Array.isArray(currentUser.admin_companies) &&
        currentUser.admin_companies.length > 0;

      if (isAdmin) {
        // Se è amministratore, mostra le forniture delle sue aziende
        const companyNames = currentUser.admin_companies;
        return temporarySupplies.filter(supply => 
          supply.azienda && companyNames.includes(supply.azienda)
        );
      }

      // Non è amministratore, mostra solo le forniture della sua azienda
      if (currentUser?.azienda) {
        return temporarySupplies.filter(supply => 
          supply.azienda === currentUser.azienda
        );
      }

      return [];
    }

    return [];
  }, [temporarySupplies, currentUser]);
  // Evidenzia spostamenti basati su segnali esterni (eventi dal polling/azioni)
  const [activeHighlights, setActiveHighlights] = React.useState({});
  useEffect(() => {
    if (!externalHighlights) return;
    setActiveHighlights(externalHighlights);
  }, [externalHighlights]);


  const roleLabel = currentUser?.ruolo === 'tecnico' ? 'Tecnico' : 'Cliente';

  // --- CONTRACTS LOGIC ---
  const [contracts, setContracts] = React.useState([]);

  const fetchContracts = React.useCallback(async () => {
    if (!currentUser) return;
    
    // Tecnici vedono tutti i contratti
    if (currentUser.ruolo === 'tecnico') {
      try {
        const res = await fetch(buildApiUrl('/api/contracts'), { headers: getAuthHeader() });
        if (res.ok) {
          const data = await res.json();
          setContracts(data);
        }
      } catch (err) {
        console.error('Failed to load contracts', err);
      }
    }
    // Clienti amministratori vedono i contratti delle loro aziende
    else if (currentUser.ruolo === 'cliente') {
      // Verifica se è amministratore
      const isAdmin = currentUser.admin_companies &&
        Array.isArray(currentUser.admin_companies) &&
        currentUser.admin_companies.length > 0;

      if (isAdmin) {
        try {
          const res = await fetch(buildApiUrl('/api/contracts'), { headers: getAuthHeader() });
          if (res.ok) {
            const allContracts = await res.json();
            // Filtra i contratti per le aziende di cui è amministratore
            const companyNames = currentUser.admin_companies;
            const filteredContracts = allContracts.filter(contract => 
              contract.azienda && companyNames.includes(contract.azienda)
            );
            setContracts(filteredContracts);
          }
        } catch (err) {
          console.error('Failed to load contracts', err);
        }
      } else {
        // Se non è amministratore, non mostra contratti
        setContracts([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.ruolo, currentUser?.admin_companies, currentUser?.id, getAuthHeader]);

  React.useEffect(() => {
    if (!currentUser) {
      setContracts([]);
      return;
    }
    
    // Esegui fetchContracts quando currentUser è disponibile
    fetchContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.ruolo, JSON.stringify(currentUser?.admin_companies || [])]);

  // Listener per refresh automatico quando viene creato, eliminato o modificato un contratto
  React.useEffect(() => {
    const handleContractCreated = () => {
      fetchContracts();
    };
    const handleContractDeleted = () => {
      fetchContracts();
    };
    const handleContractUpdated = () => {
      fetchContracts();
    };
    window.addEventListener('contractCreated', handleContractCreated);
    window.addEventListener('contractDeleted', handleContractDeleted);
    window.addEventListener('contractUpdated', handleContractUpdated);
    return () => {
      window.removeEventListener('contractCreated', handleContractCreated);
      window.removeEventListener('contractDeleted', handleContractDeleted);
      window.removeEventListener('contractUpdated', handleContractUpdated);
    };
  }, [fetchContracts]);

  // --- END CONTRACTS LOGIC --- 

  // Funzione di ricerca avanzata che cerca in tutti i campi del ticket
  const advancedSearch = (ticket, searchTerm) => {
    const searchLower = searchTerm.toLowerCase().trim();

    // Ricerca base: numero, titolo, id, descrizione
    if (
      ticket.numero?.toLowerCase().includes(searchLower) ||
      ticket.titolo?.toLowerCase().includes(searchLower) ||
      ticket.id?.toString().includes(searchTerm) ||
      ticket.descrizione?.toLowerCase().includes(searchLower) ||
      ticket.nomerichiedente?.toLowerCase().includes(searchLower)
    ) {
      return true;
    }

    // Ricerca nei messaggi (chat)
    if (ticket.messaggi && Array.isArray(ticket.messaggi)) {
      const foundInMessages = ticket.messaggi.some(message =>
        message.contenuto?.toLowerCase().includes(searchLower) ||
        message.autore?.toLowerCase().includes(searchLower)
      );
      if (foundInMessages) return true;
    }

    // Ricerca nei timelogs (registro intervento)
    if (ticket.timelogs && Array.isArray(ticket.timelogs)) {
      const foundInTimeLogs = ticket.timelogs.some(log =>
        log.descrizione?.toLowerCase().includes(searchLower) ||
        log.modalita?.toLowerCase().includes(searchLower) ||
        (log.materials && Array.isArray(log.materials) && log.materials.some(m =>
          m.nome?.toLowerCase().includes(searchLower)
        )) ||
        (log.offerte && Array.isArray(log.offerte) && log.offerte.some(o =>
          o.descrizione?.toLowerCase().includes(searchLower) ||
          o.numeroOfferta?.toLowerCase().includes(searchLower)
        ))
      );
      if (foundInTimeLogs) return true;
    }

    return false;
  };

  // Effetto per la ricerca avanzata in tempo reale
  React.useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      const results = visibleTickets.filter(ticket =>
        advancedSearch(ticket, searchTerm)
      ).slice(0, 10); // Limita a 10 risultati

      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, visibleTickets]);

  // Avvisi: ora da API backend
  const [alerts, setAlerts] = React.useState([]);
  // Usa buildApiUrl direttamente per evitare doppio slash
  const apiBase = buildApiUrl('') || '';
  const isKeepassAdmin = currentUser?.ruolo === 'cliente' &&
    Array.isArray(currentUser?.admin_companies) &&
    currentUser.admin_companies.length > 0;

  const [keepassSearchQuery, setKeepassSearchQuery] = React.useState('');
  const [keepassSearchLoading, setKeepassSearchLoading] = React.useState(false);
  const [keepassSearchError, setKeepassSearchError] = React.useState(null);
  const [keepassEntries, setKeepassEntries] = React.useState([]);
  const [keepassHasLoaded, setKeepassHasLoaded] = React.useState(false);
  const [keepassVisiblePasswords, setKeepassVisiblePasswords] = React.useState({});
  const [keepassHighlightEntryId, setKeepassHighlightEntryId] = React.useState(null);

  const loadKeepassEntries = React.useCallback(async () => {
    if (!getAuthHeader) return;

    try {
      setKeepassSearchLoading(true);
      setKeepassSearchError(null);

      const authHeader = getAuthHeader();
      const response = await fetch(buildApiUrl('/api/keepass/credentials'), {
        headers: {
          ...authHeader,
          'x-user-id': currentUser?.id?.toString() || authHeader['x-user-id'] || '',
          'x-user-role': currentUser?.ruolo || ''
        }
      });

      if (!response.ok) {
        throw new Error('Errore nel caricamento delle credenziali KeePass');
      }

      const data = await response.json();
      const groups = Array.isArray(data?.groups) ? data.groups : [];
      const flattenedEntries = [];

      // Helper per estrarre stringa da campo che potrebbe essere oggetto JSON o stringa JSON
      const extractString = (val) => {
        if (!val) return '';
        if (typeof val === 'string') {
          // Se è una stringa JSON, prova a parsarla
          if (val.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(val);
              return parsed._ !== undefined ? String(parsed._ || '') : val;
            } catch {
              return val;
            }
          }
          return val;
        }
        if (typeof val === 'object') {
          // Se è un oggetto, estrai il valore da _
          return val._ !== undefined ? String(val._ || '') : JSON.stringify(val);
        }
        return String(val || '');
      };

      const collectEntries = (group, parentPath = []) => {
        const currentPath = [...parentPath, extractString(group.name || '')];
        if (group.entries && Array.isArray(group.entries)) {
          group.entries.forEach(entry => {
            if (!entry?.password_encrypted || typeof entry.password_encrypted !== 'string' || !entry.password_encrypted.includes(':')) {
              return;
            }

            // Estrai tutti i campi - forza estrazione anche se sembrano già stringhe
            const title = extractString(entry.title || '');
            const username = extractString(entry.username || '');
            const url = extractString(entry.url || '');
            const notes = extractString(entry.notes || '');

            // Debug rimosso - la ricerca ora avviene lato backend

            // Filtra entry senza titolo valido
            if (!title || title.trim() === '' || title.trim().toLowerCase() === 'senza titolo') {
              return;
            }

            flattenedEntries.push({
              id: entry.id,
              title: title,
              username: username,
              url: url,
              notes: notes,
              password_encrypted: entry.password_encrypted,
              icon_id: entry.icon_id || 0,
              groupName: currentPath.filter(Boolean).join(' / ')
            });
          });
        }

        if (group.children && Array.isArray(group.children)) {
          group.children.forEach(child => collectEntries(child, currentPath));
        }
      };

      groups.forEach(group => collectEntries(group));

      // Nota: loadKeepassEntries viene ancora usato per altri scopi, ma la ricerca
      // ora avviene completamente lato backend tramite /api/keepass/search
      setKeepassEntries(flattenedEntries);
      setKeepassHasLoaded(true);
    } catch (err) {
      console.error('Errore caricamento rapida KeePass:', err);
      setKeepassSearchError(err?.message || 'Errore nel recupero delle credenziali');
    } finally {
      setKeepassSearchLoading(false);
    }
  }, [apiBase, currentUser, getAuthHeader]);

  // Ricerca lato backend invece che lato frontend
  const [keepassSearchResults, setKeepassSearchResults] = React.useState([]);
  const [keepassSearchLoadingResults, setKeepassSearchLoadingResults] = React.useState(false);

  React.useEffect(() => {
    // Verifica condizioni PRIMA di impostare il timeout
    if (!getAuthHeader) {
      return;
    }

    if (!isKeepassAdmin) {
      return;
    }

    const term = keepassSearchQuery.trim().toLowerCase().replace(/^["']+|["']+$/g, '').trim();

    if (term.length < 2) {
      setKeepassSearchResults([]);
      return;
    }

    const searchKeepass = async () => {
      if (!getAuthHeader || !isKeepassAdmin) {
        return;
      }

      try {
        setKeepassSearchLoadingResults(true);
        const authHeader = getAuthHeader();
        const response = await fetch(`${apiBase}/api/keepass/search?q=${encodeURIComponent(term)}`, {
          headers: {
            ...authHeader,
            'x-user-id': currentUser?.id?.toString() || authHeader['x-user-id'] || '',
            'x-user-role': currentUser?.ruolo || ''
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Errore risposta API ricerca KeePass:', response.status, errorText);
          throw new Error('Errore nella ricerca');
        }

        const data = await response.json();
        setKeepassSearchResults(data.results || []);
      } catch (err) {
        console.error('Errore ricerca KeePass:', err);
        setKeepassSearchResults([]);
      } finally {
        setKeepassSearchLoadingResults(false);
      }
    };

    const timeoutId = setTimeout(searchKeepass, 300); // Debounce 300ms

    return () => clearTimeout(timeoutId);
  }, [keepassSearchQuery]); // SOLO keepassSearchQuery come dipendenza!

  // Usa i risultati dal backend - ricerca ora lato backend
  const keepassResults = keepassSearchResults;

  // Nota: ricerca ora completamente lato backend tramite /api/keepass/search

  React.useEffect(() => {
    if (isKeepassAdmin && !keepassHasLoaded && !keepassSearchLoading) {
      loadKeepassEntries();
    }
  }, [isKeepassAdmin, keepassHasLoaded, keepassSearchLoading, loadKeepassEntries]);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(buildApiUrl('/api/alerts'), {
        headers: getAuthHeader()
      });
      if (!res.ok) throw new Error('Errore caricamento avvisi');
      const allAlerts = await res.json();

      // Parsa correttamente il campo clients se è una stringa JSON
      const parsedAlerts = allAlerts.map(alert => {
        let clients = [];
        try {
          if (alert.clients) {
            if (Array.isArray(alert.clients)) {
              clients = alert.clients;
            } else if (typeof alert.clients === 'string') {
              clients = JSON.parse(alert.clients);
            } else {
              clients = alert.clients;
            }
            if (!Array.isArray(clients)) {
              clients = [];
            }
          }
        } catch (e) {
          console.error('Errore parsing clients alert:', e);
          clients = [];
        }
        return { ...alert, clients };
      });

      // Filtra gli avvisi in base al ruolo dell'utente
      let filteredAlerts = parsedAlerts;
      if (currentUser?.ruolo === 'cliente') {
        const userId = Number(currentUser.id);

        // Verifica se il cliente è un amministratore (ha admin_companies)
        const isAdmin = currentUser.admin_companies &&
          Array.isArray(currentUser.admin_companies) &&
          currentUser.admin_companies.length > 0;

        // Filtra gli avvisi:
        // 1. Se l'avviso ha clienti specifici: il cliente lo vede solo se è nella lista (anche se non è amministratore)
        // 2. Se l'avviso NON ha clienti specifici: solo gli amministratori lo vedono
        filteredAlerts = parsedAlerts.filter(alert => {
          // Se l'avviso ha clienti specifici
          if (alert.clients && Array.isArray(alert.clients) && alert.clients.length > 0) {
            // Il cliente vede l'avviso solo se è nella lista dei clienti specifici
            return alert.clients.some(clientId => Number(clientId) === userId);
          }

          // Se l'avviso NON ha clienti specifici (è per tutti), solo gli amministratori lo vedono
          return isAdmin;
        });
      }
      // I tecnici vedono tutti gli avvisi (non serve filtro)

      // Filtra gli avvisi temporanei scaduti (per tutti gli utenti)
      // IMPORTANTE: Gli avvisi "features" temporanei scaduti devono scomparire dalla dashboard
      // ma rimanere sempre visibili nel modal "Nuove funzionalità"
      const activeAlerts = filteredAlerts.filter(alert => {
        // Se è permanente, mostralo sempre
        if (alert.isPermanent) {
          return true;
        }

        // Se è temporaneo, verifica se è scaduto
        const createdAt = new Date(alert.createdAt || alert.created_at);
        const daysToExpire = alert.daysToExpire || 7;
        const expirationDate = new Date(createdAt);
        expirationDate.setDate(expirationDate.getDate() + daysToExpire);

        // Se è scaduto, non mostrarlo nella dashboard
        const isExpired = new Date() > expirationDate;
        if (isExpired) {
          return false;
        }

        // Se non è scaduto, mostralo
        return true;
      });

      setAlerts(activeAlerts);
    } catch (e) {
      console.error(e);
    }
  };
  useEffect(() => { fetchAlerts(); }, [currentUser]);
  useEffect(() => {
    if (alertsRefreshTrigger > 0) {
      fetchAlerts();
    }
  }, [alertsRefreshTrigger]);

  const [newAlert, setNewAlert] = React.useState({ title: '', body: '', level: 'warning' });
  const levelToColor = (level) => {
    if (level === 'danger') return 'border-red-300 bg-red-50 text-red-800';
    if (level === 'info') return 'border-blue-300 bg-blue-50 text-blue-800';
    if (level === 'features') return 'border-green-300 bg-green-50 text-green-800';
    return 'border-yellow-300 bg-yellow-50 text-yellow-800';
  };
  const addAlert = async () => {
    if (!newAlert.title || !newAlert.body) return;
    try {
      const res = await fetch(buildApiUrl('/api/alerts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'tecnico' },
        body: JSON.stringify({ title: newAlert.title, body: newAlert.body, level: newAlert.level })
      });
      if (!res.ok) throw new Error('Errore creazione avviso');
      setNewAlert({ title: '', body: '', level: 'warning' });
      fetchAlerts();
    } catch (e) {
      console.error(e);
    }
  };
  const deleteAlert = async (id) => {
    try {
      const res = await fetch(buildApiUrl(`/api/alerts/${id}`), {
        method: 'DELETE',
        headers: {
          ...getAuthHeader(),
          'x-user-role': 'tecnico'
        }
      });
      if (!res.ok) throw new Error('Errore eliminazione avviso');
      fetchAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  // Funzioni per gestione avvisi nel modal
  const handleSaveAlert = async (alertData) => {
    try {
      const formData = new FormData();
      formData.append('title', alertData.title);
      formData.append('body', alertData.description);
      formData.append('level', alertData.priority);
      formData.append('clients', JSON.stringify(alertData.clients));
      formData.append('isPermanent', alertData.isPermanent);
      formData.append('daysToExpire', alertData.daysToExpire);
      formData.append('created_by', currentUser?.nome + ' ' + currentUser?.cognome);

      // Aggiungi i file selezionati
      if (alertData.files && alertData.files.length > 0) {
        alertData.files.forEach((file, index) => {
          formData.append('attachments', file);
        });
      }

      const res = await fetch(buildApiUrl('/api/alerts'), {
        method: 'POST',
        headers: {
          'x-user-role': 'tecnico',
          'x-user-id': currentUser?.id
        },
        body: formData
      });
      if (!res.ok) throw new Error('Errore creazione avviso');
      fetchAlerts();
    } catch (e) {
      console.error('Errore salvataggio avviso:', e);
      alert('Errore nel salvare l\'avviso');
    }
  };

  const handleEditAlert = async (alertData) => {
    try {
      const formData = new FormData();
      formData.append('title', alertData.title);
      formData.append('body', alertData.description);
      formData.append('level', alertData.priority);
      formData.append('clients', JSON.stringify(alertData.clients));
      formData.append('isPermanent', alertData.isPermanent);
      formData.append('daysToExpire', alertData.daysToExpire);
      formData.append('existingAttachments', JSON.stringify(alertData.existingAttachments || []));

      // Aggiungi i nuovi file selezionati
      if (alertData.files && alertData.files.length > 0) {
        alertData.files.forEach((file, index) => {
          formData.append('attachments', file);
        });
      }

      const res = await fetch(`${apiBase}/api/alerts/${alertData.id}`, {
        method: 'PUT',
        headers: {
          'x-user-role': 'tecnico',
          'x-user-id': currentUser?.id
        },
        body: formData
      });
      if (!res.ok) throw new Error('Errore modifica avviso');
      fetchAlerts();
    } catch (e) {
      console.error('Errore modifica avviso:', e);
      alert('Errore nel modificare l\'avviso');
    }
  };

  const handleEditAlertClick = (alert) => {
    setModalState({ type: 'manageAlerts', data: alert });
  };

  const statCards = [
    { key: 'aperto', title: 'Aperti', value: counts.aperto, icon: <FileText size={18} /> },
    { key: 'in_lavorazione', title: 'In lavorazione', value: counts.in_lavorazione, icon: <PlayCircle size={18} /> },
    { key: 'risolto', title: 'Risolti', value: counts.risolto, icon: <CheckCircle size={18} /> },
    { key: 'chiuso', title: 'Chiusi', value: counts.chiuso, icon: <Archive size={18} /> },
    { key: 'inviato', title: 'Inviati', value: counts.inviato, icon: <Send size={18} /> },
    { key: 'fatturato', title: 'Fatturati', value: counts.fatturato, icon: <FileCheck2 size={18} /> }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Dashboard Riepilogo ({roleLabel})</h2>
        <div className="flex items-center gap-4">
          {/* Ricerca per azienda (solo tecnico) */}
          {currentUser?.ruolo === 'tecnico' && (
            <div className="relative">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white hover:border-blue-400 transition flex items-center gap-2 justify-between whitespace-nowrap"
                  style={{ minWidth: '200px', width: 'auto' }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {selectedCompany ? (
                      <>
                        <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {selectedCompany.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-gray-900">{selectedCompany}</span>
                      </>
                    ) : (
                      <>
                        <Building size={18} className="text-gray-500 flex-shrink-0" />
                        <span className="text-gray-500">Cerca per Azienda...</span>
                      </>
                    )}
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform flex-shrink-0 ml-2 ${isCompanyDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {selectedCompany && (
                  <button
                    onClick={() => {
                      setSelectedCompany('');
                      setIsCompanyDropdownOpen(false);
                    }}
                    className="px-2 py-2 text-gray-500 hover:text-gray-700 transition"
                    title="Rimuovi filtro"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {isCompanyDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsCompanyDropdownOpen(false)}
                  ></div>
                  <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto" style={{ minWidth: '200px', width: 'max-content' }}>
                    <div className="sticky top-0 bg-white p-2 border-b z-10">
                      <div className="flex items-center gap-2 border border-gray-300 rounded-md px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                        <Search size={14} className="text-gray-400" />
                        <input
                          type="text"
                          placeholder="Filtra aziende..."
                          className="w-full text-sm outline-none text-gray-700 placeholder-gray-400"
                          value={companySearchTerm}
                          onChange={(e) => setCompanySearchTerm(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                        {companySearchTerm && (
                          <button onClick={(e) => { e.stopPropagation(); setCompanySearchTerm(''); }} className="text-gray-400 hover:text-gray-600">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCompany('');
                        setIsCompanyDropdownOpen(false);
                        setCompanySearchTerm('');
                      }}
                      className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition flex items-center gap-3 border-l-2 ${!selectedCompany
                        ? 'bg-blue-50 border-blue-500'
                        : 'border-transparent'
                        }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${!selectedCompany ? 'text-blue-700' : 'text-gray-900'}`}>
                          Tutte le aziende
                        </span>
                      </div>
                      {!selectedCompany && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                      )}
                    </button>
                    {companies
                      .filter(c => c.toLowerCase().includes(companySearchTerm.toLowerCase()))
                      .slice(0, 50)
                      .map(azienda => {
                        const isSelected = selectedCompany === azienda;
                        return (
                          <button
                            key={azienda}
                            type="button"
                            onClick={() => {
                              setSelectedCompany(azienda);
                              setIsCompanyDropdownOpen(false);
                              setCompanySearchTerm('');
                            }}
                            className={`w-full px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all flex items-center gap-2 text-left ${isSelected ? 'ring-2 ring-blue-500' : ''
                              }`}
                          >
                            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {azienda.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-bold text-gray-800 truncate">
                                {azienda}
                              </h3>
                            </div>
                            {isSelected && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                            )}
                          </button>
                        );
                      })}
                    {companies.filter(c => c.toLowerCase().includes(companySearchTerm.toLowerCase())).length > 50 && (
                      <div className="px-4 py-2 text-xs text-gray-500 text-center border-t bg-gray-50">
                        ... e altre {companies.filter(c => c.toLowerCase().includes(companySearchTerm.toLowerCase())).length - 50} aziende
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Campo ricerca avanzata */}
          <div className="relative">
            <input
              type="text"
              placeholder="Ricerca Avanzata (numero, titolo, descrizione, messaggi, interventi...)"
              className="w-80 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  // Seleziona il primo risultato
                  const firstResult = searchResults[0];
                  if (handlers?.handleSelectTicket) {
                    handlers.handleSelectTicket(firstResult);
                  }
                  if (onOpenState) {
                    onOpenState(firstResult.stato);
                  }
                  setSearchTerm('');
                  setSearchResults([]);
                }
              }}
              onBlur={() => {
                // Chiudi i risultati dopo un breve delay per permettere il click
                setTimeout(() => setSearchResults([]), 200);
              }}
            />

            {/* Lista risultati ricerca avanzata */}
            {searchTerm && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                {searchResults.map((ticket) => {
                  // Trova dove si trova il termine di ricerca per evidenziarlo
                  const getMatchHint = (ticket, searchTerm) => {
                    const searchLower = searchTerm.toLowerCase();
                    if (ticket.numero?.toLowerCase().includes(searchLower)) return 'Numero ticket';
                    if (ticket.titolo?.toLowerCase().includes(searchLower)) return 'Titolo';
                    if (ticket.descrizione?.toLowerCase().includes(searchLower)) return 'Descrizione';
                    if (ticket.nomerichiedente?.toLowerCase().includes(searchLower)) return 'Richiedente';
                    if (ticket.messaggi && Array.isArray(ticket.messaggi) && ticket.messaggi.some(m =>
                      m.contenuto?.toLowerCase().includes(searchLower)
                    )) return 'Messaggi';
                    if (ticket.timelogs && Array.isArray(ticket.timelogs) && ticket.timelogs.some(log =>
                      log.descrizione?.toLowerCase().includes(searchLower)
                    )) return 'Registro intervento';
                    return 'Trovato';
                  };

                  return (
                    <div
                      key={ticket.id}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition"
                      onClick={() => {
                        if (handlers?.handleSelectTicket) {
                          handlers.handleSelectTicket(ticket);
                        }
                        if (onOpenState) {
                          onOpenState(ticket.stato);
                        }
                        setSearchTerm('');
                        setSearchResults([]);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
                            {ticket.numero}
                            {(ticket.photos && ticket.photos.length > 0) && (
                              <span className="flex items-center gap-1 text-purple-600" title={`${ticket.photos.length} file allegato${ticket.photos.length !== 1 ? 'i' : ''}`}>
                                <Paperclip size={12} />
                                <span className="text-xs">{ticket.photos.length}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-700 truncate mt-0.5">{ticket.titolo}</div>
                          <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                            <span className="text-gray-400">•</span>
                            <span>{getMatchHint(ticket, searchTerm)}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          {ticket.stato}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Messaggio nessun risultato */}
            {searchTerm && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-3">
                <div className="text-sm text-gray-500">Nessun ticket trovato</div>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-500">Oggi: {formatDate(new Date().toISOString())}</div>
        </div>
      </div>

      {/* Sezione ricerca per azienda (solo tecnico) */}
      {currentUser?.ruolo === 'tecnico' && selectedCompany && (
        <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Building size={24} className="text-purple-600" />
              <div>
                <h3 className="text-xl font-bold text-gray-900">Ticket per Azienda: {selectedCompany}</h3>
                <p className="text-sm text-gray-600">Totale ticket: {companyCounts.totale}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedCompany('')}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-white rounded-lg transition"
            >
              Chiudi
            </button>
          </div>

          {/* Statistiche per stato */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-4">
            <div className="card-hover p-4 bg-white rounded-xl border border-gray-200 border-top-blue bg-gradient-blue shadow-sm hover:shadow-lg text-center">
              <div className="text-sm font-medium text-gray-600 mb-2 flex items-center justify-center gap-2">
                <FileText size={18} />
                <span>Aperti</span>
              </div>
              <div className="text-3xl font-extrabold text-blue-600">{companyCounts.aperto}</div>
            </div>
            <div className="card-hover p-4 bg-white rounded-xl border border-gray-200 border-top-yellow bg-gradient-yellow shadow-sm hover:shadow-lg text-center">
              <div className="text-sm font-medium text-gray-600 mb-2 flex items-center justify-center gap-2">
                <PlayCircle size={18} />
                <span>In Lavorazione</span>
              </div>
              <div className="text-3xl font-extrabold text-yellow-600">{companyCounts.in_lavorazione}</div>
            </div>
            <div className="card-hover p-4 bg-white rounded-xl border border-gray-200 border-top-green bg-gradient-green shadow-sm hover:shadow-lg text-center">
              <div className="text-sm font-medium text-gray-600 mb-2 flex items-center justify-center gap-2">
                <CheckCircle size={18} />
                <span>Risolti</span>
              </div>
              <div className="text-3xl font-extrabold text-green-600">{companyCounts.risolto}</div>
            </div>
            <div className="card-hover p-4 bg-white rounded-xl border border-gray-200 border-top-purple bg-gradient-purple shadow-sm hover:shadow-lg text-center">
              <div className="text-sm font-medium text-gray-600 mb-2 flex items-center justify-center gap-2">
                <Archive size={18} />
                <span>Chiusi</span>
              </div>
              <div className="text-3xl font-extrabold text-purple-600">{companyCounts.chiuso}</div>
            </div>
            <div className="card-hover p-4 bg-white rounded-xl border border-gray-200 border-top-teal bg-gradient-teal shadow-sm hover:shadow-lg text-center">
              <div className="text-sm font-medium text-gray-600 mb-2 flex items-center justify-center gap-2">
                <Send size={18} />
                <span>Inviati</span>
              </div>
              <div className="text-3xl font-extrabold text-teal-600">{companyCounts.inviato}</div>
            </div>
            <div className="card-hover p-4 bg-white rounded-xl border border-gray-200 border-top-gray bg-gradient-gray shadow-sm hover:shadow-lg text-center">
              <div className="text-sm font-medium text-gray-600 mb-2 flex items-center justify-center gap-2">
                <FileCheck2 size={18} />
                <span>Fatturati</span>
              </div>
              <div className="text-3xl font-extrabold text-gray-600">{companyCounts.fatturato}</div>
            </div>
          </div>

          {/* Lista ticket raggruppati per stato */}
          <div className="space-y-4">
            {Object.entries(companyTicketsByState).map(([stato, ticketsStato]) => {
              if (ticketsStato.length === 0) return null;

              const statoLabels = {
                aperto: 'Aperti',
                in_lavorazione: 'In Lavorazione',
                risolto: 'Risolti',
                chiuso: 'Chiusi',
                inviato: 'Inviati',
                fatturato: 'Fatturati'
              };

              const statoColors = {
                aperto: 'bg-blue-50 border-blue-200 text-blue-800',
                in_lavorazione: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                risolto: 'bg-green-50 border-green-200 text-green-800',
                chiuso: 'bg-purple-50 border-purple-200 text-purple-800',
                inviato: 'bg-teal-50 border-teal-200 text-teal-800',
                fatturato: 'bg-gray-50 border-gray-200 text-gray-800'
              };

              return (
                <div key={stato} className={`border rounded-lg p-4 ${statoColors[stato] || statoColors.aperto}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-lg">{statoLabels[stato] || stato} ({ticketsStato.length})</h4>
                    <button
                      onClick={() => {
                        if (onOpenState) {
                          onOpenState(stato);
                        }
                      }}
                      className="text-xs px-2 py-1 bg-white rounded hover:bg-opacity-80 transition"
                    >
                      Vedi tutti →
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {ticketsStato.slice(0, 10).map(ticket => {
                      const cliente = users.find(u => Number(u.id) === Number(ticket.clienteid));
                      return (
                        <div
                          key={ticket.id}
                          onClick={() => {
                            if (handlers?.handleSelectTicket) {
                              handlers.handleSelectTicket(ticket);
                            }
                            if (onOpenState) {
                              onOpenState(ticket.stato);
                            }
                          }}
                          className="p-2 bg-white rounded cursor-pointer hover:shadow-md transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="font-semibold text-sm">{ticket.numero}</div>
                                <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${(() => {
                                  const colorMap = {
                                    'aperto': 'bg-blue-100 text-blue-800',
                                    'in_lavorazione': 'bg-yellow-100 text-yellow-800',
                                    'risolto': 'bg-green-100 text-green-800',
                                    'chiuso': 'bg-purple-100 text-purple-800',
                                    'inviato': 'bg-teal-100 text-teal-800',
                                    'fatturato': 'bg-gray-100 text-gray-800'
                                  };
                                  return colorMap[ticket.stato] || 'bg-gray-100 text-gray-800';
                                })()}`}>
                                  {ticket.stato?.replace('_', ' ')}
                                </span>
                                <span className={`text-xs font-medium ${(() => {
                                  const colorMap = {
                                    'urgente': 'text-red-600',
                                    'alta': 'text-orange-600',
                                    'media': 'text-blue-600',
                                    'bassa': 'text-gray-600'
                                  };
                                  return colorMap[ticket.priorita] || 'text-gray-600';
                                })()}`}>
                                  {ticket.priorita?.toUpperCase()}
                                </span>
                                {(ticket.photos && ticket.photos.length > 0) && (
                                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 font-medium flex items-center gap-1" title={`${ticket.photos.length} file allegato${ticket.photos.length !== 1 ? 'i' : ''}`}>
                                    <Paperclip size={11} />
                                    {ticket.photos.length}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 truncate mt-0.5">{ticket.titolo}</div>
                              {ticket.descrizione && (
                                <div className="text-xs text-gray-500 truncate mt-0.5">{ticket.descrizione.substring(0, 60)}{ticket.descrizione.length > 60 ? '...' : ''}</div>
                              )}
                              {cliente && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Cliente: {cliente.nome} {cliente.cognome}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 whitespace-nowrap text-right">
                              <div>{ticket.dataapertura ? formatDate(ticket.dataapertura) : (ticket.datacreazione ? formatDate(ticket.datacreazione) : '-')}</div>
                              {ticket.categoria && (
                                <div className="text-gray-400 mt-0.5">{ticket.categoria}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {ticketsStato.length > 10 && (
                      <div className="text-xs text-center text-gray-500 pt-2">
                        ... e altri {ticketsStato.length - 10} ticket
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stat menu style */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-6">
        {statCards.map(sc => (
          <StatCard
            key={sc.key}
            title={sc.title}
            icon={sc.icon}
            value={sc.value}
            highlight={activeHighlights[sc.key]}
            disabled={sc.value === 0}
            cardKey={sc.key}
            onClick={() => sc.value > 0 && onOpenState && onOpenState(sc.key)}
          />
        ))}
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* AVVISI IMPORTANTI */}
          <div className="mb-6">
            <AlertsPanel
              alerts={alerts}
              onDelete={currentUser?.ruolo === 'tecnico' ? deleteAlert : undefined}
              isEditable={currentUser?.ruolo === 'tecnico'}
              onOpenTicket={(t) => {
                if (!t || !t.id) return;
                // Integrazione futura: handlers.handleSelectTicket
              }}
              onCreateTicketFromAlert={onCreateTicketFromAlert}
              onManageAlerts={() => setModalState({ type: 'manageAlerts', data: null })}
              onEditAlert={handleEditAlertClick}
              currentUser={currentUser}
              users={users || []}
              setModalState={setModalState}
            />
          </div>

          {/* CONTRATTI ATTIVI */}
          {contracts.length > 0 && (
            <div className="mb-6">
              <div className="bg-white rounded-xl border">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText size={18} />
                    Contratti Attivi
                  </h3>
                  <div className="text-xs text-gray-500">
                    {contracts.length} {contracts.length === 1 ? 'contratto' : 'contratti'}
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {contracts.map(contract => (
                    <ContractTimelineCard 
                      key={contract.id} 
                      contract={contract} 
                      currentUser={currentUser}
                      getAuthHeader={getAuthHeader}
                      onEdit={(contract) => setModalState({ type: 'editContract', data: contract })}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sezione Forniture Temporanee - per tutti gli utenti */}
          <div className="mb-6">
            <TemporarySuppliesPanel
              temporarySupplies={filteredTemporarySupplies || []}
              loading={temporarySuppliesLoading}
              onRemoveSupply={currentUser?.ruolo === 'tecnico' ? onRemoveTemporarySupply : null}
              users={users || []}
              onRefresh={currentUser?.ruolo === 'tecnico' ? onRefreshTemporarySupplies : null}
              onOpenTicket={(ticketId) => {
                const ticket = tickets.find(t => t.id === ticketId);
                if (ticket && handlers?.handleSelectTicket) {
                  handlers.handleSelectTicket(ticket);
                  onOpenState && onOpenState(ticket.stato);
                }
              }}
              onEditSupply={currentUser?.ruolo === 'tecnico' ? (supply) => {
                const ticket = tickets.find(t => t.id === supply.ticket_id);
                if (ticket && handlers?.handleSelectTicket) {
                  handlers.handleSelectTicket(ticket);
                  onOpenState && onOpenState(ticket.stato);
                  // Apri il modal delle forniture per questo ticket
                  setTimeout(() => {
                    setModalState({ type: 'forniture', data: ticket });
                  }, 100);
                }
              } : null}
              isReadOnly={currentUser?.ruolo !== 'tecnico'}
            />
          </div>
        </div>

        {/* COLONNA DESTRA (CALENDARIO + KEEPASS) */}
        <div>
          <TicketsCalendar
            users={users}
            tickets={tickets}
            onTicketClick={(ticket) => {
              // Naviga alla sezione corretta e seleziona il ticket
              if (handlers?.handleSelectTicket) {
                handlers.handleSelectTicket(ticket);
              }
              // Naviga alla sezione corretta basata sullo stato del ticket
              if (onOpenState) {
                onOpenState(ticket.stato);
              }
            }}
            currentUser={currentUser}
            getAuthHeader={getAuthHeader}
          />

          {/* Pulsante Credenziali KeePass + ricerca rapida - solo per amministratori */}
          {isKeepassAdmin && (
            <div className="mt-4">
              <div className="bg-white border border-indigo-200 rounded-lg overflow-hidden shadow-md">
                <button
                  onClick={() => {
                    const url = new URL(window.location);
                    url.searchParams.set('modal', 'keepass');
                    window.history.pushState({}, '', url);
                    setModalState({ type: 'keepassCredentials' });
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 transition"
                >
                  <Key size={20} />
                  <span className="font-semibold">Credenziali KeePass</span>
                </button>

                <div className="p-4 border-t border-indigo-100 bg-white space-y-3">
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition bg-gray-50">
                    <Search size={16} className="text-gray-400" />
                    <input
                      type="text"
                      value={keepassSearchQuery}
                      onChange={(e) => setKeepassSearchQuery(e.target.value)}
                      placeholder="Ricerca veloce..."
                      className="flex-1 text-sm text-gray-700 bg-transparent focus:outline-none"
                    />
                    {keepassSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setKeepassSearchQuery('')}
                        className="text-gray-400 hover:text-gray-600 transition"
                        title="Pulisci ricerca"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {keepassSearchLoadingResults && (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                    </div>
                  )}

                  {!keepassSearchLoadingResults && keepassSearchError && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {keepassSearchError}
                    </div>
                  )}

                  {!keepassSearchLoadingResults && !keepassSearchError && (
                    <>
                      {keepassSearchQuery.trim().length < 2 ? (
                        <p className="text-xs text-gray-500">
                          Inserisci almeno 2 caratteri per cercare le tue credenziali. La ricerca avviene solo tra i dati a te associati.
                        </p>
                      ) : keepassResults.length === 0 ? (
                        <p className="text-sm text-gray-500">Nessuna credenziale trovata.</p>
                      ) : (
                        <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {keepassResults.map((entry, index) => (
                            <li
                              key={entry.id || `${entry.title}-${index}`}
                              className="border border-gray-200 rounded-lg p-3 hover:border-indigo-300 hover:shadow-sm transition"
                            >
                              <div className="space-y-1">
                                {entry.groupPath && (
                                  <div className="text-xs text-gray-500 font-medium">
                                    {entry.groupPath}
                                  </div>
                                )}
                                <div className="text-sm font-semibold text-gray-800">{entry.title}</div>
                              </div>

                              {entry.username && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                                  <User size={14} className="text-gray-400" />
                                  <span className="truncate">{entry.username}</span>
                                  <button
                                    type="button"
                                    onClick={() => navigator.clipboard.writeText(entry.username)}
                                    className="ml-auto text-gray-400 hover:text-indigo-600 transition"
                                    title="Copia username"
                                  >
                                    <Copy size={14} />
                                  </button>
                                </div>
                              )}

                              {entry.url && (
                                <a
                                  href={entry.url.startsWith('http') ? entry.url : `http://${entry.url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline mt-2"
                                >
                                  <Globe size={14} className="text-blue-500" />
                                  <span className="truncate">{entry.url}</span>
                                </a>
                              )}

                              {/* Password */}
                              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200 mt-2">
                                <Lock size={14} className="text-gray-400" />
                                <span className="text-sm font-mono flex-1">
                                  {keepassVisiblePasswords[entry.id] ? (
                                    <span className="text-gray-900">{keepassVisiblePasswords[entry.id]}</span>
                                  ) : (
                                    <span className="text-gray-400">••••••••</span>
                                  )}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (keepassVisiblePasswords[entry.id]) {
                                        setKeepassVisiblePasswords(prev => {
                                          const next = { ...prev };
                                          delete next[entry.id];
                                          return next;
                                        });
                                        return;
                                      }
                                      try {
                                        const authHeader = getAuthHeader();
                                        const response = await fetch(`${apiBase}/api/keepass/decrypt-password`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            ...authHeader,
                                            'x-user-id': currentUser?.id?.toString() || authHeader['x-user-id'] || '',
                                            'x-user-role': currentUser?.ruolo || ''
                                          },
                                          body: JSON.stringify({ entryId: entry.id })
                                        });
                                        if (!response.ok) throw new Error('Errore nella decifratura della password');
                                        const data = await response.json();
                                        setKeepassVisiblePasswords(prev => ({
                                          ...prev,
                                          [entry.id]: data.password || ''
                                        }));
                                      } catch (err) {
                                        console.error('Errore decifratura password:', err);
                                        alert('Errore nel recupero della password');
                                      }
                                    }}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                    title={keepassVisiblePasswords[entry.id] ? 'Nascondi password' : 'Mostra password'}
                                  >
                                    {keepassVisiblePasswords[entry.id] ? (
                                      <EyeOff size={16} />
                                    ) : (
                                      <Eye size={16} />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      let password = keepassVisiblePasswords[entry.id];
                                      if (!password) {
                                        try {
                                          const authHeader = getAuthHeader();
                                          const response = await fetch(`${apiBase}/api/keepass/decrypt-password`, {
                                            method: 'POST',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              ...authHeader,
                                              'x-user-id': currentUser?.id?.toString() || authHeader['x-user-id'] || '',
                                              'x-user-role': currentUser?.ruolo || ''
                                            },
                                            body: JSON.stringify({ entryId: entry.id })
                                          });
                                          if (!response.ok) throw new Error('Errore nella decifratura della password');
                                          const data = await response.json();
                                          password = data.password || '';
                                          setKeepassVisiblePasswords(prev => ({
                                            ...prev,
                                            [entry.id]: password
                                          }));
                                        } catch (err) {
                                          console.error('Errore copia password:', err);
                                          alert('Errore nel recupero della password');
                                          return;
                                        }
                                      }
                                      navigator.clipboard.writeText(password);
                                      alert('Password copiata!');
                                    }}
                                    className="p-1 text-gray-400 hover:text-indigo-600"
                                    title="Copia password"
                                  >
                                    <Copy size={14} />
                                  </button>
                                </div>
                              </div>

                              {entry.notes && (
                                <p className="text-xs text-gray-500 mt-2 line-clamp-2 whitespace-pre-wrap">
                                  {entry.notes}
                                </p>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setKeepassHighlightEntryId(entry.id);
                                  const url = new URL(window.location);
                                  url.searchParams.set('modal', 'keepass');
                                  url.searchParams.set('entryId', entry.id.toString());
                                  window.history.pushState({}, '', url);
                                  setModalState({ type: 'keepassCredentials', data: { highlightEntryId: entry.id } });
                                }}
                                className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
                              >
                                Apri credenziali complete
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>


    </div>
  );
};

export default Dashboard;
