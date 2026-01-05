import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Clock, Calendar } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';

const EditContractModal = ({ contract, onClose, getAuthHeader, notify, onSuccess }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);

    useEffect(() => {
        if (contract && contract.events) {
            setEvents([...contract.events]);
        }
    }, [contract]);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const handleToggleEvent = async (event) => {
        if (updatingId === event.id) return;

        setUpdatingId(event.id);
        setLoading(true);

        try {
            const res = await fetch(buildApiUrl(`/api/contracts/${contract.id}/events/${event.id}`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({
                    is_processed: !event.is_processed
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Errore durante l\'aggiornamento');
            }

            const data = await res.json();
            
            // Update local state
            setEvents(prevEvents => 
                prevEvents.map(ev => 
                    ev.id === event.id ? { ...ev, is_processed: data.event.is_processed } : ev
                )
            );

            notify('Stato evento aggiornato con successo', 'success');
            
            // Emetti evento per ricaricare i contratti nella dashboard
            window.dispatchEvent(new CustomEvent('contractUpdated', { detail: { contractId: contract.id } }));
            
            // Trigger refresh
            if (onSuccess) {
                onSuccess();
            }
        } catch (err) {
            console.error('Error updating event:', err);
            notify(err.message || 'Errore durante l\'aggiornamento dell\'evento', 'error');
        } finally {
            setLoading(false);
            setUpdatingId(null);
        }
    };

    if (!contract) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Modifica Contratto</h2>
                        <p className="text-sm text-slate-500">{contract.title}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="space-y-4">
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Eventi Fatturazione</h3>
                            <p className="text-sm text-slate-500">
                                Clicca su un evento per marcare come eseguito/non eseguito
                            </p>
                        </div>

                        <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="p-3">Data</th>
                                        <th className="p-3">Descrizione</th>
                                        <th className="p-3">Importo</th>
                                        <th className="p-3">Stato</th>
                                        <th className="p-3">Azione</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {events.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="p-6 text-center text-slate-500">
                                                Nessun evento disponibile
                                            </td>
                                        </tr>
                                    )}
                                    {events.map((event) => {
                                        const isProcessed = event.is_processed === true;
                                        const isUpdating = updatingId === event.id;

                                        return (
                                            <tr 
                                                key={event.id} 
                                                className={`border-t border-slate-200 hover:bg-white transition ${
                                                    isProcessed ? 'bg-green-50' : ''
                                                }`}
                                            >
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={16} className="text-slate-400" />
                                                        <span className="font-medium">{formatDate(event.event_date)}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <span className="font-medium">{event.description || 'Fattura'}</span>
                                                </td>
                                                <td className="p-3">
                                                    {event.amount ? (
                                                        <span className="font-semibold">€ {parseFloat(event.amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                                                        isProcessed 
                                                            ? 'bg-green-100 text-green-700 border border-green-300' 
                                                            : 'bg-amber-100 text-amber-700 border border-amber-300'
                                                    }`}>
                                                        {isProcessed ? (
                                                            <>
                                                                <CheckCircle size={14} />
                                                                Eseguito
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Clock size={14} />
                                                                In attesa
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <button
                                                        onClick={() => handleToggleEvent(event)}
                                                        disabled={isUpdating || loading}
                                                        className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 ${
                                                            isProcessed
                                                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300'
                                                                : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-300'
                                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                    >
                                                        {isUpdating ? (
                                                            <>
                                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                                                Aggiornamento...
                                                            </>
                                                        ) : (
                                                            <>
                                                                {isProcessed ? (
                                                                    <>
                                                                        <Clock size={16} />
                                                                        Segna non eseguito
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <CheckCircle size={16} />
                                                                        Segna eseguito
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-slate-50 rounded-b-2xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition"
                    >
                        Chiudi
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditContractModal;

