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
  Layers
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
  snapDropToCell,
  sanitizeLayoutItems,
  saveHubLayout
} from '../../utils/hubOverviewLayout';

const SURFACE_LOCAL = '#1E1E1E';

function ModuleLaunchCard({
  icon: Icon,
  label,
  subtitle,
  accent,
  onClick,
  className = '',
  subdued = false,
  suppressInteraction = false
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-full min-h-[6rem] w-full rounded-2xl border border-white/[0.08] p-4 text-left transition hover:bg-white/[0.04] hover:[border-color:var(--hub-accent-border)] hover:shadow-[0_0_0_1px_var(--hub-accent-glow)] ${className} ${subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''} ${suppressInteraction ? 'pointer-events-none' : ''}`}
      style={{ backgroundColor: SURFACE_LOCAL }}
    >
      <div className="mb-3 inline-flex rounded-xl p-2.5" style={{ backgroundColor: hexToRgba(accent, 0.12) }}>
        <Icon size={22} style={{ color: accent }} className="shrink-0" />
      </div>
      <div className="text-sm font-semibold text-white">{label}</div>
      {subtitle && <div className="mt-1 text-xs text-white/45">{subtitle}</div>}
    </button>
  );
}

/** Stessa stat della pagina tecnico Hub. */
function TicketHubStatCard({
  icon: Icon,
  title,
  count,
  accentHex,
  stateKey,
  onOpenTicketState,
  subdued,
  suppressInteraction = false
}) {
  const active = count > 0;
  const body = (
    <>
      <div className="mb-2 flex gap-3">
        <div
          className={`inline-flex shrink-0 rounded-xl p-2.5 transition ${active ? '' : 'bg-white/[0.06]'}`}
          style={active ? { backgroundColor: hexToRgba(accentHex, 0.14) } : undefined}
        >
          <Icon
            size={22}
            className="shrink-0"
            style={{ color: active ? accentHex : 'rgba(255,255,255,0.38)' }}
          />
        </div>
        <div className="min-w-0 flex-1 self-center leading-tight">
          <div
            className={`text-[11px] font-semibold uppercase tracking-widest ${active ? 'text-white/50' : 'text-white/32'}`}
          >
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

  const surfaceStyle = { backgroundColor: SURFACE_LOCAL };
  const veil = subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : '';
  const noPtr = suppressInteraction ? 'pointer-events-none' : '';

  if (!active) {
    return (
      <div className={`h-full rounded-2xl border border-white/[0.08] p-4 text-left ${veil} ${noPtr}`} style={surfaceStyle}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={Boolean(subdued)}
      className={`h-full rounded-2xl border border-white/[0.08] p-4 text-left transition hover:bg-white/[0.04] hover:[border-color:var(--hub-accent-border)] hover:shadow-[0_0_0_1px_var(--hub-accent-glow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--hub-accent)] ${veil} ${noPtr}`}
      style={surfaceStyle}
      onClick={() => !subdued && onOpenTicketState?.(stateKey)}
      aria-label={`${title}: ${count}. Apri elenco`}
    >
      {body}
    </button>
  );
}

function HubNewTicketCard({ accentHex, onOpenNewTicket, subdued, suppressInteraction }) {
  return (
    <button
      type="button"
      disabled={Boolean(subdued)}
      onClick={() => !subdued && onOpenNewTicket?.()}
      className={`flex min-h-[8.5rem] h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border p-5 text-center transition hover:brightness-110 active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 md:py-6 ${subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''} ${suppressInteraction ? 'pointer-events-none' : ''}`}
      style={{
        backgroundColor: hexToRgba(accentHex, 0.24),
        borderColor: hexToRgba(accentHex, 0.55),
        boxShadow: `0 0 0 1px ${hexToRgba(accentHex, 0.12)} inset`
      }}
      aria-label="Crea nuovo ticket"
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: hexToRgba(accentHex, 0.35),
          color: '#121212'
        }}
      >
        <Plus size={28} strokeWidth={2.4} aria-hidden />
      </span>
      <span className="text-base font-bold leading-tight text-white">+ nuovo ticket</span>
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

  const handleDragStart = (e, id) => {
    if (!hubLayoutEditMode || !isTechnician) return;
    dragIdRef.current = id;
    e.dataTransfer.setData('text/hub-module', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    if (!hubLayoutEditMode || !isTechnician) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e) => {
    if (!hubLayoutEditMode || !isTechnician) return;
    e.preventDefault();
    const id = e.dataTransfer.getData('text/hub-module') || dragIdRef.current;
    if (!id || !gridRef.current) return;
    const { col, row } = snapDropToCell(e.clientX, e.clientY, gridRef.current);
    let next = applyPlacement(hubLayout, id, col, row);
    next = sanitizeLayoutItems(next);
    dragIdRef.current = null;
    setHubLayout(next);
  };

  const restoreDefaults = () => {
    const d = getDefaultHubLayout();
    setHubLayout(sanitizeLayoutItems(d));
  };

  /** Vista normale: non mostrare nascoste */
  const visibleLayout = hubLayout.filter((x) => !x.hidden || hubLayoutEditMode);
  /** In modifica ordinamento: mostra comunque ghost order per stabilità */
  const sorted = [...visibleLayout].sort((a, b) => a.row - b.row || a.col - b.col);

  const meta = selectedId ? HUB_MODULE_META[selectedId] : null;
  const selectedItem = hubLayout.find((x) => x.id === selectedId);
  const fixedSize = meta?.fixedSize;

  function renderInner(item) {
    const id = item.id;
    const veil = Boolean(item.hidden) && hubLayoutEditMode;

    switch (id) {
      case 'new-ticket':
        return (
          <HubNewTicketCard
            accentHex={accentHex}
            onOpenNewTicket={onOpenNewTicket}
            subdued={veil}
            suppressInteraction={hubLayoutEditMode && isTechnician}
          />
        );
      case 'stat-aperto':
        return (
          <TicketHubStatCard
            icon={FileText}
            title="Aperti"
            count={hubTicketCounts.aperto}
            accentHex={accentHex}
            stateKey="aperto"
            onOpenTicketState={onOpenTicketState}
            subdued={veil}
            suppressInteraction={hubLayoutEditMode && isTechnician}
          />
        );
      case 'stat-lavorazione':
        return (
          <TicketHubStatCard
            icon={PlayCircle}
            title="In lavorazione"
            count={hubTicketCounts.in_lavorazione}
            accentHex={accentHex}
            stateKey="in_lavorazione"
            onOpenTicketState={onOpenTicketState}
            subdued={veil}
            suppressInteraction={hubLayoutEditMode && isTechnician}
          />
        );
      case 'launch-email':
        return (
          <ModuleLaunchCard
            icon={Mail}
            label="Email"
            subtitle="Apri modulo"
            accent={accentHex}
            onClick={() => setHubCenterView?.('email')}
            subdued={veil}
            suppressInteraction={hubLayoutEditMode && isTechnician}
          />
        );
      case 'launch-network':
        return (
          <ModuleLaunchCard
            icon={Wifi}
            label="Monitoraggio"
            subtitle="Stato rete"
            accent={accentHex}
            onClick={() => nav?.onOpenNetwork?.()}
            subdued={veil}
            suppressInteraction={hubLayoutEditMode && isTechnician}
          />
        );
      case 'launch-comms':
        return (
          <ModuleLaunchCard
            icon={Bell}
            label="Comunicazioni"
            subtitle="Messaggi broadcast"
            accent={accentHex}
            onClick={() => setHubCenterView?.('comunicazioni')}
            subdued={veil}
            suppressInteraction={hubLayoutEditMode && isTechnician}
          />
        );
      case 'launch-antivirus':
        return (
          <ModuleLaunchCard
            icon={Shield}
            label="Anti-Virus"
            subtitle="Sicurezza"
            accent={accentHex}
            onClick={() => nav?.onOpenAntiVirus?.()}
            subdued={veil}
            suppressInteraction={hubLayoutEditMode && isTechnician}
          />
        );
      case 'contracts':
        return (
          <div
            className={`relative h-full min-h-0 flex flex-col ${veil ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''} ${hubLayoutEditMode && isTechnician ? 'pointer-events-none' : ''}`}
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
        return (
          <div
            className={`h-full rounded-2xl border border-white/[0.08] p-4 ${veil ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''}`}
            style={{ backgroundColor: SURFACE_LOCAL }}
          >
            <h3 className="text-sm font-semibold text-white">Riepilogo rapido</h3>
            <p className="mt-2 text-xs leading-relaxed text-white/45">
              Qui potrai inserire KPI o testo che riassume ticket, agent o avvisi. Struttura pronta per contenuti
              dinamici.
            </p>
          </div>
        );
      case 'launch-mappatura':
        return (
          <ModuleLaunchCard
            icon={MapPin}
            label="Mappatura"
            subtitle="Topologia e dispositivi"
            accent={accentHex}
            onClick={() => nav?.onOpenMappatura?.()}
            subdued={veil}
            suppressInteraction={hubLayoutEditMode && isTechnician}
            className="min-h-0 flex-1"
          />
        );
      case 'slot-1':
      case 'slot-2':
        return (
          <div
            className={`flex h-full min-h-[7rem] flex-col rounded-2xl border border-dashed border-white/[0.12] p-4 transition hover:[border-color:var(--hub-accent-border)] ${
              veil ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''
            }`}
            style={{ backgroundColor: 'rgba(30,30,30,0.55)' }}
          >
            <p className="text-xs font-medium text-white/55">{HUB_MODULE_META[id].label}</p>
            <p className="mt-2 text-xs text-white/35">
              Può diventare tabella avvisi interni, grafico a barre o feed.
            </p>
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
          Area modulare: disponi le card dopo aver attivato «Modifica layout» nella barra in alto (tecnico).
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
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {sorted.map((item) => (
            <div
              key={item.id}
              role="presentation"
              className={`relative min-h-0 outline-none transition-shadow ${
                hubLayoutEditMode && selectedId === item.id ? 'z-10 shadow-[0_0_0_2px_var(--hub-accent)]' : ''
              }`}
              style={{
                gridColumn: `${item.col} / span ${item.w}`,
                gridRow: `${item.row} / span ${item.h}`
              }}
              onClick={(e) => {
                if (!hubLayoutEditMode || !isTechnician) return;
                e.stopPropagation();
                setSelectedId(item.id === selectedId ? null : item.id);
              }}
            >
              {hubLayoutEditMode && isTechnician && (
                <div
                  className="absolute left-2 top-2 z-20 cursor-grab rounded-lg border border-white/15 bg-black/55 p-1 text-white/70 active:cursor-grabbing"
                  title="Trascina per spostare"
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    handleDragStart(e, item.id);
                  }}
                >
                  <GripVertical size={16} />
                </div>
              )}
              {hubLayoutEditMode && item.hidden && (
                <div className="pointer-events-none absolute inset-0 z-[5] rounded-2xl bg-black/45 backdrop-blur-[3px]" />
              )}
              {hubLayoutEditMode && item.hidden && (
                <div className="absolute bottom-2 right-2 z-20 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/85">
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
              onClick={restoreDefaults}
              className="ml-auto inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-black/25 px-3 py-2 text-xs font-semibold text-white/88 hover:bg-white/[0.06]"
            >
              <RotateCcw size={14} /> Layout predefinito
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

          {selectedItem && meta && (
            <div className="border-t border-white/[0.08] pt-4">
              <p className="mb-3 text-xs font-semibold text-white/75">
                Card selezionata: <span className="text-[color:var(--hub-accent)]">{meta.label}</span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-white/55">
                  Larghez. (1–7)
                  <select
                    className="rounded-lg border border-white/[0.12] bg-black/35 px-2 py-1.5 text-sm text-white outline-none disabled:opacity-45"
                    value={selectedItem.w}
                    disabled={!!fixedSize}
                    onChange={(e) => {
                      const nw = Number(e.target.value);
                      let next = applyResize(hubLayout, selectedId, nw, selectedItem.h);
                      setHubLayout(sanitizeLayoutItems(next));
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-white/55">
                  Altezza (1–{HUB_MAX_ROW_SPAN})
                  <select
                    className="rounded-lg border border-white/[0.12] bg-black/35 px-2 py-1.5 text-sm text-white outline-none disabled:opacity-45"
                    value={selectedItem.h}
                    disabled={!!fixedSize}
                    onChange={(e) => {
                      const nh = Number(e.target.value);
                      let next = applyResize(hubLayout, selectedId, selectedItem.w, nh);
                      setHubLayout(sanitizeLayoutItems(next));
                    }}
                  >
                    {Array.from({ length: HUB_MAX_ROW_SPAN }, (_, i) => i + 1).map((n) => (
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
                <p className="mt-2 text-[11px] text-white/40">Contratti attivi ha dimensioni fisse per ospitare il grafico KPI.</p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
