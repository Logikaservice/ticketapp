import React, { useState } from 'react';
import { Wrench, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';

const FixVolumesButton = ({ getAuthHeader = () => ({}) }) => {
    const [isFixing, setIsFixing] = useState(false);
    const [result, setResult] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    const handleFix = async () => {
        if (!confirm('Vuoi correggere i volumi sbagliati nelle posizioni aperte?\n\nQuesta operazione:\n- Ricalcola i volumi corretti da trade_size_usdt / entry_price\n- Aggiorna i P&L con i volumi corretti\n- Non chiude le posizioni\n\nContinuare?')) {
            return;
        }

        setIsFixing(true);
        setResult(null);

        try {
            const response = await fetch(`${API_URL}/api/crypto/fix-wrong-volumes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                }
            });

            const data = await response.json();

            if (data.success) {
                setResult({
                    success: true,
                    ...data.results
                });
            } else {
                setResult({
                    success: false,
                    error: data.error
                });
            }
        } catch (error) {
            setResult({
                success: false,
                error: error.message
            });
        } finally {
            setIsFixing(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* Button */}
            <button
                onClick={handleFix}
                disabled={isFixing}
                className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
            >
                <Wrench className={`w-5 h-5 ${isFixing ? 'animate-spin' : ''}`} />
                <span>{isFixing ? 'Correzione in corso...' : '🔧 Fix Volumi Sbagliati'}</span>
            </button>

            {/* Results */}
            {result && (
                <div className={`p-4 rounded-lg ${result.success ? 'bg-green-900/20 border border-green-700' : 'bg-red-900/20 border border-red-700'}`}>
                    <div className="flex items-start space-x-3">
                        {result.success ? (
                            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                        )}
                        
                        <div className="flex-1 space-y-2">
                            {result.success ? (
                                <>
                                    <p className="text-green-300 font-medium">
                                        ✅ Correzione completata!
                                    </p>
                                    <div className="text-sm text-gray-300 space-y-1">
                                        <p>• Posizioni totali: {result.total}</p>
                                        <p>• ✅ Corrette: <span className="text-green-400 font-bold">{result.fixed}</span></p>
                                        <p>• ⏭️ Skipped (già corrette): {result.skipped}</p>
                                        {result.errors > 0 && (
                                            <p>• ❌ Errori: <span className="text-red-400">{result.errors}</span></p>
                                        )}
                                    </div>

                                    {result.details && result.details.length > 0 && (
                                        <button
                                            onClick={() => setShowDetails(!showDetails)}
                                            className="text-sm text-blue-400 hover:text-blue-300 underline"
                                        >
                                            {showDetails ? 'Nascondi dettagli' : 'Mostra dettagli'}
                                        </button>
                                    )}

                                    {showDetails && result.details && (
                                        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                                            {result.details.map((detail, idx) => (
                                                <div key={idx} className="p-2 bg-gray-800/50 rounded text-xs space-y-1">
                                                    <p className="font-bold text-yellow-400">
                                                        {detail.symbol.toUpperCase()} ({detail.type.toUpperCase()})
                                                    </p>
                                                    {detail.status === 'fixed' ? (
                                                        <>
                                                            <p>Volume: {detail.oldVolume.toLocaleString(undefined, {maximumFractionDigits: 8})} → {detail.newVolume.toLocaleString(undefined, {maximumFractionDigits: 8})}</p>
                                                            <p>Diff: {detail.diffPct.toFixed(2)}%</p>
                                                            <p>P&L: ${detail.oldPnL.toFixed(2)} → ${detail.newPnL.toFixed(2)}</p>
                                                        </>
                                                    ) : (
                                                        <p className="text-red-400">❌ {detail.error}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <p className="text-sm text-gray-400 mt-2">
                                        💡 Ricarica la pagina per vedere i P&L aggiornati
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-red-300 font-medium">
                                        ❌ Errore durante la correzione
                                    </p>
                                    <p className="text-sm text-gray-300">
                                        {result.error}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Warning */}
            <div className="flex items-start space-x-2 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-300">
                    <p className="font-medium text-yellow-400 mb-1">ℹ️ Cosa fa questo strumento?</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Trova posizioni con volume sbagliato (diff &gt; 5%)</li>
                        <li>Ricalcola il volume corretto: trade_size_usdt / entry_price</li>
                        <li>Aggiorna P&L con il volume corretto</li>
                        <li>Non chiude né modifica le posizioni, solo corregge i dati</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default FixVolumesButton;
