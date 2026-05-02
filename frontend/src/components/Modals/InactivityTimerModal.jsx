import React, { useState } from 'react';
import { Clock, Check } from 'lucide-react';
import { getStoredTechHubAccent, HUB_PAGE_BG, hubModalCssVars } from '../../utils/techHubAccent';
import {
  HubModalBackdrop,
  HubModalChromeHeader,
  HubModalBody,
  HubModalChromeFooter,
  HubModalSecondaryButton,
  HubModalPrimaryButton
} from './HubModalChrome';

const InactivityTimerModal = ({ closeModal, currentTimeout, onTimeoutChange }) => {
  const [selectedTimeout, setSelectedTimeout] = useState(currentTimeout || 3);

  const timeoutOptions = [
    { value: 1, label: '1 minuto' },
    { value: 3, label: '3 minuti' },
    { value: 6, label: '6 minuti' },
    { value: 30, label: '30 minuti' },
    { value: 0, label: 'Mai' }
  ];

  const handleSave = () => {
    onTimeoutChange(selectedTimeout);
    closeModal();
  };

  const accentHex = getStoredTechHubAccent();

  return (
    <HubModalBackdrop zClass="z-[118]">
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/[0.1] shadow-2xl"
        style={{ backgroundColor: HUB_PAGE_BG, ...hubModalCssVars(accentHex) }}
      >
        <HubModalChromeHeader
          icon={Clock}
          title="Timer Inattività"
          subtitle="Imposta il tempo di disconnessione automatica"
          onClose={closeModal}
        />

        <HubModalBody>
          <p className="mb-4 text-sm text-white/62">
            Seleziona dopo quanto tempo di inattività vuoi essere disconnesso automaticamente:
          </p>

          <div className="space-y-2">
            {timeoutOptions.map((option) => {
              const active = selectedTimeout === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedTimeout(option.value)}
                  className={`flex w-full items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition ${
                    active
                      ? 'border-[color:var(--hub-accent)] bg-white/[0.1] text-white'
                      : 'border-white/[0.1] bg-black/22 text-white/78 hover:border-white/20 hover:bg-white/[0.05]'
                  }`}
                >
                  <span className="font-medium">{option.label}</span>
                  {active && <Check size={20} className="text-[color:var(--hub-accent)]" aria-hidden />}
                </button>
              );
            })}
          </div>

          <div className={`mt-4 rounded-lg border border-sky-500/35 bg-sky-500/12 p-3 text-xs text-sky-50`}>
            <strong className="text-sky-100">Nota:</strong> Il timer si resetta automaticamente ad ogni interazione (click,
            movimento mouse, digitazione).
          </div>
        </HubModalBody>

        <HubModalChromeFooter className="flex gap-2">
          <HubModalSecondaryButton type="button" onClick={closeModal} className="flex-1">
            Annulla
          </HubModalSecondaryButton>
          <HubModalPrimaryButton type="button" onClick={handleSave} className="flex-1">
            Salva
          </HubModalPrimaryButton>
        </HubModalChromeFooter>
      </div>
    </HubModalBackdrop>
  );
};

export default InactivityTimerModal;
