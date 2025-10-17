import React, { useState } from 'react';
import { X, Edit2, Save, Trash2, Mail, Phone, Building, Lock } from 'lucide-react';

const ManageClientsModal = ({ clienti, onClose, onUpdateClient, onDeleteClient }) => {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  // Ordina clienti alfabeticamente per azienda, poi per nome
  const clientiOrdinati = [...clienti].sort((a, b) => {
    const nomeA = (a.azienda || a.nome || '').toLowerCase();
    const nomeB = (b.azienda || b.nome || '').toLowerCase();
    return nomeA.localeCompare(nomeB);
  });

  const handleStartEdit = (cliente) => {
    setEditingId(cliente.id);
    setEditData({
      nome: cliente.nome || '',
      cognome: cliente.cognome || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      azienda: cliente.azienda || '',
      password: cliente.password || ''
    });
  };

  const handleSave = (id) => {
    const dataToSend = { ...editData };
    if (!dataToSend.password || dataToSend.password.trim() === '') {
      delete dataToSend.password;
    }
    
    onUpdateClient(id, dataToSend);
    setEditingId(null);
    setEditData({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleDelete = (cliente) => {
    onDeleteClient(cliente.id);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Building size={24} />
                Gestione Clienti
              </h2>
              <p className="text-green-100 text-xs mt-0.5">
                {clienti.length} {clienti.length === 1 ? 'cliente registrato' : 'clienti registrati'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {clienti.length === 0 ? (
            <div className="text-center py-12">
              <Building size={64} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">Nessun cliente registrato</p>
            </div>
          ) : (
            <div className="space-y-2">
              {clientiOrdinati.map((cliente) => (
                <div
                  key={cliente.id}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition"
                >
                  {editingId === cliente.id ? (
                    // Modalità Modifica - CON INTESTAZIONE VISIBILE
                    <div className="p-4">
                      {/* INTESTAZIONE CLIENTE (sempre visibile) */}
                      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-lg font-bold shadow-md">
                          {cliente.azienda ? cliente.azienda.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-gray-800">
                            {cliente.azienda || 'Azienda non specificata'}
                          </h3>
                          <p className="text-xs text-gray-600">
                            Stai modificando: {cliente.nome} {cliente.cognome}
                          </p>
                        </div>
                        <div>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                            In modifica
                          </span>
                        </div>
                      </div>

                      {/* FORM DI MODIFICA */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Nome
                          </label>
                          <input
                            type="text"
                            value={editData.nome}
                            onChange={(e) => setEditData({ ...editData, nome: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Cognome
                          </label>
                          <input
                            type="text"
                            value={editData.cognome}
                            onChange={(e) => setEditData({ ...editData, cognome: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={editData.email}
                            onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Telefono
                          </label>
                          <input
                            type="tel"
                            value={editData.telefono}
                            onChange={(e) => setEditData({ ...editData, telefono: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Azienda
                          </label>
                          <input
                            type="text"
                            value={editData.azienda}
                            onChange={(e) => setEditData({ ...editData, azienda: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                            <Lock size={12} />
                            Nuova Password <span className="text-gray-400 text-xs">(opzionale)</span>
                          </label>
                          <input
                            type="text"
                            value={editData.password}
                            onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                            placeholder="Lascia vuoto per non modificare"
                            className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                          />
                        </div>
                      </div>
                      
                      {/* Info Password */}
                      <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-xs text-yellow-800">
                          <strong>Nota:</strong> Se lasci il campo password vuoto, la password attuale non verrà modificata.
                        </p>
                      </div>
                      
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={handleCancel}
                          className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
                        >
                          Annulla
                        </button>
                        <button
                          onClick={() => handleSave(cliente.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <Save size={16} />
                          Salva
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Modalità Visualizzazione - COMPATTA
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-white text-base font-bold flex-shrink-0">
                            {cliente.azienda ? cliente.azienda.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-gray-800 truncate">
                              {cliente.azienda || 'Azienda non specificata'}
                            </h3>
                            <p className="text-xs text-gray-600 truncate">
                              {cliente.nome} {cliente.cognome}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                          <div className="flex flex-col gap-1 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <Mail size={12} className="text-green-600 flex-shrink-0" />
                              <span className="truncate max-w-[200px]">{cliente.email || 'N/D'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Phone size={12} className="text-green-600 flex-shrink-0" />
                              <span>{cliente.telefono || 'Non specificato'}</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleStartEdit(cliente)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Modifica"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(cliente)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Elimina"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 rounded-b-2xl">
          <div className="flex justify-between items-center text-xs text-gray-600">
            <span>Totale: {clienti.length} {clienti.length === 1 ? 'cliente' : 'clienti'}</span>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageClientsModal;
