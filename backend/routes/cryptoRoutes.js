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
router.get('/history', async (req, res) => {
    try {
        // Check if we have enough data
        const countRows = await dbAll("SELECT COUNT(*) as count FROM price_history WHERE symbol = 'bitcoin'");
        const count = countRows && countRows.length > 0 ? countRows[0].count : 0;

        console.log(`📊 Price history count: ${count}`);

        // If we have less than 50 data points, try to load from Binance
        if (count < 50) {
            console.log('⚠️ Price history is sparse, loading from Binance...');
            
            try {
                // Load recent klines from Binance (last 24 hours, 15min intervals = 96 candles)
                const https = require('https');
                const binanceUrl = 'https://api.binance.com/api/v3/klines?symbol=BTCEUR&interval=15m&limit=96';
                
                const binanceData = await new Promise((resolve, reject) => {
                    https.get(binanceUrl, (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            try {
                                resolve(JSON.parse(data));
                            } catch (e) {
                                reject(e);
                            }
                        });
                    }).on('error', reject);
                });

                // Save to database
                let saved = 0;
                for (const kline of binanceData) {
                    const timestamp = new Date(kline[0]).toISOString();
                    const price = parseFloat(kline[4]); // Close price
                    
                    try {
                        await dbRun(
                            "INSERT OR IGNORE INTO price_history (symbol, price, timestamp) VALUES (?, ?, ?)",
                            ['bitcoin', price, timestamp]
                        );
                        saved++;
                    } catch (err) {
                        // Ignore duplicate errors
                    }
                }
                
                console.log(`✅ Loaded ${saved} historical prices from Binance`);
            } catch (err) {
                console.error('⚠️ Error loading from Binance, using existing data:', err.message);
            }
        }

        // Get all available history
        const historyRows = await dbAll("SELECT price, timestamp FROM price_history WHERE symbol = 'bitcoin' ORDER BY timestamp ASC LIMIT 500");
        
        // Convert to format expected by frontend
        const history = (historyRows || []).map(row => ({
            time: new Date(row.timestamp).toLocaleTimeString(),
            price: row.price,
            timestamp: row.timestamp
        }));

        console.log(`📊 Returning ${history.length} price history points`);
        res.json(history);
    } catch (error) {
        console.error('❌ Error fetching price history:', error);
        res.status(500).json({ error: error.message });
    }
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

// Helper for db.get using Promises
const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
};

// Helper for db.run using Promises
const dbRun = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

// GET /api/crypto/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const portfolio = await getPortfolio();

        // Run queries in parallel for speed
        const [trades, bots, openPositions] = await Promise.all([
            dbAll("SELECT * FROM trades ORDER BY timestamp DESC LIMIT 50"), // Increased limit for calculation
            dbAll("SELECT * FROM bot_settings"),
            dbAll("SELECT * FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC")
        ]);

        // Calculate Average Buy Price for current holdings
        let avgBuyPrice = 0;
        let totalCost = 0;
        let totalAmount = 0;
        const currentHoldings = JSON.parse(portfolio.holdings || '{}')['bitcoin'] || 0;

        if (currentHoldings > 0) {
            // Simple FIFO/Weighted Average logic from recent trades
            // We scan trades backwards to find the cost basis of current holdings
            let remainingHoldings = currentHoldings;
            for (const trade of trades) {
                if (trade.type === 'buy' && trade.symbol === 'bitcoin') {
                    const amount = Math.min(trade.amount, remainingHoldings);
                    totalCost += amount * trade.price;
                    totalAmount += amount;
                    remainingHoldings -= amount;
                    if (remainingHoldings <= 0) break;
                }
            }
            if (totalAmount > 0) {
                avgBuyPrice = totalCost / totalAmount;
            }
        }

        res.json({
            portfolio: {
                balance_usd: portfolio.balance_usd,
                holdings: JSON.parse(portfolio.holdings || '{}'),
                avg_buy_price: avgBuyPrice // Send calculated avg price
            },
            recent_trades: trades.slice(0, 10), // Send only 10 to frontend list
            all_trades: trades, // Send more history for chart plotting
            active_bots: bots,
            open_positions: openPositions, // Include open positions
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
            const data = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=BTCEUR`);
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
    db.all("SELECT price FROM price_history WHERE symbol = 'bitcoin' ORDER BY timestamp DESC LIMIT 300", (err, rows) => {
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
        // Use Promise-based dbGet to properly await the result and avoid unhandled promise rejections
        const bot = await dbGet("SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy'");
        const isBotActive = bot && bot.is_active;

        // 2. Get current price (BITCOIN)
        const symbol = 'bitcoin';
        let currentPrice = 0;

        try {
            // Fetch Price using Binance API (Direct EUR pair, very reliable)
            // Symbol: BTCEUR
            const data = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=BTCEUR`);

            if (data && data.price) {
                currentPrice = parseFloat(data.price);
            } else {
                throw new Error("Invalid data from Binance");
            }

        } catch (e) {
            console.error('Error fetching price from Binance:', e.message);

            // Fallback to CoinGecko if Binance fails
            try {
                const geckoData = await httpsGet('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur');
                if (geckoData && geckoData.bitcoin && geckoData.bitcoin.eur) {
                    currentPrice = parseFloat(geckoData.bitcoin.eur);
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

        // Save to DB using Promise-based operation
        await dbRun("INSERT INTO price_history (symbol, price) VALUES (?, ?)", [symbol, currentPrice]);

        // Optional: Cleanup old history (keep last 1000 entries to save space) every 100 cycles
        if (Math.random() < 0.01) {
            await dbRun("DELETE FROM price_history WHERE id NOT IN (SELECT id FROM price_history ORDER BY timestamp DESC LIMIT 1000)");
        }

        // 4. Calculate RSI
        const rsi = calculateRSI(priceHistory);
        latestRSI = rsi; // Update global variable

        if (rsi) {
            console.log(`🤖 BOT: BTC/EUR=${currentPrice.toFixed(2)}€ | RSI=${rsi.toFixed(2)} | Active=${isBotActive}`);
        }

        if (!isBotActive || !rsi) return; // Stop here if bot is off

        // 5. Professional Decision Logic
        const portfolio = await getPortfolio();
        let balance = portfolio.balance_usd;
        let holdings = JSON.parse(portfolio.holdings || '{}');
        const cryptoAmount = holdings[symbol] || 0;

        // Calculate Weighted Average Buy Price (Real Cost Basis)
        let lastBuyPrice = 0;
        if (cryptoAmount > 0) {
            // Fetch recent buys to calculate average
            const trades = await dbAll("SELECT * FROM trades WHERE symbol = ? AND type = 'buy' ORDER BY timestamp DESC LIMIT 20", [symbol]);

            let totalCost = 0;
            let totalQty = 0;
            let remainingToMatch = cryptoAmount;

            for (const t of trades) {
                const qty = Math.min(t.amount, remainingToMatch);
                totalCost += qty * t.price;
                totalQty += qty;
                remainingToMatch -= qty;
                if (remainingToMatch <= 0.0001) break;
            }

            if (totalQty > 0) {
                lastBuyPrice = totalCost / totalQty;
            } else {
                // Fallback if history is lost but holdings exist
                lastBuyPrice = currentPrice;
            }
        }

        // --- STRATEGY PARAMETERS ---
        const RSI_OVERSOLD = 30;
        const RSI_OVERBOUGHT = 70;
        const STOP_LOSS_PCT = 0.02; // 2% max loss
        const TAKE_PROFIT_PCT = 0.03; // 3% target profit
        const TRADE_SIZE_EUR = 50; // Invest 50€ per trade (Money Management)

                console.log(`📊 ANALISI: Prezzo=${currentPrice.toFixed(2)}€ | RSI=${rsi.toFixed(2)} | Holdings=${cryptoAmount.toFixed(4)} BTC | AvgPrice=${lastBuyPrice.toFixed(2)}€`);

        // BUY LOGIC (Smart Accumulation / DCA)
        if (rsi < RSI_OVERSOLD && balance >= TRADE_SIZE_EUR) {
            // Scenario A: First Entry
            if (cryptoAmount < 0.001) {
                const amountToBuy = TRADE_SIZE_EUR / currentPrice;
                await executeTrade(symbol, 'buy', amountToBuy, currentPrice, `RSI Oversold (${rsi.toFixed(2)})`);
                console.log(`✅ BOT BUY (Entry): RSI ${rsi.toFixed(2)} < ${RSI_OVERSOLD}. Buying ${amountToBuy.toFixed(4)} BTC.`);
            }
            // Scenario B: DCA (Accumulate if price drops 2% below Avg Price)
            else if (currentPrice < lastBuyPrice * 0.98) {
                // Aggressive: Buy double (Martingale) or same amount? Let's stick to same amount for safety.
                const amountToBuy = TRADE_SIZE_EUR / currentPrice;
                await executeTrade(symbol, 'buy', amountToBuy, currentPrice, `DCA Accumulation (Price -2%)`);
                console.log(`📉 BOT BUY (DCA): Price dropped below Avg. Lowering entry price.`);
            }
        }

        // SELL LOGIC (Manage Open Position)
        else if (cryptoAmount > 0.01) {
            const pnlPercent = (currentPrice - lastBuyPrice) / lastBuyPrice;

            // 1. RSI Overbought (Classic Signal)
            if (rsi > RSI_OVERBOUGHT) {
                const pnl = (currentPrice - lastBuyPrice) * cryptoAmount;
                await executeTrade(symbol, 'sell', cryptoAmount, currentPrice, `RSI Overbought (${rsi.toFixed(2)})`, pnl);
                console.log(`✅ BOT SELL: RSI ${rsi.toFixed(2)} > ${RSI_OVERBOUGHT}. Taking profit.`);
            }
            // 2. Take Profit (Hard Target)
            else if (pnlPercent >= TAKE_PROFIT_PCT) {
                const pnl = (currentPrice - lastBuyPrice) * cryptoAmount;
                await executeTrade(symbol, 'sell', cryptoAmount, currentPrice, `Take Profit (+${(pnlPercent * 100).toFixed(2)}%)`, pnl);
                console.log(`💰 BOT SELL: Take Profit triggered. Gain: +${(pnlPercent * 100).toFixed(2)}%`);
            }
            // 3. Stop Loss (Safety Net)
            else if (pnlPercent <= -STOP_LOSS_PCT) {
                const pnl = (currentPrice - lastBuyPrice) * cryptoAmount;
                await executeTrade(symbol, 'sell', cryptoAmount, currentPrice, `Stop Loss (${(pnlPercent * 100).toFixed(2)}%)`, pnl);
                console.log(`🛡️ BOT SELL: Stop Loss triggered. Loss: ${(pnlPercent * 100).toFixed(2)}%`);
            }
        }
    } catch (error) {
        console.error('Bot Cycle Error:', error.message);
        // Errors from executeTrade and other async operations are now properly caught here
    }
};

// Helper to open a position (used by bot)
const openPosition = async (symbol, type, volume, entryPrice, strategy, stopLoss = null, takeProfit = null) => {
    try {
        // Use Promise-based getPortfolio to properly await the result
        const portfolio = await getPortfolio();
        
        const cost = volume * entryPrice;
        let balance = portfolio.balance_usd;
        let holdings = JSON.parse(portfolio.holdings || '{}');

        if (type === 'buy') {
            if (balance < cost) {
                throw new Error('Insufficient funds');
            }
            balance -= cost;
            holdings[symbol] = (holdings[symbol] || 0) + volume;
        } else {
            // Short position
            balance += cost;
            holdings[symbol] = (holdings[symbol] || 0) - volume;
        }

        const ticketId = generateTicketId();

        // Update database using Promise-based operations (sequentially to ensure order)
        await dbRun(
            "UPDATE portfolio SET balance_usd = ?, holdings = ?",
            [balance, JSON.stringify(holdings)]
        );
        
        await dbRun(
            `INSERT INTO open_positions 
            (ticket_id, symbol, type, volume, entry_price, current_price, stop_loss, take_profit, strategy, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
            [ticketId, symbol, type, volume, entryPrice, entryPrice, stopLoss, takeProfit, strategy || 'Bot']
        );

        await dbRun(
            "INSERT INTO trades (symbol, type, amount, price, strategy) VALUES (?, ?, ?, ?, ?)",
            [symbol, type, volume, entryPrice, strategy || 'Bot Open']
        );

        return ticketId;
    } catch (err) {
        console.error('Error in openPosition:', err.message);
        throw err;
    }
};

// Helper to execute trade internally (legacy - now uses positions)
const executeTrade = async (symbol, type, amount, price, strategy, realizedPnl = null) => {
    // If it's a buy, open a position
    if (type === 'buy') {
        try {
            // Calculate stop loss and take profit based on strategy
            const STOP_LOSS_PCT = 0.02; // 2%
            const TAKE_PROFIT_PCT = 0.03; // 3%
            const stopLoss = price * (1 - STOP_LOSS_PCT);
            const takeProfit = price * (1 + TAKE_PROFIT_PCT);
            
            await openPosition(symbol, type, amount, price, strategy, stopLoss, takeProfit);
            console.log(`✅ Position opened: ${type.toUpperCase()} ${amount} ${symbol} @ ${price}`);
        } catch (err) {
            console.error('Error opening position:', err.message);
            throw err; // Re-throw to allow caller to handle
        }
    } else {
        // If it's a sell, close the oldest open position
        try {
            // Use Promise-based db.get to properly await the result
            const pos = await dbGet(
                "SELECT * FROM open_positions WHERE symbol = ? AND type = 'buy' AND status = 'open' ORDER BY opened_at ASC LIMIT 1",
                [symbol]
            );

            if (!pos) {
                // Fallback to old logic if no position found
                console.warn(`⚠️ No open position found for ${symbol}, using fallback logic`);
                try {
                    const portfolio = await getPortfolio();
                    const cost = amount * price;
                    let balance = portfolio.balance_usd;
                    let holdings = JSON.parse(portfolio.holdings || '{}');

                    balance += cost;
                    holdings[symbol] = (holdings[symbol] || 0) - amount;
                    if (holdings[symbol] < 0) holdings[symbol] = 0;

                    // Use Promise-based operations for consistency
                    await dbRun(
                        "UPDATE portfolio SET balance_usd = ?, holdings = ?",
                        [balance, JSON.stringify(holdings)]
                    );
                    await dbRun(
                        "INSERT INTO trades (symbol, type, amount, price, strategy, profit_loss) VALUES (?, ?, ?, ?, ?, ?)",
                        [symbol, type, amount, price, strategy, realizedPnl]
                    );
                    console.log(`✅ Fallback trade executed: ${type.toUpperCase()} ${amount} ${symbol} @ ${price}`);
                } catch (fallbackErr) {
                    console.error('Error in fallback trade logic:', fallbackErr.message);
                    throw fallbackErr;
                }
                return;
            }

            // Close the position and wait for it to complete
            await closePosition(pos.ticket_id, price, 'taken');
            console.log(`✅ Position closed: ${pos.ticket_id} @ ${price}`);
        } catch (err) {
            console.error('Error closing position:', err.message);
            throw err; // Re-throw to allow caller to handle
        }
    }
};

// Start the loop
setInterval(runBotCycle, CHECK_INTERVAL_MS);

// ==========================================
// OPEN POSITIONS API (MetaTrader 5 Style)
// ==========================================

// Helper to generate unique ticket ID
const generateTicketId = () => {
    return `T${Date.now()}${Math.floor(Math.random() * 1000)}`;
};

// Helper to update P&L for all open positions
const updatePositionsPnL = async (currentPrice, symbol = 'bitcoin') => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM open_positions WHERE symbol = ? AND status = 'open'", [symbol], async (err, positions) => {
            if (err) {
                reject(err);
                return;
            }

            for (const pos of positions) {
                let pnl = 0;
                let pnlPct = 0;

                if (pos.type === 'buy') {
                    // Long position: profit when price goes up
                    pnl = (currentPrice - pos.entry_price) * pos.volume;
                    pnlPct = ((currentPrice - pos.entry_price) / pos.entry_price) * 100;
                } else {
                    // Short position: profit when price goes down
                    pnl = (pos.entry_price - currentPrice) * pos.volume;
                    pnlPct = ((pos.entry_price - currentPrice) / pos.entry_price) * 100;
                }

                // Update position
                db.run(
                    "UPDATE open_positions SET current_price = ?, profit_loss = ?, profit_loss_pct = ? WHERE ticket_id = ?",
                    [currentPrice, pnl, pnlPct, pos.ticket_id]
                );

                // Check stop loss and take profit
                if (pos.stop_loss || pos.take_profit) {
                    let shouldClose = false;
                    let closeReason = '';

                    if (pos.type === 'buy') {
                        // Long position
                        if (pos.stop_loss && currentPrice <= pos.stop_loss) {
                            shouldClose = true;
                            closeReason = 'stopped';
                        } else if (pos.take_profit && currentPrice >= pos.take_profit) {
                            shouldClose = true;
                            closeReason = 'taken';
                        }
                    } else {
                        // Short position
                        if (pos.stop_loss && currentPrice >= pos.stop_loss) {
                            shouldClose = true;
                            closeReason = 'stopped';
                        } else if (pos.take_profit && currentPrice <= pos.take_profit) {
                            shouldClose = true;
                            closeReason = 'taken';
                        }
                    }

                    if (shouldClose) {
                        // Close position automatically
                        await closePosition(pos.ticket_id, currentPrice, closeReason);
                    }
                }
            }

            resolve(positions.length);
        });
    });
};

// Helper to close a position
const closePosition = async (ticketId, closePrice, reason = 'manual') => {
    try {
        // Use Promise-based db.get to properly await the result
        const pos = await dbGet(
            "SELECT * FROM open_positions WHERE ticket_id = ? AND status = 'open'",
            [ticketId]
        );

        if (!pos) {
            throw new Error('Position not found or already closed');
        }

        // Calculate final P&L
        let finalPnl = 0;
        if (pos.type === 'buy') {
            finalPnl = (closePrice - pos.entry_price) * pos.volume;
        } else {
            finalPnl = (pos.entry_price - closePrice) * pos.volume;
        }

        // Update portfolio
        const portfolio = await getPortfolio();
        let balance = portfolio.balance_usd;
        let holdings = JSON.parse(portfolio.holdings || '{}');

        if (pos.type === 'buy') {
            // Selling: add money, remove crypto
            balance += closePrice * pos.volume;
            holdings[pos.symbol] = (holdings[pos.symbol] || 0) - pos.volume;
        } else {
            // Closing short: subtract money, add crypto back
            balance -= closePrice * pos.volume;
            holdings[pos.symbol] = (holdings[pos.symbol] || 0) + pos.volume;
        }

        // Update database using Promise-based operations (sequentially to ensure order)
        await dbRun(
            "UPDATE portfolio SET balance_usd = ?, holdings = ?",
            [balance, JSON.stringify(holdings)]
        );

        await dbRun(
            "UPDATE open_positions SET status = ?, closed_at = CURRENT_TIMESTAMP, current_price = ?, profit_loss = ? WHERE ticket_id = ?",
            [reason, closePrice, finalPnl, ticketId]
        );

        // Record in trades history
        await dbRun(
            "INSERT INTO trades (symbol, type, amount, price, strategy, profit_loss) VALUES (?, ?, ?, ?, ?, ?)",
            [pos.symbol, pos.type === 'buy' ? 'sell' : 'buy', pos.volume, closePrice, pos.strategy || 'Manual Close', finalPnl]
        );

        return { success: true, pnl: finalPnl };
    } catch (err) {
        console.error('Error in closePosition:', err.message);
        throw err;
    }
};

// GET /api/crypto/positions - Get all open positions
router.get('/positions', (req, res) => {
    const { status } = req.query;
    const query = status 
        ? "SELECT * FROM open_positions WHERE status = ? ORDER BY opened_at DESC"
        : "SELECT * FROM open_positions ORDER BY opened_at DESC";
    
    const params = status ? [status] : [];

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ positions: rows });
    });
});

// POST /api/crypto/positions/open - Open a new position
router.post('/positions/open', async (req, res) => {
    const { symbol, type, volume, entry_price, stop_loss, take_profit, strategy } = req.body;

    if (!symbol || !type || !volume || !entry_price) {
        return res.status(400).json({ error: 'Missing required fields: symbol, type, volume, entry_price' });
    }

    if (type !== 'buy' && type !== 'sell') {
        return res.status(400).json({ error: 'Type must be "buy" or "sell"' });
    }

    try {
        const portfolio = await getPortfolio();
        let balance = portfolio.balance_usd;
        let holdings = JSON.parse(portfolio.holdings || '{}');
        const cost = volume * entry_price;

        // Check if we have enough funds/holdings
        if (type === 'buy') {
            if (balance < cost) {
                return res.status(400).json({ error: 'Insufficient funds' });
            }
            balance -= cost;
            holdings[symbol] = (holdings[symbol] || 0) + volume;
        } else {
            // Short position: we need to "borrow" crypto, so we add money but track negative holdings
            if ((holdings[symbol] || 0) < volume) {
                // For short, we're selling what we don't have, so we add to balance
                balance += cost;
                holdings[symbol] = (holdings[symbol] || 0) - volume;
            } else {
                return res.status(400).json({ error: 'Cannot short when you have holdings. Close position first.' });
            }
        }

        const ticketId = generateTicketId();

        // Create position
        db.serialize(() => {
            db.run(
                "UPDATE portfolio SET balance_usd = ?, holdings = ?",
                [balance, JSON.stringify(holdings)]
            );

            db.run(
                `INSERT INTO open_positions 
                (ticket_id, symbol, type, volume, entry_price, current_price, stop_loss, take_profit, strategy, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
                [ticketId, symbol, type, volume, entry_price, entry_price, stop_loss || null, take_profit || null, strategy || 'Manual', 'open']
            );

            // Record initial trade
            db.run(
                "INSERT INTO trades (symbol, type, amount, price, strategy) VALUES (?, ?, ?, ?, ?)",
                [symbol, type, volume, entry_price, strategy || 'Manual Open']
            );
        });

        res.json({
            success: true,
            ticket_id: ticketId,
            message: `Position opened: ${type.toUpperCase()} ${volume} ${symbol.toUpperCase()} @ ${entry_price}`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/crypto/positions/close/:ticketId - Close a position
router.post('/positions/close/:ticketId', async (req, res) => {
    const { ticketId } = req.params;
    const { close_price } = req.body;

    try {
        // Get current price if not provided
        let finalPrice = close_price;
        if (!finalPrice) {
            try {
                const priceData = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=SOLEUR`);
                finalPrice = parseFloat(priceData.price);
            } catch (e) {
                return res.status(500).json({ error: 'Could not fetch current price. Please provide close_price.' });
            }
        }

        const result = await closePosition(ticketId, finalPrice, 'manual');
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/crypto/positions/update-pnl - Update P&L for all positions (called periodically)
router.get('/positions/update-pnl', async (req, res) => {
    try {
        const { symbol } = req.query;
        const targetSymbol = symbol || 'bitcoin';

        // Get current price
        let currentPrice = 0;
        try {
            const data = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=BTCEUR`);
            if (data && data.price) {
                currentPrice = parseFloat(data.price);
            } else {
                // Fallback to CoinGecko
                const geckoData = await httpsGet('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur');
                if (geckoData && geckoData.bitcoin && geckoData.bitcoin.eur) {
                    currentPrice = parseFloat(geckoData.bitcoin.eur);
                }
            }
        } catch (e) {
            return res.status(500).json({ error: 'Could not fetch current price' });
        }

        const updatedCount = await updatePositionsPnL(currentPrice, targetSymbol);
        res.json({ success: true, updated: updatedCount, current_price: currentPrice });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update P&L every 5 seconds in background
setInterval(async () => {
    try {
        let currentPrice = 0;
        try {
            const data = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=BTCEUR`);
            if (data && data.price) {
                currentPrice = parseFloat(data.price);
            }
        } catch (e) {
            // Silent fail in background
            return;
        }
        if (currentPrice > 0) {
            await updatePositionsPnL(currentPrice, 'bitcoin');
        }
    } catch (err) {
        // Silent fail
    }
}, 5000);

// ==========================================
// BINANCE API INTEGRATION
// ==========================================

const { getBinanceClient, isBinanceAvailable, getMode } = require('../utils/binanceConfig');

// GET /api/crypto/binance/mode - Get current Binance mode
router.get('/binance/mode', (req, res) => {
    res.json({
        mode: getMode(),
        available: isBinanceAvailable(),
        message: isBinanceAvailable() 
            ? `Modalità attiva: ${getMode().toUpperCase()}` 
            : 'Modalità DEMO: usando simulazione locale'
    });
});

// GET /api/crypto/binance/balance - Get balance from Binance
router.get('/binance/balance', async (req, res) => {
    try {
        if (!isBinanceAvailable()) {
            return res.status(400).json({
                error: 'Binance non disponibile in modalità DEMO',
                suggestion: 'Configura BINANCE_MODE=testnet per usare Binance Testnet'
            });
        }

        const { symbol } = req.query;
        const client = getBinanceClient();
        const balance = await client.getBalance(symbol);

        res.json({
            success: true,
            mode: getMode(),
            balance: symbol ? balance : balance,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Errore getBalance:', error);
        res.status(500).json({
            error: error.message || 'Errore nel recupero del saldo',
            code: error.code
        });
    }
});

// GET /api/crypto/binance/price/:symbol - Get price from Binance
router.get('/binance/price/:symbol', async (req, res) => {
    try {
        if (!isBinanceAvailable()) {
            return res.status(400).json({
                error: 'Binance non disponibile in modalità DEMO'
            });
        }

        const { symbol } = req.params;
        const client = getBinanceClient();
        const price = await client.getPrice(symbol);

        res.json({
            success: true,
            mode: getMode(),
            ...price
        });
    } catch (error) {
        console.error('❌ Errore getPrice:', error);
        res.status(error.statusCode || 500).json({
            error: error.message || 'Errore nel recupero del prezzo',
            code: error.code
        });
    }
});

// GET /api/crypto/binance/symbols - Get available trading symbols
router.get('/binance/symbols', async (req, res) => {
    try {
        if (!isBinanceAvailable()) {
            return res.status(400).json({
                error: 'Binance non disponibile in modalità DEMO'
            });
        }

        const client = getBinanceClient();
        const baseUrl = client.getBaseUrl();
        
        const https = require('https');
        const exchangeInfo = await new Promise((resolve, reject) => {
            const req = https.get(`${baseUrl}/api/v3/exchangeInfo`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });

        const symbols = exchangeInfo.symbols
            .filter(s => s.status === 'TRADING')
            .map(s => ({
                symbol: s.symbol,
                baseAsset: s.baseAsset,
                quoteAsset: s.quoteAsset,
                filters: s.filters
            }));

        // Filtra simboli con SOL o EUR
        const solSymbols = symbols.filter(s => s.baseAsset === 'SOL' || s.quoteAsset === 'SOL');
        const eurSymbols = symbols.filter(s => s.baseAsset === 'EUR' || s.quoteAsset === 'EUR');

        res.json({
            success: true,
            mode: getMode(),
            total: symbols.length,
            solSymbols: solSymbols.slice(0, 20), // Mostra primi 20
            eurSymbols: eurSymbols.slice(0, 20),
            allSymbols: symbols.slice(0, 50) // Mostra primi 50 per riferimento
        });
    } catch (error) {
        console.error('❌ Errore getSymbols:', error);
        res.status(500).json({
            error: error.message || 'Errore nel recupero dei simboli',
            code: error.code
        });
    }
});

// POST /api/crypto/binance/order/market - Place market order
router.post('/binance/order/market', async (req, res) => {
    try {
        if (!isBinanceAvailable()) {
            return res.status(400).json({
                error: 'Binance non disponibile in modalità DEMO'
            });
        }

        const { symbol, side, quantity } = req.body;

        if (!symbol || !side || !quantity) {
            return res.status(400).json({
                error: 'Parametri mancanti: symbol, side, quantity sono obbligatori'
            });
        }

        if (!['BUY', 'SELL'].includes(side.toUpperCase())) {
            return res.status(400).json({
                error: 'side deve essere BUY o SELL'
            });
        }

        const client = getBinanceClient();
        const order = await client.placeMarketOrder(symbol, side, quantity);

        res.json({
            success: true,
            mode: getMode(),
            order
        });
    } catch (error) {
        console.error('❌ Errore placeMarketOrder:', error);
        console.error('❌ Stack:', error.stack);
        console.error('❌ Error details:', {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode,
            response: error.response || 'N/A'
        });
        
        res.status(error.statusCode || 500).json({
            error: error.message || 'Errore nella creazione dell\'ordine',
            code: error.code,
            details: error.statusCode === 400 ? 'Verifica parametri (simbolo, quantità minima)' : undefined
        });
    }
});

// POST /api/crypto/binance/order/limit - Place limit order
router.post('/binance/order/limit', async (req, res) => {
    try {
        if (!isBinanceAvailable()) {
            return res.status(400).json({
                error: 'Binance non disponibile in modalità DEMO'
            });
        }

        const { symbol, side, quantity, price } = req.body;

        if (!symbol || !side || !quantity || !price) {
            return res.status(400).json({
                error: 'Parametri mancanti: symbol, side, quantity, price sono obbligatori'
            });
        }

        if (!['BUY', 'SELL'].includes(side.toUpperCase())) {
            return res.status(400).json({
                error: 'side deve essere BUY o SELL'
            });
        }

        const client = getBinanceClient();
        const order = await client.placeLimitOrder(symbol, side, quantity, price);

        res.json({
            success: true,
            mode: getMode(),
            order
        });
    } catch (error) {
        console.error('❌ Errore placeLimitOrder:', error);
        res.status(500).json({
            error: error.message || 'Errore nella creazione dell\'ordine limite',
            code: error.code
        });
    }
});

// POST /api/crypto/binance/order/stop - Place stop-loss order
router.post('/binance/order/stop', async (req, res) => {
    try {
        if (!isBinanceAvailable()) {
            return res.status(400).json({
                error: 'Binance non disponibile in modalità DEMO'
            });
        }

        const { symbol, side, quantity, stopPrice } = req.body;

        if (!symbol || !side || !quantity || !stopPrice) {
            return res.status(400).json({
                error: 'Parametri mancanti: symbol, side, quantity, stopPrice sono obbligatori'
            });
        }

        if (!['BUY', 'SELL'].includes(side.toUpperCase())) {
            return res.status(400).json({
                error: 'side deve essere BUY o SELL'
            });
        }

        const client = getBinanceClient();
        const order = await client.placeStopLossOrder(symbol, side, quantity, stopPrice);

        res.json({
            success: true,
            mode: getMode(),
            order
        });
    } catch (error) {
        console.error('❌ Errore placeStopLossOrder:', error);
        res.status(500).json({
            error: error.message || 'Errore nella creazione dell\'ordine stop-loss',
            code: error.code
        });
    }
});

// GET /api/crypto/binance/orders/history - Get order history
router.get('/binance/orders/history', async (req, res) => {
    try {
        if (!isBinanceAvailable()) {
            return res.status(400).json({
                error: 'Binance non disponibile in modalità DEMO'
            });
        }

        const { symbol, limit } = req.query;
        const client = getBinanceClient();
        const orders = await client.getOrderHistory(symbol, parseInt(limit) || 50);

        res.json({
            success: true,
            mode: getMode(),
            orders,
            count: orders.length
        });
    } catch (error) {
        console.error('❌ Errore getOrderHistory:', error);
        res.status(500).json({
            error: error.message || 'Errore nel recupero dello storico ordini',
            code: error.code
        });
    }
});

// DELETE /api/crypto/binance/order/:symbol/:orderId - Cancel order
router.delete('/binance/order/:symbol/:orderId', async (req, res) => {
    try {
        if (!isBinanceAvailable()) {
            return res.status(400).json({
                error: 'Binance non disponibile in modalità DEMO'
            });
        }

        const { symbol, orderId } = req.params;
        const client = getBinanceClient();
        const result = await client.cancelOrder(symbol, orderId);

        res.json({
            success: true,
            mode: getMode(),
            result
        });
    } catch (error) {
        console.error('❌ Errore cancelOrder:', error);
        res.status(500).json({
            error: error.message || 'Errore nella cancellazione dell\'ordine',
            code: error.code
        });
    }
});
module.exports = router;