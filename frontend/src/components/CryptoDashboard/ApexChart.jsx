import React, { useEffect, useRef, useState } from 'react';
import Chart from 'react-apexcharts';
import './ApexChart.css';

const ApexChart = ({ 
    symbol = 'BTCEUR', 
    trades = [], 
    currentPrice = 0, 
    priceHistory = [], 
    openPositions = [], 
    onIntervalChange, 
    currentInterval = '15m' 
}) => {
    const chartRef = useRef(null);
    const [selectedInterval, setSelectedInterval] = useState(currentInterval);
    const [chartOptions, setChartOptions] = useState(null);
    const [chartSeries, setChartSeries] = useState([]);
    const lastUpdateRef = useRef(Date.now());

    const intervals = [
        { value: '1m', label: '1 Min' },
        { value: '5m', label: '5 Min' },
        { value: '15m', label: '15 Min' },
        { value: '30m', label: '30 Min' },
        { value: '1h', label: '1 Ora' },
        { value: '4h', label: '4 Ore' },
        { value: '1d', label: '1 Giorno' },
    ];

    useEffect(() => {
        setSelectedInterval(currentInterval);
    }, [currentInterval]);

    // Filter bot operations: only show trades with open positions
    const botOperations = React.useMemo(() => {
        if (!trades || !openPositions || openPositions.length === 0) {
            return [];
        }
        
        const openTicketIds = new Set(openPositions.map(pos => String(pos.ticket_id || pos.id)));
        return trades.filter(trade => {
            const ticketId = String(trade.ticket_id || trade.id || '');
            return openTicketIds.has(ticketId);
        }).sort((a, b) => {
            const timeA = new Date(a.timestamp || a.time || 0).getTime();
            const timeB = new Date(b.timestamp || b.time || 0).getTime();
            return timeB - timeA; // Most recent first
        });
    }, [trades, openPositions]);

    // Prepare candlestick data
    useEffect(() => {
        if (!priceHistory || priceHistory.length === 0) {
            return;
        }

        // Convert priceHistory to ApexCharts format
        const candlestickData = priceHistory
            .filter(candle => candle && candle.time && candle.open && candle.high && candle.low && candle.close)
            .map(candle => {
                const time = typeof candle.time === 'number' ? candle.time : new Date(candle.time).getTime();
                return {
                    x: time,
                    y: [
                        parseFloat(candle.open),
                        parseFloat(candle.high),
                        parseFloat(candle.low),
                        parseFloat(candle.close)
                    ]
                };
            })
            .sort((a, b) => a.x - b.x);

        // Prepare markers for open positions (entry points)
        const markers = [];
        openPositions.forEach((pos, index) => {
            const entryTime = pos.entry_time ? new Date(pos.entry_time).getTime() : 
                            pos.timestamp ? new Date(pos.timestamp).getTime() : 
                            Date.now();
            
            const entryPrice = parseFloat(pos.entry_price || pos.price || 0);
            if (entryPrice > 0) {
                markers.push({
                    x: entryTime,
                    y: entryPrice,
                    marker: {
                        size: 8,
                        fillColor: pos.type === 'buy' ? '#10b981' : '#ef4444',
                        strokeColor: pos.type === 'buy' ? '#10b981' : '#ef4444',
                        radius: 4,
                    },
                    label: {
                        text: `${index + 1}`,
                        style: {
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 'bold',
                        },
                        offsetY: -15,
                    }
                });
            }
        });

        // Update last candle with current price in real-time
        if (candlestickData.length > 0 && currentPrice > 0) {
            const lastCandle = candlestickData[candlestickData.length - 1];
            const now = Date.now();
            
            // Update last candle if it's within the current interval
            const intervalMs = {
                '1m': 60 * 1000,
                '5m': 5 * 60 * 1000,
                '15m': 15 * 60 * 1000,
                '30m': 30 * 60 * 1000,
                '1h': 60 * 60 * 1000,
                '4h': 4 * 60 * 60 * 1000,
                '1d': 24 * 60 * 60 * 1000
            };
            const intervalDuration = intervalMs[currentInterval] || 15 * 60 * 1000;
            const candleStartTime = Math.floor(now / intervalDuration) * intervalDuration;
            
            if (lastCandle.x >= candleStartTime - intervalDuration && lastCandle.x <= candleStartTime) {
                // Update last candle with current price
                lastCandle.y[1] = Math.max(lastCandle.y[1], currentPrice); // High
                lastCandle.y[2] = Math.min(lastCandle.y[2], currentPrice); // Low
                lastCandle.y[3] = currentPrice; // Close
            }
        }

        const options = {
            chart: {
                type: 'candlestick',
                height: 500,
                toolbar: {
                    show: true,
                    tools: {
                        download: true,
                        selection: true,
                        zoom: true,
                        zoomin: true,
                        zoomout: true,
                        pan: true,
                        reset: true,
                    },
                },
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800,
                },
                zoom: {
                    enabled: true,
                    type: 'x',
                    autoScaleYaxis: true,
                },
            },
            xaxis: {
                type: 'datetime',
                labels: {
                    datetimeUTC: false,
                    format: 'HH:mm',
                },
                tooltip: {
                    enabled: true,
                },
            },
            yaxis: {
                tooltip: {
                    enabled: true,
                },
                labels: {
                    formatter: (val) => `€${val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                },
            },
            plotOptions: {
                candlestick: {
                    colors: {
                        upward: '#10b981', // Green for bullish
                        downward: '#ef4444', // Red for bearish
                    },
                },
            },
            tooltip: {
                enabled: true,
                x: {
                    format: 'dd MMM yyyy HH:mm',
                },
                custom: function({ seriesIndex, dataPointIndex, w }) {
                    const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
                    const [open, high, low, close] = data.y;
                    return `
                        <div style="padding: 10px; background: #1c1c1e; border-radius: 4px;">
                            <div><strong>Open:</strong> €${open.toFixed(2)}</div>
                            <div><strong>High:</strong> €${high.toFixed(2)}</div>
                            <div><strong>Low:</strong> €${low.toFixed(2)}</div>
                            <div><strong>Close:</strong> €${close.toFixed(2)}</div>
                        </div>
                    `;
                },
            },
            annotations: {
                points: markers.map(m => ({
                    x: m.x,
                    y: m.y,
                    marker: m.marker,
                    label: m.label,
                })),
            },
            theme: {
                mode: 'dark',
            },
            grid: {
                borderColor: '#374151',
                strokeDashArray: 4,
            },
            colors: ['#10b981', '#ef4444'],
        };

        setChartOptions(options);
        setChartSeries([{
            name: 'Bitcoin/EUR',
            data: candlestickData,
        }]);
    }, [priceHistory, currentPrice, currentInterval, openPositions]);

    const handleIntervalButtonClick = (interval) => {
        setSelectedInterval(interval);
        if (onIntervalChange) {
            onIntervalChange(interval);
        }
    };

    return (
        <div className="apex-chart-container">
            <div className="chart-main-wrapper">
                <div className="apex-chart-wrapper">
                    {chartOptions && chartSeries.length > 0 ? (
                        <Chart
                            ref={chartRef}
                            options={chartOptions}
                            series={chartSeries}
                            type="candlestick"
                            height={500}
                        />
                    ) : (
                        <div className="chart-loading">Caricamento grafico...</div>
                    )}

                    {/* Current Price Line */}
                    {currentPrice > 0 && (
                        <div 
                            className="current-price-line"
                            style={{
                                position: 'absolute',
                                bottom: '20px',
                                left: 0,
                                right: 0,
                                height: '1px',
                                background: '#3b82f6',
                                borderTop: '2px dashed #3b82f6',
                                zIndex: 10,
                                pointerEvents: 'none',
                            }}
                        />
                    )}

                    {/* Interval Selector */}
                    <div className="interval-selector">
                        {intervals.map((interval) => (
                            <button
                                key={interval.value}
                                className={`interval-button ${selectedInterval === interval.value ? 'active' : ''}`}
                                onClick={() => handleIntervalButtonClick(interval.value)}
                            >
                                {interval.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Bot Operations Panel */}
                <div className="trades-legend-right">
                    <div className="trades-legend-header">
                        <span className="trades-legend-icon">🤖</span>
                        <span className="trades-legend-title">Operazioni Bot</span>
                    </div>
                    <div className="trades-legend-content">
                        {botOperations.length > 0 ? (
                            <>
                                <div className="trades-legend-count">
                                    {botOperations.length} operazioni aperte
                                </div>
                                <div className="trades-list">
                                    {botOperations.map((trade, index) => {
                                        const isBuy = trade.type === 'buy' || trade.side === 'buy';
                                        const entryPrice = parseFloat(trade.price || trade.entry_price || 0);
                                        const currentPnL = openPositions.find(pos => 
                                            String(pos.ticket_id || pos.id) === String(trade.ticket_id || trade.id)
                                        )?.current_pnl || 0;
                                        const pnlPct = openPositions.find(pos => 
                                            String(pos.ticket_id || pos.id) === String(trade.ticket_id || trade.id)
                                        )?.pnl_percent || 0;

                                        return (
                                            <div key={trade.ticket_id || trade.id || index} className="trade-item">
                                                <div className="trade-header">
                                                    <span className={`trade-type ${isBuy ? 'buy' : 'sell'}`}>
                                                        {isBuy ? 'BUY' : 'SELL'}
                                                    </span>
                                                    <span className="trade-number">#{index + 1}</span>
                                                </div>
                                                <div className="trade-details">
                                                    <div>Prezzo: €{entryPrice.toFixed(2)}</div>
                                                    <div className={currentPnL >= 0 ? 'profit' : 'loss'}>
                                                        P&L: {currentPnL >= 0 ? '+' : ''}€{currentPnL.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                                                    </div>
                                                    <div className="trade-time">
                                                        {new Date(trade.timestamp || trade.time || Date.now()).toLocaleString('it-IT')}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className="no-operations">
                                <div>0 operazioni aperte</div>
                                <div className="no-operations-subtitle">Nessuna operazione recente</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Chart Legend */}
            <div className="chart-legend">
                <div className="legend-item">
                    <div className="legend-color" style={{ background: '#3b82f6' }}></div>
                    <span>Prezzo Corrente</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color" style={{ background: '#10b981' }}></div>
                    <span>Candele Verdi = Prezzo Sale</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color" style={{ background: '#ef4444' }}></div>
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

export default ApexChart;

