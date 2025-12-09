import React, { useEffect, useState, useRef } from 'react';
import './TradingViewOverlay.css';

/**
 * TradingViewOverlay - Mostra marker per posizioni aperte e storico trade
 * Scenario C (Ibrido):
 * - Posizioni aperte: Marker grandi + Linee SL/TP
 * - Ultimi 10 trade chiusi: Marker piccoli
 */
const TradingViewOverlay = ({
    openPositions = [],
    closedTrades = [],
    currentPrice = 0,
    showHistory = true // Toggle dalle impostazioni
}) => {
    const [visibleMarkers, setVisibleMarkers] = useState([]);
    const containerRef = useRef(null);

    useEffect(() => {
        const markers = [];

        // 1. POSIZIONI APERTE - Marker grandi con SL/TP
        openPositions.forEach((pos, index) => {
            const isLong = pos.type === 'buy' || pos.type === 'long';
            const entryPrice = parseFloat(pos.entry_price);
            const stopLoss = parseFloat(pos.stop_loss);
            const takeProfit = parseFloat(pos.take_profit);
            const timestamp = new Date(pos.opened_at || pos.timestamp).getTime();

            // Marker principale (freccia)
            markers.push({
                id: `open-${pos.ticket_id || index}`,
                type: 'position-open',
                direction: isLong ? 'long' : 'short',
                price: entryPrice,
                timestamp: timestamp,
                label: `${isLong ? 'LONG' : 'SHORT'} ${pos.symbol || 'BTC'}`,
                volume: pos.volume,
                large: true
            });

            // Linea Stop Loss
            if (stopLoss && stopLoss > 0) {
                markers.push({
                    id: `sl-${pos.ticket_id || index}`,
                    type: 'stop-loss',
                    price: stopLoss,
                    timestamp: timestamp,
                    label: `SL: $${stopLoss.toFixed(2)} USDT`,
                    parentId: pos.ticket_id || index
                });
            }

            // Linea Take Profit
            if (takeProfit && takeProfit > 0) {
                markers.push({
                    id: `tp-${pos.ticket_id || index}`,
                    type: 'take-profit',
                    price: takeProfit,
                    timestamp: timestamp,
                    label: `TP: $${takeProfit.toFixed(2)} USDT`,
                    parentId: pos.ticket_id || index
                });
            }
        });

        // 2. ULTIMI 10 TRADE CHIUSI - Marker piccoli (se abilitato)
        if (showHistory && closedTrades.length > 0) {
            const recentTrades = closedTrades
                .sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at))
                .slice(0, 10);

            recentTrades.forEach((trade, index) => {
                const isLong = trade.type === 'buy' || trade.type === 'long';
                const isProfit = parseFloat(trade.profit_loss || 0) >= 0;
                const closePrice = parseFloat(trade.close_price);
                const timestamp = new Date(trade.closed_at).getTime();

                markers.push({
                    id: `closed-${trade.ticket_id || index}`,
                    type: 'position-closed',
                    direction: isLong ? 'long' : 'short',
                    result: isProfit ? 'profit' : 'loss',
                    price: closePrice,
                    timestamp: timestamp,
                    label: `${isProfit ? '✓' : '✗'} ${isLong ? 'L' : 'S'}`,
                    pnl: trade.profit_loss,
                    large: false
                });
            });
        }

        setVisibleMarkers(markers);
    }, [openPositions, closedTrades, showHistory]);

    // Calcola posizione Y basata sul prezzo (semplificato)
    const getPricePosition = (price) => {
        if (!currentPrice || currentPrice === 0) return 50; // Centro di default

        // Calcola range visibile (±10% dal prezzo corrente)
        const range = currentPrice * 0.1;
        const minPrice = currentPrice - range;
        const maxPrice = currentPrice + range;

        // Normalizza la posizione (0-100%)
        const normalized = ((price - minPrice) / (maxPrice - minPrice)) * 100;

        // Inverti (0 = top, 100 = bottom)
        return 100 - Math.max(0, Math.min(100, normalized));
    };

    return null; // Markers disabled as per user request
    /*
    return (
        <div ref={containerRef} className="tradingview-overlay">
            {visibleMarkers.map(marker => {
                const yPosition = getPricePosition(marker.price);

                if (marker.type === 'position-open') {
                    return (
                        <div
                            key={marker.id}
                            className={`marker marker-open marker-${marker.direction} ${marker.large ? 'marker-large' : 'marker-small'}`}
                            style={{ top: `${yPosition}%` }}
                            title={`${marker.label} @ $${marker.price.toFixed(2)} USDT`}
                        >
                            <div className="marker-icon">
                                {marker.direction === 'long' ? '▲' : '▼'}
                            </div>
                            <div className="marker-label">{marker.label}</div>
                        </div>
                    );
                }

                if (marker.type === 'position-closed') {
                    return (
                        <div
                            key={marker.id}
                            className={`marker marker-closed marker-${marker.result} marker-small`}
                            style={{ top: `${yPosition}%` }}
                            title={`Chiuso @ $${marker.price.toFixed(2)} USDT | P&L: $${marker.pnl?.toFixed(2) || '0.00'} USDT`}
                        >
                            <div className="marker-icon-small">
                                {marker.label}
                            </div>
                        </div>
                    );
                }

                if (marker.type === 'stop-loss') {
                    return (
                        <div
                            key={marker.id}
                            className="price-line price-line-sl"
                            style={{ top: `${yPosition}%` }}
                        >
                            <div className="price-line-label">{marker.label}</div>
                        </div>
                    );
                }

                if (marker.type === 'take-profit') {
                    return (
                        <div
                            key={marker.id}
                            className="price-line price-line-tp"
                            style={{ top: `${yPosition}%` }}
                        >
                            <div className="price-line-label">{marker.label}</div>
                        </div>
                    );
                }

                return null;
            })}
        </div>
    );
    */
};

export default TradingViewOverlay;
