import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileSignature } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import { hexToRgba } from '../../utils/techHubAccent';
import {
  summarizeContractsPortfolio,
  buildMonthlyContractHistogram
} from '../../utils/contractHubStats';

const COL_VERDE = '#22c55e';
const COL_ARANCIO = '#fb923c';
const COL_GRIGIO = '#94a3b8';

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

  const kpis = useMemo(() => summarizeContractsPortfolio(contracts), [contracts]);
  const histogram = useMemo(() => buildMonthlyContractHistogram(contracts, 7), [contracts]);

  const chartModel = useMemo(() => {
    const W = 480;
    const H = 200;
    const padL = 34;
    const padR = 12;
    const padT = 10;
    const padB = 36;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const n = histogram.monthsMeta.length || 1;
    const gap = innerW / n * 0.08;
    const clusterW = innerW / n - gap;

    const maxBar = histogram.maxStack;

    /** @type {Array<{ bx: number, bw: number, hGray: number, hOrange: number, hGreen: number, monthIndex: number }>} */
    const clusters = [];
    for (let i = 0; i < n; i += 1) {
      const x0 = padL + i * (innerW / n) + gap / 2;
      const bx = x0 + clusterW * 0.1;
      const bw = clusterW * 0.65 / 3;
      const sg = histogram.series[i] || { verde: 0, arancione: 0, grigio: 0 };
      const hz = innerH / maxBar;

      clusters.push({
        bx,
        bw,
        hGray: sg.grigio * hz,
        hOrange: sg.arancione * hz,
        hGreen: sg.verde * hz,
        monthIndex: i
      });
    }

    return { W, H, padL, padR, padT, padB, innerW, innerH, clusters, maxY: maxBar };
  }, [histogram]);

  const baseY = chartModel.padT + chartModel.innerH;

  return (
    <div
      className="rounded-2xl border border-white/[0.08] p-5"
      style={{ backgroundColor }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSignature size={20} style={{ color: accentHex }} className="shrink-0" />
            <h2 className="text-sm font-semibold text-white">Contratti attivi</h2>
          </div>
          <p className="mt-1 text-[11px] text-white/40">
            Andamento mensile • Grigio: eventi rinnovo · Arancio: rate da pagare · Verde: rate saldate nel mese
          </p>
        </div>
        {onOpenContractsList && (
          <button
            type="button"
            onClick={onOpenContractsList}
            className="text-[11px] font-semibold text-white/50 transition hover:text-[color:var(--hub-accent)]"
          >
            Lista contratti →
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3 tabular-nums">
        <KpiChip label="Totale" value={kpis.totale} accent={accentHex} />
        <KpiChip label="Saldati" value={kpis.saldati} tone="green" />
        <KpiChip label="Da pagare" value={kpis.daPagare} tone="orange" />
        {kpis.senzaRate > 0 && (
          <KpiChip label="Senza rate" value={kpis.senzaRate} tone="gray" muted />
        )}
      </div>

      <div ref={chartRef} className="relative min-h-[220px]" onMouseLeave={() => setTip(null)}>
        {loading ? (
          <div className="flex h-[200px] items-center justify-center text-xs text-white/35">Caricamento…</div>
        ) : err ? (
          <div className="flex h-[200px] items-center justify-center text-xs text-red-300/90">{err}</div>
        ) : (
          <svg
            className="h-auto w-full max-w-full"
            viewBox={`0 0 ${chartModel.W} ${chartModel.H}`}
            role="img"
            aria-label="Grafico contratti per mese"
          >
            <line
              x1={chartModel.padL}
              y1={baseY}
              x2={chartModel.W - chartModel.padR}
              y2={baseY}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
            {ticksFor(chartModel.maxY).map((tick) => (
              <g key={`tick-${tick}`}>
                <text
                  x={chartModel.padL - 6}
                  y={baseY - ((tick || 0) / chartModel.maxY) * chartModel.innerH}
                  fill="rgba(255,255,255,0.32)"
                  fontSize="9"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {tick}
                </text>
                <line
                  x1={chartModel.padL}
                  x2={chartModel.W - chartModel.padR}
                  y1={baseY - ((tick || 0) / chartModel.maxY) * chartModel.innerH}
                  y2={baseY - ((tick || 0) / chartModel.maxY) * chartModel.innerH}
                  stroke="rgba(255,255,255,0.04)"
                  strokeDasharray="2 6"
                />
              </g>
            ))}

            {chartModel.clusters.map((c) => {
              const gapBw = c.bw * 0.22;
              const xG = c.bx;
              const xO = c.bx + c.bw + gapBw;
              const xVe = c.bx + 2 * (c.bw + gapBw);
              const mi = c.monthIndex;
              const lbl = histogram.monthsMeta[mi]?.label ?? '';
              const sg =
                histogram.series[mi] || { verde: 0, arancione: 0, grigio: 0 };

              const toLocal = (e) => {
                const root = chartRef.current;
                const r = root?.getBoundingClientRect();
                if (!r) return { x: 0, y: 0 };
                return { x: e.clientX - r.left, y: e.clientY - r.top };
              };

              const showMonthTip = (e) => {
                const pix = toLocal(e);
                setTip({
                  monthIndex: mi,
                  label: lbl,
                  x: pix.x,
                  y: pix.y - 14,
                  verde: sg.verde,
                  arancione: sg.arancione,
                  grigio: sg.grigio
                });
              };

              const mkBar = (suffix, x, h, fill) => {
                const rawH = Number.isFinite(h) && h > 0 ? h : 0;
                const hh = rawH > 0 ? Math.max(rawH, 5) : 0;
                const y = baseY - hh;
                return (
                  <rect
                    key={`b-${mi}-${suffix}`}
                    x={x}
                    y={hh > 0 ? y : baseY}
                    width={c.bw}
                    height={Math.max(hh, 0)}
                    rx={hh > 0 ? 3 : 0}
                    ry={hh > 0 ? 3 : 0}
                    fill={fill}
                    opacity={hh > 0 ? 1 : 0.12}
                    className={hh > 0 ? 'cursor-pointer transition hover:opacity-90' : ''}
                    stroke={hh > 0 ? hexToRgba(accentHex, 0.5) : 'transparent'}
                    strokeWidth={hh > 0 ? 0.7 : 0}
                    onMouseEnter={showMonthTip}
                    onMouseMove={showMonthTip}
                  />
                );
              };

              return (
                <g key={`cl-${mi}`}>
                  {mkBar('g', xG, c.hGray, COL_GRIGIO)}
                  {mkBar('o', xO, c.hOrange, COL_ARANCIO)}
                  {mkBar('v', xVe, c.hGreen, COL_VERDE)}
                </g>
              );
            })}

            {histogram.monthsMeta.map(({ label }, idx) => {
              const cw = chartModel.innerW / (histogram.monthsMeta.length || 1);
              const x = chartModel.padL + idx * cw + cw / 2;
              return (
                <text
                  key={label + idx}
                  x={x}
                  y={chartModel.H - 10}
                  fill="rgba(255,255,255,0.38)"
                  fontSize="10"
                  fontWeight={600}
                  textAnchor="middle"
                >
                  {label}
                </text>
              );
            })}
          </svg>
        )}

        {tip?.monthIndex != null && (
          <div
            className="pointer-events-none absolute z-10 max-w-[14rem] rounded-xl border border-white/[0.12] px-3 py-2 text-xs shadow-xl"
            style={{
              left: `${Math.min(Math.max(tip.x, 12), chartRef.current ? chartRef.current.clientWidth - 200 : tip.x)}px`,
              top: `${Math.min(Math.max(tip.y, 12), tip.y)}px`,
              backgroundColor,
              transform: 'translate(-50%, -100%) translateY(-6px)'
            }}
          >
            <div className="font-semibold text-white/90 capitalize">{tip.label}</div>
            <ul className="mt-2 space-y-1 text-[11px] text-white/60">
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COL_GRIGIO }} />
                  Rinnovi
                </span>
                <span className="tabular-nums text-white">{tip.grigio}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COL_ARANCIO }} />
                  Rate da pagare
                </span>
                <span className="tabular-nums text-white">{tip.arancione}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COL_VERDE }} />
                  Rate saldate
                </span>
                <span className="tabular-nums text-white">{tip.verde}</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 border-t border-white/[0.06] pt-3 text-[10px] text-white/42">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COL_GRIGIO }} /> Rinnovi
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COL_ARANCIO }} /> Da pagare
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COL_VERDE }} /> Saldate nel mese
        </span>
      </div>
    </div>
  );
}

function ticksFor(maxY) {
  const z = Math.max(1, maxY || 1);
  if (z <= 4) return Array.from({ length: z + 1 }, (_, i) => i);
  const mid = Math.round(z / 2);
  return [0, mid, z];
}

function KpiChip({ label, value, accent, tone, muted }) {
  const base = 'rounded-xl border px-3 py-1.5 ';
  let style = {};
  let cls =
    `${base}${muted ? 'border-white/[0.06]' : 'border-white/[0.1]'} `;
  cls += muted ? 'text-white/42' : 'text-white';

  if (accent) {
    style = { borderColor: hexToRgba(accent, 0.45), boxShadow: `0 0 0 1px ${hexToRgba(accent, 0.12)} inset` };
  }
  if (tone === 'green')
    cls += ' border-green-700/35 bg-green-500/15 text-green-200';
  else if (tone === 'orange')
    cls += ' border-orange-600/35 bg-orange-500/14 text-orange-200';
  else if (tone === 'gray') cls += ' border-slate-500/30 bg-slate-600/25 text-slate-200';

  return (
    <div className={`${cls} min-w-[5.75rem]`} style={accent ? style : undefined}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/45">{label}</div>
      <div className="text-xl font-extrabold tabular-nums leading-tight">{value}</div>
    </div>
  );
}
