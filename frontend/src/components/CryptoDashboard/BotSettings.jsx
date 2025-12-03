import React, { useState, useEffect } from 'react';
import { Settings, Save, X } from 'lucide-react';
import './BotSettings.css';

const BotSettings = ({ isOpen, onClose, apiBase }) => {
    const [parameters, setParameters] = useState({
        rsi_period: 14,
        rsi_oversold: 30,
        rsi_overbought: 70,
        stop_loss_pct: 2.0,
        take_profit_pct: 3.0,
        trade_size_eur: 50
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadParameters();
        }
    }, [isOpen]);

    const loadParameters = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${apiBase}/api/crypto/bot/parameters`);
            if (res.ok) {
                const data = await res.json();
                setParameters(data.parameters);
            } else {
                setError('Errore nel caricamento dei parametri');
            }
        } catch (err) {
            console.error('Error loading parameters:', err);
            setError('Errore di connessione');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);

        try {
            const res = await fetch(`${apiBase}/api/crypto/bot/parameters`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parameters })
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    setSuccess(false);
                    onClose();
                }, 1500);
            } else {
                const data = await res.json();
                setError(data.error || 'Errore nel salvataggio');
            }
        } catch (err) {
            console.error('Error saving parameters:', err);
            setError('Errore di connessione');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key, value) => {
        setParameters(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
    };

    if (!isOpen) return null;

    return (
        <div className="bot-settings-overlay" onClick={onClose}>
            <div className="bot-settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="bot-settings-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Settings size={24} className="text-blue-500" />
                        <h2>Configurazione Strategia RSI</h2>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {loading ? (
                    <div className="bot-settings-content" style={{ textAlign: 'center', padding: '40px' }}>
                        <div>Caricamento parametri...</div>
                    </div>
                ) : (
                    <div className="bot-settings-content">
                        {error && (
                            <div className="alert alert-error">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="alert alert-success">
                                ✅ Parametri salvati con successo!
                            </div>
                        )}

                        <div className="parameters-grid">
                            {/* RSI Period */}
                            <div className="parameter-group">
                                <label htmlFor="rsi_period">
                                    Periodo RSI
                                    <span className="parameter-hint">(5-30)</span>
                                </label>
                                <input
                                    id="rsi_period"
                                    type="number"
                                    min="5"
                                    max="30"
                                    value={parameters.rsi_period}
                                    onChange={(e) => handleChange('rsi_period', e.target.value)}
                                />
                                <div className="parameter-desc">
                                    Numero di periodi per il calcolo RSI. Valore più alto = segnale più stabile ma più lento.
                                </div>
                            </div>

                            {/* RSI Oversold */}
                            <div className="parameter-group">
                                <label htmlFor="rsi_oversold">
                                    Soglia Oversold (Buy)
                                    <span className="parameter-hint">(0-50)</span>
                                </label>
                                <input
                                    id="rsi_oversold"
                                    type="number"
                                    min="0"
                                    max="50"
                                    step="0.5"
                                    value={parameters.rsi_oversold}
                                    onChange={(e) => handleChange('rsi_oversold', e.target.value)}
                                />
                                <div className="parameter-desc">
                                    Il bot compra quando RSI scende sotto questo valore. Valore più basso = meno trade ma più selettivo.
                                </div>
                            </div>

                            {/* RSI Overbought */}
                            <div className="parameter-group">
                                <label htmlFor="rsi_overbought">
                                    Soglia Overbought (Sell)
                                    <span className="parameter-hint">(50-100)</span>
                                </label>
                                <input
                                    id="rsi_overbought"
                                    type="number"
                                    min="50"
                                    max="100"
                                    step="0.5"
                                    value={parameters.rsi_overbought}
                                    onChange={(e) => handleChange('rsi_overbought', e.target.value)}
                                />
                                <div className="parameter-desc">
                                    Il bot vende quando RSI sale sopra questo valore. Valore più alto = mantiene posizioni più a lungo.
                                </div>
                            </div>

                            {/* Stop Loss */}
                            <div className="parameter-group">
                                <label htmlFor="stop_loss_pct">
                                    Stop Loss (%)
                                    <span className="parameter-hint">(0.1-10)</span>
                                </label>
                                <input
                                    id="stop_loss_pct"
                                    type="number"
                                    min="0.1"
                                    max="10"
                                    step="0.1"
                                    value={parameters.stop_loss_pct}
                                    onChange={(e) => handleChange('stop_loss_pct', e.target.value)}
                                />
                                <div className="parameter-desc">
                                    Chiude la posizione se la perdita supera questa percentuale. Protegge da perdite eccessive.
                                </div>
                            </div>

                            {/* Take Profit */}
                            <div className="parameter-group">
                                <label htmlFor="take_profit_pct">
                                    Take Profit (%)
                                    <span className="parameter-hint">(0.1-20)</span>
                                </label>
                                <input
                                    id="take_profit_pct"
                                    type="number"
                                    min="0.1"
                                    max="20"
                                    step="0.1"
                                    value={parameters.take_profit_pct}
                                    onChange={(e) => handleChange('take_profit_pct', e.target.value)}
                                />
                                <div className="parameter-desc">
                                    Chiude la posizione quando il profitto raggiunge questa percentuale. Valore più alto = più profitto ma meno trade.
                                </div>
                            </div>

                            {/* Trade Size */}
                            <div className="parameter-group">
                                <label htmlFor="trade_size_eur">
                                    Dimensione Trade (€)
                                    <span className="parameter-hint">(10-1000)</span>
                                </label>
                                <input
                                    id="trade_size_eur"
                                    type="number"
                                    min="10"
                                    max="1000"
                                    step="5"
                                    value={parameters.trade_size_eur}
                                    onChange={(e) => handleChange('trade_size_eur', e.target.value)}
                                />
                                <div className="parameter-desc">
                                    Importo in Euro investito per ogni operazione. Gestione del rischio: non investire più del 5-10% del capitale per trade.
                                </div>
                            </div>
                        </div>

                        <div className="bot-settings-footer">
                            <button className="btn-secondary" onClick={onClose} disabled={saving}>
                                Annulla
                            </button>
                            <button className="btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? (
                                    <>⏳ Salvataggio...</>
                                ) : (
                                    <>
                                        <Save size={18} /> Salva Parametri
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BotSettings;

