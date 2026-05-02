import React from 'react';
import { Mail, X, Send } from 'lucide-react';
import { HubModalInnerCard, HubModalChromeFooter } from './HubModalChrome';
import { HUB_MODAL_NOTICE_INFO } from '../../utils/techHubAccent';

const SendEmailConfirmModal = ({ onConfirm, onCancel, ticket }) => {
  return (
    <HubModalInnerCard maxWidthClass="max-w-md w-full">
      <div className="p-6 pb-2 text-white">
        <div className="mb-4 text-center">
          <Mail size={44} className="mx-auto mb-3 text-sky-400" aria-hidden />
          <h2 className="text-xl font-bold text-white">Invia Email di Notifica</h2>
        </div>

        <div className={`mb-6 ${HUB_MODAL_NOTICE_INFO}`}>
          <p className="font-semibold text-sky-100">Vuoi inviare una email di notifica al cliente?</p>
          {ticket && (
            <p className="mt-2 text-sm text-white/85">
              Ticket: <strong>#{ticket.numero}</strong> — {ticket.titolo}
            </p>
          )}
          <p className="mt-2 text-xs text-white/65">Il cliente riceverà una notifica che il ticket è stato risolto.</p>
        </div>
      </div>

      <HubModalChromeFooter className="justify-stretch gap-3 [&>button]:flex-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/[0.1] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.14]"
        >
          <X size={18} aria-hidden />
          Annulla
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-500"
        >
          <Send size={18} aria-hidden />
          Invia Email
        </button>
      </HubModalChromeFooter>
    </HubModalInnerCard>
  );
};

export default SendEmailConfirmModal;
