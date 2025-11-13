// src/components/Dashboard.jsx

import React, { useEffect } from 'react';
import { AlertTriangle, FileText, PlayCircle, CheckCircle, Archive, Send, FileCheck2, Copy, X, Info, Users, Trash2, Sparkles, Building, Search, User, Globe, Key, Eye, EyeOff, Lock } from 'lucide-react';
import TicketListContainer from './TicketListContainer';
import TicketsCalendar from './TicketsCalendar';
import TemporarySuppliesPanel from './TemporarySuppliesPanel';
import { formatDate } from '../utils/formatters';

const StatCard = ({ title, value, icon, highlight = null, onClick, disabled, cardKey = null }) => {
  const ringClass = highlight
    ? highlight.type === 'up'
      ? 'ring-pulse-green'
      : highlight.type === 'down'
        ? 'ring-pulse-red'
        : 'ring-pulse-green'
    : '';
  
  // Mappa colori per ogni stato
  const colorMap = {
    'aperto': { border: 'border-top-blue', gradient: 'bg-gradient-blue' },
    'in_lavorazione': { border: 'border-top-yellow', gradient: 'bg-gradient-yellow' },
    'risolto': { border: 'border-top-green', gradient: 'bg-gradient-green' },
    'chiuso': { border: 'border-top-purple', gradient: 'bg-gradient-purple' },
    'inviato': { border: 'border-top-teal', gradient: 'bg-gradient-teal' },
    'fatturato': { border: 'border-top-gray', gradient: 'bg-gradient-gray' }
  };
  
  const colors = cardKey && colorMap[cardKey] ? colorMap[cardKey] : { border: '', gradient: '' };
  
  return (
    <button onClick={onClick} disabled={disabled} className={`card-hover text-center w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className={`p-5 rounded-xl border border-gray-200 bg-white relative overflow-hidden ${colors.border} ${colors.gradient} shadow-sm hover:shadow-lg ${ringClass}`}>
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
              {avv.level === 'features' ? (
                <div className="text-sm mt-1 text-justify">
                  {(() => {
                    // Usa line-clamp per limitare visivamente a 5 righe
                    const textLength = avv.body ? avv.body.length : 0;
                    const textLines = avv.body ? avv.body.split('\n').length : 0;
                    const shouldShowMore = textLength > 200 || textLines > 3;
                    
                    if (shouldShowMore) {
                      return (
                        <div className="relative">
                          <div className="line-clamp-5 whitespace-pre-wrap pr-12">{avv.body}</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (setModalState) {
                                setModalState({ type: 'alertsHistory' });
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
              
              {/* Pulsante per creare ticket dall'avviso - solo per clienti, escluso per avvisi "nuove funzionalità" */}
              {currentUser?.ruolo === 'cliente' && onCreateTicketFromAlert && avv.level !== 'features' && (
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
  
  // Stati per la ricerca per azienda (solo tecnico)
  const [selectedCompany, setSelectedCompany] = React.useState('');
  const [companyTickets, setCompanyTickets] = React.useState([]);
  
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
      
      // Non è amministratore, mostra solo i suoi ticket aperti
      return tickets.filter(t => t.clienteid === currentUser.id && t.stato === 'aperto');
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
      const response = await fetch(`${apiBase}/api/keepass/credentials`, {
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
      
      // Debug: mostra un esempio di entry per verificare il formato
      if (groups.length > 0 && groups[0].entries && groups[0].entries.length > 0) {
        const firstEntry = groups[0].entries[0];
        console.log('🔍 Esempio entry dal backend:', {
          title: firstEntry.title,
          titleType: typeof firstEntry.title,
          username: firstEntry.username,
          usernameType: typeof firstEntry.username,
          url: firstEntry.url,
          notes: firstEntry.notes
        });
      }

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
            
            // Debug per la prima entry
            if (flattenedEntries.length === 0) {
              console.log('🔍 Prima entry estratta:', {
                original: {
                  title: entry.title,
                  username: entry.username,
                  url: entry.url,
                  notes: entry.notes
                },
                extracted: {
                  title,
                  username,
                  url,
                  notes
                }
              });
            }
            
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

      console.log('📊 Entry caricate per ricerca:', flattenedEntries.length);
      if (flattenedEntries.length > 0) {
        console.log('📊 Esempio entry finale:', {
          title: flattenedEntries[0].title,
          titleType: typeof flattenedEntries[0].title,
          username: flattenedEntries[0].username,
          usernameType: typeof flattenedEntries[0].username,
          url: flattenedEntries[0].url,
          notes: flattenedEntries[0].notes,
          notesType: typeof flattenedEntries[0].notes
        });
        // Mostra tutte le entry per debug
        console.log('📊 Tutte le entry caricate:', flattenedEntries.map(e => ({
          id: e.id,
          title: e.title,
          username: e.username,
          url: e.url,
          notes: e.notes?.substring(0, 30)
        })));
      } else {
        console.warn('⚠️ Nessuna entry caricata per la ricerca!');
      }

      setKeepassEntries(flattenedEntries);
      setKeepassHasLoaded(true);
    } catch (err) {
      console.error('Errore caricamento rapida KeePass:', err);
      setKeepassSearchError(err?.message || 'Errore nel recupero delle credenziali');
    } finally {
      setKeepassSearchLoading(false);
    }
  }, [apiBase, currentUser, getAuthHeader]);

  const keepassResults = React.useMemo(() => {
    const term = keepassSearchQuery.trim().toLowerCase();
    console.log('🔍 Ricerca KeePass - Termine:', term, 'Entry disponibili:', keepassEntries.length);
    
    if (term.length < 2) return [];

    // Log delle prime 3 entry per debug
    if (keepassEntries.length > 0) {
      console.log('🔍 Prime 3 entry per ricerca:', keepassEntries.slice(0, 3).map(e => ({
        title: e.title,
        username: e.username,
        url: e.url,
        notes: e.notes?.substring(0, 50),
        groupName: e.groupName
      })));
    }

    const results = keepassEntries.filter(entry => {
      // Helper per estrarre stringa pulita (gestisce anche oggetti JSON)
      const getCleanString = (val) => {
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
          return val._ !== undefined ? String(val._ || '') : JSON.stringify(val);
        }
        return String(val || '');
      };
      
      // Estrai tutti i campi come stringhe pulite
      const title = getCleanString(entry.title).toLowerCase();
      const username = getCleanString(entry.username).toLowerCase();
      const url = getCleanString(entry.url).toLowerCase();
      const notes = getCleanString(entry.notes).toLowerCase();
      const groupName = getCleanString(entry.groupName).toLowerCase();
      
      // Debug per la prima entry
      if (keepassEntries.indexOf(entry) === 0) {
        console.log('🔍 Debug prima entry:', {
          original: {
            title: entry.title,
            username: entry.username,
            notes: entry.notes
          },
          cleaned: {
            title,
            username,
            notes: notes.substring(0, 30)
          },
          searchTerm: term
        });
      }
      
      // Verifica ogni campo
      const matchesTitle = title.includes(term);
      const matchesUsername = username.includes(term);
      const matchesUrl = url.includes(term);
      const matchesNotes = notes.includes(term);
      const matchesGroupName = groupName.includes(term);
      
      const matches = matchesTitle || matchesUsername || matchesUrl || matchesNotes || matchesGroupName;
      
      if (matches) {
        console.log('✅ Entry trovata:', {
          title: entry.title,
          username: entry.username,
          matches: { title: matchesTitle, username: matchesUsername, url: matchesUrl, notes: matchesNotes, groupName: matchesGroupName }
        });
      }
      
      return matches;
    }).slice(0, 15);
    
    console.log('🔍 Risultati ricerca:', results.length, 'entry trovate');
    return results;
  }, [keepassEntries, keepassSearchQuery]);

  React.useEffect(() => {
    if (isKeepassAdmin && !keepassHasLoaded && !keepassSearchLoading) {
      loadKeepassEntries();
    }
  }, [isKeepassAdmin, keepassHasLoaded, keepassSearchLoading, loadKeepassEntries]);

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
      
      // Filtra gli avvisi temporanei scaduti (per tutti gli utenti)
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
        
        // Mostra solo se non è ancora scaduto
        return new Date() <= expirationDate;
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
                <Building size={18} className="text-gray-500" />
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Cerca per Azienda...</option>
                  {companies.map(azienda => (
                    <option key={azienda} value={azienda}>{azienda}</option>
                  ))}
                </select>
                {selectedCompany && (
                  <button
                    onClick={() => setSelectedCompany('')}
                    className="px-2 py-2 text-gray-500 hover:text-gray-700 transition"
                    title="Rimuovi filtro"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
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
                              <div className="font-semibold text-sm">{ticket.numero}</div>
                              <div className="text-xs text-gray-600 truncate mt-0.5">{ticket.titolo}</div>
                              {cliente && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Cliente: {cliente.nome} {cliente.cognome} ({cliente.email})
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 whitespace-nowrap">
                              {ticket.datacreazione ? formatDate(ticket.datacreazione) : '-'}
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
                  onClick={() => setModalState({ type: 'keepassCredentials' })}
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

                  {keepassSearchLoading && (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
                    </div>
                  )}

                  {!keepassSearchLoading && keepassSearchError && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {keepassSearchError}
                    </div>
                  )}

                  {!keepassSearchLoading && !keepassSearchError && (
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
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-semibold text-gray-800">{entry.title}</div>
                                {entry.groupName && (
                                  <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                    {entry.groupName}
                                  </span>
                                )}
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
