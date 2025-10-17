// src/App.jsx
// VERSIONE SICURA - SENZA THEME (per far ripartire il deploy)

import React, { useState, useEffect } from 'react';
import Notification from './components/AppNotification';
import LoginScreen from './components/LoginScreen';
import Header from './components/Header';
import TicketListContainer from './components/TicketListContainer';
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
        
        setTickets(ticketsWithForniture);

        if (currentUser.ruolo === 'tecnico') {
          const clientsResponse = await fetch(process.env.REACT_APP_API_URL + '/api/users?role=cliente');
          if (clientsResponse.ok) {
            const clientsData = await clientsResponse.json();
            setUsers(clientsData);
          }
        }

        const storedId = localStorage.getItem('openTicketId');
        if (storedId && storedId !== 'null') {
          const found = ticketsWithForniture.find(t => t.id === storedId);
          if (found) setSelectedTicket(found);
        }
      } catch (error) {
        console.error('Errore nel caricare i dati:', error);
      }
    };

    fetchData();
  }, [isLoggedIn, currentUser]);

  // ====================================================================
  // POLLING PER AGGIORNAMENTI
  // ====================================================================
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(process.env.REACT_APP_API_URL + '/api/tickets');
        if (!response.ok) return;
        const ticketsData = await response.json();
        
        const ticketsWithForniture = await Promise.all(
          ticketsData.map(async (ticket) => {
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
        
        setTickets(ticketsWithForniture);
        
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
    }, 10000); // 10 secondi

    return () => clearInterval(interval);
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

      <main className="max-w-7xl mx-auto px-4 py-6">
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
        />
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
