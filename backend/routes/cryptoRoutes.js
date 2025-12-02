const express = require('express');
const router = express.Router();
const db = require('../crypto_db');
const https = require('https');

// Helper for native HTTPS get request (no dependencies)
const httpsGet = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => reject(err));
    });
};

// ... inside runBotCycle ...
try {
    // Fetch Price using native https
    const data = await httpsGet(`https://api.coincap.io/v2/assets/${symbol}`);
    const priceUsd = parseFloat(data.data.priceUsd);

    // Convert to EUR
    let eurRate = 1.05;
    try {
        const rateData = await httpsGet('https://api.coincap.io/v2/rates/euro');
        eurRate = parseFloat(rateData.data.rateUsd) || 1.05;
    } catch (e) { }

    currentPrice = priceUsd / eurRate; // Price in EUR
} catch (e) {
    console.error('Error fetching price:', e.message);
    // Use a realistic fallback if API fails completely
    if (currentPrice === 0) currentPrice = 120.00 + (Math.random() * 0.5);
}

// Helper to get portfolio
const getPortfolio = () => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM portfolio LIMIT 1", (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// GET /api/crypto/history (Get chart data)
router.get('/history', (req, res) => {
    db.all("SELECT price, timestamp FROM price_history WHERE symbol = 'solana' ORDER BY timestamp DESC LIMIT 50", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Reverse to show oldest to newest
        const history = rows.map(row => ({
            time: new Date(row.timestamp).toLocaleTimeString(),
            price: row.price
        })).reverse();
        res.json(history);
    });
});

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
                    active_bots: bots,
                    rsi: latestRSI // Send current RSI to frontend
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/crypto/price/:symbol (Proxy to get real price)
router.get('/price/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { currency } = req.query; // 'eur' or 'usd'

    try {
        // 1. Fetch Crypto Price (USD)
        const response = await fetch(`https://api.coincap.io/v2/assets/${symbol}`);
        if (!response.ok) throw new Error(`CoinCap API Error: ${response.statusText}`);
        const data = await response.json();
        let price = parseFloat(data.data.priceUsd);

        // 2. Convert to EUR if requested
        if (currency === 'eur') {
            try {
                const rateRes = await fetch('https://api.coincap.io/v2/rates/euro');
                if (rateRes.ok) {
                    const rateData = await rateRes.json();
                    const eurRate = parseFloat(rateData.data.rateUsd); // 1 EUR = X USD
                    price = price / eurRate;
                } else {
                    console.warn("⚠️ Failed to fetch EUR rate, using default 1.05");
                    price = price / 1.05; // Fallback rate
                }
            } catch (e) {
                console.warn("⚠️ Error fetching EUR rate:", e.message);
                price = price / 1.05; // Fallback rate
            }
        }

        res.json({ data: { priceUsd: price } });
    } catch (error) {
        console.error('❌ Error fetching price:', error.message);

        // Fallback Mock Data to prevent dashboard crash
        console.log("⚠️ Using Mock Data for price due to error");
        const mockPrice = symbol === 'solana' ? 220.50 : 50000;
        res.json({ data: { priceUsd: mockPrice, isMock: true } });
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

// In-memory price history for RSI calculation (synced with DB)
let priceHistory = [];
let latestRSI = null; // Store latest RSI for frontend display
const RSI_PERIOD = 14;
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds

// Load history from DB on startup
const loadPriceHistory = () => {
    db.all("SELECT price FROM price_history WHERE symbol = 'solana' ORDER BY timestamp DESC LIMIT 50", (err, rows) => {
        if (!err && rows) {
            // Reverse because SQL gives DESC (newest first), but we need chronological order for RSI
            priceHistory = rows.map(r => r.price).reverse();
            console.log(`📈 BOT: Loaded ${priceHistory.length} historical prices from DB.`);
        }
    });
};
loadPriceHistory();

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
        // 1. Check if bot is active (we run price collection ANYWAY to keep history valid)
        db.get("SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy'", async (err, bot) => {
            const isBotActive = bot && bot.is_active;

            // 2. Get current price (SOLANA)
            const symbol = 'solana';
            let currentPrice = 0;

            try {
                // Fetch Price using native https
                const data = await httpsGet(`https://api.coincap.io/v2/assets/${symbol}`);
                const priceUsd = parseFloat(data.data.priceUsd);

                // Convert to EUR
                let eurRate = 1.05;
                try {
                    const rateData = await httpsGet('https://api.coincap.io/v2/rates/euro');
                    eurRate = parseFloat(rateData.data.rateUsd) || 1.05;
                } catch (e) { }

                currentPrice = priceUsd / eurRate; // Price in EUR
            } catch (e) {
                console.error('Error fetching price:', e.message);
                // Use a realistic fallback if API fails completely
                if (currentPrice === 0) currentPrice = 120.00 + (Math.random() * 0.5);
            }

            // 3. Update history (RAM + DB)
            priceHistory.push(currentPrice);
            if (priceHistory.length > 50) priceHistory.shift(); // Keep memory clean

            // Save to DB
            db.run("INSERT INTO price_history (symbol, price) VALUES (?, ?)", [symbol, currentPrice]);

            // Optional: Cleanup old history (keep last 1000 entries to save space) every 100 cycles
            if (Math.random() < 0.01) {
                db.run("DELETE FROM price_history WHERE id NOT IN (SELECT id FROM price_history ORDER BY timestamp DESC LIMIT 1000)");
            }

            // 4. Calculate RSI
            const rsi = calculateRSI(priceHistory);
            latestRSI = rsi; // Update global variable

            if (rsi) {
                console.log(`🤖 BOT: SOL/EUR=${currentPrice.toFixed(2)}€ | RSI=${rsi.toFixed(2)} | Active=${isBotActive}`);
            }

            if (!isBotActive || !rsi) return; // Stop here if bot is off

            // 5. Decision Logic
            const portfolio = await getPortfolio();
            let balance = portfolio.balance_usd;
            let holdings = JSON.parse(portfolio.holdings);
            const cryptoAmount = holdings[symbol] || 0;

            if (rsi < 30 && balance >= 100) {
                const amountToBuy = 100 / currentPrice;
                executeTrade(symbol, 'buy', amountToBuy, currentPrice, 'RSI_Strategy (Auto)');
                console.log('✅ BOT BUY EXECUTED');
            }
            // SELL SIGNAL (RSI > 70) - Sell all crypto if we have any
            else if (rsi > 70 && cryptoAmount > 0.1) {
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
