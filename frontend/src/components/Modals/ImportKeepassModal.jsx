// frontend/src/components/Modals/ImportKeepassModal.jsx

import React, { useState, useMemo } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, RefreshCw, Building, Crown, ChevronRight, ChevronDown, Mail } from 'lucide-react';

const ImportKeepassModal = ({ isOpen, onClose, users, getAuthHeader, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [migrationResult, setMigrationResult] = useState(null);
  const [expandedCompanies, setExpandedCompanies] = useState(() => {
    // Lista compressa di default (nessuna azienda espansa)
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
    const clientiAttivi = users.filter(u => u.ruolo === 'cliente');
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
  }, [users]);

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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FileText size={28} />
                Importa KeePass
              </h2>
              <p className="text-blue-100 text-sm mt-1">
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
          {/* Selezione Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cliente <span className="text-red-500">*</span>
            </label>
            <div className="border border-gray-300 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              {Object.keys(clientiPerAzienda).length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  Nessun cliente disponibile
                </div>
              ) : (
                Object.entries(clientiPerAzienda).map(([azienda, clientiAzienda]) => {
                  const isExpanded = expandedCompanies.has(azienda);
                  const isNoCompany = azienda === 'Senza azienda';
                  
                  return (
                    <div key={azienda} className="border-b border-gray-200 last:border-b-0">
                      {/* Header Azienda - Espandibile */}
                      <button
                        type="button"
                        onClick={() => toggleCompany(azienda)}
                        className="w-full px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all flex items-center justify-between text-left"
                        disabled={isUploading}
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
                            const isSelected = selectedClientId === String(cliente.id);
                            
                            return (
                              <button
                                key={cliente.id}
                                type="button"
                                onClick={() => setSelectedClientId(String(cliente.id))}
                                disabled={isUploading}
                                className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition flex items-center gap-3 border-l-2 ${
                                  isSelected 
                                    ? 'bg-blue-50 border-blue-500' 
                                    : 'border-transparent'
                                } ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {/* Spazio fisso per la corona */}
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
                                  <CheckCircle size={18} className="text-blue-600 flex-shrink-0" />
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
          </div>

          {/* Upload File */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File XML KeePass <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition">
              <input
                type="file"
                id="xmlFileInput"
                accept=".xml,application/xml,text/xml"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
              <label htmlFor="xmlFileInput" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {selectedFile ? selectedFile.name : 'Clicca per selezionare file XML'}
                </span>
                <span className="text-xs text-gray-400">
                  Formato: XML - Max 10MB
                </span>
              </label>
            </div>
            {selectedFile && (
              <div className="mt-2 p-2 bg-blue-50 rounded flex items-center gap-2">
                <FileText size={16} className="text-blue-600" />
                <span className="text-sm text-blue-700">{selectedFile.name}</span>
                <span className="text-xs text-blue-500">
                  ({(selectedFile.size / 1024).toFixed(2)} KB)
                </span>
              </div>
            )}
          </div>

          {/* Messaggi */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle size={20} className="text-red-600" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle size={20} className="text-green-600" />
              <span className="text-sm text-green-700">{success}</span>
            </div>
          )}

          {/* Migrazione */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <RefreshCw size={20} className="text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                  Aggiorna Credenziali Esistenti
                </h3>
                <p className="text-xs text-yellow-700 mb-3">
                  Aggiorna automaticamente tutte le credenziali già importate applicando le ultime correzioni:
                  corregge titoli e nomi salvati come oggetti JSON, aggiorna tutti i clienti. Le entry con password vuote vengono mantenute.
                </p>
                <button
                  type="button"
                  onClick={handleMigrate}
                  disabled={isMigrating || isUploading}
                  className="flex items-center gap-2 px-3 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition disabled:opacity-50"
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
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Nota:</strong> Tutti i gruppi e le credenziali verranno importati. 
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
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isUploading || !selectedFile || !selectedClientId}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
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

