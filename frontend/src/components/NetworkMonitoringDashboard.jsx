// src/components/NetworkMonitoringDashboard.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wifi, WifiOff, Monitor, Server, Printer, Router, 
  AlertCircle, CheckCircle, Clock, RefreshCw, 
  Activity, TrendingUp, TrendingDown, Search,
  Filter, X, Loader, Plus, Download, Server as ServerIcon,
  Trash2, PowerOff, Building, ArrowLeft, ChevronRight
} from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import CreateAgentModal from './Modals/CreateAgentModal';

const NetworkMonitoringDashboard = ({ getAuthHeader, socket, initialView = null, onViewReset = null }) => {
  const [devices, setDevices] = useState([]);
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, online, offline
  const [sortBy, setSortBy] = useState('last_seen'); // last_seen, ip_address, hostname
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [agents, setAgents] = useState([]);
  const [showAgentsList, setShowAgentsList] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [companyDevices, setCompanyDevices] = useState([]);
  const [loadingCompanyDevices, setLoadingCompanyDevices] = useState(false);

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
  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  // Carica cambiamenti
  const loadChanges = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/network-monitoring/all/changes?limit=100'), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        throw new Error('Errore caricamento cambiamenti');
      }

      const data = await response.json();
      setChanges(data);
    } catch (err) {
      console.error('Errore caricamento cambiamenti:', err);
    }
  }, [getAuthHeader]);

  // Carica lista agent
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
      loadDevices();
      loadChanges();
    }, 30000); // 30 secondi

    return () => clearInterval(interval);
  }, [autoRefresh, loadDevices, loadChanges, showCreateAgentModal]);

  // Ascolta eventi WebSocket per aggiornamenti real-time - DISABILITATO se il modal di creazione è aperto
  useEffect(() => {
    if (!socket || showCreateAgentModal) return; // Non aggiornare se il modal è aperto

    const handleNetworkUpdate = (data) => {
      console.log('📡 Network monitoring update ricevuto:', data);
      
      // Ricarica dati quando arriva un aggiornamento SOLO se il modal non è aperto
      if (!showCreateAgentModal) {
        loadDevices();
        loadChanges();
      }
    };

    socket.on('network-monitoring-update', handleNetworkUpdate);

    return () => {
      socket.off('network-monitoring-update', handleNetworkUpdate);
    };
  }, [socket, loadDevices, loadChanges, showCreateAgentModal]);

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
      'vendor_changed': { label: 'Vendor Cambiato', color: 'bg-indigo-100 text-indigo-800' }
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
        device.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    recentChanges: changes.filter(c => {
      const changeDate = new Date(c.detected_at);
      const hoursAgo = (Date.now() - changeDate.getTime()) / 3600000;
      return hoursAgo < 24;
    }).length
  };

  if (loading && devices.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Caricamento dispositivi...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Wifi className="w-8 h-8 text-blue-600" />
            Monitoraggio Rete
          </h1>
          <p className="text-gray-500 mt-1">
            {lastUpdate && `Ultimo aggiornamento: ${formatDate(lastUpdate)}`}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
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
            onClick={() => {
              loadDevices();
              loadChanges();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Aggiorna
          </button>
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
                        <p><strong>Reti:</strong> {(agent.network_ranges || []).join(', ') || 'Nessuna'}</p>
                        <p><strong>Intervallo:</strong> {agent.scan_interval_minutes || 15} minuti</p>
                        <p><strong>Ultimo heartbeat:</strong> {agent.last_heartbeat ? formatDate(new Date(agent.last_heartbeat)) : 'Mai'}</p>
                      </div>
                    </div>
                    <div className="ml-4 flex flex-col gap-2">
                      <button
                        onClick={() => downloadAgentPackage(agent.id, agent.agent_name)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
      </div>

      {/* Vista Dettaglio Dispositivi Azienda (mostrata solo se un'azienda è selezionata) */}
      {selectedCompanyId && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedCompanyId(null);
                  setCompanyDevices([]);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Building size={24} className="text-purple-600" />
                {companies.find(c => c.id === selectedCompanyId)?.azienda || 'Dispositivi'}
              </h2>
            </div>
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
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">IP</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">MAC</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Hostname</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Vendor</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tipo</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Ultimo Visto</th>
                  </tr>
                </thead>
                <tbody>
                  {companyDevices.map((device) => (
                    <tr key={device.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-mono text-gray-900">{device.ip_address}</td>
                      <td className="py-3 px-4 text-sm font-mono text-gray-600">{device.mac_address || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{device.hostname || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{device.vendor || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{device.device_type || 'unknown'}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={device.status} />
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">{formatDate(device.last_seen)}</td>
                    </tr>
                  ))}
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
          <span className="text-sm text-gray-500">{changes.length} totali</span>
        </div>
        <div className="p-6">
          {changes.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Nessun cambiamento rilevato</p>
              <p className="text-gray-400 text-sm mt-2">I cambiamenti di rete verranno visualizzati qui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {changes.slice(0, 50).map((change) => (
                <div key={change.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-4 flex-1">
                    <ChangeTypeBadge changeType={change.change_type} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {change.ip_address} {change.hostname && `(${change.hostname})`}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        <span className="font-medium">{change.azienda || 'N/A'}</span> • {change.agent_name || 'Agent'}
                      </div>
                      {change.old_value && change.new_value && (
                        <div className="text-xs text-gray-400 mt-1 font-mono">
                          {change.old_value} → {change.new_value}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap ml-4">
                    {formatDate(change.detected_at)}
                  </div>
                </div>
              ))}
              {changes.length > 50 && (
                <div className="text-center py-4 text-sm text-gray-500">
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
              }, 200);
            }
          }}
          onAgentCreated={(agent) => {
            // NON fare nulla qui - evita qualsiasi refresh
            console.log('✅ Agent creato con successo:', agent);
          }}
          getAuthHeader={getAuthHeader}
        />
      )}
    </div>
  );
};

export default NetworkMonitoringDashboard;
