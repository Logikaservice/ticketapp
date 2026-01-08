// src/hooks/useModals.js

export const useModals = (
  setSelectedTicket,
  setModalState,
  initializeTimeLogs,
  initializeTimeLogsForView,
  setNewTicketData,
  setIsEditingTicket,
  setSelectedClientForNewTicket,
  setFornitureModalTicket,
  users = []
) => {
  
  const handleOpenTimeLogger = (ticket) => {
    // Seleziona il ticket per consentire il salvataggio dei timelog e dello stato
    setSelectedTicket(ticket);
    initializeTimeLogs(ticket);
    setModalState({ type: 'timeLogger', data: ticket });
  };
  
  const handleOpenEditModal = (ticket, users = []) => {
    setNewTicketData({
      titolo: ticket.titolo,
      descrizione: ticket.descrizione,
      categoria: ticket.categoria,
      priorita: ticket.priorita,
      nomerichiedente: ticket.nomerichiedente,
      dataapertura: ticket.dataapertura
    });
    setIsEditingTicket(ticket.id);
    
    // Se il ticket ha un clienteid, usa quello
    if (ticket.clienteid) {
      setSelectedClientForNewTicket(ticket.clienteid.toString());
    } else {
      // Se non ha clienteid, non selezionare nessun cliente
      setSelectedClientForNewTicket('');
    }
    
    setModalState({ type: 'newTicket', data: ticket });
  };
  
  const handleOpenForniture = (ticket) => {
    console.log('🔍 DEBUG FORNITURE: handleOpenForniture chiamata per ticket:', ticket.id, ticket.numero);
    setFornitureModalTicket(ticket);
    console.log('🔍 DEBUG FORNITURE: fornitureModalTicket impostato');
  };
  
  const handleViewTimeLog = (ticket) => {
    setSelectedTicket(ticket); // Necessario per permettere il salvataggio delle modifiche
    initializeTimeLogsForView(ticket);
    setModalState({ type: 'viewTimeLogger', data: ticket });
  };

  return {
    handleOpenTimeLogger,
    handleOpenEditModal,
    handleOpenForniture,
    handleViewTimeLog
  };
};
