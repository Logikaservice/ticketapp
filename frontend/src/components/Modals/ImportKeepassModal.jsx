// frontend/src/components/Modals/ImportKeepassModal.jsx

import React, { useState, useMemo, useEffect } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, RefreshCw, Building, Crown, ChevronRight, ChevronDown, Mail, Trash2 } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import {
  HubModalScaffold,
  HubModalChromeHeader,
  HubModalChromeFooter,
  HubModalPrimaryButton,
  HubModalSecondaryButton
} from './HubModalChrome';
import { HUB_MODAL_LABEL_CLS, HUB_MODAL_FIELD_CLS } from '../../utils/techHubAccent';

const ImportKeepassModal = ({ isOpen, onClose, users, getAuthHeader, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [migrationResult, setMigrationResult] = useState(null);
  const [hasExistingCredentials, setHasExistingCredentials] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  // Verifica se il cliente selezionato ha già credenziali
  useEffect(() => {
    // Reset immediato se non c'è cliente selezionato
    if (!selectedClientId) {
      setHasExistingCredentials(false);
      return;
    }

    let cancelled = false;

    const checkExistingCredentials = async () => {
      try {
        const authHeader = getAuthHeader();
        const response = await fetch(buildApiUrl(`/api/keepass/has-credentials/${selectedClientId}`), {
          method: 'GET',
          headers: {
            'x-user-role': 'tecnico',
            'x-user-id': authHeader['x-user-id'] || '',
            ...authHeader
          }
        });

        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();
          setHasExistingCredentials(data.hasCredentials);
        } else {
          setHasExistingCredentials(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Errore verifica credenziali esistenti:', err);
          setHasExistingCredentials(false);
        }
      }
    };

    checkExistingCredentials();

    // Cleanup per cancellare la richiesta se il componente si smonta o cambia selectedClientId
    return () => {
      cancelled = true;
    };
  }, [selectedClientId]); // Rimossa getAuthHeader dalle dipendenze

  const handleDeleteCredentials = async () => {
    if (!selectedClientId) return;

    const selectedClient = users.find(u => String(u.id) === selectedClientId);
    const clientName = selectedClient ? `${selectedClient.nome} ${selectedClient.cognome}`.trim() : 'questo cliente';

    if (!window.confirm(`Sei sicuro di voler cancellare tutte le credenziali KeePass per ${clientName}?\n\nQuesta operazione non può essere annullata.`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const authHeader = getAuthHeader();
      const response = await fetch(buildApiUrl(`/api/keepass/credentials/${selectedClientId}`), {
        method: 'DELETE',
        headers: {
          'x-user-role': 'tecnico',
          'x-user-id': authHeader['x-user-id'] || '',
          ...authHeader
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la cancellazione');
      }

      setSuccess(`Credenziali eliminate con successo per ${clientName} (${data.groupsDeleted} gruppi, ${data.entriesDeleted} entry)`);
      setHasExistingCredentials(false);
      
      // Reset dopo 2 secondi
      setTimeout(() => {
        setSuccess(null);
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (err) {
      console.error('Errore cancellazione credenziali:', err);
      setError(err.message || 'Errore durante la cancellazione delle credenziali');
    } finally {
      setIsDeleting(false);
    }
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
      const response = await fetch(buildApiUrl('/api/keepass/import'), {
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
      const response = await fetch(buildApiUrl('/api/keepass/migrate'), {
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
    <HubModalScaffold onBackdropClick={isUploading ? undefined : onClose} maxWidthClass="max-w-2xl" zClass="z-[118]">
        <HubModalChromeHeader
          icon={FileText}
          title="Importa KeePass"
          subtitle="Importa credenziali da un file XML di KeePass"
          onClose={isUploading ? undefined : onClose}
        />

        {/* Form */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          {/* Selezione Cliente */}
          <div>
            <label className={HUB_MODAL_LABEL_CLS}>
              Cliente <span className="text-red-400">*</span>
            </label>
            <div className="max-h-64 overflow-hidden overflow-y-auto rounded-lg border border-white/10">
              {Object.keys(clientiPerAzienda).length === 0 ? (
                <div className="p-4 text-center text-sm text-white/55">
                  Nessun cliente disponibile
                </div>
              ) : (
                Object.entries(clientiPerAzienda).map(([azienda, clientiAzienda]) => {
                  const isExpanded = expandedCompanies.has(azienda);
                  const isNoCompany = azienda === 'Senza azienda';
                  
                  return (
                    <div key={azienda} className="border-b border-white/10 last:border-b-0">
                      {/* Header Azienda - Espandibile */}
                      <button
                        type="button"
                        onClick={() => toggleCompany(azienda)}
                        className="flex w-full items-center justify-between bg-black/25 px-3 py-2 text-left transition hover:bg-black/35 disabled:opacity-50"
                        disabled={isUploading}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[color:var(--hub-accent)] text-xs font-bold text-[#121212]">
                            {isNoCompany ? <Building size={12} aria-hidden /> : azienda.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-bold text-white">
                              {isNoCompany ? 'Senza azienda' : azienda}
                            </h3>
                            <p className="text-xs text-white/55">
                              {clientiAzienda.length} {clientiAzienda.length === 1 ? 'cliente' : 'clienti'}
                            </p>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown size={16} className="shrink-0 text-white/45" aria-hidden />
                        ) : (
                          <ChevronRight size={16} className="shrink-0 text-white/45" aria-hidden />
                        )}
                      </button>
                      
                      {/* Clienti dell'azienda - Espansi/Collassati */}
                      {isExpanded && (
                        <div className="bg-black/15">
                          {clientiAzienda.map((cliente) => {
                            const isAdmin = isAdminOfCompany(cliente);
                            const isSelected = selectedClientId === String(cliente.id);
                            
                            return (
                              <button
                                key={cliente.id}
                                type="button"
                                onClick={() => setSelectedClientId(String(cliente.id))}
                                disabled={isUploading}
                                className={`flex w-full cursor-pointer items-center gap-3 border-l-2 px-4 py-2.5 text-left transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 ${
                                  isSelected 
                                    ? 'border-[color:var(--hub-accent)] bg-[color:var(--hub-accent)]/12' 
                                    : 'border-transparent'
                                }`}
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
                                      <span className={`text-sm font-medium ${isSelected ? 'text-[color:var(--hub-accent)]' : 'text-white'}`}>
                                        {cliente.nome} {cliente.cognome}
                                      </span>
                                    </div>
                                    {cliente.email && (
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <Mail size={12} className="text-white/38" aria-hidden />
                                        <span className="truncate text-xs text-white/55">
                                          {cliente.email}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <CheckCircle size={18} className="shrink-0 text-[color:var(--hub-accent)]" aria-hidden />
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
            
            {/* Pulsante Cancella Credenziali */}
            {selectedClientId && hasExistingCredentials && (
              <div className="mt-3 rounded-lg border border-red-500/35 bg-red-500/12 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={18} className="text-red-300" aria-hidden />
                    <span className="text-sm font-medium text-red-100">
                      Questo cliente ha già credenziali KeePass importate
                    </span>
                  </div>
                  <HubModalPrimaryButton
                    type="button"
                    onClick={handleDeleteCredentials}
                    disabled={isDeleting || isUploading}
                    className="flex items-center gap-2 bg-red-600 hover:brightness-110 disabled:opacity-50"
                  >
                    <Trash2 size={16} aria-hidden />
                    {isDeleting ? 'Cancellazione...' : 'Cancella Credenziali'}
                  </HubModalPrimaryButton>
                </div>
              </div>
            )}
          </div>

          {/* Upload File */}
          <div>
            <label className={HUB_MODAL_LABEL_CLS}>
              File XML KeePass <span className="text-red-400">*</span>
            </label>
            <div className="rounded-lg border-2 border-dashed border-white/15 p-4 text-center transition hover:border-[color:var(--hub-accent-border)]">
              <input
                type="file"
                id="xmlFileInput"
                accept=".xml,application/xml,text/xml"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
              <label htmlFor="xmlFileInput" className="flex cursor-pointer flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-white/38" aria-hidden />
                <span className="text-sm text-white/78">
                  {selectedFile ? selectedFile.name : 'Clicca per selezionare file XML'}
                </span>
                <span className="text-xs text-white/45">
                  Formato: XML - Max 10MB
                </span>
              </label>
            </div>
            {selectedFile && (
              <div className="mt-2 flex items-center gap-2 rounded border border-sky-500/35 bg-sky-500/10 p-2">
                <FileText size={16} className="text-sky-300" aria-hidden />
                <span className="text-sm text-sky-100">{selectedFile.name}</span>
                <span className="text-xs text-sky-200/80">
                  ({(selectedFile.size / 1024).toFixed(2)} KB)
                </span>
              </div>
            )}
          </div>

          {/* Messaggi */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/15 p-3">
              <AlertCircle size={20} className="text-red-300" aria-hidden />
              <span className="text-sm text-red-50">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/12 p-3">
              <CheckCircle size={20} className="text-emerald-300" aria-hidden />
              <span className="text-sm text-emerald-50">{success}</span>
            </div>
          )}

          {/* Migrazione */}
          <div className="rounded-lg border border-amber-500/38 bg-amber-500/10 p-4">
            <div className="flex gap-3">
              <RefreshCw size={20} className="mt-0.5 shrink-0 text-amber-200" aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 text-sm font-semibold text-amber-50">
                  Aggiorna Credenziali Esistenti
                </h3>
                <p className="mb-3 text-xs text-amber-100/85">
                  Aggiorna automaticamente tutte le credenziali già importate applicando le ultime correzioni:
                  corregge titoli e nomi salvati come oggetti JSON, aggiorna tutti i clienti. Le entry con password vuote vengono mantenute.
                </p>
                <HubModalSecondaryButton
                  type="button"
                  onClick={handleMigrate}
                  disabled={isMigrating || isUploading}
                  className="border-amber-500/40 bg-amber-600/90 text-[#121212] hover:bg-amber-500 disabled:opacity-50"
                >
                  <RefreshCw size={16} className={isMigrating ? 'animate-spin' : ''} aria-hidden />
                  {isMigrating ? 'Migrazione in corso...' : 'Aggiorna Tutte le Credenziali'}
                </HubModalSecondaryButton>
                {migrationResult && (
                  <div className="mt-3 rounded border border-white/10 bg-black/25 p-2 text-xs text-white/78">
                    <p className="mb-1 font-semibold text-white">Risultati:</p>
                    <ul className="space-y-1">
                      <li>✅ Entry aggiornate: {migrationResult.entriesUpdated}</li>
                      <li>📁 Gruppi aggiornati: {migrationResult.groupsUpdated}</li>
                      <li>📊 Totale processate: {migrationResult.totalProcessed}</li>
                      {migrationResult.errors > 0 && (
                        <li className="text-red-300">Errori: {migrationResult.errors}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <HubModalChromeFooter className="justify-end gap-2">
          <HubModalSecondaryButton type="button" onClick={onClose} disabled={isUploading}>
            Annulla
          </HubModalSecondaryButton>
          <HubModalPrimaryButton
            type="button"
            onClick={handleImport}
            disabled={isUploading || !selectedFile || !selectedClientId}
            className="flex items-center gap-2 disabled:opacity-50"
          >
            <Upload size={18} aria-hidden />
            {isUploading ? 'Importazione...' : 'Importa'}
          </HubModalPrimaryButton>
        </HubModalChromeFooter>
    </HubModalScaffold>
  );
};

export default ImportKeepassModal;

