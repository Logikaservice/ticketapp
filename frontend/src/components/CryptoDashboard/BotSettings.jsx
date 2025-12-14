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
        trade_size_usdt: 100,
        trailing_stop_enabled: false,
        trailing_stop_distance_pct: 1.0,
        trailing_profit_protection_enabled: true,
        partial_close_enabled: false,
        take_profit_1_pct: 1.5,
        take_profit_2_pct: 3.0,
        // Filtri Avanzati
        min_signal_strength: 70,
        min_confirmations_long: 3,
        min_confirmations_short: 4,
        min_atr_pct: 0.2,
        max_atr_pct: 5.0,
        min_volume_24h: 500000,
        // Risk Management
        max_positions: 10,
        // Timeframe
        analysis_timeframe: '15m'
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [binanceMinNotional, setBinanceMinNotional] = useState({
        recommendedMin: 10,
        safeMin: 20,
        maxMinNotional: 5,
        loading: true
    });

    useEffect(() => {
        if (isOpen) {
            loadParameters();
            loadBinanceMinNotional();
        }
    }, [isOpen]);

    const loadBinanceMinNotional = async () => {
        try {
            setBinanceMinNotional(prev => ({ ...prev, loading: true }));
            const res = await fetch(`${apiBase}/api/crypto/binance/min-notional`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setBinanceMinNotional({
                        recommendedMin: data.recommendedMin || 10,
                        safeMin: data.safeMin || 20,
                        maxMinNotional: data.maxMinNotional || 5,
                        loading: false,
                        mode: data.mode
                    });
                }
            }
        } catch (err) {
            console.warn('⚠️ Errore caricamento minNotional Binance:', err);
            setBinanceMinNotional(prev => ({ ...prev, loading: false }));
        }
    };

    const loadParameters = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${apiBase}/api/crypto/bot/parameters`);
            
            // ✅ FIX: Verifica content-type PRIMA di fare res.json()
            const contentType = res.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json');
            
            if (res.ok && isJson) {
                try {
                    const data = await res.json();
                    console.log('✅ [BOT-SETTINGS] ========== RISPOSTA BACKEND ==========');
                    console.log('✅ [BOT-SETTINGS] Risposta completa:', data);
                    console.log('✅ [BOT-SETTINGS] data.parameters:', data.parameters);
                    console.log('✅ [BOT-SETTINGS] data.parameters.trade_size_usdt:', data.parameters?.trade_size_usdt, '(type:', typeof data.parameters?.trade_size_usdt, ')');
                    console.log('✅ [BOT-SETTINGS] data.parameters.max_positions:', data.parameters?.max_positions, '(type:', typeof data.parameters?.max_positions, ')');
                    console.log('✅ [BOT-SETTINGS] Parametri caricati dal backend:', {
                        totalParams: Object.keys(data.parameters || {}).length,
                        hasTrailingProfit: 'trailing_profit_protection_enabled' in (data.parameters || {}),
                        trailingProfitValue: data.parameters?.trailing_profit_protection_enabled,
                        sampleValues: {
                            trade_size_usdt: data.parameters?.trade_size_usdt,
                            max_positions: data.parameters?.max_positions,
                            stop_loss_pct: data.parameters?.stop_loss_pct
                        },
                        // ✅ DEBUG: Mostra tutte le chiavi per vedere cosa c'è
                        allKeys: Object.keys(data.parameters || {})
                    });
                    // ✅ FIX: I parametri dal backend sono già completi (merge fatto nel backend)
                    // Non serve fare merge qui, usiamo direttamente i parametri dal backend
                    if (data.parameters && typeof data.parameters === 'object') {
                        console.log('✅ [BOT-SETTINGS] Impostazione parametri nello stato...');
                        console.log('   Prima di setParameters - trade_size_usdt:', data.parameters.trade_size_usdt);
                        setParameters(data.parameters);
                        // ✅ DEBUG: Verifica immediatamente dopo setParameters (anche se React potrebbe non aver ancora aggiornato)
                        console.log('✅ [BOT-SETTINGS] Parametri impostati nel frontend:', {
                            trade_size_usdt: data.parameters.trade_size_usdt,
                            trade_size_usdt_type: typeof data.parameters.trade_size_usdt,
                            max_positions: data.parameters.max_positions,
                            max_positions_type: typeof data.parameters.max_positions,
                            // ✅ DEBUG: Verifica se i valori sono presenti nell'oggetto
                            hasTradeSizeUsdt: 'trade_size_usdt' in data.parameters,
                            hasMaxPositions: 'max_positions' in data.parameters
                        });
                    } else {
                        console.error('❌ [BOT-SETTINGS] Parametri non validi dal backend:', data);
                        setError('Formato parametri non valido');
                    }
                } catch (jsonErr) {
                    console.error('❌ [BOT-SETTINGS] Errore parsing JSON durante caricamento:', jsonErr);
                    setError('Errore nella risposta del server (non JSON valido)');
                }
            } else if (res.ok && !isJson) {
                // ✅ FIX: Se status è OK ma content-type non è JSON, c'è un problema
                const text = await res.text();
                console.error('❌ [BOT-SETTINGS] Server ha restituito non-JSON con status OK durante caricamento:', text.substring(0, 200));
                setError('Errore: risposta del server non valida (non JSON)');
            } else {
                // ✅ FIX: Gestisci risposte non-JSON o errori HTTP
                try {
                    const errorData = await res.json();
                    console.error('❌ [BOT-SETTINGS] Errore caricamento:', errorData);
                    setError(errorData.error || 'Errore nel caricamento dei parametri');
                } catch (jsonErr) {
                    setError(`Errore HTTP ${res.status}: ${res.statusText}`);
                }
            }
        } catch (err) {
            console.error('❌ [BOT-SETTINGS] Errore di connessione:', err);
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
            // ✅ Log dei parametri che stiamo salvando
            console.log('💾 [BOT-SETTINGS] Salvataggio parametri:', {
                totalParams: Object.keys(parameters).length,
                sampleValues: {
                    trade_size_usdt: parameters.trade_size_usdt,
                    stop_loss_pct: parameters.stop_loss_pct,
                    take_profit_pct: parameters.take_profit_pct,
                    trailing_profit_protection_enabled: parameters.trailing_profit_protection_enabled,
                    min_volume_24h: parameters.min_volume_24h, // ✅ DEBUG: Aggiunto min_volume_24h
                    min_volume_24h_type: typeof parameters.min_volume_24h // ✅ DEBUG: Tipo
                },
                allKeys: Object.keys(parameters) // ✅ DEBUG: Tutte le chiavi
            });

            const res = await fetch(`${apiBase}/api/crypto/bot/parameters`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parameters })
            });

            // ✅ FIX CRITICO: Verifica content-type PRIMA di fare res.json()
            const contentType = res.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json');
            
            if (res.ok && isJson) {
                try {
                    const responseData = await res.json();
                    console.log('✅ [BOT-SETTINGS] Parametri salvati con successo:', responseData);
                    
                    // ✅ VERIFICA: Controlla se la risposta contiene effettivamente i parametri
                    if (responseData.success && responseData.parameters) {
                        setSuccess(true);
                        
                        // ✅ RICARICA i parametri dal server per verificare che siano stati salvati correttamente
                        setTimeout(async () => {
                            await loadParameters();
                            setSuccess(false);
                        }, 1000);
                    } else {
                        console.warn('⚠️ [BOT-SETTINGS] Risposta success ma senza parametri:', responseData);
                        setError('Salvataggio completato ma risposta incompleta');
                    }
                } catch (jsonErr) {
                    console.error('❌ [BOT-SETTINGS] Errore parsing JSON risposta:', jsonErr);
                    setError('Errore nella risposta del server');
                }
            } else if (res.ok && !isJson) {
                // ✅ FIX: Se status è OK ma content-type non è JSON, c'è un problema
                const text = await res.text();
                console.error('❌ [BOT-SETTINGS] Server ha restituito non-JSON con status OK:', text.substring(0, 200));
                setError('Errore: risposta del server non valida (non JSON)');
            } else {
                // ✅ FIX: Gestisci risposte HTML (errori del server)
                const contentType = res.headers.get('content-type');
                if (contentType && contentType.includes('text/html')) {
                    const text = await res.text();
                    console.error('❌ [BOT-SETTINGS] Server ha restituito HTML invece di JSON:', text.substring(0, 200));
                    setError('Errore del server: risposta non valida');
                } else {
                    try {
                        const data = await res.json();
                        console.error('❌ [BOT-SETTINGS] Errore salvataggio:', data);
                        setError(data.error || 'Errore nel salvataggio');
                    } catch (jsonErr) {
                        console.error('❌ [BOT-SETTINGS] Errore parsing JSON:', jsonErr);
                        setError(`Errore HTTP ${res.status}: ${res.statusText}`);
                    }
                }
            }
        } catch (err) {
            console.error('❌ [BOT-SETTINGS] Errore di connessione:', err);
            setError(`Errore di connessione: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key, value) => {
        // ✅ DEBUG: Log per min_volume_24h
        if (key === 'min_volume_24h') {
            console.log('🔍 [BOT-SETTINGS] handleChange per min_volume_24h:', {
                key,
                value,
                valueType: typeof value,
                valueString: String(value)
            });
        }
        
        if (key === 'trailing_stop_enabled' || key === 'partial_close_enabled' || key === 'trailing_profit_protection_enabled') {
            setParameters(prev => ({ ...prev, [key]: value === true || value === 'true' || value === 1 }));
        } else if (key === 'analysis_timeframe') {
            setParameters(prev => ({ ...prev, [key]: value }));
        } else if (key === 'min_confirmations_long' || key === 'min_confirmations_short' || key === 'max_positions' || key === 'min_signal_strength') {
            // ✅ FIX: Se il valore è vuoto, mantieni il valore esistente invece di 0
            if (value === '' || value === null || value === undefined) {
                setParameters(prev => ({ ...prev, [key]: prev[key] }));
            } else {
                const parsed = parseInt(value);
                setParameters(prev => {
                    const newParams = { ...prev, [key]: isNaN(parsed) ? prev[key] : parsed };
                    if (key === 'min_volume_24h') {
                        console.log('🔍 [BOT-SETTINGS] min_volume_24h dopo parseInt:', newParams.min_volume_24h);
                    }
                    return newParams;
                });
            }
        } else {
            // ✅ FIX: Se il valore è vuoto, mantieni il valore esistente invece di 0
            // Gestisce anche virgola come separatore decimale (es. "2,5" -> 2.5)
            if (value === '' || value === null || value === undefined) {
                setParameters(prev => ({ ...prev, [key]: prev[key] }));
            } else {
                // Converti virgola in punto per parsing corretto
                const normalizedValue = String(value).replace(',', '.');
                const parsed = parseFloat(normalizedValue);
                setParameters(prev => {
                    const newParams = { ...prev, [key]: isNaN(parsed) ? prev[key] : parsed };
                    // ✅ DEBUG: Log per trade_size_usdt
                    if (key === 'trade_size_usdt') {
                        console.log('🔍 [BOT-SETTINGS] trade_size_usdt cambiato:', {
                            inputValue: value,
                            normalizedValue,
                            parsed,
                            isNaN: isNaN(parsed),
                            finalValue: newParams.trade_size_usdt,
                            prevValue: prev.trade_size_usdt
                        });
                    }
                    if (key === 'min_volume_24h') {
                        console.log('🔍 [BOT-SETTINGS] min_volume_24h dopo parseFloat:', {
                            normalizedValue,
                            parsed,
                            isNaN: isNaN(parsed),
                            finalValue: newParams.min_volume_24h
                        });
                    }
                    return newParams;
                });
            }
        }
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
                                <label htmlFor="trade_size_usdt">
                                    Dimensione Trade ($)
                                    <span className="parameter-hint">
                                        ({binanceMinNotional.loading ? '10-1000' : `${binanceMinNotional.recommendedMin}-1000`})
                                    </span>
                                </label>
                                <input
                                    id="trade_size_usdt"
                                    type="number"
                                    min={binanceMinNotional.recommendedMin || 10}
                                    max="1000"
                                    step="5"
                                    value={parameters.trade_size_usdt || ''}
                                    onChange={(e) => handleChange('trade_size_usdt', e.target.value)}
                                    placeholder="100"
                                    style={{
                                        borderColor: parameters.trade_size_usdt && parameters.trade_size_usdt < (binanceMinNotional.recommendedMin || 10) 
                                            ? '#ef4444' 
                                            : parameters.trade_size_usdt && parameters.trade_size_usdt >= (binanceMinNotional.safeMin || 20)
                                            ? '#10b981'
                                            : undefined
                                    }}
                                />
                                <div className="parameter-desc">
                                    <div style={{ marginBottom: '8px' }}>
                                        Importo in USDT investito per ogni operazione. Gestione del rischio: non investire più del 5-10% del capitale per trade.
                                    </div>
                                    {!binanceMinNotional.loading && (
                                        <div style={{ 
                                            padding: '8px', 
                                            backgroundColor: '#f3f4f6', 
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            marginTop: '8px'
                                        }}>
                                            <strong>📊 Requisiti Binance:</strong>
                                            <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                                <li>Minimo consigliato: <strong>${binanceMinNotional.recommendedMin} USDT</strong> (2x il max requisito Binance)</li>
                                                <li>Valore sicuro: <strong>${binanceMinNotional.safeMin} USDT</strong> (3x per sicurezza extra)</li>
                                                <li>Max requisito Binance: ${binanceMinNotional.maxMinNotional} USDT</li>
                                            </ul>
                                            {parameters.trade_size_usdt && parameters.trade_size_usdt < (binanceMinNotional.recommendedMin || 10) && (
                                                <div style={{ color: '#ef4444', fontWeight: 'bold', marginTop: '4px' }}>
                                                    ⚠️ Valore troppo basso! Usa almeno ${binanceMinNotional.recommendedMin} USDT per evitare errori Binance.
                                                </div>
                                            )}
                                            {parameters.trade_size_usdt && parameters.trade_size_usdt >= (binanceMinNotional.safeMin || 20) && (
                                                <div style={{ color: '#10b981', fontWeight: 'bold', marginTop: '4px' }}>
                                                    ✅ Valore sicuro! Compatibile con tutti i simboli Binance.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Trailing Stop Loss Enabled */}
                            <div className="parameter-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={parameters.trailing_stop_enabled || false}
                                        onChange={(e) => handleChange('trailing_stop_enabled', e.target.checked)}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                    <span>Abilita Trailing Stop Loss</span>
                                </label>
                                <div className="parameter-desc">
                                    Lo stop loss si muove automaticamente seguendo il prezzo favorevole. Blocca i profitti mentre permette di continuare a guadagnare.
                                </div>
                            </div>

                            {/* Trailing Stop Distance */}
                            {parameters.trailing_stop_enabled && (
                                <div className="parameter-group">
                                    <label htmlFor="trailing_stop_distance_pct">
                                        Distanza Trailing Stop (%)
                                        <span className="parameter-hint">(0.1-5)</span>
                                    </label>
                                    <input
                                        id="trailing_stop_distance_pct"
                                        type="number"
                                        min="0.1"
                                        max="5"
                                        step="0.1"
                                        value={parameters.trailing_stop_distance_pct}
                                        onChange={(e) => handleChange('trailing_stop_distance_pct', e.target.value)}
                                    />
                                    <div className="parameter-desc">
                                        Distanza percentuale dal prezzo massimo/minimo per il trailing stop. Più basso = stop loss più vicino (meno rischio ma più probabilità di uscita prematura).
                                    </div>
                                </div>
                            )}

                            {/* Trailing Profit Protection Enabled */}
                            <div className="parameter-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={parameters.trailing_profit_protection_enabled !== undefined ? parameters.trailing_profit_protection_enabled : true}
                                        onChange={(e) => handleChange('trailing_profit_protection_enabled', e.target.checked)}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                    <span>Abilita Trailing Profit Protection</span>
                                </label>
                                <div className="parameter-desc">
                                    Protegge i profitti quando raggiungi un picco: se il profitto scende sotto una soglia minima, chiude automaticamente la posizione per bloccare i guadagni. <strong>Attivo solo dopo 15 minuti dall'apertura</strong> per evitare chiusure premature. <strong>MENO AGGRESSIVO:</strong> Chiude solo se il profitto scende >1% dal picco, permettendo più crescita.
                                </div>
                            </div>

                            {/* Partial Close Enabled */}
                            <div className="parameter-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={parameters.partial_close_enabled || false}
                                        onChange={(e) => handleChange('partial_close_enabled', e.target.checked)}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                    <span>Abilita Chiusura Parziale</span>
                                </label>
                                <div className="parameter-desc">
                                    Chiude il 50% della posizione al primo take profit (TP1) e mantiene il 50% per il secondo take profit (TP2).
                                </div>
                            </div>

                            {/* Take Profit 1 (for Partial Close) */}
                            {parameters.partial_close_enabled && (
                                <>
                                    <div className="parameter-group">
                                        <label htmlFor="take_profit_1_pct">
                                            Take Profit 1 - Prima Chiusura (%)
                                            <span className="parameter-hint">(0.1-5)</span>
                                        </label>
                                        <input
                                            id="take_profit_1_pct"
                                            type="number"
                                            min="0.1"
                                            max="5"
                                            step="0.1"
                                            value={parameters.take_profit_1_pct}
                                            onChange={(e) => handleChange('take_profit_1_pct', e.target.value)}
                                        />
                                        <div className="parameter-desc">
                                            Chiude 50% della posizione quando il profitto raggiunge questa percentuale. Assicura profitti garantiti.
                                        </div>
                                    </div>

                                    <div className="parameter-group">
                                        <label htmlFor="take_profit_2_pct">
                                            Take Profit 2 - Seconda Chiusura (%)
                                            <span className="parameter-hint">(0.1-10)</span>
                                        </label>
                                        <input
                                            id="take_profit_2_pct"
                                            type="number"
                                            min="0.1"
                                            max="10"
                                            step="0.1"
                                            value={parameters.take_profit_2_pct}
                                            onChange={(e) => handleChange('take_profit_2_pct', e.target.value)}
                                        />
                                        <div className="parameter-desc">
                                            Chiude il restante 50% quando il profitto raggiunge questa percentuale. Permette di sfruttare movimenti più ampi.
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Separatore - Filtri Avanzati */}
                            <div style={{ gridColumn: '1 / -1', borderTop: '2px solid #e5e7eb', marginTop: '20px', paddingTop: '20px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#3b82f6' }}>
                                    🎯 Filtri Avanzati
                                </h3>
                            </div>

                            {/* Min Signal Strength */}
                            <div className="parameter-group">
                                <label htmlFor="min_signal_strength">
                                    Forza Minima Segnale
                                    <span className="parameter-hint">(50-100)</span>
                                </label>
                                <input
                                    id="min_signal_strength"
                                    type="number"
                                    min="50"
                                    max="100"
                                    step="1"
                                    value={parameters.min_signal_strength || 70}
                                    onChange={(e) => handleChange('min_signal_strength', e.target.value)}
                                />
                                <div className="parameter-desc">
                                    Forza minima del segnale (0-100) richiesta per aprire una posizione. Valore più alto = più selettivo, meno trade ma più sicuri.
                                </div>
                            </div>

                            {/* Min Confirmations LONG */}
                            <div className="parameter-group">
                                <label htmlFor="min_confirmations_long">
                                    Min Conferme LONG
                                    <span className="parameter-hint">(1-10)</span>
                                </label>
                                <input
                                    id="min_confirmations_long"
                                    type="number"
                                    min="1"
                                    max="10"
                                    step="1"
                                    value={parameters.min_confirmations_long || 3}
                                    onChange={(e) => handleChange('min_confirmations_long', e.target.value)}
                                />
                                <div className="parameter-desc">
                                    Numero minimo di indicatori che devono confermare per aprire una posizione LONG. Più alto = più sicuro ma meno trade.
                                </div>
                            </div>

                            {/* Min Confirmations SHORT */}
                            <div className="parameter-group">
                                <label htmlFor="min_confirmations_short">
                                    Min Conferme SHORT
                                    <span className="parameter-hint">(1-10)</span>
                                </label>
                                <input
                                    id="min_confirmations_short"
                                    type="number"
                                    min="1"
                                    max="10"
                                    step="1"
                                    value={parameters.min_confirmations_short || 4}
                                    onChange={(e) => handleChange('min_confirmations_short', e.target.value)}
                                />
                                <div className="parameter-desc">
                                    Numero minimo di indicatori che devono confermare per aprire una posizione SHORT. SHORT richiede più conferme (più rischioso).
                                </div>
                            </div>

                            {/* Min ATR */}
                            <div className="parameter-group">
                                <label htmlFor="min_atr_pct">
                                    ATR Minimo (%)
                                    <span className="parameter-hint">(0.1-2.0)</span>
                                </label>
                                <input
                                    id="min_atr_pct"
                                    type="number"
                                    min="0.1"
                                    max="2.0"
                                    step="0.1"
                                    value={parameters.min_atr_pct || 0.2}
                                    onChange={(e) => handleChange('min_atr_pct', e.target.value)}
                                />
                                <div className="parameter-desc">
                                    Volatilità minima (ATR) richiesta per tradare. Blocca trade su mercati troppo piatti (bassa volatilità).
                                </div>
                            </div>

                            {/* Max ATR */}
                            <div className="parameter-group">
                                <label htmlFor="max_atr_pct">
                                    ATR Massimo (%)
                                    <span className="parameter-hint">(2.0-10.0)</span>
                                </label>
                                <input
                                    id="max_atr_pct"
                                    type="number"
                                    min="2.0"
                                    max="10.0"
                                    step="0.1"
                                    value={parameters.max_atr_pct || 5.0}
                                    onChange={(e) => handleChange('max_atr_pct', e.target.value)}
                                />
                                <div className="parameter-desc">
                                    Volatilità massima (ATR) consentita per tradare. Blocca trade su mercati troppo volatili (rischio elevato).
                                </div>
                            </div>

                            {/* Min Volume 24h */}
                            <div className="parameter-group">
                                <label htmlFor="min_volume_24h">
                                    Volume Minimo 24h (USDT)
                                    <span className="parameter-hint">(10K-10M)</span>
                                </label>
                                <input
                                    id="min_volume_24h"
                                    type="number"
                                    min="10000"
                                    max="10000000"
                                    step="10000"
                                    value={parameters.min_volume_24h || 500000}
                                    onChange={(e) => handleChange('min_volume_24h', e.target.value)}
                                />
                                <div className="parameter-desc">
                                    Volume minimo 24h richiesto per tradare un simbolo. Evita coin illiquide (pump & dump, spread alti).
                                </div>
                            </div>

                            {/* Separatore - Risk Management */}
                            <div style={{ gridColumn: '1 / -1', borderTop: '2px solid #e5e7eb', marginTop: '20px', paddingTop: '20px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#ef4444' }}>
                                    🛡️ Risk Management
                                </h3>
                            </div>

                            {/* Max Positions */}
                            <div className="parameter-group">
                                <label htmlFor="max_positions">
                                    Numero Massimo Posizioni
                                    <span className="parameter-hint">(1-20)</span>
                                </label>
                                <input
                                    id="max_positions"
                                    type="number"
                                    min="1"
                                    max="20"
                                    step="1"
                                    value={parameters.max_positions || 10}
                                    onChange={(e) => handleChange('max_positions', e.target.value)}
                                />
                                <div className="parameter-desc">
                                    Numero massimo di posizioni che possono essere aperte simultaneamente. Limita l'esposizione e favorisce la diversificazione.
                                </div>
                            </div>

                            {/* Separatore - Timeframe */}
                            <div style={{ gridColumn: '1 / -1', borderTop: '2px solid #e5e7eb', marginTop: '20px', paddingTop: '20px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#10b981' }}>
                                    ⏱️ Timeframe Analisi
                                </h3>
                            </div>

                            {/* Analysis Timeframe */}
                            <div className="parameter-group">
                                <label htmlFor="analysis_timeframe">
                                    Timeframe Analisi
                                </label>
                                <select
                                    id="analysis_timeframe"
                                    value={parameters.analysis_timeframe || '15m'}
                                    onChange={(e) => handleChange('analysis_timeframe', e.target.value)}
                                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px' }}
                                >
                                    <option value="15m">15 minuti (scalping)</option>
                                    <option value="1h">1 ora (intraday)</option>
                                    <option value="4h">4 ore (swing trading)</option>
                                    <option value="1d">1 giorno (position trading)</option>
                                </select>
                                <div className="parameter-desc">
                                    Timeframe utilizzato per l'analisi dei segnali. Timeframe più lunghi = segnali più stabili ma meno frequenti.
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

