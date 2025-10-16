// src/App.jsx

import React, { useState, useEffect } from 'react';
import Notification from './components/AppNotification';
import LoginScreen from './components/LoginScreen';
import Header from './components/Header';
import TicketListContainer from './components/TicketListContainer';
import AllModals from './components/Modals/AllModals';
import { getInitialMaterial, getInitialTimeLog } from './utils/helpers';
import { formatDate } from './utils/formatters';
import ManageClientsModal from './components/Modals/ManageClientsModal';
import NewClientModal from './components/Modals/NewClientModal';
import NewTicketModal from './components/Modals/NewTicketModal';
import FornitureModal from './components/Modals/FornitureModal';
import { useAuth } from './hooks/useAuth';
import { useClients } from './hooks/useClients';
import { useTickets } from './hooks/useTickets';

export default function TicketApp() {
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  
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
    nome: '',
    cognome: '',
    email: '', 
    password: '', 
    telefono: '', 
    azienda: '' 
  });
  const [timeLogs, setTimeLogs] = useState([]);
  const [isEditingTicket, setIsEditingTicket] = useState(null);
  const [selectedClientForNewTicket, setSelectedClientForNewTicket] = useState('');
  const [hasShownUnreadNotification, setHasShownUnreadNotification] = useState(false);
  const [fornitureModalTicket, setFornitureModalTicket] = useState(null);

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
  // HOOKS PERSONALIZZATI
  // ====================================================================
  const {
    isLoggedIn,
    currentUser,
    loginData,
    setLoginData,
    handleLogin,
    handleLogout,
    handleAutoFillLogin
  } = useAuth(showNotification);

  const {
    handleCreateClient,
    handleUpdateClient,
    handleDeleteClient
  } = useClients(showNotification, setUsers, setTickets);

  const closeModal = () => {
    if (modalState.type === 'newTicket') {
      resetNewTicketData();
    }
    setModalState({ type: null, data: null });
  };

  const {
    handleCreateTicket: createTicket,
    handleUpdateTicket: updateTicket,
    handleDeleteTicket,
    handleSelectTicket,
    handleSendMessage,
    handleChangeStatus: changeStatus,
    handleConfirmTimeLogs
  } = useTickets(
    showNotification,
    setTickets,
    selectedTicket,
    setSelectedTicket,
    currentUser,
    tickets,
    closeModal
  );

  // ====================================================================
  // PERSISTENZA STATO TICKET CHIUSI AL RELOAD
  // ====================================================================
  useEffect(() => {
    if (isLoggedIn) {
      setSelectedTicket(null);
      localStorage.setItem('openTicketId', 'null');
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (selectedTicket?.id) {
      localStorage.setItem('openTicketId', selectedTicket.id);
    } else {
      localStorage.setItem('openTicketId', 'null');
    }
  }, [selectedTicket]);

  // ====================================================================
  // CALCOLA MESSAGGI NON LETTI
  // ====================================================================
  const getUnreadCount = (ticket) => {
    if (!currentUser || !ticket.messaggi || ticket.messaggi.length === 0) return 0;
    
    const lastRead = currentUser.ruolo === 'cliente' 
      ? ticket.last_read_by_client 
      : ticket.last_read_by_tecnico;
    
    if (!lastRead) {
      if (currentUser.ruolo === 'cliente') {
        return ticket.messaggi.filter(m => m.autore === 'Tecnico').length;
      } else {
        return ticket.messaggi.filter(m => m.autore !== 'Tecnico').length;
      }
    }
    
    const lastReadDate = new Date(lastRead);
    
    if (currentUser.ruolo === 'cliente') {
      return ticket.messaggi.filter(m => 
        new Date(m.data) > lastReadDate && m.autore === 'Tecnico'
      ).length;
    } else {
      return ticket.messaggi.filter(m => 
        new Date(m.data) > lastReadDate && m.autore !== 'Tecnico'
      ).length;
    }
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
        
        // Carica il conteggio forniture per ogni ticket
        const ticketsWithForniture = await Promise.all(
          ticketsData.map(async (ticket) => {
            try {
              const fornitureResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${ticket.id}/forniture`);
              if (fornitureResponse.ok) {
                const forniture = await fornitureResponse.json();
                return { ...ticket, fornitureCount: forniture.length };
              }
            } catch (err) {
              console.error(`Errore nel caricare forniture per ticket ${ticket.id}:`, err);
            }
            return { ...ticket, fornitureCount: 0 };
          })
        );
        
        setTickets(ticketsWithForniture);

        if (currentUser.ruolo === 'tecnico') {
          const usersResponse = await fetch(process.env.REACT_APP_API_URL + '/api/users');
          if (usersResponse.ok) setUsers(await usersResponse.json());
        }
        
        if (!hasShownUnreadNotification) {
            const unreadTickets = ticketsWithForniture.filter(t => getUnreadCount(t) > 0);
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
    const logs = Array.isArray(ticket.timelogs) ? ticket.timelogs : [];
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
  
  const handleOpenForniture = (ticket) => {
    setFornitureModalTicket(ticket);
  };
  
  const handleViewTimeLog = (ticket) => {
    console.log('👁️ handleViewTimeLog chiamato');
    console.log('👁️ Ticket:', ticket);
    console.log('👁️ Ticket.timelogs:', ticket.timelogs);
    
    setSelectedTicket(ticket);
    const logs = Array.isArray(ticket.timelogs) ? ticket.timelogs : [];
    console.log('👁️ Logs estratti:', logs);
    
    const initialLogs = logs.length > 0 ? logs.map(lg => ({ 
      ...lg, 
      id: Date.now() + Math.random(), 
      materials: Array.isArray(lg.materials) ? lg.materials.map(m => ({ ...m, id: Date.now() + Math.random() })) : [getInitialMaterial()] 
    })) : [];
    
    console.log('👁️ InitialLogs preparati:', initialLogs);
    setTimeLogs(initialLogs);
    setModalState({ type: 'viewTimeLogger', data: ticket });
  };

  const handleSaveTimeLogs = async () => {
    if (!selectedTicket) return;
    
    try {
      const logsToSave = timeLogs.map(log => ({
        modalita: log.modalita,
        data: log.data,
        oraInizio: log.oraInizio,
        oraFine: log.oraFine,
        descrizione: log.descrizione,
        oreIntervento: parseFloat(log.oreIntervento) || 0,
        costoUnitario: parseFloat(log.costoUnitario) || 0,
        sconto: parseFloat(log.sconto) || 0,
        materials: log.materials.map(m => ({
          nome: m.nome,
          quantita: parseInt(m.quantita) || 1,
          costo: parseFloat(m.costo) || 0
        }))
      }));

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${selectedTicket.id}/timelogs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeLogs: logsToSave })
      });

      if (!response.ok) throw new Error('Errore nel salvare le modifiche');

      // Ricarica il ticket aggiornato
      const ticketResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets`);
      if (ticketResponse.ok) {
        const allTickets = await ticketResponse.json();
        const updatedTicket = allTickets.find(t => t.id === selectedTicket.id);
        
        if (updatedTicket) {
          setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
          setSelectedTicket(updatedTicket);
          
          // Aggiorna i timeLogs nel modal
          const updatedLogs = Array.isArray(updatedTicket.timelogs) ? updatedTicket.timelogs : [];
          const refreshedLogs = updatedLogs.length > 0 ? updatedLogs.map(lg => ({ 
            ...lg, 
            id: Date.now() + Math.random(), 
            materials: Array.isArray(lg.materials) ? lg.materials.map(m => ({ ...m, id: Date.now() + Math.random() })) : [getInitialMaterial()] 
          })) : [];
          setTimeLogs(refreshedLogs);
        }
      }
      
      showNotification('Modifiche salvate con successo!', 'success');
    } catch (error) {
      showNotification(error.message || 'Errore nel salvare le modifiche.', 'error');
    }
  };
  
  const handleFornitureCountChange = (ticketId, newCount) => {
    setTickets(prev => prev.map(t => 
      t.id === ticketId ? { ...t, fornitureCount: newCount } : t
    ));
  };

  // ====================================================================
  // GENERAZIONE REPORT
  // ====================================================================
  const handleGenerateSentReport = () => {
    const sentTickets = tickets.filter(t => t.stato === 'inviato');
    
    if (sentTickets.length === 0) {
      showNotification('Nessun ticket inviato da mostrare.', 'info');
      return;
    }

    let reportContent = `REPORT TICKET INVIATI\n`;
    reportContent += `Data generazione: ${new Date().toLocaleDateString('it-IT')}\n`;
    reportContent += `Totale ticket: ${sentTickets.length}\n`;
    reportContent += `\n${'='.repeat(80)}\n\n`;

    sentTickets.forEach((ticket, index) => {
      const cliente = users.find(u => u.id === ticket.clienteid);
      reportContent += `${index + 1}. TICKET ${ticket.numero}\n`;
      reportContent += `   Cliente: ${cliente ? cliente.azienda : 'N/A'}\n`;
      reportContent += `   Titolo: ${ticket.titolo}\n`;
      reportContent += `   Richiedente: ${ticket.nomerichiedente}\n`;
      reportContent += `   Data apertura: ${formatDate(ticket.dataapertura)}\n`;
      reportContent += `   Data chiusura: ${ticket.datachiusura ? formatDate(ticket.datachiusura) : 'N/A'}\n`;
      
      if (ticket.timelogs && ticket.timelogs.length > 0) {
        reportContent += `\n   INTERVENTI:\n`;
        let totaleCosto = 0;
        
        ticket.timelogs.forEach((log, logIndex) => {
          const costoManodopera = (parseFloat(log.costoUnitario) || 0) * (1 - (parseFloat(log.sconto) || 0) / 100) * (parseFloat(log.oreIntervento) || 0);
          const costoMateriali = (log.materials || []).reduce((sum, m) => sum + (parseFloat(m.costo) || 0) * (parseInt(m.quantita) || 1), 0);
          const totaleIntervento = costoManodopera + costoMateriali;
          totaleCosto += totaleIntervento;
          
          reportContent += `   ${logIndex + 1}. ${log.modalita} - ${log.data}\n`;
          reportContent += `      Ore: ${log.oreIntervento}h | Costo/h: €${log.costoUnitario} | Sconto: ${log.sconto}%\n`;
          reportContent += `      Descrizione: ${log.descrizione || 'N/A'}\n`;
          
          if (log.materials && log.materials.length > 0) {
            reportContent += `      Materiali:\n`;
            log.materials.forEach(m => {
              reportContent += `        - ${m.nome} (${m.quantita}x) €${m.costo.toFixed(2)}\n`;
            });
          }
          
          reportContent += `      Totale intervento: €${totaleIntervento.toFixed(2)}\n`;
        });
        
        reportContent += `\n   TOTALE TICKET: €${totaleCosto.toFixed(2)}\n`;
      } else {
        reportContent += `   Nessun intervento registrato\n`;
      }
      
      reportContent += `\n${'-'.repeat(80)}\n\n`;
    });

    const totaleCostoGenerale = sentTickets.reduce((sum, ticket) => {
      if (!ticket.timelogs) return sum;
      return sum + ticket.timelogs.reduce((ticketSum, log) => {
        const costoManodopera = (parseFloat(log.costoUnitario) || 0) * (1 - (parseFloat(log.sconto) || 0) / 100) * (parseFloat(log.oreIntervento) || 0);
        const costoMateriali = (log.materials || []).reduce((matSum, m) => matSum + (parseFloat(m.costo) || 0) * (parseInt(m.quantita) || 1), 0);
        return ticketSum + costoManodopera + costoMateriali;
      }, 0);
    }, 0);

    reportContent += `\nTOTALE GENERALE: €${totaleCostoGenerale.toFixed(2)}\n`;

    setModalState({
      type: 'sentReport',
      data: {
        title: 'Report Ticket Inviati',
        content: reportContent,
        color: 'text-gray-700'
      }
    });
  };

  const handleGenerateInvoiceReport = () => {
    const invoicedTickets = tickets.filter(t => t.stato === 'fatturato');
    
    if (invoicedTickets.length === 0) {
      showNotification('Nessun ticket fatturato da mostrare.', 'info');
      return;
    }

    let reportContent = `LISTA FATTURE\n`;
    reportContent += `Data generazione: ${new Date().toLocaleDateString('it-IT')}\n`;
    reportContent += `Totale fatture: ${invoicedTickets.length}\n`;
    reportContent += `\n${'='.repeat(80)}\n\n`;

    invoicedTickets.forEach((ticket, index) => {
      const cliente = users.find(u => u.id === ticket.clienteid);
      let totaleCosto = 0;
      
      if (ticket.timelogs && ticket.timelogs.length > 0) {
        totaleCosto = ticket.timelogs.reduce((sum, log) => {
          const costoManodopera = (parseFloat(log.costoUnitario) || 0) * (1 - (parseFloat(log.sconto) || 0) / 100) * (parseFloat(log.oreIntervento) || 0);
          const costoMateriali = (log.materials || []).reduce((matSum, m) => matSum + (parseFloat(m.costo) || 0) * (parseInt(m.quantita) || 1), 0);
          return sum + costoManodopera + costoMateriali;
        }, 0);
      }

      reportContent += `${index + 1}. FATTURA ${ticket.numero}\n`;
      reportContent += `   Cliente: ${cliente ? cliente.azienda : 'N/A'}\n`;
      reportContent += `   Titolo: ${ticket.titolo}\n`;
      reportContent += `   Data: ${ticket.datachiusura ? formatDate(ticket.datachiusura) : formatDate(ticket.dataapertura)}\n`;
      reportContent += `   Importo: €${totaleCosto.toFixed(2)}\n`;
      reportContent += `\n${'-'.repeat(80)}\n\n`;
    });

    const totaleGenerale = invoicedTickets.reduce((sum, ticket) => {
      if (!ticket.timelogs) return sum;
      return sum + ticket.timelogs.reduce((ticketSum, log) => {
        const costoManodopera = (parseFloat(log.costoUnitario) || 0) * (1 - (parseFloat(log.sconto) || 0) / 100) * (parseFloat(log.oreIntervento) || 0);
        const costoMateriali = (log.materials || []).reduce((matSum, m) => matSum + (parseFloat(m.costo) || 0) * (parseInt(m.quantita) || 1), 0);
        return ticketSum + costoManodopera + costoMateriali;
      }, 0);
    }, 0);

    reportContent += `\nTOTALE FATTURE: €${totaleGenerale.toFixed(2)}\n`;

    setModalState({
      type: 'invoiceReport',
      data: {
        title: 'Lista Fatture',
        content: reportContent,
        color: 'text-indigo-700'
      }
    });
  };

  // ====================================================================
  // WRAPPER FUNZIONI
  // ====================================================================
  const handleUpdateSettings = () => { /* ... la tua logica ... */ };
  const handleConfirmUrgentCreation = async () => { /* ... la tua logica ... */ };

  const wrappedHandleCreateTicket = () => {
    createTicket(newTicketData, isEditingTicket, wrappedHandleUpdateTicket, selectedClientForNewTicket);
  };

  const wrappedHandleUpdateTicket = () => {
    updateTicket(newTicketData, isEditingTicket, selectedClientForNewTicket);
  };

  const wrappedHandleCreateClient = () => {
    handleCreateClient(newClientData, () => {
      setNewClientData({ nome: '', cognome: '', email: '', password: '', telefono: '', azienda: '' });
      closeModal();
    });
  };

  const handleChangeStatus = (id, status) => {
    changeStatus(id, status, handleOpenTimeLogger);
  };

  const handleReopenInLavorazione = (id) => handleChangeStatus(id, 'in_lavorazione');
  const handleReopenAsRisolto = (id) => handleChangeStatus(id, 'risolto');
  const handleSetInviato = (id) => handleChangeStatus(id, 'inviato');
  const handleArchiveTicket = (id) => handleChangeStatus(id, 'chiuso');
  const handleInvoiceTicket = (id) => handleChangeStatus(id, 'fatturato');
  
  const handleTimeLogChange = (logId, field, value) => {
    setTimeLogs(prev => prev.map(log => log.id === logId ? { ...log, [field]: value } : log));
  };
  const handleAddTimeLog = () => {
    setTimeLogs(prev => [...prev, getInitialTimeLog()]);
  };
  const handleDuplicateTimeLog = (log) => {
    const newLog = { ...log, id: Date.now() + Math.random() };
    setTimeLogs(prev => [...prev, newLog]);
  };
  const handleRemoveTimeLog = (logId) => {
    setTimeLogs(prev => prev.filter(log => log.id !== logId));
  };
  const handleMaterialChange = (logId, materialId, field, value) => {
    setTimeLogs(prev => prev.map(log => {
      if (log.id === logId) {
        return {
          ...log,
          materials: log.materials.map(m => m.id === materialId ? { ...m, [field]: parseFloat(value) || 0 } : m)
        };
      }
      return log;
    }));
  };
  const handleAddMaterial = (logId) => {
    setTimeLogs(prev => prev.map(log => log.id === logId ? { ...log, materials: [...log.materials, getInitialMaterial()] } : log));
  };
  const handleRemoveMaterial = (logId, materialId) => {
    setTimeLogs(prev => prev.map(log => log.id === logId ? { ...log, materials: log.materials.filter(m => m.id !== materialId) } : log));
  };

  const wrappedHandleConfirmTimeLogs = () => {
    handleConfirmTimeLogs(timeLogs);
  };
  
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
          setSelectedTicket={setSelectedTicket}
          handlers={{
            handleSelectTicket,
            handleOpenEditModal,
            handleOpenTimeLogger,
            handleViewTimeLog,
            handleOpenForniture,
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
        handleConfirmTimeLogs={wrappedHandleConfirmTimeLogs}
        handleSaveTimeLogs={handleSaveTimeLogs}
        currentUser={currentUser}
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
          onSave={wrappedHandleCreateClient}
        />
      )}
      
      {modalState.type === 'newTicket' && (
        <NewTicketModal
          onClose={closeModal}
          onSave={wrappedHandleCreateTicket}
          newTicketData={newTicketData}
          setNewTicketData={setNewTicketData}
          isEditingTicket={isEditingTicket}
          currentUser={currentUser}
          clientiAttivi={users.filter(u => u.ruolo === 'cliente')}
          selectedClientForNewTicket={selectedClientForNewTicket}
          setSelectedClientForNewTicket={setSelectedClientForNewTicket}
        />
      )}

      {fornitureModalTicket && (
        <FornitureModal
          ticket={fornitureModalTicket}
          onClose={() => setFornitureModalTicket(null)}
          onFornitureCountChange={handleFornitureCountChange}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
