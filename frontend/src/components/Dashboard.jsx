// src/components/Dashboard.jsx

import React, { useEffect } from 'react';
import { AlertTriangle, FileText, PlayCircle, CheckCircle, Archive, Send, FileCheck2, X, Info, Users, Trash2, Sparkles } from 'lucide-react';
import TicketListContainer from './TicketListContainer';
import TicketsCalendar from './TicketsCalendar';
import TemporarySuppliesPanel from './TemporarySuppliesPanel';
import { formatDate } from '../utils/formatters';

const StatCard = ({ title, value, icon, highlight = null, onClick, disabled, badge = null }) => {
  const ringClass = highlight
    ? highlight.type === 'up'
      ? 'ring-pulse-green'
      : highlight.type === 'down'
        ? 'ring-pulse-red'
        : 'ring-pulse-green'
    : '';
  return (
    <button onClick={onClick} disabled={disabled} className={`text-center w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className={`p-4 rounded-xl border bg-white relative ${ringClass}`}>
        {badge && (
          <span className="absolute -top-2 -right-2 text-[10px] font-bold bg-green-600 text-white px-2 py-[2px] rounded-full shadow-sm animate-new-float">
            {badge}
          </span>
        )}
        <div className="text-sm text-gray-500 mb-1 flex items-center justify-center gap-2">{icon}<span>{title}</span></div>
        <div className="text-5xl font-extrabold gradient-text animate-pulse-strong leading-none">{value}</div>
        {/* Frecce rimosse su richiesta */}
        {highlight && highlight.type === 'up' && (
          <div className={`absolute left-4 right-4 -bottom-1 h-2 rounded-full bg-green-400 blur-md opacity-80`}></div>
        )}
        {highlight && highlight.type === 'down' && (
          <div className={`absolute left-4 right-4 -bottom-1 h-2 rounded-full bg-red-400 blur-md opacity-80`}></div>
        )}
        {/* badge NEW ora gestito via prop 'badge' */}
      </div>
    </button>
  );
};


const AlertsPanel = ({ alerts = [], onOpenTicket, onCreateTicketFromAlert, onDelete, isEditable, onManageAlerts, onEditAlert, currentUser, users = [] }) => {
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
              <div className="text-sm mt-1">{avv.body}</div>
              
              {/* Informazioni destinatari */}
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
              
              {/* Visualizza allegati se presenti */}
              {avv.attachments && avv.attachments.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-2">Allegati:</div>
                  <div className="flex flex-wrap gap-2">
                    {avv.attachments.map((attachment, index) => (
                      <div key={index} className="relative">
                        <img
                          src={`${process.env.REACT_APP_API_URL}${attachment.path}`}
                          alt={attachment.originalName}
                          className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80 transition"
                          onClick={() => window.open(`${process.env.REACT_APP_API_URL}${attachment.path}`, '_blank')}
                          title={attachment.originalName}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Pulsante per creare ticket dall'avviso - solo per clienti */}
              {currentUser?.ruolo === 'cliente' && onCreateTicketFromAlert && (
                <div className="mt-3">
                  <button
                    onClick={() => onCreateTicketFromAlert(avv)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FileText size={14} />
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

const Dashboard = ({ currentUser, tickets, users = [], selectedTicket, setSelectedTicket, setModalState, onCreateTicketFromAlert, handlers, getUnreadCount, onOpenState, externalHighlights, alertsRefreshTrigger, getAuthHeader, temporarySupplies, temporarySuppliesLoading, onRemoveTemporarySupply, onRefreshTemporarySupplies }) => {
  // Stati per la ricerca
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);

  const visibleTickets = (() => {
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
      
      // Non è amministratore, mostra solo i suoi ticket
      return tickets.filter(t => t.clienteid === currentUser.id);
    }
    return tickets;
  })();

  const counts = (() => ({
    aperto: visibleTickets.filter(t => t.stato === 'aperto').length,
    in_lavorazione: visibleTickets.filter(t => t.stato === 'in_lavorazione').length,
    risolto: visibleTickets.filter(t => t.stato === 'risolto').length,
    chiuso: visibleTickets.filter(t => t.stato === 'chiuso').length,
    inviato: visibleTickets.filter(t => t.stato === 'inviato').length,
    fatturato: visibleTickets.filter(t => t.stato === 'fatturato').length
  }))();
  // Evidenzia spostamenti basati su segnali esterni (eventi dal polling/azioni)
  const [activeHighlights, setActiveHighlights] = React.useState({});
  useEffect(() => {
    if (!externalHighlights) return;
    setActiveHighlights(externalHighlights);
  }, [externalHighlights]);

  // Badge NEW elegante su 'Aperti' quando arriva evento 'dashboard-new'
  const [showNewBadge, setShowNewBadge] = React.useState(false);
  useEffect(() => {
    const handler = (e) => {
      const { state } = e.detail || {};
      if (state === 'aperto') {
        setShowNewBadge(true);
        setTimeout(() => setShowNewBadge(false), 4000);
      }
    };
    window.addEventListener('dashboard-new', handler);
    return () => window.removeEventListener('dashboard-new', handler);
  }, []);

  const roleLabel = currentUser?.ruolo === 'tecnico' ? 'Tecnico' : 'Cliente';

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
  const apiBase = process.env.REACT_APP_API_URL;
  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${apiBase}/api/alerts`, {
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
      
      setAlerts(filteredAlerts);
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
      const res = await fetch(`${apiBase}/api/alerts`, {
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
      const res = await fetch(`${apiBase}/api/alerts/${id}`, {
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

      const res = await fetch(`${apiBase}/api/alerts`, {
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
    { key: 'aperto', title: 'Aperti', value: counts.aperto, icon: <FileText size={14} /> },
    { key: 'in_lavorazione', title: 'In lavorazione', value: counts.in_lavorazione, icon: <PlayCircle size={14} /> },
    { key: 'risolto', title: 'Risolti', value: counts.risolto, icon: <CheckCircle size={14} /> },
    { key: 'chiuso', title: 'Chiusi', value: counts.chiuso, icon: <Archive size={14} /> },
    { key: 'inviato', title: 'Inviati', value: counts.inviato, icon: <Send size={14} /> },
    { key: 'fatturato', title: 'Fatturati', value: counts.fatturato, icon: <FileCheck2 size={14} /> }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Dashboard Riepilogo ({roleLabel})</h2>
        <div className="flex items-center gap-4">
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
                          <div className="font-medium text-sm text-gray-900">{ticket.numero}</div>
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
            badge={showNewBadge && sc.key === 'aperto' ? 'NEW' : null}
            onClick={() => sc.value > 0 && onOpenState && onOpenState(sc.key)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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
          />

          {/* Sezione Forniture Temporanee - per tutti gli utenti */}
          <TemporarySuppliesPanel
            temporarySupplies={temporarySupplies || []}
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
        <div>
          {/* Pulsante temporaneo per sincronizzazione massa Google Calendar */}
          {currentUser?.ruolo === 'tecnico' && (
            <div className="mb-4">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/bulk-sync-google-calendar`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader()
                      },
                      body: JSON.stringify({})
                    });
                    
                    if (response.ok) {
                      const result = await response.json();
                      // Stampa dettagli errori in console per debug
                      if (result?.errorDetails && Array.isArray(result.errorDetails)) {
                        console.group('Dettagli errori sincronizzazione Google Calendar');
                        result.errorDetails.forEach(e => console.error(`Ticket #${e?.numero || e?.ticketId}: ${e?.error}`));
                        console.groupEnd();
                      }

                      const errorLines = (result?.errorDetails || [])
                        .map(e => `- ${e?.numero || e?.ticketId}: ${e?.error}`)
                        .join('\n');

                      const details = result?.errors > 0 && errorLines
                        ? `\n\nDettagli errori:\n${errorLines}`
                        : '';

                      alert(`Sincronizzazione completata!\nAggiornati: ${result.updated} ticket\nErrori: ${result.errors} ticket${details}`);
                    } else {
                      alert('Errore durante la sincronizzazione');
                    }
                  } catch (err) {
                    alert('Errore: ' + err.message);
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                🔄 Sincronizza Calendario Google
              </button>
            </div>
          )}
          
          <TicketsCalendar 
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
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
