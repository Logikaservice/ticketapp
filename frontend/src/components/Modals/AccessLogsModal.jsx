import React, { useState, useEffect, useMemo } from 'react';
import { X, Activity, RefreshCcw, Search, Building, Mail, LogIn, LogOut, Clock } from 'lucide-react';

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  } catch {
    return value;
  }
};

const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return '—';
  const totalSeconds = Math.max(Math.floor(seconds), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
};

const AccessLogsModal = ({ isOpen, onClose, getAuthHeader }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ activeSessions: 0, uniqueUsers: 0 });
  const [filters, setFilters] = useState({
    search: '',
    company: '',
    startDate: '',
    endDate: '',
    onlyActive: false
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pageSize = 25;

  const fetchLogs = async (resetPage = false) => {
    if (resetPage) {
      setPage(1);
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      const effectivePage = resetPage ? 1 : page;
      params.set('page', effectivePage);
      params.set('limit', pageSize);
      if (filters.search) params.set('search', filters.search);
      if (filters.company) params.set('company', filters.company);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.onlyActive) params.set('onlyActive', 'true');

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/access-logs?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeader ? getAuthHeader() : {})
        }
      });

      if (!response.ok) {
        throw new Error('Errore nel recupero dei log');
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setSummary({
        activeSessions: data.activeSessions || 0,
        uniqueUsers: data.uniqueUsers || 0,
      });
      if (resetPage) {
        setPage(1);
      }
    } catch (error) {
      console.error('Errore fetch access logs:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = useMemo(() => Math.max(Math.ceil(total / pageSize), 1), [total]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = () => {
    fetchLogs(true);
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      company: '',
      startDate: '',
      endDate: '',
      onlyActive: false
    });
    fetchLogs(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl w-full max-w-6xl max-h-[92vh] overflow-hidden shadow-[0_25px_120px_rgba(15,23,42,0.6)] border border-slate-700">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Monitoraggio accessi</p>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3 mt-1">
              <Activity className="text-emerald-300" size={26} />
              Access Log Clienti
            </h2>
            <p className="text-sm text-white/60 mt-1">
              Tracciamento accessi e disconnessioni dei clienti sul portale
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsRefreshing(true);
                fetchLogs();
              }}
              className={`px-3 py-2 rounded-xl border border-white/20 text-white text-sm flex items-center gap-2 hover:bg-white/10 transition ${
                isRefreshing ? 'opacity-60 cursor-wait' : ''
              }`}
              disabled={isRefreshing}
            >
              <RefreshCcw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              Aggiorna
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-white/5 bg-white/5 backdrop-blur">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-2 border border-white/10">
              <Search size={16} className="text-white/60" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Cerca nome, email o azienda"
                className="bg-transparent border-none outline-none text-white text-sm w-full placeholder:text-white/50"
              />
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-2 border border-white/10">
              <Building size={16} className="text-white/60" />
              <input
                type="text"
                value={filters.company}
                onChange={(e) => handleFilterChange('company', e.target.value)}
                placeholder="Filtra per azienda"
                className="bg-transparent border-none outline-none text-white text-sm w-full placeholder:text-white/50"
              />
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-2 border border-white/10">
              <Clock size={16} className="text-white/60" />
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="bg-transparent border-none outline-none text-white text-sm w-full [color-scheme:dark]"
              />
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-2 border border-white/10">
              <Clock size={16} className="text-white/60" />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="bg-transparent border-none outline-none text-white text-sm w-full [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={filters.onlyActive}
                onChange={(e) => handleFilterChange('onlyActive', e.target.checked)}
                className="accent-emerald-400"
              />
              Solo sessioni attive
            </label>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 text-sm rounded-xl bg-white/5 text-white/70 hover:bg-white/10 transition"
              >
                Reset
              </button>
              <button
                onClick={handleApplyFilters}
                className="px-4 py-2 text-sm rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white transition"
              >
                Applica filtri
              </button>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 py-5 bg-gradient-to-r from-white/5 to-transparent border-b border-white/5">
          <div className="p-4 rounded-2xl bg-white/10 border border-white/10 text-white">
            <p className="text-xs uppercase tracking-widest text-white/50">Accessi registrati</p>
            <p className="text-3xl font-bold mt-2">{total}</p>
            <p className="text-xs text-white/60 mt-1">Storico filtrato</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/10 border border-white/10 text-white">
            <p className="text-xs uppercase tracking-widest text-white/50">Sessioni attive</p>
            <p className="text-3xl font-bold mt-2">{summary.activeSessions}</p>
            <p className="text-xs text-white/60 mt-1">Clienti ancora collegati</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/10 border border-white/10 text-white">
            <p className="text-xs uppercase tracking-widest text-white/50">Clienti unici</p>
            <p className="text-3xl font-bold mt-2">{summary.uniqueUsers}</p>
            <p className="text-xs text-white/60 mt-1">Nel perimetro filtrato</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-white/70">
              <div className="inline-flex items-center gap-3 text-sm">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                Caricamento log in corso...
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-white/60 border border-dashed border-white/20 rounded-2xl">
              Nessun accesso trovato con i filtri impostati.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.session_id}
                className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white backdrop-blur hover:border-emerald-400/50 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">{log.user_name || 'Utente sconosciuto'}</p>
                    <p className="text-sm text-white/60 flex items-center gap-2">
                      <Mail size={14} /> {log.user_email || '—'}
                    </p>
                    <p className="text-sm text-white/60 flex items-center gap-2">
                      <Building size={14} /> {log.user_company || '—'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                      <p className="text-emerald-200 flex items-center gap-2">
                        <LogIn size={14} /> Accesso
                      </p>
                      <p className="text-white font-semibold">{formatDateTime(log.login_at)}</p>
                      <p className="text-xs text-white/50 mt-1">IP: {log.login_ip || 'n/d'}</p>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
                      <p className="text-rose-200 flex items-center gap-2">
                        <LogOut size={14} /> Uscita
                      </p>
                      <p className="text-white font-semibold">{formatDateTime(log.logout_at)}</p>
                      <p className="text-xs text-white/50 mt-1">IP: {log.logout_ip || 'n/d'}</p>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 min-w-[120px] text-center">
                      <p className="text-white/60 text-xs uppercase">Durata</p>
                      <p className="text-lg font-bold mt-1 text-white">{formatDuration(log.duration_seconds)}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-white/50 break-all">
                  User Agent: {log.user_agent || '—'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-white/5 bg-white/5 backdrop-blur flex items-center justify-between text-white/70 text-sm">
          <span>
            Pagina {page} di {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 disabled:opacity-30"
            >
              Precedente
            </button>
            <button
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/10 disabled:opacity-30"
            >
              Successiva
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessLogsModal;


