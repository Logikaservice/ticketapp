import React, { useEffect, useRef, useState, useMemo } from 'react';
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

    // Usa direttamente le posizioni aperte invece di filtrare i trades
    const displayPositions = useMemo(() => {
        if (!openPositions || openPositions.length === 0) {
            console.log('🔍 TradingViewChart: Nessuna posizione aperta');
            return [];
        }
        
        // Filtra solo posizioni aperte e crea oggetti per display
        const positions = openPositions
            .filter(pos => pos.status === 'open')
            .map(pos => ({
                ticket_id: pos.ticket_id,
                type: pos.type, // 'buy' or 'sell'
                entry_price: parseFloat(pos.entry_price) || 0,
                volume: parseFloat(pos.volume) || 0,
                timestamp: pos.opened_at || pos.timestamp || new Date().toISOString(),
                strategy: pos.strategy || 'Bot'
            }));
        
        console.log('🔍 TradingViewChart - Posizioni aperte:', {
            totalOpenPositions: positions.length,
            positions: positions.map(p => ({
                ticket_id: p.ticket_id,
                type: p.type,
                entry_price: p.entry_price,
                timestamp: p.timestamp
            }))
        });
        
        return positions;
    }, [openPositions]);

    // Crea numeri identificativi per i marker
    const positionIdMap = new Map();
    let nextId = 1;
    displayPositions.forEach(pos => {
        const uniqueKey = pos.ticket_id ? `ticket-${pos.ticket_id}` : `pos-${pos.timestamp}`;
        if (!positionIdMap.has(uniqueKey)) {
            positionIdMap.set(uniqueKey, nextId++);
        }
    });

    return (
        <div className="tradingview-chart-container">
            <div className="chart-main-wrapper">
                {/* TradingView Chart - stesso di Binance */}
                <div ref={containerRef} className="tradingview-chart-wrapper" style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'visible' }}>
                    {/* TradingView widget will be inserted here */}
                    
                    {/* Overlay per marker - sopra il grafico con posizionamento intelligente */}
                    {displayPositions.length > 0 && (() => {
                        console.log('📍 Rendering markers da posizioni aperte:', displayPositions.length);
                        // Calcola range di tempo e prezzo per posizionamento
                        const now = Date.now();
                        const positionTimes = displayPositions.map(p => new Date(p.timestamp).getTime());
                        const entryPrices = displayPositions.map(p => p.entry_price).filter(p => p > 0);
                        
                        // Range temporale: ultime 24 ore o range delle posizioni
                        const minTime = positionTimes.length > 0 ? Math.min(...positionTimes) : now - (24 * 60 * 60 * 1000);
                        const maxTime = positionTimes.length > 0 ? Math.max(...positionTimes) : now;
                        const timeSpan = maxTime - minTime || 1;
                        
                        // Range di prezzo: ±5% dal prezzo corrente o range degli entry prices
                        const allPrices = [...entryPrices, currentPrice].filter(p => p > 0);
                        const minPrice = allPrices.length > 0 ? Math.min(...allPrices) * 0.95 : currentPrice * 0.95;
                        const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) * 1.05 : currentPrice * 1.05;
                        const priceSpan = maxPrice - minPrice || 1;
                        
                        return (
                            <div className="markers-overlay">
                                {displayPositions.map((pos, index) => {
                                    const uniqueKey = pos.ticket_id ? `ticket-${pos.ticket_id}` : `pos-${pos.timestamp}`;
                                    const markerId = positionIdMap.get(uniqueKey) || (index + 1);
                                    const isBuy = pos.type === 'buy';
                                    
                                    // Calcola posizione X (tempo) - 5% padding laterale
                                    const positionTime = new Date(pos.timestamp).getTime();
                                    const timePercent = ((positionTime - minTime) / timeSpan) * 90 + 5; // 5% - 95%
                                    
                                    // Calcola posizione Y (prezzo) usando ENTRY_PRICE - invertito (top = prezzo alto)
                                    const pricePercent = 100 - (((pos.entry_price - minPrice) / priceSpan) * 90 + 5); // 5% - 95% invertito
                                    
                                    console.log(`📍 Marker #${markerId}:`, {
                                        ticket_id: pos.ticket_id,
                                        type: pos.type,
                                        entry_price: pos.entry_price,
                                        timestamp: pos.timestamp,
                                        position: { x: timePercent, y: pricePercent }
                                    });
                                    
                                    return (
                                        <div
                                            key={`marker-${pos.ticket_id || pos.timestamp}-${index}`}
                                            className={`chart-marker ${isBuy ? 'marker-buy' : 'marker-sell'}`}
                                            style={{
                                                position: 'absolute',
                                                left: `${Math.max(5, Math.min(95, timePercent))}%`,
                                                top: `${Math.max(5, Math.min(95, pricePercent))}%`,
                                                zIndex: 10000,
                                                transform: 'translate(-50%, -50%)'
                                            }}
                                            title={`${pos.type.toUpperCase()} #${markerId} - Entry: €${pos.entry_price.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - ${new Date(pos.timestamp).toLocaleString('it-IT')}`}
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
                        <span className="trade-count">{displayPositions.length} operazioni aperte</span>
                    </div>
                    {displayPositions.length > 0 ? (
                        <div className="trades-list-vertical">
                            {displayPositions
                                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Più recenti in alto
                                .map((pos, index) => (
                                <div 
                                    key={pos.ticket_id || index} 
                                    className={`trade-badge ${pos.type}`}
                                    title={`${pos.strategy || 'Bot'} - ${new Date(pos.timestamp).toLocaleString('it-IT')}`}
                                >
                                    <span className="trade-icon">{pos.type === 'buy' ? '↑' : '↓'}</span>
                                    <div className="trade-details">
                                        <div className="trade-row">
                                            <span className="trade-type">{pos.type.toUpperCase()}</span>
                                            <span className="trade-price">
                                                €{pos.entry_price.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="trade-row">
                                            <span className="trade-amount">{pos.volume.toFixed(4)} BTC</span>
                                            <span className="trade-time">
                                                {new Date(pos.timestamp).toLocaleTimeString('it-IT', { 
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

