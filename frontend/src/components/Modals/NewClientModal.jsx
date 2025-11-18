import React from 'react';
import { X, UserPlus, Building2, CheckCircle2 } from 'lucide-react';

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

  const handleCompanyModeChange = (useExisting) => {
    setNewClientData({
      ...newClientData,
      useExistingCompany: useExisting
    });
  };

  const handleAdminToggle = () => {
    setNewClientData({ ...newClientData, isAdmin: !newClientData.isAdmin });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <UserPlus size={28} />
                Nuovo Cliente
              </h2>
              <p className="text-green-100 text-sm mt-1">
                Compila i dati per creare un nuovo cliente
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            
            {/* Nome e Cognome sulla stessa riga */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newClientData.nome}
                  onChange={(e) => setNewClientData({ ...newClientData, nome: e.target.value })}
                  placeholder="Mario"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cognome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newClientData.cognome}
                  onChange={(e) => setNewClientData({ ...newClientData, cognome: e.target.value })}
                  placeholder="Rossi"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Email e Password sulla stessa riga */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newClientData.email}
                  onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                  placeholder="cliente@esempio.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newClientData.password}
                  onChange={(e) => setNewClientData({ ...newClientData, password: e.target.value })}
                  placeholder="Password visibile"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                  required
                />
              </div>
            </div>

            {/* Azienda */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Azienda <span className="text-red-500">*</span>
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={`px-4 py-2 rounded-lg border transition ${
                    !newClientData.useExistingCompany
                      ? 'bg-green-600 border-green-600 text-white shadow'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                  onClick={() => handleCompanyModeChange(false)}
                >
                  Nuova azienda
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-lg border transition flex items-center gap-2 ${
                    newClientData.useExistingCompany
                      ? 'bg-green-600 border-green-600 text-white shadow'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  } ${!canUseExisting ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={() => canUseExisting && handleCompanyModeChange(true)}
                  disabled={!canUseExisting}
                >
                  <Building2 size={18} />
                  Azienda esistente
                </button>
              </div>

              {newClientData.useExistingCompany ? (
                <div>
                  <select
                    value={newClientData.existingCompany}
                    onChange={(e) => setNewClientData({ ...newClientData, existingCompany: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  >
                    <option value="">Seleziona un'azienda...</option>
                    {existingCompanies.map(azienda => (
                      <option key={azienda} value={azienda}>
                        {azienda}
                      </option>
                    ))}
                  </select>
                  {!canUseExisting && (
                    <p className="text-xs text-gray-500 mt-2">
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              )}
            </div>

            {/* Ruolo amministratore */}
            <div
              className={`flex items-start gap-3 p-4 border rounded-xl bg-gray-50 ${
                !selectedCompany ? 'opacity-60' : ''
              }`}
            >
              <input
                id="isAdmin"
                type="checkbox"
                className="mt-1 h-5 w-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                checked={newClientData.isAdmin}
                onChange={handleAdminToggle}
                disabled={!selectedCompany}
              />
              <label htmlFor="isAdmin" className="flex-1 cursor-pointer">
                <span className="flex items-center gap-2 font-semibold text-gray-800">
                  <CheckCircle2 size={18} className="text-green-600" />
                  Rendi questo utente amministratore
                </span>
                <p className="text-sm text-gray-600 mt-1">
                  Potrà gestire gli altri utenti dell'azienda selezionata{selectedCompany ? ` (${selectedCompany})` : ''} e
                  visualizzare tutti i ticket associati.
                </p>
              </label>
            </div>

            {/* Telefono (opzionale) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefono <span className="text-gray-400 text-xs">(opzionale)</span>
              </label>
              <input
                type="tel"
                value={newClientData.telefono}
                onChange={(e) => setNewClientData({ ...newClientData, telefono: e.target.value })}
                placeholder="+39 123 456 7890"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> I campi contrassegnati con <span className="text-red-500">*</span> sono obbligatori.
              La password sarà visibile in chiaro per facilitare la registrazione.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              <UserPlus size={18} />
              Crea Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewClientModal;
