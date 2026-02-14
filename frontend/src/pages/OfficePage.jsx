// frontend/src/pages/OfficePage.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader, Calendar, X, StickyNote, Eye, EyeOff } from 'lucide-react';
import SectionNavMenu from '../components/SectionNavMenu';
import { buildApiUrl } from '../utils/apiConfig';
import OfficeIntroCard from '../components/OfficeIntroCard';

const OfficePage = ({ onClose, getAuthHeader, selectedCompanyId: initialCompanyId, currentUser, onNavigateEmail, onNavigateAntiVirus, onNavigateNetworkMonitoring, onNavigateMappatura }) => {
  const isCliente = currentUser?.ruolo === 'cliente';
  const isTecnico = currentUser?.ruolo === 'tecnico' || currentUser?.ruolo === 'admin';
  const showPasswordColumn = isTecnico || (currentUser?.ruolo === 'cliente' && currentUser?.admin_companies && currentUser.admin_companies.length > 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [officeData, setOfficeData] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [cardStatuses, setCardStatuses] = useState({});  // chiave = "title||username" → { note }
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [loadingPasswords, setLoadingPasswords] = useState({});

  // Se l'azienda selezionata non è nella lista, considera come "nessuna selezione" (stesso fix di EmailPage per cliente)
  const selectedCompanyValid = companies.length > 0 && selectedCompanyId &&
    companies.some(c => String(c.id) === String(selectedCompanyId));
  const showIntro = !loadingCompanies && (!selectedCompanyId || !selectedCompanyValid);
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

  // Reset selezione se l'azienda non è nella lista (es. cliente con default non allineato)
  useEffect(() => {
    if (!loadingCompanies && companies.length > 0 && selectedCompanyId && !selectedCompanyValid) {
      setSelectedCompanyId('');
    }
  }, [loadingCompanies, companies, selectedCompanyId, selectedCompanyValid]);

  useEffect(() => {
    if (selectedCompanyValid) {
      loadOfficeData();
    } else if (!selectedCompanyId) {
      setOfficeData(null);
      setError(null);
      setCompanyName('');
    }
    setVisiblePasswords({});
    setLoadingPasswords({});
  }, [selectedCompanyId, companies, loadingCompanies, selectedCompanyValid]);

  const officeEntryKey = (file) => `${file.title || ''}|${file.username || ''}`;

  const fetchPassword = async (file) => {
    if (!showPasswordColumn || !companyName || !getAuthHeader) return;
    const key = officeEntryKey(file);
    setLoadingPasswords(p => ({ ...p, [key]: true }));
    try {
      const params = new URLSearchParams({ aziendaName: companyName, title: file.title || '', username: file.username || '' });
      const res = await fetch(buildApiUrl(`/api/keepass/office-password?${params}`), { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Password non trovata');
      const data = await res.json();
      setVisiblePasswords(v => ({ ...v, [key]: data.password || '' }));
    } catch (err) {
      console.error('Errore recupero password Office:', err);
    } finally {
      setLoadingPasswords(p => ({ ...p, [key]: false }));
    }
  };

  const hidePassword = (file) => {
    const key = officeEntryKey(file);
    setVisiblePasswords(v => { const n = { ...v }; delete n[key]; return n; });
  };

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
          map[`${r.card_title || ''}||${r.card_username || ''}`] = { note: r.note || '' };
        }
        setCardStatuses(map);
      }
    } catch (e) { console.warn('Errore caricamento card status:', e); }
  }, [getAuthHeader]);

  // Salva stato card (con debounce per la nota)
  const saveCardStatus = useCallback(async (file, fields) => {
    if (!companyName || !getAuthHeader || !isTecnico) return;
    const key = cardKey(file);
    const current = cardStatuses[key] || { note: '' };
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
          is_expired: false,
          note: merged.note
        })
      });
    } catch (e) { console.warn('Errore salvataggio card status:', e); }
  }, [companyName, getAuthHeader, isTecnico, cardStatuses]);

  // Salva nota con debounce (evita troppe chiamate durante la digitazione)
  const saveNoteDebounced = useCallback((file, note) => {
    const key = cardKey(file);
    setCardStatuses(prev => ({ ...prev, [key]: { ...(prev[key] || { note: '' }), note } }));
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
          <SectionNavMenu
            currentPage="office"
            onNavigateHome={onClose}
            onNavigateOffice={null}
            onNavigateEmail={onNavigateEmail}
            onNavigateAntiVirus={onNavigateAntiVirus}
            onNavigateNetworkMonitoring={onNavigateNetworkMonitoring}
            onNavigateMappatura={onNavigateMappatura}
            currentUser={currentUser}
          />
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

        {showIntro && (
          <div className="max-w-4xl mx-auto w-full">
            <OfficeIntroCard
              companies={companies}
              value={selectedCompanyValid ? selectedCompanyId : ''}
              onChange={(companyId) => {
                const newCompanyId = companyId || null;
                setSelectedCompanyId(newCompanyId);
                setError(null);
                setOfficeData(null);
                setCompanyName('');
                if (newCompanyId) {
                  const company = companies.find(c => String(c.id) === String(newCompanyId));
                  if (company) setCompanyName((company.azienda || '').split(':')[0].trim());
                }
              }}
            />
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

        {!loading && !loadingCompanies && error && !showIntro && selectedCompanyId && (
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {officeData.files.map((file, index) => {
                const status = cardStatuses[cardKey(file)] || { note: '' };
                const keepassExpired = file.expires ? new Date(file.expires) < new Date() : false;
                const isExpired = keepassExpired;
                return (
                <div key={index} className={`bg-white rounded-lg shadow-sm border-2 px-4 py-3 transition-colors ${isExpired ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                  {/* Titolo */}
                  <div className="mb-2 pb-2 border-b border-gray-200">
                    <h3 className="text-base font-bold text-gray-900 truncate">{file.title || `File ${index + 1}`}</h3>
                    {/* Nome utente e Password sulla stessa riga */}
                    <div className="mt-2 flex flex-wrap items-start gap-x-6 gap-y-2">
                      {file.username && file.username.trim() !== '' && (
                        <div>
                          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Nome utente</p>
                          <p className="text-xs text-gray-900 font-mono">{file.username}</p>
                        </div>
                      )}
                      {showPasswordColumn && (
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide shrink-0">Password</p>
                          {visiblePasswords[officeEntryKey(file)] !== undefined ? (
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-gray-800 bg-gray-50 px-2 py-0.5 rounded text-xs">{visiblePasswords[officeEntryKey(file)]}</span>
                              <button
                                type="button"
                                onClick={() => hidePassword(file)}
                                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                title="Nascondi password"
                              >
                                <EyeOff size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => fetchPassword(file)}
                              disabled={loadingPasswords[officeEntryKey(file)]}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors whitespace-nowrap disabled:opacity-50"
                              title="Mostra password"
                            >
                              {loadingPasswords[officeEntryKey(file)] ? <Loader size={12} className="animate-spin" /> : <Eye size={14} />}
                              {loadingPasswords[officeEntryKey(file)] ? '...' : 'Mostra'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Campi personalizzati del file */}
                  <div className="mb-2">
                    <h4 className="text-xs font-semibold text-gray-500 mb-1">Attivo su:</h4>
                    
                    {file.customFields && Object.keys(file.customFields).length > 0 ? (
                      <div className="space-y-0.5">
                        {Object.entries(file.customFields)
                          .filter(([key]) => ['custom1', 'custom2', 'custom3', 'custom4', 'custom5'].includes(key))
                          .sort(([keyA], [keyB]) => {
                            const numA = parseInt(keyA.replace('custom', ''));
                            const numB = parseInt(keyB.replace('custom', ''));
                            return numA - numB;
                          })
                          .map(([key, value]) => {
                            const fieldNumber = key.replace('custom', '');
                            const valueStr = value ? String(value).trim() : '';
                            
                            const getBorderColor = (num) => {
                              if (num === '1') return 'border-blue-500';
                              if (num === '2') return 'border-green-500';
                              if (num === '3') return 'border-yellow-500';
                              if (num === '4') return 'border-purple-500';
                              if (num === '5') return 'border-red-500';
                              return 'border-gray-400';
                            };
                            
                            return (
                              <div key={key} className={`border-l-4 ${getBorderColor(fieldNumber)} pl-3 py-1`}>
                                {valueStr ? (
                                  <p className="text-sm text-gray-900">
                                    <span className="font-semibold">{fieldNumber}.</span> {valueStr}
                                  </p>
                                ) : (
                                  <p className="text-sm text-gray-400 italic">
                                    <span className="font-semibold">{fieldNumber}.</span> (vuoto)
                                  </p>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">Nessun campo personalizzato trovato</p>
                    )}
                  </div>

                  {/* Scadenza + Nota (automatica da KeePass) */}
                  {file.expires && (
                    <div className={`pt-2 border-t ${isExpired ? 'border-red-300' : 'border-gray-200'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className={keepassExpired ? 'text-red-600' : 'text-gray-600'} />
                          <p className="text-xs text-gray-500">
                            Scadenza:{' '}
                            <span className={`font-medium ${keepassExpired ? 'text-red-700' : 'text-gray-900'}`}>
                              {formatDate(file.expires)}
                              {keepassExpired ? ' (scaduta)' : ''}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 sm:max-w-xs">
                          <span className="text-xs text-gray-500 shrink-0">Nota:</span>
                          {isTecnico ? (
                            <input
                              type="text"
                              value={status.note}
                              onChange={(e) => saveNoteDebounced(file, e.target.value)}
                              placeholder="Aggiungi nota..."
                              className={`flex-1 min-w-0 text-xs border rounded px-2 py-1 outline-none focus:ring-1 ${isExpired ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-400'}`}
                            />
                          ) : (
                            <span className="text-xs text-gray-700 truncate">{status.note || '-'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
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
