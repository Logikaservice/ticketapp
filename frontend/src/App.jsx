// src/App.jsx

import React, { useState, useEffect } from 'react';
import Notification from './components/AppNotification';
import LoginScreen from './components/LoginScreen';
import Header from './components/Header';
import TicketListContainer from './components/TicketListContainer';
import AllModals from './components/Modals/AllModals';
import { getInitialMaterial, getInitialTimeLog } from './utils/helpers';
import ManageClientsModal from './components/Modals/ManageClientsModal';
import NewClientModal from './components/Modals/NewClientModal';

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
  const [newTicketData, setNewTicketData] = useState({ /* ... */ });
  const [settingsData, setSettingsData] = useState({ /* ... */ });
  const [newClientData, setNewClientData] = useState({ 
    email: '', 
    password: '', 
    telefono: '', 
    azienda: '' 
  });
  const [timeLogs, setTimeLogs] = useState([]);
  const [isEditingTicket, setIsEditingTicket] = useState(null);
  const [selectedClientForNewTicket, setSelectedClientForNewTicket] = useState('');
  
  const handleCloseNotification = () => {
    if (notificationTimeout) clearTimeout(notificationTimeout);
    setNotification(p => ({ ...p, show: false }));
  };

  const showNotification = (message, type = 'success', duration = 5000) => {
    if (notificationTimeout) clearTimeout(notificationTimeout);
    setNotification({ show: true, message, type });
    const newTimeout = setTimeout(() => {
      setNotification(p => ({ ...p, show: false }));
    }, duration);
    setNotificationTimeout(newTimeout);
  };
  
  const closeModal = () => {
    setModalState({ type: null, data: null });
  };

  const handleLogin = async () => {
    if (!loginData.email || !loginData.password) return showNotification('Inserisci email e password.', 'error');
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginData)
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

  const handleAutoFillLogin = (ruolo) => setLoginData(ruolo === 'cliente' ? { email: 'cliente@example.com', password: 'cliente123' } : { email: 'tecnico@example.com', password: 'tecnico123' });

  const openNewTicketModal = () => setModalState({ type: 'newTicket' });
  const openSettings = () => setModalState({ type: 'settings' });
  const openManageClientsModal = () => setModalState({ type: 'manageClients' });

  const handleUpdateClient = (id, updatedData) => {
    // Qui dovresti aggiungere la chiamata API per aggiornare il cliente
    setUsers(users.map(u => u.id === id ? { ...u, ...updatedData } : u));
    showNotification('Cliente aggiornato!', 'success');
  };

  const handleDeleteClient = (id) => {
    // Qui dovresti aggiungere la chiamata API per eliminare il cliente
    if (tickets.some(t => t.clienteid === id)) return showNotification('Impossibile eliminare: cliente con ticket associati.', 'error');
    setUsers(users.filter(u => u.id !== id));
    showNotification('Cliente eliminato!', 'success');
  };

  // --- FUNZIONE MODIFICATA ---
  const handleCreateClient = async () => {
    if (!newClientData.email || !newClientData.password || !newClientData.azienda) {
      return showNotification('Email, password e azienda sono obbligatori.', 'error');
    }
    if (users.some(u => u.email === newClientData.email)) {
      return showNotification('Email già registrata.', 'error');
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newClientData,
          ruolo: 'cliente' // Assicura che il ruolo sia impostato correttamente
        })
      });

      if (!response.ok) {
        throw new Error('Errore del server durante la creazione del cliente.');
      }

      const savedClient = await response.json();

      setUsers(prev => [...prev, savedClient]); // Aggiungi il cliente restituito dal DB
      closeModal();
      setNewClientData({ email: '', password: '', telefono: '', azienda: '' });
      showNotification('Cliente creato con successo!', 'success');

    } catch (error) {
      showNotification(error.message || 'Impossibile creare il cliente.', 'error');
    }
  };
  
  const handleCreateTicket = () => { /* ... la tua logica per creare un ticket ... */ };
  
  // (le altre funzioni rimangono invariate)
  const handleConfirmUrgentCreation = () => {};
  const resetNewTicketData = () => {};
  const handleUpdateSettings = () => {};
  const getUnreadCount = () => 0;
  const handleOpenEditModal = () => {};

  if (!isLoggedIn) {
    return (
      <>
        <Notification notification={notification} handleClose={handleCloseNotification} />
        <LoginScreen {...{ loginData, setLoginData, handleLogin, handleAutoFillLogin }} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Notification notification={notification} handleClose={handleCloseNotification} />
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
            handleOpenEditModal
            // ...altri handlers
          }}
        />
      </main>

      <AllModals
        modalState={modalState}
        closeModal={closeModal}
        newTicketData={newTicketData}
        setNewTicketData={setNewTicketData}
        handleCreateTicket={handleCreateTicket}
        isEditingTicket={isEditingTicket}
        currentUser={currentUser}
        clientiAttivi={users.filter(u => u.ruolo === 'cliente')}
        selectedClientForNewTicket={selectedClientForNewTicket}
        setSelectedClientForNewTicket={setSelectedClientForNewTicket}
        resetNewTicketData={resetNewTicketData}
        settingsData={settingsData}
        setSettingsData={setSettingsData}
        handleUpdateSettings={handleUpdateSettings}
        handleConfirmUrgentCreation={handleConfirmUrgentCreation}
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
          onSave={handleCreateClient}
        />
      )}
    </div>
  );
}
