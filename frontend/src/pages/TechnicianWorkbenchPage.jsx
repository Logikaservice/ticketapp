import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import {
  Search,
  Building2,
  Mail,
  Shield,
  Eye,
  Monitor,
  Gauge,
  Wifi,
  MapPin,
  Bell,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Moon,
  RefreshCw,
  Globe,
  Settings,
  Palette,
  LogOut,
  Calendar,
  Volume2,
  Layers,
  Ticket as TicketHomeIcon,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  LayoutTemplate
} from 'lucide-react';
import { fetchImportantAlertsForHub } from '../utils/importantAlertsFeed';
import ImportantAlertsHubEmbedded, { hubAlertLevelChrome } from '../components/hub/ImportantAlertsHubEmbedded';
import CommAgentDashboard from '../components/CommAgentDashboard';
import CommAgentManager from '../components/CommAgentManager';
import ContractsListModal from '../components/Modals/ContractsListModal';
import EmailPage from './EmailPage';
import OfficePage from './OfficePage';
import AntiVirusPage from './AntiVirusPage';
import DispositiviAziendaliPage from './DispositiviAziendaliPage';
import SpeedTestPage from './SpeedTestPage';
import NetworkMonitoringDashboard from '../components/NetworkMonitoringDashboard';
import {
  TECH_HUB_ACCENT_PALETTE,
  STORAGE_KEY_TECH_HUB_ACCENT,
  STORAGE_KEY_TECH_HUB_SURFACE,
  hubChromeCssVariables,
  hexToRgba,
  readableOnAccent,
  getStoredTechHubAccent,
  getStoredTechHubSurfaceMode
} from '../utils/techHubAccent';
import HubOverviewSection from '../components/hub/HubOverviewSection';
import HubLogikubeMark from '../components/hub/HubLogikubeMark';
import TicketsHubEmbedded from '../components/hub/TicketsHubEmbedded';
import HubTimeCard from '../components/hub/HubTimeCard';
import TicketsCalendar from '../components/TicketsCalendar';
import { loadHubLayout, getDefaultHubLayout, sanitizeLayoutItems } from '../utils/hubOverviewLayout';
import { hubModalCssVars } from '../utils/techHubAccent';
import { buildApiUrl } from '../utils/apiConfig';

const STORAGE_KEY_SIDEBAR_COLLAPSED = 'techHubSidebarCollapsed';
const HUB_ALERTS_PAGE_SIZE = 5;

const hubTinyIconBtn =
  'rounded-lg border border-transparent p-1.5 text-[color:var(--hub-chrome-text-muted)] transition hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-accent)] hover:[border-color:var(--hub-accent-border)] disabled:pointer-events-none disabled:opacity-0';

function useMinMd() {
  const [ok, setOk] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const fn = () => setOk(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return ok;
}

function loadSidebarCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY_SIDEBAR_COLLAPSED) === '1';
  } catch (_) {
    return false;
  }
}

function NavGroup({ title, open, onToggle, children, railMode }) {
  if (railMode) {
    return <div className="mt-1 space-y-1 border-t border-[color:var(--hub-chrome-border-soft)] pt-2">{children}</div>;
  }
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-widest text-[color:var(--hub-chrome-text-muted)] transition hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-accent)]"
      >
        <span>{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="space-y-0.5 pl-1">{children}</div>}
    </div>
  );
}

function SidebarLink({
  icon: Icon,
  label,
  onClick,
  nested,
  railMode,
  active = false,
  accentHex,
  hubSurfaceMode = 'dark'
}) {
  const iconSz = railMode ? 20 : nested ? 16 : 18;
  const hubLight = hubSurfaceMode === 'light';
  const onAccent = readableOnAccent(accentHex);
  /** Tema chiaro: selezione con tinta leggera e bordo accento (niente “pill” piena come in scuro). */
  const activeSurfaceStyle = active
    ? hubLight
      ? {
          backgroundColor: `color-mix(in srgb, ${accentHex} 16%, var(--hub-chrome-sidebar))`,
          color: 'var(--hub-chrome-text)',
          boxShadow: `inset 0 0 0 1px ${hexToRgba(accentHex, 0.42)}`
        }
      : { backgroundColor: accentHex, color: onAccent }
    : undefined;
  const activeIconColor = active ? (hubLight ? { color: accentHex } : { color: onAccent }) : undefined;
  const activeLabelColor = active ? (hubLight ? { color: 'var(--hub-chrome-text)' } : { color: onAccent }) : undefined;

  if (railMode) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={label}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={`group mx-auto flex w-full max-w-[3rem] items-center justify-center rounded-xl border border-transparent py-2.5 transition ${
          active
            ? hubLight
              ? 'shadow-sm hover:brightness-[1.02]'
              : 'shadow-sm hover:brightness-105'
            : 'text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-accent)] hover:[border-color:var(--hub-accent-border)]'
        }`}
        style={active ? activeSurfaceStyle : undefined}
      >
        <Icon
          size={iconSz}
          className={
            active
              ? 'shrink-0'
              : 'shrink-0 text-[color:var(--hub-chrome-text-muted)] transition group-hover:text-[color:var(--hub-accent)]'
          }
          style={activeIconColor}
        />
      </button>
    );
  }
  const labelColorClass = active
    ? ''
    : nested
      ? 'text-[color:var(--hub-chrome-text-muted)]'
      : 'text-[color:var(--hub-chrome-text-secondary)]';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
        active
          ? hubLight
            ? 'border-[color:color-mix(in_srgb,var(--hub-accent)_35%,var(--hub-chrome-border))] font-semibold shadow-sm hover:brightness-[1.01]'
            : 'border-transparent font-semibold shadow-sm hover:brightness-105'
          : 'border-transparent hover:bg-[color:var(--hub-chrome-hover)] hover:[border-color:var(--hub-accent-border)]'
      } ${nested ? 'pl-6 text-[13px]' : ''}`}
      style={active ? activeSurfaceStyle : undefined}
    >
      <Icon
        size={iconSz}
        className={
          active
            ? 'shrink-0'
            : 'shrink-0 text-[color:var(--hub-chrome-text-muted)] transition group-hover:text-[color:var(--hub-accent)]'
        }
        style={activeIconColor}
      />
      <span
        className={`min-w-0 flex-1 truncate ${active ? '' : `${labelColorClass} group-hover:text-[color:var(--hub-accent)]`}`}
        style={activeLabelColor}
      >
        {label}
      </span>
    </button>
  );
}

function RightPanel({
  title,
  children,
  className = '',
  bodyClassName = 'space-y-3',
  titleAccessory = null,
  onMouseEnter,
  onMouseLeave,
  scrollBody = true,
  /** Se false non mostra la riga titolo (es. calendario con titolo interno nel componente). */
  showTitle = true,
  /** `flush`: senza cornice/card per massimizzare larghezza nel contenuto. */
  variant = 'card'
}) {
  const isFlush = variant === 'flush';
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
        isFlush
          ? 'rounded-none border-0 bg-transparent p-0'
          : 'rounded-2xl border border-[color:var(--hub-chrome-border-soft)] p-4'
      } ${className}`}
      style={isFlush ? undefined : { backgroundColor: 'var(--hub-chrome-surface)' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {showTitle && (title ?? titleAccessory) ? (
        <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
          {title ? (
            <h3 className="min-w-0 flex-1 text-xs font-bold uppercase tracking-widest text-[color:var(--hub-chrome-text-fainter)]">{title}</h3>
          ) : (
            <span className="min-w-0 flex-1" aria-hidden />
          )}
          {titleAccessory ? <div className="flex shrink-0 items-center">{titleAccessory}</div> : null}
        </div>
      ) : null}
      <div
        className={`min-h-0 flex-1 ${scrollBody ? 'overflow-y-auto pr-1' : 'overflow-hidden'} ${bodyClassName}`}
      >
        {children}
      </div>
    </div>
  );
}

/** Righe lista avvisi (sola lettura). */
function ImportantAlertsSidebarRows({ items }) {
  return (
    <div role="list" className="space-y-3">
      {items.map((a) => {
        const meta = hubAlertLevelChrome(a.level);
        const Icon = meta.Icon;
        const title = (a.title && String(a.title).trim()) || '(Senza titolo)';
        const body = (a.body && String(a.body)) || '';
        const key =
          a.id != null ? `alert-${a.id}` : `${title}-${body.slice(0, 48)}`;
        return (
          <div
            key={key}
            role="listitem"
            className="flex gap-2.5 border-b border-[color:var(--hub-chrome-border-soft)] pb-3 last:border-b-0 last:pb-0"
          >
            <div className={`mt-0.5 shrink-0 ${meta.iconClassName}`} aria-hidden>
              <Icon size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 select-text">
              <p className={`text-[13px] font-semibold leading-snug ${meta.titleClassName}`}>{title}</p>
              {body ? (
                <p
                  title={body.length > 160 ? body : undefined}
                  className={`mt-1 line-clamp-3 break-words text-[11px] leading-relaxed ${meta.bodyClassName}`}
                >
                  {body}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Max {HUB_ALERTS_PAGE_SIZE} avvisi per pagina; pallini + rotazione automatica ogni 5 s. */
function ImportantAlertsCarousel({ alerts, loading, accentHex, rotationPaused = false }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [carouselTick, setCarouselTick] = useState(0);

  const alertsKey = useMemo(
    () => (alerts || []).map((a) => `${a.id ?? ''}:${(a.title || '').slice(0, 40)}`).join('|'),
    [alerts]
  );

  const pageCount =
    loading || !alerts?.length ? 0 : Math.max(1, Math.ceil(alerts.length / HUB_ALERTS_PAGE_SIZE));

  const currentItems = useMemo(() => {
    if (!alerts?.length) return [];
    const start = pageIndex * HUB_ALERTS_PAGE_SIZE;
    return alerts.slice(start, start + HUB_ALERTS_PAGE_SIZE);
  }, [alerts, pageIndex]);

  useEffect(() => {
    setPageIndex(0);
    setCarouselTick((t) => t + 1);
  }, [alertsKey]);

  useEffect(() => {
    setPageIndex((i) => {
      const max = Math.max(0, pageCount - 1);
      return Math.min(Math.max(0, i), max);
    });
  }, [pageCount]);

  const restartAutoTimer = () => setCarouselTick((t) => t + 1);

  useEffect(() => {
    if (loading || pageCount <= 1 || rotationPaused) return undefined;
    const id = window.setInterval(() => {
      setPageIndex((i) => (i + 1) % pageCount);
    }, 5000);
    return () => window.clearInterval(id);
  }, [loading, pageCount, carouselTick, rotationPaused]);

  if (loading) {
    return <div className="py-8 text-center text-xs text-[color:var(--hub-chrome-text-faint)]">Caricamento avvisi…</div>;
  }
  if (!alerts?.length) {
    return <div className="py-8 text-center text-xs text-[color:var(--hub-chrome-text-faint)]">Nessun avviso presente.</div>;
  }

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <ImportantAlertsSidebarRows items={currentItems} />
      </div>
      {pageCount > 1 && (
        <div className="mt-3 shrink-0 border-t border-[color:var(--hub-chrome-border-soft)] pt-3">
          <div className="flex items-center gap-2">
            <div className="flex w-9 shrink-0 justify-center">
              {canPrev ? (
                <button
                  type="button"
                  className={hubTinyIconBtn}
                  title="Pagina precedente"
                  aria-label="Pagina precedente"
                  onClick={() => {
                    setPageIndex((i) => Math.max(0, i - 1));
                    restartAutoTimer();
                  }}
                >
                  <ChevronLeft size={18} aria-hidden />
                </button>
              ) : (
                <span className="inline-flex w-[34px]" aria-hidden />
              )}
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5 px-1">
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={String(i)}
                  type="button"
                  title={`Pagina ${i + 1} di ${pageCount}`}
                  aria-label={`Vai alla pagina ${i + 1} di ${pageCount}`}
                  aria-current={i === pageIndex ? 'true' : undefined}
                  onClick={() => {
                    setPageIndex(i);
                    restartAutoTimer();
                  }}
                  className={`h-2 shrink-0 rounded-full transition-all duration-300 ${
                    i === pageIndex ? 'min-w-[1.35rem]' : 'w-2 opacity-45 hover:opacity-70'
                  }`}
                  style={{
                    backgroundColor: i === pageIndex ? accentHex : 'var(--hub-chrome-pagination-dot-off)'
                  }}
                />
              ))}
            </div>
            <div className="flex w-9 shrink-0 justify-center">
              {canNext ? (
                <button
                  type="button"
                  className={hubTinyIconBtn}
                  title="Pagina successiva"
                  aria-label="Pagina successiva"
                  onClick={() => {
                    setPageIndex((i) => Math.min(pageCount - 1, i + 1));
                    restartAutoTimer();
                  }}
                >
                  <ChevronRight size={18} aria-hidden />
                </button>
              ) : (
                <span className="inline-flex w-[34px]" aria-hidden />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DummyRow({ dot, title, meta, accent }) {
  return (
    <div className="flex gap-3 rounded-xl border border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-row-fill)] p-3 transition hover:[border-color:var(--hub-accent-border)]">
      <div
        className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: dot || accent }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[color:var(--hub-chrome-text-secondary)]">{title}</p>
        <p className="mt-0.5 text-xs text-[color:var(--hub-chrome-text-faint)]">{meta}</p>
      </div>
    </div>
  );
}

export default function TechnicianWorkbenchPage({
  currentUser,
  onNavigateHome,
  onLogout,
  onOpenSettings,
  nav,
  getAuthHeader,
  alertsRefreshTrigger = 0,
  tickets = [],
  onOpenTicketState,
  onOpenNewTicket,
  onOpenCreateContract = null,
  notify = () => {},
  selectedCompanyId = null,
  /** Allineamento alla selezione aziendale globale (es. modulo Email nell’Hub). */
  onGloballyCompanyChange = null,
  /** Precompila Nuovo ticket (come EmailPage full-screen in App). */
  onOpenTicketWithPrefill = null,
  /** Handler condivisi con CommAgentDashboard (nav verso altri moduli → chiude l’Hub). */
  commAgentNav = {},
  /** Apre il modal nuovo ticket precompilato da un avviso (stesso handler della dashboard). */
  onCreateTicketFromAlert = null,
  /** Incrementa `alertsRefreshTrigger` in App per ricaricare gli avvisi Hub. */
  onRefreshHubAlerts = null,
  /** tecnico → apre il modale Nuovo avviso (stesso della dashboard). */
  onOpenManageAlerts = null,
  /** Incrementato da App quando `handleOpenEmail` deve aprire Email nel centro Hub (Hub già visibile). */
  hubEmbedEmailKick = 0,
  /** Come `hubEmbedEmailKick` per `handleOpenOffice`. */
  hubEmbedOfficeKick = 0,
  /** Anti-Virus integrato nell’Hub (kick da App / hash). */
  hubEmbedAntiVirusKick = 0,
  hubEmbedDispositiviKick = 0,
  hubEmbedSpeedtestKick = 0,
  hubEmbedTicketsKick = 0,
  /** Lista ticket nella colonna centrale (stesso state/handlers di App). */
  ticketHubListProps = null,
  /** Chrome ticket hub: messaggi non letti, agent, monitoraggio. */
  ticketHubExtras = null,
  dispositiviHighlightMac = null,
  socket = null
}) {
  const [accentHex, setAccentHex] = useState(getStoredTechHubAccent);
  /** `dark` = sfondo Hub attuale; `light` = bianco / grigio chiaro sulla sola shell Hub tecnico. */
  const [hubSurfaceMode, setHubSurfaceMode] = useState(getStoredTechHubSurfaceMode);
  const [hubImportantAlerts, setHubImportantAlerts] = useState([]);
  const [hubImportantAlertsLoading, setHubImportantAlertsLoading] = useState(true);
  /** Contratti per il calendario nella sidebar vista Ticket (stessa fonte della dashboard). */
  const [hubCalendarContracts, setHubCalendarContracts] = useState([]);
  const [avvisiPanelHovered, setAvvisiPanelHovered] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accentPickerOpen, setAccentPickerOpen] = useState(false);
  const [navToolsOpen, setNavToolsOpen] = useState(true);
  const [navProjectsOpen, setNavProjectsOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  /** Centro Hub: panoramica a griglia oppure modulo integrato (Comunicazioni, Email, Anti-Virus…). */
  const [hubCenterView, setHubCenterView] = useState(
    /** @type {'overview' | 'comunicazioni' | 'comm-agent-manager' | 'email' | 'office' | 'antivirus' | 'dispositivi' | 'network-monitoring' | 'speedtest' | 'contratti' | 'avvisi' | 'tickets'} */ ('overview')
  );
  const isTechnician = currentUser?.ruolo === 'tecnico';
  const canSpeedTest = currentUser?.ruolo === 'tecnico' || currentUser?.ruolo === 'admin';
  const canNetworkMonitoring = useMemo(
    () =>
      Boolean(
        currentUser &&
          (currentUser.ruolo === 'tecnico' ||
            currentUser.ruolo === 'admin' ||
            (currentUser.ruolo === 'cliente' &&
              Array.isArray(currentUser.admin_companies) &&
              currentUser.admin_companies.length > 0))
      ),
    [currentUser]
  );

  const commAgentNavMerged = useMemo(
    () => ({
      ...commAgentNav,
      onNavigateNetworkMonitoring: canNetworkMonitoring
        ? () => setHubCenterView('network-monitoring')
        : commAgentNav.onNavigateNetworkMonitoring
    }),
    [commAgentNav, canNetworkMonitoring]
  );

  const openMonitoringFromHub = useCallback(() => {
    if (canNetworkMonitoring) setHubCenterView('network-monitoring');
    else nav?.onOpenNetwork?.();
  }, [canNetworkMonitoring, nav]);
  const hubLayoutUserKey = currentUser?.id ?? currentUser?.email ?? '';

  /** Carica subito dal localStorage: se lo facessimo solo in useEffect, il figlio salverebbe il default e cancellerebbe il salvataggio. */
  const [hubLayout, setHubLayout] = useState(() => {
    const key = currentUser?.id ?? currentUser?.email ?? '';
    const saved = loadHubLayout(key);
    return sanitizeLayoutItems(saved !== null ? saved : getDefaultHubLayout());
  });
  const [hubLayoutEditMode, setHubLayoutEditMode] = useState(false);
  const skipHubLayoutUserReloadRef = useRef(true);

  useEffect(() => {
    if (skipHubLayoutUserReloadRef.current) {
      skipHubLayoutUserReloadRef.current = false;
      return;
    }
    const key = currentUser?.id ?? currentUser?.email ?? '';
    const saved = loadHubLayout(key);
    setHubLayout(sanitizeLayoutItems(saved !== null ? saved : getDefaultHubLayout()));
  }, [currentUser?.id, currentUser?.email]);

  useEffect(() => {
    if (hubCenterView !== 'overview') setHubLayoutEditMode(false);
  }, [hubCenterView]);

  useEffect(() => {
    if (hubEmbedEmailKick > 0) setHubCenterView('email');
  }, [hubEmbedEmailKick]);

  useEffect(() => {
    if (hubEmbedOfficeKick > 0) setHubCenterView('office');
  }, [hubEmbedOfficeKick]);

  useEffect(() => {
    if (hubEmbedAntiVirusKick > 0) setHubCenterView('antivirus');
  }, [hubEmbedAntiVirusKick]);

  useEffect(() => {
    if (hubEmbedDispositiviKick > 0) setHubCenterView('dispositivi');
  }, [hubEmbedDispositiviKick]);

  useEffect(() => {
    if (hubEmbedSpeedtestKick > 0 && canSpeedTest) setHubCenterView('speedtest');
  }, [hubEmbedSpeedtestKick, canSpeedTest]);

  useEffect(() => {
    if (hubEmbedTicketsKick > 0) setHubCenterView('tickets');
  }, [hubEmbedTicketsKick]);

  useEffect(() => {
    if (hubCenterView !== 'tickets' || !getAuthHeader || !currentUser) return undefined;

    let cancelled = false;
    const load = async () => {
      if (currentUser.ruolo === 'tecnico') {
        try {
          const res = await fetch(buildApiUrl('/api/contracts'), { headers: getAuthHeader() });
          if (cancelled || !res.ok) return;
          const data = await res.json();
          if (!cancelled) setHubCalendarContracts(Array.isArray(data) ? data : []);
        } catch (_) {
          if (!cancelled) setHubCalendarContracts([]);
        }
        return;
      }
      if (currentUser.ruolo === 'cliente') {
        const isAdmin =
          Array.isArray(currentUser.admin_companies) && currentUser.admin_companies.length > 0;
        if (!isAdmin) {
          setHubCalendarContracts([]);
          return;
        }
        try {
          const res = await fetch(buildApiUrl('/api/contracts'), { headers: getAuthHeader() });
          if (cancelled || !res.ok) return;
          const allContracts = await res.json();
          if (cancelled) return;
          const list = Array.isArray(allContracts) ? allContracts : [];
          const companyNames = currentUser.admin_companies;
          setHubCalendarContracts(
            list.filter((c) => c.azienda && companyNames.includes(c.azienda))
          );
        } catch (_) {
          if (!cancelled) setHubCalendarContracts([]);
        }
        return;
      }
      setHubCalendarContracts([]);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [hubCenterView, currentUser, getAuthHeader]);

  const userMenuRef = useRef(null);
  const accentPickerRef = useRef(null);
  const minMd = useMinMd();
  const railMode = sidebarCollapsed && minMd;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TECH_HUB_ACCENT, accentHex);
    } catch (_) {
      /* ignore */
    }
  }, [accentHex]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TECH_HUB_SURFACE, hubSurfaceMode);
    } catch (_) {
      /* ignore */
    }
    window.dispatchEvent(new Event('tech-hub-surface'));
  }, [hubSurfaceMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SIDEBAR_COLLAPSED, sidebarCollapsed ? '1' : '0');
    } catch (_) {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const onDoc = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
      if (accentPickerRef.current && !accentPickerRef.current.contains(e.target)) setAccentPickerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!getAuthHeader || !currentUser) {
        setHubImportantAlerts([]);
        setHubImportantAlertsLoading(false);
        return;
      }
      setHubImportantAlertsLoading(true);
      try {
        const list = await fetchImportantAlertsForHub(getAuthHeader, currentUser);
        if (!cancelled) setHubImportantAlerts(list);
      } catch (_) {
        if (!cancelled) setHubImportantAlerts([]);
      } finally {
        if (!cancelled) setHubImportantAlertsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [getAuthHeader, currentUser, alertsRefreshTrigger]);

  const displayName = useMemo(() => {
    const n = `${currentUser?.nome || ''} ${currentUser?.cognome || ''}`.trim();
    return n || currentUser?.email || 'Utente';
  }, [currentUser]);

  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0] || '?').slice(0, 2).toUpperCase();
  }, [displayName]);

  const accentStyle = useMemo(
    () => ({
      ...hubChromeCssVariables(hubSurfaceMode),
      backgroundColor: 'var(--hub-chrome-page)',
      color: 'var(--hub-chrome-text)',
      colorScheme: hubSurfaceMode === 'light' ? 'light' : 'dark',
      ['--hub-accent']: accentHex,
      ['--hub-accent-border']: hexToRgba(accentHex, 0.52),
      ['--hub-accent-glow']: hexToRgba(accentHex, 0.32)
    }),
    [accentHex, hubSurfaceMode]
  );

  const hubHoverIconBtn =
    'rounded-xl border border-transparent text-[color:var(--hub-chrome-text-muted)] transition hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-accent)] hover:[border-color:var(--hub-accent-border)]';

  const hubTicketCounts = useMemo(() => {
    const list = Array.isArray(tickets) ? tickets : [];
    return {
      aperto: list.filter((t) => t.stato === 'aperto').length,
      in_lavorazione: list.filter((t) => t.stato === 'in_lavorazione').length
    };
  }, [tickets]);

  return (
    <div className="fixed inset-0 z-[70] flex min-h-0 flex-col md:flex-row" style={accentStyle}>
      {/* Colonna sinistra */}
      <aside
        className={`flex w-full shrink-0 flex-col border-[color:var(--hub-chrome-border-soft)] py-5 text-[color:var(--hub-chrome-text-secondary)] transition-[width,padding] duration-200 ease-out max-md:w-full max-md:px-5 md:h-full md:border-r ${
          railMode
            ? 'md:w-[76px] md:items-center md:px-2 md:overflow-visible'
            : 'md:w-[280px] md:px-5 lg:w-[292px]'
        }`}
        style={{ backgroundColor: 'var(--hub-chrome-sidebar)', color: 'var(--hub-chrome-text-secondary)' }}
      >
        <div ref={userMenuRef} className={`relative ${railMode ? 'flex w-full justify-center md:overflow-visible' : ''}`}>
          <button
            type="button"
            onClick={() => setUserMenuOpen((o) => !o)}
            title={railMode ? displayName : undefined}
            aria-expanded={userMenuOpen}
            className={`flex rounded-2xl border border-transparent transition hover:bg-white/[0.05] hover:[border-color:var(--hub-accent-border)] ${
              railMode ? 'p-1' : 'w-full items-center gap-3 p-2 text-left'
            }`}
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              style={{ backgroundColor: accentHex, color: readableOnAccent(accentHex) }}
            >
              {initials}
            </span>
            {!railMode && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[color:var(--hub-chrome-text)]">{displayName}</div>
                  <div className="truncate text-xs text-[color:var(--hub-chrome-text-faint)]">{currentUser?.email || ''}</div>
                </div>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-[color:var(--hub-chrome-text-faint)] transition ${userMenuOpen ? 'rotate-180' : ''}`}
                />
              </>
            )}
          </button>
          {userMenuOpen && (
            <div
              className={`absolute z-30 space-y-0.5 rounded-2xl border border-[color:var(--hub-chrome-border)] p-2 shadow-2xl ${
                railMode
                  ? 'left-full top-0 ml-2 w-[min(16rem,calc(100vw-5rem))]'
                  : 'left-0 right-0 top-full mt-2'
              }`}
              style={{ backgroundColor: 'var(--hub-chrome-surface)' }}
            >
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenSettings?.();
                }}
                className="group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-[color:var(--hub-chrome-text-secondary)] transition hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-accent)]"
              >
                <Settings
                  size={18}
                  className="text-[color:var(--hub-chrome-text-muted)] transition group-hover:text-[color:var(--hub-accent)]"
                />
                Impostazioni account
              </button>
              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-[color:var(--hub-chrome-text-fainter)]"
                title="In preparazione"
              >
                <Palette size={18} className="text-[color:var(--hub-chrome-text-fainter)]" />
                Personalizzazione Hub
                <span className="ml-auto text-[10px] uppercase tracking-wide text-[color:var(--hub-chrome-text-fainter)]">Beta</span>
              </button>
              <div className="my-1 border-t border-[color:var(--hub-chrome-border-soft)]" />
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  onLogout?.();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-red-300/90 hover:bg-red-500/10"
              >
                <LogOut size={18} />
                Esci
              </button>
            </div>
          )}
        </div>

        <div className={`mt-4 ${railMode ? 'flex w-full justify-center' : ''}`}>
          {railMode ? (
            <button
              type="button"
              title="Cerca… (in preparazione)"
              aria-label="Cerca (in preparazione)"
              className={`${hubHoverIconBtn} rounded-2xl p-2.5`}
              style={{ backgroundColor: 'var(--hub-chrome-surface)' }}
            >
              <Search size={20} className="text-[color:var(--hub-chrome-text-faint)]" aria-hidden />
            </button>
          ) : (
            <div
              className="group flex items-center gap-3 rounded-2xl border border-[color:var(--hub-chrome-border-soft)] px-3 py-2.5 transition hover:[border-color:var(--hub-accent-border)]"
              style={{ backgroundColor: 'var(--hub-chrome-input-bg)' }}
            >
              <Search
                size={18}
                className="shrink-0 text-[color:var(--hub-chrome-text-faint)] transition group-hover:text-[color:var(--hub-accent)]"
                aria-hidden
              />
              <input
                type="search"
                readOnly
                tabIndex={-1}
                placeholder="Cerca…"
                className="min-w-0 flex-1 cursor-default bg-transparent text-sm text-[color:var(--hub-chrome-text-secondary)] outline-none placeholder:text-[color:var(--hub-chrome-placeholder)]"
                aria-label="Campo ricerca (in preparazione)"
              />
            </div>
          )}
        </div>

        <nav
          className={`mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-visible pb-2 pr-1 md:overflow-x-visible ${
            railMode ? 'flex w-full flex-col items-center md:overflow-visible' : ''
          }`}
        >
          <SidebarLink
            railMode={railMode}
            hubSurfaceMode={hubSurfaceMode}
            icon={LayoutGrid}
            label="Hub tecnico"
            accentHex={accentHex}
            active={hubCenterView === 'overview'}
            onClick={() => setHubCenterView('overview')}
          />
          <SidebarLink
            railMode={railMode}
            hubSurfaceMode={hubSurfaceMode}
            icon={TicketHomeIcon}
            label="Ticket"
            accentHex={accentHex}
            active={hubCenterView === 'tickets'}
            onClick={() => setHubCenterView('tickets')}
          />
          <SidebarLink
            railMode={railMode}
            hubSurfaceMode={hubSurfaceMode}
            icon={Building2}
            label="Office"
            accentHex={accentHex}
            active={hubCenterView === 'office'}
            onClick={() => setHubCenterView('office')}
          />
          <SidebarLink
            railMode={railMode}
            hubSurfaceMode={hubSurfaceMode}
            icon={Mail}
            label="Email"
            accentHex={accentHex}
            active={hubCenterView === 'email'}
            onClick={() => setHubCenterView('email')}
          />
          <SidebarLink
            railMode={railMode}
            hubSurfaceMode={hubSurfaceMode}
            icon={Shield}
            label="Anti-Virus"
            accentHex={accentHex}
            active={hubCenterView === 'antivirus'}
            onClick={() => setHubCenterView('antivirus')}
          />
          <SidebarLink
            railMode={railMode}
            hubSurfaceMode={hubSurfaceMode}
            icon={Eye}
            label="L-Sight"
            accentHex={accentHex}
            onClick={() => nav?.onOpenLSight?.()}
          />
          <SidebarLink
            railMode={railMode}
            hubSurfaceMode={hubSurfaceMode}
            icon={Monitor}
            label="Dispositivi aziendali"
            accentHex={accentHex}
            active={hubCenterView === 'dispositivi'}
            onClick={() => setHubCenterView('dispositivi')}
          />
          {canSpeedTest && (
            <SidebarLink
              railMode={railMode}
              hubSurfaceMode={hubSurfaceMode}
              icon={Gauge}
              label="Speed Test"
              accentHex={accentHex}
              active={hubCenterView === 'speedtest'}
              onClick={() => setHubCenterView('speedtest')}
            />
          )}
          {canNetworkMonitoring && (
            <SidebarLink
              railMode={railMode}
              hubSurfaceMode={hubSurfaceMode}
              icon={Wifi}
              label="Monitoraggio rete"
              accentHex={accentHex}
              active={hubCenterView === 'network-monitoring'}
              onClick={() => setHubCenterView('network-monitoring')}
            />
          )}
          <SidebarLink
            railMode={railMode}
            hubSurfaceMode={hubSurfaceMode}
            icon={MapPin}
            label="Mappatura"
            accentHex={accentHex}
            onClick={() => nav?.onOpenMappatura?.()}
          />

          <div className={railMode ? 'w-full pt-2' : 'pt-2'}>
            <NavGroup railMode={railMode} title="Comunicazioni" open={navToolsOpen} onToggle={() => setNavToolsOpen((o) => !o)}>
              <SidebarLink
                railMode={railMode}
                hubSurfaceMode={hubSurfaceMode}
                nested
                icon={Monitor}
                label="Agent comunicazioni"
                accentHex={accentHex}
                active={hubCenterView === 'comm-agent-manager'}
                onClick={() => setHubCenterView('comm-agent-manager')}
              />
              <SidebarLink
                railMode={railMode}
                hubSurfaceMode={hubSurfaceMode}
                nested
                icon={Bell}
                label="Invia comunicazione"
                accentHex={accentHex}
                active={hubCenterView === 'comunicazioni'}
                onClick={() => setHubCenterView('comunicazioni')}
              />
            </NavGroup>
          </div>

          <div className={railMode ? 'w-full pt-2' : 'pt-2'}>
            <NavGroup railMode={railMode} title="Altri progetti" open={navProjectsOpen} onToggle={() => setNavProjectsOpen((o) => !o)}>
              <SidebarLink
                railMode={railMode}
                hubSurfaceMode={hubSurfaceMode}
                nested
                icon={Calendar}
                label="Orari e Turni"
                accentHex={accentHex}
                onClick={() => nav?.onOpenOrari?.()}
              />
              <SidebarLink
                railMode={railMode}
                hubSurfaceMode={hubSurfaceMode}
                nested
                icon={Volume2}
                label="Vivaldi"
                accentHex={accentHex}
                onClick={() => nav?.onOpenVivaldi?.()}
              />
              <SidebarLink
                railMode={railMode}
                hubSurfaceMode={hubSurfaceMode}
                nested
                icon={Monitor}
                label="PackVision"
                accentHex={accentHex}
                onClick={() => nav?.onOpenPackVision?.()}
              />
              <SidebarLink
                railMode={railMode}
                hubSurfaceMode={hubSurfaceMode}
                nested
                icon={Layers}
                label="VPN"
                accentHex={accentHex}
                onClick={() => nav?.onOpenVpn?.()}
              />
            </NavGroup>
          </div>
        </nav>

        <div
          className={`mt-auto flex w-full flex-col border-t border-[color:var(--hub-chrome-border-soft)] pt-3 ${railMode ? 'items-center gap-3' : 'items-start gap-3'}`}
        >
          {minMd && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              title={railMode ? 'Espandi barra laterale' : 'Comprimi barra (solo icone)'}
              aria-expanded={!railMode}
              className={`${hubHoverIconBtn} flex w-full items-center justify-center rounded-xl py-2 text-xs font-medium text-[color:var(--hub-chrome-text-muted)] ${railMode ? 'px-2' : 'px-3'}`}
            >
              {railMode ? <ChevronsRight size={22} aria-hidden /> : <ChevronsLeft size={22} aria-hidden />}
              {!railMode && <span className="ml-2 shrink-0">Solo icone</span>}
            </button>
          )}
          <div className={railMode ? 'flex w-full justify-center' : 'w-full self-start'}>
            <HubLogikubeMark railMode={railMode} />
          </div>
        </div>
      </aside>

      {/* Centro + destra */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header
            className="flex shrink-0 items-center justify-between gap-4 border-b border-[color:var(--hub-chrome-border-soft)] px-5 py-4"
            style={{ backgroundColor: 'var(--hub-chrome-page)' }}
          >
            <div className="flex min-w-0 items-center gap-3 text-sm text-[color:var(--hub-chrome-text-faint)]">
              <button
                type="button"
                className={`rounded-lg p-2 ${hubHoverIconBtn}`}
                aria-label="Navigazione"
              >
                <Layers size={20} />
              </button>
              <span className="hidden sm:inline text-[color:var(--hub-chrome-text-fainter)]">/</span>
              <div className="min-w-0 truncate">
                <span className="text-[color:var(--hub-chrome-text-faint)]">Hub tecnico</span>
                <span className="text-[color:var(--hub-chrome-text-fainter)]"> / </span>
                <span className="font-medium text-[color:var(--hub-chrome-text)]">
                  {hubCenterView === 'comunicazioni'
                    ? 'Comunicazioni'
                    : hubCenterView === 'comm-agent-manager'
                      ? 'Agent comunicazioni'
                      : hubCenterView === 'email'
                        ? 'Email'
                        : hubCenterView === 'office'
                          ? 'Office'
                          : hubCenterView === 'antivirus'
                            ? 'Anti-Virus'
                            : hubCenterView === 'dispositivi'
                              ? 'Dispositivi aziendali'
                              : hubCenterView === 'speedtest'
                              ? 'Speed Test'
                              : hubCenterView === 'contratti'
                                ? 'Contratti attivi'
                                  : hubCenterView === 'avvisi'
                                    ? 'Avvisi importanti'
                                    : hubCenterView === 'tickets'
                                      ? 'Ticket'
                                      : 'Panoramica'}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <div ref={accentPickerRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccentPickerOpen((o) => !o)}
                  className={`p-2.5 ${hubHoverIconBtn}`}
                  title="Tema Hub (accento e sfondo)"
                  aria-expanded={accentPickerOpen}
                  aria-haspopup="dialog"
                >
                  <Moon size={20} />
                </button>
                {accentPickerOpen && (
                  <div
                    className="absolute right-0 top-full z-[80] mt-2 w-[19rem] rounded-2xl border border-[color:var(--hub-chrome-border)] p-3 shadow-2xl"
                    style={{ backgroundColor: 'var(--hub-chrome-surface)' }}
                    role="dialog"
                    aria-label="Scegli colore accento"
                  >
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--hub-chrome-text-faint)]">
                      <Palette size={14} style={{ color: accentHex }} />
                      Colore tema Hub
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {TECH_HUB_ACCENT_PALETTE.map((c) => {
                        const active = accentHex.toLowerCase() === c.hex.toLowerCase();
                        return (
                          <button
                            key={c.id}
                            type="button"
                            title={c.label}
                            onClick={() => {
                              setAccentHex(c.hex);
                              setAccentPickerOpen(false);
                            }}
                            className={`relative aspect-square rounded-xl transition hover:outline hover:outline-2 hover:outline-offset-2 hover:outline-[color:var(--hub-chrome-border)] ${
                              active
                                ? 'ring-2 ring-[color:var(--hub-chrome-text)] ring-offset-2 ring-offset-[color:var(--hub-chrome-ring-offset)]'
                                : 'border border-[color:var(--hub-chrome-border-soft)]'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          />
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[11px] leading-snug text-[color:var(--hub-chrome-text-fainter)]">
                      Accento salvato nel browser per icone evidenziature e parti colorate dell’Hub.
                    </p>
                    <div className="mt-4 border-t border-[color:var(--hub-chrome-border-soft)] pt-3">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--hub-chrome-text-faint)]">
                        Sfondo interfaccia
                      </div>
                      <div className="flex gap-1 rounded-xl bg-[color:var(--hub-chrome-muted-fill)] p-1">
                        <button
                          type="button"
                          role="radio"
                          aria-checked={hubSurfaceMode === 'dark'}
                          onClick={() => setHubSurfaceMode('dark')}
                          className={`flex-1 rounded-lg px-2 py-2 text-center text-[11px] font-semibold transition ${
                            hubSurfaceMode === 'dark'
                              ? 'bg-[color:var(--hub-chrome-input-bg)] text-[color:var(--hub-chrome-text)] shadow-sm ring-1 ring-[color:var(--hub-chrome-border)]'
                              : 'text-[color:var(--hub-chrome-text-muted)] hover:text-[color:var(--hub-chrome-text)]'
                          }`}
                        >
                          Attuale
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={hubSurfaceMode === 'light'}
                          onClick={() => setHubSurfaceMode('light')}
                          className={`flex-1 rounded-lg px-2 py-2 text-center text-[11px] font-semibold transition ${
                            hubSurfaceMode === 'light'
                              ? 'bg-[color:var(--hub-chrome-input-bg)] text-[color:var(--hub-chrome-text)] shadow-sm ring-1 ring-[color:var(--hub-chrome-border)]'
                              : 'text-[color:var(--hub-chrome-text-muted)] hover:text-[color:var(--hub-chrome-text)]'
                          }`}
                        >
                          Chiaro
                        </button>
                      </div>
                      <p className="mt-2 text-[10px] leading-snug text-[color:var(--hub-chrome-text-fainter)]">
                        Chiaro applica sfondo chiaro anche ai moduli centrali (Email, Office, Rete…) con testo adeguato.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {isTechnician && hubCenterView === 'overview' && (
                <button
                  type="button"
                  onClick={() => setHubLayoutEditMode((v) => !v)}
                  className={`p-2.5 ${hubHoverIconBtn} ${
                    hubLayoutEditMode
                      ? hubSurfaceMode === 'light'
                        ? 'bg-[color:color-mix(in_srgb,var(--hub-accent)_14%,var(--hub-chrome-input-bg))] text-[color:var(--hub-accent)] [border-width:1px] [border-style:solid] [border-color:var(--hub-accent-border)] shadow-sm'
                        : 'bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-accent)] [border-width:1px] [border-style:solid] [border-color:var(--hub-accent-border)]'
                      : ''
                  }`}
                  title={hubLayoutEditMode ? 'Termina modifica layout' : 'Modifica layout panoramica'}
                  aria-pressed={hubLayoutEditMode}
                >
                  <LayoutTemplate size={20} aria-hidden />
                </button>
              )}
              <button type="button" className={`p-2.5 ${hubHoverIconBtn}`} title="Aggiorna (decorativo)">
                <RefreshCw size={20} />
              </button>
              <button type="button" className={`p-2.5 ${hubHoverIconBtn}`} title="Notifiche (decorativo)">
                <Bell size={20} />
              </button>
              <button type="button" className={`p-2.5 ${hubHoverIconBtn}`} title="Lingua (decorativo)">
                <Globe size={20} />
              </button>
            </div>
          </header>

          <div
            className={
              hubCenterView === 'comunicazioni' ||
              hubCenterView === 'comm-agent-manager' ||
              hubCenterView === 'email' ||
              hubCenterView === 'office' ||
              hubCenterView === 'antivirus' ||
              hubCenterView === 'dispositivi' ||
              hubCenterView === 'speedtest' ||
              hubCenterView === 'network-monitoring' ||
              hubCenterView === 'contratti' ||
              hubCenterView === 'avvisi'
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2 md:px-5 md:pb-5'
                : hubCenterView === 'tickets'
                  ? 'custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 pb-4 pt-2 md:px-5 md:pb-5'
                  : 'min-h-0 flex-1 overflow-y-auto p-4 md:p-5'
            }
          >
            {hubCenterView === 'avvisi' ? (
              <ImportantAlertsHubEmbedded
                accentHex={accentHex}
                alerts={hubImportantAlerts}
                loading={hubImportantAlertsLoading}
                currentUser={currentUser}
                onBack={() => setHubCenterView('overview')}
                onCreateTicketFromAlert={onCreateTicketFromAlert ?? undefined}
                onRefreshHubAlerts={onRefreshHubAlerts ?? undefined}
                onOpenManageAlerts={onOpenManageAlerts ?? undefined}
              />
            ) : hubCenterView === 'contratti' ? (
              <ContractsListModal
                embedded
                accentHex={accentHex}
                closeEmbedded={() => setHubCenterView('overview')}
                getAuthHeader={getAuthHeader}
                notify={notify}
                onOpenCreateContract={onOpenCreateContract ?? undefined}
              />
            ) : hubCenterView === 'tickets' && ticketHubListProps ? (
              <TicketsHubEmbedded
                accentHex={accentHex}
                hubSurfaceMode={hubSurfaceMode}
                currentUser={currentUser}
                tickets={tickets}
                users={ticketHubListProps.users}
                selectedTicket={ticketHubListProps.selectedTicket}
                setSelectedTicket={ticketHubListProps.setSelectedTicket}
                handlers={ticketHubListProps.handlers}
                getUnreadCount={ticketHubListProps.getUnreadCount}
                externalViewState={ticketHubListProps.externalViewState}
                onBackToOverview={() => setHubCenterView('overview')}
                onOpenNewTicket={onOpenNewTicket}
                onNavigateTicketTabState={ticketHubListProps.onNavigateTicketTabState}
                onOpenUnreadModal={ticketHubExtras?.onOpenUnreadMessages}
                hubUnreadMessagesTotal={ticketHubExtras?.unreadMessagesTotal ?? 0}
              />
            ) : hubCenterView === 'email' ? (
              <EmailPage
                embedded
                accentHex={accentHex}
                closeEmbedded={() => setHubCenterView('overview')}
                getAuthHeader={getAuthHeader}
                selectedCompanyId={selectedCompanyId}
                onCompanyChange={onGloballyCompanyChange ?? undefined}
                currentUser={currentUser}
                onOpenTicket={onOpenTicketWithPrefill ?? undefined}
                onNavigateOffice={() => setHubCenterView('office')}
                onNavigateAntiVirus={() => setHubCenterView('antivirus')}
                onNavigateDispositiviAziendali={() => setHubCenterView('dispositivi')}
                onNavigateNetworkMonitoring={openMonitoringFromHub}
                onNavigateMappatura={() => nav?.onOpenMappatura?.()}
                onNavigateSpeedTest={canSpeedTest ? () => setHubCenterView('speedtest') : undefined}
                onNavigateVpn={() => nav?.onOpenVpn?.()}
                onNavigateHome={() => setHubCenterView('overview')}
              />
            ) : hubCenterView === 'office' ? (
              <OfficePage
                embedded
                accentHex={accentHex}
                closeEmbedded={() => setHubCenterView('overview')}
                getAuthHeader={getAuthHeader}
                selectedCompanyId={selectedCompanyId}
                onCompanyChange={onGloballyCompanyChange ?? undefined}
                currentUser={currentUser}
                onOpenTicket={onOpenTicketWithPrefill ?? undefined}
                onNavigateEmail={() => setHubCenterView('email')}
                onNavigateAntiVirus={() => setHubCenterView('antivirus')}
                onNavigateDispositiviAziendali={() => setHubCenterView('dispositivi')}
                onNavigateNetworkMonitoring={openMonitoringFromHub}
                onNavigateMappatura={() => nav?.onOpenMappatura?.()}
                onNavigateSpeedTest={canSpeedTest ? () => setHubCenterView('speedtest') : undefined}
                onNavigateVpn={() => nav?.onOpenVpn?.()}
                onNavigateHome={() => setHubCenterView('overview')}
              />
            ) : hubCenterView === 'antivirus' ? (
              <AntiVirusPage
                embedded
                accentHex={accentHex}
                closeEmbedded={() => setHubCenterView('overview')}
                getAuthHeader={getAuthHeader}
                selectedCompanyId={selectedCompanyId}
                onCompanyChange={onGloballyCompanyChange ?? undefined}
                readOnly={
                  currentUser?.ruolo === 'cliente' &&
                  !!(currentUser?.admin_companies && currentUser.admin_companies.length > 0)
                }
                currentUser={currentUser}
                onOpenTicket={onOpenTicketWithPrefill ?? undefined}
                onNavigateOffice={() => setHubCenterView('office')}
                onNavigateEmail={() => setHubCenterView('email')}
                onNavigateDispositiviAziendali={() => setHubCenterView('dispositivi')}
                onNavigateNetworkMonitoring={openMonitoringFromHub}
                onNavigateMappatura={() => nav?.onOpenMappatura?.()}
                onNavigateSpeedTest={canSpeedTest ? () => setHubCenterView('speedtest') : undefined}
                onNavigateVpn={() => nav?.onOpenVpn?.()}
                onNavigateLSight={() => nav?.onOpenLSight?.()}
                onNavigateHome={() => setHubCenterView('overview')}
              />
            ) : hubCenterView === 'dispositivi' ? (
              <DispositiviAziendaliPage
                embedded
                accentHex={accentHex}
                closeEmbedded={() => setHubCenterView('overview')}
                getAuthHeader={getAuthHeader}
                selectedCompanyId={selectedCompanyId}
                onCompanyChange={onGloballyCompanyChange ?? undefined}
                readOnly={
                  currentUser?.ruolo === 'cliente' &&
                  !!(currentUser?.admin_companies && currentUser.admin_companies.length > 0)
                }
                currentUser={currentUser}
                highlightMac={dispositiviHighlightMac}
                onNavigateOffice={() => setHubCenterView('office')}
                onNavigateEmail={() => setHubCenterView('email')}
                onNavigateAntiVirus={() => setHubCenterView('antivirus')}
                onNavigateNetworkMonitoring={openMonitoringFromHub}
                onNavigateMappatura={() => nav?.onOpenMappatura?.()}
                onNavigateSpeedTest={canSpeedTest ? () => setHubCenterView('speedtest') : undefined}
                onNavigateVpn={() => nav?.onOpenVpn?.()}
                onNavigateLSight={() => nav?.onOpenLSight?.()}
                onNavigateHome={() => setHubCenterView('overview')}
                onNavigateCommAgent={() => setHubCenterView('comunicazioni')}
                onNavigateCommAgentManager={() => setHubCenterView('comm-agent-manager')}
              />
            ) : hubCenterView === 'speedtest' && canSpeedTest ? (
              <SpeedTestPage
                embedded
                accentHex={accentHex}
                closeEmbedded={() => setHubCenterView('overview')}
                currentUser={currentUser}
                getAuthHeader={getAuthHeader}
                selectedCompanyId={selectedCompanyId}
                onNavigateHome={() => setHubCenterView('overview')}
                onNavigateOffice={() => setHubCenterView('office')}
                onNavigateEmail={() => setHubCenterView('email')}
                onNavigateAntiVirus={() => setHubCenterView('antivirus')}
                onNavigateNetworkMonitoring={openMonitoringFromHub}
                onNavigateMappatura={() => nav?.onOpenMappatura?.()}
                onNavigateDispositiviAziendali={() => setHubCenterView('dispositivi')}
                onNavigateVpn={() => nav?.onOpenVpn?.()}
                onNavigateLSight={() => nav?.onOpenLSight?.()}
              />
            ) : hubCenterView === 'network-monitoring' && canNetworkMonitoring ? (
              <NetworkMonitoringDashboard
                embedded
                accentHex={accentHex}
                closeEmbedded={() => setHubCenterView('overview')}
                getAuthHeader={getAuthHeader}
                socket={socket}
                initialCompanyId={selectedCompanyId}
                onCompanyChange={onGloballyCompanyChange ?? undefined}
                readOnly={
                  currentUser?.ruolo === 'cliente' &&
                  !!(currentUser?.admin_companies && currentUser.admin_companies.length > 0)
                }
                currentUser={currentUser}
                onOpenTicket={onOpenTicketWithPrefill ?? undefined}
                onNavigateOffice={() => setHubCenterView('office')}
                onNavigateEmail={() => setHubCenterView('email')}
                onNavigateAntiVirus={() => setHubCenterView('antivirus')}
                onNavigateDispositiviAziendali={() => setHubCenterView('dispositivi')}
                onNavigateNetworkMonitoring={null}
                onNavigateMappatura={() => nav?.onOpenMappatura?.()}
                onNavigateSpeedTest={canSpeedTest ? () => setHubCenterView('speedtest') : undefined}
                onNavigateVpn={() => nav?.onOpenVpn?.()}
                onNavigateLSight={() => nav?.onOpenLSight?.()}
                onNavigateHome={() => setHubCenterView('overview')}
                onNavigateToMappatura={(companyId) => {
                  onGloballyCompanyChange?.(companyId ?? null);
                  nav?.onOpenMappatura?.();
                }}
              />
            ) : hubCenterView === 'comunicazioni' ? (
              <CommAgentDashboard
                embedded
                accentHex={accentHex}
                currentUser={currentUser}
                notify={notify}
                selectedCompanyId={selectedCompanyId}
                closeModal={() => setHubCenterView('overview')}
                onNavigateHome={commAgentNavMerged.onNavigateHome ?? onNavigateHome}
                onNavigateOffice={commAgentNavMerged.onNavigateOffice}
                onNavigateEmail={commAgentNavMerged.onNavigateEmail}
                onNavigateAntiVirus={() => setHubCenterView('antivirus')}
                onNavigateNetworkMonitoring={commAgentNavMerged.onNavigateNetworkMonitoring}
                onNavigateMappatura={commAgentNavMerged.onNavigateMappatura}
                onNavigateSpeedTest={
                  canSpeedTest ? () => setHubCenterView('speedtest') : commAgentNavMerged.onNavigateSpeedTest
                }
                onNavigateDispositiviAziendali={() => setHubCenterView('dispositivi')}
                onNavigateCommAgentManager={() => setHubCenterView('comm-agent-manager')}
                onNavigateVpn={commAgentNavMerged.onNavigateVpn}
              />
            ) : hubCenterView === 'comm-agent-manager' ? (
              <CommAgentManager
                embedded
                accentHex={accentHex}
                currentUser={currentUser}
                notify={notify}
                selectedCompanyId={selectedCompanyId}
                closeModal={() => setHubCenterView('overview')}
                onNavigateHome={commAgentNavMerged.onNavigateHome ?? onNavigateHome}
                onNavigateOffice={commAgentNavMerged.onNavigateOffice}
                onNavigateEmail={commAgentNavMerged.onNavigateEmail}
                onNavigateAntiVirus={() => setHubCenterView('antivirus')}
                onNavigateNetworkMonitoring={commAgentNavMerged.onNavigateNetworkMonitoring}
                onNavigateMappatura={commAgentNavMerged.onNavigateMappatura}
                onNavigateSpeedTest={
                  canSpeedTest ? () => setHubCenterView('speedtest') : commAgentNavMerged.onNavigateSpeedTest
                }
                onNavigateDispositiviAziendali={() => setHubCenterView('dispositivi')}
                onNavigateVpn={commAgentNavMerged.onNavigateVpn}
              />
            ) : (
              <HubOverviewSection
                accentHex={accentHex}
                hubSurfaceMode={hubSurfaceMode}
                hubTicketCounts={hubTicketCounts}
                hubLayout={hubLayout}
                setHubLayout={setHubLayout}
                hubLayoutEditMode={hubLayoutEditMode}
                isTechnician={isTechnician}
                layoutUserKey={hubLayoutUserKey}
                onOpenNewTicket={onOpenNewTicket}
                onOpenTicketState={onOpenTicketState}
                setHubCenterView={setHubCenterView}
                nav={nav}
                getAuthHeader={getAuthHeader}
                socket={socket}
                currentUser={currentUser}
              />
            )}
          </div>
        </section>

        {/* Colonna destra */}
        <aside
          className={`flex min-h-0 shrink-0 flex-col gap-3 overflow-hidden border-[color:var(--hub-chrome-border-soft)] py-5 lg:h-full lg:w-[300px] lg:border-l xl:w-[320px] ${
            hubCenterView === 'tickets' && ticketHubListProps ? 'px-2' : 'px-4'
          }`}
          style={{ backgroundColor: 'var(--hub-chrome-page)' }}
        >
          <HubTimeCard accentHex={accentHex} />
          {hubCenterView === 'tickets' && ticketHubListProps ? (
            <RightPanel
              showTitle={false}
              variant="flush"
              className="min-h-0 flex-1"
              bodyClassName="flex min-h-0 flex-col overflow-hidden p-0"
              scrollBody={false}
            >
              <div
                className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
                style={hubModalCssVars(accentHex)}
              >
                <TicketsCalendar
                  sidebarHubEmbed
                  hubSurfaceMode={hubSurfaceMode}
                  tickets={tickets}
                  users={ticketHubListProps.users}
                  contracts={hubCalendarContracts}
                  currentUser={currentUser}
                  getAuthHeader={getAuthHeader}
                  onTicketClick={(ticket) => ticketHubListProps.onCalendarTicketClick?.(ticket)}
                />
              </div>
            </RightPanel>
          ) : (
            <>
              <RightPanel
                title="Avvisi importanti"
                className="min-h-[12rem] flex-[1.25]"
                bodyClassName="space-y-0"
                scrollBody={false}
                titleAccessory={
                  <button
                    type="button"
                    className={`${hubTinyIconBtn} p-1.5`}
                    title="Apri tutti gli avvisi nel centro Hub"
                    aria-label="Apri elenco completo degli avvisi importanti nell’hub"
                    onClick={() => setHubCenterView('avvisi')}
                  >
                    <ChevronsRight size={17} aria-hidden />
                  </button>
                }
                onMouseEnter={() => setAvvisiPanelHovered(true)}
                onMouseLeave={() => setAvvisiPanelHovered(false)}
              >
                <ImportantAlertsCarousel
                  alerts={hubImportantAlerts}
                  loading={hubImportantAlertsLoading}
                  accentHex={accentHex}
                  rotationPaused={avvisiPanelHovered}
                />
              </RightPanel>

              <RightPanel title="Ultimi eventi di rete">
                <DummyRow accent={accentHex} title={'SNMP: uptime switch core > 99.9%'} meta="Dummy · timeline eventi agent" />
                <DummyRow accent={accentHex} title="Ping medio ufficio: 14 ms" meta="Dummy · ultimo campionamento" />
                <DummyRow accent={accentHex} title="Nuovo device rilevato in VLAN 20" meta="Dummy · log monitoraggio" />
              </RightPanel>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
