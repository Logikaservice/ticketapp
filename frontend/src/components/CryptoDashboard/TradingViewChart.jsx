import React, { useEffect, useRef, useState } from 'react';
import './TradingViewChart.css';

const TradingViewChart = ({ symbol = 'BTCEUR', trades = [], openPositions = [], currentPrice = 0 }) => {
    const containerRef = useRef(null);
    const widgetRef = useRef(null);
    const [markers, setMarkers] = useState([]);
    const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });
    const [timeRange, setTimeRange] = useState({ min: 0, max: 0 });

    useEffect(() => {
        // Cleanup previous widget
        if (widgetRef.current && widgetRef.current.parentNode) {
            widgetRef.current.parentNode.removeChild(widgetRef.current);
        }

        // Create new widget container
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.type = 'text/javascript';
        script.async = true;
        // Map symbol to TradingView format
        const tradingViewSymbol = symbol === 'BTCEUR' ? 'BINANCE:BTCEUR' : 
                                 symbol === 'BTCUSDT' ? 'BINANCE:BTCUSDT' :
                                 `BINANCE:${symbol}`;

        script.innerHTML = JSON.stringify({
            "autosize": true,
            "symbol": tradingViewSymbol,
            "interval": "1", // 1 minuto per movimento più fluido come Binance
            "timezone": "Europe/Rome",
            "theme": "dark",
            "style": "1",
            "locale": "it",
            "enable_publishing": false,
            "hide_top_toolbar": false,
            "hide_legend": false,
            "save_image": false,
            "calendar": false,
            "support_host": "https://www.tradingview.com",
            "height": 500,
            "width": "100%",
            "container_id": "tradingview_chart"
        });

        // Crea container univoco per evitare conflitti
        const uniqueId = `tradingview_chart_${Date.now()}`;
        const container = document.createElement('div');
        container.id = uniqueId;
        container.style.width = '100%';
        container.style.height = '500px';
        containerRef.current.appendChild(container);
        widgetRef.current = container;

        // Aggiorna container_id nello script
        const scriptContent = JSON.parse(script.innerHTML);
        scriptContent.container_id = uniqueId;
        script.innerHTML = JSON.stringify(scriptContent);

        container.appendChild(script);

        return () => {
            if (containerRef.current && container.parentNode) {
                containerRef.current.removeChild(container);
            }
        };
    }, [symbol]);

    // Convert trades to markers for overlay
    useEffect(() => {
        if (trades.length > 0) {
            const tradeMarkers = trades.map((trade, index) => ({
                id: index,
                type: trade.type, // 'buy' or 'sell'
                timestamp: new Date(trade.timestamp).getTime(),
                price: trade.price,
                amount: trade.amount,
                strategy: trade.strategy || 'Bot'
            }));
            setMarkers(tradeMarkers);
        }
    }, [trades]);

    // Filtra trades solo con posizioni aperte
    const openTrades = trades.filter(trade => {
        if (!openPositions || openPositions.length === 0) return false;
        if (!trade.ticket_id) return false;
        const tradeTicketId = String(trade.ticket_id);
        return openPositions.some(
            pos => String(pos.ticket_id) === tradeTicketId && pos.status === 'open'
        );
    });

    // Crea numeri identificativi per i marker
    const tradeIdMap = new Map();
    let nextId = 1;
    openTrades.forEach(trade => {
        const uniqueKey = trade.ticket_id ? `ticket-${trade.ticket_id}` : `trade-${trade.timestamp}`;
        if (!tradeIdMap.has(uniqueKey)) {
            tradeIdMap.set(uniqueKey, nextId++);
        }
    });

    return (
        <div className="tradingview-chart-container">
            <div className="chart-main-wrapper">
                {/* TradingView Chart - stesso di Binance */}
                <div ref={containerRef} className="tradingview-chart-wrapper" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                    {/* TradingView widget will be inserted here */}
                    
                    {/* Overlay per marker - sopra il grafico con posizionamento intelligente */}
                    {openTrades.length > 0 && (() => {
                        // Calcola range di tempo e prezzo per posizionamento
                        const now = Date.now();
                        const tradeTimes = openTrades.map(t => new Date(t.timestamp).getTime());
                        const tradePrices = openTrades.map(t => parseFloat(t.price));
                        
                        // Range temporale: ultime 24 ore o range dei trades
                        const minTime = tradeTimes.length > 0 ? Math.min(...tradeTimes) : now - (24 * 60 * 60 * 1000);
                        const maxTime = tradeTimes.length > 0 ? Math.max(...tradeTimes) : now;
                        const timeSpan = maxTime - minTime || 1;
                        
                        // Range di prezzo: ±5% dal prezzo corrente o range dei trades
                        const allPrices = [...tradePrices, currentPrice].filter(p => p > 0);
                        const minPrice = allPrices.length > 0 ? Math.min(...allPrices) * 0.95 : currentPrice * 0.95;
                        const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) * 1.05 : currentPrice * 1.05;
                        const priceSpan = maxPrice - minPrice || 1;
                        
                        return (
                            <div className="markers-overlay">
                                {openTrades.map((trade, index) => {
                                    const uniqueKey = trade.ticket_id ? `ticket-${trade.ticket_id}` : `trade-${trade.timestamp}`;
                                    const markerId = tradeIdMap.get(uniqueKey) || (index + 1);
                                    const isBuy = trade.type === 'buy';
                                    
                                    // Calcola posizione X (tempo) - 5% padding laterale
                                    const tradeTime = new Date(trade.timestamp).getTime();
                                    const timePercent = ((tradeTime - minTime) / timeSpan) * 90 + 5; // 5% - 95%
                                    
                                    // Calcola posizione Y (prezzo) - invertito (top = prezzo alto)
                                    const tradePrice = parseFloat(trade.price);
                                    const pricePercent = 100 - (((tradePrice - minPrice) / priceSpan) * 90 + 5); // 5% - 95% invertito
                                    
                                    return (
                                        <div
                                            key={`marker-${trade.ticket_id || trade.timestamp}-${index}`}
                                            className={`chart-marker ${isBuy ? 'marker-buy' : 'marker-sell'}`}
                                            style={{
                                                position: 'absolute',
                                                left: `${Math.max(5, Math.min(95, timePercent))}%`,
                                                top: `${Math.max(5, Math.min(95, pricePercent))}%`,
                                                zIndex: 1000,
                                                transform: 'translate(-50%, -50%)'
                                            }}
                                            title={`${trade.type.toUpperCase()} #${markerId} - €${parseFloat(trade.price).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - ${new Date(trade.timestamp).toLocaleString('it-IT')}`}
                                        >
                                            <div className="marker-arrow">
                                                {isBuy ? '↑' : '↓'}
                                            </div>
                                            <div className="marker-number">{markerId}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>

                {/* Operazioni Bot - A DESTRA del grafico */}
                <div className="trades-legend-right">
                    <div className="legend-header">
                        <h4>🤖 Operazioni Bot</h4>
                        <span className="trade-count">{openTrades.length} operazioni aperte</span>
                    </div>
                    {openTrades.length > 0 ? (
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
                    )}
                </div>
            </div>
        </div>
    );
};

export default TradingViewChart;

