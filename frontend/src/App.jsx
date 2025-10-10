import React, { useState, useEffect } from 'react';
import Notification from './components/AppNotification';
import LoginScreen from './components/LoginScreen';
import Header from './components/Header';
import TicketListContainer from './components/TicketListContainer';
import AllModals from './components/Modals/AllModals';
import { getInitialMaterial, getInitialTimeLog } from './utils/helpers';
import { formatReportDate } from './utils/formatters';

export default function TicketApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
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

  useEffect(() => {
    const fetchData = async () => {
      if (!process.env.REACT_APP_API_URL || !currentUser) return;

      try {
        const ticketsResponse = await fetch(process.env.REACT_APP_API_URL + '/api/tickets');
        if (!ticketsResponse.ok) throw new Error("Errore nel caricare i ticket");
        const ticketsData = await ticketsResponse.json();
        
        // Se è un tecnico, marca come "nuovi" i ticket creati negli ultimi 5 minuti
        if (currentUser.ruolo === 'tecnico') {
          const now = new Date();
          const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
          
          const ticketsWithNewFlag = ticketsData.map(ticket => {
            const ticketDate = new Date(ticket.dataapertura);
            // Marca come nuovo se creato negli ultimi 5 minuti e non è stato ancora visto
            const isRecent = ticketDate > fiveMinutesAgo;
            return {
              ...ticket,
              isNew: isRecent && ticket.stato === 'aperto'
            };
          });
          
          setTickets(ticketsWithNewFlag);
        } else {
          setTickets(ticketsData);
        }

        if (currentUser.ruolo === 'tecnico') {
          const usersResponse = await fetch(process.env.REACT_APP_API_URL + '/api/users');
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            setUsers(usersData);
          }
        }
      } catch (error) {
        console.error("Errore nel caricare i dati:", error);
        showNotification(error.message, "error");
      }
    };

    if (isLoggedIn) {
      fetchData();
    }
  }, [isLoggedIn, currentUser]);

  const showNotification = (message, type) => {
    if (!type) type = 'success';
    setNotification({ show: true, message: message, type: type });
    setTimeout(() => setNotification(p => ({ ...p, show: false })), 4000);
  };

  const closeModal = () => {
    if (modalState.type === 'newTicket') {
      resetNewTicketData();
      setSelectedClientForNewTicket('');
      setIsEditingTicket(null);
    }
    setModalState({ type: null, data: null });
  };

  const resetNewTicketData = () => {
    if (!currentUser) {
      setNewTicketData({
        titolo: '',
        descrizione: '',
        categoria: 'assistenza',
        priorita: 'media',
        nomerichiedente: ''
      });
      return;
    }
    const nomeCognome = currentUser.ruolo === 'cliente' 
      ? (currentUser.nome + ' ' + (currentUser.cognome || '')).trim()
      : '';
    setNewTicketData({
      titolo: '',
      descrizione: '',
      categoria: 'assistenza',
      priorita: 'media',
      nomerichiedente: nomeCognome
    });
  };

  const handleLogin = async () => {
    if (!loginData.email || !loginData.password) {
      return showNotification('Inserisci email e password.', 'error');
    }

    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Credenziali non valide' }));
        throw new Error(errorData.error);
      }

      const user = await response.json();
      setCurrentUser(user);
      setIsLoggedIn(true);
      setLoginData({ email: '', password: '' });
      showNotification('Benvenuto ' + user.nome + '!', 'success');

    } catch (error) {
      console.error("Errore durante il login:", error);
      showNotification(error.message || 'Credenziali non valide o errore di rete.', 'error');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setSelectedTicket(null);
    setTickets([]);
    setUsers([]);
    closeModal();
    showNotification('Disconnessione effettuata.', 'info');
  };

  const handleAutoFillLogin = (ruolo) => {
    if (ruolo === 'cliente') {
      setLoginData({ email: 'cliente@example.com', password: 'cliente123' });
    } else if (ruolo === 'tecnico') {
      setLoginData({ email: 'tecnico@example.com', password: 'tecnico123' });
    }
  };

  const openNewTicketModal = () => {
    if (!currentUser) {
      showNotification('Errore: utente non loggato', 'error');
      return;
    }
    const clienti = users.filter(u => u.ruolo === 'cliente');
    if (currentUser.ruolo === 'tecnico' && clienti.length > 0) {
      setSelectedClientForNewTicket(clienti[0].id.toString());
    } else {
      setSelectedClientForNewTicket('');
    }
    resetNewTicketData();
    setModalState({ type: 'newTicket', data: null });
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
    setSettingsData({
      nome: currentUser.nome,
      email: currentUser.email,
      vecchiaPassword: '',
      nuovaPassword: '',
      confermaNuovaPassword: ''
    });
    setModalState({ type: 'settings', data: null });
  };

  const handleOpenTimeLogger = (t) => {
    setSelectedTicket(t);
    const logs = Array.isArray(t.timeLogs) ? t.timeLogs : [];
    const initialLogs = logs.length > 0
      ? logs.map(lg => ({
          ...lg,
          id: Date.now() + Math.random(),
          materials: Array.isArray(lg.materials)
            ? lg.materials.map(m => ({ ...m, id: Date.now() + Math.random() }))
            : [getInitialMaterial()]
        }))
      : [getInitialTimeLog()];
    setTimeLogs(initialLogs);
    setModalState({ type: 'timeLogger', data: t });
  };

  const handleUpdateSettings = () => {
    if (!settingsData.nome || !settingsData.email) {
      showNotification('Nome ed email obbligatori.', 'error');
      return;
    }
    if (settingsData.nuovaPassword) {
      if (settingsData.nuovaPassword !== settingsData.confermaNuovaPassword) {
        showNotification('Le password non coincidono.', 'error');
        return;
      }
      if (currentUser.password !== settingsData.vecchiaPassword) {
        showNotification('Vecchia password errata.', 'error');
        return;
      }
    }
    const updatedUsers = users.map(us =>
      us.id === currentUser.id
        ? {
            ...us,
            nome: settingsData.nome,
            email: settingsData.email,
            password: settingsData.nuovaPassword || us.password
          }
        : us
    );
    setUsers(updatedUsers);
    setCurrentUser(updatedUsers.find(us => us.id === currentUser.id));
    closeModal();
    showNotification('Impostazioni aggiornate!', 'success');
  };

  const handleCreateClient = () => {
    if (!newClientData.email || !newClientData.password || !newClientData.azienda) {
      showNotification('Email, password e azienda sono obbligatori.', 'error');
      return;
    }
    if (users.some(u => u.email === newClientData.email)) {
      showNotification('Email già registrata.', 'error');
      return;
    }
    const newClient = {
      id: users.length + 1,
      ...newClientData,
      ruolo: 'cliente',
      nome: 'Non Specificato',
      cognome: ''
    };
    setUsers(prev => [...prev, newClient]);
    closeModal();
    setNewClientData({ email: '', password: '', telefono: '', azienda: '' });
    showNotification('Cliente creato!', 'success');
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
    if (!newTicketData.titolo || !newTicketData.descrizione || !newTicketData.nomerichiedente) {
      showNotification('Campi obbligatori mancanti.', 'error');
      closeModal();
      return;
    }

    let clienteId = currentUser.ruolo === 'tecnico' ? parseInt(selectedClientForNewTicket) : currentUser.id;

    const ticketDaInviare = {
      ...newTicketData,
      clienteid: clienteId,
      nomerichiedente: newTicketData.nomerichiedente,
      stato: 'aperto'
    };

    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketDaInviare)
      });

      if (!response.ok) {
        throw new Error('La risposta del server non è stata positiva');
      }

      const nuovoTicketSalvato = await response.json();
      
      const ticketConFlag = {
        ...nuovoTicketSalvato,
        isNew: true
      };
      
      setTickets(prevTickets => [ticketConFlag, ...prevTickets]);

      closeModal();
      showNotification('Ticket creato con successo!', 'success');
      if (currentUser.ruolo === 'cliente') {
        setSelectedTicket(ticketConFlag);
      }

    } catch (error) {
      console.error("Errore nella creazione del ticket:", error);
      showNotification('Impossibile creare il ticket.', 'error');
    }
  };

  const handleUpdateTicket = () => {
    if (!newTicketData.titolo || !newTicketData.descrizione || !newTicketData.nomerichiedente) {
      showNotification('Compila i campi obbligatori.', 'error');
      return;
    }
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

  const handleDeleteTicket = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo ticket?')) {
      return;
    }

    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/tickets/' + id, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Errore nell\'eliminazione del ticket');
      }

      setTickets(prevTickets => prevTickets.filter(t => t.id !== id));
      
      if (selectedTicket && selectedTicket.id === id) {
        setSelectedTicket(null);
      }

      showNotification('Ticket eliminato con successo!', 'success');

    } catch (error) {
      console.error('Errore nell\'eliminazione del ticket:', error);
      showNotification('Impossibile eliminare il ticket. Riprova.', 'error');
    }
  };

  const handleSendMessage = async (id, msg, isReclamo) => {
    if (!isReclamo) isReclamo = false;
    if (!msg.trim()) return;

    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    const autore = currentUser.ruolo === 'cliente' ? ticket.nomerichiedente : 'Tecnico';
    
    const messageData = {
      autore: autore,
      contenuto: msg,
      reclamo: isReclamo
    };

    try {
      // SALVA IL MESSAGGIO NEL DATABASE
      const messageResponse = await fetch(process.env.REACT_APP_API_URL + '/api/tickets/' + id + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });

      if (!messageResponse.ok) {
        throw new Error('Errore nel salvare il messaggio');
      }

      const savedMessage = await messageResponse.json();

      // Determina il nuovo stato
      let newStatus = ticket.stato;
      if (isReclamo) {
        newStatus = 'in_lavorazione';
      } else if (currentUser.ruolo === 'tecnico' && ticket.stato === 'risolto') {
        newStatus = 'in_lavorazione';
      }

      // Se lo stato cambia, salvalo nel database
      if (newStatus !== ticket.stato) {
        const statusResponse = await fetch(process.env.REACT_APP_API_URL + '/api/tickets/' + id + '/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });

        if (!statusResponse.ok) {
          throw new Error('Errore nel salvare lo stato');
        }
      }

      // Aggiorna il frontend
      setTickets(prevTickets => prevTickets.map(t => {
        if (t.id === id) {
          const updatedTicket = {
            ...t,
            messaggi: [...(t.messaggi || []), savedMessage],
            stato: newStatus
          };

          if (selectedTicket && selectedTicket.id === id) {
            setSelectedTicket(updatedTicket);
          }

          return updatedTicket;
        }
        return t;
      }));

      if (isReclamo) {
        showNotification('Reclamo inviato! Ticket riaperto.', 'error');
      }

    } catch (error) {
      console.error('Errore nell\'invio del messaggio:', error);
      showNotification('Errore nell\'invio del messaggio.', 'error');
    }
  };

  const handleChangeStatus = async (id, status) => {
    if (status === 'risolto' && currentUser.ruolo === 'tecnico') {
      const ticket = tickets.find(tk => tk.id === id);
      if (ticket) {
        handleOpenTimeLogger(ticket);
      }
      return;
    }

    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/tickets/' + id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status })
      });

      if (!response.ok) {
        throw new Error('Errore aggiornamento stato');
      }

      const updatedTicket = await response.json();

      setTickets(prevTickets =>
        prevTickets.map(t => (t.id === id ? updatedTicket : t))
      );

      showNotification('Stato del ticket aggiornato!', 'success');

      if (status === 'chiuso' || (status === 'risolto' && currentUser.ruolo === 'tecnico')) {
        setSelectedTicket(null);
      }

    } catch (error) {
      console.error('Errore handleChangeStatus:', error);
      showNotification('Impossibile aggiornare lo stato.', 'error');
    }
  };

  const handleTimeLogChange = (id, field, value) => {
    setTimeLogs(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const handleAddTimeLog = () => {
    setTimeLogs(prev => [...prev, getInitialTimeLog()]);
  };

  const handleDuplicateTimeLog = (log) => {
    setTimeLogs(prev => [...prev, { ...log, id: Date.now() }]);
  };

  const handleRemoveTimeLog = (id) => {
    setTimeLogs(prev => prev.filter(l => l.id !== id));
  };

  const handleMaterialChange = (logId, matId, field, value) => {
    setTimeLogs(prevLogs =>
      prevLogs.map(l =>
        l.id === logId
          ? {
              ...l,
              materials: l.materials.map(m =>
                m.id === matId
                  ? {
                      ...m,
                      [field]: ['quantita', 'costo'].includes(field) ? parseFloat(value) || 0 : value
                    }
                  : m
              )
            }
          : l
      )
    );
  };

  const handleAddMaterial = (logId) => {
    setTimeLogs(prevLogs =>
      prevLogs.map(l =>
        l.id === logId ? { ...l, materials: [...(l.materials || []), getInitialMaterial()] } : l
      )
    );
  };

  const handleRemoveMaterial = (logId, matId) => {
    setTimeLogs(prevLogs =>
      prevLogs.map(l =>
        l.id === logId ? { ...l, materials: l.materials.filter(m => m.id !== matId) } : l
      )
    );
  };

  const handleConfirmTimeLogs = async () => {
    if (!timeLogs.length) {
      showNotification('Registra almeno un intervento.', 'error');
      return;
    }

    const validLogs = timeLogs
      .map(l => {
        if (l.data && l.oraInizio && l.oraFine) {
          const cleanLog = { ...l };
          delete cleanLog.id;
          const materials = cleanLog.materials
            ? cleanLog.materials
                .map(mat => {
                  const cleanMat = { ...mat };
                  delete cleanMat.id;
                  return cleanMat;
                })
                .filter(mat => mat.nome && mat.quantita > 0)
            : [];
          return { ...cleanLog, materials: materials };
        }
        return null;
      })
      .filter(Boolean);

    if (!validLogs.length) {
      showNotification('Nessun intervento valido.', 'error');
      return;
    }

    try {
      const newStatus = selectedTicket.stato === 'in_lavorazione' ? 'risolto' : selectedTicket.stato;
      
      const response = await fetch(process.env.REACT_APP_API_URL + '/api/tickets/' + selectedTicket.id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Errore nel salvare lo stato');
      }

      setTickets(prev =>
        prev.map(t =>
          t.id === selectedTicket.id
            ? {
                ...t,
                stato: newStatus,
                timeLogs: validLogs
              }
            : t
        )
      );

      showNotification('Interventi registrati per ' + selectedTicket.numero + '.', 'success');
      closeModal();
      setSelectedTicket(null);

    } catch (error) {
      console.error('Errore nel salvare i timeLogs:', error);
      showNotification('Errore nel salvare lo stato del ticket.', 'error');
    }
  };

  const handleSetInviato = (id) => {
    handleChangeStatus(id, 'inviato');
  };

  const handleReopenInLavorazione = (id) => {
    handleChangeStatus(id, 'in_lavorazione');
  };

  const handleReopenAsRisolto = (id) => {
    handleChangeStatus(id, 'risolto');
  };

  const handleArchiveTicket = (id) => {
    handleChangeStatus(id, 'chiuso');
  };

  const handleInvoiceTicket = (id) => {
    handleChangeStatus(id, 'fatturato');
  };

  const handleSelectTicket = (t) => {
    if (t.isNew && currentUser.ruolo === 'tecnico') {
      setTickets(prev => prev.map(tk => (tk.id === t.id ? { ...tk, isNew: false } : tk)));
    }
    setSelectedTicket(selectedTicket && selectedTicket.id === t.id ? null : t);
  };

  const handleGenerateSentReport = (filteredTickets) => {
    if (!filteredTickets.length) {
      showNotification('Nessun ticket da includere.', 'info');
      return;
    }

    const grouped = filteredTickets.reduce((acc, t) => {
      if (!acc[t.clienteid]) acc[t.clienteid] = [];
      acc[t.clienteid].push(t);
      return acc;
    }, {});

    let report = Object.keys(grouped)
      .map(cId => {
        const ticketsForClient = grouped[cId];
        const cliente = users.find(u => u.id === parseInt(cId));
        let clientReport = 'Report per ' + (cliente ? cliente.azienda : 'Sconosciuto') + '\n---\n';

        clientReport += ticketsForClient
          .map(t => {
            let logsStr = t.timeLogs && t.timeLogs.length
              ? t.timeLogs.map(l => ' - ' + formatReportDate(l.data) + ' (' + l.oraInizio + '-' + l.oraFine + '): ' + (l.descrizione || 'N/D')).join('\n')
              : 'Nessun log.';

            let matsStr = 'Nessun materiale.';
            if (t.timeLogs) {
              const mats = t.timeLogs.flatMap((l, i) =>
                l.materials && l.materials.filter(mt => mt.nome).map(mt => ' - [Log ' + (i + 1) + '] ' + mt.nome + '(x' + mt.quantita + ')')
              );
              if (mats && mats.length) matsStr = mats.join('\n');
            }

            return t.numero + '-' + t.titolo + '\nLog:\n' + logsStr + '\nMateriali:\n' + matsStr;
          })
          .join('\n---\n');

        return clientReport;
      })
      .join('\n\n\n');

    setModalState({
      type: 'sentReport',
      data: {
        title: 'Report Interventi Inviati',
        content: report.trim(),
        color: 'text-gray-700'
      }
    });
  };

  const handleGenerateInvoiceReport = (filteredTickets) => {
    if (!filteredTickets.length) {
      showNotification('Nessun ticket da includere.', 'info');
      return;
    }

    let reportBody = filteredTickets
      .map(t => {
        const cliente = users.find(u => u.id === t.clienteid);
        let logsStr = t.timeLogs && t.timeLogs.length
          ? t.timeLogs.map(l => ' - ' + l.data + ' (' + l.oraInizio + '-' + l.oraFine + '): ' + l.descrizione).join('\n')
          : 'Nessun log.';

        let matsStr = 'Nessun materiale.';
        if (t.timeLogs) {
          const mats = t.timeLogs.flatMap((l, i) =>
            l.materials && l.materials.map(mt => ' - [Log ' + (i + 1) + '] ' + mt.nome + '(x' + mt.quantita + ')')
          );
          if (mats && mats.length) matsStr = mats.join('\n');
        }

        return 'TICKET:' + t.numero + '\nCLIENTE:' + (cliente ? cliente.azienda : 'Sconosciuto') + '\nCHIUSURA:' + (t.datachiusura || '') + '\nTITOLO:' + t.titolo + '\n\nLOG:\n' + logsStr + '\n\nMATERIALI:\n' + matsStr;
      })
      .join('\n---\n');

    setModalState({
      type: 'invoiceReport',
      data: {
        title: 'Lista Interventi Fatturati',
        content: 'Report Fatturati\n---\n' + reportBody.trim(),
        color: 'text-indigo-700'
      }
    });
  };

  if (!isLoggedIn) {
    return (
      <>
        <Notification notification={notification} setNotification={setNotification} />
        <LoginScreen
          loginData={loginData}
          setLoginData={setLoginData}
          handleLogin={handleLogin}
          handleAutoFillLogin={handleAutoFillLogin}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Notification notification={notification} setNotification={setNotification} />
      <Header
        currentUser={currentUser}
        handleLogout={handleLogout}
        openNewTicketModal={openNewTicketModal}
        openNewClientModal={() => setModalState({ type: 'newClient' })}
        openSettings={openSettings}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <TicketListContainer
          currentUser={currentUser}
          tickets={tickets}
          users={users}
          selectedTicket={selectedTicket}
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
        newTicketData={newTicketData}
        setNewTicketData={setNewTicketData}
        handleCreateTicket={handleCreateTicket}
        isEditingTicket={isEditingTicket}
        currentUser={currentUser}
        clientiAttivi={users.filter(u => u.ruolo === 'cliente')}
        selectedClientForNewTicket={selectedClientForNewTicket}
        setSelectedClientForNewTicket={setSelectedClientForNewTicket}
        resetNewTicketData={resetNewTicketData}
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
        settingsData={settingsData}
        setSettingsData={setSettingsData}
        handleUpdateSettings={handleUpdateSettings}
        newClientData={newClientData}
        setNewClientData={setNewClientData}
        handleCreateClient={handleCreateClient}
        handleConfirmUrgentCreation={handleConfirmUrgentCreation}
        showNotification={showNotification}
      />
    </div>
  );
}
