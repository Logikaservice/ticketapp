// frontend/src/components/Modals/ImportKeepassModal.jsx

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, RefreshCw, ChevronDown, Search, Building, User, Trash2 } from 'lucide-react';

const ImportKeepassModal = ({ isOpen, onClose, users, getAuthHeader, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [migrationResult, setMigrationResult] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [credentialsCount, setCredentialsCount] = useState({ groups: 0, entries: 0 });
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPreparingList, setIsPreparingList] = useState(false);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const scrollContainerRef = useRef(null);
  const ITEMS_PER_PAGE = 30; // Renderizza 30 elementi alla volta

  // Memoizza il filtro dei clienti per evitare ricalcoli ad ogni render
  // Ordina anche i clienti per nome azienda per migliorare l'UX
  // Usa useMemo con calcolo lazy per migliorare le performance
  const clientiAttivi = useMemo(() => {
    if (!users || !Array.isArray(users)) return [];
    
    // Filtra e ordina in un unico passaggio per efficienza
    const clienti = [];
    for (const u of users) {
      if (u.ruolo === 'cliente') {
        clienti.push(u);
      }
    }
    
    // Ordina per azienda, poi per email
    clienti.sort((a, b) => {
      const aziendaA = (a.azienda || 'Senza azienda').toLowerCase();
      const aziendaB = (b.azienda || 'Senza azienda').toLowerCase();
      if (aziendaA !== aziendaB) {
        return aziendaA.localeCompare(aziendaB);
      }
      return (a.email || '').toLowerCase().localeCompare((b.email || '').toLowerCase());
    });
    
    return clienti;
  }, [users]);

  // Filtra clienti in base alla ricerca con debounce implicito tramite useMemo
  const filteredClienti = useMemo(() => {
    if (!searchQuery.trim()) return clientiAttivi;
    const query = searchQuery.toLowerCase().trim();
    // Usa un algoritmo più efficiente per la ricerca
    return clientiAttivi.filter(cliente => {
      const azienda = (cliente.azienda || 'Senza azienda').toLowerCase();
      const email = (cliente.email || '').toLowerCase();
      const nome = (cliente.nome || '').toLowerCase();
      const cognome = (cliente.cognome || '').toLowerCase();
      // Cerca all'inizio delle stringhe per risultati più rilevanti
      return azienda.startsWith(query) || 
             email.startsWith(query) || 
             azienda.includes(query) || 
             email.includes(query) ||
             nome.includes(query) || 
             cognome.includes(query);
    });
  }, [clientiAttivi, searchQuery]);

  // Reset visible range quando cambia la ricerca o si apre il dropdown
  useEffect(() => {
    if (isDropdownOpen) {
      setVisibleRange({ start: 0, end: ITEMS_PER_PAGE });
    }
  }, [searchQuery, isDropdownOpen]);

  // Virtualizzazione: mostra solo gli elementi visibili
  const visibleClienti = useMemo(() => {
    return filteredClienti.slice(visibleRange.start, visibleRange.end);
  }, [filteredClienti, visibleRange]);

  // Gestione scroll per caricare più elementi
  const handleScroll = useCallback((e) => {
    const container = e.target;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Carica più elementi quando si è vicini alla fine (80% scrollato)
    if (scrollTop + clientHeight >= scrollHeight * 0.8) {
      const currentEnd = visibleRange.end;
      if (currentEnd < filteredClienti.length) {
        setVisibleRange(prev => ({
          start: prev.start,
          end: Math.min(prev.end + ITEMS_PER_PAGE, filteredClienti.length)
        }));
      }
    }
  }, [visibleRange, filteredClienti.length]);

  // Chiudi dropdown quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Reset quando il modal si chiude
  useEffect(() => {
    if (!isOpen) {
      setSelectedClientId('');
      setSearchQuery('');
      setIsDropdownOpen(false);
      setHasCredentials(false);
      setCredentialsCount({ groups: 0, entries: 0 });
      setShowDeleteConfirm(false);
    }
  }, [isOpen]);

  // Verifica se il cliente selezionato ha credenziali
  // Usa un ref per cancellare le chiamate precedenti
  const abortControllerRef = useRef(null);
  
  useEffect(() => {
    // Cancella qualsiasi chiamata precedente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const checkCredentials = async () => {
      if (!selectedClientId || !isOpen) {
        setHasCredentials(false);
        setCredentialsCount({ groups: 0, entries: 0 });
        return;
      }

      console.log(`🔍 Verifica credenziali per cliente: ${selectedClientId}`);

      // Crea un nuovo AbortController per questa chiamata
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsCheckingCredentials(true);
      try {
        const url = `${process.env.REACT_APP_API_URL}/api/keepass/check/${selectedClientId}`;
        console.log(`📡 Chiamata API: ${url}`);
        
        const response = await fetch(url, {
          headers: getAuthHeader(),
          signal: abortController.signal // Aggiungi il signal per poter cancellare
        });

        // Verifica se la richiesta è stata cancellata
        if (abortController.signal.aborted) {
          console.log('⚠️ Richiesta cancellata');
          return;
        }

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Risposta API:', data);
          setHasCredentials(data.hasCredentials);
          setCredentialsCount({
            groups: data.groupsCount || 0,
            entries: data.entriesCount || 0
          });
          
          if (data.hasCredentials) {
            console.log(`✅ Cliente ${selectedClientId} ha ${data.groupsCount} gruppi e ${data.entriesCount} credenziali`);
          } else {
            console.log(`ℹ️ Cliente ${selectedClientId} non ha credenziali`);
          }
        } else {
          const errorText = await response.text();
          console.error(`❌ Errore API (${response.status}):`, errorText);
          setHasCredentials(false);
          setCredentialsCount({ groups: 0, entries: 0 });
        }
      } catch (err) {
        // Ignora errori se la richiesta è stata cancellata
        if (err.name === 'AbortError') {
          console.log('⚠️ Richiesta abortita');
          return;
        }
        console.error('❌ Errore verifica credenziali:', err);
        setHasCredentials(false);
        setCredentialsCount({ groups: 0, entries: 0 });
      } finally {
        // Solo se non è stata cancellata
        if (!abortController.signal.aborted) {
          setIsCheckingCredentials(false);
        }
      }
    };

    // Debounce ridotto a 100ms per risposta più veloce
    const timeoutId = setTimeout(() => {
      checkCredentials();
    }, 100);

    // Cleanup: cancella il timeout e la richiesta se il componente si smonta o cambiano le dipendenze
    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedClientId, isOpen, getAuthHeader]);

  if (!isOpen) return null;

  const selectedClient = clientiAttivi.find(c => c.id.toString() === selectedClientId.toString());

  const handleDeleteCredentials = async () => {
    if (!selectedClientId) return;

    setIsDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/keepass/client/${selectedClientId}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(`Credenziali cancellate con successo! (${data.deletedGroups} gruppi, ${data.deletedEntries} credenziali)`);
        setHasCredentials(false);
        setCredentialsCount({ groups: 0, entries: 0 });
        setShowDeleteConfirm(false);
        
        // Notifica il componente padre per aggiornare la lista
        if (onSuccess) {
          onSuccess();
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Errore durante la cancellazione');
      }
    } catch (err) {
      console.error('Errore cancellazione credenziali:', err);
      setError('Errore durante la cancellazione delle credenziali');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.xml')) {
        setError('Solo file XML sono permessi');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Seleziona un file XML');
      return;
    }

    if (!selectedClientId) {
      setError('Seleziona un cliente');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setMigrationResult(null);

    try {
      const formData = new FormData();
      formData.append('xmlFile', selectedFile);
      formData.append('clientId', selectedClientId);

      const authHeader = getAuthHeader();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/keepass/import`, {
        method: 'POST',
        headers: {
          'x-user-role': 'tecnico',
          'x-user-id': authHeader['x-user-id'] || '',
          ...authHeader
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details || data.error || 'Errore durante l\'importazione';
        throw new Error(errorMsg);
      }

      setSuccess(`File importato con successo per ${data.clientEmail || 'il cliente selezionato'}`);
      
      // Reset form dopo 2 secondi
      setTimeout(() => {
        setSelectedFile(null);
        setSelectedClientId('');
        setSuccess(null);
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Errore import KeePass:', err);
      setError(err.message || 'Errore durante l\'importazione del file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleMigrate = async () => {
    if (!window.confirm('Vuoi aggiornare automaticamente tutte le credenziali KeePass esistenti?\n\nQuesto processo:\n- Correggerà titoli e nomi salvati come oggetti JSON\n- Aggiornerà tutti i clienti\n- Le entry con password vuote verranno mantenute')) {
      return;
    }

    setIsMigrating(true);
    setError(null);
    setSuccess(null);
    setMigrationResult(null);

    try {
      const authHeader = getAuthHeader();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/keepass/migrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'tecnico',
          'x-user-id': authHeader['x-user-id'] || '',
          ...authHeader
        }
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details || data.error || 'Errore durante la migrazione';
        throw new Error(errorMsg);
      }

      setMigrationResult(data.summary);
      setSuccess(`Migrazione completata! ${data.summary.entriesUpdated} entry aggiornate, ${data.summary.groupsUpdated} gruppi aggiornati.`);
      
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Errore migrazione KeePass:', err);
      setError(err.message || 'Errore durante la migrazione');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        {/* Header con lo stile viola sfumato */}
        <div className="p-6 border-b bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FileText size={28} />
                Importa KeePass
              </h2>
              <p className="text-purple-100 text-sm mt-1">
                Importa credenziali da un file XML di KeePass
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

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Selezione Cliente - Dropdown Personalizzato */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => {
                if (!isDropdownOpen) {
                  // Prepara la lista prima di aprire (defer rendering)
                  setIsPreparingList(true);
                  // Usa requestAnimationFrame per deferire il rendering
                  requestAnimationFrame(() => {
                    setIsPreparingList(false);
                    setIsDropdownOpen(true);
                  });
                } else {
                  setIsDropdownOpen(false);
                }
              }}
              disabled={isUploading}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 hover:border-purple-400 transition-all bg-white text-left flex items-center justify-between shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {selectedClient ? (
                  <>
                    <Building size={16} className="text-purple-600 flex-shrink-0" />
                    <span className="text-gray-900 font-medium truncate">
                      {selectedClient.azienda || 'Senza azienda'} - {selectedClient.email}
                    </span>
                  </>
                ) : (
                  <>
                    <User size={16} className="text-gray-400 flex-shrink-0" />
                    <span className="text-gray-500">Seleziona un cliente...</span>
                  </>
                )}
              </div>
              <ChevronDown 
                size={18} 
                className={`text-gray-400 transition-transform flex-shrink-0 ml-2 ${isDropdownOpen ? 'rotate-180' : ''}`} 
              />
            </button>

            {/* Dropdown Menu - Rendering ottimizzato */}
            {(isDropdownOpen || isPreparingList) && (
              <div className="absolute z-50 w-full mt-2 bg-white border-2 border-purple-200 rounded-lg shadow-xl max-h-96 overflow-hidden flex flex-col">
                {/* Barra di ricerca */}
                <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-violet-50">
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cerca cliente..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                      autoFocus={isDropdownOpen}
                    />
                  </div>
                </div>

                {/* Lista clienti - Virtualizzazione per performance */}
                <div 
                  ref={scrollContainerRef}
                  className="overflow-y-auto max-h-80"
                  onScroll={handleScroll}
                >
                  {isPreparingList ? (
                    <div className="p-4 text-center">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                      <p className="text-sm text-gray-500 mt-2">Caricamento clienti...</p>
                    </div>
                  ) : !clientiAttivi || clientiAttivi.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      Nessun cliente disponibile
                    </div>
                  ) : filteredClienti.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      Nessun cliente trovato per "{searchQuery}"
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-gray-100">
                        {visibleClienti.map(cliente => {
                          const isSelected = selectedClientId === cliente.id.toString();
                          return (
                            <button
                              key={cliente.id}
                              type="button"
                              onClick={() => {
                                setSelectedClientId(cliente.id.toString());
                                setIsDropdownOpen(false);
                                setSearchQuery('');
                              }}
                              className={`w-full px-4 py-3 text-left hover:bg-purple-50 active:bg-purple-100 transition-colors flex items-center gap-3 ${
                                isSelected ? 'bg-purple-100 border-l-4 border-l-purple-500' : ''
                              }`}
                            >
                              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {(cliente.azienda || cliente.email || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 truncate">
                                  {cliente.azienda || 'Senza azienda'}
                                </div>
                                <div className="text-sm text-gray-600 truncate">
                                  {cliente.email}
                                </div>
                              </div>
                              {isSelected && (
                                <CheckCircle size={18} className="text-purple-600 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {/* Spacer per mantenere l'altezza corretta dello scroll */}
                      {visibleRange.end < filteredClienti.length && (
                        <div className="p-2 text-center text-xs text-gray-500">
                          Mostrando {visibleRange.end} di {filteredClienti.length} clienti
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pulsante Cancella Credenziali - Mostra solo se il cliente ha credenziali */}
          {hasCredentials && selectedClientId && (
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Trash2 size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 mb-1">Credenziali già importate</h3>
                  <p className="text-sm text-gray-700 mb-3">
                    Questo cliente ha già {credentialsCount.groups} {credentialsCount.groups === 1 ? 'gruppo' : 'gruppi'} e {credentialsCount.entries} {credentialsCount.entries === 1 ? 'credenziale' : 'credenziali'} importate.
                    {!showDeleteConfirm && (
                      <span className="block mt-1 text-red-600 font-semibold">
                        Vuoi cancellarle prima di importare nuove credenziali?
                      </span>
                    )}
                  </p>
                  {!showDeleteConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isDeleting || isUploading}
                      className="px-4 py-2 bg-gradient-to-r from-red-500 to-orange-600 text-white font-semibold rounded-lg hover:from-red-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      Cancella Tutte le Credenziali
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="bg-white border-2 border-red-300 rounded-lg p-3 mb-2">
                        <p className="text-sm font-semibold text-red-700">
                          ⚠️ Sei sicuro di voler cancellare tutte le credenziali?
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Questa azione è irreversibile. Verranno cancellati {credentialsCount.groups} {credentialsCount.groups === 1 ? 'gruppo' : 'gruppi'} e {credentialsCount.entries} {credentialsCount.entries === 1 ? 'credenziale' : 'credenziali'}.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDeleteCredentials}
                          disabled={isDeleting || isUploading}
                          className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isDeleting ? (
                            <>
                              <RefreshCw size={16} className="animate-spin" />
                              Cancellazione...
                            </>
                          ) : (
                            <>
                              <Trash2 size={16} />
                              Conferma Cancellazione
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={isDeleting || isUploading}
                          className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Upload File */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File XML KeePass <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 hover:bg-purple-50 transition cursor-pointer">
              <input
                type="file"
                id="xmlFileInput"
                accept=".xml,application/xml,text/xml"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
              <label htmlFor="xmlFileInput" className="cursor-pointer flex flex-col items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-purple-100 to-violet-100 rounded-full">
                  <Upload className="w-8 h-8 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {selectedFile ? selectedFile.name : 'Clicca per selezionare file XML'}
                </span>
                <span className="text-xs text-gray-500">
                  Formato: XML - Max 10MB
                </span>
              </label>
            </div>
            {selectedFile && (
              <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-lg flex items-center gap-2">
                <FileText size={18} className="text-purple-600" />
                <span className="text-sm font-medium text-purple-700 flex-1">{selectedFile.name}</span>
                <span className="text-xs text-purple-600 bg-white px-2 py-1 rounded">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </span>
              </div>
            )}
          </div>

          {/* Messaggi */}
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center gap-3 shadow-sm">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
              <span className="text-sm font-medium text-red-800">{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-lg flex items-center gap-3 shadow-sm">
              <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
              <span className="text-sm font-medium text-green-800">{success}</span>
            </div>
          )}

          {/* Migrazione */}
          <div className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <RefreshCw size={20} className="text-amber-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-900 mb-1">
                  Aggiorna Credenziali Esistenti
                </h3>
                <p className="text-xs text-amber-800 mb-3">
                  Aggiorna automaticamente tutte le credenziali già importate applicando le ultime correzioni:
                  corregge titoli e nomi salvati come oggetti JSON, aggiorna tutti i clienti. Le entry con password vuote vengono mantenute.
                </p>
                <button
                  type="button"
                  onClick={handleMigrate}
                  disabled={isMigrating || isUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 text-white text-sm font-semibold rounded-lg hover:from-amber-700 hover:to-yellow-700 transition disabled:opacity-50 shadow-md"
                >
                  <RefreshCw size={16} className={isMigrating ? 'animate-spin' : ''} />
                  {isMigrating ? 'Migrazione in corso...' : 'Aggiorna Tutte le Credenziali'}
                </button>
                {migrationResult && (
                  <div className="mt-3 p-2 bg-white rounded text-xs">
                    <p className="font-semibold text-gray-700 mb-1">Risultati:</p>
                    <ul className="space-y-1 text-gray-600">
                      <li>✅ Entry aggiornate: {migrationResult.entriesUpdated}</li>
                      <li>📁 Gruppi aggiornati: {migrationResult.groupsUpdated}</li>
                      <li>📊 Totale processate: {migrationResult.totalProcessed}</li>
                      {migrationResult.errors > 0 && (
                        <li className="text-red-600">❌ Errori: {migrationResult.errors}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg shadow-sm">
            <p className="text-xs text-blue-800 leading-relaxed">
              <strong className="font-semibold">ℹ️ Nota:</strong> Tutti i gruppi e le credenziali verranno importati. 
              Le password verranno cifrate e salvate in modo sicuro. 
              Eventuali dati esistenti per questo cliente verranno sostituiti.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition disabled:opacity-50 font-medium"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isUploading || !selectedFile || !selectedClientId}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-lg hover:from-purple-700 hover:to-violet-700 transition disabled:opacity-50 font-semibold shadow-md"
            >
              <Upload size={18} />
              {isUploading ? 'Importazione...' : 'Importa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportKeepassModal;

