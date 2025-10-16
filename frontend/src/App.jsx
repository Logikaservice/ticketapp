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
  // GENERAZIONE REPORT HTML
  // ====================================================================
  const generateReportHTML = (tickets, reportTitle, reportType) => {
    const isInvoice = reportType === 'invoice';
    
    // Calcola totali
    let totalServizi = 0;
    let totalMateriali = 0;
    
    tickets.forEach(ticket => {
      if (ticket.timelogs && ticket.timelogs.length > 0) {
        ticket.timelogs.forEach(log => {
          const costoManodopera = (parseFloat(log.costoUnitario) || 0) * (1 - (parseFloat(log.sconto) || 0) / 100) * (parseFloat(log.oreIntervento) || 0);
          totalServizi += costoManodopera;
          
          if (log.materials && log.materials.length > 0) {
            log.materials.forEach(m => {
              totalMateriali += (parseFloat(m.costo) || 0) * (parseInt(m.quantita) || 1);
            });
          }
        });
      }
    });
    
    const totalGenerale = totalServizi + totalMateriali;

    // Genera HTML
    let html = `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportTitle}</title>
    <style>
        @page { margin: 20mm; }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            line-height: 1.3;
            color: #000;
            max-width: 800px;
            margin: 0 auto;
            padding: 15px;
            background-color: #fff;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #000;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .header h1 {
            margin: 0;
            font-size: 20pt;
            font-weight: bold;
            letter-spacing: 1px;
        }
        .ticket-block {
            border-bottom: 1px solid #ccc;
            padding: 10px 0;
            margin-bottom: 10px;
            page-break-inside: avoid;
        }
        .ticket-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
        }
        .ticket-number {
            font-weight: bold;
            font-size: 12pt;
        }
        .ticket-dates {
            text-align: right;
            font-size: 10pt;
        }
        .ticket-title {
            font-weight: bold;
            font-size: 11pt;
            margin-bottom: 3px;
        }
        .ticket-requester {
            text-align: right;
            font-size: 10pt;
            color: #333;
            margin-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0;
        }
        table thead {
            background-color: #f5f5f5;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
        }
        table th {
            padding: 6px;
            text-align: left;
            font-weight: bold;
            font-size: 10pt;
        }
        table td {
            padding: 6px;
            border-bottom: 1px solid #ddd;
            font-size: 10pt;
        }
        table th:last-child, table td:last-child {
            text-align: right;
        }
        .description {
            margin: 8px 0;
            padding: 6px;
            background-color: #fafafa;
            border-left: 3px solid #4a90e2;
        }
        .materials {
            margin: 8px 0;
            padding: 6px;
            background-color: #fff9e6;
            border-left: 3px solid #f39c12;
        }
        .ticket-total {
            text-align: right;
            font-size: 12pt;
            font-weight: bold;
            margin-top: 8px;
            padding: 6px;
            background-color: #e8f4f8;
        }
        .summary {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 3px double #000;
        }
        .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 11pt;
        }
        .summary-row.grand-total {
            font-size: 14pt;
            font-weight: bold;
            padding: 10px 0;
            border-top: 2px solid #000;
            border-bottom: 3px double #000;
        }
        .footer {
            margin-top: 15px;
            padding-top: 8px;
            border-top: 1px solid #ccc;
            display: flex;
            justify-content: space-between;
            font-size: 9pt;
            color: #666;
        }
        @media print {
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${reportTitle.toUpperCase()}</h1>
    </div>
`;

    // Aggiungi ogni ticket
    tickets.forEach((ticket, index) => {
      const cliente = users.find(u => u.id === ticket.clienteid);
      const dataApertura = formatDate(ticket.dataapertura);
      const dataChiusura = ticket.datachiusura ? formatDate(ticket.datachiusura) : 'N/A';
      
      let totaleTicket = 0;

      html += `
    <div class="ticket-block">
        <div class="ticket-header">
            <span class="ticket-number">Ticket: ${ticket.numero}</span>
            <span class="ticket-dates">Apertura: ${dataApertura} &nbsp;&nbsp; Chiusura: ${dataChiusura}</span>
        </div>
        <div class="ticket-title">Titolo: ${ticket.titolo}</div>
        <div class="ticket-requester">Richiedente: ${ticket.nomerichiedente}</div>
`;

      if (ticket.timelogs && ticket.timelogs.length > 0) {
        html += `
        <table>
            <thead>
                <tr>
                    <th>Servizio / Data</th>
                    <th style="text-align: center; width: 60px;">Ore</th>
                    <th style="text-align: center; width: 80px;">Prezzo/h</th>
                    <th style="text-align: center; width: 50px;">Sc.</th>
                    <th style="width: 100px;">Importo</th>
                </tr>
            </thead>
            <tbody>
`;

        ticket.timelogs.forEach((log, logIndex) => {
          const costoManodopera = (parseFloat(log.costoUnitario) || 0) * (1 - (parseFloat(log.sconto) || 0) / 100) * (parseFloat(log.oreIntervento) || 0);
          const costoMateriali = (log.materials || []).reduce((sum, m) => sum + (parseFloat(m.costo) || 0) * (parseInt(m.quantita) || 1), 0);
          totaleTicket += costoManodopera + costoMateriali;

          html += `
                <tr>
                    <td>${logIndex + 1}. ${log.modalita} - ${log.data}</td>
                    <td style="text-align: center;">${log.oreIntervento}h</td>
                    <td style="text-align: center;">€${parseFloat(log.costoUnitario).toFixed(0)}</td>
                    <td style="text-align: center;">${parseFloat(log.sconto).toFixed(0)}%</td>
                    <td style="text-align: right;">€${costoManodopera.toFixed(2)}</td>
                </tr>
`;
        });

        html += `
            </tbody>
        </table>
`;

        // Descrizione (prendo quella del primo log)
        const descrizione = ticket.timelogs[0].descrizione || 'N/A';
        html += `
        <div class="description">
            <strong>Descrizione Dettagliata:</strong> ${descrizione}
        </div>
`;

        // Materiali
        const hasMaterials = ticket.timelogs.some(log => log.materials && log.materials.length > 0);
        if (hasMaterials) {
          let materialsText = '';
          ticket.timelogs.forEach(log => {
            if (log.materials && log.materials.length > 0) {
              log.materials.forEach(m => {
                materialsText += `${m.nome} (${m.quantita}x) €${parseFloat(m.costo).toFixed(2)}, `;
              });
            }
          });
          materialsText = materialsText.slice(0, -2); // Rimuovi ultima virgola
          
          html += `
        <div class="materials">
            <strong>Materiali:</strong> ${materialsText}
        </div>
`;
        } else {
          html += `
        <div class="materials">
            <strong>Materiali:</strong> N/A
        </div>
`;
        }
      }

      html += `
        <div class="ticket-total">
            TOTALE TICKET: (${ticket.numero}) €${totaleTicket.toFixed(2)}
        </div>
    </div>
`;
    });

    // Summary
    html += `
    <div class="summary">
        <div class="summary-row">
            <span>TOTALE COMPLESSIVO SERVIZI:</span>
            <span>€${totalServizi.toFixed(2)}</span>
        </div>
        <div class="summary-row">
            <span>TOTALE MATERIALI:</span>
            <span>€${totalMateriali.toFixed(2)}</span>
        </div>
        <div class="summary-row grand-total">
            <span>TOTALE GENERALE DOCUMENTO:</span>
            <span>€${totalGenerale.toFixed(2)}</span>
        </div>
    </div>

    <div class="footer">
        <span>Totale ticket: ${tickets.length}</span>
        <span>Data generazione: ${new Date().toLocaleDateString('it-IT')} | Pagina 1</span>
    </div>

</body>
</html>
`;

    return html;
  };

  const handleGenerateSentReport = () => {
    const sentTickets = tickets.filter(t => t.stato === 'inviato');
    
    if (sentTickets.length === 0) {
      showNotification('Nessun ticket inviato da mostrare.', 'info');
      return;
    }

    const htmlContent = generateReportHTML(sentTickets, 'Report Ticket Inviati', 'sent');

    setModalState({
      type: 'reportHTML',
      data: {
        title: 'Report Ticket Inviati',
        htmlContent: htmlContent
      }
    });
  };

  const handleGenerateInvoiceReport = () => {
    const invoicedTickets = tickets.filter(t => t.stato === 'fatturato');
    
    if (invoicedTickets.length === 0) {
      showNotification('Nessun ticket fatturato da mostrare.', 'info');
      return;
    }

    const htmlContent = generateReportHTML(invoicedTickets, 'Lista Fatture', 'invoice');

    setModalState({
      type: 'reportHTML',
      data: {
        title: 'Lista Fatture',
        htmlContent: htmlContent
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
