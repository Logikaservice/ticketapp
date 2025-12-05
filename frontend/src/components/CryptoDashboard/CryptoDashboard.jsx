import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Activity, Power, RefreshCw, Wallet, Settings, BarChart2, RotateCcw } from 'lucide-react';
import OpenPositions from './OpenPositions';
import TradingViewChart from './TradingViewChart';
import ApexChart from './ApexChart';
import BotSettings from './BotSettings';
import StatisticsPanel from './StatisticsPanel';
import CryptoNotification from './CryptoNotification';
import BacktestPanel from './BacktestPanel';
import { useCryptoWebSocket } from '../../hooks/useCryptoWebSocket';
import './CryptoLayout.css';

const CryptoDashboard = () => {
    const [portfolio, setPortfolio] = useState({ balance_usd: 10000, holdings: {}, rsi: null }); // balance_usd is now treated as EUR
    const [trades, setTrades] = useState([]);
    const [botStatus, setBotStatus] = useState({ active: false, strategy: 'RSI_Strategy' });
    const [priceData, setPriceData] = useState([]);
    const [currentPrice, setCurrentPrice] = useState(0);
    const [currentSymbol, setCurrentSymbol] = useState('bitcoin'); // Current symbol being viewed
    const [availableSymbols, setAvailableSymbols] = useState([]);
    const [activeBots, setActiveBots] = useState([]);

    // Determine API base URL
    const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';

    const [allTrades, setAllTrades] = useState([]); // For chart plotting
    const [openPositions, setOpenPositions] = useState([]);
    const [closedPositions, setClosedPositions] = useState([]); // ✅ FIX: Aggiungi closed positions per recuperare P&L
    const [showBotSettings, setShowBotSettings] = useState(false);
    const [showBacktestPanel, setShowBacktestPanel] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [botParameters, setBotParameters] = useState(null);
    const [useApexChart, setUseApexChart] = useState(false); // Toggle tra TradingView e ApexChart
    
    // WebSocket for real-time notifications
    const { connected: wsConnected } = useCryptoWebSocket(
        // onPositionOpened
        (data) => {
            console.log('📈 Position opened via WebSocket:', data);
            addNotification({ ...data, type: 'opened' });
            // Refresh data immediately (no delay for instant updates)
            fetchData();
            fetchPrice(); // Also update price immediately
        },
        // onPositionClosed
        (data) => {
            console.log('📉 Position closed via WebSocket:', data);
            addNotification({ ...data, type: 'closed' });
            // Refresh data immediately (no delay for instant updates)
            fetchData();
            fetchPrice(); // Also update price immediately
        }
    );

    const addNotification = (notification) => {
        const id = Date.now() + Math.random();
        setNotifications(prev => [...prev, { ...notification, id }]);
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const fetchData = async () => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/dashboard`);
            if (res.ok) {
                const data = await res.json();
                console.log('📊 Dashboard data received:', {
                    portfolio: data.portfolio,
                    tradesCount: data.recent_trades?.length || 0,
                    allTradesCount: data.all_trades?.length || 0,
                    openPositionsCount: data.open_positions?.length || 0
                });
                setPortfolio({ ...data.portfolio, rsi: data.rsi });
                setTrades(data.recent_trades || []);
                setAllTrades(data.all_trades || []); // Store full history for chart
                setOpenPositions(data.open_positions || []); // Store open positions
                setClosedPositions(data.closed_positions || []); // ✅ FIX: Store closed positions per P&L
                const bot = data.active_bots?.find(b => b.strategy_name === 'RSI_Strategy' && b.symbol === currentSymbol);
                if (bot) setBotStatus({ active: bot.is_active === 1, strategy: bot.strategy_name });
                // Load bot parameters for backtesting
                if (data.bot_parameters) {
                    setBotParameters(data.bot_parameters);
                }
            } else {
                console.error('❌ Dashboard fetch failed:', res.status, res.statusText);
            }
        } catch (error) {
            console.error("❌ Error fetching dashboard:", error);
        }
    };

    const fetchAvailableSymbols = async () => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/symbols/available`);
            if (res.ok) {
                const data = await res.json();
                console.log('📊 Available symbols received:', data.symbols?.length || 0, 'symbols');
                setAvailableSymbols(data.symbols || []);
            } else {
                console.error('❌ Error fetching symbols:', res.status, res.statusText);
            }
        } catch (error) {
            console.error("❌ Error fetching available symbols:", error);
        }
    };

    const fetchActiveBots = async () => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/bot/active`);
            if (res.ok) {
                const data = await res.json();
                setActiveBots(data.active_bots || []);
            }
        } catch (error) {
            console.error("❌ Error fetching active bots:", error);
        }
    };

    const handleUpdatePnL = async () => {
        try {
            await fetch(`${apiBase}/api/crypto/positions/update-pnl?symbol=bitcoin`);
            // Refresh positions after update
            const res = await fetch(`${apiBase}/api/crypto/positions?status=open`);
            if (res.ok) {
                const data = await res.json();
                setOpenPositions(data.positions || []);
            }
        } catch (error) {
            console.error("Error updating P&L:", error);
        }
    };

    const handleClosePosition = async (ticketId) => {
        try {
            // Pass current price to ensure correct closing price
            const res = await fetch(`${apiBase}/api/crypto/positions/close/${ticketId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    close_price: currentPrice,
                    symbol: 'bitcoin'
                })
            });
            if (res.ok) {
                // Refresh data
                fetchData();
            } else {
                const error = await res.json();
                alert(error.error || 'Errore nella chiusura della posizione');
            }
        } catch (error) {
            console.error("Error closing position:", error);
            alert('Errore nella chiusura della posizione');
        }
    };

    const handleResetPortfolio = async () => {
        const allPositionsCount = openPositions.length + (trades?.length || 0);
        const confirmMessage = `⚠️ ATTENZIONE: Reset completo del portfolio!\n\nQuesto cancellerà:\n${openPositions.length > 0 ? `- ${openPositions.length} posizione/i aperta/e\n` : ''}- TUTTE le posizioni (aperte e chiuse)\n- TUTTI i trades (marker sul grafico e lista recenti)\n\nE poi:\n- Imposterà il saldo a €250\n- Resetterà tutte le holdings\n\nVuoi continuare?`;
        
        if (!window.confirm(confirmMessage)) {
            return;
        }
        
        try {
            const res = await fetch(`${apiBase}/api/crypto/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (res.ok) {
                const result = await res.json();
                alert(result.message || 'Portfolio resettato completamente!');
                // Refresh data
                fetchData();
            } else {
                const error = await res.json();
                alert(error.error || 'Errore nel reset del portfolio');
            }
        } catch (error) {
            console.error("Error resetting portfolio:", error);
            alert('Errore nel reset del portfolio');
        }
    };

    const fetchPrice = async () => {
        try {
            // Fetch real price for current symbol from Binance (same source as bot)
            const res = await fetch(`${apiBase}/api/crypto/price/${currentSymbol}?currency=eur`);
            if (res.ok) {
                const data = await res.json();
                // Read price directly (EUR from Binance, same as bot uses)
                const price = parseFloat(data.price || data.data?.priceUsd || 0);
                if (price > 0) {
                    setCurrentPrice(price);
                    // NOTE: We don't add to priceData here - the chart uses OHLC data from /api/crypto/history
                }
            }
        } catch (error) {
            console.error('Error fetching price:', error);
            // Don't set mock price - keep using last known price
        }
    };

    const fetchHistory = async (interval = '15m') => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/history?interval=${interval}&symbol=${currentSymbol}`);
            if (res.ok) {
                const history = await res.json();
                setPriceData(history);
            } else {
                console.error('❌ History fetch failed:', res.status, res.statusText);
            }
        } catch (error) {
            console.error("❌ Error fetching history:", error);
        }
    };
    
    // Fetch history for ApexChart (15m di default, ma può cambiare)
    const [apexHistory, setApexHistory] = useState([]);
    const [apexInterval, setApexInterval] = useState('15m'); // Default 15m per corrispondenza
    const fetchApexHistory = async (interval = '15m') => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/history?interval=${interval}&symbol=${currentSymbol}`);
            if (res.ok) {
                const history = await res.json();
                setApexHistory(history);
            } else {
                console.error('❌ ApexChart history fetch failed:', res.status, res.statusText);
            }
        } catch (error) {
            console.error("❌ Error fetching ApexChart history:", error);
        }
    };

    useEffect(() => {
        fetchAvailableSymbols();
        fetchActiveBots();
        fetchHistory(); // Load history first (15m for TradingView)
        fetchApexHistory(apexInterval); // Load history for ApexChart
        fetchData();
        fetchPrice();
        
        // Update price frequently (every 1 second for real-time feel)
        const priceInterval = setInterval(() => {
            fetchPrice();
        }, 1000);
        
        // Update data (positions, trades) every 1.5 seconds for instant updates
        const dataInterval = setInterval(() => {
            fetchData();
            fetchActiveBots(); // Also update active bots
        }, 1500);
        
        // Update history (candles) more frequently (every 5 seconds) for real-time updates
        // ✅ FIX: Aggiornamento più frequente per vedere candele in tempo reale
        const historyInterval = setInterval(() => {
            fetchHistory();
            if (useApexChart) {
                fetchApexHistory(apexInterval); // Update data when using ApexChart
            }
        }, 5000); // Ridotto da 15s a 5s per aggiornamenti più frequenti
        
        return () => {
            clearInterval(priceInterval);
            clearInterval(dataInterval);
            clearInterval(historyInterval);
        };
    }, [currentSymbol]);

    const toggleBot = async (symbol = null) => {
        try {
            const targetSymbol = symbol || currentSymbol;
            const currentBot = activeBots.find(b => b.symbol === targetSymbol);
            const newStatus = currentBot ? !currentBot.is_active : true;
            
            console.log(`🤖 Toggling bot for ${targetSymbol}, new status: ${newStatus}`);
            
            const response = await fetch(`${apiBase}/api/crypto/bot/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    strategy_name: 'RSI_Strategy', 
                    symbol: targetSymbol,
                    is_active: newStatus 
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error("❌ Error toggling bot:", errorData);
                alert(`Errore nell'attivazione del bot: ${errorData.error || response.statusText}`);
                return;
            }
            
            const result = await response.json();
            console.log('✅ Bot toggle result:', result);
            
            // Update local state
            if (targetSymbol === currentSymbol) {
                setBotStatus(prev => ({ ...prev, active: newStatus }));
            }
            
            // Refresh active bots list
            await fetchActiveBots();
            
            // Show success message
            if (newStatus) {
                const symbolInfo = availableSymbols.find(s => s.symbol === targetSymbol);
                alert(`Bot attivato per ${symbolInfo?.display || targetSymbol.toUpperCase()}`);
            } else {
                const symbolInfo = availableSymbols.find(s => s.symbol === targetSymbol);
                alert(`Bot disattivato per ${symbolInfo?.display || targetSymbol.toUpperCase()}`);
            }
        } catch (error) {
            console.error("❌ Error toggling bot:", error);
            alert(`Errore nell'attivazione del bot: ${error.message || 'Errore di connessione'}`);
        }
    };

    // Calculate total balance (EUR + All Crypto values)
    const [allSymbolPrices, setAllSymbolPrices] = useState({});
    
    // Fetch prices for all symbols in holdings
    useEffect(() => {
        const fetchAllPrices = async () => {
            const holdings = portfolio.holdings || {};
            const symbols = Object.keys(holdings).filter(s => holdings[s] > 0);
            const prices = {};
            
            for (const symbol of symbols) {
                try {
                    const res = await fetch(`${apiBase}/api/crypto/price/${symbol}?currency=eur`);
                    if (res.ok) {
                        const data = await res.json();
                        prices[symbol] = parseFloat(data.price || 0);
                    }
                } catch (error) {
                    console.error(`Error fetching price for ${symbol}:`, error);
                }
            }
            
            setAllSymbolPrices(prices);
        };
        
        if (Object.keys(portfolio.holdings || {}).length > 0) {
            fetchAllPrices();
        }
    }, [portfolio.holdings, apiBase]);
    
    // Calculate total balance including all holdings
    const holdings = portfolio.holdings || {};
    let totalCryptoValue = 0;
    Object.keys(holdings).forEach(symbol => {
        const amount = holdings[symbol] || 0;
        const price = allSymbolPrices[symbol] || (symbol === currentSymbol ? currentPrice : 0);
        totalCryptoValue += amount * price;
    });
    
    const totalBalance = portfolio.balance_usd + totalCryptoValue;

    // Calculate P&L for current symbol only (for display)
    const currentHoldings = holdings[currentSymbol] || 0;
    const avgPrice = portfolio.avg_buy_price || 0;
    const investedValue = currentHoldings * avgPrice;
    const currentValue = currentHoldings * currentPrice;
    const pnlValue = currentValue - investedValue;
    const pnlPercent = investedValue > 0 ? (pnlValue / investedValue) * 100 : 0;

    // TradingView Chart doesn't need chartData preparation anymore

    return (
        <div className="crypto-dashboard">
            <div className="crypto-header">
                <div className="crypto-title">
                    <span style={{ color: '#fff' }}>Revolut</span> <span style={{ color: '#3b82f6' }}>X</span> Clone
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9ca3af' }}>
                    <Wallet size={18} /> Demo Account
                </div>
            </div>

            {/* TOP STATS GRID - 3 COLUMNS */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr', gap: '20px', marginBottom: '20px' }}>
                <div className="balance-card" style={{ marginBottom: 0 }}>
                    <div className="balance-label">Total Balance</div>
                    <div className="balance-amount">€{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="balance-change change-positive">
                        <ArrowUpRight size={16} /> +2.4% Today
                    </div>
                </div>

                <div className="balance-card" style={{ marginBottom: 0, background: 'linear-gradient(145deg, #1c1c1e, #2a2a2d)' }}>
                    <div className="balance-label">Open Position P&L</div>
                    <div className={`balance-amount ${pnlValue >= 0 ? 'text-green-500' : 'text-red-500'}`} style={{ fontSize: '2.5rem' }}>
                        {pnlValue >= 0 ? '+' : ''}€{pnlValue.toFixed(2)}
                    </div>
                    <div style={{ color: pnlValue >= 0 ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                        {pnlValue >= 0 ? '▲' : '▼'} {pnlPercent.toFixed(2)}%
                        <span style={{ color: '#9ca3af', marginLeft: '10px', fontSize: '0.9rem', fontWeight: 'normal' }}>
                            (Avg: €{avgPrice.toFixed(2)})
                        </span>
                    </div>
                </div>

                {/* Compact Bot Control */}
                <div className="balance-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="balance-label">AI Bot Status</div>
                        <Power size={20} className={botStatus.active ? "text-green-500" : "text-gray-500"} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                        <div className={`bot-indicator ${botStatus.active ? 'bot-active' : 'bot-inactive'}`} style={{ width: '40px', height: '40px' }}>
                            <Activity size={20} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 'bold', color: botStatus.active ? '#4ade80' : '#9ca3af' }}>
                                {botStatus.active ? "Active" : "Paused"}
                            </div>
                            {portfolio.rsi !== null && (
                                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>RSI: {portfolio.rsi.toFixed(2)}</div>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <button 
                            className="toggle-btn" 
                            onClick={toggleBot} 
                            style={{ flex: 1, padding: '8px', fontSize: '0.9rem' }}
                        >
                            {botStatus.active ? "Stop Bot" : "Start Bot"}
                        </button>
                        <button 
                            className="toggle-btn" 
                            onClick={() => setShowBotSettings(true)}
                            style={{ padding: '8px', fontSize: '0.9rem', minWidth: '40px' }}
                            title="Configurazione Bot"
                        >
                            <Settings size={18} />
                        </button>
                        <button 
                            className="toggle-btn" 
                            onClick={() => setShowBacktestPanel(true)}
                            style={{ padding: '8px', fontSize: '0.9rem', minWidth: '40px' }}
                            title="Backtesting Strategia"
                        >
                            <BarChart2 size={18} />
                        </button>
                        <button 
                            className="toggle-btn" 
                            onClick={() => {
                                const url = new URL(window.location);
                                url.searchParams.set('domain', 'crypto');
                                url.searchParams.set('page', 'bot-analysis');
                                url.searchParams.set('symbol', currentSymbol);
                                window.open(url.toString(), 'BotAnalysis', 'width=1200,height=800,resizable=yes,scrollbars=yes');
                            }}
                            style={{ padding: '8px', fontSize: '0.9rem', minWidth: '40px', background: '#3b82f6' }}
                            title={`Analisi Bot in Tempo Reale per ${currentSymbol.toUpperCase()} - Apri in nuova finestra`}
                        >
                            🔍
                        </button>
                        <button 
                            className="toggle-btn" 
                            onClick={handleResetPortfolio}
                            style={{ padding: '8px', fontSize: '0.9rem', minWidth: '40px', background: '#ef4444', color: '#fff' }}
                            title="Reset Portfolio a €250"
                        >
                            <RotateCcw size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ACTIVE BOTS PANEL */}
            {activeBots.length > 0 && (
                <div className="crypto-card" style={{ marginBottom: '20px' }}>
                    <div className="card-title">
                        <Activity size={20} className="text-green-500" />
                        Bot Attivi ({activeBots.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px' }}>
                        {activeBots.map((bot, idx) => {
                            const symbolInfo = availableSymbols.find(s => s.symbol === bot.symbol);
                            return (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        setCurrentSymbol(bot.symbol);
                                        setPriceData([]);
                                        setApexHistory([]);
                                    }}
                                    style={{
                                        background: 'linear-gradient(145deg, #1c1c1e, #2a2a2d)',
                                        border: '2px solid #4ade80',
                                        borderRadius: '8px',
                                        padding: '12px 16px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        minWidth: '150px'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.05)';
                                        e.currentTarget.style.borderColor = '#22c55e';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.borderColor = '#4ade80';
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <div style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            background: '#4ade80',
                                            animation: 'pulse 2s infinite'
                                        }} />
                                        <span style={{ fontWeight: 'bold', color: '#fff' }}>
                                            {symbolInfo?.display || bot.symbol.toUpperCase()}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                                        {bot.strategy_name}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>
                                        Clicca per visualizzare
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ADVANCED STATISTICS PANEL */}
            <StatisticsPanel apiBase={apiBase} />

            {/* MAIN CRYPTO GRID - CHART & OPEN POSITIONS */}
            <div className="crypto-grid">
                <div className="crypto-card">
                    <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <Activity size={20} className="text-blue-500" />
                            <select
                                value={currentSymbol}
                                onChange={(e) => {
                                    setCurrentSymbol(e.target.value);
                                    // Reset price data when changing symbol
                                    setPriceData([]);
                                    setApexHistory([]);
                                }}
                                style={{
                                    background: '#1f2937',
                                    color: '#fff',
                                    border: '1px solid #374151',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    minWidth: '150px'
                                }}
                            >
                                {availableSymbols.map(s => (
                                    <option key={s.symbol} value={s.symbol}>
                                        {s.display} {s.bot_active ? '🤖' : ''}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => toggleBot(currentSymbol)}
                                style={{
                                    background: activeBots.find(b => b.symbol === currentSymbol) 
                                        ? '#ef4444' 
                                        : '#4ade80',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                                title={activeBots.find(b => b.symbol === currentSymbol) 
                                    ? 'Disattiva Bot per questo simbolo' 
                                    : 'Attiva Bot per questo simbolo'}
                            >
                                {activeBots.find(b => b.symbol === currentSymbol) ? (
                                    <>⏸️ Stop Bot</>
                                ) : (
                                    <>▶️ Start Bot</>
                                )}
                            </button>
                            <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                                {availableSymbols.find(s => s.symbol === currentSymbol)?.display || 'Live Market'}
                            </span>
                            {activeBots.find(b => b.symbol === currentSymbol) && (
                                <span style={{ 
                                    background: '#4ade80', 
                                    color: '#fff', 
                                    padding: '2px 8px', 
                                    borderRadius: '4px', 
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                }}>
                                    BOT ATTIVO
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setUseApexChart(!useApexChart)}
                            style={{
                                padding: '6px 12px',
                                background: useApexChart ? '#4ade80' : '#3f3f46',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '500',
                                transition: 'all 0.2s'
                            }}
                            title={useApexChart ? 'Passa a TradingView (con tool di disegno)' : 'Passa ad ApexChart (con marker precisi e aggiornamenti real-time)'}
                        >
                            {useApexChart ? '📊 TradingView' : '📍 ApexChart'}
                        </button>
                    </div>
                    {useApexChart ? (
                        <ApexChart
                            symbol={availableSymbols.find(s => s.symbol === currentSymbol)?.pair || 'BTCEUR'}
                            trades={(allTrades || []).filter(t => t.symbol === currentSymbol).map(trade => ({
                                type: trade.type,
                                timestamp: trade.timestamp,
                                price: typeof trade.price === 'number' ? trade.price : parseFloat(trade.price),
                                amount: typeof trade.amount === 'number' ? trade.amount : parseFloat(trade.amount),
                                strategy: trade.strategy || 'Bot',
                                ticket_id: trade.ticket_id || null
                            }))}
                            openPositions={(openPositions || []).filter(p => p.symbol === currentSymbol)}
                            currentPrice={currentPrice}
                            priceHistory={apexHistory.length > 0 ? apexHistory : priceData || []}
                            currentInterval={apexInterval}
                            onIntervalChange={(newInterval) => {
                                setApexInterval(newInterval);
                                fetchApexHistory(newInterval);
                            }}
                        />
                    ) : (
                        <TradingViewChart
                            symbol={availableSymbols.find(s => s.symbol === currentSymbol)?.pair || 'BTCEUR'}
                            trades={(allTrades || []).filter(t => t.symbol === currentSymbol).map(trade => ({
                                type: trade.type,
                                timestamp: trade.timestamp,
                                price: typeof trade.price === 'number' ? trade.price : parseFloat(trade.price),
                                amount: typeof trade.amount === 'number' ? trade.amount : parseFloat(trade.amount),
                                strategy: trade.strategy || 'Bot',
                                ticket_id: trade.ticket_id || null
                            }))}
                            openPositions={(openPositions || []).filter(p => p.symbol === currentSymbol)}
                            currentPrice={currentPrice}
                            priceHistory={priceData || []}
                        />
                    )}
                </div>

                {/* MT5 Style Open Positions */}
                <div className="crypto-card" style={{ gridColumn: 'span 2' }}>
                    <OpenPositions
                        positions={openPositions}
                        currentPrice={currentPrice}
                        onClosePosition={handleClosePosition}
                        onUpdatePnL={handleUpdatePnL}
                    />
                </div>
            </div>

            {/* RECENT TRADES HISTORY */}
            <div className="crypto-card" style={{ marginTop: '20px' }}>
                <div className="card-title">
                    <RefreshCw size={20} className="text-gray-400" />
                    Recent Trades History
                </div>
                <div className="trades-list">
                    {trades.length === 0 ? (
                        <div style={{ color: '#555', textAlign: 'center', padding: '20px' }}>No trades yet. Start the bot!</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ color: '#6b7280', borderBottom: '1px solid #374151' }}>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Time</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Symbol</th>
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>Price</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>Total</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>P&L</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trades.map((trade, i) => {
                                    // ✅ FIX: closedPositions è ora disponibile nello scope
                                    const isBuy = trade.type === 'buy';
                                    const totalValue = trade.amount * trade.price;
                                    let pnl = trade.profit_loss;

                                    // ✅ FIX: Se il trade ha un ticket_id, cerca la posizione corrispondente per ottenere il P&L
                                    if (pnl === null && trade.ticket_id) {
                                        const correspondingPosition = openPositions.find(pos => pos.ticket_id === trade.ticket_id) ||
                                                                   closedPositions?.find(pos => pos.ticket_id === trade.ticket_id);
                                        if (correspondingPosition && correspondingPosition.profit_loss !== null) {
                                            pnl = correspondingPosition.profit_loss;
                                        }
                                    }

                                    // Check if this trade has a corresponding open position
                                    const hasOpenPosition = isBuy && openPositions.some(pos => 
                                        (pos.ticket_id === trade.ticket_id) || // Match by ticket_id (preferito)
                                        (pos.type === 'buy' && 
                                         Math.abs(parseFloat(pos.entry_price) - parseFloat(trade.price)) < 0.01 &&
                                         Math.abs(parseFloat(pos.volume) - parseFloat(trade.amount)) < 0.0001)
                                    );

                                    // ✅ FIX: Usa il prezzo corretto per il simbolo del trade, non sempre Bitcoin
                                    let symbolCurrentPrice = currentPrice; // Default
                                    if (trade.symbol && trade.symbol !== 'bitcoin') {
                                        // Prova a ottenere il prezzo dal portfolio o usa il prezzo corrente se disponibile
                                        const symbolPrice = allSymbolPrices?.[trade.symbol];
                                        if (symbolPrice) {
                                            symbolCurrentPrice = symbolPrice;
                                        }
                                    }

                                    // Theoretical P&L for BUYs ONLY if position is still open
                                    const theoreticalPnl = (isBuy && hasOpenPosition) ? (symbolCurrentPrice - trade.price) * trade.amount : 0;
                                    const theoreticalPnlPercent = (isBuy && hasOpenPosition) ? ((symbolCurrentPrice - trade.price) / trade.price) * 100 : 0;

                                    // Get symbol display name
                                    const symbolDisplay = trade.symbol ? (trade.symbol === 'bitcoin' ? 'BTC/EUR' : 
                                        trade.symbol === 'bitcoin_usdt' ? 'BTC/USDT' :
                                        trade.symbol === 'solana' ? 'SOL/USDT' :
                                        trade.symbol === 'solana_eur' ? 'SOL/EUR' :
                                        trade.symbol.toUpperCase().replace('_', '/')) : '-';
                                    
                                    // Show P&L if available (for both BUY and SELL)
                                    const displayPnl = pnl !== null && pnl !== undefined ? (
                                        <span style={{ color: pnl >= 0 ? '#4ade80' : '#ef4444', fontWeight: 'bold' }}>
                                            {pnl >= 0 ? '+' : ''}€{pnl.toFixed(2)}
                                        </span>
                                    ) : isBuy && hasOpenPosition ? (
                                        <span style={{ color: theoreticalPnl >= 0 ? '#4ade80' : '#ef4444', fontSize: '0.85rem' }}>
                                            {theoreticalPnl >= 0 ? '+' : ''}€{theoreticalPnl.toFixed(2)} ({theoreticalPnlPercent.toFixed(2)}%)
                                            <br />
                                            <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Unrealized</span>
                                        </span>
                                    ) : isBuy ? (
                                        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                                            Chiusa
                                        </span>
                                    ) : (
                                        <span style={{ color: '#6b7280' }}>-</span>
                                    );

                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
                                            <td style={{ padding: '10px', color: '#9ca3af' }}>
                                                {new Date(trade.timestamp).toLocaleTimeString()}
                                            </td>
                                            <td style={{ padding: '10px', color: '#e5e7eb', fontWeight: '500' }}>
                                                {symbolDisplay}
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                <span style={{
                                                    color: isBuy ? '#4ade80' : '#ef4444',
                                                    fontWeight: 'bold',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {trade.type}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right', color: '#e5e7eb' }}>
                                                €{trade.price.toFixed(2)}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right', color: '#e5e7eb' }}>
                                                {trade.amount.toFixed(4)}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right', color: '#9ca3af' }}>
                                                €{totalValue.toFixed(2)}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right' }}>
                                                {displayPnl}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                                {trade.signal_details || trade.ticket_id ? (
                                                    <button
                                                        onClick={() => {
                                                            try {
                                                                let signalData = null;
                                                                if (trade.signal_details) {
                                                                    signalData = typeof trade.signal_details === 'string' 
                                                                        ? JSON.parse(trade.signal_details) 
                                                                        : trade.signal_details;
                                                                } else {
                                                                    const position = openPositions.find(pos => pos.ticket_id === trade.ticket_id);
                                                                    if (position && position.signal_details) {
                                                                        signalData = typeof position.signal_details === 'string'
                                                                            ? JSON.parse(position.signal_details)
                                                                            : position.signal_details;
                                                                    }
                                                                }
                                                                
                                                                if (signalData) {
                                                                    const details = [
                                                                        `📊 SIGNAL DETAILS`,
                                                                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                                                                        `Direction: ${signalData.direction || 'N/A'}`,
                                                                        `Strength: ${signalData.strength || 0}/100`,
                                                                        `Confirmations: ${signalData.confirmations || 0}`,
                                                                        ``,
                                                                        `📋 REASONS:`,
                                                                        ...(signalData.reasons || []).map((r, i) => `${i + 1}. ${r}`),
                                                                        ``,
                                                                        `📈 LONG SIGNAL:`,
                                                                        signalData.longSignal ? 
                                                                            `  Strength: ${signalData.longSignal.strength || 0}/100\n  Confirmations: ${signalData.longSignal.confirmations || 0}\n  Reasons: ${(signalData.longSignal.reasons || []).join(', ')}` :
                                                                            '  N/A',
                                                                        ``,
                                                                        `📉 SHORT SIGNAL:`,
                                                                        signalData.shortSignal ?
                                                                            `  Strength: ${signalData.shortSignal.strength || 0}/100\n  Confirmations: ${signalData.shortSignal.confirmations || 0}\n  Reasons: ${(signalData.shortSignal.reasons || []).join(', ')}` :
                                                                            '  N/A',
                                                                        ``,
                                                                        `📊 INDICATORS:`,
                                                                        `  RSI: ${signalData.indicators?.rsi?.toFixed(2) || 'N/A'}`,
                                                                        `  Trend: ${signalData.indicators?.trend || 'N/A'}`,
                                                                        signalData.indicators?.macd ? 
                                                                            `  MACD: ${signalData.indicators.macd.macdLine?.toFixed(2) || 'N/A'} | Signal: ${signalData.indicators.macd.signalLine?.toFixed(2) || 'N/A'}` :
                                                                            '  MACD: N/A'
                                                                    ].join('\n');
                                                                    alert(details);
                                                                } else {
                                                                    alert(`Trade Details:\n\nSymbol: ${symbolDisplay}\nType: ${trade.type}\nPrice: €${trade.price.toFixed(2)}\nAmount: ${trade.amount.toFixed(4)}\nStrategy: ${trade.strategy || 'N/A'}\nP&L: ${pnl !== null ? (pnl >= 0 ? '+' : '') + '€' + pnl.toFixed(2) : 'N/A'}`);
                                                                }
                                                            } catch (err) {
                                                                console.error('Error parsing signal details:', err);
                                                                alert(`Trade Details:\n\nSymbol: ${symbolDisplay}\nType: ${trade.type}\nPrice: €${trade.price.toFixed(2)}\nAmount: ${trade.amount.toFixed(4)}\nStrategy: ${trade.strategy || 'N/A'}\nP&L: ${pnl !== null ? (pnl >= 0 ? '+' : '') + '€' + pnl.toFixed(2) : 'N/A'}`);
                                                            }
                                                        }}
                                                        style={{
                                                            background: 'transparent',
                                                            border: '1px solid #4b5563',
                                                            color: '#9ca3af',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.75rem'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.background = '#374151'}
                                                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                                    >
                                                        View
                                                    </button>
                                                ) : (
                                                    <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Bot Settings Modal */}
            <BotSettings
                isOpen={showBotSettings}
                onClose={() => setShowBotSettings(false)}
                apiBase={apiBase}
            />

            {/* Backtest Panel Modal */}
            <BacktestPanel
                isOpen={showBacktestPanel}
                onClose={() => setShowBacktestPanel(false)}
                apiBase={apiBase}
                currentBotParams={botParameters}
            />


            {/* Real-time Notifications */}
            <div className="crypto-notifications-container">
                {notifications.map(notification => (
                    <CryptoNotification
                        key={notification.id}
                        notification={notification}
                        onClose={() => removeNotification(notification.id)}
                    />
                ))}
            </div>
        </div>
    );
};

export default CryptoDashboard;
