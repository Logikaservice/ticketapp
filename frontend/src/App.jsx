// src/App.jsx

import React, { useState, useEffect } from 'react';
import Notification from './components/AppNotification';
import LoginScreen from './components/LoginScreen';
import Header from './components/Header';
import TicketListContainer from './components/TicketListContainer';
import Dashboard from './components/Dashboard';
import AllModals from './components/Modals/AllModals';
import ManageClientsModal from './components/Modals/ManageClientsModal';
import NewClientModal from './components/Modals/NewClientModal';
import NewTicketModal from './components/Modals/NewTicketModal';
import FornitureModal from './components/Modals/FornitureModal';
import UnreadMessagesModal from './components/UnreadMessagesModal';
import TicketPhotosModal from './components/Modals/TicketPhotosModal';
import { useAuth } from './hooks/useAuth';
import { useClients } from './hooks/useClients';
import { useTickets } from './hooks/useTickets';
import { useTimeLogs } from './hooks/useTimeLogs';
import { useReports } from './hooks/useReports';
import { useModals } from './hooks/useModals';
import { useTemporarySuppliesFromTickets } from './hooks/useTemporarySuppliesFromTickets';
import { useGoogleCalendar } from './hooks/useGoogleCalendar';
import GoogleCallback from './components/GoogleCallback';

export default function TicketApp() {
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  
  // Controlla se abbiamo un codice OAuth nell'URL (solo una volta)
  const [oauthCode, setOauthCode] = useState(null);
  const [isGoogleCallback, setIsGoogleCallback] = useState(false);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      setOauthCode(code);
      setIsGoogleCallback(true);
      console.log('OAuth code found:', code);
    }
  }, []);
  
  const [notifications, setNotifications] = useState([]);

  const [modalState, setModalState] = useState({ type: null, data: null });
  const [newTicketData, setNewTicketData] = useState({ 
    titolo: '', 
    descrizione: '', 
    categoria: 'assistenza', 
    priorita: 'media', 
    nomerichiedente: ''
  });
  const [settingsData, setSettingsData] = useState({ 
    nome: '', 
    cognome: '',
    email: '', 
    telefono: '',
    azienda: '',
    passwordAttuale: '',
    nuovaPassword: '' 
  });
  const [newClientData, setNewClientData] = useState({ 
    nome: '',
    cognome: '',
    email: '', 
    password: '', 
    telefono: '', 
    azienda: '' 
  });
  const [isEditingTicket, setIsEditingTicket] = useState(null);
  const [selectedClientForNewTicket, setSelectedClientForNewTicket] = useState('');
  const [showUnreadModal, setShowUnreadModal] = useState(false);
  const [fornitureModalTicket, setFornitureModalTicket] = useState(null);
  const [photosModalTicket, setPhotosModalTicket] = useState(null);
  const [previousUnreadCounts, setPreviousUnreadCounts] = useState({});
  const [showDashboard, setShowDashboard] = useState(true);
  const [dashboardTargetState, setDashboardTargetState] = useState('aperto');
  const [dashboardHighlights, setDashboardHighlights] = useState({});
  const [prevTicketStates, setPrevTicketStates] = useState({});
  const [alertsRefreshTrigger, setAlertsRefreshTrigger] = useState(0);
  const [pendingTicketAction, setPendingTicketAction] = useState(null);

  // Helpers per localStorage (nuovi ticket non ancora aperti dall'utente)
  const getSetFromStorage = (key) => {
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
  };
  const saveSetToStorage = (key, set) => {
    try { localStorage.setItem(key, JSON.stringify(Array.from(set))); } catch {}
  };
  const debugNewTickets = () => localStorage.getItem('debugNewTickets') === '1';
  const dbg = (...args) => { if (debugNewTickets()) { console.log('[NEW-TICKETS]', ...args); } };

  // ====================================================================
  // NOTIFICHE
  // ====================================================================
  const showNotification = (message, type = 'success', duration = 5000, ticketId = null) => {
    const id = Date.now() + Math.random();
    const newNotif = { id, show: true, message, type, ticketId };
    setNotifications(prev => [...prev, newNotif]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  };

  const handleCloseNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // ====================================================================
  // HOOKS PERSONALIZZATI
  // ====================================================================
  const {
    isLoggedIn,
    currentUser,
    setCurrentUser,
    loginData,
    setLoginData,
    handleLogin,
    handleLogout,
    getAuthHeader
  } = useAuth(showNotification);

  // Hook per Google Calendar
  const { syncTicketToCalendarBackend } = useGoogleCalendar(getAuthHeader);

  // Hook per forniture temporanee dai ticket
  const {
    temporarySupplies,
    loading: temporarySuppliesLoading,
    removeTemporarySupply,
    refreshTemporarySupplies
  } = useTemporarySuppliesFromTickets(getAuthHeader);

  // Funzione per ricaricare le forniture temporanee manualmente
  const refreshTemporarySuppliesManual = () => {
    if (refreshTemporarySupplies) {
      refreshTemporarySupplies();
    }
  };

  const {
    handleCreateClient,
    handleUpdateClient,
    handleDeleteClient
  } = useClients(showNotification, setUsers, setTickets, getAuthHeader);

  const closeModal = () => {
    if (modalState.type === 'newTicket') {
      resetNewTicketData();
    }
    setModalState({ type: null, data: null });
  };

  const {
    handleCreateTicket: createTicket,
    handleUpdateTicket: updateTicket,
    handleDeleteTicket,
    handleSelectTicket,
    handleSendMessage,
    handleChangeStatus: changeStatus,
    handleConfirmTimeLogs
  } = useTickets(
    showNotification,
    setTickets,
    selectedTicket,
    setSelectedTicket,
    currentUser,
    tickets,
    closeModal,
    syncTicketToCalendarBackend, // Passiamo la funzione di sincronizzazione Google Calendar
    getAuthHeader // Passiamo la funzione per l'autenticazione
  );

  const {
    timeLogs,
    setTimeLogs,
    initializeTimeLogs,
    initializeTimeLogsForView,
    handleTimeLogChange,
    handleAddTimeLog,
    handleDuplicateTimeLog,
    handleRemoveTimeLog,
    handleMaterialChange,
    handleAddMaterial,
    handleRemoveMaterial,
    handleOffertaChange,
    handleAddOfferta,
    handleRemoveOfferta,
    handleSaveTimeLogs
  } = useTimeLogs(selectedTicket, setTickets, setSelectedTicket, showNotification, getAuthHeader, syncTicketToCalendarBackend);

  const {
    handleGenerateSentReport,
    handleGenerateInvoiceReport
  } = useReports(tickets, users, setModalState, showNotification);

  const {
    handleOpenTimeLogger,
    handleOpenEditModal,
    handleOpenForniture,
    handleViewTimeLog
  } = useModals(
    setSelectedTicket,
    setModalState,
    initializeTimeLogs,
    initializeTimeLogsForView,
    setNewTicketData,
    setIsEditingTicket,
    setSelectedClientForNewTicket,
    setFornitureModalTicket
  );

  // ====================================================================
  // PERSISTENZA STATO TICKET CHIUSI AL RELOAD
  // ====================================================================
  useEffect(() => {
    if (isLoggedIn) {
      setSelectedTicket(null);
      setShowDashboard(true); // all'accesso parte dalla dashboard
      localStorage.setItem('openTicketId', 'null');
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (selectedTicket?.id) {
      localStorage.setItem('openTicketId', selectedTicket.id);
    } else {
      localStorage.setItem('openTicketId', 'null');
    }
  }, [selectedTicket]);

  // ====================================================================
  // CALCOLA MESSAGGI NON LETTI
  // ====================================================================
  const getUnreadCount = (ticket) => {
    if (!currentUser || !ticket.messaggi || ticket.messaggi.length === 0) return 0;
    
    const lastRead = currentUser.ruolo === 'cliente' 
      ? ticket.last_read_by_client 
      : ticket.last_read_by_tecnico;
    
    if (!lastRead) {
      if (currentUser.ruolo === 'cliente') {
        return ticket.messaggi.filter(m => m.autore === 'Tecnico').length;
      } else {
        return ticket.messaggi.filter(m => m.autore !== 'Tecnico').length;
      }
    }
    
    const lastReadDate = new Date(lastRead);
    
    if (currentUser.ruolo === 'cliente') {
      return ticket.messaggi.filter(m => 
        new Date(m.data) > lastReadDate && m.autore === 'Tecnico'
      ).length;
    } else {
      return ticket.messaggi.filter(m => 
        new Date(m.data) > lastReadDate && m.autore !== 'Tecnico'
      ).length;
    }
  };

  // ====================================================================
  // CARICA DATI DAL DATABASE
  // ====================================================================
  useEffect(() => {
    const fetchData = async () => {
      if (!process.env.REACT_APP_API_URL || !currentUser) return;
      try {
        const ticketsResponse = await fetch(process.env.REACT_APP_API_URL + '/api/tickets', {
          headers: getAuthHeader()
        });
        if (!ticketsResponse.ok) throw new Error("Errore nel caricare i ticket");
        const ticketsData = await ticketsResponse.json();
        
        // Carica il conteggio forniture per ogni ticket
        const ticketsWithForniture = await Promise.all(
          ticketsData.map(async (ticket) => {
            try {
              const fornitureResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${ticket.id}/forniture`, {
                headers: getAuthHeader()
              });
              if (fornitureResponse.ok) {
                const forniture = await fornitureResponse.json();
                return { ...ticket, fornitureCount: forniture.length };
              }
            } catch (err) {
              console.error(`Errore nel caricare forniture per ticket ${ticket.id}:`, err);
            }
            return { ...ticket, fornitureCount: 0 };
          })
        );
        
        // Evidenzia nuovi ticket (persistente finché non aperto) - baseline al primo login
        let withNewFlag = ticketsWithForniture;
        const unseenKey = currentUser ? `unseenNewTicketIds_${currentUser.id}` : null;
        const unseen = unseenKey ? getSetFromStorage(unseenKey) : new Set();
        
        // Funzione helper per verificare se un ticket è visibile all'utente (uguale a quella del polling)
        const getAppliesToUserInitial = (ticket) => {
          if (currentUser.ruolo === 'tecnico') {
            return true; // I tecnici vedono tutti i ticket
          }
          
          if (currentUser.ruolo === 'cliente') {
            // Se è il proprio ticket, sempre visibile (confronta come numeri)
            const ticketClienteId = Number(ticket.clienteid);
            const currentUserId = Number(currentUser.id);
            if (ticketClienteId === currentUserId) {
              return true;
            }
            
            // Se è amministratore, controlla se il ticket appartiene a un cliente della sua azienda
            const isAdmin = currentUser.admin_companies && 
                           Array.isArray(currentUser.admin_companies) && 
                           currentUser.admin_companies.length > 0;
            
            if (isAdmin) {
              // Usa l'azienda del cliente direttamente dal ticket (se disponibile) o cerca in users
              let ticketAzienda = null;
              
              // Prima prova a usare l'azienda dal ticket (se è stata aggiunta dal backend)
              if (ticket.cliente_azienda) {
                ticketAzienda = ticket.cliente_azienda;
              } else if (users && users.length > 0) {
                // Altrimenti cerca in users
                const ticketClient = users.find(u => Number(u.id) === ticketClienteId);
                if (ticketClient && ticketClient.azienda) {
                  ticketAzienda = ticketClient.azienda;
                }
              }
              
              if (ticketAzienda) {
                // Verifica se l'azienda del ticket è tra quelle di cui è amministratore
                return currentUser.admin_companies.includes(ticketAzienda);
              }
            }
            
            return false;
          }
          
          return false;
        };
        
        // Crea un Set per tracciare quali ticket erano già stati notificati (per evitare doppie notifiche)
        const alreadyNotifiedKey = currentUser ? `notifiedTicketIds_${currentUser.id}` : null;
        const alreadyNotified = alreadyNotifiedKey ? getSetFromStorage(alreadyNotifiedKey) : new Set();
        const newlyNotifiedInitial = [];
        
        if (currentUser.ruolo === 'cliente' || currentUser.ruolo === 'tecnico') {
          // Al primo caricamento, rileva nuovi ticket (aperti) che non erano già in unseen
          ticketsWithForniture.forEach(t => {
            const appliesToUser = getAppliesToUserInitial(t);
            if (appliesToUser && t.stato === 'aperto' && !unseen.has(t.id)) {
              // Aggiungi a unseen
              unseen.add(t.id);
              
              // Mostra notifica solo se non è già stata mostrata prima
              if (!alreadyNotified.has(t.id)) {
                alreadyNotified.add(t.id);
                newlyNotifiedInitial.push(t);
              }
            }
          });
          
          // Salva unseen e alreadyNotified
          if (unseenKey) saveSetToStorage(unseenKey, unseen);
          if (alreadyNotifiedKey) saveSetToStorage(alreadyNotifiedKey, alreadyNotified);
          
          // Applica flag isNew ai ticket
          withNewFlag = ticketsWithForniture.map(t => {
            const appliesToUser = getAppliesToUserInitial(t);
            return { ...t, isNew: appliesToUser && t.stato === 'aperto' && unseen.has(t.id) };
          });
          
          // Mostra notifiche per i nuovi ticket rilevati al primo caricamento
          newlyNotifiedInitial.forEach(t => {
            showNotification(`Nuovo ticket ${t.numero}: ${t.titolo}`, 'warning', 8000, t.id);
          });
        }
        setTickets(withNewFlag);
        // Inizializza mappa stati per highlights reali
        const initMap = {};
        ticketsWithForniture.forEach(t => { if (t && t.id) initMap[t.id] = t.stato; });
        setPrevTicketStates(initMap);

        // Carica users per tecnici e per clienti amministratori (devono vedere i clienti della loro azienda)
        const isAdmin = currentUser.ruolo === 'cliente' && 
                       currentUser.admin_companies && 
                       Array.isArray(currentUser.admin_companies) && 
                       currentUser.admin_companies.length > 0;
        
        if (currentUser.ruolo === 'tecnico' || isAdmin) {
          const usersResponse = await fetch(process.env.REACT_APP_API_URL + '/api/users', {
            headers: getAuthHeader()
          });
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            setUsers(usersData);
            
            // Ri-applica la logica per i nuovi ticket dopo aver caricato users (per amministratori)
            if (isAdmin && (currentUser.ruolo === 'cliente' || currentUser.ruolo === 'tecnico')) {
              const unseenKey2 = currentUser ? `unseenNewTicketIds_${currentUser.id}` : null;
              const unseen2 = unseenKey2 ? getSetFromStorage(unseenKey2) : new Set();
              const alreadyNotifiedKey2 = currentUser ? `notifiedTicketIds_${currentUser.id}` : null;
              const alreadyNotified2 = alreadyNotifiedKey2 ? getSetFromStorage(alreadyNotifiedKey2) : new Set();
              const newlyNotifiedAfterUsers = [];
              
              ticketsWithForniture.forEach(t => {
                const appliesToUser = getAppliesToUserInitial(t);
                if (appliesToUser && t.stato === 'aperto' && !unseen2.has(t.id)) {
                  unseen2.add(t.id);
                  if (!alreadyNotified2.has(t.id)) {
                    alreadyNotified2.add(t.id);
                    newlyNotifiedAfterUsers.push(t);
                  }
                }
              });
              
              if (unseenKey2) saveSetToStorage(unseenKey2, unseen2);
              if (alreadyNotifiedKey2) saveSetToStorage(alreadyNotifiedKey2, alreadyNotified2);
              
              // Aggiorna tickets con flag isNew corretto
              const updatedTickets = ticketsWithForniture.map(t => {
                const appliesToUser = getAppliesToUserInitial(t);
                return { ...t, isNew: appliesToUser && t.stato === 'aperto' && unseen2.has(t.id) };
              });
              setTickets(updatedTickets);
              
              // Mostra notifiche per i nuovi ticket rilevati dopo il caricamento di users
              newlyNotifiedAfterUsers.forEach(t => {
                showNotification(`Nuovo ticket ${t.numero}: ${t.titolo}`, 'warning', 8000, t.id);
              });
            }
          }
        }
        
        // Mostra modale se ci sono messaggi non letti
        const unreadTickets = ticketsWithForniture.filter(t => getUnreadCount(t) > 0);
        if (unreadTickets.length > 0 && !showUnreadModal) {
          setShowUnreadModal(true);
        }
      } catch (error) {
        showNotification(error.message, "error");
      }
    };
    if (isLoggedIn) fetchData();
  }, [isLoggedIn, currentUser]);


  // Riceve eventi per glow/frecce della dashboard (senza cambiare vista)
  useEffect(() => {
    const handler = (e) => {
      const { state, type } = e.detail || {};
      if (!state || !type) return;
      // Ripristina highlight (glow) per 10s, senza simboli freccia
      setDashboardHighlights((prev) => ({ ...prev, [state]: { type } }));
      setTimeout(() => {
        setDashboardHighlights((prev) => ({ ...prev, [state]: null }));
      }, 10000);
      // Aggiorna solo il target per la dashboard, senza navigare
      setDashboardTargetState(state);
    };
    window.addEventListener('dashboard-highlight', handler);
    return () => window.removeEventListener('dashboard-highlight', handler);
  }, []);

  useEffect(() => {
    const focusHandler = (e) => {
      const { state } = e.detail || {};
      if (!state) return;
      // Aggiorna solo il target per la dashboard, senza navigare
      setDashboardTargetState(state);
    };
    window.addEventListener('dashboard-focus', focusHandler);
    return () => window.removeEventListener('dashboard-focus', focusHandler);
  }, []);

  // ====================================================================
  // MONITORAGGIO NUOVI MESSAGGI
  // ====================================================================
  useEffect(() => {
    if (!isLoggedIn) return;

    // Salva i conteggi iniziali
    const initialCounts = {};
    tickets.forEach(t => {
      initialCounts[t.id] = getUnreadCount(t);
    });
    setPreviousUnreadCounts(initialCounts);

    // Polling ogni 10 secondi
    const doPoll = async () => {
      try {
        const response = await fetch(process.env.REACT_APP_API_URL + '/api/tickets', {
          headers: getAuthHeader()
        });
        if (!response.ok) return;
        
        const updatedTickets = await response.json();
        
        // Carica forniture
        const ticketsWithForniture = await Promise.all(
          updatedTickets.map(async (ticket) => {
            try {
              const fornitureResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${ticket.id}/forniture`, {
                headers: getAuthHeader()
              });
              if (fornitureResponse.ok) {
                const forniture = await fornitureResponse.json();
                return { ...ticket, fornitureCount: forniture.length };
              }
            } catch (err) {
              console.error(`Errore forniture ticket ${ticket.id}:`, err);
            }
            return { ...ticket, fornitureCount: 0 };
          })
        );
        
        // Evidenzia nuovi ticket rispetto al polling precedente (cliente e tecnico) - persiste finché non aperto
        let polled = ticketsWithForniture;
        const unseenKeyP = currentUser ? `unseenNewTicketIds_${currentUser.id}` : null;
        const unseenP = unseenKeyP ? getSetFromStorage(unseenKeyP) : new Set();
        
        // Funzione helper per verificare se un ticket è visibile all'utente
        const getAppliesToUser = (ticket) => {
          if (currentUser.ruolo === 'tecnico') {
            return true; // I tecnici vedono tutti i ticket
          }
          
          if (currentUser.ruolo === 'cliente') {
            // Se è il proprio ticket, sempre visibile (confronta come numeri)
            const ticketClienteId = Number(ticket.clienteid);
            const currentUserId = Number(currentUser.id);
            if (ticketClienteId === currentUserId) {
              return true;
            }
            
            // Se è amministratore, controlla se il ticket appartiene a un cliente della sua azienda
            const isAdmin = currentUser.admin_companies && 
                           Array.isArray(currentUser.admin_companies) && 
                           currentUser.admin_companies.length > 0;
            
            if (isAdmin) {
              // Usa l'azienda del cliente direttamente dal ticket (se disponibile) o cerca in users
              let ticketAzienda = null;
              
              // Prima prova a usare l'azienda dal ticket (se è stata aggiunta dal backend)
              if (ticket.cliente_azienda) {
                ticketAzienda = ticket.cliente_azienda;
              } else if (users && users.length > 0) {
                // Altrimenti cerca in users
                const ticketClient = users.find(u => Number(u.id) === ticketClienteId);
                if (ticketClient && ticketClient.azienda) {
                  ticketAzienda = ticketClient.azienda;
                }
              }
              
              if (ticketAzienda) {
                // Verifica se l'azienda del ticket è tra quelle di cui è amministratore
                return currentUser.admin_companies.includes(ticketAzienda);
              }
            }
            
            return false;
          }
          
          return false;
        };
        
        if (currentUser.ruolo === 'cliente' || currentUser.ruolo === 'tecnico') {
          // Aggiungi nuovi ID non presenti nello stato precedente
          const prevIds = new Set(tickets.map(t => t.id));
          const newlyDetected = [];
          
          // Crea un Set per tracciare quali ticket erano già stati notificati (per evitare doppie notifiche)
          const alreadyNotifiedKey = currentUser ? `notifiedTicketIds_${currentUser.id}` : null;
          const alreadyNotified = alreadyNotifiedKey ? getSetFromStorage(alreadyNotifiedKey) : new Set();
          const newlyNotified = [];
          
          ticketsWithForniture.forEach(t => {
            const appliesToUser = getAppliesToUser(t);
            if (appliesToUser && t.stato === 'aperto' && !prevIds.has(t.id)) {
              unseenP.add(t.id);
              newlyDetected.push(t.id);
              
              // Mostra notifica solo se non è già stata mostrata prima
              if (!alreadyNotified.has(t.id)) {
                alreadyNotified.add(t.id);
                newlyNotified.push(t);
              }
            }
          });
          
          if (newlyDetected.length > 0) dbg('Rilevati nuovi ticket per', currentUser.ruolo, 'IDs:', newlyDetected);
          if (unseenKeyP) saveSetToStorage(unseenKeyP, unseenP);
          if (alreadyNotifiedKey) saveSetToStorage(alreadyNotifiedKey, alreadyNotified);
          
          polled = ticketsWithForniture.map(t => {
            const appliesToUser = getAppliesToUser(t);
            return { ...t, isNew: appliesToUser && t.stato === 'aperto' && unseenP.has(t.id) };
          });
          if (debugNewTickets()) {
            const flagged = polled.filter(t => t.isNew).map(t => t.id);
            if (flagged.length > 0) dbg('Flag giallo per IDs:', flagged);
          }
          
          // Toast a scomparsa per ciascun nuovo ticket rilevato per la prima volta (cliccabile per aprire)
          newlyNotified.forEach(t => {
            dbg('Mostro toast per nuovo ticket', t.id);
            // Toast giallo (warning) per nuovo ticket, cliccabile
            showNotification(`Nuovo ticket ${t.numero}: ${t.titolo}`, 'warning', 8000, t.id);
          });
        }
        setTickets(polled);
        // Highlights reali: confronta stati precedenti vs attuali
        const nextMap = {};
        ticketsWithForniture.forEach(t => { if (t && t.id) nextMap[t.id] = t.stato; });
        try {
          Object.keys(nextMap).forEach(id => {
            const prevState = prevTicketStates[id];
            const curState = nextMap[id];
            if (!prevState && curState) {
              const evtUp = new CustomEvent('dashboard-highlight', { detail: { state: curState, type: 'up', direction: 'forward' } });
              window.dispatchEvent(evtUp);
            } else if (prevState && prevState !== curState) {
              // Avanzamento/regresso: emetti direzione per posizionare le frecce correttamente
              const forwardOrder = ['aperto','in_lavorazione','risolto','chiuso','inviato','fatturato'];
              const backwardOrder = ['fatturato','inviato','chiuso','risolto','in_lavorazione','aperto'];
              const isForward = forwardOrder.indexOf(prevState) > -1 && forwardOrder.indexOf(curState) === forwardOrder.indexOf(prevState) + 1;
              const isBackward = backwardOrder.indexOf(prevState) > -1 && backwardOrder.indexOf(curState) === backwardOrder.indexOf(prevState) + 1;
              const direction = isBackward ? 'backward' : 'forward';
              window.dispatchEvent(new CustomEvent('dashboard-highlight', { detail: { state: prevState, type: 'down', direction } }));
              window.dispatchEvent(new CustomEvent('dashboard-highlight', { detail: { state: curState, type: 'up', direction } }));
            }
          });
        } catch (_) {}
        setPrevTicketStates(nextMap);
        
        // Controlla se ci sono nuovi messaggi
        // Per i clienti: controlla solo i ticket che appartengono a loro
        let ticketsToCheck = ticketsWithForniture;
        if (currentUser?.ruolo === 'cliente') {
          ticketsToCheck = ticketsWithForniture.filter(t => t.clienteid === currentUser.id);
        }
        
        let hasNewMessages = false;
        ticketsToCheck.forEach(ticket => {
          const previousCount = previousUnreadCounts[ticket.id] || 0;
          const currentCount = getUnreadCount(ticket);
          
          if (currentCount > previousCount) {
            hasNewMessages = true;
          }
        });
        
        // Mostra modale se ci sono nuovi messaggi
        if (hasNewMessages && !showUnreadModal) {
          setShowUnreadModal(true);
        }
        
        // Aggiorna conteggi solo per i ticket rilevanti
        const newCounts = {};
        ticketsToCheck.forEach(t => {
          newCounts[t.id] = getUnreadCount(t);
        });
        setPreviousUnreadCounts(newCounts);
        
      } catch (error) {
        console.error('Errore polling:', error);
      }
    };
    const interval = setInterval(doPoll, 1000);
    const localNewHandler = () => { doPoll(); };
    window.addEventListener('new-ticket-local', localNewHandler);
    return () => { clearInterval(interval); window.removeEventListener('new-ticket-local', localNewHandler); };
  }, [isLoggedIn, tickets, showUnreadModal, currentUser, previousUnreadCounts, users]);

  // Listener per apertura ticket da toast
  useEffect(() => {
    const openFromToast = (e) => {
      const ticketId = e.detail;
      try { console.log('[TOAST-DEBUG] openFromToast received id', ticketId); } catch {}
      const t = tickets.find(x => x.id === ticketId);
      if (t) {
        try { console.log('[TOAST-DEBUG] found ticket in state', t); } catch {}
        // Passa alla vista lista (Aperti) e poi seleziona il ticket
        setDashboardTargetState('aperto');
        setShowDashboard(false);
        setShowUnreadModal(false);
        // Selezione dopo il render della lista
        setTimeout(() => {
          try { handleSelectTicket(t); } catch {}
        }, 50);
      }
    };
    window.addEventListener('toast-open-ticket', openFromToast);
    return () => window.removeEventListener('toast-open-ticket', openFromToast);
  }, [tickets]);

  // ====================================================================
  // MODALI
  // ====================================================================
  const resetNewTicketData = () => {
    const nomeRichiedente = currentUser?.ruolo === 'cliente' ? `${currentUser.nome} ${currentUser.cognome || ''}`.trim() : '';
    setNewTicketData({
      titolo: '',
      descrizione: '',
      categoria: 'assistenza',
      priorita: 'media',
      nomerichiedente: nomeRichiedente,
      dataapertura: '' // Inizializza dataapertura vuota per nuovi ticket
    });
    setIsEditingTicket(null);
    setSelectedClientForNewTicket('');
  };

  // ====================================================================
  // APERTURA MODALI
  // ====================================================================
  const openNewTicketModal = () => { resetNewTicketData(); setModalState({ type: 'newTicket' }); };
  
  // Funzione per creare un ticket da un avviso
  const handleCreateTicketFromAlert = (alert) => {
    const nomeRichiedente = currentUser?.ruolo === 'cliente' ? `${currentUser.nome} ${currentUser.cognome || ''}`.trim() : '';
    setNewTicketData({
      titolo: `Ticket da avviso: ${alert.title}`,
      descrizione: `Avviso: ${alert.title}\n\n${alert.body}`,
      categoria: 'assistenza',
      priorita: 'media',
      nomerichiedente: nomeRichiedente,
      dataapertura: ''
    });
    setIsEditingTicket(null);
    setSelectedClientForNewTicket('');
    setModalState({ type: 'newTicket' });
  };
  const openSettings = () => {
    setSettingsData({ 
      nome: currentUser.nome || '', 
      cognome: currentUser.cognome || '',
      email: currentUser.email || '', 
      telefono: currentUser.telefono || '',
      azienda: currentUser.azienda || '',
      passwordAttuale: currentUser.password || '',
      nuovaPassword: '' 
    });
    setModalState({ type: 'settings' });
  };
  const openManageClientsModal = () => setModalState({ type: 'manageClients' });
  const openNewClientModal = () => setModalState({ type: 'newClient' });

  // Funzioni per gestione avvisi
  const handleSaveAlert = async (alertData) => {
    try {
      const apiBase = process.env.REACT_APP_API_URL || 'https://ticketapp-4eqb.onrender.com';
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
          'x-user-id': currentUser?.id,
          ...getAuthHeader()
        },
        body: formData
      });
      if (!res.ok) throw new Error('Errore creazione avviso');
      showNotification('Avviso creato con successo!', 'success');
      setAlertsRefreshTrigger(prev => prev + 1); // Trigger refresh avvisi
    } catch (e) {
      console.error('Errore salvataggio avviso:', e);
      showNotification('Errore nel salvare l\'avviso', 'error');
    }
  };

  const handleEditAlert = async (alertData) => {
    try {
      console.log('🔍 DEBUG ALERTS: Tentativo di modifica avviso');
      console.log('🔍 DEBUG ALERTS: Alert ID:', alertData.id);
      console.log('🔍 DEBUG ALERTS: Alert title:', alertData.title);
      
      const authHeaders = getAuthHeader();
      console.log('🔍 DEBUG ALERTS: Auth headers:', authHeaders);
      
      const apiBase = process.env.REACT_APP_API_URL || 'https://ticketapp-4eqb.onrender.com';
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
          'x-user-id': currentUser?.id,
          ...authHeaders
        },
        body: formData
      });
      
      console.log('🔍 DEBUG ALERTS: Response status:', res.status);
      console.log('🔍 DEBUG ALERTS: Response ok:', res.ok);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('🔍 DEBUG ALERTS: Errore response:', res.status, errorText);
        throw new Error('Errore modifica avviso');
      }
      showNotification('Avviso modificato con successo!', 'success');
      setAlertsRefreshTrigger(prev => prev + 1); // Trigger refresh avvisi
    } catch (e) {
      console.error('Errore modifica avviso:', e);
      showNotification('Errore nel modificare l\'avviso', 'error');
    }
  };

  const handleFornitureCountChange = (ticketId, newCount) => {
    setTickets(prev => prev.map(t => 
      t.id === ticketId ? { ...t, fornitureCount: newCount } : t
    ));
  };

  // ====================================================================
  // WRAPPER FUNZIONI
  // ====================================================================
  const handleUpdateSettings = async () => {
    try {
      console.log('🔄 Aggiornamento impostazioni tecnico...');
      console.log('Dati impostazioni:', settingsData);
      
      // Validazione password (solo se fornita)
      if (settingsData.nuovaPassword && settingsData.nuovaPassword.trim() !== '' && settingsData.nuovaPassword.length < 6) {
        showNotification('La nuova password deve essere di almeno 6 caratteri', 'error');
        return;
      }
      
      // Prepara i dati da inviare
      const updateData = {
        nome: settingsData.nome,
        cognome: settingsData.cognome || '',
        email: settingsData.email,
        telefono: settingsData.telefono || null,
        azienda: settingsData.azienda || null
      };
      
      // Aggiungi password solo se fornita
      if (settingsData.nuovaPassword && settingsData.nuovaPassword.trim() !== '') {
        updateData.password = settingsData.nuovaPassword;
      }
      
      console.log('Dati da inviare:', updateData);
      
      // Chiamata API per aggiornare le impostazioni
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${currentUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Errore API: ${response.statusText}`);
      }
      
      const updatedUser = await response.json();
      console.log('✅ Utente aggiornato:', updatedUser);
      
      // Aggiorna lo stato dell'utente corrente
      setCurrentUser(prev => ({
        ...prev,
        ...updatedUser
      }));
      
      // Resetta i dati delle impostazioni
      setSettingsData({
        nome: updatedUser.nome || '',
        cognome: updatedUser.cognome || '',
        email: updatedUser.email || '',
        telefono: updatedUser.telefono || '',
        azienda: updatedUser.azienda || '',
        passwordAttuale: updatedUser.password || '',
        nuovaPassword: ''
      });
      
      showNotification('Impostazioni aggiornate con successo!', 'success');
      closeModal();
      
    } catch (error) {
      console.error('❌ Errore aggiornamento impostazioni:', error);
      showNotification(error.message || 'Errore durante l\'aggiornamento delle impostazioni', 'error');
    }
  };
  const handleConfirmUrgentCreation = async () => {
    // Conferma creazione URGENTE: per i tecnici mostra modal email, per clienti crea direttamente
    
    // Per i tecnici, mostra il modal di conferma email anche per priorità urgente
    if (currentUser.ruolo === 'tecnico') {
      console.log('🔍 DEBUG: Priorità urgente confermata - mostrando modal email per tecnico');
      
      const clientName = users.find(u => u.id === parseInt(selectedClientForNewTicket))?.azienda || 'Cliente';
        
      setPendingTicketAction({
        type: 'create',
        data: newTicketData,
        isEditing: isEditingTicket,
        selectedClient: selectedClientForNewTicket
      });
      setModalState({ 
        type: 'emailConfirm', 
        data: { 
          isEditing: isEditingTicket, 
          clientName: clientName 
        } 
      });
      return;
    }
    
    // Per i clienti, crea direttamente il ticket con invio email obbligatorio
    await createTicket(newTicketData, isEditingTicket, wrappedHandleUpdateTicket, selectedClientForNewTicket, true, []);
    resetNewTicketData();
    setModalState({ type: null, data: null });
  };

  const handleConfirmEmptyDescription = async () => {
    // L'utente ha confermato di voler procedere senza descrizione
    // Controlla se è anche URGENTE
    if (!isEditingTicket && newTicketData.priorita === 'urgente') {
      setModalState({ type: 'urgentConfirm' });
      return;
    }
    
    // Per i tecnici, mostra il modal di conferma email anche dopo descrizione vuota
    if (currentUser.ruolo === 'tecnico') {
      console.log('🔍 DEBUG: Descrizione vuota confermata - mostrando modal email per tecnico');
      
      const clientName = users.find(u => u.id === parseInt(selectedClientForNewTicket))?.azienda || 'Cliente';
        
      setPendingTicketAction({
        type: 'create',
        data: newTicketData,
        isEditing: isEditingTicket,
        selectedClient: selectedClientForNewTicket
      });
      setModalState({ 
        type: 'emailConfirm', 
        data: { 
          isEditing: isEditingTicket, 
          clientName: clientName 
        } 
      });
      return;
    }
    
    // Per i clienti, crea direttamente il ticket con invio email obbligatorio
    await createTicket(newTicketData, isEditingTicket, wrappedHandleUpdateTicket, selectedClientForNewTicket, true, []);
    resetNewTicketData();
    setModalState({ type: null, data: null });
  };

  // Funzione per caricare foto a un ticket
  const handleUploadTicketPhotos = async (ticketId, photos) => {
    try {
      console.log('🔄 handleUploadTicketPhotos chiamata:', ticketId, photos.length, 'foto');
      
      const formData = new FormData();
      photos.forEach(photo => {
        formData.append('photos', photo);
      });

      // Per FormData, NON includere Content-Type nell'header - il browser lo imposta automaticamente con il boundary
      const authHeader = getAuthHeader();
      const headers = {};
      if (authHeader.Authorization) {
        headers['Authorization'] = authHeader.Authorization;
      }

      console.log('🔄 Chiamata API:', `${process.env.REACT_APP_API_URL}/api/tickets/${ticketId}/photos`);
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${ticketId}/photos`, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      console.log('📡 Risposta API:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore durante il caricamento delle foto');
      }

      const result = await response.json();
      
      // Aggiorna il ticket nella lista
      setTickets(prev => prev.map(t => 
        t.id === ticketId 
          ? { ...t, photos: result.photos } 
          : t
      ));

      // Aggiorna anche selectedTicket se è quello corretto
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, photos: result.photos });
      }

      showNotification(result.message || 'Foto caricate con successo', 'success');
      return result.photos;
    } catch (error) {
      console.error('Errore upload foto:', error);
      showNotification(error.message || 'Errore durante il caricamento delle foto', 'error');
      throw error;
    }
  };

  // Funzione per eliminare foto di un ticket
  const handleDeleteTicketPhoto = async (ticketId, photoFilename) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${ticketId}/photos/${photoFilename}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore durante l\'eliminazione della foto');
      }

      const result = await response.json();
      
      // Aggiorna il ticket nella lista
      setTickets(prev => prev.map(t => 
        t.id === ticketId 
          ? { ...t, photos: result.photos } 
          : t
      ));

      // Aggiorna anche selectedTicket se è quello corretto
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, photos: result.photos });
      }

      showNotification(result.message || 'Foto eliminata con successo', 'success');
      return result.photos;
    } catch (error) {
      console.error('Errore eliminazione foto:', error);
      showNotification(error.message || 'Errore durante l\'eliminazione della foto', 'error');
      throw error;
    }
  };

  const wrappedHandleCreateTicket = () => {
    console.log('🔍 DEBUG: wrappedHandleCreateTicket chiamata');
    console.log('🔍 DEBUG: currentUser.ruolo =', currentUser.ruolo);
    console.log('🔍 DEBUG: isEditingTicket =', isEditingTicket);
    
    // Se descrizione vuota, chiedi conferma
    if (!newTicketData.descrizione || newTicketData.descrizione.trim() === '') {
      console.log('🔍 DEBUG: Descrizione vuota, mostrando modal conferma');
      setModalState({ type: 'emptyDescriptionConfirm' });
      return;
    }
    // Se priorità URGENTE e stiamo creando (non edit), mostra conferma
    if (!isEditingTicket && newTicketData.priorita === 'urgente') {
      console.log('🔍 DEBUG: Priorità urgente, mostrando modal conferma');
      setModalState({ type: 'urgentConfirm' });
      return;
    }
    
    // Chiedi conferma per l'invio email SOLO per i tecnici
    if (currentUser.ruolo === 'tecnico') {
      console.log('🔍 DEBUG: Tecnico - mostrando modal di conferma email');
      console.log('🔍 DEBUG: selectedClientForNewTicket =', selectedClientForNewTicket);
      
      const clientName = users.find(u => u.id === parseInt(selectedClientForNewTicket))?.azienda || 'Cliente';
      console.log('🔍 DEBUG: clientName =', clientName);
        
      setPendingTicketAction({
        type: 'create',
        data: newTicketData,
        isEditing: isEditingTicket,
        selectedClient: selectedClientForNewTicket
      });
      setModalState({ 
        type: 'emailConfirm', 
        data: { 
          isEditing: isEditingTicket, 
          clientName: clientName 
        } 
      });
      console.log('🔍 DEBUG: Modal state impostato a emailConfirm');
      console.log('🔍 DEBUG: modalState dopo setModalState =', { type: 'emailConfirm', data: { isEditing: isEditingTicket, clientName: clientName } });
      return;
    }
    
    // Per i clienti, crea direttamente il ticket con invio email obbligatorio
    console.log('🔍 DEBUG: Cliente - creazione ticket con email obbligatoria');
    createTicket(newTicketData, isEditingTicket, wrappedHandleUpdateTicket, selectedClientForNewTicket, true, []);
  };

  const wrappedHandleUpdateTicket = () => {
    // Per le modifiche dei dettagli del ticket (non cambi di stato), 
    // aggiorna direttamente senza modal di conferma email
    console.log('🔍 DEBUG: Modifica dettagli ticket - currentUser.ruolo =', currentUser.ruolo);
    console.log('🔍 DEBUG: Aggiornamento diretto senza modal email');
    updateTicket(newTicketData, isEditingTicket, selectedClientForNewTicket, false);
  };

  // Funzione per determinare la card corrente
  const getCurrentCardState = () => {
    // Se non siamo nella dashboard, usa dashboardTargetState
    if (!showDashboard && dashboardTargetState) {
      return dashboardTargetState;
    }
    
    // Se siamo nella dashboard, determina la card basata sui ticket selezionati
    // Per ora, ritorna 'aperto' come default
    return 'aperto';
  };

  // Funzione per determinare la card di origine del ticket
  const getTicketOriginCard = (ticketId) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      return ticket.stato;
    }
    return 'aperto'; // Default
  };

  // Gestione conferma email
  const handleConfirmEmail = async () => {
    if (!pendingTicketAction) return;
    
    const { type, data, isEditing, selectedClient } = pendingTicketAction;
    
    if (type === 'create') {
      // Crea ticket con invio email
      const photos = pendingTicketAction?.photos || [];
      await createTicket(data, isEditing, wrappedHandleUpdateTicket, selectedClient, true, photos);
    } else if (type === 'update') {
      // Aggiorna ticket con invio email
      await updateTicket(data, isEditing, selectedClient, true);
    } else if (type === 'changeStatus') {
      // Cambia stato ticket con invio email
      await changeStatus(data.id, data.status, handleOpenTimeLogger, true);
      
      // Mostra l'effetto di evidenziazione per le card coinvolte
      const originCardState = getTicketOriginCard(data.id);
      const destinationCardState = data.status;
      
      // Evidenzia la card di destinazione (verde - riceve ticket)
      window.dispatchEvent(new CustomEvent('dashboard-highlight', { 
        detail: { state: destinationCardState, type: 'up', direction: 'forward' } 
      }));
      
      // Evidenzia la card di origine (rosso - perde ticket)
      window.dispatchEvent(new CustomEvent('dashboard-highlight', { 
        detail: { state: originCardState, type: 'down', direction: 'forward' } 
      }));
      
      // Mantieni la vista corrente senza rimbalzi
      setDashboardTargetState(originCardState);

      // Feedback locale rimosso (niente eventi aggiuntivi)
    } else if (type === 'confirmTimeLogs') {
      // Conferma timeLogs con invio email
      await handleConfirmTimeLogs(data.timeLogs, true);
      
      // Mostra l'effetto di evidenziazione per le card coinvolte
      if (selectedTicket) {
        const originCardState = getTicketOriginCard(selectedTicket.id);
        const destinationCardState = 'risolto'; // TimeLogs porta sempre a risolto
        
        // Evidenzia la card di destinazione (verde - riceve ticket)
        window.dispatchEvent(new CustomEvent('dashboard-highlight', { 
          detail: { state: destinationCardState, type: 'up', direction: 'forward' } 
        }));
        
        // Evidenzia la card di origine (rosso - perde ticket)
        window.dispatchEvent(new CustomEvent('dashboard-highlight', { 
          detail: { state: originCardState, type: 'down', direction: 'forward' } 
        }));
        
        // Mantieni la vista corrente senza rimbalzi
        setDashboardTargetState(originCardState);

        // Feedback locale rimosso (niente eventi aggiuntivi)
      }
    }
    
    setPendingTicketAction(null);
    setModalState({ type: null, data: null });
  };

  const handleCancelEmail = async () => {
    if (!pendingTicketAction) return;
    
    const { type, data, isEditing, selectedClient } = pendingTicketAction;
    
    if (type === 'create') {
      // Crea ticket senza invio email
      await createTicket(data, isEditing, wrappedHandleUpdateTicket, selectedClient, false);
    } else if (type === 'update') {
      // Aggiorna ticket senza invio email
      await updateTicket(data, isEditing, selectedClient, false);
    } else if (type === 'changeStatus') {
      // Cambia stato ticket senza invio email
      await changeStatus(data.id, data.status, handleOpenTimeLogger, false);
      
      // Mostra l'effetto di evidenziazione per le card coinvolte
      const originCardState = getTicketOriginCard(data.id);
      const destinationCardState = data.status;
      
      // Evidenzia la card di destinazione (verde - riceve ticket)
      window.dispatchEvent(new CustomEvent('dashboard-highlight', { 
        detail: { state: destinationCardState, type: 'up', direction: 'forward' } 
      }));
      
      // Evidenzia la card di origine (rosso - perde ticket)
      window.dispatchEvent(new CustomEvent('dashboard-highlight', { 
        detail: { state: originCardState, type: 'down', direction: 'forward' } 
      }));
      
      // Mantieni la vista corrente senza rimbalzi
      setDashboardTargetState(originCardState);

      // Feedback locale rimosso (niente eventi aggiuntivi)
    } else if (type === 'confirmTimeLogs') {
      // Conferma timeLogs senza invio email
      await handleConfirmTimeLogs(data.timeLogs, false);
      
      // Mostra l'effetto di evidenziazione per le card coinvolte
      if (selectedTicket) {
        const originCardState = getTicketOriginCard(selectedTicket.id);
        const destinationCardState = 'risolto'; // TimeLogs porta sempre a risolto
        
        // Evidenzia la card di destinazione (verde - riceve ticket)
        window.dispatchEvent(new CustomEvent('dashboard-highlight', { 
          detail: { state: destinationCardState, type: 'up', direction: 'forward' } 
        }));
        
        // Evidenzia la card di origine (rosso - perde ticket)
        window.dispatchEvent(new CustomEvent('dashboard-highlight', { 
          detail: { state: originCardState, type: 'down', direction: 'forward' } 
        }));
        
        // Mantieni la vista corrente senza rimbalzi
        setDashboardTargetState(originCardState);

        // Feedback locale rimosso (niente eventi aggiuntivi)
      }
    }
    
    setPendingTicketAction(null);
    setModalState({ type: null, data: null });
  };

  // Gestione richiesta assistenza veloce
  const handleQuickRequest = async (formData, photos = []) => {
    try {
      const apiBase = process.env.REACT_APP_API_URL || 'https://ticketapp-4eqb.onrender.com';
      
      // Crea FormData per supportare sia i dati che le foto
      const formDataToSend = new FormData();
      formDataToSend.append('titolo', formData.titolo);
      formDataToSend.append('descrizione', formData.descrizione);
      formDataToSend.append('priorita', formData.priorita);
      formDataToSend.append('nomerichiedente', `${formData.nome} ${formData.cognome}`);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('telefono', formData.telefono || '');
      formDataToSend.append('azienda', formData.azienda || '');
      
      // Aggiungi le foto se presenti
      photos.forEach(photo => {
        formDataToSend.append('photos', photo);
      });

      const response = await fetch(`${apiBase}/api/tickets/quick-request`, {
        method: 'POST',
        body: formDataToSend
      });

      if (!response.ok) {
        throw new Error('Errore nell\'invio della richiesta');
      }

      showNotification('Richiesta inviata con successo! Ti contatteremo presto.', 'success');
    } catch (error) {
      console.error('Errore richiesta veloce:', error);
      showNotification('Errore nell\'invio della richiesta. Riprova più tardi.', 'error');
    }
  };

  const wrappedHandleCreateClient = () => {
    handleCreateClient(newClientData, () => {
      setNewClientData({ nome: '', cognome: '', email: '', password: '', telefono: '', azienda: '' });
      closeModal();
    });
  };

  const handleChangeStatus = (id, status) => {
    console.log('🔍 DEBUG: handleChangeStatus chiamata - id:', id, 'status:', status, 'ruolo:', currentUser.ruolo);
    
    // Se è un tecnico e il status è "risolto", apri prima il TimeLoggerModal
    if (currentUser.ruolo === 'tecnico' && status === 'risolto') {
      console.log('🔍 DEBUG: Status risolto - aprendo TimeLoggerModal prima del modal email');
      handleOpenTimeLogger(tickets.find(t => t.id === id));
      return;
    }
    
    // Se è un tecnico, chiedi conferma per l'invio email
    if (currentUser.ruolo === 'tecnico') {
      console.log('🔍 DEBUG: Cambio stato ticket - currentUser.ruolo =', currentUser.ruolo);
      console.log('🔍 DEBUG: Mostrando modal di conferma email per cambio stato');
      
      const ticket = tickets.find(t => t.id === id);
      const clientName = ticket ? users.find(u => u.id === ticket.clienteid)?.azienda || 'Cliente' : 'Cliente';
      
      console.log('🔍 DEBUG: Ticket trovato:', ticket?.id, 'Cliente:', clientName);
      
      setPendingTicketAction({
        type: 'changeStatus',
        data: { id, status },
        isEditing: false,
        selectedClient: null
      });
      setModalState({ 
        type: 'emailConfirm', 
        data: { 
          isEditing: false, 
          clientName: clientName,
          statusChange: true,
          newStatus: status
        } 
      });
      return;
    }
    
    console.log('🔍 DEBUG: Utente non è tecnico, procedendo senza modal');
    changeStatus(id, status, handleOpenTimeLogger);
    
    // Mostra l'effetto di evidenziazione per le card coinvolte
    const originCardState = getTicketOriginCard(id);
    const destinationCardState = status;
    
    // Evidenzia la card di destinazione (verde - riceve ticket)
    window.dispatchEvent(new CustomEvent('dashboard-highlight', { 
      detail: { state: destinationCardState, type: 'up', direction: 'forward' } 
    }));
    
    // Evidenzia la card di origine (rosso - perde ticket)
    window.dispatchEvent(new CustomEvent('dashboard-highlight', { 
      detail: { state: originCardState, type: 'down', direction: 'forward' } 
    }));
    
    // Mantieni la vista corrente senza rimbalzi: niente switch temporaneo alla dashboard
    // Aggiorniamo solo il target per eventuali evidenziazioni
    setDashboardTargetState(originCardState);

    // Nessun feedback locale aggiuntivo
  };

  const handleReopenInLavorazione = (id) => handleChangeStatus(id, 'in_lavorazione');
  const handleReopenAsRisolto = (id) => handleChangeStatus(id, 'risolto');
  const handleSetInviato = (id) => handleChangeStatus(id, 'inviato');
  const handleArchiveTicket = (id) => handleChangeStatus(id, 'chiuso');
  const handleInvoiceTicket = (id) => handleChangeStatus(id, 'fatturato');

  const wrappedHandleConfirmTimeLogs = () => {
    // Se è un tecnico, mostra il modal di conferma email prima di procedere
    if (currentUser.ruolo === 'tecnico') {
      console.log('🔍 DEBUG: TimeLogs completati - mostrando modal di conferma email');
      
      const ticket = selectedTicket;
      const clientName = ticket ? users.find(u => u.id === ticket.clienteid)?.azienda || 'Cliente' : 'Cliente';
      
      setPendingTicketAction({
        type: 'confirmTimeLogs',
        data: { timeLogs },
        isEditing: false,
        selectedClient: null
      });
      setModalState({ 
        type: 'emailConfirm', 
        data: { 
          isEditing: false, 
          clientName: clientName,
          statusChange: true,
          newStatus: 'risolto'
        } 
      });
      return;
    }
    
    // Se non è tecnico, procedi direttamente
    handleConfirmTimeLogs(timeLogs);
    
    // Mostra l'effetto di evidenziazione per le card coinvolte
    if (selectedTicket) {
      const originCardState = getTicketOriginCard(selectedTicket.id);
      const destinationCardState = 'risolto'; // TimeLogs porta sempre a risolto
      
      // Evidenzia la card di destinazione (verde - riceve ticket)
      window.dispatchEvent(new CustomEvent('dashboard-highlight', { 
        detail: { state: destinationCardState, type: 'up', direction: 'forward' } 
      }));
      
      // Evidenzia la card di origine (rosso - perde ticket)
      window.dispatchEvent(new CustomEvent('dashboard-highlight', { 
        detail: { state: originCardState, type: 'down', direction: 'forward' } 
      }));
      
      // Mantieni la vista corrente senza rimbalzi
      setDashboardTargetState(originCardState);

      // Feedback locale sul ticket aggiornato
      try {
        const updated = tickets.find(t => t.id === selectedTicket.id);
        const updatedId = updated ? updated.id : selectedTicket.id;
        window.dispatchEvent(new CustomEvent('ticket-status-updated', { detail: { id: updatedId } }));
      } catch {}
    }
  };

  const handleOpenTicketFromModal = (ticket) => {
    handleSelectTicket(ticket);
    setShowUnreadModal(false);
  };
  
  // ====================================================================
  // RENDER
  // ====================================================================
  // Se siamo nella pagina di callback Google, mostra il componente di callback
  if (isGoogleCallback) {
    return <GoogleCallback />;
  }

  if (!isLoggedIn) {
    return (
      <>
        <div className="fixed bottom-5 right-5 z-[100] flex flex-col-reverse gap-2">
          {notifications.map((notif) => (
            <Notification key={notif.id} notification={notif} handleClose={() => handleCloseNotification(notif.id)} />
          ))}
        </div>
        <LoginScreen {...{ loginData, setLoginData, handleLogin, onQuickRequest: handleQuickRequest, existingClients: users.filter(u => u.ruolo === 'cliente') }} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col-reverse gap-2">
        {notifications.map((notif) => (
          <Notification key={notif.id} notification={notif} handleClose={() => handleCloseNotification(notif.id)} />
        ))}
      </div>
      <Header
        {...{ currentUser, handleLogout, openNewTicketModal, openNewClientModal, openSettings, openManageClientsModal }}
      />

      {!showDashboard && (
        <div
          className="w-full bg-gray-100 text-gray-700 shadow-sm text-center text-sm py-2 cursor-pointer hover:bg-gray-200"
          onClick={() => setShowDashboard(true)}
        >
          Torna alla Dashboard
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {showDashboard ? (
          <div className="animate-slideInRight">
          <Dashboard
            currentUser={currentUser}
            tickets={tickets}
            users={users}
            selectedTicket={selectedTicket}
            setSelectedTicket={setSelectedTicket}
            setModalState={setModalState}
            onCreateTicketFromAlert={handleCreateTicketFromAlert}
            handlers={{
              handleSelectTicket,
              handleOpenEditModal,
              handleOpenTimeLogger,
              handleViewTimeLog,
              handleOpenForniture,
              handleReopenInLavorazione,
              handleChangeStatus,
              handleReopenAsRisolto,
              handleSetInviato,
              handleArchiveTicket,
              handleInvoiceTicket,
              handleDeleteTicket,
              showNotification,
              handleSendMessage,
              handleGenerateSentReport,
              handleGenerateInvoiceReport,
              handleUploadTicketPhotos,
              handleDeleteTicketPhoto,
              setPhotosModalTicket
            }}
            getUnreadCount={getUnreadCount}
            externalHighlights={dashboardHighlights}
            alertsRefreshTrigger={alertsRefreshTrigger}
            getAuthHeader={getAuthHeader}
            temporarySupplies={temporarySupplies}
            temporarySuppliesLoading={temporarySuppliesLoading}
            onRemoveTemporarySupply={removeTemporarySupply}
            onRefreshTemporarySupplies={refreshTemporarySuppliesManual}
            onOpenState={(state) => {
              setDashboardTargetState(state || 'aperto');
              setShowDashboard(false);
            }}
          />
          </div>
        ) : (
          <div className="animate-slideInRight">
          <TicketListContainer
            {...{ currentUser, tickets, users, selectedTicket, getUnreadCount }}
            setSelectedTicket={setSelectedTicket}
            handlers={{
              handleSelectTicket,
              handleOpenEditModal,
              handleOpenTimeLogger,
              handleViewTimeLog,
              handleOpenForniture,
              handleReopenInLavorazione,
              handleChangeStatus,
              handleReopenAsRisolto,
              handleSetInviato,
              handleArchiveTicket,
              handleInvoiceTicket,
              handleDeleteTicket,
              showNotification,
              handleSendMessage,
              handleGenerateSentReport,
              handleGenerateInvoiceReport,
              handleUploadTicketPhotos,
              handleDeleteTicketPhoto,
              setPhotosModalTicket
            }}
            showFilters={true}
            externalViewState={dashboardTargetState}
          />
          </div>
        )}
      </main>

      <AllModals
        modalState={modalState}
        closeModal={closeModal}
        handleUpdateSettings={handleUpdateSettings}
        handleConfirmUrgentCreation={handleConfirmUrgentCreation}
        handleConfirmEmptyDescription={handleConfirmEmptyDescription}
        settingsData={settingsData}
        setSettingsData={setSettingsData}
        timeLogs={timeLogs}
        setTimeLogs={setTimeLogs}
        handleTimeLogChange={handleTimeLogChange}
        handleAddTimeLog={handleAddTimeLog}
        handleRemoveTimeLog={handleRemoveTimeLog}
        handleDuplicateTimeLog={handleDuplicateTimeLog}
        handleMaterialChange={handleMaterialChange}
        handleAddMaterial={handleAddMaterial}
        handleRemoveMaterial={handleRemoveMaterial}
        handleOffertaChange={handleOffertaChange}
        handleAddOfferta={handleAddOfferta}
        handleRemoveOfferta={handleRemoveOfferta}
        handleConfirmTimeLogs={wrappedHandleConfirmTimeLogs}
        handleSaveTimeLogs={handleSaveTimeLogs}
        currentUser={currentUser}
        showNotification={showNotification}
        users={users}
        onSaveAlert={handleSaveAlert}
        onEditAlert={handleEditAlert}
        onConfirmEmail={handleConfirmEmail}
        onCancelEmail={handleCancelEmail}
      />

      {modalState.type === 'manageClients' && (
        <ManageClientsModal
          clienti={users.filter(u => u.ruolo === 'cliente')}
          onClose={closeModal}
          onUpdateClient={handleUpdateClient}
          onDeleteClient={handleDeleteClient}
        />
      )}
      
      {modalState.type === 'newClient' && (
        <NewClientModal
          newClientData={newClientData}
          setNewClientData={setNewClientData}
          onClose={closeModal}
          onSave={wrappedHandleCreateClient}
        />
      )}
      
      {modalState.type === 'newTicket' && (
        <NewTicketModal
          onClose={closeModal}
          onSave={isEditingTicket ? wrappedHandleUpdateTicket : wrappedHandleCreateTicket}
          newTicketData={newTicketData}
          setNewTicketData={setNewTicketData}
          isEditingTicket={isEditingTicket}
          currentUser={currentUser}
          clientiAttivi={users.filter(u => u.ruolo === 'cliente')}
          selectedClientForNewTicket={selectedClientForNewTicket}
          setSelectedClientForNewTicket={setSelectedClientForNewTicket}
        />
      )}

      {fornitureModalTicket && (
        <FornitureModal
          ticket={fornitureModalTicket}
          onClose={() => setFornitureModalTicket(null)}
          onFornitureCountChange={handleFornitureCountChange}
          currentUser={currentUser}
          getAuthHeader={getAuthHeader}
        />
      )}

      {showUnreadModal && (
        <UnreadMessagesModal
          tickets={tickets}
          getUnreadCount={getUnreadCount}
          onClose={() => setShowUnreadModal(false)}
          onOpenTicket={handleOpenTicketFromModal}
          currentUser={currentUser}
        />
      )}

      {photosModalTicket && (
        <TicketPhotosModal
          ticket={photosModalTicket}
          photos={photosModalTicket.photos || []}
          onClose={() => {
            // Aggiorna il ticket dal database prima di chiudere
            const updatedTicket = tickets.find(t => t.id === photosModalTicket.id);
            if (updatedTicket) {
              setPhotosModalTicket(null);
            } else {
              setPhotosModalTicket(null);
            }
          }}
          onUploadPhotos={handleUploadTicketPhotos}
          onDeletePhoto={async (photoFilename) => {
            const updatedPhotos = await handleDeleteTicketPhoto(photosModalTicket.id, photoFilename);
            // Aggiorna il ticket nel modal
            const updatedTicket = tickets.find(t => t.id === photosModalTicket.id);
            if (updatedTicket) {
              setPhotosModalTicket({ ...updatedTicket, photos: updatedPhotos });
            }
            return updatedPhotos;
          }}
          getAuthHeader={getAuthHeader}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
