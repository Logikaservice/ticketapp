// src/components/Dashboard.jsx

import React, { useEffect } from 'react';
import { AlertTriangle, FileText, PlayCircle, CheckCircle, Archive, Send, FileCheck2, X, Info, Users, Trash2 } from 'lucide-react';
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


const AlertsPanel = ({ alerts = [], onOpenTicket, onDelete, isEditable, onManageAlerts, onEditAlert, currentUser, users = [] }) => {
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
                    {avv.clients && Array.isArray(avv.clients) && avv.clients.length > 0 
                      ? avv.clients.length === 1 
                        ? `Condiviso con 1 cliente`
                        : `Condiviso con ${avv.clients.length} clienti`
                      : 'Condiviso con tutti i clienti'
                    }
                  </span>
                </div>
                {avv.clients && Array.isArray(avv.clients) && avv.clients.length > 0 && avv.clients.length <= 3 && users && users.length > 0 && (
                  <div className="text-xs text-blue-600">
                    ({avv.clients.map(c => {
                      const user = users.find(u => u.id === c);
                      return user ? (user.azienda || `${user.nome} ${user.cognome}`) : 'Cliente';
                    }).join(', ')})
                  </div>
                )}
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

const Dashboard = ({ currentUser, tickets, users = [], selectedTicket, setSelectedTicket, setModalState, handlers, getUnreadCount, onOpenState, externalHighlights, alertsRefreshTrigger, getAuthHeader, temporarySupplies, temporarySuppliesLoading, onRemoveTemporarySupply, onRefreshTemporarySupplies }) => {
  // Stati per la ricerca
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);

  const visibleTickets = (() => {
    if (currentUser?.ruolo === 'cliente') {
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

  // Effetto per la ricerca in tempo reale
  React.useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      const results = visibleTickets.filter(ticket => 
        ticket.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.titolo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.id?.toString().includes(searchTerm) ||
        ticket.descrizione?.toLowerCase().includes(searchTerm.toLowerCase())
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
      
      // Filtra gli avvisi in base al ruolo dell'utente
      let filteredAlerts = allAlerts;
      if (currentUser?.ruolo === 'cliente') {
        filteredAlerts = allAlerts.filter(alert => {
          // Se l'avviso non ha clienti specifici, è per tutti
          if (!alert.clients || !Array.isArray(alert.clients) || alert.clients.length === 0) {
            return true;
          }
          // Se l'avviso ha clienti specifici, controlla se include questo cliente
          return alert.clients.includes(currentUser.id);
        });
      }
      
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
        headers: { 'x-user-role': 'tecnico' }
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
          {/* Campo ricerca veloce */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cerca ticket (es. TKT-2025-254)"
              className="w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            
            {/* Lista risultati ricerca */}
            {searchTerm && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {searchResults.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
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
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{ticket.numero}</div>
                        <div className="text-xs text-gray-600 truncate">{ticket.titolo}</div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {ticket.stato}
                      </div>
                    </div>
                  </div>
                ))}
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
                    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sync-google-calendar/bulk-sync-google-calendar`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeader()
                      },
                      body: JSON.stringify({})
                    });
                    
                    if (response.ok) {
                      const result = await response.json();
                      alert(`Sincronizzazione completata!\nAggiornati: ${result.updated} ticket\nErrori: ${result.errors} ticket`);
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
