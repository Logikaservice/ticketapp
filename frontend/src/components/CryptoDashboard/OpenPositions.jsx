import React, { useState, useEffect, useRef } from 'react';
import { X, TrendingUp, TrendingDown, AlertCircle, BarChart2, ChevronsDown, ExternalLink } from 'lucide-react';
import { formatPrice, formatPriceWithSymbol, formatVolume, formatSymbol, formatPnL } from '../../utils/priceFormatter';

// ✅ PERFORMANCE: React.memo previene re-render inutili quando props non cambiano
const OpenPositions = React.memo(({ positions, currentPrice, currentSymbol, allSymbolPrices = {}, onClosePosition, onUpdatePnL, availableSymbols = [], onSelectSymbol, apiBase }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [openMenuFor, setOpenMenuFor] = useState(null);
    const menuRefs = useRef({});

    // Debug: log posizioni ricevute (solo in sviluppo e solo quando cambia il numero)
    const prevCountRef = useRef(0);
    useEffect(() => {
        const currentCount = positions?.length || 0;
        // Log solo se il numero di posizioni cambia (non ad ogni render)
        if (currentCount !== prevCountRef.current) {
            if (process.env.NODE_ENV === 'development') {
                console.log(`📋 [OPEN POSITIONS] Ricevute ${currentCount} posizioni`);
                if (positions && positions.length > 0) {
                    positions.forEach((pos, idx) => {
                        console.log(`  ${idx + 1}. ${pos.symbol} - ${pos.type} - ${pos.status} - Ticket: ${pos.ticket_id}`);
                    });
                }
            }
            prevCountRef.current = currentCount;
        }
    }, [positions]);

    // Update P&L periodically (real-time updates)
    useEffect(() => {
        // ✅ PERFORMANCE FIX: Disabilitato auto-update per ridurre lag
        // L'utente può fare refresh manuale o aspettare il polling principale
        // const interval = setInterval(() => {
        //     if (onUpdatePnL) {
        //         setIsUpdating(true);
        //         onUpdatePnL().finally(() => setIsUpdating(false));
        //     }
        // }, 5000); // Rallentato a 5s per ridurre lag

        // return () => clearInterval(interval);
    }, [onUpdatePnL]);

    // Chiudi menu quando si clicca fuori
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (openMenuFor) {
                const menuElement = menuRefs.current[openMenuFor];
                if (menuElement && !menuElement.contains(event.target)) {
                    // Verifica se il click è sul pulsante che apre il menu
                    const button = event.target.closest('button');
                    if (!button || !button.querySelector('svg')) {
                        setOpenMenuFor(null);
                    }
                }
            }
        };

        if (openMenuFor) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [openMenuFor]);

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

    // ✅ REAL-TIME: Calcola P&L totale in tempo reale usando i prezzi aggiornati (INDIPENDENTE dal grafico)
    const calculateTotalPnL = () => {
        let total = 0;
        positions.forEach(pos => {
            const entryPrice = pos.entry_price != null ? parseFloat(pos.entry_price) : 0;
            const volume = parseFloat(pos.volume) || 0;
            const isLong = pos.type === 'buy';
            
            // ✅ CRITICO: Usa prezzo aggiornato da allSymbolPrices (aggiornato ogni 500ms per TUTTI i simboli)
            let currentPriceValue = 0;
            if (allSymbolPrices && allSymbolPrices[pos.symbol] && allSymbolPrices[pos.symbol] > 0) {
                currentPriceValue = parseFloat(allSymbolPrices[pos.symbol]);
            } else if (pos.symbol === currentSymbol && currentPrice) {
                currentPriceValue = parseFloat(currentPrice);
            } else if (pos.current_price != null) {
                currentPriceValue = parseFloat(pos.current_price);
            }
            
            if (entryPrice > 0 && currentPriceValue > 0 && volume > 0) {
                if (isLong) {
                    total += (currentPriceValue - entryPrice) * volume;
                } else {
                    total += (entryPrice - currentPriceValue) * volume;
                }
            } else {
                total += parseFloat(pos.profit_loss) || 0;
            }
        });
        return total;
    };
    
    const totalPnL = calculateTotalPnL();
    const totalPnLPercent = positions.length > 0
        ? positions.reduce((sum, pos) => {
            const entryPrice = pos.entry_price != null ? parseFloat(pos.entry_price) : 0;
            const volume = parseFloat(pos.volume) || 0;
            const isLong = pos.type === 'buy';
            
            // ✅ CRITICO: Usa prezzo aggiornato da allSymbolPrices (aggiornato ogni 500ms per TUTTI i simboli)
            let currentPriceValue = 0;
            if (allSymbolPrices && allSymbolPrices[pos.symbol] && allSymbolPrices[pos.symbol] > 0) {
                currentPriceValue = parseFloat(allSymbolPrices[pos.symbol]);
            } else if (pos.symbol === currentSymbol && currentPrice) {
                currentPriceValue = parseFloat(currentPrice);
            } else if (pos.current_price != null) {
                currentPriceValue = parseFloat(pos.current_price);
            }
            
            if (entryPrice > 0 && currentPriceValue > 0) {
                if (isLong) {
                    return sum + (((currentPriceValue - entryPrice) / entryPrice) * 100);
                } else {
                    return sum + (((entryPrice - currentPriceValue) / entryPrice) * 100);
                }
            } else {
                return sum + (parseFloat(pos.profit_loss_pct) || 0);
            }
        }, 0) / positions.length
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

            <div style={{ overflowX: 'auto', overflowY: 'visible', position: 'relative' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', position: 'relative' }}>
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
                            const isLong = pos.type === 'buy';
                            // ✅ FIX: Usa valori dal database, non fallback a 0 se sono null/undefined
                            // Per simboli con prezzi molto piccoli (es. SHIB), i valori potrebbero essere molto piccoli ma validi
                            const entryPrice = pos.entry_price != null ? parseFloat(pos.entry_price) : 0;
                            // ✅ REAL-TIME CRITICO: Prezzo corrente INDIPENDENTE dal grafico
                            // Priorità: 1) allSymbolPrices (aggiornato ogni 500ms per TUTTI i simboli), 2) currentPrice se stesso simbolo, 3) current_price dal DB
                            let currentPriceValue = 0;
                            if (allSymbolPrices && allSymbolPrices[pos.symbol] && allSymbolPrices[pos.symbol] > 0) {
                                // ✅ CRITICO: Usa allSymbolPrices che viene aggiornato ogni 500ms per TUTTI i simboli delle posizioni (indipendente dal grafico)
                                currentPriceValue = parseFloat(allSymbolPrices[pos.symbol]);
                            } else if (pos.symbol === currentSymbol && currentPrice && currentPrice > 0) {
                                // Ottimizzazione: se la posizione è per il simbolo corrente, usa il prezzo del grafico
                                currentPriceValue = parseFloat(currentPrice);
                            } else if (pos.current_price != null && parseFloat(pos.current_price) > 0) {
                                // Fallback al prezzo dal database
                                currentPriceValue = parseFloat(pos.current_price);
                            }
                            
                            const volume = parseFloat(pos.volume) || 0;
                            const stopLoss = pos.stop_loss != null ? parseFloat(pos.stop_loss) : null;
                            const takeProfit = pos.take_profit != null ? parseFloat(pos.take_profit) : null;
                            
                            // ✅ REAL-TIME: Calcola P&L in tempo reale usando il prezzo corrente aggiornato
                            let pnl = 0;
                            let pnlPct = 0;
                            
                            if (entryPrice > 0 && currentPriceValue > 0 && volume > 0) {
                                if (isLong) {
                                    // Long position: profit quando prezzo sale
                                    pnl = (currentPriceValue - entryPrice) * volume;
                                    pnlPct = ((currentPriceValue - entryPrice) / entryPrice) * 100;
                                } else {
                                    // Short position: profit quando prezzo scende
                                    pnl = (entryPrice - currentPriceValue) * volume;
                                    pnlPct = ((entryPrice - currentPriceValue) / entryPrice) * 100;
                                }
                            } else {
                                // Fallback ai valori dal database se non possiamo calcolare
                                pnl = parseFloat(pos.profit_loss) || 0;
                                pnlPct = parseFloat(pos.profit_loss_pct) || 0;
                            }

                            // Evidenziazione viola se il simbolo corrisponde a currentSymbol
                            const isSelected = pos.symbol === currentSymbol;
                            
                            return (
                                <tr
                                    key={pos.ticket_id}
                                    style={{
                                        borderBottom: '1px solid #2d2d2d',
                                        transition: 'background 0.2s',
                                        background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'transparent'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.background = '#252525';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.background = 'transparent';
                                        } else {
                                            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                                        }
                                    }}
                                >
                                    <td style={{ padding: '10px 8px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
                                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                                            {/* Menu dropdown per aprire grafico */}
                                            <div style={{ position: 'relative', display: 'inline-block', zIndex: 9999 }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuFor(openMenuFor === pos.ticket_id ? null : pos.ticket_id);
                                                    }}
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
                                                    title="Apri Grafico - Menu"
                                                >
                                                    <BarChart2 size={14} />
                                                    <ChevronsDown size={10} />
                                                </button>
                                                {openMenuFor === pos.ticket_id && (
                                                    <div
                                                        ref={el => {
                                                            menuRefs.current[pos.ticket_id] = el;
                                                            // Calcola posizione quando il menu viene aperto
                                                            if (el) {
                                                                const savedPos = menuRefs.current[`${pos.ticket_id}_pos`];
                                                                if (savedPos) {
                                                                    el.style.position = 'fixed';
                                                                    el.style.top = `${savedPos.top + 4}px`;
                                                                    el.style.left = `${savedPos.left}px`;
                                                                } else {
                                                                    // Fallback: trova il pulsante
                                                                    const button = menuRefs.current[`${pos.ticket_id}_btn`];
                                                                    if (button) {
                                                                        const buttonRect = button.getBoundingClientRect();
                                                                        el.style.position = 'fixed';
                                                                        el.style.top = `${buttonRect.bottom + 4}px`;
                                                                        el.style.left = `${buttonRect.right - 180}px`;
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                        style={{
                                                            position: 'fixed',
                                                            background: '#1f2937',
                                                            border: '1px solid #374151',
                                                            borderRadius: '6px',
                                                            padding: '4px',
                                                            zIndex: 99999,
                                                            minWidth: '180px',
                                                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (onSelectSymbol) onSelectSymbol(pos.symbol);
                                                                setOpenMenuFor(null);
                                                            }}
                                                            style={{
                                                                width: '100%',
                                                                background: 'transparent',
                                                                color: '#fff',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                padding: '8px 12px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.85rem',
                                                                textAlign: 'left',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                transition: 'background 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = '#374151'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <BarChart2 size={14} />
                                                            Nella stessa pagina
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const url = new URL(window.location);
                                                                url.searchParams.set('domain', 'crypto');
                                                                url.searchParams.set('page', 'chart-only');
                                                                url.searchParams.set('symbol', pos.symbol);
                                                                url.searchParams.set('_v', Date.now());
                                                                window.open(url.toString(), '_blank');
                                                                setOpenMenuFor(null);
                                                            }}
                                                            style={{
                                                                width: '100%',
                                                                background: 'transparent',
                                                                color: '#fff',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                padding: '8px 12px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.85rem',
                                                                textAlign: 'left',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                transition: 'background 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = '#374151'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <ExternalLink size={14} />
                                                            In nuova pagina
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
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
                                    <td 
                                        style={{ 
                                            padding: '10px 8px', 
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            userSelect: 'none'
                                        }}
                                        onClick={() => {
                                            if (onSelectSymbol) {
                                                onSelectSymbol(pos.symbol);
                                            }
                                        }}
                                        title="Clicca per evidenziare tutte le posizioni di questo simbolo"
                                    >
                                        {formatSymbol(pos.symbol, availableSymbols)}
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
                                        {formatPnL(pnl)}
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
                                                onClosePosition(pos.ticket_id, pos.symbol);
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
});

// ✅ PERFORMANCE: displayName per debug React DevTools
OpenPositions.displayName = 'OpenPositions';

export default OpenPositions;
