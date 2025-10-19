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

export default function TicketApp() {
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [notificationTimeout, setNotificationTimeout] = useState(null);

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
    vecchiaPassword: '', 
    nuovaPassword: '', 
    confermaNuovaPassword: '' 
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

  // Helpers per localStorage (nuovi ticket non ancora aperti dall'utente)
  const getSetFromStorage = (key) => {
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
  };
  const saveSetToStorage = (key, set) => {
    try { localStorage.setItem(key, JSON.stringify(Array.from(set))); } catch {}
  };

  // ====================================================================
  // NOTIFICHE
  // ====================================================================
  const showNotification = (message, type = 'success', duration = 5000) => {
    if (notificationTimeout) clearTimeout(notificationTimeout);
    setNotification({ show: true, message, type });
    const newTimeout = setTimeout(() => setNotification(p => ({ ...p, show: false })), duration);
    setNotificationTimeout(newTimeout);
  };

  const handleCloseNotification = () => {
    if (notificationTimeout) clearTimeout(notificationTimeout);
    setNotification(p => ({ ...p, show: false }));
  };

  // ====================================================================
  // HOOKS PERSONALIZZATI
  // ====================================================================
  const {
    isLoggedIn,
    currentUser,
    loginData,
    setLoginData,
    handleLogin,
    handleLogout,
    handleAutoFillLogin
  } = useAuth(showNotification);

  const {
    handleCreateClient,
    handleUpdateClient,
    handleDeleteClient
  } = useClients(showNotification, setUsers, setTickets);

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
    closeModal
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
  } = useTimeLogs(selectedTicket, setTickets, setSelectedTicket, showNotification);

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
        const ticketsResponse = await fetch(process.env.REACT_APP_API_URL + '/api/tickets');
        if (!ticketsResponse.ok) throw new Error("Errore nel caricare i ticket");
        const ticketsData = await ticketsResponse.json();
        
        // Carica il conteggio forniture per ogni ticket
        const ticketsWithForniture = await Promise.all(
          ticketsData.map(async (ticket) => {
            try {
              const fornitureResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${ticket.id}/forniture`);
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
          const usersResponse = await fetch(process.env.REACT_APP_API_URL + '/api/users');
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
        const response = await fetch(process.env.REACT_APP_API_URL + '/api/tickets');
        if (!response.ok) return;
        
        const updatedTickets = await response.json();
        
        // Carica forniture
        const ticketsWithForniture = await Promise.all(
          updatedTickets.map(async (ticket) => {
            try {
              const fornitureResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${ticket.id}/forniture`);
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
          ticketsWithForniture.forEach(t => {
            const appliesToUser = currentUser.ruolo === 'tecnico' || t.clienteid === currentUser.id;
            if (appliesToUser && t.stato === 'aperto' && !prevIds.has(t.id)) {
              unseenP.add(t.id);
            }
          });
          if (unseenKeyP) saveSetToStorage(unseenKeyP, unseenP);
          polled = ticketsWithForniture.map(t => {
            const appliesToUser = currentUser.ruolo === 'tecnico' || t.clienteid === currentUser.id;
            return { ...t, isNew: appliesToUser && t.stato === 'aperto' && unseenP.has(t.id) };
          });
        }
        setTickets(polled);
        // Toast a scomparsa per ciascun nuovo ticket
        if (currentUser.ruolo === 'cliente' || currentUser.ruolo === 'tecnico') {
          polled.filter(t => t.isNew).forEach(t => {
            showNotification(`Nuovo ticket ${t.numero}: ${t.titolo}`, 'success', 6000);
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
    setSettingsData({ nome: currentUser.nome, email: currentUser.email, vecchiaPassword: '', nuovaPassword: '', confermaNuovaPassword: '' });
    setModalState({ type: 'settings' });
  };
  const openManageClientsModal = () => setModalState({ type: 'manageClients' });
  const openNewClientModal = () => setModalState({ type: 'newClient' });

  const handleFornitureCountChange = (ticketId, newCount) => {
    setTickets(prev => prev.map(t => 
      t.id === ticketId ? { ...t, fornitureCount: newCount } : t
    ));
  };

  // ====================================================================
  // WRAPPER FUNZIONI
  // ====================================================================
  const handleUpdateSettings = () => { /* ... la tua logica ... */ };
  const handleConfirmUrgentCreation = async () => { /* ... la tua logica ... */ };

  const wrappedHandleCreateTicket = () => {
    createTicket(newTicketData, isEditingTicket, wrappedHandleUpdateTicket, selectedClientForNewTicket);
  };

  const wrappedHandleUpdateTicket = () => {
    updateTicket(newTicketData, isEditingTicket, selectedClientForNewTicket);
  };

  const wrappedHandleCreateClient = () => {
    handleCreateClient(newClientData, () => {
      setNewClientData({ nome: '', cognome: '', email: '', password: '', telefono: '', azienda: '' });
      closeModal();
    });
  };

  const handleChangeStatus = (id, status) => {
    changeStatus(id, status, handleOpenTimeLogger);
  };

  const handleReopenInLavorazione = (id) => handleChangeStatus(id, 'in_lavorazione');
  const handleReopenAsRisolto = (id) => handleChangeStatus(id, 'risolto');
  const handleSetInviato = (id) => handleChangeStatus(id, 'inviato');
  const handleArchiveTicket = (id) => handleChangeStatus(id, 'chiuso');
  const handleInvoiceTicket = (id) => handleChangeStatus(id, 'fatturato');

  const wrappedHandleConfirmTimeLogs = () => {
    handleConfirmTimeLogs(timeLogs);
  };

  const handleOpenTicketFromModal = (ticket) => {
    handleSelectTicket(ticket);
    setShowUnreadModal(false);
  };
  
  // ====================================================================
  // RENDER
  // ====================================================================
  if (!isLoggedIn) {
    return (
      <>
        <Notification {...{ notification, handleCloseNotification }} />
        <LoginScreen {...{ loginData, setLoginData, handleLogin, handleAutoFillLogin }} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Notification {...{ notification, handleCloseNotification }} />
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
