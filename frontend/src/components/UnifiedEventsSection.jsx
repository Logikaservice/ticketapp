// Componente migliorato per Eventi Unificati
// Da integrare in NetworkMonitoringDashboard.jsx

// 1. NUOVI STATE DA AGGIUNGERE (dopo gli altri useState):
const [eventTypeFilter, setEventTypeFilter] = useState('all'); // all, device, agent
const [severityFilter, setSeverityFilter] = useState('all'); // all, critical, warning, info
const [unifiedEvents, setUnifiedEvents] = useState([]);

// 2. FUNZIONE PER CARICARE EVENTI UNIFICATI (sostituisce loadChanges):
const loadUnifiedEvents = useCallback(async (silent = false) => {
    try {
        const searchParam = changesSearchTerm ? `&search=${encodeURIComponent(changesSearchTerm)}` : '';
        const aziendaParam = changesCompanyFilter ? `&azienda_id=${changesCompanyFilter}` : '';
        const eventTypeParam = eventTypeFilter !== 'all' ? `&event_type=${eventTypeFilter}` : '';
        const severityParam = severityFilter !== 'all' ? `&severity=${severityFilter}` : '';

        const response = await fetch(
            buildApiUrl(`/api/network-monitoring/all/events?limit=500&count24h=true${searchParam}${aziendaParam}${eventTypeParam}${severityParam}`),
            { headers: getAuthHeader() }
        );

        if (!response.ok) {
            throw new Error('Errore caricamento eventi');
        }

        const data = await response.json();
        if (Array.isArray(data)) {
            setUnifiedEvents(data);
        } else {
            setUnifiedEvents(data.events || []);
            if (data.count24h !== undefined) {
                setRecentChangesCount(data.count24h);
            }
        }
    } catch (err) {
        if (!silent) {
            console.error('Errore caricamento eventi:', err);
        }
    }
}, [getAuthHeader, changesSearchTerm, changesCompanyFilter, eventTypeFilter, severityFilter]);

// 3. COMPONENTE BADGE MIGLIORATO PER EVENTI:
const EventBadge = ({ event }) => {
    const { event_category, event_type, severity, is_new_device } = event;

    // Configurazione badge per eventi dispositivi
    const deviceBadges = {
        new_device: {
            icon: '🆕',
            label: 'Nuovo Dispositivo',
            bg: 'bg-green-100',
            text: 'text-green-800',
            border: 'border-green-300'
        },
        device_online: {
            icon: '🔵',
            label: is_new_device ? 'Nuovo' : 'Riconnesso',
            bg: is_new_device ? 'bg-green-100' : 'bg-blue-100',
            text: is_new_device ? 'text-green-800' : 'text-blue-800',
            border: is_new_device ? 'border-green-300' : 'border-blue-300'
        },
        device_offline: {
            icon: '🔴',
            label: 'Offline',
            bg: 'bg-red-100',
            text: 'text-red-800',
            border: 'border-red-300'
        },
        ip_changed: {
            icon: '🟠',
            label: 'IP Cambiato',
            bg: 'bg-orange-100',
            text: 'text-orange-800',
            border: 'border-orange-300'
        },
        mac_changed: {
            icon: '🟠',
            label: 'MAC Cambiato',
            bg: 'bg-orange-100',
            text: 'text-orange-800',
            border: 'border-orange-300'
        },
        hostname_changed: {
            icon: '🟡',
            label: 'Hostname Cambiato',
            bg: 'bg-yellow-100',
            text: 'text-yellow-800',
            border: 'border-yellow-300'
        }
    };

    // Configurazione badge per eventi agent
    const agentBadges = {
        offline: {
            icon: '🔴',
            label: 'Agent Offline',
            bg: 'bg-red-100',
            text: 'text-red-800',
            border: 'border-red-300'
        },
        online: {
            icon: '🟢',
            label: 'Agent Online',
            bg: 'bg-green-100',
            text: 'text-green-800',
            border: 'border-green-300'
        },
        reboot: {
            icon: '🟣',
            label: 'Agent Riavviato',
            bg: 'bg-purple-100',
            text: 'text-purple-800',
            border: 'border-purple-300'
        },
        network_issue: {
            icon: '⚠️',
            label: 'Problema Rete',
            bg: 'bg-yellow-100',
            text: 'text-yellow-800',
            border: 'border-yellow-300'
        }
    };

    const badges = event_category === 'agent' ? agentBadges : deviceBadges;
    const badge = badges[event_type] || {
        icon: '❓',
        label: event_type,
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        border: 'border-gray-300'
    };

    return (
        <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border} flex items-center gap-1`}>
                <span>{badge.icon}</span>
                <span>{badge.label}</span>
            </span>
            {severity === 'critical' && (
                <span className="text-red-600 font-bold" title="Critico">!</span>
            )}
        </div>
    );
};

// 4. COMPONENTE SEVERITY INDICATOR:
const SeverityIndicator = ({ severity }) => {
    const config = {
        critical: { icon: '🔴', label: 'Critico', color: 'text-red-600' },
        warning: { icon: '🟠', label: 'Attenzione', color: 'text-orange-600' },
        info: { icon: '🔵', label: 'Info', color: 'text-blue-600' }
    };

    const { icon, label, color } = config[severity] || config.info;

    return (
        <div className={`flex items-center gap-1 ${color}`} title={label}>
            <span>{icon}</span>
        </div>
    );
};

// 5. JSX DELLA NUOVA SEZIONE (sostituisce la sezione "Cambiamenti Rilevati"):
<div className="bg-white rounded-lg shadow">
    <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Eventi di Rete</h2>
            <span className="text-sm text-gray-500">{unifiedEvents.length} totali</span>
        </div>

        {/* Filtri */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Filtro Azienda */}
            <div className="relative">
                <select
                    value={changesCompanyFilter || ''}
                    onChange={(e) => setChangesCompanyFilter(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-2 pr-8 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                    <option value="">Tutte le Aziende</option>
                    {companies.filter(c => c.agents_count > 0).map(c => (
                        <option key={c.id} value={c.id}>{c.azienda}</option>
                    ))}
                </select>
                <Building size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Filtro Tipo Evento */}
            <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
                <option value="all">Tutti gli Eventi</option>
                <option value="device">Solo Dispositivi</option>
                <option value="agent">Solo Agent</option>
            </select>

            {/* Filtro Gravità */}
            <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
                <option value="all">Tutte le Gravità</option>
                <option value="critical">🔴 Critici</option>
                <option value="warning">🟠 Attenzione</option>
                <option value="info">🔵 Info</option>
            </select>

            {/* Barra di ricerca */}
            <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                    type="text"
                    placeholder="Cerca (IP, MAC, hostname, agent...)"
                    value={changesSearchTerm}
                    onChange={(e) => setChangesSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadUnifiedEvents(false)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {changesSearchTerm && (
                    <button
                        onClick={() => { setChangesSearchTerm(''); loadUnifiedEvents(false); }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    </div>

    <div className="p-6">
        {unifiedEvents.length === 0 ? (
            <div className="text-center py-12">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Nessun evento rilevato</p>
                <p className="text-gray-400 text-sm mt-2">Gli eventi di rete verranno visualizzati qui</p>
            </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Gravità</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tipo Evento</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">IP</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">MAC</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Hostname</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Prod.</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Azienda</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Agent</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        {unifiedEvents.slice(0, 50).map((event) => {
                            const isStatic = event.is_static === true;
                            const isAgent = event.event_category === 'agent';
                            return (
                                <tr
                                    key={`${event.event_category}-${event.id}`}
                                    className={`border-b border-gray-100 hover:bg-gray-50 ${isStatic ? 'bg-blue-50 hover:bg-blue-100' : ''
                                        } ${event.severity === 'critical' ? 'bg-red-50' : ''}`}
                                >
                                    <td className="py-3 px-4">
                                        <SeverityIndicator severity={event.severity} />
                                    </td>
                                    <td className="py-3 px-4">
                                        <EventBadge event={event} />
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="text-sm font-medium text-gray-900">
                                            {event.ip_address || (isAgent ? '-' : 'N/A')}
                                            {isStatic && (
                                                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-200 text-blue-800 font-semibold">
                                                    STATICO
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-600 font-mono">
                                        {event.mac_address ? event.mac_address.replace(/-/g, ':') : '-'}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-600">
                                        {event.hostname || '-'}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-600">
                                        <span title={event.keepass_username ? `Utente: ${event.keepass_username}` : ''}>
                                            {event.device_path || event.keepass_title || event.vendor || '-'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-600">
                                        {event.azienda || 'N/A'}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-600">
                                        {event.agent_name || 'Agent'}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-500">
                                        {formatDate(event.detected_at)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {unifiedEvents.length > 50 && (
                    <div className="text-center py-4 text-sm text-gray-500 border-t border-gray-200">
                        Mostrati i primi 50 eventi di {unifiedEvents.length} totali
                    </div>
                )}
            </div>
        )}
    </div>
</div>
