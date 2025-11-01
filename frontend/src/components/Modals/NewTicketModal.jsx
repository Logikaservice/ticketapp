// src/components/Modals/NewTicketModal.jsx

import React from 'react';
import { X, Save, FilePlus } from 'lucide-react';

const NewTicketModal = ({
  newTicketData,
  setNewTicketData,
  onClose,
  onSave,
  isEditingTicket,
  currentUser,
  clientiAttivi,
  selectedClientForNewTicket,
  setSelectedClientForNewTicket
}) => {
  // Helper per verificare se un cliente è admin della sua azienda
  const isAdminOfCompany = (cliente) => {
    if (!cliente.admin_companies || !Array.isArray(cliente.admin_companies)) return false;
    const azienda = cliente.azienda || '';
    return cliente.admin_companies.includes(azienda);
  };

  // Ordina alfabeticamente i clienti per nome azienda (case-insensitive, locale IT)
  const sortedClienti = (clientiAttivi || []).slice().sort((a, b) => {
    const aName = a.azienda || '';
    const bName = b.azienda || '';
    return aName.localeCompare(bName, 'it', { sensitivity: 'base' });
  });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        
        {/* Header con lo stile blu sfumato */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-sky-600 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FilePlus size={28} />
                {isEditingTicket ? 'Modifica Ticket' : 'Crea Nuovo Ticket'}
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                Compila i dettagli dell'intervento.
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

        {/* Form per l'inserimento dei dati */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {currentUser.ruolo === 'tecnico' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
              <select
                value={selectedClientForNewTicket}
                onChange={(e) => setSelectedClientForNewTicket(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="" disabled>Seleziona un cliente</option>
                {sortedClienti.map(c => {
                  const isAdmin = isAdminOfCompany(c);
                  const aziendaText = c.azienda || 'Senza azienda';
                  const emailText = c.email ? ` - ${c.email}` : '';
                  const adminIcon = isAdmin ? '👑 ' : '';
                  const displayText = `${adminIcon}${aziendaText}${emailText}`;
                  
                  return (
                    <option key={c.id} value={c.id}>{displayText}</option>
                  );
                })}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titolo <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Es: Problema stampante ufficio"
              value={newTicketData.titolo}
              onChange={(e) => setNewTicketData({ ...newTicketData, titolo: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
            <textarea
              rows="4"
              placeholder="Descrivi il problema in dettaglio..."
              value={newTicketData.descrizione}
              onChange={(e) => setNewTicketData({ ...newTicketData, descrizione: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select
                value={newTicketData.categoria}
                onChange={(e) => setNewTicketData({ ...newTicketData, categoria: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="assistenza">Assistenza</option>
                <option value="manutenzione">Manutenzione</option>
                <option value="installazione">Installazione</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priorità</label>
              <select
                value={newTicketData.priorita}
                onChange={(e) => setNewTicketData({ ...newTicketData, priorita: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="bassa">Bassa</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Richiedente <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={newTicketData.nomerichiedente}
              onChange={(e) => setNewTicketData({ ...newTicketData, nomerichiedente: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nome del richiedente"
              required
            />
          </div>

          {currentUser.ruolo === 'tecnico' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Apertura</label>
              <input
                type="date"
                value={(() => {
                  const v = newTicketData.dataapertura;
                  if (!v) return '';
                  
                  // Se è già in formato YYYY-MM-DD, usa direttamente
                  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
                    return v;
                  }
                  
                  // Se è in formato DD/MM/YYYY, converti in YYYY-MM-DD
                  if (typeof v === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) {
                    const [dd, mm, yyyy] = v.split('/');
                    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
                  }
                  
                  // Se ISO con orario, estrai solo la data
                  if (typeof v === 'string' && v.includes('T')) {
                    return v.split('T')[0];
                  }
                  
                  // Fallback: prova Date() e converti in YYYY-MM-DD
                  const d = new Date(v);
                  if (!isNaN(d.getTime())) {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                  }
                  
                  return '';
                })()}
                onChange={(e) => {
                  // Il campo date restituisce sempre YYYY-MM-DD
                  setNewTicketData({ ...newTicketData, dataapertura: e.target.value });
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

        </div>

        {/* Footer con i pulsanti */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition"
            >
              Annulla
            </button>
            <button
              onClick={onSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Save size={18} />
              {isEditingTicket ? 'Salva Modifiche' : 'Crea Ticket'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewTicketModal;
