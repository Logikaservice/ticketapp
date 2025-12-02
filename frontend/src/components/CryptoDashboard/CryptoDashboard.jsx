import React, { useState, useEffect } from 'react';
import { ComposedChart, Line, Area, Scatter, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity, Power, RefreshCw, Wallet } from 'lucide-react';
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
        const trade = allTrades.find(t => {
            if (!point.timestamp) return false;
            const tradeTime = new Date(t.timestamp).getTime();
            const pointTime = new Date(point.timestamp).getTime();
            return Math.abs(tradeTime - pointTime) < 120000;
        });

        return {
            ...point,
            buy: trade && trade.type === 'buy' ? point.price : null,
            sell: trade && trade.type === 'sell' ? point.price : null
        };
    });

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
                    <button className="toggle-btn" onClick={toggleBot} style={{ marginTop: '10px', padding: '8px', fontSize: '0.9rem' }}>
                        {botStatus.active ? "Stop Bot" : "Start Bot"}
                    </button>
                </div>
            </div>

            {/* MAIN CRYPTO GRID - CHART & OPEN POSITIONS */}
            <div className="crypto-grid">
                <div className="crypto-card">
                    <div className="card-title">
                        <Activity size={20} className="text-blue-500" />
                        Solana / EUR Live Market
                    </div>
                    <div className="chart-container" style={{ position: 'relative' }}>
                        {chartData.length === 0 && (
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#666' }}>
                                Loading Chart Data...
                            </div>
                        )}
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="time"
                                    stroke="#333"
                                    tick={{ fill: '#666', fontSize: 10 }}
                                    minTickGap={30}
                                />
                                <YAxis
                                    domain={['auto', 'auto']}
                                    stroke="#333"
                                    tick={{ fill: '#666', fontSize: 10 }}
                                    width={40}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1c1c1e', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="price"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorPrice)"
                                    isAnimationActive={false}
                                />
                                <Scatter name="Buy" dataKey="buy" fill="#4ade80" shape="circle" />
                                <Scatter name="Sell" dataKey="sell" fill="#ef4444" shape="circle" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '1.2rem', fontWeight: 'bold' }}>
                        1 SOL = €{currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                </div>

                {/* MT5 Style Open Positions (Moved Here) */}
                <div className="crypto-card">
                    <div className="card-title">
                        <Activity size={20} className="text-blue-500" />
                        Open Positions (Live)
                    </div>
                    <div className="trades-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {(() => {
                            // Calculate Open Positions (FIFO Logic)
                            let totalSold = trades.filter(t => t.type === 'sell').reduce((acc, t) => acc + t.amount, 0);
                            const buys = trades.filter(t => t.type === 'buy').sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // Oldest first
                            const openPositions = [];

                            for (const buy of buys) {
                                if (totalSold >= buy.amount) {
                                    totalSold -= buy.amount; // Fully sold
                                } else {
                                    const remaining = buy.amount - totalSold;
                                    openPositions.push({ ...buy, amount: remaining, originalAmount: buy.amount });
                                    totalSold = 0; // All sells accounted for
                                }
                            }

                            if (openPositions.length === 0) {
                                return <div style={{ color: '#555', textAlign: 'center', padding: '20px' }}>No open positions.</div>;
                            }

                            return (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr style={{ color: '#6b7280', borderBottom: '1px solid #374151' }}>
                                            <th style={{ padding: '5px', textAlign: 'left' }}>Time</th>
                                            <th style={{ padding: '5px', textAlign: 'right' }}>Price</th>
                                            <th style={{ padding: '5px', textAlign: 'right' }}>Vol</th>
                                            <th style={{ padding: '5px', textAlign: 'right' }}>P&L</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {openPositions.map((pos, i) => {
                                            const pnl = (currentPrice - pos.price) * pos.amount;

                                            return (
                                                <tr key={i} style={{ borderBottom: '1px solid #1f2937', background: pnl >= 0 ? 'rgba(74, 222, 128, 0.05)' : 'rgba(239, 68, 68, 0.05)' }}>
                                                    <td style={{ padding: '5px', color: '#9ca3af' }}>{new Date(pos.timestamp).toLocaleTimeString()}</td>
                                                    <td style={{ padding: '5px', textAlign: 'right' }}>€{pos.price.toFixed(2)}</td>
                                                    <td style={{ padding: '5px', textAlign: 'right' }}>{pos.amount.toFixed(4)}</td>
                                                    <td style={{ padding: '5px', textAlign: 'right', fontWeight: 'bold', color: pnl >= 0 ? '#4ade80' : '#ef4444' }}>
                                                        {pnl >= 0 ? '+' : ''}€{pnl.toFixed(2)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            );
                        })()}
                    </div>
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
        </div>
    );
};

export default CryptoDashboard;
