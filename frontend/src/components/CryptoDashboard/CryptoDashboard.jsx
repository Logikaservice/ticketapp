import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Activity, Power, RefreshCw, Wallet, Settings, BarChart2, RotateCcw } from 'lucide-react';
import OpenPositions from './OpenPositions';
import LightweightChart from './LightweightChart';
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

    // Determine API base URL
    const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';

    const [allTrades, setAllTrades] = useState([]); // For chart plotting
    const [openPositions, setOpenPositions] = useState([]);
    const [showBotSettings, setShowBotSettings] = useState(false);
    const [showBacktestPanel, setShowBacktestPanel] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [botParameters, setBotParameters] = useState(null);
    
    // WebSocket for real-time notifications
    const { connected: wsConnected } = useCryptoWebSocket(
        // onPositionOpened
        (data) => {
            console.log('📈 Position opened via WebSocket:', data);
            addNotification({ ...data, type: 'opened' });
            // Refresh data immediately
            setTimeout(() => {
                fetchData();
            }, 500);
        },
        // onPositionClosed
        (data) => {
            console.log('📉 Position closed via WebSocket:', data);
            addNotification({ ...data, type: 'closed' });
            // Refresh data immediately
            setTimeout(() => {
                fetchData();
            }, 500);
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
                const bot = data.active_bots?.find(b => b.strategy_name === 'RSI_Strategy');
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
            // Fetch real Bitcoin price in EUR
            const res = await fetch(`${apiBase}/api/crypto/price/bitcoin?currency=eur`);
            if (res.ok) {
                const data = await res.json();
                const price = parseFloat(data.data.priceUsd);
                setCurrentPrice(price);

                setPriceData(prev => {
                    const now = new Date();
                    const newData = [...prev, {
                        time: now.toLocaleTimeString(),
                        price,
                        timestamp: now.toISOString()
                    }];
                    if (newData.length > 500) newData.shift(); // Keep more history for chart
                    return newData;
                });
            }
        } catch (error) {
            // Fallback mock data if API fails
            const mockPrice = 200 + Math.random() * 5; // Mock SOL price
            setCurrentPrice(mockPrice);
            setPriceData(prev => {
                const now = new Date();
                const newData = [...prev, {
                    time: now.toLocaleTimeString(),
                    price: mockPrice,
                    timestamp: now.toISOString()
                }];
                if (newData.length > 500) newData.shift();
                return newData;
            });
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/history`);
            if (res.ok) {
                const history = await res.json();
                setPriceData(history);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        }
    };

    useEffect(() => {
        fetchHistory(); // Load history first
        fetchData();
        fetchPrice();
        const interval = setInterval(() => {
            fetchData();
            fetchPrice();
        }, 3000); // Update every 3 seconds
        return () => clearInterval(interval);
    }, []);

    const toggleBot = async () => {
        try {
            const newStatus = !botStatus.active;
            await fetch(`${apiBase}/api/crypto/bot/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategy_name: 'RSI_Strategy', is_active: newStatus })
            });
            setBotStatus(prev => ({ ...prev, active: newStatus }));
        } catch (error) {
            console.error("Error toggling bot:", error);
        }
    };

    // Calculate total balance (EUR + Crypto value)
    const totalBalance = portfolio.balance_usd + ((portfolio.holdings['bitcoin'] || 0) * currentPrice);

    // Calculate P&L
    const holdings = portfolio.holdings['bitcoin'] || 0;
    const avgPrice = portfolio.avg_buy_price || 0;
    const investedValue = holdings * avgPrice;
    const currentValue = holdings * currentPrice;
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
                            onClick={handleResetPortfolio}
                            style={{ padding: '8px', fontSize: '0.9rem', minWidth: '40px', background: '#ef4444', color: '#fff' }}
                            title="Reset Portfolio a €250"
                        >
                            <RotateCcw size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ADVANCED STATISTICS PANEL */}
            <StatisticsPanel apiBase={apiBase} />

            {/* MAIN CRYPTO GRID - CHART & OPEN POSITIONS */}
            <div className="crypto-grid">
                <div className="crypto-card">
                    <div className="card-title">
                        <Activity size={20} className="text-blue-500" />
                        Bitcoin / EUR Live Market
                    </div>
                    <LightweightChart
                        symbol="BTCEUR"
                        trades={(allTrades || []).map(trade => ({
                            type: trade.type,
                            timestamp: trade.timestamp,
                            price: typeof trade.price === 'number' ? trade.price : parseFloat(trade.price),
                            amount: typeof trade.amount === 'number' ? trade.amount : parseFloat(trade.amount),
                            strategy: trade.strategy || 'Bot'
                        }))}
                        currentPrice={currentPrice}
                        priceHistory={(priceData || []).map(point => ({
                            timestamp: point.timestamp || point.time,
                            price: typeof point.price === 'number' ? point.price : parseFloat(point.price)
                        })).filter(p => p.timestamp && !isNaN(p.price))}
                    />
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
                                    <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>Price</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>Total</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>P&L / Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trades.map((trade, i) => {
                                    const isBuy = trade.type === 'buy';
                                    const totalValue = trade.amount * trade.price;
                                    const pnl = trade.profit_loss;

                                    // Theoretical P&L for BUYs (Open Positions)
                                    const theoreticalPnl = isBuy ? (currentPrice - trade.price) * trade.amount : 0;
                                    const theoreticalPnlPercent = isBuy ? ((currentPrice - trade.price) / trade.price) * 100 : 0;

                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
                                            <td style={{ padding: '10px', color: '#9ca3af' }}>
                                                {new Date(trade.timestamp).toLocaleTimeString()}
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
                                                {!isBuy && pnl !== null ? (
                                                    <span style={{ color: pnl >= 0 ? '#4ade80' : '#ef4444', fontWeight: 'bold' }}>
                                                        {pnl >= 0 ? '+' : ''}€{pnl.toFixed(2)}
                                                    </span>
                                                ) : isBuy ? (
                                                    <span style={{ color: theoreticalPnl >= 0 ? '#4ade80' : '#ef4444', fontSize: '0.85rem' }}>
                                                        {theoreticalPnl >= 0 ? '+' : ''}€{theoreticalPnl.toFixed(2)} ({theoreticalPnlPercent.toFixed(2)}%)
                                                        <br />
                                                        <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Unrealized</span>
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#6b7280' }}>-</span>
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
