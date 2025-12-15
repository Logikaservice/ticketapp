import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, AlertCircle, CheckCircle, BarChart3, Shield, DollarSign, RefreshCw } from 'lucide-react';
import { formatPriceWithSymbol } from '../../utils/priceFormatter';
import './BotAnalysisPanel.css';

// ✅ COMPONENTE PRINCIPALE - BotAnalysisPage (sostituisce il vecchio)
const BotAnalysisPageNew = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const counterRef = React.useRef(0);
    // ✅ FIX: Preserva i blocchi precedenti durante le transizioni per evitare che scompaiano
    const preservedReasonsRef = React.useRef([]);
    const preservedBlockersRef = React.useRef({ long: [], short: [] });

    const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = urlParams.get('symbol') || 'bitcoin';

    // ✅ Fetch semplice e affidabile - sempre nuovi dati
    const fetchData = useCallback(async () => {
        try {
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(7);
            const url = `${apiBase}/api/crypto/bot-analysis?symbol=${symbol}&_t=${timestamp}&_r=${randomId}&_new=true`;

            const response = await fetch(url, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const jsonData = await response.json();

            // ✅ FORZA AGGIORNAMENTO: Aggiungi sempre timestamp unico per forzare re-render
            counterRef.current += 1;

            // ✅ FIX: Preserva signal.reasons e blockers per evitare che scompaiano durante l'aggiornamento
            // Se i nuovi dati hanno reasons/blockers validi, usali. Altrimenti, mantieni quelli precedenti
            const newReasons = jsonData.signal?.reasons;
            const newBlockers = jsonData.blockers;
            const newDirection = jsonData.signal?.direction;
            const oldDirection = data?.signal?.direction;

            // ✅ Inizializza i preservati con i dati esistenti se non sono ancora stati impostati
            if (preservedBlockersRef.current.long.length === 0 && data?.blockers?.long?.length > 0) {
                preservedBlockersRef.current.long = data.blockers.long;
            }
            if (preservedBlockersRef.current.short.length === 0 && data?.blockers?.short?.length > 0) {
                preservedBlockersRef.current.short = data.blockers.short;
            }

            // ✅ Reset i blocchi preservati SOLO se il segnale cambia direzione E i nuovi blockers sono vuoti
            // Questo evita di resettare i blockers quando il segnale cambia ma i blockers rimangono validi
            if (oldDirection && newDirection && oldDirection !== newDirection) {
                // Reset solo se i nuovi blockers sono vuoti
                const hasNewBlockers = (newBlockers?.long?.length > 0) || (newBlockers?.short?.length > 0);
                if (!hasNewBlockers) {
                    preservedReasonsRef.current = [];
                    preservedBlockersRef.current = { long: [], short: [] };
                }
            }

            // ✅ Aggiorna i ref SOLO se i nuovi dati contengono informazioni valide (non vuote)
            if (newReasons && Array.isArray(newReasons) && newReasons.length > 0) {
                preservedReasonsRef.current = newReasons;
            }

            // ✅ Aggiorna i blockers preservati SOLO se i nuovi hanno contenuto valido
            // Se i nuovi sono vuoti, mantieni quelli preservati
            if (newBlockers) {
                if (newBlockers.long && Array.isArray(newBlockers.long) && newBlockers.long.length > 0) {
                    preservedBlockersRef.current.long = newBlockers.long;
                }
                // Se i nuovi sono vuoti, NON aggiornare il ref - mantieni quelli preservati

                if (newBlockers.short && Array.isArray(newBlockers.short) && newBlockers.short.length > 0) {
                    preservedBlockersRef.current.short = newBlockers.short;
                }
                // Se i nuovi sono vuoti, NON aggiornare il ref - mantieni quelli preservati
            }

            // ✅ Determina quali blockers usare: preferisci i nuovi se validi, altrimenti usa i preservati
            const finalBlockers = {
                long: (newBlockers?.long && Array.isArray(newBlockers.long) && newBlockers.long.length > 0)
                    ? newBlockers.long
                    : (preservedBlockersRef.current.long.length > 0)
                        ? preservedBlockersRef.current.long
                        : (data?.blockers?.long?.length > 0) // Fallback ai dati esistenti nello stato
                            ? data.blockers.long
                            : [],
                short: (newBlockers?.short && Array.isArray(newBlockers.short) && newBlockers.short.length > 0)
                    ? newBlockers.short
                    : (preservedBlockersRef.current.short.length > 0)
                        ? preservedBlockersRef.current.short
                        : (data?.blockers?.short?.length > 0) // Fallback ai dati esistenti nello stato
                            ? data.blockers.short
                            : []
            };

            const freshData = {
                ...jsonData,
                _timestamp: timestamp,
                _counter: counterRef.current,
                // Usa i nuovi reasons se validi, altrimenti mantieni quelli preservati
                signal: {
                    ...jsonData.signal,
                    reasons: (newReasons && Array.isArray(newReasons) && newReasons.length > 0)
                        ? newReasons
                        : (preservedReasonsRef.current.length > 0)
                            ? preservedReasonsRef.current
                            : (data?.signal?.reasons?.length > 0) // Fallback ai dati esistenti
                                ? data.signal.reasons
                                : []
                },
                // ✅ Usa i blockers finali calcolati sopra
                blockers: finalBlockers
            };

            // ✅ AGGIORNAMENTO SENZA AZZERAMENTO: Mantieni i dati precedenti durante l'aggiornamento
            // ✅ FIX: Se i nuovi blockers sono vuoti ma abbiamo blockers preservati validi, 
            // mantieni i blockers preservati nello stato invece di sovrascriverli con array vuoti
            if (finalBlockers.long.length > 0 || finalBlockers.short.length > 0) {
                // Abbiamo blockers validi, aggiorna lo stato
                setData(freshData);
            } else if (data?.blockers && ((data.blockers.long?.length > 0) || (data.blockers.short?.length > 0))) {
                // I nuovi blockers sono vuoti ma abbiamo blockers nello stato esistente, mantienili
                setData({
                    ...freshData,
                    blockers: {
                        long: data.blockers.long || [],
                        short: data.blockers.short || []
                    }
                });
            } else {
                // Nessun blocker valido, aggiorna normalmente
                setData(freshData);
            }
            setError(null);
            // Non settare loading a false per evitare il flash durante l'aggiornamento
            // Il loading è già false dopo il primo caricamento
            if (loading) {
                setLoading(false);
            }

            // Data fetched successfully
        } catch (err) {
            console.error(`❌ [NUOVA VERSIONE] [${symbol}] Fetch error:`, err);
            // Non settare errore se abbiamo già dei dati validi (mantieni i dati vecchi)
            if (!data) {
                setError(err.message);
            }
            setLoading(false);
        }
    }, [symbol, apiBase, loading, data]);

    useEffect(() => {
        fetchData();
        // ✅ PERFORMANCE FIX: Ridotto a 15s per ridurre lag
        const interval = setInterval(fetchData, 15000);

        return () => clearInterval(interval);
    }, [fetchData]);

    const handleRefresh = () => {
        // Non azzerare i dati durante il refresh manuale
        fetchData();
    };

    const navigateToDashboard = () => {
        if (window.opener) {
            window.close();
        } else {
            const url = new URL(window.location);
            url.searchParams.delete('page');
            window.location.href = url.toString();
        }
    };

    // Helper function per identificare se una conferma riguarda il grafico
    const isChartRelatedConfirmation = (reason) => {
        if (!reason || typeof reason !== 'string') return false;
        const reasonLower = reason.toLowerCase();
        // Keywords che indicano indicatori grafici/tecnici
        const chartKeywords = [
            'rsi', 'macd', 'ema', 'bollinger', 'trend', 'volume', 'atr',
            'divergence', 'momentum', 'breakout', 'price', 'candlestick',
            'bullish', 'bearish', 'oversold', 'overbought', 'moving average',
            'support', 'resistance', 'indicator', 'technical'
        ];
        return chartKeywords.some(keyword => reasonLower.includes(keyword));
    };

    if (loading && !data) {
        return (
            <div className="bot-analysis-page" data-new-version="true">
                <div className="page-container">
                    <div className="loading-spinner">Caricamento analisi...</div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bot-analysis-page" data-new-version="true">
                <div className="page-container">
                    <div className="error-message">
                        Errore nel caricamento dei dati: {error || 'Dati non disponibili'}
                    </div>
                    <button onClick={handleRefresh} style={{ marginTop: '20px', padding: '10px 20px' }}>
                        Riprova
                    </button>
                </div>
            </div>
        );
    }

    // ✅ FIX: Mostra messaggio informativo se i dati sono insufficienti
    const hasInsufficientData = data?.error || (data?.signal?.reasons && data.signal.reasons.some(r => r.includes('Dati insufficienti')));
    const dataAvailable = data?.dataAvailable !== false;

    const { signal, requirements, risk, positions, currentPrice, rsi, mtf } = data;
    // ✅ STRATEGY v2.0: Estrai Williams %R e TSI
    const williamsR = signal?.williamsR;
    const tsi = signal?.tsi;
    const updateKey = data._timestamp || Date.now(); // Key per forzare re-render

    return (
        <div className="bot-analysis-page" data-new-version="true">
            <div className="page-container">
                <div className="page-header">
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: '#fff',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.6)',
                        zIndex: 1000,
                        border: '2px solid #fff',
                        animation: 'pulse 2s infinite'
                    }}>
                        🚀 STRATEGY v2.0 - Williams %R + TSI Momentum - BUILD {new Date().toLocaleDateString('it-IT')}
                    </div>
                    <style>{`
                        @keyframes pulse {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0.8; }
                        }
                    `}</style>
                    {window.opener ? (
                        <button className="back-button" onClick={() => window.close()}>
                            <ArrowLeft size={20} />
                            Chiudi Finestra
                        </button>
                    ) : (
                        <button className="back-button" onClick={navigateToDashboard}>
                            <ArrowLeft size={20} />
                            Torna al Dashboard
                        </button>
                    )}
                    <h1>🤖 Analisi Bot in Tempo Reale - {symbol.toUpperCase()}</h1>
                    <button
                        className="refresh-button"
                        onClick={handleRefresh}
                        title="Aggiorna manualmente"
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>

                {/* ✅ FIX: Messaggio informativo se i dati sono insufficienti */}
                {hasInsufficientData && !dataAvailable && (
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))',
                        border: '2px solid #ef4444',
                        borderRadius: '12px',
                        padding: '20px',
                        margin: '20px 0',
                        color: '#fff'
                    }}>
                        <h3 style={{ color: '#ef4444', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ⚠️ Dati Storici Insufficienti
                        </h3>
                        <p style={{ marginBottom: '10px' }}>
                            {data?.error || 'Il bot sta ancora raccogliendo dati storici per questo simbolo.'}
                        </p>
                        {data?.suggestion && (
                            <p style={{ marginBottom: '10px', fontStyle: 'italic' }}>
                                💡 {data.suggestion}
                            </p>
                        )}
                        {data?.dataCount !== undefined && (
                            <p style={{ marginBottom: '10px' }}>
                                📊 Dati disponibili: {data.dataCount} candele (minimo {data.dataRequired || 20} richieste)
                            </p>
                        )}
                        <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                            Il bot scaricherà automaticamente i dati storici da Binance. Attendi qualche minuto e ricarica la pagina.
                        </p>
                    </div>
                )}

                <div className="page-content">
                    {/* Prezzo e RSI */}
                    <div className="info-section" key={`info-${updateKey}`}>
                        <div className="info-card">
                            <div className="info-label">Prezzo Corrente</div>
                            <div className="info-value">
                                {formatPriceWithSymbol(currentPrice || 0, 2)}
                            </div>
                        </div>
                        <div className="info-card">
                            <div className="info-label">RSI (14 periodi)</div>
                            <div className={`info-value ${rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : ''}`}>
                                {rsi?.toFixed(2) || '0.00'}
                            </div>
                            <div className="info-hint">
                                {rsi < 30 ? 'Oversold (possibile rialzo)' :
                                    rsi > 70 ? 'Overbought (possibile calo)' :
                                        'Neutrale'}
                            </div>
                        </div>
                        {/* ✅ STRATEGY v2.0: Williams %R */}
                        <div className="info-card">
                            <div className="info-label">Williams %R (14 periodi)</div>
                            <div className={`info-value ${williamsR !== null && williamsR < -70 ? 'oversold' : williamsR !== null && williamsR > -30 ? 'overbought' : ''}`}>
                                {williamsR !== null ? williamsR.toFixed(2) : 'N/A'}
                            </div>
                            <div className="info-hint">
                                {williamsR !== null && williamsR < -70 ? 'Oversold (early buy signal) ⚡' :
                                    williamsR !== null && williamsR > -30 ? 'Overbought (early sell signal) ⚡' :
                                        williamsR !== null ? 'Neutral' : 'Calcolo...'}
                            </div>
                        </div>
                        {/* ✅ STRATEGY v2.0: TSI */}
                        <div className="info-card">
                            <div className="info-label">TSI - True Strength Index</div>
                            <div className={`info-value ${tsi !== null && tsi < -20 ? 'oversold' : tsi !== null && tsi > 20 ? 'overbought' : ''}`}>
                                {tsi !== null ? tsi.toFixed(2) : 'N/A'}
                            </div>
                            <div className="info-hint">
                                {tsi !== null && tsi < -20 ? 'Bearish momentum slowing ⚡' :
                                    tsi !== null && tsi > 20 ? 'Bullish momentum slowing ⚡' :
                                        tsi !== null ? 'Neutral momentum' : 'Calcolo...'}
                            </div>
                        </div>
                    </div>

                    {/* Segnale Attuale */}
                    <div className="signal-section" key={`signal-${updateKey}`}>
                        <h3>📡 Segnale Attuale</h3>
                        <div className={`signal-card ${signal?.direction?.toLowerCase() || 'neutral'}`}>
                            <div className="signal-header">
                                <span className="signal-direction">
                                    {signal?.direction === 'LONG' ? <TrendingUp size={24} /> :
                                        signal?.direction === 'SHORT' ? <TrendingDown size={24} /> :
                                            <BarChart3 size={24} />}
                                    {signal?.direction || 'NEUTRAL'}
                                </span>
                                <span className="signal-strength">
                                    Strength: {signal?.strength || 0}/100
                                </span>
                            </div>
                            <div className="signal-details">
                                <div className="signal-item">
                                    <span>Conferme ottenute:</span>
                                    <span className="highlight">{signal?.confirmations || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Multi-Timeframe Confirmation */}
                    {mtf && (
                        <div className="mtf-section" key={`mtf-${updateKey}`}>
                            <h3>🔭 Multi-Timeframe Confirmation (1h / 4h)</h3>
                            <div className="mtf-card">
                                <div className="mtf-trends">
                                    <div className="mtf-trend-item">
                                        <span className="mtf-label">Trend 1h:</span>
                                        <span className={`mtf-value ${mtf.trend1h}`}>
                                            {mtf.trend1h === 'bullish' ? '📈 Bullish' :
                                                mtf.trend1h === 'bearish' ? '📉 Bearish' :
                                                    '➡️ Neutral'}
                                        </span>
                                    </div>
                                    <div className="mtf-trend-item">
                                        <span className="mtf-label">Trend 4h:</span>
                                        <span className={`mtf-value ${mtf.trend4h}`}>
                                            {mtf.trend4h === 'bullish' ? '📈 Bullish' :
                                                mtf.trend4h === 'bearish' ? '📉 Bearish' :
                                                    '➡️ Neutral'}
                                        </span>
                                    </div>
                                </div>

                                <div className="mtf-adjustments">
                                    <div className="mtf-adjustment-card long">
                                        <h4>📈 LONG Adjustment</h4>
                                        <div className="mtf-strength-comparison">
                                            <div className="mtf-strength-row">
                                                <span>Original Strength:</span>
                                                <span className="value">{mtf.long?.originalStrength || 0}/100</span>
                                            </div>
                                            <div className="mtf-strength-row mtf-bonus">
                                                <span>MTF Bonus:</span>
                                                <span className={`value ${mtf.long?.bonus >= 0 ? 'positive' : 'negative'}`}>
                                                    {mtf.long?.bonus >= 0 ? '+' : ''}{mtf.long?.bonus || 0}
                                                </span>
                                            </div>
                                            <div className="mtf-strength-row mtf-final">
                                                <span>Adjusted Strength:</span>
                                                <span className={`value ${(mtf.long?.adjustedStrength || 0) >= 70 ? 'ready' : 'waiting'}`}>
                                                    {mtf.long?.adjustedStrength || 0}/100
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mtf-progress-bar">
                                            <div
                                                className="mtf-progress-fill"
                                                style={{
                                                    width: `${Math.min(100, ((mtf.long?.adjustedStrength || 0) / 70) * 100)}%`,
                                                    background: (mtf.long?.adjustedStrength || 0) >= 70
                                                        ? 'linear-gradient(90deg, #10b981, #059669)'
                                                        : 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                                }}
                                            />
                                        </div>
                                        <div className="mtf-reason">{mtf.long?.reason || 'Neutral timeframes (0)'}</div>
                                    </div>

                                    <div className="mtf-adjustment-card short">
                                        <h4>📉 SHORT Adjustment</h4>
                                        <div className="mtf-strength-comparison">
                                            <div className="mtf-strength-row">
                                                <span>Original Strength:</span>
                                                <span className="value">{mtf.short?.originalStrength || 0}/100</span>
                                            </div>
                                            <div className="mtf-strength-row mtf-bonus">
                                                <span>MTF Bonus:</span>
                                                <span className={`value ${mtf.short?.bonus >= 0 ? 'positive' : 'negative'}`}>
                                                    {mtf.short?.bonus >= 0 ? '+' : ''}{mtf.short?.bonus || 0}
                                                </span>
                                            </div>
                                            <div className="mtf-strength-row mtf-final">
                                                <span>Adjusted Strength:</span>
                                                <span className={`value ${(mtf.short?.adjustedStrength || 0) >= 70 ? 'ready' : 'waiting'}`}>
                                                    {mtf.short?.adjustedStrength || 0}/100
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mtf-progress-bar">
                                            <div
                                                className="mtf-progress-fill"
                                                style={{
                                                    width: `${Math.min(100, ((mtf.short?.adjustedStrength || 0) / 70) * 100)}%`,
                                                    background: (mtf.short?.adjustedStrength || 0) >= 70
                                                        ? 'linear-gradient(90deg, #10b981, #059669)'
                                                        : 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                                }}
                                            />
                                        </div>
                                        <div className="mtf-reason">{mtf.short?.reason || 'Neutral timeframes (0)'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Requisiti per LONG */}
                    <div className="requirements-section" key={`long-req-${updateKey}`}>
                        <h3>📈 Requisiti per APRIRE LONG (Compra)</h3>
                        <div className={`requirement-card ${requirements?.long?.canOpen ? 'ready' : 'waiting'}`}>
                            <div className="requirement-header">
                                <span className="requirement-status">
                                    {requirements?.long?.canOpen ? (
                                        <><CheckCircle size={20} /> PRONTO AD APRIRE</>
                                    ) : (
                                        <><AlertCircle size={20} /> IN ATTESA</>
                                    )}
                                </span>
                            </div>
                            <div className="requirement-progress">
                                <div className="progress-item">
                                    <span>Strength attuale:</span>
                                    <span className={`value ${(requirements?.long?.currentStrength || 0) >= (requirements?.long?.minStrength || 65) ? 'ok' : 'missing'}`}>
                                        {requirements?.long?.currentStrength || 0}/100
                                    </span>
                                </div>
                                <div className="progress-item">
                                    <span>Minimo richiesto:</span>
                                    <span className="value" style={{ color: '#10b981', fontWeight: 'bold' }}>
                                        {requirements?.long?.minStrength || 65}
                                    </span>
                                    {(requirements?.long?.needsStrength || 0) > 0 && (
                                        <span className="needs" style={{ color: '#ef4444', fontWeight: 'bold', marginLeft: '10px' }}>
                                            (Mancano {requirements.long.needsStrength} punti!)
                                        </span>
                                    )}
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${Math.min(100, ((requirements?.long?.currentStrength || 0) / (requirements?.long?.minStrength || 65)) * 100)}%`,
                                            transition: 'width 0.5s ease-in-out',
                                            background: (requirements?.long?.currentStrength || 0) >= (requirements?.long?.minStrength || 65)
                                                ? 'linear-gradient(90deg, #10b981, #059669)'
                                                : 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                        }}
                                    />
                                </div>
                                <div className="strength-percentage">
                                    {Math.round(((requirements?.long?.currentStrength || 0) / (requirements?.long?.minStrength || 65)) * 100)}% del target raggiunto
                                </div>
                            </div>
                            {requirements?.long?.strengthContributions && requirements.long.strengthContributions.length > 0 && (
                                <div className="strength-contributions-list">
                                    <strong>Contributi allo Strength ({requirements.long.currentStrength}/100 punti):</strong>
                                    <div className="strength-contributions-grid">
                                        {requirements.long.strengthContributions.map((contribution, idx) => (
                                            <div key={idx} className="strength-contribution-item-compact">
                                                <span className="strength-indicator-name">{contribution.indicator}</span>
                                                <span className="strength-points">+{contribution.points}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="requirement-progress">
                                <div className="progress-item">
                                    <span>Conferme richieste:</span>
                                    <span className="value">{requirements?.long?.minConfirmations || 4}</span>
                                </div>
                                <div className="progress-item">
                                    <span>Conferme attuali:</span>
                                    <span className={`value ${(requirements?.long?.currentConfirmations || 0) >= (requirements?.long?.minConfirmations || 4) ? 'ok' : 'missing'}`}>
                                        {requirements?.long?.currentConfirmations || 0}/{requirements?.long?.minConfirmations || 4}
                                    </span>
                                    {(requirements?.long?.needsConfirmations || 0) > 0 && (
                                        <span className="needs">{requirements.long.needsConfirmations} in più</span>
                                    )}
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${Math.min(100, ((requirements?.long?.currentConfirmations || 0) / (requirements?.long?.minConfirmations || 4)) * 100)}%`,
                                            transition: 'width 0.5s ease-in-out'
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="requirement-reason">
                                <strong>Stato:</strong> {requirements?.long?.reason || 'Nessun segnale LONG attivo'}
                            </div>
                        </div>
                    </div>

                    {/* Requisiti per SHORT */}
                    <div className="requirements-section" key={`short-req-${updateKey}`}>
                        <h3>📉 Requisiti per APRIRE SHORT (Vendi)</h3>
                        <div className={`requirement-card ${requirements?.short?.canOpen ? 'ready' : 'waiting'}`}>
                            <div className="requirement-header">
                                <span className="requirement-status">
                                    {requirements?.short?.canOpen ? (
                                        <><CheckCircle size={20} /> PRONTO AD APRIRE</>
                                    ) : (
                                        <><AlertCircle size={20} /> IN ATTESA</>
                                    )}
                                </span>
                            </div>
                            <div className="requirement-progress">
                                <div className="progress-item">
                                    <span>Strength attuale:</span>
                                    <span className={`value ${(requirements?.short?.currentStrength || 0) >= (requirements?.short?.minStrength || 65) ? 'ok' : 'missing'}`}>
                                        {requirements?.short?.currentStrength || 0}/100
                                    </span>
                                </div>
                                <div className="progress-item">
                                    <span>Minimo richiesto:</span>
                                    <span className="value" style={{ color: '#10b981', fontWeight: 'bold' }}>
                                        {requirements?.short?.minStrength || 65}
                                    </span>
                                    {(requirements?.short?.needsStrength || 0) > 0 && (
                                        <span className="needs" style={{ color: '#ef4444', fontWeight: 'bold', marginLeft: '10px' }}>
                                            (Mancano {requirements.short.needsStrength} punti!)
                                        </span>
                                    )}
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${Math.min(100, ((requirements?.short?.currentStrength || 0) / (requirements?.short?.minStrength || 65)) * 100)}%`,
                                            transition: 'width 0.5s ease-in-out',
                                            background: (requirements?.short?.currentStrength || 0) >= (requirements?.short?.minStrength || 65)
                                                ? 'linear-gradient(90deg, #10b981, #059669)'
                                                : 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                        }}
                                    />
                                </div>
                                <div className="strength-percentage">
                                    {Math.round(((requirements?.short?.currentStrength || 0) / (requirements?.short?.minStrength || 65)) * 100)}% del target raggiunto
                                </div>
                            </div>
                            {requirements?.short?.strengthContributions && requirements.short.strengthContributions.length > 0 && (
                                <div className="strength-contributions-list">
                                    <strong>Contributi allo Strength ({requirements.short.currentStrength}/100 punti):</strong>
                                    <div className="strength-contributions-grid">
                                        {requirements.short.strengthContributions.map((contribution, idx) => (
                                            <div key={idx} className="strength-contribution-item-compact">
                                                <span className="strength-indicator-name">{contribution.indicator}</span>
                                                <span className="strength-points">+{contribution.points}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="requirement-progress">
                                <div className="progress-item">
                                    <span>Conferme richieste:</span>
                                    <span className="value">{requirements?.short?.minConfirmations || 5}</span>
                                </div>
                                <div className="progress-item">
                                    <span>Conferme attuali:</span>
                                    <span className={`value ${(requirements?.short?.currentConfirmations || 0) >= (requirements?.short?.minConfirmations || 5) ? 'ok' : 'missing'}`}>
                                        {requirements?.short?.currentConfirmations || 0}/{requirements?.short?.minConfirmations || 5}
                                    </span>
                                    {(requirements?.short?.needsConfirmations || 0) > 0 && (
                                        <span className="needs">{requirements.short.needsConfirmations} in più</span>
                                    )}
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${Math.min(100, ((requirements?.short?.currentConfirmations || 0) / (requirements?.short?.minConfirmations || 5)) * 100)}%`,
                                            transition: 'width 0.5s ease-in-out'
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="requirement-reason">
                                <strong>Stato:</strong> {requirements?.short?.reason || 'Nessun segnale SHORT attivo'}
                            </div>
                        </div>
                    </div>

                    {/* Risk Manager */}
                    {risk && (
                        <div className="risk-section" key={`risk-${updateKey}`}>
                            <h3><Shield size={20} /> Risk Manager</h3>
                            <div className={`risk-card ${risk.canTrade ? 'ok' : 'blocked'}`}>
                                <div className="risk-status">
                                    {risk.canTrade ? (
                                        <><CheckCircle size={20} /> Trading Permesso</>
                                    ) : (
                                        <><AlertCircle size={20} /> Trading Bloccato</>
                                    )}
                                </div>
                                <div className="risk-details">
                                    <div className="risk-item">
                                        <span>Perdita giornaliera:</span>
                                        <span className={risk.dailyLoss < 5 ? 'ok' : 'warning'}>
                                            {risk.dailyLoss?.toFixed(2) || '0.00'}% (max 5%)
                                        </span>
                                    </div>
                                    <div className="risk-item">
                                        <span>Exposure corrente:</span>
                                        <span>{risk.currentExposure?.toFixed(2) || '0.00'}% (max 40%)</span>
                                    </div>
                                    <div className="risk-item">
                                        <span>Exposure disponibile:</span>
                                        <span className="highlight">${risk.availableExposure?.toFixed(2) || '0.00'}</span>
                                    </div>
                                    <div className="risk-item">
                                        <span>Dimensione max posizione:</span>
                                        <span className="highlight">${risk.maxAvailableForNewPosition?.toFixed(2) || '0.00'}</span>
                                    </div>
                                    {!risk.canTrade && (
                                        <div className="risk-reason">
                                            <strong>Motivo blocco:</strong> {risk.reason || 'N/A'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Posizioni Aperte */}
                    <div className="positions-section" key={`positions-${updateKey}`}>
                        <h3><DollarSign size={20} /> Posizioni Aperte</h3>
                        <div className="positions-card">
                            <div className="position-item">
                                <span>LONG:</span>
                                <span className="highlight">{positions?.long || 0}</span>
                            </div>
                            <div className="position-item">
                                <span>SHORT:</span>
                                <span className="highlight">{positions?.short || 0}</span>
                            </div>
                            <div className="position-item">
                                <span>Totale:</span>
                                <span className="highlight">{positions?.total || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Conferme del Segnale - SOTTO il bot */}
                    {signal?.reasons && signal.reasons.length > 0 && (
                        <div className="confirmations-section" key={`confirmations-${updateKey}`} style={{ marginTop: '20px' }}>
                            <h3>✅ Conferme del Segnale ({signal.confirmations || 0})</h3>
                            <div className="confirmations-list">
                                {(signal.reasons || []).map((reason, idx) => {
                                    const isChartRelated = isChartRelatedConfirmation(reason);
                                    return (
                                        <div
                                            key={idx}
                                            className={`confirmation-item ${isChartRelated ? 'chart-related' : ''}`}
                                            style={{
                                                background: isChartRelated
                                                    ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(124, 58, 237, 0.1))'
                                                    : 'rgba(59, 130, 246, 0.1)',
                                                border: isChartRelated
                                                    ? '1px solid rgba(139, 92, 246, 0.3)'
                                                    : '1px solid rgba(59, 130, 246, 0.2)',
                                                borderRadius: '8px',
                                                padding: '12px',
                                                marginBottom: '8px',
                                                color: '#fff',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {isChartRelated && <span style={{ color: '#a78bfa', fontSize: '1.1rem' }}>📊</span>}
                                                <span>{reason}</span>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Blocchi Attivi - SEMPRE VISIBILI se esistono, indipendentemente dal segnale attivo */}
                    {(() => {
                        // ✅ FIX: Mostra SEMPRE i blockers se esistono, non solo quando corrispondono al segnale attivo
                        // Questo permette di vedere sempre perché il bot non sta aprendo posizioni
                        const hasLongBlockers = data.blockers?.long && Array.isArray(data.blockers.long) && data.blockers.long.length > 0;
                        const hasShortBlockers = data.blockers?.short && Array.isArray(data.blockers.short) && data.blockers.short.length > 0;

                        // ✅ Mostra la sezione se ci sono blockers LONG o SHORT (o entrambi)
                        if (!hasLongBlockers && !hasShortBlockers) {
                            return null;
                        }

                        return (
                            <div className="blockers-section" key={`blockers-${updateKey}`} style={{ marginTop: '20px' }}>
                                <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    🚫 Blocchi Attivi - Perché il bot non sta aprendo?
                                </h3>

                                {hasLongBlockers && (
                                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '2px solid #ef4444', borderRadius: '12px', padding: '20px', marginBottom: hasShortBlockers ? '15px' : '0' }}>
                                        <h4 style={{ color: '#10b981', marginBottom: '15px' }}>📈 LONG Bloccato</h4>
                                        {data.blockers.long.map((blocker, idx) => (
                                            <div key={idx} style={{
                                                background: blocker.severity === 'high' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                                                border: `1px solid ${blocker.severity === 'high' ? '#ef4444' : '#fbbf24'}`,
                                                borderRadius: '8px',
                                                padding: '12px',
                                                marginBottom: '10px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span style={{ fontWeight: 'bold', color: '#fff' }}>⚠️ {blocker.type}</span>
                                                <span style={{ color: '#d1d5db' }}>{blocker.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {hasShortBlockers && (
                                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '2px solid #ef4444', borderRadius: '12px', padding: '20px' }}>
                                        <h4 style={{ color: '#ef4444', marginBottom: '15px' }}>📉 SHORT Bloccato</h4>
                                        {data.blockers.short.map((blocker, idx) => (
                                            <div key={idx} style={{
                                                background: blocker.severity === 'high' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                                                border: `1px solid ${blocker.severity === 'high' ? '#ef4444' : '#fbbf24'}`,
                                                borderRadius: '8px',
                                                padding: '12px',
                                                marginBottom: '10px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span style={{ fontWeight: 'bold', color: '#fff' }}>⚠️ {blocker.type}</span>
                                                <span style={{ color: '#d1d5db' }}>{blocker.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

export default BotAnalysisPageNew;
