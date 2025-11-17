import { buildApiUrl } from '../utils/apiConfig';

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
    selectedClientForNewTicket,
    sendEmail = true,
    photos = []
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
      selfCreated: currentUser.ruolo === 'cliente' && clienteId === currentUser.id,
      sendEmail: sendEmail
    };
    
    console.log('🔍 DEBUG FRONTEND: sendEmail =', sendEmail, 'tipo:', typeof sendEmail);
    console.log('🔍 DEBUG FRONTEND: photos =', photos.length, 'foto');
    
    try {
      // Se ci sono foto, usa FormData, altrimenti JSON
      let body;
      let headers = { ...getAuthHeader() };
      
      if (photos && photos.length > 0) {
        const formData = new FormData();
        formData.append('clienteid', ticketDaInviare.clienteid || '');
        formData.append('titolo', ticketDaInviare.titolo || '');
        formData.append('descrizione', ticketDaInviare.descrizione || '');
        formData.append('stato', ticketDaInviare.stato || 'aperto');
        formData.append('priorita', ticketDaInviare.priorita || 'media');
        formData.append('nomerichiedente', ticketDaInviare.nomerichiedente || '');
        formData.append('categoria', ticketDaInviare.categoria || 'assistenza');
        formData.append('dataapertura', ticketDaInviare.dataapertura || '');
        formData.append('sendEmail', sendEmail ? 'true' : 'false');
        
        // Aggiungi le foto
        photos.forEach(photo => {
          formData.append('photos', photo);
        });
        
        body = formData;
        // NON includere Content-Type per FormData - il browser lo imposta automaticamente
        delete headers['Content-Type'];
      } else {
        body = JSON.stringify(ticketDaInviare);
        headers['Content-Type'] = 'application/json';
      }
      
      const apiUrl = buildApiUrl('/api/tickets');
      console.log('🔍 DEBUG: Chiamata fetch a', apiUrl);
      console.log('🔍 DEBUG: closeModal è definita?', typeof closeModal);
      console.log('🔍 DEBUG: Headers keys:', Object.keys(headers));
      console.log('🔍 DEBUG: Body type:', body instanceof FormData ? 'FormData' : 'JSON');
      
      let response;
      try {
        console.log('🔍 DEBUG: Inizio fetch...');
        
        // Aggiungi timeout di 30 secondi
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.error('❌ ERRORE FETCH: Timeout dopo 30 secondi');
        }, 30000);
        
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: headers,
          body: body,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log('🔍 DEBUG: Fetch completata!');
      } catch (fetchError) {
        console.error('❌ ERRORE FETCH (rete/CORS/timeout):', fetchError);
        console.error('❌ ERRORE FETCH name:', fetchError.name);
        console.error('❌ ERRORE FETCH message:', fetchError.message);
        if (fetchError.name === 'AbortError') {
          throw new Error('Timeout: il server non ha risposto entro 30 secondi. Riprova.');
        }
        throw new Error('Errore di connessione al server. Verifica la connessione.');
      }
      
      console.log('🔍 DEBUG: Risposta ricevuta, status:', response.status, 'ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Errore creazione ticket:', response.status, errorText);
        throw new Error('Errore del server.');
      }
      const savedTicket = await response.json();
      console.log('✅ Ticket creato con successo:', savedTicket.id, savedTicket.numero);
      
      // Chiudi la modale PRIMA di aggiornare lo stato per evitare problemi
      console.log('🔍 DEBUG: Chiamata closeModal()...');
      if (typeof closeModal === 'function') {
        closeModal();
        console.log('✅ DEBUG: closeModal() chiamata con successo');
      } else {
        console.error('❌ DEBUG: closeModal non è una funzione!', closeModal);
      }
      
      // Marca subito come nuovo nella UI corrente
      const savedTicketWithNew = { ...savedTicket, isNew: true };
      // Controlla se il ticket esiste già (potrebbe essere arrivato via WebSocket prima)
      setTickets(prev => {
        const exists = prev.find(t => t.id === savedTicket.id);
        if (exists) {
          // Se esiste, aggiornalo mantenendo eventuali flag isNew
          return prev.map(t => t.id === savedTicket.id ? { ...savedTicketWithNew, isNew: t.isNew || savedTicketWithNew.isNew } : t);
        }
        // Se non esiste, aggiungilo all'inizio
        return [savedTicketWithNew, ...prev];
      });
      
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
        // Mostra effetto verde sulla card "Aperti" quando viene creato un nuovo ticket
        if (savedTicket.stato === 'aperto') {
          window.dispatchEvent(new CustomEvent('dashboard-highlight', { 
            detail: { state: 'aperto', type: 'up', direction: 'forward' } 
          }));
        }
        // Forza un polling immediato
        window.dispatchEvent(new Event('new-ticket-local'));
      } catch (_) {}
      showNotification('Ticket creato con successo!', 'success');
    } catch (error) {
      console.error('❌ ERRORE COMPLETO creazione ticket:', error);
      console.error('❌ Stack trace:', error.stack);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      showNotification(error.message || 'Impossibile creare il ticket.', 'error');
      // In caso di errore, NON chiudere la modale per permettere all'utente di riprovare
    }
  };

  const handleUpdateTicket = async (
    newTicketData,
    isEditingTicket,
    selectedClientForNewTicket,
    sendEmail = true
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
      dataapertura: newTicketData.dataapertura,
      sendEmail: sendEmail
    };
    
    console.log('🔍 DEBUG FRONTEND UPDATE: ticketAggiornato =', JSON.stringify(ticketAggiornato, null, 2));
    console.log('🔍 DEBUG FRONTEND UPDATE: dataapertura =', newTicketData.dataapertura, 'tipo:', typeof newTicketData.dataapertura);
    
    try {
      const response = await fetch(buildApiUrl(`/api/tickets/${isEditingTicket}`), {
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
      
      // Sincronizzazione automatica con Google Calendar per aggiornamenti ticket
      if (googleCalendarSync && typeof googleCalendarSync === 'function') {
        try {
          console.log('Sincronizzazione automatica aggiornamento ticket #' + ticketSalvato.id + ' con Google Calendar');
          await googleCalendarSync(ticketSalvato, 'update');
          console.log('Ticket #' + ticketSalvato.id + ' aggiornato automaticamente in Google Calendar');
        } catch (err) {
          console.error('Errore sincronizzazione automatica aggiornamento ticket #' + ticketSalvato.id + ':', err);
          // Non mostriamo errore all'utente per non interrompere il flusso
        }
      }
    } catch (error) {
      showNotification(error.message || 'Impossibile aggiornare il ticket.', 'error');
    }
  };

  const handleDeleteTicket = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo ticket?')) return;
    try {
      // Trova il ticket prima di eliminarlo per la sincronizzazione
      const ticketToDelete = tickets.find(t => t.id === id);
      
      const response = await fetch(buildApiUrl(`/api/tickets/${id}`), { 
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
        await fetch(buildApiUrl(`/api/tickets/${ticket.id}/mark-read`), {
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
    
    // Determina l'autore del messaggio in base a chi sta scrivendo
    let autore;
    if (currentUser.ruolo === 'tecnico') {
      autore = 'Tecnico';
    } else if (currentUser.ruolo === 'cliente') {
      // Usa sempre il nome di chi sta scrivendo, non sempre il nomerichiedente del ticket
      autore = `${currentUser.nome} ${currentUser.cognome || ''}`.trim() || ticket.nomerichiedente;
    } else {
      autore = 'Tecnico'; // fallback
    }
    
    const messageData = { autore, contenuto: msg, reclamo: isReclamo };
    try {
      const messageResponse = await fetch(buildApiUrl(`/api/tickets/${id}/messages`), {
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
        await fetch(buildApiUrl(`/api/tickets/${id}/status`), {
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
              const clientData = await fetch(buildApiUrl(`/api/users/${ticket.clienteid}`), {
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
          
          const emailResponse = await fetch(buildApiUrl(`/api/email/notify-technician-complaint`), {
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

  const handleDeleteMessage = async (ticketId, messageId) => {
    try {
      const response = await fetch(buildApiUrl(`/api/tickets/${ticketId}/messages/${messageId}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        }
      });
      
      if (!response.ok) {
        throw new Error('Errore nell\'eliminazione del messaggio');
      }
      
      // Aggiorna lo stato locale rimuovendo il messaggio
      setTickets(prevTickets => prevTickets.map(t => {
        if (t.id === ticketId) {
          const updatedMessaggi = (t.messaggi || []).filter(m => {
            const mId = typeof m.id === 'number' ? m.id : parseInt(m.id);
            return mId !== parseInt(messageId);
          });
          const updatedTicket = { ...t, messaggi: updatedMessaggi };
          if (selectedTicket?.id === ticketId) {
            setSelectedTicket(updatedTicket);
          }
          return updatedTicket;
        }
        return t;
      }));
      
      showNotification('Messaggio eliminato con successo.', 'success');
    } catch (error) {
      console.error('Errore nell\'eliminazione del messaggio:', error);
      showNotification('Errore nell\'eliminazione del messaggio.', 'error');
    }
  };

  const handleUpdateMessage = async (ticketId, messageId, newContent) => {
    if (!newContent || !newContent.trim()) {
      showNotification('Il contenuto del messaggio non può essere vuoto.', 'error');
      return;
    }
    
    try {
      const response = await fetch(buildApiUrl(`/api/tickets/${ticketId}/messages/${messageId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ contenuto: newContent.trim() })
      });
      
      if (!response.ok) {
        throw new Error('Errore nell\'aggiornamento del messaggio');
      }
      
      const updatedMessage = await response.json();
      
      // Aggiorna lo stato locale aggiornando il messaggio
      setTickets(prevTickets => prevTickets.map(t => {
        if (t.id === ticketId) {
          const updatedMessaggi = (t.messaggi || []).map(m => {
            const mId = typeof m.id === 'number' ? m.id : parseInt(m.id);
            if (mId === parseInt(messageId)) {
              return updatedMessage;
            }
            return m;
          });
          const updatedTicket = { ...t, messaggi: updatedMessaggi };
          if (selectedTicket?.id === ticketId) {
            setSelectedTicket(updatedTicket);
          }
          return updatedTicket;
        }
        return t;
      }));
      
      showNotification('Messaggio modificato con successo.', 'success');
    } catch (error) {
      console.error('Errore nell\'aggiornamento del messaggio:', error);
      showNotification('Errore nell\'aggiornamento del messaggio.', 'error');
    }
  };

  const handleChangeStatus = async (id, status, handleOpenTimeLogger, sendEmail = true) => {
    if (status === 'risolto' && currentUser.ruolo === 'tecnico') {
      const ticket = tickets.find(tk => tk.id === id);
      if (ticket) handleOpenTimeLogger(ticket);
      return;
    }
    
    console.log('🔍 DEBUG FRONTEND: changeStatus - sendEmail =', sendEmail, 'tipo:', typeof sendEmail);
    
    try {
      const response = await fetch(buildApiUrl(`/api/tickets/${id}/status`), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ status, sendEmail })
      });
      if (!response.ok) throw new Error('Errore aggiornamento stato');
      const updatedTicket = await response.json();
      setTickets(prevTickets => prevTickets.map(t => (t.id === id ? updatedTicket : t)));
      showNotification('Stato del ticket aggiornato!', 'success');
      
      // Sincronizzazione automatica con Google Calendar per cambio stato
      if (googleCalendarSync && typeof googleCalendarSync === 'function') {
        try {
          console.log('Sincronizzazione automatica cambio stato ticket #' + updatedTicket.id + ' con Google Calendar');
          await googleCalendarSync(updatedTicket, 'update');
          console.log('Ticket #' + updatedTicket.id + ' aggiornato automaticamente in Google Calendar');
        } catch (err) {
          console.error('Errore sincronizzazione automatica cambio stato ticket #' + updatedTicket.id + ':', err);
          // Non mostriamo errore all'utente per non interrompere il flusso
        }
      }
      
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

  const handleConfirmTimeLogs = async (timeLogs, sendEmail = true) => {
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
          quantita: parseInt(m.quantita) || 0,
          costo: parseFloat(m.costo) || 0
        })),
        offerte: log.offerte.map(o => ({
          numeroOfferta: o.numeroOfferta,
          dataOfferta: o.dataOfferta,
          costoUnitario: parseFloat(o.costoUnitario) || 0,
          qta: parseInt(o.qta) || 1,
          sconto: parseFloat(o.sconto) || 0,
          totale: parseFloat(o.totale) || 0,
          descrizione: o.descrizione,
          allegati: Array.isArray(o.allegati) ? o.allegati : []
        }))
      }));

      // 1. Salva i timeLogs
      const timelogsResponse = await fetch(buildApiUrl(`/api/tickets/${selectedTicket.id}/timelogs`), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ timeLogs: logsToSave })
      });

      if (!timelogsResponse.ok) throw new Error('Errore nel salvare i log');

      // 2. Aggiorna lo stato a risolto (con controllo invio email)
      const statusResponse = await fetch(buildApiUrl(`/api/tickets/${selectedTicket.id}/status`), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ status: 'risolto', sendEmail })
      });

      if (!statusResponse.ok) throw new Error('Errore nell\'aggiornamento dello stato');

      // 3. Ricarica il ticket completo con i timeLogs
      const ticketResponse = await fetch(buildApiUrl('/api/tickets'), {
        headers: getAuthHeader()
      });
      if (ticketResponse.ok) {
        const allTickets = await ticketResponse.json();
        const updatedTicket = allTickets.find(t => t.id === selectedTicket.id);
        
        if (updatedTicket) {
          console.log('✅ Ticket aggiornato con timeLogs:', updatedTicket.timelogs);
          setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
          
          // Sincronizzazione automatica con Google Calendar per conferma timeLogs
          if (googleCalendarSync && typeof googleCalendarSync === 'function') {
            try {
              console.log('Sincronizzazione automatica conferma timeLogs ticket #' + updatedTicket.id + ' con Google Calendar');
              await googleCalendarSync(updatedTicket, 'update');
              console.log('Ticket #' + updatedTicket.id + ' aggiornato automaticamente in Google Calendar');
            } catch (err) {
              console.error('Errore sincronizzazione automatica conferma timeLogs ticket #' + updatedTicket.id + ':', err);
              // Non mostriamo errore all'utente per non interrompere il flusso
            }
          }
          
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
    handleDeleteMessage,
    handleUpdateMessage,
    handleChangeStatus,
    handleConfirmTimeLogs
  };
};
