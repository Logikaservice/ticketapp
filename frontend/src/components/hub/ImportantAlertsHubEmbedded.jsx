import React, { useEffect, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bell,
  FileText,
  Info,
  Plus,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { hexToRgba, hubEmbeddedRootInlineStyle, hubEmbeddedBackBtnInlineStyle, readableOnAccent } from '../../utils/techHubAccent';

/** Toni avviso allineati a `--hub-chrome-*` (leggibili sia Hub scuro sia «Chiaro»). */
export function hubAlertLevelChrome(level) {
  switch (level) {
    case 'danger':
      return {
        Icon: AlertTriangle,
        iconClassName: 'text-[color:var(--hub-chrome-tone-danger-icon)]',
        titleClassName: 'text-[color:var(--hub-chrome-tone-danger-title)]',
        bodyClassName: 'text-[color:var(--hub-chrome-tone-danger-body)]'
      };
    case 'info':
      return {
        Icon: Info,
        iconClassName: 'text-[color:var(--hub-chrome-tone-info-icon)]',
        titleClassName: 'text-[color:var(--hub-chrome-tone-info-title)]',
        bodyClassName: 'text-[color:var(--hub-chrome-tone-info-body)]'
      };
    case 'features':
      return {
        Icon: Sparkles,
        iconClassName: 'text-[color:var(--hub-chrome-tone-success-icon)]',
        titleClassName: 'text-[color:var(--hub-chrome-tone-success-title)]',
        bodyClassName: 'text-[color:var(--hub-chrome-tone-success-body)]'
      };
    case 'warning':
    default:
      return {
        Icon: AlertCircle,
        iconClassName: 'text-[color:var(--hub-chrome-tone-warn-icon)]',
        titleClassName: 'text-[color:var(--hub-chrome-tone-warn-title)]',
        bodyClassName: 'text-[color:var(--hub-chrome-tone-warn-body)]'
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
  onRefreshHubAlerts,
  onOpenManageAlerts = null,
  hubRefreshTick,
  hubRefreshView
}) {
  const rootStyle = useMemo(() => hubEmbeddedRootInlineStyle(accentHex), [accentHex]);

  const embeddedBackBtnStyle = useMemo(() => hubEmbeddedBackBtnInlineStyle(), []);

  const refreshBtnClass =
    'inline-flex items-center gap-2 rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] px-3 py-2 text-[13px] font-semibold text-[color:var(--hub-chrome-text-secondary)] transition hover:bg-[color:var(--hub-chrome-hover)] hover:[border-color:var(--hub-accent-border)]';

  const showManageAlertsBtn =
    currentUser?.ruolo === 'tecnico' && typeof onOpenManageAlerts === 'function';

  const refreshRef = useRef(onRefreshHubAlerts);
  useEffect(() => {
    refreshRef.current = onRefreshHubAlerts;
  }, [onRefreshHubAlerts]);

  useEffect(() => {
    if (hubRefreshTick == null) return;
    if (hubRefreshView !== 'avvisi') return;
    try {
      refreshRef.current?.();
    } catch {
      // ignore
    }
  }, [hubRefreshTick, hubRefreshView]);

  const createAlertsBtnStyle = useMemo(
    () => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 14px',
      borderRadius: 12,
      border: `1px solid ${hexToRgba(accentHex, 0.55)}`,
      backgroundColor: hexToRgba(accentHex, 0.22),
      color: readableOnAccent(accentHex),
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 700,
      flexShrink: 0
    }),
    [accentHex]
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[color:var(--hub-chrome-border-soft)] font-sans"
      style={rootStyle}
    >
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[color:var(--hub-chrome-border-soft)] px-4 py-3"
        style={{ backgroundColor: 'var(--hub-chrome-surface)' }}
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
              <h1 className="truncate text-lg font-bold text-[color:var(--hub-chrome-text)]">Avvisi importanti</h1>
              <p className="truncate text-xs text-[color:var(--hub-chrome-text-muted)]">
                Elenco completo (stesso feed della dashboard)
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {showManageAlertsBtn ? (
            <button
              type="button"
              style={createAlertsBtnStyle}
              onClick={() => onOpenManageAlerts()}
              aria-label="Crea un nuovo avviso importante"
              className="transition hover:brightness-110 active:brightness-95"
            >
              <Plus size={18} strokeWidth={2.4} aria-hidden />
              Crea avviso
            </button>
          ) : null}
          {typeof onRefreshHubAlerts === 'function' ? (
            <button type="button" className={refreshBtnClass} onClick={() => onRefreshHubAlerts()}>
              <RefreshCw size={16} aria-hidden />
              Aggiorna
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-5 md:px-5"
        style={{ backgroundColor: 'var(--hub-chrome-page)' }}
      >
        {loading ? (
          <div className="py-16 text-center text-sm text-[color:var(--hub-chrome-text-faint)]">Caricamento avvisi…</div>
        ) : !alerts?.length ? (
          <div className="py-16 text-center text-sm text-[color:var(--hub-chrome-text-faint)]">Nessun avviso presente.</div>
        ) : (
          <div role="list" className="space-y-4">
            {alerts.map((a) => {
              const meta = hubAlertLevelChrome(a.level);
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
                  className="rounded-xl border border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-row-fill)] p-4"
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
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-muted-fill)] px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--hub-chrome-text-secondary)] transition hover:bg-[color:var(--hub-chrome-hover)] hover:text-[color:var(--hub-accent)] hover:[border-color:var(--hub-accent-border)]"
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
