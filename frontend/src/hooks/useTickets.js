export const useTickets = (
  showNotification,
  setTickets,
  selectedTicket,
  setSelectedTicket,
  currentUser,
  tickets,
  closeModal
) => {
  const handleCreateTicket = async (
    newTicketData,
    isEditingTicket,
    handleUpdateTicket,
    selectedClientForNewTicket
  ) => {
    if (isEditingTicket) {
      handleUpdateTicket();
      return;
    }
    if (!newTicketData.titolo || !newTicketData.descrizione || !newTicketData.nomerichiedente) {
      return showNotification('Titolo, descrizione e richiedente sono obbligatori.', 'error');
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

  const handleUpdateTicket = async (
    newTicketData,
    isEditingTicket,
    selectedClientForNewTicket
  ) => {
    if (!newTicketData.titolo || !newTicketData.descrizione || !newTicketData.nomerichiedente) {
      return showNotification('Titolo, descrizione e richiedente sono obbligatori.', 'error');
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
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${isEditingTicket}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketAggiornato)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore nell\'aggiornamento del ticket');
      }
      
      const ticketSalvato = await response.json();
      
      setTickets(prev => prev.map(t => t.id === isEditingTicket ? ticketSalvato : t));
      
      if (selectedTicket?.id === isEditingTicket) {
        setSelectedTicket(ticketSalvato);
      }
      
      closeModal();
      showNotification('Ticket aggiornato con successo!', 'success');
    } catch (error) {
      showNotification(error.message || 'Impossibile aggiornare il ticket.', 'error');
    }
  };

  const handleDeleteTicket = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo ticket?')) return;
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Errore durante l\'eliminazione');
      setTickets(prev => prev.filter(t => t.id !== id));
      if (selectedTicket?.id === id) setSelectedTicket(null);
      showNotification('Ticket eliminato con successo!', 'success');
    } catch (error) {
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

  const handleChangeStatus = async (id, status, handleOpenTimeLogger) => {
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

  const handleConfirmTimeLogs = async (timeLogs) => {
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

      // 1. Salva i timeLogs
      const timelogsResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${selectedTicket.id}/timelogs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeLogs: logsToSave })
      });

      if (!timelogsResponse.ok) throw new Error('Errore nel salvare i log');

      // 2. Aggiorna lo stato a risolto
      const statusResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${selectedTicket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'risolto' })
      });

      if (!statusResponse.ok) throw new Error('Errore nell\'aggiornamento dello stato');

      // 3. Ricarica il ticket completo con i timeLogs
      const ticketResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets`);
      if (ticketResponse.ok) {
        const allTickets = await ticketResponse.json();
        const updatedTicket = allTickets.find(t => t.id === selectedTicket.id);
        
        if (updatedTicket) {
          console.log('✅ Ticket aggiornato con timeLogs:', updatedTicket.timelogs);
          setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
        }
      }
      
      setSelectedTicket(null);
      closeModal();
      showNotification('Ticket risolto con successo!', 'success');
    } catch (error) {
      showNotification(error.message || 'Errore nel confermare i log.', 'error');
    }
  };

  return {
    handleCreateTicket,
    handleUpdateTicket,
    handleDeleteTicket,
    handleSelectTicket,
    handleSendMessage,
    handleChangeStatus,
    handleConfirmTimeLogs
  };
};
