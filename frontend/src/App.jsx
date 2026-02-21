// src/App.jsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Notification from './components/AppNotification';
import LoginScreen from './components/LoginScreen';
import Header from './components/Header';
import TicketListContainer from './components/TicketListContainer';
import Dashboard from './components/Dashboard';
import AllModals from './components/Modals/AllModals';
import ManageClientsModal from './components/Modals/ManageClientsModal';
import NewClientModal from './components/Modals/NewClientModal';
import NewTicketModal from './components/Modals/NewTicketModal';
import FornitureModal from './components/Modals/FornitureModal';
import UnreadMessagesModal from './components/UnreadMessagesModal';
import TicketPhotosModal from './components/Modals/TicketPhotosModal';
import InactivityTimerModal from './components/Modals/InactivityTimerModal';
import ManageContractsModal from './components/Modals/ManageContractsModal';
import ContractsListModal from './components/Modals/ContractsListModal';
import { useAuth } from './hooks/useAuth';
import { useClients } from './hooks/useClients';
import { useTickets } from './hooks/useTickets';
import { useTimeLogs } from './hooks/useTimeLogs';
import { useReports } from './hooks/useReports';
import { useModals } from './hooks/useModals';
import { useTemporarySuppliesFromTickets } from './hooks/useTemporarySuppliesFromTickets';
import { useGoogleCalendar } from './hooks/useGoogleCalendar';
import { useWebSocket } from './hooks/useWebSocket';
import GoogleCallback from './components/GoogleCallback';
import TimesheetManager from './components/TimesheetManager';
import VivaldiManager from './components/VivaldiManager';
import PackVisionWithAuth from './components/PackVisionWithAuth';
import PackVision from './components/PackVision';
import NetworkMonitoringDashboard from './components/NetworkMonitoringDashboard';
import DeviceAnalysisModal from './components/Modals/DeviceAnalysisModal';
import CommAgentDashboard from './components/CommAgentDashboard';
// import NetworkTopologyPage from './pages/NetworkTopologyPage'; // RIMOSSO SU RICHIESTA UTENTE
import MappaturaPage from './pages/MappaturaPage';
import AntiVirusPage from './pages/AntiVirusPage';
import PingTerminalPage from './pages/PingTerminalPage';
import OfficePage from './pages/OfficePage';
import EmailPage from './pages/EmailPage';
import { buildApiUrl } from './utils/apiConfig';

const INITIAL_NEW_CLIENT_DATA = {
  nome: '',
  cognome: '',
  email: '',
  password: '',
  telefono: '',
  azienda: '',
  useExistingCompany: false,
  existingCompany: '',
  isAdmin: false
};

export default function TicketApp() {
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Rileva se siamo su orari.logikaservice.it, turni.logikaservice.it o vivaldi.logikaservice.it
  // Supporta anche parametro URL ?domain=orari/vivaldi per test locali

  // 1. Rileva l'hostname reale
  const hostname = window.location.hostname;
  const isOrariHostname = hostname === 'orari.logikaservice.it' ||
    hostname === 'turni.logikaservice.it' ||
    (hostname.includes('orari') && !hostname.includes('ticket')) ||
    (hostname.includes('turni') && !hostname.includes('ticket'));

  const isVivaldiHostname = hostname === 'vivaldi.logikaservice.it' ||
    (hostname.includes('vivaldi') && !hostname.includes('ticket'));

  const isPackVisionHostname = hostname === 'packvision.logikaservice.it' ||
    (hostname.includes('packvision') && !hostname.includes('ticket'));

  // 2. Parametro URL ?domain=orari/vivaldi/packvision per test
  const urlParams = new URLSearchParams(window.location.search);
  const testDomain = urlParams.get('domain');

  // 3. Se siamo su ticket.logikaservice.it (o hostname senza orari/turni/vivaldi/packvision), pulisci requestedDomain
  if (!isOrariHostname && !isVivaldiHostname && !isPackVisionHostname && !testDomain) {
    localStorage.removeItem('requestedDomain');
  }

  // 4. Salva il dominio richiesto SOLO se presente nell'URL o nell'hostname
  useEffect(() => {
    if (testDomain === 'orari' || testDomain === 'turni' || testDomain === 'vivaldi' || testDomain === 'packvision') {
      localStorage.setItem('requestedDomain', testDomain);
    } else if (isOrariHostname) {
      localStorage.setItem('requestedDomain', 'orari');
    } else if (isVivaldiHostname) {
      localStorage.setItem('requestedDomain', 'vivaldi');
    } else if (isPackVisionHostname) {
      localStorage.setItem('requestedDomain', 'packvision');
    }
  }, [testDomain, isOrariHostname, isVivaldiHostname, isPackVisionHostname]);

  // 5. Determina il dominio finale: priorità a hostname reale, poi testDomain
  // MODIFICA: Rimosso localStorage.getItem('requestedDomain') per evitare persistenza indesiderata
  const requestedDomain = isOrariHostname ? 'orari' : (isVivaldiHostname ? 'vivaldi' : (isPackVisionHostname ? 'packvision' : (testDomain || null)));

  const isOrariDomain = requestedDomain === 'orari' || requestedDomain === 'turni';
  const isVivaldiDomain = requestedDomain === 'vivaldi';
  const isPackVisionDomain = requestedDomain === 'packvision';

  // Controlla se abbiamo un codice OAuth nell'URL (solo una volta)
  const [oauthCode, setOauthCode] = useState(null);
  const [isGoogleCallback, setIsGoogleCallback] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      setOauthCode(code);
      setIsGoogleCallback(true);
      console.log('OAuth code found:', code);
    }

    // Verifica e ripristina modal KeePass dall'URL immediatamente
    const modalParam = urlParams.get('modal');
    if (modalParam === 'keepass') {
      const entryId = urlParams.get('entryId');
      console.log('🔍 URL contiene modal=keepass, ripristino immediato:', { entryId });
      setModalState({
        type: 'keepassCredentials',
        data: entryId ? { highlightEntryId: parseInt(entryId, 10) } : null
      });
    }
  }, []);

  const [notifications, setNotifications] = useState([]);

  // Inizializza modalState dall'URL se presente (per persistenza dopo F5)
  const getInitialModalState = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const modalParam = urlParams.get('modal');
    if (modalParam === 'keepass') {
      const entryId = urlParams.get('entryId');
      console.log('📋 Inizializzazione modalState da URL:', { modalParam, entryId });
      return {
        type: 'keepassCredentials',
        data: entryId ? { highlightEntryId: parseInt(entryId, 10) } : null
      };
    }
    return { type: null, data: null };
  };

  const [modalState, setModalState] = useState(getInitialModalState);
  const keepassModalRestoredRef = React.useRef(false);
  const [newTicketData, setNewTicketData] = useState({
    titolo: '',
    descrizione: '',
    categoria: 'assistenza',
    priorita: 'media',
    nomerichiedente: ''
  });
  const [showNetworkMonitoring, setShowNetworkMonitoring] = useState(false);
  const [showNetworkMap, setShowNetworkMap] = useState(false);
  const [showMappatura, setShowMappatura] = useState(false);
  const [showAntiVirus, setShowAntiVirus] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showOffice, setShowOffice] = useState(false);
  const [networkMonitoringInitialView, setNetworkMonitoringInitialView] = useState(null); // 'agents' o 'create'
  const [selectedCompanyForNavigation, setSelectedCompanyForNavigation] = useState(null); // Azienda selezionata per navigazione tra monitoraggio e mappatura
  const [showCommAgent, setShowCommAgent] = useState(false); // Communication Agent Dashboard
  const [showDeviceAnalysisStandalone, setShowDeviceAnalysisStandalone] = useState(false);
  const [standaloneDeviceId, setStandaloneDeviceId] = useState(null);
  const [standaloneDeviceLabel, setStandaloneDeviceLabel] = useState('');

  const [settingsData, setSettingsData] = useState({
    nome: '',
    cognome: '',
    email: '',
    telefono: '',
    azienda: '',
    passwordAttuale: '',
    nuovaPassword: ''
  });
  const [newClientData, setNewClientData] = useState(() => ({ ...INITIAL_NEW_CLIENT_DATA }));
  const [isEditingTicket, setIsEditingTicket] = useState(null);
  const [selectedClientForNewTicket, setSelectedClientForNewTicket] = useState('');
  const [showUnreadModal, setShowUnreadModal] = useState(false);
  const [fornitureModalTicket, setFornitureModalTicket] = useState(null);
  const [photosModalTicket, setPhotosModalTicket] = useState(null);
  const [previousUnreadCounts, setPreviousUnreadCounts] = useState({});
  // Inizializza lo stato in base al dominio richiesto
  const [showDashboard, setShowDashboard] = useState(() => {
    // La dashboard è sempre la schermata principale, tranne per orari/turni
    return !isOrariDomain;
  });

  const [showOrariTurni, setShowOrariTurni] = useState(() => {
    // Se c'è un dominio richiesto (orari/turni), mostra subito orari
    return isOrariDomain;
  });

  const [showVivaldi, setShowVivaldi] = useState(() => {
    // Vivaldi NON viene mostrato automaticamente, solo tramite menu
    return false;
  });
  const [showPackVision, setShowPackVision] = useState(() => {
    // Se siamo su packvision.logikaservice.it, mostra automaticamente PackVision in modalità display
    if (isPackVisionHostname) {
      return true;
    }
    return false;
  });




  // Controlla se siamo in modalità display PackVision (riutilizza urlParams già dichiarato alla riga 63)
  const isPackVisionDisplayMode = urlParams.get('mode') === 'display' || isPackVisionHostname;

  // Controlla se siamo nella pagina standalone ping terminal
  const isPingTerminalPage = window.location.pathname === '/tools/ping-terminal';

  // Persistenza vista nell'URL: F5 aggiorna solo la pagina corrente senza tornare alla dashboard
  const updateUrlView = (view) => {
    const url = new URL(window.location.href);
    if (view && view !== 'dashboard') {
      url.searchParams.set('view', view);
    } else {
      url.searchParams.delete('view');
    }
    window.history.replaceState({}, '', url.toString());
  };

  const getViewFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view');
  };

  // Ripristina la vista dall'URL (es. dopo F5)
  const applyViewFromUrl = (viewName) => {
    if (!viewName || viewName === 'dashboard') return;
    const allFalse = () => {
      setShowDashboard(false);
      setShowOrariTurni(false);
      setShowVivaldi(false);
      setShowNetworkMonitoring(false);
      setShowMappatura(false);
      setShowOffice(false);
      setShowAntiVirus(false);
      setShowEmail(false);
    };
    switch (viewName) {
      case 'office':
        allFalse(); setShowOffice(true); break;
      case 'email':
        allFalse(); setShowEmail(true); break;
      case 'mappatura':
        allFalse(); setShowMappatura(true); break;
      case 'antivirus':
        allFalse(); setShowAntiVirus(true); break;
      case 'network-monitoring':
        allFalse(); setShowNetworkMonitoring(true); break;
      default:
        break;
    }
  };

  // Aggiorna lo stato quando cambia il dominio richiesto
  useEffect(() => {
    if (requestedDomain === 'orari' || requestedDomain === 'turni') {
      setShowOrariTurni(true);
      setShowDashboard(false);
      setShowVivaldi(false);
    } else if (requestedDomain === 'vivaldi') {
      setShowVivaldi(true);
      setShowDashboard(false);
      setShowOrariTurni(false);
    } else {
      // Nessun dominio specifico, mostra dashboard principale
      setShowDashboard(true);
      setShowOrariTurni(false);
      setShowVivaldi(false);
    }
  }, [requestedDomain]);

  // Persistenza vista nell'URL: F5 ricarica la pagina corrente invece di tornare alla dashboard
  const applyHashToState = (hash) => {
    const view = (hash || '').replace(/^#/, '').toLowerCase();
    const search = new URLSearchParams(window.location.search);
    if (view === 'device-analysis' && search.has('deviceId')) {
      setShowDeviceAnalysisStandalone(true);
      setStandaloneDeviceId(search.get('deviceId'));
      setStandaloneDeviceLabel(search.get('deviceLabel') || '');
      setShowDashboard(false); setShowNetworkMonitoring(false); setShowMappatura(false);
      setShowOrariTurni(false); setShowVivaldi(false); setShowPackVision(false); setShowAntiVirus(false); setShowEmail(false); setShowOffice(false);
    } else if (view === 'mappatura') {
      setShowDeviceAnalysisStandalone(false);
      setShowMappatura(true); setShowDashboard(false); setShowNetworkMonitoring(false);
      setShowOrariTurni(false); setShowVivaldi(false); setShowPackVision(false); setShowAntiVirus(false); setShowEmail(false); setShowOffice(false);
    } else if (view === 'network-monitoring') {
      setShowDeviceAnalysisStandalone(false);
      setShowNetworkMonitoring(true); setShowDashboard(false); setShowMappatura(false);
      setShowOrariTurni(false); setShowVivaldi(false); setShowPackVision(false); setShowAntiVirus(false); setShowEmail(false); setShowOffice(false);
    } else if (view === 'antivirus') {
      setShowAntiVirus(true); setShowDashboard(false); setShowMappatura(false); setShowNetworkMonitoring(false);
      setShowOrariTurni(false); setShowVivaldi(false); setShowPackVision(false); setShowEmail(false); setShowOffice(false);
    } else if (view === 'email') {
      setShowEmail(true); setShowDashboard(false); setShowMappatura(false); setShowNetworkMonitoring(false);
      setShowOrariTurni(false); setShowVivaldi(false); setShowPackVision(false); setShowAntiVirus(false); setShowOffice(false);
    } else if (view === 'office') {
      setShowOffice(true); setShowDashboard(false); setShowMappatura(false); setShowNetworkMonitoring(false);
      setShowOrariTurni(false); setShowVivaldi(false); setShowPackVision(false); setShowAntiVirus(false); setShowEmail(false);
    } else if (view !== 'device-analysis') {
      setShowDeviceAnalysisStandalone(false);
      setShowDashboard(true); setShowMappatura(false); setShowNetworkMonitoring(false);
      setShowAntiVirus(false); setShowEmail(false); setShowOffice(false);
    }
  };

  useEffect(() => {
    applyHashToState(window.location.hash);
    const onHashChange = () => applyHashToState(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (showDeviceAnalysisStandalone) return;
    const base = window.location.pathname + window.location.search;
    const h = showOffice ? 'office' : showMappatura ? 'mappatura' : showNetworkMonitoring ? 'network-monitoring' : showAntiVirus ? 'antivirus' : showEmail ? 'email' : '';
    const newHash = h ? '#' + h : '';
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', base + newHash);
    }
  }, [showDeviceAnalysisStandalone, showOffice, showMappatura, showNetworkMonitoring, showAntiVirus, showEmail]);

  useEffect(() => {
    // Gestione Mappa Rete rimossa su richiesta
    const handleOpenMappatura = () => {
      setShowMappatura(true);
      setShowDashboard(false);
      setShowNetworkMonitoring(false);
      // setShowNetworkMap(false); // Rimosso
      setShowOrariTurni(false);
      setShowVivaldi(false);
      setShowPackVision(false);
      setShowAntiVirus(false);
    };
    // window.addEventListener('open-network-map', handleOpenNetworkMap);
    window.addEventListener('open-mappatura', handleOpenMappatura);
    return () => {
      // window.removeEventListener('open-network-map', handleOpenNetworkMap);
      window.removeEventListener('open-mappatura', handleOpenMappatura);
    };
  }, []);

  const handleOpenOffice = () => {
    setShowOffice(true);
    setShowDashboard(false);
    setShowNetworkMonitoring(false);
    setShowMappatura(false);
    setShowAntiVirus(false);
    setShowEmail(false);
  };

  const handleOpenAntiVirus = () => {
    setShowAntiVirus(true);
    setShowDashboard(false);
    setShowNetworkMonitoring(false);
    setShowMappatura(false);
    setShowOffice(false);
    setShowOrariTurni(false);
    setShowVivaldi(false);
    setShowPackVision(false);
    setShowEmail(false);
  };

  const handleOpenEmail = () => {
    setShowEmail(true);
    setShowDashboard(false);
    setShowNetworkMonitoring(false);
    setShowMappatura(false);
    setShowOrariTurni(false);
    setShowVivaldi(false);
    setShowAntiVirus(false);
    setShowOffice(false);
    setShowPackVision(false);
  };

  const [dashboardTargetState, setDashboardTargetState] = useState('aperto');
  const [dashboardHighlights, setDashboardHighlights] = useState({});
  const [prevTicketStates, setPrevTicketStates] = useState({});
  const [alertsRefreshTrigger, setAlertsRefreshTrigger] = useState(0);
  const [pendingTicketAction, setPendingTicketAction] = useState(null);
  // Protezione contro chiamate multiple per cambio stato
  const isChangingStatusRef = useRef(false);
  const [pendingAlertData, setPendingAlertData] = useState(null);
  // Timer di inattività (solo per clienti)
  const [showInactivityTimerDialog, setShowInactivityTimerDialog] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showContractsListModal, setShowContractsListModal] = useState(false);
  const [inactivityTimeout, setInactivityTimeout] = useState(() => {
    // Carica da localStorage, default 3 minuti
    const saved = localStorage.getItem('inactivityTimeout');
    return saved ? parseInt(saved, 10) : 3;
  });
  const inactivityTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const handleLogoutRef = useRef(null);
  const showNotificationRef = useRef(null);
  // Traccia i ticket cancellati per evitarne la ricomparsa nel polling (usa useRef per evitare re-render)
  const deletedTicketIdsRef = useRef(new Set());
  const locallyDeletedTicketIdsRef = useRef(new Set());

  // Helpers per localStorage (nuovi ticket non ancora aperti dall'utente)
  const getSetFromStorage = (key) => {
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
  };
  const saveSetToStorage = (key, set) => {
    try { localStorage.setItem(key, JSON.stringify(Array.from(set))); } catch { }
  };
  const debugNewTickets = () => localStorage.getItem('debugNewTickets') === '1';
  const dbg = (...args) => { if (debugNewTickets()) { console.log('[NEW-TICKETS]', ...args); } };

  if (isPingTerminalPage) {
    return <PingTerminalPage />;
  }

  // ====================================================================
  // NOTIFICHE
  // ====================================================================
  const notify = (message, type = 'info', duration = 5000, ticketId = null, options = {}) => {
    window.dispatchEvent(new CustomEvent('toast', {
      detail: { message, type, duration, ticketId, options }
    }));
  };

  const removeNotification = React.useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const showNotification = React.useCallback((message, type = 'info', duration = 5000, ticketId = null, options = {}) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type, duration, ticketId, show: true, sticky: !!options.sticky }]);

    // Rimuovi automaticamente dopo la durata specificata
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
    return id;
  }, [removeNotification]);

  const handleCloseNotification = removeNotification;

  // Listener per eventi 'toast' (usati da notify)
  useEffect(() => {
    const handleToast = (e) => {
      const { message, type, duration, ticketId, options } = e.detail || {};
      if (message) {
        showNotification(message, type, duration, ticketId, options);
      }
    };
    window.addEventListener('toast', handleToast);
    return () => window.removeEventListener('toast', handleToast);
  }, [showNotification]);

  // ====================================================================
  // HOOKS PERSONALIZZATI
  // ====================================================================
  const {
    isLoggedIn,
    currentUser,
    setCurrentUser,
    loginData,
    setLoginData,
    handleLogin,
    handleLogout,
    getAuthHeader
  } = useAuth(showNotification);

  useEffect(() => {
    if (isLoggedIn) {
      setNotifications(prev => prev.filter(n => !(n.sticky && n.message === 'Disconnesso per inattività')));

      // Dopo il login, verifica se c'è un dominio richiesto e mostra la gestione orari se necessario
      // Per Vivaldi, la dashboard è sempre la schermata principale
    } else {
      // Per tutti gli altri domini (incluso vivaldi), mostra la dashboard
      setShowDashboard(true);
      setShowOrariTurni(false);
      setShowVivaldi(false);
    }
  }, [isLoggedIn]);

  // Aggiorna i ref per il timer di inattività
  useEffect(() => {
    handleLogoutRef.current = handleLogout;
    showNotificationRef.current = showNotification;
  }, [handleLogout, showNotification]);

  // Hook per Google Calendar
  const { syncTicketToCalendarBackend } = useGoogleCalendar(getAuthHeader);

  // Hook per forniture temporanee dai ticket
  const {
    temporarySupplies,
    loading: temporarySuppliesLoading,
    removeTemporarySupply,
    refreshTemporarySupplies
  } = useTemporarySuppliesFromTickets(getAuthHeader);

  // Funzione per ricaricare le forniture temporanee manualmente
  const refreshTemporarySuppliesManual = () => {
    if (refreshTemporarySupplies) {
      refreshTemporarySupplies();
    }
  };

  const {
    handleCreateClient,
    handleUpdateClient,
    handleDeleteClient
  } = useClients(showNotification, setUsers, setTickets, getAuthHeader);

  const closeModal = () => {
    if (modalState.type === 'newTicket') {
      resetNewTicketData();
    }

    // Rimuovi parametri URL se il modal KeePass viene chiuso
    if (modalState.type === 'keepassCredentials') {
      const url = new URL(window.location);
      url.searchParams.delete('modal');
      url.searchParams.delete('entryId');
      window.history.replaceState({}, '', url);
      keepassModalRestoredRef.current = false; // Reset per permettere nuovo ripristino
    }

    setModalState({ type: null, data: null });
  };

  // Funzione per chiudere solo il modal di conferma descrizione vuota e tornare al modal del nuovo ticket
  const closeEmptyDescriptionModal = () => {
    setModalState({ type: 'newTicket' });
  };

  const {
    handleCreateTicket: createTicket,
    handleUpdateTicket: updateTicket,
    handleDeleteTicket,
    handleSelectTicket,
    handleSendMessage,
    handleDeleteMessage,
    handleUpdateMessage,
    handleChangeStatus: changeStatus,
    handleConfirmTimeLogs
  } = useTickets(
    notify,
    setTickets,
    selectedTicket,
    setSelectedTicket,
    currentUser,
    tickets,
    closeModal,
    syncTicketToCalendarBackend, // Passiamo la funzione di sincronizzazione Google Calendar
    getAuthHeader // Passiamo la funzione per l'autenticazione
  );

  const wrappedHandleDeleteTicket = async (id) => {
    const success = await handleDeleteTicket(id);
    if (success) {
      locallyDeletedTicketIdsRef.current.add(id);
    }
  };

  const {
    timeLogs,
    setTimeLogs,
    initializeTimeLogs,
    initializeTimeLogsForView,
    handleTimeLogChange,
    handleAddTimeLog,
    handleDuplicateTimeLog,
    handleRemoveTimeLog,
    handleMaterialChange,
    handleAddMaterial,
    handleRemoveMaterial,
    handleOffertaChange,
    handleAddOfferta,
    handleRemoveOfferta,
    handleSaveTimeLogs
  } = useTimeLogs(selectedTicket, setTickets, setSelectedTicket, showNotification, getAuthHeader, syncTicketToCalendarBackend, setModalState);

  const {
    handleGenerateSentReport,
    handleGenerateInvoiceReport
  } = useReports(tickets, users, setModalState, showNotification);

  const {
    handleOpenTimeLogger,
    handleOpenEditModal,
    handleOpenForniture,
    handleViewTimeLog
  } = useModals(
    setSelectedTicket,
    setModalState,
    initializeTimeLogs,
    initializeTimeLogsForView,
    setNewTicketData,
    setIsEditingTicket,
    setSelectedClientForNewTicket,
    setFornitureModalTicket,
    users
  );

  // ====================================================================
  // PERSISTENZA STATO TICKET CHIUSI AL RELOAD
  // ====================================================================
  useEffect(() => {
    if (isLoggedIn) {
      setSelectedTicket(null);
      localStorage.setItem('openTicketId', 'null');

      // Verifica se c'è un dominio richiesto (orari/turni)
      const savedDomain = localStorage.getItem('requestedDomain');
      const hashView = (window.location.hash || '').replace(/^#/, '').trim();
      const urlView = getViewFromUrl();

      if (savedDomain === 'orari' || savedDomain === 'turni') {
        // Se c'è un dominio richiesto, mostra la gestione orari
        setShowDashboard(false);
        setShowOrariTurni(true);
      } else if (hashView && ['office', 'email', 'mappatura', 'antivirus', 'network-monitoring'].includes(hashView)) {
        // Dopo F5: ripristina la vista dall'hash (#office, #email, ecc.) invece di tornare alla dashboard
        applyHashToState(window.location.hash);
      } else if (urlView && urlView !== 'dashboard') {
        // Dopo F5: ripristina la vista dal param ?view= invece di tornare alla dashboard
        setShowDashboard(true);
        applyViewFromUrl(urlView);
      } else {
        // Altrimenti mostra la dashboard
        setShowDashboard(true);
      }

      // NON resettare modalState se contiene keepassCredentials (preservato dall'URL)
      // Il modalState viene già inizializzato dall'URL, non resettarlo qui
    }
  }, [isLoggedIn]);

  // Monitora il modalState e ripristina il modal KeePass se viene chiuso accidentalmente ma l'URL lo richiede
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const modalParam = urlParams.get('modal');

    if (modalParam === 'keepass') {
      // Se l'URL richiede il modal ma non è aperto, riaprirlo (anche se non loggato, per preservare lo stato)
      if (modalState.type !== 'keepassCredentials') {
        const entryId = urlParams.get('entryId');
        console.log('🔄 Ripristino modal KeePass da URL (monitor continuo):', { entryId, isLoggedIn, hasCurrentUser: !!currentUser });
        setModalState({
          type: 'keepassCredentials',
          data: entryId ? { highlightEntryId: parseInt(entryId, 10) } : null
        });
      }
    }
  }, [isLoggedIn, currentUser, modalState.type]);

  // Sistema di heartbeat per aggiornare last_activity_at (ogni 60 secondi)
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;

    let isSending = false; // Flag per evitare richieste simultanee
    let lastSent = 0; // Timestamp dell'ultimo heartbeat inviato
    const MIN_INTERVAL = 60000; // Minimo 60 secondi tra un heartbeat e l'altro
    let heartbeatTimeout = null; // Timeout per il prossimo heartbeat
    let consecutiveErrors = 0; // Contatore errori consecutivi
    const MAX_CONSECUTIVE_ERRORS = 3; // Dopo 3 errori, disabilita temporaneamente
    let isDisabled = false; // Flag per disabilitare temporaneamente il heartbeat

    const sendHeartbeat = async () => {
      // Se disabilitato, non inviare
      if (isDisabled) {
        // Riprova dopo 5 minuti
        if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
        heartbeatTimeout = setTimeout(() => {
          isDisabled = false;
          consecutiveErrors = 0;
          sendHeartbeat();
        }, 300000); // 5 minuti
        return;
      }

      // Evita richieste simultanee o troppo frequenti
      const now = Date.now();
      if (isSending || (now - lastSent) < MIN_INTERVAL) {
        return;
      }

      isSending = true;
      lastSent = now;

      try {
        const authHeader = getAuthHeader();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // Timeout ridotto a 3 secondi

        const response = await fetch(buildApiUrl('/api/access-logs/heartbeat'), {
          method: 'POST',
          headers: {
            ...authHeader
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Reset contatore errori se la richiesta è andata a buon fine
        if (response.ok || response.status === 200) {
          consecutiveErrors = 0;
        } else {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            isDisabled = true;
            // Riprova dopo 5 minuti
            if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
            heartbeatTimeout = setTimeout(() => {
              isDisabled = false;
              consecutiveErrors = 0;
            }, 300000); // 5 minuti
            return;
          }
        }
      } catch (err) {
        // Ignora errori silenziosamente (non bloccare l'app)
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          isDisabled = true;
          // Riprova dopo 5 minuti
          if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
          heartbeatTimeout = setTimeout(() => {
            isDisabled = false;
            consecutiveErrors = 0;
          }, 300000); // 5 minuti
          return;
        }
      } finally {
        isSending = false;

        // Programma il prossimo heartbeat solo se non disabilitato
        if (!isDisabled) {
          if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
          heartbeatTimeout = setTimeout(sendHeartbeat, 60000); // 60 secondi
        }
      }
    };

    // Invia heartbeat dopo 5 secondi dall'avvio (non immediatamente)
    heartbeatTimeout = setTimeout(sendHeartbeat, 5000);

    // Invia heartbeat quando la pagina diventa visibile (solo se passati almeno 60 secondi)
    const handleVisibilityChange = () => {
      if (!document.hidden && !isDisabled) {
        const now = Date.now();
        if ((now - lastSent) >= MIN_INTERVAL) {
          sendHeartbeat();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Invia heartbeat quando la pagina viene chiusa (beforeunload) - solo se non disabilitato
    const handleBeforeUnload = () => {
      if (!isSending && !isDisabled) {
        const authHeader = getAuthHeader();
        fetch(buildApiUrl('/api/access-logs/heartbeat'), {
          method: 'POST',
          headers: {
            ...authHeader
          },
          keepalive: true // Mantiene la richiesta anche dopo la chiusura della pagina
        }).catch(() => { }); // Ignora errori silenziosamente
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isLoggedIn, currentUser, getAuthHeader]);

  useEffect(() => {
    if (selectedTicket?.id) {
      localStorage.setItem('openTicketId', selectedTicket.id);
    } else {
      localStorage.setItem('openTicketId', 'null');
    }
  }, [selectedTicket]);

  // ====================================================================
  // CALCOLA MESSAGGI NON LETTI
  // ====================================================================
  const getUnreadCount = (ticket) => {
    if (!currentUser || !ticket.messaggi || ticket.messaggi.length === 0) return 0;

    const lastRead = currentUser.ruolo === 'cliente'
      ? ticket.last_read_by_client
      : ticket.last_read_by_tecnico;

    if (!lastRead) {
      if (currentUser.ruolo === 'cliente') {
        return ticket.messaggi.filter(m => m.autore === 'Tecnico').length;
      } else {
        return ticket.messaggi.filter(m => m.autore !== 'Tecnico').length;
      }
    }

    const lastReadDate = new Date(lastRead);

    if (currentUser.ruolo === 'cliente') {
      return ticket.messaggi.filter(m =>
        new Date(m.data) > lastReadDate && m.autore === 'Tecnico'
      ).length;
    } else {
      return ticket.messaggi.filter(m =>
        new Date(m.data) > lastReadDate && m.autore !== 'Tecnico'
      ).length;
    }
  };

  // ====================================================================
  // CARICA DATI DAL DATABASE
  // ====================================================================
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;

      // OTTIMIZZAZIONE: Avvia il caricamento utenti in parallelo (non bloccante)
      // Questo permette di popolare la lista aziende mentre si caricano ancora i ticket/forniture
      let usersPromise = null;
      // Carica sempre gli utenti per i tecnici
      // Per i clienti, carica sempre (serve per aggiornare currentUser con admin_companies dopo refresh)
      if (currentUser.ruolo === 'tecnico' || currentUser.ruolo === 'cliente') {
        usersPromise = fetch(buildApiUrl('/api/users'), {
          headers: getAuthHeader()
        })
          .then(res => {
            if (!res.ok) throw new Error('Errore caricamento utenti');
            return res.json();
          })
          .then(data => {
            // Aggiorna lo stato appena i dati sono pronti
            setUsers(data);

            // Aggiorna currentUser con i dati completi (incluso admin_companies) se presente nella lista
            if (currentUser?.id && data && Array.isArray(data)) {
              const fullUserData = data.find(u => Number(u.id) === Number(currentUser.id));
              if (fullUserData && fullUserData.admin_companies !== undefined) {
                // Aggiorna currentUser solo se admin_companies non è già presente o è diverso
                if (!currentUser.admin_companies || JSON.stringify(currentUser.admin_companies) !== JSON.stringify(fullUserData.admin_companies)) {
                  setCurrentUser({
                    ...currentUser,
                    admin_companies: fullUserData.admin_companies
                  });
                }
              }
            }

            return data;
          })
          .catch(err => {
            console.error('Errore caricamento utenti background:', err);
            return [];
          });
      }

      try {
        const ticketsResponse = await fetch(buildApiUrl('/api/tickets'), {
          headers: getAuthHeader()
        });
        if (!ticketsResponse.ok) throw new Error("Errore nel caricare i ticket");
        const ticketsData = await ticketsResponse.json();

        // Imposta i ticket immediatamente con fornitureCount: 0 per mostrare le card subito
        const ticketsInitial = ticketsData.map(t => ({ ...t, fornitureCount: 0 }));
        const filteredTicketsInitial = ticketsInitial.filter(t => !deletedTicketIdsRef.current.has(t.id));

        // Imposta i ticket nello stato immediatamente (le card si popolano subito)
        setTickets(filteredTicketsInitial);

        // Carica il conteggio forniture in background e aggiorna i ticket man mano
        const BATCH_SIZE = 5;
        const ticketsWithForniture = [];

        for (let i = 0; i < ticketsData.length; i += BATCH_SIZE) {
          const batch = ticketsData.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(
            batch.map(async (ticket) => {
              try {
                const fornitureResponse = await fetch(buildApiUrl(`/api/tickets/${ticket.id}/forniture`), {
                  headers: getAuthHeader()
                });
                if (fornitureResponse.ok) {
                  const forniture = await fornitureResponse.json();
                  return { ...ticket, fornitureCount: forniture.length };
                }
              } catch (err) {
                // Silenzia ERR_INSUFFICIENT_RESOURCES per forniture
                if (!err.message?.includes('ERR_INSUFFICIENT_RESOURCES')) {
                  console.error(`Errore nel caricare forniture per ticket ${ticket.id}:`, err);
                }
              }
              return { ...ticket, fornitureCount: 0 };
            })
          );
          ticketsWithForniture.push(...batchResults);

          // Aggiorna i ticket nello stato man mano che arrivano le forniture
          setTickets(prev => {
            const prevMap = new Map(prev.map(t => [t.id, t]));
            const updatedMap = new Map();

            // Mantieni tutti i ticket esistenti
            prev.forEach(t => {
              updatedMap.set(t.id, t);
            });

            // Aggiorna con i nuovi dati delle forniture
            batchResults.forEach(t => {
              updatedMap.set(t.id, t);
            });

            return Array.from(updatedMap.values());
          });

          // Delay tra batch per evitare sovraccarico
          if (i + BATCH_SIZE < ticketsData.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Filtra i ticket cancellati per il resto della logica
        const filteredTicketsWithForniture = ticketsWithForniture.filter(t => !deletedTicketIdsRef.current.has(t.id));

        // Evidenzia nuovi ticket (persistente finché non aperto) - baseline al primo login
        // Usa filteredTicketsWithForniture che ha i conteggi completi
        let withNewFlag = filteredTicketsWithForniture;
        const unseenKey = currentUser ? `unseenNewTicketIds_${currentUser.id}` : null;
        const unseen = unseenKey ? getSetFromStorage(unseenKey) : new Set();

        // Rimuovi dal localStorage i ticket che sono stati già letti (basandosi su last_read_by_client/tecnico)
        if (unseenKey && unseen.size > 0) {
          const cleanedUnseen = new Set();
          unseen.forEach(ticketId => {
            const ticket = filteredTicketsWithForniture.find(t => t.id === ticketId);
            if (ticket) {
              // Verifica se il ticket è stato già letto dall'utente corrente
              const isRead = currentUser.ruolo === 'cliente'
                ? ticket.last_read_by_client
                : ticket.last_read_by_tecnico;

              // Se il ticket è stato letto, non aggiungerlo a cleanedUnseen
              if (!isRead) {
                cleanedUnseen.add(ticketId);
              }
            } else {
              // Se il ticket non esiste più, non aggiungerlo
            }
          });

          // Aggiorna il localStorage con i ticket non letti
          if (cleanedUnseen.size !== unseen.size) {
            saveSetToStorage(unseenKey, cleanedUnseen);
            // Aggiorna unseen per usarlo nelle logiche successive
            unseen.clear();
            cleanedUnseen.forEach(id => unseen.add(id));
          }
        }

        // Funzione helper per verificare se un ticket è visibile all'utente (uguale a quella del polling)
        const getAppliesToUserInitial = (ticket, usersList = users) => {
          if (currentUser.ruolo === 'tecnico') {
            return true; // I tecnici vedono tutti i ticket
          }

          if (currentUser.ruolo === 'cliente') {
            // Se è il proprio ticket, sempre visibile (confronta come numeri)
            const ticketClienteId = Number(ticket.clienteid);
            const currentUserId = Number(currentUser.id);
            if (ticketClienteId === currentUserId) {
              return true;
            }

            // Se è amministratore, controlla se il ticket appartiene a un cliente della sua azienda
            const isAdmin = currentUser.admin_companies &&
              Array.isArray(currentUser.admin_companies) &&
              currentUser.admin_companies.length > 0;

            if (isAdmin) {
              // Usa l'azienda del cliente direttamente dal ticket (se disponibile) o cerca in users
              let ticketAzienda = null;

              // Prima prova a usare l'azienda dal ticket (se è stata aggiunta dal backend)
              if (ticket.cliente_azienda) {
                ticketAzienda = ticket.cliente_azienda;
              } else if (usersList && usersList.length > 0) {
                // Altrimenti cerca in users
                const ticketClient = usersList.find(u => Number(u.id) === ticketClienteId);
                if (ticketClient && ticketClient.azienda) {
                  ticketAzienda = ticketClient.azienda;
                }
              }

              if (ticketAzienda) {
                // Verifica se l'azienda del ticket è tra quelle di cui è amministratore
                return currentUser.admin_companies.includes(ticketAzienda);
              }
            }

            return false;
          }

          return false;
        };

        // Crea un Set per tracciare quali ticket erano già stati notificati (per evitare doppie notifiche)
        const alreadyNotifiedKey = currentUser ? `notifiedTicketIds_${currentUser.id}` : null;
        const alreadyNotified = alreadyNotifiedKey ? getSetFromStorage(alreadyNotifiedKey) : new Set();
        const newlyNotifiedInitial = [];

        if (currentUser.ruolo === 'cliente' || currentUser.ruolo === 'tecnico') {
          // Al primo caricamento, rileva nuovi ticket (aperti) che non erano già in unseen
          filteredTicketsWithForniture.forEach(t => {
            const appliesToUser = getAppliesToUserInitial(t);
            // Verifica se il ticket è stato già letto dall'utente corrente
            const isRead = currentUser.ruolo === 'cliente'
              ? t.last_read_by_client
              : t.last_read_by_tecnico;

            // Aggiungi a unseen only if it's open, not already in unseen, and not yet read
            if (appliesToUser && t.stato === 'aperto' && !unseen.has(t.id) && !isRead) {
              // Aggiungi a unseen
              unseen.add(t.id);

              // Mostra notifica solo se non è già stata mostrata prima
              if (!alreadyNotified.has(t.id)) {
                alreadyNotified.add(t.id);
                newlyNotifiedInitial.push(t);
              }
            }
          });

          // Salva unseen e alreadyNotified
          if (unseenKey) saveSetToStorage(unseenKey, unseen);
          if (alreadyNotifiedKey) saveSetToStorage(alreadyNotifiedKey, alreadyNotified);

          // Applica flag isNew ai ticket (solo se non sono stati ancora letti)
          withNewFlag = filteredTicketsWithForniture.map(t => {
            const appliesToUser = getAppliesToUserInitial(t);
            // Verifica se il ticket è stato già letto dall'utente corrente
            const isRead = currentUser.ruolo === 'cliente'
              ? t.last_read_by_client
              : t.last_read_by_tecnico;
            return { ...t, isNew: appliesToUser && t.stato === 'aperto' && unseen.has(t.id) && !isRead };
          });

          // Mostra notifiche per i nuovi ticket rilevati al primo caricamento
          newlyNotifiedInitial.forEach(t => {
            showNotification(`Nuovo ticket ${t.numero}: ${t.titolo}`, 'warning', 8000, t.id);
          });
        }
        // Aggiorna i ticket con i flag isNew (mantenendo i fornitureCount già caricati)
        setTickets(prev => {
          const prevMap = new Map(prev.map(t => [t.id, t]));
          const newMap = new Map();

          // Mantieni tutti i ticket esistenti con i loro fornitureCount
          prev.forEach(t => {
            newMap.set(t.id, t);
          });

          // Aggiorna con i flag isNew
          withNewFlag.forEach(t => {
            const existing = prevMap.get(t.id);
            if (existing) {
              // Mantieni il fornitureCount esistente se è già stato caricato
              newMap.set(t.id, { ...existing, isNew: t.isNew });
            } else {
              newMap.set(t.id, t);
            }
          });

          return Array.from(newMap.values());
        });

        // Inizializza mappa stati per highlights reali
        const initMap = {};
        filteredTicketsWithForniture.forEach(t => { if (t && t.id) initMap[t.id] = t.stato; });
        setPrevTicketStates(initMap);

        // Carica users per tecnici e per clienti amministratori (devono vedere i clienti della loro azienda)
        const isAdmin = currentUser.ruolo === 'cliente' &&
          currentUser.admin_companies &&
          Array.isArray(currentUser.admin_companies) &&
          currentUser.admin_companies.length > 0;

        if (currentUser.ruolo === 'tecnico' || isAdmin) {
          // Attendi la promise avviata all'inizio (i dati potrebbero essere già arrivati)
          const usersData = usersPromise ? await usersPromise : [];

          if (usersData.length > 0) {
            // setUsers è già stato chiamato nel .then() della promise
            // setUsers(usersData);

            // Ri-applica la logica per i nuovi ticket dopo aver caricato users (per amministratori)
            if (isAdmin && (currentUser.ruolo === 'cliente' || currentUser.ruolo === 'tecnico')) {
              const unseenKey2 = currentUser ? `unseenNewTicketIds_${currentUser.id}` : null;
              const unseen2 = unseenKey2 ? getSetFromStorage(unseenKey2) : new Set();
              const alreadyNotifiedKey2 = currentUser ? `notifiedTicketIds_${currentUser.id}` : null;
              const alreadyNotified2 = alreadyNotifiedKey2 ? getSetFromStorage(alreadyNotifiedKey2) : new Set();
              const newlyNotifiedAfterUsers = [];

              filteredTicketsWithForniture.forEach(t => {
                const appliesToUser = getAppliesToUserInitial(t, usersData);
                // Verifica se il ticket è stato già letto dall'utente corrente
                const isRead = currentUser.ruolo === 'cliente'
                  ? t.last_read_by_client
                  : t.last_read_by_tecnico;

                // Aggiungi a unseen2 solo se è aperto, non è già in unseen2, e non è stato ancora letto
                if (appliesToUser && t.stato === 'aperto' && !unseen2.has(t.id) && !isRead) {
                  unseen2.add(t.id);
                  if (!alreadyNotified2.has(t.id)) {
                    alreadyNotified2.add(t.id);
                    newlyNotifiedAfterUsers.push(t);
                  }
                }
              });

              if (unseenKey2) saveSetToStorage(unseenKey2, unseen2);
              if (alreadyNotifiedKey2) saveSetToStorage(alreadyNotifiedKey2, alreadyNotified2);

              // Aggiorna tickets con flag isNew corretto (solo se non sono stati ancora letti)
              const updatedTickets = filteredTicketsWithForniture.map(t => {
                const appliesToUser = getAppliesToUserInitial(t, usersData);
                // Verifica se il ticket è stato già letto dall'utente corrente
                const isRead = currentUser.ruolo === 'cliente'
                  ? t.last_read_by_client
                  : t.last_read_by_tecnico;
                return { ...t, isNew: appliesToUser && t.stato === 'aperto' && unseen2.has(t.id) && !isRead };
              });
              setTickets(updatedTickets);

              // Mostra notifiche per i nuovi ticket rilevati dopo il caricamento di users
              newlyNotifiedAfterUsers.forEach(t => {
                showNotification(`Nuovo ticket ${t.numero}: ${t.titolo}`, 'warning', 8000, t.id);
              });
            }
          }
        }

        // Mostra modale se ci sono messaggi non letti
        const unreadTickets = filteredTicketsWithForniture.filter(t => getUnreadCount(t) > 0);
        if (unreadTickets.length > 0 && !showUnreadModal) {
          setShowUnreadModal(true);
        }
      } catch (error) {
        showNotification(error.message, "error");
      }
    };
    if (isLoggedIn) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, currentUser?.id, currentUser?.ruolo, JSON.stringify(currentUser?.admin_companies)]);


  // Riceve eventi per glow/frecce della dashboard (senza cambiare vista)
  useEffect(() => {
    const handler = (e) => {
      const { state, type } = e.detail || {};
      if (!state || !type) return;
      // Ripristina highlight (glow) per 10s, senza simboli freccia
      setDashboardHighlights((prev) => ({ ...prev, [state]: { type } }));
      setTimeout(() => {
        setDashboardHighlights((prev) => ({ ...prev, [state]: null }));
      }, 10000);
      // Aggiorna solo il target per la dashboard, senza navigare
      setDashboardTargetState(state);
    };
    window.addEventListener('dashboard-highlight', handler);
    return () => window.removeEventListener('dashboard-highlight', handler);
  }, []);

  useEffect(() => {
    const focusHandler = (e) => {
      const { state } = e.detail || {};
      if (!state) return;
      // Aggiorna solo il target per la dashboard, senza navigare
      setDashboardTargetState(state);
    };
    window.addEventListener('dashboard-focus', focusHandler);
    return () => window.removeEventListener('dashboard-focus', focusHandler);
  }, []);

  // ====================================================================
  // TIMER DI INATTIVITÀ (solo per clienti)
  // ====================================================================
  useEffect(() => {
    // Applica solo ai clienti
    if (currentUser?.ruolo !== 'cliente' || !isLoggedIn) {
      return;
    }

    // Se timeout è 0 (mai), non fare nulla
    if (inactivityTimeout === 0) {
      return;
    }

    const timeoutMs = inactivityTimeout * 60 * 1000; // Converti minuti in millisecondi

    // Throttle per mousemove (evita troppi reset)
    let throttleTimer = null;
    const THROTTLE_MS = 1000; // Reset timer max ogni secondo anche con mousemove continuo

    // Funzione per resettare il timer
    const resetTimer = () => {
      lastActivityRef.current = Date.now();

      // Cancella il timer esistente
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }

      // Imposta nuovo timer
      inactivityTimerRef.current = setTimeout(() => {
        // Verifica che il tempo sia effettivamente passato
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        if (timeSinceLastActivity >= timeoutMs) {
          // Logout automatico
          console.log(`⏰ Timer scaduto: logout automatico dopo ${inactivityTimeout} minuti di inattività`);
          if (showNotificationRef.current) {
            showNotificationRef.current(
              'Disconnesso per inattività',
              'warning',
              0,
              null,
              { sticky: true }
            );
          }
          // Chiama logout dopo un breve delay per mostrare la notifica
          setTimeout(() => {
            if (handleLogoutRef.current) {
              // Imposta flag per mostrare notifica persistente al login
              localStorage.setItem('sessionExpiredReason', 'inactivity');
              handleLogoutRef.current();
            }
          }, 1500);
        }
      }, timeoutMs);
    };

    // Eventi che indicano attività
    const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click', 'keydown'];

    const handleActivity = (event) => {
      // Per mousemove, usa throttle per evitare troppi reset
      if (event.type === 'mousemove') {
        if (throttleTimer) {
          return; // Ignora se siamo ancora nel periodo di throttle
        }
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
        }, THROTTLE_MS);
      }

      resetTimer();
    };

    // Aggiungi listener per tutti gli eventi di attività
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Aggiungi mousemove separatamente con throttle
    const handleMouseMove = (e) => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
          resetTimer();
        }, THROTTLE_MS);
        resetTimer();
      }
    };
    document.addEventListener('mousemove', handleMouseMove, true);

    // Inizializza il timer
    resetTimer();
    console.log(`⏰ Timer di inattività attivato: ${inactivityTimeout} minuti`);

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      document.removeEventListener('mousemove', handleMouseMove, true);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      if (throttleTimer) {
        clearTimeout(throttleTimer);
        throttleTimer = null;
      }
    };
  }, [isLoggedIn, currentUser?.ruolo, inactivityTimeout]);

  // ====================================================================
  // WEBSOCKET - CALLBACK PER EVENTI REAL-TIME
  // ====================================================================
  const handleTicketCreated = React.useCallback((ticket) => {
    console.log('📨 WebSocket: Nuovo ticket creato', ticket.id);
    let wasAlreadyInState = false;
    setTickets(prev => {
      // Controlla se il ticket esiste già (potrebbe essere stato aggiunto localmente)
      const exists = prev.find(t => t.id === ticket.id);
      if (exists) {
        wasAlreadyInState = true;
        // Se esiste, aggiornalo con i dati più recenti dal WebSocket
        return prev.map(t => t.id === ticket.id ? { ...t, ...ticket } : t);
      }
      // Se non esiste, aggiungilo
      return [ticket, ...prev];
    });

    // Mostra notifica solo se il ticket NON era già nello stato (non creato localmente)
    // Questo evita doppie notifiche quando l'utente crea il ticket lui stesso
    if (!wasAlreadyInState) {
      const ticketClienteId = Number(ticket.clienteid);
      const currentUserId = Number(currentUser?.id);
      const isTicketOwner = ticketClienteId === currentUserId;
      const isTechnician = currentUser?.ruolo === 'tecnico';
      const isClient = currentUser?.ruolo === 'cliente';

      // Mostra notifica se:
      // 1. È un tecnico (vede tutti i nuovi ticket)
      // 2. È un cliente E il ticket è suo (creato da tecnico o da altro cliente amministratore)
      const shouldShowNotification = isTechnician || (isClient && isTicketOwner);

      if (shouldShowNotification) {
        notify(`Nuovo ticket ${ticket.numero}: ${ticket.titolo}`, 'info', 8000, ticket.id);
      }

      // Mostra effetto verde sulla card "Aperti" quando viene creato un nuovo ticket
      // Solo se il ticket è in stato "aperto" e è visibile all'utente corrente
      if (ticket.stato === 'aperto') {
        const appliesToUser = isTechnician || (isClient && isTicketOwner);
        if (appliesToUser) {
          window.dispatchEvent(new CustomEvent('dashboard-highlight', {
            detail: { state: 'aperto', type: 'up', direction: 'forward' }
          }));
        }
      }
    }
  }, [showNotification, currentUser]);

  const handleTicketUpdated = React.useCallback((ticket) => {
    console.log('📨 WebSocket: Ticket aggiornato', ticket.id);
    setTickets(prev => prev.map(t => t.id === ticket.id ? ticket : t));
    if (selectedTicket?.id === ticket.id) {
      setSelectedTicket(ticket);
    }
  }, [selectedTicket]);

  const handleTicketStatusChanged = React.useCallback((data) => {
    console.log('📨 WebSocket: Stato ticket cambiato', data.ticketId, data.oldStatus, '→', data.newStatus);
    console.log('📨 WebSocket: Ticket data:', data.ticket);

    // Mostra notifica al cliente quando il tecnico prende in carico il ticket
    if (data.oldStatus === 'aperto' && data.newStatus === 'in_lavorazione') {
      // Verifica se l'utente corrente è un cliente e se il ticket gli appartiene
      if (currentUser?.ruolo === 'cliente' && data.ticket?.clienteid) {
        const ticketClienteId = Number(data.ticket.clienteid);
        const currentUserId = Number(currentUser.id);
        if (ticketClienteId === currentUserId) {
          const ticketNumber = data.ticket?.numero || data.ticketId;
          showNotification(`Il tecnico ha preso in carico il tuo ticket ${ticketNumber}`, 'success', 6000);
        }
      }
    }

    // Ricarica il ticket completo dal backend per avere tutti i dati aggiornati (incluso fornitureCount)
    fetch(buildApiUrl(`/api/tickets/${data.ticketId}`), {
      headers: getAuthHeader()
    })
      .then(res => res.json())
      .then(ticket => {
        console.log('📨 WebSocket: Ticket ricaricato dal backend:', ticket.id, 'stato:', ticket.stato);

        // Carica anche le forniture per avere il conteggio corretto
        return fetch(buildApiUrl(`/api/tickets/${data.ticketId}/forniture`), {
          headers: getAuthHeader()
        })
          .then(fornitureRes => fornitureRes.ok ? fornitureRes.json() : [])
          .then(forniture => {
            const ticketWithForniture = { ...ticket, fornitureCount: forniture.length };
            console.log('📨 WebSocket: Ticket con forniture:', {
              id: ticketWithForniture.id,
              stato: ticketWithForniture.stato,
              clienteid: ticketWithForniture.clienteid,
              clienteidType: typeof ticketWithForniture.clienteid,
              fornitureCount: ticketWithForniture.fornitureCount,
              currentUserId: currentUser?.id,
              currentUserIdType: typeof currentUser?.id
            });

            // Aggiorna il ticket nella lista - FORZA l'aggiornamento anche se esiste già
            setTickets(prev => {
              const exists = prev.find(t => t.id === data.ticketId);
              console.log('📨 WebSocket: Ticket esiste nello stato?', !!exists, 'stato precedente:', exists?.stato, 'clienteid precedente:', exists?.clienteid);

              if (exists) {
                // Se esiste, aggiornalo FORZANDO il nuovo stato
                const updated = prev.map(t => {
                  if (t.id === data.ticketId) {
                    console.log('📨 WebSocket: Aggiorno ticket esistente:', {
                      id: t.id,
                      daStato: t.stato,
                      aStato: ticketWithForniture.stato,
                      daClienteId: t.clienteid,
                      aClienteId: ticketWithForniture.clienteid
                    });
                    return ticketWithForniture;
                  }
                  return t;
                });
                const updatedTicket = updated.find(t => t.id === data.ticketId);
                console.log('📨 WebSocket: Ticket aggiornato nello stato:', {
                  id: updatedTicket?.id,
                  stato: updatedTicket?.stato,
                  clienteid: updatedTicket?.clienteid,
                  clienteidType: typeof updatedTicket?.clienteid
                });
                return updated;
              } else {
                // Se non esiste (ad esempio, era in un'altra vista), aggiungilo
                console.log('📨 WebSocket: Ticket non esiste nello stato, lo aggiungo:', {
                  id: ticketWithForniture.id,
                  stato: ticketWithForniture.stato,
                  clienteid: ticketWithForniture.clienteid
                });
                return [ticketWithForniture, ...prev];
              }
            });

            // Aggiorna il ticket selezionato se è quello aperto
            if (selectedTicket?.id === data.ticketId) {
              setSelectedTicket(ticketWithForniture);
            }
          })
          .catch(err => {
            console.error('Errore caricamento forniture dopo cambio stato:', err);
            // Fallback: usa i dati del ticket senza forniture, ma FORZA il nuovo stato
            const fallbackTicket = { ...data.ticket, stato: data.newStatus, fornitureCount: 0 };
            setTickets(prev => {
              const exists = prev.find(t => t.id === data.ticketId);
              if (exists) {
                return prev.map(t => t.id === data.ticketId ? fallbackTicket : t);
              } else {
                return [fallbackTicket, ...prev];
              }
            });
            if (selectedTicket?.id === data.ticketId) {
              setSelectedTicket(fallbackTicket);
            }
          });
      })
      .catch(err => {
        console.error('Errore caricamento ticket dopo cambio stato:', err);
        // Fallback: usa i dati ricevuti via WebSocket, ma FORZA il nuovo stato
        const fallbackTicket = { ...data.ticket, stato: data.newStatus, fornitureCount: 0 };
        setTickets(prev => {
          const exists = prev.find(t => t.id === data.ticketId);
          if (exists) {
            return prev.map(t => t.id === data.ticketId ? fallbackTicket : t);
          } else {
            return [fallbackTicket, ...prev];
          }
        });
        if (selectedTicket?.id === data.ticketId) {
          setSelectedTicket(fallbackTicket);
        }
      });

    // Aggiorna highlights dashboard
    window.dispatchEvent(new CustomEvent('dashboard-highlight', {
      detail: { state: data.oldStatus, type: 'down', direction: 'forward' }
    }));
    window.dispatchEvent(new CustomEvent('dashboard-highlight', {
      detail: { state: data.newStatus, type: 'up', direction: 'forward' }
    }));
  }, [selectedTicket, getAuthHeader, currentUser, showNotification]);

  const handleNewMessage = React.useCallback((data) => {
    console.log('📨 WebSocket: Nuovo messaggio', data.ticketId);
    // Ricarica il ticket per avere i messaggi aggiornati
    fetch(buildApiUrl(`/api/tickets/${data.ticketId}`), {
      headers: getAuthHeader()
    })
      .then(res => res.json())
      .then(ticket => {
        setTickets(prev => prev.map(t => t.id === ticket.id ? ticket : t));
        if (selectedTicket?.id === ticket.id) {
          setSelectedTicket(ticket);
        }
        notify(`Nuovo messaggio su ticket ${ticket.numero}`, 'info', 5000, ticket.id);
      })
      .catch(err => console.error('Errore caricamento ticket dopo messaggio:', err));
  }, [selectedTicket, getAuthHeader, showNotification]);

  const handleTicketDeleted = React.useCallback((data) => {
    console.log('📨 WebSocket: Ticket cancellato', data.ticketId);
    const ticket = data.ticket;

    // Aggiungi il ticket ID al Set dei ticket cancellati
    deletedTicketIdsRef.current.add(data.ticketId);

    if (locallyDeletedTicketIdsRef.current.has(data.ticketId)) {
      locallyDeletedTicketIdsRef.current.delete(data.ticketId);
      return;
    }

    // Rimuovi il ticket dalla lista
    setTickets(prev => prev.filter(t => t.id !== data.ticketId));

    // Se il ticket cancellato è quello aperto, chiudilo
    if (selectedTicket?.id === data.ticketId) {
      setSelectedTicket(null);
    }

    // Mostra notifica
    const ticketNumber = ticket?.numero || data.ticketId;
    notify(`Ticket ${ticketNumber} cancellato`, 'error', 5000, ticketNumber);
  }, [selectedTicket, showNotification]);

  // Callback per network monitoring updates
  const handleNetworkMonitoringUpdate = React.useCallback((data) => {
    console.log('📡 Network monitoring update ricevuto:', data);
    // La dashboard gestirà il refresh dei dati tramite WebSocket
  }, []);

  // Hook WebSocket
  const { isConnected, socket } = useWebSocket({
    getAuthHeader,
    currentUser,
    onTicketCreated: handleTicketCreated,
    onTicketUpdated: handleTicketUpdated,
    onTicketStatusChanged: handleTicketStatusChanged,
    onNewMessage: handleNewMessage,
    onTicketDeleted: handleTicketDeleted,
    onNetworkMonitoringUpdate: handleNetworkMonitoringUpdate
  });

  // ====================================================================
  // MONITORAGGIO NUOVI MESSAGGI
  // ====================================================================
  useEffect(() => {
    if (!isLoggedIn) return;

    // Salva i conteggi iniziali
    const initialCounts = {};
    tickets.forEach(t => {
      initialCounts[t.id] = getUnreadCount(t);
    });
    setPreviousUnreadCounts(initialCounts);

    // Polling: più lento se WebSocket è connesso, più veloce altrimenti
    const pollInterval = isConnected ? 60000 : 10000; // 60s se WebSocket attivo, 10s altrimenti

    const doPoll = async () => {
      try {
        const response = await fetch(buildApiUrl('/api/tickets'), {
          headers: getAuthHeader()
        });
        if (!response.ok) return;

        const updatedTickets = await response.json();

        // Carica forniture in batch per evitare ERR_INSUFFICIENT_RESOURCES
        const BATCH_SIZE = 5;
        const ticketsWithForniture = [];

        for (let i = 0; i < updatedTickets.length; i += BATCH_SIZE) {
          const batch = updatedTickets.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(
            batch.map(async (ticket) => {
              try {
                const fornitureResponse = await fetch(buildApiUrl(`/api/tickets/${ticket.id}/forniture`), {
                  headers: getAuthHeader()
                });
                if (fornitureResponse.ok) {
                  const forniture = await fornitureResponse.json();
                  return { ...ticket, fornitureCount: forniture.length };
                }
              } catch (err) {
                // Silenzia ERR_INSUFFICIENT_RESOURCES per forniture
                if (!err.message?.includes('ERR_INSUFFICIENT_RESOURCES')) {
                  console.error(`Errore forniture ticket ${ticket.id}:`, err);
                }
              }
              return { ...ticket, fornitureCount: 0 };
            })
          );
          ticketsWithForniture.push(...batchResults);

          // Delay tra batch per evitare sovraccarico
          if (i + BATCH_SIZE < updatedTickets.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Filtra i ticket cancellati (anche se il backend li restituisce per cache/delay)
        const filteredTickets = ticketsWithForniture.filter(t => !deletedTicketIdsRef.current.has(t.id));

        // Evidenzia nuovi ticket rispetto al polling precedente (cliente e tecnico) - persiste finché non aperto
        let polled = filteredTickets;
        const unseenKeyP = currentUser ? `unseenNewTicketIds_${currentUser.id}` : null;
        const unseenP = unseenKeyP ? getSetFromStorage(unseenKeyP) : new Set();

        // Rimuovi dal localStorage i ticket che sono stati già letti (basandosi su last_read_by_client/tecnico)
        if (unseenKeyP && unseenP.size > 0) {
          const cleanedUnseenP = new Set();
          unseenP.forEach(ticketId => {
            const ticket = ticketsWithForniture.find(t => t.id === ticketId);
            if (ticket) {
              // Verifica se il ticket è stato già letto dall'utente corrente
              const isRead = currentUser.ruolo === 'cliente'
                ? ticket.last_read_by_client
                : ticket.last_read_by_tecnico;

              // Se il ticket è stato letto, non aggiungerlo a cleanedUnseenP
              if (!isRead) {
                cleanedUnseenP.add(ticketId);
              }
            } else {
              // Se il ticket non esiste più, non aggiungerlo
            }
          });

          // Aggiorna il localStorage con i ticket non letti
          if (cleanedUnseenP.size !== unseenP.size) {
            saveSetToStorage(unseenKeyP, cleanedUnseenP);
            // Aggiorna unseenP per usarlo nelle logiche successive
            unseenP.clear();
            cleanedUnseenP.forEach(id => unseenP.add(id));
          }
        }

        // Funzione helper per verificare se un ticket è visibile all'utente
        const getAppliesToUser = (ticket) => {
          if (currentUser.ruolo === 'tecnico') {
            return true; // I tecnici vedono tutti i ticket
          }

          if (currentUser.ruolo === 'cliente') {
            // Se è il proprio ticket, sempre visibile (confronta come numeri)
            const ticketClienteId = Number(ticket.clienteid);
            const currentUserId = Number(currentUser.id);
            if (ticketClienteId === currentUserId) {
              return true;
            }

            // Se è amministratore, controlla se il ticket appartiene a un cliente della sua azienda
            const isAdmin = currentUser.admin_companies &&
              Array.isArray(currentUser.admin_companies) &&
              currentUser.admin_companies.length > 0;

            if (isAdmin) {
              // Usa l'azienda del cliente direttamente dal ticket (se disponibile) o cerca in users
              let ticketAzienda = null;

              // Prima prova a usare l'azienda dal ticket (se è stata aggiunta dal backend)
              if (ticket.cliente_azienda) {
                ticketAzienda = ticket.cliente_azienda;
              } else if (users && users.length > 0) {
                // Altrimenti cerca in users
                const ticketClient = users.find(u => Number(u.id) === ticketClienteId);
                if (ticketClient && ticketClient.azienda) {
                  ticketAzienda = ticketClient.azienda;
                }
              }

              if (ticketAzienda) {
                // Verifica se l'azienda del ticket è tra quelle di cui è amministratore
                return currentUser.admin_companies.includes(ticketAzienda);
              }
            }

            return false;
          }

          return false;
        };

        if (currentUser.ruolo === 'cliente' || currentUser.ruolo === 'tecnico') {
          // Aggiungi nuovi ID non presenti nello stato precedente
          const prevIds = new Set(tickets.map(t => t.id));
          const newlyDetected = [];

          // Crea un Set per tracciare quali ticket erano già stati notificati (per evitare doppie notifiche)
          const alreadyNotifiedKey = currentUser ? `notifiedTicketIds_${currentUser.id}` : null;
          const alreadyNotified = alreadyNotifiedKey ? getSetFromStorage(alreadyNotifiedKey) : new Set();
          const newlyNotified = [];

          filteredTickets.forEach(t => {
            const appliesToUser = getAppliesToUser(t);
            // Verifica se il ticket è stato già letto dall'utente corrente
            const isRead = currentUser.ruolo === 'cliente'
              ? t.last_read_by_client
              : t.last_read_by_tecnico;

            // Aggiungi a unseenP solo se è aperto, non è già presente nello stato precedente, e non è stato ancora letto
            if (appliesToUser && t.stato === 'aperto' && !prevIds.has(t.id) && !isRead) {
              unseenP.add(t.id);
              newlyDetected.push(t.id);

              // Mostra notifica solo se non è già stata mostrata prima
              if (!alreadyNotified.has(t.id)) {
                alreadyNotified.add(t.id);
                newlyNotified.push(t);
              }
            }
          });

          if (newlyDetected.length > 0) dbg('Rilevati nuovi ticket per', currentUser.ruolo, 'IDs:', newlyDetected);
          if (unseenKeyP) saveSetToStorage(unseenKeyP, unseenP);
          if (alreadyNotifiedKey) saveSetToStorage(alreadyNotifiedKey, alreadyNotified);

          polled = filteredTickets.map(t => {
            const appliesToUser = getAppliesToUser(t);
            // Verifica se il ticket è stato già letto dall'utente corrente
            const isRead = currentUser.ruolo === 'cliente'
              ? t.last_read_by_client
              : t.last_read_by_tecnico;
            return { ...t, isNew: appliesToUser && t.stato === 'aperto' && unseenP.has(t.id) && !isRead };
          });
          if (debugNewTickets()) {
            const flagged = polled.filter(t => t.isNew).map(t => t.id);
            if (flagged.length > 0) dbg('Flag giallo per IDs:', flagged);
          }

          // Toast a scomparsa per ciascun nuovo ticket rilevato per la prima volta (cliccabile per aprire)
          newlyNotified.forEach(t => {
            dbg('Mostro toast per nuovo ticket', t.id);
            // Toast giallo (warning) per nuovo ticket, cliccabile
            showNotification(`Nuovo ticket ${t.numero}: ${t.titolo}`, 'warning', 8000, t.id);
          });
        }

        // Merge intelligente: aggiorna i ticket esistenti e aggiungi solo quelli nuovi
        // Questo evita duplicati quando WebSocket e polling arrivano contemporaneamente
        setTickets(prev => {
          const prevMap = new Map(prev.map(t => [t.id, t]));
          const polledMap = new Map(polled.map(t => [t.id, t]));

          // Ordine di priorità degli stati (più avanzato = numero più alto)
          const statePriority = {
            'aperto': 0,
            'in_lavorazione': 1,
            'risolto': 2,
            'chiuso': 3,
            'inviato': 4,
            'fatturato': 5
          };

          const getStatePriority = (stato) => statePriority[stato] ?? -1;

          // Crea una nuova lista: preferisci i dati più recenti (stato più avanzato)
          // e aggiungi eventuali ticket da prev che non sono nel polling (per evitare perdite temporanee)
          const merged = [];
          const allIds = new Set([...prevMap.keys(), ...polledMap.keys()]);

          allIds.forEach(id => {
            if (polledMap.has(id) && prevMap.has(id)) {
              // Entrambi esistono: confronta lo stato e preferisci quello più avanzato
              const prevTicket = prevMap.get(id);
              const polledTicket = polledMap.get(id);
              const prevPriority = getStatePriority(prevTicket.stato);
              const polledPriority = getStatePriority(polledTicket.stato);

              // Se prev ha uno stato più avanzato, preferisci prev (potrebbe essere un aggiornamento WebSocket recente)
              // Altrimenti preferisci polled (dati freschi dal backend)
              if (prevPriority > polledPriority) {
                merged.push(prevTicket);
              } else {
                merged.push(polledTicket);
              }
            } else if (polledMap.has(id)) {
              // Solo nel polling: aggiungilo
              merged.push(polledMap.get(id));
            } else if (prevMap.has(id) && !deletedTicketIdsRef.current.has(id)) {
              // Solo in prev: mantienilo (potrebbe essere stato aggiunto via WebSocket)
              merged.push(prevMap.get(id));
            }
          });

          return merged;
        });
        // Highlights reali: confronta stati precedenti vs attuali
        const nextMap = {};
        filteredTickets.forEach(t => { if (t && t.id) nextMap[t.id] = t.stato; });
        try {
          Object.keys(nextMap).forEach(id => {
            const prevState = prevTicketStates[id];
            const curState = nextMap[id];
            if (!prevState && curState) {
              const evtUp = new CustomEvent('dashboard-highlight', { detail: { state: curState, type: 'up', direction: 'forward' } });
              window.dispatchEvent(evtUp);
            } else if (prevState && prevState !== curState) {
              // Avanzamento/regresso: emetti direzione per posizionare le frecce correttamente
              const forwardOrder = ['aperto', 'in_lavorazione', 'risolto', 'chiuso', 'inviato', 'fatturato'];
              const backwardOrder = ['fatturato', 'inviato', 'chiuso', 'risolto', 'in_lavorazione', 'aperto'];
              const isForward = forwardOrder.indexOf(prevState) > -1 && forwardOrder.indexOf(curState) === forwardOrder.indexOf(prevState) + 1;
              const isBackward = backwardOrder.indexOf(prevState) > -1 && backwardOrder.indexOf(curState) === backwardOrder.indexOf(prevState) + 1;
              const direction = isBackward ? 'backward' : 'forward';
              window.dispatchEvent(new CustomEvent('dashboard-highlight', { detail: { state: prevState, type: 'down', direction } }));
              window.dispatchEvent(new CustomEvent('dashboard-highlight', { detail: { state: curState, type: 'up', direction } }));
            }
          });
        } catch (_) { }
        setPrevTicketStates(nextMap);

        // Controlla se ci sono nuovi messaggi
        // Per i clienti: controlla solo i ticket che appartengono a loro e che sono aperti
        let ticketsToCheck = filteredTickets;
        if (currentUser?.ruolo === 'cliente') {
          ticketsToCheck = filteredTickets.filter(t => t.clienteid === currentUser.id && t.stato === 'aperto');
        }

        let hasNewMessages = false;
        ticketsToCheck.forEach(ticket => {
          const previousCount = previousUnreadCounts[ticket.id] || 0;
          const currentCount = getUnreadCount(ticket);

          if (currentCount > previousCount) {
            hasNewMessages = true;
          }
        });

        // Mostra modale se ci sono nuovi messaggi
        if (hasNewMessages && !showUnreadModal) {
          setShowUnreadModal(true);
        }

        // Aggiorna conteggi solo per i ticket rilevanti
        const newCounts = {};
        ticketsToCheck.forEach(t => {
          newCounts[t.id] = getUnreadCount(t);
        });
        setPreviousUnreadCounts(newCounts);

      } catch (error) {
        console.error('Errore polling:', error);
      }
    };
    const interval = setInterval(doPoll, pollInterval);
    const localNewHandler = () => { doPoll(); };
    window.addEventListener('new-ticket-local', localNewHandler);
    return () => { clearInterval(interval); window.removeEventListener('new-ticket-local', localNewHandler); };
  }, [isLoggedIn, tickets, showUnreadModal, currentUser, previousUnreadCounts, users, isConnected, getAuthHeader]);

  // Listener per apertura ticket da toast
  useEffect(() => {
    const openFromToast = (e) => {
      const ticketId = e.detail;
      try { console.log('[TOAST-DEBUG] openFromToast received id', ticketId); } catch { }
      const t = tickets.find(x => x.id === ticketId);
      if (t) {
        try { console.log('[TOAST-DEBUG] found ticket in state', t); } catch { }
        // Passa alla vista lista (Aperti) e poi seleziona il ticket
        setDashboardTargetState('aperto');
        setShowDashboard(false);
        setShowUnreadModal(false);
        // Selezione dopo il render della lista
        setTimeout(() => {
          try { handleSelectTicket(t); } catch { }
        }, 50);
      }
    };
    window.addEventListener('toast-open-ticket', openFromToast);
    return () => window.removeEventListener('toast-open-ticket', openFromToast);
  }, [tickets]);

  // ====================================================================
  // MODALI
  // ====================================================================
  const resetNewTicketData = () => {
    const nomeRichiedente = currentUser?.ruolo === 'cliente' ? `${currentUser.nome} ${currentUser.cognome || ''}`.trim() : '';
    setNewTicketData({
      titolo: '',
      descrizione: '',
      categoria: 'assistenza',
      priorita: 'media',
      nomerichiedente: nomeRichiedente,
      dataapertura: '' // Inizializza dataapertura vuota per nuovi ticket
    });
    setIsEditingTicket(null);
    setSelectedClientForNewTicket('');
  };

  // ====================================================================
  // APERTURA MODALI
  // ====================================================================
  const openNewTicketModal = () => { resetNewTicketData(); setModalState({ type: 'newTicket' }); };

  /** Apre il modal nuovo ticket con titolo/descrizione precompilati (es. da Email per assistenza). */
  const openNewTicketWithData = (data = {}) => {
    const nomeRichiedente = currentUser?.ruolo === 'cliente' ? `${currentUser.nome} ${currentUser.cognome || ''}`.trim() : '';
    setNewTicketData({
      titolo: data.titolo ?? '',
      descrizione: data.descrizione ?? '',
      categoria: 'assistenza',
      priorita: 'media',
      nomerichiedente: nomeRichiedente,
      dataapertura: ''
    });
    setIsEditingTicket(null);
    setSelectedClientForNewTicket(selectedCompanyForNavigation || currentUser?.azienda_id || '');
    setModalState({ type: 'newTicket' });
  };

  // Funzione per creare un ticket da un avviso
  const handleCreateTicketFromAlert = (alert) => {
    const nomeRichiedente = currentUser?.ruolo === 'cliente' ? `${currentUser.nome} ${currentUser.cognome || ''}`.trim() : '';

    // Avviso "Email in scadenza" (solo tecnico): titolo e descrizione per intervento
    if (alert.isEmailExpiry) {
      const expDate = alert.expires ? new Date(alert.expires).toLocaleDateString('it-IT') : 'N/D';
      setNewTicketData({
        titolo: `Intervento scadenza email – ${alert.username || alert.emailTitle || ''} – ${alert.aziendaName || ''}`,
        descrizione: `Richiesta intervento per rinnovo/scadenza email.\n\nAzienda: ${alert.aziendaName || ''}\nEmail/Account: ${alert.username || ''}\nTitolo entry: ${alert.emailTitle || alert.title || ''}\nScadenza: ${expDate}\nGiorni rimanenti: ${alert.daysLeft ?? 'N/D'}\n\n${alert.body || ''}`,
        categoria: 'assistenza',
        priorita: 'media',
        nomerichiedente: nomeRichiedente,
        dataapertura: ''
      });
      setIsEditingTicket(null);
      setSelectedClientForNewTicket('');
      setModalState({ type: 'newTicket' });
      return;
    }

    // Determina la priorità in base al livello dell'avviso
    let priorita = 'media';
    if (alert.level === 'danger') {
      priorita = 'alta';
    } else if (alert.level === 'warning') {
      priorita = 'media';
    } else if (alert.level === 'info') {
      priorita = 'bassa';
    }

    // Costruisci la descrizione con tutte le informazioni dell'avviso
    let descrizione = `=== AVVISO ORIGINALE ===\n`;
    descrizione += `Titolo: ${alert.title}\n`;
    descrizione += `Tipo: ${alert.level === 'danger' ? 'Critico' : alert.level === 'warning' ? 'Avviso' : 'Informazione'}\n`;
    descrizione += `Data creazione: ${new Date(alert.createdAt || alert.created_at).toLocaleString('it-IT')}\n\n`;
    descrizione += `Descrizione avviso:\n${alert.body}\n\n==========================\n`;

    setNewTicketData({
      titolo: `Ticket da avviso: ${alert.title}`,
      descrizione: descrizione,
      categoria: 'assistenza',
      priorita: priorita,
      nomerichiedente: nomeRichiedente,
      dataapertura: ''
    });
    setIsEditingTicket(null);
    setSelectedClientForNewTicket('');
    setModalState({ type: 'newTicket' });
  };
  const openSettings = () => {
    setSettingsData({
      nome: currentUser.nome || '',
      cognome: currentUser.cognome || '',
      email: currentUser.email || '',
      telefono: currentUser.telefono || '',
      azienda: currentUser.azienda || '',
      passwordAttuale: currentUser.password || '',
      nuovaPassword: ''
    });
    setModalState({ type: 'settings' });
  };
  const openManageClientsModal = () => setModalState({ type: 'manageClients' });
  const openNewClientModal = () => setModalState({ type: 'newClient' });
  const openAlertsHistory = () => setModalState({ type: 'alertsHistory' });
  const openAnalytics = () => setModalState({ type: 'analytics' });
  const openAccessLogs = () => setModalState({ type: 'accessLogs' });
  const openInactivityTimer = () => setModalState({ type: 'inactivityTimer' });
  const handleInactivityTimeoutChange = async (timeout) => {
    setInactivityTimeout(timeout);
    localStorage.setItem('inactivityTimeout', timeout.toString());

    // Salva anche nel database se l'utente è loggato
    if (currentUser?.id) {
      try {
        const authHeader = getAuthHeader();
        const response = await fetch(buildApiUrl(`/api/users/${currentUser.id}`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...authHeader
          },
          body: JSON.stringify({
            inactivity_timeout_minutes: timeout
          })
        });

        if (response.ok) {
          const updatedUser = await response.json();
          // Aggiorna currentUser con il nuovo timeout
          setCurrentUser(prev => ({
            ...prev,
            inactivity_timeout_minutes: updatedUser.inactivity_timeout_minutes || timeout
          }));
        }
      } catch (err) {
        console.error('Errore salvataggio timeout nel database:', err);
        // Non bloccare l'operazione se il salvataggio nel DB fallisce
      }
    }

    showNotification(`Timer di inattività impostato a ${timeout === 0 ? 'mai' : `${timeout} minuti`}`, 'success');
  };
  const onKeepassImportSuccess = () => {
    showNotification('Credenziali KeePass importate con successo!', 'success');
  };

  // Funzioni per gestione avvisi
  const handleRequestEmailConfirm = (alertData) => {
    setPendingAlertData(alertData);
    setModalState({ type: 'alertEmailConfirm' });
  };

  const handleConfirmAlertEmail = async (emailOption) => {
    // emailOption può essere: 'all', 'admins', 'none', oppure { option: 'company', company: 'nomeAzienda' }
    if (pendingAlertData) {
      await handleSaveAlert(pendingAlertData, emailOption);
      setPendingAlertData(null);
      setModalState({ type: 'manageAlerts' });
    }
  };

  const handleCancelAlertEmail = () => {
    setPendingAlertData(null);
    setModalState({ type: 'manageAlerts' });
  };

  // Gestione invio email dopo salvataggio intervento
  const handleConfirmSendEmail = async (ticket) => {
    try {
      const client = users.find(u => u.id === ticket.clienteid);
      if (!client || !client.email) {
        showNotification('Cliente non trovato o email non disponibile', 'error');
        setModalState({ type: null, data: null });
        return;
      }

      const response = await fetch(buildApiUrl(`/api/email/notify-ticket-resolved`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({
          ticket: ticket,
          clientEmail: client.email,
          clientName: `${client.nome} ${client.cognome}`
        })
      });

      if (!response.ok) {
        throw new Error('Errore nell\'invio dell\'email');
      }

      showNotification('Email inviata con successo!', 'success');
      setModalState({ type: null, data: null });
    } catch (error) {
      console.error('Errore invio email:', error);
      showNotification(error.message || 'Errore nell\'invio dell\'email', 'error');
      setModalState({ type: null, data: null });
    }
  };

  const handleCancelSendEmail = () => {
    setModalState({ type: null, data: null });
  };

  // Funzione per rinviare la mail di notifica ticket risolto
  const handleResendEmail = async (ticket) => {
    try {
      const client = users.find(u => u.id === ticket.clienteid);
      if (!client || !client.email) {
        showNotification('Cliente non trovato o email non disponibile', 'error');
        return;
      }

      const response = await fetch(buildApiUrl(`/api/email/notify-ticket-resolved`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({
          ticket: ticket,
          clientEmail: client.email,
          clientName: `${client.nome} ${client.cognome}`
        })
      });

      if (!response.ok) {
        throw new Error('Errore nell\'invio dell\'email');
      }

      showNotification('Email inviata con successo!', 'success');
    } catch (error) {
      console.error('Errore invio email:', error);
      showNotification(error.message || 'Errore nell\'invio dell\'email', 'error');
    }
  };

  const handleSaveAlert = async (alertData, emailOption = 'none') => {
    try {
      const formData = new FormData();
      formData.append('title', alertData.title);
      formData.append('body', alertData.description);
      formData.append('level', alertData.priority);
      formData.append('clients', JSON.stringify(alertData.clients));
      formData.append('isPermanent', alertData.isPermanent);
      formData.append('daysToExpire', alertData.daysToExpire);
      formData.append('created_by', currentUser?.nome + ' ' + currentUser?.cognome);

      // Gestisci emailOption che può essere una stringa o un oggetto { option: 'company', companies: ['azienda1', 'azienda2'] }
      if (typeof emailOption === 'object' && emailOption.option === 'company') {
        formData.append('emailOption', 'company');
        formData.append('emailCompanies', JSON.stringify(emailOption.companies));
      } else {
        formData.append('emailOption', emailOption); // 'all', 'admins', 'none'
      }

      // Aggiungi i file selezionati
      if (alertData.files && alertData.files.length > 0) {
        alertData.files.forEach((file, index) => {
          formData.append('attachments', file);
        });
      }

      const res = await fetch(buildApiUrl('/api/alerts'), {
        method: 'POST',
        headers: {
          'x-user-role': 'tecnico',
          'x-user-id': currentUser?.id,
          ...getAuthHeader()
        },
        body: formData
      });
      if (!res.ok) throw new Error('Errore creazione avviso');

      const result = await res.json();

      // Chiudi il modal degli avvisi
      setModalState({ type: null, data: null });

      showNotification('Avviso creato con successo!', 'success');
      setAlertsRefreshTrigger(prev => prev + 1); // Trigger refresh avvisi
    } catch (e) {
      console.error('Errore salvataggio avviso:', e);
      showNotification('Errore nel salvare l\'avviso', 'error');
    }
  };

  const handleEditAlert = async (alertData) => {
    try {
      console.log('🔍 DEBUG ALERTS: Tentativo di modifica avviso');
      console.log('🔍 DEBUG ALERTS: Alert ID:', alertData.id);
      console.log('🔍 DEBUG ALERTS: Alert title:', alertData.title);

      const authHeaders = getAuthHeader();
      console.log('🔍 DEBUG ALERTS: Auth headers:', authHeaders);

      const formData = new FormData();
      formData.append('title', alertData.title);
      formData.append('body', alertData.description);
      formData.append('level', alertData.priority);
      formData.append('clients', JSON.stringify(alertData.clients));
      formData.append('isPermanent', alertData.isPermanent);
      formData.append('daysToExpire', alertData.daysToExpire);
      formData.append('existingAttachments', JSON.stringify(alertData.existingAttachments || []));

      // Aggiungi i nuovi file selezionati
      if (alertData.files && alertData.files.length > 0) {
        alertData.files.forEach((file, index) => {
          formData.append('attachments', file);
        });
      }

      const res = await fetch(buildApiUrl(`/api/alerts/${alertData.id}`), {
        method: 'PUT',
        headers: {
          'x-user-role': 'tecnico',
          'x-user-id': currentUser?.id,
          ...authHeaders
        },
        body: formData
      });

      console.log('🔍 DEBUG ALERTS: Response status:', res.status);
      console.log('🔍 DEBUG ALERTS: Response ok:', res.ok);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('🔍 DEBUG ALERTS: Errore response:', res.status, errorText);
        throw new Error('Errore modifica avviso');
      }
      showNotification('Avviso modificato con successo!', 'success');
      setAlertsRefreshTrigger(prev => prev + 1); // Trigger refresh avvisi
    } catch (e) {
      console.error('Errore modifica avviso:', e);
      showNotification('Errore nel modificare l\'avviso', 'error');
    }
  };

  const handleFornitureCountChange = (ticketId, newCount) => {
    setTickets(prev => prev.map(t =>
      t.id === ticketId ? { ...t, fornitureCount: newCount } : t
    ));
  };

  // ====================================================================
  // WRAPPER FUNZIONI
  // ====================================================================
  const handleUpdateSettings = async () => {
    try {
      console.log('🔄 Aggiornamento impostazioni tecnico...');
      console.log('Dati impostazioni:', settingsData);

      // Validazione password (solo se fornita)
      if (settingsData.nuovaPassword && settingsData.nuovaPassword.trim() !== '' && settingsData.nuovaPassword.length < 6) {
        showNotification('La nuova password deve essere di almeno 6 caratteri', 'error');
        return;
      }

      // Prepara i dati da inviare
      const updateData = {
        nome: settingsData.nome,
        cognome: settingsData.cognome || '',
        email: settingsData.email,
        telefono: settingsData.telefono || null,
        azienda: settingsData.azienda || null
      };

      // Aggiungi password solo se fornita
      if (settingsData.nuovaPassword && settingsData.nuovaPassword.trim() !== '') {
        updateData.password = settingsData.nuovaPassword;
      }

      console.log('Dati da inviare:', updateData);

      // Chiamata API per aggiornare le impostazioni
      const response = await fetch(buildApiUrl(`/api/users/${currentUser.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Errore API: ${response.statusText}`);
      }

      const updatedUser = await response.json();
      console.log('✅ Utente aggiornato:', updatedUser);

      // Aggiorna lo stato dell'utente corrente
      setCurrentUser(prev => ({
        ...prev,
        ...updatedUser
      }));

      // Resetta i dati delle impostazioni
      setSettingsData({
        nome: updatedUser.nome || '',
        cognome: updatedUser.cognome || '',
        email: updatedUser.email || '',
        telefono: updatedUser.telefono || '',
        azienda: updatedUser.azienda || '',
        passwordAttuale: updatedUser.password || '',
        nuovaPassword: ''
      });

      showNotification('Impostazioni aggiornate con successo!', 'success');
      closeModal();

    } catch (error) {
      console.error('❌ Errore aggiornamento impostazioni:', error);
      showNotification(error.message || 'Errore durante l\'aggiornamento delle impostazioni', 'error');
    }
  };
  const handleConfirmUrgentCreation = async () => {
    // Conferma creazione URGENTE: per i tecnici mostra modal email, per clienti crea direttamente

    // Recupera le foto dal modalState se presenti
    const photos = modalState.data?.photos || [];
    const selectedAzienda = modalState.data?.selectedAzienda || '';
    console.log('🔍 DEBUG: handleConfirmUrgentCreation - photos recuperate:', photos.length);
    console.log('🔍 DEBUG: handleConfirmUrgentCreation - selectedAzienda:', selectedAzienda);

    // Per i tecnici, mostra il modal di conferma email anche per priorità urgente
    if (currentUser.ruolo === 'tecnico') {
      console.log('🔍 DEBUG: Priorità urgente confermata - mostrando modal email per tecnico');

      const clientName = users.find(u => u.id === parseInt(selectedClientForNewTicket))?.azienda || 'Cliente';

      setPendingTicketAction({
        type: 'create',
        data: newTicketData,
        isEditing: isEditingTicket,
        selectedClient: selectedClientForNewTicket,
        photos: photos, // Passa le foto al pending action
        selectedAzienda: selectedAzienda // Passa l'azienda selezionata
      });
      setModalState({
        type: 'emailConfirm',
        data: {
          isEditing: isEditingTicket,
          clientName: clientName
        }
      });
      return;
    }

    // Per i clienti, crea direttamente il ticket con invio email obbligatorio
    await createTicket(newTicketData, isEditingTicket, wrappedHandleUpdateTicket, selectedClientForNewTicket, true, photos, selectedAzienda);
    resetNewTicketData();
    setModalState({ type: null, data: null });
  };

  const handleConfirmEmptyDescription = async () => {
    // L'utente ha confermato di voler procedere senza descrizione
    // Recupera le foto dal modalState se presenti
    const photos = modalState.data?.photos || [];
    const selectedAzienda = modalState.data?.selectedAzienda || '';
    console.log('🔍 DEBUG: handleConfirmEmptyDescription - photos recuperate:', photos.length);
    console.log('🔍 DEBUG: handleConfirmEmptyDescription - selectedAzienda:', selectedAzienda);

    // Controlla se è anche URGENTE
    if (!isEditingTicket && newTicketData.priorita === 'urgente') {
      // Passa le foto al prossimo modal
      setModalState({ type: 'urgentConfirm', data: { photos, selectedAzienda } });
      return;
    }

    // Per i tecnici, mostra il modal di conferma email anche dopo descrizione vuota
    if (currentUser.ruolo === 'tecnico') {
      console.log('🔍 DEBUG: Descrizione vuota confermata - mostrando modal email per tecnico');

      const clientName = users.find(u => u.id === parseInt(selectedClientForNewTicket))?.azienda || 'Cliente';

      setPendingTicketAction({
        type: 'create',
        data: newTicketData,
        isEditing: isEditingTicket,
        selectedClient: selectedClientForNewTicket,
        photos: photos, // Passa le foto al pending action
        selectedAzienda: selectedAzienda // Passa l'azienda selezionata
      });
      setModalState({
        type: 'emailConfirm',
        data: {
          isEditing: isEditingTicket,
          clientName: clientName
        }
      });
      return;
    }

    // Per i clienti, crea direttamente il ticket con invio email obbligatorio
    await createTicket(newTicketData, isEditingTicket, wrappedHandleUpdateTicket, selectedClientForNewTicket, true, photos);
    resetNewTicketData();
    setModalState({ type: null, data: null });
  };

  // Funzione per caricare foto a un ticket
  const handleUploadTicketPhotos = async (ticketId, photos) => {
    try {
      console.log('🔄 handleUploadTicketPhotos chiamata:', ticketId, photos.length, 'foto');

      const formData = new FormData();
      photos.forEach(photo => {
        formData.append('photos', photo);
      });

      // Per FormData, NON includere Content-Type nell'header - il browser lo imposta automaticamente con il boundary
      const authHeader = getAuthHeader();
      const headers = {};
      if (authHeader.Authorization) {
        headers['Authorization'] = authHeader.Authorization;
      }

      console.log('🔄 Chiamata API:', buildApiUrl(`/api/tickets/${ticketId}/photos`));

      const response = await fetch(buildApiUrl(`/api/tickets/${ticketId}/photos`), {
        method: 'POST',
        headers: headers,
        body: formData
      });

      console.log('📡 Risposta API:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore durante il caricamento delle foto');
      }

      const result = await response.json();

      // Ritorna i risultati immediatamente
      // Usa requestAnimationFrame multipli per deferire completamente gli aggiornamenti di stato
      requestAnimationFrame(() => {
        setTimeout(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              // Aggiorna il ticket nella lista
              setTickets(prev => prev.map(t =>
                t.id === ticketId
                  ? { ...t, photos: result.photos }
                  : t
              ));

              // Aggiorna anche selectedTicket se è quello corretto
              if (selectedTicket && selectedTicket.id === ticketId) {
                setSelectedTicket({ ...selectedTicket, photos: result.photos });
              }

              // Aggiorna anche photosModalTicket se è aperto e corrisponde al ticket
              if (photosModalTicket && photosModalTicket.id === ticketId) {
                setPhotosModalTicket(prev => ({ ...prev, photos: result.photos }));
              }

              showNotification(result.message || 'File caricati con successo', 'success');
            }, 10);
          });
        }, 10);
      });

      return result.photos;
    } catch (error) {
      console.error('Errore upload file:', error);
      // Usa requestAnimationFrame + setTimeout per evitare aggiornamenti di stato durante il render
      requestAnimationFrame(() => {
        setTimeout(() => {
          showNotification(error.message || 'Errore durante il caricamento dei file', 'error');
        }, 0);
      });
      throw error;
    }
  };

  // Funzione per eliminare foto di un ticket
  const handleDeleteTicketPhoto = async (ticketId, photoFilename) => {
    try {
      const response = await fetch(buildApiUrl(`/api/tickets/${ticketId}/photos/${photoFilename}`), {
        method: 'DELETE',
        headers: getAuthHeader()
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore durante l\'eliminazione della foto');
      }

      const result = await response.json();

      // Aggiorna il ticket nella lista
      setTickets(prev => prev.map(t =>
        t.id === ticketId
          ? { ...t, photos: result.photos }
          : t
      ));

      // Aggiorna anche selectedTicket se è quello corretto
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, photos: result.photos });
      }

      showNotification(result.message || 'Foto eliminata con successo', 'success');
      return result.photos;
    } catch (error) {
      console.error('Errore eliminazione foto:', error);
      showNotification(error.message || 'Errore durante l\'eliminazione della foto', 'error');
      throw error;
    }
  };

  const wrappedHandleCreateTicket = async (photos = [], selectedAzienda = '') => {
    console.log('🔍 DEBUG: wrappedHandleCreateTicket chiamata');
    console.log('🔍 DEBUG: currentUser.ruolo =', currentUser.ruolo);
    console.log('🔍 DEBUG: isEditingTicket =', isEditingTicket);
    console.log('🔍 DEBUG: photos ricevute =', photos.length, 'foto');
    console.log('🔍 DEBUG: selectedAzienda =', selectedAzienda);

    // Se descrizione vuota, chiedi conferma
    if (!newTicketData.descrizione || newTicketData.descrizione.trim() === '') {
      console.log('🔍 DEBUG: Descrizione vuota, mostrando modal conferma');
      // Passa le foto nel data del modalState
      setModalState({ type: 'emptyDescriptionConfirm', data: { photos, selectedAzienda } });
      return;
    }
    // Se priorità URGENTE e stiamo creando (non edit), mostra conferma
    if (!isEditingTicket && newTicketData.priorita === 'urgente') {
      console.log('🔍 DEBUG: Priorità urgente, mostrando modal conferma');
      // Passa le foto nel data del modalState
      setModalState({ type: 'urgentConfirm', data: { photos, selectedAzienda } });
      return;
    }

    // Chiedi conferma per l'invio email SOLO per i tecnici
    if (currentUser.ruolo === 'tecnico') {
      console.log('🔍 DEBUG: Tecnico - mostrando modal di conferma email');
      console.log('🔍 DEBUG: selectedClientForNewTicket =', selectedClientForNewTicket);

      const clientName = users.find(u => u.id === parseInt(selectedClientForNewTicket))?.azienda || 'Cliente';
      console.log('🔍 DEBUG: clientName =', clientName);

      setPendingTicketAction({
        type: 'create',
        data: newTicketData,
        isEditing: isEditingTicket,
        selectedClient: selectedClientForNewTicket,
        photos: photos, // Salva le foto nel pending action
        selectedAzienda: selectedAzienda // Salva l'azienda selezionata
      });
      setModalState({
        type: 'emailConfirm',
        data: {
          isEditing: isEditingTicket,
          clientName: clientName
        }
      });
      console.log('🔍 DEBUG: Modal state impostato a emailConfirm');
      console.log('🔍 DEBUG: modalState dopo setModalState =', { type: 'emailConfirm', data: { isEditing: isEditingTicket, clientName: clientName } });
      return;
    }

    // Per i clienti, crea direttamente il ticket con invio email obbligatorio
    console.log('🔍 DEBUG: Cliente - creazione ticket con email obbligatoria');
    console.log('🔍 DEBUG: Cliente - photos =', photos.length, 'foto');
    try {
      await createTicket(newTicketData, isEditingTicket, wrappedHandleUpdateTicket, selectedClientForNewTicket, true, photos, selectedAzienda);
    } catch (error) {
      console.error('Errore creazione ticket:', error);
      // La modale rimane aperta in caso di errore, l'errore viene mostrato dalla funzione createTicket
    }
  };

  const wrappedHandleUpdateTicket = (selectedAzienda = '') => {
    // Per le modifiche dei dettagli del ticket (non cambi di stato), 
    // aggiorna direttamente senza modal di conferma email
    console.log('🔍 DEBUG: Modifica dettagli ticket - currentUser.ruolo =', currentUser.ruolo);
    console.log('🔍 DEBUG: Aggiornamento diretto senza modal email');
    console.log('🔍 DEBUG: selectedAzienda =', selectedAzienda);
    updateTicket(newTicketData, isEditingTicket, selectedClientForNewTicket, false, selectedAzienda);
  };

  // Funzione per determinare la card corrente
  const getCurrentCardState = () => {
    // Se non siamo nella dashboard, usa dashboardTargetState
    if (!showDashboard && dashboardTargetState) {
      return dashboardTargetState;
    }

    // Se siamo nella dashboard, determina la card basata sui ticket selezionati
    // Per ora, ritorna 'aperto' come default
    return 'aperto';
  };

  // Funzione per determinare la card di origine del ticket
  const getTicketOriginCard = (ticketId) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      return ticket.stato;
    }
    return 'aperto'; // Default
  };

  // Gestione conferma email
  const handleConfirmEmail = async () => {
    if (!pendingTicketAction) {
      // Chiudi la modale anche se non c'è pendingTicketAction
      setPendingTicketAction(null);
      setModalState({ type: null, data: null });
      return;
    }

    const { type, data, isEditing, selectedClient } = pendingTicketAction;

    // Chiudi la modale IMMEDIATAMENTE prima dell'operazione asincrona
    setPendingTicketAction(null);
    setModalState({ type: null, data: null });

    try {
      if (type === 'create') {
        // Crea ticket con invio email
        const photos = pendingTicketAction?.photos || [];
        const selectedAzienda = pendingTicketAction?.selectedAzienda || '';
        console.log('🔍 DEBUG handleConfirmEmail: photos =', photos.length, 'file');
        console.log('🔍 DEBUG handleConfirmEmail: selectedAzienda =', selectedAzienda);
        await createTicket(data, isEditing, wrappedHandleUpdateTicket, selectedClient, true, photos, selectedAzienda);
      } else if (type === 'update') {
        // Aggiorna ticket con invio email
        await updateTicket(data, isEditing, selectedClient, true);
      } else if (type === 'changeStatus') {
        // Cambia stato ticket con invio email
        await changeStatus(data.id, data.status, handleOpenTimeLogger, true);

        // Mostra l'effetto di evidenziazione per le card coinvolte
        const originCardState = getTicketOriginCard(data.id);
        const destinationCardState = data.status;

        // Evidenzia la card di destinazione (verde - riceve ticket)
        window.dispatchEvent(new CustomEvent('dashboard-highlight', {
          detail: { state: destinationCardState, type: 'up', direction: 'forward' }
        }));

        // Evidenzia la card di origine (rosso - perde ticket)
        window.dispatchEvent(new CustomEvent('dashboard-highlight', {
          detail: { state: originCardState, type: 'down', direction: 'forward' }
        }));

        // Mantieni la vista corrente senza rimbalzi
        setDashboardTargetState(originCardState);

        // Feedback locale rimosso (niente eventi aggiuntivi)

        // Reset del flag di protezione
        isChangingStatusRef.current = false;
      } else if (type === 'confirmTimeLogs') {
        // Conferma timeLogs con invio email
        await handleConfirmTimeLogs(data.timeLogs, true);

        // Mostra l'effetto di evidenziazione per le card coinvolte
        if (selectedTicket) {
          const originCardState = getTicketOriginCard(selectedTicket.id);
          const destinationCardState = 'risolto'; // TimeLogs porta sempre a risolto

          // Evidenzia la card di destinazione (verde - riceve ticket)
          window.dispatchEvent(new CustomEvent('dashboard-highlight', {
            detail: { state: destinationCardState, type: 'up', direction: 'forward' }
          }));

          // Evidenzia la card di origine (rosso - perde ticket)
          window.dispatchEvent(new CustomEvent('dashboard-highlight', {
            detail: { state: originCardState, type: 'down', direction: 'forward' }
          }));

          // Mantieni la vista corrente senza rimbalzi
          setDashboardTargetState(originCardState);

          // Feedback locale rimosso (niente eventi aggiuntivi)
        }
      }
    } catch (error) {
      console.error('Errore durante conferma email:', error);
      // Reset del flag di protezione anche in caso di errore
      if (type === 'changeStatus') {
        isChangingStatusRef.current = false;
      }
    }
  };

  const handleCancelEmail = async () => {
    if (!pendingTicketAction) {
      // Chiudi la modale anche se non c'è pendingTicketAction
      setPendingTicketAction(null);
      setModalState({ type: null, data: null });
      return;
    }

    const { type, data, isEditing, selectedClient } = pendingTicketAction;

    // Chiudi la modale IMMEDIATAMENTE prima dell'operazione asincrona
    setPendingTicketAction(null);
    setModalState({ type: null, data: null });

    try {
      if (type === 'create') {
        // Crea ticket senza invio email
        const photos = pendingTicketAction?.photos || [];
        const selectedAzienda = pendingTicketAction?.selectedAzienda || '';
        console.log('🔍 DEBUG handleCancelEmail: photos =', photos.length, 'file');
        console.log('🔍 DEBUG handleCancelEmail: selectedAzienda =', selectedAzienda);
        await createTicket(data, isEditing, wrappedHandleUpdateTicket, selectedClient, false, photos, selectedAzienda);
      } else if (type === 'update') {
        // Aggiorna ticket senza invio email
        await updateTicket(data, isEditing, selectedClient, false);
      } else if (type === 'changeStatus') {
        // Cambia stato ticket senza invio email
        await changeStatus(data.id, data.status, handleOpenTimeLogger, false);

        // Mostra l'effetto di evidenziazione per le card coinvolte
        const originCardState = getTicketOriginCard(data.id);
        const destinationCardState = data.status;

        // Evidenzia la card di destinazione (verde - riceve ticket)
        window.dispatchEvent(new CustomEvent('dashboard-highlight', {
          detail: { state: destinationCardState, type: 'up', direction: 'forward' }
        }));

        // Evidenzia la card di origine (rosso - perde ticket)
        window.dispatchEvent(new CustomEvent('dashboard-highlight', {
          detail: { state: originCardState, type: 'down', direction: 'forward' }
        }));

        // Mantieni la vista corrente senza rimbalzi
        setDashboardTargetState(originCardState);

        // Feedback locale rimosso (niente eventi aggiuntivi)

        // Reset del flag di protezione
        isChangingStatusRef.current = false;
      } else if (type === 'confirmTimeLogs') {
        // Conferma timeLogs senza invio email
        await handleConfirmTimeLogs(data.timeLogs, false);

        // Mostra l'effetto di evidenziazione per le card coinvolte
        if (selectedTicket) {
          const originCardState = getTicketOriginCard(selectedTicket.id);
          const destinationCardState = 'risolto'; // TimeLogs porta sempre a risolto

          // Evidenzia la card di destinazione (verde - riceve ticket)
          window.dispatchEvent(new CustomEvent('dashboard-highlight', {
            detail: { state: destinationCardState, type: 'up', direction: 'forward' }
          }));

          // Evidenzia la card di origine (rosso - perde ticket)
          window.dispatchEvent(new CustomEvent('dashboard-highlight', {
            detail: { state: originCardState, type: 'down', direction: 'forward' }
          }));

          // Mantieni la vista corrente senza rimbalzi
          setDashboardTargetState(originCardState);

          // Feedback locale rimosso (niente eventi aggiuntivi)
        }
      }
    } catch (error) {
      console.error('Errore durante annullamento email:', error);
      // Reset del flag di protezione anche in caso di errore
      if (type === 'changeStatus') {
        isChangingStatusRef.current = false;
      }
    }
  };

  // Gestione richiesta assistenza veloce
  const handleQuickRequest = async (formData, photos = []) => {
    try {
      // Crea FormData per supportare sia i dati che le foto
      const formDataToSend = new FormData();
      formDataToSend.append('titolo', formData.titolo);
      formDataToSend.append('descrizione', formData.descrizione);
      formDataToSend.append('priorita', formData.priorita);
      formDataToSend.append('nomerichiedente', `${formData.nome} ${formData.cognome}`);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('telefono', formData.telefono || '');
      formDataToSend.append('azienda', formData.azienda || '');

      // Aggiungi le foto se presenti
      photos.forEach(photo => {
        formDataToSend.append('photos', photo);
      });

      const response = await fetch(buildApiUrl('/api/tickets/quick-request'), {
        method: 'POST',
        body: formDataToSend
      });

      if (!response.ok) {
        throw new Error('Errore nell\'invio della richiesta');
      }

      showNotification('Richiesta inviata con successo! Ti contatteremo presto.', 'success');
    } catch (error) {
      console.error('Errore richiesta veloce:', error);
      showNotification('Errore nell\'invio della richiesta. Riprova più tardi.', 'error');
    }
  };

  const existingCompanies = useMemo(() => {
    const companiesSet = new Set();
    users.forEach(user => {
      if (user.ruolo === 'cliente' && user.azienda) {
        companiesSet.add(user.azienda.trim());
      }
    });
    return Array.from(companiesSet).sort((a, b) => a.localeCompare(b));
  }, [users]);

  const wrappedHandleCreateClient = () => {
    handleCreateClient(newClientData, () => {
      setNewClientData({ ...INITIAL_NEW_CLIENT_DATA });
      closeModal();
    });
  };

  const handleChangeStatus = (id, status) => {
    console.log('🔍 DEBUG: handleChangeStatus chiamata - id:', id, 'status:', status, 'ruolo:', currentUser.ruolo);

    // Protezione contro chiamate multiple
    if (isChangingStatusRef.current) {
      console.log('⚠️ Cambio stato già in corso, ignoro la chiamata duplicata');
      return;
    }

    // Se è un tecnico e il status è "risolto", apri prima il TimeLoggerModal
    if (currentUser.ruolo === 'tecnico' && status === 'risolto') {
      console.log('🔍 DEBUG: Status risolto - aprendo TimeLoggerModal prima del modal email');
      handleOpenTimeLogger(tickets.find(t => t.id === id));
      return;
    }

    // Se è un tecnico, chiedi conferma per l'invio email
    if (currentUser.ruolo === 'tecnico') {
      console.log('🔍 DEBUG: Cambio stato ticket - currentUser.ruolo =', currentUser.ruolo);
      console.log('🔍 DEBUG: Mostrando modal di conferma email per cambio stato');

      // Controlla se c'è già una modale aperta
      if (modalState.type === 'emailConfirm' && pendingTicketAction?.type === 'changeStatus') {
        console.log('⚠️ Modale email già aperta per cambio stato, ignoro la chiamata');
        return;
      }

      isChangingStatusRef.current = true;

      const ticket = tickets.find(t => t.id === id);
      const clientName = ticket ? users.find(u => u.id === ticket.clienteid)?.azienda || 'Cliente' : 'Cliente';

      console.log('🔍 DEBUG: Ticket trovato:', ticket?.id, 'Cliente:', clientName);

      setPendingTicketAction({
        type: 'changeStatus',
        data: { id, status },
        isEditing: false,
        selectedClient: null
      });
      setModalState({
        type: 'emailConfirm',
        data: {
          isEditing: false,
          clientName: clientName,
          statusChange: true,
          newStatus: status
        }
      });
      return;
    }

    console.log('🔍 DEBUG: Utente non è tecnico, procedendo senza modal');
    isChangingStatusRef.current = true;
    changeStatus(id, status, handleOpenTimeLogger).finally(() => {
      isChangingStatusRef.current = false;
    });

    // Mostra l'effetto di evidenziazione per le card coinvolte
    const originCardState = getTicketOriginCard(id);
    const destinationCardState = status;

    // Evidenzia la card di destinazione (verde - riceve ticket)
    window.dispatchEvent(new CustomEvent('dashboard-highlight', {
      detail: { state: destinationCardState, type: 'up', direction: 'forward' }
    }));

    // Evidenzia la card di origine (rosso - perde ticket)
    window.dispatchEvent(new CustomEvent('dashboard-highlight', {
      detail: { state: originCardState, type: 'down', direction: 'forward' }
    }));

    // Mantieni la vista corrente senza rimbalzi: niente switch temporaneo alla dashboard
    // Aggiorniamo solo il target per eventuali evidenziazioni
    setDashboardTargetState(originCardState);

    // Nessun feedback locale aggiuntivo
  };

  // Reset del flag quando la modale email viene chiusa
  useEffect(() => {
    if (modalState.type !== 'emailConfirm' && isChangingStatusRef.current) {
      // Se la modale email non è più aperta ma il flag è ancora attivo, resettalo
      // Questo gestisce il caso in cui la modale viene chiusa senza confermare/annullare
      isChangingStatusRef.current = false;
    }
  }, [modalState.type]);

  const handleReopenInLavorazione = (id) => handleChangeStatus(id, 'in_lavorazione');
  const handleReopenAsRisolto = (id) => handleChangeStatus(id, 'risolto');
  const handleSetInviato = (id) => handleChangeStatus(id, 'inviato');
  const handleArchiveTicket = (id) => handleChangeStatus(id, 'chiuso');
  const handleInvoiceTicket = (id) => handleChangeStatus(id, 'fatturato');

  const wrappedHandleConfirmTimeLogs = () => {
    // Se è un tecnico, mostra il modal di conferma email prima di procedere
    if (currentUser.ruolo === 'tecnico') {
      console.log('🔍 DEBUG: TimeLogs completati - mostrando modal di conferma email');

      const ticket = selectedTicket;
      const clientName = ticket ? users.find(u => u.id === ticket.clienteid)?.azienda || 'Cliente' : 'Cliente';

      setPendingTicketAction({
        type: 'confirmTimeLogs',
        data: { timeLogs },
        isEditing: false,
        selectedClient: null
      });
      setModalState({
        type: 'emailConfirm',
        data: {
          isEditing: false,
          clientName: clientName,
          statusChange: true,
          newStatus: 'risolto'
        }
      });
      return;
    }

    // Se non è tecnico, procedi direttamente
    handleConfirmTimeLogs(timeLogs);

    // Mostra l'effetto di evidenziazione per le card coinvolte
    if (selectedTicket) {
      const originCardState = getTicketOriginCard(selectedTicket.id);
      const destinationCardState = 'risolto'; // TimeLogs porta sempre a risolto

      // Evidenzia la card di destinazione (verde - riceve ticket)
      window.dispatchEvent(new CustomEvent('dashboard-highlight', {
        detail: { state: destinationCardState, type: 'up', direction: 'forward' }
      }));

      // Evidenzia la card di origine (rosso - perde ticket)
      window.dispatchEvent(new CustomEvent('dashboard-highlight', {
        detail: { state: originCardState, type: 'down', direction: 'forward' }
      }));

      // Mantieni la vista corrente senza rimbalzi
      setDashboardTargetState(originCardState);

      // Feedback locale sul ticket aggiornato
      try {
        const updated = tickets.find(t => t.id === selectedTicket.id);
        const updatedId = updated ? updated.id : selectedTicket.id;
        window.dispatchEvent(new CustomEvent('ticket-status-updated', { detail: { id: updatedId } }));
      } catch { }
    }
  };

  const handleOpenTicketFromModal = (ticket) => {
    handleSelectTicket(ticket);
    setShowUnreadModal(false);
  };

  // ====================================================================
  // RENDER
  // ====================================================================
  // Se siamo nella pagina di callback Google, mostra il componente di callback
  if (isGoogleCallback) {
    return <GoogleCallback />;
  }

  // Controllo PackVision display mode PRIMA del controllo login
  // Questo permette di mostrare la schermata di autorizzazione monitor invece del login
  const currentUrlParams = new URLSearchParams(window.location.search);
  const isPackVisionDisplayHostname = window.location.hostname === 'packvision.logikaservice.it' ||
    window.location.hostname.includes('packvision');
  const isDisplayMode = currentUrlParams.get('mode') === 'display';

  // console.log('🔍 [App] Controllo PackVision:', {
  //   hostname: window.location.hostname,
  //   isPackVisionDisplayHostname,
  //   mode: currentUrlParams.get('mode'),
  //   isDisplayMode,
  //   monitor: currentUrlParams.get('monitor')
  // });

  if (isDisplayMode || isPackVisionDisplayHostname) {
    const monitorId = currentUrlParams.get('monitor') ? parseInt(currentUrlParams.get('monitor'), 10) : null;

    console.log('✅ [App] Mostro PackVisionWithAuth con monitorId:', monitorId);

    return (
      <>
        <PackVisionWithAuth
          monitorId={monitorId}
          onClose={() => {
            // Se siamo su packvision.logikaservice.it, non possiamo chiudere (è il dominio principale)
            if (isPackVisionDisplayHostname) {
              return; // Non permettere la chiusura se siamo sul dominio dedicato
            }
            // Rimuovi il parametro mode dall'URL e torna alla dashboard
            const url = new URL(window.location.href);
            url.searchParams.delete('mode');
            window.location.href = url.toString();
          }}
        />
      </>
    );
  }

  // console.log('❌ [App] Non in modalità display PackVision, procedo con login normale');

  if (!isLoggedIn) {
    return (
      <>
        <div className="fixed bottom-5 right-5 z-[100] flex flex-col-reverse gap-2">
          {notifications.map((notif) => (
            <Notification key={notif.id} notification={notif} handleClose={() => handleCloseNotification(notif.id)} />
          ))}
        </div>
        <LoginScreen
          {...{
            loginData,
            setLoginData,
            handleLogin,
            onQuickRequest: handleQuickRequest,
            existingClients: users.filter(u => u.ruolo === 'cliente'),
            // Personalizzazione per dominio orari
            ...(isOrariDomain ? {
              title: 'Gestione Orari e Turni',
              subtitle: 'Accedi per gestire orari e turni dei dipendenti',
              bgGradient: 'from-purple-600 to-violet-600',
              iconBgColor: 'bg-purple-100',
              iconColor: 'text-purple-600',
              buttonColor: 'bg-purple-600 hover:bg-purple-700',
              linkColor: 'text-purple-600 hover:text-purple-800'
            } : isVivaldiDomain ? {
              title: 'Sistema Vivaldi',
              subtitle: 'Accedi per gestire annunci e comunicazioni',
              bgGradient: 'from-emerald-600 to-teal-600',
              iconBgColor: 'bg-emerald-100',
              iconColor: 'text-emerald-600',
              buttonColor: 'bg-emerald-600 hover:bg-emerald-700',
              linkColor: 'text-emerald-600 hover:text-emerald-800'
            } : {
              title: 'Sistema Ticketing',
              subtitle: 'Accedi per gestire i tuoi ticket',
              bgGradient: 'from-blue-600 to-indigo-600',
              iconBgColor: 'bg-blue-100',
              iconColor: 'text-blue-600',
              buttonColor: 'bg-blue-600 hover:bg-blue-700',
              linkColor: 'text-blue-600 hover:text-blue-800'
            })
          }}
        />
        {/* Renderizza AllModals anche se non loggato, per preservare il modalState dall'URL */}
        {modalState.type === 'keepassCredentials' && (
          <AllModals
            modalState={modalState}
            closeModal={closeModal}
            closeEmptyDescriptionModal={closeEmptyDescriptionModal}
            handleUpdateSettings={handleUpdateSettings}
            handleConfirmUrgentCreation={handleConfirmUrgentCreation}
            handleConfirmEmptyDescription={handleConfirmEmptyDescription}
            settingsData={settingsData}
            setSettingsData={setSettingsData}
            timeLogs={timeLogs}
            setTimeLogs={setTimeLogs}
            onKeepassImportSuccess={onKeepassImportSuccess}
            handleTimeLogChange={handleTimeLogChange}
            handleAddTimeLog={handleAddTimeLog}
            handleRemoveTimeLog={handleRemoveTimeLog}
            handleDuplicateTimeLog={handleDuplicateTimeLog}
            handleMaterialChange={handleMaterialChange}
            handleAddMaterial={handleAddMaterial}
            handleRemoveMaterial={handleRemoveMaterial}
            handleOffertaChange={handleOffertaChange}
            handleAddOfferta={handleAddOfferta}
            handleRemoveOfferta={handleRemoveOfferta}
            handleConfirmTimeLogs={wrappedHandleConfirmTimeLogs}
            handleSaveTimeLogs={handleSaveTimeLogs}
            currentUser={currentUser}
            showNotification={showNotification}
            users={users}
            onSaveAlert={handleSaveAlert}
            onEditAlert={handleEditAlert}
            onConfirmEmail={handleConfirmEmail}
            onCancelEmail={handleCancelEmail}
            onRequestEmailConfirm={handleRequestEmailConfirm}
            onConfirmAlertEmail={handleConfirmAlertEmail}
            onCancelAlertEmail={handleCancelAlertEmail}
            onConfirmSendEmail={handleConfirmSendEmail}
            onCancelSendEmail={handleCancelSendEmail}
            getAuthHeader={getAuthHeader}
            alertsRefreshTrigger={alertsRefreshTrigger}
          />
        )}
      </>
    );
  }

  if (showDeviceAnalysisStandalone && isLoggedIn && standaloneDeviceId) {
    return (
      <DeviceAnalysisModal
        isOpen={true}
        onClose={() => {
          setShowDeviceAnalysisStandalone(false);
          setStandaloneDeviceId(null);
          setStandaloneDeviceLabel('');
          try { if (window.opener) window.close(); } catch (_) { window.history.back(); }
        }}
        deviceId={standaloneDeviceId}
        deviceLabel={standaloneDeviceLabel}
        getAuthHeader={getAuthHeader}
        fullPage={true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col-reverse gap-2">
        {notifications.map((notif) => (
          <Notification key={notif.id} notification={notif} handleClose={() => handleCloseNotification(notif.id)} />
        ))}
      </div>
      <div className="app-zoom-wrapper">
        {!showPackVision && !showNetworkMonitoring && !showEmail && !showOffice && !showAntiVirus && !showMappatura && (
          <Header
            {...{
              currentUser,
              handleLogout,
              openNewTicketModal,
              openNewClientModal,
              openSettings,
              openManageClientsModal,
              openAlertsHistory,
              openAnalytics,
              openAccessLogs,
              openInactivityTimer,
              openOrariTurni: () => { setShowOrariTurni(true); setShowDashboard(false); setShowVivaldi(false); setShowNetworkMonitoring(false); },
              openVivaldi: () => { setShowVivaldi(true); setShowDashboard(false); setShowOrariTurni(false); setShowNetworkMonitoring(false); },
              openPackVision: () => setShowPackVision(true),
              openNetworkMonitoring: () => { setShowNetworkMonitoring(true); setShowDashboard(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowEmail(false); setNetworkMonitoringInitialView(null); },
              openNetworkMonitoringAgents: () => { setShowNetworkMonitoring(true); setShowDashboard(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowEmail(false); setNetworkMonitoringInitialView('agents'); },
              openNetworkMonitoringCreateAgent: () => { setShowNetworkMonitoring(true); setShowDashboard(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowEmail(false); setNetworkMonitoringInitialView('create'); },
              openNetworkMonitoringDeviceTypes: () => { setShowNetworkMonitoring(true); setShowDashboard(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowEmail(false); setNetworkMonitoringInitialView('deviceTypes'); },
              openNetworkMonitoringNotifications: () => { setShowNetworkMonitoring(true); setShowDashboard(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowEmail(false); setNetworkMonitoringInitialView('notifications'); },
              openNetworkMonitoringTelegram: () => { setShowNetworkMonitoring(true); setShowDashboard(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowEmail(false); setNetworkMonitoringInitialView('telegram'); },
              openMappatura: () => { setShowMappatura(true); setShowDashboard(false); setShowNetworkMonitoring(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowOffice(false); setShowEmail(false); },
              openOffice: handleOpenOffice,
              openAntiVirus: handleOpenAntiVirus,
              openEmail: handleOpenEmail,
              openCommAgent: () => setShowCommAgent(true),
            }}
            openNetworkMonitoringNotifications={() => { setShowNetworkMonitoring(true); setShowDashboard(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowEmail(false); setNetworkMonitoringInitialView('notifications'); }}
            openNetworkMonitoringTelegram={() => { setShowNetworkMonitoring(true); setShowDashboard(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowEmail(false); setNetworkMonitoringInitialView('telegram'); }}
            openMappatura={() => { setShowMappatura(true); setShowDashboard(false); setShowNetworkMonitoring(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowEmail(false); }}
            openCreateContract={() => setShowContractModal(true)}
            openContractsList={() => setShowContractsListModal(true)}
            isOrariDomain={isOrariDomain}
            getAuthHeader={getAuthHeader}
            socket={socket}
          />
        )}

        {showOrariTurni && !isOrariHostname && (
          <div
            className="w-full bg-gray-100 text-gray-700 shadow-sm text-center text-sm py-2 cursor-pointer hover:bg-gray-200"
            onClick={() => { setShowDashboard(true); setShowOrariTurni(false); setShowVivaldi(false); }}
          >
            Torna alla Dashboard
          </div>
        )}

        {showVivaldi && !isVivaldiHostname && (
          <div
            className="w-full bg-gray-100 text-gray-700 shadow-sm text-center text-sm py-2 cursor-pointer hover:bg-gray-200"
            onClick={() => { setShowDashboard(true); setShowVivaldi(false); setShowOrariTurni(false); }}
          >
            Torna alla Dashboard
          </div>
        )}

        {!showDashboard && !showOrariTurni && !showVivaldi && !showPackVision && !showNetworkMonitoring && !showNetworkMap && !showMappatura && !showAntiVirus && !showEmail && (
          <div
            className="w-full bg-gray-100 text-gray-700 shadow-sm text-center text-sm py-2 cursor-pointer hover:bg-gray-200"
            onClick={() => { setShowDashboard(true); setShowNetworkMap(false); setShowMappatura(false); setShowAntiVirus(false); setShowEmail(false); }}
          >
            Torna alla Dashboard
          </div>
        )}

        {showPackVision && (
          <PackVision onClose={() => setShowPackVision(false)} />
        )}

        {showCommAgent && (
          <CommAgentDashboard
            currentUser={currentUser}
            closeModal={() => setShowCommAgent(false)}
            notify={notify}
          />
        )}

        {showNetworkMonitoring && !isOrariHostname && !isVivaldiHostname && !isPackVisionHostname && (
          // Verifica accesso al network monitoring (tecnici/admin globali/admin aziendali)
          (() => {
            const isGlobalAdmin = currentUser?.ruolo === 'admin' || currentUser?.ruolo === 'tecnico';
            const isCompanyAdmin = currentUser?.ruolo === 'cliente' &&
              currentUser?.admin_companies &&
              Array.isArray(currentUser.admin_companies) &&
              currentUser.admin_companies.length > 0;
            const hasAccess = isGlobalAdmin || isCompanyAdmin;
            const isReadOnly = isCompanyAdmin && !isGlobalAdmin; // Solo admin aziendali sono read-only

            return hasAccess ? (
              <NetworkMonitoringDashboard
                getAuthHeader={getAuthHeader}
                socket={socket}
                initialView={networkMonitoringInitialView}
                onViewReset={() => setNetworkMonitoringInitialView(null)}
                onClose={() => { setShowNetworkMonitoring(false); setShowDashboard(true); setSelectedCompanyForNavigation(null); }}
                onNavigateToMappatura={(companyId) => {
                  setSelectedCompanyForNavigation(companyId);
                  setShowNetworkMonitoring(false);
                  setShowMappatura(true);
                }}
                initialCompanyId={selectedCompanyForNavigation}
                readOnly={isReadOnly}
                currentUser={currentUser}
                onNavigateOffice={handleOpenOffice}
                onNavigateEmail={handleOpenEmail}
                onNavigateAntiVirus={handleOpenAntiVirus}
                onNavigateNetworkMonitoring={null}
                onNavigateMappatura={() => { setShowMappatura(true); setShowNetworkMonitoring(false); setShowDashboard(false); setSelectedCompanyForNavigation(selectedCompanyForNavigation); }}
              />
            ) : (
              // Messaggio di accesso negato
              <div className="fixed inset-0 bg-gray-100 z-50 overflow-y-auto">
                <div className="min-h-screen flex items-center justify-center">
                  <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border-2 border-red-200">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-bold text-red-600 mb-3">Accesso Negato</h2>
                      <p className="text-gray-700 mb-3 text-base">
                        Non hai i permessi per accedere al Monitoraggio Rete.
                      </p>
                      <p className="text-gray-600 text-sm mb-6">
                        Contatta l'amministratore per richiedere l'accesso a questo modulo.
                      </p>
                      <div className="space-y-2">
                        <button
                          onClick={() => { setShowNetworkMonitoring(false); setShowDashboard(true); }}
                          className="w-full bg-gray-600 text-white py-2.5 rounded-lg hover:bg-gray-700 transition font-semibold"
                        >
                          Torna alla Dashboard
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()
        )}





        {showMappatura && (
          <MappaturaPage
            onClose={() => { setShowMappatura(false); setShowDashboard(true); setSelectedCompanyForNavigation(null); }}
            getAuthHeader={getAuthHeader}
            selectedCompanyId={selectedCompanyForNavigation}
            onNavigateToMonitoring={(companyId) => {
              setSelectedCompanyForNavigation(companyId);
              setShowMappatura(false);
              setShowNetworkMonitoring(true);
            }}
            currentUser={currentUser}
            onNavigateOffice={handleOpenOffice}
            onNavigateEmail={handleOpenEmail}
            onNavigateAntiVirus={handleOpenAntiVirus}
            onNavigateMappatura={null}
          />
        )}

        {showOffice && (
          <OfficePage
            onClose={() => { setShowOffice(false); setShowDashboard(true); }}
            getAuthHeader={getAuthHeader}
            selectedCompanyId={selectedCompanyForNavigation || (currentUser?.ruolo === 'cliente' ? currentUser?.azienda_id : null) || (currentUser?.admin_companies && currentUser.admin_companies.length > 0 ? currentUser.admin_companies[0] : null)}
            onOpenTicket={openNewTicketWithData}
            currentUser={currentUser}
            onNavigateEmail={handleOpenEmail}
            onNavigateAntiVirus={handleOpenAntiVirus}
            onNavigateNetworkMonitoring={() => { setShowNetworkMonitoring(true); setShowDashboard(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowEmail(false); setShowOffice(false); setNetworkMonitoringInitialView(null); }}
            onNavigateMappatura={() => { setShowMappatura(true); setShowDashboard(false); setShowNetworkMonitoring(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowOffice(false); setShowEmail(false); }}
          />
        )}

        {showAntiVirus && (
          <AntiVirusPage
            onClose={() => { setShowAntiVirus(false); setShowDashboard(true); }}
            getAuthHeader={getAuthHeader}
            readOnly={currentUser?.ruolo === 'cliente' && !!(currentUser?.admin_companies && currentUser.admin_companies.length > 0)}
            currentUser={currentUser}
            onOpenTicket={openNewTicketWithData}
            onNavigateOffice={handleOpenOffice}
            onNavigateEmail={handleOpenEmail}
            onNavigateNetworkMonitoring={() => { setShowNetworkMonitoring(true); setShowDashboard(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowEmail(false); setShowOffice(false); setNetworkMonitoringInitialView(null); }}
            onNavigateMappatura={() => { setShowMappatura(true); setShowDashboard(false); setShowNetworkMonitoring(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowOffice(false); setShowEmail(false); }}
          />
        )}

        {showEmail && (
          <EmailPage
            onClose={() => { setShowEmail(false); setShowDashboard(true); }}
            getAuthHeader={getAuthHeader}
            selectedCompanyId={selectedCompanyForNavigation || (currentUser?.ruolo === 'cliente' ? currentUser?.azienda_id : null) || (currentUser?.admin_companies && currentUser.admin_companies.length > 0 ? currentUser.admin_companies[0] : null)}
            currentUser={currentUser}
            onOpenTicket={openNewTicketWithData}
            onNavigateOffice={handleOpenOffice}
            onNavigateAntiVirus={handleOpenAntiVirus}
            onNavigateNetworkMonitoring={() => { setShowNetworkMonitoring(true); setShowDashboard(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowEmail(false); setShowOffice(false); setNetworkMonitoringInitialView(null); }}
            onNavigateMappatura={() => { setShowMappatura(true); setShowDashboard(false); setShowNetworkMonitoring(false); setShowOrariTurni(false); setShowVivaldi(false); setShowAntiVirus(false); setShowOffice(false); setShowEmail(false); }}
          />
        )}

        <main className="mx-auto px-4 py-6 max-w-7xl">
          {showVivaldi ? (
            // Verifica accesso al sistema Vivaldi (admin e tecnici hanno sempre accesso)
            (currentUser?.ruolo === 'admin' || currentUser?.ruolo === 'tecnico' || currentUser?.enabled_projects?.includes('vivaldi')) ? (
              <div className="animate-slideInRight">
                <VivaldiManager currentUser={currentUser} getAuthHeader={getAuthHeader} showNotification={showNotification} />
              </div>
            ) : (
              // Messaggio di accesso negato
              <div className="min-h-[60vh] flex items-center justify-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border-2 border-red-200">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-red-600 mb-3">Accesso Negato</h2>
                    <p className="text-gray-700 mb-3 text-base">
                      Non hai i permessi per accedere al sistema Vivaldi.
                    </p>
                    <p className="text-gray-600 text-sm mb-6">
                      Contatta l'amministratore per richiedere l'accesso a questo modulo.
                    </p>
                    <div className="space-y-2">
                      <button
                        onClick={handleLogout}
                        className="w-full bg-red-600 text-white py-2.5 rounded-lg hover:bg-red-700 transition font-semibold"
                      >
                        Torna al Login
                      </button>
                      {!isVivaldiDomain && (
                        <button
                          onClick={() => { setShowDashboard(true); setShowVivaldi(false); }}
                          className="w-full bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300 transition font-semibold"
                        >
                          Torna alla Dashboard
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : showNetworkMonitoring ? (
            // Verifica accesso al network monitoring (tecnici/admin globali/admin aziendali)
            (() => {
              const isGlobalAdmin = currentUser?.ruolo === 'admin' || currentUser?.ruolo === 'tecnico';
              const isCompanyAdmin = currentUser?.ruolo === 'cliente' &&
                currentUser?.admin_companies &&
                Array.isArray(currentUser.admin_companies) &&
                currentUser.admin_companies.length > 0;
              const hasAccess = isGlobalAdmin || isCompanyAdmin;
              const isReadOnly = isCompanyAdmin && !isGlobalAdmin; // Solo admin aziendali sono read-only

              return hasAccess ? (
                <div className="animate-slideInRight">
                  <NetworkMonitoringDashboard
                    getAuthHeader={getAuthHeader}
                    socket={socket}
                    initialView={networkMonitoringInitialView}
                    onViewReset={() => setNetworkMonitoringInitialView(null)}
                    readOnly={isReadOnly}
                  />
                </div>
              ) : (
                // Messaggio di accesso negato
                <div className="min-h-[60vh] flex items-center justify-center">
                  <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border-2 border-red-200">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-bold text-red-600 mb-3">Accesso Negato</h2>
                      <p className="text-gray-700 mb-3 text-base">
                        Non hai i permessi per accedere al Monitoraggio Rete.
                      </p>
                      <p className="text-gray-600 text-sm mb-6">
                        Solo tecnici e amministratori possono accedere a questo modulo.
                      </p>
                      <button
                        onClick={() => { setShowDashboard(true); setShowNetworkMonitoring(false); }}
                        className="w-full bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300 transition font-semibold"
                      >
                        Torna alla Dashboard
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()
          ) : showOrariTurni ? (
            // Verifica accesso al sistema orari (admin e tecnici hanno sempre accesso)
            (currentUser?.ruolo === 'admin' || currentUser?.ruolo === 'tecnico' || currentUser?.enabled_projects?.includes('orari')) ? (
              <div className="animate-slideInRight">
                <TimesheetManager currentUser={currentUser} getAuthHeader={getAuthHeader} showNotification={showNotification} />
              </div>
            ) : (
              // Messaggio di accesso negato
              <div className="min-h-[60vh] flex items-center justify-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border-2 border-red-200">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-red-600 mb-3">Accesso Negato</h2>
                    <p className="text-gray-700 mb-3 text-base">
                      Non hai i permessi per accedere al sistema di gestione orari e turni.
                    </p>
                    <p className="text-gray-600 text-sm mb-6">
                      Contatta l'amministratore per richiedere l'accesso a questo modulo.
                    </p>
                    <div className="space-y-2">
                      <button
                        onClick={handleLogout}
                        className="w-full bg-red-600 text-white py-2.5 rounded-lg hover:bg-red-700 transition font-semibold"
                      >
                        Torna al Login
                      </button>
                      {!isOrariDomain && (
                        <button
                          onClick={() => { setShowDashboard(true); setShowOrariTurni(false); }}
                          className="w-full bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300 transition font-semibold"
                        >
                          Torna alla Dashboard
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : showDashboard ? (
            <div className="animate-slideInRight">
              <Dashboard
                currentUser={currentUser}
                tickets={tickets}
                users={users}
                selectedTicket={selectedTicket}
                setSelectedTicket={setSelectedTicket}
                setModalState={setModalState}
                onCreateTicketFromAlert={handleCreateTicketFromAlert}
                handlers={{
                  handleSelectTicket,
                  handleOpenEditModal,
                  handleOpenTimeLogger,
                  handleViewTimeLog,
                  handleOpenForniture,
                  handleReopenInLavorazione,
                  handleChangeStatus,
                  handleReopenAsRisolto,
                  handleSetInviato,
                  handleArchiveTicket,
                  handleInvoiceTicket,
                  handleDeleteTicket: wrappedHandleDeleteTicket,
                  showNotification,
                  handleSendMessage,
                  handleDeleteMessage,
                  handleUpdateMessage,
                  handleGenerateSentReport,
                  handleGenerateInvoiceReport,
                  handleUploadTicketPhotos,
                  handleDeleteTicketPhoto,
                  setPhotosModalTicket,
                  handleResendEmail
                }}
                getUnreadCount={getUnreadCount}
                externalHighlights={dashboardHighlights}
                alertsRefreshTrigger={alertsRefreshTrigger}
                getAuthHeader={getAuthHeader}
                temporarySupplies={temporarySupplies}
                temporarySuppliesLoading={temporarySuppliesLoading}
                onRemoveTemporarySupply={removeTemporarySupply}
                onRefreshTemporarySupplies={refreshTemporarySuppliesManual}
                onOpenState={(state) => {
                  setDashboardTargetState(state || 'aperto');
                  setShowDashboard(false);
                }}
              />
            </div>
          ) : (
            <div className="animate-slideInRight">
              <TicketListContainer
                {...{ currentUser, tickets, users, selectedTicket, getUnreadCount }}
                setSelectedTicket={setSelectedTicket}
                handlers={{
                  handleSelectTicket,
                  handleOpenEditModal,
                  handleOpenTimeLogger,
                  handleViewTimeLog,
                  handleOpenForniture,
                  handleReopenInLavorazione,
                  handleChangeStatus,
                  handleReopenAsRisolto,
                  handleSetInviato,
                  handleArchiveTicket,
                  handleInvoiceTicket,
                  handleDeleteTicket: wrappedHandleDeleteTicket,
                  showNotification,
                  handleSendMessage,
                  handleDeleteMessage,
                  handleUpdateMessage,
                  handleGenerateSentReport,
                  handleGenerateInvoiceReport,
                  handleUploadTicketPhotos,
                  handleDeleteTicketPhoto,
                  setPhotosModalTicket,
                  handleResendEmail
                }}
                showFilters={true}
                externalViewState={dashboardTargetState}
              />
            </div>
          )}
        </main>
      </div>

      <AllModals
        modalState={modalState}
        closeModal={closeModal}
        closeEmptyDescriptionModal={closeEmptyDescriptionModal}
        handleUpdateSettings={handleUpdateSettings}
        handleConfirmUrgentCreation={handleConfirmUrgentCreation}
        handleConfirmEmptyDescription={handleConfirmEmptyDescription}
        settingsData={settingsData}
        setSettingsData={setSettingsData}
        timeLogs={timeLogs}
        setTimeLogs={setTimeLogs}
        onKeepassImportSuccess={onKeepassImportSuccess}
        handleTimeLogChange={handleTimeLogChange}
        handleAddTimeLog={handleAddTimeLog}
        handleRemoveTimeLog={handleRemoveTimeLog}
        handleDuplicateTimeLog={handleDuplicateTimeLog}
        handleMaterialChange={handleMaterialChange}
        handleAddMaterial={handleAddMaterial}
        handleRemoveMaterial={handleRemoveMaterial}
        handleOffertaChange={handleOffertaChange}
        handleAddOfferta={handleAddOfferta}
        handleRemoveOfferta={handleRemoveOfferta}
        handleConfirmTimeLogs={wrappedHandleConfirmTimeLogs}
        handleSaveTimeLogs={handleSaveTimeLogs}
        currentUser={currentUser}
        showNotification={showNotification}
        users={users}
        setSelectedTicket={setSelectedTicket}
        setTickets={setTickets}
        onSaveAlert={handleSaveAlert}
        onEditAlert={handleEditAlert}
        onConfirmEmail={handleConfirmEmail}
        onCancelEmail={handleCancelEmail}
        onRequestEmailConfirm={handleRequestEmailConfirm}
        onConfirmAlertEmail={handleConfirmAlertEmail}
        onCancelAlertEmail={handleCancelAlertEmail}
        onConfirmSendEmail={handleConfirmSendEmail}
        onCancelSendEmail={handleCancelSendEmail}
        getAuthHeader={getAuthHeader}
        alertsRefreshTrigger={alertsRefreshTrigger}
      />

      {modalState.type === 'manageClients' && (
        <ManageClientsModal
          clienti={users.filter(u => u.ruolo === 'cliente')}
          onClose={closeModal}
          onUpdateClient={handleUpdateClient}
          onDeleteClient={handleDeleteClient}
          getAuthHeader={getAuthHeader}
        />
      )}

      {modalState.type === 'newClient' && (
        <NewClientModal
          newClientData={newClientData}
          setNewClientData={setNewClientData}
          onClose={closeModal}
          onSave={wrappedHandleCreateClient}
          existingCompanies={existingCompanies}
        />
      )}

      {modalState.type === 'newTicket' && (
        <NewTicketModal
          onClose={closeModal}
          onSave={isEditingTicket ? wrappedHandleUpdateTicket : wrappedHandleCreateTicket}
          newTicketData={newTicketData}
          setNewTicketData={setNewTicketData}
          isEditingTicket={isEditingTicket}
          currentUser={currentUser}
          clientiAttivi={users.filter(u => u.ruolo === 'cliente')}
          selectedClientForNewTicket={selectedClientForNewTicket}
          setSelectedClientForNewTicket={setSelectedClientForNewTicket}
          editingTicket={isEditingTicket ? tickets.find(t => t.id === isEditingTicket) || modalState.data : null}
        />
      )}

      {modalState.type === 'inactivityTimer' && (
        <InactivityTimerModal
          closeModal={closeModal}
          currentTimeout={inactivityTimeout}
          onTimeoutChange={handleInactivityTimeoutChange}
        />
      )}

      {fornitureModalTicket && (
        <FornitureModal
          ticket={fornitureModalTicket}
          onClose={() => setFornitureModalTicket(null)}
          onFornitureCountChange={handleFornitureCountChange}
          currentUser={currentUser}
          getAuthHeader={getAuthHeader}
        />
      )}

      {showUnreadModal && (
        <UnreadMessagesModal
          tickets={tickets}
          getUnreadCount={getUnreadCount}
          onClose={() => setShowUnreadModal(false)}
          onOpenTicket={handleOpenTicketFromModal}
          currentUser={currentUser}
        />
      )}

      {photosModalTicket && (
        <TicketPhotosModal
          ticket={photosModalTicket}
          photos={photosModalTicket.photos || []}
          onClose={() => {
            // Aggiorna il ticket dal database prima di chiudere
            const updatedTicket = tickets.find(t => t.id === photosModalTicket.id);
            if (updatedTicket) {
              setPhotosModalTicket(null);
            } else {
              setPhotosModalTicket(null);
            }
          }}
          onUploadPhotos={handleUploadTicketPhotos}
          onDeletePhoto={async (photoFilename) => {
            const updatedPhotos = await handleDeleteTicketPhoto(photosModalTicket.id, photoFilename);
            // Aggiorna il ticket nel modal
            const updatedTicket = tickets.find(t => t.id === photosModalTicket.id);
            if (updatedTicket) {
              setPhotosModalTicket({ ...updatedTicket, photos: updatedPhotos });
            }
            return updatedPhotos;
          }}
          getAuthHeader={getAuthHeader}
          currentUser={currentUser}
        />
      )}

      {showContractModal && (
        <ManageContractsModal
          onClose={() => setShowContractModal(false)}
          onSuccess={() => {
            // Il contratto è stato creato con successo
            // I contratti vengono ricaricati automaticamente quando necessario
            // (ad esempio nella Dashboard quando si ricarica la pagina)
          }}
          notify={notify}
          getAuthHeader={getAuthHeader}
        />
      )}

      {showContractsListModal && (
        <ContractsListModal
          onClose={() => setShowContractsListModal(false)}
          getAuthHeader={getAuthHeader}
          notify={notify}
        />
      )}
    </div>
  );
}
