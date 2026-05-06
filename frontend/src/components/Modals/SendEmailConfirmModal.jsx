import React from 'react';
import { Mail, X, Send } from 'lucide-react';
import { HubModalInnerCard, HubModalChromeFooter } from './HubModalChrome';
import { HUB_MODAL_NOTICE_INFO } from '../../utils/techHubAccent';

const SendEmailConfirmModal = ({ onConfirm, onCancel, ticket }) => {
  return (
    <HubModalInnerCard maxWidthClass="max-w-md w-full">
      <div className="p-6 pb-2 text-[color:var(--hub-chrome-text)]">
        <div className="mb-4 text-center">
          <Mail size={44} className="mx-auto mb-3 text-sky-400" aria-hidden />
          <h2 className="text-xl font-bold text-[color:var(--hub-chrome-text)]">Invia Email di Notifica</h2>
        </div>

        <div className={`mb-6 ${HUB_MODAL_NOTICE_INFO}`}>
          <p className="font-semibold text-[color:var(--hub-chrome-text-secondary)]">Vuoi inviare una email di notifica al cliente?</p>
          {ticket && (
            <p className="mt-2 text-sm text-[color:var(--hub-chrome-text-muted)]">
              Ticket: <strong>#{ticket.numero}</strong> — {ticket.titolo}
            </p>
          )}
          <p className="mt-2 text-xs text-[color:var(--hub-chrome-text-faint)]">Il cliente riceverà una notifica che il ticket è stato risolto.</p>
        </div>
      </div>

      <HubModalChromeFooter className="justify-stretch gap-3 [&>button]:flex-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[color:var(--hub-chrome-hover)] px-4 py-3 text-sm font-medium text-[color:var(--hub-chrome-text)] ring-1 ring-[color:var(--hub-chrome-border)] transition hover:brightness-110"
        >
          <X size={18} aria-hidden />
          Annulla
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition hover:brightness-110"
          style={{ backgroundColor: 'var(--hub-accent)', color: 'var(--hub-accent-on)' }}
        >
          <Send size={18} aria-hidden />
          Invia Email
        </button>
      </HubModalChromeFooter>
    </HubModalInnerCard>
  );
};

export default SendEmailConfirmModal;
