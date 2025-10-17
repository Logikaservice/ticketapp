// src/components/NotificationModal.jsx

import React from 'react';
import { X, Clock } from 'lucide-react';

export default function NotificationModal({ ticket, onClose, onOpenTicket, onSnooze }) {
  if (!ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 animate-fade-in">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Nuovo messaggio
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <button
          onClick={() => {
            onOpenTicket(ticket.id);
            onClose();
          }}
          className="w-full text-left p-4 bg-yellow-50 hover:bg-yellow-100 rounded-lg border-2 border-yellow-400 transition-all hover:shadow-md mb-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-medium text-gray-900 mb-1">{ticket.titolo}</p>
              <p className="text-sm text-gray-600">
                Cliente: {ticket.clientName}
              </p>
            </div>
            <div className="bg-yellow-400 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold ml-3">
              {ticket.unreadCount}
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            onSnooze(ticket.id);
            onClose();
          }}
          className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Clock size={16} />
          Ricordamelo dopo
        </button>
      </div>
    </div>
  );
}
