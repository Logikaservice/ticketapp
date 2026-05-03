// src/components/Modals/EmailConfirmModal.jsx

import React, { useState, useEffect } from 'react';
import { Mail, Check, X } from 'lucide-react';
import { HUB_MODAL_NOTICE_INFO } from '../../utils/techHubAccent';
import {
  HubModalInnerCard,
  HubModalChromeHeader,
  HubModalChromeFooter,
  HubModalBody,
  HubModalPrimaryButton,
  HubModalSecondaryButton
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

      <HubModalBody className="space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--hub-chrome-row-nested-bg)] ring-2 ring-[color:var(--hub-accent-border)]">
            <Mail size={32} className="text-[color:var(--hub-accent)]" aria-hidden />
          </div>

          <h3 className="mb-2 text-lg font-semibold text-[color:var(--hub-chrome-text)]">
            Vuoi inviare una notifica email?
          </h3>

          <p className="text-sm leading-relaxed text-[color:var(--hub-chrome-text-muted)]">
            {statusChange ? (
              currentUser?.ruolo === 'cliente' ? (
                <>Riceverai una notifica via email per il cambio di stato del ticket.</>
              ) : (
                <>
                  Il cliente{' '}
                  <strong className="font-semibold text-[color:var(--hub-chrome-text)]">{clientName}</strong> riceverà
                  una notifica via email per il cambio di stato del ticket a{' '}
                  <strong className="font-semibold text-[color:var(--hub-chrome-text)]">{newStatus}</strong>.
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
                Il cliente <strong className="font-semibold text-[color:var(--hub-chrome-text)]">{clientName}</strong>{' '}
                riceverà una notifica via email sulle modifiche apportate al ticket.
              </>
            ) : (
              <>
                Il cliente <strong className="font-semibold text-[color:var(--hub-chrome-text)]">{clientName}</strong>{' '}
                riceverà una notifica via email per il nuovo ticket creato.
              </>
            )}
          </p>
        </div>

        <div className={HUB_MODAL_NOTICE_INFO}>
          <div className="flex items-start gap-3">
            <div
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: 'var(--hub-accent, #38bdf8)' }}
              aria-hidden
            />
            <div>
              <p className="mb-1 font-medium">Cosa riceverà il cliente:</p>
              <ul className="space-y-1 opacity-95">
                <li>• Dettagli del ticket</li>
                <li>• Link per accedere al sistema</li>
                <li>• Informazioni di contatto</li>
              </ul>
            </div>
          </div>
        </div>
      </HubModalBody>

      <HubModalChromeFooter>
        <div className="flex w-full gap-3">
          <HubModalSecondaryButton
            type="button"
            onClick={handleCancel}
            disabled={isProcessing}
            className="flex flex-1 items-center justify-center gap-2 py-2.5"
          >
            <X size={18} aria-hidden />
            Non inviare
          </HubModalSecondaryButton>
          <HubModalPrimaryButton
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex flex-1 items-center justify-center gap-2 py-2.5"
          >
            <Check size={18} aria-hidden />
            {isProcessing ? 'Elaborazione…' : 'Invia email'}
          </HubModalPrimaryButton>
        </div>
      </HubModalChromeFooter>
    </HubModalInnerCard>
  );
};

export default EmailConfirmModal;
