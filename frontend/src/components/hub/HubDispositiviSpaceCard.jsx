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
  backgroundColor = 'var(--hub-chrome-surface)',
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

  const issuesOnly = useMemo(() => perCompany.filter((x) => x.crit + x.warn > 0), [perCompany]);
  const top = issuesOnly.slice(0, 10);
  const companiesWithIssues = issuesOnly.length;

  const chromeText = hubSurfaceMode === 'light' ? 'var(--hub-chrome-text)' : 'rgba(255,255,255,0.92)';
  const chromeMuted = hubSurfaceMode === 'light' ? 'var(--hub-chrome-text-muted)' : 'rgba(255,255,255,0.55)';
  const hubLight = hubSurfaceMode === 'light';

  return (
    <div
      className={`rounded-2xl border p-3 ${hubLight ? 'border-[color:var(--hub-chrome-border-soft)]' : 'border-white/[0.08]'}`}
      style={{ backgroundColor, boxShadow: 'var(--hub-chrome-card-shadow)' }}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <HardDrive size={18} style={{ color: accent }} className="shrink-0" aria-hidden />
            <h2 className={`text-xs font-semibold sm:text-sm ${hubLight ? 'text-[color:var(--hub-chrome-text)]' : 'text-white'}`}>
              Dispositivi aziendali
            </h2>
          </div>
          <p
            className={`mt-0.5 text-[9px] leading-snug ${hubLight ? 'text-[color:var(--hub-chrome-text-muted)]' : 'text-white/38'}`}
          >
            {loading
              ? 'Caricamento…'
              : err
                ? err
                : `${companiesWithIssues} aziende con dischi quasi pieni`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenDispositivi?.()}
            className={`text-[10px] font-semibold transition hover:opacity-90 ${
              hubLight ? 'text-[color:var(--hub-chrome-link)]' : 'text-white/50 hover:text-[color:var(--hub-accent)]'
            }`}
            title="Apri Dispositivi aziendali"
          >
            Apri →
          </button>
        </div>
      </div>

      <div
        className={`rounded-lg border ${
          hubLight ? 'border-[color:var(--hub-chrome-border-soft)] bg-white' : 'border-white/[0.08] bg-black/15'
        }`}
      >
        <div className="custom-scrollbar min-h-0 max-h-[260px] overflow-y-auto px-3 py-2">
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
              Nessuna anomalia rilevata.
            </div>
          ) : (
            <div className="space-y-1">
              {top.map((c) => {
                const showCrit = c.crit > 0;
                const showWarn = c.warn > 0;
                return (
                  <div
                    key={c.name}
                    className="flex items-start gap-3 py-1.5"
                  >
                    <AlertTriangle
                      size={14}
                      className={showCrit ? 'text-red-500' : 'text-yellow-500'}
                      aria-hidden
                      style={{ marginTop: 2 }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <div className="truncate text-[13px] font-semibold" style={{ color: chromeText }}>
                          {shortCompanyLabel(c.name, 18)}
                        </div>

                        {(showCrit || showWarn) && (
                          <div className="flex items-center gap-2 text-[11px] font-medium" style={{ color: chromeMuted }}>
                            {showCrit ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                                {c.crit} rosso
                              </span>
                            ) : null}
                            {showWarn ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-yellow-500" aria-hidden />
                                {c.warn} giallo
                              </span>
                            ) : null}
                          </div>
                        )}

                        <div className="ml-auto shrink-0 text-[11px] font-semibold" style={{ color: chromeMuted }}>
                          {c.total} PC
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {issuesOnly.length > top.length ? (
                <div className="pt-1 text-[11px]" style={{ color: chromeMuted }}>
                  Mostrate {top.length} aziende · altre {issuesOnly.length - top.length} nella lista completa.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

