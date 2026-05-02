import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Search, Filter, RefreshCw, Calendar, Trash2, FileText } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import ContractTimelineCard from '../ContractTimelineCard';
import {
  getStoredTechHubAccent,
  hexToRgba,
  techHubAccentHeaderGradientStyle
} from '../../utils/techHubAccent';

const ContractsListModal = ({ onClose, getAuthHeader, notify }) => {
    const dashboardAccentHex = useMemo(() => getStoredTechHubAccent(), []);
    const dashboardThemeVars = useMemo(
      () => ({
        '--td-accent': dashboardAccentHex,
        '--td-soft': hexToRgba(dashboardAccentHex, 0.08),
        '--td-soft-strong': hexToRgba(dashboardAccentHex, 0.16)
      }),
      [dashboardAccentHex]
    );
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // all, active, expired
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const fetchContracts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(buildApiUrl('/api/contracts'), { headers: getAuthHeader() });
            const data = await res.json();
            if (Array.isArray(data)) {
                setContracts(data);
            } else {
                console.error('Invalid contracts data:', data);
                setContracts([]);
            }
        } catch (err) {
            console.error('Error fetching contracts:', err);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeader]);

    useEffect(() => {
        fetchContracts();
    }, [fetchContracts]);

    // Listener per refresh automatico quando viene creato un nuovo contratto
    useEffect(() => {
        const handleContractCreated = () => {
            fetchContracts();
        };
        window.addEventListener('contractCreated', handleContractCreated);
        return () => window.removeEventListener('contractCreated', handleContractCreated);
    }, [fetchContracts]);

    const filtered = contracts.filter(c => {
        // Filtro ricerca testo
        const matchesSearch = !searchTerm || 
            (c.title && c.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (c.client_name && c.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (c.azienda && c.azienda.toLowerCase().includes(searchTerm.toLowerCase()));

        // Filtro stato
        const matchesStatus = filterStatus === 'all' ||
            (filterStatus === 'active' && c.active && (!c.end_date || new Date(c.end_date) >= new Date())) ||
            (filterStatus === 'expired' && (c.end_date && new Date(c.end_date) < new Date()));

        // Filtro data inizio
        const matchesDateFrom = !filterDateFrom || !c.start_date || new Date(c.start_date) >= new Date(filterDateFrom);

        // Filtro data fine
        const matchesDateTo = !filterDateTo || !c.end_date || new Date(c.end_date) <= new Date(filterDateTo);

        return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });

    const handleDelete = async (contractId, contractTitle) => {
        if (!window.confirm(`Sei sicuro di voler disattivare il contratto "${contractTitle}"?\n\nIl contratto verrà disattivato e non sarà più visibile nella lista dei contratti attivi.`)) {
            return;
        }

        setDeletingId(contractId);
        try {
            const res = await fetch(buildApiUrl(`/api/contracts/${contractId}`), {
                method: 'DELETE',
                headers: getAuthHeader()
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Errore durante la disattivazione del contratto');
            }

            // Rimuovi dalla lista locale
            setContracts(prev => prev.filter(c => c.id !== contractId));
            notify('Contratto disattivato con successo', 'success');
            
            // Dispatch evento per aggiornare Dashboard se necessario
            window.dispatchEvent(new CustomEvent('contractDeleted', { detail: { contractId } }));
        } catch (err) {
            console.error('Error deleting contract:', err);
            const errorMessage = err.message || 'Errore durante la disattivazione del contratto';
            notify(errorMessage, 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const inputFocusChrome =
      'outline-none rounded-xl border transition focus:border-transparent focus:ring-2 focus:ring-[color:var(--td-accent)]';

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div
              className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-scaleIn contracts-list-dashboard-accent"
              style={dashboardThemeVars}
            >
                <div
                  className="flex shrink-0 items-center justify-between border-b px-6 py-5 text-white"
                  style={techHubAccentHeaderGradientStyle(dashboardAccentHex)}
                >
                    <div>
                        <h2 className="flex items-center gap-2 text-2xl font-bold">
                          <FileText size={26} aria-hidden />
                          Lista contratti attivi
                        </h2>
                        <p className="mt-1 text-sm text-white/90">
                          Cerca, filtra e gestisci i contratti salvati nell&apos;area ticket.
                        </p>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-xl bg-white/20 p-2 transition hover:bg-white/30"
                      aria-label="Chiudi"
                    >
                        <X size={24} className="text-white" aria-hidden />
                    </button>
                </div>

                <div className="flex shrink-0 flex-col gap-4 border-b p-4" style={{ backgroundColor: hexToRgba(dashboardAccentHex, 0.06) }}>
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Cerca per titolo, cliente o azienda..."
                                className={`w-full border border-gray-200 bg-white py-2 pl-10 pr-4 ${inputFocusChrome} hover:border-[color:var(--td-accent)]`}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 rounded-xl border px-4 py-2 transition ${
                              showFilters || filterStatus !== 'all' || filterDateFrom || filterDateTo
                                ? 'border-[color:var(--td-accent)] bg-[color:var(--td-soft-strong)] text-[color:var(--td-accent)]'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-[color:var(--td-accent)] hover:bg-[color:var(--td-soft)]'
                            }`}
                        >
                            <Filter size={18} />
                            Filtri
                        </button>
                        <button
                            type="button"
                            onClick={fetchContracts}
                            disabled={loading}
                            className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-700 transition hover:border-[color:var(--td-accent)] hover:bg-[color:var(--td-soft)] disabled:opacity-50"
                            title="Aggiorna lista"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {/* Filtri Avanzati */}
                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                                <select
                                    className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2 ${inputFocusChrome.replace('rounded-xl', 'rounded-lg')}`}
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                >
                                    <option value="all">Tutti</option>
                                    <option value="active">Attivi</option>
                                    <option value="expired">Scaduti</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                    <Calendar size={14} />
                                    Data Inizio Da
                                </label>
                                <input
                                    type="date"
                                    className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2 ${inputFocusChrome.replace('rounded-xl', 'rounded-lg')}`}
                                    value={filterDateFrom}
                                    onChange={e => setFilterDateFrom(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                    <Calendar size={14} />
                                    Data Fine Fino A
                                </label>
                                <input
                                    type="date"
                                    className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2 ${inputFocusChrome.replace('rounded-xl', 'rounded-lg')}`}
                                    value={filterDateTo}
                                    onChange={e => setFilterDateTo(e.target.value)}
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilterStatus('all');
                                        setFilterDateFrom('');
                                        setFilterDateTo('');
                                    }}
                                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-gray-700 transition hover:border-[color:var(--td-accent)] hover:bg-[color:var(--td-soft)]"
                                >
                                    Reset Filtri
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-6">
                    {loading ? (
                        <div className="flex justify-center py-10">
                          <div
                            className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-[color:var(--td-accent)]"
                            role="status"
                            aria-label="Caricamento"
                          />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="text-gray-500 mb-2">Nessun contratto trovato</div>
                            {(filterStatus !== 'all' || filterDateFrom || filterDateTo || searchTerm) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setFilterStatus('all');
                                        setFilterDateFrom('');
                                        setFilterDateTo('');
                                    }}
                                    className="text-sm text-[color:var(--td-accent)] underline decoration-[color:var(--td-accent)]/50 underline-offset-2 hover:opacity-85"
                                >
                                    Rimuovi tutti i filtri
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {filtered.map(contract => (
                                <div key={contract.id} className="relative">
                                    {/* Etichetta Cliente con Pulsante Elimina */}
                                    <div className="mb-2 text-sm font-bold text-gray-700 ml-1 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--td-accent)]" aria-hidden />
                                            {contract.client_name || contract.azienda || 'Cliente Sconosciuto'}
                                        </div>
                                        <button
                                            onClick={() => handleDelete(contract.id, contract.title)}
                                            disabled={deletingId === contract.id}
                                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                            title="Disattiva contratto"
                                        >
                                            <Trash2 size={14} />
                                            {deletingId === contract.id ? 'Eliminazione...' : 'Elimina'}
                                        </button>
                                    </div>
                                    <ContractTimelineCard contract={contract} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContractsListModal;
