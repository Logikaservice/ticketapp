import React, { useState, useEffect } from 'react';
import { X, Search, Calendar, Building, Mail, User, Clock, Activity, Filter } from 'lucide-react';

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
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/access-logs?${params}`, {
        headers: {
          ...authHeader
        }
      });
      
      if (!response.ok) {
        throw new Error('Errore nel caricamento dei log');
      }
      
      const data = await response.json();
      setLogs(data.logs || []);
      setSummary({
        total: data.total || 0,
        activeSessions: data.activeSessions || 0,
        uniqueUsers: data.uniqueUsers || 0
      });
    } catch (err) {
      setError(err.message);
      console.error('Errore caricamento log:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, currentPage, filters]);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Activity size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Log Accessi</h2>
              <p className="text-sm text-white/80">Monitoraggio accessi al portale</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="px-6 py-4 bg-gray-50 border-b grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Activity size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Totale Accessi</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Clock size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Sessioni Attive</p>
                <p className="text-2xl font-bold text-green-600">{summary.activeSessions}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <User size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Utenti Unici</p>
                <p className="text-2xl font-bold text-purple-600">{summary.uniqueUsers}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 bg-white border-b">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-700">Filtri</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            {/* Campo ricerca unificato con selezione tipo */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ricerca</label>
              <div className="flex gap-2">
                <select
                  value={filters.searchType}
                  onChange={(e) => handleFilterChange('searchType', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm bg-white min-w-[100px]"
                >
                  <option value="all">Tutto</option>
                  <option value="company">Azienda</option>
                  <option value="email">Email</option>
                </select>
                <div className="relative flex-1">
                  {filters.searchType === 'company' ? (
                    <Building size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  ) : filters.searchType === 'email' ? (
                    <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  ) : (
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            {/* Data Inizio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
              <div className="relative">
                <Calendar size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
            {/* Data Fine */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Fine</label>
              <div className="relative">
                <Calendar size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
            {/* Checkbox solo sessioni attive e pulsante pulisci */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.onlyActive}
                  onChange={(e) => handleFilterChange('onlyActive', e.target.checked)}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">Solo sessioni attive</span>
              </label>
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Pulisci Filtri
              </button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nessun log trovato
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Utente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Azienda</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Login</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Logout</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Durata</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">IP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Stato</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.session_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{log.user_name || '-'}</div>
                          <div className="text-xs text-gray-500">{log.user_email || '-'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {log.user_company || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(log.login_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(log.logout_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {formatDuration(log.duration_seconds)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {log.login_ip || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.logout_at ? (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                            Chiusa
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                            Attiva
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer con totale */}
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                  <tr>
                    <td colSpan="7" className="px-4 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity size={18} className="text-gray-600" />
                          <span className="text-sm font-semibold text-gray-700">
                            Totale accessi visualizzati:
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            {logs.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700">
                            Totale accessi (tutti i filtri):
                          </span>
                          <span className="text-sm font-bold text-orange-600">
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
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Pagina {currentPage} • {logs.length} risultati
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Precedente
              </button>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={logs.length < pageSize}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Successiva
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccessLogsModal;

