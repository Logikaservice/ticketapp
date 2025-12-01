import React, { useState, useEffect } from 'react';
import { Monitor, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const MonitorAuthRequest = ({ monitorId, onAuthorized }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [requested, setRequested] = useState(false);
    const [requestId, setRequestId] = useState(null);
    const [checkingExisting, setCheckingExisting] = useState(true);

    // Verifica se esiste già una richiesta pendente per questo monitor
    useEffect(() => {
        const checkExistingRequest = async () => {
            try {
                const response = await fetch(buildApiUrl('/api/packvision/monitor/requests'));
                if (response.ok) {
                    const requests = await response.json();
                    const existing = requests.find(r => r.monitor_id === monitorId && !r.authorized && new Date(r.expires_at) > new Date());
                    if (existing) {
                        console.log('✅ [MonitorAuthRequest] Richiesta esistente trovata:', existing);
                        setRequested(true);
                        setRequestId(existing.id);
                    }
                }
            } catch (err) {
                console.error('❌ [MonitorAuthRequest] Errore verifica richieste esistenti:', err);
            } finally {
                setCheckingExisting(false);
            }
        };

        checkExistingRequest();
    }, [monitorId]);

    // Ascolta WebSocket per notifiche di autorizzazione
    useEffect(() => {
        // Verifica se esiste un socket già connesso (dal sistema principale)
        const checkSocket = () => {
            // Cerca il socket globale o riconnettiti
            if (window.io) {
                const socket = window.io();
                socket.on('packvision:monitor-authorized', (data) => {
                    if (data.monitor_id === monitorId && data.token) {
                        onAuthorized(data.token);
                    }
                });
                return () => socket.disconnect();
            }
        };

        const cleanup = checkSocket();
        return cleanup;
    }, [monitorId, onAuthorized]);

    const handleRequestAuth = async () => {
        setLoading(true);
        setError(null);

        try {
            console.log('📤 [MonitorAuthRequest] Invio richiesta autorizzazione per monitor', monitorId);
            const apiUrl = buildApiUrl('/api/packvision/monitor/request');
            console.log('🔗 [MonitorAuthRequest] URL:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monitor_id: monitorId })
            });

            console.log('📥 [MonitorAuthRequest] Risposta ricevuta:', {
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers.get('content-type')
            });

            // Controlla se la risposta è JSON o HTML
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('❌ [MonitorAuthRequest] Risposta non JSON ricevuta:', text.substring(0, 200));
                throw new Error('Il server ha restituito una risposta non valida. Verifica che il backend sia raggiungibile.');
            }

            const data = await response.json();
            console.log('✅ [MonitorAuthRequest] Dati ricevuti:', data);

            if (!response.ok) {
                if (response.status === 409) {
                    // Richiesta già esistente
                    setRequested(true);
                    setRequestId(data.request_id);
                    return;
                }
                throw new Error(data.error || 'Errore nella richiesta di autorizzazione');
            }

            setRequested(true);
            setRequestId(data.request_id);
        } catch (err) {
            console.error('❌ [MonitorAuthRequest] Errore:', err);
            setError(err.message || 'Errore nella richiesta di autorizzazione. Verifica la connessione al server.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
                        <Monitor className="w-10 h-10 text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Autorizzazione Monitor {monitorId}
                    </h1>
                    <p className="text-gray-600">
                        Questo monitor richiede autorizzazione per accedere a PackVision
                    </p>
                </div>

                {checkingExisting ? (
                    <div className="text-center py-8">
                        <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                        <p className="text-gray-600">Verifica richieste esistenti...</p>
                    </div>
                ) : !requested ? (
                    <div className="space-y-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <Monitor className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <h3 className="font-semibold text-blue-900 mb-1">
                                        Come funziona?
                                    </h3>
                                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                                        <li>Clicca su "Attesa di accettazione" per creare una richiesta di autorizzazione</li>
                                        <li>La richiesta apparirà immediatamente nella sezione "Richieste in Attesa" di PackVision Control</li>
                                        <li>L'amministratore autorizzerà questo monitor da PackVision Control</li>
                                        <li>Una volta autorizzato, questo monitor avrà accesso permanente</li>
                                        <li>La richiesta scade dopo 15 minuti se non autorizzata</li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm text-red-800">{error}</p>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleRequestAuth}
                            disabled={loading || checkingExisting}
                            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader className="w-5 h-5 animate-spin" />
                                    Creazione richiesta...
                                </>
                            ) : checkingExisting ? (
                                <>
                                    <Loader className="w-5 h-5 animate-spin" />
                                    Verifica richieste...
                                </>
                            ) : (
                                <>
                                    <Monitor className="w-5 h-5" />
                                    Attesa di accettazione
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                            <h3 className="font-semibold text-green-900 mb-2">
                                Richiesta Creata!
                            </h3>
                            <p className="text-sm text-green-800 mb-4">
                                La richiesta di autorizzazione è stata creata e apparirà immediatamente nella sezione "Richieste in Attesa" di PackVision Control.
                            </p>
                            <p className="text-xs text-green-700">
                                ID Richiesta: <span className="font-mono">{requestId}</span>
                            </p>
                        </div>

                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm text-yellow-800">
                                        <strong>In attesa di autorizzazione...</strong><br />
                                        Una volta che l'amministratore avrà autorizzato questo monitor dalla sezione PackVision Control, la pagina si aggiornerà automaticamente.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                        >
                            Ricarica Pagina
                        </button>
                    </div>
                )}

                <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                    <p className="text-xs text-gray-500">
                        Questo sistema protegge l'accesso non autorizzato ai monitor PackVision
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MonitorAuthRequest;

