import React from 'react';
import { MessageCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import {
  HubModalBackdrop,
  HubModalInnerCard,
  HubModalChromeHeader,
  HubModalBody,
  HubModalChromeFooter,
} from './Modals/HubModalChrome';

const UnreadMessagesModal = ({ tickets, getUnreadCount, onClose, onOpenTicket, currentUser }) => {
  // Filtra solo i ticket con messaggi non letti
  // Per i clienti: mostra solo i ticket che appartengono a loro e che sono aperti
  let filteredTickets = tickets;
  if (currentUser?.ruolo === 'cliente') {
    filteredTickets = tickets.filter(t => t.clienteid === currentUser.id && t.stato === 'aperto');
  }
  
  const unreadTickets = filteredTickets.filter(t => getUnreadCount(t) > 0);
  
  if (unreadTickets.length === 0) return null;

  const totalUnread = unreadTickets.reduce((sum, t) => sum + getUnreadCount(t), 0);

  // Controlla se c'è un reclamo tra i messaggi non letti
  const hasUnreadReclamo = (ticket) => {
    if (!ticket.messaggi || ticket.messaggi.length === 0) return false;
    
    // Trova l'ultimo messaggio non letto
    const lastReadDate = ticket.last_read_by_tecnico 
      ? new Date(ticket.last_read_by_tecnico) 
      : null;
    
    if (!lastReadDate) {
      // Se non c'è data di lettura, controlla tutti i messaggi del cliente
      return ticket.messaggi.some(m => m.reclamo && m.autore !== 'Tecnico');
    }
    
    // Controlla i messaggi dopo l'ultima lettura
    const unreadMessages = ticket.messaggi.filter(m => 
      new Date(m.data) > lastReadDate && m.autore !== 'Tecnico'
    );
    
    return unreadMessages.some(m => m.reclamo);
  };

  return (
    <HubModalBackdrop zClass="z-[118]">
      <HubModalInnerCard maxWidthClass="max-w-2xl" className="flex max-h-[80vh] flex-col overflow-hidden animate-slideIn">
        <HubModalChromeHeader
          icon={MessageCircle}
          title="Nuovi Messaggi"
          subtitle={`Hai ${totalUnread} ${totalUnread === 1 ? 'messaggio non letto' : 'messaggi non letti'}`}
          onClose={onClose}
        />
        <HubModalBody className="space-y-3">
          {unreadTickets.map((ticket) => {
            const count = getUnreadCount(ticket);
            const isReclamo = hasUnreadReclamo(ticket);
            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => {
                  onOpenTicket(ticket);
                  onClose();
                }}
                className={`group w-full rounded-xl border-2 p-4 text-left transition-all ${
                  isReclamo
                    ? 'border-red-400/60 bg-red-500/10 hover:border-red-400 hover:bg-red-500/15'
                    : 'border-amber-400/40 bg-amber-500/10 hover:border-amber-400/60 hover:bg-amber-500/15'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-white ${
                          isReclamo ? 'bg-red-600' : 'bg-amber-500'
                        }`}
                      >
                        {isReclamo ? '⚠️' : '💬'} {count}
                      </span>
                      <span className="font-mono text-xs font-semibold text-white/55">{ticket.numero}</span>
                      {isReclamo && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">RECLAMO</span>
                      )}
                    </div>
                    <h3
                      className={`mb-1 font-bold transition ${
                        isReclamo ? 'text-red-100 group-hover:text-red-50' : 'text-white group-hover:text-amber-100'
                      }`}
                    >
                      {ticket.titolo}
                    </h3>
                    <p className="truncate text-sm text-white/60">Richiedente: {ticket.nomerichiedente}</p>
                  </div>
                  {isReclamo ? (
                    <AlertTriangle
                      className="shrink-0 animate-pulse text-red-400 transition-transform group-hover:scale-110"
                      size={24}
                    />
                  ) : (
                    <AlertCircle className="shrink-0 text-amber-400 transition-transform group-hover:scale-110" size={24} />
                  )}
                </div>
              </button>
            );
          })}
        </HubModalBody>
        <HubModalChromeFooter className="justify-center border-t border-white/[0.08]">
          <p className="w-full text-center text-sm text-white/55">Clicca su un ticket per aprire la conversazione</p>
        </HubModalChromeFooter>
      </HubModalInnerCard>
    </HubModalBackdrop>
  );
};

export default UnreadMessagesModal;
