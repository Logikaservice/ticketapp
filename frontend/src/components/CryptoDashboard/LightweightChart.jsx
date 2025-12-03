import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import './LightweightChart.css';

const LightweightChart = ({ symbol = 'BTCEUR', trades = [], currentPrice = 0, priceHistory = [] }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const candlestickSeriesRef = useRef(null);
    const markersRef = useRef([]);

    // Initialize chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Create chart
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
            if (chartRef.current) {
                chartRef.current.remove();
            }
        };
    }, []);

    // Update chart data
    useEffect(() => {
        if (!candlestickSeriesRef.current) return;

        console.log('📊 LightweightChart: priceHistory length:', priceHistory.length);
        
        if (priceHistory.length === 0) {
            console.warn('⚠️ LightweightChart: No price history data');
            return;
        }

        // Convert price history to candlestick format
        // Use line chart if we don't have enough data for candlesticks
        const validData = priceHistory
            .map((point) => {
                const price = typeof point.price === 'number' ? point.price : parseFloat(point.price);
                const timestamp = point.timestamp || point.time;
                const time = timestamp ? new Date(timestamp).getTime() / 1000 : null;
                
                if (isNaN(price) || !time) return null;
                
                return { time, price };
            })
            .filter(item => item !== null)
            .sort((a, b) => a.time - b.time);

        console.log('📊 LightweightChart: Valid data points:', validData.length);

        if (validData.length === 0) {
            console.warn('⚠️ LightweightChart: No valid data points after filtering');
            return;
        }

        // If we have enough data, create candlesticks; otherwise use line data
        if (validData.length > 10) {
            // Group prices by time intervals (15 minutes)
            const interval = 15 * 60; // 15 minutes in seconds
            const groupedData = {};
            
            validData.forEach((point) => {
                const intervalKey = Math.floor(point.time / interval) * interval;
                
                if (!groupedData[intervalKey]) {
                    groupedData[intervalKey] = {
                        time: intervalKey,
                        prices: []
                    };
                }
                
                groupedData[intervalKey].prices.push(point.price);
            });

            // Convert grouped data to candlesticks
            const candlestickData = Object.values(groupedData)
                .sort((a, b) => a.time - b.time)
                .map((group, index, array) => {
                    const prices = group.prices;
                    const open = index > 0 ? array[index - 1].prices[array[index - 1].prices.length - 1] : prices[0];
                    const close = prices[prices.length - 1];
                    const high = Math.max(...prices);
                    const low = Math.min(...prices);

                    return {
                        time: group.time,
                        open: open || close,
                        high: high || close,
                        low: low || close,
                        close: close,
                    };
                });

            if (candlestickData.length > 0) {
                console.log('✅ LightweightChart: Setting candlestick data:', candlestickData.length, 'candles');
                candlestickSeriesRef.current.setData(candlestickData);
            }
        } else {
            // Use line chart for small datasets
            const lineData = validData.map(point => ({
                time: point.time,
                value: point.price
            }));
            console.log('✅ LightweightChart: Setting line data:', lineData.length, 'points');
            candlestickSeriesRef.current.setData(lineData);
        }
    }, [priceHistory]);

    // Add markers for trades
    useEffect(() => {
        if (!candlestickSeriesRef.current) return;

        // Clear previous markers
        markersRef.current = [];

        if (trades.length > 0) {
            // Create markers from trades
            const markers = trades.map((trade, index) => {
                const tradeTime = new Date(trade.timestamp).getTime() / 1000;
                const tradePrice = parseFloat(trade.price);

                return {
                    time: tradeTime,
                    position: trade.type === 'buy' ? 'belowBar' : 'aboveBar',
                    color: trade.type === 'buy' ? '#4ade80' : '#f87171',
                    shape: trade.type === 'buy' ? 'arrowUp' : 'arrowDown',
                    text: `${trade.type.toUpperCase()}`,
                    size: 2,
                    id: `marker-${index}`,
                };
            });

            markersRef.current = markers;
            candlestickSeriesRef.current.setMarkers(markers);
        } else {
            // Clear markers if no trades
            candlestickSeriesRef.current.setMarkers([]);
        }
    }, [trades]);

    // Update price line (only show if we have historical data)
    useEffect(() => {
        if (!candlestickSeriesRef.current || !currentPrice || priceHistory.length === 0) return;

        // Create price line for current price
        candlestickSeriesRef.current.createPriceLine({
            price: currentPrice,
            color: '#3b82f6',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: `€${currentPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        });
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

