import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { HubModalInnerCard, HubModalChromeFooter } from './HubModalChrome';
import { HUB_MODAL_NOTICE_WARN } from '../../utils/techHubAccent';

const EmptyDescriptionConfirmModal = ({ handleConfirmEmptyDescription, closeModal }) => {
  return (
    <HubModalInnerCard maxWidthClass="max-w-sm w-full">
      <div className="p-6 pb-4 text-white">
        <div className="mb-4 text-center">
          <AlertTriangle size={44} className="mx-auto mb-3 text-amber-400" aria-hidden />
          <h2 className="text-xl font-bold text-white">Descrizione Vuota</h2>
        </div>

        <div className={`mb-6 ${HUB_MODAL_NOTICE_WARN}`}>
          <p className="font-semibold">Attenzione:</p>
          <p className="mt-1 text-amber-50/90">Non hai inserito nessuna descrizione. Vuoi procedere comunque?</p>
        </div>
      </div>

      <HubModalChromeFooter className="justify-stretch [&>button]:flex-1">
        <button
          type="button"
          onClick={closeModal}
          className="rounded-lg bg-white/[0.1] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.14]"
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
