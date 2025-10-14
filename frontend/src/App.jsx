// src/App.jsx

import React, { useState, useEffect, useMemo } from 'react'; // Aggiunto 'useMemo'
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

  // ... (TUTTE LE FUNZIONI DA 'showNotification' a 'handleGenerateInvoiceReport' RIMANGONO IDENTICHE)
  const showNotification = (message, type = 'success', duration = 5000) => { /* ... */ };
  const handleCloseNotification = () => { /* ... */ };
  const getUnreadCount = (ticket) => { /* ... */ };
  useEffect(() => { /* ... */ }, [isLoggedIn, currentUser]);
  const closeModal = () => { /* ... */ };
  const resetNewTicketData = () => { /* ... */ };
  const handleLogin = async () => { /* ... */ };
  const handleLogout = () => { /* ... */ };
  const handleAutoFillLogin = (ruolo) => { /* ... */ };
  const openNewTicketModal = () => { /* ... */ };
  const handleOpenEditModal = (t) => { /* ... */ };
  const openSettings = () => { /* ... */ };
  const openManageClientsModal = () => setModalState({ type: 'manageClients' });
  const openNewClientModal = () => setModalState({ type: 'newClient' });
  const handleOpenTimeLogger = (t) => { /* ... */ };
  const handleUpdateSettings = () => { /* ... */ };
  const handleCreateClient = async () => { /* ... */ };
  const handleUpdateClient = async (id, updatedData) => { /* ... */ };
  const handleDeleteClient = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo cliente? L\'azione è irreversibile.')) {
        return;
    }
    try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Errore durante l\'eliminazione del cliente');
        }
        setUsers(prev => prev.filter(u => u.id !== id));
        showNotification('Cliente eliminato con successo!', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
  };
  const handleCreateTicket = async () => { /* ... */ };
  const handleUpdateTicket = async () => { /* ... */ };
  const handleConfirmUrgentCreation = async () => { /* ... */ };
  const handleDeleteTicket = async (id) => { /* ... */ };
  const handleSelectTicket = async (ticket) => { /* ... */ };
  const handleSendMessage = async (id, msg, isReclamo = false) => { /* ... */ };
  const handleChangeStatus = async (id, status) => { /* ... */ };
  const handleReopenInLavorazione = (id) => handleChangeStatus(id, 'in_lavorazione');
  const handleReopenAsRisolto = (id) => handleChangeStatus(id, 'risolto');
  const handleSetInviato = (id) => handleChangeStatus(id, 'inviato');
  const handleArchiveTicket = (id) => handleChangeStatus(id, 'chiuso');
  const handleInvoiceTicket = (id) => handleChangeStatus(id, 'fatturato');
  const handleGenerateSentReport = () => { /* ... */ };
  const handleGenerateInvoiceReport = () => { /* ... */ };
  const handleTimeLogChange = () => { /* ... */ };
  const handleAddTimeLog = () => { /* ... */ };
  const handleDuplicateTimeLog = () => { /* ... */ };
  const handleRemoveTimeLog = () => { /* ... */ };
  const handleMaterialChange = () => { /* ... */ };
  const handleAddMaterial = () => { /* ... */ };
  const handleRemoveMaterial = () => { /* ... */ };
  const handleConfirmTimeLogs = () => { /* ... */ };
  
  // ====================================================================
  // --- UNICA MODIFICA: Calcola quali clienti hanno ticket ---
  // ====================================================================
  const clientIdsWithTickets = useMemo(() => 
    new Set(tickets.map(ticket => ticket.clienteid))
  , [tickets]);

  if (!isLoggedIn) { /* ... (codice invariato) ... */ }

  return (
    <div className="min-h-screen bg-gray-50">
      <Notification {...{ notification, handleCloseNotification }} />
      <Header
        {...{ currentUser, handleLogout, openNewTicketModal, openNewClientModal, openSettings, openManageClientsModal }}
      />

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

      {modalState.type === 'manageClients' && (
        <ManageClientsModal
          clienti={users.filter(u => u.ruolo === 'cliente')}
          // --- UNICA MODIFICA: Passa l'informazione alla finestra ---
          clientIdsWithTickets={clientIdsWithTickets}
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
