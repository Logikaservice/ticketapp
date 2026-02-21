// Modal Analisi dispositivo: overview, test remoti, pattern, confronto con dispositivi simili
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  X, Activity, BarChart3, Cpu, Users, Loader, AlertTriangle,
  CheckCircle, WifiOff, Clock, Wifi, Server, Monitor, Printer,
  Router, Shield, HardDrive, ArrowUpRight, ArrowDownRight,
  Minus, ChevronDown, ChevronUp
} from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';

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
          <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
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
  if (hours.length === 0) return <p className="text-sm text-gray-400 italic">Nessun evento nel periodo.</p>;

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-end gap-1 min-w-max h-24">
        {data.map(({ hour, offline, online }) => {
          const total = offline + online;
          if (total === 0) return (
            <div key={hour} className="flex flex-col items-center gap-0.5 w-7">
              <div className="w-5 h-0.5 bg-gray-100 rounded" />
              <span className="text-[9px] text-gray-300">{hour}</span>
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
              <span className="text-[9px] text-gray-400">{hour}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-2">
        <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-3 h-2 bg-red-400 rounded-sm inline-block" /> Offline</span>
        <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-3 h-2 bg-green-400 rounded-sm inline-block" /> Online</span>
      </div>
    </div>
  );
};

/* ─── Timeline Item ─── */
const TimelineItem = ({ ev, prev }) => {
  const isOffline = ev.change_type === 'device_offline';
  const isOnline = ev.change_type === 'device_online' || ev.change_type === 'new_device';
  const isConflict = ev.change_type === 'ip_conflict';
  const isChange = ev.change_type === 'ip_changed' || ev.change_type === 'mac_changed';

  let duration = null;
  if (isOnline && prev && prev.change_type === 'device_offline') {
    const ms = new Date(ev.detected_at).getTime() - new Date(prev.detected_at).getTime();
    const min = Math.round(ms / 60000);
    const h = Math.floor(min / 60);
    duration = h > 0 ? `${h}h ${min % 60}m offline` : `${min}m offline`;
  }

  const dotColor = isOffline ? 'bg-red-500' : isOnline ? 'bg-green-500' : isConflict ? 'bg-amber-500' : 'bg-blue-400';
  const Icon = isOffline ? ArrowDownRight : isOnline ? ArrowUpRight : isConflict ? AlertTriangle : Minus;
  const textColor = isOffline ? 'text-red-700' : isOnline ? 'text-green-700' : isConflict ? 'text-amber-700' : 'text-blue-700';

  return (
    <div className="relative flex gap-3 pb-4">
      <div className="flex flex-col items-center">
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor} ring-2 ring-white mt-0.5 shrink-0 z-10`} />
        <div className="w-px flex-1 bg-gray-200 mt-1" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className={`w-3.5 h-3.5 ${textColor} shrink-0`} />
          <span className={`text-xs font-semibold ${textColor}`}>{changeTypeLabel(ev.change_type)}</span>
          <span className="text-xs text-gray-400">{formatDate(ev.detected_at)}</span>
          {duration && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
              ⏱ {duration}
            </span>
          )}
        </div>
        {(ev.old_value || ev.new_value) && (
          <p className="text-xs text-gray-500 mt-0.5 font-mono">
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
  const testSectionRef = useRef(null);
  const fetchAnalysisRef = useRef(null);
  const testsLoadingRef = useRef(false);
  testsLoadingRef.current = testsLoading;

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
      if (!res.ok) throw new Error('Test falliti');
      const json = await res.json();
      if (json.deferred && json.task_id) {
        const taskId = json.task_id;
        setTestsWaitingAgent(true);
        const deadline = Date.now() + 7 * 60 * 1000;
        const poll = async () => {
          if (Date.now() > deadline) {
            setTestsWaitingAgent(false);
            setTests({ error: "Timeout: l'agent non ha completato i test in tempo. Verifica che l'agent sia attivo e riprova." });
            setTestsLoading(false);
            return;
          }
          try {
            const r = await fetch(buildApiUrl(`/api/network-monitoring/device-test-result/${taskId}`), { headers: getAuthHeader() });
            const data = await r.json();
            if (data.status !== 'pending') {
              await ensureMinBanner();
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
      setTests(json);
    } catch (err) {
      await ensureMinBanner();
      setTests({ error: err.message });
    } finally {
      setTestsLoading(false);
    }
  };

  if (!fullPage && !isOpen) return null;

  const dev = data?.device || {};
  const health = data?.health || {};
  const comparison = data?.comparison || {};
  const pattern = data?.pattern?.by_hour || [];
  const sameNetwork = data?.same_network_issues || [];
  const timeline = data?.timeline || [];
  const visibleTimeline = timelineExpanded ? timeline : timeline.slice(0, 8);

  const inner = (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-blue-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white leading-tight">Analisi Dispositivo</h2>
              <p className="text-sm text-slate-300 truncate mt-0.5">
                {deviceLabel || dev.hostname || dev.ip_address || '…'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors shrink-0">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Device Info Strip */}
        {dev.ip_address && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {dev.ip_address && (
              <span className="flex items-center gap-1 text-xs text-slate-300">
                <span className="text-slate-400">IP</span>
                <span className="font-mono text-white">{dev.ip_address}</span>
              </span>
            )}
            {dev.mac_address && (
              <span className="flex items-center gap-1 text-xs text-slate-300">
                <span className="text-slate-400">MAC</span>
                <span className="font-mono text-white">{dev.mac_address}</span>
              </span>
            )}
            {dev.device_type && (
              <span className="flex items-center gap-1 text-xs text-slate-300">
                {deviceTypeIcon(dev.device_type)}
                <span className="text-white capitalize">{dev.device_type}</span>
              </span>
            )}
            {dev.vendor && (
              <span className="text-xs text-slate-400">{dev.vendor}</span>
            )}
            {dev.last_seen && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                visto {formatRelative(dev.last_seen)}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dev.status === 'online' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
              {dev.status === 'online' ? '● Online' : '● Offline'}
            </span>
          </div>
        )}
      </div>

      {/* ── Banner test in corso ── */}
      {testsLoading && (
        <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 border-b border-amber-200 shrink-0">
          <Loader className="w-5 h-5 text-amber-600 animate-spin shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-900">
              {testsWaitingAgent ? 'In attesa dell\'agent (IP privato)…' : 'Esecuzione test in corso…'}
            </div>
            {testsWaitingAgent && (
              <div className="text-xs text-amber-700 mt-0.5">L'agent riceve i comandi ogni ~5 min. Attendi fino a 5 minuti.</div>
            )}
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div className="px-6 pt-4 pb-2 flex items-center gap-3 border-b border-gray-100 shrink-0 bg-gray-50">
        <span className="text-xs text-gray-500 font-medium">Periodo:</span>
        <select
          value={periodDays}
          onChange={e => setPeriodDays(Number(e.target.value))}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white shadow-sm"
        >
          <option value={7}>7 giorni</option>
          <option value={30}>30 giorni</option>
          <option value={90}>90 giorni</option>
        </select>
        <button
          type="button"
          onClick={fetchAnalysis}
          disabled={loading}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 flex items-center gap-1"
        >
          {loading && !testsLoading ? <Loader className="w-3 h-3 animate-spin" /> : null}
          Aggiorna
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {loading && !testsLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-400">Caricamento analisi…</p>
          </div>
        )}
        {error && !testsLoading && (
          <div className="m-6 flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {((!loading || testsLoading) && (data || testsLoading) && !(error && !testsLoading)) && (
          <div className="p-6 space-y-5">

            {/* ── 1. Overview ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-700">Overview & Salute</h3>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex flex-wrap items-center gap-6">
                  {/* Gauge */}
                  <HealthGauge score={health.health_score} />

                  {/* Stats */}
                  <div className="flex flex-wrap gap-4 flex-1 min-w-0">
                    <div className="bg-gray-50 rounded-xl p-3 flex-1 min-w-[100px] text-center">
                      <div className="text-2xl font-bold text-gray-800">{health.uptime_pct ?? '-'}%</div>
                      <div className="text-xs text-gray-500 mt-0.5">Uptime stimato</div>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 flex-1 min-w-[100px] text-center">
                      <div className="text-2xl font-bold text-red-600">{health.offline_events ?? 0}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Eventi offline</div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3 flex-1 min-w-[100px] text-center">
                      <div className="text-2xl font-bold text-green-600">{health.online_events ?? 0}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Rientri online</div>
                    </div>
                  </div>
                </div>
                {dev.has_ping_failures && (
                  <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Disconnessioni frequenti rilevate su questo dispositivo (ping instabile).</span>
                  </div>
                )}
                {health.offline_events === 0 && health.uptime_pct === 100 && (
                  <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Nessun problema rilevato nel periodo selezionato.</span>
                  </div>
                )}
              </div>
            </section>

            {/* ── 2. Test Remoti ── */}
            <section ref={testSectionRef}>
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-700">Test Remoti</h3>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-xs text-gray-400 mb-4">
                  Ping e scan porte adattati al tipo dispositivo.
                  Per IP privati (192.168.x, 10.x) i test vengono eseguiti dall'<strong>agent in locale</strong>.
                </p>

                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); runTests(ev); }}
                    disabled={testsLoading}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-colors"
                  >
                    {testsLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                    {testsLoading ? (testsWaitingAgent ? 'In attesa agent…' : 'Test in corso…') : 'Esegui test'}
                  </button>
                  {tests?.profileLabel && (
                    <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">
                      {tests.profileLabel}
                    </span>
                  )}
                  {tests?._deferred && (
                    <span className="text-[11px] text-green-600 font-medium">✓ Eseguiti dall'agent in locale</span>
                  )}
                </div>

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
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ping</div>
                      {tests.ping?.ok ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                            <CheckCircle className="w-4 h-4" /> Raggiungibile
                          </div>
                          <div className="text-xs text-gray-500">
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
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Porte</div>
                      {tests.ports && Object.keys(tests.ports).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(tests.ports).map(([port, open]) => (
                            <div
                              key={port}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${open
                                ? 'bg-green-50 text-green-800 border-green-200'
                                : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-green-500' : 'bg-gray-400'}`} />
                              {port}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Nessun dato</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── 3. Pattern Orario ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-700">Pattern per ora del giorno</h3>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-xs text-gray-400 mb-4">
                  Distribuzione degli eventi per fascia oraria — utile per individuare conflitti DHCP, backup schedulati o interruzioni ricorrenti.
                </p>
                <HourlyChart data={pattern} />
              </div>
            </section>

            {/* ── 4. Confronto ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-700">Confronto con dispositivi simili</h3>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-gray-800">{sameNetwork.length}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Altri dispositivi con problemi (stessa rete)</div>
                  </div>
                  {comparison.same_type_count > 0 && (
                    <>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-gray-800">{comparison.same_type_avg_offlines}</div>
                        <div className="text-xs text-gray-400 mt-0.5">Media offline (tipo {dev.device_type || 'N/D'})</div>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${comparison.this_device_offlines > comparison.same_type_avg_offlines * 2 ? 'bg-red-50' : 'bg-gray-50'}`}>
                        <div className={`text-xl font-bold ${comparison.this_device_offlines > comparison.same_type_avg_offlines * 2 ? 'text-red-600' : 'text-gray-800'}`}>
                          {comparison.this_device_offlines}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">Questo dispositivo (offline)</div>
                      </div>
                    </>
                  )}
                </div>

                {comparison.suggestion && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{comparison.suggestion}</span>
                  </div>
                )}

                {sameNetwork.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-gray-500">
                          <th className="py-2 px-3 font-medium">IP</th>
                          <th className="py-2 px-3 font-medium">Hostname</th>
                          <th className="py-2 px-3 font-medium">Offline</th>
                          <th className="py-2 px-3 font-medium">Disconnessioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sameNetwork.slice(0, 10).map((row) => (
                          <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-3 font-mono">{row.ip_address}</td>
                            <td className="py-2 px-3 text-gray-600">{row.hostname || '-'}</td>
                            <td className="py-2 px-3">
                              <span className={`font-semibold ${(row.offline_count ?? 0) > 5 ? 'text-red-600' : 'text-gray-700'}`}>
                                {row.offline_count ?? '-'}
                              </span>
                            </td>
                            <td className="py-2 px-3">{row.has_ping_failures ? <span className="text-amber-600">⚠ Sì</span> : <span className="text-gray-400">-</span>}</td>
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
                    <h3 className="text-sm font-semibold text-slate-700">Conflitti IP Rilevati</h3>
                  </div>
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                    <p className="text-xs text-amber-700 mb-3">Questo dispositivo è stato coinvolto in conflitti IP (stesso IP usato da due MAC diversi).</p>
                    <ul className="space-y-2">
                      {ipConflicts.map((ev, i) => (
                        <li key={i} className="text-sm flex flex-wrap items-center gap-2">
                          <span className="text-amber-700 font-medium">{formatDate(ev.detected_at)}</span>
                          <span className="font-mono text-xs bg-white border border-amber-200 px-2 py-0.5 rounded">{ev.old_value || '-'}</span>
                          <span className="text-amber-400">vs</span>
                          <span className="font-mono text-xs bg-white border border-amber-200 px-2 py-0.5 rounded">{ev.new_value || '-'}</span>
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
                  <Clock className="w-4 h-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-700">
                    Timeline eventi
                    {timeline.length > 0 && <span className="ml-2 text-xs text-gray-400 font-normal">({timeline.length} totali)</span>}
                  </h3>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                {timeline.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Nessun evento nel periodo selezionato.</p>
                ) : (
                  <>
                    <div className="relative">
                      {visibleTimeline.map((ev, i) => (
                        <TimelineItem key={i} ev={ev} prev={i > 0 ? visibleTimeline[i - 1] : null} />
                      ))}
                    </div>
                    {timeline.length > 8 && (
                      <button
                        type="button"
                        onClick={() => setTimelineExpanded(e => !e)}
                        className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
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
    return <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden">{inner}</div>;
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {inner}
      </div>
    </div>
  );
}
