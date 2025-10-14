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

  // NOTIFICHE
  const showNotification = (message, type = 'success', duration = 5000) => { /* ... (codice invariato) ... */ };
  const handleCloseNotification = () => { /* ... (codice invariato) ... */ };
  
  // FUNZIONI VARIE
  const getUnreadCount = (ticket) => { /* ... (codice invariato) ... */ };
  useEffect(() => { /* ... (codice invariato) ... */ }, [isLoggedIn, currentUser]);
  const closeModal = () => { /* ... (codice invariato) ... */ };
  const resetNewTicketData = () => { /* ... (codice invariato) ... */ };
  
  // LOGIN / LOGOUT
  const handleLogin = async () => { /* ... (codice invariato) ... */ };
  const handleLogout = () => { /* ... (codice invariato) ... */ };
  const handleAutoFillLogin = (ruolo) => { /* ... (codice invariato) ... */ };
  
  // APERTURA MODALI
  const openNewTicketModal = () => { /* ... (codice invariato) ... */ };
  const openSettings = () => {
    setSettingsData({ nome: currentUser.nome, email: currentUser.email, vecchiaPassword: '', nuovaPassword: '', confermaNuovaPassword: '' });
    setModalState({ type: 'settings' });
  };
  const openManageClientsModal = () => setModalState({ type: 'manageClients' });
  const openNewClientModal = () => setModalState({ type: 'newClient' });
  const handleOpenTimeLogger = (ticket) => { /* ... (codice invariato) ... */ };
  const handleOpenEditModal = (ticket) => { /* ... (codice invariato) ... */ };

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
      // NOTA: Il tuo backend non richiede la vecchia password, quindi non la inviamo.
      // Se lo richiedesse, dovresti aggiungere qui il controllo.
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
  const handleCreateClient = async () => { /* ... (codice invariato) ... */ };
  const handleUpdateClient = async (id, updatedData) => { /* ... (codice invariato) ... */ };
  const handleDeleteClient = async (id) => { /* ... (codice invariato) ... */ };

  // GESTIONE TICKET
  const handleCreateTicket = async () => { /* ... (codice invariato) ... */ };
  const handleUpdateTicket = async () => { /* ... (codice invariato) ... */ };
  const handleConfirmUrgentCreation = async () => { /* ... (codice invariato) ... */ };
  const handleDeleteTicket = async (id) => { /* ... (codice invariato) ... */ };
  const handleSendMessage = async (id, msg, isReclamo) => { /* ... (codice invariato) ... */ };
  const handleChangeStatus = async (id, status) => { /* ... (codice invariato) ... */ };
  const handleSelectTicket = async (t) => { /* ... (codice invariato) ... */ };
  const handleReopenInLavorazione = (id) => { /* ... (codice invariato) ... */ };
  const handleReopenAsRisolto = (id) => { /* ... (codice invariato) ... */ };
  const handleSetInviato = (id) => { /* ... (codice invariato) ... */ };
  const handleArchiveTicket = (id) => { /* ... (codice invariato) ... */ };
  const handleInvoiceTicket = (id) => { /* ... (codice invariato) ... */ };
  const handleTimeLogChange = () => { /* ... (codice invariato) ... */ };
  const handleAddTimeLog = () => { /* ... (codice invariato) ... */ };
  const handleDuplicateTimeLog = (log) => { /* ... (codice invariato) ... */ };
  const handleRemoveTimeLog = (id) => { /* ... (codice invariato) ... */ };
  const handleMaterialChange = (logId, matId, field, value) => { /* ... (codice invariato) ... */ };
  const handleAddMaterial = (logId) => { /* ... (codice invariato) ... */ };
  const handleRemoveMaterial = (logId, matId) => { /* ... (codice invariato) ... */ };
  const handleConfirmTimeLogs = async () => { /* ... (codice invariato) ... */ };
  const handleGenerateSentReport = () => { /* ... (codice invariato) ... */ };
  const handleGenerateInvoiceReport = () => { /* ... (codice invariato) ... */ };
  
  // RENDER
  if (!isLoggedIn) { /* ... (codice invariato) ... */ }

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
        {...{ modalState, closeModal, handleUpdateSettings, handleConfirmUrgentCreation, settingsData, setSettingsData, timeLogs, setTimeLogs, handleTimeLogChange, handleAddTimeLog, handleRemoveTimeLog, handleDuplicateTimeLog, handleMaterialChange, handleAddMaterial, handleRemoveMaterial, handleConfirmTimeLogs }}
      />
      {modalState.type === 'manageClients' && ( <ManageClientsModal clienti={users.filter(u => u.ruolo === 'cliente')} onClose={closeModal} onUpdateClient={handleUpdateClient} onDeleteClient={handleDeleteClient} /> )}
      {modalState.type === 'newClient' && ( <NewClientModal newClientData={newClientData} setNewClientData={setNewClientData} onClose={closeModal} onSave={handleCreateClient} /> )}
      {modalState.type === 'newTicket' && ( <NewTicketModal onClose={closeModal} onSave={handleCreateTicket} newTicketData={newTicketData} setNewTicketData={setNewTicketData} isEditingTicket={isEditingTicket} currentUser={currentUser} clientiAttivi={users.filter(u => u.ruolo === 'cliente')} selectedClientForNewTicket={selectedClientForNewTicket} setSelectedClientForNewTicket={setSelectedClientForNewTicket} /> )}
    </div>
  );
}
