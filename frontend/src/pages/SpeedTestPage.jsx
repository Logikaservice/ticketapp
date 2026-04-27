// src/pages/SpeedTestPage.jsx
// Dashboard Speed Test - Monitoraggio velocità connessione per azienda
// Visibile solo ai tecnici

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Search,
  Gauge,
  Wifi,
  WifiOff,
  RefreshCw,
  Globe,
  Server as ServerIcon,
  Clock,
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import SectionNavMenu from '../components/SectionNavMenu';
import { buildApiUrl } from '../utils/apiConfig';

/** Riempimento arco ping (indipendente dalla soglia colore). */
function getPingPct(ping) {
  const n = Number(ping);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.max(5, Math.min(95, 100 - (n / 50) * 100));
}

/**
 * Qualità latenza: colore del cerchio + etichetta sotto il gauge.
 * Gradazione: verde → giallo → arancione → rose/corallo → rosso.
 */
function pingQuality(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) {
    return { color: '#475569', label: 'PING', pct: 0 };
  }
  const pct = getPingPct(n);
  if (n <= 20) return { color: '#22c55e', label: 'PING (Eccellente)', pct };
  if (n <= 40) return { color: '#eab308', label: 'PING (Ottimo)', pct };
  if (n <= 60) return { color: '#f97316', label: 'PING (Buono)', pct };
  if (n <= 149) return { color: '#f43f5e', label: 'PING (Sufficiente)', pct };
  return { color: '#dc2626', label: 'PING (Pessimo)', pct };
}

function getDownloadPct(mbps) {
  const n = Number(mbps);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.max(5, Math.min(95, (n / 200) * 100));
}

function getUploadPct(mbps) {
  const n = Number(mbps);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.max(5, Math.min(95, (n / 100) * 100));
}

/**
 * Qualità download (Mbps): più è alto, meglio è. Colori in linea con la scala ping.
 * Soglie: 0–10 critica → … → >500 ultra-veloce.
 */
function downloadQuality(mbps) {
  const n = Number(mbps);
  if (!Number.isFinite(n) || n < 0) {
    return { color: '#475569', label: 'DOWNLOAD', pct: 0 };
  }
  const pct = getDownloadPct(n);
  if (n <= 10) return { color: '#dc2626', label: 'DOWNLOAD (Critica)', pct };
  if (n <= 30) return { color: '#f97316', label: 'DOWNLOAD (Lenta)', pct };
  if (n <= 100) return { color: '#f472b6', label: 'DOWNLOAD (Media)', pct };
  if (n <= 500) return { color: '#eab308', label: 'DOWNLOAD (Veloce)', pct };
  return { color: '#22c55e', label: 'DOWNLOAD (Ultra-Veloce)', pct };
}

/** Upload: soglie Mbps dedicate; colori allineati a ping/download. */
function uploadQuality(mbps) {
  const n = Number(mbps);
  if (!Number.isFinite(n) || n < 0) {
    return { color: '#475569', label: 'UPLOAD', pct: 0 };
  }
  const pct = getUploadPct(n);
  if (n <= 3) return { color: '#dc2626', label: 'UPLOAD (Critica)', pct };
  if (n <= 10) return { color: '#f97316', label: 'UPLOAD (Sufficiente)', pct };
  if (n <= 20) return { color: '#f472b6', label: 'UPLOAD (Buona)', pct };
  if (n <= 100) return { color: '#eab308', label: 'UPLOAD (Ottima)', pct };
  return { color: '#22c55e', label: 'UPLOAD (Eccellente)', pct };
}

/**
 * Ultimo heartbeat così come salvato sul server (ISO). “X min fa” è calcolato con `now` al momento del render:
 * senza re-render periodico il testo resta fermo; cambiando pagina si forza un nuovo calcolo e può sembrare un “reset”.
 * @returns {{ line: string, isStale: boolean, detailTitle: string | null, absoluteShort: string | null }}
 */
function formatAgentLastSeen(isoDateStr, nowMs = Date.now()) {
  if (isoDateStr == null || isoDateStr === '') {
    return { line: 'Ultimo controllo: —', isStale: true, detailTitle: null, absoluteShort: null };
  }
  const d = new Date(isoDateStr);
  const t = d.getTime();
  if (Number.isNaN(t)) {
    return { line: 'Ultimo controllo: —', isStale: true, detailTitle: null, absoluteShort: null };
  }
  const absoluteIt = d.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'medium' });
  const absoluteShort = d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const detailTitle = `Registrato sul server alle ${absoluteIt}. Il valore “fa” si aggiorna mentre resti su questa pagina; non è un contatore dal tuo ultimo click.`;

  const sec = Math.floor((nowMs - t) / 1000);
  if (sec < 0) {
    return { line: 'Ultimo controllo: adesso', isStale: false, detailTitle, absoluteShort };
  }
  if (sec < 60) {
    return { line: 'Ultimo controllo: meno di 1 min fa', isStale: false, detailTitle, absoluteShort };
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return { line: `Ultimo controllo: ${min} min fa`, isStale: min > 15, detailTitle, absoluteShort };
  }
  const h = Math.floor(min / 60);
  if (h < 48) {
    return { line: `Ultimo controllo: ${h} h fa`, isStale: true, detailTitle, absoluteShort };
  }
  const days = Math.floor(h / 24);
  return { line: `Ultimo controllo: ${days} giorni fa`, isStale: true, detailTitle, absoluteShort };
}

/** Scostamento % ultimo test vs media dei test precedenti (cronologia ordinata per data). */
function pctVsPriorAvgFromHistory(rows, key) {
  if (!rows || rows.length < 2) return null;
  const sorted = [...rows].sort((a, b) => new Date(a.test_date) - new Date(b.test_date));
  const cur = Number(sorted[sorted.length - 1][key]);
  const prev = sorted.slice(0, -1);
  const sum = prev.reduce((s, r) => s + (Number(r[key]) || 0), 0);
  const avg = sum / prev.length;
  if (!(avg > 0) || !Number.isFinite(cur)) return null;
  return Math.round((100 * (cur - avg)) / avg);
}

function formatVsHistoricalPct(pct) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const body = pct > 0 ? `+${pct}` : `${pct}`;
  return `(${body}%)`;
}

function vsHistoricalPctColor(pct) {
  if (pct == null || !Number.isFinite(pct)) return '#94a3b8';
  if (pct <= -15) return '#f87171';
  if (pct < 0) return '#fbbf24';
  if (pct >= 15) return '#4ade80';
  return '#94a3b8';
}

/** Allineato al backend: stesso IP per ≥3 test o ≥24 h, su righe con IP valorizzato; altrimenti dinamico se cambia tra test consecutivi. */
const PUBLIC_IP_STABILITY_MIN_CONSECUTIVE = 3;
const PUBLIC_IP_STABILITY_MIN_HOURS = 24;
const PUBLIC_IP_STABILITY_TOOLTIP =
  'Confronto tra i test con IP registrato su questo agent: (Statico) stesso IP per almeno 3 misure o per almeno 24 ore; (Dinamico) IP diverso tra un test e il successivo. Con pochi dati l’etichetta può non comparire.';

/** Righe massime nella tabella sotto il grafico (il periodo può contenere molte più misure). */
const SPEEDTEST_DETAIL_TABLE_MAX_ROWS = 30;
const SPEEDTEST_SERVER_RETENTION_DAYS = 60;
const SPEEDTEST_BUILD_MARK =
  process.env.REACT_APP_SPEEDTEST_BUILD_MARK ||
  'st-click-fix-2026-04-27';

/** Aziende con speedtest attivo ma senza nuovo rilevamento da più di questa soglia → elenco “senza aggiornamenti”. */
const SPEEDTEST_STALE_AFTER_MS = 2 * 60 * 60 * 1000;

// Chiave stabile per evitare mismatch di card/click dopo refresh (no idx: React deve riusare correttamente i nodi)
function speedtestRowKey(row) {
  const agentId = resolveAgentIdFromRow(row);
  const aziendaId = resolveAziendaIdFromRow(row);
  if (agentId != null) return `st-agent-${agentId}`;
  if (aziendaId != null) return `st-azienda-${aziendaId}`;
  const name = (row?.azienda_name || row?.agent_name || '').toString().trim().toLowerCase();
  return `st-name-${name || 'unknown'}`;
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Chiave locale YYYY-MM-DD da una misura speedtest (timezone browser). */
function ymdLocalFromTestDate(iso) {
  if (iso == null || iso === '') return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function ymdToItDisplay(ymd) {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  const [y, m, day] = parts;
  return `${day}/${m}/${y}`;
}

/** dd/mm/yyyy (o separatore . -) → YYYY-MM-DD se valido; se daysWithData è un Set, accetta solo giorni con dati. */
function parseItalianDayInput(raw, daysWithData) {
  const t = String(raw || '').trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return null;
  let dayN = parseInt(m[1], 10);
  let mo = parseInt(m[2], 10);
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || dayN < 1 || dayN > 31) return null;
  const cand = new Date(y, mo - 1, dayN);
  if (cand.getFullYear() !== y || cand.getMonth() !== mo - 1 || cand.getDate() !== dayN) return null;
  const ymd = `${y}-${pad2(mo)}-${pad2(dayN)}`;
  if (daysWithData instanceof Set && !daysWithData.has(ymd)) return null;
  return ymd;
}

function normalizeSpeedtestPublicIp(ip) {
  if (ip == null || ip === '') return '';
  return String(ip).trim();
}

/** @returns {'static'|'dynamic'|null} */
function inferPublicIpStability(rows) {
  const withIp = (rows || [])
    .map((r) => ({
      t: r.test_date == null ? NaN : new Date(r.test_date).getTime(),
      ip: normalizeSpeedtestPublicIp(r.public_ip),
    }))
    .filter((r) => r.ip !== '' && Number.isFinite(r.t));
  if (withIp.length < 2) return null;
  withIp.sort((a, b) => a.t - b.t);
  for (let i = 1; i < withIp.length; i++) {
    if (withIp[i].ip !== withIp[i - 1].ip) return 'dynamic';
  }
  const first = withIp[0];
  const last = withIp[withIp.length - 1];
  const hours = (last.t - first.t) / (3600 * 1000);
  if (hours >= PUBLIC_IP_STABILITY_MIN_HOURS || withIp.length >= PUBLIC_IP_STABILITY_MIN_CONSECUTIVE) {
    return 'static';
  }
  return null;
}

/** Dettaglio: cronologia caricata se disponibile; altrimenti valore panoramica. */
function resolvePublicIpStabilityFromDetail(history, overviewStability) {
  const fromHist = inferPublicIpStability(history);
  if (fromHist != null) return fromHist;
  return overviewStability ?? null;
}

function publicIpStabilityParen(code) {
  if (code === 'static') return { text: '(Statico)', color: '#4ade80' };
  if (code === 'dynamic') return { text: '(Dinamico)', color: '#fb923c' };
  return null;
}

function parsePositiveInt(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (typeof v === 'number') {
    return Number.isFinite(v) && v > 0 ? Math.trunc(v) : null;
  }
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    const n = parseInt(t, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * L'API PostgreSQL/Express può esporre colonne in snake_case; eventuali proxy o serializzazioni
 * possono variare. Si cercano anche tutte le chiavi che sembrano "agent id" / "azienda id".
 */
function resolveAgentIdFromRow(row) {
  if (!row || typeof row !== 'object') return null;
  const candidates = [
    row.agent_id,
    row.agentId,
    row.AgentId,
    row.AGENT_ID,
    row.Agent_Id,
    row.id_agent,
    row.network_agent_id
  ];
  for (const v of candidates) {
    const n = parsePositiveInt(v);
    if (n != null) return n;
  }
  for (const k of Object.keys(row)) {
    if (/^agent_?id$/i.test(k) || k === 'network_agent_id') {
      const n = parsePositiveInt(row[k]);
      if (n != null) return n;
    }
  }
  return null;
}

function resolveAziendaIdFromRow(row) {
  if (!row || typeof row !== 'object') return null;
  const candidates = [
    row.azienda_id,
    row.aziendaId,
    row.AziendaId,
    row.AZIENDA_ID,
    row.Azienda_Id,
    row.company_id,
    row.companyId
  ];
  for (const v of candidates) {
    const n = parsePositiveInt(v);
    if (n != null) return n;
  }
  for (const k of Object.keys(row)) {
    if (/^azienda_?id$/i.test(k) || /^company_?id$/i.test(k)) {
      const n = parsePositiveInt(row[k]);
      if (n != null) return n;
    }
  }
  return null;
}

/** Una sola riga per agent_id (evita liste raddoppiate in caso di richieste sovrapposte o dati anomali). */
function dedupeSpeedtestOverview(rows) {
  const map = new Map();
  let fb = 0;
  for (const row of rows) {
    const resolvedAgent = resolveAgentIdFromRow(row);
    const resolvedAzienda = resolveAziendaIdFromRow(row);
    const aid = resolvedAgent != null ? resolvedAgent : NaN;
    const key = Number.isFinite(aid) ? aid : `__fb_${fb++}`;
    const normalized = {
      ...row,
      ...(resolvedAgent != null ? { agent_id: resolvedAgent } : {}),
      ...(resolvedAzienda != null ? { azienda_id: resolvedAzienda } : {})
    };
    map.set(key, normalized);
  }
  return Array.from(map.values());
}

const SpeedTestPage = ({
  currentUser,
  getAuthHeader,
  onNavigateHome,
  onNavigateOffice,
  onNavigateEmail,
  onNavigateAntiVirus,
  onNavigateNetworkMonitoring,
  onNavigateMappatura,
  onNavigateDispositiviAziendali,
  selectedCompanyId
}) => {
  const [overview, setOverview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overviewRefreshing, setOverviewRefreshing] = useState(false);
  const overviewHasDataRef = useRef(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null); // { agentId?, aziendaId?, aziendaName, snapshot?, lastHeartbeatFromOverview?, download_vs_hist_pct?, upload_vs_hist_pct? }
  const [history, setHistory] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDays, setHistoryDays] = useState(30);
  /** Filtro dettaglio: una giornata (locale YYYY-MM-DD) o tutto il periodo. */
  const [historyDayFilter, setHistoryDayFilter] = useState(null);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [dayPickerMonth, setDayPickerMonth] = useState(() => new Date());
  const [daySearchInput, setDaySearchInput] = useState('');
  const dayPickerWrapRef = useRef(null);
  const chartCanvasRef = useRef(null);
  const chartContainerRef = useRef(null);
  const overviewFetchSeqRef = useRef(0);
  /** Aggiorna il calcolo di “X min fa” senza cambiare i dati API (evita testo congelato vs rientro pagina). */
  const [heartbeatTick, setHeartbeatTick] = useState(0);
  const pageScrollRef = useRef(null);
  useEffect(() => {
    const id = window.setInterval(() => setHeartbeatTick((n) => n + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  const [staleListOpen, setStaleListOpen] = useState(false);
  const stalePopoverRef = useRef(null);
  useEffect(() => {
    if (!staleListOpen) return;
    const onDown = (e) => {
      if (stalePopoverRef.current && !stalePopoverRef.current.contains(e.target)) {
        setStaleListOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [staleListOpen]);

  // Carica panoramica (primo caricamento: schermo pieno; aggiornamenti: dati precedenti visibili, niente “azzeramento”)
  const fetchOverview = useCallback(async () => {
    const seq = ++overviewFetchSeqRef.current;
    const useFullPageLoader = !overviewHasDataRef.current;
    try {
      if (useFullPageLoader) setLoading(true);
      else setOverviewRefreshing(true);
      const res = await fetch(buildApiUrl('/api/network-monitoring/speedtest/overview'), {
        headers: getAuthHeader()
      });
      const data = await res.json();
      if (seq !== overviewFetchSeqRef.current) return;
      if (data.success) {
        const rows = Array.isArray(data.data) ? data.data : [];
        if (rows.length > 0) {
          overviewHasDataRef.current = true;
          try {
            const u = resolveAgentIdFromRow(rows[0]);
            const z = resolveAziendaIdFromRow(rows[0]);
            console.warn('[SpeedTest] overview caricata', rows.length, 'righe · primo agent_id risolto:', u, 'azienda_id:', z, 'chiavi:', Object.keys(rows[0]).join(','));
          } catch (_) { /* ignore */ }
        }
        setOverview(dedupeSpeedtestOverview(rows));
      }
    } catch (err) {
      console.error('Errore caricamento panoramica speed test:', err);
    } finally {
      if (seq === overviewFetchSeqRef.current) {
        setLoading(false);
        setOverviewRefreshing(false);
      }
    }
  }, [getAuthHeader]);

  // Cronologia: preferisci endpoint per agent; se agentId manca usa azienda (stesso payload)
  const fetchHistory = useCallback(async (selection, days = 30) => {
    const agentId = selection?.agentId != null ? selection.agentId : null;
    const aziendaId = selection?.aziendaId != null ? selection.aziendaId : null;
    const url =
      agentId != null
        ? buildApiUrl(`/api/network-monitoring/speedtest/agent/${agentId}/history?days=${days}`)
        : aziendaId != null
          ? buildApiUrl(`/api/network-monitoring/speedtest/company/${aziendaId}/history?days=${days}`)
          : null;
    if (!url) {
      setHistory([]);
      setCompanyInfo(null);
      return;
    }
    console.info('[SpeedTest] richiesta cronologia', url);
    try {
      setHistoryLoading(true);
      const res = await fetch(url, {
        headers: getAuthHeader()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('Speed test cronologia: risposta HTTP', res.status, data);
        setHistory([]);
        setCompanyInfo(null);
        return;
      }
      if (data.success) {
        setHistory(data.history || []);
        setCompanyInfo(data.company || null);
      } else {
        console.error('Speed test cronologia: success false', data);
        setHistory([]);
        setCompanyInfo(null);
      }
    } catch (err) {
      console.error('Errore caricamento cronologia speed test:', err);
      setHistory([]);
      setCompanyInfo(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [getAuthHeader]);

  // Toggle speed test attivo/disattivo
  const toggleSpeedTest = async (agentId, enabled, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(buildApiUrl(`/api/network-monitoring/speedtest/toggle/${agentId}`), {
        method: 'PUT',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const data = await res.json();
      if (data.success) {
        // Aggiorna panoramica locale
        setOverview(prev => prev.map(c =>
          c.agent_id === parseInt(agentId) ? { ...c, speedtest_enabled: enabled } : c
        ));
        // Aggiorna info azienda se siamo nel dettaglio
        if (companyInfo && companyInfo.agent_id === parseInt(agentId)) {
          setCompanyInfo(prev => ({ ...prev, speedtest_enabled: enabled }));
        }
      }
    } catch (err) {
      console.error('Errore toggle speed test:', err);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Quando si seleziona una card, carica cronologia (agent o azienda)
  useEffect(() => {
    if (selectedCompany && (selectedCompany.agentId != null || selectedCompany.aziendaId != null)) {
      fetchHistory(selectedCompany, historyDays);
    }
  }, [selectedCompany, historyDays, fetchHistory]);

  useEffect(() => {
    setHistoryDayFilter(null);
    setDayPickerOpen(false);
    setDaySearchInput('');
  }, [selectedCompany, historyDays]);

  const daysWithDataSet = useMemo(() => {
    const s = new Set();
    for (const row of history) {
      const k = ymdLocalFromTestDate(row.test_date);
      if (k) s.add(k);
    }
    return s;
  }, [history]);

  const historyFiltered = useMemo(() => {
    if (!historyDayFilter) return history;
    return history.filter((r) => ymdLocalFromTestDate(r.test_date) === historyDayFilter);
  }, [history, historyDayFilter]);

  useEffect(() => {
    if (!dayPickerOpen) return;
    const onDown = (e) => {
      if (dayPickerWrapRef.current && !dayPickerWrapRef.current.contains(e.target)) {
        setDayPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dayPickerOpen]);

  const drawChart = useCallback(() => {
    const series = historyFiltered;
    const canvas = chartCanvasRef.current;
    const container = chartContainerRef.current;
    if (!canvas || !container || !series || series.length === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const padL = 55;
    const padR = 55;
    const padT = 15;
    const padB = 35;
    const cW = W - padL - padR;
    const cH = H - padT - padB;

    const firstYmd = ymdLocalFromTestDate(series[0]?.test_date);
    const sameCalendarDay =
      firstYmd != null && series.every((r) => ymdLocalFromTestDate(r.test_date) === firstYmd);

    const downloads = series.map((d) => d.download_mbps || 0);
    const uploads = series.map((d) => d.upload_mbps || 0);
    const pings = series.map((d) => d.ping_ms || 0);
    const maxMbps = Math.max(Math.ceil(Math.max(...downloads, ...uploads) / 10) * 10 + 10, 20);
    const maxPing = Math.max(Math.ceil(Math.max(...pings) / 5) * 5 + 5, 10);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padT + (cH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(maxMbps - (maxMbps / gridLines) * i)}`, padL - 8, y + 4);
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(maxPing - (maxPing / gridLines) * i)} ms`, W - padR + 8, y + 4);
    }

    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    const n = series.length;
    const step = Math.max(1, Math.floor(n / 7));
    const xLabel = (idx) => {
      const d = new Date(series[idx].test_date);
      if (sameCalendarDay) {
        return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      }
      return `${d.getDate()}/${d.getMonth() + 1}`;
    };
    for (let i = 0; i < n; i += step) {
      const x = padL + (cW / Math.max(n - 1, 1)) * i;
      ctx.fillText(xLabel(i), x, H - 8);
    }
    if (n > 1) {
      const xLast = padL + cW;
      ctx.fillText(xLabel(n - 1), xLast, H - 8);
    }

    const drawLine = (values, maxV, color, lineW) => {
      if (values.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      values.forEach((v, i) => {
        const x = padL + (cW / Math.max(values.length - 1, 1)) * i;
        const y = padT + cH - (v / maxV) * cH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW + 6;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      values.forEach((v, i) => {
        const x = padL + (cW / Math.max(values.length - 1, 1)) * i;
        const y = padT + cH - (v / maxV) * cH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };

    drawLine(downloads, maxMbps, '#7c3aed', 2.5);
    drawLine(uploads, maxMbps, '#06b6d4', 2.5);
    drawLine(pings, maxPing, '#22c55e', 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.save();
    ctx.translate(14, padT + cH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Mbps', 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(W - 10, padT + cH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Ping (ms)', 0, 0);
    ctx.restore();
  }, [historyFiltered]);

  // Disegna il grafico quando cambiano i dati (serve almeno un segmento)
  useEffect(() => {
    if (selectedCompany && historyFiltered.length > 1 && chartCanvasRef.current && chartContainerRef.current) {
      drawChart();
    }
  }, [historyFiltered, selectedCompany, drawChart]);

  // Ridisegna i grafico al resize
  useEffect(() => {
    const handleResize = () => {
      if (selectedCompany && historyFiltered.length > 1) drawChart();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedCompany, historyFiltered, drawChart]);

  // === Helpers ===
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const fmtPing = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : '—';
  };
  const fmtMbps = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1) : '—';
  };

  const historyTableRows = useMemo(
    () =>
      [...historyFiltered]
        .sort((a, b) => new Date(b.test_date) - new Date(a.test_date))
        .slice(0, SPEEDTEST_DETAIL_TABLE_MAX_ROWS),
    [historyFiltered]
  );

  // Filtra per ricerca
  const filteredOverview = overview.filter(c =>
    (c.azienda_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = overview.filter(c => c.speedtest_enabled !== false).length;
  const disabledCount = overview.filter(c => c.speedtest_enabled === false).length;

  /** Base tempo per “Ultimo controllo: X fa” (si aggiorna ogni 30s insieme a heartbeatTick). */
  const lastSeenNowMs = useMemo(() => Date.now(), [heartbeatTick]);

  /** Speedtest attivo ma nessun rilevamento da >2h (o mai ricevuto). */
  const staleSpeedtestRows = useMemo(() => {
    const now = lastSeenNowMs;
    return overview.filter((c) => {
      if (c.speedtest_enabled === false) return false;
      if (c.test_date == null || c.test_date === '') return true;
      const t = new Date(c.test_date).getTime();
      if (Number.isNaN(t)) return true;
      return now - t > SPEEDTEST_STALE_AFTER_MS;
    });
  }, [overview, lastSeenNowMs]);

  // === STILE INLINE (tema scuro speedtest.net) ===
  const styles = {
    page: {
      position: 'fixed',
      inset: 0,
      background: '#0f172a',
      color: '#e2e8f0',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      zIndex: 2147483000,
      pointerEvents: 'auto',
      overflowY: 'auto',
      WebkitTapHighlightColor: 'transparent'
    },
    header: {
      background: '#1e293b',
      borderBottom: '1px solid #334155',
      padding: '16px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px'
    },
    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    },
    headerIcon: {
      width: 40, height: 40,
      background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
      borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    filterBar: {
      padding: '16px 32px',
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    searchInput: {
      background: '#1e293b',
      border: '1px solid #334155',
      color: '#e2e8f0',
      padding: '8px 14px',
      borderRadius: 8,
      fontSize: 14,
      width: 280,
      outline: 'none',
      fontFamily: 'inherit'
    },
    statsBar: {
      display: 'flex',
      gap: 16,
      marginLeft: 'auto',
      fontSize: 13,
      color: '#94a3b8'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
      gap: 20,
      padding: '0 32px 32px',
      position: 'relative',
      zIndex: 1
    },
    cardOuter: (clickable, speedtestOn, isHovered) => ({
      position: 'relative',
      background: '#1e293b',
      border: `1px solid ${isHovered && clickable ? '#7c3aed' : '#334155'}`,
      borderRadius: 16,
      padding: 24,
      transition: 'all 0.3s ease',
      opacity: clickable ? (speedtestOn ? 1 : 0.88) : 0.5,
      transform: isHovered && clickable ? 'translateY(-2px)' : 'none',
      boxShadow: isHovered && clickable ? '0 8px 32px rgba(124, 58, 237, 0.15)' : 'none'
    }),
    cardBody: {
      display: 'block',
      width: '100%',
      margin: 0,
      padding: 0,
      paddingRight: 8,
      border: 'none',
      background: 'transparent',
      textAlign: 'left',
      color: 'inherit',
      fontFamily: 'inherit',
      position: 'relative',
      zIndex: 1,
      userSelect: 'none'
    },
    toggle: (active) => ({
      width: 44, height: 24,
      background: active ? '#22c55e' : '#475569',
      borderRadius: 12,
      position: 'relative',
      cursor: 'pointer',
      transition: 'background 0.3s',
      border: 'none',
      padding: 0,
      flexShrink: 0
    }),
    toggleDot: (active) => ({
      width: 18, height: 18,
      background: 'white',
      borderRadius: '50%',
      position: 'absolute',
      top: 3,
      left: active ? 23 : 3,
      transition: 'left 0.3s'
    }),
    gaugeWrap: {
      width: 100,
      height: 100,
      margin: '0 auto 8px',
      position: 'relative'
    },
    gaugeRing: (pct, colorVar) => ({
      position: 'absolute',
      inset: 0,
      borderRadius: '50%',
      background: `conic-gradient(${colorVar} ${pct}%, #334155 0)`,
      WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
      mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
      pointerEvents: 'none',
      zIndex: 0
    }),
    gaugeInner: {
      position: 'absolute',
      inset: 4,
      borderRadius: '50%',
      background: '#1e293b',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1
    },
    detailGaugeWrap: {
      width: 160,
      height: 160,
      margin: '0 auto 12px',
      position: 'relative'
    },
    detailGaugeRing: (pct, colorVar) => ({
      position: 'absolute',
      inset: 0,
      borderRadius: '50%',
      background: `conic-gradient(${colorVar} ${pct}%, #1e293b 0)`,
      WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))',
      mask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))',
      pointerEvents: 'none',
      zIndex: 0
    }),
    detailGaugeInner: {
      position: 'absolute',
      inset: 6,
      borderRadius: '50%',
      background: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1
    },
    backBtnSquare: {
      width: 44,
      height: 44,
      minWidth: 44,
      flexShrink: 0,
      background: '#334155',
      border: 'none',
      color: '#e2e8f0',
      borderRadius: 8,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      fontFamily: 'inherit',
      transition: 'background 0.2s',
      alignSelf: 'flex-start',
      marginTop: 2
    },
    chartSection: {
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: 16,
      padding: 24
    },
    periodBtn: (active) => ({
      background: active ? '#7c3aed' : '#334155',
      border: 'none',
      color: active ? 'white' : '#94a3b8',
      padding: '6px 14px',
      borderRadius: 6,
      fontSize: 13,
      fontFamily: 'inherit',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s'
    }),
    disabledBadge: {
      display: 'inline-block',
      background: '#7f1d1d',
      color: '#fca5a5',
      fontSize: 11,
      fontWeight: 600,
      padding: '3px 10px',
      borderRadius: 6
    }
  };

  // === COMPONENTE CARD ===
  const CompanyCard = ({ company }) => {
    const [hovered, setHovered] = useState(false);
    const enabled = company.speedtest_enabled !== false;
    const agentIdNum = resolveAgentIdFromRow(company);
    const aziendaIdNum = resolveAziendaIdFromRow(company);
    const canOpenDetail = agentIdNum != null || aziendaIdNum != null;
    const hasData = Boolean(
      company.test_date != null &&
        company.ping_ms != null &&
        !Number.isNaN(Number(company.ping_ms))
    );
    const pqPing = enabled && hasData ? pingQuality(company.ping_ms) : { color: '#475569', pct: 0, label: 'PING' };
    const dqDown = enabled && hasData ? downloadQuality(company.download_mbps) : { color: '#475569', pct: 0, label: 'DOWNLOAD' };
    const uqUp = enabled && hasData ? uploadQuality(company.upload_mbps) : { color: '#475569', pct: 0, label: 'UPLOAD' };

    const openDetail = () => {
      if (!canOpenDetail) {
        console.warn('[SpeedTest] Impossibile aprire dettaglio: mancano agent_id e azienda_id', company);
        return;
      }
      console.info('[SpeedTest] apertura dettaglio', {
        agent_id: agentIdNum,
        azienda_id: aziendaIdNum,
        nome: company.azienda_name || company.agent_name
      });
      const snapshot =
        company.test_date != null &&
        company.ping_ms != null &&
        !Number.isNaN(Number(company.ping_ms))
          ? {
              test_date: company.test_date,
              ping_ms: company.ping_ms,
              download_mbps: company.download_mbps,
              upload_mbps: company.upload_mbps,
              isp: company.isp,
              public_ip: company.public_ip,
              server_name: company.server_name,
              result_url: company.result_url
            }
          : null;
      setSelectedCompany({
        agentId: agentIdNum,
        aziendaId: aziendaIdNum,
        aziendaName: company.azienda_name || company.aziendaName || company.agent_name || 'Agent',
        snapshot,
        lastHeartbeatFromOverview: company.last_heartbeat ?? company.lastHeartbeat ?? null,
        download_vs_hist_pct: company.download_vs_hist_pct ?? company.downloadVsHistPct ?? null,
        upload_vs_hist_pct: company.upload_vs_hist_pct ?? company.uploadVsHistPct ?? null,
        public_ip_stability: company.public_ip_stability ?? company.publicIpStability ?? null
      });
      // Se l'utente era molto in basso nella griglia, al passaggio alla vista dettaglio
      // l'altezza contenuti cambia e il browser può "clampare" lo scroll in modo brusco.
      // Portiamo intenzionalmente la vista in alto così l'intestazione del dettaglio è sempre visibile.
      window.requestAnimationFrame(() => {
        try {
          if (pageScrollRef.current) pageScrollRef.current.scrollTop = 0;
        } catch { /* ignore */ }
      });
    };

    /**
     * Apertura da click nativo: il browser emette `click` solo se press/release restano
     * un’interazione coerente sulla card (evita pointerup “orfani” su un’altra card).
     * Il toggle ferma la propagazione del click sul wrapper.
     */
    const onCardClick = (e) => {
      if (!canOpenDetail) return;
      if (typeof e.target?.closest === 'function' && e.target.closest('[data-st-toggle-wrap]')) return;
      openDetail();
    };

    return (
      <div
        style={{
          ...styles.cardOuter(canOpenDetail, enabled, hovered),
          cursor: canOpenDetail ? 'pointer' : 'default',
          touchAction: 'manipulation'
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onCardClick}
        onKeyDown={(e) => {
          if (!canOpenDetail) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDetail();
          }
        }}
        tabIndex={canOpenDetail ? 0 : -1}
        role="group"
        aria-label={canOpenDetail ? 'Apri cronologia speed test' : 'Card speed test'}
      >
        <div style={styles.cardBody}>
          {/* Intestazione (spazio a destra per toggle assoluto) */}
          <div style={{ paddingRight: 100, marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{company.azienda_name || company.agent_name || 'N/A'}</div>
            <div
              style={{
                marginTop: 6,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '4px 10px',
                fontSize: 11,
                color: '#64748b',
                lineHeight: 1.35
              }}
            >
              <span>{hasData ? `🕐 ${formatDate(company.test_date)}` : 'Speed test: nessun dato'}</span>
              {(() => {
                const seen = formatAgentLastSeen(company.last_heartbeat ?? company.lastHeartbeat, lastSeenNowMs);
                return (
                  <span
                    title={seen.detailTitle ?? 'Ultimo check-in dell’agent verso il server'}
                    style={{ color: seen.isStale ? '#fbbf24' : '#94a3b8', fontWeight: seen.isStale ? 600 : 500, whiteSpace: 'nowrap' }}
                  >
                    {seen.line}
                    {seen.absoluteShort ? (
                      <span style={{ opacity: 0.82, fontWeight: 500 }}>{' · '}{seen.absoluteShort}</span>
                    ) : null}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Info ISP */}
          <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
            {enabled && hasData ? (
              <>
                <Globe size={14} />
                {company.isp || '—'} &nbsp;·&nbsp;
                <span style={{ color: '#7c3aed', fontFamily: 'monospace', fontSize: 11 }}>
                  {company.public_ip || '—'}
                  {(() => {
                    const p = publicIpStabilityParen(company.public_ip_stability ?? company.publicIpStability);
                    if (!p || !(company.public_ip || '').trim()) return null;
                    return (
                      <span
                        style={{ color: p.color, fontFamily: 'inherit', fontWeight: 700, fontSize: 10 }}
                        title={PUBLIC_IP_STABILITY_TOOLTIP}
                      >
                        {' '}
                        {p.text}
                      </span>
                    );
                  })()}
                </span>
              </>
            ) : enabled ? (
              <span>Nessun risultato speed test disponibile per questa azienda.</span>
            ) : (
              'Speed test disattivato: attiva il toggle per raccogliere misure da questo agent.'
            )}
          </div>

          {/* Gauge */}
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 8 }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={styles.gaugeWrap}>
                <div style={styles.gaugeRing(enabled && hasData ? pqPing.pct : 0, pqPing.color)} />
                <div style={styles.gaugeInner}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: enabled ? '#f1f5f9' : '#475569', lineHeight: 1.1 }}>
                    {enabled && hasData ? fmtPing(company.ping_ms) : '—'}
                  </span>
                  <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{enabled && hasData ? 'ms' : ''}</span>
                </div>
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 0.2,
                  lineHeight: 1.25,
                  color: pqPing.color,
                  marginTop: 2,
                  padding: '0 2px'
                }}
              >
                {pqPing.label}
              </div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={styles.gaugeWrap}>
                <div style={styles.gaugeRing(enabled && hasData ? dqDown.pct : 0, dqDown.color)} />
                <div style={styles.gaugeInner}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'center', gap: '2px 4px' }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: enabled ? '#f1f5f9' : '#475569', lineHeight: 1.1 }}>
                      {enabled && hasData ? fmtMbps(company.download_mbps) : '—'}
                    </span>
                    {enabled && hasData && company.download_vs_hist_pct != null && (
                      <span
                        style={{ fontSize: 10, fontWeight: 700, color: vsHistoricalPctColor(company.download_vs_hist_pct) }}
                        title="Scostamento vs media storica DOWNLOAD (ultimi 60 giorni conservati, escluso questo test). Il tier colore può restare buono anche con percentuale negativa: qui vedi il calo rispetto al solito."
                      >
                        {formatVsHistoricalPct(company.download_vs_hist_pct)}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{enabled && hasData ? 'Mbps' : ''}</span>
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.2, lineHeight: 1.25, color: dqDown.color, marginTop: 2, padding: '0 2px' }}>{dqDown.label}</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={styles.gaugeWrap}>
                <div style={styles.gaugeRing(enabled && hasData ? uqUp.pct : 0, uqUp.color)} />
                <div style={styles.gaugeInner}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'center', gap: '2px 4px' }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: enabled ? '#f1f5f9' : '#475569', lineHeight: 1.1 }}>
                      {enabled && hasData ? fmtMbps(company.upload_mbps) : '—'}
                    </span>
                    {enabled && hasData && company.upload_vs_hist_pct != null && (
                      <span
                        style={{ fontSize: 10, fontWeight: 700, color: vsHistoricalPctColor(company.upload_vs_hist_pct) }}
                        title="Scostamento vs media storica UPLOAD (ultimi 60 giorni conservati, escluso questo test)."
                      >
                        {formatVsHistoricalPct(company.upload_vs_hist_pct)}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{enabled && hasData ? 'Mbps' : ''}</span>
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.2, lineHeight: 1.25, color: uqUp.color, marginTop: 2, padding: '0 2px' }}>{uqUp.label}</div>
            </div>
          </div>
        </div>

        <div
          data-st-toggle-wrap
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 2,
            width: 'fit-content',
            maxWidth: 140,
            pointerEvents: 'auto'
          }}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {!enabled && <span style={styles.disabledBadge}>Disattivato</span>}
          <button
            type="button"
            style={styles.toggle(enabled)}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const aid = agentIdNum ?? resolveAgentIdFromRow(company);
              if (aid == null) return;
              toggleSpeedTest(aid, !enabled, e);
            }}
            title={enabled ? 'Disattiva speed test' : 'Attiva speed test'}
          >
            <div style={styles.toggleDot(enabled)} />
          </button>
        </div>
      </div>
    );
  };

  // === RENDER ===
  if (selectedCompany) {
    // VISTA DETTAGLIO AZIENDA — con filtro giorno: ultima misura di quel giorno; senza filtro: ultimo del periodo o snapshot card
    const lastFromHistoryFull = history.length > 0 ? history[history.length - 1] : null;
    const lastFromDayFiltered =
      historyFiltered.length > 0 ? historyFiltered[historyFiltered.length - 1] : null;
    const lastResult = historyDayFilter
      ? lastFromDayFiltered
      : lastFromHistoryFull || selectedCompany.snapshot || null;
    const enabled = companyInfo?.speedtest_enabled !== false;
    const downloadVsHistDetail =
      pctVsPriorAvgFromHistory(history, 'download_mbps') ?? selectedCompany.download_vs_hist_pct ?? null;
    const uploadVsHistDetail =
      pctVsPriorAvgFromHistory(history, 'upload_mbps') ?? selectedCompany.upload_vs_hist_pct ?? null;
    const publicIpStabilityDetail = resolvePublicIpStabilityFromDetail(
      history,
      selectedCompany.public_ip_stability ?? selectedCompany.publicIpStability
    );
    const publicIpStabLabel = publicIpStabilityParen(publicIpStabilityDetail);

    return createPortal(
      <div style={styles.page} ref={pageScrollRef}>
        {/* Intestazione */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <SectionNavMenu
              currentPage="speedtest"
              onNavigateHome={onNavigateHome}
              onNavigateOffice={onNavigateOffice}
              onNavigateEmail={onNavigateEmail}
              onNavigateAntiVirus={onNavigateAntiVirus}
              onNavigateNetworkMonitoring={onNavigateNetworkMonitoring}
              onNavigateMappatura={onNavigateMappatura}
              onNavigateDispositiviAziendali={onNavigateDispositiviAziendali}
              currentUser={currentUser}
              selectedCompanyId={selectedCompanyId}
            />
            <div style={styles.headerIcon}>
              <Gauge size={20} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Speed Test Dashboard</h1>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>Monitoraggio velocità connessione · Solo tecnici</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
                Build: <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{SPEEDTEST_BUILD_MARK}</span>
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding: 32 }}>
          {/* Intestazione azienda: indietro (quadrato) + nome + toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
            <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <button
                  type="button"
                  aria-label="Torna alla panoramica"
                  title="Torna alla panoramica"
                  style={styles.backBtnSquare}
                  onClick={() => { setSelectedCompany(null); setHistory([]); setCompanyInfo(null); }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#475569'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#334155'; }}
                >
                  <ArrowLeft size={22} strokeWidth={2.25} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', margin: 0, lineHeight: 1.15 }}>
                    {companyInfo?.azienda_name || selectedCompany.aziendaName}
                  </h2>
                  <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                    {historyDayFilter ? (
                      <>
                        Giorno <strong style={{ color: '#e2e8f0' }}>{ymdToItDisplay(historyDayFilter)}</strong>
                        {' · '}
                        ultima misura: {lastResult ? formatDate(lastResult.test_date) : '—'}
                      </>
                    ) : (
                      <>Ultimo test nel periodo: {lastResult ? formatDate(lastResult.test_date) : '—'}</>
                    )}
                  </div>
                  {(() => {
                const seen = formatAgentLastSeen(
                  companyInfo?.last_heartbeat ?? companyInfo?.lastHeartbeat ?? selectedCompany.lastHeartbeatFromOverview,
                  lastSeenNowMs
                );
                return (
                  <div
                    style={{ fontSize: 12, color: seen.isStale ? '#fbbf24' : '#64748b', marginTop: 6, fontWeight: seen.isStale ? 600 : 500 }}
                    title={seen.detailTitle ?? 'Ultimo heartbeat verso il server'}
                  >
                    {seen.line}
                    {seen.absoluteShort ? (
                      <span style={{ opacity: 0.85, fontWeight: 500 }}>{' · '}{seen.absoluteShort}</span>
                    ) : null}
                  </div>
                );
                  })()}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94a3b8' }}>
              <span>Speed Test</span>
              <button
                type="button"
                style={styles.toggle(enabled)}
                onClick={() => companyInfo && toggleSpeedTest(companyInfo.agent_id, !enabled)}
              >
                <div style={styles.toggleDot(enabled)} />
              </button>
            </div>
          </div>

          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: 12 }}>Caricamento dati...</p>
            </div>
          ) : (
            <>
              {/* Gauge grandi */}
              {lastResult && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginBottom: 16, flexWrap: 'wrap' }}>
                    {/* Ping */}
                    <div style={{ textAlign: 'center' }}>
                      {(() => {
                        const pq = pingQuality(lastResult.ping_ms);
                        return (
                          <>
                            <div style={styles.detailGaugeWrap}>
                              <div style={styles.detailGaugeRing(pq.pct, pq.color)} />
                              <div style={styles.detailGaugeInner}>
                                <span style={{ fontSize: 36, fontWeight: 900, color: '#f1f5f9', lineHeight: 1.1 }}>
                                  {fmtPing(lastResult.ping_ms)}
                                </span>
                                <span style={{ fontSize: 14, color: '#94a3b8' }}>ms</span>
                              </div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: pq.color, lineHeight: 1.3, maxWidth: 220, margin: '0 auto' }}>{pq.label}</div>
                          </>
                        );
                      })()}
                    </div>
                    {/* Download */}
                    <div style={{ textAlign: 'center' }}>
                      {(() => {
                        const dq = downloadQuality(lastResult.download_mbps);
                        return (
                          <>
                            <div style={styles.detailGaugeWrap}>
                              <div style={styles.detailGaugeRing(dq.pct, dq.color)} />
                              <div style={styles.detailGaugeInner}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'center', gap: '4px 8px' }}>
                                  <span style={{ fontSize: 36, fontWeight: 900, color: '#f1f5f9', lineHeight: 1.1 }}>
                                    {fmtMbps(lastResult.download_mbps)}
                                  </span>
                                  {downloadVsHistDetail != null && (
                                    <span
                                      style={{ fontSize: 17, fontWeight: 700, color: vsHistoricalPctColor(downloadVsHistDetail) }}
                                      title="Vs media storica: nella panoramica usa 60 giorni (escluso ultimo test); nel dettaglio, se disponibile, la cronologia caricata."
                                    >
                                      {formatVsHistoricalPct(downloadVsHistDetail)}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: 14, color: '#94a3b8' }}>Mbps</span>
                              </div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: dq.color, lineHeight: 1.3, maxWidth: 260, margin: '0 auto' }}>{dq.label}</div>
                          </>
                        );
                      })()}
                    </div>
                    {/* Upload */}
                    <div style={{ textAlign: 'center' }}>
                      {(() => {
                        const uq = uploadQuality(lastResult.upload_mbps);
                        return (
                          <>
                            <div style={styles.detailGaugeWrap}>
                              <div style={styles.detailGaugeRing(uq.pct, uq.color)} />
                              <div style={styles.detailGaugeInner}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'center', gap: '4px 8px' }}>
                                  <span style={{ fontSize: 36, fontWeight: 900, color: '#f1f5f9', lineHeight: 1.1 }}>
                                    {fmtMbps(lastResult.upload_mbps)}
                                  </span>
                                  {uploadVsHistDetail != null && (
                                    <span
                                      style={{ fontSize: 17, fontWeight: 700, color: vsHistoricalPctColor(uploadVsHistDetail) }}
                                      title="Vs media storica UPLOAD (stessa logica del download)."
                                    >
                                      {formatVsHistoricalPct(uploadVsHistDetail)}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: 14, color: '#94a3b8' }}>Mbps</span>
                              </div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: uq.color, lineHeight: 1.3, maxWidth: 260, margin: '0 auto' }}>{uq.label}</div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Info connessione */}
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, marginBottom: 40, display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Globe size={14} /> Operatore: <strong style={{ color: '#e2e8f0' }}>{lastResult.isp || '—'}</strong>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Wifi size={14} /> IP Pubblico:{' '}
                      <strong style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{lastResult.public_ip || '—'}</strong>
                      {publicIpStabLabel && (lastResult.public_ip || '').trim() ? (
                        <span
                          style={{ color: publicIpStabLabel.color, fontWeight: 700, fontSize: 13 }}
                          title={PUBLIC_IP_STABILITY_TOOLTIP}
                        >
                          {' '}
                          {publicIpStabLabel.text}
                        </span>
                      ) : null}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ServerIcon size={14} /> Server: <strong style={{ color: '#e2e8f0' }}>{lastResult.server_name || '—'}</strong>
                    </span>
                  </div>

                  {lastResult.result_url ? (
                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                      <a
                        href={lastResult.result_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#a78bfa', fontSize: 14, fontWeight: 600 }}
                      >
                        Apri pagina risultato speedtest.net →
                      </a>
                    </div>
                  ) : null}
                </>
              )}

              {!lastResult && (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                  <Activity size={40} style={{ marginBottom: 12 }} />
                  <p>Nessun risultato speed test disponibile per questa azienda.</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>Il primo test verrà eseguito dall'agent entro 2 ore.</p>
                </div>
              )}

              {/* Grafico cronologia + tabella ultime misure */}
              {!historyLoading && history.length >= 1 && (
                <div style={styles.chartSection}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>📈 Cronologia</h3>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {[7, 14, 30, 60].map((d) => (
                        <button key={d} type="button" style={styles.periodBtn(historyDays === d)} onClick={() => setHistoryDays(d)}>
                          {d}g
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    ref={dayPickerWrapRef}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 18,
                      position: 'relative',
                      zIndex: 5
                    }}
                  >
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Giorno</span>
                    <input
                      type="text"
                      value={daySearchInput}
                      onChange={(e) => setDaySearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const ymd = parseItalianDayInput(daySearchInput, daysWithDataSet);
                          if (ymd) {
                            setHistoryDayFilter(ymd);
                            setDaySearchInput(ymdToItDisplay(ymd));
                          }
                        }
                      }}
                      placeholder="gg/mm/aaaa"
                      style={{
                        width: 118,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid #475569',
                        background: '#0f172a',
                        color: '#e2e8f0',
                        fontSize: 13,
                        fontFamily: 'inherit'
                      }}
                      title="Inserisci una data con test (anche senza zeri iniziali). Solo giorni evidenziati in calendario hanno misure."
                      aria-label="Cerca giorno per data"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const ymd = parseItalianDayInput(daySearchInput, daysWithDataSet);
                        if (ymd) {
                          setHistoryDayFilter(ymd);
                          setDaySearchInput(ymdToItDisplay(ymd));
                        }
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#475569',
                        color: '#e2e8f0',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                    >
                      Vai
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (historyDayFilter) {
                          const [yy, mm, dd] = historyDayFilter.split('-').map(Number);
                          setDayPickerMonth(new Date(yy, mm - 1, 1));
                        } else if (history.length > 0) {
                          const d = new Date(history[history.length - 1].test_date);
                          setDayPickerMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                        } else {
                          setDayPickerMonth(new Date());
                        }
                        setDayPickerOpen((o) => !o);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: dayPickerOpen ? '#7c3aed' : '#334155',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                      title="Calendario: solo i giorni con almeno un speed test sono cliccabili"
                    >
                      <Calendar size={16} /> Calendario
                    </button>
                    {historyDayFilter ? (
                      <button
                        type="button"
                        onClick={() => {
                          setHistoryDayFilter(null);
                          setDaySearchInput('');
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #64748b',
                          background: 'transparent',
                          color: '#94a3b8',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit'
                        }}
                      >
                        Tutto il periodo
                      </button>
                    ) : null}

                    {dayPickerOpen ? (
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '100%',
                          marginTop: 8,
                          width: 288,
                          background: '#1e293b',
                          border: '1px solid #475569',
                          borderRadius: 12,
                          padding: 12,
                          boxShadow: '0 12px 40px rgba(0,0,0,0.45)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <button
                            type="button"
                            onClick={() => setDayPickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
                            aria-label="Mese precedente"
                          >
                            <ChevronLeft size={22} />
                          </button>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', textTransform: 'capitalize' }}>
                            {dayPickerMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDayPickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
                            aria-label="Mese successivo"
                          >
                            <ChevronRight size={22} />
                          </button>
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, 1fr)',
                            gap: 4,
                            textAlign: 'center',
                            fontSize: 10,
                            color: '#64748b',
                            fontWeight: 600,
                            marginBottom: 6
                          }}
                        >
                          {['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'].map((w) => (
                            <span key={w}>{w}</span>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                          {(() => {
                            const calY = dayPickerMonth.getFullYear();
                            const calM = dayPickerMonth.getMonth();
                            const first = new Date(calY, calM, 1);
                            const startPad = (first.getDay() + 6) % 7;
                            const dim = new Date(calY, calM + 1, 0).getDate();
                            const cells = [];
                            for (let i = 0; i < startPad; i++) {
                              cells.push(<span key={`e-${i}`} />);
                            }
                            for (let dN = 1; dN <= dim; dN++) {
                              const ymd = `${calY}-${pad2(calM + 1)}-${pad2(dN)}`;
                              const hasData = daysWithDataSet.has(ymd);
                              const isSel = historyDayFilter === ymd;
                              cells.push(
                                <button
                                  key={ymd}
                                  type="button"
                                  disabled={!hasData}
                                  onClick={() => {
                                    if (!hasData) return;
                                    setHistoryDayFilter(ymd);
                                    setDaySearchInput(ymdToItDisplay(ymd));
                                    setDayPickerOpen(false);
                                  }}
                                  style={{
                                    height: 32,
                                    borderRadius: 8,
                                    border: isSel ? '2px solid #a78bfa' : '1px solid transparent',
                                    background: !hasData ? '#0f172a' : isSel ? '#5b21b6' : '#334155',
                                    color: !hasData ? '#475569' : '#f1f5f9',
                                    fontSize: 13,
                                    fontWeight: hasData ? 600 : 400,
                                    cursor: hasData ? 'pointer' : 'not-allowed',
                                    fontFamily: 'inherit',
                                    padding: 0,
                                    lineHeight: 1
                                  }}
                                  title={hasData ? `${ymdToItDisplay(ymd)} · clic per filtrare` : 'Nessun test in questa data'}
                                >
                                  {dN}
                                </button>
                              );
                            }
                            return cells;
                          })()}
                        </div>
                        <p style={{ margin: '12px 0 0', fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
                          In grigio i giorni senza misure nel periodo caricato ({historyDays}g).
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {historyFiltered.length > 1 ? (
                    <>
                      <div style={{ display: 'flex', gap: 20, marginBottom: 16, fontSize: 12, color: '#94a3b8', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 20, height: 3, borderRadius: 2, background: '#7c3aed', display: 'inline-block' }} />
                          DOWNLOAD (Mbps)
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 20, height: 3, borderRadius: 2, background: '#06b6d4', display: 'inline-block' }} />
                          UPLOAD (Mbps)
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 20, height: 3, borderRadius: 2, background: '#22c55e', display: 'inline-block' }} />
                          Ping (ms)
                        </span>
                      </div>
                      <div ref={chartContainerRef} style={{ width: '100%', height: 280, position: 'relative' }}>
                        <canvas ref={chartCanvasRef} style={{ width: '100%', height: '100%' }} />
                      </div>
                    </>
                  ) : (
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
                      {historyDayFilter
                        ? `Nella giornata ${ymdToItDisplay(historyDayFilter)} c’è una sola misura: servono almeno due punti per tracciare il grafico.`
                        : `Nel periodo selezionato c’è una sola misura: il grafico richiede almeno due punti. Estendi il periodo (es. 7g o 60g) o attendi i prossimi test dall’agent (circa ogni ${companyInfo?.speedtest_interval_hours ?? 2} h).`}
                    </p>
                  )}

                  <div style={{ marginTop: historyFiltered.length > 1 ? 28 : 0 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px' }}>Ultime misure</h4>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px', lineHeight: 1.45 }}>
                      Fino a <strong>{SPEEDTEST_DETAIL_TABLE_MAX_ROWS}</strong> righe
                      {historyDayFilter ? (
                        <> filtrate per <strong>{ymdToItDisplay(historyDayFilter)}</strong></>
                      ) : (
                        <> (le più recenti nel periodo scelto)</>
                      )}
                      . In database restano al massimo <strong>{SPEEDTEST_SERVER_RETENTION_DAYS} giorni</strong> di storico (~720 test a campionamento ogni 2 h).
                    </p>
                    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #334155' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'left' }}>
                            <th style={{ padding: '10px 12px', fontWeight: 600 }}>Data / ora</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600 }}>Ping</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600 }}>↓ Mbps</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600 }}>↑ Mbps</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600 }}>IP</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600 }}>ISP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyTableRows.map((row) => (
                            <tr key={row.id} style={{ borderTop: '1px solid #334155' }}>
                              <td style={{ padding: '10px 12px', color: '#e2e8f0', whiteSpace: 'nowrap' }}>{formatDate(row.test_date)}</td>
                              <td style={{ padding: '10px 12px', color: '#e2e8f0' }}>{fmtPing(row.ping_ms)} ms</td>
                              <td style={{ padding: '10px 12px', color: '#c4b5fd' }}>{fmtMbps(row.download_mbps)}</td>
                              <td style={{ padding: '10px 12px', color: '#67e8f9' }}>{fmtMbps(row.upload_mbps)}</td>
                              <td style={{ padding: '10px 12px', color: '#e9d5ff', fontFamily: 'monospace', fontSize: 11 }} title={row.public_ip || ''}>
                                {row.public_ip || '—'}
                              </td>
                              <td style={{ padding: '10px 12px', color: '#94a3b8', maxWidth: 200 }} title={row.isp || ''}>
                                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.isp || '—'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* CSS animazione spin */}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>,
      document.body
    );
  }

  // VISTA PANORAMICA
  return createPortal(
    <div style={styles.page} ref={pageScrollRef}>
      {/* Intestazione */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <SectionNavMenu
            currentPage="speedtest"
            onNavigateHome={onNavigateHome}
            onNavigateOffice={onNavigateOffice}
            onNavigateEmail={onNavigateEmail}
            onNavigateAntiVirus={onNavigateAntiVirus}
            onNavigateNetworkMonitoring={onNavigateNetworkMonitoring}
            onNavigateMappatura={onNavigateMappatura}
            onNavigateDispositiviAziendali={onNavigateDispositiviAziendali}
            currentUser={currentUser}
            selectedCompanyId={selectedCompanyId}
          />
          <div style={styles.headerIcon}>
            <Gauge size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Speed Test Dashboard</h1>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>Monitoraggio velocità connessione · Solo tecnici</p>
            <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
              Build: <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{SPEEDTEST_BUILD_MARK}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fetchOverview()}
          disabled={overviewRefreshing}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: overviewRefreshing ? 'wait' : 'pointer',
            padding: 8,
            borderRadius: 8,
            opacity: overviewRefreshing ? 0.65 : 1
          }}
          title={overviewRefreshing ? 'Aggiornamento in corso…' : 'Aggiorna elenco (i dati restano visibili)'}
        >
          <RefreshCw size={18} style={{ animation: overviewRefreshing ? 'spin 1s linear infinite' : undefined }} />
        </button>
      </div>

      {/* Barra filtri */}
      <div style={styles.filterBar}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Cerca azienda..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...styles.searchInput, paddingLeft: 34 }}
          />
        </div>
        <div style={{ position: 'relative', marginLeft: 'auto' }} ref={stalePopoverRef}>
          <div style={{ ...styles.statsBar, marginLeft: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              {activeCount} attivi
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b', display: 'inline-block' }} />
              {disabledCount} disattivati
            </span>
            <button
              type="button"
              onClick={() => setStaleListOpen((o) => !o)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                color: staleSpeedtestRows.length > 0 ? '#fb923c' : '#64748b',
                cursor: 'pointer',
                padding: 0,
                fontSize: 13
              }}
              title="Speedtest attivo ma nessun nuovo rilevamento da più di 2 ore (o mai arrivato). Clic per l’elenco."
            >
              <AlertTriangle size={14} />
              {staleSpeedtestRows.length} senza aggiorn. (&gt;2h)
            </button>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} /> Test ogni 2 ore
            </span>
          </div>
          {staleListOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 8,
                minWidth: 300,
                maxWidth: 440,
                maxHeight: 340,
                overflowY: 'auto',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 12,
                padding: 12,
                boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
                zIndex: 50
              }}
            >
              {staleSpeedtestRows.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.45 }}>
                  Nessuna azienda in ritardo: con speedtest attivo tutte hanno inviato almeno un rilevamento nelle ultime 2 ore.
                </p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {staleSpeedtestRows.map((row) => {
                    const id = row.agent_id ?? row.azienda_id;
                    return (
                      <li
                        key={id != null ? `stale-${id}` : `stale-${row.azienda_name}`}
                        style={{
                          padding: '10px 0',
                          borderBottom: '1px solid #334155',
                          fontSize: 13
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{row.azienda_name || '—'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, lineHeight: 1.35 }}>
                          {(row.agent_name && String(row.agent_name).trim()) ? `${row.agent_name} · ` : ''}
                          Ultimo rilevamento: {row.test_date ? formatDate(row.test_date) : 'nessuno'}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Griglia card */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12 }}>Caricamento dati speed test...</p>
        </div>
      ) : filteredOverview.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
          <Gauge size={40} style={{ marginBottom: 12 }} />
          <p>{searchTerm ? 'Nessuna azienda corrisponde alla ricerca.' : 'Nessun agent configurato. Configura un agent di monitoraggio per iniziare.'}</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredOverview.map((company, idx) => {
            return <CompanyCard key={speedtestRowKey(company)} company={company} />;
          })}
        </div>
      )}

      {/* CSS animazione spin */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>,
    document.body
  );
};

export default SpeedTestPage;
