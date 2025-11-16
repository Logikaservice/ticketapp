// frontend/src/components/Modals/ImportKeepassModal.jsx

import React, { useState, useMemo } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

const ImportKeepassModal = ({ isOpen, onClose, users, getAuthHeader, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [migrationResult, setMigrationResult] = useState(null);

  // Memoizza il filtro dei clienti per evitare ricalcoli ad ogni render
  const clientiAttivi = useMemo(() => {
    if (!users || !Array.isArray(users)) return [];
    return users.filter(u => u.ruolo === 'cliente');
  }, [users]);

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
          {/* Selezione Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent hover:border-purple-400 transition bg-white"
              disabled={isUploading}
            >
              <option value="">Seleziona un cliente...</option>
              {clientiAttivi.map(cliente => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.azienda || 'Senza azienda'} - {cliente.email}
                </option>
              ))}
            </select>
          </div>

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

