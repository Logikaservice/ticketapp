import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import './LightweightChart.css';

const LightweightChart = ({ symbol = 'BTCEUR', trades = [], currentPrice = 0, priceHistory = [] }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const candlestickSeriesRef = useRef(null);
    const markersRef = useRef([]);
    const priceLinesRef = useRef([]); // Array per tenere traccia di tutte le price lines create
    const hasRestoredPositionRef = useRef(false); // Flag per evitare ripristino multiplo
    const savePositionTimeoutRef = useRef(null); // Timeout per debounce salvataggio posizione

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
                            console.log('💾 Grafico: Posizione salvata', { from: visibleRange.from, to: visibleRange.to });
                        }
                    } catch (e) {
                        console.warn('Errore nel salvataggio posizione grafico:', e);
                    }
                }
            }, 500); // Debounce: salva dopo 500ms di inattività
        };

        // Listen to timeScale changes (scroll/zoom)
        chart.timeScale().subscribeVisibleTimeRangeChange(saveChartPosition);

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

        console.log('📊 LightweightChart: priceHistory length:', priceHistory.length);
        
        if (priceHistory.length === 0) {
            console.warn('⚠️ LightweightChart: No price history data');
            return;
        }

        // Debug: log first item to see structure
        console.log('🔍 LightweightChart: First item structure:', {
            keys: Object.keys(priceHistory[0] || {}),
            firstItem: priceHistory[0],
            hasOpen: 'open' in (priceHistory[0] || {}),
            hasHigh: 'high' in (priceHistory[0] || {}),
            hasLow: 'low' in (priceHistory[0] || {}),
            hasClose: 'close' in (priceHistory[0] || {})
        });

        // Check if we have OHLC candlesticks (from klines table) or price points
        // Use 'in' operator instead of hasOwnProperty for better compatibility
        const firstItem = priceHistory[0] || {};
        const hasOHLC = priceHistory.length > 0 && 
                       ('open' in firstItem) && 
                       ('high' in firstItem) && 
                       ('low' in firstItem) && 
                       ('close' in firstItem);
        
        console.log('🔍 LightweightChart: hasOHLC check:', hasOHLC);
        
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
                console.log('✅ LightweightChart: Setting OHLC candlestick data:', candlestickData.length, 'candles (from Binance klines)');
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
                                    console.log('✅ Grafico: Posizione ripristinata', { from, to });
                                } else if (attempt < 3) {
                                    setTimeout(() => restorePosition(attempt + 1), 500);
                                } else {
                                    console.log('⚠️ Grafico: Range salvato non valido, usando default');
                                }
                            } catch (e) {
                                console.warn('Errore nel ripristino posizione:', e);
                            }
                        } else if (attempt < 3) {
                            setTimeout(() => restorePosition(attempt + 1), 500);
                        }
                    };
                    setTimeout(() => restorePosition(0), 300);
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
            console.warn('⚠️ LightweightChart: No valid data points');
            return;
        }

        // Use line chart for price points (fallback)
        const lineData = validData.map(point => ({
            time: point.time,
            value: point.price
        }));
        console.log('✅ LightweightChart: Setting line data (fallback):', lineData.length, 'points');
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
                            console.log('✅ Grafico: Posizione ripristinata (fallback)');
                        } else if (attempt < 3) {
                            setTimeout(() => restorePosition(attempt + 1), 500);
                        }
                    } catch (e) {
                        console.warn('Errore nel ripristino posizione:', e);
                    }
                } else if (attempt < 3) {
                    setTimeout(() => restorePosition(attempt + 1), 500);
                }
            };
            setTimeout(() => restorePosition(0), 300);
        }
    }, [priceHistory]);

    // Add markers for trades - CON RAGGRUPPAMENTO per evitare sovrapposizioni
    useEffect(() => {
        if (!candlestickSeriesRef.current) return;

        // Clear previous markers
        markersRef.current = [];

        if (trades.length > 0) {
            // Ordina trades per timestamp
            const sortedTrades = [...trades].sort((a, b) => 
                new Date(a.timestamp) - new Date(b.timestamp)
            );

            // Raggruppa marker troppo vicini (entro 2 minuti = 120 secondi)
            const GROUP_TIME_WINDOW = 120; // 2 minuti
            const groupedMarkers = [];
            let currentGroup = [];

            sortedTrades.forEach((trade, index) => {
                const tradeTime = new Date(trade.timestamp).getTime() / 1000;
                
                if (currentGroup.length === 0) {
                    // Primo trade del gruppo
                    currentGroup.push({ trade, time: tradeTime, index });
                } else {
                    const lastTime = currentGroup[currentGroup.length - 1].time;
                    
                    if (tradeTime - lastTime < GROUP_TIME_WINDOW) {
                        // Stesso gruppo - aggiungi
                        currentGroup.push({ trade, time: tradeTime, index });
                    } else {
                        // Nuovo gruppo - salva il precedente e inizia nuovo
                        groupedMarkers.push([...currentGroup]);
                        currentGroup = [{ trade, time: tradeTime, index }];
                    }
                }
            });

            // Aggiungi l'ultimo gruppo
            if (currentGroup.length > 0) {
                groupedMarkers.push(currentGroup);
            }

            // Crea marker da gruppi (mostra solo il più recente di ogni gruppo)
            const markers = groupedMarkers.map((group, groupIndex) => {
                // Prendi il trade più recente del gruppo
                const latestTrade = group[group.length - 1].trade;
                const tradeTime = new Date(latestTrade.timestamp).getTime() / 1000;
                const tradePrice = parseFloat(latestTrade.price);
                
                // Se ci sono più trade nel gruppo, mostra il count
                const count = group.length;
                const text = count > 1 ? `${latestTrade.type.toUpperCase()} (${count})` : latestTrade.type.toUpperCase();

                return {
                    time: tradeTime,
                    position: latestTrade.type === 'buy' ? 'belowBar' : 'aboveBar',
                    color: latestTrade.type === 'buy' ? '#4ade80' : '#f87171',
                    shape: latestTrade.type === 'buy' ? 'arrowUp' : 'arrowDown',
                    text: text,
                    size: count > 1 ? 3 : 2, // Marker più grande se raggruppato
                    id: `marker-group-${groupIndex}`,
                };
            });

            markersRef.current = markers;
            candlestickSeriesRef.current.setMarkers(markers);
            
            if (groupedMarkers.some(g => g.length > 1)) {
                console.log(`📊 Grafico: ${trades.length} trades raggruppati in ${markers.length} marker visibili`);
            }
        } else {
            // Clear markers if no trades
            candlestickSeriesRef.current.setMarkers([]);
        }
    }, [trades]);

    // Update price line (only show if we have historical data)
    useEffect(() => {
        if (!candlestickSeriesRef.current || !currentPrice || priceHistory.length === 0) {
            // Rimuovi tutte le price lines se non ci sono dati
            if (priceLinesRef.current.length > 0) {
                priceLinesRef.current.forEach(priceLine => {
                    try {
                        candlestickSeriesRef.current?.removePriceLine(priceLine);
                    } catch (e) {
                        console.warn('Error removing price line:', e);
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
                console.warn('Error removing old price line:', e);
            }
        });
        priceLinesRef.current = [];

        // Crea UNA SOLA price line per il prezzo corrente
        try {
            const newPriceLine = candlestickSeriesRef.current.createPriceLine({
                price: currentPrice,
                color: '#3b82f6',
                lineWidth: 2,
                lineStyle: 2, // Dashed
                axisLabelVisible: true,
                title: `€${currentPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            });
            priceLinesRef.current.push(newPriceLine);
        } catch (e) {
            console.error('Error creating price line:', e);
        }
    }, [currentPrice, priceHistory.length]);

    return (
        <div className="lightweight-chart-container">
            {/* Trades Legend */}
            {trades.length > 0 && (
                <div className="trades-legend-top">
                    <div className="legend-header">
                        <h4>🤖 Operazioni Bot</h4>
                        <span className="trade-count">{trades.length} operazioni</span>
                    </div>
                    <div className="trades-list-compact">
                        {trades.slice(-8).reverse().map((trade, index) => (
                            <div 
                                key={index} 
                                className={`trade-badge ${trade.type}`}
                                title={`${trade.strategy || 'Bot'} - ${new Date(trade.timestamp).toLocaleString('it-IT')}`}
                            >
                                <span className="trade-icon">{trade.type === 'buy' ? '↑' : '↓'}</span>
                                <span className="trade-type">{trade.type.toUpperCase()}</span>
                                <span className="trade-price">
                                    €{parseFloat(trade.price).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
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
                        ))}
                    </div>
                </div>
            )}

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

