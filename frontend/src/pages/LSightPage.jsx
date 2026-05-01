import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Eye, Activity, Search, X, MonitorPlay, ShieldCheck,
  User, Trash2, Server, Building2, ChevronRight,
  ArrowLeft, WifiOff, Wifi, RefreshCw, Mail, Save
} from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const COMPANY_COLORS = [
  { bg: 'from-indigo-600/30 to-indigo-800/20', border: 'border-indigo-500/30', text: 'text-indigo-400' },
  { bg: 'from-cyan-600/30 to-cyan-800/20', border: 'border-cyan-500/30', text: 'text-cyan-400' },
  { bg: 'from-violet-600/30 to-violet-800/20', border: 'border-violet-500/30', text: 'text-violet-400' },
  { bg: 'from-emerald-600/30 to-emerald-800/20', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  { bg: 'from-amber-600/30 to-amber-800/20', border: 'border-amber-500/30', text: 'text-amber-400' },
  { bg: 'from-rose-600/30 to-rose-800/20', border: 'border-rose-500/30', text: 'text-rose-400' },
  { bg: 'from-sky-600/30 to-sky-800/20', border: 'border-sky-500/30', text: 'text-sky-400' },
  { bg: 'from-fuchsia-600/30 to-fuchsia-800/20', border: 'border-fuchsia-500/30', text: 'text-fuchsia-400' },
];

const getCompanyColor = (name) => {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i += 1) hash += name.charCodeAt(i);
  return COMPANY_COLORS[Math.abs(hash) % COMPANY_COLORS.length];
};

const getInitials = (name) => {
  if (!name) return '??';
  return name.split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase();
};

const normCompany = (s) => String(s || '').trim().toLowerCase();

const LSightPage = ({ onClose, onNavigateHome, currentUser, getAuthHeader, onOpenSession: _onOpenSession }) => {
  const [isScanning, setIsScanning] = useState(true);
  const [agents, setAgents] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companySearch, setCompanySearch] = useState('');
  const [pcSearch, setPcSearch] = useState('');
  const [startingSessionAgentId, setStartingSessionAgentId] = useState(null);

  const [grantCompany, setGrantCompany] = useState('');
  const [grantEmail, setGrantEmail] = useState('');
  const [grantSaving, setGrantSaving] = useState(false);
  const [grantMessage, setGrantMessage] = useState('');
  const [companyNames, setCompanyNames] = useState([]);
  const [ticketUsers, setTicketUsers] = useState([]);
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [accessSummaryLoading, setAccessSummaryLoading] = useState(false);
  const [accessSummary, setAccessSummary] = useState({ full_company: [], selected_only: [] });

  const [grantPanelAgents, setGrantPanelAgents] = useState([]);
  const [grantAgentsLoading, setGrantAgentsLoading] = useState(false);
  const [grantEnabledAgentIds, setGrantEnabledAgentIds] = useState([]);
  const [grantAccessFullCompany, setGrantAccessFullCompany] = useState(false);
  const [grantAccessLoading, setGrantAccessLoading] = useState(false);

  const isTecnico = currentUser?.ruolo === 'tecnico';

  const hdr = () => ({ headers: getAuthHeader() });

  const fetchMyAgents = useCallback(async () => {
    setIsScanning(true);
    try {
      const res = await fetch(buildApiUrl('/api/lsight/my-agents'), hdr());
      const data = await res.json().catch(() => ({}));
      if (data.success) setAgents(data.agents || []);
    } catch (e) {
      console.error('Errore fetch agenti L-Sight:', e);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const fetchCompanyNames = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/api/lsight/admin/company-names'), hdr());
      const data = await res.json().catch(() => ({}));
      if (data.success && Array.isArray(data.companies)) setCompanyNames(data.companies);
    } catch (e) {
      console.error('Errore company-names:', e);
    }
  }, []);

  const fetchAccessSummary = useCallback(async () => {
    setAccessSummaryLoading(true);
    try {
      const res = await fetch(buildApiUrl('/api/lsight/admin/access-summary'), hdr());
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setAccessSummary({
          full_company: data.full_company || [],
          selected_only: data.selected_only || [],
        });
      } else {
        setAccessSummary({ full_company: [], selected_only: [] });
      }
    } catch (e) {
      console.error('Errore access-summary:', e);
    } finally {
      setAccessSummaryLoading(false);
    }
  }, []);

  const fetchTicketUsers = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/api/users'), hdr());
      const data = await res.json().catch(() => []);
      const arr = Array.isArray(data) ? data : [];
      setTicketUsers(arr.filter((u) => u.ruolo === 'cliente'));
    } catch (e) {
      console.error('Errore /api/users per L-Sight:', e);
    }
  }, []);

  useEffect(() => {
    fetchMyAgents();
  }, [fetchMyAgents]);

  useEffect(() => {
    if (!showAuthPanel || !grantCompany.trim()) {
      setGrantPanelAgents([]);
      setGrantEnabledAgentIds([]);
      setGrantAccessFullCompany(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setGrantAgentsLoading(true);
      try {
        const q = new URLSearchParams({ azienda: grantCompany.trim() });
        const res = await fetch(buildApiUrl(`/api/lsight/admin/company-agents?${q}`), hdr());
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data.success && Array.isArray(data.agents)) {
          setGrantPanelAgents(data.agents);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setGrantAgentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAuthPanel, grantCompany]);

  useEffect(() => {
    if (!showAuthPanel || !grantCompany.trim() || !grantEmail.trim()) {
      if (showAuthPanel && grantCompany.trim() && !grantEmail.trim()) {
        setGrantEnabledAgentIds([]);
        setGrantAccessFullCompany(false);
      }
      return;
    }
    const t = setTimeout(async () => {
      setGrantAccessLoading(true);
      try {
        const q = new URLSearchParams({
          azienda: grantCompany.trim(),
          email: grantEmail.trim(),
        });
        const res = await fetch(buildApiUrl(`/api/lsight/admin/user-device-access?${q}`), hdr());
        const data = await res.json().catch(() => ({}));
        if (data.success) {
          setGrantEnabledAgentIds(data.enabled_agent_ids || []);
          setGrantAccessFullCompany(!!data.access_full_company);
        } else {
          setGrantEnabledAgentIds([]);
          setGrantAccessFullCompany(false);
        }
      } catch (e) {
        setGrantEnabledAgentIds([]);
        setGrantAccessFullCompany(false);
      } finally {
        setGrantAccessLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [showAuthPanel, grantCompany, grantEmail]);

  const sortedPanelAgents = useMemo(() => {
    const list = [...grantPanelAgents];
    list.sort((a, b) => {
      const ae = grantEnabledAgentIds.includes(a.agent_id);
      const be = grantEnabledAgentIds.includes(b.agent_id);
      if (ae && !be) return -1;
      if (!ae && be) return 1;
      const ao = a.status === 'online' ? 0 : 1;
      const bo = b.status === 'online' ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return String(a.machine_name || '').localeCompare(String(b.machine_name || ''), 'it');
    });
    return list;
  }, [grantPanelAgents, grantEnabledAgentIds]);

  const allGrantAgentsSelected =
    grantPanelAgents.length > 0 && grantPanelAgents.every((a) => grantEnabledAgentIds.includes(a.agent_id));

  const toggleGrantAgent = (agentId) => {
    setGrantEnabledAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };

  const setAllGrantAgents = (checked) => {
    if (!grantPanelAgents.length) return;
    if (checked) {
      setGrantEnabledAgentIds(grantPanelAgents.map((a) => a.agent_id));
    } else {
      setGrantEnabledAgentIds([]);
    }
  };

  const saveDeviceAccess = async () => {
    setGrantMessage('');
    if (!grantCompany.trim() || !grantEmail.trim()) {
      setGrantMessage('Seleziona azienda e inserisci email.');
      return;
    }
    if (!grantPanelAgents.length) {
      setGrantMessage('Nessun PC per questa azienda.');
      return;
    }
    setGrantSaving(true);
    try {
      const res = await fetch(buildApiUrl('/api/lsight/admin/sync-device-access'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          email: grantEmail.trim(),
          azienda: grantCompany.trim(),
          agent_ids: grantEnabledAgentIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setGrantMessage(data?.error || 'Errore salvataggio');
        return;
      }
      setGrantMessage('');
      await fetchAccessSummary();
      await fetchMyAgents();
    } catch (e) {
      setGrantMessage('Errore di rete');
    } finally {
      setGrantSaving(false);
    }
  };

  const revokeUnifiedAccess = async (row) => {
    const aziendaParam =
      row.kind === 'full_company'
        ? companyNames.find((n) => normCompany(n) === String(row.company_key || '').trim().toLowerCase()) ||
          row.company_key
        : row.company_label;
    if (
      !window.confirm(
        `Revocare tutti gli accessi L-Sight per ${row.email} sull’azienda «${aziendaParam}»?`
      )
    )
      return;
    try {
      const q = new URLSearchParams({
        email: row.email.trim(),
        azienda: String(aziendaParam).trim(),
      });
      const res = await fetch(buildApiUrl(`/api/lsight/admin/user-company-access?${q}`), {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Errore revoca');
        return;
      }
      fetchAccessSummary();
    } catch (e) {
      console.error(e);
    }
  };

  const clienteEmailsForGrantCompany = useMemo(() => {
    if (!grantCompany.trim()) return [];
    const nk = normCompany(grantCompany);
    return ticketUsers.filter((u) => normCompany(u.azienda) === nk && (u.email || '').trim()).map((u) => u.email.trim());
  }, [ticketUsers, grantCompany]);

  const companiesMap = useMemo(() => {
    const map = new Map();
    agents.forEach((ag) => {
      const az = ag.azienda || 'Non classificato';
      if (!map.has(az)) map.set(az, { name: az, agents: [], onlineCount: 0, totalCount: 0 });
      const co = map.get(az);
      co.agents.push(ag);
      co.totalCount += 1;
      if (ag.status === 'online') co.onlineCount += 1;
    });
    return map;
  }, [agents]);

  const companies = useMemo(
    () =>
      Array.from(companiesMap.values())
        .filter((c) => c.name.toLowerCase().includes(companySearch.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [companiesMap, companySearch]
  );

  const selectedCompanyAgents = useMemo(() => {
    if (!selectedCompany) return [];
    const co = companiesMap.get(selectedCompany);
    if (!co) return [];
    return co.agents.filter(
      (ag) =>
        (ag.machine_name || '').toLowerCase().includes(pcSearch.toLowerCase()) ||
        (ag.os_info || '').toLowerCase().includes(pcSearch.toLowerCase())
    );
  }, [selectedCompany, companiesMap, pcSearch]);

  const PcCard = ({ ag }) => {
    const isOnline = ag.status === 'online';
    const isStarting = startingSessionAgentId === ag.agent_id;

    const startSession = async (source = 'click') => {
      if (!isOnline || isStarting) return;
      setStartingSessionAgentId(ag.agent_id);
      try {
        if (window?.localStorage?.getItem('debug_lsight') === '1') {
          console.log('[L-Sight] startSession', { source, agent_id: ag.agent_id, machine: ag.machine_name });
        }
      } catch (_) {
        /* ignore */
      }

      try {
        const res = await fetch(buildApiUrl(`/api/lsight/agents/${ag.agent_id}/direct-rdp`), {
          headers: getAuthHeader(),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          alert(txt || 'Impossibile generare il file RDP per questo PC.');
          return;
        }
        const blob = await res.blob();
        const safe = String(ag.machine_name || `pc-${ag.agent_id}`).replace(/[^\w.\-]+/g, '_').slice(0, 80);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lsight-direct-${safe}.rdp`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (e) {
        console.error('Errore download RDP diretto L-Sight:', e);
        alert('Errore di rete durante la generazione del file RDP.');
      } finally {
        setStartingSessionAgentId(null);
      }
    };

    return (
      <div
        className={`group relative bg-[#111827] rounded-2xl border transition-all overflow-hidden flex flex-col shadow-lg ${
          isOnline ? 'border-indigo-500/30 hover:border-indigo-400/60' : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        {isOnline && (
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-indigo-500/10 blur-2xl rounded-full pointer-events-none" />
        )}
        <div className="p-5 pb-3 border-b border-white/5 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-sm flex items-center gap-2 truncate">
              <Server className="text-indigo-400 flex-shrink-0" size={14} />
              <span className="truncate">{ag.machine_name}</span>
            </h3>
            <div
              className={`text-[10px] mt-1.5 font-mono uppercase tracking-widest flex items-center gap-1.5 ${isOnline ? 'text-emerald-400' : 'text-rose-400/70'}`}
            >
              {isOnline ? (
                <>
                  <Wifi size={9} />
                  ONLINE
                </>
              ) : (
                <>
                  <WifiOff size={9} />
                  OFFLINE
                </>
              )}
            </div>
          </div>
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ml-2 transition-colors ${
              isOnline ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800/50 text-slate-500'
            }`}
          >
            <MonitorPlay size={16} />
          </div>
        </div>
        <div className="p-5 pt-3 flex-1 flex flex-col justify-between">
          <p className="text-xs text-slate-500 mb-4 truncate">{ag.os_info || 'Sistema sconosciuto'}</p>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              startSession('mousedown');
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              startSession('touchstart');
            }}
            onClick={(e) => {
              e.preventDefault();
              startSession('click');
            }}
            disabled={!isOnline || isStarting}
            className={`w-full py-2 rounded-lg flex items-center justify-center gap-2 font-bold text-xs transition-all focus:outline-none ${
              isOnline
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.35)]'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
            }`}
          >
            {isOnline ? (isStarting ? '⏳ File RDP...' : 'Desktop remoto') : '— offline'}
          </button>
        </div>
      </div>
    );
  };

  const CompanyCard = ({ company }) => {
    const color = getCompanyColor(company.name);
    const goCompany = () => {
      setSelectedCompany(company.name);
      setPcSearch('');
    };
    return (
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          goCompany();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          goCompany();
        }}
        onClick={(e) => {
          e.preventDefault();
          goCompany();
        }}
        className={`group relative z-20 pointer-events-auto cursor-pointer select-none text-left w-full rounded-2xl border bg-gradient-to-br p-5 transition-all shadow-lg hover:scale-[1.02] active:scale-[0.99] overflow-hidden ${color.bg} ${color.border}`}
      >
        <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/5 rounded-full" />
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl bg-black/30 flex items-center justify-center text-sm font-black ${color.text} flex-shrink-0 border border-white/10`}
          >
            {getInitials(company.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-sm truncate">{company.name}</div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[10px] bg-black/30 border border-white/10 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                {company.totalCount} PC
              </span>
              {company.onlineCount > 0 && (
                <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                  <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse inline-block" />
                  {company.onlineCount} online
                </span>
              )}
            </div>
          </div>
          <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 flex-shrink-0 mt-1 transition-colors" />
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0A0E17] text-slate-300 flex flex-col font-sans overflow-hidden">

      <header className="flex-none bg-[#0D131F] border-b border-indigo-900/30 px-6 py-4 flex items-center justify-between shadow-2xl relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-full bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10 min-w-0">
          <div className="relative flex items-center justify-center w-12 h-12 bg-indigo-950 rounded-xl border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)] shrink-0">
            <Eye className="text-indigo-400 w-6 h-6" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-indigo-950 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
              L-Sight
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] uppercase font-black tracking-widest border border-indigo-500/20">
                Desktop remoto
              </span>
            </h1>
            <p className="text-xs text-indigo-300/70 uppercase tracking-widest font-semibold mt-0.5">
              PC per azienda · Desktop remoto diretto (file .rdp · apri la VPN sul PC tecnico)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10 shrink-0">
          {isTecnico && (
            <button
              type="button"
              onClick={() => {
                setShowAuthPanel(true);
                fetchCompanyNames();
                fetchAccessSummary();
                fetchTicketUsers();
              }}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/45 border border-indigo-500/30 text-sm font-medium text-indigo-100"
              title="Autorizzazioni · azienda e email"
            >
              <ShieldCheck size={18} />
              <span className="hidden sm:inline">Autorizzazioni</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => fetchMyAgents()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-sm font-medium"
            title="Aggiorna elenco PC"
          >
            <RefreshCw size={18} />
            <span className="hidden sm:inline">Aggiorna</span>
          </button>
          <button
            type="button"
            onClick={onNavigateHome || onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all text-sm font-medium"
          >
            <X size={18} />
            Chiudi
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-8 min-w-0 min-h-0">
          <div className="max-w-7xl mx-auto relative z-10 space-y-6 pb-16">

          <div className="rounded-2xl bg-gradient-to-r from-indigo-900/40 to-slate-900 border border-indigo-500/20 overflow-hidden flex items-stretch">
            <div className="w-1.5 bg-gradient-to-b from-indigo-500 to-indigo-700" />
            <div className="p-5 flex-1 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="text-indigo-400" size={18} />
                  {selectedCompany ? `Azienda: ${selectedCompany}` : "Seleziona un'azienda"}
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  {selectedCompany
                    ? `${selectedCompanyAgents.length} postazioni visualizzate (online/offline)`
                    : `${companies.length} aziende · ${agents.length} PC Comm Agent`}
                </p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <div className="bg-[#0A0E17] border border-slate-800 rounded-lg px-4 py-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Aziende</div>
                  <div className="text-indigo-400 font-mono text-base font-bold">{companies.length}</div>
                </div>
                <div className="bg-[#0A0E17] border border-slate-800 rounded-lg px-4 py-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">PC</div>
                  <div className="text-indigo-400 font-mono text-base font-bold">{agents.length}</div>
                </div>
              </div>
            </div>
          </div>

          {isScanning ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin" />
                <Eye className="absolute inset-0 m-auto text-indigo-400 animate-pulse" size={24} />
              </div>
              <div className="text-sm font-mono text-indigo-400 animate-pulse tracking-widest">Caricamento...</div>
            </div>
          ) : !selectedCompany ? (
            <div className="space-y-6">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Filtra aziende..."
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  className="w-full bg-[#111827] border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              {companies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-slate-800 rounded-2xl bg-[#0D131F]/50">
                  <Building2 size={40} className="text-slate-600 mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">Nessuna azienda disponibile</h3>
                  <p className="text-slate-400 text-sm max-w-md">
                    {isTecnico
                      ? 'Non risultano Comm Agent registrati, oppure gli utenti non hanno campo azienda valorizzato.'
                      : 'Nessun PC è autorizzato per il tuo profilo L-Sight. Contatta un tecnico per abilitarti (azienda + email).'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative z-20 pointer-events-auto">
                  {companies.map((co) => (
                    <CompanyCard key={co.name} company={co} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCompany(null);
                    setPcSearch('');
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-all border border-slate-700"
                >
                  <ArrowLeft size={16} />
                  Tutte le aziende
                </button>
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <ChevronRight size={14} />
                  <Building2 size={14} className="text-indigo-400" />
                  <span className="text-white font-semibold">{selectedCompany}</span>
                </div>
                <div className="flex-1" />
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Cerca PC..."
                    value={pcSearch}
                    onChange={(e) => setPcSearch(e.target.value)}
                    className="bg-[#111827] border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all w-60 max-w-[50vw]"
                  />
                </div>
              </div>

              {selectedCompanyAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-slate-800 rounded-2xl bg-[#0D131F]/50">
                  <MonitorPlay size={40} className="text-slate-600 mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">Nessuna postazione</h3>
                  <p className="text-slate-400 text-sm max-w-sm">Modifica il filtro di ricerca per questa azienda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {selectedCompanyAgents.map((ag) => (
                    <PcCard key={ag.agent_id} ag={ag} />
                  ))}
                </div>
              )}
            </div>
          )}

          </div>
      </main>

      {isTecnico && showAuthPanel && (
        <div className="fixed inset-0 z-[130] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="lsight-auth-panel-title">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setShowAuthPanel(false)}
            aria-label="Chiudi pannello autorizzazioni"
          />
          <aside className="relative w-full max-w-xl h-full bg-[#080c14] border-l border-indigo-900/50 shadow-2xl flex flex-col">
            <div className="p-4 border-b border-indigo-900/40 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck size={18} className="text-indigo-400 shrink-0" />
                <h2 id="lsight-auth-panel-title" className="text-white font-bold text-sm truncate">
                  Autorizzazioni · azienda e email
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthPanel(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 shrink-0"
                aria-label="Chiudi"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Scegli <span className="text-slate-300 font-medium">azienda</span> e <span className="text-slate-300 font-medium">email cliente</span> (profilo TicketApp con stessa azienda). Spunta i{' '}
                <span className="text-slate-300 font-medium">PC</span> a cui può accedere: quelli abilitati restano in cima; gli altri restano visibili sotto.
                Se selezioni tutti i PC, il sistema salva come accesso &quot;tutta l’azienda&quot;.
              </p>

              {grantMessage && (
                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">{grantMessage}</div>
              )}

              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold">Azienda (Comm Agent)</label>
                <select
                  value={grantCompany}
                  onChange={(e) => {
                    setGrantCompany(e.target.value);
                    setGrantMessage('');
                  }}
                  className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                >
                  <option value="">— Scegli —</option>
                  {companyNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                  <Mail size={12} />
                  Email utente cliente
                </label>
                <input
                  type="email"
                  list="lsight-grant-emails-panel"
                  value={grantEmail}
                  onChange={(e) => {
                    setGrantEmail(e.target.value);
                    setGrantMessage('');
                  }}
                  placeholder="nome@..."
                  autoComplete="off"
                  className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                />
                <datalist id="lsight-grant-emails-panel">
                  {clienteEmailsForGrantCompany.map((em) => (
                    <option key={em} value={em} />
                  ))}
                </datalist>
              </div>

              {grantCompany.trim() && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold">Dispositivi</label>
                    {grantPanelAgents.length > 0 && (
                      <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={allGrantAgentsSelected}
                          onChange={(e) => setAllGrantAgents(e.target.checked)}
                          className="rounded border-slate-600 bg-[#111827] text-indigo-500 focus:ring-indigo-500"
                        />
                        Seleziona tutti
                      </label>
                    )}
                  </div>
                  {grantAgentsLoading ? (
                    <div className="text-xs text-slate-500 py-4 text-center">Caricamento elenco PC…</div>
                  ) : !grantPanelAgents.length ? (
                    <div className="text-xs text-slate-500 py-3 border border-dashed border-slate-700 rounded-lg px-3">
                      Nessun Comm Agent per questa azienda.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-800 bg-[#0A0E17] max-h-[42vh] overflow-y-auto divide-y divide-slate-800/80">
                      {grantAccessLoading && grantEmail.trim() && (
                        <div className="px-3 py-2 text-[10px] text-slate-500">Aggiornamento stato accessi…</div>
                      )}
                      {grantAccessFullCompany && grantEmail.trim() && (
                        <div className="px-3 py-2 text-[10px] text-emerald-400/90 bg-emerald-500/5">
                          Modo attuale: accesso a <span className="font-semibold">tutta l&apos;azienda</span> · tutti i PC risultano abilitati.
                        </div>
                      )}
                      {sortedPanelAgents.map((ag) => {
                        const on = grantEnabledAgentIds.includes(ag.agent_id);
                        return (
                          <label
                            key={ag.agent_id}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/[0.03] ${on ? 'bg-indigo-500/10' : 'opacity-80'}`}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggleGrantAgent(ag.agent_id)}
                              className="rounded border-slate-600 bg-[#111827] text-indigo-500 focus:ring-indigo-500 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-white font-medium truncate">{ag.machine_name || `PC #${ag.agent_id}`}</div>
                              <div className="text-[10px] text-slate-500 truncate">{ag.os_info || '—'}</div>
                            </div>
                            <span
                              className={`text-[10px] font-mono uppercase shrink-0 ${ag.status === 'online' ? 'text-emerald-400' : 'text-slate-500'}`}
                            >
                              {ag.status === 'online' ? 'online' : 'offline'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={grantSaving || !grantCompany.trim() || !grantEmail.trim() || !grantPanelAgents.length}
                onClick={saveDeviceAccess}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <Save size={16} />
                {grantSaving ? 'Salvataggio...' : 'Salva autorizzazioni'}
              </button>

              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Riepilogo configurazioni</h3>
                <div className="rounded-xl border border-slate-800 overflow-hidden bg-[#0A0E17] max-h-[36vh] overflow-y-auto">
                  {accessSummaryLoading ? (
                    <div className="px-4 py-6 text-center text-slate-500 text-xs">Caricamento...</div>
                  ) : !accessSummary.full_company?.length && !accessSummary.selected_only?.length ? (
                    <div className="px-4 py-6 text-center text-slate-500 text-xs italic">Nessuna autorizzazione</div>
                  ) : (
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-[#111827] text-[10px] uppercase text-slate-500 sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Cliente</th>
                          <th className="px-3 py-2">Azienda PC</th>
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2 w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {accessSummary.full_company.map((r) => {
                          const azLabel =
                            companyNames.find((n) => normCompany(n) === String(r.company_key || '').trim().toLowerCase()) ||
                            r.company_key;
                          return (
                            <tr key={`f-${r.grant_id}`} className="hover:bg-white/[0.02]">
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <User size={12} className="text-indigo-400 shrink-0" />
                                  <span className="truncate max-w-[7rem]">
                                    {r.nome} {r.cognome}
                                  </span>
                                </div>
                                <div className="font-mono text-[10px] text-slate-500 truncate max-w-[11rem]">{r.email}</div>
                              </td>
                              <td className="px-3 py-2 font-medium text-indigo-200">{azLabel}</td>
                              <td className="px-3 py-2 text-emerald-400/90">Tutti i PC</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  title="Revoca"
                                  onClick={() => revokeUnifiedAccess({ ...r, kind: 'full_company' })}
                                  className="p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400 rounded"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {accessSummary.selected_only.map((r) => (
                          <tr key={`p-${r.user_id}-${r.company_key_low}`} className="hover:bg-white/[0.02]">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <User size={12} className="text-indigo-400 shrink-0" />
                                <span className="truncate max-w-[7rem]">
                                  {r.nome} {r.cognome}
                                </span>
                              </div>
                              <div className="font-mono text-[10px] text-slate-500 truncate max-w-[11rem]">{r.email}</div>
                            </td>
                            <td className="px-3 py-2 font-medium text-indigo-200">{r.company_label}</td>
                            <td className="px-3 py-2 text-slate-400">{r.n_devices} PC</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                title="Revoca"
                                onClick={() => revokeUnifiedAccess({ ...r, kind: 'selected_devices' })}
                                className="p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default LSightPage;
