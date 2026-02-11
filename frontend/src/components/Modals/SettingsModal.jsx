import React from 'react';
import { X, Settings, Download, Bell } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';

const SettingsModal = ({ settingsData, setSettingsData, handleUpdateSettings, closeModal, currentUser }) => {


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">

        {/* Header con lo stile giallo sfumato */}
        <div className="p-6 border-b bg-gradient-to-r from-yellow-500 to-amber-500 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Settings size={28} />
                Impostazioni
              </h2>
              <p className="text-yellow-100 text-sm mt-1">
                Gestisci i tuoi dati personali
              </p>
            </div>
            <button
              onClick={closeModal}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
            >
              <X size={24} />
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
                      const token = localStorage.getItem('token');
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