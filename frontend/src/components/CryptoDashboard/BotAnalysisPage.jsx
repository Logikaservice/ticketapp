import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, AlertCircle, CheckCircle, BarChart3, Shield, DollarSign, RefreshCw } from 'lucide-react';
// Non usiamo react-router, usiamo window.location
import './BotAnalysisPanel.css';

const BotAnalysisPage = () => {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';

    // Get symbol from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = urlParams.get('symbol') || 'bitcoin';

    const navigateToDashboard = () => {
        // Se siamo in una finestra popup, chiudila, altrimenti naviga
        if (window.opener) {
            window.close();
        } else {
            const url = new URL(window.location);
            url.searchParams.delete('page');
            window.location.href = url.toString();
        }
    };

    useEffect(() => {
        const fetchAnalysis = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${apiBase}/api/crypto/bot-analysis?symbol=${symbol}`);
                if (res.ok) {
                    const data = await res.json();
                    setAnalysis(data);
                }
            } catch (error) {
                console.error('Error fetching bot analysis:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalysis();
        const interval = setInterval(fetchAnalysis, 1000); // ✅ Aggiorna ogni 1 secondo per vedere cambiamenti in tempo reale

        return () => clearInterval(interval);
    }, [apiBase, symbol]);

    if (loading && !analysis) {
        return (
            <div className="bot-analysis-page">
                <div className="page-container">
                    <div className="loading-spinner">Caricamento analisi...</div>
                </div>
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className="bot-analysis-page">
                <div className="page-container">
                    <div className="error-message">Errore nel caricamento dei dati</div>
                </div>
            </div>
        );
    }

    const { signal, requirements, risk, positions, currentPrice, rsi, botParameters, mtf } = analysis;

    return (
        <div className="bot-analysis-page">
            <div className="page-container">
                <div className="page-header">
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
                        onClick={() => window.location.reload()}
                        title="Aggiorna pagina"
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>

                <div className="page-content">
                    {/* Prezzo e RSI Corrente */}
                    <div className="info-section">
                        <div className="info-card">
                            <div className="info-label">Prezzo Corrente</div>
                            <div className="info-value">€{currentPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                        <div className="info-card">
                            <div className="info-label">RSI (14 periodi)</div>
                            <div className={`info-value ${rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : ''}`}>
                                {rsi.toFixed(2)}
                            </div>
                            <div className="info-hint">
                                {rsi < 30 ? 'Oversold (possibile rialzo)' :
                                    rsi > 70 ? 'Overbought (possibile calo)' :
                                        'Neutrale'}
                            </div>
                        </div>
                    </div>

                    {/* Segnale Attuale */}
                    <div className="signal-section">
                        <h3>📡 Segnale Attuale</h3>
                        <div className={`signal-card ${signal.direction.toLowerCase()}`}>
                            <div className="signal-header">
                                <span className="signal-direction">
                                    {signal.direction === 'LONG' ? <TrendingUp size={24} /> :
                                        signal.direction === 'SHORT' ? <TrendingDown size={24} /> :
                                            <BarChart3 size={24} />}
                                    {signal.direction || 'NEUTRAL'}
                                </span>
                                <span className="signal-strength">
                                    Strength: {signal.strength}/100
                                </span>
                            </div>
                            <div className="signal-details">
                                <div className="signal-item">
                                    <span>Conferme ottenute:</span>
                                    <span className="highlight">{signal.confirmations}</span>
                                </div>
                                <div className="signal-reasons">
                                    <strong>Motivi del segnale:</strong>
                                    <ul>
                                        {signal.reasons.map((reason, idx) => (
                                            <li key={idx}>{reason}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Multi-Timeframe Confirmation */}
                    {mtf && (
                        <div className="mtf-section">
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
                                                <span className="value">{mtf.long.originalStrength}/100</span>
                                            </div>
                                            <div className="mtf-strength-row mtf-bonus">
                                                <span>MTF Bonus:</span>
                                                <span className={`value ${mtf.long.bonus >= 0 ? 'positive' : 'negative'}`}>
                                                    {mtf.long.bonus >= 0 ? '+' : ''}{mtf.long.bonus}
                                                </span>
                                            </div>
                                            <div className="mtf-strength-row mtf-final">
                                                <span>Adjusted Strength:</span>
                                                <span className={`value ${mtf.long.adjustedStrength >= 70 ? 'ready' : 'waiting'}`}>
                                                    {mtf.long.adjustedStrength}/100
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mtf-progress-bar">
                                            <div
                                                className="mtf-progress-fill"
                                                style={{
                                                    width: `${Math.min(100, (mtf.long.adjustedStrength / 70) * 100)}%`,
                                                    background: mtf.long.adjustedStrength >= 70
                                                        ? 'linear-gradient(90deg, #10b981, #059669)'
                                                        : 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                                }}
                                            />
                                        </div>
                                        <div className="mtf-reason">{mtf.long.reason}</div>
                                    </div>

                                    <div className="mtf-adjustment-card short">
                                        <h4>📉 SHORT Adjustment</h4>
                                        <div className="mtf-strength-comparison">
                                            <div className="mtf-strength-row">
                                                <span>Original Strength:</span>
                                                <span className="value">{mtf.short.originalStrength}/100</span>
                                            </div>
                                            <div className="mtf-strength-row mtf-bonus">
                                                <span>MTF Bonus:</span>
                                                <span className={`value ${mtf.short.bonus >= 0 ? 'positive' : 'negative'}`}>
                                                    {mtf.short.bonus >= 0 ? '+' : ''}{mtf.short.bonus}
                                                </span>
                                            </div>
                                            <div className="mtf-strength-row mtf-final">
                                                <span>Adjusted Strength:</span>
                                                <span className={`value ${mtf.short.adjustedStrength >= 70 ? 'ready' : 'waiting'}`}>
                                                    {mtf.short.adjustedStrength}/100
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mtf-progress-bar">
                                            <div
                                                className="mtf-progress-fill"
                                                style={{
                                                    width: `${Math.min(100, (mtf.short.adjustedStrength / 70) * 100)}%`,
                                                    background: mtf.short.adjustedStrength >= 70
                                                        ? 'linear-gradient(90deg, #10b981, #059669)'
                                                        : 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                                }}
                                            />
                                        </div>
                                        <div className="mtf-reason">{mtf.short.reason}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Requisiti per LONG */}
                    <div className="requirements-section">
                        <h3>📈 Requisiti per APRIRE LONG (Compra)</h3>
                        <div className={`requirement-card ${requirements.long.canOpen ? 'ready' : 'waiting'}`}>
                            <div className="requirement-header">
                                <span className="requirement-status">
                                    {requirements.long.canOpen ? (
                                        <><CheckCircle size={20} /> PRONTO AD APRIRE</>
                                    ) : (
                                        <><AlertCircle size={20} /> IN ATTESA</>
                                    )}
                                </span>
                            </div>
                            <div className="requirement-progress">
                                <div className="progress-item">
                                    <span>Strength richiesto:</span>
                                    <span className="value">{requirements.long.minStrength}/100</span>
                                </div>
                                <div className="progress-item">
                                    <span>Strength attuale:</span>
                                    <span className={`value ${requirements.long.currentStrength >= requirements.long.minStrength ? 'ok' : 'missing'}`}>
                                        {requirements.long.currentStrength}/100
                                    </span>
                                    {requirements.long.needsStrength > 0 && (
                                        <span className="needs">+{requirements.long.needsStrength} punti</span>
                                    )}
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${Math.min(100, (requirements.long.currentStrength / requirements.long.minStrength) * 100)}%`,
                                            transition: 'width 0.5s ease-in-out',
                                            background: requirements.long.currentStrength >= requirements.long.minStrength
                                                ? 'linear-gradient(90deg, #10b981, #059669)'
                                                : 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                        }}
                                    />
                                </div>
                                {/* Indicatore visivo percentuale */}
                                <div className="strength-percentage">
                                    {Math.round((requirements.long.currentStrength / requirements.long.minStrength) * 100)}% del target raggiunto
                                </div>
                            </div>
                            {/* Lista dei contributi allo Strength */}
                            {requirements.long.strengthContributions && requirements.long.strengthContributions.length > 0 && (
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
                            {requirements.long.currentStrength === 0 && (
                                <div className="strength-contributions-list">
                                    <span className="no-strength">Nessun contributo allo Strength ancora</span>
                                </div>
                            )}
                            <div className="requirement-progress">
                                <div className="progress-item">
                                    <span>Conferme richieste:</span>
                                    <span className="value">{requirements.long.minConfirmations}</span>
                                </div>
                                <div className="progress-item">
                                    <span>Conferme attuali:</span>
                                    <span className={`value ${requirements.long.currentConfirmations >= requirements.long.minConfirmations ? 'ok' : 'missing'}`}>
                                        {requirements.long.currentConfirmations}/{requirements.long.minConfirmations}
                                    </span>
                                    {requirements.long.needsConfirmations > 0 && (
                                        <span className="needs">{requirements.long.needsConfirmations} in più</span>
                                    )}
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${Math.min(100, (requirements.long.currentConfirmations / requirements.long.minConfirmations) * 100)}%`,
                                            transition: 'width 0.5s ease-in-out'
                                        }}
                                    />
                                </div>
                            </div>
                            {/* Lista delle conferme ottenute */}
                            {requirements.long.confirmationsList && requirements.long.confirmationsList.length > 0 && (
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
                            {requirements.long.currentConfirmations === 0 && (
                                <div className="confirmations-list">
                                    <span className="no-confirmations">Nessuna conferma ottenuta ancora</span>
                                </div>
                            )}
                            <div className="requirement-reason">
                                <strong>Stato:</strong> {requirements.long.reason}
                            </div>
                        </div>
                    </div>

                    {/* Requisiti per SHORT */}
                    <div className="requirements-section">
                        <h3>📉 Requisiti per APRIRE SHORT (Vendi)</h3>
                        <div className={`requirement-card ${requirements.short.canOpen ? 'ready' : 'waiting'}`}>
                            <div className="requirement-header">
                                <span className="requirement-status">
                                    {requirements.short.canOpen ? (
                                        <><CheckCircle size={20} /> PRONTO AD APRIRE</>
                                    ) : (
                                        <><AlertCircle size={20} /> IN ATTESA</>
                                    )}
                                </span>
                            </div>
                            <div className="requirement-progress">
                                <div className="progress-item">
                                    <span>Strength richiesto:</span>
                                    <span className="value">{requirements.short.minStrength}/100</span>
                                </div>
                                <div className="progress-item">
                                    <span>Strength attuale:</span>
                                    <span className={`value ${requirements.short.currentStrength >= requirements.short.minStrength ? 'ok' : 'missing'}`}>
                                        {requirements.short.currentStrength}/100
                                    </span>
                                    {requirements.short.needsStrength > 0 && (
                                        <span className="needs">+{requirements.short.needsStrength} punti</span>
                                    )}
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${Math.min(100, (requirements.short.currentStrength / requirements.short.minStrength) * 100)}%`,
                                            transition: 'width 0.5s ease-in-out',
                                            background: requirements.short.currentStrength >= requirements.short.minStrength
                                                ? 'linear-gradient(90deg, #10b981, #059669)'
                                                : 'linear-gradient(90deg, #3b82f6, #2563eb)'
                                        }}
                                    />
                                </div>
                                {/* Indicatore visivo percentuale */}
                                <div className="strength-percentage">
                                    {Math.round((requirements.short.currentStrength / requirements.short.minStrength) * 100)}% del target raggiunto
                                </div>
                            </div>
                            {/* Lista dei contributi allo Strength */}
                            {requirements.short.strengthContributions && requirements.short.strengthContributions.length > 0 && (
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
                            {requirements.short.currentStrength === 0 && (
                                <div className="strength-contributions-list">
                                    <span className="no-strength">Nessun contributo allo Strength ancora</span>
                                </div>
                            )}
                            <div className="requirement-progress">
                                <div className="progress-item">
                                    <span>Conferme richieste:</span>
                                    <span className="value">{requirements.short.minConfirmations}</span>
                                </div>
                                <div className="progress-item">
                                    <span>Conferme attuali:</span>
                                    <span className={`value ${requirements.short.currentConfirmations >= requirements.short.minConfirmations ? 'ok' : 'missing'}`}>
                                        {requirements.short.currentConfirmations}/{requirements.short.minConfirmations}
                                    </span>
                                    {requirements.short.needsConfirmations > 0 && (
                                        <span className="needs">{requirements.short.needsConfirmations} in più</span>
                                    )}
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${Math.min(100, (requirements.short.currentConfirmations / requirements.short.minConfirmations) * 100)}%`,
                                            transition: 'width 0.5s ease-in-out'
                                        }}
                                    />
                                </div>
                            </div>
                            {/* Lista delle conferme ottenute */}
                            {requirements.short.confirmationsList && requirements.short.confirmationsList.length > 0 && (
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
                            {requirements.short.currentConfirmations === 0 && (
                                <div className="confirmations-list">
                                    <span className="no-confirmations">Nessuna conferma ottenuta ancora</span>
                                </div>
                            )}
                            <div className="requirement-reason">
                                <strong>Stato:</strong> {requirements.short.reason}
                            </div>

                        </div>
                    </div>

                    {/* Risk Manager */}
                    <div className="risk-section">
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
                                        {risk.dailyLoss.toFixed(2)}% (max 5%)
                                    </span>
                                </div>
                                <div className="risk-item">
                                    <span>Exposure corrente:</span>
                                    <span>{risk.currentExposure.toFixed(2)}% (max 40%)</span>
                                </div>
                                <div className="risk-item">
                                    <span>Exposure disponibile:</span>
                                    <span className="highlight">€{risk.availableExposure.toFixed(2)}</span>
                                </div>
                                <div className="risk-item">
                                    <span>Dimensione max posizione:</span>
                                    <span className="highlight">€{risk.maxAvailableForNewPosition.toFixed(2)}</span>
                                </div>
                                {!risk.canTrade && (
                                    <div className="risk-reason">
                                        <strong>Motivo blocco:</strong> {risk.reason}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Posizioni Aperte */}
                    <div className="positions-section">
                        <h3><DollarSign size={20} /> Posizioni Aperte</h3>
                        <div className="positions-card">
                            <div className="position-item">
                                <span>LONG:</span>
                                <span className="highlight">{positions.long}</span>
                            </div>
                            <div className="position-item">
                                <span>SHORT:</span>
                                <span className="highlight">{positions.short}</span>
                            </div>
                            <div className="position-item">
                                <span>Totale:</span>
                                <span className="highlight">{positions.total}</span>
                            </div>
                        </div>
                    </div>

                    {/* Spiegazione Semplice */}
                    <div className="explanation-section">
                        <h3>💡 Come Funziona (Spiegazione Semplice)</h3>
                        <div className="explanation-card">
                            <p><strong>Il bot analizza il mercato come un trader professionale:</strong></p>
                            <ul>
                                <li><strong>RSI:</strong> Se è sotto 30, il prezzo è "sottovalutato" (possibile rialzo). Se è sopra 70, è "sopravvalutato" (possibile calo).</li>
                                <li><strong>Conferme:</strong> Il bot non si fida di un solo indicatore. Serve che MULTIPLI indicatori (RSI, MACD, Bollinger Bands, Trend) siano d'accordo.</li>
                                <li><strong>Strength:</strong> Quanto è forte il segnale (0-100). Serve almeno 70 per avere ~90% di certezza.</li>
                                <li><strong>LONG:</strong> Serve 4 conferme + strength {'>'}= 70 per comprare.</li>
                                <li><strong>SHORT:</strong> Serve 5 conferme + strength {'>'}= 70 per vendere (più rigoroso).</li>
                                <li><strong>Risk Manager:</strong> Anche se il segnale è perfetto, il bot non apre se ha già perso troppo oggi o se l'exposure è troppo alta.</li>
                            </ul>
                            <p className="explanation-footer">
                                <strong>In pratica:</strong> Il bot aspetta che TUTTI gli indicatori siano d'accordo e che il segnale sia FORTISSIMO (90% certezza) prima di aprire.
                                Questo significa che potrebbe aspettare anche molto tempo, ma quando apre, è perché è QUASI SICURO che la posizione possa fruttare.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BotAnalysisPage;

