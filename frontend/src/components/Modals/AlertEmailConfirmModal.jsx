import React from 'react';
import { Mail, Users, Crown, X, Building } from 'lucide-react';
import {
  HubModalInnerCard,
  HubModalChromeFooter,
  HubModalSecondaryButton,
  HubModalPrimaryButton
} from './HubModalChrome';
import { HUB_MODAL_NOTICE_NEUTRAL } from '../../utils/techHubAccent';

const optBase =
  'flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition';
const optIdle = 'border-white/[0.1] bg-black/[0.22] hover:border-[color:var(--hub-accent-border)] hover:bg-white/[0.05]';
const optSel = 'border-[color:var(--hub-accent)] bg-white/[0.1]';

const AlertEmailConfirmModal = ({ onConfirm, onCancel, users = [] }) => {
  const [selectedOption, setSelectedOption] = React.useState('all');
  const [selectedCompanies, setSelectedCompanies] = React.useState(() => new Set());

  const companies = React.useMemo(() => {
    const clienti = users.filter((u) => u.ruolo === 'cliente');
    const aziendeSet = new Set();
    clienti.forEach((c) => {
      if (c.azienda && c.azienda.trim() !== '') {
        aziendeSet.add(c.azienda);
      }
    });
    return Array.from(aziendeSet).sort((a, b) => a.localeCompare(b));
  }, [users]);

  const handleToggleCompany = (azienda) => {
    setSelectedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(azienda)) next.delete(azienda);
      else next.add(azienda);
      return next;
    });
  };

  const handleSelectAllCompanies = () => {
    if (selectedCompanies.size === companies.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(companies));
    }
  };

  const handleConfirm = () => {
    if (selectedOption === 'company') {
      if (selectedCompanies.size === 0) {
        alert("Seleziona almeno un'azienda");
        return;
      }
      onConfirm({ option: 'company', companies: Array.from(selectedCompanies) });
    } else {
      onConfirm(selectedOption);
    }
  };

  const Dot = ({ on }) => (
    <div
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
        on ? 'border-[color:var(--hub-accent)] bg-[color:var(--hub-accent)]' : 'border-white/25'
      }`}
    >
      {on && <div className="h-2 w-2 rounded-full bg-[#121212]" />}
    </div>
  );

  return (
    <HubModalInnerCard maxWidthClass="max-w-md w-full">
      <div className="border-b border-white/[0.08] px-6 py-5 text-white">
        <div className="text-center">
          <Mail size={44} className="mx-auto mb-3 text-[color:var(--hub-accent)]" aria-hidden />
          <h2 className="text-xl font-bold">Invio Email Avviso</h2>
        </div>
      </div>

      <div className="space-y-4 p-6 text-white">
        <div className={HUB_MODAL_NOTICE_NEUTRAL}>
          <p className="font-semibold text-white/92">Scegli i destinatari:</p>
          <p className="mt-1 text-white/62">Seleziona a chi inviare l'email per questo avviso.</p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setSelectedOption('all');
              setSelectedCompanies(new Set());
            }}
            className={`${optBase} ${selectedOption === 'all' ? optSel : optIdle}`}
          >
            <Dot on={selectedOption === 'all'} />
            <Users size={20} className="shrink-0 text-[color:var(--hub-accent)]" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white">Invia a tutti</div>
              <div className="text-xs text-white/52">Amministratori e clienti</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedOption('admins');
              setSelectedCompanies(new Set());
            }}
            className={`${optBase} ${selectedOption === 'admins' ? optSel : optIdle}`}
          >
            <Dot on={selectedOption === 'admins'} />
            <Crown size={20} className="shrink-0 text-amber-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white">Solo amministratori</div>
              <div className="text-xs text-white/52">Solo clienti amministratori</div>
            </div>
          </button>

          <button type="button" onClick={() => setSelectedOption('company')} className={`${optBase} ${selectedOption === 'company' ? optSel : optIdle}`}>
            <Dot on={selectedOption === 'company'} />
            <Building size={20} className="shrink-0 text-sky-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white">Per azienda</div>
              <div className="text-xs text-white/52">Seleziona una o più aziende specifiche</div>
            </div>
          </button>

          {selectedOption === 'company' && (
            <div className="mb-4 ml-8 mt-2 max-h-60 overflow-y-auto rounded-lg border border-white/[0.12] bg-black/[0.25] p-3">
              {companies.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={handleSelectAllCompanies}
                    className="mb-2 w-full rounded px-2 py-1 text-left text-sm font-semibold text-[color:var(--hub-accent)] hover:bg-white/[0.06]"
                  >
                    {selectedCompanies.size === companies.length ? 'Deseleziona tutte' : 'Seleziona tutte'}
                  </button>
                  <div className="space-y-2">
                    {companies.map((azienda) => (
                      <label
                        key={azienda}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/[0.06]"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCompanies.has(azienda)}
                          onChange={() => handleToggleCompany(azienda)}
                          className="h-4 w-4 rounded border-white/30 bg-black/40 accent-[color:var(--hub-accent)]"
                        />
                        <span className="text-sm text-white/82">{azienda}</span>
                      </label>
                    ))}
                  </div>
                  {selectedCompanies.size > 0 && (
                    <div className="mt-2 border-t border-white/[0.1] pt-2 text-xs font-semibold text-white/72">
                      {selectedCompanies.size} azienda{selectedCompanies.size > 1 ? 'e' : ''} selezionata
                      {selectedCompanies.size > 1 ? 'e' : ''}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-2 text-center text-sm text-white/45">Nessuna azienda disponibile</div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setSelectedOption('none');
              setSelectedCompanies(new Set());
            }}
            className={`${optBase} ${selectedOption === 'none' ? optSel : optIdle}`}
          >
            <Dot on={selectedOption === 'none'} />
            <X size={20} className="shrink-0 text-white/55" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-white">Non inviare</div>
              <div className="text-xs text-white/52">Nessuna email verrà inviata</div>
            </div>
          </button>
        </div>
      </div>

      <HubModalChromeFooter className="gap-3 [&>button]:flex-1">
        <HubModalSecondaryButton type="button" onClick={onCancel} className="flex-1 py-3">
          Annulla
        </HubModalSecondaryButton>
        <HubModalPrimaryButton type="button" onClick={handleConfirm} className="flex flex-1 items-center justify-center gap-2 py-3 font-bold">
          <Mail size={18} aria-hidden />
          Conferma
        </HubModalPrimaryButton>
      </HubModalChromeFooter>
    </HubModalInnerCard>
  );
};

export default AlertEmailConfirmModal;
