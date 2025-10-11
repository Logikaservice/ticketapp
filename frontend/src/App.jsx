// src/App.jsx

import React, { useState, useEffect } from 'react';
import Notification from './components/AppNotification';
import LoginScreen from './components/LoginScreen';
import Header from './components/Header';
import TicketListContainer from './components/TicketListContainer';
import AllModals from './components/Modals/AllModals';
import { getInitialMaterial, getInitialTimeLog } from './utils/helpers';
import { formatReportDate } from './utils/formatters';
import ManageClientsModal from './components/ManageClientsModal';
import NewClientModal from './components/NewClientModal';

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

  const getUnreadCount = (ticket) => {
    if (!ticket.messaggi || ticket.messaggi.length === 0) return 0;
    const lastRead = currentUser.ruolo === 'cliente' ? ticket.last_read_by_client : ticket.last_read_by_tecnico;
    if (!lastRead) return ticket.messaggi.length;
    return ticket.messaggi.filter(m => new Date(m.data) > new Date(lastRead)).length;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!process.env.REACT_APP_API_URL || !currentUser) return;
      try {
        const [ticketsRes, usersRes] = await Promise.all([
          fetch(`${process.env.REACT_APP_API_URL}/api/tickets`),
          currentUser.ruolo === 'tecnico' ? fetch(`${process.env.REACT_APP_API_URL}/api/users`) : Promise.resolve({ ok: false })
        ]);

        if (!ticketsRes.ok) throw new Error("Errore nel caricare i ticket");
        const ticketsData = await ticketsRes.json();
        setTickets(ticketsData);

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData);
        }

        if (!hasShownUnreadNotification) {
          const unreadTicketsCount = ticketsData.filter(t => getUnreadCount(t) > 0).length;
          if (unreadTicketsCount > 0) {
            showNotification(`Hai nuovi messaggi in ${unreadTicketsCount} ticket!`, 'info');
          }
          setHasShownUnreadNotification(true);
        }
      } catch (error) {
        showNotification(error.message, "error");
      }
    };
    if (isLoggedIn) fetchData();
  }, [isLoggedIn, currentUser]);

  const closeModal = () => {
    setModalState({ type: null, data: null });
  };

  const resetNewTicketData = () => {
    const nome = currentUser?.ruolo === 'cliente' ? `${currentUser.nome} ${currentUser.cognome || ''}`.trim() : '';
    setNewTicketData({ titolo: '', descrizione: '', categoria: 'assistenza', priorita: 'media', nomerichiedente: nome });
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

  const openNewTicketModal = () => {
    resetNewTicketData();
    setModalState({ type: 'newTicket' });
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
    setSettingsData({ nome: currentUser.nome, email: currentUser.email, vecchiaPassword: '', nuovaPassword: '', confermaNuovaPassword: '' });
    setModalState({ type: 'settings' });
  };
  
  const handleUpdateClient = (id, updatedData) => {
    setUsers(users.map(u => u.id === id ? { ...u, ...updatedData } : u));
    showNotification('Cliente aggiornato con successo!', 'success');
  };

  const handleDeleteClient = (id) => {
    if (tickets.some(t => t.clienteid === id)) {
      return showNotification('Impossibile eliminare: il cliente ha ticket associati.', 'error');
    }
    setUsers(users.filter(u => u.id !== id));
    showNotification('Cliente eliminato con successo!', 'success');
  };

  const openManageClientsModal = () => {
    setModalState({ type: 'manageClients' });
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

  const handleUpdateTicket = () => {
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
    const clienteId = currentUser.ruolo === 'tecnico' ? parseInt(selectedClientForNewTicket) : currentUser.id;
    const ticketDaInviare = {
      ...newTicketData,
      clienteid: clienteId,
      nomerichiedente: newTicketData.nomerichiedente,
      stato: 'aperto'
    };
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketDaInviare)
      });
      if (!response.ok) throw new Error('Errore del server');
      const nuovoTicketSalvato = await response.json();
      setTickets(prev => [nuovoTicketSalvato, ...prev]);
      closeModal();
      showNotification('Ticket creato!', 'success');
      if (currentUser.ruolo === 'cliente') setSelectedTicket(nuovoTicketSalvato);
    } catch (error) {
      showNotification('Impossibile creare il ticket.', 'error');
    }
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
        {...{ currentUser, handleLogout, openNewTicketModal, openSettings }}
        openNewClientModal={() => setModalState({ type: 'newClient' })}
        openManageClientsModal={openManageClientsModal}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <TicketListContainer
          {...{ currentUser, tickets, users, selectedTicket, getUnreadCount }}
          handlers={{
            // Aggiungi qui gli altri handlers che servono a TicketListContainer
          }}
        />
      </main>

      <AllModals
        modalState={modalState}
        closeModal={closeModal}
        newTicketData={newTicketData}
        setNewTicketData={setNewTicketData}
        handleCreateTicket={handleCreateTicket} // Passa la funzione corretta
        isEditingTicket={isEditingTicket}
        currentUser={currentUser}
        clientiAttivi={users.filter(u => u.ruolo === 'cliente')}
        selectedClientForNewTicket={selectedClientForNewTicket}
        setSelectedClientForNewTicket={setSelectedClientForNewTicket}
        resetNewTicketData={resetNewTicketData}
        settingsData={settingsData}
        setSettingsData={setSettingsData}
        // ...altre props...
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
