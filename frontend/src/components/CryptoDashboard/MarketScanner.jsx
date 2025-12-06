import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle, Play, Activity, BarChart2 } from 'lucide-react';
import './CryptoLayout.css';

const MarketScanner = ({ apiBase, onSelectSymbol }) => {
    const [scanResults, setScanResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastScan, setLastScan] = useState(null);

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
                            const isNeutral = item.direction === 'NEUTRAL';
                            const strengthColor = item.strength >= 80 ? '#22c55e' : item.strength >= 60 ? '#eab308' : '#6b7280';

                            return (
                                <tr key={idx} style={{ borderBottom: '1px solid #1f2937', background: item.strength >= 70 ? 'rgba(34, 197, 94, 0.05)' : 'transparent' }}>
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#fff' }}>
                                        {item.display}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right', color: '#e5e7eb' }}>
                                        €{item.price.toFixed(4)}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>
                                        {(() => {
                                            const vol = item.volume24h || 0;
                                            const MIN_VOLUME = 500_000;
                                            const volumeColor = vol >= MIN_VOLUME * 2 ? '#22c55e' : vol >= MIN_VOLUME ? '#eab308' : '#ef4444';

                                            let formatted = '';
                                            if (vol >= 1_000_000) {
                                                formatted = `€${(vol / 1_000_000).toFixed(1)}M`;
                                            } else if (vol >= 1_000) {
                                                formatted = `€${(vol / 1_000).toFixed(0)}K`;
                                            } else {
                                                formatted = `€${vol.toFixed(0)}`;
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
                                    <td style={{ padding: '10px', textAlign: 'center', color: item.rsi < 30 ? '#4ade80' : item.rsi > 70 ? '#f87171' : '#9ca3af' }}>
                                        {item.rsi?.toFixed(1)}
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
                                                    // ✅ FIX: Aggiungi timestamp per forzare reload della nuova versione
                                                    url.searchParams.set('_v', Date.now());
                                                    window.open(url.toString(), 'BotAnalysis', 'width=1200,height=800,resizable=yes,scrollbars=yes');
                                                }}
                                                style={{
                                                    background: '#8b5cf6',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    padding: '4px 8px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem'
                                                }}
                                                title="Deep Analysis"
                                            >
                                                🔍
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const url = new URL(window.location);
                                                    url.searchParams.set('domain', 'crypto');
                                                    url.searchParams.set('page', 'bot-analysis');
                                                    url.searchParams.set('symbol', item.symbol);
                                                    url.searchParams.set('_new', 'true');
                                                    url.searchParams.set('_v', Date.now());
                                                    url.searchParams.set('_cache', 'no');
                                                    window.open(url.toString(), 'BotAnalysisNew', 'width=1200,height=800,resizable=yes,scrollbars=yes');
                                                }}
                                                style={{
                                                    background: '#10b981',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    padding: '4px 8px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem',
                                                    marginLeft: '3px'
                                                }}
                                                title="NUOVA Analisi - Versione Aggiornata"
                                            >
                                                ✨ Nuova
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {scanResults.length === 0 && !loading && (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                                    No data available. Click Scan Now.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {lastScan && (
                <div style={{ textAlign: 'right', marginTop: '10px', fontSize: '0.75rem', color: '#6b7280' }}>
                    Last scan: {lastScan.toLocaleTimeString()}
                </div>
            )}
        </div>
    );
};

export default MarketScanner;
