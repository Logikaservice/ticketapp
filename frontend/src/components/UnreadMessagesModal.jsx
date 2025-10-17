import React from 'react';
import { X, MessageCircle, AlertCircle } from 'lucide-react';

const UnreadMessagesModal = ({ tickets, getUnreadCount, onClose, onOpenTicket }) => {
  // Filtra solo i ticket con messaggi non letti
  const unreadTickets = tickets.filter(t => getUnreadCount(t) > 0);
  
  if (unreadTickets.length === 0) return null;

  const totalUnread = unreadTickets.reduce((sum, t) => sum + getUnreadCount(t), 0);

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
              return (
                <button
                  key={ticket.id}
                  onClick={() => {
                    onOpenTicket(ticket);
                    onClose();
                  }}
                  className="w-full text-left p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl hover:bg-yellow-100 hover:border-yellow-400 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                          💬 {count}
                        </span>
                        <span className="text-xs font-mono text-gray-600 font-semibold">
                          {ticket.numero}
                        </span>
                      </div>
                      
                      <h3 className="font-bold text-gray-800 mb-1 group-hover:text-yellow-700 transition">
                        {ticket.titolo}
                      </h3>
                      
                      <p className="text-sm text-gray-600 truncate">
                        Richiedente: {ticket.nomerichiedente}
                      </p>
                    </div>
                    
                    <AlertCircle className="text-yellow-600 group-hover:scale-110 transition-transform flex-shrink-0" size={24} />
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
