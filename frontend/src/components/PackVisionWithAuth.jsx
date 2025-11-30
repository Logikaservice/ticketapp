import React, { useState, useEffect } from 'react';
import PackVision from './PackVision';
import MonitorAuthRequest from './MonitorAuthRequest';
import { buildApiUrl } from '../utils/apiConfig';

const PackVisionWithAuth = ({ monitorId, onClose }) => {
    const [monitorAuthorized, setMonitorAuthorized] = useState(null); // null = checking, true = authorized, false = not authorized
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkMonitorAuth = async () => {
            if (!monitorId || monitorId < 1 || monitorId > 4) {
                // Nessun monitor_id, mostra direttamente PackVision
                setMonitorAuthorized(true);
                setChecking(false);
                return;
            }

            const savedToken = localStorage.getItem(`packvision_monitor_${monitorId}_token`);
            
            if (!savedToken) {
                setMonitorAuthorized(false);
                setChecking(false);
                return;
            }

            try {
                const response = await fetch(buildApiUrl('/api/packvision/monitor/verify'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: savedToken, monitor_id: monitorId })
                });

                const data = await response.json();

                if (data.authorized) {
                    setMonitorAuthorized(true);
                    // Bypassa il login impostando uno stato speciale
                    localStorage.setItem('packvision_monitor_auth', 'true');
                    localStorage.setItem('packvision_monitor_id', monitorId.toString());
                } else {
                    // Token non valido, rimuovilo
                    localStorage.removeItem(`packvision_monitor_${monitorId}_token`);
                    setMonitorAuthorized(false);
                }
            } catch (err) {
                console.error('Errore verifica token monitor:', err);
                setMonitorAuthorized(false);
            } finally {
                setChecking(false);
            }
        };

        checkMonitorAuth();
    }, [monitorId]);

    // Polling ogni 10 secondi per verificare se è stato autorizzato (solo se non autorizzato)
    useEffect(() => {
        if (monitorAuthorized === false && monitorId) {
            const interval = setInterval(async () => {
                const savedToken = localStorage.getItem(`packvision_monitor_${monitorId}_token`);
                if (savedToken) {
                    try {
                        const response = await fetch(buildApiUrl('/api/packvision/monitor/verify'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token: savedToken, monitor_id: monitorId })
                        });

                        const data = await response.json();

                        if (data.authorized) {
                            setMonitorAuthorized(true);
                            localStorage.setItem('packvision_monitor_auth', 'true');
                            localStorage.setItem('packvision_monitor_id', monitorId.toString());
                        }
                    } catch (err) {
                        console.error('Errore verifica token monitor (polling):', err);
                    }
                }
            }, 10000); // Controlla ogni 10 secondi

            return () => clearInterval(interval);
        }
    }, [monitorAuthorized, monitorId]);

    // Callback quando il monitor viene autorizzato (via WebSocket o polling)
    const handleAuthorized = (token) => {
        localStorage.setItem(`packvision_monitor_${monitorId}_token`, token);
        localStorage.setItem('packvision_monitor_auth', 'true');
        localStorage.setItem('packvision_monitor_id', monitorId.toString());
        setMonitorAuthorized(true);
    };

    if (checking) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Verifica autorizzazione...</p>
                </div>
            </div>
        );
    }

    if (monitorAuthorized === false && monitorId) {
        return <MonitorAuthRequest monitorId={monitorId} onAuthorized={handleAuthorized} />;
    }

    return <PackVision onClose={onClose} />;
};

export default PackVisionWithAuth;

