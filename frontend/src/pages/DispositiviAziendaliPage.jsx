import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Monitor, HardDrive, Battery, User, Loader2, Wifi, WifiOff, Activity, Settings, X, ArrowLeft } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import DispositiviAziendaliIntroCard from '../components/DispositiviAziendaliIntroCard';
import SectionNavMenu from '../components/SectionNavMenu';
import {
  hexToRgba,
  normalizeHex,
  readableOnAccent,
  getStoredTechHubAccent,
  hubEmbeddedRootInlineStyle,
  hubEmbeddedBackBtnInlineStyle
} from '../utils/techHubAccent';

/** Formatta indirizzo MAC con due punti (es. 00:50:56:C0:00:01) */
const formatMacWithColons = (mac) => {
  if (!mac || typeof mac !== 'string') return '—';
  return mac.trim().replace(/-/g, ':');
};

const renderDisks = (disksJson, embedded = false) => {
  const emptyCls = embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500';
  if (!disksJson) return <span className={emptyCls}>—</span>;
  try {
    const arr = typeof disksJson === 'string' ? JSON.parse(disksJson) : disksJson;
    if (!Array.isArray(arr) || arr.length === 0) return <span className={emptyCls}>—</span>;
    return (
      <div className="mt-1 flex w-full flex-col gap-2">
        {arr.map((d, i) => {
          if (d.total_gb == null || d.free_gb == null) return null;
          const used = Math.max(0, d.total_gb - d.free_gb);
          const percent = d.total_gb > 0 ? Math.round((used / d.total_gb) * 100) : 0;
          return (
            <div
              key={i}
              className={
                embedded
                  ? 'flex w-full flex-col gap-1 rounded border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well-mid)] p-2 text-xs'
                  : 'flex w-full flex-col gap-1 rounded border border-gray-100 bg-gray-50 p-2 text-xs'
              }
            >
              <div
                className={`flex justify-between font-medium ${embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-700'}`}
              >
                <span>Disco {d.letter}</span>
                <span>{percent}% in uso</span>
              </div>
              <div
                className={`h-1.5 w-full overflow-hidden rounded-full ${embedded ? 'bg-[color:var(--hub-chrome-muted-fill)]' : 'bg-gray-200'}`}
              >
                <div
                  className={`h-1.5 rounded-full ${percent > 90 ? 'bg-red-500' : percent > 75 ? 'bg-yellow-500' : embedded ? 'bg-[color:var(--hub-accent)]' : 'bg-teal-500'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div
                className={`flex justify-between text-[10px] ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}`}
              >
                <span>Liberi: {d.free_gb} GB</span>
                <span>Totali: {d.total_gb} GB</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  } catch (e) {
    return <span className={emptyCls}>—</span>;
  }
};

const DispositiviAziendaliPage = ({
  onClose,
  getAuthHeader,
  selectedCompanyId: initialCompanyId,
  onCompanyChange,
  readOnly = false,
  currentUser,
  onNavigateOffice,
  onNavigateEmail,
  onNavigateAntiVirus,
  onNavigateNetworkMonitoring,
  onNavigateMappatura,
  onNavigateCommAgent = null,
  onNavigateCommAgentManager = null,
  onNavigateSpeedTest,
  onNavigateVpn,
  onNavigateHome,
  onNavigateLSight,
  embedded = false,
  closeEmbedded,
  accentHex: accentHexProp,
  highlightMac = null
}) => {
  const accent = useMemo(() => normalizeHex(accentHexProp) || getStoredTechHubAccent(), [accentHexProp]);
  const primaryBtnStyle = useMemo(
    () => ({ backgroundColor: accent, color: readableOnAccent(accent) }),
    [accent]
  );
  const onEmbeddedBack = () => {
    if (typeof closeEmbedded === 'function') closeEmbedded();
    else if (typeof onClose === 'function') onClose();
  };
  const embeddedBackBtnStyle = useMemo(() => hubEmbeddedBackBtnInlineStyle(), []);
  const rootEmbeddedStyle = useMemo(
    () => (embedded ? hubEmbeddedRootInlineStyle(accent) : undefined),
    [embedded, accent]
  );
  const companySelectCls = embedded
    ? 'min-w-[180px] rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none [color-scheme:light] focus:ring-2 focus:ring-[color:var(--hub-accent)] sm:min-w-[200px]'
    : 'min-w-[200px] rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500';
  const rootClassName = embedded
    ? 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[color:var(--hub-chrome-border-soft)] font-sans'
    : 'fixed inset-0 z-50 flex flex-col overflow-hidden bg-gray-100 font-sans';
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId || '');
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [monitoringIps, setMonitoringIps] = useState(new Set());
  const [highlightedDeviceId, setHighlightedDeviceId] = useState(null);
  const highlightRef = React.useRef(null);
  // Stats: agent comm online/offline globali (tutte le aziende)
  const [globalOnline, setGlobalOnline] = useState(null);
  const [globalOffline, setGlobalOffline] = useState(null);
  // Gear dropdown visibility
  const [showGearMenu, setShowGearMenu] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const gearRef = React.useRef(null);

  // Chiudi dropdown gear se si clicca fuori
  useEffect(() => {
    const handler = (e) => { if (gearRef.current && !gearRef.current.contains(e.target)) setShowGearMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Conteggi comm-agent per azienda (calcolati dai devices già caricati)
  const companyAgentsOnline = devices.filter(d => d.real_status === 'online').length;
  const companyAgentsOffline = devices.filter(d => d.real_status !== 'online').length;
  const totalCompanyAgents = devices.length;

  // Sincronizza lo stato locale con initialCompanyId se cambia esternamente
  useEffect(() => {
    if (initialCompanyId && String(initialCompanyId) !== String(selectedCompanyId)) {
      setSelectedCompanyId(initialCompanyId);
    }
  }, [initialCompanyId]);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch(buildApiUrl('/api/network-monitoring/all-clients'), { headers: getAuthHeader() });
        if (res.ok) {
          const data = await res.json();
          const seen = new Set();
          const unique = (data || []).filter(c => {
            const name = (c.azienda || (c.nome && c.cognome ? `${c.nome} ${c.cognome}` : '') || '').trim();
            if (!name || seen.has(name)) return false;
            seen.add(name);
            return true;
          });
          setCompanies(unique);
        }
      } catch (e) {
        console.error('Error fetching companies:', e);
      }
    };
    fetchCompanies();
  }, [getAuthHeader]);

  // Carica statistiche globali: tutti gli agent comm di tutte le aziende
  useEffect(() => {
    const loadGlobalStats = async () => {
      try {
        const res = await fetch(buildApiUrl('/api/comm-agent/device-info'), { headers: getAuthHeader() });
        if (!res.ok) return;
        const data = await res.json();
        const devs = Array.isArray(data) ? data : [];
        setGlobalOnline(devs.filter(d => d.real_status === 'online').length);
        setGlobalOffline(devs.filter(d => d.real_status !== 'online').length);
      } catch (e) { /* silent */ }
    };
    loadGlobalStats();
    // Aggiorna ogni 30s per mantenere i contatori globali freschi
    const interval = setInterval(loadGlobalStats, 30000);
    return () => clearInterval(interval);
  }, [getAuthHeader]);

  // Carica agent online/offline per azienda selezionata
  useEffect(() => {
    if (!selectedCompanyId) {
      return; // calcolati da devices
    }
  }, [selectedCompanyId, getAuthHeader]);

  const handleDeleteDevice = async (agentId, deviceName) => {
    if (!window.confirm(`Sei sicuro di voler eliminare definitivamente il dispositivo "${deviceName || 'Sconosciuto'}"? Verranno persi tutti i suoi dati registrati.`)) return;
    try {
      const res = await fetch(buildApiUrl(`/api/comm-agent/agents/${agentId}`), {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (res.ok) {
        setDevices(prev => prev.filter(d => d.agent_id !== agentId));
      } else {
        alert("Errore durante l'eliminazione del dispositivo.");
      }
    } catch (err) {
      console.error(err);
      alert("Errore di connessione durante l'eliminazione.");
    }
  };

  const selectedCompany = companies.find(c => String(c.id) === String(selectedCompanyId));
  const companyName = selectedCompany?.azienda || selectedCompany?.nome || '';

  const loadCompanyDevices = useCallback(async ({ silent = false } = {}) => {
    if (!companyName) {
      setDevices([]);
      return;
    }
    if (!silent) setDevicesLoading(true);
    try {
      const res = await fetch(buildApiUrl(`/api/comm-agent/device-info?azienda=${encodeURIComponent(companyName)}`), { headers: getAuthHeader() });
      const data = res.ok ? await res.json() : [];
      setDevices(Array.isArray(data) ? data : []);
    } catch (_) {
      // Durante refresh silenzioso non svuotare la lista per evitare "salti" visuali.
      if (!silent) setDevices([]);
    } finally {
      if (!silent) setDevicesLoading(false);
    }
  }, [companyName, getAuthHeader]);

  const loadMonitoringIps = useCallback(async () => {
    if (!selectedCompanyId) {
      setMonitoringIps(new Set());
      return;
    }
    try {
      const res = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/devices`), { headers: getAuthHeader() });
      const data = res.ok ? await res.json() : [];
      const ips = new Set();
      (data || []).forEach(d => {
        if (d.ip_address) ips.add(String(d.ip_address).trim());
        const add = d.additional_ips;
        if (Array.isArray(add)) add.forEach(ip => ip && ips.add(String(ip).trim()));
        else if (typeof add === 'string') {
          try { JSON.parse(add).forEach(ip => ip && ips.add(String(ip).trim())); } catch (_) { /* ignore */ }
        }
      });
      setMonitoringIps(ips);
    } catch (_) {
      setMonitoringIps(new Set());
    }
  }, [selectedCompanyId, getAuthHeader]);

  // Effetto per sincronizzare verso l'alto quando cambia localmente
  useEffect(() => {
    if (onCompanyChange && selectedCompanyId) {
      onCompanyChange(selectedCompanyId);
    }
  }, [selectedCompanyId, onCompanyChange]);

  useEffect(() => {
    loadCompanyDevices();
  }, [loadCompanyDevices]);

  // IP presenti nel monitoraggio rete (per evidenziarli in grassetto)
  useEffect(() => {
    loadMonitoringIps();
  }, [loadMonitoringIps]);

  // Auto-refresh azienda selezionata: ogni 15s, solo se tab visibile
  useEffect(() => {
    if (!autoRefreshEnabled || !selectedCompanyId) return undefined;
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      loadCompanyDevices({ silent: true });
      loadMonitoringIps();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, selectedCompanyId, loadCompanyDevices, loadMonitoringIps]);

  // Evidenzia il dispositivo richiesto (per navigazione da Monitoraggio Rete)
  useEffect(() => {
    if (!highlightMac || !devices.length) return;
    // Normalizza MAC (rimuovi trattini, uppercase)
    const norm = (s) => s ? s.replace(/[:\-]/g, '').toUpperCase() : '';
    const highlight = norm(highlightMac);
    const match = devices.find(d => {
      if (d.mac && norm(d.mac) === highlight) return true;
      // Prova anche match IP
      if (d.ip_addresses) {
        const ips = d.ip_addresses.split(/[,\s]+/).map(s => s.replace(/\s*\(.*$/, '').trim());
        if (ips.some(ip => ip === highlightMac)) return true;
      }
      return false;
    });
    if (match) {
      setHighlightedDeviceId(match.agent_id);
      // Scrolla verso la card dopo un breve delay
      setTimeout(() => {
        if (highlightRef.current) {
          highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      // Rimuovi highlight dopo 4s
      setTimeout(() => setHighlightedDeviceId(null), 4000);
    }
  }, [highlightMac, devices]);

  const statHintCls = embedded ? 'text-[10px] text-[color:var(--hub-chrome-text-fainter)]' : 'text-[10px] text-gray-400';

  return (
    <div className={rootClassName} style={rootEmbeddedStyle}>
      <div
        className={
          embedded
            ? 'flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[color:var(--hub-chrome-border-soft)] px-4 py-3'
            : 'flex flex-wrap items-center justify-between border-b bg-white px-6 py-4 shadow-sm'
        }
        style={embedded ? { backgroundColor: 'var(--hub-chrome-surface)' } : undefined}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {embedded ? (
            <button type="button" onClick={onEmbeddedBack} style={embeddedBackBtnStyle}>
              <ArrowLeft size={18} aria-hidden />
              Panoramica Hub
            </button>
          ) : (
            <SectionNavMenu
              currentPage="dispositivi-aziendali"
              onNavigateHome={onNavigateHome || onClose}
              onNavigateOffice={onNavigateOffice}
              onNavigateEmail={onNavigateEmail}
              onNavigateAntiVirus={onNavigateAntiVirus}
              onNavigateNetworkMonitoring={onNavigateNetworkMonitoring}
              onNavigateMappatura={onNavigateMappatura}
              onNavigateSpeedTest={onNavigateSpeedTest}
              onNavigateDispositiviAziendali={null}
              onNavigateVpn={onNavigateVpn}
              onNavigateLSight={onNavigateLSight}
              currentUser={currentUser}
              selectedCompanyId={selectedCompanyId}
            />
          )}
          {!embedded && (
            <div className="rounded-lg bg-teal-100 p-2 text-teal-600">
              <Monitor size={24} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className={`font-bold ${embedded ? 'truncate text-lg text-[color:var(--hub-chrome-text)]' : 'text-xl text-gray-800'}`}>
              Dispositivi aziendali
            </h1>
            {readOnly && (
              <p className={`mt-0.5 text-sm ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-500'}`}>Sola consultazione</p>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          <select
            className={companySelectCls}
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
          >
            <option value="">{readOnly ? 'Seleziona Azienda...' : 'Seleziona Cliente...'}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.azienda || (c.nome && c.cognome ? `${c.nome} ${c.cognome}` : `ID ${c.id}`)}
              </option>
            ))}
          </select>
          <button
            type="button"
            title="Vai a Monitoraggio Rete"
            onClick={() => onNavigateNetworkMonitoring && onNavigateNetworkMonitoring(selectedCompanyId || null)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition-colors ${
              embedded ? 'hover:brightness-105' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            style={embedded ? primaryBtnStyle : undefined}
          >
            <Activity size={16} />
            <span className="hidden sm:inline">Monitoraggio</span>
          </button>
          <button
            type="button"
            title="Aggiornamento automatico dispositivi"
            onClick={() => setAutoRefreshEnabled((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition-colors ${
              autoRefreshEnabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            <Activity size={16} />
            <span className="hidden sm:inline">Auto-refresh {autoRefreshEnabled ? 'ON' : 'OFF'}</span>
          </button>
          <div className="relative" ref={gearRef}>
            <button
              type="button"
              title="Comunicazioni"
              onClick={() => setShowGearMenu((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors ${
                embedded
                  ? 'border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well-mid)] hover:bg-[color:var(--hub-chrome-well)]'
                  : 'bg-gray-700 hover:bg-gray-800'
              }`}
            >
              <Settings size={16} />
            </button>
            {showGearMenu && (
              <div
                className={`absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border py-1 shadow-2xl ${
                  embedded
                    ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)]'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div
                  className={`mb-1 border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                    embedded ? 'border-[color:var(--hub-chrome-border-soft)] text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-400'
                  }`}
                >
                  Comunicazioni
                </div>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    embedded
                      ? 'text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-accent)]'
                      : 'text-gray-700 hover:bg-violet-50 hover:text-violet-700'
                  }`}
                  onClick={() => {
                    setShowGearMenu(false);
                    if (onNavigateCommAgentManager) onNavigateCommAgentManager(selectedCompanyId || null);
                  }}
                >
                  <Monitor size={16} className={embedded ? 'text-[color:var(--hub-accent)]' : 'text-violet-500'} />
                  Crea / Visualizza Agent
                </button>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    embedded
                      ? 'text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-accent)]'
                      : 'text-gray-700 hover:bg-violet-50 hover:text-violet-700'
                  }`}
                  onClick={() => {
                    setShowGearMenu(false);
                    if (onNavigateCommAgent) onNavigateCommAgent(selectedCompanyId || null);
                  }}
                >
                  <Settings size={16} className={embedded ? 'text-[color:var(--hub-accent)]' : 'text-violet-500'} />
                  Invia Comunicazione
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`grid grid-cols-2 gap-2 border-b ${embedded ? 'px-4 py-2' : 'px-6 py-3'} sm:grid-cols-4 ${
          embedded ? 'border-[color:var(--hub-chrome-border-soft)] bg-transparent' : 'bg-white'
        }`}
      >
        <div
          className={`flex flex-col gap-1 rounded-xl ${embedded ? 'p-3' : 'p-4'} shadow-sm ${
            embedded ? 'border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well-mid)]' : 'border border-gray-200 bg-white'
          }`}
        >
          <div
            className={`flex items-center gap-2 text-xs font-medium ${embedded ? 'text-[color:var(--hub-chrome-palette-emerald-fg)]' : 'text-green-600'}`}
          >
            <Wifi size={14} /> Online
          </div>
          <div className={`text-xl font-bold ${embedded ? 'text-[color:var(--hub-chrome-palette-emerald-fg)]' : 'text-green-600'}`}>{globalOnline ?? '—'}</div>
          <div className={statHintCls}>agent monitor (tutte le aziende)</div>
        </div>
        <div
          className={`flex flex-col gap-1 rounded-xl ${embedded ? 'p-3' : 'p-4'} shadow-sm ${
            embedded ? 'border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well-mid)]' : 'border border-gray-200 bg-white'
          }`}
        >
          <div
            className={`flex items-center gap-2 text-xs font-medium ${embedded ? 'text-[color:var(--hub-chrome-tone-danger-title)]' : 'text-red-400'}`}
          >
            <WifiOff size={14} /> Offline
          </div>
          <div className={`text-xl font-bold ${embedded ? 'text-[color:var(--hub-chrome-tone-danger-title)]' : 'text-red-400'}`}>{globalOffline ?? '—'}</div>
          <div className={statHintCls}>agent monitor (tutte le aziende)</div>
        </div>
        <div
          className={`flex flex-col gap-1 rounded-xl ${embedded ? 'p-3' : 'p-4'} shadow-sm ${
            embedded ? 'border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well-mid)]' : 'border border-gray-200 bg-white'
          }`}
        >
          <div
            className={`flex items-center gap-2 text-xs font-medium ${embedded ? 'text-[color:var(--hub-chrome-palette-sky-fg)]' : 'text-blue-600'}`}
          >
            <Activity size={14} /> Agent Online
          </div>
          <div className={`text-xl font-bold ${embedded ? 'text-[color:var(--hub-chrome-palette-sky-fg)]' : 'text-blue-600'}`}>
            {selectedCompanyId ? companyAgentsOnline : '—'}
          </div>
          {selectedCompanyId ? (
            <div className={statHintCls}>di {totalCompanyAgents} per questa azienda</div>
          ) : (
            <div className={statHintCls}>seleziona un&apos;azienda</div>
          )}
        </div>
        <div
          className={`flex flex-col gap-1 rounded-xl ${embedded ? 'p-3' : 'p-4'} shadow-sm ${
            embedded ? 'border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well-mid)]' : 'border border-gray-200 bg-white'
          }`}
        >
          <div
            className={`flex items-center gap-2 text-xs font-medium ${embedded ? 'text-[color:var(--hub-chrome-tone-warn-title)]' : 'text-orange-400'}`}
          >
            <Activity size={14} /> Agent Offline
          </div>
          <div className={`text-xl font-bold ${embedded ? 'text-[color:var(--hub-chrome-tone-warn-title)]' : 'text-orange-400'}`}>
            {selectedCompanyId ? companyAgentsOffline : '—'}
          </div>
          {selectedCompanyId ? (
            <div className={statHintCls}>di {totalCompanyAgents} per questa azienda</div>
          ) : (
            <div className={statHintCls}>seleziona un&apos;azienda</div>
          )}
        </div>
      </div>

      <div
        className={`flex-1 overflow-auto ${embedded ? 'bg-[transparent] px-4 py-4 md:px-5' : 'p-6'}`}
        style={embedded ? { backgroundColor: 'var(--hub-chrome-page)' } : undefined}
      >
        {!selectedCompanyId ? (
          <div className="mx-auto w-full max-w-4xl">
            <DispositiviAziendaliIntroCard
              embedded={embedded}
              accentHex={accent}
              companies={companies}
              value={selectedCompanyId}
              onChange={(id) => setSelectedCompanyId(id || '')}
            />
          </div>
        ) : (
          <div className="w-full">
            <h3 className={`mb-3 text-base font-semibold ${embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-900'}`}>
              Dispositivi (dati dagli agent)
            </h3>
            {devicesLoading ? (
              <div className={`flex items-center gap-2 py-8 ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-500'}`}>
                <Loader2 size={20} className="animate-spin" />
                Caricamento...
              </div>
            ) : devices.length === 0 ? (
              <p className={`py-6 ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-500'}`}>
                Nessun dispositivo con agent registrato per questa azienda, oppure i dati non sono ancora stati inviati.
              </p>
            ) : (
              <div className="space-y-3">
                {devices.map((row) => {
                  const hasInfo = row.mac || row.device_name || row.os_name;
                  const lbl = embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500';
                  const muted = embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-400';
                  const delBtn =
                    embedded
                      ? 'text-[color:var(--hub-chrome-text-fainter)] hover:bg-red-500/15 hover:text-[color:var(--hub-chrome-tone-danger-icon)]'
                      : 'text-gray-400 hover:bg-red-50 hover:text-red-500';
                  return (
                    <div
                      key={row.agent_id}
                      ref={highlightedDeviceId === row.agent_id ? highlightRef : null}
                      className={`rounded-xl border ${embedded ? 'p-3' : 'p-4'} shadow-sm transition-all duration-700 ${
                        embedded
                          ? highlightedDeviceId === row.agent_id
                            ? 'border-yellow-400/50 bg-yellow-500/15 ring-4 ring-yellow-400/85'
                            : 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well-mid)]'
                          : highlightedDeviceId === row.agent_id
                            ? 'border-gray-200 bg-yellow-50 ring-4 ring-yellow-400'
                            : 'border-gray-200 bg-white'
                      } ${embedded ? 'text-[11px] leading-tight' : ''}`}
                    >
                      {!hasInfo ? (
                        <div className="flex items-center justify-between gap-4">
                          <p className={`text-sm ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-500'}`}>
                            Dispositivo {row.machine_name || row.email} — in attesa di dati dall&apos;agent.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleDeleteDevice(row.agent_id, row.machine_name || row.email)}
                            className={`flex-shrink-0 rounded-lg p-1.5 transition-colors ${delBtn}`}
                            title="Elimina dispositivo"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className={`mb-2 flex flex-wrap items-center gap-2 font-semibold ${embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-800'}`}>
                            <Monitor size={16} style={embedded ? { color: accent } : undefined} className={embedded ? '' : 'text-teal-600'} />
                            <span>{row.device_name || row.machine_name || '—'}</span>
                            <span className={`font-normal ${embedded ? 'text-[11px] text-[color:var(--hub-chrome-text-muted)]' : 'text-sm text-gray-500'}`}>
                              {row.mac ? `(MAC: ${formatMacWithColons(row.mac)})` : ''}
                            </span>
                            {row.real_status === 'online' && (
                              <span
                                className={
                                  embedded
                                    ? 'rounded border border-[color:var(--hub-chrome-chip-live-border)] bg-[color:var(--hub-chrome-chip-live-bg)] px-1.5 py-0.5 text-xs text-[color:var(--hub-chrome-chip-live-text)]'
                                    : 'rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700'
                                }
                              >
                                Online
                              </span>
                            )}
                            <div className="ml-auto">
                              <button
                                type="button"
                                onClick={() => handleDeleteDevice(row.agent_id, row.device_name || row.machine_name)}
                                className={`flex-shrink-0 rounded-lg p-1.5 transition-colors ${delBtn}`}
                                title="Elimina dispositivo"
                              >
                                <X size={18} />
                              </button>
                            </div>
                          </div>
                          <div className={`mb-3 flex items-center gap-1 ${embedded ? 'text-[11px] text-[color:var(--hub-chrome-text-secondary)]' : 'text-sm'}`}>
                            <User size={14} className={muted} />
                            <span className={lbl}>Utente:</span> {row.current_user || '—'}
                          </div>
                          <div className={`grid grid-cols-1 gap-4 md:grid-cols-3 ${embedded ? 'text-[11px] text-[color:var(--hub-chrome-text-secondary)]' : 'text-sm'}`}>
                            <div className="space-y-1">
                              <div>
                                <span className={lbl}>IP:</span>{' '}
                                {(() => {
                                  const raw = row.ip_addresses || '';
                                  if (!raw) return <span className={muted}>—</span>;
                                  const segments = raw.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
                                  return segments.map((seg, i) => {
                                    const ipOnly = seg.replace(/\s*\(.*$/, '').trim();
                                    const inMonitoring = monitoringIps.has(ipOnly);
                                    return (
                                      <span key={i}>
                                        {i > 0 && ', '}
                                        {inMonitoring ? (
                                          <strong
                                            className={
                                              embedded
                                                ? 'font-semibold text-[color:var(--hub-chrome-text)]'
                                                : 'font-semibold text-gray-900'
                                            }
                                            title="Presente nel monitoraggio rete"
                                          >
                                            {seg}
                                          </strong>
                                        ) : (
                                          seg
                                        )}
                                      </span>
                                    );
                                  });
                                })()}
                              </div>
                              <div>
                                <span className={lbl}>SO:</span> {row.os_name || '—'} {row.os_version && `(${row.os_version})`}{' '}
                                {row.os_arch && ` · ${row.os_arch}`}
                              </div>
                              {row.os_install_date && (
                                <div>
                                  <span className={lbl}>Installato:</span>{' '}
                                  {new Date(row.os_install_date).toLocaleDateString('it-IT')}
                                </div>
                              )}
                              {(row.antivirus_name || row.antivirus_state) && (
                                <div className="flex items-center gap-1">
                                  <span className={lbl}>AV:</span> {row.antivirus_name || '—'}{' '}
                                  {row.antivirus_state && `· ${row.antivirus_state}`}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div>
                                <span className={lbl}>HW:</span> {row.manufacturer || '—'} {row.model && `· ${row.model}`}{' '}
                                {row.device_type && `(${row.device_type})`}
                              </div>
                              <div>
                                <span className={lbl}>CPU:</span> {row.cpu_name || '—'}{' '}
                                {row.cpu_cores != null && `· ${row.cpu_cores} core`}{' '}
                                {row.cpu_clock_mhz != null && `· ${row.cpu_clock_mhz} MHz`}
                              </div>
                              <div>
                                <span className={lbl}>RAM:</span>{' '}
                                {row.ram_free_gb != null && row.ram_total_gb != null
                                  ? `${row.ram_free_gb} / ${row.ram_total_gb} GB liberi`
                                  : row.ram_total_gb != null
                                    ? `${row.ram_total_gb} GB`
                                    : '—'}
                              </div>
                              <div className="mt-1">
                                <span className={lbl}>GPU:</span>
                                {row.gpus_json ? (
                                  (() => {
                                    try {
                                      const gpus = typeof row.gpus_json === 'string' ? JSON.parse(row.gpus_json) : row.gpus_json;
                                      if (Array.isArray(gpus) && gpus.length > 0) {
                                        const virtualSkip = /Virtual Desktop Monitor|Meta Virtual Monitor/i;
                                        const realGpus = gpus.filter((g) => {
                                          const name = (g.name || g.caption || '').trim();
                                          return name && !virtualSkip.test(name);
                                        });
                                        if (realGpus.length === 0) return <span className={lbl}> —</span>;
                                        const parts = realGpus.map((g) => {
                                          const name = g.name || g.caption || '—';
                                          const gb = g.adapter_ram_mb != null ? Math.round(g.adapter_ram_mb / 1024) : null;
                                          return gb != null ? `${name} · ${gb} GB` : name;
                                        });
                                        return (
                                          <span className={embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-700'}>{' '}{parts.join(', ')}</span>
                                        );
                                      }
                                    } catch (_) {
                                      /* ignore */
                                    }
                                    return (
                                      <span className={embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-700'}> {row.gpu_name || '—'}</span>
                                    );
                                  })()
                                ) : row.gpu_name ? (
                                  <span className={embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-700'}> {row.gpu_name}</span>
                                ) : (
                                  <span className={`italic ${muted}`} title="Riavvia o aggiorna l’agent sul PC per inviare i dati delle schede video">
                                    Nessun dato ricevuto dall’agent
                                  </span>
                                )}
                              </div>
                              {(row.battery_percent != null || row.battery_status) && (
                                <div className="flex items-center gap-1">
                                  <Battery size={14} className={muted} /> {row.battery_status || ''}{' '}
                                  {row.battery_percent != null && `${row.battery_percent}%`} {row.battery_charging && '(in carica)'}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <HardDrive size={14} className={muted} />
                                <span className={`${lbl} font-medium`}>Archiviazione Dischi:</span>
                              </div>
                              {renderDisks(row.disks_json, embedded)}
                            </div>
                          </div>
                        </>
                      )}
                      <div
                        className={`mt-2 border-t pt-2 text-xs ${embedded ? 'border-[color:var(--hub-chrome-border-soft)] text-[color:var(--hub-chrome-text-faint)]' : 'border-gray-100 text-gray-400'}`}
                      >
                        {row.email} · Aggiornato:{' '}
                        {row.device_info_updated_at ? new Date(row.device_info_updated_at).toLocaleString('it-IT') : 'mai'}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DispositiviAziendaliPage;
