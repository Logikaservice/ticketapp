// Modal Analisi dispositivo: overview, test remoti, pattern, confronto con dispositivi simili
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Activity, BarChart3, Cpu, Users, Loader, AlertTriangle, CheckCircle, Wifi, WifiOff
} from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';

const formatDate = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
};

const changeTypeLabel = (t) => {
  const map = { device_offline: 'Offline', device_online: 'Online', new_device: 'Nuovo', ip_changed: 'IP cambiato', mac_changed: 'MAC cambiato' };
  return map[t] || t;
};

export default function DeviceAnalysisModal({ isOpen, onClose, deviceId, deviceLabel, getAuthHeader }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tests, setTests] = useState(null);
  const [testsLoading, setTestsLoading] = useState(false);
  const [periodDays, setPeriodDays] = useState(30);

  const fetchAnalysis = useCallback(async () => {
    if (!deviceId) return;
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

  useEffect(() => {
    if (isOpen && deviceId) fetchAnalysis();
  }, [isOpen, deviceId, fetchAnalysis]);

  const runTests = async () => {
    if (!deviceId) return;
    setTestsLoading(true);
    setTests(null);
    try {
      const res = await fetch(buildApiUrl(`/api/network-monitoring/device-analysis/${deviceId}/run-tests`), {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Test falliti');
      const json = await res.json();
      setTests(json);
    } catch (e) {
      setTests({ error: e.message });
    } finally {
      setTestsLoading(false);
    }
  };

  if (!isOpen) return null;

  const dev = data?.device || {};
  const health = data?.health || {};
  const comparison = data?.comparison || {};
  const pattern = data?.pattern?.by_hour || [];
  const sameNetwork = data?.same_network_issues || [];
  const timeline = data?.timeline || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Analisi dispositivo</h2>
              <p className="text-sm text-gray-500">{deviceLabel || `${dev.hostname || dev.ip_address || ''} (${dev.ip_address})`}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 text-red-800">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {!loading && !error && data && (
            <>
              {/* Period selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Periodo:</span>
                <select
                  value={periodDays}
                  onChange={e => setPeriodDays(Number(e.target.value))}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                >
                  <option value={7}>7 giorni</option>
                  <option value={30}>30 giorni</option>
                  <option value={90}>90 giorni</option>
                </select>
                <button
                  type="button"
                  onClick={fetchAnalysis}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Aggiorna
                </button>
              </div>

              {/* 1. Overview / Health */}
              <section className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Overview e salute
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className={`text-2xl font-bold ${health.health_score >= 70 ? 'text-green-600' : health.health_score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                      {health.health_score ?? '-'}
                    </div>
                    <div className="text-xs text-gray-500">Health score (0-100)</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-800">{health.uptime_pct ?? '-'}%</div>
                    <div className="text-xs text-gray-500">Uptime stimato</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">{health.offline_events ?? 0}</div>
                    <div className="text-xs text-gray-500">Eventi offline</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-800">{health.online_events ?? 0}</div>
                    <div className="text-xs text-gray-500">Eventi online</div>
                  </div>
                </div>
                {dev.has_ping_failures && (
                  <div className="mt-3 flex items-center gap-2 text-amber-700 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Disconnessioni frequenti rilevate su questo dispositivo.
                  </div>
                )}
              </section>

              {/* 2. Test remoti */}
              <section className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Test remoti
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Ping e verifica porte. I test si adattano al tipo dispositivo: <strong>antenna/switch/router</strong> → porte gestione (80, 443, 22, 8080); <strong>PC/server</strong> → 80, 443, 445, 3389, 22, 21. Eseguiti dal server: se l&apos;IP è privato e il server è in cloud, il ping può fallire.
                </p>
                <button
                  type="button"
                  onClick={runTests}
                  disabled={testsLoading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {testsLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                  Esegui test
                </button>
                {tests?.error && (
                  <div className="mt-3 text-sm text-red-600">{tests.error}</div>
                )}
                {tests && !tests.error && (
                  <>
                    {tests.profileLabel && (
                      <div className="mt-3 text-xs text-blue-700 bg-blue-50 rounded px-3 py-2">
                        Profilo usato: {tests.profileLabel}
                      </div>
                    )}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs font-medium text-gray-500 mb-2">Ping</div>
                      {tests.ping?.ok ? (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Loss: {tests.ping.packetLoss}%</span>
                          {tests.ping.avgMs != null && <span> · Media: {tests.ping.avgMs} ms</span>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-red-600">
                          <WifiOff className="w-4 h-4" />
                          <span>{tests.ping?.error || 'Non raggiungibile'}</span>
                        </div>
                      )}
                    </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs font-medium text-gray-500 mb-2">Porte</div>
                        <div className="flex flex-wrap gap-2">
                          {tests.ports && Object.entries(tests.ports).map(([port, open]) => (
                            <span
                              key={port}
                              className={`px-2 py-0.5 rounded text-xs ${open ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}
                            >
                              {port} {open ? '✓' : '✗'}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </section>

              {/* 3. Pattern per ora */}
              <section className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Pattern per ora del giorno
                </h3>
                <p className="text-xs text-gray-500 mb-3">Distribuzione eventi offline/online per fascia oraria (utile per conflitti backup o DHCP).</p>
                <div className="flex flex-wrap gap-2">
                  {pattern.filter(p => p.offline > 0 || p.online > 0).length === 0 ? (
                    <span className="text-sm text-gray-500">Nessun dato nel periodo.</span>
                  ) : (
                    pattern.map(({ hour, offline, online }) => (
                      <div key={hour} className="flex items-center gap-1">
                        <span className="text-xs text-gray-500 w-8">{hour}h</span>
                        {offline > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-xs" title={`${offline} offline`}>
                            {offline} off
                          </span>
                        )}
                        {online > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 text-xs" title={`${online} online`}>
                            {online} on
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* 4. Confronto con dispositivi simili */}
              <section className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Confronto con dispositivi simili
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-600">
                    Stessa rete (agent): <strong>{sameNetwork.length}</strong> altri dispositivi con problemi (offline o disconnessioni rilevate).
                  </p>
                  {comparison.same_type_count > 0 && (
                    <p className="text-gray-600">
                      Stesso tipo (<strong>{dev.device_type || 'N/D'}</strong>): <strong>{comparison.same_type_count}</strong> dispositivi · media eventi offline: <strong>{comparison.same_type_avg_offlines}</strong> · questo dispositivo: <strong>{comparison.this_device_offlines}</strong>.
                    </p>
                  )}
                  {comparison.suggestion && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{comparison.suggestion}</span>
                    </div>
                  )}
                </div>
                {sameNetwork.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="py-2 pr-2">IP</th>
                          <th className="py-2 pr-2">Hostname</th>
                          <th className="py-2 pr-2">Offline (periodo)</th>
                          <th className="py-2 pr-2">Disconnessioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sameNetwork.slice(0, 10).map((row) => (
                          <tr key={row.id} className="border-b border-gray-100">
                            <td className="py-1.5 font-mono">{row.ip_address}</td>
                            <td className="py-1.5">{row.hostname || '-'}</td>
                            <td className="py-1.5">{row.offline_count ?? '-'}</td>
                            <td className="py-1.5">{row.has_ping_failures ? 'Sì' : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* 5. Timeline eventi */}
              <section className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Timeline eventi</h3>
                {timeline.length === 0 ? (
                  <p className="text-sm text-gray-500">Nessun evento nel periodo.</p>
                ) : (
                  <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {timeline.map((ev, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className={`shrink-0 w-20 ${ev.change_type === 'device_offline' ? 'text-red-600' : 'text-green-600'}`}>
                          {changeTypeLabel(ev.change_type)}
                        </span>
                        <span className="text-gray-500">{formatDate(ev.detected_at)}</span>
                        {(ev.old_value || ev.new_value) && (
                          <span className="text-gray-400 text-xs">
                            {ev.old_value && `${ev.old_value} → `}{ev.new_value}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
