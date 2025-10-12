// src/App.jsx

import React, { useState, useEffect } from 'react';
import Notification from './components/AppNotification';
import LoginScreen from './components/LoginScreen';
import Header from './components/Header';
import TicketListContainer from './components/TicketListContainer';
import AllModals from './components/Modals/AllModals';
import { getInitialMaterial, getInitialTimeLog } from './utils/helpers';
import { formatReportDate } from './utils/formatters';
import ManageClientsModal from './components/Modals/ManageClientsModal';
import NewClientModal from './components/Modals/NewClientModal';
import NewTicketModal from './components/Modals/NewTicketModal';

export default function TicketApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  
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
    email: '', 
    password: '', 
    telefono: '', 
    azienda: '' 
  });
  const [timeLogs, setTimeLogs] = useState([]);
  const [isEditingTicket, setIsEditingTicket] = useState(null);
  const [selectedClientForNewTicket, setSelectedClientForNewTicket] = useState('');
  const [hasShownUnreadNotification, setHasShownUnreadNotification] = useState(false);

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
  // CALCOLA MESSAGGI NON LETTI
  // ====================================================================
  const getUnreadCount = (ticket) => {
    if (!ticket.messaggi || ticket.messaggi.length === 0) return 0;
    
    const lastRead = currentUser.ruolo === 'cliente' 
      ? ticket.last_read_by_client 
      : ticket.last_read_by_tecnico;
    
    if (!lastRead) return ticket.messaggi.length;
    
    const lastReadDate = new Date(lastRead);
    return ticket.messaggi.filter(m => new Date(m.data) > lastReadDate).length;
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
        
        if (currentUser.ruolo === 'tecnico') {
          const now = new Date();
          const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
          
          const ticketsWithNewFlag = ticketsData.map(ticket => {
            const ticketDate = new Date(ticket.dataapertura);
            const isRecent = ticketDate > fiveMinutesAgo;
            return {
              ...ticket,
              isNew: isRecent && ticket.stato === 'aperto'
            };
          });
          
          setTickets(ticketsWithNewFlag);
        } else {
          setTickets(ticketsData);
        }

        if (currentUser.ruolo === 'tecnico') {
          const usersResponse = await fetch(process.env.REACT_APP_API_URL + '/api/users');
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            setUsers(usersData);
          }
        }

        if (!hasShownUnreadNotification && ticketsData.length > 0) {
          const unreadTickets = ticketsData.filter(t => {
            if (!t.messaggi || t.messaggi.length === 0) return false;
            const lastRead = currentUser.ruolo === 'cliente' 
              ? t.last_read_by_client 
              : t.last_read_by_tecnico;
            if (!lastRead) return t.messaggi.length > 0;
            const lastReadDate = new Date(lastRead);
            return t.messaggi.some(m => new Date(m.data) > lastReadDate);
          });

          if (unreadTickets.length > 0) {
            const totalUnread = unreadTickets.reduce((sum, t) => {
              const lastRead = currentUser.ruolo === 'cliente' 
                ? t.last_read_by_client 
                : t.last_read_by_tecnico;
              if (!lastRead) return sum + (t.messaggi?.length || 0);
              const lastReadDate = new Date(lastRead);
              return sum + t.messaggi.filter(m => new Date(m.data) > lastReadDate).length;
            }, 0);
            
            showNotification(
              `Hai ${totalUnread} nuov${totalUnread === 1 ? 'o messaggio' : 'i messaggi'} in ${unreadTickets.length} ticket!`, 
              'info',
              8000
            );
          }
          setHasShownUnreadNotification(true);
        }

      } catch (error) {
        console.error("Errore nel caricare i dati:", error);
        showNotification(error.message, "error");
      }
    };

    if (isLoggedIn) {
      fetchData();
    }
  }, [isLoggedIn, currentUser]);

  // ====================================================================
  // MODALI
  // ====================================================================
  const closeModal = () => {
    if (modalState.type === 'newTicket') {
      resetNewTicketData();
      setSelectedClientForNewTicket('');
      setIsEditingTicket(null);
    }
    setModalState({ type: null, data: null });
  };

  const resetNewTicketData = () => {
    if (!currentUser) {
      setNewTicketData({
        titolo: '',
        descrizione: '',
        categoria: 'assistenza',
        priorita: 'media',
        nomerichiedente: ''
      });
      return;
    }
    const nomeCognome = currentUser.ruolo === 'cliente' 
      ? (currentUser.nome + ' ' + (currentUser.cognome || '')).trim()
      : '';
    setNewTicketData({
      titolo: '',
      descrizione: '',
      categoria: 'assistenza',
      priorita: 'media',
      nomerichiedente: nomeCognome
    });
  };

  // ====================================================================
  // LOGIN / LOGOUT
  // ====================================================================
  const handleLogin = async () => {
    if (!loginData.email || !loginData.password) {
      return showNotification('Inserisci email e password.', 'error');
    }

    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Credenziali non valide' }));
        throw new Error(errorData.error);
      }

      const user = await response.json();
      setCurrentUser(user);
      setIsLoggedIn(true);
      setLoginData({ email: '', password: '' });
      showNotification('Benvenuto ' + user.nome + '!', 'success');

    } catch (error) {
      console.error("Errore durante il login:", error);
      showNotification(error.message || 'Credenziali non valide o errore di rete.', 'error');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setSelectedTicket(null);
    setTickets([]);
    setUsers([]);
    setHasShownUnreadNotification(false);
    closeModal();
    showNotification('Disconnessione effettuata.', 'info');
  };

  const handleAutoFillLogin = (ruolo) => {
    if (ruolo === 'cliente') {
      setLoginData({ email: 'cliente@example.com', password: 'cliente123' });
    } else if (ruolo === 'tecnico') {
      setLoginData({ email: 'tecnico@example.com', password: 'tecnico123' });
    }
  };

  // ====================================================================
  // APERTURA MODALI
  // ====================================================================
  const openNewTicketModal = () => {
    if (!currentUser) {
      showNotification('Errore: utente non loggato', 'error');
      return;
    }
    const clienti = users.filter(u => u.ruolo === 'cliente');
    if (currentUser.ruolo === 'tecnico' && clienti.length > 0) {
      setSelectedClientForNewTicket(clienti[0].id.toString());
    } else {
      setSelectedClientForNewTicket('');
    }
    resetNewTicketData();
    setModalState({ type: 'newTicket', data: null });
  };

  const handleOpenEditModal = (t) => {
    setNewTicketData({
      titolo: t.titolo,
      descrizione: t.descrizione,
      categoria: t.categoria,
      priorita: t.priorita,
      nomerichiedente: t.nomerichiedente
    });
    setIsEditingTicket(t.id);
    setSelectedClientForNewTicket(t.clienteid.toString());
    setModalState({ type: 'newTicket', data: t });
  };

  const openSettings = () => {
    setSettingsData({
      nome: currentUser.nome,
      email: currentUser.email,
      vecchiaPassword: '',
      nuovaPassword: '',
      confermaNuovaPassword: ''
    });
    setModalState({ type: 'settings', data: null });
  };
  
  const openNewClientModal = () => setModalState({ type: 'newClient' });
  const openManageClientsModal = () => setModalState({ type: 'manageClients' });

  const handleOpenTimeLogger = (t) => {
    setSelectedTicket(t);
    const logs = Array.isArray(t.timeLogs) ? t.timeLogs : [];
    const initialLogs = logs.length > 0
      ? logs.map(lg => ({
          ...lg,
          id: Date.now() + Math.random(),
          materials: Array.isArray(lg.materials)
            ? lg.materials.map(m => ({ ...m, id: Date.now() + Math.random() }))
            : [getInitialMaterial()]
        }))
      : [getInitialTimeLog()];
    setTimeLogs(initialLogs);
    setModalState({ type: 'timeLogger', data: t });
  };

  // ====================================================================
  // GESTIONE SETTINGS
  // ====================================================================
  const handleUpdateSettings = () => {
    if (!settingsData.nome || !settingsData.email) {
      showNotification('Nome ed email obbligatori.', 'error');
      return;
    }
    if (settingsData.nuovaPassword) {
      if (settingsData.nuovaPassword !== settingsData.confermaNuovaPassword) {
        showNotification('Le password non coincidono.', 'error');
        return;
      }
      if (currentUser.password !== settingsData.vecchiaPassword) {
        showNotification('Vecchia password errata.', 'error');
        return;
      }
    }
    const updatedUsers = users.map(us =>
      us.id === currentUser.id
        ? {
            ...us,
            nome: settingsData.nome,
            email: settingsData.email,
            password: settingsData.nuovaPassword || us.password
          }
        : us
    );
    setUsers(updatedUsers);
    setCurrentUser(updatedUsers.find(us => us.id === currentUser.id));
    closeModal();
    showNotification('Impostazioni aggiornate!', 'success');
  };

  // ====================================================================
  // GESTIONE CLIENTI (con API)
  // ====================================================================
  const handleCreateClient = async () => {
    if (!newClientData.email || !newClientData.password || !newClientData.azienda) {
      return showNotification('Email, password e azienda sono obbligatori.', 'error');
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newClientData,
          ruolo: 'cliente'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore del server.');
      }

      const savedClient = await response.json();
      setUsers(prev => [...prev, savedClient]);
      closeModal();
      setNewClientData({ email: '', password: '', telefono: '', azienda: '' });
      showNotification('Cliente creato con successo!', 'success');

    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleUpdateClient = async (id, updatedData) => { 
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore durante l\'aggiornamento.');
      }

      const updatedClient = await response.json();
      setUsers(prev => prev.map(user => user.id === id ? updatedClient : user));
      showNotification('Cliente aggiornato con successo!', 'success');

    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleDeleteClient = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo cliente? Questa azione è irreversibile.')) {
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore durante l\'eliminazione.');
      }

      setUsers(prev => prev.filter(user => user.id !== id));
      showNotification('Cliente eliminato con successo!', 'success');

    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  // ====================================================================
  // GESTIONE TICKET
  // ====================================================================
  const handleCreateTicket = () => {
    if (isEditingTicket) {
      handleUpdateTicket();
      return;
    }
    if (!newTicketData.titolo || !newTicketData.descrizione || !newTicketData.nomerichiedente) {
      showNotification('Compila i campi obbligatori.', 'error');
      return;
    }
    if (currentUser.ruolo === 'tecnico' && !selectedClientForNewTicket) {
      showNotification('Seleziona un cliente.', 'error');
      return;
    }
    if (newTicketData.priorita === 'urgente' && currentUser.ruolo === 'cliente') {
      setModalState({ type: 'urgentConfirm', data: null });
      return;
    }
    handleConfirmUrgentCreation();
  };

  const handleConfirmUrgentCreation = async () => {
    if (!newTicketData.titolo || !newTicketData.descrizione || !newTicketData.nomerichiedente) {
      showNotification('Campi obbligatori mancanti.', 'error');
      closeModal();
      return;
    }

    let clienteId = currentUser.ruolo === 'tecnico' ? parseInt(selectedClientForNewTicket) : currentUser.id;

    const ticketDaInviare = {
      ...newTicketData,
      clienteid: clienteId,
      nomerichiedente: newTicketData.nomerichiedente,
      stato: 'aperto'
    };

    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketDaInviare)
      });

      if (!response.ok) {
        throw new Error('La risposta del server non è stata positiva');
      }

      const nuovoTicketSalvato = await response.json();
      
      const ticketConFlag = {
        ...nuovoTicketSalvato,
        isNew: true
      };
      
      setTickets(prevTickets => [ticketConFlag, ...prevTickets]);

      closeModal();
      showNotification('Ticket creato con successo!', 'success');
      if (currentUser.ruolo === 'cliente') {
        setSelectedTicket(ticketConFlag);
      }

    } catch (error) {
      console.error("Errore nella creazione del ticket:", error);
      showNotification('Impossibile creare il ticket.', 'error');
    }
  };

  const handleUpdateTicket = () => {
    if (!newTicketData.titolo || !newTicketData.descrizione || !newTicketData.nomerichiedente) {
      showNotification('Compila i campi obbligatori.', 'error');
      return;
    }
    const oldTicket = tickets.find(t => t.id === isEditingTicket);
    const clienteId = currentUser.ruolo === 'tecnico'
      ? (selectedClientForNewTicket ? parseInt(selectedClientForNewTicket) : oldTicket.clienteid)
      : oldTicket.clienteid;
    const updatedTicket = {
      ...oldTicket,
      ...newTicketData,
      clienteid: clienteId,
      nomerichiedente: newTicketData.nomerichiedente
    };
    setTickets(prev => prev.map(t => (t.id === isEditingTicket ? updatedTicket : t)));
    if (selectedTicket && selectedTicket.id === isEditingTicket) {
      setSelectedTicket(updatedTicket);
    }
    showNotification('Ticket aggiornato!', 'success');
    closeModal();
  };

  const handleDeleteTicket = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo ticket?')) {
      return;
    }

    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/tickets/' + id, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Errore nell\'eliminazione del ticket');
      }

      setTickets(prevTickets => prevTickets.filter(t => t.id !== id));
      
      if (selectedTicket && selectedTicket.id === id) {
        setSelectedTicket(null);
      }

      showNotification('Ticket eliminato con successo!', 'success');

    } catch (error) {
      console.error('Errore nell\'eliminazione del ticket:', error);
      showNotification('Impossibile eliminare il ticket. Riprova.', 'error');
    }
  };

  const handleSendMessage = async (id, msg, isReclamo) => { /* ... */ };
  const handleChangeStatus = async (id, status) => { /* ... */ };
  const handleSelectTicket = async (t) => { /* ... */ };
  const handleSetInviato = (id) => handleChangeStatus(id, 'inviato');
  const handleReopenInLavorazione = (id) => handleChangeStatus(id, 'in_lavorazione');
  const handleReopenAsRisolto = (id) => handleChangeStatus(id, 'risolto');
  const handleArchiveTicket = (id) => handleChangeStatus(id, 'chiuso');
  const handleInvoiceTicket = (id) => handleChangeStatus(id, 'fatturato');
  const handleTimeLogChange = (id, field, value) => { /* ... */ };
  const handleAddTimeLog = () => { /* ... */ };
  const handleDuplicateTimeLog = (log) => { /* ... */ };
  const handleRemoveTimeLog = (id) => { /* ... */ };
  const handleMaterialChange = (logId, matId, field, value) => { /* ... */ };
  const handleAddMaterial = (logId) => { /* ... */ };
  const handleRemoveMaterial = (logId, matId) => { /* ... */ };
  const handleConfirmTimeLogs = async () => { /* ... */ };
  const handleGenerateSentReport = (filteredTickets) => { /* ... */ };
  const handleGenerateInvoiceReport = (filteredTickets) => { /* ... */ };
  
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
      {/* --- ECCO LA CORREZIONE: Ho aggiunto tutte le funzioni mancanti --- */}
      <Header
        currentUser={currentUser}
        handleLogout={handleLogout}
        openNewTicketModal={openNewTicketModal}
        openNewClientModal={() => setModalState({ type: 'newClient' })}
        openSettings={openSettings}
        openManageClientsModal={openManageClientsModal}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <TicketListContainer
          currentUser={currentUser}
          tickets={tickets}
          users={users}
          selectedTicket={selectedTicket}
          getUnreadCount={getUnreadCount}
          handlers={{
            handleSelectTicket,
            handleOpenEditModal,
            handleOpenTimeLogger,
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
        // ... (props per le altre modali)
        settingsData={settingsData}
        setSettingsData={setSettingsData}
        handleUpdateSettings={handleUpdateSettings}
        handleConfirmUrgentCreation={handleConfirmUrgentCreation}
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
          onSave={handleCreateClient}
        />
      )}
      
      {modalState.type === 'newTicket' && (
        <NewTicketModal
          onClose={closeModal}
          onSave={handleCreateTicket}
          newTicketData={newTicketData}
          setNewTicketData={setNewTicketData}
          isEditingTicket={isEditingTicket}
          currentUser={currentUser}
          clientiAttivi={users.filter(u => u.ruolo === 'cliente')}
          selectedClientForNewTicket={selectedClientForNewTicket}
          setSelectedClientForNewTicket={setSelectedClientForNewTicket}
        />
      )}
    </div>
  );
}
