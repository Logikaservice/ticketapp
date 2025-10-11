// src/App.jsx

import React, { useState, useEffect } from 'react';
import Notification from './components/AppNotification';
import LoginScreen from './components/LoginScreen';
import Header from './components/Header';
import TicketListContainer from './components/TicketListContainer';
import AllModals from './components/Modals/AllModals';
import { getInitialMaterial, getInitialTimeLog } from './utils/helpers';
// Importa le nuove finestre dalla cartella Modals
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

  const [modalState, setModalState] = useState({ type: null, data: null });
  const [newTicketData, setNewTicketData] = useState({ /* ... */ });
  const [settingsData, setSettingsData] = useState({ /* ... */ });
  const [newClientData, setNewClientData] = useState({ 
    email: '', 
    password: '', 
    telefono: '', 
    azienda: '' 
  });
  // ... (altri stati)

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
    setUsers(users.map(u => u.id === id ? { ...u, ...updatedData } : u));
    showNotification('Cliente aggiornato!', 'success');
  };

  const handleDeleteClient = (id) => {
    if (tickets.some(t => t.clienteid === id)) return showNotification('Impossibile eliminare: cliente con ticket associati.', 'error');
    setUsers(users.filter(u => u.id !== id));
    showNotification('Cliente eliminato!', 'success');
  };

  const handleCreateClient = () => {
    if (!newClientData.email || !newClientData.password || !newClientData.azienda) return showNotification('Email, password e azienda sono obbligatori.', 'error');
    if (users.some(u => u.email === newClientData.email)) return showNotification('Email già registrata.', 'error');
    const newClient = { id: Date.now(), ...newClientData, ruolo: 'cliente' };
    setUsers(prev => [...prev, newClient]);
    closeModal();
    setNewClientData({ email: '', password: '', telefono: '', azienda: '' });
    showNotification('Cliente creato!', 'success');
  };
  
  const handleCreateTicket = () => { /* ... la tua logica per creare un ticket ... */ };

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
          handlers={{ /* ... */ }}
        />
      </main>

      {/* AllModals ora gestisce solo le finestre definite al suo interno */}
      <AllModals
        modalState={modalState}
        closeModal={closeModal}
        handleCreateTicket={handleCreateTicket}
        // ... passa solo le altre props necessarie a AllModals
      />
      
      {/* Le nuove finestre vengono gestite separatamente qui */}
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
