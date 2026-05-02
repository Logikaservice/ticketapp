import React, { useState, useRef, useEffect } from 'react';
import { X, UserPlus, Building2, CheckCircle2, ChevronDown, Check } from 'lucide-react';
import {
  getStoredTechHubAccent,
  HUB_PAGE_BG,
  HUB_SURFACE,
  hexToRgba,
  readableOnAccent,
  hubModalCssVars,
  HUB_MODAL_LABEL_CLS,
  HUB_MODAL_FIELD_CLS
} from '../../utils/techHubAccent';

const NewClientModal = ({
  newClientData,
  setNewClientData,
  onClose,
  onSave,
  existingCompanies = []
}) => {
  const selectedCompany = newClientData.useExistingCompany
    ? newClientData.existingCompany
    : newClientData.azienda;
  const canUseExisting = existingCompanies.length > 0;
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const handleCompanyModeChange = (useExisting) => {
    setNewClientData({
      ...newClientData,
      useExistingCompany: useExisting
    });
    if (!useExisting) {
      setShowCompanyDropdown(false);
    }
  };

  const handleAdminToggle = () => {
    setNewClientData({ ...newClientData, isAdmin: !newClientData.isAdmin });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  useEffect(() => {
    if (!showCompanyDropdown) return;
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCompanyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCompanyDropdown]);

  useEffect(() => {
    if (!newClientData.useExistingCompany) {
      setShowCompanyDropdown(false);
    }
  }, [newClientData.useExistingCompany]);

  const accentHex = getStoredTechHubAccent();

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.1] shadow-2xl"
        style={{ backgroundColor: HUB_PAGE_BG, ...hubModalCssVars(accentHex) }}
      >
        <div className="shrink-0 border-b border-white/[0.08] px-6 py-5" style={{ backgroundColor: HUB_SURFACE }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl md:h-12 md:w-12"
                style={{ backgroundColor: hexToRgba(accentHex, 0.2), color: accentHex }}
              >
                <UserPlus size={24} aria-hidden className="md:h-[26px] md:w-[26px]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-white md:text-2xl">Nuovo contatto</h2>
                <p className="mt-0.5 text-sm text-white/55">Crea un nuovo cliente nel sistema</p>
              </div>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="shrink-0 rounded-lg bg-white/10 p-2 text-white ring-1 ring-white/15 transition hover:bg-white/16"
              aria-label="Chiudi"
            >
              <X size={22} aria-hidden />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            
            {/* Nome e Cognome sulla stessa riga */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={HUB_MODAL_LABEL_CLS}>
                  Nome <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newClientData.nome}
                  onChange={(e) => setNewClientData({ ...newClientData, nome: e.target.value })}
                  placeholder="Mario"
                  className={HUB_MODAL_FIELD_CLS}
                  required
                />
              </div>

              <div>
                <label className={HUB_MODAL_LABEL_CLS}>
                  Cognome <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newClientData.cognome}
                  onChange={(e) => setNewClientData({ ...newClientData, cognome: e.target.value })}
                  placeholder="Rossi"
                  className={HUB_MODAL_FIELD_CLS}
                  required
                />
              </div>
            </div>

            {/* Email e Password sulla stessa riga */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={HUB_MODAL_LABEL_CLS}>
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={newClientData.email}
                  onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                  placeholder="cliente@esempio.com"
                  className={HUB_MODAL_FIELD_CLS}
                  required
                />
              </div>

              <div>
                <label className={HUB_MODAL_LABEL_CLS}>
                  Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newClientData.password}
                  onChange={(e) => setNewClientData({ ...newClientData, password: e.target.value })}
                  placeholder="Password visibile"
                  className={`${HUB_MODAL_FIELD_CLS} font-mono`}
                  required
                />
              </div>
            </div>

            {/* Azienda */}
            <div className="space-y-3">
              <label className={`${HUB_MODAL_LABEL_CLS} mb-3`}>
                Azienda <span className="text-red-400">*</span>
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    !newClientData.useExistingCompany
                      ? '[border-color:var(--hub-accent-border)] shadow-[inset_0_0_0_1px_var(--hub-accent-border)]'
                      : 'border-white/[0.12] bg-black/20 text-white/75 hover:bg-white/[0.06]'
                  }`}
                  onClick={() => handleCompanyModeChange(false)}
                  style={
                    !newClientData.useExistingCompany
                      ? {
                          backgroundColor: hexToRgba(accentHex, 0.18),
                          color: readableOnAccent(accentHex)
                        }
                      : undefined
                  }
                >
                  Nuova azienda
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    newClientData.useExistingCompany
                      ? 'shadow-[inset_0_0_0_1px_var(--hub-accent-border)]'
                      : 'border-white/[0.12] bg-black/20 text-white/75 hover:bg-white/[0.06]'
                  } ${!canUseExisting ? 'cursor-not-allowed opacity-55' : ''}`}
                  onClick={() => canUseExisting && handleCompanyModeChange(true)}
                  disabled={!canUseExisting}
                  style={
                    newClientData.useExistingCompany
                      ? {
                          backgroundColor: hexToRgba(accentHex, 0.18),
                          borderColor: hexToRgba(accentHex, 0.5),
                          color: readableOnAccent(accentHex)
                        }
                      : undefined
                  }
                >
                  <Building2 size={18} aria-hidden />
                  Azienda esistente
                </button>
              </div>

              {newClientData.useExistingCompany ? (
                <div ref={dropdownRef} className="relative">
                  {/* Select nascosto per validazione form */}
                  <select
                    value={newClientData.existingCompany}
                    onChange={() => {}}
                    className="sr-only"
                    required
                  >
                    <option value="">Seleziona un'azienda...</option>
                    {existingCompanies.map(azienda => (
                      <option key={azienda} value={azienda}>{azienda}</option>
                    ))}
                  </select>
                  
                  {/* Button che simula il select */}
                  <button
                    type="button"
                    onClick={() => canUseExisting && setShowCompanyDropdown(prev => !prev)}
                    disabled={!canUseExisting}
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-2 text-left text-sm transition ${
                      canUseExisting
                        ? `${HUB_MODAL_FIELD_CLS} cursor-pointer`
                        : 'cursor-not-allowed border-white/[0.08] bg-black/20 text-white/35'
                    }`}
                  >
                    <span className={newClientData.existingCompany ? 'text-white' : 'text-white/42'}>
                      {newClientData.existingCompany || "Seleziona un'azienda..."}
                    </span>
                    <ChevronDown
                      size={18}
                      className={`text-white/45 transition-transform ${showCompanyDropdown ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                  </button>

                  {showCompanyDropdown && canUseExisting && (
                    <div className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-white/[0.12] bg-[#1E1E1E] shadow-2xl">
                      {existingCompanies.map((azienda) => {
                        const isSelected = newClientData.existingCompany === azienda;
                        return (
                          <button
                            type="button"
                            key={azienda}
                            onClick={() => {
                              setNewClientData({ ...newClientData, existingCompany: azienda });
                              setShowCompanyDropdown(false);
                            }}
                            className={`flex w-full items-center justify-between border-l-4 px-3 py-1.5 text-left transition ${
                              isSelected
                                ? 'border-[color:var(--hub-accent)] bg-white/[0.08]'
                                : 'border-transparent hover:bg-white/[0.05]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1 ring-white/15"
                                style={{
                                  backgroundColor: hexToRgba(accentHex, 0.25),
                                  color: readableOnAccent(accentHex)
                                }}
                              >
                                {azienda.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-white/90">{azienda}</span>
                            </div>
                            {isSelected && (
                              <Check size={16} className="flex-shrink-0 text-[color:var(--hub-accent)]" aria-hidden />
                            )}
                          </button>
                        );
                      })}
                      {existingCompanies.length === 0 && (
                        <div className="px-4 py-3 text-sm text-white/50">Nessuna azienda disponibile.</div>
                      )}
                    </div>
                  )}
                  {!canUseExisting && (
                    <p className="mt-2 text-xs text-white/45">
                      Nessuna azienda disponibile. Aggiungine una nuova per poterla riutilizzare.
                    </p>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={newClientData.azienda}
                  onChange={(e) => setNewClientData({ ...newClientData, azienda: e.target.value })}
                  placeholder="Nome dell'azienda"
                  className={HUB_MODAL_FIELD_CLS}
                  required
                />
              )}
            </div>

            {/* Ruolo amministratore */}
            <div
              className={`rounded-xl border border-white/[0.1] bg-black/[0.22] p-4 ${!selectedCompany ? 'opacity-55' : ''}`}
            >
              <div className="flex items-start gap-3">
                <input
                  id="isAdmin"
                  type="checkbox"
                  className="mt-1 h-5 w-5 rounded border-white/30 bg-black/40 accent-[color:var(--hub-accent)] focus:ring-[color:var(--hub-accent)]"
                  checked={newClientData.isAdmin}
                  onChange={handleAdminToggle}
                  disabled={!selectedCompany}
                />
                <label htmlFor="isAdmin" className="flex-1 cursor-pointer">
                  <span className="flex items-center gap-2 font-semibold text-white/90">
                    <CheckCircle2 size={18} className="text-[color:var(--hub-accent)]" aria-hidden />
                    Rendi questo utente amministratore
                  </span>
                  <p className="mt-1 text-sm text-white/52">
                    Potrà gestire gli altri utenti dell'azienda selezionata
                    {selectedCompany ? ` (${selectedCompany})` : ''} e visualizzare tutti i ticket associati.
                  </p>
                </label>
              </div>
            </div>

            <div>
              <label className={HUB_MODAL_LABEL_CLS}>
                Telefono <span className="text-xs text-white/40">(opzionale)</span>
              </label>
              <input
                type="tel"
                value={newClientData.telefono}
                onChange={(e) => setNewClientData({ ...newClientData, telefono: e.target.value })}
                placeholder="+39 123 456 7890"
                className={HUB_MODAL_FIELD_CLS}
              />
            </div>

          </div>

          <div
            className="mt-6 rounded-lg border px-4 py-3"
            style={{ borderColor: hexToRgba(accentHex, 0.28), backgroundColor: hexToRgba(accentHex, 0.1) }}
          >
            <p className="text-sm text-white/82">
              <strong className="text-white">Nota:</strong> I campi contrassegnati con{' '}
              <span className="text-red-400">*</span> sono obbligatori. La password sarà visibile in chiaro per facilitare la
              registrazione.
            </p>
          </div>

          <div
            className="mt-6 flex flex-shrink-0 flex-wrap justify-end gap-2 border-t border-white/[0.08] pt-6"
          >
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/[0.1] px-6 py-2 text-sm font-medium text-white transition hover:bg-white/[0.14]"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold transition hover:brightness-110"
              style={{ backgroundColor: accentHex, color: readableOnAccent(accentHex) }}
            >
              <UserPlus size={18} aria-hidden />
              Crea contatto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewClientModal;
