// src/components/NetworkMonitoringDashboard.jsx

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Wifi, WifiOff, Monitor, Server, Printer, Router,
  AlertCircle, AlertTriangle, CheckCircle, Clock, RefreshCw,
  Activity, TrendingUp, TrendingDown, Search,
  Filter, X, Loader, Plus, Download, Server as ServerIcon,
  Trash2, PowerOff, Building, ArrowLeft, ChevronRight, Settings, Edit,
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
import {
  hexToRgba,
  normalizeHex,
  getStoredTechHubAccent,
  readableOnAccent,
  hubEmbeddedRootInlineStyle,
  hubEmbeddedBackBtnInlineStyle
} from '../utils/techHubAccent';

/** Switch virtuali (mappatura UniFi): IP fittizio `virtual-…`. Nascosti in Monitoraggio Rete; i record restano in DB. */
function isVirtualSwitchMonitorRow(device) {
  const ip = String(device?.ip_address ?? '').toLowerCase();
  return ip.startsWith('virtual-');
}

/** Tooltip inline (tabella) nell’Hub embedded: contrasto corretto tema chiaro/scuro. */
const HUB_EMBED_TOOLTIP_NEUTRAL =
  'border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] text-[color:var(--hub-chrome-text-secondary)] shadow-xl';
const HUB_EMBED_TOOLTIP_DANGER =
  'border border-[color:var(--hub-chrome-notice-danger-border)] bg-[color:var(--hub-chrome-notice-danger-bg)] text-[color:var(--hub-chrome-notice-danger-text)] shadow-xl';

/** Chip/badge stati nell’embedded (palette Hub, non `text-*-100` fissi). */
const HUB_EMBED_CHIP_LIVE =
  'border border-[color:var(--hub-chrome-chip-live-border)] bg-[color:var(--hub-chrome-chip-live-bg)] text-[color:var(--hub-chrome-chip-live-text)]';
const HUB_EMBED_CHIP_IDLE =
  'border border-[color:var(--hub-chrome-chip-idle-border)] bg-[color:var(--hub-chrome-chip-idle-bg)] text-[color:var(--hub-chrome-chip-idle-text)]';
const HUB_EMBED_CHIP_CRITICAL =
  'border border-[color:var(--hub-chrome-notice-danger-border)] bg-[color:var(--hub-chrome-badge-critical-bg)] text-[color:var(--hub-chrome-badge-critical-text)]';
const HUB_EMBED_CHIP_WARN_BADGE =
  'border border-[color:var(--hub-chrome-notice-warn-border)] bg-[color:var(--hub-chrome-badge-warn-bg)] text-[color:var(--hub-chrome-badge-warn-text)]';
const HUB_EMBED_BANNER_WARN =
  'border border-[color:var(--hub-chrome-notice-warn-border)] bg-[color:var(--hub-chrome-notice-warn-bg)] text-[color:var(--hub-chrome-notice-warn-text)]';
const HUB_EMBED_CHIP_ORANGE =
  'border border-[color:var(--hub-chrome-notice-warn-border)] bg-[color:var(--hub-chrome-badge-warn-bg)] text-[color:var(--hub-chrome-tone-warn-title)]';
const HUB_EMBED_CHIP_AMBER =
  'border border-[color:var(--hub-chrome-chip-idle-border)] bg-[color:var(--hub-chrome-palette-amber-bg)] text-[color:var(--hub-chrome-palette-amber-fg)]';

const NetworkMonitoringDashboard = ({
  getAuthHeader,
  socket,
  initialView = null,
  onViewReset = null,
  onClose = null,
  onNavigateToMappatura = null,
  onCompanyChange = null,
  initialCompanyId = null,
  readOnly = false,
  currentUser,
  onNavigateOffice,
  onNavigateEmail,
  onNavigateAntiVirus,
  onNavigateDispositiviAziendali,
  onNavigateNetworkMonitoring,
  onNavigateMappatura,
  onNavigateSpeedTest,
  onNavigateVpn,
  onNavigateLSight,
  onNavigateHome,
  onOpenTicket = null,
  embedded = false,
  closeEmbedded = null,
  accentHex: accentHexProp = null
}) => {
  const updateTimeoutRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [changes, setChanges] = useState([]);
  const [recentChangesCount, setRecentChangesCount] = useState(0); // Conteggio cambiamenti ultime 24h dal backend
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  /** Errore dedicato a GET /all/events: non sovrascrive errori su dispositivi/agent e mostra hint + riprova. */
  const [eventsError, setEventsError] = useState(null);
  const [eventsErrorDetail, setEventsErrorDetail] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, online, offline
  const [sortBy, setSortBy] = useState('last_seen'); // last_seen, ip_address, hostname
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [agents, setAgents] = useState([]);
  const [showAgentsList, setShowAgentsList] = useState(false);
  /** Versione letta da GET /agent-version (pacchetto sul VPS), non dalla colonna DB */
  const [serverPackageVersion, setServerPackageVersion] = useState(null);
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
  const companyDevicesFetchSeqRef = useRef(0);
  const companyDevicesAbortRef = useRef(null);
  const selectedCompanyIdRef = useRef(null);
  const agentStatOnlineCardRef = useRef(null);
  const agentStatOfflineCardRef = useRef(null);
  const agentStatPopoverRef = useRef(null);
  const eventiReteSectionRef = useRef(null);
  const [agentStatPopoverMode, setAgentStatPopoverMode] = useState(null); // 'online' | 'offline' | null
  const [agentStatPopoverBox, setAgentStatPopoverBox] = useState({ top: 0, left: 0, width: 280, maxHeight: 320 });

  // Sincronizza lo stato locale con initialCompanyId SOLO se cambia la prop esterna
  // NON includere selectedCompanyId nelle dipendenze: altrimenti ogni click interno
  // sull'azienda (che cambia selectedCompanyId) triggera questo effect che resetta a null
  useEffect(() => {
    const numericId = initialCompanyId ? Number(initialCompanyId) : null;
    setCompanyDevices([]); // Pulisci la lista quando cambia dall'esterno
    setSelectedCompanyId(numericId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCompanyId]); // ← solo la prop esterna, non selectedCompanyId!

  // Traccia sempre l'azienda selezionata per evitare race tra fetch concorrenti
  useEffect(() => {
    selectedCompanyIdRef.current = selectedCompanyId;
  }, [selectedCompanyId]);


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
  useEffect(() => {
    if (!showAgentsList) return undefined;
    let cancelled = false;
    fetch(buildApiUrl('/api/network-monitoring/agent-version'))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && d.version) setServerPackageVersion(String(d.version));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showAgentsList]);

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
      if (!silent) {
        setEventsError(null);
        setEventsErrorDetail(null);
      }
      const searchParam = changesSearchTerm ? `&search=${encodeURIComponent(changesSearchTerm)}` : '';
      const aziendaParam = changesCompanyFilter ? `&azienda_id=${changesCompanyFilter}` : '';
      const networkParam = changesNetworkFilter ? `&network=${encodeURIComponent(changesNetworkFilter)}` : '';
      const eventTypeParam = eventTypeFilter !== 'all' ? `&event_type=${eventTypeFilter}` : '';

      const url = buildApiUrl(
        `/api/network-monitoring/all/events?limit=500&count24h=true${searchParam}${aziendaParam}${networkParam}${eventTypeParam}`
      );

      const retryStatuses = new Set([502, 503, 504]);
      const maxAttempts = 3;
      let response = null;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 450 * 2 ** (attempt - 1)));
        }
        response = await fetch(url, { headers: getAuthHeader() });
        if (response && (response.ok || !retryStatuses.has(response.status))) {
          break;
        }
        if (response) {
          console.warn(`[Monitoraggio rete] /all/events tentativo ${attempt + 1}/${maxAttempts} — HTTP ${response.status}`);
        }
      }

      if (!response || !response.ok) {
        if (!response) {
          const err = new Error('NESSUNA_RISPOSTA');
          err.nmEventsHint = 'Nessuna risposta dal server (rete o CORS). Controlla la connessione.';
          err.nmEventsCode = 0;
          throw err;
        }
        const code = response.status;
        let serverHint = '';
        try {
          const j = await response.clone().json();
          serverHint = (j.details && String(j.details)) || (j.error && String(j.error)) || '';
        } catch {
          try {
            const t = await response.text();
            if (t) serverHint = t.slice(0, 240);
          } catch { /* ignore */ }
        }
        let hint = '';
        if (code === 502 || code === 503 || code === 504) {
          hint =
            'Di solito il proxy (es. Nginx) non riceve risposta dal backend in tempo: verifica sulla VPS che il processo Node sia attivo (pm2/systemd), i log di Nginx (upstream timed out) e, se serve, aumenta proxy_read_timeout.';
        } else if (code === 401) {
          hint = 'Sessione scaduta: effettua di nuovo l’accesso.';
        } else if (code >= 500) {
          hint = serverHint ? `Dettaglio: ${serverHint}` : 'Controlla i log del backend sulla VPS.';
        } else {
          hint = serverHint || `Risposta HTTP ${code}.`;
        }
        const err = new Error(`HTTP_${code}`);
        err.nmEventsHint = hint;
        err.nmEventsCode = code;
        throw err;
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
      setEventsError(null);
      setEventsErrorDetail(null);
    } catch (err) {
      console.error('Errore caricamento eventi:', err);
      if (!silent) {
        if (err && err.nmEventsHint != null) {
          setEventsError(
            err.nmEventsCode
              ? `Caricamento eventi di rete non riuscito (HTTP ${err.nmEventsCode}).`
              : 'Caricamento eventi di rete non riuscito.'
          );
          setEventsErrorDetail(err.nmEventsHint);
        } else {
          setEventsError('Caricamento eventi di rete: errore di rete o risposta non valida.');
          setEventsErrorDetail(err?.message ? String(err.message) : 'Verifica la connessione e riprova.');
        }
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
    const seq = ++companyDevicesFetchSeqRef.current;
    try {
      if (!silent) {
        setLoadingCompanyDevices(true);
      }
      // Annulla eventuale richiesta precedente: evita che una risposta "vecchia" sovrascriva la lista
      try {
        if (companyDevicesAbortRef.current) {
          companyDevicesAbortRef.current.abort();
        }
      } catch { /* ignore */ }
      const controller = new AbortController();
      companyDevicesAbortRef.current = controller;

      const response = await fetch(buildApiUrl(`/api/network-monitoring/clients/${aziendaId}/devices`), {
        headers: getAuthHeader(),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Errore caricamento dispositivi azienda');
      }
      const data = await response.json();
      // Se nel frattempo l'utente ha cambiato azienda (o è partita un'altra fetch), ignora questa risposta
      if (seq !== companyDevicesFetchSeqRef.current) return;
      if (selectedCompanyIdRef.current !== aziendaId) return;

      // 1. Applica subito gli aggiornamenti pendenti ai dati ricevuti (per is_static, notify_telegram, device_type, is_new_device)
      // Escludi switch virtuali (virtual-…) dalla vista: non eliminati dal DB
      const updatedData = applyPendingUpdates(data).filter(d => !isVirtualSwitchMonitorRow(d));

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
      if (err?.name === 'AbortError') {
        return;
      }
      console.error('Errore caricamento dispositivi azienda:', err);
      if (!silent) {
        setError(err.message);
      }
    } finally {
      if (!silent) {
        setLoadingCompanyDevices(false);
      }
    }
  }, [applyPendingUpdates, getAuthHeader]);

  // Aggiorna dati da Keepass e ricarica tutto
  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setEventsError(null);
      setEventsErrorDetail(null);

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

  /** Richiede aggiornamento OTA: flag DB → prossimo heartbeat agent ≥ 2.7.11 scarica dal server */
  const forceAgentUpdate = useCallback(
    async (agentId, agentName) => {
      if (
        !confirm(
          `Richiedere aggiornamento automatico per l'agent "${agentName}"?\n\n` +
            'Al prossimo heartbeat (di solito entro 5 minuti) l’agent scaricherà l’ultimo script dal VPS. ' +
            'Non serve reinstallare manualmente. Agent molto vecchi potrebbero richiedere un aggiornamento una tantum con il pacchetto ZIP.'
        )
      ) {
        return;
      }
      try {
        const response = await fetch(buildApiUrl(`/api/network-monitoring/agent/${agentId}/force-update`), {
          method: 'POST',
          headers: getAuthHeader()
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Errore richiesta aggiornamento');
        }
        alert(data.message || 'Richiesta registrata.');
        loadAgents();
      } catch (err) {
        console.error('forceAgentUpdate:', err);
        alert(`Errore: ${err.message}`);
      }
    },
    [getAuthHeader, loadAgents]
  );

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

  // Refresh "locale" dalla topbar dell'Hub: non ricarica tutta l'app.
  useEffect(() => {
    if (!embedded) return;
    const handler = (e) => {
      const view = e?.detail?.view;
      if (view !== 'network-monitoring') return;
      if (document.visibilityState !== 'visible') return;
      loadDevices(true);
      loadChanges(true);
      if (selectedCompanyId) loadCompanyDevices(selectedCompanyId, true);
    };
    window.addEventListener('hub:refresh', handler);
    return () => window.removeEventListener('hub:refresh', handler);
  }, [embedded, loadDevices, loadChanges, loadCompanyDevices, selectedCompanyId]);

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
      try {
        if (localStorage.getItem('debug_ws') === '1') {
          console.log('📡 Network monitoring update ricevuto:', data);
        }
      } catch (_) {
        // ignore
      }

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
      try {
        if (localStorage.getItem('debug_ws') === '1') {
          console.log('🔔 Agent event ricevuto:', data);
        }
      } catch (_) {
        // ignore
      }

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
    const offCls = embedded ? HUB_EMBED_CHIP_CRITICAL : 'bg-red-100 text-red-800';
    const warnCls = embedded ? HUB_EMBED_CHIP_IDLE : 'bg-yellow-100 text-yellow-800';
    const onCls = embedded ? HUB_EMBED_CHIP_LIVE : 'bg-green-100 text-green-800';
    // Offline: dispositivo completamente irraggiungibile
    if (status === 'offline') {
      return (
        <span className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs ${offCls}`}>
          <WifiOff size={12} />
          Offline
        </span>
      );
    }

    // Online ma non risponde al ping: presente via ARP
    if (status === 'online' && pingResponsive === false) {
      return (
        <span className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs ${warnCls}`}>
          <AlertTriangle size={12} />
          No Ping
        </span>
      );
    }

    // Online con ping responsive: tutto ok
    return (
      <span className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs ${onCls}`}>
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

  /** Online: tempo dall'ultimo scan-results elaborato sulla VPS (timestamp agente, uguale per tutti gli IP di quell'agent). "Ora" = entro ~90s da quell'istante. */
  const formatOnlineScanAge = (batchAt) => {
    if (!batchAt) return null;
    const date = new Date(batchAt);
    if (isNaN(date.getTime())) return null;
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) return 'Ora';
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 90) return 'Ora';
    if (diffMins < 60) return `${diffMins} min`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours} ore`;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 7) return `${diffDays} giorni`;
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /** Offline: solo tempo (la colonna Stato indica già offline). Relativo se recente, altrimenti "dalle HH:mm del gg/mm/aaaa". */
  const formatOfflineScanOnly = (ts) => {
    if (!ts) return '—';
    const date = new Date(ts);
    if (isNaN(date.getTime())) return '—';
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) return '—';
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return '< 1 min';
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours} ore`;
    if (diffDays < 7) return `${diffDays} giorni`;
    const hhmm = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const dmy = date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `dalle ${hhmm} del ${dmy}`;
  };

  /** Colonna Scan: online = età dall'ultimo batch scan sulla VPS; offline = solo durata/data (no ripetizione "Offline"); ⚠ = errore salvataggio */
  const formatScanCell = (device) => {
    if (device.status === 'offline') {
      if (device.offline_since) {
        return formatOfflineScanOnly(device.offline_since);
      }
      return device.last_seen ? formatOfflineScanOnly(device.last_seen) : '—';
    }
    // Stesso agent => stesso riferimento temporale: prima colonna dedicata, poi heartbeat agent (uguale per tutte le righe), MAI solo last_seen per device (sarebbero minuti diversi senza motivo)
    const batchAt = device.last_scan_processed_at || device.agent_last_seen;
    if (!batchAt) return formatDate(device.last_seen) || 'N/A';
    return formatOnlineScanAge(batchAt) || 'N/A';
  };

  const scanCellTitle = (device) => {
    if (device.last_scan_error) {
      return `Errore ultimo salvataggio: ${device.last_scan_error}${device.last_scan_error_at ? ` (${new Date(device.last_scan_error_at).toLocaleString('it-IT')})` : ''}`;
    }
    if (device.status === 'offline') {
      return 'Quanto tempo è offline (da offline_since), oppure ultimo visto se manca offline_since';
    }
    const interval = device.scan_interval_minutes != null ? device.scan_interval_minutes : '—';
    return `Riferimento unico per tutti i device di questo agent: ultimo scan elaborato sulla VPS (last_scan_processed_at), oppure heartbeat agent se la colonna non è ancora valorizzata. Intervallo scan: ${interval} min. «Ora» = entro ~90s da quell’istante. Non usa last_seen per device (evita minuti falsamente diversi).`;
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

  const getUnifiSubtitle = (device) => {
    const keepassTitle = (device?.hostname || '').trim();
    const unifiTitle = (device?.unifi_name || '').trim();
    if (!keepassTitle || !unifiTitle) return '';
    if (keepassTitle.toLowerCase() === unifiTitle.toLowerCase()) return '';
    return unifiTitle;
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
      if (isVirtualSwitchMonitorRow(device)) return false;
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
  const devicesForStatsRaw = (selectedCompanyId && companyDevices.length > 0) ? companyDevices : devices;
  const devicesForStats = devicesForStatsRaw.filter(d => !isVirtualSwitchMonitorRow(d));
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

  const agentsForStatPopover = useMemo(() => {
    if (!agentStatPopoverMode) return [];
    return agents.filter((a) => a.status === agentStatPopoverMode);
  }, [agents, agentStatPopoverMode]);

  /** Agent di questa azienda con scan batch oltre soglia (stesso criterio API GET /agents). */
  const scanLateAgentsForSelectedCompany = useMemo(() => {
    if (!selectedCompanyId) return [];
    return agents.filter(
      (a) => Number(a.azienda_id) === Number(selectedCompanyId) && a.scan_schedule_status === 'late'
    );
  }, [agents, selectedCompanyId]);

  const updateAgentStatPopoverPosition = useCallback(() => {
    if (!agentStatPopoverMode) return;
    const ref = agentStatPopoverMode === 'online' ? agentStatOnlineCardRef : agentStatOfflineCardRef;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const minW = 280;
    const maxH = Math.min(320, Math.max(160, window.innerHeight - 32));
    const gap = 8;
    let width = Math.min(Math.max(minW, r.width), window.innerWidth - 16);
    let left = r.left;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    if (left < 8) left = 8;
    let top = r.bottom + gap;
    if (top + maxH > window.innerHeight - 8) {
      top = r.top - maxH - gap;
    }
    if (top < 8) top = 8;
    setAgentStatPopoverBox({ top, left, width, maxHeight: maxH });
  }, [agentStatPopoverMode]);

  useLayoutEffect(() => {
    if (!agentStatPopoverMode) return;
    updateAgentStatPopoverPosition();
    window.addEventListener('resize', updateAgentStatPopoverPosition);
    return () => window.removeEventListener('resize', updateAgentStatPopoverPosition);
  }, [agentStatPopoverMode, updateAgentStatPopoverPosition]);

  useEffect(() => {
    if (!agentStatPopoverMode) return;
    const close = () => setAgentStatPopoverMode(null);
    const isInsideSafeZone = (target) => {
      if (!(target instanceof Node)) return false;
      if (agentStatPopoverRef.current?.contains(target)) return true;
      if (agentStatOnlineCardRef.current?.contains(target)) return true;
      if (agentStatOfflineCardRef.current?.contains(target)) return true;
      return false;
    };
    // La scrollbar nativa non è sempre nel DOM come figlio: il target del click può essere "sbagliato".
    // Usiamo il rettangolo del popover così scroll e trascinamento barra restano dentro.
    const isPointInsidePopover = (clientX, clientY) => {
      const el = agentStatPopoverRef.current;
      if (!el || clientX == null || clientY == null) return false;
      const r = el.getBoundingClientRect();
      return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
    };
    const onPointerDown = (e) => {
      if (isInsideSafeZone(e.target)) return;
      if (e.type === 'mousedown' && isPointInsidePopover(e.clientX, e.clientY)) return;
      if (e.type === 'touchstart' && e.touches?.length > 0) {
        const t = e.touches[0];
        if (isPointInsidePopover(t.clientX, t.clientY)) return;
      }
      close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('touchstart', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [agentStatPopoverMode]);

  /**
   * Porta in vista il titolo "Eventi di Rete" sotto l'header sticky.
   * Usa scroll-margin + scrollIntoView così il browser applica lo scroll sul contenitore giusto
   * (il calcolo manuale con scrollTop poteva sottostimare lo scroll e fermarsi troppo in alto).
   */
  const scrollToEventiReteSection = useCallback(() => {
    const el = eventiReteSectionRef.current;
    if (!el) return;
    const panel = el.closest('[data-network-monitor-root]');
    let marginPx = 12;
    if (panel) {
      const stickyHeader = panel.querySelector('.sticky.top-0') || panel.querySelector('.sticky');
      if (stickyHeader) {
        marginPx = Math.ceil(stickyHeader.getBoundingClientRect().height) + 12;
      }
    }
    el.style.scrollMarginTop = `${marginPx}px`;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      el.style.scrollMarginTop = '';
    }, 1200);
  }, []);

  // Eventi di Rete: nascosti ai clienti (readOnly) che non hanno agent per l'azienda selezionata
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const selectedCompanyAgentsCount = selectedCompany?.agents_count ?? selectedCompany?.agent_count ?? 0;
  const showEventiDiRete = !readOnly || selectedCompanyAgentsCount > 0;

  const accentEmbedded = useMemo(
    () => normalizeHex(accentHexProp) || getStoredTechHubAccent(),
    [accentHexProp]
  );
  const onEmbeddedHubBack = useCallback(() => {
    if (typeof closeEmbedded === 'function') closeEmbedded();
    else onNavigateHome?.();
  }, [closeEmbedded, onNavigateHome]);
  const embeddedBackBtnStyle = useMemo(() => hubEmbeddedBackBtnInlineStyle(), []);
  const embeddedRootAccentStyle = useMemo(
    () => (embedded ? hubEmbeddedRootInlineStyle(accentEmbedded) : undefined),
    [embedded, accentEmbedded]
  );

  const kpiBtnOnline = embedded
    ? 'rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] p-3 text-left w-full shadow-none transition hover:bg-[color:var(--hub-chrome-hover)] hover:[border-color:var(--hub-accent-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hub-accent)] cursor-pointer'
    : 'bg-white rounded-lg shadow p-4 text-left w-full transition hover:shadow-md hover:ring-2 hover:ring-blue-200/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer';
  const kpiBtnOffline = embedded
    ? 'rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] p-3 text-left w-full shadow-none transition hover:bg-[color:var(--hub-chrome-hover)] hover:[border-color:var(--hub-accent-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70 cursor-pointer'
    : 'bg-white rounded-lg shadow p-4 text-left w-full transition hover:shadow-md hover:ring-2 hover:ring-orange-200/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 cursor-pointer';
  const kpiBtnActivity = embedded
    ? 'rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] p-3 text-left w-full shadow-none transition hover:bg-[color:var(--hub-chrome-hover)] hover:[border-color:var(--hub-accent-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hub-accent)] cursor-pointer'
    : 'bg-white rounded-lg shadow p-4 text-left w-full transition hover:shadow-md hover:ring-2 hover:ring-blue-200/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer';
  const kpiBoxStatic = embedded
    ? 'rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] p-3 shadow-none'
    : 'bg-white rounded-lg shadow p-4';
  const kpiLabelCls = embedded
    ? 'text-xs text-[color:var(--hub-chrome-text-muted)] mb-1 flex items-center gap-1'
    : 'text-sm text-gray-600 mb-1 flex items-center gap-1';
  const kpiSubCls = embedded
    ? 'text-xs text-[color:var(--hub-chrome-text-faint)] mt-1'
    : 'text-xs text-gray-500 mt-1';

  const eHubPanel = embedded
    ? 'mb-4 rounded-2xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] p-4'
    : 'mb-6 rounded-lg bg-white p-6 shadow';
  const eHubPanelFlat = embedded
    ? 'rounded-2xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)]'
    : 'rounded-lg bg-white shadow';
  const eH2 = embedded ? 'text-xl font-bold text-[color:var(--hub-chrome-text)]' : 'text-xl font-bold text-gray-900';
  const eH2semi = embedded ? 'text-xl font-semibold text-[color:var(--hub-chrome-text)]' : 'text-xl font-semibold text-gray-900';
  const eMuted = embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-500';
  const eMutedSm = embedded ? 'text-sm text-[color:var(--hub-chrome-text-muted)]' : 'text-sm text-gray-500';
  const eSelect =
    'min-w-[200px] cursor-pointer appearance-none rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] px-4 py-2.5 pr-10 text-sm font-medium text-[color:var(--hub-chrome-text)] outline-none transition hover:border-[color:var(--hub-chrome-border-soft)] focus:border-[color:var(--hub-accent)] focus:ring-2 focus:ring-[color:var(--hub-accent)]/35';
  const eSelectFull =
    'w-full cursor-pointer appearance-none rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] px-4 py-2.5 pr-10 text-sm font-medium text-[color:var(--hub-chrome-text)] outline-none transition hover:border-[color:var(--hub-chrome-border-soft)] focus:border-[color:var(--hub-accent)] focus:ring-2 focus:ring-[color:var(--hub-accent)]/35';
  const eSelectInline =
    'cursor-pointer rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] px-4 py-2.5 text-sm font-medium text-[color:var(--hub-chrome-text)] outline-none transition hover:border-[color:var(--hub-chrome-border-soft)] focus:ring-2 focus:ring-[color:var(--hub-accent)]/35';
  const embeddedSelectSurfaceStyle = embedded
    ? { backgroundColor: 'var(--hub-chrome-surface)', color: 'var(--hub-chrome-text)' }
    : undefined;
  const embedBtnPrimaryStyle = embedded
    ? { backgroundColor: accentEmbedded, color: readableOnAccent(accentEmbedded) }
    : undefined;
  const eThRow = embedded ? 'border-b border-[color:var(--hub-chrome-border-soft)]' : 'border-b border-gray-200';
  const eTh = embedded
    ? 'py-2 px-4 text-left text-sm font-semibold text-[color:var(--hub-chrome-text-muted)]'
    : 'text-left py-2 px-4 text-sm font-semibold text-gray-700';
  const ipHistoryPopover = embedded
    ? 'absolute left-0 bottom-full z-20 mb-2 hidden w-64 overflow-hidden rounded-md border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] text-xs shadow-xl group-hover:block'
    : 'absolute left-0 bottom-full z-20 mb-2 hidden w-64 overflow-hidden rounded-md border border-gray-200 bg-white text-xs shadow-xl group-hover:block';
  const eTdStrong = embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-900';
  const eTdBody = embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-600';
  const eTdBodyMono = embedded ? 'font-mono text-[color:var(--hub-chrome-text-secondary)]' : 'font-mono text-gray-600';
  const eTdSubtle = embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-500';
  const eUniFiBadge = embedded
    ? 'inline-flex flex-shrink-0 items-center rounded bg-[color:var(--hub-accent)]/18 px-1.5 py-[1px] text-[10px] font-semibold text-[color:var(--hub-accent)]'
    : 'inline-flex flex-shrink-0 items-center rounded bg-indigo-100 px-1.5 py-[1px] text-[10px] font-semibold text-indigo-700';
  const ipCtxMenuCls = embedded
    ? 'min-w-[150px] rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] py-2 shadow-xl'
    : 'min-w-[150px] rounded-lg border border-gray-200 bg-white py-2 shadow-lg';
  const ipCtxBtnCls = embedded
    ? 'flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[color:var(--hub-chrome-text-secondary)] transition-colors hover:bg-[color:var(--hub-chrome-hover)]'
    : 'flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-700';
  const ipCtxBtnPurpleCls = embedded
    ? `${ipCtxBtnCls} hover:text-violet-300`
    : 'flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-purple-50 hover:text-purple-700';
  const ipCtxDividerCls = embedded ? 'my-1 border-t border-[color:var(--hub-chrome-border-soft)]' : 'my-1 border-t border-gray-100';
  const ipCtxTicketCls = embedded
    ? 'flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-[color:var(--hub-chrome-tone-success-title)] transition-colors hover:bg-[color:var(--hub-chrome-muted-fill)]'
    : 'flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-green-700 transition-colors hover:bg-green-50';
  const daPopoverShell = embedded
    ? 'absolute max-w-[960px] rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] p-4 text-[11px] leading-snug shadow-2xl'
    : 'absolute max-w-[960px] rounded-xl border border-gray-200 bg-white/95 p-4 text-[11px] leading-snug shadow-2xl';
  const daPopLbl = embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500';
  const daPopTxt = embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-700';

  const showLegacyStickyHeader = Boolean(onClose) && !embedded;
  const showControlsInScroll = embedded || !onClose;

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
          style={embedded ? embeddedSelectSurfaceStyle : undefined}
          className={
            embedded
              ? eSelect
              : 'min-w-[200px] cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 pr-8 text-gray-700 hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
          }
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
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transform ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-400'}`}
        />
      </div>

      <button
        onClick={() => setAutoRefresh(!autoRefresh)}
        type="button"
        className={`px-4 py-2 rounded-lg flex items-center gap-2 border transition ${
          embedded
            ? autoRefresh
              ? `${HUB_EMBED_CHIP_LIVE} hover:brightness-[1.07]`
              : 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well-mid)] text-[color:var(--hub-chrome-text-muted)] hover:border-[color:var(--hub-chrome-border)] hover:bg-[color:var(--hub-chrome-hover)]'
            : autoRefresh
              ? 'bg-green-100 text-green-800 hover:bg-green-200 border-transparent'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-transparent'
        }`}
      >
        <Activity size={18} />
        Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
      </button>

      <button
        onClick={handleRefresh}
        type="button"
        className={`px-4 py-2 rounded-lg flex items-center gap-2 font-semibold transition ${embedded ? 'hover:brightness-110 disabled:opacity-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        style={embedded ? embedBtnPrimaryStyle : undefined}
        disabled={loading}
        title="Aggiorna dati da Keepass e ricarica dispositivi"
      >
        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        Aggiorna
      </button>

      {/* Pulsante Mappatura */}
      {onNavigateToMappatura && (
        <button
          type="button"
          onClick={() => onNavigateToMappatura(selectedCompanyId)}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 font-semibold border transition ${embedded ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)] hover:[border-color:var(--hub-accent-border)]' : 'bg-purple-600 text-white hover:bg-purple-700 border-transparent'}`}
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
            className={`flex items-center justify-center rounded-lg border p-2 ${embedded ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] text-[color:var(--hub-chrome-text-muted)] hover:border-[color:var(--hub-chrome-border)] hover:bg-[color:var(--hub-chrome-hover)]' : 'bg-white border border-gray-300 hover:bg-gray-100 hover:border-gray-400 text-gray-600'}`}
            title="Opzioni Agent (lista e creazione)"
          >
            <Settings size={18} />
          </button>
          {showAgentControlsMenu && (
            <div
              className={`absolute right-0 z-30 mt-2 w-56 rounded-xl border shadow-2xl ${embedded ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)]' : 'border-gray-200 bg-white rounded-lg shadow-lg'}`}
            >
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
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm ${embedded ? 'text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)]' : 'hover:bg-gray-100'}`}
              >
                <ServerIcon size={16} className={embedded ? 'text-[color:var(--hub-accent)]' : 'text-purple-600'} />
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
                className={`flex w-full items-center gap-2 border-t px-4 py-2.5 text-left text-sm ${embedded ? 'border-[color:var(--hub-chrome-border-soft)] text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)]' : 'hover:bg-gray-100 border-gray-100'}`}
              >
                <Plus size={16} className="text-green-600" />
                <span>Crea Agent</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Versione: pacchetto VPS vs massimo segnalato dagli agent (heartbeat → DB) */}
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

        return (
          <div
            className={`flex min-w-[200px] flex-col gap-1 rounded-lg border px-4 py-2 ${embedded ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)]' : 'border-gray-300 bg-white'}`}
          >
            {serverPackageVersion && (
              <div className={`flex items-center gap-2 text-xs ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : ''}`}>
                <span className={embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}>Pacchetto sul server:</span>
                <span className={`font-mono font-semibold ${embedded ? 'text-emerald-300' : 'text-emerald-700'}`}>{serverPackageVersion}</span>
              </div>
            )}
            {highestVersionAgent && highestVersionAgent.version && (
              <div
                className={`flex items-center gap-2 text-xs ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : ''}`}
                title="Ultima versione inviata via heartbeat (salvata nel DB per ogni agent)"
              >
                <span className={embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}>Max da agent (DB):</span>
                <span className={`font-mono font-semibold ${embedded ? 'text-[color:var(--hub-accent)]' : 'text-blue-600'}`}>
                  {highestVersionAgent.version}
                </span>
              </div>
            )}
          </div>
        );
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
                className={`flex w-full flex-col gap-1 rounded border p-2 text-[10px] ${embedded ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] text-[color:var(--hub-chrome-text-muted)]' : 'border-gray-100 bg-gray-50'}`}
              >
                <div className={`flex justify-between font-medium ${embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-700'}`}>
                  <span>{d.letter ? `Disco ${d.letter}` : 'Disco'}</span>
                  <span>{percent}% in uso</span>
                </div>
                <div className={`h-1.5 w-full overflow-hidden rounded-full ${embedded ? 'bg-[color:var(--hub-chrome-muted-fill)]' : 'bg-gray-200'}`}>
                  <div
                    className={`h-1.5 rounded-full ${
                      percent > 90
                        ? embedded
                          ? 'bg-red-400/90'
                          : 'bg-red-500'
                        : percent > 75
                          ? embedded
                            ? 'bg-amber-400/85'
                            : 'bg-yellow-500'
                          : embedded
                            ? 'bg-[color:var(--hub-accent)]'
                            : 'bg-teal-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className={`flex justify-between text-[9px] ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}`}>
                  <span>Liberi: {d.free_gb} GB</span>
                  <span>Totali: {d.total_gb} GB</span>
                </div>
              </div>
            );
          })}
          {extraCount > 0 && (
            <div className={`text-[9px] ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}`}>
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
    if (embedded) {
      return (
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[color:var(--hub-chrome-border-soft)]"
          style={embeddedRootAccentStyle}
          data-network-monitor-root
        >
          <div className="flex flex-1 items-center justify-center gap-3 p-8 text-[color:var(--hub-chrome-text-secondary)]">
            <Loader className="h-8 w-8 shrink-0 animate-spin" style={{ color: accentEmbedded }} />
            <span>Caricamento dispositivi...</span>
          </div>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 bg-gray-100 z-50 overflow-y-auto" data-network-monitor-root>
        <div className="p-8 flex items-center justify-center min-h-screen">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Caricamento dispositivi...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-network-monitor-root
      style={embedded ? embeddedRootAccentStyle : undefined}
      className={
        embedded
          ? 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[color:var(--hub-chrome-border-soft)]'
          : 'fixed inset-0 bg-gray-100 z-50 overflow-y-auto'
      }
    >
      {showLegacyStickyHeader && (
        <div className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-4">
            <SectionNavMenu
              currentPage="network"
              onNavigateHome={onNavigateHome || onClose}
              onNavigateOffice={onNavigateOffice}
              onNavigateEmail={onNavigateEmail}
              onNavigateAntiVirus={onNavigateAntiVirus}
              onNavigateDispositiviAziendali={onNavigateDispositiviAziendali}
              onNavigateNetworkMonitoring={null}
              onNavigateMappatura={onNavigateMappatura}
              onNavigateSpeedTest={onNavigateSpeedTest}
              onNavigateLSight={onNavigateLSight}
              onNavigateVpn={onNavigateVpn}
              currentUser={currentUser}
              selectedCompanyId={selectedCompanyId}
            />
            <div className="h-6 w-px bg-gray-300"></div>
            <h1 className="font-bold text-xl text-gray-800">Monitoraggio Rete</h1>
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

      {embedded && (
        <div
          className="sticky top-0 z-40 flex shrink-0 flex-wrap items-center gap-2 border-b border-[color:var(--hub-chrome-border)] px-3 py-2.5 sm:gap-3 sm:px-4"
          style={{ backgroundColor: 'var(--hub-chrome-surface)' }}
        >
          <button type="button" onClick={onEmbeddedHubBack} style={embeddedBackBtnStyle} aria-label="Torna alla panoramica Hub">
            <ArrowLeft size={20} aria-hidden />
          </button>
          <div className="hidden h-6 w-px bg-[color:var(--hub-chrome-border)] sm:block" aria-hidden />
          <h1 className="text-base font-bold text-[color:var(--hub-chrome-text)]">Monitoraggio Rete</h1>
          {getAuthHeader && socket ? (
            <div className="flex items-center [&_button]:border-[color:var(--hub-chrome-border)] [&_button]:bg-[color:var(--hub-chrome-well)] [&_button]:text-[color:var(--hub-chrome-text-secondary)]">
              <AgentNotifications getAuthHeader={getAuthHeader} socket={socket} onOpenNetworkMonitoring={null} />
            </div>
          ) : null}
          {readOnly ? (
            <div className="ml-auto flex items-center gap-2 rounded-lg border border-[color:var(--hub-chrome-notice-warn-border)] bg-[color:var(--hub-chrome-notice-warn-bg)] px-2.5 py-1 text-xs font-semibold text-[color:var(--hub-chrome-notice-warn-text)]">
              <Eye size={14} aria-hidden />
              Modalità visualizzazione
            </div>
          ) : null}
        </div>
      )}

      <div className={embedded ? 'flex min-h-0 flex-1 flex-col overflow-y-auto bg-[color:var(--hub-chrome-page)]' : ''}>
        <div className="mx-auto w-full max-w-[98vw] p-4">
          {showControlsInScroll && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                {!onClose && !embedded && (
                  <div>
                    <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900">
                      <Wifi className="h-8 w-8 shrink-0 text-blue-600" />
                      Monitoraggio Rete
                    </h1>
                    <p className="mt-1 text-gray-500">
                      {lastUpdate && `Ultimo aggiornamento: ${formatDate(lastUpdate)}`}
                    </p>
                  </div>
                )}
                {embedded && lastUpdate ? (
                  <p className="text-sm text-[color:var(--hub-chrome-text-faint)]">
                    Ultimo aggiornamento: {formatDate(lastUpdate)}
                  </p>
                ) : null}
              </div>
              {!showLegacyStickyHeader ? (
                <div className="flex flex-wrap items-center gap-3">{controlsSection}</div>
              ) : null}
            </div>
          )}

        {(error || eventsError) && (
          <div
            className={`mb-4 rounded-lg border p-4 ${embedded ? 'border-[color:var(--hub-chrome-msg-error-border)] bg-[color:var(--hub-chrome-msg-error-bg)] text-[color:var(--hub-chrome-msg-error-text)]' : 'border-red-200 bg-red-50 text-red-800'}`}
          >
            <div className="flex flex-wrap items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                {error ? <p className="m-0 font-medium leading-snug">{error}</p> : null}
                {eventsError ? (
                  <div
                    className={
                      error
                        ? embedded
                          ? 'border-t border-[color:var(--hub-chrome-msg-error-border)] pt-2'
                          : 'border-t border-red-200 pt-2'
                        : ''
                    }
                  >
                    <p className="m-0 font-medium leading-snug">{eventsError}</p>
                    {eventsErrorDetail ? (
                      <p className={`mt-1.5 text-sm leading-relaxed ${embedded ? 'opacity-95' : 'text-red-900/90'}`}>
                        {eventsErrorDetail}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => loadChanges(false)}
                      className={
                        embedded
                          ? 'mt-2 rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] px-3 py-1.5 text-sm font-semibold text-[color:var(--hub-chrome-text)] hover:bg-[color:var(--hub-chrome-hover)]'
                          : 'mt-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-900 hover:bg-red-50'
                      }
                    >
                      Riprova caricamento eventi
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Lista Agent Esistenti (solo per tecnici, nascosta in readOnly) */}
        {!readOnly && showAgentsList && (
          <div className={eHubPanel}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className={`${eH2} flex items-center gap-2`}>
                <ServerIcon size={24} className={embedded ? 'text-[color:var(--hub-accent)]' : 'text-purple-600'} />
                Agent Registrati
              </h2>
              <button
                onClick={() => setShowAgentsList(false)}
                type="button"
                className={`rounded-lg p-2 ${embedded ? 'text-[color:var(--hub-chrome-text-faint)] hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <X size={20} />
              </button>
            </div>

            {(() => {
              const lateAgents = agents.filter((a) => a.scan_schedule_status === 'late');
              if (lateAgents.length === 0) return null;
              return (
                <div
                  className={`mb-4 flex flex-wrap items-start gap-2 rounded-lg border p-3 text-sm ${embedded ? 'border-[color:var(--hub-chrome-notice-warn-border)] bg-[color:var(--hub-chrome-notice-warn-bg)] text-[color:var(--hub-chrome-notice-warn-text)]' : 'border-orange-200 bg-orange-50 text-orange-900'}`}
                >
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <strong>Scan in ritardo:</strong> {lateAgents.length}{' '}
                    {lateAgents.length === 1 ? 'agent non rispetta' : 'agent non rispettano'} la pianificazione attesa
                    (ultimo batch sulla VPS oltre la soglia: intervallo scan × tolleranza, default ×3). Verifica PC
                    agent, rete e versione backend.
                  </div>
                </div>
              );
            })()}

            {agents.length === 0 ? (
              <p className={`py-4 text-center ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}`}>
                Nessun agent registrato
              </p>
            ) : (
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className={`rounded-lg border p-4 ${embedded ? 'border-[color:var(--hub-chrome-border)] hover:bg-[color:var(--hub-chrome-hover)]' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className={`font-semibold ${embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-900'}`}>
                            {agent.agent_name || `Agent #${agent.id}`}
                          </h3>
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${
                              agent.status === 'online'
                                ? embedded
                                  ? HUB_EMBED_CHIP_LIVE
                                  : 'bg-green-100 text-green-800'
                                : agent.status === 'offline'
                                  ? embedded
                                    ? HUB_EMBED_CHIP_CRITICAL
                                    : 'bg-red-100 text-red-800'
                                  : embedded
                                    ? 'border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-chrome-text-muted)]'
                                    : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {agent.status || 'unknown'}
                          </span>
                        </div>
                        <div className={`mt-2 space-y-1 text-sm ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}>
                          <p>
                            <strong>Azienda:</strong>{' '}
                            {agent.azienda || 'N/A'}
                            {agent.azienda_ip_statico && (
                              <>
                                {' '}
                                (
                                <span
                                  className={`cursor-pointer font-mono hover:underline ${embedded ? 'text-[color:var(--hub-accent)]' : 'text-blue-600'}`}
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
                                <label
                                  className={`mb-1 block text-xs font-medium ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-700'}`}
                                >
                                  Nome Agent:
                                </label>
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
                                <label
                                  className={`mb-1 block text-xs font-medium ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-700'}`}
                                >
                                  Reti (una per riga, formato: 192.168.1.0/24):
                                </label>
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
                                <label
                                  className={`mb-1 block text-xs font-medium ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-700'}`}
                                >
                                  Intervallo Scansione (minuti):
                                </label>
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
                              <p>
                                <strong>Versione (heartbeat → DB):</strong>{' '}
                                <span
                                  className={`font-mono font-semibold ${embedded ? 'text-[color:var(--hub-accent)]' : 'text-blue-600'}`}
                                >
                                  {agent.version || 'N/A'}
                                </span>
                                {agent.pending_agent_update && (
                                  <span
                                    className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${embedded ? HUB_EMBED_CHIP_AMBER : 'bg-amber-100 text-amber-700'}`}
                                  >
                                    aggiornamento richiesto
                                  </span>
                                )}
                              </p>
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
                              {agent.last_scan_processed_at && (
                                <p>
                                  <strong>Ultimo batch scan (VPS):</strong>{' '}
                                  {formatDate(new Date(agent.last_scan_processed_at))}
                                  {agent.minutes_since_scan_batch != null && (
                                    <span className={embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}>
                                      {' '}
                                      (≈ {agent.minutes_since_scan_batch} min fa)
                                    </span>
                                  )}
                                </p>
                              )}
                              <p>
                                <strong>Ultimo heartbeat:</strong>{' '}
                                {agent.last_heartbeat ? formatDate(new Date(agent.last_heartbeat)) : 'Mai'}
                                {agent.minutes_since_heartbeat != null && (
                                  <span className={embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}>
                                    {' '}
                                    (≈ {agent.minutes_since_heartbeat} min fa)
                                  </span>
                                )}
                              </p>
                              {agent.scan_schedule_status && (
                                <p className="mt-1 flex flex-wrap items-center gap-2">
                                  <span className={`font-semibold ${embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-800'}`}>
                                    Pianificazione scan:
                                  </span>
                                  <span
                                    title={agent.scan_schedule_detail || ''}
                                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                                      embedded
                                        ? agent.scan_schedule_status === 'ok'
                                          ? HUB_EMBED_CHIP_LIVE
                                          : agent.scan_schedule_status === 'late'
                                            ? HUB_EMBED_CHIP_ORANGE
                                            : agent.scan_schedule_status === 'warn'
                                              ? HUB_EMBED_CHIP_IDLE
                                              : agent.scan_schedule_status === 'agent_offline'
                                                ? 'border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-chrome-text-muted)]'
                                                : agent.scan_schedule_status === 'disabled'
                                                  ? 'border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-chrome-text-fainter)]'
                                                  : 'border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-chrome-text-muted)]'
                                        : agent.scan_schedule_status === 'ok'
                                          ? 'bg-green-100 text-green-800'
                                          : agent.scan_schedule_status === 'late'
                                            ? 'bg-orange-100 text-orange-800'
                                            : agent.scan_schedule_status === 'warn'
                                              ? 'bg-amber-100 text-amber-900'
                                              : agent.scan_schedule_status === 'agent_offline'
                                                ? 'bg-gray-100 text-gray-600'
                                                : agent.scan_schedule_status === 'disabled'
                                                  ? 'bg-gray-100 text-gray-500'
                                                  : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {agent.scan_schedule_status === 'ok' && 'Rispettata (entro soglia)'}
                                    {agent.scan_schedule_status === 'late' && (
                                      <>
                                        In ritardo <Clock size={12} className="inline" />
                                      </>
                                    )}
                                    {agent.scan_schedule_status === 'warn' && 'Da verificare (batch non tracciato)'}
                                    {agent.scan_schedule_status === 'agent_offline' && 'N/D — agent offline'}
                                    {agent.scan_schedule_status === 'disabled' && 'N/D — agent disabilitato'}
                                    {agent.scan_schedule_status === 'unknown' && 'Dati insufficienti'}
                                  </span>
                                  {agent.scan_late_threshold_minutes != null && agent.scan_schedule_status !== 'disabled' && agent.scan_schedule_status !== 'agent_offline' && (
                                    <span className={`text-xs ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}`}>
                                      soglia {agent.scan_late_threshold_minutes} min
                                      {agent.scan_schedule_tolerance_multiplier != null
                                        ? ` (${agent.scan_schedule_tolerance_multiplier}× intervallo)`
                                        : ''}
                                    </span>
                                  )}
                                </p>
                              )}
                              {agent.scan_pipeline_suspect && (
                                <p
                                  className={`mt-2 rounded border px-2 py-1.5 text-xs leading-snug ${embedded ? HUB_EMBED_BANNER_WARN : 'border-amber-200 bg-amber-50 text-amber-900'}`}
                                >
                                  <strong>Diagnosi:</strong> l&apos;heartbeat è più recente dell&apos;ultimo batch scan di{' '}
                                  {agent.heartbeat_newer_than_scan_minutes != null
                                    ? `~${agent.heartbeat_newer_than_scan_minutes} min`
                                    : 'diversi minuti'}
                                  . È probabile che <span className="font-mono text-[11px]">POST scan-results</span> non
                                  completi (timeout 30s, 413, 502/500) o che il backend si fermi prima dell&apos;UPDATE del
                                  batch. Controllare sul PC il log del servizio e sulla VPS{' '}
                                  <span className="font-mono text-[11px]">journalctl / pm2</span> per{' '}
                                  <span className="font-mono text-[11px]">Errore ricezione scan results</span> e nginx{' '}
                                  <span className="font-mono text-[11px]">client_max_body_size</span>.
                                </p>
                              )}
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

                            {/* Fila 2: Aggiorna da server, Pacchetto, Diagnostica */}
                            <div className="flex flex-row gap-1">
                              <button
                                type="button"
                                onClick={() => forceAgentUpdate(agent.id, agent.agent_name)}
                                disabled={readOnly}
                                className={`flex-1 py-1.5 rounded flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm ${
                                  readOnly
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-teal-600 text-white hover:bg-teal-700'
                                }`}
                                title="Chiede all'agent di scaricare l'ultima versione dal VPS al prossimo heartbeat (senza reinstallare)"
                              >
                                <RefreshCw size={13} />
                                Agg. OTA
                              </button>
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
          <div className={eHubPanel}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className={`${eH2} flex items-center gap-2`}>
                <AlertTriangle size={24} className={embedded ? 'text-amber-300/90' : 'text-yellow-600'} />
                Notifiche Agent
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadAgentEvents({ limit: 200, unreadOnly: false })}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${embedded ? 'border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  disabled={agentEventsLoading}
                  title="Aggiorna notifiche"
                >
                  <RefreshCw size={14} className={agentEventsLoading ? 'animate-spin' : ''} />
                  Aggiorna
                </button>
                <button
                  onClick={clearAllAgentNotifications}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition hover:brightness-110 disabled:opacity-50 ${embedded ? '' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  style={embedded ? embedBtnPrimaryStyle : undefined}
                  title="Segna tutte come lette (lo storico resta)"
                >
                  <Trash2 size={14} />
                  Segna tutte lette
                </button>
                <button
                  onClick={() => setShowAgentNotificationsList(false)}
                  className={`rounded-lg p-1.5 ${embedded ? 'text-[color:var(--hub-chrome-text-faint)] hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-400 hover:text-gray-600'}`}
                  title="Chiudi"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filtri */}
            <div className="grid grid-cols-1 gap-2 mb-3 md:grid-cols-4">
              <select
                value={agentEventsFilters.azienda}
                onChange={(e) => setAgentEventsFilters(prev => ({ ...prev, azienda: e.target.value }))}
                style={embeddedSelectSurfaceStyle}
                className={
                  embedded
                    ? `${eSelectFull} !w-full px-3 py-1.5 text-xs`
                    : 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700'
                }
              >
                <option value="">Tutte le aziende</option>
                {companies.map(c => (
                  <option key={c.id} value={c.azienda}>{c.azienda}</option>
                ))}
              </select>

              <select
                value={agentEventsFilters.agentId}
                onChange={(e) => setAgentEventsFilters(prev => ({ ...prev, agentId: e.target.value }))}
                style={embeddedSelectSurfaceStyle}
                className={
                  embedded
                    ? `${eSelectFull} !w-full px-3 py-1.5 text-xs`
                    : 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700'
                }
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
                style={embeddedSelectSurfaceStyle}
                className={
                  embedded
                    ? `${eSelectFull} !w-full px-3 py-1.5 text-xs`
                    : 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700'
                }
              >
                <option value="">Tutti i tipi</option>
                <option value="offline">Offline</option>
                <option value="online">Online</option>
                <option value="reboot">Riavvio</option>
                <option value="network_issue">Problema rete</option>
              </select>

              <div className="flex items-center gap-2">
                <label className={`flex items-center gap-2 text-xs ${embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-700'}`}>
                  <input
                    type="checkbox"
                    checked={agentEventsFilters.unreadOnly}
                    onChange={(e) => setAgentEventsFilters(prev => ({ ...prev, unreadOnly: e.target.checked }))}
                  />
                  Solo non lette
                </label>
                <div className="relative flex-1">
                  <Search
                    size={14}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-400'}`}
                  />
                  <input
                    value={agentEventsFilters.search}
                    onChange={(e) => setAgentEventsFilters(prev => ({ ...prev, search: e.target.value }))}
                    placeholder="Cerca..."
                    className={
                      embedded
                        ? 'w-full rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] py-1.5 pl-8 pr-3 text-xs text-[color:var(--hub-chrome-text)] outline-none placeholder:text-[color:var(--hub-chrome-placeholder)]'
                        : 'w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm'
                    }
                  />
                </div>
              </div>
            </div>

            {agentEventsError && (
              <div
                className={`mb-4 rounded border p-3 text-sm ${embedded ? 'border-[color:var(--hub-chrome-msg-error-border)] bg-[color:var(--hub-chrome-msg-error-bg)] text-[color:var(--hub-chrome-msg-error-text)]' : 'border-red-200 bg-red-50 text-red-800'}`}
              >
                {agentEventsError}
              </div>
            )}

            {/* Lista */}
            {agentEventsLoading ? (
              <div
                className={`flex items-center justify-center py-8 ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}
              >
                <Loader
                  className="mr-2 h-5 w-5 animate-spin"
                  style={embedded ? { color: accentEmbedded } : undefined}
                />
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
                return (
                  <div className={`py-8 text-center ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}`}>
                    Nessuna notifica
                  </div>
                );
              }

              return (
                <div
                  className={`divide-y overflow-hidden rounded-lg border ${embedded ? 'divide-[color:var(--hub-chrome-border-soft)] border-[color:var(--hub-chrome-border)]' : 'divide-gray-200 border-gray-200'}`}
                >
                  {filtered.map(ev => {
                    const isUnread = !ev.is_read;
                    const typeCls =
                      ev.event_type === 'offline'
                        ? embedded
                          ? HUB_EMBED_CHIP_CRITICAL
                          : 'bg-red-100 text-red-800'
                        : ev.event_type === 'online'
                          ? embedded
                            ? HUB_EMBED_CHIP_LIVE
                            : 'bg-green-100 text-green-800'
                          : ev.event_type === 'reboot'
                            ? embedded
                              ? 'border border-[color:var(--hub-accent-border)] bg-[color:var(--hub-accent)]/14 text-[color:var(--hub-chrome-text-secondary)]'
                              : 'bg-blue-100 text-blue-800'
                            : ev.event_type === 'network_issue'
                              ? embedded
                                ? HUB_EMBED_CHIP_IDLE
                                : 'bg-yellow-100 text-yellow-800'
                              : embedded
                                ? 'border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-chrome-text-muted)]'
                                : 'bg-gray-100 text-gray-800';
                    return (
                      <div
                        key={ev.id}
                        className={`flex items-start justify-between gap-3 p-3 ${embedded ? 'hover:bg-[color:var(--hub-chrome-hover)]' : 'hover:bg-gray-50'} ${
                          isUnread
                            ? embedded
                              ? 'bg-[color:var(--hub-accent)]/[0.07]'
                              : 'bg-blue-50'
                            : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${typeCls}`}>
                              {ev.event_type}
                            </span>
                            {isUnread && (
                              <span
                                className={`text-[11px] font-semibold ${embedded ? 'text-[color:var(--hub-accent)]' : 'text-blue-700'}`}
                              >
                                NON LETTA
                              </span>
                            )}
                          </div>
                          <div
                            className={`truncate text-[13px] font-medium ${embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-900'}`}
                          >
                            {getAgentEventLabel(ev)}
                          </div>
                          <div className={`mt-0.5 text-[11px] ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}`}>
                            {ev.detected_at ? formatDate(ev.detected_at) : 'N/A'}
                            {ev.azienda ? ` • ${ev.azienda}` : ''}
                            {ev.agent_name ? ` • ${ev.agent_name}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!ev.is_read && (
                            <button
                              onClick={() => markAgentEventAsRead(ev.id)}
                              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition hover:brightness-110 ${embedded ? '' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                              style={embedded ? embedBtnPrimaryStyle : undefined}
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

        {/* Statistiche: prima lo stato degli agent (salute del monitoraggio), poi attività, poi dispositivi */}
        <div className="grid grid-cols-1 gap-3 mb-4 md:grid-cols-3 lg:grid-cols-5">
          <button
            type="button"
            ref={agentStatOnlineCardRef}
            onClick={(e) => {
              e.stopPropagation();
              setAgentStatPopoverMode((prev) => (prev === 'online' ? null : 'online'));
            }}
            className={kpiBtnOnline}
            title="Agent connessi — clic per l'elenco"
          >
            <div className={kpiLabelCls}>
              <ServerIcon size={16} className={embedded ? 'text-[color:var(--hub-accent)]' : 'text-blue-600'} />
              Agent Online
            </div>
            <div className={`text-2xl font-bold ${embedded ? 'text-[color:var(--hub-accent)]' : 'text-blue-600'}`}>
              {stats.agentsOnline}
            </div>
            <div className={kpiSubCls}>di {stats.agentsTotal} totali</div>
          </button>
          <button
            type="button"
            ref={agentStatOfflineCardRef}
            onClick={(e) => {
              e.stopPropagation();
              setAgentStatPopoverMode((prev) => (prev === 'offline' ? null : 'offline'));
            }}
            className={kpiBtnOffline}
            title="Agent non in contatto — clic per l'elenco"
          >
            <div className={kpiLabelCls}>
              <WifiOff size={16} className={embedded ? 'text-orange-400' : 'text-orange-600'} />
              Agent Offline
            </div>
            <div className={`text-2xl font-bold ${embedded ? 'text-orange-400' : 'text-orange-600'}`}>
              {stats.agentsOffline}
            </div>
            <div className={kpiSubCls}>di {stats.agentsTotal} totali</div>
          </button>
          <button
            type="button"
            onClick={scrollToEventiReteSection}
            className={kpiBtnActivity}
            title="Vai alla sezione Eventi di Rete"
          >
            <div className={kpiLabelCls}>
              <Activity size={16} className={embedded ? 'text-[color:var(--hub-accent)]' : 'text-blue-600'} />
              Cambiamenti (Oggi)
            </div>
            <div className={`text-2xl font-bold ${embedded ? 'text-[color:var(--hub-accent)]' : 'text-blue-600'}`}>
              {stats.recentChanges}
            </div>
          </button>
          <div className={kpiBoxStatic} title="Dispositivi di rete rilevati come raggiungibili">
            <div className={kpiLabelCls}>
              <CheckCircle size={16} className={embedded ? 'text-emerald-400' : 'text-green-600'} />
              Dispositivi Online
            </div>
            <div className={`text-2xl font-bold ${embedded ? 'text-emerald-400' : 'text-green-600'}`}>{stats.online}</div>
          </div>
          <div className={kpiBoxStatic} title="Dispositivi di rete non raggiungibili o segnalati offline">
            <div className={kpiLabelCls}>
              <WifiOff size={16} className={embedded ? 'text-red-400' : 'text-red-600'} />
              Dispositivi Offline
            </div>
            <div className={`text-2xl font-bold ${embedded ? 'text-red-400' : 'text-red-600'}`}>{stats.offline}</div>
          </div>
        </div>

        {agentStatPopoverMode && createPortal(
          <div
            ref={agentStatPopoverRef}
            role="dialog"
            aria-label={agentStatPopoverMode === 'online' ? 'Elenco agent online' : 'Elenco agent offline'}
            className={`flex flex-col animate-in fade-in zoom-in-95 rounded-xl shadow-2xl ring-1 duration-150 ${embedded ? 'border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)] shadow-black/50 ring-black/40' : 'border-gray-200/90 bg-white ring-black/[0.04] shadow-gray-400/20'}`}
            style={{
              position: 'fixed',
              top: agentStatPopoverBox.top,
              left: agentStatPopoverBox.left,
              width: agentStatPopoverBox.width,
              maxHeight: agentStatPopoverBox.maxHeight,
              zIndex: 10060
            }}
          >
            <div
              className={`flex shrink-0 items-center justify-between border-b px-3 py-2.5 ${
                embedded
                  ? agentStatPopoverMode === 'online'
                    ? 'border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-accent)]/12'
                    : 'border-[color:var(--hub-chrome-border-soft)] bg-orange-500/12'
                  : agentStatPopoverMode === 'online'
                    ? 'border-gray-100/80 bg-gradient-to-r from-blue-50 to-white'
                    : 'border-gray-100/80 bg-gradient-to-r from-orange-50 to-white'
              }`}
            >
              <span className={`text-sm font-semibold ${embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-800'}`}>
                {agentStatPopoverMode === 'online' ? 'Agent online' : 'Agent offline'}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums ${embedded ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] text-[color:var(--hub-chrome-text-muted)]' : 'border-gray-100 bg-white/80 text-gray-500'}`}
              >
                {agentsForStatPopover.length}
              </span>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
              {agentsForStatPopover.length === 0 ? (
                <li className={`px-3 py-6 text-center text-sm ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}`}>
                  Nessun agent in questo stato
                </li>
              ) : (
                agentsForStatPopover.map((agent) => (
                  <li
                    key={agent.id}
                    className={`border-b px-3 py-2.5 transition-colors last:border-0 ${embedded ? 'border-[color:var(--hub-chrome-border-soft)] hover:bg-[color:var(--hub-chrome-hover)]' : 'border-gray-50 hover:bg-gray-50/80'}`}
                  >
                    <div className={`text-sm font-medium leading-snug ${embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-900'}`}>
                      {agent.agent_name || `Agent #${agent.id}`}
                    </div>
                    {agent.azienda && (
                      <div
                        className={`mt-1 truncate text-xs ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}`}
                        title={agent.azienda}
                      >
                        {agent.azienda}
                      </div>
                    )}
                    <div className={`mt-1 text-[11px] ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-400'}`}>
                      Heartbeat: {agent.last_heartbeat ? formatDate(new Date(agent.last_heartbeat)) : 'Mai'}
                    </div>
                  </li>
                ))
              )}
            </ul>
            <p
              className={`shrink-0 border-t px-3 py-1.5 text-[10px] ${embedded ? 'border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-well-mid)] text-[color:var(--hub-chrome-text-fainter)]' : 'border-gray-50 bg-gray-50/50 text-gray-400'}`}
            >
              Chiudi: clic fuori o Esc
            </p>
          </div>,
          document.body
        )}

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
          <div className={embedded ? `${eHubPanelFlat} mb-4 overflow-hidden` : eHubPanel}>
            <div
              className={
                embedded
                  ? 'flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--hub-chrome-border-soft)] px-4 py-3'
                  : 'mb-4 flex items-center justify-between'
              }
            >
              <h2 className={`${eH2} flex items-center gap-2`}>
                <Building size={embedded ? 20 : 24} className={embedded ? 'text-[color:var(--hub-accent)]' : 'text-purple-600'} />
                {companies.find(c => c.id === selectedCompanyId)?.azienda || 'Dispositivi'}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetPingFailures}
                  disabled={readOnly}
                  className={`mr-2 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors ${readOnly
                    ? embedded
                      ? 'cursor-not-allowed border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-row-fill)] text-[color:var(--hub-chrome-text-fainter)]'
                      : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                    : embedded
                      ? `${HUB_EMBED_CHIP_ORANGE} hover:brightness-[1.06]`
                      : 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100'
                    }`}
                  title={readOnly ? 'Non disponibile in modalità visualizzazione' : "Resetta l'avviso di 'Disconnessioni rilevate' per tutti i dispositivi di questa azienda"}
                >
                  <Activity size={embedded ? 16 : 18} />
                  <span className="text-xs font-medium">Reset Errori</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPingFailuresOnly(!showPingFailuresOnly)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors ${showPingFailuresOnly
                    ? embedded
                      ? `${HUB_EMBED_CHIP_CRITICAL} hover:brightness-[1.06]`
                      : 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                    : embedded
                      ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well-mid)] text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)]'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  title={showPingFailuresOnly ? 'Mostra tutti' : 'Mostra solo con disconnessioni'}
                >
                  <AlertTriangle
                    size={embedded ? 16 : 18}
                    className={
                      showPingFailuresOnly
                        ? embedded
                          ? 'text-[color:var(--hub-chrome-tone-danger-icon)]'
                          : 'text-red-700'
                        : embedded
                          ? 'text-[color:var(--hub-chrome-text-faint)]'
                          : 'text-gray-400'
                    }
                  />
                  <span className="text-xs font-medium">Disconnessioni rilevate</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowOfflineDevices(!showOfflineDevices)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors ${showOfflineDevices
                    ? embedded
                      ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)]'
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                    : embedded
                      ? 'border-[color:var(--hub-accent-border)] bg-[color:var(--hub-accent)]/14 text-[color:var(--hub-chrome-text)] hover:bg-[color:var(--hub-accent)]/22'
                      : 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                    }`}
                  title={showOfflineDevices ? 'Nascondi dispositivi offline' : 'Mostra dispositivi offline'}
                >
                  {showOfflineDevices ? (
                    <>
                      <EyeOff size={embedded ? 16 : 18} />
                      <span className="text-xs font-medium">Nascondi Offline</span>
                    </>
                  ) : (
                    <>
                      <Eye size={embedded ? 16 : 18} />
                      <span className="text-xs font-medium">Mostra Offline</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={generatePrintableReport}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors ${embedded ? `${HUB_EMBED_CHIP_LIVE} hover:brightness-[1.06] disabled:opacity-40` : 'bg-green-50 border border-green-300 text-green-700 hover:bg-green-100 disabled:opacity-40'}`}
                  title="Genera report stampabile (include tutti i dispositivi)"
                  disabled={companyDevices.length === 0}
                >
                  <FileText size={embedded ? 16 : 18} />
                  <span className="text-xs font-medium">Report Stampabile</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCompanyId(null)}
                  className={`ml-1 rounded-lg p-1.5 transition-colors ${embedded ? 'text-[color:var(--hub-chrome-text-faint)] hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-chrome-text)]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                  title="Chiudi vista azienda"
                >
                  <X size={embedded ? 20 : 24} />
                </button>
              </div>
            </div>
            <div className={embedded ? 'p-4' : ''}>
            {scanLateAgentsForSelectedCompany.length > 0 && (
              <div
                className={`mb-4 flex flex-wrap items-start gap-2 rounded-lg border p-3 text-sm ${embedded ? HUB_EMBED_BANNER_WARN : 'border-amber-200 bg-amber-50 text-amber-900'}`}
              >
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Agent in ritardo su questa azienda:</strong>{' '}
                  {scanLateAgentsForSelectedCompany.map((a) => a.agent_name || `#${a.id}`).join(', ')}.
                  L&apos;ultimo batch scan sulla VPS supera la soglia (intervallo × tolleranza, default ×3). Apri la
                  lista <strong>Agent registrati</strong> per i dettagli o verifica PC agent e rete.
                </div>
              </div>
            )}
            {loadingCompanyDevices ? (
              <div className="flex items-center justify-center p-8">
                <Loader className={`h-8 w-8 animate-spin ${embedded ? '' : 'text-blue-600'}`} style={embedded ? { color: accentEmbedded } : undefined} />
                <span className={`ml-3 ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}>Caricamento dispositivi...</span>
              </div>
            ) : (() => {
              // Filtra i dispositivi in base al toggle (switch virtuali già esclusi da loadCompanyDevices)
              const filteredDevices = companyDevices.filter(device =>
                !isVirtualSwitchMonitorRow(device) &&
                (showOfflineDevices || device.status === 'online') &&
                (!showPingFailuresOnly || device.has_ping_failures)
              );

              if (companyDevices.length === 0) {
                return <p className={`py-4 text-center ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}`}>Nessun dispositivo trovato per questa azienda</p>;
              }

              if (filteredDevices.length === 0) {
                return (
                  <p className={`py-4 text-center ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}`}>
                    Nessun dispositivo online. Attiva "Mostra Offline" per vedere tutti i dispositivi.
                  </p>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={eThRow}>
                        <th className={`${eTh} whitespace-nowrap`}>Opzioni</th>
                        <th className={`${eTh} min-w-[5rem]`} title="Tipo / Online-Offline"></th>
                        <th className={`${eTh} whitespace-nowrap`}>IP</th>
                        <th className={`${eTh} whitespace-nowrap`}>MAC</th>
                        <th className={`${eTh} max-w-[11rem] truncate`} title="Titolo (switch virtuali accorciati)">Titolo</th>
                        <th className={`${eTh} whitespace-nowrap`}>Utente</th>
                        <th className={`${eTh} whitespace-nowrap`}>Percorso</th>
                        <th className={`${eTh} w-10 text-center whitespace-nowrap`} title="Aggiornamento firmware disponibile (UniFi)">FW</th>
                        <th
                          className={`${eTh} min-w-[5.5rem] whitespace-nowrap`}
                          title="Online: minuti dall’ultimo scan elaborato sulla VPS (uguale per tutti gli IP dello stesso agent). Offline: da quanto è offline. ⚠ = errore salvataggio."
                        >
                          Scan
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDevices.map((device) => {
                        const isStatic = device.is_static === true;
                        return (
                          <tr
                            key={device.id}
                            className={`${embedded ? 'border-b border-[color:var(--hub-chrome-border-soft)]' : 'border-b border-gray-100'} ${embedded ? 'hover:bg-[color:var(--hub-chrome-hover)]' : 'hover:bg-gray-50'} ${
                              isStatic
                                ? embedded
                                  ? 'bg-[color:var(--hub-accent)]/[0.08] hover:bg-[color:var(--hub-accent)]/[0.13]'
                                  : 'bg-blue-50 hover:bg-blue-100'
                                : ''
                            }`}
                          >
                            {/* 1. Opzioni (Statico / Notifica) - su 2 righe */}
                            <td className="py-1 px-3">
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
                                    className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <span className={`text-xs ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600'}`}>Statico</span>
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
                                    className="w-3.5 h-3.5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                  />
                                  <span
                                    className={`text-xs cursor-pointer flex items-center gap-0.5 ${embedded ? 'text-[color:var(--hub-chrome-text-muted)] hover:text-[color:var(--hub-accent)]' : 'text-gray-600 hover:text-blue-600'}`}
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
                            <td className="py-1 px-3 min-w-[5rem] align-top">
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
                                    className={`inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded p-1 transition-colors ${embedded ? 'hover:bg-[color:var(--hub-chrome-hover)]' : 'hover:bg-gray-200'}`}
                                    title="Clicca per cambiare tipo dispositivo (si aggiorna anche in Mappatura)"
                                  >
                                    {getDeviceIcon(device.device_type, 18, embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-600')}
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
                                  const daAgentOnline = String(info?.real_status || '').toLowerCase() === 'online';
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setDispositivoAziendaliPopover({ show: true, left: rect.left, top: rect.bottom + 6, device, info });
                                      }}
                                      className={`inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded p-1 transition-colors ${
                                        daAgentOnline
                                          ? embedded
                                            ? 'text-[color:var(--hub-chrome-palette-emerald-fg)] hover:bg-[color:var(--hub-chrome-chip-live-bg)]'
                                            : 'text-teal-600 hover:bg-teal-100'
                                          : embedded
                                            ? 'text-[color:var(--hub-chrome-placeholder)] hover:bg-[color:var(--hub-chrome-hover)]'
                                            : 'text-gray-400 hover:bg-gray-100'
                                      }`}
                                      title={
                                        daAgentOnline
                                          ? 'Dispositivi aziendali: agent online (heartbeat recente)'
                                          : 'Dispositivi aziendali: agent offline o senza heartbeat recente (il PC può risultare online in monitoraggio rete)'
                                      }
                                    >
                                      <MonitorSmartphone className="w-4 h-4" />
                                    </button>
                                  );
                                })()}
                              </div>
                            </td>
                            {/* 3. IP */}
                            <td className={`py-1 px-4 text-sm font-mono whitespace-nowrap ${embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-900'}`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">

                                  {device.previous_ip && (
                                    <div className="flex items-center gap-1">
                                      <div className="relative group">
                                        <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                                        <div
                                          className={`absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 rounded border py-1 px-2 text-xs whitespace-nowrap ${embedded ? HUB_EMBED_TOOLTIP_NEUTRAL : 'border-transparent bg-gray-900 text-white shadow-lg'}`}
                                        >
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
                                      <History
                                        className={`h-4 w-4 cursor-help ${embedded ? 'text-[color:var(--hub-accent)]/85 hover:text-[color:var(--hub-accent)]' : 'text-blue-400 hover:text-blue-600'}`}
                                      />
                                      <div className={`${ipHistoryPopover} w-64 rounded-md`}>
                                        <div
                                          className={`border-b px-3 py-2 text-xs font-semibold ${embedded ? 'border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-well)] text-[color:var(--hub-chrome-text-muted)]' : 'border-gray-100 bg-gray-50 text-gray-700'}`}
                                        >
                                          Storico IP
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                          {(Array.isArray(device.ip_history) ? device.ip_history : JSON.parse(device.ip_history || '[]'))
                                            .slice()
                                            .reverse()
                                            .map((h, idx) => (
                                              <div
                                                key={idx}
                                                className={`flex items-center justify-between border-b px-3 py-2 ${embedded ? 'border-[color:var(--hub-chrome-border-soft)] hover:bg-[color:var(--hub-chrome-hover)]' : 'border-gray-50 hover:bg-blue-50'}`}
                                              >
                                                <span className={`font-mono ${embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-800'}`}>{h.ip}</span>
                                                <span className={`text-[10px] ${embedded ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-gray-500'}`}>{formatDate(h.seen_at)}</span>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                   {/* Indicatore Disconnessioni Frequenti (Flapping/Instabilità) */}
                                  {device.has_ping_failures && (
                                    <div className="relative group shrink-0">
                                      <div 
                                        className="w-4 h-4 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-sm cursor-help animate-pulse"
                                        title="Instabilità: Rilevate più di 5 disconnessioni in 24h"
                                      >
                                        +
                                      </div>
                                      <div
                                        className={`absolute left-0 bottom-full mb-2 hidden group-hover:block z-30 rounded py-1 px-2 text-[10px] whitespace-nowrap ${embedded ? HUB_EMBED_TOOLTIP_DANGER : 'border border-red-400 bg-red-900 text-white shadow-xl'}`}
                                      >
                                        Instabilità: Rilevate più di 5 disconnessioni in 24h
                                      </div>
                                    </div>
                                  )}

                                  <span
                                    onClick={(e) => handleIpClick(e, device.ip_address, device)}
                                    className={`cursor-pointer transition-colors hover:underline ${embedded ? 'hover:text-[color:var(--hub-accent)]' : 'hover:text-blue-600'}`}
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
                                      <span className={`text-xs ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-300'}`}>↳</span>
                                      <span
                                        onClick={(e) => handleIpClick(e, ip, device)}
                                        className={`cursor-pointer text-sm transition-colors hover:underline ${embedded ? 'text-[color:var(--hub-chrome-text-muted)] hover:text-[color:var(--hub-accent)]' : 'text-gray-500 hover:text-blue-600'}`}
                                        title="IP Secondario (stesso MAC Address)"
                                      >
                                        {ip}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </td>
                            {/* 4. MAC */}
                            <td className={`py-1 px-4 whitespace-nowrap text-sm ${eTdBodyMono}`}>
                              <div className="flex items-center gap-2">
                                {/* Warning: MAC cambiato (storico previous_mac) */}
                                {device.previous_mac && (
                                  <div className="flex items-center gap-1">
                                    <div className="relative group">
                                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                                      <div
                                        className={`absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 rounded py-1 px-2 text-xs whitespace-nowrap ${embedded ? HUB_EMBED_TOOLTIP_NEUTRAL : 'border-transparent bg-gray-900 text-white shadow-lg'}`}
                                      >
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
                                    <div
                                      className={`absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 rounded py-1 px-2 text-xs max-w-xs ${embedded ? HUB_EMBED_TOOLTIP_NEUTRAL : 'border-transparent bg-gray-900 text-white shadow-lg'}`}
                                    >
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
                                  <span
                                    className={
                                      newDevicesInList.has(device.id)
                                        ? embedded
                                          ? `rounded px-1 font-bold ${HUB_EMBED_CHIP_AMBER}`
                                          : 'rounded bg-yellow-100 px-1 font-bold'
                                        : ''
                                    }
                                    title={
                                      device.keepass_outside_azienda ? "Dati da KeePass fuori dal percorso dell'azienda" : undefined
                                    }
                                  >
                                    {device.mac_address ? device.mac_address.replace(/-/g, ':') : '-'}
                                    {device.keepass_outside_azienda && (
                                      <span
                                        className={`font-bold ${embedded ? 'text-[color:var(--hub-chrome-palette-amber-fg)]' : 'text-amber-600'}`}
                                        title="Dati da KeePass fuori dal percorso dell'azienda"
                                      >
                                        {' *'}
                                      </span>
                                    )}
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
                                      className={`ml-1 rounded-full border p-0.5 transition-colors shadow-sm ${embedded ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-chrome-text-faint)] hover:bg-[color:var(--hub-chrome-chip-live-bg)] hover:text-[color:var(--hub-chrome-chip-live-text)]' : 'border-gray-200 bg-white text-slate-400 hover:bg-green-50 hover:text-green-600'}`}
                                      title="Conferma visione nuovo dispositivo"
                                    >
                                      <HelpCircle className="w-4 h-4 p-0.5" />
                                    </button>
                                  )}
                                  {device.keepass_model && (
                                    <div
                                      className={`absolute left-0 bottom-full mb-1 hidden group-hover:block z-20 rounded px-2 py-1 text-[10px] max-w-xs ${embedded ? HUB_EMBED_TOOLTIP_NEUTRAL : 'border-transparent bg-gray-900 text-white shadow-lg'}`}
                                    >
                                      Modello: {device.keepass_model}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className={`py-1 px-3 text-sm max-w-[11rem] ${eTdBody}`} title={device.hostname || '-'}>
                              {(() => {
                                const macNorm = normalizeMac(device.mac_address);
                                const deviceIp = device.ip_address?.trim();
                                let hasMatch = false;
                                let matchValue = null;
                                const titleValue = getDisplayTitle(device);
                                const unifiSubtitle = getUnifiSubtitle(device);
                                const hasUnifiName = !!(device?.unifi_name && String(device.unifi_name).trim());
                                const titleContent = (
                                  <span className="block max-w-[11rem]">
                                    <span className="flex items-center gap-1 min-w-0">
                                      {hasUnifiName && <span className={`${eUniFiBadge} flex-shrink-0`}>UniFi</span>}
                                      <span className="block truncate min-w-0">{titleValue}</span>
                                    </span>
                                    {unifiSubtitle && (
                                      <span className="mt-0.5 flex items-center gap-1 min-w-0 pl-[2px]">
                                        <span className={`block min-w-0 truncate text-[11px] ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-500'}`}>
                                          {unifiSubtitle}
                                        </span>
                                      </span>
                                    )}
                                  </span>
                                );

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
                                      className={`w-full text-left transition-colors hover:underline ${embedded ? 'text-[color:var(--hub-accent)] hover:text-[color:var(--hub-chrome-text)]' : 'text-blue-600 hover:text-blue-800'}`}
                                      title="Vai al dispositivo in Dispositivi aziendali"
                                    >
                                      {titleContent}
                                    </button>
                                  );
                                }
                                return titleContent;
                              })()}
                            </td>
                            <td className={`py-1 px-3 whitespace-nowrap text-sm ${eTdBody}`}>{device.device_username || '-'}</td>
                            <td
                              className={`max-w-[8rem] truncate py-1 px-3 whitespace-nowrap text-sm ${eTdBody}`}
                              title={device.device_path || '-'}
                            >
                              {device.device_path || '-'}
                            </td>
                            <td className="py-1 px-2 text-center whitespace-nowrap">
                              {device.upgrade_available && (
                                <div className="flex justify-center" title="Aggiornamento Firmware Disponibile">
                                  <ArrowUpCircle
                                    className={`h-5 w-5 ${embedded ? 'text-[color:var(--hub-accent)]' : 'text-blue-600'}`}
                                  />
                                </div>
                              )}
                            </td>
                            <td
                              className={`min-w-[5.5rem] whitespace-nowrap py-1 px-3 text-sm ${eTdSubtle}`}
                              title={scanCellTitle(device)}
                            >
                              <span className="inline-flex items-center gap-1">
                                {formatScanCell(device)}
                                {device.last_scan_error && (
                                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden />
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
            </div>
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
              className={`fixed z-50 py-2 ${ipCtxMenuCls}`}
              style={{
                left: `${ipContextMenu.x}px`,
                top: `${ipContextMenu.y}px`,
                transform: 'translate(-50%, 10px)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => handleTerminalPing(ipContextMenu.ip)}
                className={ipCtxBtnCls}
              >
                <Terminal size={16} />
                Ping
              </button>
              <button
                onClick={() => handleWeb(ipContextMenu.ip)}
                className={ipCtxBtnCls}
              >
                <Monitor size={16} />
                Web
              </button>
              <button
                onClick={() => handleRemoteDesktop(ipContextMenu.ip)}
                className={ipCtxBtnPurpleCls}
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
                    const params = new URLSearchParams(window.location.search);
                    params.set('deviceId', String(id));
                    params.set('deviceLabel', deviceLabel);
                    params.set('returnView', 'network-monitoring');
                    const nextUrl = `${window.location.pathname}?${params.toString()}#device-analysis`;
                    window.history.pushState(null, '', nextUrl);
                    window.dispatchEvent(new Event('ticketapp-sync-hash'));
                    closeIpContextMenu();
                  }}
                  className={ipCtxBtnCls}
                >
                  <Activity size={16} />
                  Analisi dispositivo
                </button>
              )}
              {/* Crea ticket da dispositivo */}
              {onOpenTicket && (
                <>
                  <div className={ipCtxDividerCls} />
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
                    className={ipCtxTicketCls}
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
          <div className={embedded ? `${eHubPanelFlat} overflow-hidden` : 'rounded-lg bg-white shadow'}>
            <div className={`px-4 py-3 ${embedded ? 'border-b border-[color:var(--hub-chrome-border-soft)]' : 'border-b border-gray-200'}`}>
              <div
                ref={eventiReteSectionRef}
                className="mb-3 flex items-center justify-between"
              >
                <h2 className={eH2semi}>Eventi di Rete</h2>
                <span className={embedded ? 'text-xs text-[color:var(--hub-chrome-text-muted)]' : 'text-xs text-gray-500'}>
                  {changes.length} totali
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                {/* Filtro Azienda */}
                <div className="relative">
                  <select
                    value={changesCompanyFilter || ''}
                    onChange={(e) => {
                      const companyId = e.target.value ? parseInt(e.target.value) : null;
                      setChangesCompanyFilter(companyId);
                    }}
                    style={embeddedSelectSurfaceStyle}
                    className={
                      embedded
                        ? eSelectFull
                        : 'w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 pr-8 text-sm text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    }
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
                    className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transform ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-400'}`}
                  />
                </div>

                {/* Filtro Rete (visibile solo se azienda selezionata e reti disponibili) */}
                {changesCompanyFilter && availableNetworks.length > 0 && (
                  <div className="relative">
                    <select
                      value={changesNetworkFilter}
                      onChange={(e) => setChangesNetworkFilter(e.target.value)}
                      style={embeddedSelectSurfaceStyle}
                      className={
                        embedded
                          ? eSelectFull
                          : 'w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 pr-8 text-sm text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
                      }
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
                      className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transform ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-400'}`}
                    />
                  </div>
                )}

                {/* Filtro Tipo Evento */}
                <select
                  value={eventTypeFilter}
                  onChange={(e) => setEventTypeFilter(e.target.value)}
                  style={embeddedSelectSurfaceStyle}
                  className={
                    embedded
                      ? `${eSelectInline} min-w-0 md:w-auto py-1.5 text-xs`
                      : 'cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  }
                >
                  <option value="all">Tutti gli Eventi</option>
                  <option value="device">Solo Dispositivi</option>
                  <option value="agent">Solo Agent</option>
                </select>

                {/* Barra di ricerca */}
                <div className="relative md:col-span-2">
                  <Search
                    className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-400'}`}
                  />
                  <input
                    type="text"
                    placeholder="Cerca (IP, MAC, hostname, agent...)"
                    value={changesSearchTerm}
                    onChange={(e) => setChangesSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadChanges(false)}
                    className={
                      embedded
                        ? 'w-full rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] py-1.5 pl-10 pr-10 text-xs text-[color:var(--hub-chrome-text)] outline-none placeholder:text-[color:var(--hub-chrome-placeholder)] focus:ring-2 focus:ring-[color:var(--hub-accent)]'
                        : 'w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                    }
                  />
                  {changesSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setChangesSearchTerm('');
                        loadChanges(false);
                      }}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 transform ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)] hover:text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4">
              {changes.length === 0 ? (
                <div className="py-12 text-center">
                  <Activity className={`mx-auto mb-4 h-12 w-12 ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-400'}`} />
                  <p className={`text-lg ${embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-500'}`}>Nessun evento rilevato</p>
                  <p className={`mt-2 text-sm ${embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-400'}`}>Gli eventi di rete verranno visualizzati qui</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1200px]">
                    <thead>
                      <tr className={eThRow}>
                        <th
                          className={`${eTh} w-10 py-3 px-2`}
                          title="Tipo dispositivo (solo se riconosciuto)"
                        ></th>
                        <th className={`${eTh} px-3 py-2 text-xs`}>Tipo Evento</th>
                        <th className={`${eTh} px-3 py-2 text-xs`}>IP</th>
                        <th className={`${eTh} px-3 py-2 text-xs`}>MAC</th>
                        <th className={`${eTh} px-3 py-2 text-xs`}>Hostname</th>
                        <th className={`${eTh} px-3 py-2 text-xs`}>Prod.</th>
                        <th className={`${eTh} px-3 py-2 text-xs`}>Titolo</th>
                        <th className={`${eTh} px-3 py-2 text-xs`}>Azienda</th>
                        <th className={`${eTh} px-3 py-2 text-xs`}>Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.slice(0, 50).map((change) => {
                        const isStatic = change.is_static === true;
                        const isAgent = change.event_category === 'agent';
                        return (
                          <tr
                            key={`${change.event_category || 'device'}-${change.id}`}
                            className={`${embedded ? 'border-b border-[color:var(--hub-chrome-border-soft)] hover:bg-[color:var(--hub-chrome-hover)]' : 'border-b border-gray-100 hover:bg-gray-50'} ${
                              isStatic
                                ? embedded
                                  ? 'bg-[color:var(--hub-accent)]/[0.08] hover:bg-[color:var(--hub-accent)]/[0.13]'
                                  : 'bg-blue-50 hover:bg-blue-100'
                                : ''
                            } ${change.severity === 'critical' ? (embedded ? 'bg-red-500/12' : 'bg-red-50') : ''}`}
                          >
                            {/* Icona tipo dispositivo: solo per eventi dispositivo con device_type riconosciuto */}
                            <td className="py-2 px-2 w-10 whitespace-nowrap align-middle">
                              {!isAgent && change.device_type && String(change.device_type).trim() !== '' ? (
                                <span className="inline-flex items-center justify-center" title={change.device_type}>
                                  {getDeviceIcon(change.device_type, 16, embedded ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-gray-500')}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {(() => {
                                const actualEventType = change.event_type || change.change_type;
                                const actualCategory = change.event_category || 'device';
                                const isNewDevice = change.is_new_device;

                                // Configurazione badge per eventi dispositivi (senza icone)
                                const deviceBadges = embedded
                                  ? {
                                      new_device: {
                                        label: 'Nuovo',
                                        bg: 'bg-[color:var(--hub-chrome-chip-live-bg)]',
                                        text: 'text-[color:var(--hub-chrome-chip-live-text)]',
                                        border: 'border-[color:var(--hub-chrome-chip-live-border)]'
                                      },
                                      device_online: {
                                        label: isNewDevice ? 'Nuovo' : 'Online',
                                        bg: isNewDevice ? 'bg-[color:var(--hub-chrome-chip-live-bg)]' : 'bg-[color:var(--hub-accent)]/14',
                                        text: isNewDevice ? 'text-[color:var(--hub-chrome-chip-live-text)]' : 'text-[color:var(--hub-chrome-text-secondary)]',
                                        border: isNewDevice ? 'border-[color:var(--hub-chrome-chip-live-border)]' : 'border-[color:var(--hub-accent-border)]'
                                      },
                                      device_offline: {
                                        label: 'Offline',
                                        bg: 'bg-[color:var(--hub-chrome-badge-critical-bg)]',
                                        text: 'text-[color:var(--hub-chrome-badge-critical-text)]',
                                        border: 'border-[color:var(--hub-chrome-notice-danger-border)]'
                                      },
                                      ip_changed: {
                                        label: 'IP Cambiato (Statico)',
                                        bg: 'bg-[color:var(--hub-chrome-badge-warn-bg)]',
                                        text: 'text-[color:var(--hub-chrome-tone-warn-title)]',
                                        border: 'border-[color:var(--hub-chrome-notice-warn-border)]'
                                      },
                                      mac_changed: {
                                        label: 'MAC Cambiato',
                                        bg: 'bg-[color:var(--hub-chrome-badge-warn-bg)]',
                                        text: 'text-[color:var(--hub-chrome-tone-warn-title)]',
                                        border: 'border-[color:var(--hub-chrome-notice-warn-border)]'
                                      },
                                      ip_conflict: {
                                        label: 'Conflitto IP',
                                        bg: 'bg-[color:var(--hub-chrome-palette-amber-bg)]',
                                        text: 'text-[color:var(--hub-chrome-palette-amber-fg)]',
                                        border: 'border-[color:var(--hub-chrome-chip-idle-border)]'
                                      },
                                      hostname_changed: {
                                        label: 'Hostname Cambiato',
                                        bg: 'bg-[color:var(--hub-chrome-chip-idle-bg)]',
                                        text: 'text-[color:var(--hub-chrome-chip-idle-text)]',
                                        border: 'border-[color:var(--hub-chrome-chip-idle-border)]'
                                      }
                                    }
                                  : {
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
                                const agentBadges = embedded
                                  ? {
                                      offline: {
                                        label: 'Agent Off.',
                                        bg: 'bg-[color:var(--hub-chrome-badge-critical-bg)]',
                                        text: 'text-[color:var(--hub-chrome-badge-critical-text)]',
                                        border: 'border-[color:var(--hub-chrome-notice-danger-border)]'
                                      },
                                      online: {
                                        label: 'Agent Online',
                                        bg: 'bg-[color:var(--hub-chrome-chip-live-bg)]',
                                        text: 'text-[color:var(--hub-chrome-chip-live-text)]',
                                        border: 'border-[color:var(--hub-chrome-chip-live-border)]'
                                      },
                                      reboot: {
                                        label: 'Agent Riavviato',
                                        bg: 'bg-[color:var(--hub-chrome-palette-violet-bg)]',
                                        text: 'text-[color:var(--hub-chrome-palette-violet-fg)]',
                                        border: 'border-[color:var(--hub-chrome-border)]'
                                      },
                                      network_issue: {
                                        label: 'Problema Rete',
                                        bg: 'bg-[color:var(--hub-chrome-chip-idle-bg)]',
                                        text: 'text-[color:var(--hub-chrome-chip-idle-text)]',
                                        border: 'border-[color:var(--hub-chrome-chip-idle-border)]'
                                      }
                                    }
                                  : {
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
                                  bg: embedded ? 'bg-[color:var(--hub-chrome-muted-fill)]' : 'bg-gray-100',
                                  text: embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-800',
                                  border: embedded ? 'border-[color:var(--hub-chrome-border)]' : 'border-gray-300'
                                };

                                return (
                                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg} ${badge.text} ${badge.border} whitespace-nowrap`}>
                                    {badge.label}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <div className={`text-[13px] font-medium ${eTdStrong}`}>
                                <div className="flex items-center gap-2">
                                  {/* Indicatore disconnessioni frequenti */}
                                  {change.has_ping_failures && (
                                    <div className="relative group flex items-center">
                                      <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                                        <span className="text-white text-xs font-bold leading-none">+</span>
                                      </div>
                                      <div
                                        className={`absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 rounded py-1 px-2 text-xs whitespace-nowrap ${embedded ? HUB_EMBED_TOOLTIP_NEUTRAL : 'border-transparent bg-gray-900 text-white shadow-lg'}`}
                                      >
                                        Disconnessioni frequenti rilevate
                                      </div>
                                    </div>
                                  )}

                                  {/* IP Address */}
                                  {change.ip_address ? (
                                    <span
                                      onClick={(e) => handleIpClick(e, change.ip_address, change)}
                                      className={`cursor-pointer transition-colors hover:underline ${embedded ? 'hover:text-[color:var(--hub-accent)]' : 'hover:text-blue-600'}`}
                                      title="Clicca per opzioni"
                                    >
                                      {change.ip_address}
                                    </span>
                                  ) : (isAgent ? '-' : 'N/A')}

                                  {isStatic && (
                                    <span
                                      className={`ml-2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${embedded ? 'border border-[color:var(--hub-accent)]/40 bg-[color:var(--hub-accent)]/20 text-[color:var(--hub-accent)]' : 'bg-blue-200 text-blue-800'}`}
                                    >
                                      STATICO
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className={`py-2 px-3 text-xs font-mono whitespace-nowrap ${eTdBody}`}>
                              <div className="group relative inline-flex items-center">
                                <span>
                                  {change.mac_address ? change.mac_address.replace(/-/g, ':') : '-'}
                                </span>
                                {change.keepass_model && (
                                  <div
                                    className={`absolute left-0 bottom-full mb-1 hidden group-hover:block z-20 rounded px-2 py-1 text-[10px] max-w-xs ${embedded ? HUB_EMBED_TOOLTIP_NEUTRAL : 'border-transparent bg-gray-900 text-white shadow-lg'}`}
                                  >
                                    Modello: {change.keepass_model}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className={`py-2 px-3 whitespace-nowrap text-xs ${eTdBody}`}>
                              {change.hostname || '-'}
                            </td>
                            <td className={`py-2 px-3 whitespace-nowrap text-xs ${eTdBody}`}>
                              {change.device_type || '-'}
                            </td>
                            <td className={`py-2 px-3 whitespace-nowrap text-xs ${eTdBody}`}>
                              <span title={change.keepass_username ? `Utente: ${change.keepass_username}` : ''}>
                                {change.hostname || change.keepass_title || change.device_path || change.vendor || '-'}
                              </span>
                            </td>
                            <td className={`py-2 px-3 whitespace-nowrap text-xs ${eTdBody}`}>
                              {change.azienda ? (
                                <span
                                  onClick={(e) => {
                                    // Previene propagazione e aziona lo scroll/selezione
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (change.azienda_id) {
                                      const numericId = parseInt(change.azienda_id, 10);
                                      setCompanyDevices([]); // Svuota immediatamente
                                      setSelectedCompanyId(numericId);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                      
                                      // Prova a scrollare vari container tipici
                                      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
                                      document.body.scrollTo({ top: 0, behavior: 'smooth' });
                                      const containers = document.querySelectorAll('.overflow-y-auto, main');
                                      containers.forEach(c => c.scrollTo({ top: 0, behavior: 'smooth' }));
                                    }
                                  }}
                                  className={`cursor-pointer transition-colors hover:underline ${embedded ? 'hover:text-[color:var(--hub-accent)]' : 'hover:text-blue-600'}`}
                                  title="Vedi dispositivi azienda"
                                >
                                  {change.azienda}
                                </span>
                              ) : 'N/A'}
                            </td>
                            <td className={`whitespace-nowrap py-2 px-3 text-xs ${eTdSubtle}`}>
                              {formatDate(change.detected_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {changes.length > 50 && (
                    <div
                      className={`border-t py-4 text-center text-sm ${embedded ? 'border-[color:var(--hub-chrome-border-soft)] text-[color:var(--hub-chrome-text-faint)]' : 'border-gray-200 text-gray-500'}`}
                    >
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
              <div
                className={`fixed inset-0 z-20 ${embedded ? 'bg-[color:var(--hub-chrome-hidden-mask)]' : 'bg-black/20'}`}
                aria-hidden="true"
                onClick={() => { setDeviceTypePickerDeviceId(null); setDeviceTypePickerAnchor(null); }}
              />
              <div
                className={`fixed z-30 w-[560px] max-w-[95vw] rounded-xl border p-3 shadow-2xl ${embedded ? 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-surface)]' : 'border-gray-200 bg-white'}`}
                style={{ left: Math.min(deviceTypePickerAnchor.left, window.innerWidth - 580), top: Math.min(deviceTypePickerAnchor.top, window.innerHeight - 350) }}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className={`text-sm font-semibold ${embedded ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-700'}`}>Tipo dispositivo</p>
                  <button
                    type="button"
                    onClick={() => { setDeviceTypePickerDeviceId(null); setDeviceTypePickerAnchor(null); }}
                    className={`text-lg font-bold leading-none ${embedded ? 'text-[color:var(--hub-chrome-text-faint)] hover:text-[color:var(--hub-chrome-text-secondary)]' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Chiudi"
                  >
                    &times;
                  </button>
                </div>
                <div className="grid max-h-[360px] grid-cols-6 gap-1.5 overflow-y-auto pr-1">
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
                        className={`flex flex-col items-center justify-start gap-1 rounded-lg p-1.5 transition-all ${isSelected ? (embedded ? 'bg-[color:var(--hub-accent)]/22 text-[color:var(--hub-chrome-text)] ring-2 ring-[color:var(--hub-accent)]' : 'bg-blue-100 text-blue-700 ring-2 ring-blue-500') : embedded ? 'border border-transparent bg-transparent text-[color:var(--hub-chrome-text-muted)] hover:border-[color:var(--hub-chrome-border)] hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-chrome-text)]' : 'border border-transparent bg-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-100 hover:text-gray-900'}`}
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
              className={daPopoverShell}
              style={{
                left: popoverSafeLeft,
                top: dispositivoAziendaliPopover.top,
                maxWidth: popoverMaxWidth,
                ...(embedded ? { backgroundColor: 'var(--hub-chrome-surface)' } : undefined)
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {!popoverHasInfo && (
                <p className={`text-sm ${daPopLbl}`}>In attesa di dati dall&apos;agent.</p>
              )}
              {popoverHasInfo && (
                <div className="space-y-2">
                  {/* Riga titolo: nome, MAC, badge Online */}
                  <div
                    className={`flex flex-wrap items-center gap-2 text-xs font-semibold ${embedded ? 'text-[color:var(--hub-chrome-text)]' : 'text-gray-800'}`}
                  >
                    <Monitor size={16} className={embedded ? 'text-[color:var(--hub-chrome-palette-emerald-fg)]' : 'text-teal-600'} />
                    <span>{popoverDeviceInfo.device_name || popoverDeviceInfo.machine_name || '—'}</span>
                    <span className={`text-[10px] ${daPopLbl}`}>
                      (MAC: {formatMacWithColons(popoverDeviceInfo.mac || '')})
                    </span>
                    {popoverDeviceInfo.real_status === 'online' && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] ${embedded ? HUB_EMBED_CHIP_LIVE : 'bg-green-100 text-green-700'}`}
                      >
                        Online
                      </span>
                    )}
                  </div>

                  {/* Dati principali in tre colonne compatte (come carta Dispositivi aziendali) */}
                  <div className="mt-1 grid grid-cols-1 gap-4 text-[11px] md:grid-cols-3">
                    <div className={`space-y-1 ${daPopTxt}`}>
                      {popoverDeviceInfo.current_user && (
                        <div>
                          <span className={daPopLbl}>Utente:</span>{' '}
                          {popoverDeviceInfo.current_user}
                        </div>
                      )}
                      <div>
                        <span className={daPopLbl}>IP:</span>{' '}
                        {popoverDeviceInfo.primary_ip || '—'}
                      </div>
                      <div>
                        <span className={daPopLbl}>SO:</span>{' '}
                        {popoverDeviceInfo.os_name || '—'}{' '}
                        {popoverDeviceInfo.os_version && `(${popoverDeviceInfo.os_version})`}{' '}
                        {popoverDeviceInfo.os_arch && ` · ${popoverDeviceInfo.os_arch}`}
                      </div>
                      {popoverDeviceInfo.os_install_date && (
                        <div>
                          <span className={daPopLbl}>Installato:</span>{' '}
                          {new Date(popoverDeviceInfo.os_install_date).toLocaleDateString('it-IT')}
                        </div>
                      )}
                      {(popoverDeviceInfo.antivirus_name || popoverDeviceInfo.antivirus_state) && (
                        <div>
                          <span className={daPopLbl}>AV:</span>{' '}
                          {popoverDeviceInfo.antivirus_name || '—'}{' '}
                          {popoverDeviceInfo.antivirus_state && `· ${popoverDeviceInfo.antivirus_state}`}
                        </div>
                      )}
                    </div>

                    <div className={`space-y-1 ${daPopTxt}`}>
                      <div>
                        <span className={daPopLbl}>HW:</span>{' '}
                        {popoverDeviceInfo.manufacturer || '—'}{' '}
                        {popoverDeviceInfo.model && `· ${popoverDeviceInfo.model}`}{' '}
                        {popoverDeviceInfo.device_type && `(${popoverDeviceInfo.device_type})`}
                      </div>
                      <div>
                        <span className={daPopLbl}>CPU:</span>{' '}
                        {popoverDeviceInfo.cpu_name || '—'}{' '}
                        {popoverDeviceInfo.cpu_cores != null && `· ${popoverDeviceInfo.cpu_cores} core`}{' '}
                        {popoverDeviceInfo.cpu_clock_mhz != null && `· ${popoverDeviceInfo.cpu_clock_mhz} MHz`}
                      </div>
                      <div>
                        <span className={daPopLbl}>RAM:</span>{' '}
                        {popoverDeviceInfo.ram_free_gb != null && popoverDeviceInfo.ram_total_gb != null
                          ? `${popoverDeviceInfo.ram_free_gb} / ${popoverDeviceInfo.ram_total_gb} GB liberi`
                          : (popoverDeviceInfo.ram_total_gb != null ? `${popoverDeviceInfo.ram_total_gb} GB` : '—')}
                      </div>
                      {popoverDeviceInfo.gpu_name && (
                        <div>
                          <span className={daPopLbl}>GPU:</span>{' '}
                          {popoverDeviceInfo.gpu_name}
                        </div>
                      )}
                      {(popoverDeviceInfo.battery_percent != null || popoverDeviceInfo.battery_status) && (
                        <div>
                          <span className={daPopLbl}>Batteria:</span>{' '}
                          {popoverDeviceInfo.battery_status || ''}{' '}
                          {popoverDeviceInfo.battery_percent != null && `${popoverDeviceInfo.battery_percent}%`}{' '}
                          {popoverDeviceInfo.battery_charging && '(in carica)'}
                        </div>
                      )}
                    </div>

                    <div className={`space-y-1 ${daPopTxt}`}>
                      <div className="flex items-center gap-1">
                        <HardDrive size={12} className={embedded ? 'text-[color:var(--hub-chrome-text-fainter)]' : 'text-gray-400'} />
                        <span className={`font-medium ${daPopLbl}`}>Archiviazione Dischi:</span>
                      </div>
                      {renderDisksInline(popoverDeviceInfo.disks_json) || (
                        <span className={`text-xs ${daPopLbl}`}>—</span>
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
    </div>
  );
};

export default NetworkMonitoringDashboard;
