// frontend/src/components/EmailQuotaPanel.jsx
// Pannello spazio occupato caselle email - stile card con barre colorate
// Integrato nella EmailPage come tab aggiuntivo

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, HardDrive, AlertTriangle, CheckCircle, XCircle, Mail, Clock } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const EmailQuotaPanel = ({ aziendaName, getAuthHeader }) => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [lastScan, setLastScan] = useState(null);
    const [error, setError] = useState(null);

    const fetchResults = useCallback(async () => {
        if (!aziendaName || !getAuthHeader) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(buildApiUrl(`/api/email-quota/results/${encodeURIComponent(aziendaName)}`), {
                headers: getAuthHeader()
            });
            if (!res.ok) throw new Error('Errore caricamento dati');
            const data = await res.json();
            setResults(data.results || []);
            if (data.results && data.results.length > 0) {
                setLastScan(data.results[0].last_scan);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [aziendaName, getAuthHeader]);

    useEffect(() => {
        fetchResults();
    }, [fetchResults]);

    // Polling durante la scansione
    useEffect(() => {
        if (!scanning) return;
        const interval = setInterval(() => {
            fetchResults().then(() => {
                // Controlla se la scansione è finita
                if (results.length > 0) {
                    const newest = results[0]?.last_scan;
                    if (newest && new Date(newest) > new Date(Date.now() - 10000)) {
                        setScanning(false);
                    }
                }
            });
        }, 3000);
        return () => clearInterval(interval);
    }, [scanning, results, fetchResults]);

    const handleScan = async () => {
        if (!aziendaName || !getAuthHeader) return;
        setScanning(true);
        try {
            await fetch(buildApiUrl(`/api/email-quota/scan/${encodeURIComponent(aziendaName)}`), {
                method: 'POST',
                headers: { ...getAuthHeader(), 'Content-Type': 'application/json' }
            });
            // Polling gestirà i risultati
            setTimeout(() => fetchResults(), 2000);
            // Auto-stop scanning dopo 2 minuti max
            setTimeout(() => setScanning(false), 120000);
        } catch (err) {
            setError(err.message);
            setScanning(false);
        }
    };

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const b = Number(bytes);
        if (b < 1024) return `${b} B`;
        if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
        if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
        return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Adesso';
        if (diffMin < 60) return `${diffMin} min fa`;
        if (diffHours < 24) return `${diffHours} ore fa`;
        if (diffDays < 7) return `${diffDays} gg fa`;
        return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const getBarColor = (percent) => {
        if (percent >= 90) return { bar: '#ef4444', bg: '#fef2f2', badge: '#dc2626', badgeBg: '#fee2e2' }; // Rosso
        if (percent >= 70) return { bar: '#f59e0b', bg: '#fffbeb', badge: '#d97706', badgeBg: '#fef3c7' }; // Arancione
        if (percent >= 50) return { bar: '#3b82f6', bg: '#eff6ff', badge: '#2563eb', badgeBg: '#dbeafe' }; // Blu
        return { bar: '#3b82f6', bg: '#f0fdf4', badge: '#2563eb', badgeBg: '#dbeafe' }; // Blu/Verde
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'critical': return <AlertTriangle size={16} className="text-red-500" />;
            case 'warning': return <AlertTriangle size={16} className="text-amber-500" />;
            case 'error': return <XCircle size={16} className="text-gray-400" />;
            default: return null;
        }
    };

    // Stats summary
    const totalAccounts = results.length;
    const okAccounts = results.filter(r => r.status === 'ok').length;
    const warningAccounts = results.filter(r => r.status === 'warning').length;
    const criticalAccounts = results.filter(r => r.status === 'critical').length;
    const errorAccounts = results.filter(r => r.status === 'error').length;

    return (
        <div className="space-y-4">
            {/* Header con pulsante scan */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <HardDrive size={20} className="text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Spazio Caselle Email</h3>
                        <p className="text-xs text-gray-500">
                            {lastScan ? `Ultimo controllo: ${formatDate(lastScan)}` : 'Nessuna scansione effettuata'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleScan}
                    disabled={scanning}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all shadow-sm
            ${scanning
                            ? 'bg-blue-100 text-blue-600 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'}`}
                >
                    <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
                    {scanning ? 'Scansione in corso...' : 'Scansione'}
                </button>
            </div>

            {/* Summary stats */}
            {results.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                        <div className="text-2xl font-bold text-gray-900">{totalAccounts}</div>
                        <div className="text-xs text-gray-500">Caselle</div>
                    </div>
                    <div className="bg-white rounded-lg border border-green-200 p-3 text-center">
                        <div className="text-2xl font-bold text-green-600">{okAccounts}</div>
                        <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                            <CheckCircle size={12} className="text-green-500" /> OK
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-amber-200 p-3 text-center">
                        <div className="text-2xl font-bold text-amber-600">{warningAccounts}</div>
                        <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                            <AlertTriangle size={12} className="text-amber-500" /> Attenzione
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-red-200 p-3 text-center">
                        <div className="text-2xl font-bold text-red-600">{criticalAccounts + errorAccounts}</div>
                        <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                            <XCircle size={12} className="text-red-500" /> Critici/Errori
                        </div>
                    </div>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading && results.length === 0 && (
                <div className="flex items-center justify-center py-8">
                    <RefreshCw size={24} className="animate-spin text-blue-600 mr-2" />
                    <span className="text-gray-500">Caricamento...</span>
                </div>
            )}

            {/* Empty state */}
            {!loading && results.length === 0 && !error && (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <Mail size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 mb-1">Nessun dato disponibile</p>
                    <p className="text-gray-400 text-sm">Clicca "Scansione" per controllare lo spazio delle caselle email</p>
                </div>
            )}

            {/* Results list - stile come nella foto */}
            {results.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    {/* Header tabella */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <div className="col-span-4">Casella Email</div>
                        <div className="col-span-6">Impatto sullo Spazio</div>
                        <div className="col-span-2 text-right">Ultimo Check</div>
                    </div>

                    {/* Righe */}
                    <div className="divide-y divide-gray-100">
                        {results.map((item, idx) => {
                            const percent = parseFloat(item.usage_percent) || 0;
                            const colors = getBarColor(percent);
                            const isError = item.status === 'error';

                            return (
                                <div
                                    key={item.email || idx}
                                    className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors"
                                >
                                    {/* Email + server */}
                                    <div className="col-span-4 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(item.status)}
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate" title={item.email}>
                                                    {item.email}
                                                </p>
                                                <p className="text-xs text-gray-400 truncate" title={item.imap_server}>
                                                    {isError ? (item.error_message || 'Errore connessione').substring(0, 50) : item.imap_server}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Barra spazio */}
                                    <div className="col-span-6">
                                        {isError ? (
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                                    Errore
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                {/* Badge MB/GB */}
                                                <span
                                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap min-w-[70px] justify-center"
                                                    style={{ backgroundColor: colors.badgeBg, color: colors.badge }}
                                                >
                                                    {formatBytes(item.usage_bytes)}
                                                </span>

                                                {/* Progress bar */}
                                                <div className="flex-1 relative">
                                                    <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{
                                                                width: `${Math.min(percent, 100)}%`,
                                                                backgroundColor: colors.bar,
                                                                minWidth: percent > 0 ? '4px' : '0'
                                                            }}
                                                        />
                                                    </div>
                                                    {/* Tooltip */}
                                                    <div className="absolute -top-5 right-0 text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {formatBytes(item.usage_bytes)} / {formatBytes(item.limit_bytes)}
                                                    </div>
                                                </div>

                                                {/* Percentuale + icona alert */}
                                                <div className="flex items-center gap-1 min-w-[55px] justify-end">
                                                    <span className="text-xs font-medium text-gray-500">{percent.toFixed(0)}%</span>
                                                    {(item.status === 'critical' || item.status === 'warning') && (
                                                        <AlertTriangle size={12} className={item.status === 'critical' ? 'text-red-500' : 'text-amber-500'} />
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Data ultimo check */}
                                    <div className="col-span-2 text-right">
                                        <span className="text-xs text-gray-400">{formatDate(item.last_scan)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                            {totalAccounts} caselle monitorate
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={12} />
                            Scansione automatica ogni 12 ore (mezzanotte)
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailQuotaPanel;
