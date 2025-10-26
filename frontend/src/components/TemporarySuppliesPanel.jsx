// components/TemporarySuppliesPanel.jsx

import React from 'react';
import { Package, Trash2, User, FileText } from 'lucide-react';

const TemporarySuppliesPanel = ({ 
  temporarySupplies = [], 
  loading, 
  onRemoveSupply, 
  users = [],
  onOpenTicket,
  onEditSupply
}) => {
  const handleRemove = async (supplyId) => {
    if (window.confirm('Sei sicuro di voler restituire questa fornitura?')) {
      try {
        await onRemoveSupply(supplyId);
      } catch (error) {
        console.error('Errore nell\'eliminare la fornitura:', error);
      }
    }
  };

  return (
    <div className="bg-white rounded-xl border">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Package size={18} />
          Forniture Temporanee
        </h3>
        <div className="text-xs text-gray-500">
          {temporarySupplies.length} forniture attive
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-sm text-gray-500">Caricamento...</div>
        ) : (
          <>
            {/* Lista forniture temporanee dai ticket */}
            {temporarySupplies.length === 0 ? (
              <div className="text-sm text-gray-500">Nessuna fornitura temporanea presente.</div>
            ) : (
              <div className="space-y-2">
                {temporarySupplies.map(supply => (
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
                        
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                          <User size={12} />
                          <span>
                            {supply.azienda} - {supply.cliente_nome}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                          <FileText size={12} />
                          <span>
                            Ticket #{supply.ticket_numero}: {supply.ticket_titolo}
                          </span>
                        </div>

                        {supply.nota && (
                          <div className="text-xs text-blue-600 mb-1">
                            Note: {supply.nota}
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-400">
                          Prestato il {new Date(supply.data_prestito).toLocaleDateString('it-IT')}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => onOpenTicket && onOpenTicket(supply.ticket_id)}
                          className="text-blue-500 hover:text-blue-700 px-2 py-1 text-xs font-medium border border-blue-300 rounded hover:bg-blue-50"
                          title="Apri ticket"
                        >
                          Apri
                        </button>
                        <button
                          onClick={() => onEditSupply && onEditSupply(supply)}
                          className="text-green-500 hover:text-green-700 px-2 py-1 text-xs font-medium border border-green-300 rounded hover:bg-green-50"
                          title="Modifica fornitura"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => handleRemove(supply.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Restituisci fornitura"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TemporarySuppliesPanel;
