// src/components/Modals/NewTicketModal.jsx

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Save, FilePlus, ChevronDown, ChevronRight, Crown, Building, Mail } from 'lucide-react';
import {
  getStoredTechHubAccent,
  readableOnAccent,
  techHubAccentModalHeaderStyle,
  techHubAccentIconTileStyle,
  hubShellThemeVars
} from '../../utils/techHubAccent';

const NewTicketModal = ({
  newTicketData,
  setNewTicketData,
  onClose,
  onSave,
  isEditingTicket,
  currentUser,
  clientiAttivi,
  selectedClientForNewTicket,
  setSelectedClientForNewTicket,
  editingTicket = null // Passa il ticket completo quando si modifica
}) => {
  const [isAziendaDropdownOpen, setIsAziendaDropdownOpen] = useState(false);
  const [selectedAzienda, setSelectedAzienda] = useState('');
  const [isRichiedenteDropdownOpen, setIsRichiedenteDropdownOpen] = useState(false);
  const [richiedenteInputMode, setRichiedenteInputMode] = useState('dropdown'); // 'dropdown' o 'manual'
  const [photos, setPhotos] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  const dashboardAccentHex = useMemo(() => getStoredTechHubAccent(), []);
  const hubTheme = useMemo(() => hubShellThemeVars(dashboardAccentHex), [dashboardAccentHex]);

  // Quando si modifica un ticket, carica l'azienda del cliente associato o dal ticket stesso (se esiste)
  useEffect(() => {
    // Solo per la modifica di ticket esistenti
    if (isEditingTicket && !selectedAzienda) {
      // Primo tentativo: recupera l'azienda dal cliente associato
      if (selectedClientForNewTicket) {
        const clienteId = parseInt(selectedClientForNewTicket);
        if (!isNaN(clienteId)) {
          const cliente = clientiAttivi.find(c => c.id === clienteId);
          if (cliente && cliente.azienda) {
            console.log('🔍 DEBUG: useEffect - impostando azienda da cliente:', cliente.azienda);
            setSelectedAzienda(cliente.azienda);
            return;
          }
        }
      }
      
      // Secondo tentativo: recupera l'azienda dal ticket stesso (cliente_azienda)
      if (editingTicket && editingTicket.cliente_azienda) {
        console.log('🔍 DEBUG: useEffect - impostando azienda da ticket.cliente_azienda:', editingTicket.cliente_azienda);
        setSelectedAzienda(editingTicket.cliente_azienda);
        return;
      }
      
      // Terzo tentativo: cerca un cliente con lo stesso nome richiedente nell'elenco dei clienti
      if (newTicketData.nomerichiedente) {
        const nomeRichiedente = newTicketData.nomerichiedente.trim();
        // Rimuovi email se presente (es. "Nome Cognome (email@example.com)" -> "Nome Cognome")
        const nomeSenzaEmail = nomeRichiedente.split('(')[0].trim();
        const nomeParts = nomeSenzaEmail.split(' ');
        const nome = nomeParts[0] || nomeSenzaEmail;
        const cognome = nomeParts.slice(1).join(' ') || '';
        
        const clienteTrovato = clientiAttivi.find(c => {
          const nomeCompleto = `${c.nome || ''} ${c.cognome || ''}`.trim();
          return nomeCompleto === nomeSenzaEmail || 
                 (c.nome === nome && c.cognome === cognome) ||
                 c.nome === nomeSenzaEmail;
        });
        
        if (clienteTrovato && clienteTrovato.azienda) {
          console.log('🔍 DEBUG: useEffect - impostando azienda da cliente trovato con nome richiedente:', clienteTrovato.azienda);
          setSelectedAzienda(clienteTrovato.azienda);
          // Imposta anche il cliente selezionato
          setSelectedClientForNewTicket(clienteTrovato.id.toString());
        }
      }
    }
    // Non resettare l'azienda per nuovi ticket - lascia che l'utente la selezioni
  }, [isEditingTicket, selectedClientForNewTicket, clientiAttivi, editingTicket, newTicketData.nomerichiedente]);

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

  const handleSelectAzienda = (azienda, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('🔍 DEBUG: handleSelectAzienda chiamato con azienda:', azienda);
    setSelectedAzienda(azienda);
    setIsAziendaDropdownOpen(false);
    // Reset cliente selezionato e nome richiedente quando si cambia azienda
    setSelectedClientForNewTicket('');
    setNewTicketData(prev => ({ ...prev, nomerichiedente: '' }));
    setRichiedenteInputMode('dropdown');
    console.log('🔍 DEBUG: selectedAzienda impostato a:', azienda);
  };

  // Helper per verificare se un'email è temporanea
  const isTempEmail = (email) => {
    if (!email) return false;
    return email.startsWith('temp_') && email.endsWith('.local');
  };

  const handleSelectRichiedente = (cliente) => {
    // Se si seleziona un cliente dal dropdown, usa il suo nome completo
    // Non mostrare l'email se è temporanea
    const nomeCompleto = `${cliente.nome || ''} ${cliente.cognome || ''}`.trim();
    const displayName = (cliente.email && !isTempEmail(cliente.email)) 
      ? `${nomeCompleto} (${cliente.email})` 
      : nomeCompleto;
    setNewTicketData({ ...newTicketData, nomerichiedente: displayName });
    setSelectedClientForNewTicket(cliente.id.toString());
    setIsRichiedenteDropdownOpen(false);
    setRichiedenteInputMode('dropdown');
  };

  const handleRichiedenteManualInput = (value) => {
    console.log('🔍 DEBUG handleRichiedenteManualInput - selectedAzienda:', selectedAzienda);
    setNewTicketData({ ...newTicketData, nomerichiedente: value });
    // Se si inserisce manualmente, non selezionare un cliente specifico
    // MA mantieni selectedAzienda - è critico per associare il ticket all'azienda corretta
    if (value && !clientiAziendaSelezionata.some(c => {
      const nomeCompleto = `${c.nome || ''} ${c.cognome || ''}`.trim();
      const displayName = c.email ? `${nomeCompleto} (${c.email})` : nomeCompleto;
      return displayName === value;
    })) {
      setSelectedClientForNewTicket('');
      setRichiedenteInputMode('manual');
      // IMPORTANTE: NON resettare selectedAzienda - deve rimanere selezionata!
      console.log('🔍 DEBUG handleRichiedenteManualInput - Mantenendo selectedAzienda:', selectedAzienda);
    }
  };

  // Trova il cliente selezionato in base al nome richiedente
  const selectedClientFromRichiedente = useMemo(() => {
    if (!newTicketData.nomerichiedente || !selectedAzienda) return null;
    return clientiAziendaSelezionata.find(c => {
      const nomeCompleto = `${c.nome || ''} ${c.cognome || ''}`.trim();
      const isTemp = isTempEmail(c.email);
      const displayName = (c.email && !isTemp) 
        ? `${nomeCompleto} (${c.email})` 
        : nomeCompleto;
      // Confronta sia con displayName che con solo nome (per email temporanee)
      return displayName === newTicketData.nomerichiedente || 
        (isTemp && nomeCompleto === newTicketData.nomerichiedente);
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
    
    // VALIDAZIONE: Verifica che l'azienda sia selezionata per i tecnici
    if (currentUser.ruolo === 'tecnico' && !selectedAzienda) {
      console.error('❌ ERRORE: Nessuna azienda selezionata!');
      alert('Devi selezionare un\'azienda prima di creare il ticket.');
      return;
    }
    
    setIsSaving(true);
    try {
      // Passa selectedAzienda sia per creazione che per modifica
      // Per la modifica, onSave è wrappedHandleUpdateTicket che accetta solo selectedAzienda
      // Per la creazione, onSave è wrappedHandleCreateTicket che accetta (photos, selectedAzienda)
      console.log('🔍 DEBUG NewTicketModal - Prima di salvare:', {
        selectedAzienda: selectedAzienda || 'VUOTO!',
        nomerichiedente: newTicketData.nomerichiedente,
        isEditingTicket,
        photosCount: photos.length
      });
      
      if (isEditingTicket) {
        await onSave(selectedAzienda || '');
      } else {
        console.log('🔍 DEBUG NewTicketModal - Chiamata onSave con:', { photos: photos.length, selectedAzienda: selectedAzienda || 'VUOTO!' });
        await onSave(photos, selectedAzienda || '');
      }
      // Se il salvataggio ha successo, la modale si chiuderà e isSaving verrà resettato dal cleanup
    } catch (error) {
      console.error('Errore durante il salvataggio:', error);
      setIsSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div
        className="ticket-modal-hub-shell flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--hub-page)] text-white/90 shadow-2xl"
        style={{ ...hubTheme, colorScheme: 'dark' }}
      >
        
        {/* Header: colore accento Hub uniforme */}
        <div
          className="rounded-t-2xl border-b border-black/10 p-6"
          style={techHubAccentModalHeaderStyle(dashboardAccentHex)}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                <FilePlus size={28} strokeWidth={2} className="shrink-0 opacity-95" aria-hidden />
                {isEditingTicket ? 'Modifica Ticket' : 'Crea Nuovo Ticket'}
              </h2>
              <p className="mt-1 text-sm opacity-90">
                Compila i dettagli dell'intervento.
              </p>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="rounded-lg bg-black/20 p-2 ring-1 ring-black/10 transition hover:bg-black/30"
              aria-label="Chiudi"
            >
              <X size={24} aria-hidden className="opacity-95" />
            </button>
          </div>
        </div>

        {/* Form per l'inserimento dei dati */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 bg-[color:var(--hub-page)]">
          {currentUser.ruolo === 'tecnico' && (
            <div className="relative">
              <label className="block text-sm font-medium text-white/75 mb-1">
                Azienda 
                {!isEditingTicket && <span className="text-red-400">*</span>}
                {isEditingTicket && !selectedAzienda && (
                  <span className="text-xs text-orange-400/90 ml-2">(Nessuna azienda associata)</span>
                )}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAziendaDropdownOpen(!isAziendaDropdownOpen)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-[color:var(--hub-surface)] px-3 py-2 text-left text-white transition hover:border-[color:var(--td-accent)] focus:border-transparent focus:ring-2 focus:ring-[color:var(--td-accent)]"
                >
                  <span className={selectedAzienda ? 'text-white/95' : 'text-white/42'}>
                    {selectedAzienda || 'Seleziona un\'azienda'}
                  </span>
                  <ChevronDown 
                    size={20} 
                    className={`text-white/40 transition-transform ${isAziendaDropdownOpen ? 'rotate-180' : ''}`} 
                  />
                </button>

                {isAziendaDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsAziendaDropdownOpen(false)}
                    ></div>
                    <div 
                      className="absolute z-50 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border border-white/10 bg-[color:var(--hub-surface)] shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {aziendeUniche.length === 0 ? (
                        <div className="p-4 text-center text-white/45">
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
                              onClick={(e) => handleSelectAzienda(azienda, e)}
                              className={`flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-left transition last:border-b-0 hover:bg-[color:var(--td-soft)] ${
                                isSelected ? 'bg-[color:var(--td-soft-strong)]' : ''
                              }`}
                            >
                              <div
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-sm font-bold text-white"
                                style={techHubAccentIconTileStyle(dashboardAccentHex)}
                              >
                                {azienda === 'Senza azienda' ? <Building size={16} /> : azienda.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white">
                                  {azienda === 'Senza azienda' ? 'Senza azienda' : azienda}
                                </div>
                                <div className="text-xs text-white/50">
                                  {clientiCount} {clientiCount === 1 ? 'cliente' : 'clienti'}
                                          </div>
                                        </div>
                                        {isSelected && (
                                          <div className="h-2 w-2 flex-shrink-0 rounded-full bg-[color:var(--td-accent)]"></div>
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
            <label className="block text-sm font-medium text-white/75 mb-1">Titolo <span className="text-red-400">*</span></label>
            <input
              type="text"
              placeholder="Es: Problema stampante ufficio"
              value={newTicketData.titolo}
              onChange={(e) => setNewTicketData({ ...newTicketData, titolo: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[color:var(--hub-surface)] px-3 py-2 text-white placeholder:text-white/35 focus:border-transparent focus:ring-2 focus:ring-[color:var(--td-accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/75 mb-1">Descrizione</label>
            <textarea
              rows="4"
              placeholder="Descrivi il problema in dettaglio..."
              value={newTicketData.descrizione}
              onChange={(e) => setNewTicketData({ ...newTicketData, descrizione: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[color:var(--hub-surface)] px-3 py-2 text-white placeholder:text-white/35 focus:border-transparent focus:ring-2 focus:ring-[color:var(--td-accent)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/75 mb-1">Categoria</label>
              <select
                value={newTicketData.categoria}
                onChange={(e) => setNewTicketData({ ...newTicketData, categoria: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[color:var(--hub-surface)] px-3 py-2 text-white placeholder:text-white/35 focus:border-transparent focus:ring-2 focus:ring-[color:var(--td-accent)]"
              >
                <option value="assistenza">Assistenza</option>
                <option value="manutenzione">Manutenzione</option>
                <option value="installazione">Installazione</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/75 mb-1">Priorità</label>
              <select
                value={newTicketData.priorita}
                onChange={(e) => setNewTicketData({ ...newTicketData, priorita: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-[color:var(--hub-surface)] px-3 py-2 text-white placeholder:text-white/35 focus:border-transparent focus:ring-2 focus:ring-[color:var(--td-accent)]"
              >
                <option value="bassa">Bassa</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-white/75 mb-1">Richiedente <span className="text-red-400">*</span></label>
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
                            className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-[color:var(--hub-surface)] px-3 py-2 text-left text-white transition hover:border-[color:var(--td-accent)] focus:border-transparent focus:ring-2 focus:ring-[color:var(--td-accent)]"
                          >
                            <span className={newTicketData.nomerichiedente ? 'text-white/95' : 'text-white/42'}>
                              {newTicketData.nomerichiedente || 'Seleziona un richiedente'}
                            </span>
                            <ChevronDown 
                              size={20} 
                              className={`text-white/40 transition-transform ${isRichiedenteDropdownOpen ? 'rotate-180' : ''}`} 
                            />
                          </button>
                          {isRichiedenteDropdownOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => setIsRichiedenteDropdownOpen(false)}
                              ></div>
                              <div 
                                className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-white/10 bg-[color:var(--hub-surface)] shadow-xl"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {clientiAziendaSelezionata.length === 0 ? (
                                  <div className="p-4 text-center text-white/45">
                                    Nessun cliente disponibile per questa azienda
                                  </div>
                                ) : (
                                  <>
                                    {clientiAziendaSelezionata.map((cliente) => {
                                      const nomeCompleto = `${cliente.nome || ''} ${cliente.cognome || ''}`.trim();
                                      const isTemp = isTempEmail(cliente.email);
                                      const displayName = (cliente.email && !isTemp) 
                                        ? `${nomeCompleto} (${cliente.email})` 
                                        : nomeCompleto;
                                      const isSelected = newTicketData.nomerichiedente === displayName || 
                                        (isTemp && newTicketData.nomerichiedente === nomeCompleto);
                                      
                                      return (
                                        <button
                                          key={cliente.id}
                                          type="button"
                                          onClick={() => handleSelectRichiedente(cliente)}
                                          className={`flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left transition hover:bg-[color:var(--td-soft)] ${
                                            isSelected
                                              ? 'border-[color:var(--td-accent)] bg-[color:var(--td-soft-strong)]'
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
                                              <div className="text-sm font-medium text-white">
                                                {nomeCompleto}
                                              </div>
                                              {cliente.email && !isTemp && (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                  <Mail size={12} className="text-white/40" />
                                                  <span className="truncate text-xs text-white/50">
                                                    {cliente.email}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          {isSelected && (
                                            <div className="h-2 w-2 flex-shrink-0 rounded-full bg-[color:var(--td-accent)]"></div>
                                          )}
                                        </button>
                                      );
                                    })}
                                    <div className="border-t border-white/10">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          console.log('🔍 DEBUG: Cliccato "Inserisci manualmente" - selectedAzienda:', selectedAzienda);
                                          setRichiedenteInputMode('manual');
                                          setIsRichiedenteDropdownOpen(false);
                                          setNewTicketData({ ...newTicketData, nomerichiedente: '' });
                                          // NON resettare selectedAzienda - deve rimanere selezionata!
                                        }}
                                        className="w-full px-4 py-2.5 text-left text-sm text-white/60 transition hover:bg-white/[0.06]"
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
                            className="w-full rounded-lg border border-white/10 bg-[color:var(--hub-surface)] px-3 py-2 text-white placeholder:text-white/35 focus:border-transparent focus:ring-2 focus:ring-[color:var(--td-accent)]"
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
                            className="text-xs text-[color:var(--td-accent)] hover:opacity-80"
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
              className="w-full rounded-lg border border-white/10 bg-[color:var(--hub-surface)] px-3 py-2 text-white placeholder:text-white/35 focus:border-transparent focus:ring-2 focus:ring-[color:var(--td-accent)]"
              placeholder="Nome del richiedente"
              required
            />
            )}
          </div>

          {currentUser.ruolo === 'tecnico' && (
            <div>
              <label className="block text-sm font-medium text-white/75 mb-1">Data Apertura</label>
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
                className="w-full rounded-lg border border-white/10 bg-[color:var(--hub-surface)] px-3 py-2 text-white placeholder:text-white/35 focus:border-transparent focus:ring-2 focus:ring-[color:var(--td-accent)]"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/75 mb-1">
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
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/14 bg-[color:var(--hub-surface)] px-3 py-2 text-white/90 transition hover:border-[color:var(--td-accent)] hover:bg-white/[0.05] focus:border-transparent focus:ring-2 focus:ring-[color:var(--td-accent)]"
            >
              <FilePlus size={18} />
              {photos.length > 0 ? `${photos.length} file selezionati` : 'Seleziona file'}
            </button>
            {photos.length > 0 && (
              <div className="mt-2 space-y-2">
                {photos.map((photo, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 p-2">
                    <FilePlus size={16} className="text-white/55" />
                    <span className="flex-1 truncate text-sm text-white/85">{photo.name}</span>
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="text-sm text-red-400 hover:text-red-300"
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
        <div className="rounded-b-2xl border-t border-white/10 bg-[color:var(--hub-surface)] p-4">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/12 bg-white/[0.08] px-4 py-2 text-white/90 transition hover:bg-white/[0.14]"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSaveWithPhotos}
              disabled={isSaving}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 transition ${
                isSaving ? 'cursor-not-allowed bg-gray-400 text-white' : 'hover:brightness-105 active:brightness-95'
              }`}
              style={
                !isSaving
                  ? {
                      backgroundColor: dashboardAccentHex,
                      color: readableOnAccent(dashboardAccentHex)
                    }
                  : undefined
              }
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
