import React, { useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bell,
  FileText,
  Info,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { HUB_PAGE_BG, HUB_SURFACE, hexToRgba } from '../../utils/techHubAccent';

function alertLevelMeta(level) {
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

/** Stesso criterio di `Dashboard.jsx` per il pulsante «Crea ticket». */
export function hubAlertAllowsCreateTicket(alert, currentUser) {
  const r = currentUser?.ruolo;
  if (!(r === 'cliente' || r === 'tecnico')) return false;
  if (alert?.isEmailExpiry) return true;
  return ['info', 'warning', 'danger'].includes(alert?.level);
}

export default function ImportantAlertsHubEmbedded({
  accentHex,
  alerts = [],
  loading = false,
  currentUser,
  onBack,
  onCreateTicketFromAlert,
  onRefreshHubAlerts
}) {
  const rootStyle = useMemo(
    () => ({
      backgroundColor: HUB_PAGE_BG,
      ['--hub-accent']: accentHex,
      ['--hub-accent-border']: hexToRgba(accentHex, 0.48)
    }),
    [accentHex]
  );

  const embeddedBackBtnStyle = useMemo(
    () => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(0,0,0,0.28)',
      color: 'rgba(255,255,255,0.82)',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      flexShrink: 0
    }),
    []
  );

  const refreshBtnClass =
    'inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-black/25 px-3 py-2 text-[13px] font-semibold text-white/80 transition hover:bg-white/[0.06] hover:[border-color:var(--hub-accent-border)]';

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] font-sans"
      style={rootStyle}
    >
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3"
        style={{ backgroundColor: HUB_SURFACE }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button type="button" onClick={() => onBack?.()} style={embeddedBackBtnStyle}>
            <ArrowLeft size={18} aria-hidden />
            Panoramica Hub
          </button>
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: hexToRgba(accentHex, 0.16), color: accentHex }}
            >
              <Bell size={18} aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-white">Avvisi importanti</h1>
              <p className="truncate text-xs text-white/55">Elenco completo (stesso feed della dashboard)</p>
            </div>
          </div>
        </div>
        {typeof onRefreshHubAlerts === 'function' ? (
          <button type="button" className={refreshBtnClass} onClick={() => onRefreshHubAlerts()}>
            <RefreshCw size={16} aria-hidden />
            Aggiorna
          </button>
        ) : null}
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-5 md:px-5"
        style={{ backgroundColor: HUB_PAGE_BG }}
      >
        {loading ? (
          <div className="py-16 text-center text-sm text-white/45">Caricamento avvisi…</div>
        ) : !alerts?.length ? (
          <div className="py-16 text-center text-sm text-white/45">Nessun avviso presente.</div>
        ) : (
          <div role="list" className="space-y-4">
            {alerts.map((a) => {
              const meta = alertLevelMeta(a.level);
              const Icon = meta.Icon;
              const title = (a.title && String(a.title).trim()) || '(Senza titolo)';
              const body = (a.body && String(a.body)) || '';
              const key = a.id != null ? `alert-${a.id}` : `${title}-${body.slice(0, 48)}`;
              const showTicket =
                onCreateTicketFromAlert && hubAlertAllowsCreateTicket(a, currentUser);

              return (
                <div
                  key={key}
                  role="listitem"
                  className="rounded-xl border border-white/[0.08] bg-black/20 p-4"
                >
                  <div className="flex gap-3">
                    <div className={`mt-0.5 shrink-0 ${meta.iconClassName}`} aria-hidden>
                      <Icon size={20} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1 select-text">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className={`text-sm font-semibold leading-snug ${meta.titleClassName}`}>{title}</p>
                        {showTicket ? (
                          <button
                            type="button"
                            onClick={() => onCreateTicketFromAlert(a)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.14] bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-white/88 transition hover:bg-white/[0.1] hover:text-[color:var(--hub-accent)] hover:[border-color:var(--hub-accent-border)]"
                          >
                            <FileText size={14} aria-hidden />
                            Crea ticket
                          </button>
                        ) : null}
                      </div>
                      {body ? (
                        <p
                          className={`mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed ${meta.bodyClassName}`}
                        >
                          {body}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
