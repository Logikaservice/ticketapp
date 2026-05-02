// Modal Analisi dispositivo: overview, test remoti, pattern, confronto con dispositivi simili
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  X, Activity, BarChart3, Cpu, Users, Loader, AlertTriangle,
  CheckCircle, WifiOff, Clock, Wifi, Server, Monitor, Printer,
  Router, Shield, HardDrive, ArrowUpRight, ArrowDownRight,
  Minus, ChevronDown, ChevronUp, Play, Timer
} from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import {
  getStoredTechHubAccent,
  techHubAccentModalHeaderStyle,
  HUB_PAGE_BG,
  hubModalCssVars
} from '../../utils/techHubAccent';
import { HubModalInnerCard } from './HubModalChrome';

/* ─── Helpers ─── */
const formatDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
};

const formatRelative = (d) => {
  if (!d) return '-';
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
};

const changeTypeLabel = (t) => {
  const map = {
    device_offline: 'Offline',
    device_online: 'Online',
    new_device: 'Nuovo',
    ip_changed: 'IP cambiato',
    mac_changed: 'MAC cambiato',
    ip_conflict: 'Conflitto IP'
  };
  return map[t] || t;
};

const deviceTypeIcon = (type) => {
  const t = (type || '').toLowerCase();
  if (t.includes('server')) return <Server className="w-4 h-4" />;
  if (t.includes('printer')) return <Printer className="w-4 h-4" />;
  if (t.includes('router') || t.includes('firewall')) return <Shield className="w-4 h-4" />;
  if (t.includes('switch') || t.includes('wifi') || t.includes('antenna') || t.includes('ap')) return <Wifi className="w-4 h-4" />;
  if (t.includes('nas') || t.includes('storage')) return <HardDrive className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
};

/* ─── Health Score Gauge ─── */
const HealthGauge = ({ score }) => {
  const s = score ?? 0;
  const color = s >= 70 ? '#16a34a' : s >= 40 ? '#d97706' : '#dc2626';
  const bg = s >= 70 ? '#dcfce7' : s >= 40 ? '#fef3c7' : '#fee2e2';
  const label = s >= 70 ? 'Buono' : s >= 40 ? 'Attenzione' : 'Critico';
  const r = 28, circ = 2 * Math.PI * r;
  const dash = circ * (s / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold" style={{ color }}>{s}</span>
        </div>
      </div>
      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: bg, color }}>{label}</span>
    </div>
  );
};

/* ─── Mini Bar Chart (pattern orario) ─── */
const HourlyChart = ({ data }) => {
  const maxVal = Math.max(...data.map(d => d.offline + d.online), 1);
  const hours = data.filter(d => d.offline > 0 || d.online > 0);
  if (hours.length === 0) return <p className="text-sm italic text-white/45">Nessun evento nel periodo.</p>;

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-end gap-1 min-w-max h-24">
        {data.map(({ hour, offline, online }) => {
          const total = offline + online;
          if (total === 0) return (
            <div key={hour} className="flex flex-col items-center gap-0.5 w-7">
              <div className="h-0.5 w-5 rounded bg-white/12" />
              <span className="text-[9px] text-white/35">{hour}</span>
            </div>
          );
          const offH = Math.round((offline / maxVal) * 72);
          const onH = Math.round((online / maxVal) * 72);
          return (
            <div key={hour} className="flex flex-col items-center gap-0.5 w-7" title={`${hour}:00 — ${offline} offline, ${online} online`}>
              <div className="flex flex-col-reverse items-center w-5 gap-px" style={{ height: 72 }}>
                {online > 0 && <div style={{ height: onH, minHeight: 4 }} className="w-full bg-green-400 rounded-sm" />}
                {offline > 0 && <div style={{ height: offH, minHeight: 4 }} className="w-full bg-red-400 rounded-sm" />}
              </div>
              <span className="text-[9px] text-white/45">{hour}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-2">
        <span className="flex items-center gap-1 text-xs text-white/55"><span className="inline-block h-2 w-3 rounded-sm bg-red-400" /> Offline</span>
        <span className="flex items-center gap-1 text-xs text-white/55"><span className="inline-block h-2 w-3 rounded-sm bg-green-400" /> Online</span>
      </div>
    </div>
  );
};

/* ─── Timeline Item ─── */
const TimelineItem = ({ ev }) => {
  const isOffline = ev.change_type === 'device_offline';
  const isOnline = ev.change_type === 'device_online' || ev.change_type === 'new_device';
  const isConflict = ev.change_type === 'ip_conflict';
  const isChange = ev.change_type === 'ip_changed' || ev.change_type === 'mac_changed';

  const duration = ev._offlineDurationLabel || null;

  const dotColor = isOffline ? 'bg-red-500' : isOnline ? 'bg-green-500' : isConflict ? 'bg-amber-500' : 'bg-blue-400';
  const Icon = isOffline ? ArrowDownRight : isOnline ? ArrowUpRight : isConflict ? AlertTriangle : Minus;
  const textColor = isOffline ? 'text-red-300' : isOnline ? 'text-emerald-300' : isConflict ? 'text-amber-200' : 'text-sky-300';

  return (
    <div className="relative flex gap-3 pb-4">
      <div className="flex flex-col items-center">
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-0.5 shrink-0 ring-2 ring-[#121212] z-10`} />
        <div className="mt-1 w-px flex-1 bg-white/12" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className={`w-3.5 h-3.5 ${textColor} shrink-0`} />
          <span className={`text-xs font-semibold ${textColor}`}>{changeTypeLabel(ev.change_type)}</span>
          <span className="text-xs text-white/45">{formatDate(ev.detected_at)}</span>
          {duration && (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-100">
              ⏱ {duration}
            </span>
          )}
        </div>
        {(ev.old_value || ev.new_value) && (
          <p className="mt-0.5 font-mono text-xs text-white/55">
            {isConflict
              ? `MAC 1: ${ev.old_value || '-'} · MAC 2: ${ev.new_value || '-'}`
              : `${ev.old_value ? `${ev.old_value} → ` : ''}${ev.new_value || ''}`}
          </p>
        )}
      </div>
    </div>
  );
};

/* ─── Main Component ─── */
export default function DeviceAnalysisModal({ isOpen, onClose, deviceId, deviceLabel, getAuthHeader, fullPage = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tests, setTests] = useState(null);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsWaitingAgent, setTestsWaitingAgent] = useState(false);
  const [periodDays, setPeriodDays] = useState(30);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [countdown, setCountdown] = useState(null); // secondi rimasti
  const countdownRef = useRef(null);
  const testSectionRef = useRef(null);
  const fetchAnalysisRef = useRef(null);
  const testsLoadingRef = useRef(false);
  testsLoadingRef.current = testsLoading;

  // Countdown timer per attesa agent
  const startCountdown = (seconds) => {
    setCountdown(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };
  const stopCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(null);
  };
  useEffect(() => () => stopCountdown(), []);

  const fetchAnalysis = useCallback(async () => {
    if (!deviceId || testsLoadingRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl(`/api/network-monitoring/device-analysis/${deviceId}?days=${periodDays}`), {
        headers: getAuthHeader()
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Errore ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [deviceId, periodDays, getAuthHeader]);

  fetchAnalysisRef.current = fetchAnalysis;

  useEffect(() => {
    if ((isOpen || fullPage) && deviceId && !testsLoadingRef.current) fetchAnalysisRef.current?.();
  }, [isOpen, fullPage, deviceId]);

  const runTests = async (e) => {
    e?.stopPropagation?.();
    if (!deviceId) return;
    setTests(null);
    stopCountdown();
    flushSync(() => {
      setTestsLoading(true);
      setTestsWaitingAgent(false);
    });
    testSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const minBannerMs = 1500;
    const bannerShownAt = Date.now();
    const ensureMinBanner = () => new Promise(resolve => {
      const elapsed = Date.now() - bannerShownAt;
      if (elapsed >= minBannerMs) return resolve();
      setTimeout(resolve, minBannerMs - elapsed);
    });
    try {
      const res = await fetch(buildApiUrl(`/api/network-monitoring/device-analysis/${deviceId}/run-tests`), {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Test falliti - risposta server non valida');
      const json = await res.json();
      if (json.deferred && json.task_id) {
        const taskId = json.task_id;
        flushSync(() => setTestsWaitingAgent(true));
        startCountdown(360); // 6 minuti di attesa max
        const deadline = Date.now() + 7 * 60 * 1000;
        const poll = async () => {
          if (Date.now() > deadline) {
            stopCountdown();
            setTestsWaitingAgent(false);
            setTests({ error: "Timeout: l'agent non ha risposto in 7 minuti. Verifica che l'agent sia attivo, poi riprova (l'agent riceve il task al prossimo heartbeat, ogni 5 min)." });
            setTestsLoading(false);
            return;
          }
          try {
            const r = await fetch(buildApiUrl(`/api/network-monitoring/device-test-result/${taskId}`), { headers: getAuthHeader() });
            const data = await r.json();
            if (data.status !== 'pending') {
              await ensureMinBanner();
              stopCountdown();
              setTestsWaitingAgent(false);
              setTests({
                ping: data.ping ?? null, ports: data.ports ?? null,
                profile: data.profile ?? null, profileLabel: data.profileLabel ?? null,
                device_type: data.device_type ?? null, error: data.error ?? null, _deferred: true
              });
              setTestsLoading(false);
              return;
            }
          } catch (_) { }
          setTimeout(poll, 2500);
        };
        setTimeout(poll, 2500);
        return;
      }
      await ensureMinBanner();
      stopCountdown();
      setTests(json);
    } catch (err) {
      await ensureMinBanner();
      stopCountdown();
      setTests({ error: err.message });
    } finally {
      if (!testsWaitingAgent) setTestsLoading(false);
    }
  };

  if (!fullPage && !isOpen) return null;

  const dev = data?.device || {};
  const health = data?.health || {};
  const comparison = data?.comparison || {};
  const pattern = data?.pattern?.by_hour || [];
  const sameNetwork = data?.same_network_issues || [];
  const timeline = data?.timeline || [];

  // Timeline ordinata dal più recente al più vecchio,
  // ma con durata offline calcolata in ordine cronologico
  const timelineChrono = [...timeline].sort(
    (a, b) => new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime()
  );
  for (let i = 1; i < timelineChrono.length; i += 1) {
    const ev = timelineChrono[i];
    const prev = timelineChrono[i - 1];
    const isOnline =
      ev.change_type === 'device_online' || ev.change_type === 'new_device';
    if (isOnline && prev && prev.change_type === 'device_offline') {
      const ms =
        new Date(ev.detected_at).getTime() -
        new Date(prev.detected_at).getTime();
      const min = Math.round(ms / 60000);
      const h = Math.floor(min / 60);
      // Salviamo l'etichetta sul singolo evento per poterla usare
      // anche quando visualizziamo in ordine inverso
      ev._offlineDurationLabel =
        h > 0 ? `${h}h ${min % 60}m offline` : `${min}m offline`;
    } else if (!ev._offlineDurationLabel) {
      ev._offlineDurationLabel = null;
    }
  }
  const timelineSorted = [...timelineChrono].sort(
    (a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
  );
  const visibleTimeline = timelineExpanded
    ? timelineSorted
    : timelineSorted.slice(0, 8);

  const inner = (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div
        className="shrink-0 border-b border-black/10 px-6 py-4"
        style={techHubAccentModalHeaderStyle(getStoredTechHubAccent())}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/20 ring-1 ring-black/10">
              <Activity className="h-5 w-5 opacity-95" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold leading-tight">Analisi Dispositivo</h2>
              <p className="mt-0.5 truncate text-sm opacity-90">
                {deviceLabel || dev.hostname || dev.ip_address || '…'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-black/20 p-1.5 ring-1 ring-black/10 transition-colors hover:bg-black/30"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Device Info Strip */}
        {dev.ip_address && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {dev.ip_address && (
              <span className="flex items-center gap-1 text-xs opacity-85">
                <span className="opacity-75">IP</span>
                <span className="font-mono font-medium opacity-95">{dev.ip_address}</span>
              </span>
            )}
            {dev.mac_address && (
              <span className="flex items-center gap-1 text-xs opacity-85">
                <span className="opacity-75">MAC</span>
                <span className="font-mono font-medium opacity-95">{dev.mac_address}</span>
              </span>
            )}
            {dev.device_type && (
              <span className="flex items-center gap-1 text-xs opacity-85">
                {deviceTypeIcon(dev.device_type)}
                <span className="capitalize font-medium opacity-95">{dev.device_type}</span>
              </span>
            )}
            {dev.vendor && (
              <span className="text-xs opacity-75">{dev.vendor}</span>
            )}
            {dev.last_seen && (
              <span className="flex items-center gap-1 text-xs opacity-75">
                <Clock className="h-3 w-3" aria-hidden />
                visto {formatRelative(dev.last_seen)}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-black/10 ${dev.status === 'online' ? 'bg-emerald-500/30' : 'bg-red-500/30'}`}
            >
              {dev.status === 'online' ? '● Online' : '● Offline'}
            </span>
          </div>
        )}
      </div>

      {/* ── Banner test in corso ── */}
      {testsLoading && (
        <div className={`shrink-0 border-b ${testsWaitingAgent ? 'border-sky-500/35 bg-sky-500/10' : 'border-amber-500/38 bg-amber-500/10'}`}>
          <div className="flex items-center gap-3 px-6 py-3">
            {testsWaitingAgent
              ? <Timer className="h-5 w-5 shrink-0 text-sky-300" />
              : <Loader className="h-5 w-5 shrink-0 animate-spin text-amber-300" />}
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-semibold ${testsWaitingAgent ? 'text-sky-50' : 'text-amber-50'}`}>
                {testsWaitingAgent
                  ? `⏳ In attesa che l'agent esegua il test${countdown != null ? ` — ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')} rimasti` : ''}`
                  : '⚡ Esecuzione test dal server cloud…'}
              </div>
              {testsWaitingAgent && (
                <div className="mt-0.5 text-xs text-sky-100/85">
                  L'agent esegue test locali al prossimo heartbeat (~5 min). Attendi.
                </div>
              )}
            </div>
            {testsWaitingAgent && countdown != null && (
              <div className="shrink-0 font-mono text-2xl font-bold text-sky-200">
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
              </div>
            )}
          </div>
          {testsWaitingAgent && countdown != null && (
            <div className="h-1 bg-white/10">
              <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(countdown / 360) * 100}%` }} />
            </div>
          )}
          {!testsWaitingAgent && (
            <div className="h-1 bg-amber-500/15">
              <div className="h-full bg-amber-400 animate-pulse" style={{ width: '65%' }} />
            </div>
          )}
        </div>
      )}

      {/* ── Controls ── */}
      <div className="px-6 pt-4 pb-2 flex items-center gap-3 border-b border-white/10 shrink-0 bg-black/20">
        <span className="text-xs font-medium text-white/55">Periodo:</span>
        <select
          value={periodDays}
          onChange={e => setPeriodDays(Number(e.target.value))}
          className="text-xs rounded-lg border border-white/12 bg-black/28 px-2.5 py-1.5 text-white shadow-none outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hub-accent)]"
        >
          <option value={7}>7 giorni</option>
          <option value={30}>30 giorni</option>
          <option value={90}>90 giorni</option>
        </select>
        <button
          type="button"
          onClick={fetchAnalysis}
          disabled={loading}
          className="text-xs font-medium text-sky-300 hover:text-sky-200 disabled:opacity-50 flex items-center gap-1"
        >
          {loading && !testsLoading ? <Loader className="w-3 h-3 animate-spin" /> : null}
          Aggiorna
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {loading && !testsLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader className="h-8 w-8 animate-spin text-[color:var(--hub-accent)]" />
            <p className="text-sm text-white/45">Caricamento analisi…</p>
          </div>
        )}
        {error && !testsLoading && (
          <div className="m-6 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 p-4 text-red-50">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {((!loading || testsLoading) && (data || testsLoading) && !(error && !testsLoading)) && (
          <div className="p-6 space-y-5">

            {/* ── 1. Overview ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-white/55" />
                <h3 className="text-sm font-semibold text-white/78">Overview & Salute</h3>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 shadow-sm p-5">
                <div className="flex flex-wrap items-center gap-6">
                  {/* Gauge */}
                  <HealthGauge score={health.health_score} />

                  {/* Stats */}
                  <div className="flex flex-wrap gap-4 flex-1 min-w-0">
                    <div className="min-w-[100px] flex-1 rounded-xl border border-white/10 bg-black/25 p-3 text-center">
                      <div className="text-2xl font-bold text-white">{health.uptime_pct ?? '-'}%</div>
                      <div className="mt-0.5 text-xs text-white/55">Uptime stimato</div>
                    </div>
                    <div className="min-w-[100px] flex-1 rounded-xl border border-red-500/35 bg-red-500/12 p-3 text-center">
                      <div className="text-2xl font-bold text-red-300">{health.offline_events ?? 0}</div>
                      <div className="mt-0.5 text-xs text-white/55">Eventi offline</div>
                    </div>
                    <div className="min-w-[100px] flex-1 rounded-xl border border-emerald-500/35 bg-emerald-500/12 p-3 text-center">
                      <div className="text-2xl font-bold text-emerald-300">{health.online_events ?? 0}</div>
                      <div className="mt-0.5 text-xs text-white/55">Rientri online</div>
                    </div>
                  </div>
                </div>
                {dev.has_ping_failures && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/38 bg-amber-500/12 p-3 text-sm text-amber-50">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Disconnessioni frequenti rilevate su questo dispositivo (ping instabile).</span>
                  </div>
                )}
                {health.offline_events === 0 && health.uptime_pct === 100 && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/12 p-3 text-sm text-emerald-50">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Nessun problema rilevato nel periodo selezionato.</span>
                  </div>
                )}
              </div>
            </section>

            {/* ── 2. Test Remoti ── */}
            <section ref={testSectionRef}>
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-white/55" />
                <h3 className="text-sm font-semibold text-white/78">Test Remoti</h3>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 shadow-sm p-5">
                <p className="mb-4 text-xs text-white/55">
                  Ping e scan porte adattati al tipo dispositivo.
                  Per IP privati (192.168.x, 10.x) i test vengono eseguiti dall'<strong>agent in locale</strong>.
                </p>

                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); runTests(ev); }}
                    disabled={testsLoading}
                    className={`px-4 py-2 text-white text-sm rounded-lg flex items-center gap-2 shadow-sm transition-colors ${testsLoading
                      ? 'cursor-not-allowed bg-white/25'
                      : 'bg-[color:var(--hub-accent)] hover:brightness-110'
                      }`}
                  >
                    {testsLoading
                      ? <Loader className="w-4 h-4 animate-spin" />
                      : <Play className="w-4 h-4" />}
                    {testsLoading
                      ? (testsWaitingAgent ? 'In attesa agent…' : 'Test in corso…')
                      : 'Esegui test'}
                  </button>
                  {tests?.profileLabel && !testsLoading && (
                    <span className="rounded-full border border-sky-500/35 bg-sky-500/15 px-2.5 py-1 text-[11px] text-sky-100">
                      {tests.profileLabel}
                    </span>
                  )}
                  {tests?._deferred && !testsLoading && (
                    <span className="text-[11px] font-medium text-emerald-300">✓ Eseguiti dall&apos;agent in locale</span>
                  )}
                </div>

                {/* Stato loading inline compatto */}
                {testsLoading && testsWaitingAgent && (
                  <p className="mb-4 text-xs text-sky-200/90">
                    ⏳ Task inviato all'agent — attendi il prossimo heartbeat (~5 min). Il countdown è visibile in cima.
                  </p>
                )}
                {testsLoading && !testsWaitingAgent && (
                  <p className="text-xs text-amber-600 mb-4 flex items-center gap-1">
                    <Loader className="w-3 h-3 animate-spin inline" /> Test in esecuzione dal server cloud…
                  </p>
                )}

                {/* Risultati */}
                {tests?.error && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                    <div className="flex items-start gap-2 text-red-800">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Test non completati</div>
                        <p className="text-sm mt-1">{tests.error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {tests && !tests.error && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Ping */}
                  <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/55">Ping</div>
                      {tests.ping?.ok ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                            <CheckCircle className="w-4 h-4" /> Raggiungibile
                          </div>
                          <div className="text-xs text-white/55">
                            Packet loss: <strong>{tests.ping.packetLoss}%</strong>
                            {tests.ping.avgMs != null && <> · RTT medio: <strong>{tests.ping.avgMs} ms</strong></>}
                          </div>
                          {tests.ping.packetLoss > 20 && (
                            <div className="text-xs text-amber-700 flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-3 h-3" /> Packet loss elevato
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-red-600">
                          <WifiOff className="w-4 h-4" />
                          <span>{tests.ping?.error || 'Non raggiungibile'}</span>
                        </div>
                      )}
                    </div>

                    {/* Porte */}
                    <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/55">Porte</div>
                      {tests.ports && Object.keys(tests.ports).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(tests.ports).map(([port, open]) => (
                            <div
                              key={port}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${open
                                ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
                                : 'border-white/10 bg-black/25 text-white/55'}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-green-500' : 'bg-white/35'}`} />
                              {port}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-white/45">Nessun dato</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── 3. Pattern Orario ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-white/55" />
                <h3 className="text-sm font-semibold text-white/78">Pattern per ora del giorno</h3>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 shadow-sm p-5">
                <p className="mb-4 text-xs text-white/55">
                  Distribuzione degli eventi per fascia oraria — utile per individuare conflitti DHCP, backup schedulati o interruzioni ricorrenti.
                </p>
                <HourlyChart data={pattern} />
              </div>
            </section>

            {/* ── 4. Confronto ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-white/55" />
                <h3 className="text-sm font-semibold text-white/78">Confronto con dispositivi simili</h3>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 shadow-sm p-5 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-center">
                    <div className="text-xl font-bold text-white">{sameNetwork.length}</div>
                    <div className="mt-0.5 text-xs text-white/45">Altri dispositivi con problemi (stessa rete)</div>
                  </div>
                  {comparison.same_type_count > 0 && (
                    <>
                      <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-center">
                        <div className="text-xl font-bold text-white">{comparison.same_type_avg_offlines}</div>
                        <div className="mt-0.5 text-xs text-white/45">Media offline (tipo {dev.device_type || 'N/D'})</div>
                      </div>
                      <div className={`rounded-lg border p-3 text-center ${comparison.this_device_offlines > comparison.same_type_avg_offlines * 2 ? 'border-red-500/35 bg-red-500/12' : 'border-white/10 bg-black/25'}`}>
                        <div className={`text-xl font-bold ${comparison.this_device_offlines > comparison.same_type_avg_offlines * 2 ? 'text-red-300' : 'text-white'}`}>
                          {comparison.this_device_offlines}
                        </div>
                        <div className="mt-0.5 text-xs text-white/45">Questo dispositivo (offline)</div>
                      </div>
                    </>
                  )}
                </div>

                {comparison.suggestion && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/38 bg-amber-500/12 p-3 text-sm text-amber-50">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{comparison.suggestion}</span>
                  </div>
                )}

                {sameNetwork.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-white/10">
                    <table className="w-full text-xs">
                      <thead className="bg-black/30">
                        <tr className="text-left text-white/55">
                          <th className="py-2 px-3 font-medium">IP</th>
                          <th className="py-2 px-3 font-medium">Hostname</th>
                          <th className="py-2 px-3 font-medium">Offline</th>
                          <th className="py-2 px-3 font-medium">Disconnessioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sameNetwork.slice(0, 10).map((row) => (
                          <tr key={row.id} className="border-t border-white/10 hover:bg-white/[0.04]">
                            <td className="px-3 py-2 font-mono text-white/85">{row.ip_address}</td>
                            <td className="px-3 py-2 text-white/65">{row.hostname || '-'}</td>
                            <td className="px-3 py-2">
                              <span className={`font-semibold ${(row.offline_count ?? 0) > 5 ? 'text-red-300' : 'text-white/85'}`}>
                                {row.offline_count ?? '-'}
                              </span>
                            </td>
                            <td className="px-3 py-2">{row.has_ping_failures ? <span className="text-amber-300">⚠ Sì</span> : <span className="text-white/38">-</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* ── 5. Conflitti IP ── */}
            {(() => {
              const ipConflicts = timeline.filter(ev => ev.change_type === 'ip_conflict');
              if (ipConflicts.length === 0) return null;
              return (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-white/78">Conflitti IP Rilevati</h3>
                  </div>
                  <div className="rounded-xl border border-amber-500/38 bg-amber-500/10 p-5">
                    <p className="mb-3 text-xs text-amber-100/85">Questo dispositivo è stato coinvolto in conflitti IP (stesso IP usato da due MAC diversi).</p>
                    <ul className="space-y-2">
                      {ipConflicts.map((ev, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium text-amber-200">{formatDate(ev.detected_at)}</span>
                          <span className="rounded border border-amber-500/35 bg-black/30 px-2 py-0.5 font-mono text-xs text-white/85">{ev.old_value || '-'}</span>
                          <span className="text-amber-400/80">vs</span>
                          <span className="rounded border border-amber-500/35 bg-black/30 px-2 py-0.5 font-mono text-xs text-white/85">{ev.new_value || '-'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              );
            })()}

            {/* ── 6. Timeline ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-white/55" />
                  <h3 className="text-sm font-semibold text-white/78">
                    Timeline eventi
                    {timeline.length > 0 && <span className="ml-2 text-xs font-normal text-white/45">({timeline.length} totali)</span>}
                  </h3>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 shadow-sm p-5">
                {timeline.length === 0 ? (
                  <p className="text-sm italic text-white/45">Nessun evento nel periodo selezionato.</p>
                ) : (
                  <>
                    <div className="relative">
                      {visibleTimeline.map((ev, i) => (
                        <TimelineItem key={i} ev={ev} />
                      ))}
                    </div>
                    {timeline.length > 8 && (
                      <button
                        type="button"
                        onClick={() => setTimelineExpanded(e => !e)}
                        className="mt-2 flex items-center gap-1.5 text-xs font-medium text-sky-300 hover:text-sky-200"
                      >
                        {timelineExpanded
                          ? <><ChevronUp className="w-3.5 h-3.5" /> Mostra meno</>
                          : <><ChevronDown className="w-3.5 h-3.5" /> Mostra tutti ({timeline.length - 8} nascosti)</>}
                      </button>
                    )}
                  </>
                )}
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  );

  if (fullPage) {
    const ah = getStoredTechHubAccent();
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
        style={{ backgroundColor: HUB_PAGE_BG, ...hubModalCssVars(ah) }}
      >
        {inner}
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[118] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <HubModalInnerCard maxWidthClass="max-w-3xl" className="flex max-h-[90vh] flex-col overflow-hidden">
          {inner}
        </HubModalInnerCard>
      </div>
    </div>
  );
}
