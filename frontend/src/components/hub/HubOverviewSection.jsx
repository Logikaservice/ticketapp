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
  LayoutGrid,
  Monitor,
  Gauge,
  Lock
} from 'lucide-react';
import { hexToRgba } from '../../utils/techHubAccent';
import HubContractsActiveCard from './HubContractsActiveCard';
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

const SURFACE_LOCAL = '#1E1E1E';

const HUB_REFRESH_TICKET_STAT_IDS = new Set(['stat-aperto', 'stat-lavorazione']);

function ModuleLaunchCard({
  icon: Icon,
  label,
  subtitle,
  accent,
  onClick,
  className = '',
  subdued = false,
  suppressInteraction = false,
  iconOnly = false
}) {
  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`flex h-full min-h-[4.5rem] w-full flex-col items-center justify-center rounded-2xl border border-white/[0.08] p-3 text-white/90 transition hover:bg-white/[0.04] hover:[border-color:var(--hub-accent-border)] hover:shadow-[0_0_0_1px_var(--hub-accent-glow)] ${className} ${subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''} ${suppressInteraction ? 'pointer-events-none' : ''}`}
        style={{ backgroundColor: SURFACE_LOCAL }}
      >
        <div className="inline-flex rounded-xl p-2.5" style={{ backgroundColor: hexToRgba(accent, 0.14) }}>
          <Icon size={26} style={{ color: accent }} aria-hidden />
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-full min-h-[6rem] w-full items-center rounded-2xl border border-white/[0.08] p-4 text-left transition hover:bg-white/[0.04] hover:[border-color:var(--hub-accent-border)] hover:shadow-[0_0_0_1px_var(--hub-accent-glow)] ${className} ${subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''} ${suppressInteraction ? 'pointer-events-none' : ''}`}
      style={{ backgroundColor: SURFACE_LOCAL }}
    >
      <div className="flex w-full min-w-0 items-center gap-3">
        <div
          className="inline-flex shrink-0 self-center rounded-xl p-2.5"
          style={{ backgroundColor: hexToRgba(accent, 0.12) }}
        >
          <Icon size={22} style={{ color: accent }} className="shrink-0" />
        </div>
        <div className="min-w-0 flex-1 self-center leading-tight">
          <div className="text-base font-semibold text-white/90">{label}</div>
          {subtitle ? <div className="mt-1 text-xs text-white/45">{subtitle}</div> : null}
        </div>
      </div>
    </button>
  );
}

/** Allineata visivamente a ModuleLaunchCard: stesso titolo/sottotitolo e struttura riga. */
function TicketHubStatCard({
  icon: Icon,
  title,
  count,
  accentHex,
  stateKey,
  onOpenTicketState,
  subdued,
  suppressInteraction = false,
  iconOnly = false
}) {
  const active = count > 0;

  const body = iconOnly ? (
    <div className="flex h-full flex-col items-center justify-center gap-1 py-2">
      <div
        className={`inline-flex rounded-xl p-2.5 ${active ? '' : 'bg-white/[0.06]'}`}
        style={active ? { backgroundColor: hexToRgba(accentHex, 0.12) } : undefined}
      >
        <Icon
          size={26}
          className="shrink-0"
          style={{ color: active ? accentHex : 'rgba(255,255,255,0.38)' }}
          aria-hidden
        />
      </div>
      <span
        className={`tabular-nums text-base font-semibold ${active ? 'text-white/90' : 'text-white/[0.28]'}`}
        style={active ? { color: accentHex } : undefined}
        aria-live="polite"
      >
        {count}
      </span>
    </div>
  ) : (
    <div className="flex w-full min-w-0 items-center gap-3">
      <div
        className={`inline-flex shrink-0 self-center rounded-xl p-2.5 transition ${active ? '' : 'bg-white/[0.06]'}`}
        style={active ? { backgroundColor: hexToRgba(accentHex, 0.12) } : undefined}
      >
        <Icon
          size={22}
          className="shrink-0"
          style={{ color: active ? accentHex : 'rgba(255,255,255,0.38)' }}
        />
      </div>
      <div className="min-w-0 flex-1 self-center leading-tight">
        <div className="text-base font-semibold text-white/90">{title}</div>
        <div className="mt-1 text-xs font-normal text-white/45 tabular-nums">Nell&apos;elenco: {count}</div>
      </div>
    </div>
  );

  const surfaceStyle = { backgroundColor: SURFACE_LOCAL };
  const veil = subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : '';
  const noPtr = suppressInteraction ? 'pointer-events-none' : '';
  const fullRow =
    'flex h-full min-h-[6rem] w-full items-center rounded-2xl border border-white/[0.08] p-4 text-left';

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
      className={`${fullRow} transition hover:bg-white/[0.04] hover:[border-color:var(--hub-accent-border)] hover:shadow-[0_0_0_1px_var(--hub-accent-glow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--hub-accent)] ${
        iconOnly ? 'justify-center' : ''
      } ${veil} ${noPtr}`}
      style={surfaceStyle}
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
          boxShadow: `0 0 0 1px ${hexToRgba(accentHex, 0.12)} inset`
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
      className={`flex h-full min-h-[6rem] w-full items-center gap-3 rounded-2xl border p-4 text-left transition hover:brightness-110 active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''} ${suppressInteraction ? 'pointer-events-none' : ''}`}
      style={{
        backgroundColor: hexToRgba(accentHex, 0.24),
        borderColor: hexToRgba(accentHex, 0.55),
        boxShadow: `0 0 0 1px ${hexToRgba(accentHex, 0.12)} inset`
      }}
      aria-label={aria}
    >
      <div
        className="inline-flex shrink-0 self-center rounded-xl p-2.5"
        style={{ backgroundColor: hexToRgba(accentHex, 0.35), color: '#121212' }}
      >
        <Plus size={24} strokeWidth={2.4} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 self-center leading-tight">
        <div className="text-base font-semibold text-white/90">{title}</div>
        {subtitle ? <div className="mt-1 text-xs font-normal text-white/45">{subtitle}</div> : null}
      </div>
    </button>
  );
}

/** Griglia panoramica con modifica layout (solo controlli esterni attivati dal parent per ruolo tecnico). */
export default function HubOverviewSection({
  accentHex,
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
  currentUser
}) {
  const gridRef = useRef(null);
  const dragIdRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!hubLayoutEditMode) setSelectedId(null);
  }, [hubLayoutEditMode]);

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

    if (droppedOnId && droppedOnId !== dragId) {
      setHubLayout((prev) => sanitizeLayoutItems(swapGridPositions(prev, dragId, droppedOnId)));
    } else {
      setHubLayout((prev) => {
        const grid = gridRef.current;
        const { col, row: rowFromSnap } = snapDropToCell(e.clientX, e.clientY, grid, prev);
        const anchored = inferDropRowFromAnchor(e.clientY, grid, prev, dragId, col);
        const sensibleMaxRow = Math.max(maxRowUsed(prev) + 6, 12);
        const rawRow = anchored.row != null ? anchored.row : rowFromSnap;
        const row = Math.min(sensibleMaxRow, Math.max(1, rawRow));
        const next = applyPlacement(prev, dragId, col, row);
        return sanitizeLayoutItems(next);
      });
    }
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

  function txt(item, fallback) {
    const t = item.customTitle?.trim();
    return t || fallback;
  }

  function sub(item, fallback) {
    const t = item.customSubtitle?.trim();
    return t || fallback;
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
            count={hubTicketCounts.aperto}
            accentHex={accentHex}
            stateKey="aperto"
            onOpenTicketState={onOpenTicketState}
            subdued={veil}
            suppressInteraction={suppressInteraction}
            iconOnly={io}
          />
        );
      case 'stat-lavorazione':
        return (
          <TicketHubStatCard
            icon={PlayCircle}
            title={txt(item, 'In lavorazione')}
            count={hubTicketCounts.in_lavorazione}
            accentHex={accentHex}
            stateKey="in_lavorazione"
            onOpenTicketState={onOpenTicketState}
            subdued={veil}
            suppressInteraction={suppressInteraction}
            iconOnly={io}
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
              backgroundColor={SURFACE_LOCAL}
              accentHex={accentHex}
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
              className={`flex h-full min-h-[4.5rem] items-center justify-center rounded-2xl border border-white/[0.08] p-3 text-white/85 ${
                veil ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''
              } ${suppressInteraction ? 'pointer-events-none' : ''}`}
              style={{ backgroundColor: SURFACE_LOCAL }}
              role="img"
              aria-label={txt(item, HUB_MODULE_META[id].label)}
            >
              <div className="inline-flex shrink-0 rounded-xl bg-white/[0.08] p-2.5">
                <Layers size={26} className="shrink-0 text-white/55" aria-hidden />
              </div>
            </div>
          );
        }
        return (
          <div
            className={`flex h-full min-h-[6rem] items-center gap-3 rounded-2xl border border-white/[0.08] p-4 ${
              veil ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''
            } ${suppressInteraction ? 'pointer-events-none' : ''}`}
            style={{ backgroundColor: SURFACE_LOCAL }}
          >
            <div className="inline-flex shrink-0 self-center rounded-xl bg-white/[0.08] p-2.5">
              <Layers size={22} className="shrink-0 text-white/55" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <h3 className="text-base font-semibold text-white">{txt(item, 'Riepilogo rapido')}</h3>
              <p className="mt-1 text-xs leading-relaxed text-white/45">{sub(item, 'Qui potrai inserire KPI o testo che riassume ticket, agent o avvisi.')}</p>
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
      case 'slot-1':
      case 'slot-2':
        if (io) {
          return (
            <div
              className={`flex h-full min-h-[4.5rem] items-center justify-center rounded-2xl border border-dashed border-white/[0.12] p-3 transition hover:[border-color:var(--hub-accent-border)] ${
                veil ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''
              } ${suppressInteraction ? 'pointer-events-none' : ''}`}
              style={{ backgroundColor: 'rgba(30,30,30,0.55)' }}
              aria-label={txt(item, HUB_MODULE_META[id].label)}
              role="img"
            >
              <div className="inline-flex rounded-xl bg-white/[0.06] p-2.5">
                <LayoutGrid size={26} className="shrink-0 text-white/45" aria-hidden />
              </div>
            </div>
          );
        }
        return (
          <div
            className={`flex h-full min-h-[7rem] items-center gap-3 rounded-2xl border border-dashed border-white/[0.12] p-4 transition hover:[border-color:var(--hub-accent-border)] ${
              veil ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''
            } ${suppressInteraction ? 'pointer-events-none' : ''}`}
            style={{ backgroundColor: 'rgba(30,30,30,0.55)' }}
          >
            <div className="inline-flex shrink-0 self-center rounded-xl bg-white/[0.06] p-2.5">
              <LayoutGrid size={22} className="shrink-0 text-white/45" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-base font-semibold text-white/88">{txt(item, HUB_MODULE_META[id].label)}</p>
              <p className="mt-1 text-xs text-white/35">{sub(item, 'Può diventare tabella avvisi interni, grafico o feed.')}</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <>
      {!hubLayoutEditMode && (
        <p className="mb-3 text-xs text-white/40">
          Area modulare: disponi le card dopo aver attivato «Modifica layout» nella barra in alto (tecnico). Le card «nascoste»
          dalla vista restano visibili in hub come anteprima sfocata.
        </p>
      )}
      <div className={`relative rounded-2xl ${hubLayoutEditMode && isTechnician ? 'ring-2 ring-dashed ring-[color:var(--hub-accent-border)] ring-offset-2 ring-offset-[#121212]' : ''}`}>
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
              className={`relative min-h-0 outline-none transition-shadow ${
                hubLayoutEditMode && selectedId === item.id ? 'z-10 shadow-[0_0_0_2px_var(--hub-accent)]' : ''
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
                  className={`absolute left-2 top-2 z-20 rounded-lg border border-white/15 bg-black/55 p-1 text-white/70 ${
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
                  className="pointer-events-none absolute right-2 top-2 z-20 rounded-md border border-amber-500/35 bg-black/70 p-1 text-amber-200/95"
                  title="Bloccata"
                >
                  <Lock size={14} aria-hidden />
                </div>
              )}
              {item.hidden && (
                <div className="pointer-events-none absolute inset-0 z-[5] rounded-2xl bg-black/45 backdrop-blur-[3px]" />
              )}
              {item.hidden && (
                <div className="pointer-events-none absolute bottom-2 right-2 z-20 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/85">
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
          className="mt-4 space-y-3 rounded-2xl border border-white/[0.08] p-4"
          style={{ backgroundColor: SURFACE_LOCAL }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/42">
              <Layers size={14} /> Libreria · ripristino
            </div>
            <button
              type="button"
              onClick={restoreFullHubLayout}
              className="ml-auto inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-transparent px-3 py-2 text-[11px] font-medium text-white/50 underline-offset-2 hover:bg-white/[0.04] hover:text-white/70"
              title="Reinserisce tutti i moduli come all’avvio del progetto"
            >
              <RotateCcw size={14} className="opacity-70" /> Ripristina tutta la panoramica
            </button>
          </div>
          {missing.length === 0 ? (
            <p className="text-xs text-white/38">Tutti i moduli disponibili sono già in griglia. Puoi rimuovere un modulo per tenerlo qui.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {missing.map((mid) => (
                <button
                  key={mid}
                  type="button"
                  onClick={() => {
                    let next = restoreDefaultModule(hubLayout, mid);
                    next = sanitizeLayoutItems(next);
                    setHubLayout(next);
                  }}
                  className="rounded-xl border border-white/[0.12] bg-black/22 px-3 py-2 text-xs font-medium text-white/85 transition hover:bg-white/[0.06] hover:[border-color:var(--hub-accent-border)]"
                >
                  Aggiungi {HUB_MODULE_META[mid].label}
                </button>
              ))}
            </div>
          )}

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
            <div className="border-t border-white/[0.08] pt-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-white/75">
                  Card selezionata: <span className="text-[color:var(--hub-accent)]">{meta.label}</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const sid = selectedId;
                    setHubLayout((prev) => restoreSingleCardDefaults(prev, sid));
                  }}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.12] bg-black/25 px-3 py-2 text-xs font-semibold text-white/88 hover:bg-white/[0.06]"
                  title="Riposiziona e ridimensiona come da progetto e azzera titolo, sottotitolo e opzioni"
                >
                  <RotateCcw size={14} /> Layout predefinito
                </button>
              </div>
              <p className="mb-3 text-[11px] text-white/38">
                Vale solo per questa card: non reintegra moduli tolti dalla griglia e non cambia le altre posizioni, salvo sistemare
                sovrapposizioni se servono.
              </p>
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/70">
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-white/25 bg-black/40"
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
                    className="rounded border-white/25 bg-black/40"
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
                <label className="block text-xs text-white/55">
                  Titolo mostrato (vuoto = predefinito)
                  <input
                    type="text"
                    maxLength={120}
                    value={selectedItem.customTitle ?? ''}
                    onChange={(e) => patchItem({ customTitle: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/[0.12] bg-black/35 px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/25"
                    placeholder={meta.label}
                  />
                </label>
                <label className="block text-xs text-white/55">
                  Sottotitolo / nota (vuoto = testo predefinito del modulo)
                  <input
                    type="text"
                    maxLength={200}
                    value={selectedItem.customSubtitle ?? ''}
                    onChange={(e) => patchItem({ customSubtitle: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-white/[0.12] bg-black/35 px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/25"
                    placeholder="es. Apri modulo"
                  />
                </label>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-white/55">
                  Refresh automatico
                  <select
                    className="rounded-lg border border-white/[0.12] bg-black/35 px-2 py-1.5 text-sm text-white outline-none"
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
              <p className="mb-2 text-[11px] text-white/38">
                Il refresh aggiorna i conteggi ticket sulle card «Aperti / In lavorazione» e i dati del modulo «Contratti attivi»,
                riusando il polling già presente nell’app.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-white/55">
                  Larghezza
                  <select
                    className="rounded-lg border border-white/[0.12] bg-black/35 px-2 py-1.5 text-sm text-white outline-none disabled:opacity-45"
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
                <label className="flex items-center gap-2 text-xs text-white/55">
                  Altezza
                  <select
                    className="rounded-lg border border-white/[0.12] bg-black/35 px-2 py-1.5 text-sm text-white outline-none disabled:opacity-45"
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
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] px-3 py-2 text-xs font-semibold text-white/82 hover:bg-white/[0.05]"
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
                <p className="mt-2 text-[11px] text-white/40">Questo modulo ha dimensioni fisse.</p>
              )}
              {rbSel && !fixedSize && (
                <p className="mt-2 text-[11px] text-white/40">
                  Dimensioni consentite: larghezza {rbSel.minW}–{rbSel.maxW}, altezza {rbSel.minH}–{rbSel.maxH} (per il grafico KPI).
                </p>
              )}
              {selectedItem.iconOnly && (
                <p className="mt-2 text-[11px] text-white/40">In modalità solo icona la cella resta 1×1: disattiva per ridimensionare.</p>
              )}
            </div>
            );
          })()}
        </div>
      )}
    </>
  );
}
