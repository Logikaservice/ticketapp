import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, HardDrive, Monitor } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import { hexToRgba, normalizeHex } from '../../utils/techHubAccent';

const EV_REFRESH = 'hub-overview-dispositivi-refresh';

function safeParseDisks(disksJson) {
  if (!disksJson) return [];
  try {
    const arr = typeof disksJson === 'string' ? JSON.parse(disksJson) : disksJson;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function deviceDiskLevel(row) {
  const disks = safeParseDisks(row?.disks_json);
  let worst = 0; // 0 ok, 1 warn(yellow), 2 crit(red)
  for (const d of disks) {
    const total = Number(d?.total_gb);
    const free = Number(d?.free_gb);
    if (!Number.isFinite(total) || !Number.isFinite(free) || !(total > 0)) continue;
    const used = Math.max(0, total - free);
    const pct = (used / total) * 100;
    if (pct > 90) return 2;
    if (pct > 75) worst = Math.max(worst, 1);
  }
  return worst;
}

function shortCompanyLabel(name, max = 18) {
  const t = String(name || '').trim();
  if (!t) return '—';
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(8, max - 1))}…`;
}

/**
 * KPI Hub: riepilogo dispositivi per azienda (warning/critical disco).
 * Usa /api/comm-agent/device-info (tutte le aziende) e aggrega localmente.
 */
export default function HubDispositiviSpaceCard({
  accentHex,
  hubSurfaceMode = 'dark',
  getAuthHeader,
  currentUser,
  onOpenDispositivi
}) {
  const accent = useMemo(() => normalizeHex(accentHex) || accentHex || '#14b8a6', [accentHex]);
  const isTecnico = currentUser?.ruolo === 'tecnico' || currentUser?.ruolo === 'admin';
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [rows, setRows] = useState([]);
  const lastLoadAtRef = useRef(0);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!getAuthHeader || !isTecnico) {
        setRows([]);
        setErr(null);
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setErr(null);
      try {
        const res = await fetch(buildApiUrl('/api/comm-agent/device-info'), { headers: getAuthHeader() });
        if (!res.ok) throw new Error('fetch');
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        lastLoadAtRef.current = Date.now();
        setRows(list);
      } catch (_) {
        setErr('Errore caricamento dispositivi');
        if (!silent) setRows([]);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [getAuthHeader, isTecnico]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onUp = () => {
      // Evita burst ravvicinati (click ripetuti) — 600ms è sufficiente per UX.
      const dt = Date.now() - (lastLoadAtRef.current || 0);
      load({ silent: dt < 2500 });
    };
    window.addEventListener(EV_REFRESH, onUp);
    return () => window.removeEventListener(EV_REFRESH, onUp);
  }, [load]);

  const perCompany = useMemo(() => {
    /** @type {Record<string, { name: string, total: number, warn: number, crit: number }>} */
    const map = {};
    for (const r of rows) {
      const name = String(r?.azienda || r?.azienda_name || r?.company || '').trim();
      if (!name) continue;
      const k = name.toLowerCase();
      if (!map[k]) map[k] = { name, total: 0, warn: 0, crit: 0 };
      map[k].total += 1;
      const lvl = deviceDiskLevel(r);
      if (lvl === 2) map[k].crit += 1;
      else if (lvl === 1) map[k].warn += 1;
    }
    const list = Object.values(map);
    // prima chi ha problemi, poi per totale pc, poi alfabetico
    list.sort((a, b) => {
      const ap = a.crit + a.warn;
      const bp = b.crit + b.warn;
      if (bp !== ap) return bp - ap;
      if (b.crit !== a.crit) return b.crit - a.crit;
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [rows]);

  const top = perCompany.slice(0, 10);
  const totalCompanies = perCompany.length;
  const companiesWithIssues = perCompany.filter((x) => x.crit + x.warn > 0).length;

  const chromeText = hubSurfaceMode === 'light' ? 'var(--hub-chrome-text)' : 'rgba(255,255,255,0.92)';
  const chromeMuted = hubSurfaceMode === 'light' ? 'var(--hub-chrome-text-muted)' : 'rgba(255,255,255,0.55)';
  const borderSoft = 'var(--hub-chrome-border-soft)';
  const surface = 'var(--hub-chrome-surface)';
  const well = 'var(--hub-chrome-well)';
  const rowFill = 'var(--hub-chrome-row-fill)';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--hub-chrome-border-soft)]">
      <div
        className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--hub-chrome-border-soft)] px-4 py-3"
        style={{ backgroundColor: surface }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: hexToRgba(accent, 0.16), color: accent }}
            aria-hidden
          >
            <HardDrive size={18} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold" style={{ color: chromeText }}>
              Dispositivi aziendali
            </div>
            <div className="truncate text-xs" style={{ color: chromeMuted }}>
              {loading
                ? 'Caricamento…'
                : err
                  ? err
                  : `${companiesWithIssues}/${totalCompanies} aziende con dischi quasi pieni`}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenDispositivi?.()}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] px-3 py-2 text-[13px] font-semibold text-[color:var(--hub-chrome-text-secondary)] transition hover:bg-[color:var(--hub-chrome-hover)] hover:[border-color:var(--hub-accent-border)]"
          title="Apri Dispositivi aziendali"
        >
          <Monitor size={16} aria-hidden />
          Apri
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden" style={{ backgroundColor: well }}>
        <div className="custom-scrollbar min-h-0 h-full overflow-y-auto px-4 py-3">
          {!isTecnico ? (
            <div className="py-6 text-center text-sm" style={{ color: chromeMuted }}>
              Solo tecnici.
            </div>
          ) : loading ? (
            <div className="py-6 text-center text-sm" style={{ color: chromeMuted }}>
              Caricamento dispositivi…
            </div>
          ) : err ? (
            <div className="py-6 text-center text-sm" style={{ color: chromeMuted }}>
              {err}
            </div>
          ) : top.length === 0 ? (
            <div className="py-6 text-center text-sm" style={{ color: chromeMuted }}>
              Nessun dato disponibile.
            </div>
          ) : (
            <div className="space-y-2">
              {top.map((c) => {
                const hasIssue = c.crit + c.warn > 0;
                return (
                  <div
                    key={c.name}
                    className="flex items-center gap-3 rounded-xl border border-[color:var(--hub-chrome-border-soft)] px-3 py-2"
                    style={{ backgroundColor: rowFill }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {hasIssue ? (
                          <AlertTriangle
                            size={14}
                            className={c.crit > 0 ? 'text-red-500' : 'text-yellow-500'}
                            aria-hidden
                          />
                        ) : null}
                        <div className="truncate text-[13px] font-semibold" style={{ color: chromeText }}>
                          {shortCompanyLabel(c.name, 18)}
                        </div>
                        <div className="ml-auto shrink-0 text-[11px] font-semibold" style={{ color: chromeMuted }}>
                          {c.total} PC
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: chromeMuted }}>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                          {c.crit} rosso
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-yellow-500" aria-hidden />
                          {c.warn} giallo
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {perCompany.length > top.length ? (
                <div className="pt-1 text-[11px]" style={{ color: chromeMuted }}>
                  Mostrate {top.length} aziende · altre {perCompany.length - top.length} nella lista completa.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

