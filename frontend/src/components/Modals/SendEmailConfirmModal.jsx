import React from 'react';
import { Mail, X, Send } from 'lucide-react';

const SendEmailConfirmModal = ({ onConfirm, onCancel, ticket }) => {
  return (
    <div className="bg-white rounded-xl max-w-md w-full p-6">
      <div className="text-center mb-4">
        <Mail size={48} className="text-blue-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold">Invia Email di Notifica</h2>
      </div>

      <div className="text-sm mb-6 p-3 border border-blue-200 bg-blue-50 rounded-lg">
        <p className="font-semibold text-blue-800">Vuoi inviare una email di notifica al cliente?</p>
        {ticket && (
          <p className="mt-2 text-blue-700">
            Ticket: <strong>#{ticket.numero}</strong> - {ticket.titolo}
          </p>
        )}
        <p className="mt-2 text-blue-600 text-xs">
          Il cliente riceverà una notifica che il ticket è stato risolto.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2"
        >
          <X size={18} />
          Annulla
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition"
        >
          <Send size={18} />
          Invia Email
        </button>
      </div>
    </div>
  );
};

export default SendEmailConfirmModal;

