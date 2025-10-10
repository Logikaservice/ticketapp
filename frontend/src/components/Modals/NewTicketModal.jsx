import React from 'react';
import { X, Plus, Settings } from 'lucide-react';

const NewTicketModal = ({ 
  newTicketData, 
  setNewTicketData, 
  handleCreateTicket, 
  isEditingTicket, 
  currentUser, 
  clientiAttivi, 
  selectedClientForNewTicket, 
  setSelectedClientForNewTicket, 
  resetNewTicketData, 
  closeModal 
}) => {
  return (
    <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6 border-b pb-3">
        <h2 className="text-2xl font-bold text-blue-700 flex items-center gap-2">
          {isEditingTicket ? <Settings size={24} /> : <Plus size={24} />}
          {isEditingTicket ? 'Modifica Ticket' : 'Nuovo Ticket'}
        </h2>
        <button onClick={closeModal} className="text-gray-400">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-4">
        {currentUser.ruolo === 'tecnico' && (
          <div>
            <label className="block text-sm font-medium mb-1">Cliente</label>
            <select
              value={selectedClientForNewTicket}
              onChange={(e) => setSelectedClientForNewTicket(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-yellow-50"
            >
              <option value="" disabled>-- Seleziona --</option>
              {clientiAttivi.map(c => (
                <option key={c.id} value={c.id}>{c.azienda}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Richiedente</label>
          <input
            type="text"
            value={newTicketData.nomerichiedente}
            onChange={(e) => setNewTicketData({ ...newTicketData, nomerichiedente: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Titolo</label>
          <input
            type="text"
            value={newTicketData.titolo}
            onChange={(e) => setNewTicketData({ ...newTicketData, titolo: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Descrizione</label>
          <textarea
            value={newTicketData.descrizione}
            onChange={(e) => setNewTicketData({ ...newTicketData, descrizione: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Categoria</label>
            <select
              value={newTicketData.categoria}
              onChange={(e) => setNewTicketData({ ...newTicketData, categoria: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="assistenza">Assistenza</option>
              <option value="manutenzione">Manutenzione</option>
              <option value="installazione">Installazione</option>
              <option value="altro">Altro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Priorità</label>
            <select
              value={newTicketData.priorita}
              onChange={(e) => setNewTicketData({ ...newTicketData, priorita: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="bassa">Bassa</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={resetNewTicketData} className="flex-1 px-4 py-3 border rounded-lg">
            Pulisci
          </button>
          <button onClick={closeModal} className="flex-1 px-4 py-3 border rounded-lg text-red-600 hover:bg-red-50">
            Annulla
          </button>
          <button onClick={handleCreateTicket} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-bold">
            {isEditingTicket ? 'Salva' : 'Crea'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewTicketModal;
