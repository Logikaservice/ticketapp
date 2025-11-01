// src/components/Modals/NewTicketModal.jsx

import React, { useState, useMemo } from 'react';
import { X, Save, FilePlus, ChevronDown, ChevronRight, Crown, Building, Mail } from 'lucide-react';

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [expandedCompanies, setExpandedCompanies] = useState(() => {
    // Aziende collassate di default (vuoto = tutte collassate)
    return new Set();
  });

  // Helper per verificare se un cliente è admin della sua azienda
  const isAdminOfCompany = (cliente) => {
    if (!cliente.admin_companies || !Array.isArray(cliente.admin_companies)) return false;
    const azienda = cliente.azienda || '';
    return cliente.admin_companies.includes(azienda);
  };

  // Raggruppa clienti per azienda, con amministratori per primi
  const clientiPerAzienda = useMemo(() => {
    const grouped = {};
    clientiAttivi.forEach(cliente => {
      const azienda = cliente.azienda || 'Senza azienda';
      if (!grouped[azienda]) {
        grouped[azienda] = [];
      }
      grouped[azienda].push(cliente);
    });
    
    // Ordina i clienti dentro ogni azienda: prima gli amministratori, poi gli altri
    Object.keys(grouped).forEach(azienda => {
      grouped[azienda].sort((a, b) => {
        const aIsAdmin = isAdminOfCompany(a);
        const bIsAdmin = isAdminOfCompany(b);
        
        // Prima gli amministratori
        if (aIsAdmin && !bIsAdmin) return -1;
        if (!aIsAdmin && bIsAdmin) return 1;
        
        // Poi ordina per nome
        const nomeA = `${a.nome || ''} ${a.cognome || ''}`.trim().toLowerCase();
        const nomeB = `${b.nome || ''} ${b.cognome || ''}`.trim().toLowerCase();
        return nomeA.localeCompare(nomeB);
      });
    });
    
    // Ordina le aziende alfabeticamente
    return Object.keys(grouped)
      .sort((a, b) => {
        if (a === 'Senza azienda') return 1;
        if (b === 'Senza azienda') return -1;
        return a.toLowerCase().localeCompare(b.toLowerCase());
      })
      .reduce((acc, azienda) => {
        acc[azienda] = grouped[azienda];
        return acc;
      }, {});
  }, [clientiAttivi]);

  const toggleCompany = (azienda) => {
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(azienda)) {
        next.delete(azienda);
      } else {
        next.add(azienda);
      }
      return next;
    });
  };

  const handleSelectClient = (clientId) => {
    setSelectedClientForNewTicket(clientId.toString());
    setIsDropdownOpen(false);
  };

  const selectedClient = clientiAttivi.find(c => c.id.toString() === selectedClientForNewTicket);
  const selectedClientName = selectedClient 
    ? `${selectedClient.azienda || 'Senza azienda'}${selectedClient.email ? ` - ${selectedClient.email}` : ''}`
    : 'Seleziona un cliente';
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
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition"
                >
                  <span className={selectedClient ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedClient ? (
                      <span className="flex items-center gap-2">
                        {isAdminOfCompany(selectedClient) && <Crown size={16} className="text-yellow-500" />}
                        {selectedClientName}
                      </span>
                    ) : selectedClientName}
                  </span>
                  <ChevronDown 
                    size={20} 
                    className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
                  />
                </button>

                {isDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsDropdownOpen(false)}
                    ></div>
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                      {Object.keys(clientiPerAzienda).length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          Nessun cliente disponibile
                        </div>
                      ) : (
                        Object.entries(clientiPerAzienda).map(([azienda, clientiAzienda]) => {
                          const isExpanded = expandedCompanies.has(azienda);
                          const isNoCompany = azienda === 'Senza azienda';
                          
                          return (
                            <div key={azienda} className="border-b border-gray-100 last:border-b-0">
                              {/* Header Azienda - Espandibile */}
                              <button
                                type="button"
                                onClick={() => toggleCompany(azienda)}
                                className="w-full px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all flex items-center justify-between text-left"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {isNoCompany ? <Building size={12} /> : azienda.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-gray-800 truncate">
                                      {isNoCompany ? 'Senza azienda' : azienda}
                                    </h3>
                                    <p className="text-xs text-gray-600">
                                      {clientiAzienda.length} {clientiAzienda.length === 1 ? 'cliente' : 'clienti'}
                                    </p>
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
                                ) : (
                                  <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
                                )}
                              </button>
                              
                              {/* Clienti dell'azienda - Espansi/Collassati */}
                              {isExpanded && (
                                <div className="bg-gray-50">
                                  {clientiAzienda.map((cliente) => {
                                    const isAdmin = isAdminOfCompany(cliente);
                                    const isSelected = cliente.id.toString() === selectedClientForNewTicket;
                                    
                                    return (
                                      <button
                                        key={cliente.id}
                                        type="button"
                                        onClick={() => handleSelectClient(cliente.id)}
                                        className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition flex items-center gap-3 border-l-2 ${
                                          isSelected 
                                            ? 'bg-blue-50 border-blue-500' 
                                            : 'border-transparent'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          {/* Spazio fisso per la corona: sempre presente, visibile solo se admin */}
                                          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                            {isAdmin && (
                                              <Crown size={16} className="text-yellow-500" />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                                                {cliente.nome} {cliente.cognome}
                                              </span>
                                            </div>
                                            {cliente.email && (
                                              <div className="flex items-center gap-1 mt-0.5">
                                                <Mail size={12} className="text-gray-400" />
                                                <span className="text-xs text-gray-600 truncate">
                                                  {cliente.email}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        {isSelected && (
                                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
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
