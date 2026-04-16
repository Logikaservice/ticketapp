import React, { useState, useEffect } from 'react';
import { Eye, Activity, Search, X, MonitorPlay, Zap, ShieldCheck, User, Plus, Trash2, Server } from 'lucide-react';

const LSightPage = ({ onClose, onNavigateHome, currentUser, getAuthHeader }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(true);
  const [agents, setAgents] = useState([]);
  
  // Admin state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [allAgents, setAllAgents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [selectedUserForAssign, setSelectedUserForAssign] = useState('');

  const isTecnico = currentUser?.ruolo === 'tecnico';

  const fetchMyAgents = async () => {
    try {
      const response = await fetch('/api/lsight/my-agents', {
        headers: getAuthHeader()
      });
      const data = await response.json();
      if (data.success) {
        setAgents(data.agents || []);
      }
    } catch (error) {
      console.error('Errore nel fetch degli agenti L-Sight:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const fetchAdminData = async () => {
    setAdminLoading(true);
    try {
      // Carica utenti
      const usersRes = await fetch('/api/users', { headers: getAuthHeader() });
      const usersData = await usersRes.json();
      if (usersData.success) {
        setAllUsers(usersData.users || []);
      }

      // Carica assegnazioni correnti
      const asgnRes = await fetch('/api/lsight/admin/assignments', { headers: getAuthHeader() });
      const asgnData = await asgnRes.json();
      if (asgnData.success) {
        setAssignments(asgnData.assignments || []);
        
        // Estrai la lista di agenti completi
        const uniqueAgentsMap = new Map();
        (asgnData.assignments || []).forEach(a => {
            if (a.agent_id && !uniqueAgentsMap.has(a.agent_id)) {
                uniqueAgentsMap.set(a.agent_id, {
                    id: a.agent_id,
                    machine_name: a.machine_name,
                    status: a.status
                });
            }
        });
        setAllAgents(Array.from(uniqueAgentsMap.values()));
      }
    } catch (error) {
      console.error('Errore nel fetch dati admin:', error);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAssignAgent = async (agentId) => {
    if (!selectedUserForAssign) return alert('Seleziona un utente prima!');
    try {
      const res = await fetch('/api/lsight/admin/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ user_id: selectedUserForAssign, agent_id: agentId })
      });
      if (res.ok) {
        fetchAdminData();
      } else {
        alert('Errore in assegnazione');
      }
    } catch (error) {
      console.error('Errore in assegnazione', error);
    }
  };

  const handleRemoveAssignment = async (userId, agentId) => {
    if (!window.confirm('Sicuro di voler rimuovere il permesso a questo utente?')) return;
    try {
      const res = await fetch(`/api/lsight/admin/assignments?user_id=${userId}&agent_id=${agentId}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch (e) {
      console.error('Errore', e);
    }
  };

  useEffect(() => {
    fetchMyAgents();
  }, []);

  useEffect(() => {
    if (showAdminModal) {
      fetchAdminData();
    }
  }, [showAdminModal]);

  const filteredAgents = agents.filter(a => 
    a.machine_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.os_info?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] bg-[#0A0E17] text-slate-300 flex flex-col font-sans overflow-hidden">
      {/* Header Premium */}
      <header className="flex-none bg-[#0D131F] border-b border-indigo-900/30 px-6 py-4 flex items-center justify-between shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-full bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="relative flex items-center justify-center w-12 h-12 bg-indigo-950 rounded-xl border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Eye className="text-indigo-400 w-6 h-6" />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-indigo-950 animate-pulse"></div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              L-Sight <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] uppercase font-black tracking-widest border border-indigo-500/20">Remote Core</span>
            </h1>
            <p className="text-xs text-indigo-300/70 uppercase tracking-widest font-semibold mt-0.5">Zero-Trust Remote Access Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <button 
            onClick={onNavigateHome || onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all text-sm font-medium"
          >
            <X size={18} />
            Chiudi Modulo
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10 space-y-8">
          
          {/* Status Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-indigo-900/40 to-slate-900 border border-indigo-500/20 overflow-hidden flex items-stretch">
            <div className="w-1.5 bg-indigo-500" />
            <div className="p-6 flex-1 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="text-indigo-400" size={20} />
                  Infrastruttura L-Sight Operativa
                </h2>
                <p className="text-slate-400 text-sm mt-1">Connessioni crittografate end-to-end senza VPN abilitate. I tuoi dispositivi autorizzati appariranno in basso.</p>
              </div>
              <div className="flex gap-4">
                <div className="bg-[#0A0E17] border border-slate-800 rounded-lg px-4 py-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Latenza Rete</div>
                  <div className="text-emerald-400 font-mono text-lg font-bold">12ms</div>
                </div>
                <div className="bg-[#0A0E17] border border-slate-800 rounded-lg px-4 py-2 text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">I tuoi target</div>
                  <div className="text-indigo-400 font-mono text-lg font-bold">{agents.length}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Cerca dispositivo o indirizzo..." 
                className="w-full bg-[#111827] border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {isTecnico && (
              <button 
                onClick={() => setShowAdminModal(true)}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all"
              >
                <Zap size={18} />
                Gestisci Assegnazioni L-Sight
              </button>
            )}
          </div>

          {/* Content Grid */}
          {isScanning ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-6">
               <div className="relative w-20 h-20">
                  <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                  <Eye className="absolute inset-0 m-auto text-indigo-400 animate-pulse" size={24} />
               </div>
               <div className="text-sm font-mono text-indigo-400 animate-pulse tracking-widest">AUTENTICAZIONE IN CORSO...</div>
            </div>
          ) : filteredAgents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {filteredAgents.map(ag => (
                  <div key={ag.agent_id} className="group relative bg-[#111827] rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-all overflow-hidden flex flex-col shadow-lg">
                    {ag.status === 'online' && (
                       <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 blur-xl rounded-full" />
                    )}
                    <div className="p-6 pb-4 border-b border-white/5 flex items-start justify-between">
                       <div>
                          <h3 className="font-bold text-white text-lg flex items-center gap-2">
                             <Server className="text-indigo-400" size={18} />
                             {ag.machine_name}
                          </h3>
                          <div className="text-xs text-slate-500 mt-1 font-mono uppercase tracking-widest flex items-center gap-1.5">
                             {ag.status === 'online' ? (
                               <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span> ONLINE</>
                             ) : (
                               <><span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span> OFFLINE</>
                             )}
                          </div>
                       </div>
                       <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
                          <MonitorPlay size={20} className="text-slate-400 group-hover:text-indigo-400" />
                       </div>
                    </div>
                    <div className="p-6 pt-4 flex-1 flex flex-col justify-between">
                       <p className="text-sm text-slate-400 mb-6 truncate">{ag.os_info || 'Sistema Sconosciuto'}</p>
                       <button 
                          className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#111827] ${
                             ag.status === 'online' 
                             ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] focus:ring-blue-500' 
                             : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          }`}
                          disabled={ag.status !== 'online'}
                       >
                         {ag.status === 'online' ? 'CONNETTI ORA' : 'NON DISPONIBILE'}
                       </button>
                    </div>
                  </div>
               ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-slate-800 rounded-2xl bg-[#0D131F]/50">
              <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-6 border border-slate-700/50 shadow-inner">
                <MonitorPlay size={32} className="text-slate-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Nessun dispositivo autorizzato</h3>
              <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed mb-6">
                 Attualmente non ci sono postazioni collegate al tuo profilo L-Sight. L'amministratore di sistema deve prima abilitare e assegnare i PC al tuo account.
              </p>
              <div className="inline-flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-800">
                <ShieldCheck size={14} className="text-emerald-500" />
                RICHIEDI ACCESSO
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Admin Modal */}
      {showAdminModal && isTecnico && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                 <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="text-indigo-500" />
                    Pannello Assegnazioni L-Sight
                 </h2>
                 <button onClick={() => setShowAdminModal(false)} className="text-slate-400 hover:text-white transition">
                    <X size={20} />
                 </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-8">
                 {adminLoading ? (
                    <div className="text-center py-12 text-slate-400 font-mono text-sm animate-pulse">
                       SINCRONIZZAZIONE DATI...
                    </div>
                 ) : (
                    <>
                       {/* Assegna nuovo */}
                       <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-800">
                          <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-widest">Assegna un PC ad un Utente</h3>
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                             <div className="md:col-span-5">
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">1. Seleziona Utente Cliente</label>
                                <select 
                                   className="w-full bg-[#0A0E17] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                   value={selectedUserForAssign}
                                   onChange={e => setSelectedUserForAssign(e.target.value)}
                                >
                                   <option value="">-- Seleziona Utente --</option>
                                   {allUsers.filter(u => u.ruolo !== 'tecnico').map(u => (
                                      <option key={u.id} value={u.id}>{u.nome} {u.cognome} ({u.azienda})</option>
                                   ))}
                                </select>
                             </div>
                             <div className="md:col-span-7">
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">2. Seleziona PC (Agent) da assegnare</label>
                                <div className="flex gap-2 text-sm">
                                   {/* Quick mock per l'assegnazione. Usiamo allAgents che raccoglie i comm_agents dalla query (oppure un semplice input test nel caso mancassero) */}
                                   <select 
                                      id="assign-agent-select"
                                      className="w-full bg-[#0A0E17] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                      disabled={!selectedUserForAssign}
                                   >
                                      <option value="">-- Seleziona Agent --</option>
                                      {/* Per mostrare tutti gli agenti servirebbe una fetch separata degli agenti. Per ora filtriamo dalla lista unificata assignments se ne ha, o carichiamo. */}
                                      {allAgents.map(a => (
                                         <option key={a.id} value={a.id}>{a.machine_name} {a.status === 'online' ? '(Online)' : ''}</option>
                                      ))}
                                      {allAgents.length === 0 && <option value="" disabled>Nessun agent noto rilevato. Falli prima connettere.</option>}
                                   </select>
                                   <button 
                                      onClick={() => {
                                        const agId = document.getElementById('assign-agent-select').value;
                                        if (agId) handleAssignAgent(agId);
                                      }}
                                      disabled={!selectedUserForAssign}
                                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-1 transition-all"
                                   >
                                      <Plus size={16} /> Abbina
                                   </button>
                                </div>
                                {allAgents.length === 0 && <p className="text-xs text-rose-400 mt-2">Nessun agent in lista. Nel sistema non risultano Communication Agent attivi.</p>}
                             </div>
                          </div>
                       </div>

                       {/* Tabella correnti */}
                       <div>
                          <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-widest">Matrice dei Permessi L-Sight</h3>
                          <div className="bg-[#0A0E17] border border-slate-800 rounded-xl overflow-hidden">
                             <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-[#111827] border-b border-slate-800 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                                   <tr>
                                      <th className="px-4 py-3">Utente Cliente</th>
                                      <th className="px-4 py-3">Azienda</th>
                                      <th className="px-4 py-3">Computer Autorizzato (L-Sight)</th>
                                      <th className="px-4 py-3 text-right">Azioni</th>
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                   {assignments.filter(a => a.user_id).length === 0 ? (
                                      <tr>
                                         <td colSpan="4" className="px-4 py-8 text-center text-slate-500 italic">Nessun permesso configurato</td>
                                      </tr>
                                   ) : (
                                      assignments.filter(a => a.user_id).map((a, i) => (
                                         <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                                               <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs border border-slate-700">
                                                  <User size={12} className="text-indigo-400" />
                                               </div>
                                               {a.nome} {a.cognome}
                                            </td>
                                            <td className="px-4 py-3">{a.azienda || '-'}</td>
                                            <td className="px-4 py-3 font-mono text-indigo-300">{a.machine_name}</td>
                                            <td className="px-4 py-3 text-right">
                                               <button 
                                                  onClick={() => handleRemoveAssignment(a.user_id, a.agent_id)}
                                                  className="p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 rounded transition-colors"
                                                  title="Revoca permesso"
                                               >
                                                  <Trash2 size={16} />
                                               </button>
                                            </td>
                                         </tr>
                                      ))
                                   )}
                                </tbody>
                             </table>
                          </div>
                       </div>
                    </>
                 )}
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default LSightPage;
