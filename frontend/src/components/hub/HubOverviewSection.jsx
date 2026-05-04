import React, { useRef, useMemo, useState, useEffect } from 'react';
import {
  Mail,
  Shield,
  Wifi,
  Bell,
  MapPin,
  FileText,
  PlayCircle,
  Plus,
  GripVertical,
  EyeOff,
  Trash2,
  RotateCcw,
  Layers,
  Building2,
  Monitor,
  Gauge,
  Lock,
  Package
} from 'lucide-react';
import {
  hexToRgba,
  hubKpiActiveForegroundHex,
  hubCardInnerGlowCssVars,
  HUB_CARD_INNER_GLOW_CLASS
} from '../../utils/techHubAccent';
import HubContractsActiveCard from './HubContractsActiveCard';
import HubAgentEventsInteractiveCard from './HubAgentEventsInteractiveCard';
import {
  HUB_GRID_COLS,
  HUB_MAX_ROW_SPAN,
  HUB_MODULE_META,
  applyPlacement,
  applyResize,
  setHidden,
  removeModule,
  restoreDefaultModule,
  missingModuleIds,
  ALL_MODULE_IDS,
  getDefaultHubLayout,
  restoreSingleCardDefaults,
  snapDropToCell,
  inferDropRowFromAnchor,
  sanitizeLayoutItems,
  saveHubLayout,
  swapGridPositions,
  hubModuleSupportsIconOnly,
  findNearestFit,
  maxRowUsed
} from '../../utils/hubOverviewLayout';

const HUB_REFRESH_TICKET_STAT_IDS = new Set(['stat-aperto', 'stat-lavorazione']);

/** Gruppi nel pannello «Modifica layout»: per tipo d’uso della card. */
const HUB_LIBRARY_GROUP_SPECS = [
  {
    title: 'Ticket',
    caption: 'Conteggi e azioni sui ticket nella panoramica',
    ids: ['new-ticket', 'stat-aperto', 'stat-lavorazione']
  },
  {
    title: 'Moduli',
    caption: 'Accesso ai moduli integrati nell’hub',
    ids: [
      'launch-email',
      'launch-network',
      'launch-comms',
      'agent-events',
      'launch-antivirus',
      'launch-dispositivi',
      'launch-speedtest',
      'launch-forniture-resoconto',
      'launch-office',
      'launch-mappatura'
    ]
  },
  {
    title: 'KPI',
    caption: 'Indicatori e grafici',
    ids: ['contracts']
  },
  {
    title: 'Testo',
    caption: 'Titolo e testo nella card hub',
    ids: ['quick-summary']
  }
];

const _libSpecIds = new Set(HUB_LIBRARY_GROUP_SPECS.flatMap((g) => g.ids));
const HUB_LIBRARY_GROUPS = [
  ...HUB_LIBRARY_GROUP_SPECS,
  ...(ALL_MODULE_IDS.some((id) => !_libSpecIds.has(id))
    ? [
        {
          title: 'Altri',
          caption: '',
          ids: ALL_MODULE_IDS.filter((id) => !_libSpecIds.has(id))
        }
      ]
    : [])
];

/** Solo tema Chiaro ha ombra; in scuro `--hub-chrome-card-shadow` è `none`. */
const hubOverviewCardLift = { boxShadow: 'var(--hub-chrome-card-shadow)' };

function ModuleLaunchCard({
  icon: Icon,
  label,
  subtitle,
  accent,
  onClick,
  className = '',
  subdued = false,
  suppressInteraction = false,
  iconOnly = false,
  /** Se definito (numero), mostra conteggio a destra come le card ticket KPI (colore da accento Hub). */
  count = undefined,
  hubSurfaceMode = 'dark'
}) {
  const hasCount = typeof count === 'number' && !Number.isNaN(count);
  const g = hasCount ? hubKpiActiveForegroundHex(accent, hubSurfaceMode) : null;
  const n = hasCount ? Math.max(0, Math.floor(count)) : null;
  const countActive = hasCount && n > 0;
  const innerGlowStyle = countActive ? hubCardInnerGlowCssVars(accent) : null;

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={hasCount ? `${label}: ${n}` : label}
        className={`flex h-full min-h-[4.5rem] w-full flex-col items-center justify-center rounded-2xl border border-[color:var(--hub-chrome-border-soft)] p-3 text-[color:var(--hub-chrome-text)] transition hover:bg-[color:var(--hub-chrome-hover)] hover:[border-color:var(--hub-accent-border)] hover:shadow-[0_0_0_1px_var(--hub-accent-glow)] ${countActive ? HUB_CARD_INNER_GLOW_CLASS : ''} ${className} ${subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''} ${suppressInteraction ? 'pointer-events-none' : ''}`}
        style={{
          backgroundColor: 'var(--hub-chrome-surface)',
          ...hubOverviewCardLift,
          ...innerGlowStyle
        }}
      >
        <div className="flex flex-col items-center justify-center gap-1 py-2">
          <div
            className={`inline-flex rounded-xl p-2.5 ${hasCount && !countActive ? 'bg-[color:var(--hub-chrome-muted-fill)]' : ''}`}
            style={hasCount && countActive ? { backgroundColor: hexToRgba(g, 0.12) } : hasCount ? undefined : { backgroundColor: hexToRgba(accent, 0.14) }}
          >
            <Icon
              size={26}
              style={
                hasCount
                  ? countActive
                    ? { color: g }
                    : { color: 'var(--hub-chrome-text-fainter)' }
                  : { color: accent }
              }
              aria-hidden
            />
          </div>
          {hasCount ? (
            <span
              className={`tabular-nums text-base font-semibold ${countActive ? '' : 'text-[color:var(--hub-chrome-text-fainter)]'}`}
              style={countActive ? { color: g } : undefined}
              aria-hidden
            >
              {n}
            </span>
          ) : null}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hasCount ? `${label}: ${n}` : label}
      className={`flex h-full min-h-[6rem] w-full min-w-0 flex-col rounded-2xl border border-[color:var(--hub-chrome-border-soft)] p-4 transition hover:bg-[color:var(--hub-chrome-hover)] hover:[border-color:var(--hub-accent-border)] hover:shadow-[0_0_0_1px_var(--hub-accent-glow)] ${countActive ? HUB_CARD_INNER_GLOW_CLASS : ''} ${className} ${subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''} ${suppressInteraction ? 'pointer-events-none' : ''} ${
        hasCount ? 'justify-start text-left' : 'justify-center text-center'
      }`}
      style={{
        backgroundColor: 'var(--hub-chrome-surface)',
        ...hubOverviewCardLift,
        ...innerGlowStyle
      }}
    >
      <div className="flex w-full min-w-0 flex-col items-center gap-2">
        <div
          className={`inline-flex shrink-0 rounded-xl p-2.5 ${hasCount && !countActive ? 'bg-[color:var(--hub-chrome-muted-fill)]' : ''}`}
          style={
            hasCount && countActive
              ? { backgroundColor: hexToRgba(g, 0.12) }
              : hasCount
                ? undefined
                : { backgroundColor: hexToRgba(accent, 0.12) }
          }
        >
          <Icon
            size={22}
            className="shrink-0"
            style={
              hasCount
                ? countActive
                  ? { color: g }
                  : { color: 'var(--hub-chrome-text-fainter)' }
                : { color: accent }
            }
            aria-hidden
          />
        </div>
        {hasCount ? (
          <div className="flex w-full min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1 leading-tight">
              <div className="break-words text-base font-semibold text-[color:var(--hub-chrome-text)]">{label}</div>
              {subtitle ? (
                <div className="mt-1 break-words text-xs leading-snug text-[color:var(--hub-chrome-text-faint)]">{subtitle}</div>
              ) : null}
            </div>
            <span
              className={`shrink-0 tabular-nums text-[1.85rem] font-bold leading-none tracking-tight sm:text-[2.1rem] ${
                countActive ? '' : 'text-[color:var(--hub-chrome-text-fainter)]'
              }`}
              style={countActive ? { color: g } : undefined}
              aria-hidden
            >
              {n}
            </span>
          </div>
        ) : (
          <div className="w-full min-w-0 leading-tight">
            <div className="break-words text-base font-semibold text-[color:var(--hub-chrome-text)]">{label}</div>
            {subtitle ? (
              <div className="mt-1 break-words text-xs leading-snug text-[color:var(--hub-chrome-text-faint)]">{subtitle}</div>
            ) : null}
          </div>
        )}
      </div>
    </button>
  );
}

/**
 * KPI ticket: icona centrata in alto · titolo/sottotitolo a sinistra e numero a destra sulla stessa riga (meno altezza).
 * Zero → grigio; &gt;0 → colore derivato dall’accento Hub ({@link hubKpiActiveForegroundHex}).
 */
function TicketHubStatCard({
  icon: Icon,
  title,
  subtitle = '',
  count,
  stateKey,
  onOpenTicketState,
  subdued,
  suppressInteraction = false,
  iconOnly = false,
  kpiActiveHex,
  accentHex
}) {
  const active = count > 0;
  const g = kpiActiveHex;
  const innerGlowStyle = active && accentHex ? hubCardInnerGlowCssVars(accentHex) : null;

  const body = iconOnly ? (
    <div className="flex h-full flex-col items-center justify-center gap-1 py-2">
      <div
        className={`inline-flex rounded-xl p-2.5 ${active ? '' : 'bg-[color:var(--hub-chrome-muted-fill)]'}`}
        style={active ? { backgroundColor: hexToRgba(g, 0.12) } : undefined}
      >
        <Icon
          size={26}
          className="shrink-0"
          style={active ? { color: g } : { color: 'var(--hub-chrome-text-fainter)' }}
          aria-hidden
        />
      </div>
      <span
        className={`tabular-nums text-base font-semibold ${active ? '' : 'text-[color:var(--hub-chrome-text-fainter)]'}`}
        style={active ? { color: g } : undefined}
        aria-live="polite"
      >
        {count}
      </span>
    </div>
  ) : (
    <div className="flex w-full min-w-0 flex-col items-center gap-2 text-left">
      <div
        className={`inline-flex shrink-0 rounded-xl p-2.5 transition ${active ? '' : 'bg-[color:var(--hub-chrome-muted-fill)]'}`}
        style={active ? { backgroundColor: hexToRgba(g, 0.12) } : undefined}
      >
        <Icon
          size={26}
          className="shrink-0"
          style={active ? { color: g } : { color: 'var(--hub-chrome-text-fainter)' }}
        />
      </div>
      <div className="flex w-full min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1 leading-tight">
          <div className="break-words text-base font-semibold text-[color:var(--hub-chrome-text)]">{title}</div>
          {subtitle ? (
            <div className="mt-1 break-words text-xs font-normal leading-snug text-[color:var(--hub-chrome-text-faint)]">{subtitle}</div>
          ) : null}
        </div>
        <span
          className={`shrink-0 tabular-nums text-[1.85rem] font-bold leading-none tracking-tight sm:text-[2.1rem] ${
            active ? '' : 'text-[color:var(--hub-chrome-text-fainter)]'
          }`}
          style={active ? { color: g } : undefined}
          aria-hidden
        >
          {count}
        </span>
      </div>
    </div>
  );

  const surfaceStyle = { backgroundColor: 'var(--hub-chrome-surface)', ...hubOverviewCardLift };
  const veil = subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : '';
  const noPtr = suppressInteraction ? 'pointer-events-none' : '';
  const fullRow =
    'flex h-full min-h-[6rem] w-full min-w-0 flex-col justify-start rounded-2xl border border-[color:var(--hub-chrome-border-soft)] p-4 text-left';

  if (!active) {
    return (
      <div
        className={`${fullRow} ${iconOnly ? 'justify-center' : ''} ${veil} ${noPtr}`}
        style={surfaceStyle}
        role="status"
        aria-label={`${title}: ${count} ticket`}
      >
        {body}
      </div>
    );
  }

  const ariaLbl = `${title}: ${count}. Apri elenco`;

  return (
    <button
      type="button"
      disabled={Boolean(subdued)}
      aria-label={ariaLbl}
      className={`${fullRow} transition hover:bg-[color:var(--hub-chrome-hover)] hover:[border-color:var(--hub-accent-border)] hover:shadow-[0_0_0_1px_var(--hub-accent-glow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--hub-accent)] ${HUB_CARD_INNER_GLOW_CLASS} ${
        iconOnly ? 'justify-center' : ''
      } ${veil} ${noPtr}`}
      style={{ ...surfaceStyle, ...innerGlowStyle }}
      onClick={() => !subdued && onOpenTicketState?.(stateKey)}
    >
      {body}
    </button>
  );
}

function HubNewTicketCard({
  accentHex,
  title = 'Nuovo ticket',
  subtitle = '',
  onOpenNewTicket,
  subdued,
  suppressInteraction,
  iconOnly = false
}) {
  const aria = `${title}. Crea nuovo ticket`;
  if (iconOnly) {
    return (
      <button
        type="button"
        disabled={Boolean(subdued)}
        onClick={() => !subdued && onOpenNewTicket?.()}
        aria-label={aria}
        className={`flex h-full min-h-[4.5rem] w-full items-center justify-center rounded-2xl border p-4 transition hover:brightness-110 active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''} ${suppressInteraction ? 'pointer-events-none' : ''}`}
        style={{
          backgroundColor: hexToRgba(accentHex, 0.24),
          borderColor: hexToRgba(accentHex, 0.55),
          boxShadow: `0 0 0 1px ${hexToRgba(accentHex, 0.12)} inset, var(--hub-chrome-card-shadow)`
        }}
      >
        <div
          className="inline-flex rounded-xl p-2.5"
          style={{ backgroundColor: hexToRgba(accentHex, 0.35), color: '#121212' }}
        >
          <Plus size={26} strokeWidth={2.4} aria-hidden />
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={Boolean(subdued)}
      onClick={() => !subdued && onOpenNewTicket?.()}
      className={`flex h-full min-h-[6rem] w-full min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition hover:brightness-110 active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''} ${suppressInteraction ? 'pointer-events-none' : ''}`}
      style={{
        backgroundColor: hexToRgba(accentHex, 0.24),
        borderColor: hexToRgba(accentHex, 0.55),
        boxShadow: `0 0 0 1px ${hexToRgba(accentHex, 0.12)} inset, var(--hub-chrome-card-shadow)`
      }}
      aria-label={aria}
    >
      <div
        className="inline-flex shrink-0 rounded-xl p-2.5"
        style={{ backgroundColor: hexToRgba(accentHex, 0.35), color: '#121212' }}
      >
        <Plus size={24} strokeWidth={2.4} aria-hidden />
      </div>
      <div className="w-full min-w-0 leading-tight">
        <div className="break-words text-base font-semibold text-[color:var(--hub-chrome-text)]">{title}</div>
        {subtitle ? (
          <div className="mt-1 break-words text-xs font-normal leading-snug text-[color:var(--hub-chrome-text-faint)]">{subtitle}</div>
        ) : null}
      </div>
    </button>
  );
}

/** Griglia panoramica con modifica layout (solo controlli esterni attivati dal parent per ruolo tecnico). */
export default function HubOverviewSection({
  accentHex,
  /** `light` → card ombreggiature e moduli KPI come dashboard chiara. */
  hubSurfaceMode = 'dark',
  hubTicketCounts,
  hubLayout,
  setHubLayout,
  hubLayoutEditMode,
  isTechnician,
  layoutUserKey,
  onOpenNewTicket,
  onOpenTicketState,
  setHubCenterView,
  nav,
  getAuthHeader,
  socket = null,
  currentUser,
  onOpenFornitureResoconto = null,
  /** Conteggio forniture visibili all'utente (dopo filtro ruolo); `undefined` durante caricamento iniziale. */
  hubTemporarySuppliesCount = undefined
}) {
  const hubLight = hubSurfaceMode === 'light';
  const hubKpiActiveColor = useMemo(
    () => hubKpiActiveForegroundHex(accentHex, hubSurfaceMode),
    [accentHex, hubSurfaceMode]
  );
  const gridRef = useRef(null);
  const dragIdRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  /** Gruppo libreria espanso (`null` = tutti chiusi, meno spazio verticale). */
  const [expandedLibraryTitle, setExpandedLibraryTitle] = useState(null);

  useEffect(() => {
    if (!hubLayoutEditMode) setSelectedId(null);
  }, [hubLayoutEditMode]);

  useEffect(() => {
    if (!hubLayoutEditMode) {
      setExpandedLibraryTitle(null);
      return;
    }
    if (!selectedId) return;
    const grp = HUB_LIBRARY_GROUPS.find((g) => g.ids.includes(selectedId));
    if (grp) setExpandedLibraryTitle(grp.title);
  }, [hubLayoutEditMode, selectedId]);

  const missing = useMemo(() => missingModuleIds(hubLayout), [hubLayout]);

  useEffect(() => {
    saveHubLayout(layoutUserKey, hubLayout);
  }, [hubLayout, layoutUserKey]);

  /** Aggiorna dati in base agli intervalli impostati per singola card (ticket API + contratti). */
  useEffect(() => {
    const timers = [];
    const ticketMs = hubLayout
      .filter((x) => HUB_REFRESH_TICKET_STAT_IDS.has(x.id) && Number(x.refreshIntervalSec) >= 30)
      .map((x) => Number(x.refreshIntervalSec) * 1000);
    if (ticketMs.length > 0) {
      const ms = Math.min(...ticketMs);
      timers.push(
        setInterval(() => {
          try {
            window.dispatchEvent(new CustomEvent('hub-overview-tickets-refresh'));
          } catch (_) {
            /* ignore */
          }
        }, ms)
      );
    }

    const contractMs = hubLayout
      .filter((x) => x.id === 'contracts' && Number(x.refreshIntervalSec) >= 30)
      .map((x) => Number(x.refreshIntervalSec) * 1000);
    if (contractMs.length > 0) {
      const ms = Math.min(...contractMs);
      timers.push(
        setInterval(() => {
          try {
            window.dispatchEvent(new CustomEvent('hub-overview-contracts-refresh'));
          } catch (_) {
            /* ignore */
          }
        }, ms)
      );
    }

    return () => {
      timers.forEach((t) => clearInterval(t));
    };
  }, [hubLayout]);

  const hubCanSpeedTest = currentUser?.ruolo === 'tecnico' || currentUser?.ruolo === 'admin';
  const hubCanNetworkMonitoring =
    currentUser?.ruolo === 'tecnico' ||
    currentUser?.ruolo === 'admin' ||
    (currentUser?.ruolo === 'cliente' &&
      Array.isArray(currentUser?.admin_companies) &&
      currentUser.admin_companies.length > 0);

  const handleDragStart = (e, id) => {
    if (!hubLayoutEditMode || !isTechnician) return;
    if (hubLayout.find((x) => x.id === id)?.locked) {
      e.preventDefault();
      return;
    }
    dragIdRef.current = id;
    try {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.setData('application/x-hub-slot', id);
      e.dataTransfer.effectAllowed = 'move';
    } catch (_) {
      dragIdRef.current = id;
    }
  };

  const handleDragOverZone = (e) => {
    if (!hubLayoutEditMode || !isTechnician) return;
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = 'move';
    } catch (_) {
      /* ignore */
    }
  };

  /** Necessario: senza preventDefault sulla tile sottostante il browser non innesca mai il drop */
  const handleUnifiedDrop = (e) => {
    if (!hubLayoutEditMode || !isTechnician) return;
    e.preventDefault();
    e.stopPropagation();

    let dragId = '';
    try {
      dragId =
        e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/x-hub-slot') || '';
    } catch (_) {
      dragId = '';
    }
    if (!dragId) dragId = dragIdRef.current;
    if (!dragId || !gridRef.current) {
      dragIdRef.current = null;
      return;
    }
    if (hubLayout.find((x) => x.id === dragId)?.locked) {
      dragIdRef.current = null;
      return;
    }

    let droppedOnId = '';
    try {
      const host =
        typeof e.target?.closest === 'function' ? e.target.closest('[data-hub-slot]') : null;
      droppedOnId = host?.getAttribute?.('data-hub-slot')?.trim?.() ?? '';
    } catch (_) {
      droppedOnId = '';
    }

    setHubLayout((prev) => {
      const grid = gridRef.current;
      const { col, row: rowFromSnap } = snapDropToCell(e.clientX, e.clientY, grid, prev);
      const anchored = inferDropRowFromAnchor(e.clientY, grid, prev, dragId, col);
      const sensibleMaxRow = Math.max(maxRowUsed(prev) + 6, 12);
      const rawRow = anchored.row != null ? anchored.row : rowFromSnap;
      const row = Math.min(sensibleMaxRow, Math.max(1, rawRow));

      // Se il DOM target è una card ma il punto "snappato" cade FUORI dalla sua area griglia,
      // preferisci il posizionamento libero (permette buchi/gap) invece dello swap.
      let swapTargetId = droppedOnId && droppedOnId !== dragId ? droppedOnId : '';
      if (swapTargetId) {
        const host = prev.find((x) => x.id === swapTargetId);
        if (host) {
          const inHostCols = col >= host.col && col < host.col + host.w;
          const inHostRows = row >= host.row && row < host.row + host.h;
          if (!inHostCols || !inHostRows) swapTargetId = '';
        }
      }

      if (swapTargetId) {
        return sanitizeLayoutItems(swapGridPositions(prev, dragId, swapTargetId));
      }
      return sanitizeLayoutItems(applyPlacement(prev, dragId, col, row));
    });
    dragIdRef.current = null;
  };

  const restoreFullHubLayout = () => {
    if (
      !window.confirm(
        'Ripristinare l’intera panoramica come all’inizio del progetto? Verranno reinseriti tutti i moduli nella griglia e resi visibili quelli nascosti.'
      )
    ) {
      return;
    }
    setHubLayout(sanitizeLayoutItems(getDefaultHubLayout()));
  };

  /** Le card «nascoste» restano in griglia (sfocate + overlay) anche fuori dalla modifica layout */
  const sorted = [...hubLayout].sort((a, b) => a.row - b.row || a.col - b.col);

  const meta = selectedId ? HUB_MODULE_META[selectedId] : null;
  const selectedItem = hubLayout.find((x) => x.id === selectedId);
  const fixedSize = meta?.fixedSize;
  const resizeBoundsMeta = meta?.resizeBounds ?? null;

  /** Testo mostrato: valore salvato così com’è; solo se è solo spazi/vuoto si usa il fallback catalogo. */
  function txt(item, fallback) {
    const raw = item.customTitle;
    if (typeof raw !== 'string' || raw.trim() === '') return fallback;
    return raw;
  }

  function sub(item, fallback) {
    const raw = item.customSubtitle;
    if (typeof raw !== 'string' || raw.trim() === '') return fallback;
    return raw;
  }

  function renderInner(item) {
    const id = item.id;
    const veil = Boolean(item.hidden);
    const suppressInteraction = (hubLayoutEditMode && isTechnician) || item.hidden;
    const io = Boolean(item.iconOnly);

    switch (id) {
      case 'new-ticket':
        return (
          <HubNewTicketCard
            accentHex={accentHex}
            title={txt(item, 'Nuovo ticket')}
            subtitle={sub(item, '')}
            onOpenNewTicket={onOpenNewTicket}
            subdued={veil}
            suppressInteraction={suppressInteraction}
            iconOnly={io}
          />
        );
      case 'stat-aperto':
        return (
          <TicketHubStatCard
            icon={FileText}
            title={txt(item, 'Aperti')}
            subtitle={sub(item, '')}
            count={hubTicketCounts.aperto}
            stateKey="aperto"
            onOpenTicketState={onOpenTicketState}
            subdued={veil}
            suppressInteraction={suppressInteraction}
            iconOnly={io}
            kpiActiveHex={hubKpiActiveColor}
            accentHex={accentHex}
          />
        );
      case 'stat-lavorazione':
        return (
          <TicketHubStatCard
            icon={PlayCircle}
            title={txt(item, 'In lavorazione')}
            subtitle={sub(item, '')}
            count={hubTicketCounts.in_lavorazione}
            stateKey="in_lavorazione"
            onOpenTicketState={onOpenTicketState}
            subdued={veil}
            suppressInteraction={suppressInteraction}
            iconOnly={io}
            kpiActiveHex={hubKpiActiveColor}
            accentHex={accentHex}
          />
        );
      case 'launch-email':
        return (
          <ModuleLaunchCard
            icon={Mail}
            label={txt(item, 'Email')}
            subtitle={sub(item, 'Apri modulo')}
            accent={accentHex}
            onClick={() => setHubCenterView?.('email')}
            subdued={veil}
            suppressInteraction={suppressInteraction}
            iconOnly={io}
          />
        );
      case 'launch-network':
        return (
          <ModuleLaunchCard
            icon={Wifi}
            label={txt(item, 'Monitoraggio rete')}
            subtitle={sub(item, hubCanNetworkMonitoring ? 'Apri nel centro Hub' : 'Non disponibile')}
            accent={accentHex}
            onClick={
              hubCanNetworkMonitoring ? () => setHubCenterView?.('network-monitoring') : () => nav?.onOpenNetwork?.()
            }
            subdued={veil || !hubCanNetworkMonitoring}
            suppressInteraction={suppressInteraction || !hubCanNetworkMonitoring}
            iconOnly={io}
          />
        );
      case 'launch-comms':
        return (
          <ModuleLaunchCard
            icon={Bell}
            label={txt(item, 'Comunicazioni')}
            subtitle={sub(item, 'Messaggi broadcast')}
            accent={accentHex}
            onClick={() => setHubCenterView?.('comunicazioni')}
            subdued={veil}
            suppressInteraction={suppressInteraction}
            iconOnly={io}
          />
        );
      case 'agent-events':
        return (
          <HubAgentEventsInteractiveCard
            accentHex={accentHex}
            hubSurfaceMode={hubSurfaceMode}
            getAuthHeader={getAuthHeader}
            socket={socket}
            onOpenNetworkMonitoring={() => setHubCenterView?.('network-monitoring')}
            title={txt(item, HUB_MODULE_META[id].label)}
            subtitle={sub(item, 'Offline, online e avvisi sugli agent')}
            technicianOnly={hubCanNetworkMonitoring}
            subdued={veil}
            suppressInteraction={suppressInteraction}
            iconOnly={io}
          />
        );
      case 'launch-antivirus':
        return (
          <ModuleLaunchCard
            icon={Shield}
            label={txt(item, 'Anti-Virus')}
            subtitle={sub(item, 'Sicurezza')}
            accent={accentHex}
            onClick={() => setHubCenterView?.('antivirus')}
            subdued={veil}
            suppressInteraction={suppressInteraction}
            iconOnly={io}
          />
        );
      case 'launch-dispositivi':
        return (
          <ModuleLaunchCard
            icon={Monitor}
            label={txt(item, 'Dispositivi')}
            subtitle={sub(item, 'Parco macchine')}
            accent={accentHex}
            onClick={() => setHubCenterView?.('dispositivi')}
            subdued={veil}
            suppressInteraction={suppressInteraction}
            iconOnly={io}
          />
        );
      case 'launch-speedtest':
        return (
          <ModuleLaunchCard
            icon={Gauge}
            label={txt(item, 'Speed test')}
            subtitle={sub(item, hubCanSpeedTest ? 'Velocità linea' : 'Solo tecnici')}
            accent={accentHex}
            onClick={hubCanSpeedTest ? () => setHubCenterView?.('speedtest') : undefined}
            subdued={veil || !hubCanSpeedTest}
            suppressInteraction={suppressInteraction || !hubCanSpeedTest}
            iconOnly={io}
          />
        );
      case 'launch-forniture-resoconto':
        return (
          <ModuleLaunchCard
            icon={Package}
            label={txt(item, 'Forniture temporanee')}
            subtitle={sub(item, 'Resoconto dai ticket')}
            accent={accentHex}
            hubSurfaceMode={hubSurfaceMode}
            onClick={() => onOpenFornitureResoconto?.()}
            subdued={veil}
            suppressInteraction={suppressInteraction || !onOpenFornitureResoconto}
            iconOnly={io}
            count={hubTemporarySuppliesCount ?? 0}
          />
        );
      case 'launch-office':
        return (
          <ModuleLaunchCard
            icon={Building2}
            label={txt(item, 'Office')}
            subtitle={sub(item, 'Licenze, download e attivazioni')}
            accent={accentHex}
            onClick={() => setHubCenterView?.('office')}
            subdued={veil}
            suppressInteraction={suppressInteraction}
            iconOnly={io}
          />
        );
      case 'contracts':
        return (
          <div
            className={`relative h-full min-h-0 flex flex-col ${veil ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''} ${suppressInteraction ? 'pointer-events-none' : ''}`}
          >
            <HubContractsActiveCard
              backgroundColor="var(--hub-chrome-surface)"
              accentHex={accentHex}
              hubSurfaceMode={hubSurfaceMode}
              getAuthHeader={getAuthHeader}
              currentUser={currentUser}
              onOpenContractsList={() => setHubCenterView?.('contratti')}
            />
          </div>
        );
      case 'quick-summary':
        if (io) {
          return (
            <div
              className={`flex h-full min-h-[4.5rem] items-center justify-center rounded-2xl border border-[color:var(--hub-chrome-border-soft)] p-3 text-[color:var(--hub-chrome-text-secondary)] ${
                veil ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''
              } ${suppressInteraction ? 'pointer-events-none' : ''}`}
              style={{ backgroundColor: 'var(--hub-chrome-surface)', ...hubOverviewCardLift }}
              role="img"
              aria-label={txt(item, HUB_MODULE_META[id].label)}
            >
              <div className="inline-flex shrink-0 rounded-xl bg-[color:var(--hub-chrome-muted-fill)] p-2.5">
                <Layers size={26} className="shrink-0 text-[color:var(--hub-chrome-text-muted)]" aria-hidden />
              </div>
            </div>
          );
        }
        return (
          <div
            className={`flex h-full min-h-[6rem] w-full min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-[color:var(--hub-chrome-border-soft)] p-4 text-center ${
              veil ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''
            } ${suppressInteraction ? 'pointer-events-none' : ''}`}
            style={{ backgroundColor: 'var(--hub-chrome-surface)', ...hubOverviewCardLift }}
          >
            <div className="inline-flex shrink-0 rounded-xl bg-[color:var(--hub-chrome-muted-fill)] p-2.5">
              <Layers size={22} className="shrink-0 text-[color:var(--hub-chrome-text-muted)]" aria-hidden />
            </div>
            <div className="w-full min-w-0 leading-tight">
              <h3 className="break-words text-base font-semibold text-[color:var(--hub-chrome-text)]">{txt(item, 'Riepilogo rapido')}</h3>
              <p className="mt-1 break-words text-xs leading-relaxed text-[color:var(--hub-chrome-text-faint)]">
                {sub(item, 'Qui potrai inserire KPI o testo che riassume ticket, agent o avvisi.')}
              </p>
            </div>
          </div>
        );
      case 'launch-mappatura':
        return (
          <ModuleLaunchCard
            icon={MapPin}
            label={txt(item, 'Mappatura')}
            subtitle={sub(item, 'Topologia e dispositivi')}
            accent={accentHex}
            onClick={() => nav?.onOpenMappatura?.()}
            subdued={veil}
            suppressInteraction={suppressInteraction}
            className="min-h-0 flex-1"
            iconOnly={io}
          />
        );
      default:
        return null;
    }
  }

  return (
    <>
      {!hubLayoutEditMode && (
        <p className="mb-3 text-xs text-[color:var(--hub-chrome-text-faint)]">
          Area modulare: disponi le card dopo aver attivato «Modifica layout» nella barra in alto (tecnico). Le card «nascoste»
          dalla vista restano visibili in hub come anteprima sfocata.
        </p>
      )}
      <div
        className={`relative rounded-2xl ${
          hubLayoutEditMode && isTechnician
            ? hubLight
              ? 'ring-2 ring-dashed ring-slate-400/55 ring-offset-2 ring-offset-[color:var(--hub-chrome-ring-offset)]'
              : 'ring-2 ring-dashed ring-[color:var(--hub-accent-border)] ring-offset-2 ring-offset-[color:var(--hub-chrome-ring-offset)]'
            : ''
        }`}
      >
        <div
          ref={gridRef}
          role="grid"
          aria-label="Panoramica moduli Hub"
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${HUB_GRID_COLS}, minmax(0, 1fr))`,
            gridAutoRows: 'minmax(112px, auto)'
          }}
          onDragOver={handleDragOverZone}
          onDrop={handleUnifiedDrop}
        >
          {sorted.map((item) => (
            <div
              key={item.id}
              role="presentation"
              data-hub-slot={item.id}
              className={`relative min-h-0 min-w-0 outline-none transition-shadow ${
                hubLayoutEditMode && selectedId === item.id
                  ? hubLight
                    ? 'z-10 rounded-2xl shadow-[0_0_0_2px_var(--hub-accent)] shadow-[0_8px_28px_rgba(15,23,42,0.07)]'
                    : 'z-10 shadow-[0_0_0_2px_var(--hub-accent)]'
                  : ''
              }`}
              style={{
                gridColumn: `${item.col} / span ${item.w}`,
                gridRow: `${item.row} / span ${item.h}`,
                borderRadius: '1rem'
              }}
              onDragOver={handleDragOverZone}
              onDrop={handleUnifiedDrop}
              onClick={(e) => {
                if (!hubLayoutEditMode || !isTechnician) return;
                e.stopPropagation();
                setSelectedId(item.id === selectedId ? null : item.id);
              }}
            >
              {hubLayoutEditMode && isTechnician && (
                <div
                  className={`absolute left-2 top-2 z-20 rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-badge-scrim)] p-1 text-[color:var(--hub-chrome-text-muted)] ${
                    item.locked ? 'cursor-not-allowed opacity-40' : 'cursor-grab active:cursor-grabbing'
                  }`}
                  title={item.locked ? 'Carta bloccata: sloccare dal pannello sotto per spostarla' : 'Trascina per spostare'}
                  draggable={hubLayoutEditMode && !item.locked}
                  data-hub-slot={item.id}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    handleDragStart(e, item.id);
                  }}
                  onDragEnd={() => {
                    dragIdRef.current = null;
                  }}
                >
                  <GripVertical size={16} />
                </div>
              )}
              {item.locked && hubLayoutEditMode && isTechnician && (
                <div
                  className="pointer-events-none absolute right-2 top-2 z-20 rounded-md border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-badge-scrim)] p-1 text-[color:var(--hub-chrome-badge-warn-text)]"
                  title="Bloccata"
                >
                  <Lock size={14} aria-hidden />
                </div>
              )}
              {item.hidden && (
                <div className="pointer-events-none absolute inset-0 z-[5] rounded-2xl bg-[color:var(--hub-chrome-hidden-mask)] backdrop-blur-[3px]" />
              )}
              {item.hidden && (
                <div className="pointer-events-none absolute bottom-2 right-2 z-20 rounded-md bg-[color:var(--hub-chrome-badge-scrim)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--hub-chrome-text-secondary)]">
                  Nascosta (anteprima)
                </div>
              )}
              <div className="h-full min-h-0">{renderInner(item)}</div>
            </div>
          ))}
        </div>
      </div>

      {hubLayoutEditMode && isTechnician && (
        <div
          className="mt-4 space-y-3 rounded-2xl border border-[color:var(--hub-chrome-border-soft)] p-4"
          style={{ backgroundColor: 'var(--hub-chrome-surface)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--hub-chrome-text-faint)]">
              <Layers size={14} /> Libreria · ripristino
            </div>
            <button
              type="button"
              onClick={restoreFullHubLayout}
              className="ml-auto inline-flex items-center gap-2 rounded-xl border border-[color:var(--hub-chrome-border-soft)] bg-transparent px-3 py-2 text-[11px] font-medium text-[color:var(--hub-chrome-text-faint)] underline-offset-2 hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-chrome-text-muted)]"
              title="Reinserisce tutti i moduli come all’avvio del progetto"
            >
              <RotateCcw size={14} className="opacity-70" /> Ripristina tutta la panoramica
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-[color:var(--hub-chrome-text-fainter)]">
              I quattro quadrati in alto aprono sotto l’elenco delle card (chip con i nomi). Clic di nuovo per chiudere. Con
              una card selezionata in griglia, il gruppo corrispondente si apre da solo.
            </p>
            {missing.length === 0 ? (
              <p className="text-xs text-[color:var(--hub-chrome-text-fainter)]">
                Tutti i tipi di card sono già in griglia. Tocca un nome nel gruppo per selezionarlo; per togliere un modulo usa
                «Rimuovi dalla griglia» sulla card selezionata.
              </p>
            ) : null}
            {(() => {
              return (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {HUB_LIBRARY_GROUPS.map((group) => {
                      const expanded = expandedLibraryTitle === group.title;
                      const inGroupCount = group.ids.filter((id) => hubLayout.some((x) => x.id === id)).length;
                      return (
                        <button
                          key={group.title}
                          type="button"
                          onClick={() => setExpandedLibraryTitle((t) => (t === group.title ? null : group.title))}
                          aria-expanded={expanded}
                          title={group.caption ? `${group.title}: ${group.caption}` : group.title}
                          className={`flex h-[6.75rem] w-[6.75rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border p-1.5 text-center transition sm:aspect-square ${
                            expanded
                              ? hubLight
                                ? 'border-[color:var(--hub-accent)] bg-[color:color-mix(in_srgb,var(--hub-accent)_18%,var(--hub-chrome-well))] shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                                : 'border-[color:var(--hub-accent)] bg-[color:color-mix(in_srgb,var(--hub-accent)_14%,transparent)]'
                              : 'border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-well-mid)] hover:border-[color:var(--hub-accent-border)] hover:bg-[color:var(--hub-chrome-hover)]'
                          }`}
                        >
                          <span className="line-clamp-2 max-w-full text-[11px] font-bold uppercase leading-tight text-[color:var(--hub-chrome-text)]">
                            {group.title}
                          </span>
                          <span className="text-[11px] font-semibold tabular-nums leading-none text-[color:var(--hub-chrome-text-faint)]">
                            {inGroupCount}/{group.ids.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {(() => {
                    const group = HUB_LIBRARY_GROUPS.find((g) => g.title === expandedLibraryTitle);
                    if (!group) return null;
                    return (
                      <div className="rounded-xl border border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-well)] px-3 pb-3 pt-2">
                        {group.caption ? (
                          <p className="mb-2 text-[11px] leading-relaxed text-[color:var(--hub-chrome-text-fainter)]">
                            {group.caption}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          {group.ids.map((mid) => {
                            const mod = HUB_MODULE_META[mid];
                            if (!mod) return null;
                            const inGrid = hubLayout.some((x) => x.id === mid);
                            const canAdd = missing.includes(mid);
                            const label = mod.label;
                            return (
                              <button
                                key={mid}
                                type="button"
                                onClick={() => {
                                  if (inGrid) setSelectedId((s) => (s === mid ? null : mid));
                                  else if (canAdd) {
                                    setHubLayout((prev) =>
                                      sanitizeLayoutItems(restoreDefaultModule(prev, mid))
                                    );
                                  }
                                }}
                                disabled={!inGrid && !canAdd}
                                title={
                                  inGrid
                                    ? 'Seleziona questa card nella griglia'
                                    : canAdd
                                      ? 'Aggiungi alla griglia'
                                      : 'Non disponibile'
                                }
                                className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${
                                  inGrid
                                    ? selectedId === mid
                                      ? hubLight
                                        ? 'border-[color:var(--hub-accent)] bg-[color:color-mix(in_srgb,var(--hub-accent)_20%,var(--hub-chrome-well))] text-[color:var(--hub-chrome-text)] shadow-[0_1px_3px_rgba(15,23,42,0.06)]'
                                        : 'border-[color:var(--hub-accent)] bg-[color:color-mix(in_srgb,var(--hub-accent)_16%,transparent)] text-[color:var(--hub-chrome-text)]'
                                      : 'border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well-mid)] text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)] hover:[border-color:var(--hub-accent-border)]'
                                    : canAdd
                                      ? 'border-dashed border-[color:var(--hub-chrome-border)] text-[color:var(--hub-chrome-text-muted)] hover:border-[color:var(--hub-accent-border)] hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-chrome-text-secondary)]'
                                      : 'border-[color:var(--hub-chrome-border-soft)] text-[color:var(--hub-chrome-text-fainter)]'
                                }`}
                              >
                                {inGrid ? label : `Aggiungi · ${label}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>

          {selectedItem && meta && (() => {
            const rbSel = resizeBoundsMeta;
            const wChoices = rbSel
              ? Array.from({ length: rbSel.maxW - rbSel.minW + 1 }, (_, i) => rbSel.minW + i)
              : [1, 2, 3, 4, 5, 6, 7];
            const hChoices = rbSel
              ? Array.from({ length: rbSel.maxH - rbSel.minH + 1 }, (_, i) => rbSel.minH + i)
              : Array.from({ length: HUB_MAX_ROW_SPAN }, (_, i) => i + 1);
            const dimDisabled = !!fixedSize || !!selectedItem.iconOnly;
            const patchItem = (patch) =>
              setHubLayout((prev) =>
                sanitizeLayoutItems(prev.map((x) => (x.id === selectedId ? { ...x, ...patch } : x)))
              );

            return (
            <div className="border-t border-[color:var(--hub-chrome-border-soft)] pt-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-[color:var(--hub-chrome-text-muted)]">
                  Card selezionata: <span className="text-[color:var(--hub-accent)]">{meta.label}</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const sid = selectedId;
                    setHubLayout((prev) => restoreSingleCardDefaults(prev, sid));
                  }}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)]"
                  title="Riposiziona e ridimensiona come da progetto e azzera titolo, sottotitolo e opzioni"
                >
                  <RotateCcw size={14} /> Layout predefinito
                </button>
              </div>
              <p className="mb-3 text-[11px] text-[color:var(--hub-chrome-text-fainter)]">
                Vale solo per questa card: non reintegra moduli tolti dalla griglia e non cambia le altre posizioni, salvo sistemare
                sovrapposizioni se servono.
              </p>
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[color:var(--hub-chrome-text-muted)]">
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)]"
                    checked={Boolean(selectedItem.locked)}
                    onChange={(e) => patchItem({ locked: e.target.checked })}
                  />
                  Blocca (non si sposta trascinando)
                </label>
                <label
                  className={`inline-flex items-center gap-2 ${hubModuleSupportsIconOnly(selectedId) ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'}`}
                >
                  <input
                    type="checkbox"
                    className="rounded border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)]"
                    disabled={!hubModuleSupportsIconOnly(selectedId)}
                    checked={Boolean(selectedItem.iconOnly)}
                    onChange={(e) => {
                      const v = e.target.checked;
                      const sid = selectedId;
                      setHubLayout((prev) => {
                        const rowScan = Math.max(maxRowUsed(prev) + 12, 24);
                        const nextItems = prev.map((x) => {
                          if (x.id !== sid) return x;
                          const m = meta;
                          if (v) {
                            const upd = { ...x, iconOnly: true, w: 1, h: 1 };
                            const tentative = prev.map((p) => (p.id === sid ? upd : p));
                            const fit = findNearestFit(tentative, 1, 1, sid, x.col, x.row, rowScan);
                            return { ...upd, col: fit.col, row: fit.row };
                          }
                          let dw = m.defaultPlacement.w;
                          let dh = m.defaultPlacement.h;
                          if (m.fixedSize) {
                            dw = m.fixedSize.w;
                            dh = m.fixedSize.h;
                          } else if (m.resizeBounds) {
                            const b = m.resizeBounds;
                            dw = Math.min(Math.max(dw, b.minW), b.maxW);
                            dh = Math.min(Math.max(dh, b.minH), b.maxH);
                          }
                          const upd = { ...x, iconOnly: false, w: dw, h: dh };
                          const tentative = prev.map((p) => (p.id === sid ? upd : p));
                          const fit = findNearestFit(
                            tentative,
                            dw,
                            dh,
                            sid,
                            m.defaultPlacement.col,
                            m.defaultPlacement.row,
                            rowScan
                          );
                          return { ...upd, col: fit.col, row: fit.row };
                        });
                        return sanitizeLayoutItems(nextItems);
                      });
                    }}
                  />
                  Solo icona 1×1 (senza titolo)
                </label>
              </div>
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <label className="block text-xs text-[color:var(--hub-chrome-text-muted)]">
                  Titolo mostrato (vuoto = predefinito)
                  <input
                    type="text"
                    maxLength={120}
                    value={selectedItem.customTitle ?? ''}
                    onChange={(e) => patchItem({ customTitle: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-input-well)] px-2 py-1.5 text-sm text-[color:var(--hub-chrome-text)] outline-none placeholder:text-[color:var(--hub-chrome-placeholder)]"
                    placeholder={meta.label}
                  />
                </label>
                <label className="block text-xs text-[color:var(--hub-chrome-text-muted)]">
                  Sottotitolo / nota (vuoto = testo predefinito del modulo)
                  <input
                    type="text"
                    maxLength={200}
                    value={selectedItem.customSubtitle ?? ''}
                    onChange={(e) => patchItem({ customSubtitle: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-input-well)] px-2 py-1.5 text-sm text-[color:var(--hub-chrome-text)] outline-none placeholder:text-[color:var(--hub-chrome-placeholder)]"
                    placeholder="es. Apri modulo"
                  />
                </label>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-[color:var(--hub-chrome-text-muted)]">
                  Refresh automatico
                  <select
                    className="rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-input-well)] px-2 py-1.5 text-sm text-[color:var(--hub-chrome-text)] outline-none"
                    value={Number(selectedItem.refreshIntervalSec ?? 0)}
                    onChange={(e) => patchItem({ refreshIntervalSec: Number(e.target.value) })}
                  >
                    <option value={0}>Off</option>
                    <option value={30}>30 s</option>
                    <option value={60}>1 min</option>
                    <option value={120}>2 min</option>
                    <option value={300}>5 min</option>
                    <option value={600}>10 min</option>
                  </select>
                </label>
              </div>
              <p className="mb-2 text-[11px] text-[color:var(--hub-chrome-text-fainter)]">
                Il refresh aggiorna i conteggi ticket sulle card «Aperti / In lavorazione» e i dati del modulo «Contratti attivi»,
                riusando il polling già presente nell’app.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-[color:var(--hub-chrome-text-muted)]">
                  Larghezza
                  <select
                    className="rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-input-well)] px-2 py-1.5 text-sm text-[color:var(--hub-chrome-text)] outline-none disabled:opacity-45"
                    value={selectedItem.w}
                    disabled={dimDisabled}
                    onChange={(e) => {
                      const nw = Number(e.target.value);
                      const sid = selectedId;
                      setHubLayout((prev) => {
                        const cur = prev.find((x) => x.id === sid);
                        if (!cur) return prev;
                        return sanitizeLayoutItems(applyResize(prev, sid, nw, cur.h));
                      });
                    }}
                  >
                    {wChoices.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-[color:var(--hub-chrome-text-muted)]">
                  Altezza
                  <select
                    className="rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-input-well)] px-2 py-1.5 text-sm text-[color:var(--hub-chrome-text)] outline-none disabled:opacity-45"
                    value={selectedItem.h}
                    disabled={dimDisabled}
                    onChange={(e) => {
                      const nh = Number(e.target.value);
                      const sid = selectedId;
                      setHubLayout((prev) => {
                        const cur = prev.find((x) => x.id === sid);
                        if (!cur) return prev;
                        return sanitizeLayoutItems(applyResize(prev, sid, cur.w, nh));
                      });
                    }}
                  >
                    {hChoices.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    let next = setHidden(hubLayout, selectedId, !selectedItem.hidden);
                    setHubLayout(next);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--hub-chrome-border)] px-3 py-2 text-xs font-semibold text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)]"
                >
                  <EyeOff size={14} />
                  {selectedItem.hidden ? 'Mostra nella vista' : 'Nascondi vista (sfocato)'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`Rimuovere «${meta.label}» dall’hub? Potrai ripristinarlo dalla libreria.`)) return;
                    let next = removeModule(hubLayout, selectedId);
                    next = sanitizeLayoutItems(next);
                    setHubLayout(next);
                    setSelectedId(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/12 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/20"
                >
                  <Trash2 size={14} /> Rimuovi dalla griglia
                </button>
              </div>
              {fixedSize && (
                <p className="mt-2 text-[11px] text-[color:var(--hub-chrome-text-faint)]">Questo modulo ha dimensioni fisse.</p>
              )}
              {rbSel && !fixedSize && (
                <p className="mt-2 text-[11px] text-[color:var(--hub-chrome-text-faint)]">
                  Dimensioni consentite: larghezza {rbSel.minW}–{rbSel.maxW}, altezza {rbSel.minH}–{rbSel.maxH} (per il grafico KPI).
                </p>
              )}
              {selectedItem.iconOnly && (
                <p className="mt-2 text-[11px] text-[color:var(--hub-chrome-text-faint)]">In modalità solo icona la cella resta 1×1: disattiva per ridimensionare.</p>
              )}
            </div>
            );
          })()}
        </div>
      )}
    </>
  );
}
