import React, { useEffect, useRef, useState, useMemo } from 'react';
import TradingViewOverlay from './TradingViewOverlay';
import './TradingViewChart.css';

const TradingViewChart = ({ symbol = 'BTCUSDT', trades = [], openPositions = [], currentPrice = 0, priceHistory = [], closedTrades = [] }) => {
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
        // ✅ FIX: Normalizza simboli comuni e gestisci EUR -> USDT
        let normalizedSymbol = symbol;

        // Converti EUR a USDT se presente
        if (symbol.includes('EUR')) {
            normalizedSymbol = symbol.replace('EUR', 'USDT');
        }

        // Mappa simboli comuni a formato TradingView
        const symbolMap = {
            'BTCUSDT': 'BTCUSDT',
            'BITCOINUSDT': 'BTCUSDT',
            'ETHUSDT': 'ETHUSDT',
            'ETHEUR': 'ETHUSDT',
            'SOLUSDT': 'SOLUSDT',
            'SOLEUR': 'SOLUSDT',
            'ADAUSDT': 'ADAUSDT',
            'ADAEUR': 'ADAUSDT',
            'DOTUSDT': 'DOTUSDT',
            'DOTEUR': 'DOTUSDT',
            'LINKUSDT': 'LINKUSDT',
            'LINKEUR': 'LINKUSDT',
            'LTCUSDT': 'LTCUSDT',
            'LTCEUR': 'LTCUSDT',
            'XRPUSDT': 'XRPUSDT',
            'XRPEUR': 'XRPUSDT',
            'BNBUSDT': 'BNBUSDT',
            'BNBEUR': 'BNBUSDT'
        };

        normalizedSymbol = symbolMap[normalizedSymbol] || normalizedSymbol;
        const tradingViewSymbol = `BINANCE:${normalizedSymbol}`;

        // Crea container univoco per evitare conflitti
        const uniqueId = `tradingview_chart_${Date.now()}`;
        const container = document.createElement('div');
        container.id = uniqueId;
        container.style.width = '100%';
        container.style.height = '500px';
        containerRef.current.appendChild(container);
        widgetRef.current = container;

        // Configurazione widget TradingView - configurazione minimale per mostrare toolbar completa
        // IMPORTANTE: Non usare parametri che potrebbero nascondere la toolbar
        // Il widget advanced-chart mostra la toolbar di default se non viene nascosta esplicitamente
        const widgetConfig = {
            "autosize": true,
            "symbol": tradingViewSymbol,
            "interval": "15",
            "timezone": "Europe/Rome",
            "theme": "dark",
            "style": "1", // Candlestick - può essere cambiato dalla toolbar
            "locale": "it",
            "enable_publishing": false,
            "hide_top_toolbar": false, // FALSE = mostra toolbar (pulsanti tipo grafico, indicatori, ecc.)
            "hide_legend": false,
            "save_image": false,
            "calendar": false,
            "withdateranges": true,
            "support_host": "https://www.tradingview.com",
            "height": 500,
            "width": "100%",
            "container_id": uniqueId
        };

        script.innerHTML = JSON.stringify(widgetConfig);
        container.appendChild(script);

        // TradingView Widget initialized

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

        // Open positions loaded

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

                    {/* Overlay con marker posizioni e SL/TP */}
                    <TradingViewOverlay
                        openPositions={openPositions}
                        closedTrades={closedTrades}
                        currentPrice={currentPrice}
                        showHistory={localStorage.getItem('crypto_general_settings') ? JSON.parse(localStorage.getItem('crypto_general_settings')).showTradeHistory : true}
                    />
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
                                                    ${pos.entry_price.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

