import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, AlertCircle, CheckCircle, BarChart3, Shield, DollarSign, RefreshCw } from 'lucide-react';
import './BotAnalysisPanel.css';

const BotAnalysisPage = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [updateCounter, setUpdateCounter] = useState(0);
    
    const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = urlParams.get('symbol') || 'bitcoin';
    const isNewVersion = urlParams.get('_new') === 'true';

    // ✅ Fetch semplice e affidabile - sempre nuovi dati
    const fetchData = useCallback(async () => {
        try {
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(7);
            const url = `${apiBase}/api/crypto/bot-analysis?symbol=${symbol}&_t=${timestamp}&_r=${randomId}${isNewVersion ? '&_new=true' : ''}`;
            
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
            const freshData = {
                ...jsonData,
                _timestamp: timestamp,
                _counter: updateCounter + 1
            };
            
            setData(freshData);
            setUpdateCounter(prev => prev + 1);
            setError(null);
            setLoading(false);
            
            console.log(`✅ [${symbol}] Data fetched at ${new Date().toLocaleTimeString()}`, {
                signal: jsonData.signal?.direction,
                strength: jsonData.signal?.strength
            });
        } catch (err) {
            console.error(`❌ [${symbol}] Fetch error:`, err);
            setError(err.message);
            setLoading(false);
        }
    }, [symbol, apiBase, updateCounter, isNewVersion]);

    // ✅ Forza reload completo se è la nuova versione
    useEffect(() => {
        if (isNewVersion) {
            // Forza il browser a non usare cache per questa pagina
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    registrations.forEach(registration => registration.unregister());
                });
            }
            // Aggiorna il timestamp nell'URL per forzare reload
            const url = new URL(window.location);
            url.searchParams.set('_loaded', Date.now().toString());
            window.history.replaceState({}, '', url);
        }
    }, [isNewVersion]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 2000); // Aggiorna ogni 2 secondi
        
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleRefresh = () => {
        setLoading(true);
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

    if (loading && !data) {
        return (
            <div className="bot-analysis-page">
                <div className="page-container">
                    <div className="loading-spinner">Caricamento analisi...</div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bot-analysis-page">
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

    const { signal, requirements, risk, positions, currentPrice, rsi, mtf } = data;
    const updateKey = data._timestamp || Date.now(); // Key per forzare re-render

    return (
        <div className="bot-analysis-page">
            <div className="page-container">
                <div className="page-header">
                    {isNewVersion && (
                        <div style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)',
                            zIndex: 1000
                        }}>
                            ✨ NUOVA VERSIONE
                        </div>
                    )}
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

                <div className="page-content">
                    {/* Prezzo e RSI */}
                    <div className="info-section" key={`info-${updateKey}`}>
                        <div className="info-card">
                            <div className="info-label">Prezzo Corrente</div>
                            <div className="info-value">
                                €{currentPrice?.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
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
                                <div className="signal-reasons">
                                    <strong>Motivi del segnale:</strong>
                                    <ul>
                                        {(signal?.reasons || []).map((reason, idx) => (
                                            <li key={idx}>{reason}</li>
                                        ))}
                                    </ul>
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
                                    <span>Strength richiesto:</span>
                                    <span className="value">{requirements?.long?.minStrength || 70}/100</span>
                                </div>
                                <div className="progress-item">
                                    <span>Strength attuale:</span>
                                    <span className={`value ${(requirements?.long?.currentStrength || 0) >= (requirements?.long?.minStrength || 70) ? 'ok' : 'missing'}`}>
                                        {requirements?.long?.currentStrength || 0}/100
                                    </span>
                                    {(requirements?.long?.needsStrength || 0) > 0 && (
                                        <span className="needs">+{requirements.long.needsStrength} punti</span>
                                    )}
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${Math.min(100, ((requirements?.long?.currentStrength || 0) / (requirements?.long?.minStrength || 70)) * 100)}%`,
                                            transition: 'width 0.5s ease-in-out',
                                            background: (requirements?.long?.currentStrength || 0) >= (requirements?.long?.minStrength || 70)
                                                ? 'linear-gradient(90deg, #10b981, #059669)'
                                                : 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                        }}
                                    />
                                </div>
                                <div className="strength-percentage">
                                    {Math.round(((requirements?.long?.currentStrength || 0) / (requirements?.long?.minStrength || 70)) * 100)}% del target raggiunto
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
                            {requirements?.long?.confirmationsList && requirements.long.confirmationsList.length > 0 && (
                                <div className="confirmations-list">
                                    <strong>Conferme ottenute ({requirements.long.currentConfirmations}/{requirements.long.minConfirmations}):</strong>
                                    <div className="confirmations-grid">
                                        {requirements.long.confirmationsList.map((confirmation, idx) => (
                                            <div key={idx} className="confirmation-item-compact">
                                                <span className="confirmation-check">✓</span>
                                                <span className="confirmation-text">{confirmation}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                                    <span>Strength richiesto:</span>
                                    <span className="value">{requirements?.short?.minStrength || 70}/100</span>
                                </div>
                                <div className="progress-item">
                                    <span>Strength attuale:</span>
                                    <span className={`value ${(requirements?.short?.currentStrength || 0) >= (requirements?.short?.minStrength || 70) ? 'ok' : 'missing'}`}>
                                        {requirements?.short?.currentStrength || 0}/100
                                    </span>
                                    {(requirements?.short?.needsStrength || 0) > 0 && (
                                        <span className="needs">+{requirements.short.needsStrength} punti</span>
                                    )}
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${Math.min(100, ((requirements?.short?.currentStrength || 0) / (requirements?.short?.minStrength || 70)) * 100)}%`,
                                            transition: 'width 0.5s ease-in-out',
                                            background: (requirements?.short?.currentStrength || 0) >= (requirements?.short?.minStrength || 70)
                                                ? 'linear-gradient(90deg, #10b981, #059669)'
                                                : 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                        }}
                                    />
                                </div>
                                <div className="strength-percentage">
                                    {Math.round(((requirements?.short?.currentStrength || 0) / (requirements?.short?.minStrength || 70)) * 100)}% del target raggiunto
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
                            {requirements?.short?.confirmationsList && requirements.short.confirmationsList.length > 0 && (
                                <div className="confirmations-list">
                                    <strong>Conferme ottenute ({requirements.short.currentConfirmations}/{requirements.short.minConfirmations}):</strong>
                                    <div className="confirmations-grid">
                                        {requirements.short.confirmationsList.map((confirmation, idx) => (
                                            <div key={idx} className="confirmation-item-compact">
                                                <span className="confirmation-check">✓</span>
                                                <span className="confirmation-text">{confirmation}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                                        <span className="highlight">€{risk.availableExposure?.toFixed(2) || '0.00'}</span>
                                    </div>
                                    <div className="risk-item">
                                        <span>Dimensione max posizione:</span>
                                        <span className="highlight">€{risk.maxAvailableForNewPosition?.toFixed(2) || '0.00'}</span>
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
                </div>
            </div>
        </div>
    );
};

export default BotAnalysisPage;