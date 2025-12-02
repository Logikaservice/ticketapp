const express = require('express');
const router = express.Router();
const db = require('../crypto_db');
const fetch = require('node-fetch');

// Helper to get portfolio
const getPortfolio = () => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM portfolio LIMIT 1", (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// GET /api/crypto/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const portfolio = await getPortfolio();

        db.all("SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10", (err, trades) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all("SELECT * FROM bot_settings", (err, bots) => {
                if (err) return res.status(500).json({ error: err.message });

                res.json({
                    portfolio: {
                        balance_usd: portfolio.balance_usd,
                        holdings: JSON.parse(portfolio.holdings)
                    },
                    recent_trades: trades,
                    active_bots: bots
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/crypto/price/:symbol (Proxy to get real price)
router.get('/price/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toLowerCase(); // e.g., bitcoin
    try {
        // Using CoinCap API for free real-time data
        const response = await fetch(`https://api.coincap.io/v2/assets/${symbol}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch price' });
    }
});

// POST /api/crypto/bot/toggle
router.post('/bot/toggle', (req, res) => {
    const { strategy_name, is_active } = req.body;
    db.run("UPDATE bot_settings SET is_active = ? WHERE strategy_name = ?", [is_active ? 1 : 0, strategy_name], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, strategy_name, is_active });
    });
});

// POST /api/crypto/trade (Simulation)
router.post('/trade', async (req, res) => {
    const { symbol, type, amount, price, strategy } = req.body;
    // In a real app, we would check balance here.
    // For this demo, we just record it.

    const cost = amount * price;

    try {
        const portfolio = await getPortfolio();
        let balance = portfolio.balance_usd;
        let holdings = JSON.parse(portfolio.holdings);

        if (type === 'buy') {
            if (balance < cost) return res.status(400).json({ error: 'Insufficient funds' });
            balance -= cost;
            holdings[symbol] = (holdings[symbol] || 0) + amount;
        } else {
            if (!holdings[symbol] || holdings[symbol] < amount) return res.status(400).json({ error: 'Insufficient crypto' });
            balance += cost;
            holdings[symbol] -= amount;
        }

        // Update DB
        db.serialize(() => {
            db.run("UPDATE portfolio SET balance_usd = ?, holdings = ?", [balance, JSON.stringify(holdings)]);
            db.run("INSERT INTO trades (symbol, type, amount, price, strategy) VALUES (?, ?, ?, ?, ?)",
                [symbol, type, amount, price, strategy]);
        });

        res.json({ success: true, new_balance: balance, new_holdings: holdings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// BOT ENGINE (Background Worker)
// ==========================================

// In-memory price history for RSI calculation (last 20 prices)
let priceHistory = [];
const RSI_PERIOD = 14;
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds

// Calculate RSI
const calculateRSI = (prices) => {
    if (prices.length < RSI_PERIOD + 1) return null;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= RSI_PERIOD; i++) {
        const change = prices[prices.length - i] - prices[prices.length - i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }

    if (losses === 0) return 100;

    const avgGain = gains / RSI_PERIOD;
    const avgLoss = losses / RSI_PERIOD;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

// Bot Loop Function
const runBotCycle = async () => {
    try {
        // 1. Check if bot is active
        db.get("SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy'", async (err, bot) => {
            if (err || !bot || !bot.is_active) return; // Bot stopped

            // 2. Get current price
            const symbol = 'bitcoin';
            const response = await fetch(`https://api.coincap.io/v2/assets/${symbol}`);
            const data = await response.json();
            const currentPrice = parseFloat(data.data.priceUsd);

            // 3. Update history
            priceHistory.push(currentPrice);
            if (priceHistory.length > 50) priceHistory.shift(); // Keep memory clean

            // 4. Calculate RSI
            const rsi = calculateRSI(priceHistory);
            if (!rsi) return; // Not enough data yet

            console.log(`🤖 BOT: Price=${currentPrice.toFixed(2)} | RSI=${rsi.toFixed(2)}`);

            // 5. Decision Logic
            const portfolio = await getPortfolio();
            let balance = portfolio.balance_usd;
            let holdings = JSON.parse(portfolio.holdings);
            const cryptoAmount = holdings[symbol] || 0;

            // BUY SIGNAL (RSI < 30) - Buy $1000 worth if we have USD
            if (rsi < 30 && balance >= 1000) {
                const amountToBuy = 1000 / currentPrice;
                executeTrade(symbol, 'buy', amountToBuy, currentPrice, 'RSI_Strategy (Auto)');
                console.log('✅ BOT BUY EXECUTED');
            }
            // SELL SIGNAL (RSI > 70) - Sell all crypto if we have any
            else if (rsi > 70 && cryptoAmount > 0.0001) {
                executeTrade(symbol, 'sell', cryptoAmount, currentPrice, 'RSI_Strategy (Auto)');
                console.log('✅ BOT SELL EXECUTED');
            }
        });
    } catch (error) {
        console.error('Bot Cycle Error:', error.message);
    }
};

// Helper to execute trade internally
const executeTrade = (symbol, type, amount, price, strategy) => {
    const cost = amount * price;
    db.get("SELECT * FROM portfolio LIMIT 1", (err, row) => {
        if (err) return;
        let balance = row.balance_usd;
        let holdings = JSON.parse(row.holdings);

        if (type === 'buy') {
            balance -= cost;
            holdings[symbol] = (holdings[symbol] || 0) + amount;
        } else {
            balance += cost;
            holdings[symbol] = (holdings[symbol] || 0) - amount;
            if (holdings[symbol] < 0) holdings[symbol] = 0; // Safety
        }

        db.serialize(() => {
            db.run("UPDATE portfolio SET balance_usd = ?, holdings = ?", [balance, JSON.stringify(holdings)]);
            db.run("INSERT INTO trades (symbol, type, amount, price, strategy) VALUES (?, ?, ?, ?, ?)",
                [symbol, type, amount, price, strategy]);
        });
    });
};

// Start the loop
setInterval(runBotCycle, CHECK_INTERVAL_MS);

module.exports = router;
