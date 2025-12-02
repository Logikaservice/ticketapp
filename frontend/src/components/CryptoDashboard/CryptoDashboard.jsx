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
    // Force HTTPS URL for production to avoid any relative path ambiguity
    const apiBase = window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : 'https://ticket.logikaservice.it';

    console.log("CryptoDashboard API Base:", apiBase); // Debug log

    const fetchData = async () => {
        try {
            const res = await fetch(`${apiBase}/api/crypto/dashboard`);
            if (res.ok) {
                const data = await res.json();
                setPortfolio({ ...data.portfolio, rsi: data.rsi });
                setTrades(data.recent_trades);
                const bot = data.active_bots.find(b => b.strategy_name === 'RSI_Strategy');
                if (bot) setBotStatus({ active: bot.is_active === 1, strategy: bot.strategy_name });
            } else {
                console.error(`❌ Fetch Dashboard Failed: ${res.status} ${res.statusText}`);
            }
        } catch (error) {
            console.error("❌ Error fetching dashboard data from:", `${apiBase}/api/crypto/dashboard`, error);
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
                    if (newData.length > 30) newData.shift();
                    return newData;
                });
            } else {
                console.error(`❌ Fetch Price Failed: ${res.status} ${res.statusText}`);
            }
        } catch (error) {
            // Fallback mock data if API fails
            const mockPrice = 200 + Math.random() * 5; // Mock SOL price
            setCurrentPrice(mockPrice);
            setPriceData(prev => {
                const newData = [...prev, { time: new Date().toLocaleTimeString(), price: mockPrice }];
                if (newData.length > 30) newData.shift();
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

            <div className="balance-card">
                <div className="balance-label">Total Balance</div>
                <div className="balance-amount">€{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="balance-change change-positive">
                    <ArrowUpRight size={16} /> +2.4% Today
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
                            <LineChart data={priceData}>
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
                                    dot={false}
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
