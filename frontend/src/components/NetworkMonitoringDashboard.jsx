// src/components/NetworkMonitoringDashboard.jsx

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Wifi, WifiOff, Monitor, Server, Printer, Router,
  AlertCircle, AlertTriangle, CheckCircle, Clock, RefreshCw,
  Activity, TrendingUp, TrendingDown, Search,
  Filter, X, Loader, Plus, Download, Server as ServerIcon,
  Trash2, PowerOff, Building, ArrowLeft, ChevronRight, Settings, Edit, Menu,
  CircleAlert, Stethoscope, Eye, EyeOff, FileText, ArrowUpCircle, Terminal, Network, History, Key, MonitorSmartphone,
  Cpu, HardDrive, Battery, Shield, User, HelpCircle, Ticket
} from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';
import { getDeviceIcon, AVAILABLE_ICONS } from '../utils/deviceTypeIcons';
import CreateAgentModal from './Modals/CreateAgentModal';
import EditAgentModal from './Modals/EditAgentModal';
import MonitoringScheduleModal from './Modals/MonitoringScheduleModal';
import AgentNotifications from './AgentNotifications';
import TelegramConfigSection from './TelegramConfigSection';
import { EventBadge, SeverityIndicator } from './EventBadges';
import MonitoraggioIntroCard from './MonitoraggioIntroCard';
import SectionNavMenu from './SectionNavMenu';
import DeviceAnalysisModal from './Modals/DeviceAnalysisModal';

const NetworkMonitoringDashboard = ({ getAuthHeader, socket, initialView = null, onViewReset = null, onClose = null, onNavigateToMappatura = null, onCompanyChange = null, initialCompanyId = null, readOnly = false, currentUser, onNavigateOffice, onNavigateEmail, onNavigateAntiVirus, onNavigateDispositiviAziendali, onNavigateNetworkMonitoring, onNavigateMappatura, onOpenTicket = null }) => {
  const updateTimeoutRef = useRef(null);
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
  const [showTelegramConfig, setShowTelegramConfig] = useState(false);
  const [showAgentControlsMenu, setShowAgentControlsMenu] = useState(false);
  const [telegramConfigs, setTelegramConfigs] = useState([]);
  const [telegramConfigLoading, setTelegramConfigLoading] = useState(false);
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
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId ? Number(initialCompanyId) : null);
  const [companyDevices, setCompanyDevices] = useState([]);
  const [loadingCompanyDevices, setLoadingCompanyDevices] = useState(false);
  const [showOfflineDevices, setShowOfflineDevices] = useState(true); // Mostra dispositivi offline di default
  const [showPingFailuresOnly, setShowPingFailuresOnly] = useState(false); // Filtra solo disconnessioni rilevate
  const [changesSearchTerm, setChangesSearchTerm] = useState('');
  const [changesCompanyFilter, setChangesCompanyFilter] = useState(initialCompanyId ? Number(initialCompanyId) : null); // Filtro azienda separato per "Cambiamenti Rilevati"
  const [changesNetworkFilter, setChangesNetworkFilter] = useState(''); // Filtro rete per "Cambiamenti Rilevati"
  const [availableNetworks, setAvailableNetworks] = useState([]); // Reti disponibili per l'azienda selezionata
  const [eventTypeFilter, setEventTypeFilter] = useState('all'); // all, device, agent
  const [ipContextMenu, setIpContextMenu] = useState({ show: false, ip: '', x: 0, y: 0 });
  const [deviceTypePickerDeviceId, setDeviceTypePickerDeviceId] = useState(null); // id dispositivo per cui è aperto il picker tipo (icona)
  const [deviceTypePickerAnchor, setDeviceTypePickerAnchor] = useState(null); // { left, top } per posizionare il popover in fixed
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedDeviceForSchedule, setSelectedDeviceForSchedule] = useState(null);
  const [showEditAgentModal, setShowEditAgentModal] = useState(false);
  const [selectedAgentForEdit, setSelectedAgentForEdit] = useState(null);
  const [showDeviceAnalysisModal, setShowDeviceAnalysisModal] = useState(false);
  const [deviceAnalysisDeviceId, setDeviceAnalysisDeviceId] = useState(null);
  const [deviceAnalysisLabel, setDeviceAnalysisLabel] = useState('');
  // Dispositivi aziendali: lista per MAC (icona + fumetto in tabella)
  const [dispositiviAziendaliList, setDispositiviAziendaliList] = useState([]);
  const [dispositivoAziendaliPopover, setDispositivoAziendaliPopover] = useState({ show: false, left: 0, top: 0, device: null, info: null });
  const popoverDeviceInfo = dispositivoAziendaliPopover.info;
  const popoverHasInfo = !!(popoverDeviceInfo && (popoverDeviceInfo.mac || popoverDeviceInfo.device_name || popoverDeviceInfo.os_name));
  // Dimensioni sicure per il fumetto dispositivi aziendali (adattato alla larghezza pagina)
  const popoverMaxWidth = (typeof window !== 'undefined')
    ? Math.max(480, Math.min(960, window.innerWidth - 32)) // minimo 480px, massimo ~doppio (960px), con margine 16px per lato
    : 960;
  const popoverSafeLeft = (typeof window !== 'undefined')
    ? Math.max(16, Math.min(dispositivoAziendaliPopover.left, window.innerWidth - popoverMaxWidth - 16))
    : dispositivoAziendaliPopover.left;
  // selectedStaticIPs non serve più, usiamo is_static dal database
  const seenMacAddressesRef = useRef(new Set());
  const [newDevicesInList, setNewDevicesInList] = useState(new Set());
  const pendingUpdatesRef = useRef({}); // { [deviceId]: { [field]: { value, timestamp } } }
  
  // Sincronizza lo stato locale con initialCompanyId se cambia esternamente
  useEffect(() => {
    const numericId = initialCompanyId ? Number(initialCompanyId) : null;
    if (numericId !== selectedCompanyId) {
      setCompanyDevices([]); // Pulisci la lista quando cambia dall'esterno
      setSelectedCompanyId(numericId);
    }
  }, [initialCompanyId, selectedCompanyId]);

  // Applica gli aggiornamenti pendenti ai dati ricevuti dal server
  const applyPendingUpdates = useCallback((items) => {
    if (!items || !Array.isArray(items)) return items;
    const now = Date.now();
    const LOCK_TIME = 8000; // 8 secondi di "blocco" per evitare overwrite da refresh (visti i tempi del backend)

    return items.map(item => {
      const pending = pendingUpdatesRef.current[item.id];
      if (!pending) return item;

      let newItem = { ...item };
      let hasUpdates = false;

      Object.keys(pending).forEach(field => {
        if (now - pending[field].timestamp < LOCK_TIME) {
          newItem[field] = pending[field].value;
          hasUpdates = true;
        } else {
          // Pulisci update vecchio
          delete pendingUpdatesRef.current[item.id][field];
        }
      });

      if (Object.keys(pendingUpdatesRef.current[item.id]).length === 0) {
        delete pendingUpdatesRef.current[item.id];
      }

      return hasUpdates ? newItem : item;
    });
  }, []);

  const markPendingUpdate = (deviceId, field, value) => {
    if (!pendingUpdatesRef.current[deviceId]) {
      pendingUpdatesRef.current[deviceId] = {};
    }
    pendingUpdatesRef.current[deviceId][field] = {
      value,
      timestamp: Date.now()
    };
  };

  // Funzione per generare report stampabile
  const generatePrintableReport = () => {
    const companyName = companies.find(c => c.id === selectedCompanyId)?.azienda || 'Dispositivi';

    // Prepara HTML per la stampa (include tutti i dispositivi, anche offline)
    const printHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Report Dispositivi - ${companyName}</title>
        <style>
          @media print {
            @page { margin: 0.8cm; }
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 10px;
          }
          h1 {
            text-align: center;
            color: #1f2937;
            margin-bottom: 20px;
            font-size: 22px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            table-layout: fixed;
          }
          /* Larghezze colonne ottimizzate - più spazio per Utente */
          table th:nth-child(1), table td:nth-child(1) { width: 4%; text-align: center; } /* Statico */
          table th:nth-child(2), table td:nth-child(2) { width: 11%; } /* IP */
          table th:nth-child(3), table td:nth-child(3) { width: 15%; } /* MAC */
          table th:nth-child(4), table td:nth-child(4) { width: 10%; } /* Prod. */
          table th:nth-child(5), table td:nth-child(5) { width: 15%; } /* Titolo */
          table th:nth-child(6), table td:nth-child(6) { width: 30%; } /* Utente - aumentato */
          table th:nth-child(7), table td:nth-child(7) { width: 15%; } /* Status */
          .checkbox-icon {
            font-size: 12px;
            font-weight: bold;
          }
          th {
            background-color: #f3f4f6;
            padding: 8px;
            text-align: left;
            border-bottom: 2px solid #d1d5db;
            font-weight: bold;
            color: #374151;
            font-size: 10px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          td {
            padding: 6px 8px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 9px;
            color: #1f2937;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          tr.static-row {
            background-color: #dbeafe !important;
          }
          tr.offline-row {
            background-color: #fee2e2 !important;
          }
          .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 9px;
            font-weight: bold;
          }
          .status-online {
            background-color: #d1fae5;
            color: #065f46;
          }
          .status-no-ping {
            background-color: #fef3c7;
            color: #92400e;
          }
          .status-offline {
            background-color: #fee2e2;
            color: #991b1b;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <h1>Report Dispositivi di Rete - ${companyName}</h1>
        <table>
          <thead>
            <tr>
              <th>Statico</th>
              <th>IP</th>
              <th>MAC</th>
              <th>Prod.</th>
              <th>Titolo</th>
              <th>Utente</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${companyDevices.map(device => {
      const isStatic = device.is_static === true;
      const isOffline = device.status === 'offline';
      const rowClass = isOffline ? 'offline-row' : (isStatic ? 'static-row' : '');
      // Converti MAC da trattini a due punti
      const macFormatted = device.mac_address ? device.mac_address.replace(/-/g, ':') : '-';
      const macWithAsterisk = macFormatted + (device.keepass_outside_azienda ? ' *' : '');

      return `
                <tr class="${rowClass}">
                  <td style="text-align: center;">${isStatic ? '☑' : '☐'}</td>
                  <td>${device.ip_address || '-'}</td>
                  <td>${macWithAsterisk}</td>
                  <td>${device.device_path || '-'}</td>
                  <td>${device.hostname || '-'}</td>
                  <td>${device.device_username || '-'}</td>
                  <td>
                    <span class="status-badge status-${device.status === 'offline' ? 'offline' :
          (device.status === 'online' && device.ping_responsive === false) ? 'no-ping' :
            'online'
        }">
                      ${device.status === 'offline' ? '○ Offline' :
          (device.status === 'online' && device.ping_responsive === false) ? '⚠ No Ping' :
            '● Online'
        }
                    </span>
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
        <div class="footer">
          Generato il ${new Date().toLocaleString('it-IT')} | Totale dispositivi: ${companyDevices.length}
        </div>
      </body>
      </html>
    `;

    // Apri in nuova finestra
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHTML);
    printWindow.document.close();

    // Attendi caricamento e stampa
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  };

  const [editingAgentId, setEditingAgentId] = useState(null);
  const [editAgentData, setEditAgentData] = useState({
    agent_name: '',
    network_ranges: [],
    scan_interval_minutes: 15
  });

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

  // Gestisci initialView dal menu (Agent e Notifiche Telegram solo per tecnici: se readOnly non aprire queste viste)
  useEffect(() => {
    if (readOnly && (initialView === 'agents' || initialView === 'create' || initialView === 'notifications' || initialView === 'telegram')) {
      return;
    }
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
    } else if (initialView === 'notifications') {
      setShowAgentNotificationsList(true);
      setShowAgentsList(false);
      loadAgents();
      loadAgentEvents({ limit: 200, unreadOnly: false });
      // Reset dopo un breve delay per permettere al componente di renderizzare
      if (onViewReset) {
        setTimeout(() => onViewReset(), 100);
      }
    } else if (initialView === 'telegram') {
      setShowTelegramConfig(true);
      setShowAgentsList(false);
      setShowAgentNotificationsList(false);
      loadTelegramConfigs();
      // Reset dopo un breve delay per permettere al componente di renderizzare
      if (onViewReset) {
        setTimeout(() => onViewReset(), 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialView, readOnly]);

  // Carica dispositivi
  // Normalizza MAC a 12 caratteri esadecimali maiuscoli (riscontro solo tramite MAC)
  const normalizeMac = useCallback((mac) => {
    if (!mac || typeof mac !== 'string') return '';
    const hex = mac.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().slice(0, 12);
    return hex.length === 12 ? hex : '';
  }, []);

  // Formatta MAC con i due punti (es. 00:50:56:C0:00:01)
  const formatMacWithColons = useCallback((mac) => {
    if (!mac || typeof mac !== 'string') return '—';
    return mac.trim().replace(/-/g, ':');
  }, []);

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
      const updatedData = applyPendingUpdates(data);
      setDevices(updatedData);
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

  // Carica eventi unificati (dispositivi + agent)
  const loadChanges = useCallback(async (silent = false) => {
    try {
      const searchParam = changesSearchTerm ? `&search=${encodeURIComponent(changesSearchTerm)}` : '';
      const aziendaParam = changesCompanyFilter ? `&azienda_id=${changesCompanyFilter}` : '';
      const networkParam = changesNetworkFilter ? `&network=${encodeURIComponent(changesNetworkFilter)}` : '';
      const eventTypeParam = eventTypeFilter !== 'all' ? `&event_type=${eventTypeFilter}` : '';

      // Usa il nuovo endpoint unificato
      const response = await fetch(
        buildApiUrl(`/api/network-monitoring/all/events?limit=500&count24h=true${searchParam}${aziendaParam}${networkParam}${eventTypeParam}`),
        { headers: getAuthHeader() }
      );

      if (!response.ok) {
        throw new Error('Errore caricamento eventi');
      }

      const data = await response.json();
      // Gestisci sia formato vecchio (array) che nuovo (oggetto con events)
      if (Array.isArray(data)) {
        setChanges(data);
      } else {
        setChanges(data.events || []);
        // Salva il conteggio delle ultime 24 ore se disponibile
        if (data.count24h !== undefined) {
          setRecentChangesCount(data.count24h);
        }
      }
    } catch (err) {
      if (!silent) {
        console.error('Errore caricamento eventi:', err);
      }
    }
  }, [getAuthHeader, changesSearchTerm, changesCompanyFilter, changesNetworkFilter, eventTypeFilter]);

  // Carica lista dispositivi aziendali (solo MAC) per icona/fumetto in tabella
  const loadDispositiviAziendaliByMac = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/network-monitoring/dispositivi-aziendali-by-mac'), {
        headers: getAuthHeader()
      });
      if (!response.ok) return;
      const data = await response.json();
      setDispositiviAziendaliList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Errore caricamento dispositivi aziendali by MAC:', err);
    }
  }, [getAuthHeader]);

  // Mappa MAC normalizzato e IP -> elenco entry (stesso MAC/IP può essere in più aziende)
  const dispositiviAziendaliMap = useMemo(() => {
    const map = new Map();
    for (const row of dispositiviAziendaliList) {
      const mac = normalizeMac(row.mac_normalized || row.mac);
      if (mac) {
        if (!map.has(mac)) map.set(mac, []);
        map.get(mac).push(row);
      }
      
      const primaryIp = row.primary_ip?.trim();
      if (primaryIp) {
        if (!map.has(primaryIp)) map.set(primaryIp, []);
        if (!map.get(primaryIp).some(r => r.mac === row.mac)) {
          map.get(primaryIp).push(row);
        }
      }
      
      let ips = [];
      try {
        if (typeof row.ip_addresses === 'string') {
          ips = row.ip_addresses.includes('[') ? JSON.parse(row.ip_addresses) : row.ip_addresses.split(',');
        } else if (Array.isArray(row.ip_addresses)) {
          ips = row.ip_addresses;
        }
      } catch (e) {}
      
      if (Array.isArray(ips)) {
        for (const ip of ips) {
          const cleanIp = typeof ip === 'string' ? ip.trim() : '';
          if (cleanIp) {
            if (!map.has(cleanIp)) map.set(cleanIp, []);
            if (!map.get(cleanIp).some(r => r.mac === row.mac)) {
               map.get(cleanIp).push(row);
            }
          }
        }
      }
    }
    return map;
  }, [dispositiviAziendaliList, normalizeMac]);

  // Carica reti quando cambia l'azienda selezionata nei filtri eventi
  useEffect(() => {
    setChangesNetworkFilter('');
    const loadNetworks = async () => {
      if (!changesCompanyFilter) {
        setAvailableNetworks([]);
        setChangesNetworkFilter('');
        return;
      }

      try {
        const response = await fetch(buildApiUrl(`/api/network-monitoring/company/${changesCompanyFilter}/networks`), {
          headers: getAuthHeader()
        });
        if (response.ok) {
          const data = await response.json();
          setAvailableNetworks(data);
        }
      } catch (err) {
        console.error("Errore caricamento reti:", err);
      }
    };

    loadNetworks();
  }, [changesCompanyFilter, getAuthHeader]);

  useEffect(() => {
    loadChanges();
  }, [loadChanges]);

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

  // Carica configurazioni Telegram
  const loadTelegramConfigs = useCallback(async () => {
    setTelegramConfigLoading(true);
    try {
      const response = await fetch(buildApiUrl('/api/network-monitoring/telegram/config'), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        throw new Error('Errore caricamento configurazioni Telegram');
      }

      const data = await response.json();
      setTelegramConfigs(data);
    } catch (err) {
      console.error('Errore caricamento configurazioni Telegram:', err);
    } finally {
      setTelegramConfigLoading(false);
    }
  }, [getAuthHeader]);

  // Salva configurazione Telegram
  const saveTelegramConfig = async (config) => {
    try {
      const response = await fetch(buildApiUrl('/api/network-monitoring/telegram/config'), {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore salvataggio configurazione Telegram');
      }

      const data = await response.json();
      await loadTelegramConfigs(); // Ricarica lista
      return data;
    } catch (err) {
      console.error('Errore salvataggio configurazione Telegram:', err);
      throw err;
    }
  };

  // Rimuovi configurazione Telegram
  const deleteTelegramConfig = async (configId) => {
    try {
      const response = await fetch(buildApiUrl(`/api/network-monitoring/telegram/config/${configId}`), {
        method: 'DELETE',
        headers: getAuthHeader()
      });

      if (!response.ok) {
        throw new Error('Errore rimozione configurazione Telegram');
      }

      await loadTelegramConfigs(); // Ricarica lista
    } catch (err) {
      console.error('Errore rimozione configurazione Telegram:', err);
      throw err;
    }
  };


  // Apri modal modifica agent
  const handleEditAgent = (agent) => {
    setSelectedAgentForEdit(agent);
    setShowEditAgentModal(true);
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

  // Reset has_ping_failures
  const handleResetPingFailures = async () => {
    if (!selectedCompanyId) return;
    if (!confirm('Sei sicuro di voler resettare gli avvisi di "Disconnessioni frequenti" per TUTTI i dispositivi di questa azienda?\n\nQuesta azione non risolve i problemi di rete, ma azzera solo i contatori di visualizzazione.')) {
      return;
    }

    try {
      setLoadingCompanyDevices(true);
      const response = await fetch(buildApiUrl(`/api/network-monitoring/clients/${selectedCompanyId}/reset-ping-failures`), {
        method: 'POST',
        headers: getAuthHeader()
      });

      if (!response.ok) {
        throw new Error('Errore durante il reset');
      }

      const res = await response.json();
      alert(res.message || 'Reset effettuato con successo');
      await loadCompanyDevices(selectedCompanyId); // Ricarica lista
    } catch (err) {
      console.error('Errore reset:', err);
      alert('Errore durante il reset: ' + err.message);
    } finally {
      setLoadingCompanyDevices(false);
    }
  };

  // Carica dispositivi per un'azienda specifica
  const loadCompanyDevices = useCallback(async (aziendaId, silent = false) => {
    try {
      if (!silent) {
        setLoadingCompanyDevices(true);
      }
      const response = await fetch(buildApiUrl(`/api/network-monitoring/clients/${aziendaId}/devices`), {
        headers: getAuthHeader()
      });

      if (!response.ok) {
        throw new Error('Errore caricamento dispositivi azienda');
      }
      const data = await response.json();

      // 1. Applica subito gli aggiornamenti pendenti ai dati ricevuti (per is_static, notify_telegram, device_type, is_new_device)
      const updatedData = applyPendingUpdates(data);

      // 2. Rileva nuovi dispositivi usando il flag (ora aggiornato optimisticamente)
      const newlyDetected = new Set();
      updatedData.forEach(device => {
        if (device.is_new_device) {
          newlyDetected.add(device.id);
        }
      });

      if (newlyDetected.size > 0) {
        // Aggiungi ai dispositivi da evidenziare
        setNewDevicesInList(prev => {
          const next = new Set(prev);
          newlyDetected.forEach(id => next.add(id));
          return next;
        });
        // NON rimuoviamo l'evidenziazione dopo 10 secondi, resta finché l'agent non aggiorna
      } else {
        // Se non ci sono nuovi dispositivi dal backend, puliamo la lista
        setNewDevicesInList(new Set());
      }

      setCompanyDevices(updatedData);

    } catch (err) {
      console.error('Errore caricamento dispositivi azienda:', err);
      if (!silent) {
        setError(err.message);
      }
    } finally {
      if (!silent) {
        setLoadingCompanyDevices(false);
      }
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
        loadChanges(false),
        loadDispositiviAziendaliByMac(),
        selectedCompanyId ? loadCompanyDevices(selectedCompanyId) : Promise.resolve()
      ]);
    } catch (err) {
      console.error('Errore durante il refresh:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, loadDevices, loadChanges, loadCompanyDevices, loadDispositiviAziendaliByMac, selectedCompanyId]);

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
    loadChanges(false);
    loadAgents();
    loadCompanies();
    loadDispositiviAziendaliByMac();
  }, [loadDevices, loadChanges, loadAgents, loadCompanies, loadDispositiviAziendaliByMac]);

  // Auto-refresh ogni 30 secondi - DISABILITATO se il modal di creazione è aperto
  useEffect(() => {
    if (!autoRefresh || showCreateAgentModal) return; // Non aggiornare se il modal è aperto

    const interval = setInterval(() => {
      // Usa modalità "silent" per evitare flicker durante auto-refresh
      loadDevices(true);
      loadChanges(true);
      // Se un'azienda è selezionata, ricarica anche i dispositivi dell'azienda (già silenzioso)
      if (selectedCompanyId) {
        loadCompanyDevices(selectedCompanyId, true);
      }
    }, 30000); // 30 secondi

    return () => clearInterval(interval);
  }, [autoRefresh, loadDevices, loadChanges, loadCompanyDevices, selectedCompanyId, showCreateAgentModal]);

  // Ricarica i cambiamenti quando cambia il filtro azienda per i cambiamenti
  useEffect(() => {
    loadChanges(false);
  }, [changesCompanyFilter, loadChanges]);

  // Resetta il toggle e carica i dati quando cambia l'azienda selezionata
  useEffect(() => {
    setShowOfflineDevices(true); // Mostra sempre i dispositivi offline quando si cambia azienda
    setCompanyDevices([]); // Svuota l'array per mostrare il loader subito e non i vecchi dati
    if (selectedCompanyId) {
      loadCompanyDevices(selectedCompanyId);
    }
  }, [selectedCompanyId, loadCompanyDevices]);

  // Sincronizza filtro Eventi di Rete con l'azienda selezionata nella vista principale: così gli eventi mostrati sono solo di quell'azienda
  useEffect(() => {
    setChangesCompanyFilter(selectedCompanyId ?? null);
  }, [selectedCompanyId]);

  // Chiude il menu contestuale quando si preme ESC
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && ipContextMenu.show) {
        closeIpContextMenu();
      }
    };

    if (ipContextMenu.show) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [ipContextMenu.show]);

  // Ascolta eventi WebSocket per aggiornamenti real-time - DISABILITATO se il modal di creazione è aperto
  useEffect(() => {
    if (!socket || showCreateAgentModal) return; // Non aggiornare se il modal è aperto

    const handleNetworkUpdate = (data) => {
      console.log('📡 Network monitoring update ricevuto:', data);

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
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
            loadCompanyDevices(selectedCompanyId, true);
          }
        }
      }, 1500); // 1.5 secondi debounce
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
      loadChanges(false);
    }, 300); // Debounce di 300ms

    return () => clearTimeout(timeoutId);
  }, [changesSearchTerm, loadChanges]);

  // Badge status (3 stati: Online, No Ping, Offline)
  const StatusBadge = ({ status, pingResponsive }) => {
    // Offline: dispositivo completamente irraggiungibile
    if (status === 'offline') {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 flex items-center gap-1 whitespace-nowrap">
          <WifiOff size={12} />
          Offline
        </span>
      );
    }

    // Online ma non risponde al ping: presente via ARP
    if (status === 'online' && pingResponsive === false) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1 whitespace-nowrap">
          <AlertTriangle size={12} />
          No Ping
        </span>
      );
    }

    // Online con ping responsive: tutto ok
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 flex items-center gap-1 whitespace-nowrap">
        <CheckCircle size={12} />
        Online
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
      'ip_conflict': { label: 'Conflitto IP', color: 'bg-amber-100 text-amber-800' },
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

    if (diffMins < 1) return 'Ora';
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours} ore`;
    if (diffDays < 7) return `${diffDays} giorni`;

    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Titolo da mostrare in tabella: accorciato per switch virtuali per evitare overflow e barra di scroll orizzontale
  const MAX_TITLE_LENGTH_VIRTUAL = 18;
  const getDisplayTitle = (device) => {
    const title = device.hostname || '-';
    if (!title || title === '-') return title;
    const isVirtual = (device.device_type || '').toLowerCase() === 'virtual' ||
      (device.device_type || '').toLowerCase() === 'virtualization' ||
      (device.ip_address && String(device.ip_address).toLowerCase().startsWith('virtual-'));
    if (!isVirtual) return title;
    if (title.length <= MAX_TITLE_LENGTH_VIRTUAL) return title;
    return title.slice(0, MAX_TITLE_LENGTH_VIRTUAL) + '…';
  };

  // Gestisce il click sull'IP per mostrare il menu contestuale (deviceOrChange = dispositivo dalla tabella o change da Cambiamenti, per avere id/device_id)
  const handleIpClick = (e, ip, deviceOrChange) => {
    e.preventDefault();
    e.stopPropagation();
    setIpContextMenu({
      show: true,
      ip: ip,
      x: e.clientX,
      y: e.clientY,
      device: deviceOrChange || null
    });
  };

  // Chiude il menu contestuale
  const closeIpContextMenu = () => {
    setIpContextMenu({ show: false, ip: '', x: 0, y: 0, device: null });
  };

  // Apre PowerShell/CMD con comando ping direttamente
  const handlePing = (ip) => {
    closeIpContextMenu();

    // Su Windows, crea un file .bat temporaneo che viene eseguito immediatamente
    // Questo è l'unico modo pratico per aprire PowerShell/CMD da un browser web
    const batContent = `@echo off\nchcp 65001 >nul\ntitle Ping continuo a ${ip}\ncolor 0A\necho PING CONTINUO A ${ip}\necho.\necho Premere CTRL+C per interrompere\necho.\nping ${ip} -t\npause`;
    const blob = new Blob([batContent], { type: 'application/x-msdos-program' });
    const url = URL.createObjectURL(blob);

    // Crea un link per il download
    const link = document.createElement('a');
    link.href = url;
    link.download = `ping_${ip.replace(/\./g, '_')}.bat`;

    // Clicca il link per avviare il download
    document.body.appendChild(link);
    link.click();

    // Pulisci immediatamente dopo il click
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Nota: Il browser potrebbe chiedere conferma prima di aprire/eseguire il file .bat
      // Questo è un comportamento normale per sicurezza. L'utente deve confermare l'apertura.
    }, 50);
  };

  // Apre terminale ping nel browser (nuova finestra)
  const handleTerminalPing = (ip) => {
    closeIpContextMenu();
    // Apre la pagina standalone in un popup
    window.open(`/tools/ping-terminal?ip=${ip}`, 'PingTerminal', 'width=800,height=600,resizable,scrollbars');
  };

  // Apre l'IP nel browser
  const handleWeb = (ip) => {
    closeIpContextMenu();
    window.open(`http://${ip}`, '_blank');
  };

  // Apre desktop remoto (RDP) con credenziali da Keepass
  // Il file .bat si auto-elimina e rimuove le credenziali automaticamente
  const handleRemoteDesktop = async (ip) => {
    closeIpContextMenu();

    try {
      const response = await fetch(buildApiUrl(`/api/network-monitoring/tools/rdp-credentials?ip=${encodeURIComponent(ip)}`), {
        headers: getAuthHeader()
      });

      let username = '';
      let password = '';
      let found = false;

      if (response.ok) {
        const data = await response.json();
        username = data.username || '';
        password = data.password || '';
        found = data.found || false;
      }

      // Il .bat si auto-lancia minimizzato, salva credenziali temporanee,
      // avvia mstsc, dopo 5 sec rimuove credenziali e si auto-elimina dal disco
      let batContent = '@echo off\r\n';
      batContent += 'if not "%1"=="AUTO" (\r\n';
      batContent += '  start /min "" cmd /c "%~f0" AUTO\r\n';
      batContent += '  exit\r\n';
      batContent += ')\r\n';
      batContent += 'chcp 65001 >nul\r\n';

      if (found && username && password) {
        batContent += 'cmdkey /generic:TERMSRV/' + ip + ' /user:' + username + ' /pass:' + password + ' >nul 2>&1\r\n';
        batContent += 'start mstsc /v:' + ip + '\r\n';
        batContent += 'ping -n 6 127.0.0.1 >nul\r\n';
        batContent += 'cmdkey /delete:TERMSRV/' + ip + ' >nul 2>&1\r\n';
      } else {
        batContent += 'start mstsc /v:' + ip + '\r\n';
      }

      // Auto-elimina il file .bat dal disco
      batContent += '(goto) 2>nul & del "%~f0"\r\n';

      const blob = new Blob([batContent], { type: 'application/x-msdos-program' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'rdp_' + ip.replace(/\./g, '_') + '.bat';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 50);
    } catch (error) {
      console.error('Errore apertura desktop remoto:', error);
    }
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
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      return changeDate.getTime() >= todayMidnight.getTime();
    }).length,
    agentsTotal: agents.length,
    agentsOnline: agents.filter(a => a.status === 'online').length,
    agentsOffline: agents.filter(a => a.status === 'offline').length
  };

  // Eventi di Rete: nascosti ai clienti (readOnly) che non hanno agent per l'azienda selezionata
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const selectedCompanyAgentsCount = selectedCompany?.agents_count ?? selectedCompany?.agent_count ?? 0;
  const showEventiDiRete = !readOnly || selectedCompanyAgentsCount > 0;

  // Sezione Controlli (Azienda, Refresh, Mappatura)
  const controlsSection = (
    <>
      {/* Dropdown selezione azienda */}
      <div className="relative">
        <select
          value={selectedCompanyId || ''}
          onChange={(e) => {
            const companyId = e.target.value ? parseInt(e.target.value) : null;
            setCompanyDevices([]); // Svuota immediatamente per reattività UI
            setSelectedCompanyId(companyId);
            if (onCompanyChange) onCompanyChange(companyId);
            // loadCompanyDevices viene gestito in automatico dall'useEffect
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
        className={`px-4 py-2 rounded-lg flex items-center gap-2 ${autoRefresh
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

      {/* Pulsante Mappatura */}
      {onNavigateToMappatura && (
        <button
          onClick={() => onNavigateToMappatura(selectedCompanyId)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
          title="Vai alla Mappatura Topologica"
        >
          <Network size={18} />
          Mappatura
        </button>
      )}

      {/* Menu rapido Agent (Agent Esistenti / Crea Agent) */}
      {!readOnly && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAgentControlsMenu(prev => !prev)}
            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 text-gray-600 flex items-center justify-center"
            title="Opzioni Agent (lista e creazione)"
          >
            <Settings size={18} />
          </button>
          {showAgentControlsMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
              <button
                type="button"
                onClick={() => {
                  setShowAgentsList(true);
                  setShowCreateAgentModal(false);
                  setShowAgentNotificationsList(false);
                  setShowTelegramConfig(false);
                  setShowAgentControlsMenu(false);
                  loadAgents();
                }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <ServerIcon size={16} className="text-purple-600" />
                <span>Agent esistenti</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateAgentModal(true);
                  setShowAgentsList(false);
                  setShowAgentNotificationsList(false);
                  setShowTelegramConfig(false);
                  setShowAgentControlsMenu(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2 border-t border-gray-100"
              >
                <Plus size={16} className="text-green-600" />
                <span>Crea Agent</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Versione agent più alta */}
      {agents.length > 0 && (() => {
        // Trova la versione più alta tra tutti gli agent
        const compareVersions = (v1, v2) => {
          if (!v1) return 1;
          if (!v2) return -1;
          const parts1 = v1.split('.').map(Number);
          const parts2 = v2.split('.').map(Number);
          for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const part1 = parts1[i] || 0;
            const part2 = parts2[i] || 0;
            if (part1 > part2) return -1;
            if (part1 < part2) return 1;
          }
          return 0;
        };

        const highestVersionAgent = agents.reduce((highest, agent) => {
          if (!highest) return agent;
          if (!agent.version) return highest;
          if (!highest.version) return agent;
          return compareVersions(agent.version, highest.version) < 0 ? agent : highest;
        }, null);

        if (highestVersionAgent && highestVersionAgent.version) {
          return (
            <div className="px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center gap-2 min-w-[140px]">
              <span className="text-xs text-gray-500">Versione:</span>
              <span className="font-mono font-semibold text-blue-600">{highestVersionAgent.version}</span>
            </div>
          );
        }
        return null;
      })()}
    </>
  );

  // Helper per rappresentare i dischi nel fumetto dispositivi aziendali
  // (stile simile alla pagina Dispositivi Aziendali, con barra grafica)
  const renderDisksInline = (disksJson) => {
    if (!disksJson) return null;
    try {
      const arr = typeof disksJson === 'string' ? JSON.parse(disksJson) : disksJson;
      if (!Array.isArray(arr) || arr.length === 0) return null;

      const visible = arr.slice(0, 2); // massimo 2 dischi nel fumetto
      const extraCount = arr.length - visible.length;

      return (
        <div className="flex flex-col gap-2 w-full mt-1">
          {visible.map((d, i) => {
            if (d.total_gb == null || d.free_gb == null) return null;
            const used = Math.max(0, d.total_gb - d.free_gb);
            const percent = d.total_gb > 0 ? Math.round((used / d.total_gb) * 100) : 0;
            return (
              <div
                key={i}
                className="flex flex-col gap-1 text-[10px] w-full bg-gray-50 p-2 rounded border border-gray-100"
              >
                <div className="flex justify-between text-gray-700 font-medium">
                  <span>{d.letter ? `Disco ${d.letter}` : 'Disco'}</span>
                  <span>{percent}% in uso</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${percent > 90 ? 'bg-red-500' : percent > 75 ? 'bg-yellow-500' : 'bg-teal-500'
                      }`}
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[9px] text-gray-500">
                  <span>Liberi: {d.free_gb} GB</span>
                  <span>Totali: {d.total_gb} GB</span>
                </div>
              </div>
            );
          })}
          {extraCount > 0 && (
            <div className="text-[9px] text-gray-500">
              + {extraCount} {extraCount === 1 ? 'altro disco' : 'altri dischi'}
            </div>
          )}
        </div>
      );
    } catch {
      return null;
    }
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
            <SectionNavMenu
              currentPage="network"
              onNavigateHome={onClose}
              onNavigateOffice={onNavigateOffice}
              onNavigateEmail={onNavigateEmail}
              onNavigateAntiVirus={onNavigateAntiVirus}
              onNavigateDispositiviAziendali={onNavigateDispositiviAziendali}
              onNavigateNetworkMonitoring={null}
              onNavigateMappatura={onNavigateMappatura}
              currentUser={currentUser}
              selectedCompanyId={selectedCompanyId}
            />
            <div className="h-6 w-px bg-gray-300"></div>
            <h1 className="font-bold text-xl text-gray-800">Monitoraggio Rete</h1>
            {/* Notifiche Agent - spostato a destra del titolo */}
            {getAuthHeader && socket && (
              <AgentNotifications
                getAuthHeader={getAuthHeader}
                socket={socket}
                onOpenNetworkMonitoring={null}
              />
            )}
            {readOnly && (
              <div className="ml-4 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium flex items-center gap-2">
                <Eye size={16} />
                Modalità Visualizzazione
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {controlsSection}
          </div>
        </div>
      )}
      <div className="p-6 max-w-[95vw] mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Menu hamburger rimosso - ora è nel Header principale */}

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
            {!onClose && controlsSection}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <AlertCircle className="w-5 h-5 inline mr-2" />
            {error}
          </div>
        )}

        {/* Lista Agent Esistenti (solo per tecnici, nascosta in readOnly) */}
        {!readOnly && showAgentsList && (
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
                          <span className={`px-2 py-1 rounded text-xs font-medium ${agent.status === 'online' ? 'bg-green-100 text-green-800' :
                            agent.status === 'offline' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                            {agent.status || 'unknown'}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-gray-600 space-y-1">
                          <p>
                            <strong>Azienda:</strong>{' '}
                            {agent.azienda || 'N/A'}
                            {agent.azienda_ip_statico && (
                              <>
                                {' '}
                                (
                                <span
                                  className="font-mono text-blue-600 cursor-pointer hover:underline"
                                  title="Clicca per opzioni IP (ping, web, desktop remoto...)"
                                  onClick={(e) => handleIpClick(e, agent.azienda_ip_statico, null)}
                                >
                                  {agent.azienda_ip_statico}
                                </span>
                                )
                              </>
                            )}
                          </p>
                          {editingAgentId === agent.id ? (
                            <div className="space-y-2 mt-2">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Nome Agent:</label>
                                <input
                                  type="text"
                                  value={editAgentData.agent_name}
                                  onChange={(e) => setEditAgentData({ ...editAgentData, agent_name: e.target.value })}
                                  disabled={readOnly}
                                  className={`w-full px-3 py-1.5 text-sm border rounded ${readOnly
                                    ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
                                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                                    }`}
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
                                  disabled={readOnly}
                                  rows={3}
                                  className={`w-full px-3 py-1.5 text-sm border rounded font-mono ${readOnly
                                    ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
                                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                                    }`}
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
                                  disabled={readOnly}
                                  className={`w-full px-3 py-1.5 text-sm border rounded ${readOnly
                                    ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
                                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                                    }`}
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              <p><strong>Versione:</strong> <span className="font-mono text-blue-600 font-semibold">{agent.version || 'N/A'}</span></p>
                              <p><strong>Reti:</strong> {(() => {
                                // Se abbiamo network_ranges_config con nomi, mostrali
                                if (agent.network_ranges_config && Array.isArray(agent.network_ranges_config)) {
                                  return agent.network_ranges_config.map(r =>
                                    r.name ? `${r.range} (${r.name})` : r.range
                                  ).join(', ') || 'Nessuna';
                                }
                                // Altrimenti usa il vecchio formato
                                return (agent.network_ranges || []).join(', ') || 'Nessuna';
                              })()}</p>
                              <p><strong>Intervallo:</strong> {agent.scan_interval_minutes || 15} minuti</p>
                              <p><strong>Ultimo heartbeat:</strong> {agent.last_heartbeat ? formatDate(new Date(agent.last_heartbeat)) : 'Mai'}</p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col gap-2 min-w-[320px]">
                        {editingAgentId === agent.id ? (
                          <div className="flex flex-row gap-2">
                            <button
                              onClick={handleSaveAgent}
                              disabled={readOnly}
                              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 ${readOnly
                                ? 'bg-gray-400 text-white cursor-not-allowed'
                                : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                              title={readOnly ? 'Non disponibile in modalità visualizzazione' : 'Salva modifiche'}
                            >
                              <CheckCircle size={18} />
                              Salva
                            </button>
                            <button
                              onClick={handleCancelEditAgent}
                              className="flex-1 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2"
                            >
                              <X size={18} />
                              Annulla
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                             {/* Fila 1: Modifica, Disabilita, Elimina */}
                            <div className="flex flex-row gap-1 mb-1.5">
                              <button
                                onClick={() => handleEditAgent(agent)}
                                disabled={readOnly}
                                className={`flex-1 py-1.5 rounded flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider border transition-all ${readOnly
                                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                  : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'
                                  }`}
                                title={readOnly ? 'Non disponibile in modalità visualizzazione' : 'Modifica'}
                              >
                                <Edit size={13} />
                                Modifica
                              </button>
                              <button
                                onClick={() => disableAgent(agent.id, agent.agent_name)}
                                disabled={readOnly}
                                className={`flex-1 py-1.5 rounded flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider border transition-all ${readOnly
                                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                  : 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100'
                                  }`}
                                title={readOnly ? 'Non disponibile in modalità visualizzazione' : 'Disabilita'}
                              >
                                <PowerOff size={13} />
                                Disabilita
                              </button>
                              <button
                                onClick={() => deleteAgent(agent.id, agent.agent_name)}
                                disabled={readOnly}
                                className={`flex-1 py-1.5 rounded flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider border transition-all ${readOnly
                                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                  : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                                  }`}
                                title={readOnly ? 'Non disponibile in modalità visualizzazione' : 'Elimina'}
                              >
                                <Trash2 size={13} />
                                Elimina
                              </button>
                            </div>

                            {/* Fila 2: Scarica Pacchetto, Diagnostica */}
                            <div className="flex flex-row gap-1">
                              <button
                                onClick={() => downloadAgentPackage(agent.id, agent.agent_name)}
                                className="flex-1 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm"
                                title="Scarica pacchetto completo"
                              >
                                <Download size={13} />
                                Pacchetto
                              </button>
                              <button
                                onClick={() => showAgentDiagnostics(agent.id, agent.agent_name)}
                                className="flex-1 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm"
                                title="Mostra diagnostica"
                              >
                                <Stethoscope size={13} />
                                Diagnostica
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Configurazione Notifiche Telegram (solo per tecnici, nascosta in readOnly) */}
        {!readOnly && showTelegramConfig && (
          <TelegramConfigSection
            companies={companies}
            agents={agents}
            telegramConfigs={telegramConfigs}
            loading={telegramConfigLoading}
            onSave={readOnly ? null : saveTelegramConfig}
            onDelete={readOnly ? null : deleteTelegramConfig}
            readOnly={readOnly}
            onClose={() => setShowTelegramConfig(false)}
            getAuthHeader={getAuthHeader}
          />
        )}

        {/* Lista Notifiche Agent (solo per tecnici, nascosta in readOnly) */}
        {!readOnly && showAgentNotificationsList && (
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
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ev.event_type === 'offline' ? 'bg-red-100 text-red-800' :
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
              Cambiamenti (Oggi)
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

        {/* Intro per clienti (readOnly): sotto le 5 card, solo se nessuna azienda selezionata; quando selezioni l'azienda scompare e lascia spazio alla lista */}
        {readOnly && !selectedCompanyId && (
          <div className="mt-10 pt-8 border-t border-gray-200">
            <MonitoraggioIntroCard
              companies={companies}
              value={selectedCompanyId}
              onChange={(companyId) => {
                const id = companyId ? parseInt(companyId, 10) : null;
                setCompanyDevices([]); // Svuota immediatamente
                setSelectedCompanyId(id);
                if (onCompanyChange) onCompanyChange(id);
                // loadCompanyDevices viene gestito in automatico dall'useEffect
              }}
            />
          </div>
        )}

        {/* Vista Dettaglio Dispositivi Azienda (mostrata solo se un'azienda è selezionata) */}
        {selectedCompanyId && (
          <div className="mb-6 bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Building size={24} className="text-purple-600" />
                {companies.find(c => c.id === selectedCompanyId)?.azienda || 'Dispositivi'}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetPingFailures}
                  disabled={readOnly}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors mr-2 ${readOnly
                    ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100'
                    }`}
                  title={readOnly ? 'Non disponibile in modalità visualizzazione' : "Resetta l'avviso di 'Disconnessioni rilevate' per tutti i dispositivi di questa azienda"}
                >
                  <Activity size={18} />
                  <span className="text-sm font-medium">Reset Errori</span>
                </button>
                <button
                  onClick={() => setShowPingFailuresOnly(!showPingFailuresOnly)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${showPingFailuresOnly
                    ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  title={showPingFailuresOnly ? 'Mostra tutti' : 'Mostra solo con disconnessioni'}
                >
                  <AlertTriangle size={18} className={showPingFailuresOnly ? 'text-red-700' : 'text-gray-400'} />
                  <span className="text-sm font-medium">Disconnessioni rilevate</span>
                </button>

                <button
                  onClick={() => setShowOfflineDevices(!showOfflineDevices)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${showOfflineDevices
                    ? 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                    : 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                    }`}
                  title={showOfflineDevices ? 'Nascondi dispositivi offline' : 'Mostra dispositivi offline'}
                >
                  {showOfflineDevices ? (
                    <>
                      <EyeOff size={18} />
                      <span className="text-sm font-medium">Nascondi Offline</span>
                    </>
                  ) : (
                    <>
                      <Eye size={18} />
                      <span className="text-sm font-medium">Mostra Offline</span>
                    </>
                  )}
                </button>

                <button
                  onClick={generatePrintableReport}
                  className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-300 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                  title="Genera report stampabile (include tutti i dispositivi)"
                  disabled={companyDevices.length === 0}
                >
                  <FileText size={18} />
                  <span className="text-sm font-medium">Report Stampabile</span>
                </button>

                <button
                  onClick={() => setSelectedCompanyId(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors ml-2"
                  title="Chiudi vista azienda"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            {loadingCompanyDevices ? (
              <div className="p-8 flex items-center justify-center">
                <Loader className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600">Caricamento dispositivi...</span>
              </div>
            ) : (() => {
              // Filtra i dispositivi in base al toggle
              const filteredDevices = companyDevices.filter(device =>
                (showOfflineDevices || device.status === 'online') &&
                (!showPingFailuresOnly || device.has_ping_failures)
              );

              if (companyDevices.length === 0) {
                return <p className="text-gray-500 text-center py-4">Nessun dispositivo trovato per questa azienda</p>;
              }

              if (filteredDevices.length === 0) {
                return (
                  <p className="text-gray-500 text-center py-4">
                    Nessun dispositivo online. Attiva "Mostra Offline" per vedere tutti i dispositivi.
                  </p>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 whitespace-nowrap">Opzioni</th>
                        <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 min-w-[5rem]" title="Tipo / Online-Offline"></th>
                        <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 whitespace-nowrap">IP</th>
                        <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700 whitespace-nowrap">MAC</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 max-w-[11rem] truncate" title="Titolo (switch virtuali accorciati)">Titolo</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 whitespace-nowrap">Utente</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 whitespace-nowrap">Percorso</th>
                        <th className="text-center py-2 px-2 text-sm font-semibold text-gray-700 w-10 whitespace-nowrap" title="Aggiornamento firmware disponibile (UniFi)">FW</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 whitespace-nowrap min-w-[5.5rem]">Scan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDevices.map((device) => {
                        const isStatic = device.is_static === true;
                        return (
                          <tr
                            key={device.id}
                            className={`border-b border-gray-100 hover:bg-gray-50 ${isStatic ? 'bg-blue-50 hover:bg-blue-100' : ''}`}
                          >
                            {/* 1. Opzioni (Statico / Notifica) - su 2 righe */}
                            <td className="py-1 px-4">
                              <div className="flex flex-col gap-1">
                                <label className="flex items-center gap-1 cursor-pointer" title="IP Statico - Dispositivo con IP fisso">
                                  <input
                                    type="checkbox"
                                    checked={isStatic}
                                    onChange={async (e) => {
                                      const newIsStatic = e.target.checked;
                                      
                                      // 1. Update ottimistico locale
                                      setCompanyDevices(prev => prev.map(d =>
                                        d.id === device.id ? { ...d, is_static: newIsStatic } : d
                                      ));
                                      
                                      // 2. Blocca overwrite da background refresh per 8s
                                      markPendingUpdate(device.id, 'is_static', newIsStatic);

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
                                          throw new Error(errorData.error || 'Errore aggiornamento');
                                        }
                                        // Update definitivo non necessario se abbiamo già fatto quello ottimistico,
                                        // ma carichiamo comunque i dati aggiornati per sicurezza al prossimo refresh
                                      } catch (err) {
                                        console.error('Errore aggiornamento statico:', err);
                                        alert(`Errore: ${err.message}`);
                                        // Revert in caso di errore
                                        setCompanyDevices(prev => prev.map(d =>
                                          d.id === device.id ? { ...d, is_static: !newIsStatic } : d
                                        ));
                                        delete pendingUpdatesRef.current[device.id]?.is_static;
                                      }
                                    }}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <span className="text-xs text-gray-600">Statico</span>
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer" title="Monitora con Telegram - Ricevi notifiche per cambio IP/MAC/status">
                                  <input
                                    type="checkbox"
                                    checked={device.notify_telegram === true}
                                    onChange={async (e) => {
                                      const newNotifyTelegram = e.target.checked;
                                      
                                      // 1. Update ottimistico locale
                                      setCompanyDevices(prev => prev.map(d =>
                                        d.id === device.id ? { ...d, notify_telegram: newNotifyTelegram } : d
                                      ));
                                      
                                      // 2. Blocca overwrite da background refresh per 8s
                                      markPendingUpdate(device.id, 'notify_telegram', newNotifyTelegram);

                                      try {
                                        const response = await fetch(buildApiUrl(`/api/network-monitoring/devices/${device.id}/static`), {
                                          method: 'PATCH',
                                          headers: {
                                            ...getAuthHeader(),
                                            'Content-Type': 'application/json'
                                          },
                                          body: JSON.stringify({ notify_telegram: newNotifyTelegram })
                                        });

                                        if (!response.ok) {
                                          const errorData = await response.json();
                                          throw new Error(errorData.error || 'Errore aggiornamento');
                                        }
                                      } catch (err) {
                                        console.error('Errore aggiornamento notifiche:', err);
                                        alert(`Errore: ${err.message}`);
                                        // Revert in caso di errore
                                        setCompanyDevices(prev => prev.map(d =>
                                          d.id === device.id ? { ...d, notify_telegram: !newNotifyTelegram } : d
                                        ));
                                        delete pendingUpdatesRef.current[device.id]?.notify_telegram;
                                      }
                                    }}
                                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                  />
                                  <span
                                    className="text-xs text-gray-600 hover:text-blue-600 cursor-pointer flex items-center gap-0.5"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setSelectedDeviceForSchedule(device);
                                      setShowScheduleModal(true);
                                    }}
                                    title="Clicca per configurare orari e giorni"
                                  >
                                    Notifica
                                    {device.monitoring_schedule?.enabled && (
                                      <span className="text-[10px]" title="Orari personalizzati">⏰</span>
                                    )}
                                  </span>
                                </label>
                              </div>
                            </td>
                            {/* 2. Icona tipo dispositivo (modificabile) + Status - stessa lista Mappatura, sincronizzato ovunque */}
                            <td className="py-1 px-4 min-w-[5rem] align-top">
                              <div className="flex items-center gap-1.5">
                                <div className="relative flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      if (deviceTypePickerDeviceId === device.id) {
                                        setDeviceTypePickerDeviceId(null);
                                        setDeviceTypePickerAnchor(null);
                                      } else {
                                        setDeviceTypePickerDeviceId(device.id);
                                        setDeviceTypePickerAnchor({ left: rect.left, top: rect.bottom + 6 });
                                      }
                                    }}
                                    className="p-1 rounded hover:bg-gray-200 transition-colors inline-flex items-center justify-center min-w-[28px] min-h-[28px]"
                                    title="Clicca per cambiare tipo dispositivo (si aggiorna anche in Mappatura)"
                                  >
                                    {getDeviceIcon(device.device_type, 20, 'text-gray-600')}
                                  </button>
                                </div>
                                <StatusBadge status={device.status} pingResponsive={device.ping_responsive} />
                                {/* Icona Dispositivi aziendali: visibile se il MAC o l'IP è nella lista */}
                                {(() => {
                                  const macNorm = normalizeMac(device.mac_address);
                                  const deviceIp = device.ip_address?.trim();
                                  let entries = null;
                                  
                                  if (macNorm && dispositiviAziendaliMap.has(macNorm)) {
                                    entries = dispositiviAziendaliMap.get(macNorm);
                                  } else if (deviceIp && dispositiviAziendaliMap.has(deviceIp)) {
                                    entries = dispositiviAziendaliMap.get(deviceIp);
                                  }
                                  
                                  if (!entries || entries.length === 0) return null;
                                  const info = entries.find(e => e.azienda_id === device.azienda_id) || entries[0];
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setDispositivoAziendaliPopover({ show: true, left: rect.left, top: rect.bottom + 6, device, info });
                                      }}
                                      className="p-1 rounded hover:bg-teal-100 transition-colors inline-flex items-center justify-center min-w-[24px] min-h-[24px] text-teal-600"
                                      title="Dati da Dispositivi aziendali"
                                    >
                                      <MonitorSmartphone className="w-4 h-4" />
                                    </button>
                                  );
                                })()}
                              </div>
                            </td>
                            {/* 3. IP */}
                            <td className="py-1 px-4 text-sm font-mono text-gray-900 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
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
                                        <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                          IP cambiato (statico): da {device.previous_ip} a {device.ip_address}
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

                                            setCompanyDevices(prev => prev.map(d =>
                                              d.id === device.id ? { ...d, previous_ip: null, previous_mac: null } : d
                                            ));
                                          } catch (err) {
                                            console.error('Errore reset warning:', err);
                                            alert(`Errore: ${err.message}`);
                                          }
                                        }}
                                        className="text-orange-500 hover:text-orange-700 transition-colors shrink-0"
                                        title="Accetta nuovo IP"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                  {/* History Tooltip */}
                                  {device.ip_history && (Array.isArray(device.ip_history) ? device.ip_history : JSON.parse(device.ip_history || '[]')).length > 0 && (
                                    <div className="relative group">
                                      <History className="w-4 h-4 text-blue-400 hover:text-blue-600 cursor-help" />
                                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-20 bg-white border border-gray-200 shadow-xl text-xs rounded-md overflow-hidden w-64">
                                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 font-semibold text-gray-700">
                                          Storico IP
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                          {(Array.isArray(device.ip_history) ? device.ip_history : JSON.parse(device.ip_history || '[]'))
                                            .slice()
                                            .reverse()
                                            .map((h, idx) => (
                                              <div key={idx} className="px-3 py-2 border-b border-gray-50 flex justify-between items-center hover:bg-blue-50">
                                                <span className="font-mono text-gray-800">{h.ip}</span>
                                                <span className="text-gray-500 text-[10px]">{formatDate(h.seen_at)}</span>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  <span
                                    onClick={(e) => handleIpClick(e, device.ip_address, device)}
                                    className="cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                                    title="Clicca per opzioni"
                                  >
                                    {device.ip_address}
                                  </span>
                                </div>
                                {device.previous_ip && (
                                  <div className="text-xs text-orange-600 font-mono">
                                    era {device.previous_ip}
                                  </div>
                                )}
                                {/* IP aggiuntivi (multihoming/bridge) */}
                                {(device.additional_ips ? (Array.isArray(device.additional_ips) ? device.additional_ips : JSON.parse(device.additional_ips || '[]')) : [])
                                  .filter(ip => ip !== device.ip_address) // Evita duplicati se presente anche qui
                                  .map(ip => (
                                    <div key={ip} className="flex items-center gap-2 pl-0">
                                      <span className="text-gray-300 text-xs">↳</span>
                                      <span
                                        onClick={(e) => handleIpClick(e, ip, device)}
                                        className="text-sm cursor-pointer text-gray-500 hover:text-blue-600 hover:underline transition-colors"
                                        title="IP Secondario (stesso MAC Address)"
                                      >
                                        {ip}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </td>
                            {/* 4. MAC */}
                            <td className="py-1 px-4 text-sm font-mono text-gray-600 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {/* Warning: MAC cambiato (storico previous_mac) */}
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

                                {/* Warning: IP diverso da KeePass per stesso MAC */}
                                {device.keepass_ip_mismatch && (
                                  <div className="relative group">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap max-w-xs">
                                      IP diverso da KeePass:
                                      <br />
                                      <span className="font-mono">
                                        KeePass: {device.keepass_ip || 'N/D'}
                                      </span>
                                      <br />
                                      <span className="font-mono">
                                        Rilevato: {device.ip_address || 'N/D'}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                <div className="relative inline-flex items-center group">
                                  <span className={newDevicesInList.has(device.id) ? "bg-yellow-100 px-1 rounded font-bold" : ""} title={device.keepass_outside_azienda ? 'Dati da KeePass fuori dal percorso dell\'azienda' : undefined}>
                                    {device.mac_address ? device.mac_address.replace(/-/g, ':') : '-'}
                                    {device.keepass_outside_azienda && <span className="text-amber-600 font-bold" title="Dati da KeePass fuori dal percorso dell'azienda"> *</span>}
                                  </span>
                                  {newDevicesInList.has(device.id) && !readOnly && (
                                    <button
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();

                                        // 1. Update ottimistico locale
                                        setNewDevicesInList(prev => {
                                          const next = new Set(prev);
                                          next.delete(device.id);
                                          return next;
                                        });

                                        // 2. Blocca overwrite da background refresh per 8s
                                        markPendingUpdate(device.id, 'is_new_device', false);
                                        try {
                                          const response = await fetch(buildApiUrl(`/api/network-monitoring/devices/${device.id}/acknowledge`), {
                                            method: 'PATCH',
                                            headers: getAuthHeader()
                                          });
                                          if (!response.ok) {
                                            const errorData = await response.json();
                                            throw new Error(errorData.error || 'Errore conferma dispositivo');
                                          }
                                        } catch (err) {
                                          console.error('Errore conferma dispositivo:', err);
                                          alert(`Errore: ${err.message}`);
                                          // Revert in caso di errore
                                          setNewDevicesInList(prev => {
                                            const next = new Set(prev);
                                            next.add(device.id);
                                            return next;
                                          });
                                          delete pendingUpdatesRef.current[device.id]?.is_new_device;
                                        }
                                      }}
                                      className="ml-1 text-slate-400 hover:text-green-600 transition-colors bg-white hover:bg-green-50 rounded-full shadow-sm border border-gray-200"
                                      title="Conferma visione nuovo dispositivo"
                                    >
                                      <HelpCircle className="w-4 h-4 p-0.5" />
                                    </button>
                                  )}
                                  {device.keepass_model && (
                                    <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-20 bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap max-w-xs">
                                      Modello: {device.keepass_model}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-1 px-3 text-sm text-gray-600 max-w-[11rem] truncate" title={device.hostname || '-'}>
                              {(() => {
                                const macNorm = normalizeMac(device.mac_address);
                                const deviceIp = device.ip_address?.trim();
                                let hasMatch = false;
                                let matchValue = null;

                                if (macNorm && dispositiviAziendaliMap.has(macNorm)) {
                                  hasMatch = true;
                                  matchValue = macNorm;
                                } else if (deviceIp && dispositiviAziendaliMap.has(deviceIp)) {
                                  hasMatch = true;
                                  matchValue = deviceIp;
                                }

                                if (hasMatch && onNavigateDispositiviAziendali) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onNavigateDispositiviAziendali(selectedCompanyId, matchValue);
                                      }}
                                      className="text-left text-blue-600 hover:text-blue-800 hover:underline transition-colors truncate w-full"
                                      title="Vai al dispositivo in Dispositivi aziendali"
                                    >
                                      {getDisplayTitle(device)}
                                    </button>
                                  );
                                }
                                return getDisplayTitle(device);
                              })()}
                            </td>
                            <td className="py-1 px-3 text-sm text-gray-600 whitespace-nowrap">{device.device_username || '-'}</td>
                            <td className="py-1 px-3 text-sm text-gray-600 whitespace-nowrap max-w-[8rem] truncate" title={device.device_path || '-'}>{device.device_path || '-'}</td>
                            <td className="py-1 px-2 text-center whitespace-nowrap">
                              {device.upgrade_available && (
                                <div className="flex justify-center" title="Aggiornamento Firmware Disponibile">
                                  <ArrowUpCircle className="w-5 h-5 text-blue-600" />
                                </div>
                              )}
                            </td>
                            <td className="py-1 px-3 text-sm text-gray-500 whitespace-nowrap min-w-[5.5rem]">{formatDate(device.last_seen)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* Menu contestuale per IP */}
        {ipContextMenu.show && (
          <>
            {/* Overlay per chiudere il menu cliccando fuori */}
            <div
              className="fixed inset-0 z-40"
              onClick={closeIpContextMenu}
            />
            {/* Menu contestuale */}
            <div
              className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[150px]"
              style={{
                left: `${ipContextMenu.x}px`,
                top: `${ipContextMenu.y}px`,
                transform: 'translate(-50%, 10px)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => handleTerminalPing(ipContextMenu.ip)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors"
              >
                <Terminal size={16} />
                Ping
              </button>
              <button
                onClick={() => handleWeb(ipContextMenu.ip)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors"
              >
                <Monitor size={16} />
                Web
              </button>
              <button
                onClick={() => handleRemoteDesktop(ipContextMenu.ip)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2 transition-colors"
              >
                <MonitorSmartphone size={16} />
                Desktop Remoto
              </button>
              {/* Analisi dispositivo: usa device_id (eventi di rete) o id (tabella dispositivi). Non usare id negli eventi agent (device_id null, id = id evento) per evitare 404 */}
              {(ipContextMenu.device?.device_id != null || (ipContextMenu.device?.id != null && ipContextMenu.device?.event_category !== 'agent')) && (
                <button
                  onClick={() => {
                    const id = ipContextMenu.device?.device_id ?? ipContextMenu.device?.id;
                    const label = ipContextMenu.device?.hostname || ipContextMenu.device?.ip_address || ipContextMenu.ip;
                    const deviceLabel = label ? `${label} (${ipContextMenu.ip})` : ipContextMenu.ip;
                    const params = new URLSearchParams();
                    params.set('deviceId', String(id));
                    params.set('deviceLabel', deviceLabel);
                    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}#device-analysis`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                    closeIpContextMenu();
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors"
                >
                  <Activity size={16} />
                  Analisi dispositivo
                </button>
              )}
              {/* Crea ticket da dispositivo */}
              {onOpenTicket && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => {
                      const device = ipContextMenu.device;
                      const ip = ipContextMenu.ip;
                      const now = new Date().toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
                      const companyName = companies.find(c => c.id === selectedCompanyId)?.azienda || device?.azienda || '';
                      const mac = device?.mac_address ? device.mac_address.replace(/-/g, ':') : '-';
                      const hostname = device?.hostname || '-';
                      const tipoUtente = device?.device_type || device?.tipo_utente || '-';
                      const percorso = device?.device_path || device?.device_username || '-';
                      const utente = device?.keepass_username || device?.device_username || '-';

                      const hostnameLabel = hostname !== '-' ? hostname : ip;
                      const percorsoLabel = percorso !== '-' ? percorso : (utente !== '-' ? utente : '');

                      const titolo = `Segnalazione dispositivo ${hostnameLabel}${percorsoLabel ? ` - ${percorsoLabel}` : ''}`;
                      const descrizione =
                        `====== DISPOSITIVO DI RETE ======\n` +
                        `IP: ${ip}\n` +
                        `MAC: ${mac}\n` +
                        `==========================\n\n` +
                        `Descrizione del problema:\n`;

                      onOpenTicket({ titolo, descrizione, clientId: selectedCompanyId });
                      closeIpContextMenu();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 flex items-center gap-2 transition-colors font-medium"
                  >
                    <Ticket size={16} />
                    + Ticket
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {showDeviceAnalysisModal && (
          <DeviceAnalysisModal
            isOpen={showDeviceAnalysisModal}
            onClose={() => setShowDeviceAnalysisModal(false)}
            deviceId={deviceAnalysisDeviceId}
            deviceLabel={deviceAnalysisLabel}
            getAuthHeader={getAuthHeader}
          />
        )}

        {/* Sezione eventi unificati (dispositivi + agent): nascosta se cliente senza agent */}
        {showEventiDiRete && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Eventi di Rete</h2>
                <span className="text-sm text-gray-500">{changes.length} totali</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {/* Filtro Azienda */}
                <div className="relative">
                  <select
                    value={changesCompanyFilter || ''}
                    onChange={(e) => {
                      const companyId = e.target.value ? parseInt(e.target.value) : null;
                      setChangesCompanyFilter(companyId);
                    }}
                    className="w-full px-4 py-2 pr-8 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="">Tutte le Aziende</option>
                    {companies
                      .filter(company => (company.agents_count ?? company.agent_count ?? 0) > 0 || company.id === changesCompanyFilter || company.id === selectedCompanyId)
                      .map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.azienda}
                        </option>
                      ))
                    }
                  </select>
                  <Building
                    size={16}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>

                {/* Filtro Rete (visibile solo se azienda selezionata e reti disponibili) */}
                {changesCompanyFilter && availableNetworks.length > 0 && (
                  <div className="relative">
                    <select
                      value={changesNetworkFilter}
                      onChange={(e) => setChangesNetworkFilter(e.target.value)}
                      className="w-full px-4 py-2 pr-8 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                    >
                      <option value="">Tutte le Reti</option>
                      {availableNetworks.map((net, idx) => (
                        <option key={idx} value={net.range || net}>
                          {net.name ? `${net.name} (${net.range})` : (net.range || net)}
                        </option>
                      ))}
                    </select>
                    <Wifi
                      size={16}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                  </div>
                )}

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

                {/* Barra di ricerca */}
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Cerca (IP, MAC, hostname, agent...)"
                    value={changesSearchTerm}
                    onChange={(e) => setChangesSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadChanges(false)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {changesSearchTerm && (
                    <button
                      onClick={() => { setChangesSearchTerm(''); loadChanges(false); }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6">
              {changes.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Nessun evento rilevato</p>
                  <p className="text-gray-400 text-sm mt-2">Gli eventi di rete verranno visualizzati qui</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1200px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 w-10" title="Tipo dispositivo (solo se riconosciuto)"></th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tipo Evento</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">IP</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">MAC</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Hostname</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Prod.</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Titolo</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Azienda</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.slice(0, 50).map((change) => {
                        const isStatic = change.is_static === true;
                        const isAgent = change.event_category === 'agent';
                        return (
                          <tr
                            key={`${change.event_category || 'device'}-${change.id}`}
                            className={`border-b border-gray-100 hover:bg-gray-50 ${isStatic ? 'bg-blue-50 hover:bg-blue-100' : ''
                              } ${change.severity === 'critical' ? 'bg-red-50' : ''}`}
                          >
                            {/* Icona tipo dispositivo: solo per eventi dispositivo con device_type riconosciuto */}
                            <td className="py-3 px-2 w-10 whitespace-nowrap align-middle">
                              {!isAgent && change.device_type && String(change.device_type).trim() !== '' ? (
                                <span className="inline-flex items-center justify-center" title={change.device_type}>
                                  {getDeviceIcon(change.device_type, 18, 'text-gray-500')}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {(() => {
                                const actualEventType = change.event_type || change.change_type;
                                const actualCategory = change.event_category || 'device';
                                const isNewDevice = change.is_new_device;

                                // Configurazione badge per eventi dispositivi (senza icone)
                                const deviceBadges = {
                                  new_device: {
                                    label: 'Nuovo',
                                    bg: 'bg-green-100',
                                    text: 'text-green-800',
                                    border: 'border-green-300'
                                  },
                                  device_online: {
                                    label: isNewDevice ? 'Nuovo' : 'Online',
                                    bg: isNewDevice ? 'bg-green-100' : 'bg-blue-100',
                                    text: isNewDevice ? 'text-green-800' : 'text-blue-800',
                                    border: isNewDevice ? 'border-green-300' : 'border-blue-300'
                                  },
                                  device_offline: {
                                    label: 'Offline',
                                    bg: 'bg-red-100',
                                    text: 'text-red-800',
                                    border: 'border-red-300'
                                  },
                                  ip_changed: {
                                    label: 'IP Cambiato (Statico)',
                                    bg: 'bg-orange-100',
                                    text: 'text-orange-800',
                                    border: 'border-orange-300'
                                  },
                                  mac_changed: {
                                    label: 'MAC Cambiato',
                                    bg: 'bg-orange-100',
                                    text: 'text-orange-800',
                                    border: 'border-orange-300'
                                  },
                                  ip_conflict: {
                                    label: 'Conflitto IP',
                                    bg: 'bg-amber-100',
                                    text: 'text-amber-800',
                                    border: 'border-amber-300'
                                  },
                                  hostname_changed: {
                                    label: 'Hostname Cambiato',
                                    bg: 'bg-yellow-100',
                                    text: 'text-yellow-800',
                                    border: 'border-yellow-300'
                                  }
                                };

                                // Configurazione badge per eventi agent (senza icone)
                                const agentBadges = {
                                  offline: {
                                    label: 'Agent Off.',
                                    bg: 'bg-red-100',
                                    text: 'text-red-800',
                                    border: 'border-red-300'
                                  },
                                  online: {
                                    label: 'Agent Online',
                                    bg: 'bg-green-100',
                                    text: 'text-green-800',
                                    border: 'border-green-300'
                                  },
                                  reboot: {
                                    label: 'Agent Riavviato',
                                    bg: 'bg-purple-100',
                                    text: 'text-purple-800',
                                    border: 'border-purple-300'
                                  },
                                  network_issue: {
                                    label: 'Problema Rete',
                                    bg: 'bg-yellow-100',
                                    text: 'text-yellow-800',
                                    border: 'border-yellow-300'
                                  }
                                };

                                const badges = actualCategory === 'agent' ? agentBadges : deviceBadges;
                                const badge = badges[actualEventType] || {
                                  label: actualEventType || '-',
                                  bg: 'bg-gray-100',
                                  text: 'text-gray-800',
                                  border: 'border-gray-300'
                                };

                                return (
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border} whitespace-nowrap`}>
                                    {badge.label}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                <div className="flex items-center gap-2">
                                  {/* Indicatore disconnessioni frequenti */}
                                  {change.has_ping_failures && (
                                    <div className="relative group flex items-center">
                                      <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                                        <span className="text-white text-xs font-bold leading-none">+</span>
                                      </div>
                                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                        Disconnessioni frequenti rilevate
                                      </div>
                                    </div>
                                  )}

                                  {/* IP Address */}
                                  {change.ip_address ? (
                                    <span
                                      onClick={(e) => handleIpClick(e, change.ip_address, change)}
                                      className="cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                                      title="Clicca per opzioni"
                                    >
                                      {change.ip_address}
                                    </span>
                                  ) : (isAgent ? '-' : 'N/A')}

                                  {isStatic && (
                                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-200 text-blue-800 font-semibold whitespace-nowrap">
                                      STATICO
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 font-mono whitespace-nowrap">
                              <div className="relative inline-flex items-center group">
                                <span>
                                  {change.mac_address ? change.mac_address.replace(/-/g, ':') : '-'}
                                </span>
                                {change.keepass_model && (
                                  <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-20 bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap max-w-xs">
                                    Modello: {change.keepass_model}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                              {change.hostname || '-'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                              {change.device_type || '-'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                              <span title={change.keepass_username ? `Utente: ${change.keepass_username}` : ''}>
                                {change.hostname || change.keepass_title || change.device_path || change.vendor || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                              {change.azienda ? (
                                <span
                                  onClick={() => {
                                    if (change.azienda_id) {
                                      setCompanyDevices([]); // Svuota immediatamente
                                      setSelectedCompanyId(change.azienda_id);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }
                                  }}
                                  className="cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                                  title="Vedi dispositivi azienda"
                                >
                                  {change.azienda}
                                </span>
                              ) : 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">
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
        )}

        {/* Popover Tipo dispositivo: portale a schermo intero così le icone non vengono mai tagliate */}
        {deviceTypePickerDeviceId != null && deviceTypePickerAnchor && (() => {
          const device = companyDevices.find(d => d.id === deviceTypePickerDeviceId);
          if (!device) return null;
          return createPortal(
            <>
              <div className="fixed inset-0 z-20 bg-black/20" aria-hidden="true" onClick={() => { setDeviceTypePickerDeviceId(null); setDeviceTypePickerAnchor(null); }} />
              <div
                className="fixed z-30 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 w-[560px] max-w-[95vw]"
                style={{ left: Math.min(deviceTypePickerAnchor.left, window.innerWidth - 580), top: Math.min(deviceTypePickerAnchor.top, window.innerHeight - 350) }}
              >
                <div className="flex justify-between items-center mb-3 px-1">
                  <p className="text-sm font-semibold text-gray-700">Tipo dispositivo</p>
                  <button type="button" onClick={() => { setDeviceTypePickerDeviceId(null); setDeviceTypePickerAnchor(null); }} className="text-gray-400 hover:text-gray-600 font-bold text-lg leading-none" title="Chiudi">&times;</button>
                </div>
                <div className="grid grid-cols-6 gap-1.5 max-h-[360px] overflow-y-auto pr-1">
                  {AVAILABLE_ICONS.map((iconItem) => {
                    const IconComp = iconItem.icon;
                    const isSelected = (device.device_type || '').toLowerCase() === iconItem.type;
                    return (
                      <button
                        key={iconItem.type}
                        type="button"
                          onClick={async () => {
                            const newType = iconItem.type;
                            
                            // 1. Update ottimistico locale
                            setCompanyDevices(prev => prev.map(d => d.id === device.id ? { ...d, device_type: newType } : d));
                            
                            // 2. Blocca overwrite da background refresh
                            markPendingUpdate(device.id, 'device_type', newType);
                            
                            setDeviceTypePickerDeviceId(null);
                            setDeviceTypePickerAnchor(null);

                            try {
                              const res = await fetch(buildApiUrl(`/api/network-monitoring/devices/${device.id}/type`), {
                                method: 'PATCH',
                                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
                                body: JSON.stringify({ device_type: newType })
                              });
                              if (!res.ok) {
                                throw new Error('Errore aggiornamento tipo');
                              }
                            } catch (e) { 
                              console.error('Errore aggiornamento tipo', e); 
                              // Revert
                              setCompanyDevices(prev => prev.map(d => d.id === device.id ? { ...d, device_type: device.device_type } : d));
                              delete pendingUpdatesRef.current[device.id]?.device_type;
                            }
                          }}
                        className={`p-1.5 rounded-lg flex flex-col items-center justify-start gap-1 transition-all ${isSelected ? 'bg-blue-100 ring-2 ring-blue-500 text-blue-700' : 'bg-transparent hover:bg-gray-100 text-gray-600 hover:text-gray-900 border border-transparent hover:border-gray-200'}`}
                        title={iconItem.label}
                      >
                        <IconComp size={22} strokeWidth={isSelected ? 2 : 1.5} className="shrink-0" />
                        <span className="text-[10px] leading-[1.15] text-center w-full px-0 whitespace-normal break-words">{iconItem.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>,
            document.body
          );
        })()}

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
                  loadChanges(false);
                  loadAgents();
                  loadCompanies();
                  loadDispositiviAziendaliByMac();
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

        {/* Modal Configurazione Monitoring Schedule */}

        {/* Modal Configurazione Monitoring Schedule */}
        {showScheduleModal && selectedDeviceForSchedule && (
          <MonitoringScheduleModal
            device={selectedDeviceForSchedule}
            onClose={() => {
              setShowScheduleModal(false);
              setSelectedDeviceForSchedule(null);
            }}
            onSave={(updatedDevice) => {
              // Aggiorna il dispositivo nella lista
              setCompanyDevices(prev => prev.map(d =>
                d.id === updatedDevice.id ? { ...d, ...updatedDevice } : d
              ));
            }}
            getAuthHeader={getAuthHeader}
            buildApiUrl={buildApiUrl}
          />
        )}

        {/* Modal Modifica Agent */}
        {showEditAgentModal && selectedAgentForEdit && (
          <EditAgentModal
            isOpen={showEditAgentModal}
            onClose={() => {
              setShowEditAgentModal(false);
              setSelectedAgentForEdit(null);
            }}
            agent={selectedAgentForEdit}
            getAuthHeader={getAuthHeader}
            onAgentUpdated={(updatedAgent) => {
              setAgents(prev => prev.map(a =>
                a.id === updatedAgent.id ? { ...a, ...updatedAgent } : a
              ));
              loadAgents();
            }}
          />
        )}

        {/* Fumetto Dispositivi aziendali (solo se aperto da icona in tabella) */}
        {dispositivoAziendaliPopover.show && dispositivoAziendaliPopover.info && createPortal(
          <div
            className="fixed inset-0 z-[100]"
            onClick={() => setDispositivoAziendaliPopover({ show: false, left: 0, top: 0, device: null, info: null })}
            role="presentation"
          >
            <div
              className="absolute bg-white/95 border border-gray-200 rounded-xl shadow-2xl p-4 text-[11px] leading-snug max-w-[960px]"
              style={{ left: popoverSafeLeft, top: dispositivoAziendaliPopover.top, maxWidth: popoverMaxWidth }}
              onClick={(e) => e.stopPropagation()}
            >
              {!popoverHasInfo && (
                <p className="text-gray-500 text-sm">In attesa di dati dall&apos;agent.</p>
              )}
              {popoverHasInfo && (
                <div className="space-y-2">
                  {/* Riga titolo: nome, MAC, badge Online */}
                  <div className="flex items-center gap-2 flex-wrap text-xs font-semibold text-gray-800">
                    <Monitor size={16} className="text-teal-600" />
                    <span>{popoverDeviceInfo.device_name || popoverDeviceInfo.machine_name || '—'}</span>
                    <span className="text-gray-500 text-[10px]">
                      (MAC: {formatMacWithColons(popoverDeviceInfo.mac || '')})
                    </span>
                    {popoverDeviceInfo.real_status === 'online' && (
                      <span className="text-[11px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Online</span>
                    )}
                  </div>

                  {/* Dati principali in tre colonne compatte (come carta Dispositivi aziendali) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] mt-1">
                    <div className="space-y-1 text-gray-700">
                      {popoverDeviceInfo.current_user && (
                        <div>
                          <span className="text-gray-500">Utente:</span>{' '}
                          {popoverDeviceInfo.current_user}
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">IP:</span>{' '}
                        {popoverDeviceInfo.primary_ip || '—'}
                      </div>
                      <div>
                        <span className="text-gray-500">SO:</span>{' '}
                        {popoverDeviceInfo.os_name || '—'}{' '}
                        {popoverDeviceInfo.os_version && `(${popoverDeviceInfo.os_version})`}{' '}
                        {popoverDeviceInfo.os_arch && ` · ${popoverDeviceInfo.os_arch}`}
                      </div>
                      {popoverDeviceInfo.os_install_date && (
                        <div>
                          <span className="text-gray-500">Installato:</span>{' '}
                          {new Date(popoverDeviceInfo.os_install_date).toLocaleDateString('it-IT')}
                        </div>
                      )}
                      {(popoverDeviceInfo.antivirus_name || popoverDeviceInfo.antivirus_state) && (
                        <div>
                          <span className="text-gray-500">AV:</span>{' '}
                          {popoverDeviceInfo.antivirus_name || '—'}{' '}
                          {popoverDeviceInfo.antivirus_state && `· ${popoverDeviceInfo.antivirus_state}`}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 text-gray-700">
                      <div>
                        <span className="text-gray-500">HW:</span>{' '}
                        {popoverDeviceInfo.manufacturer || '—'}{' '}
                        {popoverDeviceInfo.model && `· ${popoverDeviceInfo.model}`}{' '}
                        {popoverDeviceInfo.device_type && `(${popoverDeviceInfo.device_type})`}
                      </div>
                      <div>
                        <span className="text-gray-500">CPU:</span>{' '}
                        {popoverDeviceInfo.cpu_name || '—'}{' '}
                        {popoverDeviceInfo.cpu_cores != null && `· ${popoverDeviceInfo.cpu_cores} core`}{' '}
                        {popoverDeviceInfo.cpu_clock_mhz != null && `· ${popoverDeviceInfo.cpu_clock_mhz} MHz`}
                      </div>
                      <div>
                        <span className="text-gray-500">RAM:</span>{' '}
                        {popoverDeviceInfo.ram_free_gb != null && popoverDeviceInfo.ram_total_gb != null
                          ? `${popoverDeviceInfo.ram_free_gb} / ${popoverDeviceInfo.ram_total_gb} GB liberi`
                          : (popoverDeviceInfo.ram_total_gb != null ? `${popoverDeviceInfo.ram_total_gb} GB` : '—')}
                      </div>
                      {popoverDeviceInfo.gpu_name && (
                        <div>
                          <span className="text-gray-500">GPU:</span>{' '}
                          {popoverDeviceInfo.gpu_name}
                        </div>
                      )}
                      {(popoverDeviceInfo.battery_percent != null || popoverDeviceInfo.battery_status) && (
                        <div>
                          <span className="text-gray-500">Batteria:</span>{' '}
                          {popoverDeviceInfo.battery_status || ''}{' '}
                          {popoverDeviceInfo.battery_percent != null && `${popoverDeviceInfo.battery_percent}%`}{' '}
                          {popoverDeviceInfo.battery_charging && '(in carica)'}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 text-gray-700">
                      <div className="flex items-center gap-1">
                        <HardDrive size={12} className="text-gray-400" />
                        <span className="text-gray-500 font-medium">Archiviazione Dischi:</span>
                      </div>
                      {renderDisksInline(popoverDeviceInfo.disks_json) || (
                        <span className="text-gray-500 text-xs">—</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default NetworkMonitoringDashboard;
