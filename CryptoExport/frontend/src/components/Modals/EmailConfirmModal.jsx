// src/components/Modals/EmailConfirmModal.jsx

import React, { useState, useEffect } from 'react';
import { Mail, Check, X } from 'lucide-react';

const EmailConfirmModal = ({ 
  onConfirm, 
  onCancel, 
  isEditing = false,
  clientName = 'Cliente',
  currentUser = null,
  statusChange = false,
  newStatus = null
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // Gestione chiusura con ESC
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !isProcessing) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel, isProcessing]);

  const handleConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Errore durante conferma email:', error);
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (isProcessing) return;
    onCancel();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Chiudi cliccando fuori dalla modale
        if (e.target === e.currentTarget && !isProcessing) {
          handleCancel();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-sky-600 text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Mail size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Conferma Invio Email</h2>
              <p className="text-blue-100 text-sm">
                Notifica al cliente
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={32} className="text-blue-600" />
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Vuoi inviare una notifica email?
            </h3>
            
            <p className="text-gray-600 text-sm leading-relaxed">
              {statusChange ? (
                currentUser?.ruolo === 'cliente' ? (
                  <>
                    Riceverai una notifica via email per il cambio di stato del ticket.
                  </>
                ) : (
                  <>
                    Il cliente <strong>{clientName}</strong> riceverà una notifica via email 
                    per il cambio di stato del ticket a <strong>{newStatus}</strong>.
                  </>
                )
              ) : currentUser?.ruolo === 'cliente' ? (
                isEditing ? (
                  <>
                    Riceverai una notifica via email sulle modifiche apportate al ticket.
                  </>
                ) : (
                  <>
                    Riceverai una notifica via email per il nuovo ticket creato.
                  </>
                )
              ) : (
                isEditing ? (
                  <>
                    Il cliente <strong>{clientName}</strong> riceverà una notifica via email 
                    sulle modifiche apportate al ticket.
                  </>
                ) : (
                  <>
                    Il cliente <strong>{clientName}</strong> riceverà una notifica via email 
                    per il nuovo ticket creato.
                  </>
                )
              )}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Cosa riceverà il cliente:</p>
                <ul className="text-blue-700 space-y-1">
                  <li>• Dettagli del ticket</li>
                  <li>• Link per accedere al sistema</li>
                  <li>• Informazioni di contatto</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={isProcessing}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition ${
                isProcessing 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <X size={18} />
              Non inviare
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition ${
                isProcessing 
                  ? 'bg-blue-400 text-white cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Check size={18} />
              {isProcessing ? 'Elaborazione...' : 'Invia email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailConfirmModal;
