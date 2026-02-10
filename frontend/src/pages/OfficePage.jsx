// frontend/src/pages/OfficePage.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Loader, Calendar, X, CheckSquare, Square, StickyNote } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const OfficePage = ({ onClose, getAuthHeader, selectedCompanyId: initialCompanyId, currentUser }) => {
  const isCliente = currentUser?.ruolo === 'cliente';
  const isTecnico = currentUser?.ruolo === 'tecnico' || currentUser?.ruolo === 'admin';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [officeData, setOfficeData] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [cardStatuses, setCardStatuses] = useState({});  // chiave = "title||username" → { is_expired, note }
  const saveTimers = useRef({});

  // Carica le aziende al mount
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!getAuthHeader) return;
      try {
        setLoadingCompanies(true);
        const response = await fetch(buildApiUrl('/api/network-monitoring/all-clients'), {
          headers: getAuthHeader()
        });
        if (response.ok) {
          const data = await response.json();
          // Deduplica per nome azienda (mantieni primo id per ogni nome)
          const seen = new Set();
          const unique = (data || []).filter(c => {
            const name = (c.azienda || '').trim();
            if (!name || seen.has(name)) return false;
            seen.add(name);
            return true;
          });
          setCompanies(unique);
        } else {
          console.error("Errore fetch aziende:", response.status);
          setError('Errore nel caricamento delle aziende');
        }
      } catch (err) {
        console.error("Errore caricamento aziende:", err);
        setError('Errore nel caricamento delle aziende');
      } finally {
        setLoadingCompanies(false);
      }
    };
    fetchCompanies();
  }, []);

  useEffect(() => {
    // Non caricare automaticamente i dati - l'utente deve selezionare manualmente l'azienda
    // I dati verranno caricati solo quando l'utente seleziona un'azienda dal dropdown
  }, [selectedCompanyId]);

  const loadOfficeData = async (companyIdOverride = null) => {
    const companyIdToUse = companyIdOverride || selectedCompanyId;
    
    if (!companyIdToUse || !getAuthHeader) {
      setError('Azienda non selezionata');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Usa l'azienda già caricata dalla lista companies
      const company = companies.find(c => String(c.id) === String(companyIdToUse));
      
      if (!company) {
        throw new Error('Azienda non trovata');
      }

      const aziendaName = company.azienda || '';
      console.log('🔍 Caricamento Office per azienda:', aziendaName, 'ID:', company.id);
      
      // Pulisci il nome dell'azienda da eventuali caratteri strani o ID
      const cleanAziendaName = aziendaName.split(':')[0].trim();
      console.log('🔍 Nome azienda pulito:', cleanAziendaName);
      
      setCompanyName(cleanAziendaName);

      // Ora recupera i dati Office da Keepass
      const apiUrl = buildApiUrl(`/api/keepass/office/${encodeURIComponent(cleanAziendaName)}`);
      console.log('🔍 URL API chiamato:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 404) {
          setError('Office non trovato in Keepass per questa azienda');
        } else {
          throw new Error(errorData.error || 'Errore nel caricamento dei dati Office');
        }
        return;
      }

      const data = await response.json();
      console.log('📦 Dati Office ricevuti dal backend:', data);
      console.log('📦 customFields:', data.customFields);
      console.log('📦 Tipo customFields:', typeof data.customFields);
      console.log('📦 È array?', Array.isArray(data.customFields));
      console.log('📦 Chiavi customFields:', data.customFields ? Object.keys(data.customFields) : 'null');
      console.log('📦 Valori customFields:', data.customFields ? Object.entries(data.customFields).map(([k, v]) => `${k}: "${v}"`).join(', ') : 'null');
      setOfficeData(data);
      // Carica stati scaduta/nota per le card di questa azienda
      await loadCardStatuses(cleanAziendaName);
    } catch (err) {
      console.error('Errore caricamento Office:', err);
      setError(err.message || 'Errore nel caricamento dei dati Office');
    } finally {
      setLoading(false);
    }
  };

  // Chiave univoca per ogni card
  const cardKey = (file) => `${file.title || ''}||${file.username || ''}`;

  // Carica stati card dal backend
  const loadCardStatuses = useCallback(async (azienda) => {
    if (!azienda || !getAuthHeader) return;
    try {
      const resp = await fetch(buildApiUrl(`/api/keepass/office-card-status/${encodeURIComponent(azienda)}`), { headers: getAuthHeader() });
      if (resp.ok) {
        const rows = await resp.json();
        const map = {};
        for (const r of rows) {
          map[`${r.card_title || ''}||${r.card_username || ''}`] = { is_expired: r.is_expired, note: r.note || '' };
        }
        setCardStatuses(map);
      }
    } catch (e) { console.warn('Errore caricamento card status:', e); }
  }, [getAuthHeader]);

  // Salva stato card (con debounce per la nota)
  const saveCardStatus = useCallback(async (file, fields) => {
    if (!companyName || !getAuthHeader || !isTecnico) return;
    const key = cardKey(file);
    const current = cardStatuses[key] || { is_expired: false, note: '' };
    const merged = { ...current, ...fields };
    setCardStatuses(prev => ({ ...prev, [key]: merged }));
    try {
      await fetch(buildApiUrl('/api/keepass/office-card-status'), {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azienda_name: companyName,
          card_title: file.title || '',
          card_username: file.username || '',
          is_expired: merged.is_expired,
          note: merged.note
        })
      });
    } catch (e) { console.warn('Errore salvataggio card status:', e); }
  }, [companyName, getAuthHeader, isTecnico, cardStatuses]);

  // Salva nota con debounce (evita troppe chiamate durante la digitazione)
  const saveNoteDebounced = useCallback((file, note) => {
    const key = cardKey(file);
    setCardStatuses(prev => ({ ...prev, [key]: { ...(prev[key] || { is_expired: false, note: '' }), note } }));
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      saveCardStatus(file, { note });
    }, 800);
  }, [saveCardStatus]);

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-[100] flex flex-col font-sans w-full h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-full" 
            title="Chiudi Office"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Office</h1>
            <p className="text-sm text-gray-600">{companyName || 'Seleziona un\'azienda'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!loadingCompanies && (isCliente ? !!selectedCompanyId : true) && (
            <select
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={selectedCompanyId || ''}
              onChange={async (e) => {
                const newCompanyId = e.target.value;
                setSelectedCompanyId(newCompanyId);
                setError(null);
                setOfficeData(null);
                setCompanyName('');
                
                // Carica i dati solo se è stata selezionata un'azienda
                if (newCompanyId) {
                  await loadOfficeData(newCompanyId);
                }
              }}
            >
              <option value="">Seleziona Azienda...</option>
              {companies.map(c => (
                <option key={c.id} value={String(c.id)}>{c.azienda}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loadingCompanies && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader size={32} className="animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Caricamento aziende...</p>
            </div>
          </div>
        )}

        {!loadingCompanies && !selectedCompanyId && (
          <div className="flex flex-col items-center justify-center flex-1 min-h-0 py-8">
            <div className={`bg-blue-50 border border-blue-200 rounded-xl p-6 flex flex-col items-center gap-4 max-w-md w-full ${isCliente ? 'shadow-md' : ''}`}>
              <h3 className="font-semibold text-blue-800 text-lg">Seleziona un'azienda</h3>
              {isCliente ? (
                <>
                  <p className="text-blue-700 text-sm text-center">Scegli l'azienda per visualizzare i dati Office da Keepass.</p>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    value={selectedCompanyId || ''}
                    onChange={async (e) => {
                      const newCompanyId = e.target.value;
                      setSelectedCompanyId(newCompanyId);
                      setError(null);
                      setOfficeData(null);
                      setCompanyName('');
                      if (newCompanyId) await loadOfficeData(newCompanyId);
                    }}
                  >
                    <option value="">Seleziona Azienda...</option>
                    {companies.map(c => (
                      <option key={c.id} value={String(c.id)}>{c.azienda}</option>
                    ))}
                  </select>
                </>
              ) : (
                <p className="text-blue-700 text-sm text-center">Seleziona un'azienda dal menu in alto per visualizzare i dati Office da Keepass.</p>
              )}
            </div>
          </div>
        )}

        {loading && selectedCompanyId && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader size={32} className="animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Caricamento dati Office da Keepass...</p>
            </div>
          </div>
        )}

        {!loading && !loadingCompanies && error && selectedCompanyId && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <X size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-800 mb-1">Errore</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && officeData && (
          <div className="max-w-7xl mx-auto">
            {/* Lista di tutti i file trovati */}
            {officeData.files && officeData.files.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {officeData.files.map((file, index) => {
                const status = cardStatuses[cardKey(file)] || { is_expired: false, note: '' };
                return (
                <div key={index} className={`bg-white rounded-lg shadow-md border-2 p-6 transition-colors ${status.is_expired ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                  {/* Titolo e username del file */}
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{file.title || `File ${index + 1}`}</h3>
                      </div>
                      {file.username && file.username.trim() !== '' && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nome utente</p>
                          <p className="text-gray-900 font-mono">{file.username}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Campi personalizzati del file */}
                  <div className="space-y-4 mb-4">
                    <h4 className="text-md font-semibold text-gray-700">Attivo su:</h4>
                    
                    {file.customFields && Object.keys(file.customFields).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(file.customFields)
                          .filter(([key]) => ['custom1', 'custom2', 'custom3', 'custom4', 'custom5'].includes(key))
                          .sort(([keyA], [keyB]) => {
                            // Ordina per numero: custom1, custom2, custom3, custom4, custom5
                            const numA = parseInt(keyA.replace('custom', ''));
                            const numB = parseInt(keyB.replace('custom', ''));
                            return numA - numB;
                          })
                          .map(([key, value]) => {
                            // Estrai il numero dal nome del campo (custom1 -> 1, custom2 -> 2, ecc.)
                            const fieldNumber = key.replace('custom', '');
                            const valueStr = value ? String(value).trim() : '';
                            
                            // Determina il colore del bordo in base al campo
                            const getBorderColor = (num) => {
                              if (num === '1') return 'border-blue-500';
                              if (num === '2') return 'border-green-500';
                              if (num === '3') return 'border-yellow-500';
                              if (num === '4') return 'border-purple-500';
                              if (num === '5') return 'border-red-500';
                              return 'border-gray-400';
                            };
                            
                            return (
                              <div key={key} className={`border-l-4 ${getBorderColor(fieldNumber)} pl-4 py-2`}>
                                {valueStr ? (
                                  <p className="text-gray-900">
                                    <span className="font-semibold">{fieldNumber}.</span> {valueStr}
                                  </p>
                                ) : (
                                  <p className="text-gray-400 italic">
                                    <span className="font-semibold">{fieldNumber}.</span> (vuoto)
                                  </p>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">Nessun campo personalizzato trovato</p>
                    )}
                  </div>

                  {/* Scadenza del file */}
                  {file.expires && (
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        <Calendar size={20} className="text-gray-600" />
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Scadenza</p>
                          <p className="text-gray-900">{formatDate(file.expires)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stato scaduta + Nota */}
                  <div className={`pt-4 mt-4 border-t ${status.is_expired ? 'border-red-300' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-4">
                      {/* Toggle Scaduta */}
                      <button
                        onClick={() => isTecnico && saveCardStatus(file, { is_expired: !status.is_expired })}
                        className={`flex items-center gap-2 shrink-0 ${isTecnico ? 'cursor-pointer' : 'cursor-default'}`}
                        title={isTecnico ? 'Segna come scaduta / non scaduta' : ''}
                        disabled={!isTecnico}
                      >
                        {status.is_expired
                          ? <CheckSquare size={22} className="text-red-600" />
                          : <Square size={22} className="text-gray-400" />
                        }
                        <span className={`text-sm font-semibold ${status.is_expired ? 'text-red-700' : 'text-gray-500'}`}>
                          {status.is_expired ? 'Scaduta' : 'Non scaduta'}
                        </span>
                      </button>

                      {/* Campo Nota */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <StickyNote size={16} className="text-gray-400 shrink-0" />
                        <span className="text-xs font-medium text-gray-500 shrink-0">Nota:</span>
                        {isTecnico ? (
                          <input
                            type="text"
                            value={status.note}
                            onChange={(e) => saveNoteDebounced(file, e.target.value)}
                            placeholder="Aggiungi una nota..."
                            className={`flex-1 min-w-0 text-sm border rounded px-2 py-1 outline-none focus:ring-1 ${status.is_expired ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-400'}`}
                          />
                        ) : (
                          <span className="text-sm text-gray-700 truncate">{status.note || '-'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <p className="text-gray-500 italic">Nessun file trovato nel gruppo Office</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OfficePage;
