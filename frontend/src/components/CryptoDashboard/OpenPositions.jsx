import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, AlertCircle, BarChart2 } from 'lucide-react';
import { formatPrice, formatPriceWithSymbol, formatVolume } from '../../utils/priceFormatter';

const OpenPositions = ({ positions, currentPrice, currentSymbol, allSymbolPrices = {}, onClosePosition, onUpdatePnL, availableSymbols = [], onSelectSymbol, apiBase }) => {
    const [isUpdating, setIsUpdating] = useState(false);

    // Update P&L periodically (more frequently for instant updates)
    useEffect(() => {
        const interval = setInterval(() => {
            if (onUpdatePnL) {
                setIsUpdating(true);
                onUpdatePnL().finally(() => setIsUpdating(false));
            }
        }, 2000); // Update every 2 seconds for instant feedback

        return () => clearInterval(interval);
    }, [onUpdatePnL]);

    if (!positions || positions.length === 0) {
        return (
            <div className="open-positions-container" style={{
                background: '#1a1a1a',
                borderRadius: '8px',
                padding: '20px',
                color: '#9ca3af',
                textAlign: 'center'
            }}>
                <p>Nessuna posizione aperta</p>
            </div>
        );
    }

    const totalPnL = positions.reduce((sum, pos) => sum + (parseFloat(pos.profit_loss) || 0), 0);
    const totalPnLPercent = positions.length > 0
        ? positions.reduce((sum, pos) => sum + (parseFloat(pos.profit_loss_pct) || 0), 0) / positions.length
        : 0;

    return (
        <div className="open-positions-container" style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '16px',
            color: '#fff'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid #2d2d2d'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Posizioni Aperte</h3>
                    <span style={{
                        background: '#2d2d2d',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#9ca3af'
                    }}>
                        {positions.length}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>P&L Totale</div>
                        <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: totalPnL >= 0 ? '#10b981' : '#ef4444'
                        }}>
                            {totalPnL >= 0 ? '+' : ''}${(totalPnL || 0).toFixed(2)}
                        </div>
                    </div>
                    {isUpdating && (
                        <div style={{ fontSize: '10px', color: '#6b7280' }}>Aggiornamento...</div>
                    )}
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #2d2d2d', color: '#9ca3af' }}>
                            <th style={{ padding: '8px', textAlign: 'center', fontWeight: '500', fontSize: '11px' }}>Azioni</th>
                            <th style={{ padding: '8px', textAlign: 'left', fontWeight: '500', fontSize: '11px' }}>Simbolo</th>
                            <th style={{ padding: '8px', textAlign: 'left', fontWeight: '500', fontSize: '11px' }}>Tipo</th>
                            <th style={{ padding: '8px', textAlign: 'right', fontWeight: '500', fontSize: '11px' }}>Volume</th>
                            <th style={{ padding: '8px', textAlign: 'right', fontWeight: '500', fontSize: '11px' }}>Investito</th>
                            <th style={{ padding: '8px', textAlign: 'right', fontWeight: '500', fontSize: '11px' }}>Entry</th>
                            <th style={{ padding: '8px', textAlign: 'right', fontWeight: '500', fontSize: '11px' }}>Prezzo</th>
                            <th style={{ padding: '8px', textAlign: 'right', fontWeight: '500', fontSize: '11px' }}>S/L</th>
                            <th style={{ padding: '8px', textAlign: 'right', fontWeight: '500', fontSize: '11px' }}>T/P</th>
                            <th style={{ padding: '8px', textAlign: 'right', fontWeight: '500', fontSize: '11px' }}>P&L</th>
                            <th style={{ padding: '8px', textAlign: 'right', fontWeight: '500', fontSize: '11px' }}>P&L %</th>
                            <th style={{ padding: '8px', textAlign: 'center', fontWeight: '500', fontSize: '11px' }}>Sentimento Bot</th>
                            <th style={{ padding: '8px', textAlign: 'center', fontWeight: '500', fontSize: '11px' }}>Azione</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.map((pos) => {
                            // ✅ FIX: Controlli null/undefined per prevenire errori toFixed()
                            const pnl = parseFloat(pos.profit_loss) || 0;
                            const pnlPct = parseFloat(pos.profit_loss_pct) || 0;
                            const isLong = pos.type === 'buy';
                            // ✅ FIX: Usa valori dal database, non fallback a 0 se sono null/undefined
                            // Per simboli con prezzi molto piccoli (es. SHIB), i valori potrebbero essere molto piccoli ma validi
                            const entryPrice = pos.entry_price != null ? parseFloat(pos.entry_price) : 0;
                            const currentPriceValue = pos.current_price != null ? parseFloat(pos.current_price) : (currentPrice ? parseFloat(currentPrice) : 0);
                            const volume = parseFloat(pos.volume) || 0;
                            const stopLoss = pos.stop_loss != null ? parseFloat(pos.stop_loss) : null;
                            const takeProfit = pos.take_profit != null ? parseFloat(pos.take_profit) : null;

                            return (
                                <tr
                                    key={pos.ticket_id}
                                    style={{
                                        borderBottom: '1px solid #2d2d2d',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#252525'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                                            <button
                                                onClick={() => onSelectSymbol && onSelectSymbol(pos.symbol)}
                                                style={{
                                                    background: '#3b82f6',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    padding: '4px 8px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    transition: 'opacity 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                                                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                                title="View Chart"
                                            >
                                                <BarChart2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const url = new URL(window.location);
                                                    url.searchParams.set('domain', 'crypto');
                                                    url.searchParams.set('page', 'bot-analysis');
                                                    url.searchParams.set('symbol', pos.symbol);
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
                                                    fontSize: '0.75rem',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    transition: 'opacity 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                                                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                                title="Deep Analysis"
                                            >
                                                🔍
                                            </button>
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px 8px', fontWeight: '600' }}>
                                        {(() => {
                                            // Cerca il simbolo in availableSymbols per ottenere il display corretto
                                            const symbolInfo = availableSymbols.find(s => s.symbol === pos.symbol);
                                            if (symbolInfo && symbolInfo.display) {
                                                return symbolInfo.display;
                                            }
                                            // Fallback: formatta manualmente se non trovato
                                            if (pos.symbol && pos.symbol.includes('_usdt')) {
                                                const baseSymbol = pos.symbol.replace('_usdt', '').toUpperCase();
                                                return `${baseSymbol}/USDT`;
                                            } else if (pos.symbol && pos.symbol.includes('_eur')) {
                                                const baseSymbol = pos.symbol.replace('_eur', '').toUpperCase();
                                                return `${baseSymbol}/USDT`;
                                            }
                                            // Fallback finale: uppercase semplice
                                            return (pos.symbol || '').toUpperCase().replace(/_/g, '/');
                                        })()}
                                    </td>
                                    <td style={{ padding: '10px 8px' }}>
                                        <div style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            background: isLong ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: isLong ? '#10b981' : '#ef4444',
                                            fontSize: '11px',
                                            fontWeight: '600'
                                        }}>
                                            {isLong ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            {isLong ? 'BUY' : 'SELL'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace' }}>
                                        {formatVolume(volume || 0)}
                                    </td>
                                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', color: '#fbbf24' }}>
                                        ${((entryPrice || 0) * (volume || 0)).toFixed(2)}
                                    </td>
                                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#9ca3af' }}>
                                        {entryPrice > 0 ? (
                                            <>
                                                <span title="Prezzo in USDT">
                                                    {formatPriceWithSymbol(entryPrice)}
                                                </span>
                                            </>
                                        ) : (
                                            <span style={{ color: '#ef4444' }} title="Prezzo non disponibile">$0.00</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '600' }}>
                                        {currentPriceValue > 0 ? (
                                            formatPriceWithSymbol(currentPriceValue)
                                        ) : (
                                            <span style={{ color: '#ef4444' }}>$0.00</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#ef4444' }}>
                                        {stopLoss != null && stopLoss > 0 ? (
                                            formatPriceWithSymbol(stopLoss)
                                        ) : '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#10b981' }}>
                                        {takeProfit != null && takeProfit > 0 ? (
                                            formatPriceWithSymbol(takeProfit)
                                        ) : '-'}
                                    </td>
                                    <td style={{
                                        padding: '10px 8px',
                                        textAlign: 'right',
                                        fontFamily: 'monospace',
                                        fontWeight: '600',
                                        color: pnl >= 0 ? '#10b981' : '#ef4444'
                                    }}>
                                        {pnl >= 0 ? '+' : ''}${(pnl || 0).toFixed(2)}
                                    </td>
                                    <td style={{
                                        padding: '10px 8px',
                                        textAlign: 'right',
                                        fontFamily: 'monospace',
                                        fontWeight: '600',
                                        color: pnlPct >= 0 ? '#10b981' : '#ef4444'
                                    }}>
                                        {pnlPct >= 0 ? '+' : ''}{(pnlPct || 0).toFixed(2)}%
                                    </td>
                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                        {(() => {
                                            const sentiment = pos.bot_sentiment;
                                            if (!sentiment || sentiment.sentiment === 'NEUTRAL') {
                                                return (
                                                    <div style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        background: '#2d2d2d',
                                                        color: '#9ca3af',
                                                        fontSize: '11px',
                                                        fontWeight: '500'
                                                    }} title="Sentimento neutro">
                                                        ➡️ Neutro
                                                    </div>
                                                );
                                            }
                                            
                                            const isBullish = sentiment.sentiment === 'BULLISH';
                                            const isContrary = sentiment.is_contrary;
                                            const strength = sentiment.strength || 0;
                                            
                                            return (
                                                <div style={{
                                                    display: 'inline-flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '2px'
                                                }}>
                                                    <div style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        background: isContrary 
                                                            ? 'rgba(239, 68, 68, 0.2)' 
                                                            : isBullish 
                                                            ? 'rgba(16, 185, 129, 0.15)' 
                                                            : 'rgba(239, 68, 68, 0.15)',
                                                        color: isContrary 
                                                            ? '#ef4444' 
                                                            : isBullish 
                                                            ? '#10b981' 
                                                            : '#ef4444',
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        border: isContrary ? '1px solid #ef4444' : 'none'
                                                    }} title={isContrary 
                                                        ? `⚠️ ATTENZIONE: Sentimento contrario alla posizione! Bot prevede ${sentiment.direction === 'UP' ? 'rialzo' : 'ribasso'} ma posizione è ${isLong ? 'LONG' : 'SHORT'}` 
                                                        : `Bot prevede ${sentiment.direction === 'UP' ? 'rialzo' : 'ribasso'} (strength: ${strength}/100)`}>
                                                        {isContrary && <AlertCircle size={12} />}
                                                        {isBullish ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                        {sentiment.direction === 'UP' ? '↑ Su' : '↓ Giù'}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '9px',
                                                        color: '#6b7280',
                                                        fontWeight: '500'
                                                    }}>
                                                        {strength}/100
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                        <button
                                            onClick={() => {
                                                onClosePosition(pos.ticket_id);
                                            }}
                                            style={{
                                                background: '#ef4444',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '4px 8px',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                transition: 'opacity 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                        >
                                            <X size={14} color="#fff" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Summary Footer */}
            <div style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #2d2d2d',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                color: '#9ca3af'
            }}>
                <div>
                    Volume Totale: <span style={{ color: '#fff', fontWeight: '600' }}>
                        {(positions.reduce((sum, pos) => sum + (parseFloat(pos.volume) || 0), 0) || 0).toFixed(4)}
                    </span>
                </div>
                <div>
                    P&L Medio: <span style={{
                        color: totalPnLPercent >= 0 ? '#10b981' : '#ef4444',
                        fontWeight: '600'
                    }}>
                        {totalPnLPercent >= 0 ? '+' : ''}{(totalPnLPercent || 0).toFixed(2)}%
                    </span>
                </div>
            </div>
        </div>
    );
};

export default OpenPositions;
