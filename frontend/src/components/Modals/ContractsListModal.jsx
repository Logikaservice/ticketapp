import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import ContractTimelineCard from '../ContractTimelineCard';

const ContractsListModal = ({ onClose, getAuthHeader }) => {
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchContracts = async () => {
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
        };
        fetchContracts();
    }, [getAuthHeader]);

    const filtered = contracts.filter(c =>
        (c.title && c.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.client_name && c.client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.azienda && c.azienda.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl animate-scaleIn">
                <div className="p-6 border-b flex justify-between items-center bg-white rounded-t-2xl">
                    <h2 className="text-2xl font-bold text-gray-800">Lista Contratti Attivi</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 border-b bg-gray-50 flex gap-4">
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
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                    {loading ? (
                        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-20 text-gray-500">Nessun contratto trovato</div>
                    ) : (
                        <div className="space-y-6">
                            {filtered.map(contract => (
                                <div key={contract.id}>
                                    {/* Etichetta Cliente */}
                                    <div className="mb-2 text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        {contract.client_name || contract.azienda || 'Cliente Sconosciuto'}
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
