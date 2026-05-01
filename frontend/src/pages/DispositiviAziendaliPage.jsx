import React, { useState, useEffect, useCallback } from 'react';
import { Monitor, Cpu, HardDrive, Battery, Shield, User, Loader2, Wifi, WifiOff, Activity, Settings, X } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import DispositiviAziendaliIntroCard from '../components/DispositiviAziendaliIntroCard';
import SectionNavMenu from '../components/SectionNavMenu';

/** Formatta indirizzo MAC con due punti (es. 00:50:56:C0:00:01) */
const formatMacWithColons = (mac) => {
  if (!mac || typeof mac !== 'string') return '—';
  return mac.trim().replace(/-/g, ':');
};

const renderDisks = (disksJson) => {
  if (!disksJson) return <span className="text-gray-500">—</span>;
  try {
    const arr = typeof disksJson === 'string' ? JSON.parse(disksJson) : disksJson;
    if (!Array.isArray(arr) || arr.length === 0) return <span className="text-gray-500">—</span>;
    return (
      <div className="flex flex-col gap-2 w-full mt-1">
        {arr.map((d, i) => {
          if (d.total_gb == null || d.free_gb == null) return null;
          const used = Math.max(0, d.total_gb - d.free_gb);
          const percent = d.total_gb > 0 ? Math.round((used / d.total_gb) * 100) : 0;
          return (
            <div key={i} className="flex flex-col gap-1 text-xs w-full bg-gray-50 p-2 rounded border border-gray-100">
              <div className="flex justify-between text-gray-700 font-medium">
                <span>Disco {d.letter}</span>
                <span>{percent}% in uso</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full ${percent > 90 ? 'bg-red-500' : percent > 75 ? 'bg-yellow-500' : 'bg-teal-500'}`}
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>Liberi: {d.free_gb} GB</span>
                <span>Totali: {d.total_gb} GB</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  } catch (e) {
    return <span className="text-gray-500">—</span>;
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
  highlightMac = null
}) => {
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

  return (
    <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
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
            currentUser={currentUser}
            selectedCompanyId={selectedCompanyId}
          />
          <div className="bg-teal-100 p-2 rounded-lg text-teal-600">
            <Monitor size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Dispositivi aziendali</h1>
            {readOnly && <p className="text-sm text-gray-500 mt-0.5">Sola consultazione</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="border rounded-lg px-3 py-2 bg-gray-50 text-sm focus:ring-2 focus:ring-teal-500 outline-none min-w-[200px]"
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
          >
            <option value="">{readOnly ? 'Seleziona Azienda...' : 'Seleziona Cliente...'}</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.azienda || (c.nome && c.cognome ? `${c.nome} ${c.cognome}` : `ID ${c.id}`)}</option>
            ))}
          </select>
          {/* Pulsante: torna a Monitoraggio Rete */}
          <button
            title="Vai a Monitoraggio Rete"
            onClick={() => onNavigateNetworkMonitoring && onNavigateNetworkMonitoring(selectedCompanyId || null)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <Activity size={16} />
            <span className="hidden sm:inline">Monitoraggio</span>
          </button>
          <button
            title="Aggiornamento automatico dispositivi"
            onClick={() => setAutoRefreshEnabled(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors shadow-sm ${
              autoRefreshEnabled ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-500 hover:bg-gray-600'
            }`}
          >
            <Activity size={16} />
            <span className="hidden sm:inline">Auto-refresh {autoRefreshEnabled ? 'ON' : 'OFF'}</span>
          </button>
          {/* Pulsante Comunicazioni / Gear con dropdown */}
          <div className="relative" ref={gearRef}>
            <button
              title="Comunicazioni"
              onClick={() => setShowGearMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              <Settings size={16} />
            </button>
            {showGearMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 py-1 z-50">
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b mb-1">Comunicazioni</div>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-violet-50 text-gray-700 hover:text-violet-700 transition-colors"
                  onClick={() => {
                    setShowGearMenu(false);
                    if (onNavigateCommAgentManager) onNavigateCommAgentManager(selectedCompanyId || null);
                  }}
                >
                  <Monitor size={16} className="text-violet-500" />
                  Crea / Visualizza Agent
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-violet-50 text-gray-700 hover:text-violet-700 transition-colors"
                  onClick={() => {
                    setShowGearMenu(false);
                    if (onNavigateCommAgent) onNavigateCommAgent(selectedCompanyId || null);
                  }}
                >
                  <Settings size={16} className="text-violet-500" />
                  Invia Comunicazione
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="bg-white border-b px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <div className="flex items-center gap-2 text-green-600 text-xs font-medium">
            <Wifi size={14} /> Online
          </div>
          <div className="text-2xl font-bold text-green-600">{globalOnline ?? '—'}</div>
          <div className="text-[10px] text-gray-400">agent monitor (tutte le aziende)</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <div className="flex items-center gap-2 text-red-500 text-xs font-medium">
            <WifiOff size={14} /> Offline
          </div>
          <div className="text-2xl font-bold text-red-500">{globalOffline ?? '—'}</div>
          <div className="text-[10px] text-gray-400">agent monitor (tutte le aziende)</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <div className="flex items-center gap-2 text-blue-600 text-xs font-medium">
            <Activity size={14} /> Agent Online
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {selectedCompanyId ? companyAgentsOnline : '—'}
          </div>
          {selectedCompanyId
            ? <div className="text-[10px] text-gray-400">di {totalCompanyAgents} per questa azienda</div>
            : <div className="text-[10px] text-gray-400">seleziona un'azienda</div>}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <div className="flex items-center gap-2 text-orange-500 text-xs font-medium">
            <Activity size={14} /> Agent Offline
          </div>
          <div className="text-2xl font-bold text-orange-500">
            {selectedCompanyId ? companyAgentsOffline : '—'}
          </div>
          {selectedCompanyId
            ? <div className="text-[10px] text-gray-400">di {totalCompanyAgents} per questa azienda</div>
            : <div className="text-[10px] text-gray-400">seleziona un'azienda</div>}
        </div>
      </div>

      {/* Content: intro solo senza azienda selezionata; con azienda solo lista dispositivi a tutta larghezza */}
      <div className="flex-1 overflow-auto p-6">
        {!selectedCompanyId ? (
          <div className="max-w-4xl mx-auto w-full">
            <DispositiviAziendaliIntroCard
              companies={companies}
              value={selectedCompanyId}
              onChange={(id) => setSelectedCompanyId(id || '')}
            />
          </div>
        ) : (
          <div className="w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dispositivi (dati dagli agent)</h3>
            {devicesLoading ? (
              <div className="flex items-center gap-2 text-gray-500 py-8">
                <Loader2 size={20} className="animate-spin" />
                Caricamento...
              </div>
            ) : devices.length === 0 ? (
              <p className="text-gray-500 py-6">Nessun dispositivo con agent registrato per questa azienda, oppure i dati non sono ancora stati inviati.</p>
            ) : (
              <div className="space-y-4">
                {devices.map((row) => {
                  const hasInfo = row.mac || row.device_name || row.os_name;
                  return (
                    <div
                      key={row.agent_id}
                      ref={highlightedDeviceId === row.agent_id ? highlightRef : null}
                      className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm transition-all duration-700 ${highlightedDeviceId === row.agent_id ? 'ring-4 ring-yellow-400 bg-yellow-50' : ''}`}
                    >
                      {!hasInfo ? (
                        <div className="flex justify-between items-center gap-4">
                          <p className="text-gray-500 text-sm">Dispositivo {row.machine_name || row.email} — in attesa di dati dall&apos;agent.</p>
                          <button onClick={() => handleDeleteDevice(row.agent_id, row.machine_name || row.email)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors flex-shrink-0" title="Elimina dispositivo">
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Riga titolo: nome, subito dopo MAC (tra parentesi), poi badge Online */}
                          <div className="font-semibold text-gray-800 flex items-center gap-2 flex-wrap mb-2">
                            <Monitor size={16} className="text-teal-600" />
                            <span>{row.device_name || row.machine_name || '—'}</span>
                            <span className="text-gray-500 font-normal text-sm">{row.mac ? `(MAC: ${formatMacWithColons(row.mac)})` : ''}</span>
                            {row.real_status === 'online' && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Online</span>}
                            <div className="ml-auto">
                              <button onClick={() => handleDeleteDevice(row.agent_id, row.device_name || row.machine_name)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors flex-shrink-0" title="Elimina dispositivo">
                                <X size={18} />
                              </button>
                            </div>
                          </div>
                          {/* Utente sotto il titolo */}
                          <div className="flex items-center gap-1 text-sm mb-4"><User size={14} className="text-gray-400" /><span className="text-gray-500">Utente:</span> {row.current_user || '—'}</div>
                          {/* 3 colonne: Identità/SO | Hardware/CPU/RAM/GPU/Batteria/AV | Archiviazione Dischi */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                            <div className="space-y-1">
                              <div>
                                <span className="text-gray-500">IP:</span>{' '}
                                {(() => {
                                  const raw = row.ip_addresses || '';
                                  if (!raw) return <span>—</span>;
                                  const segments = raw.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
                                  return segments.map((seg, i) => {
                                    const ipOnly = seg.replace(/\s*\(.*$/, '').trim();
                                    const inMonitoring = monitoringIps.has(ipOnly);
                                    return (
                                      <span key={i}>
                                        {i > 0 && ', '}
                                        {inMonitoring ? <strong className="font-semibold text-gray-900" title="Presente nel monitoraggio rete">{seg}</strong> : seg}
                                      </span>
                                    );
                                  });
                                })()}
                              </div>
                              <div><span className="text-gray-500">SO:</span> {row.os_name || '—'} {row.os_version && `(${row.os_version})`} {row.os_arch && ` · ${row.os_arch}`}</div>
                              {row.os_install_date && <div><span className="text-gray-500">Installato:</span> {new Date(row.os_install_date).toLocaleDateString('it-IT')}</div>}
                              {(row.antivirus_name || row.antivirus_state) && (
                                <div className="flex items-center gap-1"><span className="text-gray-500">AV:</span> {row.antivirus_name || '—'} {row.antivirus_state && `· ${row.antivirus_state}`}</div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div><span className="text-gray-500">HW:</span> {row.manufacturer || '—'} {row.model && `· ${row.model}`} {row.device_type && `(${row.device_type})`}</div>
                              <div>
                                <span className="text-gray-500">CPU:</span> {row.cpu_name || '—'} {row.cpu_cores != null && `· ${row.cpu_cores} core`} {row.cpu_clock_mhz != null && `· ${row.cpu_clock_mhz} MHz`}
                              </div>
                              <div><span className="text-gray-500">RAM:</span> {row.ram_free_gb != null && row.ram_total_gb != null ? `${row.ram_free_gb} / ${row.ram_total_gb} GB liberi` : (row.ram_total_gb != null ? `${row.ram_total_gb} GB` : '—')}</div>
                              {/* GPU: solo schede reali (no Virtual/Meta monitor), formato Nome · X GB */}
                              <div className="mt-1">
                                <span className="text-gray-500">GPU:</span>
                                {row.gpus_json ? (() => {
                                  try {
                                    const gpus = typeof row.gpus_json === 'string' ? JSON.parse(row.gpus_json) : row.gpus_json;
                                    if (Array.isArray(gpus) && gpus.length > 0) {
                                      const virtualSkip = /Virtual Desktop Monitor|Meta Virtual Monitor/i;
                                      const realGpus = gpus.filter(g => {
                                        const name = (g.name || g.caption || '').trim();
                                        return name && !virtualSkip.test(name);
                                      });
                                      if (realGpus.length === 0) return <span className="text-gray-500"> —</span>;
                                      const parts = realGpus.map(g => {
                                        const name = g.name || g.caption || '—';
                                        const gb = g.adapter_ram_mb != null ? Math.round(g.adapter_ram_mb / 1024) : null;
                                        return gb != null ? `${name} · ${gb} GB` : name;
                                      });
                                      return <span className="text-gray-700"> {parts.join(', ')}</span>;
                                    }
                                  } catch (_) {}
                                  return <span className="text-gray-700"> {row.gpu_name || '—'}</span>;
                                })() : row.gpu_name ? (
                                  <span className="text-gray-700"> {row.gpu_name}</span>
                                ) : (
                                  <span className="text-gray-400 italic" title="Riavvia o aggiorna l’agent sul PC per inviare i dati delle schede video">Nessun dato ricevuto dall’agent</span>
                                )}
                              </div>
                              {(row.battery_percent != null || row.battery_status) && (
                                <div className="flex items-center gap-1"><Battery size={14} className="text-gray-400" /> {row.battery_status || ''} {row.battery_percent != null && `${row.battery_percent}%`} {row.battery_charging && '(in carica)'}</div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1"><HardDrive size={14} className="text-gray-400" /><span className="text-gray-500 font-medium">Archiviazione Dischi:</span></div>
                              {renderDisks(row.disks_json)}
                            </div>
                          </div>
                        </>
                        )}
                        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
                          {row.email} · Aggiornato: {row.device_info_updated_at ? new Date(row.device_info_updated_at).toLocaleString('it-IT') : 'mai'}
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
