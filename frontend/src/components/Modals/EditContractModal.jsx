import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Calendar } from 'lucide-react';
import { buildApiUrl } from '../../utils/apiConfig';
import {
  HubModalInnerCard,
  HubModalChromeHeader,
  HubModalBody,
  HubModalChromeFooter,
  HubModalSecondaryButton,
} from './HubModalChrome';

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
        <HubModalInnerCard maxWidthClass="max-w-4xl" className="flex max-h-[90vh] flex-col overflow-y-auto">
                <HubModalChromeHeader
                  icon={Calendar}
                  title="Modifica Contratto"
                  subtitle={contract.title}
                  onClose={onClose}
                />

                <HubModalBody className="flex-1">
                    <div className="space-y-4">
                        <div className="mb-4">
                            <h3 className="mb-2 text-lg font-semibold text-white">Eventi Fatturazione</h3>
                            <p className="text-sm text-white/55">
                                Clicca su un evento per marcare come eseguito/non eseguito
                            </p>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                            <table className="w-full text-left text-sm text-white">
                                <thead className="bg-black/30 text-white/70">
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
                                            <td colSpan="5" className="p-6 text-center text-white/50">
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
                                                className={`border-t border-white/10 transition hover:bg-white/[0.04] ${
                                                    isProcessed ? 'bg-emerald-500/10' : ''
                                                }`}
                                            >
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={16} className="text-white/45" />
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
                                                        <span className="text-white/40">-</span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                                                        isProcessed 
                                                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100' 
                                                            : 'border-amber-400/40 bg-amber-500/15 text-amber-100'
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
                                                        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                                                            isProcessed
                                                                ? 'border-amber-400/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20'
                                                                : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
                                                        } disabled:cursor-not-allowed disabled:opacity-50`}
                                                    >
                                                        {isUpdating ? (
                                                            <>
                                                                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
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
                </HubModalBody>

                <HubModalChromeFooter className="justify-end">
                    <HubModalSecondaryButton onClick={onClose}>Chiudi</HubModalSecondaryButton>
                </HubModalChromeFooter>
        </HubModalInnerCard>
    );
};

export default EditContractModal;

