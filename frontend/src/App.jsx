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
    if (!currentUser || !ticket.messaggi || ticket.messaggi.length === 0) return 0;
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
        setTickets(ticketsData);

        if (currentUser.ruolo === 'tecnico') {
          const usersResponse = await fetch(process.env.REACT_APP_API_URL + '/api/users');
          if (usersResponse.ok) setUsers(await usersResponse.json());
        }
        
        if (!hasShownUnreadNotification) {
            const unreadTickets = ticketsData.filter(t => getUnreadCount(t) > 0);
            if (unreadTickets.length > 0) {
                const totalUnread = unreadTickets.reduce((sum, t) => sum + getUnreadCount(t), 0);
                showNotification(`Hai ${totalUnread} nuov${totalUnread === 1 ? 'o messaggio' : 'i messaggi'}!`, 'info');
            }
            setHasShownUnreadNotification(true);
        }
      } catch (error) {
        showNotification(error.message, "error");
      }
    };
    if (isLoggedIn) fetchData();
  }, [isLoggedIn, currentUser]);

  // ====================================================================
  // MODALI
  // ====================================================================
  const closeModal = () => {
    if (modalState.type === 'newTicket') {
      resetNewTicketData();
    }
    setModalState({ type: null, data: null });
  };

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
  // LOGIN / LOGOUT
  // ====================================================================
  const handleLogin = async () => {
    if (!loginData.email || !loginData.password) return showNotification('Inserisci email e password.', 'error');
    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Credenziali non valide');
      const user = await response.json();
      setCurrentUser(user);
      setIsLoggedIn(true);
      setLoginData({ email: '', password: '' });
      showNotification(`Benvenuto ${user.nome}!`, 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
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
  const openNewTicketModal = () => { resetNewTicketData(); setModalState({ type: 'newTicket' }); };
  const openSettings = () => {
    setSettingsData({ nome: currentUser.nome, email: currentUser.email, vecchiaPassword: '', nuovaPassword: '', confermaNuovaPassword: '' });
    setModalState({ type: 'settings' });
  };
  const openManageClientsModal = () => setModalState({ type: 'manageClients' });
  const openNewClientModal = () => setModalState({ type: 'newClient' });
  const handleOpenTimeLogger = (ticket) => {
    setSelectedTicket(ticket);
    const logs = Array.isArray(ticket.timeLogs) ? ticket.timeLogs : [];
    const initialLogs = logs.length > 0 ? logs.map(lg => ({ ...lg, id: Date.now() + Math.random(), materials: Array.isArray(lg.materials) ? lg.materials.map(m => ({ ...m, id: Date.now() + Math.random() })) : [getInitialMaterial()] })) : [getInitialTimeLog()];
    setTimeLogs(initialLogs);
    setModalState({ type: 'timeLogger', data: ticket });
  };
  const handleOpenEditModal = (ticket) => {
    setNewTicketData({
      titolo: ticket.titolo,
      descrizione: ticket.descrizione,
      categoria: ticket.categoria,
      priorita: ticket.priorita,
      nomerichiedente: ticket.nomerichiedente
    });
    setIsEditingTicket(ticket.id);
    setSelectedClientForNewTicket(ticket.clienteid.toString());
    setModalState({ type: 'newTicket', data: ticket });
  };

  // ====================================================================
  // --- UNICA MODIFICA: QUESTA FUNZIONE ORA SALVA NEL DATABASE ---
  // ====================================================================
  const handleUpdateSettings = async () => {
    if (!settingsData.nome || !settingsData.email) {
      return showNotification('Nome ed email sono obbligatori.', 'error');
    }
    
    // Prepara i dati da inviare al backend
    const dataToUpdate = {
      nome: settingsData.nome,
      email: settingsData.email,
    };

    // Aggiungi la password solo se è stata inserita e confermata
    if (settingsData.nuovaPassword) {
      if (settingsData.nuovaPassword !== settingsData.confermaNuovaPassword) {
        return showNotification('Le nuove password non coincidono.', 'error');
      }
      // NOTA: Se il backend richiedesse la vecchia password per sicurezza,
      // il controllo andrebbe fatto qui.
      dataToUpdate.password = settingsData.nuovaPassword;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${currentUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToUpdate)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore durante l\'aggiornamento.');
      }

      const updatedUser = await response.json();
      
      // Aggiorna lo stato locale con i dati salvati
      setCurrentUser(updatedUser);
      // Se è un tecnico, aggiorna anche la lista generale degli utenti
      if (currentUser.ruolo === 'tecnico') {
          setUsers(prevUsers => prevUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
      }
      
      closeModal();
      showNotification('Impostazioni aggiornate con successo!', 'success');

    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  // GESTIONE CLIENTI (con API)
  const handleCreateClient = async () => { /* ... la tua logica ... */ };
  const handleUpdateClient = async (id, updatedData) => { /* ... la tua logica ... */ };
  const handleDeleteClient = async (id) => { /* ... la tua logica ... */ };

  // GESTIONE TICKET
  const handleCreateTicket = async () => { /* ... la tua logica ... */ };
  const handleUpdateTicket = async () => { /* ... la tua logica ... */ };
  const handleConfirmUrgentCreation = async () => { /* ... la tua logica ... */ };
  const handleDeleteTicket = async (id) => { /* ... la tua logica ... */ };
  const handleSendMessage = async (id, msg, isReclamo) => { /* ... la tua logica ... */ };
  const handleChangeStatus = async (id, status) => { /* ... la tua logica ... */ };
  const handleSelectTicket = async (t) => { /* ... la tua logica ... */ };
  const handleReopenInLavorazione = (id) => handleChangeStatus(id, 'in_lavorazione');
  const handleReopenAsRisolto = (id) => handleChangeStatus(id, 'risolto');
  const handleSetInviato = (id) => handleChangeStatus(id, 'inviato');
  const handleArchiveTicket = (id) => handleChangeStatus(id, 'chiuso');
  const handleInvoiceTicket = (id) => handleChangeStatus(id, 'fatturato');
  const handleTimeLogChange = (id, field, value) => { /* ... la tua logica ... */ };
  const handleAddTimeLog = () => { /* ... la tua logica ... */ };
  const handleDuplicateTimeLog = (log) => { /* ... la tua logica ... */ };
  const handleRemoveTimeLog = (id) => { /* ... la tua logica ... */ };
  const handleMaterialChange = (logId, matId, field, value) => { /* ... la tua logica ... */ };
  const handleAddMaterial = (logId) => { /* ... la tua logica ... */ };
  const handleRemoveMaterial = (logId, matId) => { /* ... la tua logica ... */ };
  const handleConfirmTimeLogs = async () => { /* ... la tua logica ... */ };
  const handleGenerateSentReport = (filteredTickets) => { /* ... la tua logica ... */ };
  const handleGenerateInvoiceReport = (filteredTickets) => { /* ... la tua logica ... */ };
  
  // RENDER
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
      <Header {...{ currentUser, handleLogout, openNewTicketModal, openNewClientModal, openSettings, openManageClientsModal }} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <TicketListContainer
          {...{ currentUser, tickets, users, selectedTicket, getUnreadCount }}
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
        handleConfirmTimeLogs={handleConfirmTimeLogs}
      />
      {modalState.type === 'manageClients' && ( <ManageClientsModal clienti={users.filter(u => u.ruolo === 'cliente')} onClose={closeModal} onUpdateClient={handleUpdateClient} onDeleteClient={handleDeleteClient} /> )}
      {modalState.type === 'newClient' && ( <NewClientModal newClientData={newClientData} setNewClientData={setNewClientData} onClose={closeModal} onSave={handleCreateClient} /> )}
      {modalState.type === 'newTicket' && ( <NewTicketModal onClose={closeModal} onSave={handleCreateTicket} newTicketData={newTicketData} setNewTicketData={setNewTicketData} isEditingTicket={isEditingTicket} currentUser={currentUser} clientiAttivi={users.filter(u => u.ruolo === 'cliente')} selectedClientForNewTicket={selectedClientForNewTicket} setSelectedClientForNewTicket={setSelectedClientForNewTicket} /> )}
    </div>
  );
}
