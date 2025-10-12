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
  const [settingsData, setSettingsData] = useState({});
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

  // Funzioni di notifica
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

  // Funzione per calcolare messaggi non letti
  const getUnreadCount = (ticket) => {
    if (!currentUser || !ticket.messaggi || ticket.messaggi.length === 0) return 0;
    const lastRead = currentUser.ruolo === 'cliente' ? ticket.last_read_by_client : ticket.last_read_by_tecnico;
    if (!lastRead) return ticket.messaggi.length;
    const lastReadDate = new Date(lastRead);
    return ticket.messaggi.filter(m => new Date(m.data) > lastReadDate).length;
  };

  // Funzione per caricare i dati iniziali
  useEffect(() => {
    const fetchData = async () => {
      if (!process.env.REACT_APP_API_URL || !currentUser) return;
      try {
        const ticketsResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets`);
        if (!ticketsResponse.ok) throw new Error("Errore nel caricare i ticket");
        const ticketsData = await ticketsResponse.json();
        setTickets(ticketsData);

        if (currentUser.ruolo === 'tecnico') {
          const usersResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/users`);
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

  // Funzioni per modali e reset
  const resetNewTicketData = () => {
    const nomeRichiedente = currentUser?.ruolo === 'cliente' ? `${currentUser.nome} ${currentUser.cognome || ''}`.trim() : '';
    setNewTicketData({ titolo: '', descrizione: '', categoria: 'assistenza', priorita: 'media', nomerichiedente: nomeRichiedente });
    setIsEditingTicket(null);
    setSelectedClientForNewTicket('');
  };
  const closeModal = () => {
    if (modalState.type === 'newTicket') resetNewTicketData();
    setModalState({ type: null, data: null });
  };

  // Funzioni di autenticazione
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
  
  // Funzioni per aprire modali
  const openNewTicketModal = () => { resetNewTicketData(); setModalState({ type: 'newTicket' }); };
  const openSettings = () => setModalState({ type: 'settings' });
  const openManageClientsModal = () => setModalState({ type: 'manageClients' });
  const handleOpenEditModal = (ticket) => { /* ... logica per aprire la modale di modifica ... */ };
  const handleOpenTimeLogger = (ticket) => { /* ... logica per aprire il time logger ... */ };

  // Funzioni CRUD per i clienti
  const handleCreateClient = async () => {
    if (!newClientData.email || !newClientData.password || !newClientData.azienda) return showNotification('Email, password e azienda sono obbligatori.', 'error');
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newClientData, ruolo: 'cliente' })
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Errore del server.');
      const savedClient = await response.json();
      setUsers(prev => [...prev, savedClient]);
      closeModal();
      setNewClientData({ email: '', password: '', telefono: '', azienda: '' });
      showNotification('Cliente creato con successo!', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };
  const handleUpdateClient = async (id, updatedData) => { /* ... logica API ... */ };
  const handleDeleteClient = async (id) => { /* ... logica API ... */ };

  // Funzioni CRUD per i ticket
  const handleCreateTicket = async () => {
    if (isEditingTicket) return; // Qui andrà la logica di modifica
    if (!newTicketData.titolo || !newTicketData.descrizione) return showNotification('Titolo e descrizione sono obbligatori.', 'error');
    const clienteId = currentUser.ruolo === 'tecnico' ? parseInt(selectedClientForNewTicket) : currentUser.id;
    if (currentUser.ruolo === 'tecnico' && !clienteId) return showNotification('Devi selezionare un cliente.', 'error');
    const ticketDaInviare = {
      ...newTicketData, clienteid: clienteId, stato: 'aperto',
      nomerichiedente: newTicketData.nomerichiedente || (currentUser.ruolo === 'cliente' ? `${currentUser.nome} ${currentUser.cognome || ''}`.trim() : 'Tecnico')
    };
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ticketDaInviare)
      });
      if (!response.ok) throw new Error('Errore del server.');
      const savedTicket = await response.json();
      setTickets(prev => [savedTicket, ...prev]);
      closeModal();
      showNotification('Ticket creato con successo!', 'success');
    } catch (error) {
      showNotification(error.message || 'Impossibile creare il ticket.', 'error');
    }
  };
  const handleSelectTicket = (ticket) => setSelectedTicket(prev => (prev?.id === ticket.id ? null : ticket));
  
  const handleChangeStatus = async (ticketId, newStatus) => {
    try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${ticketId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!response.ok) throw new Error("Errore nell'aggiornamento dello stato.");
        
        const updatedTicket = await response.json();
        setTickets(tickets.map(t => t.id === ticketId ? updatedTicket : t));
        showNotification("Stato del ticket aggiornato!", "success");
        setSelectedTicket(null);
    } catch (error) {
        showNotification(error.message, "error");
    }
  };

  // Altre funzioni
  const handleConfirmUrgentCreation = () => {};
  const handleUpdateSettings = () => {};
  const handleReopenInLavorazione = (id) => handleChangeStatus(id, 'in_lavorazione');
  const handleReopenAsRisolto = (id) => handleChangeStatus(id, 'risolto');
  const handleSetInviato = (id) => handleChangeStatus(id, 'inviato');
  const handleArchiveTicket = (id) => handleChangeStatus(id, 'chiuso');
  const handleInvoiceTicket = (id) => handleChangeStatus(id, 'fatturato');
  const handleDeleteTicket = async (id) => { /* ... logica API ... */ };
  const handleSendMessage = async (id, msg) => { /* ... logica API ... */ };
  const handleGenerateSentReport = () => {};
  const handleGenerateInvoiceReport = () => {};

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
          // --- ECCO LA CORREZIONE: PASSIAMO LA "CASSETTA DEGLI ATTREZZI" ---
          handlers={{
            handleSelectTicket,
            handleChangeStatus,
            handleOpenEditModal,
            handleOpenTimeLogger,
            handleReopenInLavorazione,
            handleReopenAsRisolto,
            handleSetInviato,
            handleArchiveTicket,
            handleInvoiceTicket,
            handleDeleteTicket,
            handleSendMessage,
            handleGenerateSentReport,
            handleGenerateInvoiceReport,
            showNotification
          }}
        />
      </main>

      <AllModals
        {...{ modalState, closeModal, handleUpdateSettings, handleConfirmUrgentCreation, settingsData, setSettingsData }}
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
