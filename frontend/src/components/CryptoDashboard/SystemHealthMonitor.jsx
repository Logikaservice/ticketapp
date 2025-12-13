import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Activity, Database, Radio, Layers } from 'lucide-react';

// Usa stessa logica di CryptoDashboard per determinare API URL
const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';

const SystemHealthMonitor = ({ compact = false }) => {
    const [healthStatus, setHealthStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);

    // Fetch health status
    const fetchHealthStatus = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/crypto/health-status`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            if (data.success) {
                setHealthStatus(data.status);
                setLastUpdate(new Date());
            } else {
                throw new Error('Risposta non valida dal server');
            }
        } catch (error) {
            console.error('Errore fetch health status:', error);
            setHealthStatus({
                overall: 'error',
                criticalIssues: ['Impossibile contattare backend - ' + error.message],
                backend: { healthy: false, message: 'Backend non raggiungibile' },
                database: { healthy: false, message: 'Non verificato' },
                websocket: { healthy: false, message: 'Non verificato' },
                aggregator: { healthy: false, message: 'Non verificato' }
            });
            setLastUpdate(new Date());
        } finally {
            setLoading(false);
        }
    };

    // Auto-refresh ogni 30 secondi
    useEffect(() => {
        fetchHealthStatus();
        const interval = setInterval(fetchHealthStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    // Loading state
    if (loading && !healthStatus) {
        return (
            <div className="flex items-center space-x-2 text-gray-400">
                <Activity className="w-4 h-4 animate-spin" />
                <span className="text-sm">Verifica sistema...</span>
            </div>
        );
    }

    const isHealthy = healthStatus?.overall === 'healthy';
    const hasIssues = healthStatus?.criticalIssues?.length > 0;

    // Compact view (per header/navbar)
    if (compact) {
        return (
            <button
                onClick={() => setShowDetails(!showDetails)}
                className="relative flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
            >
                {/* Alert triangle lampeggiante se problemi */}
                {hasIssues && (
                    <div className="absolute -top-1 -right-1 animate-pulse">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 fill-yellow-500/20" />
                    </div>
                )}
                
                {/* Icona stato */}
                <Activity className={`w-5 h-5 ${isHealthy ? 'text-green-500' : 'text-red-500'}`} />
                
                {showDetails && (
                    <div className="absolute top-full right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 p-4">
                        <SystemHealthDetails status={healthStatus} onClose={() => setShowDetails(false)} />
                    </div>
                )}
            </button>
        );
    }

    // Full view (per settings)
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Activity className={`w-6 h-6 ${isHealthy ? 'text-green-500' : 'text-red-500'}`} />
                    <div>
                        <h3 className="text-lg font-semibold text-white">
                            Stato Sistema
                        </h3>
                        <p className="text-sm text-gray-400">
                            {isHealthy ? 'Tutti i servizi operativi' : `${healthStatus?.criticalIssues?.length || 0} problemi rilevati`}
                        </p>
                    </div>
                </div>

                {/* Alert lampeggiante */}
                {hasIssues && (
                    <div className="animate-pulse">
                        <AlertTriangle className="w-8 h-8 text-yellow-500 fill-yellow-500/20" />
                    </div>
                )}
            </div>

            {/* Stato servizi */}
            <div className="space-y-2">
                <ServiceStatus
                    icon={<Activity className="w-5 h-5" />}
                    name="Backend"
                    status={healthStatus?.backend}
                />
                <ServiceStatus
                    icon={<Database className="w-5 h-5" />}
                    name="Database"
                    status={healthStatus?.database}
                />
                <ServiceStatus
                    icon={<Radio className="w-5 h-5" />}
                    name="WebSocket"
                    status={healthStatus?.websocket}
                />
                <ServiceStatus
                    icon={<Layers className="w-5 h-5" />}
                    name="Aggregatore Klines"
                    status={healthStatus?.aggregator}
                />
            </div>

            {/* Problemi rilevati */}
            {hasIssues && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-yellow-500 mb-2">
                        Problemi Rilevati:
                    </h4>
                    <ul className="space-y-1">
                        {healthStatus.criticalIssues.map((issue, idx) => (
                            <li key={idx} className="text-sm text-yellow-200 flex items-start space-x-2">
                                <span className="text-yellow-500 mt-0.5">•</span>
                                <span>{issue}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Last update */}
            <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">
                    Ultimo aggiornamento: {lastUpdate?.toLocaleTimeString() || 'N/A'}
                </span>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fetchHealthStatus();
                    }}
                    disabled={loading}
                    style={{
                        padding: '6px 12px',
                        background: loading ? '#374151' : '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        opacity: loading ? 0.5 : 1,
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => !loading && (e.target.style.background = '#2563eb')}
                    onMouseLeave={(e) => !loading && (e.target.style.background = '#3b82f6')}
                >
                    {loading ? '⏳ Caricamento...' : '🔄 Aggiorna'}
                </button>
            </div>
        </div>
    );
};

// Componente per singolo servizio
const ServiceStatus = ({ icon, name, status }) => {
    const isHealthy = status?.healthy;
    
    return (
        <div className={`flex items-center justify-between p-3 rounded-lg border ${
            isHealthy 
                ? 'bg-green-500/5 border-green-500/20' 
                : 'bg-red-500/5 border-red-500/20'
        }`}>
            <div className="flex items-center space-x-3">
                <div className={isHealthy ? 'text-green-500' : 'text-red-500'}>
                    {icon}
                </div>
                <div>
                    <div className="text-sm font-medium text-white">
                        {name}
                    </div>
                    <div className={`text-xs ${isHealthy ? 'text-green-400' : 'text-red-400'}`}>
                        {status?.message || 'Non verificato'}
                    </div>
                </div>
            </div>
            
            <div>
                {isHealthy ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                )}
            </div>
        </div>
    );
};

// Componente dettagli (per compact view)
const SystemHealthDetails = ({ status, onClose }) => {
    const isHealthy = status?.overall === 'healthy';
    
    return (
        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                <h4 className="text-sm font-semibold text-white">Stato Sistema</h4>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    ×
                </button>
            </div>

            <div className="space-y-2">
                <ServiceStatusCompact name="Backend" status={status?.backend} />
                <ServiceStatusCompact name="Database" status={status?.database} />
                <ServiceStatusCompact name="WebSocket" status={status?.websocket} />
                <ServiceStatusCompact name="Aggregatore" status={status?.aggregator} />
            </div>

            {status?.criticalIssues?.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                    <p className="text-xs font-semibold text-yellow-500 mb-1">Problemi:</p>
                    <ul className="space-y-1">
                        {status.criticalIssues.map((issue, idx) => (
                            <li key={idx} className="text-xs text-yellow-200">• {issue}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="text-xs text-gray-500 text-center">
                Aggiornamento automatico ogni 30s
            </div>
        </div>
    );
};

const ServiceStatusCompact = ({ name, status }) => {
    const isHealthy = status?.healthy;
    
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-gray-300">{name}</span>
            <div className="flex items-center space-x-2">
                {isHealthy ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                )}
            </div>
        </div>
    );
};

export default SystemHealthMonitor;
