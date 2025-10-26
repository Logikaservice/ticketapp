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
import { useAuth } from './hooks/useAuth';
import { useClients } from './hooks/useClients';
import { useTickets } from './hooks/useTickets';
import { useTimeLogs } from './hooks/useTimeLogs';
import { useReports } from './hooks/useReports';
import { useModals } from './hooks/useModals';
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
    email: '', 
    telefono: '',
    azienda: '',
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
    handleSaveTimeLogs
  } = useTimeLogs(selectedTicket, setTickets, setSelectedTicket, showNotification, getAuthHeader);

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
        const bootKey = currentUser ? `newTicketsBootstrapped_${currentUser.id}` : null;
        const unseen = unseenKey ? getSetFromStorage(unseenKey) : new Set();
        if (currentUser.ruolo === 'cliente' || currentUser.ruolo === 'tecnico') {
          // Al primo caricamento non aggiungiamo nuovi, solo mostriamo quelli già in unseen
          if (bootKey && !localStorage.getItem(bootKey)) {
            localStorage.setItem(bootKey, '1');
          } else {
            // Dopo il bootstrap, aggiungeremo tramite polling
          }
          withNewFlag = ticketsWithForniture.map(t => {
            const appliesToUser = currentUser.ruolo === 'tecnico' || t.clienteid === currentUser.id;
            return { ...t, isNew: appliesToUser && t.stato === 'aperto' && unseen.has(t.id) };
          });
        }
        setTickets(withNewFlag);
        // Inizializza mappa stati per highlights reali
        const initMap = {};
        ticketsWithForniture.forEach(t => { if (t && t.id) initMap[t.id] = t.stato; });
        setPrevTicketStates(initMap);

        if (currentUser.ruolo === 'tecnico') {
          const usersResponse = await fetch(process.env.REACT_APP_API_URL + '/api/users', {
            headers: getAuthHeader()
          });
          if (usersResponse.ok) setUsers(await usersResponse.json());
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


  // Riceve eventi per glow/frecce della dashboard
  useEffect(() => {
    const handler = (e) => {
      const { state, type } = e.detail || {};
      if (!state || !type) return;
      // Ripristina highlight (glow) per 10s, senza simboli freccia
      setDashboardHighlights((prev) => ({ ...prev, [state]: { type } }));
      setTimeout(() => {
        setDashboardHighlights((prev) => ({ ...prev, [state]: null }));
      }, 10000);
      // Vai in dashboard e focalizza lo stato relativo
      setShowDashboard(true);
      setDashboardTargetState(state);
    };
    window.addEventListener('dashboard-highlight', handler);
    return () => window.removeEventListener('dashboard-highlight', handler);
  }, []);

  useEffect(() => {
    const focusHandler = (e) => {
      const { state } = e.detail || {};
      if (!state) return;
      setShowDashboard(true);
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
        if (currentUser.ruolo === 'cliente' || currentUser.ruolo === 'tecnico') {
          // Aggiungi nuovi ID non presenti nello stato precedente
          const prevIds = new Set(tickets.map(t => t.id));
          const newlyDetected = [];
          ticketsWithForniture.forEach(t => {
            const appliesToUser = currentUser.ruolo === 'tecnico' || t.clienteid === currentUser.id;
            if (appliesToUser && t.stato === 'aperto' && !prevIds.has(t.id)) {
              unseenP.add(t.id);
              newlyDetected.push(t.id);
            }
          });
          if (newlyDetected.length > 0) dbg('Rilevati nuovi ticket per', currentUser.ruolo, 'IDs:', newlyDetected);
          if (unseenKeyP) saveSetToStorage(unseenKeyP, unseenP);
          polled = ticketsWithForniture.map(t => {
            const appliesToUser = currentUser.ruolo === 'tecnico' || t.clienteid === currentUser.id;
            return { ...t, isNew: appliesToUser && t.stato === 'aperto' && unseenP.has(t.id) };
          });
          if (debugNewTickets()) {
            const flagged = polled.filter(t => t.isNew).map(t => t.id);
            if (flagged.length > 0) dbg('Flag giallo per IDs:', flagged);
          }
        }
        setTickets(polled);
        // Toast a scomparsa per ciascun nuovo ticket (cliccabile per aprire)
        if (currentUser.ruolo === 'cliente' || currentUser.ruolo === 'tecnico') {
          polled.filter(t => t.isNew).forEach(t => {
            dbg('Mostro toast per ticket', t.id);
            // Toast giallo (warning) per nuovo ticket, cliccabile
            showNotification(`Nuovo ticket ${t.numero}: ${t.titolo}`, 'warning', 8000, t.id);
          });
        }
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
        let hasNewMessages = false;
        ticketsWithForniture.forEach(ticket => {
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
        
        // Aggiorna conteggi
        const newCounts = {};
        ticketsWithForniture.forEach(t => {
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
  }, [isLoggedIn, tickets, showUnreadModal, currentUser, previousUnreadCounts]);

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
      nomerichiedente: nomeRichiedente
    });
    setIsEditingTicket(null);
    setSelectedClientForNewTicket('');
  };

  // ====================================================================
  // APERTURA MODALI
  // ====================================================================
  const openNewTicketModal = () => { resetNewTicketData(); setModalState({ type: 'newTicket' }); };
  const openSettings = () => {
    setSettingsData({ 
      nome: currentUser.nome || '', 
      email: currentUser.email || '', 
      telefono: currentUser.telefono || '',
      azienda: currentUser.azienda || '',
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
        email: updatedUser.email || '',
        telefono: updatedUser.telefono || '',
        azienda: updatedUser.azienda || '',
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
    // Conferma creazione URGENTE: procede alla normale creazione e chiude le modali
    await createTicket(newTicketData, isEditingTicket, wrappedHandleUpdateTicket, selectedClientForNewTicket);
    // Resetta form e chiudi qualsiasi modale residua
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
    await createTicket(newTicketData, isEditingTicket, wrappedHandleUpdateTicket, selectedClientForNewTicket);
    resetNewTicketData();
    setModalState({ type: null, data: null });
  };

  const wrappedHandleCreateTicket = () => {
    // Se descrizione vuota, chiedi conferma
    if (!newTicketData.descrizione || newTicketData.descrizione.trim() === '') {
      setModalState({ type: 'emptyDescriptionConfirm' });
      return;
    }
    // Se priorità URGENTE e stiamo creando (non edit), mostra conferma
    if (!isEditingTicket && newTicketData.priorita === 'urgente') {
      setModalState({ type: 'urgentConfirm' });
      return;
    }
    
    // Chiedi conferma per l'invio email SOLO per i tecnici
    if (currentUser.ruolo === 'tecnico') {
      console.log('🔍 DEBUG: currentUser.ruolo =', currentUser.ruolo);
      console.log('🔍 DEBUG: Mostrando modal di conferma email per tecnico');
      
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
    console.log('🔍 DEBUG: Cliente - creazione ticket con email obbligatoria');
    createTicket(newTicketData, isEditingTicket, wrappedHandleUpdateTicket, selectedClientForNewTicket, true);
  };

  const wrappedHandleUpdateTicket = () => {
    // Chiedi conferma per l'invio email SOLO per i tecnici
    if (currentUser.ruolo === 'tecnico') {
      console.log('🔍 DEBUG: Aggiornamento ticket - currentUser.ruolo =', currentUser.ruolo);
      console.log('🔍 DEBUG: Mostrando modal di conferma email per aggiornamento');
      
      const clientName = users.find(u => u.id === parseInt(selectedClientForNewTicket))?.azienda || 'Cliente';
        
      setPendingTicketAction({
        type: 'update',
        data: newTicketData,
        isEditing: isEditingTicket,
        selectedClient: selectedClientForNewTicket
      });
      setModalState({ 
        type: 'emailConfirm', 
        data: { 
          isEditing: true, 
          clientName: clientName 
        } 
      });
      return;
    }
    
    // Per i clienti, aggiorna direttamente il ticket con invio email obbligatorio
    console.log('🔍 DEBUG: Cliente - aggiornamento ticket con email obbligatoria');
    updateTicket(newTicketData, isEditingTicket, selectedClientForNewTicket, true);
  };

  // Gestione conferma email
  const handleConfirmEmail = async () => {
    if (!pendingTicketAction) return;
    
    const { type, data, isEditing, selectedClient } = pendingTicketAction;
    
    if (type === 'create') {
      // Crea ticket con invio email
      await createTicket(data, isEditing, wrappedHandleUpdateTicket, selectedClient, true);
    } else if (type === 'update') {
      // Aggiorna ticket con invio email
      await updateTicket(data, isEditing, selectedClient, true);
    } else if (type === 'changeStatus') {
      // Cambia stato ticket con invio email
      await changeStatus(data.id, data.status, handleOpenTimeLogger, true);
    } else if (type === 'confirmTimeLogs') {
      // Conferma timeLogs con invio email
      await handleConfirmTimeLogs(data.timeLogs, true);
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
    } else if (type === 'confirmTimeLogs') {
      // Conferma timeLogs senza invio email
      await handleConfirmTimeLogs(data.timeLogs, false);
    }
    
    setPendingTicketAction(null);
    setModalState({ type: null, data: null });
  };

  // Gestione richiesta assistenza veloce
  const handleQuickRequest = async (formData) => {
    try {
      const apiBase = process.env.REACT_APP_API_URL || 'https://ticketapp-4eqb.onrender.com';
      
      // Crea un ticket con i dati della richiesta veloce
      const ticketData = {
        clienteid: null, // Sarà gestito dal backend
        titolo: formData.titolo,
        descrizione: formData.descrizione,
        stato: 'aperto',
        priorita: formData.priorita,
        nomerichiedente: `${formData.nome} ${formData.cognome}`,
        categoria: 'assistenza',
        // Dati aggiuntivi per richiesta veloce
        quickRequest: true,
        email: formData.email,
        telefono: formData.telefono,
        azienda: formData.azienda
      };

      const response = await fetch(`${apiBase}/api/tickets/quick-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ticketData)
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
              handleGenerateInvoiceReport
            }}
            getUnreadCount={getUnreadCount}
            externalHighlights={dashboardHighlights}
            alertsRefreshTrigger={alertsRefreshTrigger}
            getAuthHeader={getAuthHeader}
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
              handleGenerateInvoiceReport
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
          onSave={wrappedHandleCreateTicket}
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
        />
      )}
    </div>
  );
}
