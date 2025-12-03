import React, { useEffect, useRef, useState } from 'react';
import './TradingViewChart.css';

const TradingViewChart = ({ symbol = 'BTCEUR', trades = [] }) => {
    const containerRef = useRef(null);
    const widgetRef = useRef(null);
    const [markers, setMarkers] = useState([]);

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
            "interval": "15",
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

        const container = document.createElement('div');
        container.id = 'tradingview_chart';
        container.style.width = '100%';
        container.style.height = '500px';
        containerRef.current.appendChild(container);
        widgetRef.current = container;

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

    return (
        <div className="tradingview-chart-container">
            <div ref={containerRef} className="tradingview-chart-wrapper">
                {/* TradingView widget will be inserted here */}
            </div>
            
            {/* Trade Markers Overlay */}
            {markers.length > 0 && (
                <div className="trade-markers-overlay">
                    {markers.map(marker => (
                        <div
                            key={marker.id}
                            className={`trade-marker trade-marker-${marker.type}`}
                            title={`${marker.type.toUpperCase()}: ${marker.amount} @ €${marker.price} - ${marker.strategy}`}
                        >
                            <div className={`marker-icon ${marker.type}`}>
                                {marker.type === 'buy' ? '↑' : '↓'}
                            </div>
                            <div className="marker-label">
                                {marker.type === 'buy' ? 'BUY' : 'SELL'}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Trades List Below Chart */}
            {trades.length > 0 && (
                <div className="trades-legend">
                    <h4>Operazioni Bot ({trades.length})</h4>
                    <div className="trades-list-compact">
                        {trades.slice(-10).reverse().map((trade, index) => (
                            <div key={index} className={`trade-badge ${trade.type}`}>
                                <span className="trade-type">{trade.type.toUpperCase()}</span>
                                <span className="trade-price">€{parseFloat(trade.price).toFixed(2)}</span>
                                <span className="trade-amount">{parseFloat(trade.amount).toFixed(4)} BTC</span>
                                <span className="trade-time">
                                    {new Date(trade.timestamp).toLocaleTimeString('it-IT', { 
                                        hour: '2-digit', 
                                        minute: '2-digit' 
                                    })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TradingViewChart;

