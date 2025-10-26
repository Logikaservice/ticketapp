// components/TemporarySuppliesPanel.jsx

import React, { useState } from 'react';
import { Package, Plus, Trash2, User } from 'lucide-react';

const TemporarySuppliesPanel = ({ 
  temporarySupplies = [], 
  loading, 
  onAddSupply, 
  onRemoveSupply, 
  users = [] 
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSupply, setNewSupply] = useState({
    materiale: '',
    quantita: 1,
    cliente_id: '',
    note: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newSupply.materiale.trim() || !newSupply.cliente_id) return;

    try {
      await onAddSupply(newSupply);
      setNewSupply({
        materiale: '',
        quantita: 1,
        cliente_id: '',
        note: ''
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Errore nell\'aggiungere la fornitura:', error);
    }
  };

  const handleRemove = async (supplyId) => {
    if (window.confirm('Sei sicuro di voler rimuovere questa fornitura?')) {
      try {
        await onRemoveSupply(supplyId);
      } catch (error) {
        console.error('Errore nell\'eliminare la fornitura:', error);
      }
    }
  };

  // Filtra solo i clienti
  const clienti = users.filter(user => user.ruolo === 'cliente');

  return (
    <div className="bg-white rounded-xl border">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Package size={18} />
          Forniture Temporanee
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors flex items-center gap-1"
        >
          <Plus size={14} />
          Aggiungi
        </button>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-sm text-gray-500">Caricamento...</div>
        ) : (
          <>
            {/* Form per aggiungere nuova fornitura */}
            {showAddForm && (
              <div className="bg-gray-50 rounded-lg p-3 border">
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Materiale *
                    </label>
                    <input
                      type="text"
                      value={newSupply.materiale}
                      onChange={(e) => setNewSupply({ ...newSupply, materiale: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="Nome del materiale"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Quantità *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newSupply.quantita}
                        onChange={(e) => setNewSupply({ ...newSupply, quantita: parseInt(e.target.value) || 1 })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Cliente *
                      </label>
                      <select
                        value={newSupply.cliente_id}
                        onChange={(e) => setNewSupply({ ...newSupply, cliente_id: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        required
                      >
                        <option value="">Seleziona cliente</option>
                        {clienti.map(cliente => (
                          <option key={cliente.id} value={cliente.id}>
                            {cliente.azienda} - {cliente.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Note
                    </label>
                    <input
                      type="text"
                      value={newSupply.note}
                      onChange={(e) => setNewSupply({ ...newSupply, note: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="Note aggiuntive (opzionale)"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                    >
                      Salva
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600 transition-colors"
                    >
                      Annulla
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista forniture temporanee */}
            {temporarySupplies.length === 0 ? (
              <div className="text-sm text-gray-500">Nessuna fornitura temporanea presente.</div>
            ) : (
              <div className="space-y-2">
                {temporarySupplies.map(supply => {
                  const cliente = clienti.find(c => c.id === supply.cliente_id);
                  return (
                    <div key={supply.id} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Package size={14} className="text-blue-600" />
                            <span className="font-medium text-sm">{supply.materiale}</span>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                              Qty: {supply.quantita}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <User size={12} />
                            <span>
                              {cliente ? `${cliente.azienda} - ${cliente.nome}` : 'Cliente non trovato'}
                            </span>
                          </div>
                          
                          {supply.note && (
                            <div className="text-xs text-gray-500 mt-1">
                              Note: {supply.note}
                            </div>
                          )}
                          
                          <div className="text-xs text-gray-400 mt-1">
                            Aggiunto il {new Date(supply.created_at).toLocaleDateString('it-IT')}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleRemove(supply.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Rimuovi fornitura"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TemporarySuppliesPanel;
