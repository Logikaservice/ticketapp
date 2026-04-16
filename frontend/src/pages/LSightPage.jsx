import React, { useState, useEffect, useMemo } from 'react';
import {
  Eye, Activity, Search, X, MonitorPlay, Zap, ShieldCheck,
  User, Plus, Trash2, Server, Building2, ChevronRight,
  ArrowLeft, WifiOff, Wifi
} from 'lucide-react';

// ── Colori deterministici per azienda ─────────────────────────────────────────
const COMPANY_COLORS = [
  { bg: 'from-indigo-600/30 to-indigo-800/20', border: 'border-indigo-500/30', text: 'text-indigo-400' },
  { bg: 'from-cyan-600/30 to-cyan-800/20',     border: 'border-cyan-500/30',   text: 'text-cyan-400' },
  { bg: 'from-violet-600/30 to-violet-800/20', border: 'border-violet-500/30', text: 'text-violet-400' },
  { bg: 'from-emerald-600/30 to-emerald-800/20', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  { bg: 'from-amber-600/30 to-amber-800/20',   border: 'border-amber-500/30',  text: 'text-amber-400' },
  { bg: 'from-rose-600/30 to-rose-800/20',     border: 'border-rose-500/30',   text: 'text-rose-400' },
  { bg: 'from-sky-600/30 to-sky-800/20',       border: 'border-sky-500/30',    text: 'text-sky-400' },
  { bg: 'from-fuchsia-600/30 to-fuchsia-800/20', border: 'border-fuchsia-500/30', text: 'text-fuchsia-400' },
];

const getCompanyColor = (name) => {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash += name.charCodeAt(i);
  return COMPANY_COLORS[hash % COMPANY_COLORS.length];
};

const getInitials = (name) => {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
};

// ── Componente principale ──────────────────────────────────────────────────────
const LSightPage = ({ onClose, onNavigateHome, currentUser, getAuthHeader }) => {
  const [isScanning, setIsScanning]           = useState(true);
  const [agents, setAgents]                   = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companySearch, setCompanySearch]     = useState('');
  const [pcSearch, setPcSearch]               = useState('');

  // Admin state
  const [showAdminModal, setShowAdminModal]               = useState(false);
  const [allUsers, setAllUsers]                           = useState([]);
  const [assignments, setAssignments]                     = useState([]);
  const [adminLoading, setAdminLoading]                   = useState(false);
  const [selectedUserForAssign, setSelectedUserForAssign] = useState('');
  const [selectedAgentForAssign, setSelectedAgentForAssign] = useState('');

  const isTecnico = currentUser?.ruolo === 'tecnico';

  // ── Fetch agenti ─────────────────────────────────────────────────────────────
  const fetchMyAgents = async () => {
    setIsScanning(true);
    try {
      const res  = await fetch('/api/lsight/my-agents', { headers: getAuthHeader() });
      const data = await res.json();
      if (data.success) setAgents(data.agents || []);
    } catch (e) {
      console.error('Errore fetch agenti L-Sight:', e);
    } finally {
      setIsScanning(false);
    }
  };

  // ── Fetch dati pannello admin ─────────────────────────────────────────────────
  const fetchAdminData = async () => {
    setAdminLoading(true);
    try {
      const [usersRes, asgnRes] = await Promise.all([
        fetch('/api/users', { headers: getAuthHeader() }),
        fetch('/api/lsight/admin/assignments', { headers: getAuthHeader() }),
      ]);
      const usersData = await usersRes.json();
      const asgnData  = await asgnRes.json();
      // /api/users restituisce direttamente un array (non { success, users })
      if (Array.isArray(usersData))       setAllUsers(usersData);
      else if (usersData.success)         setAllUsers(usersData.users || []);
      if (asgnData.success)               setAssignments(asgnData.assignments || []);
    } catch (e) {
      console.error('Errore fetch admin:', e);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => { fetchMyAgents(); }, []);
  useEffect(() => { if (showAdminModal) fetchAdminData(); }, [showAdminModal]);

  // ── Raggruppa agent per azienda ───────────────────────────────────────────────
  const companiesMap = useMemo(() => {
    const map = new Map();
    agents.forEach(ag => {
      const az = ag.azienda || 'Non classificato';
      if (!map.has(az)) map.set(az, { name: az, agents: [], onlineCount: 0, totalCount: 0 });
      const co = map.get(az);
      co.agents.push(ag);
      co.totalCount++;
      if (ag.status === 'online') co.onlineCount++;
    });
    return map;
  }, [agents]);

  const companies = useMemo(() =>
    Array.from(companiesMap.values())
      .filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name))
  , [companiesMap, companySearch]);

  const selectedCompanyAgents = useMemo(() => {
    if (!selectedCompany) return [];
    const co = companiesMap.get(selectedCompany);
    if (!co) return [];
    return co.agents.filter(ag =>
      (ag.machine_name || '').toLowerCase().includes(pcSearch.toLowerCase()) ||
      (ag.os_info || '').toLowerCase().includes(pcSearch.toLowerCase())
    );
  }, [selectedCompany, companiesMap, pcSearch]);

  // ── Azioni admin ──────────────────────────────────────────────────────────────
  const handleAssignAgent = async () => {
    if (!selectedUserForAssign || !selectedAgentForAssign) {
      alert('Seleziona utente e PC!');
      return;
    }
    const res = await fetch('/api/lsight/admin/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ user_id: selectedUserForAssign, agent_id: selectedAgentForAssign }),
    });
    if (res.ok) {
      fetchAdminData();
      setSelectedUserForAssign('');
      setSelectedAgentForAssign('');
    } else {
      alert('Errore in assegnazione');
    }
  };

  const handleRemoveAssignment = async (userId, agentId) => {
    if (!window.confirm('Revocare questo permesso?')) return;
    const res = await fetch(`/api/lsight/admin/assignments?user_id=${userId}&agent_id=${agentId}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    if (res.ok) fetchAdminData();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Sub-componenti interni
  // ─────────────────────────────────────────────────────────────────────────────

  const PcCard = ({ ag }) => {
    const isOnline = ag.status === 'online';
    return (
      <div className={`group relative bg-[#111827] rounded-2xl border transition-all overflow-hidden flex flex-col shadow-lg ${isOnline ? 'border-indigo-500/30 hover:border-indigo-400/60' : 'border-slate-800 hover:border-slate-700'}`}>
        {isOnline && (
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-indigo-500/10 blur-2xl rounded-full pointer-events-none" />
        )}
        <div className="p-5 pb-3 border-b border-white/5 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-sm flex items-center gap-2 truncate">
              <Server className="text-indigo-400 flex-shrink-0" size={14} />
              <span className="truncate">{ag.machine_name}</span>
            </h3>
            <div className={`text-[10px] mt-1.5 font-mono uppercase tracking-widest flex items-center gap-1.5 ${isOnline ? 'text-emerald-400' : 'text-rose-400/70'}`}>
              {isOnline ? (
                <React.Fragment>
                  <Wifi size={9} />
                  {' ONLINE'}
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <WifiOff size={9} />
                  {' OFFLINE'}
                </React.Fragment>
              )}
            </div>
          </div>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ml-2 transition-colors ${isOnline ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800/50 text-slate-500'}`}>
            <MonitorPlay size={16} />
          </div>
        </div>
        <div className="p-5 pt-3 flex-1 flex flex-col justify-between">
          <p className="text-xs text-slate-500 mb-4 truncate">{ag.os_info || 'Sistema Sconosciuto'}</p>
          <button
            disabled={!isOnline}
            className={`w-full py-2 rounded-lg flex items-center justify-center gap-2 font-bold text-xs transition-all focus:outline-none ${
              isOnline
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.35)]'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
            }`}
          >
            {isOnline ? '⚡ CONNETTI ORA' : '— NON DISPONIBILE'}
          </button>
        </div>
      </div>
    );
  };

  const CompanyCard = ({ company }) => {
    const color = getCompanyColor(company.name);
    return (
      <button
        onClick={() => { setSelectedCompany(company.name); setPcSearch(''); }}
        className={`group relative text-left w-full rounded-2xl border bg-gradient-to-br p-5 transition-all shadow-lg hover:scale-[1.02] active:scale-[0.99] overflow-hidden ${color.bg} ${color.border}`}
      >
        <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/5 rounded-full" />
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl bg-black/30 flex items-center justify-center text-sm font-black ${color.text} flex-shrink-0 border border-white/10`}>
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

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] bg-[#0A0E17] text-slate-300 flex flex-col font-sans overflow-hidden">

      {/* ── Header ── */}
      <header className="flex-none bg-[#0D131F] border-b border-indigo-900/30 px-6 py-4 flex items-center justify-between shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-full bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="relative flex items-center justify-center w-12 h-12 bg-indigo-950 rounded-xl border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Eye className="text-indigo-400 w-6 h-6" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-indigo-950 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              L-Sight
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] uppercase font-black tracking-widest border border-indigo-500/20">Remote Core</span>
            </h1>
            <p className="text-xs text-indigo-300/70 uppercase tracking-widest font-semibold mt-0.5">Zero-Trust Remote Access Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          {isTecnico && (
            <button
              onClick={() => setShowAdminModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all"
            >
              <Zap size={16} />
              Assegnazioni
            </button>
          )}
          <button
            onClick={onNavigateHome || onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all text-sm font-medium"
          >
            <X size={18} />
            Chiudi
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 space-y-6">

          {/* Status Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-indigo-900/40 to-slate-900 border border-indigo-500/20 overflow-hidden flex items-stretch">
            <div className="w-1.5 bg-gradient-to-b from-indigo-500 to-indigo-700" />
            <div className="p-5 flex-1 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="text-indigo-400" size={18} />
                  {selectedCompany ? `Azienda: ${selectedCompany}` : "Seleziona un'Azienda per procedere"}
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  {selectedCompany
                    ? `${selectedCompanyAgents.length} postazioni trovate · Connessioni crittografate end-to-end`
                    : `${companies.length} aziende disponibili · ${agents.length} postazioni totali monitorate`}
                </p>
              </div>
              <div className="flex gap-3">
                <div className="bg-[#0A0E17] border border-slate-800 rounded-lg px-4 py-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Latenza</div>
                  <div className="text-emerald-400 font-mono text-base font-bold">12ms</div>
                </div>
                <div className="bg-[#0A0E17] border border-slate-800 rounded-lg px-4 py-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Aziende</div>
                  <div className="text-indigo-400 font-mono text-base font-bold">{companies.length}</div>
                </div>
                <div className="bg-[#0A0E17] border border-slate-800 rounded-lg px-4 py-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Postazioni</div>
                  <div className="text-indigo-400 font-mono text-base font-bold">{agents.length}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Contenuto centrale */}
          {isScanning ? (

            /* Loading */
            <div className="flex flex-col items-center justify-center py-24 space-y-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin" />
                <Eye className="absolute inset-0 m-auto text-indigo-400 animate-pulse" size={24} />
              </div>
              <div className="text-sm font-mono text-indigo-400 animate-pulse tracking-widest">AUTENTICAZIONE IN CORSO...</div>
            </div>

          ) : !selectedCompany ? (

            /* Step 1 — selezione azienda */
            <div className="space-y-6">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Filtra aziende..."
                  value={companySearch}
                  onChange={e => setCompanySearch(e.target.value)}
                  className="w-full bg-[#111827] border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              {companies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-slate-800 rounded-2xl bg-[#0D131F]/50">
                  <Building2 size={40} className="text-slate-600 mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">Nessuna azienda trovata</h3>
                  <p className="text-slate-400 text-sm max-w-sm">
                    Non ci sono agent con un azienda associata, oppure nessun PC è ancora stato assegnato al tuo profilo.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {companies.map(co => (
                    <CompanyCard key={co.name} company={co} />
                  ))}
                </div>
              )}
            </div>

          ) : (

            /* Step 2 — PC dell'azienda selezionata */
            <div className="space-y-6">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => { setSelectedCompany(null); setPcSearch(''); }}
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
                    onChange={e => setPcSearch(e.target.value)}
                    className="bg-[#111827] border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all w-60"
                  />
                </div>
              </div>

              {selectedCompanyAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-slate-800 rounded-2xl bg-[#0D131F]/50">
                  <MonitorPlay size={40} className="text-slate-600 mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">Nessuna postazione trovata</h3>
                  <p className="text-slate-400 text-sm max-w-sm">Nessun PC corrisponde ai criteri di ricerca per questa azienda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {selectedCompanyAgents.map(ag => (
                    <PcCard key={ag.agent_id} ag={ag} />
                  ))}
                </div>
              )}
            </div>

          )}

        </div>
      </main>

      {/* ── Pannello Admin ── */}
      {showAdminModal && isTecnico && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[88vh] flex flex-col shadow-2xl">

            {/* Titolo — fisso */}
            <div className="flex-none p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="text-indigo-500" />
                Pannello Assegnazioni L-Sight
              </h2>
              <button onClick={() => setShowAdminModal(false)} className="text-slate-400 hover:text-white transition">
                <X size={20} />
              </button>
            </div>

            {/* Form — fisso, sempre visibile */}
            <div className="flex-none p-6 border-b border-slate-800 bg-[#0D131F]">
              <h3 className="text-xs font-semibold text-white mb-4 uppercase tracking-widest flex items-center gap-2">
                <Plus size={13} className="text-indigo-400" />
                Nuova assegnazione · Utente → PC
              </h3>
              {adminLoading ? (
                <div className="text-slate-400 font-mono text-sm animate-pulse py-2">SINCRONIZZAZIONE DATI...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-5">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Utente Cliente</label>
                    <select
                      value={selectedUserForAssign}
                      onChange={e => setSelectedUserForAssign(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Seleziona Utente --</option>
                      {allUsers.filter(u => u.ruolo !== 'tecnico').map(u => (
                        <option key={u.id} value={u.id}>{u.nome} {u.cognome} ({u.azienda})</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-5">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Agent / PC da assegnare</label>
                    <select
                      value={selectedAgentForAssign}
                      onChange={e => setSelectedAgentForAssign(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Seleziona PC --</option>
                      {agents.map(a => (
                        <option key={a.agent_id} value={a.agent_id}>[{a.azienda}] {a.machine_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <button
                      onClick={handleAssignAgent}
                      disabled={!selectedUserForAssign || !selectedAgentForAssign}
                      className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all text-sm"
                    >
                      <Plus size={15} />
                      Abbina
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tabella — scrollabile */}
            <div className="flex-1 overflow-y-auto p-6">
              <h3 className="text-xs font-semibold text-white mb-4 uppercase tracking-widest">Matrice Permessi Attivi</h3>
              <div className="bg-[#0A0E17] border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-[#111827] border-b border-slate-800 text-[10px] uppercase text-slate-500 font-semibold tracking-wider sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Utente</th>
                      <th className="px-4 py-3">Azienda</th>
                      <th className="px-4 py-3">PC Autorizzato</th>
                      <th className="px-4 py-3 text-right">Revoca</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {adminLoading ? (
                      <tr>
                        <td colSpan="4" className="px-4 py-8 text-center text-slate-500 font-mono text-xs animate-pulse">
                          Caricamento...
                        </td>
                      </tr>
                    ) : assignments.filter(a => a.user_id).length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-4 py-8 text-center text-slate-500 italic text-sm">
                          Nessun permesso configurato
                        </td>
                      </tr>
                    ) : assignments.filter(a => a.user_id).map((a, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-medium text-white">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center border border-slate-700 flex-shrink-0">
                              <User size={11} className="text-indigo-400" />
                            </div>
                            {a.nome} {a.cognome}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{a.azienda || '—'}</td>
                        <td className="px-4 py-3 font-mono text-indigo-300 text-xs">{a.machine_name}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemoveAssignment(a.user_id, a.agent_id)}
                            className="p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 rounded transition-colors"
                            title="Revoca permesso"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default LSightPage;
