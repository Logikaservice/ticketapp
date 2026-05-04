import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { HubModalInnerCard, HubModalChromeFooter } from './HubModalChrome';
import { HUB_MODAL_NOTICE_WARN } from '../../utils/techHubAccent';

const EmptyDescriptionConfirmModal = ({ handleConfirmEmptyDescription, closeModal }) => {
  return (
    <HubModalInnerCard maxWidthClass="max-w-sm w-full">
      <div className="p-6 pb-4 text-[color:var(--hub-chrome-text)]">
        <div className="mb-4 text-center">
          <AlertTriangle
            size={44}
            className="mx-auto mb-3 text-[color:var(--hub-chrome-tone-warn-icon)]"
            aria-hidden
          />
          <h2 className="text-xl font-bold text-[color:var(--hub-chrome-text)]">Descrizione Vuota</h2>
        </div>

        <div className={`mb-6 ${HUB_MODAL_NOTICE_WARN}`}>
          <p className="m-0 font-semibold">Attenzione:</p>
          <p className="m-0 mt-1 opacity-95">
            Non hai inserito nessuna descrizione. Vuoi procedere comunque?
          </p>
        </div>
      </div>

      <HubModalChromeFooter className="justify-stretch [&>button]:flex-1">
        <button
          type="button"
          onClick={closeModal}
          className="rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-muted-fill)] px-4 py-3 text-sm font-medium text-[color:var(--hub-chrome-text)] transition hover:bg-[color:var(--hub-chrome-hover)]"
        >
          Torna indietro
        </button>
        <button
          type="button"
          onClick={handleConfirmEmptyDescription}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-500"
        >
          <Check size={18} aria-hidden />
          Continua
        </button>
      </HubModalChromeFooter>
    </HubModalInnerCard>
  );
};

export default EmptyDescriptionConfirmModal;
