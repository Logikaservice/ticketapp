import React, { useState, useEffect } from 'react';
import { Monitor, CheckCircle, XCircle, Clock, RefreshCw, Trash2 } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const MonitorAuthManager = () => {
    const [requests, setRequests] = useState([]);
    const [authorizedMonitors, setAuthorizedMonitors] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadRequests = async () => {
        try {
            const response = await fetch(buildApiUrl('/api/packvision/monitor/requests'));
            if (response.ok) {
                const data = await response.json();
                setRequests(data);
            }
        } catch (err) {
            console.error('Errore caricamento richieste:', err);
        }
    };

    const loadAuthorized = async () => {
        try {
            const response = await fetch(buildApiUrl('/api/packvision/monitor/list'));
            if (response.ok) {
                const data = await response.json();
                setAuthorizedMonitors(data);
            }
        } catch (err) {
            console.error('Errore caricamento monitor autorizzati:', err);
        }
    };

    useEffect(() => {
        loadRequests();
        loadAuthorized();
        setLoading(false);

        // Aggiorna ogni 5 secondi
        const interval = setInterval(() => {
            loadRequests();
            loadAuthorized();
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    const handleApprove = async (requestId) => {
        try {
            console.log('📤 [MonitorAuthManager] Invio richiesta approvazione per request_id:', requestId);
            const response = await fetch(buildApiUrl('/api/packvision/monitor/approve'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_id: requestId })
            });

            console.log('📥 [MonitorAuthManager] Risposta ricevuta:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('❌ [MonitorAuthManager] Risposta non JSON:', text.substring(0, 200));
                alert(`Errore: Il server ha restituito una risposta non valida (${response.status})`);
                return;
            }

            const data = await response.json();
            console.log('📥 [MonitorAuthManager] Dati ricevuti:', data);

            if (response.ok) {
                // Aggiorna le liste
                await loadRequests();
                await loadAuthorized();
                alert(`✅ Monitor ${data.monitor_id} autorizzato con successo!`);
            } else {
                alert(`❌ Errore: ${data.error || 'Impossibile autorizzare il monitor'}`);
            }
        } catch (err) {
            console.error('❌ [MonitorAuthManager] Errore approvazione:', err);
            alert(`❌ Errore nell'autorizzazione del monitor: ${err.message}`);
        }
    };

    const handleRevoke = async (monitorId) => {
        if (!window.confirm(`Sei sicuro di voler revocare l'autorizzazione per il Monitor ${monitorId}?`)) {
            return;
        }

        try {
            const response = await fetch(buildApiUrl(`/api/packvision/monitor/revoke/${monitorId}`), {
                method: 'DELETE'
            });

            if (response.ok) {
                await loadAuthorized();
                alert(`Autorizzazione Monitor ${monitorId} revocata`);
            } else {
                alert('Errore nella revoca dell\'autorizzazione');
            }
        } catch (err) {
            console.error('Errore revoca:', err);
            alert('Errore nella revoca dell\'autorizzazione');
        }
    };

    if (loading) {
        return <div className="text-center py-8 text-gray-500">Caricamento...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Monitor Autorizzati */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <CheckCircle className="text-green-600" size={20} />
                        Monitor Autorizzati
                    </h3>
                </div>
                <div className="p-6">
                    {authorizedMonitors.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">Nessun monitor autorizzato</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map((monitorId) => {
                                const auth = authorizedMonitors.find(m => m.monitor_id === monitorId);
                                if (!auth) return null;
                                
                                return (
                                    <div key={monitorId} className="border border-green-200 rounded-lg p-4 bg-green-50">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <Monitor className="text-green-600" size={24} />
                                                <span className="font-bold text-gray-900">Monitor {monitorId}</span>
                                            </div>
                                            <button
                                                onClick={() => handleRevoke(monitorId)}
                                                className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                                title="Revoca autorizzazione"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div className="text-xs text-gray-600 space-y-1">
                                            <p><strong>Autorizzato:</strong> {new Date(auth.authorized_at).toLocaleString('it-IT')}</p>
                                            <p><strong>IP:</strong> {auth.ip_address}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Richieste in Attesa */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 border-b flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Clock className="text-amber-600" size={20} />
                        Richieste in Attesa
                    </h3>
                    <button
                        onClick={() => { loadRequests(); loadAuthorized(); }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Aggiorna"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
                <div className="p-6">
                    {requests.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">Nessuna richiesta in attesa</p>
                    ) : (
                        <div className="space-y-3">
                            {requests.map((request) => (
                                <div
                                    key={request.id}
                                    className="border border-amber-200 rounded-lg p-4 bg-amber-50 hover:bg-amber-100 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold">
                                                    {request.monitor_id}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900">
                                                        Monitor {request.monitor_id}
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                        Codice: <span className="font-mono font-bold text-blue-600">{request.authorization_code}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-600 space-y-1 ml-14">
                                                <p><strong>IP:</strong> {request.ip_address}</p>
                                                <p><strong>Browser:</strong> {request.user_agent?.substring(0, 80)}...</p>
                                                <p><strong>Richiesto:</strong> {new Date(request.created_at).toLocaleString('it-IT')}</p>
                                                <p><strong>Scade:</strong> {new Date(request.expires_at).toLocaleString('it-IT')}</p>
                                                {(() => {
                                                    const expiresAt = new Date(request.expires_at);
                                                    const now = new Date();
                                                    const minutesLeft = Math.max(0, Math.floor((expiresAt - now) / 60000));
                                                    return minutesLeft > 0 ? (
                                                        <p className="text-amber-600 font-semibold">
                                                            ⏱️ Tempo rimanente: {minutesLeft} minuti
                                                        </p>
                                                    ) : (
                                                        <p className="text-red-600 font-semibold">
                                                            ⚠️ Scaduta
                                                        </p>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleApprove(request.id)}
                                            className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
                                        >
                                            <CheckCircle size={18} />
                                            Autorizza
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MonitorAuthManager;

