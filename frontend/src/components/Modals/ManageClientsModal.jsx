import React, { useState } from 'react';
import { X, Edit2, Save, Trash2, Mail, Phone, Building } from 'lucide-react';

const ManageClientsModal = ({ clienti, onClose, onUpdateClient, onDeleteClient }) => {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  const handleStartEdit = (cliente) => {
    setEditingId(cliente.id);
    setEditData({
      nome: cliente.nome || '',
      cognome: cliente.cognome || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      azienda: cliente.azienda || ''
    });
  };

  const handleSave = (id) => {
    onUpdateClient(id, editData);
    setEditingId(null);
    setEditData({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  // ====================================================================
  // 🔧 FIX: Rimossa la conferma da qui - ora c'è solo in App.jsx
  // ====================================================================
  const handleDelete = (cliente) => {
    onDeleteClient(cliente.id);
  };
  // ====================================================================

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Building size={28} />
                Gestione Clienti
              </h2>
              <p className="text-green-100 text-sm mt-1">
                {clienti.length} {clienti.length === 1 ? 'cliente registrato' : 'clienti registrati'}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {clienti.length === 0 ? (
            <div className="text-center py-12">
              <Building size={64} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">Nessun cliente registrato</p>
            </div>
          ) : (
            <div className="space-y-4">
              {clienti.map((cliente) => (
                <div
                  key={cliente.id}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition"
                >
                  {editingId === cliente.id ? (
                    // Modalità Modifica
                    <div className="p-6">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nome
                          </label>
                          <input
                            type="text"
                            value={editData.nome}
                            onChange={(e) => setEditData({ ...editData, nome: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cognome
                          </label>
                          <input
                            type="text"
                            value={editData.cognome}
                            onChange={(e) => setEditData({ ...editData, cognome: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={editData.email}
                            onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Telefono
                          </label>
                          <input
                            type="tel"
                            value={editData.telefono}
                            onChange={(e) => setEditData({ ...editData, telefono: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Azienda
                          </label>
                          <input
                            type="text"
                            value={editData.azienda}
                            onChange={(e) => setEditData({ ...editData, azienda: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={handleCancel}
                          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                        >
                          Annulla
                        </button>
                        <button
                          onClick={() => handleSave(cliente.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <Save size={18} />
                          Salva
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Modalità Visualizzazione
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                              {cliente.azienda ? cliente.azienda.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-gray-800">
                                {cliente.azienda || 'Azienda non specificata'}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {cliente.nome} {cliente.cognome}
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="flex items-center gap-2 text-gray-700">
                              <Mail size={16} className="text-green-600" />
                              <span className="text-sm">{cliente.email || 'Non specificata'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-700">
                              <Phone size={16} className="text-green-600" />
                              <span className="text-sm">{cliente.telefono || 'Non specificato'}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleStartEdit(cliente)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Modifica"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(cliente)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Elimina"
                          >
                            <Trash2 size={18} />
                          </button>
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
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>Totale: {clienti.length} {clienti.length === 1 ? 'cliente' : 'clienti'}</span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition"
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
