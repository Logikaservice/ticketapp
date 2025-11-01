import React from 'react';
import { X, MessageCircle, AlertCircle, AlertTriangle } from 'lucide-react';

const UnreadMessagesModal = ({ tickets, getUnreadCount, onClose, onOpenTicket, currentUser }) => {
  // Filtra solo i ticket con messaggi non letti
  // Per i clienti: mostra solo i ticket che appartengono a loro
  let filteredTickets = tickets;
  if (currentUser?.ruolo === 'cliente') {
    filteredTickets = tickets.filter(t => t.clienteid === currentUser.id);
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-slideIn">
        
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <MessageCircle size={32} />
                Nuovi Messaggi
              </h2>
              <p className="text-yellow-100 text-sm mt-1">
                Hai {totalUnread} {totalUnread === 1 ? 'messaggio non letto' : 'messaggi non letti'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Lista Ticket */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {unreadTickets.map((ticket) => {
              const count = getUnreadCount(ticket);
              const isReclamo = hasUnreadReclamo(ticket);
              
              return (
                <button
                  key={ticket.id}
                  onClick={() => {
                    onOpenTicket(ticket);
                    onClose();
                  }}
                  className={`w-full text-left p-4 border-2 rounded-xl transition-all group ${
                    isReclamo
                      ? 'bg-red-50 border-red-400 hover:bg-red-100 hover:border-red-500'
                      : 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100 hover:border-yellow-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-white text-xs font-bold rounded-full flex items-center gap-1 ${
                          isReclamo ? 'bg-red-600' : 'bg-yellow-500'
                        }`}>
                          {isReclamo ? '⚠️' : '💬'} {count}
                        </span>
                        <span className="text-xs font-mono text-gray-600 font-semibold">
                          {ticket.numero}
                        </span>
                        {isReclamo && (
                          <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full">
                            RECLAMO
                          </span>
                        )}
                      </div>
                      
                      <h3 className={`font-bold mb-1 transition ${
                        isReclamo 
                          ? 'text-red-800 group-hover:text-red-900' 
                          : 'text-gray-800 group-hover:text-yellow-700'
                      }`}>
                        {ticket.titolo}
                      </h3>
                      
                      <p className="text-sm text-gray-600 truncate">
                        Richiedente: {ticket.nomerichiedente}
                      </p>
                    </div>
                    
                    {isReclamo ? (
                      <AlertTriangle className="text-red-600 group-hover:scale-110 transition-transform flex-shrink-0 animate-pulse" size={24} />
                    ) : (
                      <AlertCircle className="text-yellow-600 group-hover:scale-110 transition-transform flex-shrink-0" size={24} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
          <p className="text-sm text-gray-600 text-center">
            Clicca su un ticket per aprire la conversazione
          </p>
        </div>
      </div>
    </div>
  );
};

export default UnreadMessagesModal;
