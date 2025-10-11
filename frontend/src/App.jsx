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
import NewTicketModal from './components/Modals/NewTicketModal'; // <-- Importa la nuova finestra

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
  const [settingsData, setSettingsData] = useState({ /* ... */ });
  const [newClientData, setNewClientData] = useState({ /* ... */ });
  const [isEditingTicket, setIsEditingTicket] = useState(null);
  const [selectedClientForNewTicket, setSelectedClientForNewTicket] = useState('');

  const handleCloseNotification = () => { /* ... */ };
  const showNotification = (message, type = 'success', duration = 5000) => { /* ... */ };
  
  // --- FUNZIONE CORRETTA PER CHIUDERE E PULIRE ---
  const closeModal = () => {
    // Se stiamo chiudendo la finestra del ticket, svuota i campi
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

  const handleLogin = async () => { /* ... */ };
  const handleLogout = () => { /* ... */ };
  const handleAutoFillLogin = (ruolo) => { /* ... */ };
  const openNewTicketModal = () => {
    resetNewTicketData(); // Resetta i dati anche all'apertura per sicurezza
    setModalState({ type: 'newTicket' });
  };
  const openSettings = () => setModalState({ type: 'settings' });
  const openManageClientsModal = () => setModalState({ type: 'manageClients' });
  const handleUpdateClient = (id, updatedData) => { /* ... */ };
  const handleDeleteClient = (id) => { /* ... */ };
  const handleCreateClient = async () => { /* ... */ };

  // --- FUNZIONE CORRETTA PER CREARE IL TICKET ---
  const handleCreateTicket = async () => {
    if (isEditingTicket) {
      // handleUpdateTicket(); // Logica di modifica da implementare se serve
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

        if (!response.ok) {
            throw new Error('Errore del server durante la creazione del ticket.');
        }

        const savedTicket = await response.json();
        setTickets(prev => [savedTicket, ...prev]);
        closeModal();
        showNotification('Ticket creato con successo!', 'success');

    } catch (error) {
        showNotification(error.message || 'Impossibile creare il ticket.', 'error');
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
        currentUser={currentUser}
        handleLogout={handleLogout}
        openNewTicketModal={openNewTicketModal}
        openNewClientModal={() => setModalState({ type: 'newClient' })}
        openSettings={openSettings}
        openManageClientsModal={openManageClientsModal}
      />
      <main>
        <TicketListContainer /* ... */ />
      </main>

      {/* AllModals ora non gestisce più NewTicketModal */}
      <AllModals modalState={modalState} closeModal={closeModal} /* ... */ />
      
      {/* Le nuove finestre vengono gestite separatamente */}
      {modalState.type === 'manageClients' && ( <ManageClientsModal /* ... */ /> )}
      {modalState.type === 'newClient' && ( <NewClientModal /* ... */ /> )}
      
      {/* --- AGGIUNTA LA NUOVA FINESTRA TICKET QUI --- */}
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
