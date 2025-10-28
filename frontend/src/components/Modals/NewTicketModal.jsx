// src/components/Modals/NewTicketModal.jsx

import React, { useEffect, useState } from 'react';
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
  // Stato locale per l'input della data in formato italiano (DD/MM/YYYY)
  const [dateAperturaText, setDateAperturaText] = useState('');

  // Inizializza/sincronizza lo stato locale quando cambia il dato sorgente
  useEffect(() => {
    const v = newTicketData?.dataapertura;
    if (!v) { setDateAperturaText(''); return; }
    // Se già DD/MM/YYYY
    if (typeof v === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) { setDateAperturaText(v); return; }
    // YYYY-MM-DD
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [yyyy, mm, dd] = v.split('-');
      setDateAperturaText(`${dd}/${mm}/${yyyy}`);
      return;
    }
    // ISO con orario
    if (typeof v === 'string' && v.includes('T')) {
      const [yyyy, mm, dd] = v.split('T')[0].split('-');
      setDateAperturaText(`${dd}/${mm}/${yyyy}`);
      return;
    }
    // Fallback Date()
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      setDateAperturaText(`${day}/${month}/${year}`);
      return;
    }
    setDateAperturaText('');
  }, [newTicketData?.dataapertura]);
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
                {sortedClienti.map(c => (
                  <option key={c.id} value={c.id}>{c.azienda}</option>
                ))}
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

          {isEditingTicket && currentUser.ruolo === 'tecnico' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Apertura</label>
              <input
                type="text"
                placeholder="DD/MM/YYYY (es: 15/03/2025)"
                value={dateAperturaText}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  setDateAperturaText(inputValue);
                  
                  // Se l'input è nel formato DD/MM/YYYY, converti in YYYY-MM-DD per il database
                  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(inputValue)) {
                    const [dd, mm, yyyy] = inputValue.split('/');
                    const isoDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
                    setNewTicketData({ ...newTicketData, dataapertura: isoDate });
                  } else if (inputValue === '') {
                    // Se vuoto, salva vuoto
                    setNewTicketData({ ...newTicketData, dataapertura: '' });
                  }
                  // Altrimenti non fare nulla (l'utente sta ancora digitando)
                }}
                onBlur={() => {
                  // Se perde il focus e il testo è valido, assicurati di sincronizzare
                  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateAperturaText)) {
                    const [dd, mm, yyyy] = dateAperturaText.split('/');
                    const isoDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
                    setNewTicketData({ ...newTicketData, dataapertura: isoDate });
                  }
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Formato: DD/MM/YYYY (es: 15/03/2025)</p>
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
