export const useTickets = (
  showNotification,
  setTickets,
  selectedTicket,
  setSelectedTicket,
  currentUser,
  tickets,
  closeModal,
  googleCalendarSync, // Aggiungiamo il parametro per la sincronizzazione Google Calendar
  getAuthHeader // Aggiungiamo il parametro per l'autenticazione
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
    if (!newTicketData.titolo || !newTicketData.nomerichiedente) {
      return showNotification('Titolo e richiedente sono obbligatori.', 'error');
    }
    const clienteId = currentUser.ruolo === 'tecnico' ? parseInt(selectedClientForNewTicket) : currentUser.id;
    if (currentUser.ruolo === 'tecnico' && !clienteId) {
      return showNotification('Devi selezionare un cliente.', 'error');
    }
    const ticketDaInviare = {
      ...newTicketData,
      clienteid: clienteId,
      stato: 'aperto',
      nomerichiedente: newTicketData.nomerichiedente || (currentUser.ruolo === 'cliente' ? `${currentUser.nome} ${currentUser.cognome || ''}`.trim() : 'Tecnico'),
      // Flag per distinguere se il ticket è creato dal cliente stesso
      createdBy: currentUser.ruolo,
      selfCreated: currentUser.ruolo === 'cliente' && clienteId === currentUser.id
    };
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(ticketDaInviare)
      });
      if (!response.ok) throw new Error('Errore del server.');
      const savedTicket = await response.json();
      // Marca subito come nuovo nella UI corrente
      const savedTicketWithNew = { ...savedTicket, isNew: true };
      setTickets(prev => [savedTicketWithNew, ...prev]);
      closeModal();
      
      // Sincronizzazione automatica con Google Calendar per nuovi ticket
      if (googleCalendarSync && typeof googleCalendarSync === 'function') {
        try {
          console.log('Sincronizzazione automatica nuovo ticket #' + savedTicket.id + ' con Google Calendar');
          await googleCalendarSync(savedTicket);
          console.log('Ticket #' + savedTicket.id + ' sincronizzato automaticamente con Google Calendar');
        } catch (err) {
          console.error('Errore sincronizzazione automatica ticket #' + savedTicket.id + ':', err);
          // Non mostriamo errore all'utente per non interrompere il flusso
        }
      }
      
      try {
        // Marca subito come non visto per l'utente corrente (evidenza gialla immediata senza refresh)
        const key = `unseenNewTicketIds_${currentUser.id}`;
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        if (!arr.includes(savedTicket.id)) {
          arr.push(savedTicket.id);
          localStorage.setItem(key, JSON.stringify(arr));
        }
        // Badge NEW in dashboard
        window.dispatchEvent(new CustomEvent('dashboard-new', { detail: { state: 'aperto' } }));
        window.dispatchEvent(new CustomEvent('dashboard-focus', { detail: { state: 'aperto' } }));
        // Forza un polling immediato
        window.dispatchEvent(new Event('new-ticket-local'));
      } catch (_) {}
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
    if (!newTicketData.titolo || !newTicketData.nomerichiedente) {
      return showNotification('Titolo e richiedente sono obbligatori.', 'error');
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
      clienteid: clienteId,
      dataapertura: newTicketData.dataapertura
    };
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${isEditingTicket}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
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
      // Trova il ticket prima di eliminarlo per la sincronizzazione
      const ticketToDelete = tickets.find(t => t.id === id);
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (!response.ok) throw new Error('Errore durante l\'eliminazione');
      
      // Sincronizzazione automatica con Google Calendar per eliminazione ticket
      if (googleCalendarSync && typeof googleCalendarSync === 'function' && ticketToDelete) {
        try {
          console.log('Sincronizzazione automatica eliminazione ticket #' + id + ' con Google Calendar');
          await googleCalendarSync(ticketToDelete, 'delete');
          console.log('Ticket #' + id + ' rimosso automaticamente da Google Calendar');
        } catch (err) {
          console.error('Errore sincronizzazione automatica eliminazione ticket #' + id + ':', err);
          // Non mostriamo errore all'utente per non interrompere il flusso
        }
      }
      
      setTickets(prev => prev.filter(t => t.id !== id));
      if (selectedTicket?.id === id) setSelectedTicket(null);
      showNotification('Ticket eliminato con successo!', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleSelectTicket = async (ticket) => {
    // Opzione A: non far scorrere la pagina quando si apre/chiude la chat
    const savedScrollY = typeof window !== 'undefined' ? (window.scrollY || window.pageYOffset || 0) : 0;
    if (ticket && (!selectedTicket || selectedTicket.id !== ticket.id)) {
      try {
        await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${ticket.id}/mark-read`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeader()
          },
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
    // Aprendo il ticket, rimuovi l'evidenza "isNew"
    setSelectedTicket(prev => (prev?.id === ticket.id ? null : ticket));
    // Segna come visto: rimuove evidenza e rimuove l'ID dai "non visti"
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, isNew: false } : t));
    try {
      const key = `unseenNewTicketIds_${currentUser.id}`;
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = Array.isArray(arr) ? arr.filter((tid) => tid !== ticket.id) : [];
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch {}
    // Ripristina la posizione dello scroll dopo il render della chat
    setTimeout(() => {
      try { window.scrollTo(0, savedScrollY); } catch {}
    }, 0);
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
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(messageData)
      });
      if (!messageResponse.ok) throw new Error('Errore nel salvare il messaggio');
      const savedMessage = await messageResponse.json();
      let newStatus = ticket.stato;
      if (isReclamo) {
        newStatus = 'in_lavorazione';
      }
      if (newStatus !== ticket.stato) {
        await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${id}/status`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeader()
          },
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
      if (isReclamo) {
        showNotification('Reclamo inviato! Ticket riaperto.', 'error');
        
        // Invia notifica email al tecnico per il reclamo
        try {
          console.log('🚨 INVIO RECLAMO - Ticket:', ticket.numero);
          
          // Usa il messaggio appena salvato come reclamo
          const complaintMessages = [savedMessage];
          console.log('📝 Messaggi reclamo:', complaintMessages);
          
          // Usa i dati del cliente già disponibili nel ticket
          let clientEmail = ticket.emailcliente || ticket.email;
          const clientName = ticket.nomerichiedente || ticket.cliente || 'Cliente';
          
          // Se l'email non è disponibile nel ticket, recuperala dal database
          if (!clientEmail && ticket.clienteid) {
            console.log('🔍 Tentativo recupero email per cliente ID:', ticket.clienteid);
            try {
              const clientData = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${ticket.clienteid}`, {
                headers: getAuthHeader()
              });
              
              console.log('📡 Risposta API users:', clientData.status);
              
              if (clientData.ok) {
                const client = await clientData.json();
                clientEmail = client.email;
                console.log('📧 Email recuperata dal database:', clientEmail);
              } else {
                console.log('❌ API users fallita:', clientData.status);
                const errorText = await clientData.text();
                console.log('📄 Dettagli errore API:', errorText);
              }
            } catch (dbErr) {
              console.log('⚠️ Errore recupero email dal database:', dbErr.message);
            }
          }
          
          console.log('👤 Dati cliente:', { clientEmail, clientName });
          
          // Se ancora non abbiamo l'email, usa un fallback
          if (!clientEmail) {
            console.log('⚠️ Email cliente non disponibile, uso fallback');
            clientEmail = 'cliente@example.com'; // Fallback temporaneo
          }
          
          const emailResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/email/notify-technician-complaint`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeader()
            },
            body: JSON.stringify({
              ticket: { ...ticket, stato: newStatus },
              clientEmail: clientEmail,
              clientName: clientName,
              complaintMessages: complaintMessages
            })
          });
          
          if (emailResponse.ok) {
            console.log('✅ Email reclamo inviata al tecnico');
          } else {
            console.log('⚠️ Errore invio email reclamo:', emailResponse.status);
            const errorText = await emailResponse.text();
            console.log('📄 Dettagli errore:', errorText);
          }
        } catch (emailErr) {
          console.log('⚠️ Errore invio email reclamo:', emailErr.message);
        }
      }
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
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Errore aggiornamento stato');
      const updatedTicket = await response.json();
      setTickets(prevTickets => prevTickets.map(t => (t.id === id ? updatedTicket : t)));
      showNotification('Stato del ticket aggiornato!', 'success');
      
      // La logica delle email è ora gestita dal backend in base al ruolo dell'utente
      
      // Glow immediato (senza frecce): stato precedente diminuisce, nuovo aumenta
      try {
        const prev = tickets.find(t => t.id === id)?.stato;
        const cur = updatedTicket.stato;
        if (prev && cur && prev !== cur) {
          window.dispatchEvent(new CustomEvent('dashboard-highlight', { detail: { state: prev, type: 'down' } }));
          window.dispatchEvent(new CustomEvent('dashboard-highlight', { detail: { state: cur, type: 'up' } }));
        }
      } catch (_) {}
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
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ timeLogs: logsToSave })
      });

      if (!timelogsResponse.ok) throw new Error('Errore nel salvare i log');

      // 2. Aggiorna lo stato a risolto
      const statusResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets/${selectedTicket.id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ status: 'risolto' })
      });

      if (!statusResponse.ok) throw new Error('Errore nell\'aggiornamento dello stato');

      // 3. Ricarica il ticket completo con i timeLogs
      const ticketResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/tickets`, {
        headers: getAuthHeader()
      });
      if (ticketResponse.ok) {
        const allTickets = await ticketResponse.json();
        const updatedTicket = allTickets.find(t => t.id === selectedTicket.id);
        
        if (updatedTicket) {
          console.log('✅ Ticket aggiornato con timeLogs:', updatedTicket.timelogs);
          setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
          // Glow immediato per in_lavorazione -> risolto
          try {
            window.dispatchEvent(new CustomEvent('dashboard-highlight', { detail: { state: 'in_lavorazione', type: 'down' } }));
            window.dispatchEvent(new CustomEvent('dashboard-highlight', { detail: { state: 'risolto', type: 'up' } }));
          } catch (_) {}
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
