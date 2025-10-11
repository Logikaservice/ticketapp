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
  const [settingsData, setSettingsData] = useState({});
  const [newClientData, setNewClientData] = useState({
    email: '', 
    password: '', 
    telefono: '', 
    azienda: '' 
  });
  const [isEditingTicket, setIsEditingTicket] = useState(null);
  const [selectedClientForNewTicket, setSelectedClientForNewTicket] = useState('');
  
  // ====================================================================
  // CARICA DATI DAL DATABASE DOPO IL LOGIN
  // ====================================================================
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      loadInitialData();
    }
  }, [isLoggedIn, currentUser]);

  const loadInitialData = async () => {
    try {
      console.log('📥 Caricamento dati dal database...');

      // Carica tutti gli utenti
      const usersResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/users`);
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData);
        console.log('✅ Utenti caricati:', usersData.length);
      } else {
        console.error('❌ Errore nel caricamento utenti');
      }

      // Carica tutti i ticket
      const ticketsResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets`);
      if (ticketsResponse.ok) {
        const ticketsData = await ticketsResponse.json();
        setTickets(ticketsData);
        console.log('✅ Ticket caricati:', ticketsData.length);
      } else {
        console.error('❌ Errore nel caricamento ticket');
      }
      
    } catch (error) {
      console.error('💥 Errore nel caricamento dei dati:', error);
      showNotification('Errore nel caricamento dei dati dal server.', 'error');
    }
  };
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

  const closeModal = () => {
    if (modalState.type === 'newTicket') {
      resetNewTicketData();
    }
    setModalState({ type: null, data: null });
  };

  const handleLogin = async () => {
    if (!loginData.email || !loginData.password) return showNotification('Inserisci email e password.', 'error');
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/login`, {
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
    setUsers([]);
    setTickets([]);
    showNotification('Disconnessione effettuata.', 'info');
  };

  const handleAutoFillLogin = (ruolo) => setLoginData(ruolo === 'cliente' ? { email: 'cliente@example.com', password: 'cliente123' } : { email: 'tecnico@example.com', password: 'tecnico123' });
  
  const openNewTicketModal = () => {
    resetNewTicketData();
    setModalState({ type: 'newTicket' });
  };

  const openSettings = () => setModalState({ type: 'settings' });
  const openManageClientsModal = () => setModalState({ type: 'manageClients' });

  // ====================================================================
  // CREA NUOVO CLIENTE
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

  // ====================================================================
  // ELIMINA CLIENTE
  // ====================================================================
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

      // Rimuovi il cliente dallo stato
      setUsers(prev => prev.filter(user => user.id !== id));
      showNotification('Cliente eliminato con successo!', 'success');

    } catch (error) {
      showNotification(error.message, 'error');
    }
  };
  // ====================================================================
  
  const handleUpdateClient = async (id, updatedData) => { 
    // TODO: Implementare aggiornamento cliente
    console.log('Aggiorna cliente:', id, updatedData);
  };
  
  const handleCreateTicket = async () => { 
    // TODO: Implementare creazione ticket
    console.log('Crea ticket');
  };
  
  const handleConfirmUrgentCreation = () => { 
    // TODO: Implementare conferma creazione urgente
    console.log('Conferma creazione urgente');
  };
  
  const handleUpdateSettings = () => { 
    // TODO: Implementare aggiornamento impostazioni
    console.log('Aggiorna impostazioni');
  };

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
          handlers={{}}
        />
      </main>

      <AllModals
        modalState={modalState}
        closeModal={closeModal}
        handleUpdateSettings={handleUpdateSettings}
        handleConfirmUrgentCreation={handleConfirmUrgentCreation}
        settingsData={settingsData}
        setSettingsData={setSettingsData}
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
