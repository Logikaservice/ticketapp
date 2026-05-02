// src/components/Modals/EmailConfirmModal.jsx

import React, { useState, useEffect } from 'react';
import { Mail, Check, X } from 'lucide-react';
import { HUB_MODAL_NOTICE_INFO } from '../../utils/techHubAccent';
import {
  HubModalInnerCard,
  HubModalChromeHeader,
  HubModalChromeFooter
} from './HubModalChrome';

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
    <HubModalInnerCard maxWidthClass="max-w-md w-full">
      <HubModalChromeHeader icon={Mail} title="Conferma invio email" subtitle="Notifica al cliente" compact />

      <div className="p-6 text-white">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/20 ring-2 ring-sky-500/40">
            <Mail size={32} className="text-sky-300" aria-hidden />
          </div>

          <h3 className="mb-2 text-lg font-semibold text-white">Vuoi inviare una notifica email?</h3>

          <p className="text-sm leading-relaxed text-white/65">
            {statusChange ? (
              currentUser?.ruolo === 'cliente' ? (
                <>Riceverai una notifica via email per il cambio di stato del ticket.</>
              ) : (
                <>
                  Il cliente <strong className="text-white">{clientName}</strong> riceverà una notifica via email per il
                  cambio di stato del ticket a <strong className="text-white">{newStatus}</strong>.
                </>
              )
            ) : currentUser?.ruolo === 'cliente' ? (
              isEditing ? (
                <>Riceverai una notifica via email sulle modifiche apportate al ticket.</>
              ) : (
                <>Riceverai una notifica via email per il nuovo ticket creato.</>
              )
            ) : isEditing ? (
              <>
                Il cliente <strong className="text-white">{clientName}</strong> riceverà una notifica via email sulle modifiche
                apportate al ticket.
              </>
            ) : (
              <>
                Il cliente <strong className="text-white">{clientName}</strong> riceverà una notifica via email per il nuovo ticket
                creato.
              </>
            )}
          </p>
        </div>

        <div className={HUB_MODAL_NOTICE_INFO}>
          <div className="flex items-start gap-3">
            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
            <div className="text-sm">
              <p className="mb-1 font-medium text-white/95">Cosa riceverà il cliente:</p>
              <ul className="space-y-1 text-white/75">
                <li>• Dettagli del ticket</li>
                <li>• Link per accedere al sistema</li>
                <li>• Informazioni di contatto</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <HubModalChromeFooter>
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isProcessing}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition ${
              isProcessing ? 'cursor-not-allowed opacity-45' : ''
            } bg-white/[0.1] font-medium text-white hover:bg-white/[0.14]`}
          >
            <X size={18} aria-hidden />
            Non inviare
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              isProcessing ? 'cursor-not-allowed opacity-65' : 'hover:brightness-110'
            } bg-sky-600 text-white`}
          >
            <Check size={18} aria-hidden />
            {isProcessing ? 'Elaborazione…' : 'Invia email'}
          </button>
        </div>
      </HubModalChromeFooter>
    </HubModalInnerCard>
  );
};

export default EmailConfirmModal;
