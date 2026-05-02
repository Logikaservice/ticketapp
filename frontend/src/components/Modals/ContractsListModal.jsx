import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Search, Filter, RefreshCw, Calendar, Trash2, FileText } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import ContractTimelineCard from '../ContractTimelineCard';
import {
  getStoredTechHubAccent,
  techHubAccentHeaderGradientStyle,
  hubShellThemeVars
} from '../../utils/techHubAccent';

const ContractsListModal = ({ onClose, getAuthHeader, notify }) => {
    const dashboardAccentHex = useMemo(() => getStoredTechHubAccent(), []);
    const hubTheme = useMemo(() => hubShellThemeVars(dashboardAccentHex), [dashboardAccentHex]);
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

    const inputFieldDark =
      'border border-white/10 bg-[color:var(--hub-surface)] text-white placeholder:text-white/35 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[color:var(--td-accent)]';

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div
              className="contracts-list-hub-shell flex h-[90vh] w-full max-w-screen-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--hub-page)] text-white/90 shadow-2xl animate-scaleIn"
              style={{ ...hubTheme, colorScheme: 'dark' }}
            >
                <div
                  className="flex shrink-0 items-center justify-between border-b px-5 py-3.5 text-white"
                  style={techHubAccentHeaderGradientStyle(dashboardAccentHex)}
                >
                    <div>
                        <h2 className="flex items-center gap-2 text-xl font-bold">
                          <FileText size={22} aria-hidden />
                          Lista contratti attivi
                        </h2>
                        <p className="mt-0.5 text-xs leading-snug text-white/82">
                          Cerca, filtra e gestisci i contratti dall&apos;Hub tecnico (stesso tema colore dell&apos;Hub).
                        </p>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-xl bg-white/20 p-1.5 transition hover:bg-white/30"
                      aria-label="Chiudi"
                    >
                        <X size={22} className="text-white" aria-hidden />
                    </button>
                </div>

                <div className="flex shrink-0 flex-col gap-2.5 border-b border-white/10 bg-[color:var(--hub-surface)] px-4 py-3">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/38" size={18} />
                            <input
                                type="text"
                                placeholder="Cerca per titolo, cliente o azienda..."
                                className={`w-full rounded-lg py-1.5 pl-9 pr-3 text-sm hover:border-[color:var(--td-accent)] ${inputFieldDark}`}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${
                              showFilters || filterStatus !== 'all' || filterDateFrom || filterDateTo
                                ? 'border-[color:var(--td-accent)] bg-[color:var(--td-soft-strong)] text-[color:var(--td-accent)]'
                                : 'border-white/12 bg-white/[0.06] text-white/88 hover:border-[color:var(--td-accent)] hover:bg-[color:var(--td-soft)]'
                            }`}
                        >
                            <Filter size={16} />
                            Filtri
                        </button>
                        <button
                            type="button"
                            onClick={fetchContracts}
                            disabled={loading}
                            className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-3 py-1.5 text-sm text-white/85 transition hover:border-[color:var(--td-accent)] hover:bg-[color:var(--td-soft)] disabled:opacity-50"
                            title="Aggiorna lista"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {/* Filtri Avanzati */}
                    {showFilters && (
                        <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-2 md:grid-cols-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-white/72">Stato</label>
                                <select
                                    className={`w-full rounded-lg px-3 py-2 ${inputFieldDark}`}
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                >
                                    <option value="all">Tutti</option>
                                    <option value="active">Attivi</option>
                                    <option value="expired">Scaduti</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 flex items-center gap-1 text-sm font-medium text-white/72">
                                    <Calendar size={14} className="text-white/55" aria-hidden />
                                    Data Inizio Da
                                </label>
                                <input
                                    type="date"
                                    className={`w-full rounded-lg px-3 py-2 ${inputFieldDark}`}
                                    value={filterDateFrom}
                                    onChange={e => setFilterDateFrom(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="mb-1 flex items-center gap-1 text-sm font-medium text-white/72">
                                    <Calendar size={14} className="text-white/55" aria-hidden />
                                    Data Fine Fino A
                                </label>
                                <input
                                    type="date"
                                    className={`w-full rounded-lg px-3 py-2 ${inputFieldDark}`}
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
                                    className="w-full rounded-lg border border-white/12 bg-white/[0.06] px-4 py-2 text-white/88 transition hover:border-[color:var(--td-accent)] hover:bg-[color:var(--td-soft)]"
                                >
                                    Reset Filtri
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--hub-page)] px-4 py-3">
                    {loading ? (
                        <div className="flex justify-center py-10">
                          <div
                            className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[color:var(--td-accent)]"
                            role="status"
                            aria-label="Caricamento"
                          />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-20 text-center">
                            <div className="mb-2 text-white/45">Nessun contratto trovato</div>
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
                        <div className="space-y-3">
                            {filtered.map(contract => (
                                <div key={contract.id} className="relative">
                                    {/* Etichetta Cliente con Pulsante Elimina */}
                                    <div className="mb-1 ml-0.5 flex items-center justify-between text-xs font-bold text-white/86">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--td-accent)]" aria-hidden />
                                            {contract.client_name || contract.azienda || 'Cliente Sconosciuto'}
                                        </div>
                                        <button
                                            onClick={() => handleDelete(contract.id, contract.title)}
                                            disabled={deletingId === contract.id}
                                            type="button"
                                            className="flex items-center gap-1.5 rounded-md bg-red-500/15 px-2 py-1 text-[11px] text-red-400 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                                            title="Disattiva contratto"
                                        >
                                            <Trash2 size={14} />
                                            {deletingId === contract.id ? 'Eliminazione...' : 'Elimina'}
                                        </button>
                                    </div>
                                    <ContractTimelineCard contract={contract} variant="hub" compact />
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
