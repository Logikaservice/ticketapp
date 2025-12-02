import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity, Power, RefreshCw, Wallet } from 'lucide-react';
import './CryptoLayout.css';

const CryptoDashboard = () => {
    const [portfolio, setPortfolio] = useState({ balance_usd: 10000, holdings: {}, rsi: null }); // balance_usd is now treated as EUR
    const [trades, setTrades] = useState([]);
    const [botStatus, setBotStatus] = useState({ active: false, strategy: 'RSI_Strategy' });
    const [priceData, setPriceData] = useState([]);
    const [currentPrice, setCurrentPrice] = useState(0);

    // Determine API base URL
    // Use relative path for production (handled by Nginx) and localhost for dev
    const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';

    const [allTrades, setAllTrades] = useState([]); // For chart plotting

    const fetchData = async () => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/dashboard`);
            if (res.ok) {
                const data = await res.json();
                setPortfolio({ ...data.portfolio, rsi: data.rsi });
                setTrades(data.recent_trades);
                setAllTrades(data.all_trades || []); // Store full history for chart
                const bot = data.active_bots.find(b => b.strategy_name === 'RSI_Strategy');
                if (bot) setBotStatus({ active: bot.is_active === 1, strategy: bot.strategy_name });
            }
        } catch (error) {
            console.error("Error fetching dashboard:", error);
        }
    };

    const fetchPrice = async () => {
        try {
            // Fetch real Solana price in EUR
            const res = await fetch(`${apiBase}/api/crypto/price/solana?currency=eur`);
            if (res.ok) {
                const data = await res.json();
                const price = parseFloat(data.data.priceUsd);
                setCurrentPrice(price);

                setPriceData(prev => {
                    const newData = [...prev, { time: new Date().toLocaleTimeString(), price }];
                    if (newData.length > 50) newData.shift(); // Keep more history for chart
                    return newData;
                });
            }
        } catch (error) {
            // Fallback mock data if API fails
            const mockPrice = 200 + Math.random() * 5; // Mock SOL price
            setCurrentPrice(mockPrice);
            setPriceData(prev => {
                const newData = [...prev, { time: new Date().toLocaleTimeString(), price: mockPrice }];
                if (newData.length > 50) newData.shift();
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
    const totalBalance = portfolio.balance_usd + ((portfolio.holdings['solana'] || 0) * currentPrice);

    // Calculate P&L
    const holdings = portfolio.holdings['solana'] || 0;
    const avgPrice = portfolio.avg_buy_price || 0;
    const investedValue = holdings * avgPrice;
    const currentValue = holdings * currentPrice;
    const pnlValue = currentValue - investedValue;
    const pnlPercent = investedValue > 0 ? (pnlValue / investedValue) * 100 : 0;

    // Prepare Chart Data with Trades
    const chartData = priceData.map(point => {
        // Find if any trade happened around this time (simple matching for demo)
        const trade = allTrades.find(t => {
            const tradeTime = new Date(t.timestamp).getTime();
            // Match within 1 minute window for demo visualization
            // If point.timestamp is missing (live data), we approximate
            const pointTime = point.timestamp ? new Date(point.timestamp).getTime() : Date.now();
            return Math.abs(tradeTime - pointTime) < 60000;
        });

        return {
            ...point,
            buy: trade && trade.type === 'buy' ? point.price : null,
            sell: trade && trade.type === 'sell' ? point.price : null
        };
    });

    // Custom Dot for Trades
    const TradeMarker = (props) => {
        const { cx, cy, payload } = props;
        if (payload.buy) return <circle cx={cx} cy={cy} r={6} fill="#4ade80" stroke="#fff" strokeWidth={2} />;
        if (payload.sell) return <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />;
        return null;
    };

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

            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
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
                            (Avg Price: €{avgPrice.toFixed(2)})
                        </span>
                    </div>
                </div>
            </div>

            <div className="crypto-grid">
                <div className="crypto-card">
                    <div className="card-title">
                        <Activity size={20} className="text-blue-500" />
                        Solana / EUR Live Market
                    </div>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <XAxis dataKey="time" hide />
                                <YAxis domain={['auto', 'auto']} hide />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1c1c1e', border: 'none', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ display: 'none' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="price"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={<TradeMarker />}
                                    animationDuration={500}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '1.2rem', fontWeight: 'bold' }}>
                        1 SOL = €{currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                </div>

                <div className="crypto-card">
                    <div className="card-title">
                        <Power size={20} className={botStatus.active ? "text-green-500" : "text-gray-500"} />
                        AI Bot Control
                    </div>
                    <div className="bot-status-container">
                        <div className={`bot-indicator ${botStatus.active ? 'bot-active' : 'bot-inactive'}`}>
                            <Activity size={32} />
                        </div>
                        <div>
                            <h3>{botStatus.active ? "AI Trading Active" : "AI Paused"}</h3>
                            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Strategy: RSI Momentum</p>
                            {portfolio.rsi !== undefined && portfolio.rsi !== null && (
                                <div style={{ marginTop: '5px', fontSize: '0.9rem', fontWeight: 'bold', color: portfolio.rsi < 30 ? '#10b981' : portfolio.rsi > 70 ? '#ef4444' : '#f59e0b' }}>
                                    RSI: {portfolio.rsi.toFixed(2)}
                                    <span style={{ marginLeft: '5px', fontWeight: 'normal', color: '#9ca3af' }}>
                                        ({portfolio.rsi < 30 ? 'Oversold - BUY' : portfolio.rsi > 70 ? 'Overbought - SELL' : 'Neutral'})
                                    </span>
                                </div>
                            )}
                            {(portfolio.rsi === null || portfolio.rsi === undefined) && (
                                <div style={{ marginTop: '5px', fontSize: '0.8rem', color: '#6b7280' }}>
                                    Gathering data for RSI...
                                </div>
                            )}
                        </div>
                        <button className="toggle-btn" onClick={toggleBot}>
                            {botStatus.active ? "Stop Bot" : "Start Bot"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="crypto-card" style={{ marginTop: '20px' }}>
                <div className="card-title">
                    <RefreshCw size={20} className="text-gray-400" />
                    Recent Trades
                </div>
                <div className="trades-list">
                    {trades.length === 0 ? (
                        <div style={{ color: '#555', textAlign: 'center', padding: '20px' }}>No trades yet. Start the bot!</div>
                    ) : (
                        trades.map((trade, i) => (
                            <div key={i} className="trade-item">
                                <div className="trade-info">
                                    <span className="trade-symbol">{trade.symbol ? trade.symbol.toUpperCase() : 'SOL'}</span>
                                    <span className="trade-time">{new Date(trade.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className={`trade-amount ${trade.type === 'buy' ? 'type-buy' : 'type-sell'}`}>
                                    {trade.type === 'buy' ? '+' : '-'}{trade.amount.toFixed(4)}
                                    <div style={{ fontSize: '0.8rem', color: '#777' }}>@ €{trade.price.toFixed(2)}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default CryptoDashboard;
