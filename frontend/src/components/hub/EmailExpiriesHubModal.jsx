import React, { useMemo, useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail } from 'lucide-react';
import { HubModalScaffold, HubModalChromeHeader, HubModalBody } from '../Modals/HubModalChrome';
import { buildApiUrl } from '../../utils/apiConfig';
import { hubModalCssVars } from '../../utils/techHubAccent';

export default function EmailExpiriesHubModal({
  open,
  onClose,
  getAuthHeader,
  currentUser,
  accentHex,
  days = 30,
  prefetchedItems,
  prefetchedLoading = false,
  onRefresh,
  onOpenCompany
}) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  const canAccess = useMemo(() => {
    const role = currentUser?.ruolo;
    if (role === 'tecnico' || role === 'admin') return true;
    if (role === 'cliente' && Array.isArray(currentUser?.admin_companies) && currentUser.admin_companies.length > 0) return true;
    return false;
  }, [currentUser]);

  const fetchList = useCallback(async () => {
    if (!getAuthHeader || !canAccess) return;
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl(`/api/keepass/email-upcoming-expiries?days=${days}`), {
        headers: getAuthHeader(),
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('fetch');
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (_) {
      // Non azzerare: se il fetch fallisce, mantieni l'ultima lista nota.
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, canAccess, days]);

  useEffect(() => {
    if (!open) return;
    if (Array.isArray(prefetchedItems)) {
      setItems(prefetchedItems);
      return;
    }
    fetchList();
  }, [open, fetchList, prefetchedItems]);

  const count = Array.isArray(items) ? items.length : 0;

  const subtitle = prefetchedLoading || loading ? 'Caricamento…' : `${count} scadenze (entro ${days} giorni o già scadute).`;

  if (!open) return null;

  return createPortal(
    <HubModalScaffold
      onBackdropClick={onClose}
      maxWidthClass="max-w-3xl"
      zClass="z-[119]"
      panelClassName="max-h-[90vh] flex flex-col overflow-hidden"
    >
      <HubModalChromeHeader icon={Mail} title="Scadenze Email" subtitle={subtitle} onClose={onClose} compact />
      <HubModalBody className="flex min-h-0 flex-1 flex-col space-y-0 p-4">
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto" style={hubModalCssVars(accentHex)}>
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={async () => {
                if (prefetchedLoading || loading) return;
                await onRefresh?.();
                if (!onRefresh) fetchList();
              }}
              className="rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] px-3 py-2 text-xs font-semibold text-[color:var(--hub-chrome-text-secondary)] hover:bg-[color:var(--hub-chrome-hover)] disabled:opacity-45"
              disabled={prefetchedLoading || loading}
              title="Aggiorna scadenze"
            >
              Aggiorna
            </button>
          </div>
          {count === 0 ? (
            <div className="rounded-2xl border border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-surface)] p-4 text-sm text-[color:var(--hub-chrome-text-faint)]">
              Nessuna scadenza Email rilevata.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => {
                const daysLeft = typeof it?.daysLeft === 'number' ? it.daysLeft : null;
                const expired = typeof daysLeft === 'number' && daysLeft < 0;
                const soon = typeof daysLeft === 'number' && daysLeft >= 0 && daysLeft <= days;
                const chipCls =
                  expired || soon
                    ? 'bg-red-500/10 text-red-600 border-red-500/30'
                    : 'bg-slate-500/10 text-slate-600 border-slate-500/30';
                const chipText = expired ? 'Scaduta' : typeof daysLeft === 'number' ? `${daysLeft} gg` : '—';
                return (
                  <button
                    key={`${it?.aziendaName || ''}-${it?.username || it?.title || ''}-${idx}`}
                    type="button"
                    onClick={() => {
                      const aziendaName = String(it?.aziendaName || '');
                      if (!aziendaName) return;
                      onClose?.();
                      onOpenCompany?.(aziendaName);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-surface)] p-4 text-left hover:bg-[color:var(--hub-chrome-hover)]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[color:var(--hub-chrome-text)]">
                        {it?.aziendaName || 'Azienda'}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-[color:var(--hub-chrome-text-faint)]">
                        {it?.username || it?.title || 'Email'}
                        {it?.expires ? ` · scade ${new Date(it.expires).toLocaleDateString('it-IT')}` : ''}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${chipCls}`}>{chipText}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </HubModalBody>
    </HubModalScaffold>,
    document.body
  );
}

