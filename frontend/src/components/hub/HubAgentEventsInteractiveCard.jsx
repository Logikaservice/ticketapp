import React, { useState, useMemo, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronDown, ChevronUp, Trash2, Wifi } from 'lucide-react';
import { hexToRgba } from '../../utils/techHubAccent';
import { useAgentMonitoringEvents, getAgentEventVisual, getAgentEventMessage } from '../../hooks/useAgentMonitoringEvents';

const SURFACE = '#1E1E1E';
const BUBBLE_SURFACE = '#1a1e24';
const POPOVER_Z_BACKDROP = 119;
const POPOVER_Z_PANEL = 120;

function computePopoverBox(anchorRect) {
  const margin = 10;
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 800;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 600;
  const width = Math.min(Math.max(anchorRect.width, 296), viewportW - margin * 2);
  let left = anchorRect.left + (anchorRect.width - width) / 2;
  left = Math.max(margin, Math.min(left, viewportW - width - margin));

  const preferredH = Math.min(440, viewportH - margin * 2);
  const spaceBelow = viewportH - anchorRect.bottom - margin;
  const spaceAbove = anchorRect.top - margin;
  /** Di default sotto la card; se non c’è spazio a sufficienza, si apre sopra. */
  const preferBelow = spaceBelow >= Math.min(200, preferredH * 0.4) || spaceBelow >= spaceAbove;

  let top;
  if (preferBelow) {
    top = anchorRect.bottom + margin;
  } else {
    top = Math.max(margin, anchorRect.top - preferredH - margin);
  }
  /** Altezza reale dopo clip al bordo viewport (scrollbar interno, griglia stabile). */
  let height = Math.min(preferredH, viewportH - margin - top);
  if (height < 120) {
    top = Math.max(margin, viewportH - margin - 140);
    height = Math.min(preferredH, viewportH - margin - top);
  }
  /** Freccetta verso card: sopra il fumetto se il pannello è sotto l’anchor, sotto il fumetto se è sopra. */
  const arrowAtTop = Boolean(preferBelow);
  return { top, left, width, height, arrowAtTop };
}

/**
 * Card panoramica Hub: fascia compatta fissa nella griglia. L’elenco eventi è in overlay tipo “fumetto”,
 * così le righe `auto` della griglia non si dilatano quando apri il pannello.
 */
export default function HubAgentEventsInteractiveCard({
  accentHex,
  getAuthHeader,
  socket,
  onOpenNetworkMonitoring,
  /** Con `light` la card segue `--hub-chrome-*` come il resto della panoramica Chiara. */
  hubSurfaceMode = 'dark',
  title = 'Notifiche agent',
  subtitle = 'Eventi rete sugli agent',
  subdued,
  suppressInteraction,
  /** Ruoli con accesso al monitoraggio rete (allineato a Hub: tecnico, admin, cliente multi-azienda). */
  technicianOnly = false
}) {
  const hubLight = hubSurfaceMode === 'light';
  const [expanded, setExpanded] = useState(false);
  const [popoverBox, setPopoverBox] = useState(null);

  const wrapRef = useRef(null);
  const popoverRef = useRef(null);

  const { events, unreadCount, markAsRead, clearAllNotifications, formatDate } = useAgentMonitoringEvents(
    technicianOnly ? getAuthHeader : null,
    technicianOnly ? socket : null
  );

  const accentSoft = useMemo(() => hexToRgba(accentHex, 0.14), [accentHex]);

  const closePopover = useCallback(() => setExpanded(false), []);

  const updatePopoverPosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el || !expanded) return;
    setPopoverBox(computePopoverBox(el.getBoundingClientRect()));
  }, [expanded]);

  useLayoutEffect(() => {
    if (!expanded) {
      setPopoverBox(null);
      return;
    }
    updatePopoverPosition();
    const win = typeof window !== 'undefined' ? window : null;
    if (!win) return;
    win.addEventListener('resize', updatePopoverPosition);
    win.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      win.removeEventListener('resize', updatePopoverPosition);
      win.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [expanded, events.length, updatePopoverPosition]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closePopover();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, closePopover]);

  /** Chiusura “click fuori”: il backdrop è solo grafico (`pointer-events-none`) così l’header resta cliccabile. */
  useEffect(() => {
    if (!expanded) return;
    const onDocMouseDown = (e) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (popoverRef.current?.contains(t)) return;
      if (wrapRef.current?.contains(t)) return;
      closePopover();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [expanded, closePopover]);

  if (!technicianOnly) {
    return (
      <div
        className={`flex h-full min-h-0 flex-col rounded-2xl border p-4 ${
          hubLight ? 'border-[color:var(--hub-chrome-border-soft)]' : 'border-white/[0.08]'
        } ${subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''} ${suppressInteraction ? 'pointer-events-none' : ''}`}
        style={{
          backgroundColor: hubLight ? 'var(--hub-chrome-surface)' : SURFACE,
          boxShadow: 'var(--hub-chrome-card-shadow)'
        }}
        role="status"
      >
        <div className="flex items-center gap-3">
          <div
            className={`rounded-xl p-2.5 ${hubLight ? 'bg-[color:var(--hub-chrome-muted-fill)] text-[color:var(--hub-chrome-text-fainter)]' : 'bg-white/[0.06] text-white/35'}`}
          >
            <Wifi size={22} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className={`text-sm font-semibold ${hubLight ? 'text-[color:var(--hub-chrome-text-secondary)]' : 'text-white/70'}`}>
              {title}
            </h3>
            <p className={`mt-0.5 text-xs ${hubLight ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-white/38'}`}>
              Serve un account con accesso al monitoraggio rete (tecnico, admin o aziende abilitate).
            </p>
          </div>
        </div>
      </div>
    );
  }

  const veil = subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : '';
  const blocked = suppressInteraction;

  const toggleExpanded = () => {
    if (blocked) return;
    setExpanded((e) => !e);
  };

  const handleClearClick = async (e) => {
    e.stopPropagation();
    if (blocked || events.length === 0) return;
    await clearAllNotifications();
  };

  const popoverMounted = expanded && !blocked && popoverBox != null && typeof document !== 'undefined';

  return (
    <>
      <div
        ref={wrapRef}
        className={`relative flex h-full max-h-full min-h-0 flex-col overflow-hidden rounded-2xl border ${hubLight ? 'border-[color:var(--hub-chrome-border-soft)]' : 'border-white/[0.08]'} ${veil} ${blocked ? 'pointer-events-none' : ''}`}
        style={{
          backgroundColor: hubLight ? 'var(--hub-chrome-surface)' : SURFACE,
          boxShadow: 'var(--hub-chrome-card-shadow)'
        }}
      >
        <button
          type="button"
          onClick={toggleExpanded}
          disabled={blocked}
          className={`flex h-full max-h-full min-h-0 w-full shrink-0 flex-col justify-center gap-0 p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--hub-accent)] disabled:pointer-events-none ${hubLight ? 'hover:bg-[color:var(--hub-chrome-hover)]' : 'hover:bg-white/[0.04]'}`}
          aria-expanded={expanded}
          aria-haspopup="dialog"
        >
          <div className="flex min-h-0 w-full shrink-0 items-center gap-3">
            <div className="relative inline-flex shrink-0 rounded-xl p-2.5" style={{ backgroundColor: accentSoft }}>
              <AlertTriangle
                size={24}
                className={
                  unreadCount > 0
                    ? hubLight
                      ? 'text-[color:var(--hub-chrome-tone-warn-icon)]'
                      : 'text-amber-400'
                    : hubLight
                      ? 'text-[color:var(--hub-chrome-text-fainter)]'
                      : 'text-white/45'
                }
                strokeWidth={2}
                aria-hidden
              />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="flex items-center gap-2">
                <span className={`text-base font-semibold ${hubLight ? 'text-[color:var(--hub-chrome-text)]' : 'text-white/90'}`}>
                  {title}
                </span>
                {expanded ? (
                  <ChevronUp
                    size={18}
                    className={`shrink-0 ${hubLight ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-white/45'}`}
                    aria-hidden
                  />
                ) : (
                  <ChevronDown
                    size={18}
                    className={`shrink-0 ${hubLight ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-white/45'}`}
                    aria-hidden
                  />
                )}
              </div>
              <p className={`mt-1 text-xs ${hubLight ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-white/45'}`}>
                {expanded ? 'Lista in overlay: clic fuori o Esc per chiudere' : `${subtitle} · clic per aprire`}
              </p>
            </div>
          </div>
        </button>
      </div>

      {popoverMounted
        ? createPortal(
            <>
              <div
                aria-hidden
                className="pointer-events-none fixed inset-0 animate-in fade-in"
                style={{
                  zIndex: POPOVER_Z_BACKDROP,
                  background: hubLight ? 'rgba(15,23,42,0.15)' : 'rgba(0,0,0,0.38)'
                }}
              />
              <div
                ref={popoverRef}
                role="dialog"
                aria-label={title}
                className={`custom-scrollbar flex animate-in fade-in zoom-in-95 flex-col overflow-hidden rounded-2xl border border-[color:var(--hub-accent-border)] outline-none duration-150 ${
                  hubLight ? 'shadow-[0_16px_48px_rgba(15,23,42,0.12)]' : 'shadow-[0_16px_48px_rgba(0,0,0,0.55)]'
                }`}
                style={{
                  position: 'fixed',
                  top: popoverBox.top,
                  left: popoverBox.left,
                  width: popoverBox.width,
                  height: popoverBox.height,
                  maxHeight: popoverBox.height,
                  zIndex: POPOVER_Z_PANEL,
                  backgroundColor: hubLight ? 'var(--hub-chrome-surface)' : BUBBLE_SURFACE,
                  boxShadow: hubLight
                    ? '0 0 0 1px var(--hub-chrome-border-soft), 0 20px 44px rgba(15,23,42,0.08)'
                    : '0 0 0 1px rgba(255,255,255,0.06), 0 20px 50px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)'
                }}
              >
                  {popoverBox.arrowAtTop ? (
                    <div className="pointer-events-none absolute -top-px left-1/2 z-[1] -translate-x-1/2 translate-y-[1px]" aria-hidden>
                      <div className="h-0 w-0 border-x-[10px] border-b-[11px] border-x-transparent border-b-[color:var(--hub-accent-border)]" />
                    </div>
                  ) : (
                    <div className="pointer-events-none absolute -bottom-px left-1/2 z-[1] -translate-x-1/2 -translate-y-[1px]" aria-hidden>
                      <div className="h-0 w-0 border-x-[10px] border-t-[11px] border-x-transparent border-t-[color:var(--hub-accent-border)]" />
                    </div>
                  )}
                  <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl pt-px">
                  <div
                    className={`flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2 pl-4 ${
                      hubLight ? 'border-[color:var(--hub-chrome-border-soft)]' : 'border-white/[0.08]'
                    }`}
                  >
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wide ${
                        hubLight ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-white/42'
                      }`}
                    >
                      Elenco eventi
                    </span>
                    <button
                      type="button"
                      onClick={handleClearClick}
                      disabled={events.length === 0}
                      title="Pulisci tutte le notifiche"
                      className={`inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${
                        hubLight
                          ? 'text-[color:var(--hub-chrome-tone-danger-title)] hover:bg-[color:var(--hub-chrome-notice-danger-bg)]'
                          : 'text-red-300 hover:bg-red-500/15'
                      }`}
                    >
                      <Trash2 size={14} aria-hidden />
                      Svuota
                    </button>
                  </div>
                  <div
                    className={`custom-scrollbar flex min-h-0 flex-1 flex-col divide-y overflow-y-auto overscroll-contain px-2 pb-2 ${
                      hubLight ? 'divide-[color:var(--hub-chrome-border-soft)]' : 'divide-white/[0.08]'
                    }`}
                  >
                    {events.length === 0 ? (
                      <p
                        className={`py-10 text-center text-xs ${hubLight ? 'text-[color:var(--hub-chrome-text-faint)]' : 'text-white/40'}`}
                      >
                        Nessun evento recente.
                      </p>
                    ) : (
                      events.map((event) => {
                        const { icon: Icon, color, bg } = getAgentEventVisual(event.event_type);
                        const isUnread = !event.is_read;

                        return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!event.is_read) markAsRead(event.id);
                              onOpenNetworkMonitoring?.();
                            }}
                            className={`flex w-full items-start gap-2 rounded-xl px-2 py-3 text-left transition ${
                              hubLight
                                ? `hover:bg-[color:var(--hub-chrome-hover)] ${isUnread ? 'bg-[color:var(--hub-chrome-row-nested-bg)]' : ''}`
                                : `hover:bg-white/[0.06] ${isUnread ? 'bg-sky-500/10' : ''}`
                            }`}
                          >
                            <div className={`shrink-0 rounded-lg p-2 ${hubLight ? bg : hubToneEventBg(bg)}`}>
                              <Icon size={16} className={hubLight ? color : hubToneIconColor(color)} aria-hidden />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-[13px] leading-snug ${
                                  hubLight
                                    ? isUnread
                                      ? 'font-semibold text-[color:var(--hub-chrome-text)]'
                                      : 'font-medium text-[color:var(--hub-chrome-text-secondary)]'
                                    : isUnread
                                      ? 'font-semibold text-white/92'
                                      : 'font-medium text-white/80'
                                }`}
                              >
                                {getAgentEventMessage(event)}
                              </p>
                              <p
                                className={`mt-1 text-[11px] ${hubLight ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-white/42'}`}
                              >
                                {formatDate(event.detected_at)}
                                {event.azienda ? ` • ${event.azienda}` : ''}
                              </p>
                            </div>
                            {isUnread ? (
                              <span
                                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${hubLight ? 'bg-[color:var(--hub-chrome-link)]' : 'bg-sky-400'}`}
                                aria-hidden
                              />
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                  </div>
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}

/** Adatta classi tema chiaro del backend a contrasto su sfondo scuro. */
function hubToneEventBg(lightBgClass) {
  if (lightBgClass.includes('red')) return 'bg-red-500/20';
  if (lightBgClass.includes('green')) return 'bg-emerald-500/20';
  if (lightBgClass.includes('blue')) return 'bg-blue-500/20';
  if (lightBgClass.includes('yellow')) return 'bg-amber-500/20';
  return 'bg-white/10';
}

function hubToneIconColor(lightTxtClass) {
  if (lightTxtClass.includes('red')) return 'text-red-400';
  if (lightTxtClass.includes('green')) return 'text-emerald-400';
  if (lightTxtClass.includes('blue')) return 'text-sky-400';
  if (lightTxtClass.includes('yellow')) return 'text-amber-300';
  return 'text-white/55';
}
