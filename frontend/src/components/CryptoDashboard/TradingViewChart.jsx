import React, { useEffect, useRef, useState, useMemo } from 'react';
import TradingViewOverlay from './TradingViewOverlay';
import { formatPriceWithSymbol } from '../../utils/priceFormatter';
import { Maximize2, Minimize2 } from 'lucide-react';
import './TradingViewChart.css';

const TradingViewChart = ({ symbol = 'BTCUSDT', trades = [], openPositions = [], currentPrice = 0, priceHistory = [], closedTrades = [] }) => {
    const containerRef = useRef(null);
    const widgetRef = useRef(null);
    const [markers, setMarkers] = useState([]);
    const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });
    const [timeRange, setTimeRange] = useState({ min: 0, max: 0 });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const fullscreenContainerRef = useRef(null);

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
        // ✅ RIMOSSO: Conversioni EUR -> USDT - tutto è già in USDT
        let normalizedSymbol = symbol;

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
        // In chart-only mode, usa tutta l'altezza dello schermo
        // In fullscreen mode, aumenta l'altezza del 25%
        const isChartOnly = window.location.search.includes('page=chart-only');
        const isInFullscreen = document.fullscreenElement !== null;
        let containerHeight = '750px';
        if (isChartOnly) {
            containerHeight = '100vh';
        } else if (isInFullscreen) {
            // Aumenta del 25% l'altezza in fullscreen
            containerHeight = 'calc((100vh - 200px) * 1.25)';
        }
        container.style.height = containerHeight;
        containerRef.current.appendChild(container);
        widgetRef.current = container;

        // Configurazione widget TradingView - configurazione minimale per mostrare toolbar completa
        // IMPORTANTE: Non usare parametri che potrebbero nascondere la toolbar
        // Il widget advanced-chart mostra la toolbar di default se non viene nascosta esplicitamente
        let widgetHeight = 750;
        if (isChartOnly) {
            widgetHeight = window.innerHeight;
        } else if (isInFullscreen) {
            // Aumenta del 25% l'altezza in fullscreen
            widgetHeight = Math.floor((window.innerHeight - 200) * 1.25);
        }
        
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
            "hide_side_toolbar": false, // ✅ ABILITATO: Mostra toolbar laterale per strumenti di disegno (Trend Line, ecc.)
            "hide_legend": false,
            "save_image": false,
            "calendar": false,
            "withdateranges": true,
            "support_host": "https://www.tradingview.com",
            "height": widgetHeight,
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
    }, [symbol, isFullscreen]); // Rilega anche quando cambia lo stato fullscreen per aggiornare l'altezza

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

    // Fullscreen handler
    const toggleFullscreen = () => {
        if (!isFullscreen) {
            // Enter fullscreen
            const container = containerRef.current?.parentElement;
            if (container && container.requestFullscreen) {
                container.requestFullscreen();
                setIsFullscreen(true);
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    return (
        <div className={`tradingview-chart-container ${isFullscreen ? 'fullscreen-mode' : ''}`} style={{ position: 'relative' }}>
            {/* Pulsante ingrandimento */}
            <button
                onClick={toggleFullscreen}
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(31, 41, 55, 0.9)',
                    color: '#fff',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                    padding: '8px',
                    cursor: 'pointer',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(55, 65, 81, 0.95)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(31, 41, 55, 0.9)'}
                title={isFullscreen ? "Riduci" : "Ingrandisci"}
            >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

            <div className={`chart-main-wrapper ${isFullscreen ? 'fullscreen-chart' : ''}`}>
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

                {/* Operazioni Bot - A DESTRA del grafico (solo quando NON è fullscreen) */}
                {!isFullscreen && (
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
                                                        {formatPriceWithSymbol(pos.entry_price, 2)}
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
                )}
            </div>

            {/* Posizioni Aperte sotto il grafico quando è in fullscreen */}
            {isFullscreen && displayPositions.length > 0 && (
                <div className="fullscreen-positions-section">
                    <div className="fullscreen-positions-header">
                        <h3>📊 Posizioni Aperte</h3>
                        <span>{displayPositions.length} posizione{displayPositions.length !== 1 ? 'i' : ''}</span>
                    </div>
                    <div className="fullscreen-positions-grid">
                        {displayPositions
                            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                            .map((pos, index) => {
                                // Calcola P&L per questa posizione
                                const pnl = currentPrice > 0 && pos.entry_price > 0
                                    ? pos.type === 'buy'
                                        ? ((currentPrice - pos.entry_price) / pos.entry_price * 100)
                                        : ((pos.entry_price - currentPrice) / pos.entry_price * 100)
                                    : 0;
                                const pnlColor = pnl >= 0 ? '#4ade80' : '#f87171';

                                return (
                                    <div key={pos.ticket_id || index} className={`fullscreen-position-card ${pos.type}`}>
                                        <div className="position-card-header">
                                            <div className="position-type-badge">
                                                <span className="position-icon">{pos.type === 'buy' ? '↑' : '↓'}</span>
                                                <span className="position-type">{pos.type.toUpperCase()}</span>
                                            </div>
                                            <div className="position-pnl" style={{ color: pnlColor }}>
                                                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                                            </div>
                                        </div>
                                        <div className="position-card-body">
                                            <div className="position-info-row">
                                                <span className="position-label">Entry:</span>
                                                <span className="position-value">{formatPriceWithSymbol(pos.entry_price, 2)}</span>
                                            </div>
                                            <div className="position-info-row">
                                                <span className="position-label">Prezzo Attuale:</span>
                                                <span className="position-value">{formatPriceWithSymbol(currentPrice, 2)}</span>
                                            </div>
                                            <div className="position-info-row">
                                                <span className="position-label">Volume:</span>
                                                <span className="position-value">{pos.volume.toFixed(4)}</span>
                                            </div>
                                            <div className="position-info-row">
                                                <span className="position-label">Aperta:</span>
                                                <span className="position-value">
                                                    {new Date(pos.timestamp).toLocaleString('it-IT', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TradingViewChart;

