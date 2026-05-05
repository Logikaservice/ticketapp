import React, { useState, useEffect } from 'react';
import { Search, Calendar, Building, Mail, User, Clock, Activity, Filter, RefreshCw } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import { HUB_MODAL_FIELD_CLS, HUB_MODAL_LABEL_CLS } from '../../utils/techHubAccent';
import {
  HubModalInnerCard,
  HubModalChromeHeader,
  HubModalChromeFooter,
  HubModalSecondaryButton
} from './HubModalChrome';

const AccessLogsModal = ({ isOpen, onClose, getAuthHeader }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    searchType: 'all', // 'all', 'company', 'email'
    startDate: '',
    endDate: '',
    onlyActive: false
  });
  const [summary, setSummary] = useState({
    total: 0,
    activeSessions: 0,
    uniqueUsers: 0
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString()
      });
      
      // Applica il filtro di ricerca in base al tipo selezionato
      if (filters.search) {
        if (filters.searchType === 'company') {
          params.append('company', filters.search);
        } else if (filters.searchType === 'email') {
          params.append('email', filters.search);
        } else {
          params.append('search', filters.search);
        }
      }
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.onlyActive) params.append('onlyActive', 'true');
      
      const authHeader = getAuthHeader();
      const response = await fetch(buildApiUrl(`/api/access-logs?${params}`), {
        headers: {
          ...authHeader
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Errore risposta access logs:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.error || errorData.details || `Errore nel caricamento dei log (${response.status})`);
      }
      
      const data = await response.json();
      console.log('✅ Dati access logs ricevuti:', {
        logsCount: data.logs?.length || 0,
        total: data.total,
        activeSessions: data.activeSessions,
        uniqueUsers: data.uniqueUsers
      });
      setLogs(data.logs || []);
      setSummary({
        total: data.total || 0,
        activeSessions: data.activeSessions || 0,
        uniqueUsers: data.uniqueUsers || 0
      });
    } catch (err) {
      setError(err.message);
      console.error('❌ Errore caricamento log:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Ricarica sempre i dati quando il modal viene aperto
      fetchLogs();
    }
  }, [isOpen, currentPage, filters]);
  
  // Ricarica anche quando il modal viene riaperto (per vedere aggiornamenti dopo logout)
  useEffect(() => {
    if (isOpen && !loading) {
      // Piccolo delay per assicurarsi che eventuali operazioni di logout siano completate
      const timeoutId = setTimeout(() => {
        fetchLogs();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen]);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      searchType: 'all',
      startDate: '',
      endDate: '',
      onlyActive: false
    });
    setCurrentPage(1);
  };

  if (!isOpen) return null;

  return (
    <HubModalInnerCard maxWidthClass="max-w-7xl" className="flex max-h-[90vh] w-full flex-col overflow-hidden">
      <HubModalChromeHeader
        icon={Activity}
        title="Log Accessi"
        subtitle="Monitoraggio accessi al portale"
        onClose={onClose}
      />
      <div className="flex shrink-0 justify-end border-b border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-surface)] px-4 py-2">
        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="rounded-lg bg-[color:var(--hub-chrome-hover)] p-2 text-[color:var(--hub-chrome-text)] ring-1 ring-[color:var(--hub-chrome-border)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          title="Aggiorna"
          aria-label="Aggiorna"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} aria-hidden />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 border-b border-[color:var(--hub-chrome-border-soft)] bg-[color:var(--hub-chrome-surface)] px-6 py-4">
        <div className="rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 ring-1 ring-sky-500/30">
              <Activity size={20} className="text-sky-300" />
            </div>
            <div>
              <p className="text-sm text-[color:var(--hub-chrome-text-faint)]">Totale Accessi</p>
              <p className="text-2xl font-bold text-[color:var(--hub-chrome-text)]">{summary.total}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30">
              <Clock size={20} className="text-emerald-300" />
            </div>
            <div>
              <p className="text-sm text-[color:var(--hub-chrome-text-faint)]">Sessioni Attive</p>
              <p className="text-2xl font-bold text-emerald-300">{summary.activeSessions}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[color:var(--hub-chrome-border)] bg-[color:var(--hub-chrome-well)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20 ring-1 ring-violet-500/30">
              <User size={20} className="text-violet-300" />
            </div>
            <div>
              <p className="text-sm text-[color:var(--hub-chrome-text-faint)]">Utenti Unici</p>
              <p className="text-2xl font-bold text-violet-300">{summary.uniqueUsers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-[color:var(--hub-chrome-border-soft)] px-6 py-4">
          <div className="mb-4 flex items-center gap-2">
            <Filter size={18} className="text-[color:var(--hub-chrome-text-faint)]" />
            <h3 className="font-semibold text-[color:var(--hub-chrome-text)]">Filtri</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            {/* Campo ricerca unificato con selezione tipo */}
            <div className="md:col-span-2">
              <label className={HUB_MODAL_LABEL_CLS}>Ricerca</label>
              <div className="flex gap-2">
                <select
                  value={filters.searchType}
                  onChange={(e) => handleFilterChange('searchType', e.target.value)}
                  className={`min-w-[100px] shrink-0 ${HUB_MODAL_FIELD_CLS}`}
                >
                  <option value="all">Tutto</option>
                  <option value="company">Azienda</option>
                  <option value="email">Email</option>
                </select>
                <div className="relative flex-1">
                  {filters.searchType === 'company' ? (
                    <Building size={18} className="absolute left-3 top-1/2 -translate-y-1/2 transform text-white/38" />
                  ) : filters.searchType === 'email' ? (
                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 transform text-white/38" />
                  ) : (
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 transform text-white/38" />
                  )}
                  <input
                    type={filters.searchType === 'email' ? 'email' : 'text'}
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder={
                      filters.searchType === 'company' 
                        ? 'Nome azienda...' 
                        : filters.searchType === 'email' 
                        ? 'Email utente...' 
                        : 'Email, nome, azienda...'
                    }
                    className={`${HUB_MODAL_FIELD_CLS} pl-10`}
                  />
                </div>
              </div>
            </div>
            {/* Data Inizio */}
            <div>
              <label className={HUB_MODAL_LABEL_CLS}>Data Inizio</label>
              <div className="relative">
                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 transform text-white/38" />
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className={`${HUB_MODAL_FIELD_CLS} pl-10`}
                />
              </div>
            </div>
            {/* Data Fine */}
            <div>
              <label className={HUB_MODAL_LABEL_CLS}>Data Fine</label>
              <div className="relative">
                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 transform text-white/38" />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className={`${HUB_MODAL_FIELD_CLS} pl-10`}
                />
              </div>
            </div>
            {/* Checkbox solo sessioni attive e pulsante pulisci */}
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.onlyActive}
                  onChange={(e) => handleFilterChange('onlyActive', e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-black/30 text-[color:var(--hub-accent)] focus:ring-[color:var(--hub-accent)]"
                />
                <span className="text-sm text-white/78">Solo sessioni attive</span>
              </label>
              <HubModalSecondaryButton type="button" onClick={clearFilters}>
                Pulisci Filtri
              </HubModalSecondaryButton>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[color:var(--hub-accent)]"></div>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/15 p-4 text-red-50">
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-white/55">
              Nessun log trovato
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-black/35">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/70">Utente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/70">Azienda</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/70">Login</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/70">Logout</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/70">Durata</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/70">IP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/70">Stato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-black/10">
                  {logs.map((log) => (
                    <tr key={log.session_id} className="hover:bg-white/[0.04]">
                      <td className="whitespace-nowrap px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-white">{log.user_name || '-'}</div>
                          <div className="text-xs text-white/45">{log.user_email || '-'}</div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-white/78">
                        {log.user_company || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-white/78">
                        {formatDate(log.login_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-white/78">
                        {formatDate(log.logout_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-white/78">
                        {formatDuration(log.duration_seconds)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-white/45">
                        {log.login_ip || '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {log.logout_at ? (
                          <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white/78 ring-1 ring-white/15">
                            Chiusa
                          </span>
                        ) : (() => {
                          // Verifica se la sessione è realmente attiva usando il timeout personalizzato dell'utente
                          // Default: 3 minuti (180000 ms) se non specificato
                          const rawT = log.user_inactivity_timeout_minutes;
                          const fallbackT = log.user_role === 'tecnico' ? 30 : 3;
                          const userTimeoutMinutes =
                            rawT !== undefined && rawT !== null && rawT !== ''
                              ? Number(rawT)
                              : fallbackT;
                          const timeoutMs = userTimeoutMinutes === 0 ? Infinity : userTimeoutMinutes * 60 * 1000;
                          
                          const lastActivity = log.last_activity_at ? new Date(log.last_activity_at) : null;
                          const isActive = lastActivity && (Date.now() - lastActivity.getTime()) < timeoutMs;
                          
                          return isActive ? (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-200 ring-1 ring-emerald-500/35">
                              Attiva
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-100 ring-1 ring-amber-500/35">
                              Inattiva
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer con totale */}
                <tfoot className="border-t-2 border-white/10 bg-black/30">
                  <tr>
                    <td colSpan="7" className="px-4 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity size={18} className="text-white/55" />
                          <span className="text-sm font-semibold text-white/78">
                            Totale accessi visualizzati:
                          </span>
                          <span className="text-sm font-bold text-white">
                            {logs.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white/78">
                            Totale accessi (tutti i filtri):
                          </span>
                          <span className="text-sm font-bold text-[color:var(--hub-accent)]">
                            {summary.total.toLocaleString('it-IT')}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && logs.length > 0 && (
          <HubModalChromeFooter className="flex items-center justify-between">
            <div className="text-sm text-white/65">
              Pagina {currentPage} • {logs.length} risultati
            </div>
            <div className="flex gap-2">
              <HubModalSecondaryButton
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="disabled:cursor-not-allowed disabled:opacity-50"
              >
                Precedente
              </HubModalSecondaryButton>
              <HubModalSecondaryButton
                type="button"
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={logs.length < pageSize}
                className="disabled:cursor-not-allowed disabled:opacity-50"
              >
                Successiva
              </HubModalSecondaryButton>
            </div>
          </HubModalChromeFooter>
        )}
    </HubModalInnerCard>
  );
};

export default AccessLogsModal;

