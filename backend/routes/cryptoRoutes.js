const express = require('express');
const router = express.Router();
const db = require('../crypto_db');
const https = require('https');

// Helper for native HTTPS get request (no dependencies)
const httpsGet = (url) => {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.end();
    });
};

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

// Helper for DB queries using Promises
const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

// GET /api/crypto/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const portfolio = await getPortfolio();

        // Run queries in parallel for speed
        const [trades, bots] = await Promise.all([
            dbAll("SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10"),
            dbAll("SELECT * FROM bot_settings")
        ]);

        res.json({
            portfolio: {
                balance_usd: portfolio.balance_usd,
                holdings: JSON.parse(portfolio.holdings || '{}')
            },
            recent_trades: trades, // Guaranteed to be an array
            active_bots: bots,     // Guaranteed to be an array
            rsi: latestRSI
        });
    } catch (error) {
        console.error("Dashboard Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/crypto/price/:symbol (Proxy to get real price)
router.get('/price/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { currency } = req.query; // 'eur' or 'usd'
    let price = 0;

    try {
        // 1. Try Binance (Best for EUR)
        try {
            const data = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=SOLEUR`);
            if (data && data.price) {
                price = parseFloat(data.price);
            }
        } catch (e) {
            console.error('Binance API failed:', e.message);
        }

        // 2. Fallback to CoinGecko
        if (!price) {
            try {
                const geckoData = await httpsGet('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=eur');
                if (geckoData && geckoData.solana && geckoData.solana.eur) {
                    price = parseFloat(geckoData.solana.eur);
                }
            } catch (e) {
                console.error('CoinGecko API failed:', e.message);
            }
        }

        // 3. Last Resort: Realistic Random Fallback (matches bot logic)
        if (!price) {
            console.warn("⚠️ All APIs failed, using random fallback");
            price = 120.00 + (Math.random() * 0.8); // Random between 120.00 and 120.80
        }

        res.json({ data: { priceUsd: price } }); // Sending EUR value in priceUsd field to maintain frontend compatibility
    } catch (error) {
        console.error('❌ Critical Error fetching price:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/crypto/reset (Reset Demo Portfolio)
router.post('/reset', (req, res) => {
    db.serialize(() => {
        // 262.5 USD is approx 250 EUR
        db.run("UPDATE portfolio SET balance_usd = 262.5, holdings = '{}' WHERE id = 1");
        db.run("DELETE FROM trades");
        res.json({ success: true, message: "Portfolio reset to €250" });
    });
});

// POST /api/crypto/trade (Simulation)
router.post('/trade', async (req, res) => {
    const { symbol, type, amount, price, strategy } = req.body;

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
                // Fetch Price using Binance API (Direct EUR pair, very reliable)
                // Symbol: SOLEUR
                const data = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=SOLEUR`);

                if (data && data.price) {
                    currentPrice = parseFloat(data.price);
                } else {
                    throw new Error("Invalid data from Binance");
                }

            } catch (e) {
                console.error('Error fetching price from Binance:', e.message);

                // Fallback to CoinGecko if Binance fails
                try {
                    const geckoData = await httpsGet('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=eur');
                    if (geckoData && geckoData.solana && geckoData.solana.eur) {
                        currentPrice = parseFloat(geckoData.solana.eur);
                    }
                } catch (e2) {
                    console.error('Error fetching price from CoinGecko:', e2.message);
                    // Last resort fallback
                    if (currentPrice === 0) currentPrice = 120.00 + (Math.random() * 0.5);
                }
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

            // 5. Professional Decision Logic
            const portfolio = await getPortfolio();
            let balance = portfolio.balance_usd;
            let holdings = JSON.parse(portfolio.holdings || '{}');
            const cryptoAmount = holdings[symbol] || 0;

            // Calculate Average Buy Price (approximate from recent trades if not stored)
            // In a real pro system, we would track "lots" separately.
            // Here we fetch the last BUY trade to establish a reference price.
            let lastBuyPrice = 0;
            if (cryptoAmount > 0) {
                const lastTrade = await new Promise(resolve => {
                    db.get("SELECT price FROM trades WHERE symbol = ? AND type = 'buy' ORDER BY timestamp DESC LIMIT 1", [symbol], (err, row) => {
                        resolve(row ? row.price : 0);
                    });
                });
                lastBuyPrice = lastTrade;
            }

            // --- STRATEGY PARAMETERS ---
            const RSI_OVERSOLD = 30;
            const RSI_OVERBOUGHT = 70;
            const STOP_LOSS_PCT = 0.02; // 2% max loss
            const TAKE_PROFIT_PCT = 0.03; // 3% target profit
            const TRADE_SIZE_EUR = 50; // Invest 50€ per trade (Money Management)

            console.log(`📊 ANALISI: Prezzo=${currentPrice.toFixed(2)}€ | RSI=${rsi.toFixed(2)} | Holdings=${cryptoAmount.toFixed(4)} SOL | AvgPrice=${lastBuyPrice.toFixed(2)}€`);

            // BUY LOGIC
            if (rsi < RSI_OVERSOLD && balance >= TRADE_SIZE_EUR) {
                // Buy only if we have enough cash
                const amountToBuy = TRADE_SIZE_EUR / currentPrice;
                await executeTrade(symbol, 'buy', amountToBuy, currentPrice, `RSI Oversold (${rsi.toFixed(2)})`);
                console.log(`✅ BOT BUY: RSI ${rsi.toFixed(2)} < ${RSI_OVERSOLD}. Buying ${amountToBuy.toFixed(4)} SOL.`);
            }

            // SELL LOGIC (Manage Open Position)
            else if (cryptoAmount > 0.01) {
                const pnlPercent = (currentPrice - lastBuyPrice) / lastBuyPrice;

                // 1. RSI Overbought (Classic Signal)
                if (rsi > RSI_OVERBOUGHT) {
                    await executeTrade(symbol, 'sell', cryptoAmount, currentPrice, `RSI Overbought (${rsi.toFixed(2)})`);
                    console.log(`✅ BOT SELL: RSI ${rsi.toFixed(2)} > ${RSI_OVERBOUGHT}. Taking profit.`);
                }
                // 2. Take Profit (Hard Target)
                else if (pnlPercent >= TAKE_PROFIT_PCT) {
                    await executeTrade(symbol, 'sell', cryptoAmount, currentPrice, `Take Profit (+${(pnlPercent * 100).toFixed(2)}%)`);
                    console.log(`💰 BOT SELL: Take Profit triggered. Gain: +${(pnlPercent * 100).toFixed(2)}%`);
                }
                // 3. Stop Loss (Safety Net)
                else if (pnlPercent <= -STOP_LOSS_PCT) {
                    await executeTrade(symbol, 'sell', cryptoAmount, currentPrice, `Stop Loss (${(pnlPercent * 100).toFixed(2)}%)`);
                    console.log(`🛡️ BOT SELL: Stop Loss triggered. Loss: ${(pnlPercent * 100).toFixed(2)}%`);
                }
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
