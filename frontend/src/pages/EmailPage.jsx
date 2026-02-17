// frontend/src/pages/EmailPage.jsx
// Pagina Email - struttura da KeePass (cartella Email per azienda, righe divisorie per @nomequalcosa)
// Scadenza letta da KeePass (entry.times.expiryTime); riga in rosso se scaduta
// Barra spazio occupato sotto ogni riga email (dati da IMAP QUOTA)

import React, { useState, useEffect, useCallback } from 'react';
import { Loader, MessageCircle, Eye, EyeOff, HardDrive, RefreshCw, AlertTriangle, Clock, Activity, HelpCircle } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import EmailIntroCard from '../components/EmailIntroCard';
import SectionNavMenu from '../components/SectionNavMenu';

const EmailPage = ({ onClose, getAuthHeader, selectedCompanyId: initialCompanyId, currentUser, onOpenTicket, onNavigateOffice, onNavigateAntiVirus, onNavigateNetworkMonitoring, onNavigateMappatura }) => {
  const isCliente = currentUser?.ruolo === 'cliente';
  const showAssistenzaButton = isCliente && typeof onOpenTicket === 'function';
  const showPasswordColumn = currentUser?.ruolo === 'tecnico' || currentUser?.ruolo === 'admin' || (currentUser?.ruolo === 'cliente' && currentUser?.admin_companies && currentUser.admin_companies.length > 0);
  const isTecnico = currentUser?.ruolo === 'tecnico' || currentUser?.ruolo === 'admin';
  const [loading, setLoading] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [loadingPasswords, setLoadingPasswords] = useState({});
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // Quota state
  const [quotaData, setQuotaData] = useState({}); // keyed by email
  const [scanning, setScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(null);

  const selectedCompanyValid = companies.length > 0 && selectedCompanyId &&
    companies.some(c => String(c.id) === String(selectedCompanyId));
  const showIntro = !loadingCompanies && (!selectedCompanyId || !selectedCompanyValid);

  const entryKey = (item) => `${item.title || ''}|${item.username || ''}|${item.url || ''}|${item.divider || ''}`;

  const formatExpiry = (expires) => {
    if (!expires) return '—';
    try {
      const d = new Date(expires);
      return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  // ============ QUOTA HELPERS ============
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const b = Number(bytes);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getBarColor = (percent) => {
    if (percent >= 90) return { bar: '#ef4444', bg: '#fef2f2', text: '#dc2626' };
    if (percent >= 70) return { bar: '#f59e0b', bg: '#fffbeb', text: '#d97706' };
    return { bar: '#3b82f6', bg: '#eff6ff', text: '#2563eb' };
  };

  const formatScanTime = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMin < 1) return 'adesso';
    if (diffMin < 60) return `${diffMin} min fa`;
    if (diffHours < 24) return `${diffHours}h fa`;
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getActivityStatus = (lastEmailDate) => {
    // Se non c'è data (mai usata o vuota) -> Forse Inattivo
    if (!lastEmailDate) {
      console.log('[EmailPage] getActivityStatus: lastEmailDate è null/undefined');
      return { status: 'inactive', label: 'Forse Inattivo', color: 'bg-amber-100 text-amber-700' };
    }

    const d = new Date(lastEmailDate);
    if (isNaN(d.getTime())) {
      console.log('[EmailPage] getActivityStatus: lastEmailDate non valida:', lastEmailDate);
      return { status: 'inactive', label: 'Forse Inattivo', color: 'bg-amber-100 text-amber-700' };
    }

    const now = new Date();
    // Calcolo più preciso: differenza in giorni, poi converti in mesi
    const diffMs = now.getTime() - d.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const diffMonths = diffDays / 30; // Approssimazione: 30 giorni = 1 mese

    // Debug per capire il problema
    if (diffMonths < 6) {
      console.log(`[EmailPage] getActivityStatus: ATTIVO - lastEmailDate: ${d.toISOString()}, diff: ${diffMonths.toFixed(1)} mesi`);
      return { status: 'active', label: 'Attivo', color: 'bg-green-100 text-green-700' };
    } else {
      console.log(`[EmailPage] getActivityStatus: INATTIVO - lastEmailDate: ${d.toISOString()}, diff: ${diffMonths.toFixed(1)} mesi`);
      return { status: 'inactive', label: 'Forse Inattivo', color: 'bg-amber-100 text-amber-700' };
    }
  };

  // ============ FETCH QUOTA RESULTS ============
  const fetchQuotaResults = useCallback(async (azName) => {
    if (!azName || !getAuthHeader) return;
    try {
      const res = await fetch(buildApiUrl(`/api/email-quota/results/${encodeURIComponent(azName)}`), {
        headers: getAuthHeader()
      });
      if (!res.ok) return;
      const data = await res.json();
      const map = {};
      let newest = null;
      (data.results || []).forEach(r => {
        map[r.email?.toLowerCase()] = r;
        if (r.last_scan && (!newest || new Date(r.last_scan) > new Date(newest))) {
          newest = r.last_scan;
        }
      });
      setQuotaData(map);
      setLastScanTime(newest);
    } catch (err) {
      console.error('Errore fetch quota:', err);
    }
  }, [getAuthHeader]);

  // ============ TRIGGER SCAN ============
  const handleScan = async () => {
    if (!companyName || !getAuthHeader) return;
    setScanning(true);
    try {
      await fetch(buildApiUrl(`/api/email-quota/scan/${encodeURIComponent(companyName)}`), {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' }
      });
      // Polling per aggiornare i risultati
      const pollInterval = setInterval(async () => {
        await fetchQuotaResults(companyName);
      }, 4000);
      // Stop dopo 2 minuti max
      setTimeout(() => {
        clearInterval(pollInterval);
        setScanning(false);
      }, 120000);
      // Primo check dopo 5 secondi
      setTimeout(() => fetchQuotaResults(companyName), 5000);
    } catch (err) {
      console.error('Errore scan:', err);
      setScanning(false);
    }
  };

  // Reset selezione se l'azienda non è nella lista
  useEffect(() => {
    if (!loadingCompanies && companies.length > 0 && selectedCompanyId && !selectedCompanyValid) {
      setSelectedCompanyId('');
    }
  }, [loadingCompanies, companies, selectedCompanyId, selectedCompanyValid]);

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
          const seen = new Set();
          const unique = (data || []).filter(c => {
            const name = (c.azienda || '').trim();
            if (!name || seen.has(name)) return false;
            seen.add(name);
            return true;
          });
          setCompanies(unique);
        }
      } catch (err) {
        console.error('Errore caricamento aziende:', err);
      } finally {
        setLoadingCompanies(false);
      }
    };
    fetchCompanies();
  }, [getAuthHeader]);

  useEffect(() => {
    if (selectedCompanyValid) {
      loadEmailData();
    } else {
      setItems([]);
      setError(null);
      setHasSearched(false);
      setCompanyName('');
      setQuotaData({});
      setLastScanTime(null);
    }
    setVisiblePasswords({});
    setLoadingPasswords({});
  }, [selectedCompanyId, companies, loadingCompanies, selectedCompanyValid]);

  // Fetch quota data when companyName changes
  useEffect(() => {
    if (companyName && isTecnico) {
      fetchQuotaResults(companyName);
    }
  }, [companyName, isTecnico, fetchQuotaResults]);

  const fetchPassword = async (item) => {
    if (!showPasswordColumn || !companyName || !getAuthHeader) return;
    const key = entryKey(item);
    setLoadingPasswords(p => ({ ...p, [key]: true }));
    try {
      const params = new URLSearchParams({
        aziendaName: companyName,
        title: item.title || '',
        username: item.username || '',
        url: item.url || '',
        divider: item.divider || ''
      });
      const res = await fetch(buildApiUrl(`/api/keepass/email-password?${params}`), { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Password non trovata');
      const data = await res.json();
      setVisiblePasswords(v => ({ ...v, [key]: data.password || '' }));
    } catch (err) {
      console.error('Errore recupero password:', err);
    } finally {
      setLoadingPasswords(p => ({ ...p, [key]: false }));
    }
  };

  const hidePassword = (item) => {
    const key = entryKey(item);
    setVisiblePasswords(v => {
      const next = { ...v };
      delete next[key];
      return next;
    });
  };

  const loadEmailData = async () => {
    if (!selectedCompanyId || !getAuthHeader) {
      setError('Seleziona un\'azienda');
      return;
    }

    const company = companies.find(c => String(c.id) === String(selectedCompanyId));
    if (!company) {
      setError('Azienda non trovata');
      return;
    }

    const aziendaName = (company.azienda || '').split(':')[0].trim();
    setLoading(true);
    setError(null);
    setItems([]);

    try {
      const response = await fetch(buildApiUrl(`/api/keepass/email/${encodeURIComponent(aziendaName)}`), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 404) {
          setError('Cartella Email non trovata in KeePass per questa azienda');
        } else {
          setError(errData.error || 'Errore nel caricamento');
        }
        setHasSearched(true);
        return;
      }

      const data = await response.json();
      setItems(data.items || []);
      setHasSearched(true);
      setCompanyName(aziendaName);
    } catch (err) {
      setError(err.message || 'Errore nel caricamento');
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  };

  // ============ QUOTA BAR COMPONENT (inline sotto ogni riga) ============
  const QuotaBar = ({ email }) => {
    const q = quotaData[email?.toLowerCase()];
    if (!q || q.status === 'error') return null;

    const percent = parseFloat(q.usage_percent) || 0;
    const colors = getBarColor(percent);
    const colCount = 4 + (showPasswordColumn ? 1 : 0) + (showAssistenzaButton ? 1 : 0);
    const activity = getActivityStatus(q.last_email_date);

    return (
      <tr className="border-b border-gray-50 bg-gray-50/30">
        <td colSpan={colCount} className="px-3 py-1.5 align-middle">
          <div className="flex items-center gap-4 ml-8">
            {/* Usage Badge */}
            <div className="flex items-center gap-2 min-w-[80px]">
              <HardDrive size={13} className="text-gray-400" />
              <span className="text-[11px] font-bold text-gray-700">
                {formatBytes(q.usage_bytes)}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="flex flex-1 items-center gap-2 max-w-md">
              <div className="h-2 flex-1 rounded-full bg-gray-200 overflow-hidden relative" title={`${percent.toFixed(1)}% occupato`}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(percent, 100)}%`,
                    backgroundColor: colors.bar,
                  }}
                />
              </div>
              <span className="text-[10px] text-gray-500 w-12 text-right">
                {percent.toFixed(0)}%
              </span>
              {percent >= 70 && (
                <AlertTriangle size={12} className={percent >= 90 ? 'text-red-500' : 'text-amber-500'} />
              )}
            </div>

            {/* Activity Badge */}
            <div className="flex items-center gap-2" title={q.last_email_date ? `Ultima email ricevuta: ${new Date(q.last_email_date).toLocaleDateString()}` : 'Nessuna email trovata'}>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border ${activity.color.replace('text-', 'border-').replace('100', '200')} ${activity.color}`}>
                <Activity size={10} />
                {activity.label}
              </span>
              {activity.status === 'inactive' && (
                <span className="text-[10px] text-gray-400 italic">
                  (Ultima email {q.last_email_date ? new Date(q.last_email_date).toLocaleDateString() : 'mai'})
                </span>
              )}
            </div>

            {/* Limit Info */}
            <div className="text-[10px] text-gray-400 ml-auto flex items-center gap-1">
              Max: {formatBytes(q.limit_bytes)}
            </div>
          </div>
        </td>
      </tr>
    );
  };

  // ============ CONTEGGIO QUOTA STATS ============
  const quotaEntries = Object.values(quotaData);
  const quotaCount = quotaEntries.length;
  const quotaCritical = quotaEntries.filter(q => q.status === 'critical').length;
  const quotaWarning = quotaEntries.filter(q => q.status === 'warning').length;

  return (
    <div className="fixed inset-0 bg-gray-50 z-[100] flex flex-col font-sans w-full h-full overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <SectionNavMenu
            currentPage="email"
            onNavigateHome={onClose}
            onNavigateOffice={onNavigateOffice}
            onNavigateEmail={null}
            onNavigateAntiVirus={onNavigateAntiVirus}
            onNavigateNetworkMonitoring={onNavigateNetworkMonitoring}
            onNavigateMappatura={onNavigateMappatura}
            currentUser={currentUser}
          />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Email</h1>
            <p className="text-sm text-gray-600">{companyName || 'Seleziona un\'azienda'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Scan button + quota info - solo per tecnici con azienda selezionata */}
          {isTecnico && selectedCompanyValid && companyName && items.length > 0 && (
            <div className="flex items-center gap-2">
              {/* Mini stats */}
              {quotaCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-400 mr-1">
                  <Clock size={12} />
                  <span>{formatScanTime(lastScanTime) || 'Mai'}</span>
                  {quotaCritical > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                      {quotaCritical} critico
                    </span>
                  )}
                  {quotaWarning > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 font-medium">
                      {quotaWarning} att.
                    </span>
                  )}
                </div>
              )}
              <button
                onClick={handleScan}
                disabled={scanning}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all shadow-sm
                  ${scanning
                    ? 'bg-blue-50 text-blue-500 cursor-not-allowed border border-blue-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'}`}
                title="Scansiona lo spazio delle caselle email via IMAP"
              >
                <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} />
                {scanning ? 'Scansione...' : 'Scan Spazio'}
              </button>
            </div>
          )}
          {!loadingCompanies && (isCliente ? !!selectedCompanyId : true) && (
            <select
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={selectedCompanyId || ''}
              onChange={async (e) => {
                const newCompanyId = e.target.value || null;
                setSelectedCompanyId(newCompanyId);
                setError(null);
                setItems([]);
                setCompanyName('');
                setQuotaData({});
                setLastScanTime(null);
                if (newCompanyId) {
                  const company = companies.find(c => String(c.id) === String(newCompanyId));
                  if (company) {
                    setCompanyName((company.azienda || '').split(':')[0].trim());
                  }
                }
              }}
            >
              <option value="">Seleziona Azienda...</option>
              {companies.map(c => (
                <option key={c.id} value={String(c.id)}>{c.azienda || `ID ${c.id}`}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto w-full">
          {loadingCompanies && (
            <div className="flex justify-center items-center py-12">
              <Loader size={32} className="animate-spin text-blue-600 mr-3" />
              <span className="text-gray-600">Caricamento aziende...</span>
            </div>
          )}

          {!loadingCompanies && error && !showIntro && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {!loadingCompanies && items.length > 0 && (
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-1.5 px-3 font-semibold text-gray-700">Titolo</th>
                    <th className="text-left py-1.5 px-3 font-semibold text-gray-700">Nome Utente</th>
                    {showPasswordColumn && <th className="text-left py-1.5 px-3 font-semibold text-gray-700 min-w-[120px]">Password</th>}
                    <th className="text-left py-1.5 px-3 font-semibold text-gray-700">URL</th>
                    <th className="text-left py-1.5 px-3 font-semibold text-gray-700">Scadenza</th>
                    {showAssistenzaButton && <th className="text-left py-1.5 px-3 font-semibold text-gray-700 min-w-[140px] w-40">Assistenza</th>}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let currentLevel = 0;
                    let lastDomainLevel0 = null;
                    const domainFromName = (n) => (n || '').replace(/^@/, '').trim().toLowerCase();
                    const isSubOf = (subName, domainName) => {
                      const d = domainFromName(domainName);
                      const s = (subName || '').toLowerCase();
                      return s === d || s.endsWith('.' + d);
                    };
                    const withLevel = items.map((it) => {
                      if (it.type === 'divider') {
                        const name = (it.name || '').trim();
                        const nestedByTree = it.level === 1;
                        const nestedByName = lastDomainLevel0 != null && name && isSubOf(name, lastDomainLevel0);
                        const isNested = nestedByTree || nestedByName;
                        if (!isNested) lastDomainLevel0 = name;
                        currentLevel = isNested ? 1 : 0;
                        return { ...it, _level: currentLevel };
                      }
                      return { ...it, _level: currentLevel };
                    });
                    return withLevel;
                  })().map((item, idx) => {
                    const isNested = item._level === 1;
                    if (item.type === 'divider') {
                      return (
                        <tr
                          key={`div-${idx}`}
                          className={`bg-sky-100 border-y border-sky-200 ${isNested ? 'border-l-4 border-l-sky-400 bg-sky-50' : ''}`}
                        >
                          <td
                            colSpan={4 + (showPasswordColumn ? 1 : 0) + (showAssistenzaButton ? 1 : 0)}
                            className={`py-1 px-3 font-medium text-sky-800 ${isNested ? 'pl-10' : ''}`}
                          >
                            {isNested && <span className="text-sky-600 mr-2">└</span>}
                            {item.name || '—'}
                          </td>
                        </tr>
                      );
                    }
                    const key = entryKey(item);
                    const expiresDate = item.expires ? new Date(item.expires) : null;
                    const isExpired = expiresDate && !isNaN(expiresDate.getTime()) && expiresDate < new Date();
                    const rowClass = isNested
                      ? 'border-b border-gray-100 border-l-4 border-l-sky-300 bg-sky-50/50 hover:bg-sky-50'
                      : `border-b border-gray-100 ${isExpired ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`;
                    const cellPad = isNested ? 'py-1 px-3 pl-10' : 'py-1 px-3';
                    const hasQuota = item.username && item.username.includes('@') && quotaData[item.username.toLowerCase()];

                    return (
                      <React.Fragment key={`ent-${idx}`}>
                        <tr className={rowClass}>
                          <td className={`${cellPad} text-gray-900`}>
                            {isNested && <span className="text-sky-500 mr-2">└</span>}
                            {item.title || '—'}
                          </td>
                          <td className={`${cellPad} text-gray-600 font-mono`}>{item.username || '—'}</td>
                          {showPasswordColumn && (
                            <td className={`${cellPad} whitespace-nowrap`}>
                              {visiblePasswords[key] !== undefined ? (
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-gray-800 bg-gray-50 px-2 py-0.5 rounded text-xs">{visiblePasswords[key]}</span>
                                  <button
                                    type="button"
                                    onClick={() => hidePassword(item)}
                                    className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                                    title="Nascondi password"
                                  >
                                    <EyeOff size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => fetchPassword(item)}
                                  disabled={loadingPasswords[key]}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors whitespace-nowrap disabled:opacity-50"
                                  title="Mostra password"
                                >
                                  {loadingPasswords[key] ? <Loader size={12} className="animate-spin" /> : <Eye size={14} />}
                                  {loadingPasswords[key] ? '...' : 'Mostra'}
                                </button>
                              )}
                            </td>
                          )}
                          <td className={`${cellPad} text-gray-600 truncate max-w-[280px]`} title={item.url || ''}>
                            {item.url ? (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {item.url}
                              </a>
                            ) : '—'}
                          </td>
                          <td className={`${cellPad} whitespace-nowrap ${isExpired ? 'text-red-700 font-medium' : 'text-gray-600'}`}>
                            {item.expires ? (
                              <span title={isExpired ? 'Scaduta' : ''}>
                                {formatExpiry(item.expires)}
                                {isExpired ? ' (scaduta)' : ''}
                              </span>
                            ) : '—'}
                          </td>
                          {showAssistenzaButton && (
                            <td className={`${cellPad} whitespace-nowrap min-w-[140px]`}>
                              <button
                                type="button"
                                onClick={() => onOpenTicket({
                                  titolo: `Assistenza Email - ${(item.title || item.username || 'Account').toString().trim()}`,
                                  descrizione: `Richiesta assistenza relativa all'account email:\n\nTitolo: ${item.title || '—'}\nUtente: ${item.username || '—'}\nURL: ${item.url || '—'}\nAzienda: ${companyName || '—'}`
                                })}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors whitespace-nowrap"
                                title="Apri un ticket di assistenza"
                              >
                                <MessageCircle size={14} />
                                Apri ticket
                              </button>
                            </td>
                          )}
                        </tr>
                        {/* Barra spazio sotto la riga email */}
                        {hasQuota && <QuotaBar email={item.username} />}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {showIntro && (
            <div className="w-full">
              <EmailIntroCard
                companies={companies}
                value={selectedCompanyValid ? selectedCompanyId : ''}
                onChange={(companyId) => {
                  const newCompanyId = companyId || null;
                  setSelectedCompanyId(newCompanyId);
                  setError(null);
                  setItems([]);
                  setCompanyName('');
                  if (newCompanyId) {
                    const company = companies.find(c => String(c.id) === String(newCompanyId));
                    if (company) setCompanyName((company.azienda || '').split(':')[0].trim());
                  }
                }}
              />
            </div>
          )}

          {!loadingCompanies && loading && selectedCompanyId && (
            <div className="flex justify-center items-center py-12">
              <Loader size={32} className="animate-spin text-blue-600 mr-3" />
              <span className="text-gray-600">Caricamento Email da KeePass...</span>
            </div>
          )}

          {!loadingCompanies && selectedCompanyId && !loading && items.length === 0 && !error && hasSearched && (
            <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
              Nessuna voce nella cartella Email per questa azienda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailPage;
