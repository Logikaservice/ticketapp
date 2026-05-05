// frontend/src/pages/EmailPage.jsx
// Pagina Email - struttura da KeePass (cartella Email per azienda, righe divisorie per @nomequalcosa)
// Scadenza letta da KeePass (entry.times.expiryTime); riga in rosso se scaduta
// Barra spazio occupato sotto ogni riga email (dati da IMAP QUOTA)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader,
  MessageCircle,
  Eye,
  EyeOff,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  Clock,
  Activity,
  ArrowLeft
} from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import EmailIntroCard from '../components/EmailIntroCard';
import SectionNavMenu from '../components/SectionNavMenu';
import {
  normalizeHex,
  getStoredTechHubAccent,
  hubEmbeddedRootInlineStyle,
  hubEmbeddedBackBtnInlineStyle
} from '../utils/techHubAccent';

const EmailPage = ({
  onClose,
  getAuthHeader,
  selectedCompanyId: initialCompanyId,
  initialCompanyName,
  onCompanyChange,
  currentUser,
  onOpenTicket,
  onNavigateOffice,
  onNavigateAntiVirus,
  onNavigateDispositiviAziendali,
  onNavigateNetworkMonitoring,
  onNavigateMappatura,
  onNavigateSpeedTest,
  onNavigateVpn,
  onNavigateHome,
  /** Dentro Hub tecnico (area centrale): niente overlay full-screen. */
  embedded = false,
  /** Accordo col CommAgentDashboard: pulsante «Panoramica Hub». */
  closeEmbedded,
  accentHex: accentHexProp
}) => {
  const accent = useMemo(() => normalizeHex(accentHexProp) || getStoredTechHubAccent(), [accentHexProp]);
  const isCliente = currentUser?.ruolo === 'cliente';
  const showTicketButton =
    typeof onOpenTicket === 'function' &&
    (currentUser?.ruolo === 'cliente' || currentUser?.ruolo === 'tecnico' || currentUser?.ruolo === 'admin');
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

  // Sincronizza lo stato locale con initialCompanyId se cambia esternamente
  useEffect(() => {
    if (initialCompanyId !== selectedCompanyId) {
      setSelectedCompanyId(initialCompanyId);
    }
  }, [initialCompanyId]);

  // Auto-selezione azienda da nome (usato dall'Hub scadenze Email).
  useEffect(() => {
    if (!initialCompanyName) return;
    if (!companies || companies.length === 0) return;
    const target = String(initialCompanyName || '').trim().toLowerCase();
    if (!target) return;
    const normCompany = (c) => String(c?.azienda || c?.name || '').split(':')[0].trim().toLowerCase();
    const match = companies.find((c) => normCompany(c) === target);
    if (!match) return;
    if (String(match.id) === String(selectedCompanyId || '')) return;
    setSelectedCompanyId(match.id);
    onCompanyChange?.(match.id);
  }, [initialCompanyName, companies, selectedCompanyId, onCompanyChange]);

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
    const colCount = 4 + (showPasswordColumn ? 1 : 0) + (showTicketButton ? 1 : 0);
    const activity = getActivityStatus(q.last_email_date);
    const actHub =
      activity.status === 'active'
        ? 'border-[color:var(--hub-chrome-chip-live-border)] bg-[color:var(--hub-chrome-chip-live-bg)] text-[color:var(--hub-chrome-chip-live-text)]'
        : 'border-[color:var(--hub-chrome-chip-idle-border)] bg-[color:var(--hub-chrome-chip-idle-bg)] text-[color:var(--hub-chrome-chip-idle-text)]';

    return (
      <tr
        className={
          embedded
            ? 'border-b border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-row-fill)]'
            : 'border-b border-gray-50 bg-gray-50/30'
        }
      >
        <td colSpan={colCount} className="px-3 py-1.5 align-middle">
          <div className="ml-8 flex items-center gap-4">
            {/* Usage Badge */}
            <div className="flex min-w-[80px] items-center gap-2">
              <HardDrive
                size={13}
                className={embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-400'}
              />
              <span
                className={`text-[11px] font-bold ${embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-700'}`}
              >
                {formatBytes(q.usage_bytes)}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="flex max-w-md flex-1 items-center gap-2">
              <div
                className={`relative h-2 flex-1 overflow-hidden rounded-full ${embedded ? 'bg-[color:var(--hub-chrome-muted-fill)]' : 'bg-gray-200'}`}
                title={`${percent.toFixed(1)}% occupato`}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(percent, 100)}%`,
                    backgroundColor: colors.bar
                  }}
                />
              </div>
              <span
                className={`w-12 text-right text-[10px] ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}`}
              >
                {percent.toFixed(0)}%
              </span>
              {percent >= 70 && (
                <AlertTriangle size={12} className={percent >= 90 ? 'text-red-500' : 'text-amber-500'} />
              )}
            </div>

            {/* Activity Badge */}
            <div
              className="flex items-center gap-2"
              title={q.last_email_date ? `Ultima email ricevuta: ${new Date(q.last_email_date).toLocaleDateString()}` : 'Nessuna email trovata'}
            >
              <span
                className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-medium ${
                  embedded
                    ? actHub
                    : `border ${activity.color.replace('text-', 'border-').replace('100', '200')} ${activity.color}`
                }`}
              >
                <Activity size={10} />
                {activity.label}
              </span>
              {activity.status === 'inactive' && (
                <span
                  className={`text-[10px] italic ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-400'}`}
                >
                  (Ultima email {q.last_email_date ? new Date(q.last_email_date).toLocaleDateString() : 'mai'})
                </span>
              )}
            </div>

            {/* Limit Info */}
            <div
              className={`ml-auto flex items-center gap-1 text-[10px] ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-400'}`}
            >
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

  const onEmbeddedBack = () => {
    if (typeof closeEmbedded === 'function') closeEmbedded();
    else if (typeof onClose === 'function') onClose();
  };

  const rootClassName = embedded
    ? 'flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--hub-chrome-border-soft)] font-sans'
    : 'fixed inset-0 bg-gray-50 z-[100] flex flex-col font-sans w-full h-full overflow-hidden';

  const rootEmbeddedStyle = useMemo(
    () => (embedded ? hubEmbeddedRootInlineStyle(accent) : undefined),
    [embedded, accent]
  );

  const embeddedBackBtnStyle = useMemo(() => hubEmbeddedBackBtnInlineStyle(), []);

  // Il menu nativo del <select> su Windows/Chromium usa spesso uno sfondo chiaro: non usare text-white sulla
  // `<select>` o le `<option>` risultano invisibili (testo chiaro su sfondo chiaro). Stile “pill” chiaro sulla barra Hub.
  const selectCls = embedded
    ? 'rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 outline-none [color-scheme:light] focus:ring-2 focus:ring-blue-500/80'
    : 'border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none';

  return (
    <div className={rootClassName} style={rootEmbeddedStyle}>
      <div
        className={
          embedded
            ? 'flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--hub-chrome-border-soft)] px-4 py-3 z-10'
            : 'bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10'
        }
        style={embedded ? { backgroundColor: 'var(--hub-chrome-surface)' } : undefined}
      >
        <div className={`flex min-w-0 items-center ${embedded ? 'gap-3' : 'gap-4'}`}>
          {embedded ? (
            <button type="button" onClick={onEmbeddedBack} style={embeddedBackBtnStyle}>
              <ArrowLeft size={18} aria-hidden />
              Panoramica Hub
            </button>
          ) : (
            <SectionNavMenu
              currentPage="email"
              onNavigateHome={onNavigateHome || onClose}
              onNavigateOffice={onNavigateOffice}
              onNavigateEmail={null}
              onNavigateAntiVirus={onNavigateAntiVirus}
              onNavigateDispositiviAziendali={onNavigateDispositiviAziendali}
              onNavigateNetworkMonitoring={onNavigateNetworkMonitoring}
              onNavigateMappatura={onNavigateMappatura}
              onNavigateSpeedTest={onNavigateSpeedTest}
              onNavigateVpn={onNavigateVpn}
              currentUser={currentUser}
              selectedCompanyId={selectedCompanyId}
            />
          )}
          <div className="min-w-0">
            <h1 className={`font-bold truncate ${embedded ? 'text-lg text-[color:var(--hub-chrome-text)]' : 'text-xl text-gray-900'}`}>
              Email
            </h1>
            <p className={`truncate ${embedded ? 'text-xs text-[color:var(--hub-chrome-text-muted)]' : 'text-sm text-gray-600'}`}>{companyName || 'Seleziona un\'azienda'}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          {/* Scan button + quota info - solo per tecnici con azienda selezionata */}
          {isTecnico && selectedCompanyValid && companyName && items.length > 0 && (
            <div className="flex items-center gap-2">
              {quotaCount > 0 && (
                <div
                  className={`mr-1 flex flex-wrap items-center gap-2 text-xs ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-400'}`}
                >
                  <Clock size={12} />
                  <span>{formatScanTime(lastScanTime) || 'Mai'}</span>
                  {quotaCritical > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-medium ${embedded ? 'bg-[color:var(--hub-chrome-badge-critical-bg)] text-[color:var(--hub-chrome-badge-critical-text)]' : 'bg-red-100 text-red-600'}`}
                    >
                      {quotaCritical} critico
                    </span>
                  )}
                  {quotaWarning > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-medium ${embedded ? 'bg-[color:var(--hub-chrome-badge-warn-bg)] text-[color:var(--hub-chrome-badge-warn-text)]' : 'bg-amber-100 text-amber-600'}`}
                    >
                      {quotaWarning} att.
                    </span>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={handleScan}
                disabled={scanning}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition-all ${
                  scanning
                    ? embedded
                      ? 'cursor-not-allowed border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-chrome-link)]'
                      : 'cursor-not-allowed border border-blue-200 bg-blue-50 text-blue-500'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                }`}
                title="Scansiona lo spazio delle caselle email via IMAP"
              >
                <RefreshCw size={13} className={scanning ? 'animate-spin' : ''} />
                {scanning ? 'Scansione...' : 'Scan Spazio'}
              </button>
            </div>
          )}
          {!loadingCompanies && (isCliente ? !!selectedCompanyId : true) && (
            <select
              className={selectCls}
              value={selectedCompanyId || ''}
              onChange={async (e) => {
                const newCompanyId = e.target.value || null;
                setSelectedCompanyId(newCompanyId);
                if (onCompanyChange) onCompanyChange(newCompanyId);
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
              {companies
                .filter((c) => c.id != null)
                .map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.azienda || `ID ${c.id}`}
                  </option>
                ))}
            </select>
          )}
        </div>
      </div>

      <div className={embedded ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'flex-1 overflow-y-auto p-6'}>
        <div
          className={embedded ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-5 md:px-5' : 'max-w-7xl mx-auto w-full'}
          style={embedded ? { backgroundColor: 'var(--hub-chrome-page)' } : undefined}
        >
          {loadingCompanies && (
            <div className="flex items-center justify-center py-12">
              <Loader
                size={32}
                className={`mr-3 animate-spin ${embedded ? 'text-[color:var(--hub-accent)]' : 'text-blue-600'}`}
              />
              <span className={embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}>
                Caricamento aziende...
              </span>
            </div>
          )}

          {!loadingCompanies && error && !showIntro && (
            <div
              className={
                embedded
                  ? 'mb-4 rounded-lg border border-[color:var(--hub-chrome-msg-error-border)] bg-[color:var(--hub-chrome-msg-error-bg)] px-4 py-3 text-sm text-[color:var(--hub-chrome-msg-error-text)]'
                  : 'mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700'
              }
            >
              {error}
            </div>
          )}

          {!loadingCompanies && items.length > 0 && (
            <div
              className={
                embedded
                  ? 'overflow-hidden rounded-2xl border border-[color:var(--hub-chrome-border-soft)]'
                  : 'overflow-hidden rounded-lg border border-gray-200 bg-white shadow'
              }
              style={embedded ? { backgroundColor: 'var(--hub-chrome-surface)' } : undefined}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className={
                      embedded
                        ? 'border-b border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-row-fill)]'
                        : 'border-b border-gray-200 bg-gray-50'
                    }
                  >
                    <th
                      className={`px-3 py-1.5 text-left font-semibold ${embedded ? 'text-xs uppercase tracking-wide text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-700'}`}
                    >
                      Titolo
                    </th>
                    <th
                      className={`px-3 py-1.5 text-left font-semibold ${embedded ? 'text-xs uppercase tracking-wide text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-700'}`}
                    >
                      Nome Utente
                    </th>
                    {showPasswordColumn && (
                      <th
                        className={`min-w-[120px] px-3 py-1.5 text-left font-semibold ${embedded ? 'text-xs uppercase tracking-wide text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-700'}`}
                      >
                        Password
                      </th>
                    )}
                    <th
                      className={`px-3 py-1.5 text-left font-semibold ${embedded ? 'text-xs uppercase tracking-wide text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-700'}`}
                    >
                      URL
                    </th>
                    <th
                      className={`px-3 py-1.5 text-left font-semibold ${embedded ? 'text-xs uppercase tracking-wide text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-700'}`}
                    >
                      Scadenza
                    </th>
                    {showTicketButton && (
                      <th
                        className={`min-w-[140px] w-40 px-3 py-1.5 text-left font-semibold ${embedded ? 'text-xs uppercase tracking-wide text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-700'}`}
                      >
                        Ticket
                      </th>
                    )}
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
                          className={
                            embedded
                              ? `border-y border-[color:var(--hub-chrome-band-info-mark)]/35 bg-[color:var(--hub-chrome-band-info-bg)] ${isNested ? 'border-l-4 border-[color:var(--hub-chrome-band-info-mark)] bg-[color:var(--hub-chrome-band-info-bg)]' : ''}`
                              : `border-y border-sky-200 bg-sky-100 ${isNested ? 'border-l-4 border-l-sky-400 bg-sky-50' : ''}`
                          }
                        >
                          <td
                            colSpan={4 + (showPasswordColumn ? 1 : 0) + (showTicketButton ? 1 : 0)}
                            className={`px-3 py-1 font-medium ${embedded ? 'text-[color:var(--hub-chrome-band-info-text)]' : 'text-sky-800'} ${isNested ? 'pl-10' : ''}`}
                          >
                            {isNested && (
                              <span className={`mr-2 ${embedded ? 'text-[color:var(--hub-chrome-band-info-mark)]' : 'text-sky-600'}`}>
                                └
                              </span>
                            )}
                            {item.name || '—'}
                          </td>
                        </tr>
                      );
                    }
                    const key = entryKey(item);
                    const expiresDate = item.expires ? new Date(item.expires) : null;
                    const isExpired = expiresDate && !isNaN(expiresDate.getTime()) && expiresDate < new Date();
                    const rowClass = embedded
                      ? isNested
                        ? 'border-b border-[color:var(--hub-chrome-border-soft)] border-l-4 border-[color:var(--hub-chrome-band-info-mark)] bg-[color:var(--hub-chrome-row-nested-bg)] hover:bg-[color:var(--hub-chrome-row-nested-hover)]'
                        : `border-b border-[color:var(--hub-chrome-border-soft)] ${isExpired ? 'bg-[color:var(--hub-chrome-row-expired-bg)] hover:brightness-95' : 'hover:bg-[color:var(--hub-chrome-hover)]'}`
                      : isNested
                        ? 'border-b border-gray-100 border-l-4 border-l-sky-300 bg-sky-50/50 hover:bg-sky-50'
                        : `border-b border-gray-100 ${isExpired ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`;
                    const cellPad = isNested ? 'py-1 px-3 pl-10' : 'py-1 px-3';
                    const txtMain = embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-900';
                    const txtMuted = embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600';
                    const treeMark = embedded ? 'text-[color:var(--hub-chrome-link)]' : 'text-sky-500';
                    const hasQuota = item.username && item.username.includes('@') && quotaData[item.username.toLowerCase()];

                    return (
                      <React.Fragment key={`ent-${idx}`}>
                        <tr className={rowClass}>
                          <td className={`${cellPad} ${txtMain}`}>
                            {isNested && <span className={`mr-2 ${treeMark}`}>└</span>}
                            {item.title || '—'}
                          </td>
                          <td className={`${cellPad} font-mono ${txtMuted}`}>{item.username || '—'}</td>
                          {showPasswordColumn && (
                            <td className={`${cellPad} whitespace-nowrap`}>
                              {visiblePasswords[key] !== undefined ? (
                                <div className="flex items-center gap-1">
                                  <span
                                    className={`rounded px-2 py-0.5 font-mono text-xs ${embedded ? 'bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-chrome-text)]' : 'bg-gray-50 text-gray-800'}`}
                                  >
                                    {visiblePasswords[key]}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => hidePassword(item)}
                                    className={`rounded p-1 ${embedded ? 'text-[color:var(--hub-chrome-text-muted)] hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-chrome-text)]' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
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
                                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                                    embedded
                                      ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)]'
                                      : 'border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                                  }`}
                                  title="Mostra password"
                                >
                                  {loadingPasswords[key] ? <Loader size={12} className="animate-spin" /> : <Eye size={14} />}
                                  {loadingPasswords[key] ? '...' : 'Mostra'}
                                </button>
                              )}
                            </td>
                          )}
                          <td className={`${cellPad} max-w-[280px] truncate ${txtMuted}`} title={item.url || ''}>
                            {item.url ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={
                                  embedded ? 'text-[color:var(--hub-chrome-link)] hover:underline' : 'text-blue-600 hover:underline'
                                }
                              >
                                {item.url}
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td
                            className={`${cellPad} whitespace-nowrap ${isExpired ? (embedded ? 'font-medium text-[color:var(--hub-chrome-tone-danger-title)]' : 'font-medium text-red-700') : txtMuted}`}
                          >
                            {item.expires ? (
                              <span title={isExpired ? 'Scaduta' : ''}>
                                {formatExpiry(item.expires)}
                                {isExpired ? ' (scaduta)' : ''}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          {showTicketButton && (
                            <td className={`${cellPad} min-w-[140px] whitespace-nowrap`}>
                              <button
                                type="button"
                                onClick={() => onOpenTicket({
                                  titolo: `Supporto Email - ${(item.title || item.username || 'Account').toString().trim()}`,
                                  descrizione: [
                                    `Richiesta assistenza relativa all'account email.`,
                                    '',
                                    `Azienda: ${companyName || '—'}`,
                                    `Titolo: ${item.title || '—'}`,
                                    `Utente: ${item.username || '—'}`,
                                    `URL: ${item.url || '—'}`,
                                    `Scadenza: ${item.expires ? formatExpiry(item.expires) : '—'}`,
                                    '',
                                    'Descrivi qui il problema o la richiesta:'
                                  ].join('\n')
                                })}
                                className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-1 text-xs font-medium transition-colors ${
                                  embedded
                                    ? 'border-[color:var(--hub-accent-border)] bg-[color:var(--hub-accent)]/18 text-[color:var(--hub-accent)] hover:bg-[color:var(--hub-accent)]/28'
                                    : 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                }`}
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
                embedded={embedded}
                companies={companies}
                value={selectedCompanyValid ? selectedCompanyId : ''}
                onChange={(companyId) => {
                  const newCompanyId = companyId || null;
                  setSelectedCompanyId(newCompanyId);
                  if (onCompanyChange) onCompanyChange(newCompanyId);
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
            <div className="flex items-center justify-center py-12">
              <Loader
                size={32}
                className={`mr-3 animate-spin ${embedded ? 'text-[color:var(--hub-accent)]' : 'text-blue-600'}`}
              />
              <span className={embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}>
                Caricamento Email da KeePass...
              </span>
            </div>
          )}

          {!loadingCompanies && selectedCompanyId && !loading && items.length === 0 && !error && hasSearched && (
            <div
              className={
                embedded
                  ? 'rounded-2xl border border-[color:var(--hub-chrome-border-soft)] px-8 py-10 text-center text-[color:var(--hub-chrome-text-faint)]'
                  : 'rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 shadow'
              }
              style={embedded ? { backgroundColor: 'var(--hub-chrome-surface)' } : undefined}
            >
              Nessuna voce nella cartella Email per questa azienda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailPage;
