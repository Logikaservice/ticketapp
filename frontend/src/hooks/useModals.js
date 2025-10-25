// src/hooks/useModals.js

export const useModals = (
  setSelectedTicket,
  setModalState,
  initializeTimeLogs,
  initializeTimeLogsForView,
  setNewTicketData,
  setIsEditingTicket,
  setSelectedClientForNewTicket,
  setFornitureModalTicket
) => {
  
  const handleOpenTimeLogger = (ticket) => {
    // Seleziona il ticket per consentire il salvataggio dei timelog e dello stato
    setSelectedTicket(ticket);
    initializeTimeLogs(ticket);
    setModalState({ type: 'timeLogger', data: ticket });
  };
  
  const handleOpenEditModal = (ticket) => {
    setNewTicketData({
      titolo: ticket.titolo,
      descrizione: ticket.descrizione,
      categoria: ticket.categoria,
      priorita: ticket.priorita,
      nomerichiedente: ticket.nomerichiedente,
      dataapertura: ticket.dataapertura
    });
    setIsEditingTicket(ticket.id);
    setSelectedClientForNewTicket(ticket.clienteid.toString());
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
