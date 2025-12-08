import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle, Play, Activity, BarChart2, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import './CryptoLayout.css';

const MarketScanner = ({ apiBase, onSelectSymbol }) => {
    const [scanResults, setScanResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastScan, setLastScan] = useState(null);

    // Quick Analysis State
    const [expandedSymbol, setExpandedSymbol] = useState(null);
    const [quickAnalysis, setQuickAnalysis] = useState(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);

    const toggleExpand = async (symbol) => {
        if (expandedSymbol === symbol) {
            setExpandedSymbol(null);
            setQuickAnalysis(null);
            return;
        }

        setExpandedSymbol(symbol);
        setAnalysisLoading(true);
        setQuickAnalysis(null);

        try {
            const res = await fetch(`${apiBase}/api/crypto/bot-analysis?symbol=${symbol}`);
            if (res.ok) {
                const data = await res.json();
                setQuickAnalysis(data);
            }
        } catch (error) {
            console.error("Error fetching quick analysis:", error);
        } finally {
            setAnalysisLoading(false);
        }
    };

    const runScan = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${apiBase}/api/crypto/scanner`);
            if (res.ok) {
                const data = await res.json();
                setScanResults(data.scan_results || []);
                setLastScan(new Date());
            }
        } catch (error) {
            console.error("Scanner error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        runScan();
        // Auto-refresh every 60 seconds
        const interval = setInterval(runScan, 60000);
        return () => clearInterval(interval);
    }, [apiBase]);

    return (
        <div className="crypto-card" style={{ marginTop: '20px' }}>
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Activity size={20} className="text-blue-500" />
                    Market Scanner (15m Timeframe)
                </div>
                <button
                    onClick={runScan}
                    disabled={loading}
                    className="toggle-btn"
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                    <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    {loading ? 'Scanning...' : 'Scan Now'}
                </button>
            </div>

            <div className="scanner-table-container" style={{ overflowX: 'auto', overflowY: 'auto', marginTop: '15px', maxHeight: '600px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ color: '#6b7280', borderBottom: '1px solid #374151' }}>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Symbol</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Price</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Volume 24h</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Signal</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Strength</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>RSI</th>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Top Reason</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scanResults.map((item, idx) => {
                            const isLong = item.direction === 'LONG';
                            const isShort = item.direction === 'SHORT';
                            const strengthColor = item.strength >= 80 ? '#22c55e' : item.strength >= 60 ? '#eab308' : '#6b7280';

                            return (
                                <React.Fragment key={idx}>
                                    <tr style={{ borderBottom: expandedSymbol === item.symbol ? 'none' : '1px solid #1f2937', background: item.strength >= 70 ? 'rgba(34, 197, 94, 0.05)' : 'transparent' }}>
                                        <td
                                            onClick={() => toggleExpand(item.symbol)}
                                            style={{ padding: '10px', fontWeight: 'bold', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            {expandedSymbol === item.symbol ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            {item.display}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'right', color: '#e5e7eb' }}>
                                            {item.display && item.display.includes('USDT') ? '$' : '€'}{item.price.toFixed(4)}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>
                                            {(() => {
                                                const vol = item.volume24h || 0;
                                                const MIN_VOLUME = 500_000;
                                                const volumeColor = vol >= MIN_VOLUME * 2 ? '#22c55e' : vol >= MIN_VOLUME ? '#eab308' : '#ef4444';

                                                const currency = item.display && item.display.includes('USDT') ? '$' : '€';

                                                let formatted = '';
                                                if (vol >= 1_000_000) {
                                                    formatted = `${currency}${(vol / 1_000_000).toFixed(1)}M`;
                                                } else if (vol >= 1_000) {
                                                    formatted = `${currency}${(vol / 1_000).toFixed(0)}K`;
                                                } else {
                                                    formatted = `${currency}${vol.toFixed(0)}`;
                                                }

                                                return (
                                                    <span style={{ color: volumeColor, fontWeight: '500', fontSize: '0.85rem' }}>
                                                        {formatted}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold',
                                                background: isLong ? 'rgba(34, 197, 94, 0.2)' : isShort ? 'rgba(239, 68, 68, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                                                color: isLong ? '#4ade80' : isShort ? '#f87171' : '#9ca3af'
                                            }}>
                                                {item.direction}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                                                <div style={{ width: '40px', height: '6px', background: '#374151', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${item.strength}%`, height: '100%', background: strengthColor }} />
                                                </div>
                                                <span style={{ color: strengthColor, fontWeight: 'bold' }}>{item.strength}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                            {(() => {
                                                const rsi = item.rsi;
                                                if (!rsi) return <span style={{ color: '#6b7280' }}>N/A</span>;
                                                
                                                // ✅ DEEP ANALYSIS RSI: Mostra direzione long/short basata su RSI
                                                // RSI < 30: Oversold (bullish per LONG) - Verde
                                                // RSI > 70: Overbought (bearish per SHORT) - Rosso
                                                // RSI 30-70: Neutro - Grigio
                                                // Per SHORT: RSI alto (>70) è positivo, RSI basso (<30) è negativo
                                                // Per LONG: RSI basso (<30) è positivo, RSI alto (>70) è negativo
                                                
                                                let rsiColor = '#9ca3af'; // Neutro
                                                let rsiDirection = '';
                                                let rsiTooltip = `RSI: ${rsi.toFixed(1)}`;
                                                
                                                if (item.direction === 'SHORT') {
                                                    // Per SHORT: RSI alto è positivo (overbought = opportunità short)
                                                    if (rsi > 70) {
                                                        rsiColor = '#f87171'; // Rosso = Overbought = Buono per SHORT
                                                        rsiDirection = '↓';
                                                        rsiTooltip += ' (Overbought - Buono per SHORT)';
                                                    } else if (rsi < 30) {
                                                        rsiColor = '#4ade80'; // Verde = Oversold = Cattivo per SHORT
                                                        rsiDirection = '↑';
                                                        rsiTooltip += ' (Oversold - Cattivo per SHORT)';
                                                    } else {
                                                        rsiColor = '#eab308'; // Giallo = Neutro
                                                        rsiTooltip += ' (Neutro)';
                                                    }
                                                } else if (item.direction === 'LONG') {
                                                    // Per LONG: RSI basso è positivo (oversold = opportunità long)
                                                    if (rsi < 30) {
                                                        rsiColor = '#4ade80'; // Verde = Oversold = Buono per LONG
                                                        rsiDirection = '↑';
                                                        rsiTooltip += ' (Oversold - Buono per LONG)';
                                                    } else if (rsi > 70) {
                                                        rsiColor = '#f87171'; // Rosso = Overbought = Cattivo per LONG
                                                        rsiDirection = '↓';
                                                        rsiTooltip += ' (Overbought - Cattivo per LONG)';
                                                    } else {
                                                        rsiColor = '#eab308'; // Giallo = Neutro
                                                        rsiTooltip += ' (Neutro)';
                                                    }
                                                } else {
                                                    // NEUTRAL: Mostra colore standard basato su RSI
                                                    if (rsi < 30) {
                                                        rsiColor = '#4ade80';
                                                        rsiTooltip += ' (Oversold)';
                                                    } else if (rsi > 70) {
                                                        rsiColor = '#f87171';
                                                        rsiTooltip += ' (Overbought)';
                                                    }
                                                }
                                                
                                                return (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }} title={rsiTooltip}>
                                                        <span style={{ color: rsiColor, fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                            {rsi.toFixed(1)}
                                                        </span>
                                                        {rsiDirection && (
                                                            <span style={{ color: rsiColor, fontSize: '0.8rem' }}>
                                                                {rsiDirection}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ padding: '10px', color: '#9ca3af', fontSize: '0.8rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {item.reasons[0] || '-'}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => onSelectSymbol(item.symbol)}
                                                    style={{
                                                        background: '#3b82f6',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        padding: '4px 8px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem'
                                                    }}
                                                    title="View Chart"
                                                >
                                                    <BarChart2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const url = new URL(window.location);
                                                        url.searchParams.set('domain', 'crypto');
                                                        url.searchParams.set('page', 'bot-analysis');
                                                        url.searchParams.set('symbol', item.symbol);
                                                        url.searchParams.set('_v', Date.now());
                                                        window.open(url.toString(), 'BotAnalysis', 'width=1200,height=800,resizable=yes,scrollbars=yes');
                                                    }}
                                                    style={{
                                                        background: '#10b981',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        padding: '4px 8px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem'
                                                    }}
                                                    title="Deep Analysis - Nuova Versione"
                                                >
                                                    🔍
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {
                                        expandedSymbol === item.symbol && (
                                            <tr style={{ background: '#1c1c1e', borderBottom: '1px solid #374151' }}>
                                                <td colSpan="8" style={{ padding: '15px' }}>
                                                    {analysisLoading ? (
                                                        <div style={{ color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <RefreshCw className="spin" size={16} /> Caricamento analisi rapida...
                                                        </div>
                                                    ) : quickAnalysis ? (
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                                            {/* LONG COLUMN */}
                                                            <div style={{ padding: '10px', background: 'rgba(34, 197, 94, 0.05)', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.1)' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                                    <h4 style={{ margin: 0, color: '#4ade80', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <TrendingUp size={16} /> LONG
                                                                    </h4>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: quickAnalysis?.requirements?.long?.canOpen ? '#4ade80' : '#9ca3af' }}>
                                                                        {quickAnalysis?.requirements?.long?.canOpen ? 'READY' : 'WAITING'}
                                                                    </span>
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#9ca3af' }}>Strength:</span>
                                                                        <span style={{ color: '#fff' }}>
                                                                            {quickAnalysis?.requirements?.long?.currentStrength || 0} <span style={{ color: '#6b7280' }}>/ {quickAnalysis?.requirements?.long?.minStrength || 0}</span>
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#9ca3af' }}>Confirms:</span>
                                                                        <span style={{ color: '#fff' }}>
                                                                            {quickAnalysis?.requirements?.long?.currentConfirmations || 0} <span style={{ color: '#6b7280' }}>/ {quickAnalysis?.requirements?.long?.minConfirmations || 0}</span>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                {quickAnalysis?.blockers?.long?.length > 0 && (
                                                                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                                                        <div style={{ color: '#f87171', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                                                            <Lock size={12} /> Blockers:
                                                                        </div>
                                                                        <ul style={{ margin: 0, paddingLeft: '15px', color: '#fca5a5', fontSize: '0.8rem' }}>
                                                                            {quickAnalysis.blockers.long.map((b, i) => (
                                                                                <li key={i}>{b.type}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* SHORT COLUMN */}
                                                            <div style={{ padding: '10px', background: 'rgba(248, 113, 113, 0.05)', borderRadius: '6px', border: '1px solid rgba(248, 113, 113, 0.1)' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                                    <h4 style={{ margin: 0, color: '#f87171', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <TrendingDown size={16} /> SHORT
                                                                    </h4>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: quickAnalysis?.requirements?.short?.canOpen ? '#f87171' : '#9ca3af' }}>
                                                                        {quickAnalysis?.requirements?.short?.canOpen ? 'READY' : 'WAITING'}
                                                                    </span>
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#9ca3af' }}>Strength:</span>
                                                                        <span style={{ color: '#fff' }}>
                                                                            {quickAnalysis?.requirements?.short?.currentStrength || 0} <span style={{ color: '#6b7280' }}>/ {quickAnalysis?.requirements?.short?.minStrength || 0}</span>
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#9ca3af' }}>Confirms:</span>
                                                                        <span style={{ color: '#fff' }}>
                                                                            {quickAnalysis?.requirements?.short?.currentConfirmations || 0} <span style={{ color: '#6b7280' }}>/ {quickAnalysis?.requirements?.short?.minConfirmations || 0}</span>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                {quickAnalysis?.blockers?.short?.length > 0 && (
                                                                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                                                        <div style={{ color: '#f87171', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                                                            <Lock size={12} /> Blockers:
                                                                        </div>
                                                                        <ul style={{ margin: 0, paddingLeft: '15px', color: '#fca5a5', fontSize: '0.8rem' }}>
                                                                            {quickAnalysis.blockers.short.map((b, i) => (
                                                                                <li key={i}>{b.type}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: '#ef4444' }}>Errore caricamento dati analisi.</div>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    }
                                </React.Fragment>
                            );
                        })}
                        {
                            scanResults.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                                        No data available. Click Scan Now.
                                    </td>
                                </tr>
                            )
                        }
                    </tbody>
                </table>
            </div>
            {
                lastScan && (
                    <div style={{ textAlign: 'right', marginTop: '10px', fontSize: '0.75rem', color: '#6b7280' }}>
                        Last scan: {lastScan.toLocaleTimeString()}
                    </div>
                )
            }
        </div>
    );
};

export default MarketScanner;
