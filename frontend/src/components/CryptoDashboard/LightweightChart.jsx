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
        if (!candlestickSeriesRef.current || priceHistory.length === 0) return;

        // Convert price history to candlestick format
        // Group prices by time intervals (15 minutes)
        const interval = 15 * 60; // 15 minutes in seconds
        const groupedData = {};
        
        priceHistory.forEach((point) => {
            const time = new Date(point.timestamp || point.time).getTime() / 1000;
            const intervalKey = Math.floor(time / interval) * interval;
            
            if (!groupedData[intervalKey]) {
                groupedData[intervalKey] = {
                    time: intervalKey,
                    prices: []
                };
            }
            
            const price = typeof point.price === 'number' ? point.price : parseFloat(point.price);
            if (!isNaN(price)) {
                groupedData[intervalKey].prices.push(price);
            }
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
            candlestickSeriesRef.current.setData(candlestickData);
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

    // Update price line (remove old one before adding new)
    useEffect(() => {
        if (!candlestickSeriesRef.current || !currentPrice) return;

        // Remove previous price line if exists
        const priceLineId = candlestickSeriesRef.current.createPriceLine({
            price: currentPrice,
            color: '#3b82f6',
            lineWidth: 2,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: `€${currentPrice.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        });
    }, [currentPrice]);

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

            {/* Chart Container */}
            <div ref={chartContainerRef} className="lightweight-chart-wrapper" />

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

