// src/components/Modals/NewTicketModal.jsx

import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  const [isAziendaDropdownOpen, setIsAziendaDropdownOpen] = useState(false);
  const [selectedAzienda, setSelectedAzienda] = useState('');
  const [isRichiedenteDropdownOpen, setIsRichiedenteDropdownOpen] = useState(false);
  const [richiedenteInputMode, setRichiedenteInputMode] = useState('dropdown'); // 'dropdown' o 'manual'
  const [photos, setPhotos] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Helper per verificare se un cliente è admin della sua azienda
  const isAdminOfCompany = (cliente) => {
    if (!cliente.admin_companies || !Array.isArray(cliente.admin_companies)) return false;
    const azienda = cliente.azienda || '';
    return cliente.admin_companies.includes(azienda);
  };

  // Ottieni lista unica di aziende
  const aziendeUniche = useMemo(() => {
    const aziende = new Set();
    clientiAttivi.forEach(cliente => {
      const azienda = cliente.azienda || 'Senza azienda';
      if (azienda) {
        aziende.add(azienda);
      }
    });
    return Array.from(aziende).sort((a, b) => {
      if (a === 'Senza azienda') return 1;
      if (b === 'Senza azienda') return -1;
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
  }, [clientiAttivi]);

  // Ottieni clienti dell'azienda selezionata
  const clientiAziendaSelezionata = useMemo(() => {
    if (!selectedAzienda) return [];
    return clientiAttivi
      .filter(cliente => (cliente.azienda || 'Senza azienda') === selectedAzienda)
      .sort((a, b) => {
        const aIsAdmin = isAdminOfCompany(a);
        const bIsAdmin = isAdminOfCompany(b);
        if (aIsAdmin && !bIsAdmin) return -1;
        if (!aIsAdmin && bIsAdmin) return 1;
        const nomeA = `${a.nome || ''} ${a.cognome || ''}`.trim().toLowerCase();
        const nomeB = `${b.nome || ''} ${b.cognome || ''}`.trim().toLowerCase();
        return nomeA.localeCompare(nomeB);
      });
  }, [selectedAzienda, clientiAttivi]);

  const handleSelectAzienda = (azienda) => {
    setSelectedAzienda(azienda);
    setIsAziendaDropdownOpen(false);
    // Reset cliente selezionato e nome richiedente quando si cambia azienda
    setSelectedClientForNewTicket('');
    setNewTicketData({ ...newTicketData, nomerichiedente: '' });
    setRichiedenteInputMode('dropdown');
  };

  const handleSelectRichiedente = (cliente) => {
    // Se si seleziona un cliente dal dropdown, usa il suo nome completo e email
    const nomeCompleto = `${cliente.nome || ''} ${cliente.cognome || ''}`.trim();
    const displayName = cliente.email ? `${nomeCompleto} (${cliente.email})` : nomeCompleto;
    setNewTicketData({ ...newTicketData, nomerichiedente: displayName });
    setSelectedClientForNewTicket(cliente.id.toString());
    setIsRichiedenteDropdownOpen(false);
    setRichiedenteInputMode('dropdown');
  };

  const handleRichiedenteManualInput = (value) => {
    setNewTicketData({ ...newTicketData, nomerichiedente: value });
    // Se si inserisce manualmente, non selezionare un cliente specifico
    if (value && !clientiAziendaSelezionata.some(c => {
      const nomeCompleto = `${c.nome || ''} ${c.cognome || ''}`.trim();
      const displayName = c.email ? `${nomeCompleto} (${c.email})` : nomeCompleto;
      return displayName === value;
    })) {
      setSelectedClientForNewTicket('');
      setRichiedenteInputMode('manual');
    }
  };

  // Trova il cliente selezionato in base al nome richiedente
  const selectedClientFromRichiedente = useMemo(() => {
    if (!newTicketData.nomerichiedente || !selectedAzienda) return null;
    return clientiAziendaSelezionata.find(c => {
      const nomeCompleto = `${c.nome || ''} ${c.cognome || ''}`.trim();
      const displayName = c.email ? `${nomeCompleto} (${c.email})` : nomeCompleto;
      return displayName === newTicketData.nomerichiedente;
    });
  }, [newTicketData.nomerichiedente, selectedAzienda, clientiAziendaSelezionata]);

  // Aggiorna selectedClientForNewTicket quando si seleziona un cliente dal dropdown
  useEffect(() => {
    if (selectedClientFromRichiedente && selectedClientFromRichiedente.id.toString() !== selectedClientForNewTicket) {
      setSelectedClientForNewTicket(selectedClientFromRichiedente.id.toString());
    }
  }, [selectedClientFromRichiedente, selectedClientForNewTicket, setSelectedClientForNewTicket]);

  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    // Verifica dimensione per file singolo (massimo 10MB per file)
    const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
    const oversizedFiles = newFiles.filter(file => file.size > maxFileSize);
    
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(f => `${f.name} (${(f.size / (1024 * 1024)).toFixed(2)}MB)`).join(', ');
      alert(`I seguenti file superano il limite di 10MB per file:\n${fileNames}\n\nDimensione massima consentita: 10MB per file.\n\nSeleziona file più piccoli.`);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    // Combina i file esistenti con i nuovi file
    const existingFiles = photos || [];
    const allFiles = [...existingFiles, ...newFiles];
    
    // Verifica dimensione totale (massimo 10MB totali)
    const maxTotalSize = 10 * 1024 * 1024; // 10MB in bytes
    const totalSize = allFiles.reduce((sum, file) => sum + file.size, 0);
    
    if (totalSize > maxTotalSize) {
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      alert(`La dimensione totale dei file selezionati (${totalSizeMB}MB) supera il limite di 10MB.\n\nDimensione massima consentita: 10MB totali per tutti i file.\n\nRimuovi alcuni file o seleziona file più piccoli.`);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    // Evita duplicati basandosi sul nome e dimensione del file
    const uniqueFiles = [];
    const fileKeys = new Set();
    
    allFiles.forEach(file => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (!fileKeys.has(key)) {
        fileKeys.add(key);
        uniqueFiles.push(file);
      }
    });
    
    setPhotos(uniqueFiles);
    
    // Reset input per permettere di selezionare gli stessi file di nuovo se necessario
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Reset isSaving quando la modale viene chiusa
  useEffect(() => {
    return () => {
      setIsSaving(false);
    };
  }, []);

  const handleSaveWithPhotos = async () => {
    if (isSaving) {
      console.log('⚠️ Salvataggio già in corso, ignoro il click');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(photos);
      // Se il salvataggio ha successo, la modale si chiuderà e isSaving verrà resettato dal cleanup
    } catch (error) {
      console.error('Errore durante il salvataggio:', error);
      setIsSaving(false);
    }
  };
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Azienda <span className="text-red-500">*</span></label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAziendaDropdownOpen(!isAziendaDropdownOpen)}
                  className="w-full px-3 py-2 border rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition"
                >
                  <span className={selectedAzienda ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedAzienda || 'Seleziona un\'azienda'}
                  </span>
                  <ChevronDown 
                    size={20} 
                    className={`text-gray-400 transition-transform ${isAziendaDropdownOpen ? 'rotate-180' : ''}`} 
                  />
                </button>

                {isAziendaDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsAziendaDropdownOpen(false)}
                    ></div>
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                      {aziendeUniche.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          Nessuna azienda disponibile
                        </div>
                      ) : (
                        aziendeUniche.map((azienda) => {
                          const isSelected = azienda === selectedAzienda;
                          const clientiCount = clientiAttivi.filter(c => (c.azienda || 'Senza azienda') === azienda).length;
                          
                          return (
                              <button
                              key={azienda}
                                type="button"
                              onClick={() => handleSelectAzienda(azienda)}
                              className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition flex items-center gap-3 border-b border-gray-100 last:border-b-0 ${
                                isSelected ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                {azienda === 'Senza azienda' ? <Building size={16} /> : azienda.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900">
                                  {azienda === 'Senza azienda' ? 'Senza azienda' : azienda}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {clientiCount} {clientiCount === 1 ? 'cliente' : 'clienti'}
                                          </div>
                                        </div>
                                        {isSelected && (
                                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                        )}
                                      </button>
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

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Richiedente <span className="text-red-500">*</span></label>
            {currentUser.ruolo === 'tecnico' && selectedAzienda ? (
              <div className="space-y-2">
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      {richiedenteInputMode === 'dropdown' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsRichiedenteDropdownOpen(!isRichiedenteDropdownOpen)}
                            className="w-full px-3 py-2 border rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition"
                          >
                            <span className={newTicketData.nomerichiedente ? 'text-gray-900' : 'text-gray-500'}>
                              {newTicketData.nomerichiedente || 'Seleziona un richiedente'}
                            </span>
                            <ChevronDown 
                              size={20} 
                              className={`text-gray-400 transition-transform ${isRichiedenteDropdownOpen ? 'rotate-180' : ''}`} 
                            />
                          </button>
                          {isRichiedenteDropdownOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setIsRichiedenteDropdownOpen(false)}
                              ></div>
                              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                {clientiAziendaSelezionata.length === 0 ? (
                                  <div className="p-4 text-center text-gray-500">
                                    Nessun cliente disponibile per questa azienda
                                  </div>
                                ) : (
                                  <>
                                    {clientiAziendaSelezionata.map((cliente) => {
                                      const nomeCompleto = `${cliente.nome || ''} ${cliente.cognome || ''}`.trim();
                                      const displayName = cliente.email ? `${nomeCompleto} (${cliente.email})` : nomeCompleto;
                                      const isSelected = newTicketData.nomerichiedente === displayName;
                                      
                                      return (
                                        <button
                                          key={cliente.id}
                                          type="button"
                                          onClick={() => handleSelectRichiedente(cliente)}
                                          className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition flex items-center gap-3 border-l-2 ${
                                            isSelected 
                                              ? 'bg-blue-50 border-blue-500' 
                                              : 'border-transparent'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                              {isAdminOfCompany(cliente) && (
                                                <Crown size={16} className="text-yellow-500" />
                                              )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="text-sm font-medium text-gray-900">
                                                {nomeCompleto}
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
                                    <div className="border-t border-gray-200">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRichiedenteInputMode('manual');
                                          setIsRichiedenteDropdownOpen(false);
                                          setNewTicketData({ ...newTicketData, nomerichiedente: '' });
                                        }}
                                        className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition text-sm text-gray-600"
                                      >
                                        Inserisci manualmente...
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={newTicketData.nomerichiedente}
                            onChange={(e) => handleRichiedenteManualInput(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Inserisci il nome del richiedente"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setRichiedenteInputMode('dropdown');
                              setNewTicketData({ ...newTicketData, nomerichiedente: '' });
                              setSelectedClientForNewTicket('');
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            ← Torna alla selezione da lista
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
            <input
              type="text"
              value={newTicketData.nomerichiedente}
              onChange={(e) => setNewTicketData({ ...newTicketData, nomerichiedente: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nome del richiedente"
              required
            />
            )}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Foto (opzionale)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:bg-gray-50 transition flex items-center justify-center gap-2"
            >
              <FilePlus size={18} />
              {photos.length > 0 ? `${photos.length} file selezionati` : 'Seleziona file'}
            </button>
            {photos.length > 0 && (
              <div className="mt-2 space-y-2">
                {photos.map((photo, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <FilePlus size={16} className="text-gray-600" />
                    <span className="text-sm text-gray-700 flex-1 truncate">{photo.name}</span>
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Rimuovi
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              onClick={handleSaveWithPhotos}
              disabled={isSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                isSaving 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Save size={18} />
              {isSaving ? 'Salvataggio...' : (isEditingTicket ? 'Salva Modifiche' : 'Crea Ticket')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewTicketModal;
