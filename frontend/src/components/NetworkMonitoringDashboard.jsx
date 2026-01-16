// src/components/NetworkMonitoringDashboard.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Wifi, WifiOff, Monitor, Server, Printer, Router, 
  AlertCircle, AlertTriangle, CheckCircle, Clock, RefreshCw, 
  Activity, TrendingUp, TrendingDown, Search,
  Filter, X, Loader, Plus, Download, Server as ServerIcon,
  Trash2, PowerOff, Building, ArrowLeft, ChevronRight, Settings, Edit, Menu,
  CircleAlert, Stethoscope
} from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import CreateAgentModal from './Modals/CreateAgentModal';
import AgentNotifications from './AgentNotifications';

const NetworkMonitoringDashboard = ({ getAuthHeader, socket, initialView = null, onViewReset = null, onClose = null }) => {
  const [devices, setDevices] = useState([]);
  const [changes, setChanges] = useState([]);
  const [recentChangesCount, setRecentChangesCount] = useState(0); // Conteggio cambiamenti ultime 24h dal backend
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, online, offline
  const [sortBy, setSortBy] = useState('last_seen'); // last_seen, ip_address, hostname
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [agents, setAgents] = useState([]);
  const [showAgentsList, setShowAgentsList] = useState(false);
  const [showAgentNotificationsList, setShowAgentNotificationsList] = useState(false);
  const [agentEvents, setAgentEvents] = useState([]);
  const [agentEventsLoading, setAgentEventsLoading] = useState(false);
  const [agentEventsError, setAgentEventsError] = useState(null);
  const [agentEventsFilters, setAgentEventsFilters] = useState({
    azienda: '',
    agentId: '',
    eventType: '',
    unreadOnly: false,
    search: ''
  });
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [companyDevices, setCompanyDevices] = useState([]);
  const [loadingCompanyDevices, setLoadingCompanyDevices] = useState(false);
  const [changesSearchTerm, setChangesSearchTerm] = useState('');
  // selectedStaticIPs non serve più, usiamo is_static dal database

  const [editingAgentId, setEditingAgentId] = useState(null);
  const [editAgentData, setEditAgentData] = useState({
    agent_name: '',
    network_ranges: [],
    scan_interval_minutes: 15
  });
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const networkMenuRef = useRef(null);

  // Chiudi menu quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (networkMenuRef.current && !networkMenuRef.current.contains(event.target)) {
        setShowNetworkMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carica lista agent (definito prima per essere usato in useEffect)
  const loadAgents = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/network-monitoring/agents'), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        throw new Error('Errore caricamento agent');
      }

      const data = await response.json();
      setAgents(data);
    } catch (err) {
      console.error('Errore caricamento agent:', err);
    }
  }, [getAuthHeader]);

  const loadAgentEvents = useCallback(async (opts = {}) => {
    try {
      setAgentEventsLoading(true);
      setAgentEventsError(null);
      const limit = opts.limit || 200;
      const unreadOnly = opts.unreadOnly === true;

      const url = new URL(buildApiUrl('/api/network-monitoring/agent-events'));
      url.searchParams.set('limit', String(limit));
      if (unreadOnly) url.searchParams.set('unread_only', 'true');

      const response = await fetch(url.toString(), {
        headers: getAuthHeader()
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Errore caricamento notifiche agent' }));
        throw new Error(errorData.error || 'Errore caricamento notifiche agent');
      }
      const data = await response.json();
      setAgentEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Errore caricamento notifiche agent:', err);
      setAgentEventsError(err.message || 'Errore caricamento notifiche agent');
    } finally {
      setAgentEventsLoading(false);
    }
  }, [getAuthHeader]);

  const markAgentEventAsRead = useCallback(async (eventId) => {
    try {
      const response = await fetch(buildApiUrl(`/api/network-monitoring/agent-events/${eventId}/read`), {
        method: 'POST',
        headers: getAuthHeader()
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Errore marcatura notifica' }));
        throw new Error(errorData.error || 'Errore marcatura notifica');
      }
      // Aggiorna localmente (evita un refetch completo)
      setAgentEvents(prev => prev.map(e => (e.id === eventId ? { ...e, is_read: true } : e)));
      try {
        window.dispatchEvent(new CustomEvent('agent-notifications-updated'));
      } catch { }
    } catch (err) {
      console.error('Errore marcatura notifica come letta:', err);
      alert(`Errore marcatura notifica: ${err.message}`);
    }
  }, [getAuthHeader]);

  const clearAllAgentNotifications = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/network-monitoring/agent-events/clear'), {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Errore cancellazione notifiche' }));
        throw new Error(errorData.error || 'Errore cancellazione notifiche');
      }
      // Non svuotare lo storico: marca come lette localmente
      setAgentEvents(prev => (prev || []).map(e => ({ ...e, is_read: true })));
      try {
        window.dispatchEvent(new CustomEvent('agent-notifications-updated'));
      } catch { }
    } catch (err) {
      console.error('Errore cancellazione notifiche agent:', err);
      alert(`Errore cancellazione notifiche: ${err.message}`);
    }
  }, [getAuthHeader]);

  const safeParseEventData = (event) => {
    try {
      const raw = event?.event_data;
      if (!raw) return {};
      if (typeof raw === 'string') return JSON.parse(raw);
      return raw;
    } catch {
      return {};
    }
  };

  const getAgentEventLabel = (event) => {
    const data = safeParseEventData(event);
    const agentLabel = event?.agent_name || `Agent #${event?.agent_id || ''}`;
    switch (event?.event_type) {
      case 'offline': {
        const mins = data.offline_duration_minutes;
        return `Agent ${agentLabel} offline${mins ? ` (da ${mins} min)` : ''}`;
      }
      case 'online': {
        const mins = data.offline_duration_minutes;
        return `Agent ${agentLabel} tornato online${mins ? ` (era offline da ${mins} min)` : ''}`;
      }
      case 'reboot': {
        const uptime = data.system_uptime_minutes || data.system_uptime;
        return `Agent ${agentLabel} riavviato${uptime ? ` (uptime: ${uptime} min)` : ''}`;
      }
      case 'network_issue': {
        const mins = data.issue_duration_minutes || data.network_issue_duration;
        return `Agent ${agentLabel} - problema rete${mins ? ` (durata: ${mins} min)` : ''}`;
      }
      default:
        return `Evento ${event?.event_type || 'sconosciuto'} per ${agentLabel}`;
    }
  };

  // Gestisci initialView dal menu
  useEffect(() => {
    if (initialView === 'agents') {
      setShowAgentsList(true);
      loadAgents();
      // Reset dopo un breve delay per permettere al componente di renderizzare
      if (onViewReset) {
        setTimeout(() => onViewReset(), 100);
      }
    } else if (initialView === 'create') {
      setShowCreateAgentModal(true);
      // Reset dopo un breve delay per permettere al componente di renderizzare
      if (onViewReset) {
        setTimeout(() => onViewReset(), 100);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialView]);

  // Carica dispositivi
  const loadDevices = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(buildApiUrl('/api/network-monitoring/all/devices'), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        throw new Error('Errore caricamento dispositivi');
      }

      const data = await response.json();
      setDevices(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Errore caricamento dispositivi:', err);
      if (!silent) {
        setError(err.message);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [getAuthHeader]);

  // Carica cambiamenti
  const loadChanges = useCallback(async (silent = false) => {
    try {
      const searchParam = changesSearchTerm ? `&search=${encodeURIComponent(changesSearchTerm)}` : '';
      // Richiedi anche il conteggio delle ultime 24 ore
      const response = await fetch(buildApiUrl(`/api/network-monitoring/all/changes?limit=500&count24h=true${searchParam}`), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        throw new Error('Errore caricamento cambiamenti');
      }

      const data = await response.json();
      // Gestisci sia formato vecchio (array) che nuovo (oggetto con count24h)
      if (Array.isArray(data)) {
        setChanges(data);
      } else {
        setChanges(data.changes || []);
        // Salva il conteggio delle ultime 24 ore se disponibile
        if (data.count24h !== undefined) {
          setRecentChangesCount(data.count24h);
        }
      }
    } catch (err) {
      if (!silent) {
        console.error('Errore caricamento cambiamenti:', err);
      }
    }
  }, [getAuthHeader, changesSearchTerm]);

  // Carica lista aziende
  const loadCompanies = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/network-monitoring/companies'), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        throw new Error('Errore caricamento aziende');
      }

      const data = await response.json();
      setCompanies(data);
    } catch (err) {
      console.error('Errore caricamento aziende:', err);
    }
  }, [getAuthHeader]);


  // Apri modal modifica agent
  const handleEditAgent = (agent) => {
    setEditAgentData({
      agent_name: agent.agent_name || '',
      network_ranges: agent.network_ranges || [],
      scan_interval_minutes: agent.scan_interval_minutes || 15
    });
    setEditingAgentId(agent.id);
  };

  // Chiudi modal modifica agent
  const handleCancelEditAgent = () => {
    setEditingAgentId(null);
    setEditAgentData({
      agent_name: '',
      network_ranges: [],
      scan_interval_minutes: 15
    });
  };

  // Salva modifiche agent
  const handleSaveAgent = useCallback(async () => {
    if (!editingAgentId) return;

    try {
      setError(null);
      const response = await fetch(buildApiUrl(`/api/network-monitoring/agent/${editingAgentId}`), {
        method: 'PUT',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editAgentData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore aggiornamento agent');
      }

      const result = await response.json();
      alert(`✅ ${result.message || 'Configurazione agent aggiornata con successo. Le modifiche saranno applicate al prossimo heartbeat dell\'agent.'}`);
      
      handleCancelEditAgent();
      loadAgents(); // Ricarica lista agent
    } catch (err) {
      console.error('Errore aggiornamento agent:', err);
      setError(err.message);
    }
  }, [editingAgentId, editAgentData, getAuthHeader, loadAgents]);

  // Carica dispositivi per un'azienda specifica
  const loadCompanyDevices = useCallback(async (aziendaId) => {
    try {
      setLoadingCompanyDevices(true);
      const response = await fetch(buildApiUrl(`/api/network-monitoring/clients/${aziendaId}/devices`), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        throw new Error('Errore caricamento dispositivi azienda');
      }

      const data = await response.json();
      setCompanyDevices(data);
    } catch (err) {
      console.error('Errore caricamento dispositivi azienda:', err);
      setError(err.message);
    } finally {
      setLoadingCompanyDevices(false);
    }
  }, [getAuthHeader]);

  // Aggiorna dati da Keepass e ricarica tutto
  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Prima aggiorna i dati da Keepass
      console.log('🔄 Aggiornamento dati da Keepass...');
      const keepassResponse = await fetch(buildApiUrl('/api/network-monitoring/refresh-keepass-data'), {
        method: 'POST',
        headers: getAuthHeader()
      });

      if (keepassResponse.ok) {
        const keepassResult = await keepassResponse.json();
        console.log('✅ Keepass aggiornato:', keepassResult);
        if (keepassResult.updated > 0) {
          // Mostra messaggio solo se ci sono stati aggiornamenti
          console.log(`✅ ${keepassResult.message}`);
        }
      } else {
        console.warn('⚠️ Errore aggiornamento Keepass (continuo comunque con il refresh)...');
      }

      // Poi ricarica tutti i dati
      await Promise.all([
        loadDevices(),
        loadChanges(),
        selectedCompanyId ? loadCompanyDevices(selectedCompanyId) : Promise.resolve()
      ]);
    } catch (err) {
      console.error('Errore durante il refresh:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, loadDevices, loadChanges, loadCompanyDevices, selectedCompanyId]);

  // Disabilita agent (blocca ricezione dati, ma NON disinstalla)
  const disableAgent = useCallback(async (agentId, agentName) => {
    if (!confirm(`Vuoi disabilitare l'agent "${agentName}"?\n\nL'agent smetterà di inviare dati al server, ma rimarrà installato sul client. Potrai riabilitarlo in futuro.`)) {
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`/api/network-monitoring/agent/${agentId}/disable`), {
        method: 'PUT',
        headers: getAuthHeader()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore disabilitazione agent');
      }

      alert('Agent disabilitato con successo. I dati non verranno più accettati, ma l\'agent rimane installato sul client.');
      loadAgents(); // Ricarica lista
    } catch (err) {
      console.error('Errore disabilitazione agent:', err);
      alert(`Errore disabilitazione agent: ${err.message}`);
    }
  }, [getAuthHeader, loadAgents]);

  // Elimina agent (disinstalla dal client, ma mantiene i dati nel database)
  const deleteAgent = useCallback(async (agentId, agentName) => {
    if (!confirm(`Vuoi eliminare l'agent "${agentName}"?\n\nL'agent verrà disinstallato dal client, ma tutti i dati verranno mantenuti nel database (per i ticket associati).`)) {
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`/api/network-monitoring/agent/${agentId}`), {
        method: 'DELETE',
        headers: getAuthHeader()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore eliminazione agent');
      }

      alert('Agent eliminato con successo. I dati sono stati mantenuti. L\'agent si disinstallerà automaticamente dal client al prossimo heartbeat.');
      loadAgents(); // Ricarica lista
    } catch (err) {
      console.error('Errore eliminazione agent:', err);
      alert(`Errore eliminazione agent: ${err.message}`);
    }
  }, [getAuthHeader, loadAgents]);

  // Scarica pacchetto completo agent (ZIP con tutti i file)
  const downloadAgentPackage = async (agentId, agentName) => {
    try {
      const response = await fetch(buildApiUrl(`/api/network-monitoring/agent/${agentId}/download`), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Errore download pacchetto' }));
        throw new Error(errorData.error || 'Errore download pacchetto');
      }

      // Download ZIP
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NetworkMonitor-Agent-${agentName.replace(/\s+/g, '-')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Errore download pacchetto:', err);
      alert('Errore scaricamento pacchetto: ' + err.message);
    }
  };

  // Apri diagnostica agent
  const showAgentDiagnostics = async (agentId, agentName) => {
    try {
      const response = await fetch(buildApiUrl(`/api/network-monitoring/agent/${agentId}/diagnostics`), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Errore caricamento diagnostica' }));
        throw new Error(errorData.error || 'Errore caricamento diagnostica');
      }

      const diagnostics = await response.json();
      
      // Formatta i dati per la visualizzazione
      const formatDiagnostics = (diag) => {
        let message = `🔍 DIAGNOSTICA AGENT: ${diag.agent.name}\n\n`;
        message += `📊 STATO AGENT:\n`;
        message += `  • ID: ${diag.agent.id}\n`;
        message += `  • Status: ${diag.agent.status}\n`;
        message += `  • Versione: ${diag.agent.version || 'N/A'}\n`;
        message += `  • Abilitato: ${diag.agent.enabled ? 'Sì' : 'No'}\n`;
        message += `  • Eliminato: ${diag.agent.deleted ? 'Sì' : 'No'}\n`;
        message += `  • Reti: ${(diag.agent.network_ranges || []).join(', ') || 'Nessuna'}\n`;
        message += `  • Intervallo: ${diag.agent.scan_interval_minutes || 15} minuti\n\n`;
        
        message += `💓 HEARTBEAT:\n`;
        message += `  • Ultimo heartbeat: ${diag.heartbeat.last_heartbeat ? new Date(diag.heartbeat.last_heartbeat).toLocaleString('it-IT') : 'Mai'}\n`;
        message += `  • Minuti fa: ${diag.heartbeat.minutes_ago !== null ? diag.heartbeat.minutes_ago : 'N/A'}\n`;
        message += `  • Scaduto: ${diag.heartbeat.is_stale ? 'Sì (>8 min)' : 'No'}\n`;
        message += `  • Intervallo atteso: ${diag.heartbeat.expected_interval_minutes} minuti\n\n`;
        
        if (diag.events.unresolved_offline_count > 0) {
          message += `⚠️ EVENTI OFFLINE NON RISOLTI: ${diag.events.unresolved_offline_count}\n`;
          diag.events.unresolved_offline_events.forEach((ev, idx) => {
            message += `  ${idx + 1}. Rilevato: ${new Date(ev.detected_at).toLocaleString('it-IT')}\n`;
          });
          message += `\n`;
        }
        
        message += `🔬 ANALISI:\n`;
        message += `  • Dovrebbe essere offline: ${diag.analysis.should_be_offline ? 'Sì' : 'No'}\n`;
        message += `  • Motivo: ${diag.analysis.reason}\n\n`;
        message += `💡 RACCOMANDAZIONE:\n  ${diag.analysis.recommendation}`;
        
        return message;
      };

      const formattedMessage = formatDiagnostics(diagnostics);
      alert(formattedMessage);
    } catch (err) {
      console.error('Errore diagnostica agent:', err);
      alert('Errore caricamento diagnostica: ' + err.message);
    }
  };

  // Carica dati iniziali
  useEffect(() => {
    loadDevices();
    loadChanges();
    loadAgents();
    loadCompanies();
  }, [loadDevices, loadChanges, loadAgents, loadCompanies]);

  // Auto-refresh ogni 30 secondi - DISABILITATO se il modal di creazione è aperto
  useEffect(() => {
    if (!autoRefresh || showCreateAgentModal) return; // Non aggiornare se il modal è aperto

    const interval = setInterval(() => {
      // Usa modalità "silent" per evitare flicker durante auto-refresh
      loadDevices(true);
      loadChanges(true);
      // Se un'azienda è selezionata, ricarica anche i dispositivi dell'azienda (già silenzioso)
      if (selectedCompanyId) {
        loadCompanyDevices(selectedCompanyId);
      }
    }, 30000); // 30 secondi

    return () => clearInterval(interval);
  }, [autoRefresh, loadDevices, loadChanges, loadCompanyDevices, selectedCompanyId, showCreateAgentModal]);

  // Ascolta eventi WebSocket per aggiornamenti real-time - DISABILITATO se il modal di creazione è aperto
  useEffect(() => {
    if (!socket || showCreateAgentModal) return; // Non aggiornare se il modal è aperto

    const handleNetworkUpdate = (data) => {
      console.log('📡 Network monitoring update ricevuto:', data);
      
      // Ricarica dati quando arriva un aggiornamento SOLO se il modal non è aperto
      // Usa modalità "silent" per evitare flicker (gli aggiornamenti WebSocket sono già real-time)
      if (!showCreateAgentModal) {
        loadDevices(true);
        loadChanges(true);
        
        // Se l'evento riguarda un cambio di status dell'agent, ricarica anche la lista agenti
        if (data && data.type === 'agent-status-changed') {
          loadAgents();
        }
        
        // Se un'azienda è selezionata, ricarica anche i dispositivi dell'azienda (già silenzioso)
        if (selectedCompanyId) {
          loadCompanyDevices(selectedCompanyId);
        }
      }
    };

    const handleAgentEvent = (data) => {
      console.log('🔔 Agent event ricevuto:', data);
      
      // Quando arriva un evento agent (offline, online, reboot, network_issue)
      // ricarica la lista agenti per aggiornare lo status in tempo reale
      if (!showCreateAgentModal) {
        loadAgents();
      }
    };

    socket.on('network-monitoring-update', handleNetworkUpdate);
    socket.on('agent-event', handleAgentEvent);

    return () => {
      socket.off('network-monitoring-update', handleNetworkUpdate);
      socket.off('agent-event', handleAgentEvent);
    };
  }, [socket, loadDevices, loadChanges, loadCompanyDevices, loadAgents, selectedCompanyId, showCreateAgentModal]);

  // Ricarica cambiamenti quando cambia il termine di ricerca (con debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadChanges();
    }, 300); // Debounce di 300ms

    return () => clearTimeout(timeoutId);
  }, [changesSearchTerm, loadChanges]);

  // Icona dispositivo per tipo
  const getDeviceIcon = (deviceType) => {
    switch (deviceType?.toLowerCase()) {
      case 'server': return <Server className="w-5 h-5" />;
      case 'router': return <Router className="w-5 h-5" />;
      case 'printer': return <Printer className="w-5 h-5" />;
      case 'workstation': return <Monitor className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  // Badge status
  const StatusBadge = ({ status }) => {
    if (status === 'online') {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 flex items-center gap-1">
          <CheckCircle size={12} />
          Online
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 flex items-center gap-1">
        <WifiOff size={12} />
        Offline
      </span>
    );
  };

  // Badge tipo cambiamento
  const ChangeTypeBadge = ({ changeType }) => {
    const badges = {
      'new_device': { label: 'Nuovo', color: 'bg-blue-100 text-blue-800' },
      'device_offline': { label: 'Offline', color: 'bg-red-100 text-red-800' },
      'device_online': { label: 'Online', color: 'bg-green-100 text-green-800' },
      'ip_changed': { label: 'IP Cambiato', color: 'bg-yellow-100 text-yellow-800' },
      'mac_changed': { label: 'MAC Cambiato', color: 'bg-orange-100 text-orange-800' },
      'hostname_changed': { label: 'Hostname Cambiato', color: 'bg-purple-100 text-purple-800' },
    };

    const badge = badges[changeType] || { label: changeType, color: 'bg-gray-100 text-gray-800' };

    return (
      <span className={`px-2 py-1 text-xs rounded-full ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  // Formatta data
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Appena ora';
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffHours < 24) return `${diffHours} ore fa`;
    if (diffDays < 7) return `${diffDays} giorni fa`;
    
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filtra e ordina dispositivi
  const filteredDevices = devices
    .filter(device => {
      // Filtro ricerca
      const matchesSearch = !searchTerm || 
        device.ip_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.hostname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.mac_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.azienda?.toLowerCase().includes(searchTerm.toLowerCase());

      // Filtro status
      const matchesStatus = filterStatus === 'all' || device.status === filterStatus;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'ip_address':
          return a.ip_address?.localeCompare(b.ip_address || '');
        case 'hostname':
          return (a.hostname || '').localeCompare(b.hostname || '');
        case 'last_seen':
        default:
          return new Date(b.last_seen || 0) - new Date(a.last_seen || 0);
      }
    });

  // Statistiche
  // Se un'azienda è selezionata, usa companyDevices (se disponibili), altrimenti usa devices
  // Usa companyDevices solo se selectedCompanyId è impostato E companyDevices ha elementi
  const devicesForStats = (selectedCompanyId && companyDevices.length > 0) ? companyDevices : devices;
  const stats = {
    total: devicesForStats.length,
    online: devicesForStats.filter(d => d.status === 'online').length,
    offline: devicesForStats.filter(d => d.status === 'offline').length,
    // Usa il conteggio dal backend se disponibile, altrimenti calcola lato frontend
    recentChanges: recentChangesCount > 0 ? recentChangesCount : changes.filter(c => {
      const changeDate = new Date(c.detected_at);
      const hoursAgo = (Date.now() - changeDate.getTime()) / 3600000;
      return hoursAgo < 24;
    }).length,
    agentsTotal: agents.length,
    agentsOnline: agents.filter(a => a.status === 'online').length,
    agentsOffline: agents.filter(a => a.status === 'offline').length
  };

  if (loading && devices.length === 0) {
    return (
      <div className="fixed inset-0 bg-gray-100 z-50 overflow-y-auto">
        <div className="p-8 flex items-center justify-center min-h-screen">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Caricamento dispositivi...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-100 z-50 overflow-y-auto">
      {/* Header Navigazione */}
      {onClose && (
        <div className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X size={24} className="text-gray-600" />
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <h1 className="font-bold text-xl text-gray-800">Monitoraggio Rete</h1>
          </div>
        </div>
      )}
      <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Menu hamburger */}
          <div className="relative" ref={networkMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNetworkMenu(!showNetworkMenu)}
              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              title="Menu Monitoraggio Rete"
            >
              <Menu size={24} />
            </button>
            
            {/* Dropdown menu - posizionato sotto il pulsante */}
            {showNetworkMenu && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50" style={{ position: 'absolute' }}>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowAgentsList(true);
                      setShowAgentNotificationsList(false);
                      loadAgents();
                      setShowNetworkMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <ServerIcon size={18} className="text-cyan-600" />
                    Agent Esistenti
                  </button>
                  <button
                    onClick={() => {
                      setShowAgentNotificationsList(true);
                      setShowAgentsList(false);
                      setShowNetworkMenu(false);
                      // Carica dati necessari
                      loadAgents();
                      loadAgentEvents({ limit: 200, unreadOnly: false });
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <AlertTriangle size={18} className="text-yellow-600" />
                    Notifiche Agent
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateAgentModal(true);
                      setShowAgentNotificationsList(false);
                      setShowNetworkMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Plus size={18} className="text-cyan-600" />
                    Crea Agent
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Notifiche Agent */}
          {getAuthHeader && socket && (
            <AgentNotifications
              getAuthHeader={getAuthHeader}
              socket={socket}
              onOpenNetworkMonitoring={null}
            />
          )}
          
          {!onClose && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Wifi className="w-8 h-8 text-blue-600" />
                Monitoraggio Rete
              </h1>
              <p className="text-gray-500 mt-1">
                {lastUpdate && `Ultimo aggiornamento: ${formatDate(lastUpdate)}`}
              </p>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Dropdown selezione azienda */}
          <div className="relative">
            <select
              value={selectedCompanyId || ''}
              onChange={(e) => {
                const companyId = e.target.value ? parseInt(e.target.value) : null;
                setSelectedCompanyId(companyId);
                if (companyId) {
                  loadCompanyDevices(companyId);
                } else {
                  setCompanyDevices([]);
                }
              }}
              className="px-4 py-2 pr-8 bg-white border border-gray-300 rounded-lg text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer min-w-[200px]"
            >
              <option value="">Tutte le Aziende</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.azienda}
                </option>
              ))}
            </select>
            <Building 
              size={18} 
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" 
            />
          </div>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              autoRefresh 
                ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Activity size={18} />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
          
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            disabled={loading}
            title="Aggiorna dati da Keepass e ricarica dispositivi"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Aggiorna
          </button>
          
          {/* Versione agent più recente */}
          {agents.length > 0 && (() => {
            // Trova l'agent con la versione più recente (per updated_at)
            const latestAgent = agents.reduce((latest, agent) => {
              if (!latest) return agent;
              const latestDate = latest.updated_at ? new Date(latest.updated_at) : new Date(0);
              const agentDate = agent.updated_at ? new Date(agent.updated_at) : new Date(0);
              return agentDate > latestDate ? agent : latest;
            }, null);
            
            if (latestAgent && latestAgent.version) {
              return (
                <div className="px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center gap-2 min-w-[140px]">
                  <span className="text-xs text-gray-500">Versione:</span>
                  <span className="font-mono font-semibold text-blue-600">{latestAgent.version}</span>
                </div>
              );
            }
            return null;
          })()}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <AlertCircle className="w-5 h-5 inline mr-2" />
          {error}
        </div>
      )}

{/* Lista Agent Esistenti */}
      {showAgentsList && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ServerIcon size={24} className="text-purple-600" />
              Agent Registrati
            </h2>
            <button
              onClick={() => setShowAgentsList(false)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
          
          {agents.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nessun agent registrato</p>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div key={agent.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">{agent.agent_name || `Agent #${agent.id}`}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          agent.status === 'online' ? 'bg-green-100 text-green-800' :
                          agent.status === 'offline' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {agent.status || 'unknown'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600 space-y-1">
                        <p><strong>Azienda:</strong> {agent.azienda || 'N/A'}</p>
                        {editingAgentId === agent.id ? (
                          <div className="space-y-2 mt-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Nome Agent:</label>
                              <input
                                type="text"
                                value={editAgentData.agent_name}
                                onChange={(e) => setEditAgentData({ ...editAgentData, agent_name: e.target.value })}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Nome agent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Reti (una per riga, formato: 192.168.1.0/24):</label>
                              <textarea
                                value={editAgentData.network_ranges.join('\n')}
                                onChange={(e) => {
                                  const ranges = e.target.value.split('\n').filter(r => r.trim());
                                  setEditAgentData({ ...editAgentData, network_ranges: ranges });
                                }}
                                rows={3}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                                placeholder="192.168.1.0/24&#10;10.0.0.0/16"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Intervallo Scansione (minuti):</label>
                              <input
                                type="number"
                                min="1"
                                max="1440"
                                value={editAgentData.scan_interval_minutes}
                                onChange={(e) => setEditAgentData({ ...editAgentData, scan_interval_minutes: parseInt(e.target.value) || 15 })}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <p><strong>Versione:</strong> <span className="font-mono text-blue-600 font-semibold">{agent.version || 'N/A'}</span></p>
                            <p><strong>Reti:</strong> {(agent.network_ranges || []).join(', ') || 'Nessuna'}</p>
                            <p><strong>Intervallo:</strong> {agent.scan_interval_minutes || 15} minuti</p>
                            <p><strong>Ultimo heartbeat:</strong> {agent.last_heartbeat ? formatDate(new Date(agent.last_heartbeat)) : 'Mai'}</p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex flex-col gap-2">
                      {editingAgentId === agent.id ? (
                        <>
                          <button
                            onClick={handleSaveAgent}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                          >
                            <CheckCircle size={18} />
                            Salva
                          </button>
                          <button
                            onClick={handleCancelEditAgent}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
                          >
                            <X size={18} />
                            Annulla
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditAgent(agent)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                            title="Modifica configurazione agent (nome, reti, intervallo scansione)"
                          >
                            <Edit size={18} />
                            Modifica
                          </button>
                          <button
                            onClick={() => showAgentDiagnostics(agent.id, agent.agent_name)}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                            title="Mostra diagnostica agent (heartbeat, eventi, analisi)"
                          >
                            <Stethoscope size={18} />
                            Diagnostica
                          </button>
                          <button
                            onClick={() => downloadAgentPackage(agent.id, agent.agent_name)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                            title="Scarica pacchetto completo (ZIP con config.json, NetworkMonitor.ps1, InstallerCompleto.ps1)"
                          >
                            <Download size={18} />
                            Scarica Pacchetto
                          </button>
                          <button
                            onClick={() => disableAgent(agent.id, agent.agent_name)}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
                            title="Disabilita agent (disinstallazione remota al prossimo heartbeat)"
                          >
                            <PowerOff size={18} />
                            Disabilita
                          </button>
                          <button
                            onClick={() => deleteAgent(agent.id, agent.agent_name)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                            title="Elimina agent definitivamente"
                          >
                            <Trash2 size={18} />
                            Elimina
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista Notifiche Agent */}
      {showAgentNotificationsList && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle size={24} className="text-yellow-600" />
              Notifiche Agent
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadAgentEvents({ limit: 200, unreadOnly: false })}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                disabled={agentEventsLoading}
                title="Aggiorna notifiche"
              >
                <RefreshCw size={16} className={agentEventsLoading ? 'animate-spin' : ''} />
                Aggiorna
              </button>
              <button
                onClick={clearAllAgentNotifications}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                title="Segna tutte come lette (lo storico resta)"
              >
                <Trash2 size={16} />
                Segna tutte lette
              </button>
              <button
                onClick={() => setShowAgentNotificationsList(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                title="Chiudi"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Filtri */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <select
              value={agentEventsFilters.azienda}
              onChange={(e) => setAgentEventsFilters(prev => ({ ...prev, azienda: e.target.value }))}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700"
            >
              <option value="">Tutte le aziende</option>
              {companies.map(c => (
                <option key={c.id} value={c.azienda}>{c.azienda}</option>
              ))}
            </select>

            <select
              value={agentEventsFilters.agentId}
              onChange={(e) => setAgentEventsFilters(prev => ({ ...prev, agentId: e.target.value }))}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700"
            >
              <option value="">Tutti gli agent</option>
              {agents.map(a => (
                <option key={a.id} value={String(a.id)}>
                  {a.agent_name || `Agent #${a.id}`}
                </option>
              ))}
            </select>

            <select
              value={agentEventsFilters.eventType}
              onChange={(e) => setAgentEventsFilters(prev => ({ ...prev, eventType: e.target.value }))}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700"
            >
              <option value="">Tutti i tipi</option>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
              <option value="reboot">Riavvio</option>
              <option value="network_issue">Problema rete</option>
            </select>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={agentEventsFilters.unreadOnly}
                  onChange={(e) => setAgentEventsFilters(prev => ({ ...prev, unreadOnly: e.target.checked }))}
                />
                Solo non lette
              </label>
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={agentEventsFilters.search}
                  onChange={(e) => setAgentEventsFilters(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="Cerca..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {agentEventsError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              {agentEventsError}
            </div>
          )}

          {/* Lista */}
          {agentEventsLoading ? (
            <div className="py-8 flex items-center justify-center text-gray-600">
              <Loader className="w-5 h-5 animate-spin mr-2" />
              Caricamento notifiche...
            </div>
          ) : (() => {
            const filtered = (agentEvents || [])
              .filter(ev => {
                if (agentEventsFilters.unreadOnly && ev.is_read) return false;
                if (agentEventsFilters.azienda && (ev.azienda || '') !== agentEventsFilters.azienda) return false;
                if (agentEventsFilters.agentId && String(ev.agent_id) !== String(agentEventsFilters.agentId)) return false;
                if (agentEventsFilters.eventType && ev.event_type !== agentEventsFilters.eventType) return false;

                const q = (agentEventsFilters.search || '').trim().toLowerCase();
                if (!q) return true;
                const hay = [
                  ev.azienda,
                  ev.agent_name,
                  ev.event_type,
                  getAgentEventLabel(ev),
                ].filter(Boolean).join(' ').toLowerCase();
                return hay.includes(q);
              });

            if (filtered.length === 0) {
              return <div className="py-8 text-center text-gray-500">Nessuna notifica</div>;
            }

            return (
              <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                {filtered.map(ev => {
                  const isUnread = !ev.is_read;
                  return (
                    <div
                      key={ev.id}
                      className={`p-4 hover:bg-gray-50 flex items-start justify-between gap-4 ${isUnread ? 'bg-blue-50' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            ev.event_type === 'offline' ? 'bg-red-100 text-red-800' :
                            ev.event_type === 'online' ? 'bg-green-100 text-green-800' :
                            ev.event_type === 'reboot' ? 'bg-blue-100 text-blue-800' :
                            ev.event_type === 'network_issue' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {ev.event_type}
                          </span>
                          {isUnread && <span className="text-xs font-semibold text-blue-700">NON LETTA</span>}
                        </div>
                        <div className="text-sm text-gray-900 font-medium truncate">
                          {getAgentEventLabel(ev)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {ev.detected_at ? formatDate(ev.detected_at) : 'N/A'}
                          {ev.azienda ? ` • ${ev.azienda}` : ''}
                          {ev.agent_name ? ` • ${ev.agent_name}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!ev.is_read && (
                          <button
                            onClick={() => markAgentEventAsRead(ev.id)}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                            title="Segna come letta"
                          >
                            Segna letta
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
            <CheckCircle size={16} className="text-green-600" />
            Online
          </div>
          <div className="text-3xl font-bold text-green-600">{stats.online}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
            <WifiOff size={16} className="text-red-600" />
            Offline
          </div>
          <div className="text-3xl font-bold text-red-600">{stats.offline}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
            <Activity size={16} className="text-blue-600" />
            Cambiamenti (24h)
          </div>
          <div className="text-3xl font-bold text-blue-600">{stats.recentChanges}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
            <ServerIcon size={16} className="text-blue-600" />
            Agent Online
          </div>
          <div className="text-3xl font-bold text-blue-600">{stats.agentsOnline}</div>
          <div className="text-xs text-gray-500 mt-1">di {stats.agentsTotal} totali</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
            <WifiOff size={16} className="text-orange-600" />
            Agent Offline
          </div>
          <div className="text-3xl font-bold text-orange-600">{stats.agentsOffline}</div>
          <div className="text-xs text-gray-500 mt-1">di {stats.agentsTotal} totali</div>
        </div>
      </div>

      {/* Vista Dettaglio Dispositivi Azienda (mostrata solo se un'azienda è selezionata) */}
      {selectedCompanyId && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Building size={24} className="text-purple-600" />
              {companies.find(c => c.id === selectedCompanyId)?.azienda || 'Dispositivi'}
            </h2>
          </div>
          {loadingCompanyDevices ? (
            <div className="p-8 flex items-center justify-center">
              <Loader className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Caricamento dispositivi...</span>
            </div>
          ) : companyDevices.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nessun dispositivo trovato per questa azienda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-12"></th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">IP</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">MAC</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Hostname</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Titolo</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Prod.</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Ultimo Visto</th>
                  </tr>
                </thead>
                <tbody>
                  {companyDevices.map((device) => {
                    const isStatic = device.is_static === true;
                    return (
                      <tr 
                        key={device.id} 
                        className={`border-b border-gray-100 hover:bg-gray-50 ${isStatic ? 'bg-blue-50 hover:bg-blue-100' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isStatic}
                            onChange={async (e) => {
                              const newIsStatic = e.target.checked;
                              try {
                                const response = await fetch(buildApiUrl(`/api/network-monitoring/devices/${device.id}/static`), {
                                  method: 'PATCH',
                                  headers: {
                                    ...getAuthHeader(),
                                    'Content-Type': 'application/json'
                                  },
                                  body: JSON.stringify({ is_static: newIsStatic })
                                });

                                if (!response.ok) {
                                  const errorData = await response.json();
                                  throw new Error(errorData.error || 'Errore aggiornamento stato statico');
                                }

                                // Aggiorna il dispositivo nella lista locale
                                setCompanyDevices(prev => prev.map(d => 
                                  d.id === device.id ? { ...d, is_static: newIsStatic } : d
                                ));
                              } catch (err) {
                                console.error('Errore aggiornamento stato statico:', err);
                                alert(`Errore: ${err.message}`);
                                // Ripristina lo stato precedente
                                e.target.checked = !newIsStatic;
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                            title="IP Statico"
                          />
                        </td>
                        <td className="py-3 px-4 text-sm font-mono text-gray-900">
                          <div className="flex items-center gap-2">
                            {device.has_ping_failures && (
                              <div className="relative group flex items-center">
                                <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                                  <span className="text-white text-xs font-bold leading-none">+</span>
                                </div>
                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                  Disconnessioni rilevate
                                </div>
                              </div>
                            )}
                            {device.previous_ip && (
                              <div className="flex items-center gap-1">
                                <div className="relative group">
                                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                    IP precedente: {device.previous_ip}
                                  </div>
                                </div>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const response = await fetch(buildApiUrl(`/api/network-monitoring/devices/${device.id}/reset-warnings`), {
                                        method: 'PATCH',
                                        headers: {
                                          ...getAuthHeader(),
                                          'Content-Type': 'application/json'
                                        }
                                      });

                                      if (!response.ok) {
                                        const errorData = await response.json();
                                        throw new Error(errorData.error || 'Errore reset warning');
                                      }

                                      // Aggiorna il dispositivo nella lista locale
                                      setCompanyDevices(prev => prev.map(d => 
                                        d.id === device.id ? { ...d, previous_ip: null, previous_mac: null } : d
                                      ));
                                    } catch (err) {
                                      console.error('Errore reset warning:', err);
                                      alert(`Errore: ${err.message}`);
                                    }
                                  }}
                                  className="text-orange-500 hover:text-orange-700 transition-colors"
                                  title="Rimuovi warning"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            <span>{device.ip_address}</span>
                          </div>
                        </td>
                      <td className="py-3 px-4 text-sm font-mono text-gray-600">
                        <div className="flex items-center gap-2">
                          {device.previous_mac && (
                            <div className="flex items-center gap-1">
                              <div className="relative group">
                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                  MAC precedente: {device.previous_mac ? device.previous_mac.replace(/-/g, ':') : '-'}
                                </div>
                              </div>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const response = await fetch(buildApiUrl(`/api/network-monitoring/devices/${device.id}/reset-warnings`), {
                                      method: 'PATCH',
                                      headers: {
                                        ...getAuthHeader(),
                                        'Content-Type': 'application/json'
                                      }
                                    });

                                    if (!response.ok) {
                                      const errorData = await response.json();
                                      throw new Error(errorData.error || 'Errore reset warning');
                                    }

                                    // Aggiorna il dispositivo nella lista locale
                                    setCompanyDevices(prev => prev.map(d => 
                                      d.id === device.id ? { ...d, previous_ip: null, previous_mac: null } : d
                                    ));
                                  } catch (err) {
                                    console.error('Errore reset warning:', err);
                                    alert(`Errore: ${err.message}`);
                                  }
                                }}
                                className="text-orange-500 hover:text-orange-700 transition-colors"
                                title="Rimuovi warning"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <span>{device.mac_address ? device.mac_address.replace(/-/g, ':') : '-'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">{device.hostname || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{device.device_type || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{device.device_path || '-'}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={device.status} />
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">{formatDate(device.last_seen)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sezione cambiamenti recenti - PRIORITARIA */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Cambiamenti Rilevati</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Cerca (IP, MAC, hostname, azienda...)"
                value={changesSearchTerm}
                onChange={(e) => {
                  setChangesSearchTerm(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    loadChanges();
                  }
                }}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
              {changesSearchTerm && (
                <button
                  onClick={() => {
                    setChangesSearchTerm('');
                    loadChanges();
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <span className="text-sm text-gray-500">{changes.length} totali</span>
          </div>
        </div>
        <div className="p-6">
          {changes.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Nessun cambiamento rilevato</p>
              <p className="text-gray-400 text-sm mt-2">I cambiamenti di rete verranno visualizzati qui</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tipo</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">IP</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">MAC</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Hostname</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Azienda</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Agente</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.slice(0, 50).map((change) => {
                    const isStatic = change.is_static === true;
                    return (
                      <tr 
                        key={change.id} 
                        className={`border-b border-gray-100 hover:bg-gray-50 ${isStatic ? 'bg-blue-50 hover:bg-blue-100' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <ChangeTypeBadge changeType={change.change_type} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm font-medium text-gray-900">
                            {change.ip_address}
                            {isStatic && (
                              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-200 text-blue-800 font-semibold">
                                STATICO
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 font-mono">
                          {change.mac_address ? change.mac_address.replace(/-/g, ':') : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {change.hostname || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {change.azienda || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {change.agent_name || 'Agent'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {formatDate(change.detected_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {changes.length > 50 && (
                <div className="text-center py-4 text-sm text-gray-500 border-t border-gray-200">
                  Mostrati i primi 50 cambiamenti di {changes.length} totali
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal creazione agent - NON aggiornare dati durante creazione */}
      {showCreateAgentModal && (
        <CreateAgentModal
          key="create-agent-modal"
          isOpen={showCreateAgentModal}
          setShowCreateAgentModal={setShowCreateAgentModal}
          onClose={(shouldRefresh = false) => {
            // Ricarica dati SOLO quando il modal viene chiuso esplicitamente
            if (shouldRefresh) {
              setTimeout(() => {
                loadDevices();
                loadChanges();
                loadAgents();
                // opzionale: aggiorna lista aziende (se UI mostra conteggi o dropdown dipende dal backend)
                loadCompanies();
              }, 200);
            }
          }}
          onAgentCreated={(agent) => {
            // Aggiorna subito lista agent: evita che l'utente debba fare refresh pagina
            console.log('✅ Agent creato con successo:', agent);
            loadAgents();
            loadCompanies();
          }}
          getAuthHeader={getAuthHeader}
        />
      )}
      </div>
    </div>
  );
};

export default NetworkMonitoringDashboard;
