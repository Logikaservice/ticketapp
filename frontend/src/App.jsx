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
  // GESTIONE SETTINGS
  // ====================================================================
  const handleUpdateSettings = () => { /* ... la tua logica ... */ };

  // ====================================================================
  // GESTIONE CLIENTI (con API) - ✅ IMPLEMENTATE
  // ====================================================================
  const handleCreateClient = async () => {
    // Validazione dati
    if (!newClientData.email || !newClientData.password) {
      return showNotification('Email e password sono obbligatori.', 'error');
    }
    if (!newClientData.azienda) {
      return showNotification('Il nome dell\'azienda è obbligatorio.', 'error');
    }
    
    // Prepara i dati del cliente
    const clienteDaCreare = {
      ...newClientData,
      ruolo: 'cliente',
      nome: newClientData.azienda
    };
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clienteDaCreare)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore nella creazione del cliente');
      }
      
      const nuovoCliente = await response.json();
      
      // Aggiorna la lista degli utenti
      setUsers(prev => [...prev, nuovoCliente]);
      
      // Reset form e chiudi modale
      setNewClientData({ email: '', password: '', telefono: '', azienda: '' });
      closeModal();
      
      showNotification('Cliente creato con successo!', 'success');
    } catch (error) {
      showNotification(error.message || 'Impossibile creare il cliente.', 'error');
    }
  };

  const handleUpdateClient = async (id, updatedData) => {
    if (!id) return showNotification('ID cliente non valido.', 'error');
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore nell\'aggiornamento del cliente');
      }
      
      const clienteAggiornato = await response.json();
      
      // Aggiorna la lista degli utenti
      setUsers(prev => prev.map(u => u.id === id ? clienteAggiornato : u));
      
      showNotification('Cliente aggiornato con successo!', 'success');
    } catch (error) {
      showNotification(error.message || 'Impossibile aggiornare il cliente.', 'error');
    }
  };

  const handleDeleteClient = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo cliente? Tutti i suoi ticket verranno eliminati!')) {
      return;
    }
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore nell\'eliminazione del cliente');
      }
      
      // Rimuovi il cliente dalla lista
      setUsers(prev => prev.filter(u => u.id !== id));
      
      // Rimuovi anche tutti i ticket del cliente
      setTickets(prev => prev.filter(t => t.clienteid !== id));
      
      showNotification('Cliente eliminato con successo!', 'success');
    } catch (error) {
      showNotification(error.message || 'Impossibile eliminare il cliente.', 'error');
    }
  };

  // ====================================================================
  // GESTIONE TICKET
  // ====================================================================
  const handleCreateTicket = async () => {
    if (isEditingTicket) {
      handleUpdateTicket();
      return;
    }
    if (!newTicketData.titolo || !newTicketData.descrizione) {
      return showNotification('Titolo e descrizione sono obbligatori.', 'error');
    }
    const clienteId = currentUser.ruolo === 'tecnico' ? parseInt(selectedClientForNewTicket) : currentUser.id;
    if (currentUser.ruolo === 'tecnico' && !clienteId) {
        return showNotification('Devi selezionare un cliente.', 'error');
    }
    const ticketDaInviare = {
      ...newTicketData,
      clienteid: clienteId,
      stato: 'aperto',
      nomerichiedente: newTicketData.nomerichiedente || (currentUser.ruolo === 'cliente' ? `${currentUser.nome} ${currentUser.cognome || ''}`.trim() : 'Tecnico')
    };
    try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ticketDaInviare)
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
  
  const handleUpdateTicket = async () => {
    console.log('🔧 handleUpdateTicket chiamata!');
    console.log('📝 ID ticket da modificare:', isEditingTicket);
    console.log('📋 Dati ticket:', newTicketData);
    console.log('👤 Cliente selezionato:', selectedClientForNewTicket);
    
    if (!newTicketData.titolo || !newTicketData.descrizione) {
      return showNotification('Titolo e descrizione sono obbligatori.', 'error');
    }
    
    const clienteId = currentUser.ruolo === 'tecnico' ? parseInt(selectedClientForNewTicket) : currentUser.id;
    if (currentUser.ruolo === 'tecnico' && !clienteId) {
      return showNotification('Devi selezionare un cliente.', 'error');
    }
    
    const ticketAggiornato = {
      titolo: newTicketData.titolo,
      descrizione: newTicketData.descrizione,
      categoria: newTicketData.categoria,
      priorita: newTicketData.priorita,
      nomerichiedente: newTicketData.nomerichiedente,
      clienteid: clienteId
    };
    
    console.log('📤 Invio al backend:', ticketAggiornato);
    console.log('🌐 URL:', `${process.env.REACT_APP_API_URL}/api/tickets/${isEditingTicket}`);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${isEditingTicket}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketAggiornato)
      });
      
      console.log('📥 Risposta backend status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Errore dal backend:', errorData);
        throw new Error(errorData.error || 'Errore nell\'aggiornamento del ticket');
      }
      
      const ticketSalvato = await response.json();
      console.log('✅ Ticket salvato dal backend:', ticketSalvato);
      
      // Aggiorna la lista dei ticket
      setTickets(prev => prev.map(t => t.id === isEditingTicket ? ticketSalvato : t));
      
      // Se il ticket modificato è quello selezionato, aggiorna anche selectedTicket
      if (selectedTicket?.id === isEditingTicket) {
        setSelectedTicket(ticketSalvato);
      }
      
      closeModal();
      showNotification('Ticket aggiornato con successo!', 'success');
    } catch (error) {
      console.error('💥 Errore catch:', error);
      showNotification(error.message || 'Impossibile aggiornare il ticket.', 'error');
    }
  };
  const handleConfirmUrgentCreation = async () => { /* ... la tua logica ... */ };
  
  const handleDeleteTicket = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo ticket?')) return;
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Errore durante l\'eliminazione');
      setTickets(prev => prev.filter(t => t.id !== id));
      if (selectedTicket?.id === id) setSelectedTicket(null);
      showNotification('Ticket eliminato con successo!', 'success');
    } catch(error) {
      showNotification(error.message, 'error');
    }
  };
  
  const handleSelectTicket = async (ticket) => {
    if (ticket && (!selectedTicket || selectedTicket.id !== ticket.id)) {
      try {
        await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${ticket.id}/mark-read`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ruolo: currentUser.ruolo })
        });
        setTickets(prev => prev.map(tk => {
          if (tk.id === ticket.id) {
            const updated = { ...tk };
            if (currentUser.ruolo === 'cliente') updated.last_read_by_client = new Date().toISOString();
            else updated.last_read_by_tecnico = new Date().toISOString();
            return updated;
          }
          return tk;
        }));
      } catch (error) {
        console.error('Errore nel marcare come letto:', error);
      }
    }
    setSelectedTicket(prev => (prev?.id === ticket.id ? null : ticket));
  };
  
  const handleSendMessage = async (id, msg, isReclamo = false) => {
    if (!msg.trim()) return;
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;
    const autore = currentUser.ruolo === 'cliente' ? ticket.nomerichiedente : 'Tecnico';
    const messageData = { autore, contenuto: msg, reclamo: isReclamo };
    try {
      const messageResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });
      if (!messageResponse.ok) throw new Error('Errore nel salvare il messaggio');
      const savedMessage = await messageResponse.json();
      let newStatus = ticket.stato;
      if (isReclamo || (currentUser.ruolo === 'tecnico' && ticket.stato === 'risolto')) {
        newStatus = 'in_lavorazione';
      }
      if (newStatus !== ticket.stato) {
        await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
      }
      setTickets(prevTickets => prevTickets.map(t => {
        if (t.id === id) {
          const updatedTicket = { ...t, messaggi: [...(t.messaggi || []), savedMessage], stato: newStatus };
          if (selectedTicket?.id === id) setSelectedTicket(updatedTicket);
          return updatedTicket;
        }
        return t;
      }));
      if (isReclamo) showNotification('Reclamo inviato! Ticket riaperto.', 'error');
    } catch (error) {
      showNotification('Errore nell\'invio del messaggio.', 'error');
    }
  };
  
  const handleChangeStatus = async (id, status) => {
    if (status === 'risolto' && currentUser.ruolo === 'tecnico') {
      const ticket = tickets.find(tk => tk.id === id);
      if (ticket) handleOpenTimeLogger(ticket);
      return;
    }
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Errore aggiornamento stato');
      const updatedTicket = await response.json();
      setTickets(prevTickets => prevTickets.map(t => (t.id === id ? updatedTicket : t)));
      showNotification('Stato del ticket aggiornato!', 'success');
      if (status === 'chiuso' || (status === 'risolto' && currentUser.ruolo === 'tecnico')) {
        setSelectedTicket(null);
      }
    } catch (error) {
      showNotification('Impossibile aggiornare lo stato.', 'error');
    }
  };
  
  const handleReopenInLavorazione = (id) => handleChangeStatus(id, 'in_lavorazione');
  const handleReopenAsRisolto = (id) => handleChangeStatus(id, 'risolto');
  const handleSetInviato = (id) => handleChangeStatus(id, 'inviato');
  const handleArchiveTicket = (id) => handleChangeStatus(id, 'chiuso');
  const handleInvoiceTicket = (id) => handleChangeStatus(id, 'fatturato');
  const handleGenerateSentReport = () => {};
  const handleGenerateInvoiceReport = () => {};
  const handleTimeLogChange = () => {};
  const handleAddTimeLog = () => {};
  const handleDuplicateTimeLog = () => {};
  const handleRemoveTimeLog = () => {};
  const handleMaterialChange = () => {};
  const handleAddMaterial = () => {};
  const handleRemoveMaterial = () => {};
  const handleConfirmTimeLogs = () => {};
  
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
