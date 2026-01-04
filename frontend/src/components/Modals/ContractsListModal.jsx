import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Filter, RefreshCw, Calendar, Trash2 } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import ContractTimelineCard from '../ContractTimelineCard';

const ContractsListModal = ({ onClose, getAuthHeader, notify }) => {
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

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl animate-scaleIn">
                <div className="p-6 border-b flex justify-between items-center bg-white rounded-t-2xl">
                    <h2 className="text-2xl font-bold text-gray-800">Lista Contratti Attivi</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 border-b bg-gray-50 flex flex-col gap-4">
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Cerca per titolo, cliente o azienda..."
                                className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-4 py-2 border rounded-xl transition-colors flex items-center gap-2 ${
                                showFilters || filterStatus !== 'all' || filterDateFrom || filterDateTo
                                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <Filter size={18} />
                            Filtri
                        </button>
                        <button
                            onClick={fetchContracts}
                            disabled={loading}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
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
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={filterDateTo}
                                    onChange={e => setFilterDateTo(e.target.value)}
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={() => {
                                        setFilterStatus('all');
                                        setFilterDateFrom('');
                                        setFilterDateTo('');
                                    }}
                                    className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors"
                                >
                                    Reset Filtri
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                    {loading ? (
                        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="text-gray-500 mb-2">Nessun contratto trovato</div>
                            {(filterStatus !== 'all' || filterDateFrom || filterDateTo || searchTerm) && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setFilterStatus('all');
                                        setFilterDateFrom('');
                                        setFilterDateTo('');
                                    }}
                                    className="text-blue-600 hover:text-blue-700 text-sm underline"
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
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
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
