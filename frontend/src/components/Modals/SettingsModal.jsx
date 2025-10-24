import React from 'react';
import { X, Settings } from 'lucide-react';

const SettingsModal = ({ settingsData, setSettingsData, handleUpdateSettings, closeModal }) => {


  return (
    <div className="bg-white rounded-xl max-w-2xl w-full p-6">
      <div className="flex items-center justify-between mb-6 border-b pb-3">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings size={24} />
          Impostazioni
        </h2>
        <button onClick={closeModal} className="text-gray-400">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Nome</label>
          <input
            type="text"
            value={settingsData.nome}
            onChange={(e) => setSettingsData({ ...settingsData, nome: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            value={settingsData.email}
            onChange={(e) => setSettingsData({ ...settingsData, email: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Telefono</label>
          <input
            type="tel"
            value={settingsData.telefono}
            onChange={(e) => setSettingsData({ ...settingsData, telefono: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="+39 123 456 7890"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Azienda</label>
          <input
            type="text"
            value={settingsData.azienda}
            onChange={(e) => setSettingsData({ ...settingsData, azienda: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Nome azienda"
          />
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-bold mb-3">Cambia Password</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Nuova Password</label>
              <input
                type="password"
                value={settingsData.nuovaPassword}
                onChange={(e) => setSettingsData({ ...settingsData, nuovaPassword: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Lascia vuoto per non modificare"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lascia vuoto se non vuoi cambiare la password
              </p>
            </div>
          </div>
        </div>


        <div className="flex gap-3 pt-2">
          <button onClick={closeModal} className="flex-1 px-4 py-3 border rounded-lg">
            Annulla
          </button>
          <button onClick={handleUpdateSettings} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold">
            Salva
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;