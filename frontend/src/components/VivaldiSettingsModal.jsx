import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, Volume2, Mic, CheckCircle, AlertCircle, RefreshCw, Coins } from 'lucide-react';
import { buildApiUrl } from '../utils/apiConfig';

const VivaldiSettingsModal = ({
    show,
    onClose,
    config,
    setConfig,
    onSave,
    onTestConnection,
    testingConnection,
    testResults,
    getAuthHeader // Assicurati che venga passato dal genitore
}) => {
    const [balance, setBalance] = useState(null);
    const [loadingBalance, setLoadingBalance] = useState(false);

    useEffect(() => {
        if (show) {
            fetchBalance();
        }
    }, [show]);

    const fetchBalance = async () => {
        setLoadingBalance(true);
        try {
            // Usa getAuthHeader se disponibile, altrimenti prova a prenderlo da localStorage o props
            const headers = getAuthHeader ? getAuthHeader() : {};

            const response = await fetch(buildApiUrl('/api/vivaldi/balance'), {
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setBalance(data);
            } else {
                setBalance(null);
            }
        } catch (error) {
            console.error('Errore recupero saldo:', error);
            setBalance(null);
        } finally {
            setLoadingBalance(false);
        }
    };

    if (!show) return null;

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg border border-white/20 relative overflow-hidden animate-slideIn max-h-[90vh] overflow-y-auto">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-600"></div>

                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <Settings className="text-slate-400" /> Configurazione
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Volume2 size={18} className="text-blue-600" /> SpeechGen.io
                            </h3>
                            <button
                                onClick={fetchBalance}
                                disabled={loadingBalance}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Aggiorna saldo"
                            >
                                <RefreshCw size={16} className={loadingBalance ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider">API Key</label>
                                <input
                                    type="text"
                                    value={config.speechgen_api_key}
                                    onChange={(e) => setConfig({ ...config, speechgen_api_key: e.target.value })}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm"
                                    placeholder="Inserisci API Key..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider">Email Account</label>
                                <input
                                    type="email"
                                    value={config.speechgen_email}
                                    onChange={(e) => setConfig({ ...config, speechgen_email: e.target.value })}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                    placeholder="email@example.com"
                                />
                            </div>

                            {/* Balance Display */}
                            {balance && (
                                <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                                        <Coins size={16} className="text-amber-500" />
                                        <span className="text-sm font-bold text-slate-700">Saldo Disponibile</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Voci Standard</p>
                                            <p className="text-lg font-mono font-bold text-slate-800">
                                                {balance.standard_chars?.toLocaleString()} <span className="text-xs font-normal text-slate-400">chars</span>
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Voci Pro</p>
                                            <p className="text-lg font-mono font-bold text-indigo-600">
                                                {balance.pro_chars?.toLocaleString()} <span className="text-xs font-normal text-slate-400">chars</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-slate-50 text-right">
                                        <p className="text-xs text-slate-400">Limits totali: {balance.limits?.toLocaleString()}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Mic size={18} className="text-purple-600" /> Google Gemini AI
                        </h3>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 tracking-wider">API Key (Opzionale)</label>
                            <input
                                type="text"
                                value={config.gemini_api_key}
                                onChange={(e) => setConfig({ ...config, gemini_api_key: e.target.value })}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-mono text-sm"
                                placeholder="AIzaSy..."
                            />
                        </div>
                    </div>

                    {testResults && (
                        <div className={`p-4 rounded-xl text-sm border flex items-start gap-3 ${testResults.speechgen.success ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                            {testResults.speechgen.success ? <CheckCircle size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
                            <div>
                                <p className="font-bold mb-1">Risultato Test SpeechGen</p>
                                <p className="opacity-90">{testResults.speechgen.message}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4 pt-4">
                        <button
                            onClick={onTestConnection}
                            disabled={testingConnection}
                            className="px-5 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-colors flex items-center gap-2 shadow-lg shadow-slate-800/20 disabled:opacity-50 font-medium"
                        >
                            {testingConnection ? 'Test...' : 'Test Connessione'}
                        </button>
                        <div className="flex-1"></div>
                        <button
                            onClick={onSave}
                            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all font-bold"
                        >
                            Salva
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default VivaldiSettingsModal;
