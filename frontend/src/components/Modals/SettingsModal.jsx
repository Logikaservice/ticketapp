import React, { useState } from 'react';
import { X, Settings, Download, Bell, Shield, Palette } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import {
  TECH_HUB_ACCENT_PALETTE,
  STORAGE_KEY_TECH_HUB_ACCENT,
  getStoredTechHubAccent,
  techHubAccentModalHeaderStyle
} from '../../utils/techHubAccent';

const SettingsModal = ({ settingsData, setSettingsData, handleUpdateSettings, closeModal, currentUser }) => {
  const [ticketAccentHex, setTicketAccentHex] = useState(getStoredTechHubAccent);

  const persistTicketAccent = (hex) => {
    try {
      localStorage.setItem(STORAGE_KEY_TECH_HUB_ACCENT, hex);
    } catch (_) {
      /* ignore */
    }
    setTicketAccentHex(hex);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">

        {/* Header: accento tema Hub (preview colore mentre scegli dalla palette) */}
        <div
          className="rounded-t-2xl border-b border-black/10 p-6"
          style={techHubAccentModalHeaderStyle(ticketAccentHex)}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                <Settings size={28} className="shrink-0 opacity-95" aria-hidden />
                Impostazioni
              </h2>
              <p className="mt-1 text-sm opacity-90">
                Gestisci i tuoi dati personali
              </p>
            </div>
            <button
              onClick={closeModal}
              type="button"
              className="rounded-lg bg-black/20 p-2 ring-1 ring-black/10 transition hover:bg-black/30"
              aria-label="Chiudi"
            >
              <X size={24} aria-hidden />
            </button>
          </div>
        </div>

        {/* Form per l'inserimento dei dati */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 font-bold">Azienda</label>
            <input
              type="text"
              value={settingsData.azienda}
              onChange={(e) => setSettingsData({ ...settingsData, azienda: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="Nome azienda"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                type="text"
                value={settingsData.nome}
                onChange={(e) => setSettingsData({ ...settingsData, nome: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
              <input
                type="text"
                value={settingsData.cognome || ''}
                onChange={(e) => setSettingsData({ ...settingsData, cognome: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={settingsData.email}
              onChange={(e) => setSettingsData({ ...settingsData, email: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>

          {/* Gestione Password - Sotto Email */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-bold mb-3">Password</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Attuale</label>
                <input
                  type="text"
                  value={settingsData.passwordAttuale}
                  readOnly
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-600"
                  placeholder="Password attuale"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Password attualmente in uso
                </p>
              </div>
              {/* Mostra campo nuova password solo per tecnici */}
              {currentUser?.ruolo !== 'cliente' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nuova Password</label>
                  <input
                    type="text"
                    value={settingsData.nuovaPassword}
                    onChange={(e) => setSettingsData({ ...settingsData, nuovaPassword: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    placeholder="Lascia vuoto per non modificare"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lascia vuoto se non vuoi cambiare la password
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Dati Aggiuntivi */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-bold mb-3">Dati Aggiuntivi</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
              <input
                type="tel"
                value={settingsData.telefono}
                onChange={(e) => setSettingsData({ ...settingsData, telefono: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                placeholder="+39 123 456 7890"
              />
            </div>
          </div>

          {/* Colore tema ticket (stesso storage Hub + modale creazione ticket) */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
              <Palette size={16} className="text-amber-600" />
              Colore tema ticket
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              All’inizio vale il predefinito; se scegli un colore resta salvato su questo browser (uguale per tecnico e cliente).
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
                    className={`aspect-square rounded-lg border-2 transition hover:opacity-90 ${
                      active ? 'ring-2 ring-offset-2 ring-gray-800 scale-[1.02]' : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                );
              })}
            </div>
          </div>

          {/* IP Statico - solo per tecnici */}
          {currentUser?.ruolo === 'tecnico' && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Shield size={16} className="text-red-500" />
                Sicurezza Accesso
              </h3>
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-3">
                  Inserisci il tuo <strong>IP statico</strong> (es. IP dell'adsl di casa/ufficio).
                  Se accedi da un IP diverso, riceverai una <strong>notifica Telegram</strong>.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IP Statico autorizzato</label>
                  <input
                    type="text"
                    value={settingsData.ip_statico || ''}
                    onChange={(e) => setSettingsData({ ...settingsData, ip_statico: e.target.value })}
                    className="w-full px-3 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent font-mono text-sm"
                    placeholder="es. 151.34.22.10"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lascia vuoto per disabilitare il controllo. Puoi trovare il tuo IP su <strong>whatismyip.com</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Download Communication Agent - solo per clienti */}
          {currentUser?.ruolo === 'cliente' && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Bell size={16} className="text-purple-500" />
                Communication Agent
              </h3>
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-3">
                  Installa il Communication Agent sul tuo PC per ricevere le notifiche dal team Logika Service in tempo reale.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const token = localStorage.getItem('authToken');
                      window.open(buildApiUrl('/api/comm-agent/download-agent') + '?token=' + token, '_blank');
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition shadow-md text-sm font-semibold"
                  >
                    <Download size={16} />
                    Scarica Agent
                  </button>
                  <span className="text-xs text-gray-500">
                    Pacchetto ZIP con installer automatico
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer con i pulsanti */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
          <div className="flex justify-end gap-2">
            <button
              onClick={closeModal}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition"
            >
              Annulla
            </button>
            <button
              onClick={handleUpdateSettings}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
            >
              Salva
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;