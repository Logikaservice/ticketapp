import React, { useState, useEffect, useCallback } from 'react';
import {
    X, Users, Monitor, Building2, Mail, Download, RefreshCw,
    Trash2, Bell, Plus, Search, CheckCircle, Clock, WifiOff
} from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const CommAgentManager = ({ currentUser, closeModal, notify }) => {
    const [activeTab, setActiveTab] = useState('agents');
    const [agents, setAgents] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAzienda, setSelectedAzienda] = useState('');
    const [downloadingId, setDownloadingId] = useState(null);

    const getHeaders = useCallback(() => {
        const token = localStorage.getItem('authToken');
        return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    }, []);

    const fetchAgents = useCallback(async () => {
        try {
            const res = await fetch(buildApiUrl('/api/comm-agent/agents'), { headers: getHeaders() });
            if (res.ok) setAgents(await res.json());
        } catch (err) { console.error('Errore fetch comm agents:', err); }
    }, [getHeaders]);

    const fetchClients = useCallback(async () => {
        try {
            const res = await fetch(buildApiUrl('/api/comm-agent/clients'), { headers: getHeaders() });
            if (res.ok) setClients(await res.json());
        } catch (err) { console.error('Errore fetch clients:', err); }
    }, [getHeaders]);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchAgents(), fetchClients()]).finally(() => setLoading(false));
    }, [fetchAgents, fetchClients]);

    const handleDelete = async (agentId, machineName) => {
        if (!window.confirm(`Eliminare l'agent su "${machineName}"? L'agent smetterà di funzionare.`)) return;
        try {
            const res = await fetch(buildApiUrl(`/api/comm-agent/agents/${agentId}`), {
                method: 'DELETE', headers: getHeaders()
            });
            if (res.ok) {
                notify?.('Agent eliminato', 'success');
                fetchAgents();
            } else {
                notify?.('Errore eliminazione agent', 'error');
            }
        } catch (err) { notify?.('Errore di rete', 'error'); }
    };

    const handleDownload = async (userId, userEmail) => {
        setDownloadingId(userId);
        try {
            const token = localStorage.getItem('authToken');
            const url = buildApiUrl(`/api/comm-agent/download-agent-for-user/${userId}`) + `?token=${token}`;
            window.open(url, '_blank');
        } catch (err) {
            notify?.('Errore download', 'error');
        } finally {
            setTimeout(() => setDownloadingId(null), 2000);
        }
    };

    // Aziende uniche dagli agent
    const aziende = [...new Set(agents.map(a => a.azienda).filter(Boolean))].sort();

    const filteredAgents = agents.filter(a => {
        const matchAzienda = !selectedAzienda || a.azienda === selectedAzienda;
        const q = searchQuery.toLowerCase();
        const matchSearch = !q || (a.machine_name || '').toLowerCase().includes(q)
            || (a.email || '').toLowerCase().includes(q)
            || (a.azienda || '').toLowerCase().includes(q)
            || (a.nome || '').toLowerCase().includes(q)
            || (a.cognome || '').toLowerCase().includes(q);
        return matchAzienda && matchSearch;
    });

    // Raggruppa clients per azienda
    const clientsByAzienda = clients.reduce((acc, c) => {
        const az = c.azienda || 'Senza azienda';
        if (!acc[az]) acc[az] = [];
        acc[az].push(c);
        return acc;
    }, {});

    const filteredClients = Object.entries(clientsByAzienda).filter(([az]) => {
        const q = searchQuery.toLowerCase();
        return !q || az.toLowerCase().includes(q) || clientsByAzienda[az].some(c =>
            (c.email || '').toLowerCase().includes(q) || (c.nome || '').toLowerCase().includes(q)
        );
    });

    const onlineCount = agents.filter(a => a.status === 'online' || a.real_status === 'online').length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-violet-600 to-indigo-600">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Bell size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Agent Comunicazioni</h2>
                            <p className="text-violet-200 text-xs">{agents.length} agent registrati • {onlineCount} online</p>
                        </div>
                    </div>
                    <button onClick={closeModal} className="p-2 hover:bg-white/20 rounded-lg transition">
                        <X size={20} className="text-white" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b bg-gray-50">
                    {[
                        { id: 'agents', label: 'Agent Esistenti', icon: Monitor },
                        { id: 'create', label: 'Crea Agent', icon: Plus }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSearchQuery(''); setSelectedAzienda(''); }}
                            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-violet-600 text-violet-700 bg-white'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                        >
                            <tab.icon size={15} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Filtri */}
                <div className="flex items-center gap-3 px-6 py-3 border-b bg-white">
                    <div className="relative flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={activeTab === 'agents' ? 'Cerca per nome, email, PC, azienda...' : 'Cerca per azienda o email...'}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                        />
                    </div>
                    {activeTab === 'agents' && (
                        <select
                            value={selectedAzienda}
                            onChange={e => setSelectedAzienda(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none min-w-[180px]"
                        >
                            <option value="">Tutte le aziende</option>
                            {aziende.map(az => (
                                <option key={az} value={az}>{az}</option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={() => { fetchAgents(); fetchClients(); }}
                        className="p-2 border rounded-lg hover:bg-gray-50 transition text-gray-500"
                        title="Aggiorna"
                    >
                        <RefreshCw size={15} />
                    </button>
                </div>

                {/* Contenuto */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-gray-400">
                            <RefreshCw size={24} className="animate-spin mr-3" /> Caricamento...
                        </div>
                    ) : activeTab === 'agents' ? (
                        filteredAgents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                                <Monitor size={40} className="opacity-30" />
                                <p className="font-medium">Nessun agent trovato</p>
                                <p className="text-sm">Scarica e installa l'agent su un PC cliente</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredAgents.map(agent => {
                                    const isOnline = agent.status === 'online' || agent.real_status === 'online';
                                    return (
                                        <div key={agent.id} className="flex items-center gap-4 p-4 rounded-xl border bg-white hover:border-violet-200 hover:shadow-sm transition-all">
                                            {/* Status */}
                                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-gray-300'}`} />

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-gray-800 text-sm">
                                                        {agent.nome} {agent.cognome}
                                                    </span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {isOnline ? 'Online' : 'Offline'}
                                                    </span>
                                                    <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                                                        v{agent.version || '1.0.0'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                                                    <span className="flex items-center gap-1"><Mail size={11} />{agent.email}</span>
                                                    <span className="flex items-center gap-1"><Monitor size={11} />{agent.machine_name || 'N/A'}</span>
                                                    <span className="flex items-center gap-1"><Building2 size={11} />{agent.azienda || 'N/A'}</span>
                                                    {agent.last_heartbeat && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={11} />
                                                            {new Date(agent.last_heartbeat).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Elimina */}
                                            <button
                                                onClick={() => handleDelete(agent.id, agent.machine_name || agent.email)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                title="Elimina agent"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    ) : (
                        /* TAB: Crea Agent */
                        filteredClients.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                                <Users size={40} className="opacity-30" />
                                <p className="font-medium">Nessun cliente trovato</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-500">
                                    Seleziona un'azienda e scarica il pacchetto Agent Comunicazioni pre-configurato per quell'utente.
                                    Il pacchetto include già le credenziali di accesso.
                                </p>
                                {filteredClients.map(([azienda, users]) => (
                                    <div key={azienda} className="border rounded-xl overflow-hidden">
                                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b">
                                            <Building2 size={14} className="text-violet-500" />
                                            <span className="font-semibold text-gray-700 text-sm">{azienda}</span>
                                            <span className="text-xs text-gray-400 ml-auto">{users.length} {users.length === 1 ? 'utente' : 'utenti'}</span>
                                        </div>
                                        <div className="divide-y">
                                            {users.map(user => {
                                                const hasAgent = agents.some(a => a.user_id === user.id || a.email === user.email);
                                                return (
                                                    <div key={user.id} className="flex items-center gap-4 px-4 py-3 bg-white hover:bg-gray-50 transition">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-gray-800 text-sm">{user.nome} {user.cognome}</span>
                                                                {hasAgent && (
                                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                        <CheckCircle size={10} /> Agent attivo
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                                <Mail size={10} /> {user.email}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDownload(user.id, user.email)}
                                                            disabled={downloadingId === user.id}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition shadow-sm"
                                                            title={`Scarica Agent per ${user.email}`}
                                                        >
                                                            <Download size={13} />
                                                            {downloadingId === user.id ? 'Download...' : 'Scarica Agent'}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommAgentManager;
