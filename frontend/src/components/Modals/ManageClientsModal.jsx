// src/components/Modals/ManageClientsModal.jsx

import React, { useState } from 'react';
import { X, Edit2, Save, Trash2, Mail, Phone, Building } from 'lucide-react';

// --- UNICA MODIFICA: Aggiunta la prop 'clientIdsWithTickets' ---
const ManageClientsModal = ({ clienti, onClose, onUpdateClient, onDeleteClient, clientIdsWithTickets }) => {
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

  const handleDelete = (cliente) => {
    onDeleteClient(cliente.id);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        
        {/* Header (invariato) */}
        <div className="p-6 border-b bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-2xl">
            {/* ... */}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {clienti.length === 0 ? (
            <div className="text-center py-12">
              {/* ... */}
            </div>
          ) : (
            <div className="space-y-4">
              {clienti.map((cliente) => {
                // --- UNICA MODIFICA: Controlla se il cliente ha ticket ---
                const hasTickets = clientIdsWithTickets.has(cliente.id);

                return (
                  <div
                    key={cliente.id}
                    className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition"
                  >
                    {editingId === cliente.id ? (
                      // Modalità Modifica (invariata)
                      <div className="p-6">
                        {/* ... */}
                      </div>
                    ) : (
                      // Modalità Visualizzazione
                      <div className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {/* ... (dati cliente invariati) ... */}
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStartEdit(cliente)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Modifica"
                            >
                              <Edit2 size={18} />
                            </button>

                            {/* --- UNICA MODIFICA: Pulsante Elimina condizionale --- */}
                            <button
                              onClick={() => handleDelete(cliente)}
                              disabled={hasTickets}
                              className={`p-2 rounded-lg transition ${
                                hasTickets
                                  ? 'text-gray-400 cursor-not-allowed' // Stile disabilitato
                                  : 'text-red-600 hover:bg-red-50'    // Stile normale
                              }`}
                              title={hasTickets ? 'Impossibile eliminare: il cliente ha ticket associati' : 'Elimina'}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer (invariato) */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
          {/* ... */}
        </div>
      </div>
    </div>
  );
};

export default ManageClientsModal;
