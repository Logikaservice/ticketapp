import React, { useState } from 'react';
import { Settings, Download, Bell, Shield, Palette } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import {
  TECH_HUB_ACCENT_PALETTE,
  STORAGE_KEY_TECH_HUB_ACCENT,
  getStoredTechHubAccent,
  HUB_MODAL_LABEL_CLS,
  HUB_MODAL_FIELD_CLS,
  hexToRgba
} from '../../utils/techHubAccent';
import {
  HubModalInnerCard,
  HubModalChromeHeader,
  HubModalBody,
  HubModalChromeFooter,
  HubModalSecondaryButton,
  HubModalPrimaryButton
} from './HubModalChrome';

const SettingsModal = ({ settingsData, setSettingsData, handleUpdateSettings, closeModal, currentUser }) => {
  const [ticketAccentHex, setTicketAccentHex] = useState(getStoredTechHubAccent);

  const persistTicketAccent = (hex) => {
    try {
      localStorage.setItem(STORAGE_KEY_TECH_HUB_ACCENT, hex);
    } catch (_) {
      /* ignore */
    }
    setTicketAccentHex(hex);

    // Persistenza cross-device (best-effort)
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        fetch(buildApiUrl('/api/user-preferences/tech-hub'), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ accentHex: hex })
        }).catch(() => {});
      }
    } catch (_) {
      /* ignore */
    }
  };

  return (
    <HubModalInnerCard
      accentHex={ticketAccentHex}
      maxWidthClass="max-w-2xl w-full"
      className="flex max-h-[90vh] flex-col"
    >
      <HubModalChromeHeader
        icon={Settings}
        title="Impostazioni"
        subtitle="Gestisci i tuoi dati personali"
        onClose={closeModal}
      />

      <HubModalBody className="space-y-4">
        <div>
          <label className={`${HUB_MODAL_LABEL_CLS} font-bold text-[color:var(--hub-chrome-text)]`}>Azienda</label>
          <input
            type="text"
            value={settingsData.azienda}
            onChange={(e) => setSettingsData({ ...settingsData, azienda: e.target.value })}
            className={HUB_MODAL_FIELD_CLS}
            placeholder="Nome azienda"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={HUB_MODAL_LABEL_CLS}>Nome</label>
            <input
              type="text"
              value={settingsData.nome}
              onChange={(e) => setSettingsData({ ...settingsData, nome: e.target.value })}
              className={HUB_MODAL_FIELD_CLS}
            />
          </div>
          <div>
            <label className={HUB_MODAL_LABEL_CLS}>Cognome</label>
            <input
              type="text"
              value={settingsData.cognome || ''}
              onChange={(e) => setSettingsData({ ...settingsData, cognome: e.target.value })}
              className={HUB_MODAL_FIELD_CLS}
            />
          </div>
        </div>

        <div>
          <label className={HUB_MODAL_LABEL_CLS}>Email</label>
          <input
            type="email"
            value={settingsData.email}
            onChange={(e) => setSettingsData({ ...settingsData, email: e.target.value })}
            className={HUB_MODAL_FIELD_CLS}
          />
        </div>

        <div className="border-t border-[color:var(--hub-chrome-border-soft)] pt-4">
          <h3 className="mb-3 text-sm font-bold text-[color:var(--hub-chrome-text)]">Password</h3>
          <div className="space-y-3">
            <div>
              <label className={HUB_MODAL_LABEL_CLS}>Password Attuale</label>
              <input
                type="text"
                value={settingsData.passwordAttuale}
                readOnly
                className={`${HUB_MODAL_FIELD_CLS} bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-chrome-text-muted)]`}
                placeholder="Password attuale"
              />
              <p className="mt-1 text-xs text-[color:var(--hub-chrome-text-faint)]">Password attualmente in uso</p>
            </div>
            {currentUser?.ruolo !== 'cliente' && (
              <div>
                <label className={HUB_MODAL_LABEL_CLS}>Nuova Password</label>
                <input
                  type="text"
                  value={settingsData.nuovaPassword}
                  onChange={(e) => setSettingsData({ ...settingsData, nuovaPassword: e.target.value })}
                  className={HUB_MODAL_FIELD_CLS}
                  placeholder="Lascia vuoto per non modificare"
                />
                <p className="mt-1 text-xs text-[color:var(--hub-chrome-text-faint)]">Lascia vuoto se non vuoi cambiare la password</p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[color:var(--hub-chrome-border-soft)] pt-4">
          <h3 className="mb-3 text-sm font-bold text-[color:var(--hub-chrome-text)]">Dati Aggiuntivi</h3>
          <div>
            <label className={HUB_MODAL_LABEL_CLS}>Telefono</label>
            <input
              type="tel"
              value={settingsData.telefono}
              onChange={(e) => setSettingsData({ ...settingsData, telefono: e.target.value })}
              className={HUB_MODAL_FIELD_CLS}
              placeholder="+39 123 456 7890"
            />
          </div>
        </div>

        <div className="border-t border-[color:var(--hub-chrome-border-soft)] pt-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-[color:var(--hub-chrome-text)]">
            <Palette size={16} className="text-[color:var(--hub-accent)]" aria-hidden />
            Colore tema ticket
          </h3>
          <p className="mb-3 text-xs text-[color:var(--hub-chrome-text-faint)]">
            All'inizio vale il predefinito; se scegli un colore resta salvato su questo browser (uguale per tecnico e cliente).
          </p>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {TECH_HUB_ACCENT_PALETTE.map((c) => {
              const active = ticketAccentHex.toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => persistTicketAccent(c.hex)}
                  className={`aspect-square rounded-lg border-2 border-white/[0.12] transition hover:opacity-90 ${
                    active ? 'ring-2 ring-white ring-offset-2 ring-offset-[#121212] scale-[1.02]' : ''
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              );
            })}
          </div>
        </div>

        {currentUser?.ruolo === 'tecnico' && (
          <div className="border-t border-[color:var(--hub-chrome-border-soft)] pt-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[color:var(--hub-chrome-text)]">
              <Shield size={16} className="text-red-400" aria-hidden />
              Sicurezza Accesso
            </h3>
            <div className="rounded-xl border border-red-500/35 bg-red-500/12 p-4">
              <p className="mb-3 text-sm text-[color:var(--hub-chrome-text-secondary)]">
                Inserisci il tuo <strong className="text-[color:var(--hub-chrome-text)]">IP statico</strong>. Se accedi da un IP diverso, riceverai una{' '}
                <strong className="text-[color:var(--hub-chrome-text)]">notifica Telegram</strong>.
              </p>
              <div>
                <label className={HUB_MODAL_LABEL_CLS}>IP Statico autorizzato</label>
                <input
                  type="text"
                  value={settingsData.ip_statico || ''}
                  onChange={(e) => setSettingsData({ ...settingsData, ip_statico: e.target.value })}
                  className={`${HUB_MODAL_FIELD_CLS} border-red-500/25 font-mono text-sm`}
                  placeholder="es. 151.34.22.10"
                />
                <p className="mt-1 text-xs text-[color:var(--hub-chrome-text-faint)]">
                  Lascia vuoto per disabilitare. Puoi trovare il tuo IP su <strong className="text-[color:var(--hub-chrome-text)]">whatismyip.com</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {currentUser?.ruolo === 'cliente' && (
          <div className="border-t border-[color:var(--hub-chrome-border-soft)] pt-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[color:var(--hub-chrome-text)]">
              <Bell size={16} className="text-violet-400" aria-hidden />
              Communication Agent
            </h3>
            <div className="rounded-xl border border-violet-500/35 bg-violet-500/10 p-4">
              <p className="mb-3 text-sm text-[color:var(--hub-chrome-text-secondary)]">
                Installa il Communication Agent sul tuo PC per ricevere le notifiche dal team Logika Service in tempo reale.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const token = localStorage.getItem('authToken');
                    window.open(buildApiUrl('/api/comm-agent/download-agent') + '?token=' + token, '_blank');
                  }}
                  className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
                  style={{
                    backgroundImage: `linear-gradient(to right, ${hexToRgba('#7c3aed', 1)}, ${hexToRgba('#6366f1', 1)})`
                  }}
                >
                  <Download size={16} aria-hidden />
                  Scarica Agent
                </button>
                <span className="text-xs text-[color:var(--hub-chrome-text-faint)]">Pacchetto ZIP con installer automatico</span>
              </div>
            </div>
          </div>
        )}
      </HubModalBody>

      <HubModalChromeFooter className="justify-end gap-2">
        <HubModalSecondaryButton type="button" onClick={closeModal}>
          Annulla
        </HubModalSecondaryButton>
        <HubModalPrimaryButton type="button" onClick={handleUpdateSettings}>
          Salva
        </HubModalPrimaryButton>
      </HubModalChromeFooter>
    </HubModalInnerCard>
  );
};

export default SettingsModal;
