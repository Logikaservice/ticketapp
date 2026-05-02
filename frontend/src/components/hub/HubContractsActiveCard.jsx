import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileSignature } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import {
  buildCalendarYearEuroSeries,
  rollupEuroYearSeries,
  summarizeEuroForCalendarMonth
} from '../../utils/contractHubStats';

/** Verde barra KPI / riempimento; grigio “guscio” candela — stesse tonalità già usate sull’Hub. */
const COL_VERDE = '#15803d';
const COL_TRACK = '#3f495a';

function fmtEuroCompact(n) {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(x);
}

/** Solo asse Y: compatto, evita rumore vicino allo zero. */
function fmtEuroAxisTick(n) {
  if (!n) return '0';
  const k = Math.abs(n);
  if (k >= 1000) {
    const t = k / 1000;
    const s = Number.isInteger(t) ? `${t}` : t.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `${s}k`;
  }
  return `${Math.round(n)}`;
}

/** Allineati alla scala delle candele (= max mensile fra i previsti nell’anno). */
function ticksForScale(scaleMax) {
  const m = Math.max(scaleMax || 1, 1);
  return [0, m / 2, m];
}

/** @param {{ backgroundColor: string, accentHex: string }} p */
export default function HubContractsActiveCard({
  backgroundColor,
  accentHex,
  getAuthHeader,
  currentUser,
  onOpenContractsList
}) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const chartRef = useRef(null);
  const [tip, setTip] = useState(null);
  /** KPI header: solo mese in corso vs intero anno (grafico sempre gen–dic anno di riferimento). */
  const [kpiScope, setKpiScope] = useState(/** @type {'mese' | 'anno'} */ ('anno'));

  const refYear = new Date().getFullYear();

  const load = useCallback(async () => {
    if (!getAuthHeader || currentUser?.ruolo !== 'tecnico') {
      setContracts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(buildApiUrl('/api/contracts'), { headers: getAuthHeader() });
      if (!res.ok) throw new Error('fetch');
      const data = await res.json();
      setContracts(Array.isArray(data) ? data : []);
    } catch (_) {
      setErr('Errore caricamento contratti');
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, currentUser?.ruolo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onUp = () => load();
    window.addEventListener('contractUpdated', onUp);
    window.addEventListener('contractCreated', onUp);
    return () => {
      window.removeEventListener('contractUpdated', onUp);
      window.removeEventListener('contractCreated', onUp);
    };
  }, [load]);

  const euroModel = useMemo(
    () => buildCalendarYearEuroSeries(contracts, refYear),
    [contracts, refYear]
  );

  const moneyKpis = useMemo(() => {
    const now = new Date();
    if (kpiScope === 'anno') {
      return rollupEuroYearSeries(euroModel.series);
    }
    return summarizeEuroForCalendarMonth(
      contracts,
      now.getFullYear(),
      now.getMonth()
    );
  }, [contracts, euroModel.series, kpiScope]);

  const chartModel = useMemo(() => {
    const W = 520;
    const H = 144;
    const padL = 28;
    const padR = 4;
    const padT = 4;
    const padB = 30;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const n = 12;
    const slot = innerW / n;
    const maxBarW = 10;
    const barW = Math.max(4, Math.min(maxBarW, slot * 0.28));

    const scaleMax = Math.max(euroModel.chartEuroMax, 1);
    /** @type {Array<{ bx: number; bw: number; hTrack: number; hFill: number; monthIndex: number }>} */
    const bars = [];

    for (let mi = 0; mi < 12; mi += 1) {
      const sg = euroModel.series[mi] || { previsto: 0, pagato: 0 };
      const prev = sg.previsto;
      const paid = sg.pagato;
      const x0 = padL + mi * slot;
      const bx = x0 + (slot - barW) / 2;
      const hTrack =
        prev > 0 ? Math.max(innerH * (prev / scaleMax), 5) : 3;
      const ratioRaw = prev > 0 ? paid / prev : 0;
      const ratio = Math.min(1, Math.max(0, ratioRaw));
      const hFill = prev > 0 ? Math.max(hTrack * ratio, paid > 0 ? 5 * ratio || 3 : 0) : paid > 0 ? 6 : 0;

      bars.push({ bx, bw: barW, hTrack, hFill, monthIndex: mi });
    }

    return { W, H, padL, padR, padT, padB, innerW, innerH, slot, bars, scaleMax };
  }, [euroModel]);

  const baseY = chartModel.padT + chartModel.innerH;
  const yTicks = ticksForScale(chartModel.scaleMax);
  const now = new Date();
  const showCurrentMonthMarker =
    refYear === now.getFullYear();
  const currentMonthIndex = now.getMonth();

  return (
    <div className="rounded-2xl border border-white/[0.08] p-3" style={{ backgroundColor }}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <FileSignature size={18} style={{ color: accentHex }} className="shrink-0" />
            <h2 className="text-xs font-semibold text-white sm:text-sm">Contratti attivi</h2>
          </div>
          <p className="mt-0.5 text-[9px] leading-snug text-white/38">
            {refYear} · guscio = previsto · verde = pagato · KPI:{' '}
            <span className="text-white/50">
              {kpiScope === 'mese' ? 'mese in corso' : `anno ${refYear}`}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-white/[0.1] p-0.5"
            role="group"
            aria-label="Ambito KPI"
          >
            <SegmentBtn active={kpiScope === 'mese'} onClick={() => setKpiScope('mese')}>
              Mese
            </SegmentBtn>
            <SegmentBtn active={kpiScope === 'anno'} onClick={() => setKpiScope('anno')}>
              Anno
            </SegmentBtn>
          </div>
          {onOpenContractsList && (
            <button
              type="button"
              onClick={onOpenContractsList}
              className="text-[10px] font-semibold text-white/50 transition hover:text-[color:var(--hub-accent)]"
            >
              Lista →
            </button>
          )}
        </div>
      </div>

      <div className="mb-2 grid grid-cols-3 divide-x divide-white/[0.08] rounded-lg border border-white/[0.08] bg-black/15">
        <KpiMoneyCol title="Totale" subline="Totale previsto" value={moneyKpis.previsto} />
        <KpiMoneyCol title="Pagato" subline="Nel periodo" value={moneyKpis.pagato} highlight />
        <KpiMoneyCol title="Mancante" subline="Da incassare" value={moneyKpis.mancante} />
      </div>

      <div ref={chartRef} className="relative min-h-[136px]" onMouseLeave={() => setTip(null)}>
        {loading ? (
          <div className="flex h-[126px] items-center justify-center text-[11px] text-white/35">Caricamento…</div>
        ) : err ? (
          <div className="flex h-[126px] items-center justify-center text-[11px] text-red-300/90">{err}</div>
        ) : (
          <svg
            className="h-auto w-full max-w-full"
            viewBox={`0 0 ${chartModel.W} ${chartModel.H}`}
            role="img"
            aria-label={`Andamento mensile euro contratti ${refYear}`}
          >
            <line
              x1={chartModel.padL}
              y1={baseY}
              x2={chartModel.W - chartModel.padR}
              y2={baseY}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
            {yTicks.map((tick) => {
              const yt = baseY - (tick / chartModel.scaleMax) * chartModel.innerH;
              return (
                <g key={`y-${tick}-${chartModel.scaleMax}`}>
                  <text
                    x={chartModel.padL - 2}
                    y={tick === 0 ? baseY + 9 : yt}
                    fill="rgba(255,255,255,0.28)"
                    fontSize="7"
                    textAnchor="end"
                    dominantBaseline={tick === 0 ? 'hanging' : 'middle'}
                  >
                    {fmtEuroAxisTick(tick)}
                  </text>
                  {tick !== 0 && (
                    <line
                      x1={chartModel.padL}
                      x2={chartModel.W - chartModel.padR}
                      y1={yt}
                      y2={yt}
                      stroke="rgba(255,255,255,0.05)"
                      strokeDasharray="2 6"
                    />
                  )}
                </g>
              );
            })}
            <text
              x={chartModel.padL - 2}
              y={chartModel.padT + 2}
              fill="rgba(255,255,255,0.22)"
              fontSize="6"
              textAnchor="end"
            >
              €
            </text>

            {chartModel.bars.map((c) => {
              const mi = c.monthIndex;
              const lbl = euroModel.monthsMeta[mi]?.label ?? '';
              const sg = euroModel.series[mi] || { previsto: 0, pagato: 0 };

              const toLocal = (e) => {
                const root = chartRef.current;
                const r = root?.getBoundingClientRect();
                if (!r) return { x: 0, y: 0 };
                return { x: e.clientX - r.left, y: e.clientY - r.top };
              };

              const showTip = (e) => {
                const pix = toLocal(e);
                setTip({
                  monthIndex: mi,
                  label: lbl,
                  x: pix.x,
                  y: pix.y - 12,
                  ...sg,
                  mancante: Math.max(0, sg.previsto - sg.pagato)
                });
              };

              const rx = Math.min(2.5, c.bw / 2);
              const yTrack = baseY - c.hTrack;
              const yFill = baseY - c.hFill;

              return (
                <g key={`bar-${mi}`}>
                  {/* Guscio: totale previsto nel mese */}
                  <rect
                    x={c.bx}
                    y={yTrack}
                    width={c.bw}
                    height={c.hTrack}
                    rx={rx}
                    ry={rx}
                    fill={COL_TRACK}
                    opacity={sg.previsto > 0 ? 1 : 0.22}
                    className="cursor-pointer transition hover:opacity-90"
                    onMouseEnter={showTip}
                    onMouseMove={showTip}
                  />
                  {/* Riempimento: pagato */}
                  {c.hFill > 0 && sg.previsto > 0 && (
                    <rect
                      x={c.bx}
                      y={yFill}
                      width={c.bw}
                      height={c.hFill}
                      rx={rx}
                      ry={rx}
                      fill={COL_VERDE}
                      className="cursor-pointer transition hover:opacity-90"
                      onMouseEnter={showTip}
                      onMouseMove={showTip}
                    />
                  )}
                </g>
              );
            })}

            {euroModel.monthsMeta.map(({ label }, idx) => {
              const x = chartModel.padL + idx * chartModel.slot + chartModel.slot / 2;
              const isCurrent = showCurrentMonthMarker && idx === currentMonthIndex;
              return (
                <text
                  key={`${label}-${idx}`}
                  x={x}
                  y={chartModel.H - 15}
                  fill={isCurrent ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.34)'}
                  fontSize="8.5"
                  fontWeight={isCurrent ? 700 : 600}
                  textAnchor="middle"
                  className="capitalize"
                >
                  {label}
                </text>
              );
            })}
          </svg>
        )}

        {tip?.monthIndex != null && (
          <div
            className="pointer-events-none absolute z-10 max-w-[15rem] rounded-xl border border-white/[0.12] px-3 py-2 text-xs shadow-xl"
            style={{
              left: `${Math.min(Math.max(tip.x, 14), chartRef.current ? chartRef.current.clientWidth - 200 : tip.x)}px`,
              top: `${Math.min(Math.max(tip.y, 12), tip.y)}px`,
              backgroundColor,
              transform: 'translate(-50%, -100%) translateY(-4px)'
            }}
          >
            <div className="font-semibold capitalize text-white/90">{tip.label}</div>
            <ul className="mt-2 space-y-1 text-[11px] text-white/65">
              <li className="flex justify-between gap-4 tabular-nums">
                <span className="text-white/50">Previsto</span>
                <span className="text-white">{fmtEuroCompact(tip.previsto ?? 0)}</span>
              </li>
              <li className="flex justify-between gap-4 tabular-nums">
                <span className="text-white/50">Pagato</span>
                <span className="text-white">{fmtEuroCompact(tip.pagato ?? 0)}</span>
              </li>
              <li className="flex justify-between gap-4 tabular-nums">
                <span className="text-white/50">Mancante</span>
                <span className="text-white">{fmtEuroCompact(tip.mancante ?? 0)}</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap justify-center gap-3 border-t border-white/[0.06] pt-1.5 text-[9px] text-white/38">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: COL_TRACK }} />{' '}
          Previsto nel mese
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: COL_VERDE }} /> Pagato nel mese
        </span>
      </div>
    </div>
  );
}

function SegmentBtn({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
        active ? 'bg-white/[0.12] text-white' : 'text-white/42 hover:text-white/70'
      }`}
    >
      {children}
    </button>
  );
}

function KpiMoneyCol({ title, subline, value, highlight }) {
  return (
    <div
      className={`min-w-0 px-1.5 py-1.5 sm:px-2 ${highlight ? 'text-emerald-200/95' : 'text-white'}`}
    >
      <div className="flex items-baseline justify-between gap-1.5">
        <span className="text-xs font-bold tabular-nums leading-none sm:text-sm">{fmtEuroCompact(value)}</span>
        <span
          className={`shrink-0 text-[9px] font-semibold uppercase tracking-wide ${highlight ? 'text-emerald-200/75' : 'text-white/45'}`}
        >
          {title}
        </span>
      </div>
      <div className={`mt-0.5 text-[8px] leading-tight ${highlight ? 'text-emerald-200/45' : 'text-white/32'}`}>
        {subline}
      </div>
    </div>
  );
}
