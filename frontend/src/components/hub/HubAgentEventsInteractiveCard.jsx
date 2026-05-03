import React, { useState, useMemo } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Trash2, Wifi } from 'lucide-react';
import { hexToRgba } from '../../utils/techHubAccent';
import { useAgentMonitoringEvents, getAgentEventVisual, getAgentEventMessage } from '../../hooks/useAgentMonitoringEvents';

const SURFACE = '#1E1E1E';

/**
 * Card panoramica Hub: icona alert come nel header · badge non letti · click espande lista eventi agent.
 * Toolbar in espansione: svuota (come triangolo) + chiudi lista.
 */
export default function HubAgentEventsInteractiveCard({
  accentHex,
  getAuthHeader,
  socket,
  onOpenNetworkMonitoring,
  title = 'Notifiche agent',
  subtitle = 'Eventi rete sugli agent',
  subdued,
  suppressInteraction,
  /** Ruoli con accesso al monitoraggio rete (allineato a Hub: tecnico, admin, cliente multi-azienda). */
  technicianOnly = false
}) {
  const [expanded, setExpanded] = useState(false);
  const { events, unreadCount, markAsRead, clearAllNotifications, formatDate } = useAgentMonitoringEvents(
    technicianOnly ? getAuthHeader : null,
    technicianOnly ? socket : null
  );

  const accentSoft = useMemo(() => hexToRgba(accentHex, 0.14), [accentHex]);

  if (!technicianOnly) {
    return (
      <div
        className={`flex h-full min-h-0 flex-col rounded-2xl border border-white/[0.08] p-4 ${subdued ? 'opacity-[0.28] saturate-50 blur-[2px]' : ''} ${suppressInteraction ? 'pointer-events-none' : ''}`}
        style={{ backgroundColor: SURFACE }}
        role="status"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/[0.06] p-2.5 text-white/35">
            <Wifi size={22} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white/70">{title}</h3>
            <p className="mt-0.5 text-xs text-white/38">
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

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] ${veil} ${blocked ? 'pointer-events-none' : ''}`}
      style={{ backgroundColor: SURFACE }}
    >
      {/* Riga pulsante sopra quando espansa: cancella */}
      {expanded && !blocked ? (
        <div className="flex shrink-0 items-center justify-end gap-2 border-b border-white/[0.08] px-3 py-2">
          <button
            type="button"
            onClick={handleClearClick}
            disabled={events.length === 0}
            title="Pulisci tutte le notifiche"
            className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-[11px] font-medium text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Trash2 size={14} aria-hidden />
            Svuota
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={toggleExpanded}
        disabled={blocked}
        className="flex w-full shrink-0 items-center gap-3 p-4 text-left transition hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--hub-accent)] disabled:pointer-events-none"
        aria-expanded={expanded}
      >
        <div className="relative inline-flex shrink-0 rounded-xl p-2.5" style={{ backgroundColor: accentSoft }}>
          <AlertTriangle
            size={24}
            className={unreadCount > 0 ? 'text-amber-400' : 'text-white/45'}
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
            <span className="text-base font-semibold text-white/90">{title}</span>
            {expanded ? (
              <ChevronUp size={18} className="shrink-0 text-white/45" aria-hidden />
            ) : (
              <ChevronDown size={18} className="shrink-0 text-white/45" aria-hidden />
            )}
          </div>
          <p className="mt-1 text-xs text-white/45">{expanded ? 'Clicca per chiudere l’elenco' : subtitle}</p>
        </div>
      </button>

      {expanded ? (
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col divide-y divide-white/[0.08] overflow-y-auto border-t border-white/[0.08] px-2 pb-2">
          {events.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/40">Nessun evento recente.</p>
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
                  className={`flex w-full items-start gap-2 rounded-xl px-2 py-3 text-left transition hover:bg-white/[0.06] ${isUnread ? 'bg-sky-500/10' : ''}`}
                >
                  <div className={`shrink-0 rounded-lg p-2 ${hubToneEventBg(bg)}`}>
                    <Icon size={16} className={hubToneIconColor(color)} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] leading-snug ${isUnread ? 'font-semibold text-white/92' : 'font-medium text-white/80'}`}>
                      {getAgentEventMessage(event)}
                    </p>
                    <p className="mt-1 text-[11px] text-white/42">
                      {formatDate(event.detected_at)}
                      {event.azienda ? ` • ${event.azienda}` : ''}
                    </p>
                  </div>
                  {isUnread ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-400" aria-hidden /> : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
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
