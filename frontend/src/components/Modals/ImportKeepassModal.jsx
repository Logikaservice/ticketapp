// frontend/src/components/Modals/ImportKeepassModal.jsx

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, RefreshCw, Trash2, Building, ChevronDown, Info } from 'lucide-react';

const ImportKeepassModal = ({ isOpen, onClose, users, getAuthHeader, onSuccess }) => {
  // Estrai solo le aziende uniche - molto più veloce e semplice
  const aziendeUniche = useMemo(() => {
    if (!users || !Array.isArray(users)) return [];
    
    const clienti = users.filter(u => u.ruolo === 'cliente');
    const aziendeMap = new Map();
    
    // Raggruppa per azienda e prendi il primo cliente per ogni azienda
    clienti.forEach(cliente => {
      const azienda = cliente.azienda || 'Senza azienda';
      if (!aziendeMap.has(azienda)) {
        aziendeMap.set(azienda, cliente);
      }
    });
    
    // Converti in array e ordina
    return Array.from(aziendeMap.entries())
      .map(([azienda, cliente]) => ({ azienda, cliente }))
      .sort((a, b) => a.azienda.localeCompare(b.azienda));
  }, [users]);
  
  // Mappa azienda -> primo cliente per l'importazione
  const getClienteByAzienda = (azienda) => {
    const entry = aziendeUniche.find(a => a.azienda === azienda);
    return entry ? entry.cliente : null;
  };

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedAzienda, setSelectedAzienda] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [migrationResult, setMigrationResult] = useState(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [credentialsCount, setCredentialsCount] = useState({ groups: 0, entries: 0 });
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset quando il modal si chiude
  useEffect(() => {
    if (!isOpen) {
      setSelectedAzienda('');
      setHasCredentials(false);
      setCredentialsCount({ groups: 0, entries: 0 });
      setShowDeleteConfirm(false);
    }
  }, [isOpen]);

  // Verifica se l'azienda selezionata ha credenziali (usando il primo cliente dell'azienda)
  const abortControllerRef = useRef(null);
  const getAuthHeaderRef = useRef(getAuthHeader);
  
  useEffect(() => {
    getAuthHeaderRef.current = getAuthHeader;
  }, [getAuthHeader]);
  
  useEffect(() => {
    if (!isOpen || !selectedAzienda) {
      setHasCredentials(false);
      setCredentialsCount({ groups: 0, entries: 0 });
      return;
    }

    const cliente = getClienteByAzienda(selectedAzienda);
    if (!cliente) return;

    const currentClientId = cliente.id.toString();
    const currentAzienda = selectedAzienda; // Salva per il controllo

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const checkCredentials = async () => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsCheckingCredentials(true);
      try {
        const url = `${process.env.REACT_APP_API_URL}/api/keepass/check/${currentClientId}`;
        const response = await fetch(url, {
          headers: getAuthHeaderRef.current(),
          signal: abortController.signal
        });

        if (abortController.signal.aborted || selectedAzienda !== currentAzienda) return;

        if (response.ok) {
          const data = await response.json();
          if (selectedAzienda === currentAzienda) {
            setHasCredentials(data.hasCredentials);
            setCredentialsCount({
              groups: data.groupsCount || 0,
              entries: data.entriesCount || 0
            });
          }
        } else {
          if (selectedAzienda === currentAzienda) {
            setHasCredentials(false);
            setCredentialsCount({ groups: 0, entries: 0 });
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (selectedAzienda === currentAzienda) {
          setHasCredentials(false);
          setCredentialsCount({ groups: 0, entries: 0 });
        }
      } finally {
        if (!abortController.signal.aborted && selectedAzienda === currentAzienda) {
          setIsCheckingCredentials(false);
        }
      }
    };

    const timeoutId = setTimeout(checkCredentials, 50);
    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedAzienda, isOpen, getClienteByAzienda]);

  if (!isOpen) return null;

  const selectedCliente = getClienteByAzienda(selectedAzienda);

  const handleDeleteCredentials = async () => {
    if (!selectedAzienda || !selectedCliente) return;

    setIsDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/keepass/client/${selectedCliente.id}`, {
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

            if (!selectedAzienda || !selectedCliente) {
              setError('Seleziona un\'azienda');
              return;
            }

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setMigrationResult(null);

            try {
              const formData = new FormData();
              formData.append('xmlFile', selectedFile);
              formData.append('clientId', selectedCliente.id);

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
      setSelectedAzienda('');
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Selezione Azienda - Design migliorato */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Building size={18} className="text-purple-600" />
              <span>Azienda <span className="text-red-500">*</span></span>
            </label>
            <div className="relative">
              <select
                value={selectedAzienda}
                onChange={(e) => setSelectedAzienda(e.target.value)}
                className="w-full px-4 py-3 pl-11 pr-10 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 hover:border-purple-300 transition-all bg-white text-gray-800 font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
                disabled={isUploading}
              >
                <option value="">Seleziona un'azienda...</option>
                {aziendeUniche.map(({ azienda }) => (
                  <option key={azienda} value={azienda}>
                    {azienda}
                  </option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Building size={18} className="text-gray-400" />
              </div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown size={18} className="text-gray-400" />
              </div>
            </div>
          </div>

          {/* Pulsante Cancella Credenziali - Mostra solo se l'azienda ha credenziali */}
          {hasCredentials && selectedAzienda && selectedCliente && (
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

          {/* Upload File - Design migliorato */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <FileText size={18} className="text-purple-600" />
              <span>File XML KeePass <span className="text-red-500">*</span></span>
            </label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-purple-400 hover:bg-gradient-to-br hover:from-purple-50 hover:to-violet-50 transition-all duration-300 cursor-pointer group">
              <input
                type="file"
                id="xmlFileInput"
                accept=".xml,application/xml,text/xml"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
              <label htmlFor="xmlFileInput" className="cursor-pointer flex flex-col items-center gap-4">
                <div className="p-4 bg-gradient-to-br from-purple-100 to-violet-100 rounded-2xl group-hover:from-purple-200 group-hover:to-violet-200 transition-all duration-300 shadow-sm group-hover:shadow-md">
                  <Upload className="w-10 h-10 text-purple-600 group-hover:text-purple-700 transition-colors" />
                </div>
                <div className="space-y-1">
                  <span className="text-base font-semibold text-gray-800 block">
                    {selectedFile ? selectedFile.name : 'Clicca per selezionare file XML'}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    Formato: XML - Max 10MB
                  </span>
                </div>
              </label>
            </div>
            {selectedFile && (
              <div className="mt-3 p-4 bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-purple-200 rounded-xl flex items-center gap-3 shadow-sm">
                <div className="p-2 bg-white rounded-lg">
                  <FileText size={20} className="text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-purple-900 block truncate">{selectedFile.name}</span>
                  <span className="text-xs text-purple-600 font-medium">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </span>
                </div>
                <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
              </div>
            )}
          </div>

          {/* Messaggi - Design migliorato */}
          {error && (
            <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500 rounded-xl flex items-center gap-3 shadow-md animate-in slide-in-from-top-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle size={20} className="text-red-600" />
              </div>
              <span className="text-sm font-semibold text-red-900 flex-1">{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-xl flex items-center gap-3 shadow-md animate-in slide-in-from-top-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle size={20} className="text-green-600" />
              </div>
              <span className="text-sm font-semibold text-green-900 flex-1">{success}</span>
            </div>
          )}

          {/* Migrazione - Design migliorato */}
          <div className="p-5 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-200 rounded-xl shadow-md">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl shadow-sm">
                <RefreshCw size={24} className="text-white" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-base font-bold text-amber-900 mb-1.5">
                    Aggiorna Credenziali Esistenti
                  </h3>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    Aggiorna automaticamente tutte le credenziali già importate applicando le ultime correzioni: 
                    corregge titoli e nomi salvati come oggetti JSON, aggiorna tutti i clienti. 
                    Le entry con password vuote vengono mantenute.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleMigrate}
                  disabled={isMigrating || isUploading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-sm font-bold rounded-xl hover:from-amber-600 hover:to-yellow-600 transition-all disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <RefreshCw size={18} className={isMigrating ? 'animate-spin' : ''} />
                  {isMigrating ? 'Aggiornamento in corso...' : 'Aggiorna Tutte le Credenziali'}
                </button>
                {migrationResult && (
                  <div className="mt-4 p-4 bg-white rounded-xl border-2 border-amber-200 shadow-sm">
                    <p className="font-bold text-gray-800 mb-2 text-sm">📊 Risultati Migrazione:</p>
                    <ul className="space-y-1.5 text-sm">
                      <li className="flex items-center gap-2 text-gray-700">
                        <CheckCircle size={16} className="text-green-600" />
                        Entry aggiornate: <span className="font-semibold">{migrationResult.entriesUpdated}</span>
                      </li>
                      <li className="flex items-center gap-2 text-gray-700">
                        <FileText size={16} className="text-blue-600" />
                        Gruppi aggiornati: <span className="font-semibold">{migrationResult.groupsUpdated}</span>
                      </li>
                      <li className="flex items-center gap-2 text-gray-700">
                        <Info size={16} className="text-purple-600" />
                        Totale processate: <span className="font-semibold">{migrationResult.totalProcessed}</span>
                      </li>
                      {migrationResult.errors > 0 && (
                        <li className="flex items-center gap-2 text-red-600">
                          <AlertCircle size={16} />
                          Errori: <span className="font-semibold">{migrationResult.errors}</span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info - Design migliorato */}
          <div className="p-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-l-4 border-blue-500 rounded-xl shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Info size={20} className="text-blue-600" />
              </div>
              <p className="text-sm text-blue-900 leading-relaxed font-medium">
                <strong className="font-bold">Nota Importante:</strong> Tutti i gruppi e le credenziali verranno importati. 
                Le password verranno cifrate e salvate in modo sicuro. 
                Eventuali dati esistenti per questo cliente verranno sostituiti.
              </p>
            </div>
          </div>
        </div>

        {/* Footer - Design migliorato */}
        <div className="p-6 border-t-2 border-gray-100 bg-gradient-to-br from-gray-50 to-white rounded-b-2xl">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading || isMigrating || isDeleting}
              className="px-6 py-3 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 rounded-xl transition-all disabled:opacity-50 font-semibold shadow-sm hover:shadow-md transform hover:scale-105"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isUploading || !selectedFile || !selectedAzienda || isMigrating || isDeleting}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all disabled:opacity-50 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
            >
              {isUploading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Importazione...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Importa
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportKeepassModal;

