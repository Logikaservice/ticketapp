import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import './LightweightChart.css';

const LightweightChart = ({ symbol = 'BTCEUR', trades = [], currentPrice = 0, priceHistory = [], openPositions = [] }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const candlestickSeriesRef = useRef(null);
    const markersRef = useRef([]);
    const priceLinesRef = useRef([]); // Array per tenere traccia di tutte le price lines create
    const hasRestoredPositionRef = useRef(false); // Flag per evitare ripristino multiplo
    const savePositionTimeoutRef = useRef(null); // Timeout per debounce salvataggio posizione
    const lastCandleDataRef = useRef(null); // Memorizza l'ultima candela per aggiornarla con prezzo live
    const isUserScrolledRef = useRef(false); // Flag per sapere se l'utente ha scrollato manualmente

    // Initialize chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Create chart - use full container width
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#1c1c1e' },
                textColor: '#d1d5db',
            },
            grid: {
                vertLines: { color: '#2c2c2e' },
                horzLines: { color: '#2c2c2e' },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
            },
            width: chartContainerRef.current.clientWidth,
            height: 500,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#3f3f46',
            },
            rightPriceScale: {
                borderColor: '#3f3f46',
            },
        });

        chartRef.current = chart;

        // Create candlestick series
        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#4ade80',
            downColor: '#f87171',
            borderVisible: false,
            wickUpColor: '#4ade80',
            wickDownColor: '#f87171',
        });

        candlestickSeriesRef.current = candlestickSeries;

        // Restore saved chart position from localStorage - sarà fatto dopo caricamento dati
        // Non ripristinare qui, aspetta che i dati siano caricati

        // Save chart position when user scrolls/zooms - con più informazioni
        const saveChartPosition = () => {
            if (savePositionTimeoutRef.current) {
                clearTimeout(savePositionTimeoutRef.current);
            }
            savePositionTimeoutRef.current = setTimeout(() => {
                if (chartRef.current) {
                    try {
                        const visibleRange = chartRef.current.timeScale().getVisibleRange();
                        if (visibleRange && visibleRange.from && visibleRange.to) {
                            const positionData = {
                                from: visibleRange.from,
                                to: visibleRange.to,
                                timestamp: Date.now(), // Quando è stato salvato
                                symbol: symbol // Per sicurezza
                            };
                            localStorage.setItem(`chart_position_${symbol}`, JSON.stringify(positionData));
                        }
                    } catch (e) {
                        // Silent fail
                    }
                }
            }, 500); // Debounce: salva dopo 500ms di inattività
        };

        // Listen to timeScale changes (scroll/zoom)
        chart.timeScale().subscribeVisibleTimeRangeChange((newVisibleRange) => {
            // Rileva scroll manuale dell'utente
            isUserScrolledRef.current = true;
            saveChartPosition(newVisibleRange);
        });

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (savePositionTimeoutRef.current) {
                clearTimeout(savePositionTimeoutRef.current);
            }
            if (chartRef.current) {
                chartRef.current.remove();
            }
            hasRestoredPositionRef.current = false;
        };
    }, [symbol]);

    // Update chart data
    useEffect(() => {
        if (!candlestickSeriesRef.current) return;

        if (priceHistory.length === 0) {
            return;
        }

        // Check if we have OHLC candlesticks (from klines table) or price points
        const firstItem = priceHistory[0] || {};
        const hasOHLC = priceHistory.length > 0 && 
                       ('open' in firstItem) && 
                       ('high' in firstItem) && 
                       ('low' in firstItem) && 
                       ('close' in firstItem);
        
        if (hasOHLC) {
            // Use OHLC candlesticks directly (no grouping needed - already from Binance)
            const candlestickData = priceHistory
                .map((candle) => {
                    const time = typeof candle.time === 'number' ? candle.time : (candle.timestamp ? new Date(candle.timestamp).getTime() / 1000 : null);
                    const open = typeof candle.open === 'number' ? candle.open : parseFloat(candle.open);
                    const high = typeof candle.high === 'number' ? candle.high : parseFloat(candle.high);
                    const low = typeof candle.low === 'number' ? candle.low : parseFloat(candle.low);
                    const close = typeof candle.close === 'number' ? candle.close : parseFloat(candle.close);
                    
                    if (!time || isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) return null;
                    
                    return {
                        time: time,
                        open: open,
                        high: high,
                        low: low,
                        close: close
                    };
                })
                .filter(item => item !== null)
                .sort((a, b) => a.time - b.time);

            if (candlestickData.length > 0) {
                // Salva l'ultima candela per aggiornamenti live
                lastCandleDataRef.current = candlestickData[candlestickData.length - 1];
                
                candlestickSeriesRef.current.setData(candlestickData);
                
                // Restore saved position after data is loaded
                if (!hasRestoredPositionRef.current && chartRef.current) {
                    const restorePosition = (attempt = 0) => {
                        const savedPosition = localStorage.getItem(`chart_position_${symbol}`);
                        if (savedPosition && chartRef.current) {
                            try {
                                const { from, to } = JSON.parse(savedPosition);
                                const firstTime = candlestickData[0].time;
                                const lastTime = candlestickData[candlestickData.length - 1].time;
                                
                                if (from >= firstTime && to <= lastTime && from < to) {
                                    chartRef.current.timeScale().setVisibleRange({ from, to });
                                    hasRestoredPositionRef.current = true;
                                    isUserScrolledRef.current = true; // L'utente ha una posizione salvata, non auto-scrollare
                                } else if (attempt < 3) {
                                    setTimeout(() => restorePosition(attempt + 1), 500);
                                }
                            } catch (e) {
                                // Silent fail
                            }
                        } else if (attempt < 3) {
                            setTimeout(() => restorePosition(attempt + 1), 500);
                        } else {
                            // Nessuna posizione salvata - auto-scroll alla fine
                            isUserScrolledRef.current = false;
                        }
                    };
                    setTimeout(() => restorePosition(0), 300);
                } else if (!hasRestoredPositionRef.current) {
                    // Nessuna posizione salvata - auto-scroll alla fine
                    isUserScrolledRef.current = false;
                }
                
                // Auto-scroll alla fine se l'utente non ha scrollato manualmente
                if (!isUserScrolledRef.current && chartRef.current && candlestickData.length > 0) {
                    setTimeout(() => {
                        try {
                            const lastTime = candlestickData[candlestickData.length - 1].time;
                            const visibleRange = chartRef.current.timeScale().getVisibleRange();
                            if (visibleRange) {
                                // Scroll solo se siamo vicini alla fine (ultimi 10% del grafico)
                                const timeRange = lastTime - candlestickData[0].time;
                                const scrollThreshold = lastTime - (timeRange * 0.1);
                                
                                if (!visibleRange.to || visibleRange.to >= scrollThreshold) {
                                    // Auto-scroll alla fine per mostrare il prezzo corrente
                                    const windowDuration = visibleRange.to - visibleRange.from;
                                    chartRef.current.timeScale().setVisibleRange({
                                        from: lastTime - windowDuration,
                                        to: lastTime
                                    });
                                }
                            }
                        } catch (e) {
                            // Silent fail
                        }
                    }, 100);
                }
                
                return;
            }
        }
        
        // Fallback: Convert price points to candlesticks (backward compatibility)
        const validData = priceHistory
            .map((point) => {
                const price = typeof point.price === 'number' ? point.price : parseFloat(point.price);
                const timestamp = point.timestamp || point.time;
                const time = timestamp ? (typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime() / 1000) : null;
                
                if (isNaN(price) || !time) return null;
                
                return { time, price };
            })
            .filter(item => item !== null)
            .sort((a, b) => a.time - b.time);

        if (validData.length === 0) {
            return;
        }

        // Use line chart for price points (fallback)
        const lineData = validData.map(point => ({
            time: point.time,
            value: point.price
        }));
        candlestickSeriesRef.current.setData(lineData);
        
        // Restore saved position
        if (!hasRestoredPositionRef.current && chartRef.current) {
            const restorePosition = (attempt = 0) => {
                const savedPosition = localStorage.getItem(`chart_position_${symbol}`);
                if (savedPosition && chartRef.current) {
                    try {
                        const { from, to } = JSON.parse(savedPosition);
                        const firstTime = lineData[0]?.time;
                        const lastTime = lineData[lineData.length - 1]?.time;
                        
                        if (firstTime && lastTime && from >= firstTime && to <= lastTime && from < to) {
                            chartRef.current.timeScale().setVisibleRange({ from, to });
                            hasRestoredPositionRef.current = true;
                        } else if (attempt < 3) {
                            setTimeout(() => restorePosition(attempt + 1), 500);
                        }
                    } catch (e) {
                        // Silent fail
                    }
                } else if (attempt < 3) {
                    setTimeout(() => restorePosition(attempt + 1), 500);
                }
            };
            setTimeout(() => restorePosition(0), 300);
        }
    }, [priceHistory]);

    // Add markers for trades - SOLO QUELLI CON POSIZIONI APERTE
    useEffect(() => {
        if (!candlestickSeriesRef.current) return;

        // Clear previous markers
        markersRef.current = [];

        // Filtra SOLO trades con posizioni APERTE
        const openTrades = trades.filter(trade => {
            if (!openPositions || openPositions.length === 0) return false;
            if (!trade.ticket_id) return false;
            
            // Confronta ticket_id come stringhe
            const tradeTicketId = String(trade.ticket_id);
            return openPositions.some(
                pos => String(pos.ticket_id) === tradeTicketId && pos.status === 'open'
            );
        });

        if (openTrades.length > 0) {
            // Ordina trades per timestamp
            const sortedTrades = [...openTrades].sort((a, b) => 
                new Date(a.timestamp) - new Date(b.timestamp)
            );

            // Crea un map per tracciare i numeri identificativi
            const tradeIdMap = new Map();
            let nextId = 1;

            // Assegna numeri identificativi sequenziali
            sortedTrades.forEach((trade) => {
                const uniqueKey = trade.ticket_id ? `ticket-${trade.ticket_id}` : `trade-${trade.timestamp}`;
                if (!tradeIdMap.has(uniqueKey)) {
                    tradeIdMap.set(uniqueKey, nextId++);
                }
            });

            // Crea marker SOLO per trades con posizioni aperte
            const markers = sortedTrades.map((trade, index) => {
                const tradeTime = new Date(trade.timestamp).getTime() / 1000;
                const uniqueKey = trade.ticket_id ? `ticket-${trade.ticket_id}` : `trade-${trade.timestamp}`;
                const markerId = tradeIdMap.get(uniqueKey) || (index + 1);

                return {
                    time: tradeTime,
                    position: trade.type === 'buy' ? 'belowBar' : 'aboveBar',
                    color: trade.type === 'buy' ? '#4ade80' : '#f87171',
                    shape: trade.type === 'buy' ? 'arrowUp' : 'arrowDown',
                    text: `${markerId}`,
                    size: 2,
                    id: `marker-${trade.ticket_id || trade.timestamp}-${trade.type}-${index}`,
                };
            });

            markersRef.current = markers;
            candlestickSeriesRef.current.setMarkers(markers);
            
        } else {
            // Clear markers if no open trades
            candlestickSeriesRef.current.setMarkers([]);
        }
    }, [trades, openPositions]);

    // Update last candle with live price (real-time candlestick update) - FORZATO OGNI 500ms
    useEffect(() => {
        if (!candlestickSeriesRef.current || !currentPrice || !lastCandleDataRef.current || priceHistory.length === 0) {
            return;
        }

        // Aggiorna immediatamente
        const updateCandle = () => {
            if (!candlestickSeriesRef.current || !currentPrice || !lastCandleDataRef.current) return;
            
            try {
                const lastCandle = lastCandleDataRef.current;
                
                // Crea nuova candela live con prezzo corrente
                const liveCandle = {
                    time: lastCandle.time,
                    open: lastCandle.open,
                    high: Math.max(lastCandle.high, currentPrice),
                    low: Math.min(lastCandle.low, currentPrice),
                    close: currentPrice // Update close with current price
                };

                // FORZA l'aggiornamento - usa updateData per efficienza
                candlestickSeriesRef.current.updateData(liveCandle);
                lastCandleDataRef.current = liveCandle;
            } catch (e) {
                console.error('Error updating live candle:', e);
            }
        };

        // Aggiorna subito
        updateCandle();

        // E poi ogni 500ms per movimento molto fluido e visibile
        const interval = setInterval(updateCandle, 500);

        return () => clearInterval(interval);
    }, [currentPrice, priceHistory.length]);

    // Update price lines: current price (blue) + entry lines for open BUY positions
    useEffect(() => {
        if (!candlestickSeriesRef.current || !currentPrice || priceHistory.length === 0) {
            // Rimuovi tutte le price lines se non ci sono dati
            if (priceLinesRef.current.length > 0) {
                priceLinesRef.current.forEach(priceLine => {
                    try {
                        candlestickSeriesRef.current?.removePriceLine(priceLine);
                    } catch (e) {
                        // Silent fail
                    }
                });
                priceLinesRef.current = [];
            }
            return;
        }

        // Rimuovi tutte le price lines precedenti
        priceLinesRef.current.forEach(priceLine => {
            try {
                candlestickSeriesRef.current?.removePriceLine(priceLine);
            } catch (e) {
                // Silent fail
            }
        });
        priceLinesRef.current = [];

        // Crea price line per il prezzo corrente (linea blu)
        try {
            const currentPriceLine = candlestickSeriesRef.current.createPriceLine({
                price: currentPrice,
                color: '#3b82f6',
                lineWidth: 2,
                lineStyle: 2, // Dashed
                axisLabelVisible: true,
                title: `€${currentPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            });
            priceLinesRef.current.push(currentPriceLine);
        } catch (e) {
            // Silent fail
        }

        // Aggiungi linee di entry per le posizioni BUY e SELL aperte
        if (openPositions && openPositions.length > 0) {
            openPositions.forEach((pos) => {
                if (pos.status === 'open' && pos.entry_price) {
                    try {
                        const entryPrice = parseFloat(pos.entry_price);
                        const isBuy = pos.type === 'buy';
                        const entryLine = candlestickSeriesRef.current.createPriceLine({
                            price: entryPrice,
                            color: isBuy ? '#4ade80' : '#f87171', // Verde per BUY, rosso per SELL
                            lineWidth: 1,
                            lineStyle: 0, // Solid
                            axisLabelVisible: true,
                            title: `Entry ${isBuy ? 'BUY' : 'SELL'}: €${entryPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        });
                        priceLinesRef.current.push(entryLine);
                    } catch (e) {
                        // Silent fail
                    }
                }
            });
        }
    }, [currentPrice, priceHistory.length, openPositions]);

    return (
        <div className="lightweight-chart-container">
            <div className="chart-main-wrapper">
                {/* Chart Container - Always render to allow initialization */}
                <div ref={chartContainerRef} className="lightweight-chart-wrapper">
                    {priceHistory.length === 0 && (
                        <div className="chart-loading-overlay">
                            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                                <div style={{ fontSize: '1.2rem', marginBottom: '10px' }}>📊 Caricamento dati storici...</div>
                                <div style={{ fontSize: '0.9rem' }}>Il grafico si popolerà automaticamente con i dati storici di Binance</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Trades Legend - A DESTRA del grafico - SEMPRE VISIBILE */}
                <div className="trades-legend-right">
                    <div className="legend-header">
                        <h4>🤖 Operazioni Bot</h4>
                        <span className="trade-count">
                            {trades.filter(trade => {
                                if (!openPositions || openPositions.length === 0) return false;
                                if (!trade.ticket_id) return false;
                                
                                // Confronta ticket_id come stringhe per evitare problemi di tipo
                                const tradeTicketId = String(trade.ticket_id);
                                return openPositions.some(
                                    pos => String(pos.ticket_id) === tradeTicketId && pos.status === 'open'
                                );
                            }).length} operazioni aperte
                        </span>
                    </div>
                    {(() => {
                        const openTrades = trades.filter(trade => {
                            if (!openPositions || openPositions.length === 0) return false;
                            if (!trade.ticket_id) return false;
                            
                            // Confronta ticket_id come stringhe per evitare problemi di tipo
                            const tradeTicketId = String(trade.ticket_id);
                            return openPositions.some(
                                pos => String(pos.ticket_id) === tradeTicketId && pos.status === 'open'
                            );
                        });
                        
                        return openTrades.length > 0 ? (
                        <div className="trades-list-vertical">
                            {openTrades
                                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Più recenti in alto
                                .map((trade, index) => (
                                <div 
                                    key={index} 
                                    className={`trade-badge ${trade.type}`}
                                    title={`${trade.strategy || 'Bot'} - ${new Date(trade.timestamp).toLocaleString('it-IT')}`}
                                >
                                    <span className="trade-icon">{trade.type === 'buy' ? '↑' : '↓'}</span>
                                    <div className="trade-details">
                                        <div className="trade-row">
                                            <span className="trade-type">{trade.type.toUpperCase()}</span>
                                            <span className="trade-price">
                                                €{parseFloat(trade.price).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="trade-row">
                                            <span className="trade-amount">{parseFloat(trade.amount).toFixed(4)} BTC</span>
                                            <span className="trade-time">
                                                {new Date(trade.timestamp).toLocaleTimeString('it-IT', { 
                                                    hour: '2-digit', 
                                                    minute: '2-digit',
                                                    day: '2-digit',
                                                    month: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
                            Nessuna operazione recente
                        </div>
                    );
                    })()}
                </div>
            </div>

            {/* Chart Legend */}
            <div style={{
                padding: '12px 16px',
                background: '#27272a',
                borderTop: '1px solid #3f3f46',
                fontSize: '11px',
                color: '#9ca3af',
                display: 'flex',
                gap: '20px',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                        width: '20px',
                        height: '2px',
                        background: '#3b82f6',
                        borderStyle: 'dashed',
                        borderWidth: '1px',
                        borderColor: '#3b82f6'
                    }}></div>
                    <span>Prezzo Corrente</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                        width: '12px',
                        height: '12px',
                        background: '#4ade80',
                        borderRadius: '2px'
                    }}></div>
                    <span>Candele Verdi = Prezzo Sale</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                        width: '12px',
                        height: '12px',
                        background: '#f87171',
                        borderRadius: '2px'
                    }}></div>
                    <span>Candele Rosse = Prezzo Scende</span>
                </div>
            </div>

            {/* Current Price Display */}
            {currentPrice > 0 && (
                <div className="current-price-display">
                    1 BTC = €{currentPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
            )}

        </div>
    );
};

export default LightweightChart;

