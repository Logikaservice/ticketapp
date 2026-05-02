import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Send, Users, Monitor, Building2, Globe, MessageSquare,
    ChevronDown, Clock, CheckCircle2, AlertTriangle, Wrench,
    RefreshCw, Zap, Info, Search, X, Loader2, Eye, Mail,
    Bell, Megaphone, ArrowLeft, MoreVertical, Trash2
} from 'lucide-react';

import { buildApiUrl } from '../utils/apiConfig';
import SectionNavMenu from './SectionNavMenu';
import {
    normalizeHex,
    hexToRgba,
    readableOnAccent,
    getStoredTechHubAccent,
    buildCommHubMessagingTheme,
    lightenHex,
    darkenHex
} from '../utils/techHubAccent';

const CommAgentDashboard = ({
    currentUser,
    closeModal,
    notify,
    selectedCompanyId,
    onNavigateHome,
    onNavigateOffice,
    onNavigateEmail,
    onNavigateAntiVirus,
    onNavigateNetworkMonitoring,
    onNavigateMappatura,
    onNavigateSpeedTest,
    onNavigateDispositiviAziendali,
    onNavigateCommAgentManager,
    onNavigateVpn,
    /** Se true: niente overlay full-screen; pensato per l’Hub tecnico (area centrale). */
    embedded = false,
    /** Accento tema (coerente con Hub); default da localStorage come l’Hub. */
    accentHex: accentHexProp
}) => {
    const th = useMemo(() => buildCommHubMessagingTheme(accentHexProp), [accentHexProp]);
    // State
    const [activeTab, setActiveTab] = useState('send');
    const [agents, setAgents] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [targetType, setTargetType] = useState('broadcast');
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [selectedCompanies, setSelectedCompanies] = useState([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [category, setCategory] = useState('info');

    // Auth headers
    const getHeaders = useCallback(() => {
        const token = localStorage.getItem('authToken');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }, []);

    // Fetch data
    const fetchAgents = useCallback(async () => {
        try {
            const res = await fetch(buildApiUrl('/api/comm-agent/agents'), { headers: getHeaders() });
            if (res.ok) setAgents(await res.json());
        } catch (err) {
            console.error('Errore fetch agents:', err);
        }
    }, [getHeaders]);

    const fetchCompanies = useCallback(async () => {
        try {
            const res = await fetch(buildApiUrl('/api/comm-agent/companies'), { headers: getHeaders() });
            if (res.ok) setCompanies(await res.json());
        } catch (err) {
            console.error('Errore fetch companies:', err);
        }
    }, [getHeaders]);

    const fetchMessages = useCallback(async () => {
        try {
            const res = await fetch(buildApiUrl('/api/comm-agent/messages?limit=50'), { headers: getHeaders() });
            if (res.ok) setMessages(await res.json());
        } catch (err) {
            console.error('Errore fetch messages:', err);
        }
    }, [getHeaders]);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchAgents(), fetchCompanies(), fetchMessages()])
            .finally(() => setLoading(false));
    }, [fetchAgents, fetchCompanies, fetchMessages]);

    // Send message
    const handleSend = async () => {
        if (!title.trim() || !body.trim()) {
            notify?.('Inserisci titolo e messaggio', 'error');
            return;
        }

        if (targetType === 'single' && !selectedAgent) {
            notify?.('Seleziona un destinatario', 'error');
            return;
        }
        if (targetType === 'group' && selectedCompanies.length === 0) {
            notify?.('Seleziona almeno un\'azienda', 'error');
            return;
        }

        setSending(true);
        try {
            const res = await fetch(buildApiUrl('/api/comm-agent/messages/send'), {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    target_type: targetType,
                    target_agent_id: targetType === 'single' ? selectedAgent?.id : null,
                    target_companies: targetType === 'group' ? selectedCompanies : null,
                    title: title.trim(),
                    body: body.trim(),
                    priority: category === 'urgent' ? 'urgent' : category === 'warning' ? 'high' : 'normal',
                    category
                })
            });

            const data = await res.json();
            if (data.success) {
                notify?.(`✅ Messaggio inviato a ${data.delivered_to} destinatari`, 'success');
                setTitle('');
                setBody('');
                setCategory('info');
                fetchMessages();
            } else {
                notify?.(data.error || 'Errore invio messaggio', 'error');
            }
        } catch (err) {
            notify?.('Errore di connessione', 'error');
        } finally {
            setSending(false);
        }
    };

    // Filter agents
    const filteredAgents = agents.filter(a => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (a.email || '').toLowerCase().includes(q) ||
            (a.nome || '').toLowerCase().includes(q) ||
            (a.cognome || '').toLowerCase().includes(q) ||
            (a.azienda || '').toLowerCase().includes(q) ||
            (a.machine_name || '').toLowerCase().includes(q);
    });

    const onlineCount = agents.filter(a => a.status === 'online' || a.real_status === 'online').length;

    // Precompila form da messaggio storico (Rinvio)
    const handleRinvio = (msg) => {
        setTitle(msg.title || '');
        setBody(msg.body || '');
        setCategory(msg.category || 'info');
        setTargetType(msg.target_type || 'broadcast');
        if (msg.target_type === 'group' && msg.target_company) {
            const companiesList = String(msg.target_company).split(/,\s*/).map(s => s.trim()).filter(Boolean);
            setSelectedCompanies(companiesList.filter(c => companies.some(co => co.azienda === c)));
        } else {
            setSelectedCompanies([]);
        }
        if (msg.target_type === 'single') {
            const agent = agents.find(a => a.email === msg.target_email || a.machine_name === msg.target_machine);
            setSelectedAgent(agent || null);
        } else {
            setSelectedAgent(null);
        }
        setActiveTab('send');
    };

    // Priority/Category (info = accento Hub, resto semantico)
    const categoryOptions = useMemo(
        () => [
            { value: 'info', label: 'Informazione', icon: <Info size={14} />, color: th.accent },
            { value: 'warning', label: 'Avviso', icon: <AlertTriangle size={14} />, color: '#F59E0B' },
            { value: 'maintenance', label: 'Manutenzione', icon: <Wrench size={14} />, color: '#06B6D4' },
            { value: 'update', label: 'Aggiornamento', icon: <RefreshCw size={14} />, color: '#10B981' },
            { value: 'urgent', label: 'Urgente', icon: <Zap size={14} />, color: '#EF4444' }
        ],
        [th.accent]
    );

    // Delete agent
    const handleDeleteAgent = async (agentId) => {
        if (!window.confirm('Eliminare questo agent?')) return;
        try {
            await fetch(buildApiUrl(`/api/comm-agent/agents/${agentId}`), {
                method: 'DELETE',
                headers: getHeaders()
            });
            notify?.('Agent eliminato', 'success');
            fetchAgents();
        } catch (err) {
            notify?.('Errore eliminazione', 'error');
        }
    };

    const accentShellVars = {
        ['--hub-accent']: th.accent,
        ['--hub-accent-border']: th.accentBorder,
        ['--hub-accent-soft']: th.accentSoft
    };

    const outerShell = embedded
        ? {
              position: 'relative',
              flex: 1,
              minHeight: 0,
              zIndex: 'auto',
              display: 'flex',
              flexDirection: 'column',
              background: th.page,
              overflow: 'hidden',
              borderRadius: 16,
              border: `1px solid ${th.border}`,
              ...accentShellVars
          }
        : {
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              display: 'flex',
              flexDirection: 'column',
              background: th.page,
              overflow: 'hidden',
              ...accentShellVars
          };

    return (
        <div style={outerShell}>
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    color: th.text
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: embedded ? '12px 16px' : '16px 24px',
                        background: th.surface,
                        borderBottom: `1px solid ${th.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexShrink: 0
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: embedded ? 10 : 14, minWidth: 0 }}>
                        {embedded && (
                            <button
                                type="button"
                                onClick={() => closeModal?.()}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '8px 12px',
                                    borderRadius: 12,
                                    border: `1px solid ${th.borderMid}`,
                                    background: th.well,
                                    color: th.textSoft,
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    flexShrink: 0
                                }}
                            >
                                <ArrowLeft size={18} aria-hidden />
                                Panoramica Hub
                            </button>
                        )}
                        {!embedded && (
                            <SectionNavMenu
                                currentPage="comm-agent"
                                onNavigateHome={onNavigateHome || closeModal}
                                onNavigateOffice={onNavigateOffice}
                                onNavigateEmail={onNavigateEmail}
                                onNavigateAntiVirus={onNavigateAntiVirus}
                                onNavigateNetworkMonitoring={onNavigateNetworkMonitoring}
                                onNavigateMappatura={onNavigateMappatura}
                                onNavigateSpeedTest={onNavigateSpeedTest}
                                onNavigateDispositiviAziendali={onNavigateDispositiviAziendali}
                                onNavigateVpn={onNavigateVpn}
                                currentUser={currentUser}
                                selectedCompanyId={selectedCompanyId}
                            />
                        )}
                        <div
                            style={{
                                width: embedded ? 36 : 44,
                                height: embedded ? 36 : 44,
                                borderRadius: 14,
                                background: th.iconTileBg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}
                        >
                            <Bell size={embedded ? 20 : 24} color={th.accent} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h2
                                style={{
                                    margin: 0,
                                    color: th.text,
                                    fontSize: embedded ? 17 : 19,
                                    fontWeight: 700
                                }}
                            >
                                Centro Comunicazioni
                            </h2>
                            <p
                                style={{
                                    margin: '2px 0 0',
                                    color: th.label,
                                    fontSize: 11
                                }}
                            >
                                Invia notifiche ai PC dei clienti • {agents.length} agent registrati • {onlineCount}{' '}
                                online
                            </p>
                        </div>
                    </div>
                    {embedded && typeof onNavigateCommAgentManager === 'function' && (
                        <button
                            type="button"
                            onClick={() => onNavigateCommAgentManager()}
                            style={{
                                flexShrink: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 12px',
                                borderRadius: 12,
                                border: `1px solid ${hexToRgba(th.accent, 0.45)}`,
                                background: th.accentSoft2,
                                color: th.accent,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700
                            }}
                        >
                            <Monitor size={16} aria-hidden />
                            Agent comunicazioni
                        </button>
                    )}
                </div>

                {/* Tab Bar */}
                <div
                    style={{
                        display: 'flex',
                        padding: embedded ? '0 12px' : '0 20px',
                        background: th.well,
                        borderBottom: `1px solid ${th.border}`,
                        gap: 4,
                        flexShrink: 0
                    }}
                >
                    {[
                        { id: 'send', label: 'Invia Messaggio', icon: <Send size={15} /> },
                        { id: 'agents', label: 'Agent Registrati', icon: <Monitor size={15} /> },
                        { id: 'history', label: 'Storico Messaggi', icon: <Clock size={15} /> }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '11px 18px',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                background:
                                    activeTab === tab.id ? th.accentSoft : 'transparent',
                                color:
                                    activeTab === tab.id ? th.accent : th.tabInactive,
                                borderBottom:
                                    activeTab === tab.id ? `2px solid ${th.accent}` : '2px solid transparent',
                                transition: 'all 0.2s',
                                borderRadius: '10px 10px 0 0'
                            }}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        overflow: 'auto',
                        padding: embedded ? 16 : 24,
                        background: th.page
                    }}
                >

                    {/* TAB: Invio Messaggio */}
                    {activeTab === 'send' && (
                        <div style={{ display: 'flex', gap: 24 }}>
                            {/* Colonna Sinistra: Form */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>

                                {/* Tipo destinatario */}
                                <div>
                                    <label style={{ color: th.label, fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Destinatario
                                    </label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {[
                                            { value: 'broadcast', label: 'Tutti', icon: <Globe size={16} />, desc: 'Tutti gli agent' },
                                            { value: 'group', label: 'Azienda', icon: <Building2 size={16} />, desc: 'Per azienda' },
                                            { value: 'single', label: 'Singolo', icon: <Monitor size={16} />, desc: 'Un solo PC' }
                                        ].map(opt => (
                                            <button key={opt.value} onClick={() => { setTargetType(opt.value); setSelectedAgent(null); setSelectedCompanies([]); }}
                                                style={{
                                                    flex: 1, padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
                                                    border:
                                                        targetType === opt.value ? `2px solid ${th.accent}` : `2px solid ${th.borderMid}`,
                                                    background:
                                                        targetType === opt.value ? th.accentSoft2 : th.surface,
                                                    color:
                                                        targetType === opt.value ? th.textSoft : th.label,
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                    transition: 'all 0.2s'
                                                }}>
                                                {opt.icon}
                                                <span style={{ fontSize: 12, fontWeight: 600 }}>{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Selettore Aziende (multi-select) */}
                                    {targetType === 'group' && (
                                        <div style={{ marginTop: 12 }}>
                                            {companies.length > 0 ? (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                        <span style={{ fontSize: 11, color: th.muted }}>
                                                            {selectedCompanies.length} di {companies.length} selezionate
                                                        </span>
                                                        <button onClick={() => setSelectedCompanies(
                                                            selectedCompanies.length === companies.length ? [] : companies.map(c => c.azienda)
                                                        )} style={{
                                                            padding: '4px 10px', borderRadius: 6, border: `1px solid ${th.borderMid}`,
                                                            background: th.surface, color: th.accent, cursor: 'pointer', fontSize: 11, fontWeight: 600
                                                        }}>
                                                            {selectedCompanies.length === companies.length ? 'Deseleziona Tutte' : 'Seleziona Tutte'}
                                                        </button>
                                                    </div>
                                                    <div style={{ maxHeight: 180, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                        {companies.map(c => {
                                                            const isSelected = selectedCompanies.includes(c.azienda);
                                                            return (
                                                                <button key={c.azienda}
                                                                    onClick={() => setSelectedCompanies(prev =>
                                                                        isSelected ? prev.filter(x => x !== c.azienda) : [...prev, c.azienda]
                                                                    )}
                                                                    style={{
                                                                        padding: '10px 14px',
                                                                        borderRadius: 10,
                                                                        cursor: 'pointer',
                                                                        border: isSelected ? `2px solid ${th.accent}` : `1px solid ${th.borderMid}`,
                                                                        background: isSelected ? th.accentSoft2 : th.surface,
                                                                        color: th.textSoft,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 10,
                                                                        textAlign: 'left',
                                                                        transition: 'all 0.15s'
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            width: 18,
                                                                            height: 18,
                                                                            borderRadius: 4,
                                                                            flexShrink: 0,
                                                                            border: isSelected ? `2px solid ${th.accent}` : `2px solid ${th.borderMid}`,
                                                                            background: isSelected ? th.accent : 'transparent',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            transition: 'all 0.15s'
                                                                        }}
                                                                    >
                                                                        {isSelected && <CheckCircle2 size={12} color="white" />}
                                                                    </div>
                                                                    <div style={{ flex: 1 }}>
                                                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{c.azienda}</div>
                                                                        <div style={{ fontSize: 11, color: th.muted }}>{c.agent_count} agent</div>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{
                                                    padding: 16, textAlign: 'center', color: th.muted, fontSize: 13,
                                                    background: th.surface, borderRadius: 10, border: `1px solid ${th.borderMid}`
                                                }}>
                                                    Nessuna azienda con agent installati
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Selettore Agent singolo */}
                                    {targetType === 'single' && (
                                        <div style={{ marginTop: 12 }}>
                                            <div style={{ position: 'relative', marginBottom: 8 }}>
                                                <Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: th.muted }} />
                                                <input
                                                    type="text" placeholder="Cerca per nome, email, azienda..."
                                                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                                    style={{
                                                        width: '100%', padding: '10px 14px 10px 34px', borderRadius: 10,
                                                        background: th.surface, color: th.textSoft, border: `1px solid ${th.borderMid}`,
                                                        fontSize: 13, boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>
                                            <div style={{ maxHeight: 180, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {filteredAgents.map(agent => (
                                                    <button key={agent.id} onClick={() => setSelectedAgent(agent)}
                                                        style={{
                                                            padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                                                            border:
                                                                selectedAgent?.id === agent.id
                                                                    ? `2px solid ${th.accent}`
                                                                    : `1px solid ${th.borderMid}`,
                                                            background:
                                                                selectedAgent?.id === agent.id ? th.accentSoft2 : th.surface,
                                                            color: th.textSoft, display: 'flex', alignItems: 'center', gap: 10,
                                                            textAlign: 'left', transition: 'all 0.15s'
                                                        }}>
                                                        <div style={{
                                                            width: 8, height: 8, borderRadius: '50%',
                                                            background: (agent.status === 'online' || agent.real_status === 'online') ? '#22C55E' : '#6B7280',
                                                            flexShrink: 0
                                                        }} />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                                                                {agent.nome} {agent.cognome}
                                                            </div>
                                                            <div style={{ fontSize: 11, color: th.muted }}>
                                                                {agent.email} • {agent.machine_name || 'N/A'} • {agent.azienda}
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                                {filteredAgents.length === 0 && (
                                                    <div style={{ textAlign: 'center', padding: 20, color: th.muted, fontSize: 13 }}>
                                                        Nessun agent trovato
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Titolo */}
                                <div>
                                    <label style={{ color: th.label, fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Titolo
                                    </label>
                                    <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                                        placeholder="Titolo della notifica..."
                                        style={{
                                            width: '100%', padding: '12px 14px', borderRadius: 10,
                                            background: th.surface, color: th.textSoft, border: `1px solid ${th.borderMid}`,
                                            fontSize: 14, fontWeight: 600, boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                {/* Corpo messaggio */}
                                <div>
                                    <label style={{ color: th.label, fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Messaggio
                                    </label>
                                    <textarea value={body} onChange={e => setBody(e.target.value)}
                                        placeholder="Scrivi il tuo messaggio qui..."
                                        rows={4}
                                        style={{
                                            width: '100%', padding: '12px 14px', borderRadius: 10,
                                            background: th.surface, color: th.textSoft, border: `1px solid ${th.borderMid}`,
                                            fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
                                            lineHeight: 1.6, boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                {/* Categoria */}
                                <div>
                                    <label style={{ color: th.label, fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Categoria
                                    </label>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {categoryOptions.map(opt => (
                                            <button key={opt.value} onClick={() => setCategory(opt.value)}
                                                style={{
                                                    padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                                                    fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                                                    border:
                                                        category === opt.value
                                                            ? `2px solid ${opt.color}`
                                                            : `2px solid ${th.borderMid}`,
                                                    background: category === opt.value ? `${opt.color}20` : th.surface,
                                                    color: category === opt.value ? opt.color : th.muted,
                                                    transition: 'all 0.2s'
                                                }}>
                                                {opt.icon} {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Bottone invio */}
                                <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()}
                                    style={{
                                        padding: '14px 28px',
                                        borderRadius: 12,
                                        border: 'none',
                                        cursor: sending || !title.trim() || !body.trim() ? 'not-allowed' : 'pointer',
                                        background: sending ? th.sendDisabled : th.btnPrimaryBg,
                                        color: sending ? 'rgba(255,255,255,0.5)' : th.btnPrimaryFg,
                                        fontSize: 15,
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 10,
                                        transition: 'all 0.3s',
                                        opacity: !title.trim() || !body.trim() ? 0.5 : 1,
                                        boxShadow: sending ? 'none' : `0 4px 20px ${hexToRgba(th.accent, 0.28)}`
                                    }}
                                >
                                    {sending ? <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
                                    {sending ? 'Invio in corso...' : 'Invia Notifica'}
                                </button>
                            </div>

                            {/* Colonna Destra: Preview */}
                            <div style={{ width: 380, flexShrink: 0 }}>
                                <label style={{ color: th.label, fontSize: 12, fontWeight: 600, marginBottom: 12, display: 'block', textTransform: 'uppercase', letterSpacing: 1 }}>
                                    Anteprima Notifica
                                </label>
                                <NotificationPreview
                                    title={title || 'Titolo notifica'}
                                    body={body || 'Il messaggio apparirà qui...'}
                                    sender={`${currentUser?.nome || ''} ${currentUser?.cognome || ''}`}
                                    category={category}
                                    accentHex={th.accent}
                                />

                                {/* Info riepilogo */}
                                <div style={{
                                    marginTop: 16, padding: 16, borderRadius: 12,
                                    background: th.surface, border: `1px solid ${th.borderMid}`
                                }}>
                                    <div style={{ color: th.label, fontSize: 12, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase' }}>
                                        Riepilogo invio
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                            <span style={{ color: th.muted }}>Destinatari:</span>
                                            <span style={{ color: th.textSoft, fontWeight: 600 }}>
                                                {targetType === 'broadcast' ? `Tutti (${agents.length})` :
                                                    targetType === 'group' ? (selectedCompanies.length > 0 ? `${selectedCompanies.length} aziend${selectedCompanies.length === 1 ? 'a' : 'e'}` : 'Nessuna azienda') :
                                                        (selectedAgent ? `${selectedAgent.nome} ${selectedAgent.cognome}` : 'Nessuno')}
                                            </span>
                                        </div>
                                        {(() => {
                                            const targetList = targetType === 'broadcast' ? agents : targetType === 'group' ? agents.filter(a => selectedCompanies.includes(a.azienda)) : (selectedAgent ? [selectedAgent] : []);
                                            return targetList.length > 0 ? (
                                                <div style={{ fontSize: 11, color: th.muted, marginTop: 2 }}>
                                                    Riceveranno {targetList.length} agent → PC: {targetList.map(a => a.machine_name || a.email || '?').join(', ')}
                                                </div>
                                            ) : null;
                                        })()}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                            <span style={{ color: th.muted }}>Online ora:</span>
                                            <span style={{ color: '#22C55E', fontWeight: 600 }}>{onlineCount} / {agents.length}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                            <span style={{ color: th.muted }}>Categoria:</span>
                                            <span style={{ color: categoryOptions.find(c => c.value === category)?.color, fontWeight: 600 }}>
                                                {categoryOptions.find(c => c.value === category)?.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: Agent Registrati */}
                    {activeTab === 'agents' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div style={{ color: th.label, fontSize: 13 }}>
                                    {agents.length} agent registrati • {onlineCount} online
                                </div>
                                <button onClick={fetchAgents} style={{
                                    padding: '8px 16px', borderRadius: 8, border: `1px solid ${th.borderMid}`,
                                    background: th.surface, color: th.label, cursor: 'pointer', fontSize: 12,
                                    display: 'flex', alignItems: 'center', gap: 6
                                }}>
                                    <RefreshCw size={14} /> Aggiorna
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {agents.map(agent => (
                                    <div key={agent.id} style={{
                                        padding: '16px 18px', borderRadius: 14,
                                        background: th.surface, border: `1px solid ${th.borderMid}`,
                                        display: 'flex', alignItems: 'center', gap: 14,
                                        transition: 'border-color 0.2s'
                                    }}>
                                        {/* Status dot */}
                                        <div style={{
                                            width: 12, height: 12, borderRadius: '50%',
                                            background: (agent.status === 'online' || agent.real_status === 'online') ? '#22C55E' : '#6B7280',
                                            boxShadow: (agent.status === 'online' || agent.real_status === 'online') ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
                                            flexShrink: 0
                                        }} />

                                        {/* Info - tutto in linea */}
                                        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px', fontSize: 12, color: th.muted }}>
                                            <span style={{ fontWeight: 600, color: th.textSoft, marginRight: 4 }}>
                                                {agent.nome} {agent.cognome}
                                            </span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <Mail size={11} />
                                                {agent.email}
                                            </span>
                                            <span style={{ color: th.borderMid }}>•</span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <Monitor size={11} />
                                                {agent.machine_name || 'N/A'}
                                            </span>
                                            <span style={{ color: th.borderMid }}>•</span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <Building2 size={11} />
                                                {agent.azienda || 'N/A'}
                                            </span>
                                        </div>

                                        {/* Version */}
                                        <div style={{
                                            padding: '4px 10px', borderRadius: 6,
                                            background: th.well,
                                            fontSize: 11,
                                            color: th.muted
                                        }}>
                                            v{agent.version || '1.0.0'}
                                        </div>

                                        {/* Last heartbeat */}
                                        <div style={{ fontSize: 11, color: th.muted, textAlign: 'right', minWidth: 80 }}>
                                            {agent.last_heartbeat
                                                ? new Date(agent.last_heartbeat).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
                                                : 'Mai'}
                                        </div>

                                        {/* Delete */}
                                        <button onClick={() => handleDeleteAgent(agent.id)} style={{
                                            padding: 6, borderRadius: 6, border: 'none', cursor: 'pointer',
                                            background: 'transparent', color: th.muted, transition: 'color 0.2s'
                                        }}
                                            onMouseEnter={e => e.target.style.color = '#EF4444'}
                                            onMouseLeave={(e) => {
                                                e.target.style.color = th.muted;
                                            }}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                ))}

                                {agents.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: 60, color: th.muted }}>
                                        <Monitor size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Nessun agent registrato</div>
                                        <div style={{ fontSize: 13 }}>I client devono scaricare e installare il Communication Agent</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB: Storico Messaggi */}
                    {activeTab === 'history' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div style={{ color: th.label, fontSize: 13 }}>
                                    Ultimi {messages.length} messaggi inviati
                                </div>
                                <button onClick={fetchMessages} style={{
                                    padding: '8px 16px', borderRadius: 8, border: `1px solid ${th.borderMid}`,
                                    background: th.surface, color: th.label, cursor: 'pointer', fontSize: 12,
                                    display: 'flex', alignItems: 'center', gap: 6
                                }}>
                                    <RefreshCw size={14} /> Aggiorna
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {messages.map(msg => {
                                    const catConfig = categoryOptions.find(c => c.value === msg.category);
                                    return (
                                        <div key={msg.id} style={{
                                            padding: '16px 18px', borderRadius: 14,
                                            background: th.surface, border: `1px solid ${th.borderMid}`,
                                            borderLeft: `3px solid ${catConfig?.color || th.accent}`
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 14, fontWeight: 700, color: th.textSoft }}>{msg.title}</span>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                                        background: `${catConfig?.color}20`, color: catConfig?.color
                                                    }}>
                                                        {catConfig?.label}
                                                    </span>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                                        background:
                                                            msg.target_type === 'broadcast'
                                                                ? hexToRgba(th.accent, 0.2)
                                                                : msg.target_type === 'group'
                                                                  ? hexToRgba('#06B6D4', 0.2)
                                                                  : hexToRgba('#F59E0B', 0.2),
                                                        color:
                                                            msg.target_type === 'broadcast'
                                                                ? th.accent
                                                                : msg.target_type === 'group'
                                                                  ? '#06B6D4'
                                                                  : '#F59E0B'
                                                    }}>
                                                        {msg.target_type === 'broadcast' ? '🌍 Tutti' :
                                                            msg.target_type === 'group' ? `🏢 ${msg.target_company || msg.target_azienda}` :
                                                                `💻 ${msg.target_email || msg.target_machine}`}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                                    <div style={{ fontSize: 11, color: th.muted }}>
                                                        {new Date(msg.created_at).toLocaleString('it-IT', {
                                                            day: '2-digit', month: '2-digit', year: '2-digit',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </div>
                                                    <button
                                                        onClick={() => handleRinvio(msg)}
                                                        style={{
                                                            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                                            border: `1px solid ${th.borderMid}`, background: th.surface, color: th.accent,
                                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = th.accentSoft;
                                                            e.currentTarget.style.borderColor = th.accent;
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = th.surface;
                                                            e.currentTarget.style.borderColor = th.borderMid;
                                                        }}
                                                    >
                                                        <RefreshCw size={12} />
                                                        Rinvio
                                                    </button>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 13, color: th.label, marginBottom: 8 }}>{msg.body}</div>
                                            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: th.muted }}>
                                                <span><Users size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Destinatari: {msg.total_targets ?? 0}</span>
                                                <span style={{ color: '#22C55E' }}>
                                                    <CheckCircle2 size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Ricevuto da: {msg.delivered_count ?? 0}
                                                </span>
                                                <span style={{ color: th.accent }}>
                                                    <Eye size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Letto da: {msg.read_count ?? 0}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {messages.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: 60, color: th.muted }}>
                                        <MessageSquare size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Nessun messaggio inviato</div>
                                        <div style={{ fontSize: 13 }}>Invia il tuo primo messaggio dalla tab "Invia Messaggio"</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Spin keyframe */}
            <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
};

// ============================================
// Componente Preview Notifica (simula l'aspetto WPF)
// ============================================
const NotificationPreview = ({ title, body, sender, category, accentHex }) => {
    const accentBase = normalizeHex(accentHex) || getStoredTechHubAccent();
    const schemes = {
        info: {
            bg1: darkenHex(accentBase, 0.1),
            bg2: lightenHex(accentBase, 0.12),
            icon: '💬'
        },
        warning: { bg1: '#b45309', bg2: '#f59e0b', icon: '⚠️' },
        maintenance: { bg1: '#0369a1', bg2: '#22d3ee', icon: '🔧' },
        update: { bg1: '#047857', bg2: '#34d399', icon: '🔄' },
        urgent: { bg1: '#b91c1c', bg2: '#f87171', icon: '🚨' }
    };

    const cat = category || 'info';
    const scheme = schemes[cat] || schemes.info;
    const time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    return (
        <div style={{
            borderRadius: 16, overflow: 'hidden', position: 'relative',
            background: `linear-gradient(135deg, ${scheme.bg1} 0%, ${scheme.bg2} 100%)`,
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            animation: 'slideIn 0.4s ease-out'
        }}>
            {/* Overlay glassmorphism */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(255,255,255,0.08)'
            }} />

            {/* Cerchi decorativi */}
            <div style={{
                position: 'absolute', top: -30, right: -30, width: 120, height: 120,
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)'
            }} />
            <div style={{
                position: 'absolute', bottom: -20, left: -20, width: 80, height: 80,
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)'
            }} />

            <div style={{ position: 'relative', padding: '18px 20px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'rgba(255,255,255,0.2)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: 16
                    }}>
                        {scheme.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{sender || 'Logika Service'}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{time}</div>
                    </div>
                    <div style={{
                        padding: '3px 8px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.15)', fontSize: 9,
                        fontWeight: 700, color: 'white', textTransform: 'uppercase'
                    }}>
                        {cat}
                    </div>
                    <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, color: 'white'
                    }}>✕</div>
                </div>

                {/* Separator */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.15)', marginBottom: 12 }} />

                {/* Title */}
                <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 6 }}>{title}</div>

                {/* Body */}
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>{body}</div>

                {/* Progress bar */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
                    background: 'rgba(255,255,255,0.1)'
                }}>
                    <div style={{
                        width: '70%', height: '100%',
                        background: 'rgba(255,255,255,0.3)',
                        borderRadius: '0 0 0 16px',
                        animation: 'progress 12s linear'
                    }} />
                </div>
            </div>

            <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
        </div>
    );
};

export default CommAgentDashboard;
