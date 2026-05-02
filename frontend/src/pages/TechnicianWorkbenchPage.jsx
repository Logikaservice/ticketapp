import React, { useMemo, useRef, useEffect, useState } from 'react';
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
  Info,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  FileText,
  PlayCircle
} from 'lucide-react';
import { fetchImportantAlertsForHub } from '../utils/importantAlertsFeed';

const SURFACE = '#1E1E1E';
const DEFAULT_ACCENT = '#C1FF72';
const PAGE_BG = '#121212';
const STORAGE_KEY_ACCENT = 'techHubAccent';
const STORAGE_KEY_SIDEBAR_COLLAPSED = 'techHubSidebarCollapsed';
const HUB_ALERTS_PAGE_SIZE = 5;

const hubTinyIconBtn =
  'rounded-lg border border-transparent p-1.5 text-white/55 transition hover:bg-white/[0.06] hover:text-[color:var(--hub-accent)] hover:[border-color:var(--hub-accent-border)] disabled:pointer-events-none disabled:opacity-0';

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

/** Palette colori brillanti (accento Hub tecnico). */
const TECH_HUB_ACCENT_PALETTE = [
  { id: 'lime', label: 'Lime', hex: '#C1FF72' },
  { id: 'chartreuse', label: 'Chartreuse', hex: '#D4FF47' },
  { id: 'spring', label: 'Primavera', hex: '#00FF9F' },
  { id: 'cyan', label: 'Ciano', hex: '#22D3EE' },
  { id: 'sky', label: 'Cielo', hex: '#38BDF8' },
  { id: 'blue', label: 'Blu elettrico', hex: '#60A5FA' },
  { id: 'violet', label: 'Violetto', hex: '#A78BFA' },
  { id: 'fuchsia', label: 'Fucsia', hex: '#E879F9' },
  { id: 'pink', label: 'Rosa', hex: '#FB7185' },
  { id: 'coral', label: 'Corallo', hex: '#FF6B6B' },
  { id: 'amber', label: 'Ambra', hex: '#FBBF24' },
  { id: 'orange', label: 'Arancione', hex: '#FB923C' }
];

function normalizeHex(hex) {
  const h = (hex || '').trim();
  const re = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
  const m = h.match(re);
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) {
    s = s.split('').map((c) => c + c).join('');
  }
  return `#${s}`;
}

function hexToRgba(hex, alpha) {
  const normalized = normalizeHex(hex);
  if (!normalized) return `rgba(255,255,255,${alpha})`;
  const h = normalized.slice(1);
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Testo leggibile sulla pill colore avatar (sfondi accesi vs scuri). */
function readableOnAccent(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return '#111111';
  const h = normalized.slice(1);
  const n = parseInt(h, 16);
  const R = ((n >> 16) & 255) / 255;
  const G = ((n >> 8) & 255) / 255;
  const Bl = (n & 255) / 255;
  const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * Bl;
  return luminance > 0.62 ? '#121212' : '#fafafa';
}

function loadStoredAccent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACCENT);
    const n = normalizeHex(raw);
    if (!n) return DEFAULT_ACCENT;
    const known = TECH_HUB_ACCENT_PALETTE.some((p) => p.hex.toLowerCase() === n.toLowerCase());
    return known ? n : DEFAULT_ACCENT;
  } catch (_) {
    /* ignore */
  }
  return DEFAULT_ACCENT;
}

function loadSidebarCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY_SIDEBAR_COLLAPSED) === '1';
  } catch (_) {
    return false;
  }
}

/** Incrociabile: modulo card cliccabile (stesso pattern per tasselli e griglia centrale). */
function ModuleLaunchCard({ icon: Icon, label, subtitle, accent, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border border-white/[0.08] p-4 text-left transition hover:bg-white/[0.04] hover:[border-color:var(--hub-accent-border)] hover:shadow-[0_0_0_1px_var(--hub-accent-glow)] ${className}`}
      style={{ backgroundColor: SURFACE }}
    >
      <div className="mb-3 inline-flex rounded-xl p-2.5" style={{ backgroundColor: hexToRgba(accent, 0.12) }}>
        <Icon size={22} style={{ color: accent }} className="shrink-0" />
      </div>
      <div className="text-sm font-semibold text-white">{label}</div>
      {subtitle && <div className="mt-1 text-xs text-white/45">{subtitle}</div>}
    </button>
  );
}

/**
 * Stat ticket allineata alla Dashboard (icone FileText / PlayCircle, conteggi stessi ticket tecnico globali).
 * Con conteggio 0: neutra come le altre card Hub, non cliccabile.
 */
function TicketHubStatCard({ icon: Icon, title, count, accentHex, stateKey, onOpenTicketState }) {
  const active = Boolean(count > 0);
  const ticketLabelTone = active ? 'text-white/50' : 'text-white/32';
  const body = (
    <>
      <div className="mb-2 flex gap-3">
        <div
          className={`inline-flex shrink-0 rounded-xl p-2.5 transition ${
            active ? '' : 'bg-white/[0.06]'
          }`}
          style={active ? { backgroundColor: hexToRgba(accentHex, 0.14) } : undefined}
        >
          <Icon
            size={22}
            className="shrink-0"
            style={{ color: active ? accentHex : 'rgba(255,255,255,0.38)' }}
          />
        </div>
        <div className="min-w-0 flex-1 self-center leading-tight">
          <div className={`text-[11px] font-semibold uppercase tracking-widest ${ticketLabelTone}`}>
            Ticket
          </div>
          <div className="mt-0.5 text-base font-semibold text-white/90">{title}</div>
        </div>
      </div>
      <div
        className={`text-5xl font-extrabold leading-none tabular-nums md:text-[3.25rem] ${
          active ? '' : 'text-white/[0.28]'
        }`}
        style={active ? { color: accentHex } : undefined}
      >
        {count}
      </div>
    </>
  );

  const surfaceStyle = { backgroundColor: SURFACE };

  if (!active) {
    return (
      <div className="rounded-2xl border border-white/[0.08] p-4 text-left" style={surfaceStyle}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`rounded-2xl border border-white/[0.08] p-4 text-left transition hover:bg-white/[0.04] hover:[border-color:var(--hub-accent-border)] hover:shadow-[0_0_0_1px_var(--hub-accent-glow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--hub-accent)]`}
      style={surfaceStyle}
      onClick={() => onOpenTicketState?.(stateKey)}
      aria-label={`${title}: ${count}. Apri elenco ticket per questo stato`}
    >
      {body}
    </button>
  );
}

function NavGroup({ title, open, onToggle, children, railMode }) {
  if (railMode) {
    return <div className="mt-1 space-y-1 border-t border-white/[0.06] pt-2">{children}</div>;
  }
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-widest text-white/40 transition hover:bg-white/[0.04] hover:text-[color:var(--hub-accent)]"
      >
        <span>{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="space-y-0.5 pl-1">{children}</div>}
    </div>
  );
}

function SidebarLink({ icon: Icon, label, onClick, nested, railMode }) {
  const iconSz = railMode ? 20 : nested ? 16 : 18;
  if (railMode) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={label}
        aria-label={label}
        className="group mx-auto flex w-full max-w-[3rem] items-center justify-center rounded-xl border border-transparent py-2.5 text-white/80 transition hover:bg-white/[0.06] hover:text-[color:var(--hub-accent)] hover:[border-color:var(--hub-accent-border)]"
      >
        <Icon size={iconSz} className="shrink-0 text-white/50 transition group-hover:text-[color:var(--hub-accent)]" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm text-white/80 transition hover:bg-white/[0.05] hover:text-[color:var(--hub-accent)] hover:[border-color:var(--hub-accent-border)] ${
        nested ? 'pl-6 text-[13px] text-white/70' : ''
      }`}
    >
      <Icon
        size={iconSz}
        className="shrink-0 text-white/45 transition group-hover:text-[color:var(--hub-accent)]"
      />
      {label}
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
  scrollBody = true
}) {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] p-4 ${className}`}
      style={{ backgroundColor: SURFACE }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-xs font-bold uppercase tracking-widest text-white/40">{title}</h3>
        {titleAccessory ? <div className="flex shrink-0 items-center">{titleAccessory}</div> : null}
      </div>
      <div
        className={`min-h-0 flex-1 ${scrollBody ? 'overflow-y-auto pr-1' : 'overflow-hidden'} ${bodyClassName}`}
      >
        {children}
      </div>
    </div>
  );
}

function alertLevelSidebarMeta(level) {
  switch (level) {
    case 'danger':
      return {
        Icon: AlertTriangle,
        iconClassName: 'text-red-400',
        titleClassName: 'text-red-400',
        bodyClassName: 'text-red-300/90'
      };
    case 'info':
      return {
        Icon: Info,
        iconClassName: 'text-sky-400',
        titleClassName: 'text-sky-300',
        bodyClassName: 'text-sky-200/85'
      };
    case 'features':
      return {
        Icon: Sparkles,
        iconClassName: 'text-emerald-400',
        titleClassName: 'text-emerald-300',
        bodyClassName: 'text-emerald-200/85'
      };
    case 'warning':
    default:
      return {
        Icon: AlertCircle,
        iconClassName: 'text-amber-400',
        titleClassName: 'text-amber-300',
        bodyClassName: 'text-amber-200/85'
      };
  }
}

/** Righe lista avvisi (sola lettura). */
function ImportantAlertsSidebarRows({ items }) {
  return (
    <div role="list" className="space-y-3">
      {items.map((a) => {
        const meta = alertLevelSidebarMeta(a.level);
        const Icon = meta.Icon;
        const title = (a.title && String(a.title).trim()) || '(Senza titolo)';
        const body = (a.body && String(a.body)) || '';
        const key =
          a.id != null ? `alert-${a.id}` : `${title}-${body.slice(0, 48)}`;
        return (
          <div
            key={key}
            role="listitem"
            className="flex gap-2.5 border-b border-white/[0.06] pb-3 last:border-b-0 last:pb-0"
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
    return <div className="py-8 text-center text-xs text-white/40">Caricamento avvisi…</div>;
  }
  if (!alerts?.length) {
    return <div className="py-8 text-center text-xs text-white/40">Nessun avviso presente.</div>;
  }

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        <ImportantAlertsSidebarRows items={currentItems} />
      </div>
      {pageCount > 1 && (
        <div className="mt-3 shrink-0 border-t border-white/[0.06] pt-3">
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
                    backgroundColor: i === pageIndex ? accentHex : 'rgba(255,255,255,0.22)'
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
    <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3 transition hover:[border-color:var(--hub-accent-border)]">
      <div
        className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: dot || accent }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/85">{title}</p>
        <p className="mt-0.5 text-xs text-white/40">{meta}</p>
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
  onOpenTicketState
}) {
  const [accentHex, setAccentHex] = useState(loadStoredAccent);
  const [hubImportantAlerts, setHubImportantAlerts] = useState([]);
  const [hubImportantAlertsLoading, setHubImportantAlertsLoading] = useState(true);
  const [avvisiPanelHovered, setAvvisiPanelHovered] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accentPickerOpen, setAccentPickerOpen] = useState(false);
  const [navToolsOpen, setNavToolsOpen] = useState(true);
  const [navProjectsOpen, setNavProjectsOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const userMenuRef = useRef(null);
  const accentPickerRef = useRef(null);
  const minMd = useMinMd();
  const railMode = sidebarCollapsed && minMd;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACCENT, accentHex);
    } catch (_) {
      /* ignore */
    }
  }, [accentHex]);

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
      backgroundColor: PAGE_BG,
      color: '#fafafa',
      ['--hub-accent']: accentHex,
      ['--hub-accent-border']: hexToRgba(accentHex, 0.52),
      ['--hub-accent-glow']: hexToRgba(accentHex, 0.32)
    }),
    [accentHex]
  );

  const hubHoverIconBtn =
    'rounded-xl border border-transparent text-white/45 transition hover:bg-white/[0.06] hover:text-[color:var(--hub-accent)] hover:[border-color:var(--hub-accent-border)]';

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
        className={`flex w-full shrink-0 flex-col border-white/[0.06] py-5 transition-[width,padding] duration-200 ease-out max-md:w-full max-md:px-5 md:h-full md:border-r ${
          railMode ? 'md:w-[76px] md:items-center md:px-2 md:overflow-visible' : 'md:w-[280px] md:px-5 lg:w-[292px]'
        }`}
        style={{ backgroundColor: '#171717' }}
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
                  <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                  <div className="truncate text-xs text-white/45">{currentUser?.email || ''}</div>
                </div>
                <ChevronDown size={18} className={`shrink-0 text-white/40 transition ${userMenuOpen ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>
          {userMenuOpen && (
            <div
              className={`absolute z-30 space-y-0.5 rounded-2xl border border-white/[0.1] p-2 shadow-2xl ${
                railMode
                  ? 'left-full top-0 ml-2 w-[min(16rem,calc(100vw-5rem))]'
                  : 'left-0 right-0 top-full mt-2'
              }`}
              style={{ backgroundColor: SURFACE }}
            >
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenSettings?.();
                }}
                className="group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-white/85 transition hover:bg-white/[0.05] hover:text-[color:var(--hub-accent)]"
              >
                <Settings size={18} className="text-white/50 transition group-hover:text-[color:var(--hub-accent)]" />
                Impostazioni account
              </button>
              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-white/35"
                title="In preparazione"
              >
                <Palette size={18} className="text-white/30" />
                Personalizzazione Hub
                <span className="ml-auto text-[10px] uppercase tracking-wide text-white/25">Beta</span>
              </button>
              <div className="my-1 border-t border-white/[0.06]" />
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
              style={{ backgroundColor: SURFACE }}
            >
              <Search size={20} className="text-white/40" aria-hidden />
            </button>
          ) : (
            <div
              className="group flex items-center gap-3 rounded-2xl border border-white/[0.08] px-3 py-2.5 transition hover:[border-color:var(--hub-accent-border)]"
              style={{ backgroundColor: SURFACE }}
            >
              <Search size={18} className="shrink-0 text-white/35 transition group-hover:text-[color:var(--hub-accent)]" aria-hidden />
              <input
                type="search"
                readOnly
                tabIndex={-1}
                placeholder="Cerca…"
                className="min-w-0 flex-1 cursor-default bg-transparent text-sm text-white/80 outline-none placeholder:text-white/30"
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
          <SidebarLink railMode={railMode} icon={TicketHomeIcon} label="Ticket" onClick={() => onNavigateHome?.()} />
          <SidebarLink railMode={railMode} icon={Building2} label="Office" onClick={() => nav?.onOpenOffice?.()} />
          <SidebarLink railMode={railMode} icon={Mail} label="Email" onClick={() => nav?.onOpenEmail?.()} />
          <SidebarLink railMode={railMode} icon={Shield} label="Anti-Virus" onClick={() => nav?.onOpenAntiVirus?.()} />
          <SidebarLink railMode={railMode} icon={Eye} label="L-Sight" onClick={() => nav?.onOpenLSight?.()} />
          <SidebarLink railMode={railMode} icon={Monitor} label="Dispositivi aziendali" onClick={() => nav?.onOpenDispositivi?.()} />
          <SidebarLink railMode={railMode} icon={Gauge} label="Speed Test" onClick={() => nav?.onOpenSpeedTest?.()} />
          <SidebarLink railMode={railMode} icon={Wifi} label="Monitoraggio rete" onClick={() => nav?.onOpenNetwork?.()} />
          <SidebarLink railMode={railMode} icon={MapPin} label="Mappatura" onClick={() => nav?.onOpenMappatura?.()} />

          <div className={railMode ? 'w-full pt-2' : 'pt-2'}>
            <NavGroup railMode={railMode} title="Comunicazioni" open={navToolsOpen} onToggle={() => setNavToolsOpen((o) => !o)}>
              <SidebarLink
                railMode={railMode}
                nested
                icon={Monitor}
                label="Agent comunicazioni"
                onClick={() => nav?.onOpenCommAgentManager?.()}
              />
              <SidebarLink railMode={railMode} nested icon={Bell} label="Invia comunicazione" onClick={() => nav?.onOpenCommAgent?.()} />
            </NavGroup>
          </div>

          <div className={railMode ? 'w-full pt-2' : 'pt-2'}>
            <NavGroup railMode={railMode} title="Altri progetti" open={navProjectsOpen} onToggle={() => setNavProjectsOpen((o) => !o)}>
              <SidebarLink railMode={railMode} nested icon={Calendar} label="Orari e Turni" onClick={() => nav?.onOpenOrari?.()} />
              <SidebarLink railMode={railMode} nested icon={Volume2} label="Vivaldi" onClick={() => nav?.onOpenVivaldi?.()} />
              <SidebarLink railMode={railMode} nested icon={Monitor} label="PackVision" onClick={() => nav?.onOpenPackVision?.()} />
              <SidebarLink railMode={railMode} nested icon={Layers} label="VPN" onClick={() => nav?.onOpenVpn?.()} />
            </NavGroup>
          </div>
        </nav>

        {minMd && (
          <div className={`mt-auto w-full border-t border-white/[0.06] pt-3 ${railMode ? 'flex justify-center' : ''}`}>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              title={railMode ? 'Espandi barra laterale' : 'Comprimi barra (solo icone)'}
              aria-expanded={!railMode}
              className={`${hubHoverIconBtn} flex items-center justify-center rounded-xl py-2 text-xs font-medium text-white/50 ${railMode ? 'px-2' : 'w-full px-3'}`}
            >
              {railMode ? <ChevronsRight size={22} aria-hidden /> : <ChevronsLeft size={22} aria-hidden />}
              {!railMode && <span className="ml-2">Solo icone</span>}
            </button>
          </div>
        )}

        <div
          className={`flex items-center gap-2 border-t border-white/[0.06] pt-3 opacity-70 ${railMode ? 'mt-2 w-full flex-col justify-center' : 'mt-2'} ${!minMd ? 'mt-auto' : ''}`}
          title={railMode ? 'Ticket' : undefined}
        >
          <LayoutGrid size={20} style={{ color: accentHex }} />
          {!railMode && <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">Ticket</span>}
        </div>
      </aside>

      {/* Centro + destra */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header
            className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4"
            style={{ backgroundColor: PAGE_BG }}
          >
            <div className="flex min-w-0 items-center gap-3 text-sm text-white/45">
              <button
                type="button"
                className={`rounded-lg p-2 ${hubHoverIconBtn}`}
                aria-label="Navigazione"
              >
                <Layers size={20} />
              </button>
              <span className="hidden sm:inline text-white/25">/</span>
              <div className="min-w-0 truncate">
                <span className="text-white/45">Hub tecnico</span>
                <span className="text-white/25"> / </span>
                <span className="font-medium text-white/90">Panoramica</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <div ref={accentPickerRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccentPickerOpen((o) => !o)}
                  className={`p-2.5 ${hubHoverIconBtn}`}
                  title="Colore tema Hub"
                  aria-expanded={accentPickerOpen}
                  aria-haspopup="dialog"
                >
                  <Moon size={20} />
                </button>
                {accentPickerOpen && (
                  <div
                    className="absolute right-0 top-full z-[80] mt-2 w-[17.5rem] rounded-2xl border border-white/[0.12] p-3 shadow-2xl"
                    style={{ backgroundColor: SURFACE }}
                    role="dialog"
                    aria-label="Scegli colore accento"
                  >
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/42">
                      <Palette size={14} style={{ color: accentHex }} />
                      Colore accento
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
                            className={`relative aspect-square rounded-xl transition hover:outline hover:outline-2 hover:outline-offset-2 hover:outline-white/50 ${
                              active ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1e1e1e]' : 'border border-white/15'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          />
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[11px] leading-snug text-white/38">
                      Salvato in questo browser; icone e bordi in evidenza seguono il colore che scegli.
                    </p>
                  </div>
                )}
              </div>
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

          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
            <p className="mb-3 text-xs text-white/40">
              Area modulare: griglia a 12 colonne per comporre tasselli, grafici e riassunti. Esempio sotto (placeholder).
            </p>
            <div
              className="grid auto-rows-[minmax(112px,auto)] grid-cols-12 gap-3"
              style={{ minHeight: 'min(70vh, 640px)' }}
            >
              <div className="col-span-12 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TicketHubStatCard
                  icon={FileText}
                  title="Aperti"
                  count={hubTicketCounts.aperto}
                  accentHex={accentHex}
                  stateKey="aperto"
                  onOpenTicketState={onOpenTicketState}
                />
                <TicketHubStatCard
                  icon={PlayCircle}
                  title="In lavorazione"
                  count={hubTicketCounts.in_lavorazione}
                  accentHex={accentHex}
                  stateKey="in_lavorazione"
                  onOpenTicketState={onOpenTicketState}
                />
              </div>

              {/* Quattro tasselli piccoli = una fascia unificata */}
              <div className="col-span-12 grid grid-cols-2 gap-3 md:grid-cols-4">
                <ModuleLaunchCard
                  icon={Mail}
                  label="Email"
                  subtitle="Apri modulo"
                  accent={accentHex}
                  onClick={() => nav?.onOpenEmail?.()}
                  className="col-span-1"
                />
                <ModuleLaunchCard
                  icon={Wifi}
                  label="Monitoraggio"
                  subtitle="Stato rete"
                  accent={accentHex}
                  onClick={() => nav?.onOpenNetwork?.()}
                  className="col-span-1"
                />
                <ModuleLaunchCard
                  icon={Bell}
                  label="Comunicazioni"
                  subtitle="Messaggi broadcast"
                  accent={accentHex}
                  onClick={() => nav?.onOpenCommAgent?.()}
                  className="col-span-1"
                />
                <ModuleLaunchCard
                  icon={Shield}
                  label="Anti-Virus"
                  subtitle="Sicurezza"
                  accent={accentHex}
                  onClick={() => nav?.onOpenAntiVirus?.()}
                  className="col-span-1"
                />
              </div>

              {/* Blocco grafico più ampio */}
              <div
                className="col-span-12 flex flex-col rounded-2xl border border-white/[0.08] p-5 md:col-span-7 md:row-span-3"
                style={{ backgroundColor: SURFACE }}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">Grafico (placeholder)</h2>
                  <span className="text-xs text-white/35">Aggiorna con dati reali</span>
                </div>
                <div className="relative flex flex-1 min-h-[200px] items-center justify-center">
                  {/* Donut semplice CSS */}
                  <div
                    className="relative h-44 w-44 rounded-full"
                    style={{
                      background: `conic-gradient(${accentHex} 0deg 210deg, ${hexToRgba(
                        accentHex,
                        0.28
                      )} 210deg 300deg, rgba(255,255,255,0.06) 300deg 360deg)`
                    }}
                  >
                    <div
                      className="absolute inset-[18%] flex items-center justify-center rounded-full text-center"
                      style={{ backgroundColor: PAGE_BG }}
                    >
                      <div>
                        <div className="text-2xl font-bold tabular-nums text-white">68%</div>
                        <div className="mt-1 text-[11px] text-white/40">Placeholder</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4 text-center">
                  <div>
                    <div className="text-lg font-semibold tabular-nums text-white">12</div>
                    <div className="text-[10px] uppercase tracking-wide text-white/35">Ieri</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold tabular-nums" style={{ color: accentHex }}>
                      48
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-white/35">Oggi</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold tabular-nums text-white">5</div>
                    <div className="text-[10px] uppercase tracking-wide text-white/35">In attesa</div>
                  </div>
                </div>
              </div>

              {/* Stack destro */}
              <div
                className="col-span-12 flex flex-col gap-3 md:col-span-5 md:row-span-2"
              >
                <div
                  className="rounded-2xl border border-white/[0.08] p-4 flex-1"
                  style={{ backgroundColor: SURFACE }}
                >
                  <h3 className="text-sm font-semibold text-white">Riepilogo rapido</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    Qui potrai inserire KPI o testo che riassume ticket, agent o avvisi. Struttura pronta per contenuti
                    dinamici.
                  </p>
                </div>
                <ModuleLaunchCard
                  icon={MapPin}
                  label="Mappatura"
                  subtitle="Topologia e dispositivi"
                  accent={accentHex}
                  onClick={() => nav?.onOpenMappatura?.()}
                  className="flex-1"
                />
              </div>

              {/* Riga bassa: due tasselli affiancati */}
              <div
                className="col-span-12 rounded-2xl border border-dashed border-white/[0.12] p-4 transition hover:[border-color:var(--hub-accent-border)] md:col-span-6"
                style={{ backgroundColor: 'rgba(30,30,30,0.55)' }}
              >
                <p className="text-xs font-medium text-white/55">Slot libero — metà larghezza</p>
                <p className="mt-2 text-xs text-white/35">Può diventare tabella avvisi interni, grafico a barre o feed.</p>
              </div>
              <div
                className="col-span-12 rounded-2xl border border-dashed border-white/[0.12] p-4 transition hover:[border-color:var(--hub-accent-border)] md:col-span-6"
                style={{ backgroundColor: 'rgba(30,30,30,0.55)' }}
              >
                <p className="text-xs font-medium text-white/55">Slot libero — metà larghezza</p>
                <p className="mt-2 text-xs text-white/35">Combinazione con sopra forma una riga responsive a tutta griglia.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Colonna destra */}
        <aside
          className="flex min-h-0 shrink-0 flex-col gap-3 overflow-hidden border-white/[0.06] px-4 py-5 lg:h-full lg:w-[300px] lg:border-l xl:w-[320px]"
          style={{ backgroundColor: PAGE_BG }}
        >
          <RightPanel
            title="Avvisi importanti"
            className="min-h-[12rem] flex-[1.25]"
            bodyClassName="space-y-0"
            scrollBody={false}
            titleAccessory={
              <button
                type="button"
                className={`${hubTinyIconBtn} p-1.5`}
                title="Apri la dashboard Ticket (avvisi completi)"
                aria-label="Vai alla dashboard Ticket con gli avvisi"
                onClick={() => onNavigateHome?.()}
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

          <RightPanel title="Comunicazioni">
            <DummyRow accent={accentHex} title="Broadcast «Avviso backup» consegnato" meta="Dummy · dettaglio invii" />
            <DummyRow accent={accentHex} title="2 messaggi in coda sugli agent" meta="Dummy · stato coda" />
          </RightPanel>
        </aside>
      </div>
    </div>
  );
}
