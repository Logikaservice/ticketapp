const express = require('express');
const router = express.Router();
const db = require('../crypto_db');
const https = require('https');

// Import new services
const riskManager = require('../services/RiskManager');
const signalGenerator = require('../services/BidirectionalSignalGenerator');

// Socket.io instance (will be set from index.js)
let ioInstance = null;

// Function to set Socket.io instance
const setSocketIO = (io) => {
    ioInstance = io;
};

// Helper to emit crypto events (optional auth - public room for crypto dashboard)
const emitCryptoEvent = (eventName, data) => {
    if (ioInstance) {
        // Emit to public crypto room (anyone viewing crypto dashboard)
        ioInstance.to('crypto:dashboard').emit(eventName, data);
        console.log(`📡 Emitted crypto event: ${eventName}`, data);
    }
};

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
        // Get interval from query parameter (default: 15m for TradingView, 1m for Lightweight Charts)
        const interval = req.query.interval || '15m'; // Support: 1m, 15m, 1h, 1d, etc.
        
        // Check if we have OHLC klines data first (preferred)
        const klinesCountRows = await dbAll(`SELECT COUNT(*) as count FROM klines WHERE symbol = 'bitcoin' AND interval = ?`, [interval]);
        const klinesCount = klinesCountRows && klinesCountRows.length > 0 ? klinesCountRows[0].count : 0;
        
        // Also check price_history for backward compatibility
        const countRows = await dbAll("SELECT COUNT(*) as count FROM price_history WHERE symbol = 'bitcoin'");
        const count = countRows && countRows.length > 0 ? countRows[0].count : 0;

        console.log(`📊 Klines count: ${klinesCount}, Price history count: ${count}`);

        // Determine limit based on interval
        let limit = 500;
        if (interval === '1m') {
            limit = 1440; // 1 day of 1-minute candles
        } else if (interval === '1d') {
            limit = 365; // 1 year of daily candles
        } else if (interval === '1h') {
            limit = 720; // 30 days of hourly candles
        }
        
        // If we have less than required klines, try to load from Binance
        // ✅ FIX: Carica sempre almeno 24 ore di candele per copertura completa
        const minRequired = interval === '1m' ? 1000 : 200;
        const shouldLoadFromBinance = klinesCount < minRequired;
        
        // ✅ FIX: Calcola sempre almeno 24 ore di candele per garantire copertura completa del giorno
        const candlesNeededFor24h = interval === '15m' ? 96 : // 24 hours (4 candles/hour * 24)
                                   interval === '1m' ? 1440 : // 24 hours (60 candles/hour * 24)
                                   interval === '5m' ? 288 : // 24 hours (12 candles/hour * 24)
                                   interval === '30m' ? 48 : // 24 hours (2 candles/hour * 24)
                                   interval === '1h' ? 24 : // 24 hours
                                   interval === '4h' ? 6 : // 24 hours
                                   interval === '1d' ? 30 : // 30 days
                                   96; // Default: 24 hours
        
        // ✅ FIX: Usa sempre almeno 24 ore, o il limite richiesto se maggiore
        const binanceLimit = Math.max(limit, candlesNeededFor24h);
        
        if (shouldLoadFromBinance || klinesCount < candlesNeededFor24h) {
            console.log(`📥 Loading ${binanceLimit} klines from Binance for interval ${interval} (current count: ${klinesCount})...`);
            
            try {
                // Load klines from Binance with specified interval
                const https = require('https');
                const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=BTCEUR&interval=${interval}&limit=${binanceLimit}`;
                
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

                // Save OHLC klines to database (complete candlestick data)
                let saved = 0;
                let savedKlines = 0;
                for (const kline of binanceData) {
                    // Binance kline format: [openTime, open, high, low, close, volume, closeTime, ...]
                    const openTime = parseInt(kline[0]);
                    const open = parseFloat(kline[1]);
                    const high = parseFloat(kline[2]);
                    const low = parseFloat(kline[3]);
                    const close = parseFloat(kline[4]);
                    const volume = parseFloat(kline[5]);
                    const closeTime = parseInt(kline[6]);
                    const timestamp = new Date(openTime).toISOString();
                    
                    try {
                        // Save close price for backward compatibility
                        await dbRun(
                            "INSERT OR IGNORE INTO price_history (symbol, price, timestamp) VALUES (?, ?, ?)",
                            ['bitcoin', close, timestamp]
                        );
                        saved++;
                        
                        // Save complete OHLC kline
                        await dbRun(
                            `INSERT OR IGNORE INTO klines 
                            (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            ['bitcoin', interval, openTime, open, high, low, close, volume, closeTime]
                        );
                        savedKlines++;
                    } catch (err) {
                        // Ignore duplicate errors
                    }
                }
                
                console.log(`✅ Loaded ${saved} historical prices and ${savedKlines} klines from Binance`);
            } catch (err) {
                console.error('⚠️ Error loading from Binance, using existing data:', err.message);
            }
        }

        // Try to get OHLC klines first (more accurate) with specified interval
        // ✅ FIX CRITICO: Prendi le ULTIME N candele (più recenti), poi ordina per ASC per il grafico
        // Calcola il timestamp minimo per le ultime N candele (circa 24 ore per 15m = 96 candele)
        const now = Date.now();
        const intervalMs = {
            '1m': 60 * 1000,
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '30m': 30 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000
        };
        const intervalDuration = intervalMs[interval] || 15 * 60 * 1000;
        const minTime = now - (limit * intervalDuration); // Timestamp minimo per le ultime N candele
        
        const klinesRows = await dbAll(
            `SELECT open_time, open_price, high_price, low_price, close_price, volume 
             FROM klines 
             WHERE symbol = 'bitcoin' AND interval = ? AND open_time >= ? 
             ORDER BY open_time ASC 
             LIMIT ?`,
            [interval, minTime, limit]
        );
        
        if (klinesRows && klinesRows.length > 0) {
            // Return OHLC candlesticks (like TradingView)
            const candles = klinesRows
                .map(row => {
                    // open_time from Binance is in milliseconds, convert to seconds for Lightweight Charts
                    const timeSeconds = Math.floor(row.open_time / 1000);
                    return {
                        time: timeSeconds, // Unix timestamp in seconds
                        open: parseFloat(row.open_price),
                        high: parseFloat(row.high_price),
                        low: parseFloat(row.low_price),
                        close: parseFloat(row.close_price),
                        volume: parseFloat(row.volume || 0)
                    };
                })
                .filter(candle => !isNaN(candle.time) && candle.time > 0) // Filter invalid data
                .sort((a, b) => a.time - b.time); // Ordina per sicurezza
            
            // ✅ FIX: Verifica e riempi buchi nel grafico
            if (candles.length > 1) {
                const intervalSeconds = interval === '15m' ? 15 * 60 : 
                                       interval === '1m' ? 60 :
                                       interval === '5m' ? 5 * 60 :
                                       interval === '30m' ? 30 * 60 :
                                       interval === '1h' ? 60 * 60 :
                                       interval === '4h' ? 4 * 60 * 60 :
                                       interval === '1d' ? 24 * 60 * 60 : 15 * 60;
                
                const filledCandles = [];
                for (let i = 0; i < candles.length - 1; i++) {
                    filledCandles.push(candles[i]);
                    
                    // Verifica se c'è un buco tra questa candela e la successiva
                    const currentTime = candles[i].time;
                    const nextTime = candles[i + 1].time;
                    const expectedNextTime = currentTime + intervalSeconds;
                    
                    // Se c'è un gap maggiore di 1.5x l'intervallo, riempi con candele vuote
                    if (nextTime - currentTime > intervalSeconds * 1.5) {
                        let gapTime = expectedNextTime;
                        while (gapTime < nextTime - intervalSeconds / 2) {
                            // Crea candela "vuota" (usa close della candela precedente)
                            filledCandles.push({
                                time: gapTime,
                                open: candles[i].close,
                                high: candles[i].close,
                                low: candles[i].close,
                                close: candles[i].close,
                                volume: 0
                            });
                            gapTime += intervalSeconds;
                        }
                    }
                }
                filledCandles.push(candles[candles.length - 1]); // Aggiungi ultima candela
                
                const firstTime = filledCandles[0] ? new Date(filledCandles[0].time * 1000).toISOString() : 'N/A';
                const lastTime = filledCandles[filledCandles.length - 1] ? new Date(filledCandles[filledCandles.length - 1].time * 1000).toISOString() : 'N/A';
                console.log(`📊 Returning ${filledCandles.length} OHLC candlesticks from klines table (interval: ${interval}, original: ${candles.length}, filled gaps)`);
                console.log(`📊 Time range: ${firstTime} to ${lastTime}`);
                res.json(filledCandles);
            } else {
                const firstTime = candles[0] ? new Date(candles[0].time * 1000).toISOString() : 'N/A';
                const lastTime = candles[candles.length - 1] ? new Date(candles[candles.length - 1].time * 1000).toISOString() : 'N/A';
                console.log(`📊 Returning ${candles.length} OHLC candlesticks from klines table (interval: ${interval})`);
                console.log(`📊 Time range: ${firstTime} to ${lastTime}`);
                res.json(candles);
            }
        } else {
            // Fallback to price_history points (backward compatibility)
            const historyRows = await dbAll("SELECT price, timestamp FROM price_history WHERE symbol = 'bitcoin' ORDER BY timestamp ASC LIMIT 500");
            
            // Convert to format expected by frontend
            const history = (historyRows || []).map(row => ({
                time: new Date(row.timestamp).getTime() / 1000, // Unix timestamp in seconds
                price: row.price,
                timestamp: row.timestamp
            }));

            console.log(`📊 Returning ${history.length} price history points (fallback)`);
            res.json(history);
        }
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

        // 2. Fallback to CoinGecko (for Bitcoin, not Solana!)
        if (!price) {
            try {
                const geckoData = await httpsGet('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur');
                if (geckoData && geckoData.bitcoin && geckoData.bitcoin.eur) {
                    price = parseFloat(geckoData.bitcoin.eur);
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

        // Return price in EUR (same format as bot uses from Binance)
        res.json({ 
            success: true,
            price: price, // EUR price from Binance
            currency: 'EUR',
            source: price > 0 ? 'Binance' : 'Fallback',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Critical Error fetching price:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/crypto/reset (Reset Demo Portfolio)
router.post('/reset', async (req, res) => {
    try {
        // 1. Conta posizioni e trades prima di cancellarli
        const positionCountRows = await dbAll("SELECT COUNT(*) as count FROM open_positions");
        const positionCount = positionCountRows && positionCountRows.length > 0 ? positionCountRows[0].count : 0;
        
        const tradeCountRows = await dbAll("SELECT COUNT(*) as count FROM trades");
        const tradeCount = tradeCountRows && tradeCountRows.length > 0 ? tradeCountRows[0].count : 0;
        
        // 2. Cancella TUTTE le posizioni (aperte e chiuse) - questo rimuove anche dal grafico
        await dbRun("DELETE FROM open_positions");
        console.log(`🗑️ Cancellate ${positionCount} posizione/i (aperte e chiuse)`);
        
        // 3. Cancella TUTTI i trades - questo rimuove marker dal grafico e lista recenti
        await dbRun("DELETE FROM trades");
        console.log(`🗑️ Cancellati ${tradeCount} trade/i`);
        
        // 4. Reset portfolio a €250
        await dbRun("UPDATE portfolio SET balance_usd = 250, holdings = '{}' WHERE id = 1");
        
        // 5. Invalida cache Risk Manager
        riskManager.invalidateCache();
        
        res.json({ 
            success: true, 
            message: `Portfolio resettato completamente a €250. Cancellate ${positionCount} posizione/i e ${tradeCount} trade/i. Grafico e lista recenti puliti.`,
            deleted_positions: positionCount,
            deleted_trades: tradeCount
        });
    } catch (err) {
        console.error('Error resetting portfolio:', err);
        res.status(500).json({ error: err.message });
    }
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
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds

// Default strategy parameters (fallback if not configured)
const DEFAULT_PARAMS = {
    rsi_period: 14,
    rsi_oversold: 30,
    rsi_overbought: 70,
    stop_loss_pct: 2.0,
    take_profit_pct: 3.0,
    trade_size_eur: 50,
    trailing_stop_enabled: false,
    trailing_stop_distance_pct: 1.0,
    partial_close_enabled: false,
    take_profit_1_pct: 1.5,
    take_profit_2_pct: 3.0
};

// Helper to get bot strategy parameters from database
const getBotParameters = async () => {
    try {
        const bot = await dbGet("SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy'");
        if (bot && bot.parameters) {
            const params = JSON.parse(bot.parameters);
            // Merge with defaults to ensure all parameters exist
            return { ...DEFAULT_PARAMS, ...params };
        }
    } catch (err) {
        console.error('Error loading bot parameters:', err.message);
    }
    // Return defaults if error or not found
    return DEFAULT_PARAMS;
};

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
const calculateRSI = (prices, period = 14) => {
    if (prices.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = prices[prices.length - i] - prices[prices.length - i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }

    if (losses === 0) return 100;

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

// Bot Loop Function - SERIOUS VERSION with Risk Manager and Bidirectional Signals
const runBotCycle = async () => {
    try {
        // 1. Check if bot is active (we run price collection ANYWAY to keep history valid)
        const bot = await dbGet("SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy'");
        const isBotActive = bot && bot.is_active;

        // 2. Get current price (BITCOIN)
        const symbol = 'bitcoin';
        let currentPrice = 0;

        try {
            const data = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=BTCEUR`);
            if (data && data.price) {
                currentPrice = parseFloat(data.price);
            } else {
                throw new Error("Invalid data from Binance");
            }
        } catch (e) {
            console.error('Error fetching price from Binance:', e.message);
            try {
                const geckoData = await httpsGet('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur');
                if (geckoData && geckoData.bitcoin && geckoData.bitcoin.eur) {
                    currentPrice = parseFloat(geckoData.bitcoin.eur);
                }
            } catch (e2) {
                console.error('Error fetching price from CoinGecko:', e2.message);
                if (currentPrice === 0) currentPrice = 120.00 + (Math.random() * 0.5);
            }
        }

        // 3. Update history (RAM + DB)
        priceHistory.push(currentPrice);
        if (priceHistory.length > 50) priceHistory.shift();

        await dbRun("INSERT INTO price_history (symbol, price) VALUES (?, ?)", [symbol, currentPrice]);

        // ✅ FIX: Aggiorna candele klines in tempo reale per tutti gli intervalli
        const intervalsToUpdate = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
        const now = Date.now();
        
        // Helper function per calcolare candleStartTime allineato ai minuti naturali
        const calculateAlignedCandleTime = (timestamp, interval) => {
            const date = new Date(timestamp);
            
            if (interval === '1m') {
                date.setSeconds(0, 0);
                return date.getTime();
            } else if (interval === '5m') {
                const minutes = date.getMinutes();
                const alignedMinutes = Math.floor(minutes / 5) * 5;
                date.setMinutes(alignedMinutes, 0, 0);
                return date.getTime();
            } else if (interval === '15m') {
                // ✅ FIX CRITICO: Allinea ai 15 minuti naturali (00:00, 00:15, 00:30, 00:45)
                const minutes = date.getMinutes();
                const alignedMinutes = Math.floor(minutes / 15) * 15;
                date.setMinutes(alignedMinutes, 0, 0);
                return date.getTime();
            } else if (interval === '30m') {
                const minutes = date.getMinutes();
                const alignedMinutes = Math.floor(minutes / 30) * 30;
                date.setMinutes(alignedMinutes, 0, 0);
                return date.getTime();
            } else if (interval === '1h') {
                date.setMinutes(0, 0, 0);
                return date.getTime();
            } else if (interval === '4h') {
                const hours = date.getHours();
                const alignedHours = Math.floor(hours / 4) * 4;
                date.setHours(alignedHours, 0, 0, 0);
                return date.getTime();
            } else if (interval === '1d') {
                date.setHours(0, 0, 0, 0);
                return date.getTime();
            } else {
                // Fallback
                const intervalMs = {
                    '1m': 60 * 1000,
                    '5m': 5 * 60 * 1000,
                    '15m': 15 * 60 * 1000,
                    '30m': 30 * 60 * 1000,
                    '1h': 60 * 60 * 1000,
                    '4h': 4 * 60 * 60 * 1000,
                    '1d': 24 * 60 * 60 * 1000
                };
                const intervalDuration = intervalMs[interval] || 15 * 60 * 1000;
                return Math.floor(timestamp / intervalDuration) * intervalDuration;
            }
        };
        
        // Aggiorna solo l'intervallo più importante (15m) per evitare troppe query
        // Gli altri intervalli verranno aggiornati quando necessario
        const primaryInterval = '15m';
        
        try {
            // ✅ FIX: Usa funzione helper per allineamento corretto
            const candleStartTime = calculateAlignedCandleTime(now, primaryInterval);
            
            // Verifica se esiste già una candela per questo periodo
            const existingKline = await dbGet(
                "SELECT * FROM klines WHERE symbol = ? AND interval = ? AND open_time = ?",
                ['bitcoin', primaryInterval, candleStartTime]
            );
            
            if (existingKline) {
                // Aggiorna candela esistente: aggiorna high, low, close
                const newHigh = Math.max(existingKline.high_price, currentPrice);
                const newLow = Math.min(existingKline.low_price, currentPrice);
                
                await dbRun(
                    "UPDATE klines SET high_price = ?, low_price = ?, close_price = ?, close_time = ? WHERE symbol = ? AND interval = ? AND open_time = ?",
                    [newHigh, newLow, currentPrice, now, 'bitcoin', primaryInterval, candleStartTime]
                );
                
                // Log solo ogni 10 aggiornamenti per non intasare i log
                if (Math.random() < 0.1) {
                    console.log(`📊 Kline ${primaryInterval} aggiornata: ${new Date(candleStartTime).toISOString()} | Price: €${currentPrice.toFixed(2)} | High: €${newHigh.toFixed(2)} | Low: €${newLow.toFixed(2)}`);
                }
            } else {
                // Crea nuova candela
                await dbRun(
                    `INSERT INTO klines 
                    (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    ['bitcoin', primaryInterval, candleStartTime, currentPrice, currentPrice, currentPrice, currentPrice, 0, now]
                );
                console.log(`🆕 Nuova candela ${primaryInterval} creata: ${new Date(candleStartTime).toISOString()} | Price: €${currentPrice.toFixed(2)}`);
            }
        } catch (err) {
            console.error(`⚠️ Error updating kline for interval ${primaryInterval}:`, err.message);
        }
        
        // Aggiorna anche gli altri intervalli, ma meno frequentemente (ogni 10 cicli)
        if (Math.random() < 0.1) {
            for (const interval of intervalsToUpdate) {
                if (interval === primaryInterval) continue; // Già aggiornato sopra
                
                try {
                    // ✅ FIX: Usa funzione helper per allineamento corretto
                    const candleStartTime = calculateAlignedCandleTime(now, interval);
                    
                    const existingKline = await dbGet(
                        "SELECT * FROM klines WHERE symbol = ? AND interval = ? AND open_time = ?",
                        ['bitcoin', interval, candleStartTime]
                    );
                    
                    if (existingKline) {
                        const newHigh = Math.max(existingKline.high_price, currentPrice);
                        const newLow = Math.min(existingKline.low_price, currentPrice);
                        
                        await dbRun(
                            "UPDATE klines SET high_price = ?, low_price = ?, close_price = ?, close_time = ? WHERE symbol = ? AND interval = ? AND open_time = ?",
                            [newHigh, newLow, currentPrice, now, 'bitcoin', interval, candleStartTime]
                        );
                    } else {
                        await dbRun(
                            `INSERT INTO klines 
                            (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            ['bitcoin', interval, candleStartTime, currentPrice, currentPrice, currentPrice, currentPrice, 0, now]
                        );
                    }
                } catch (err) {
                    // Ignora errori per singoli intervalli
                }
            }
        }

        // Optional: Cleanup old history
        if (Math.random() < 0.01) {
            await dbRun("DELETE FROM price_history WHERE id NOT IN (SELECT id FROM price_history ORDER BY timestamp DESC LIMIT 1000)");
        }

        // 4. Update all open positions P&L (this handles SL/TP/trailing stop automatically)
        await updatePositionsPnL(currentPrice, symbol);

        // 5. Get bot parameters
        const params = await getBotParameters();
        const rsi = calculateRSI(priceHistory, params.rsi_period);
        latestRSI = rsi;

        if (rsi) {
            console.log(`🤖 BOT: BTC/EUR=${currentPrice.toFixed(2)}€ | RSI=${rsi.toFixed(2)} | Active=${isBotActive}`);
        }

        if (!isBotActive || !rsi) return; // Stop here if bot is off

        // 6. RISK CHECK - Protezione PRIMA di tutto
        const riskCheck = await riskManager.calculateMaxRisk();
        
        if (!riskCheck.canTrade) {
            console.log(`🛑 RISK MANAGER: Trading blocked - ${riskCheck.reason}`);
            console.log(`   Daily Loss: ${(riskCheck.dailyLoss * 100).toFixed(2)}% | Exposure: ${(riskCheck.currentExposure * 100).toFixed(2)}% | Drawdown: ${(riskCheck.drawdown * 100).toFixed(2)}%`);
            return; // STOP - Non tradare se rischio troppo alto
        }

        console.log(`✅ RISK MANAGER: OK - Max Position: €${riskCheck.maxPositionSize.toFixed(2)} | Available Exposure: ${(riskCheck.availableExposurePct * 100).toFixed(2)}%`);

        // 7. Get price history for signal generation
        const priceHistoryData = await dbAll(
            "SELECT price, timestamp FROM price_history WHERE symbol = ? ORDER BY timestamp DESC LIMIT 50",
            [symbol]
        );
        
        // Reverse to chronological order
        const historyForSignal = priceHistoryData.reverse().map(row => ({
            price: row.price,
            timestamp: row.timestamp
        }));

        // 8. Generate bidirectional signal
        const signal = signalGenerator.generateSignal(historyForSignal);

        // ✅ LOGGING DETTAGLIATO per debug
        console.log(`📡 SIGNAL ANALYSIS:`);
        console.log(`   Direction: ${signal.direction}`);
        console.log(`   Strength: ${signal.strength}/100`);
        console.log(`   Confirmations: ${signal.confirmations || 0}`);
        console.log(`   Reasons: ${signal.reasons.join(' | ')}`);
        if (signal.indicators) {
            console.log(`   RSI: ${signal.indicators.rsi?.toFixed(2) || 'N/A'}`);
            console.log(`   Trend: ${signal.indicators.trend || 'N/A'}`);
            console.log(`   MACD: ${signal.indicators.macd ? 'Present' : 'N/A'}`);
        }

        // 9. Get current open positions
        const openPositions = await dbAll(
            "SELECT * FROM open_positions WHERE symbol = ? AND status = 'open'",
            [symbol]
        );

        const longPositions = openPositions.filter(p => p.type === 'buy');
        const shortPositions = openPositions.filter(p => p.type === 'sell');

        console.log(`📊 OPEN POSITIONS: LONG=${longPositions.length} | SHORT=${shortPositions.length}`);

        // 10. DECISION LOGIC - Solo se segnale FORTISSIMO (90% certezza)
        // ✅ STRATEGIA: 1000 posizioni piccole su analisi giuste > 1 posizione ogni tanto
        // Permettiamo MULTIPLE posizioni se il segnale è forte e il risk manager lo permette
        const MIN_SIGNAL_STRENGTH = 70; // Soglia alta per sicurezza 90%
        
        if (signal.direction === 'LONG' && signal.strength >= MIN_SIGNAL_STRENGTH) {
            // Verifica se possiamo aprire LONG
            // ✅ FIX: Calcola position size considerando posizioni già aperte (per permettere multiple)
            const maxAvailableForNewPosition = Math.min(
                params.trade_size_eur, 
                riskCheck.maxPositionSize,
                riskCheck.availableExposure * 0.1 // Max 10% dell'exposure disponibile per nuova posizione
            );
            const canOpen = await riskManager.canOpenPosition(maxAvailableForNewPosition);
            
            console.log(`🔍 LONG SIGNAL CHECK: Strength=${signal.strength} (>=${MIN_SIGNAL_STRENGTH}) | Confirmations=${signal.confirmations} (>=3) | CanOpen=${canOpen.allowed} | LongPositions=${longPositions.length} | AvailableExposure=${riskCheck.availableExposure.toFixed(2)}€`);

            // ✅ FIX: Rimuovo controllo longPositions.length === 0 - permetto multiple posizioni
            if (canOpen.allowed) {
                // Apri LONG position
                const amount = positionSize / currentPrice;
                const stopLoss = currentPrice * (1 - params.stop_loss_pct / 100);
                const takeProfit = currentPrice * (1 + params.take_profit_pct / 100);

                const options = {
                    trailing_stop_enabled: params.trailing_stop_enabled || false,
                    trailing_stop_distance_pct: params.trailing_stop_distance_pct || 1.0,
                    partial_close_enabled: params.partial_close_enabled || false,
                    take_profit_1_pct: params.take_profit_1_pct || 1.5,
                    take_profit_2_pct: params.take_profit_2_pct || 3.0
                };

                await openPosition(symbol, 'buy', amount, currentPrice, `LONG Signal (${signal.strength}/100)`, stopLoss, takeProfit, options);
                console.log(`✅ BOT LONG: Opened position #${longPositions.length + 1} @ €${currentPrice.toFixed(2)} | Size: €${maxAvailableForNewPosition.toFixed(2)} | Signal: ${signal.reasons.join(', ')}`);
                riskManager.invalidateCache(); // Invalida cache dopo operazione
            } else if (!canOpen.allowed) {
                console.log(`⚠️ BOT LONG: Cannot open - ${canOpen.reason} | Current exposure: ${(riskCheck.currentExposure * 100).toFixed(2)}% | Available: €${riskCheck.availableExposure.toFixed(2)}`);
            }
        }
        else if (signal.direction === 'SHORT' && signal.strength >= MIN_SIGNAL_STRENGTH) {
            // Verifica se possiamo aprire SHORT
            // ✅ FIX: Calcola position size considerando posizioni già aperte (per permettere multiple)
            const maxAvailableForNewPosition = Math.min(
                params.trade_size_eur, 
                riskCheck.maxPositionSize,
                riskCheck.availableExposure * 0.1 // Max 10% dell'exposure disponibile per nuova posizione
            );
            const canOpen = await riskManager.canOpenPosition(maxAvailableForNewPosition);
            
            console.log(`🔍 SHORT SIGNAL CHECK: Strength=${signal.strength} (>=${MIN_SIGNAL_STRENGTH}) | Confirmations=${signal.confirmations} (>=5) | CanOpen=${canOpen.allowed} | ShortPositions=${shortPositions.length} | AvailableExposure=${riskCheck.availableExposure.toFixed(2)}€`);

            // ✅ FIX: Rimuovo controllo shortPositions.length === 0 - permetto multiple posizioni
            if (canOpen.allowed) {
                // Apri SHORT position
                const amount = positionSize / currentPrice;
                const stopLoss = currentPrice * (1 + params.stop_loss_pct / 100); // Per SHORT, SL è sopra
                const takeProfit = currentPrice * (1 - params.take_profit_pct / 100); // Per SHORT, TP è sotto

                const options = {
                    trailing_stop_enabled: params.trailing_stop_enabled || false,
                    trailing_stop_distance_pct: params.trailing_stop_distance_pct || 1.0,
                    partial_close_enabled: params.partial_close_enabled || false,
                    take_profit_1_pct: params.take_profit_1_pct || 1.5,
                    take_profit_2_pct: params.take_profit_2_pct || 3.0
                };

                await openPosition(symbol, 'sell', amount, currentPrice, `SHORT Signal (${signal.strength}/100)`, stopLoss, takeProfit, options);
                console.log(`✅ BOT SHORT: Opened position #${shortPositions.length + 1} @ €${currentPrice.toFixed(2)} | Size: €${maxAvailableForNewPosition.toFixed(2)} | Signal: ${signal.reasons.join(', ')}`);
                riskManager.invalidateCache(); // Invalida cache dopo operazione
            } else if (!canOpen.allowed) {
                console.log(`⚠️ BOT SHORT: Cannot open - ${canOpen.reason} | Current exposure: ${(riskCheck.currentExposure * 100).toFixed(2)}% | Available: €${riskCheck.availableExposure.toFixed(2)}`);
            }
        }
        else {
            // Segnale NEUTRAL o troppo debole
            if (signal.direction === 'NEUTRAL') {
                console.log(`➡️ BOT: Neutral signal (strength: ${signal.strength}/100, confirmations: ${signal.confirmations || 0}) - No action`);
                console.log(`   Reason: ${signal.reasons[0] || 'Unknown'}`);
            } else if (signal.direction === 'LONG' || signal.direction === 'SHORT') {
                const minStrength = signal.direction === 'LONG' ? 50 : 50;
                const minConfirmations = signal.direction === 'LONG' ? 3 : 4;
                console.log(`➡️ BOT: ${signal.direction} signal too weak - No action`);
                console.log(`   Strength: ${signal.strength}/100 (required: >= ${minStrength})`);
                console.log(`   Confirmations: ${signal.confirmations || 0} (required: >= ${minConfirmations})`);
                console.log(`   Reasons: ${signal.reasons.slice(0, 3).join(' | ')}`);
            } else {
                console.log(`➡️ BOT: Unknown signal direction - No action`);
            }
        }

    } catch (error) {
        console.error('❌ Bot Cycle Error:', error.message);
        console.error(error.stack);
    }
};

// Helper to open a position (used by bot)
const openPosition = async (symbol, type, volume, entryPrice, strategy, stopLoss = null, takeProfit = null, options = {}) => {
    try {
        // Use Promise-based getPortfolio to properly await the result
        const portfolio = await getPortfolio();
        
        const cost = volume * entryPrice;
        let balance = portfolio.balance_usd;
        let holdings = JSON.parse(portfolio.holdings || '{}');

        const balanceBefore = balance;
        
        if (type === 'buy') {
            if (balance < cost) {
                throw new Error('Insufficient funds');
            }
            balance -= cost;
            holdings[symbol] = (holdings[symbol] || 0) + volume;
            console.log(`💵 LONG OPEN: Balance ${balanceBefore.toFixed(2)} → ${balance.toFixed(2)} (-€${cost.toFixed(2)}) | Holdings: ${holdings[symbol].toFixed(8)}`);
        } else {
            // ✅ FIX CRITICO: Short position - ricevi denaro ma NON toccare holdings
            // In uno SHORT vendi allo scoperto (non possiedi la crypto), quindi holdings NON cambiano
            balance += cost;
            // holdings[symbol] NON DEVE CAMBIARE all'apertura di uno SHORT
            console.log(`💵 SHORT OPEN: Balance ${balanceBefore.toFixed(2)} → ${balance.toFixed(2)} (+€${cost.toFixed(2)}) | Holdings: ${holdings[symbol] || 0} (unchanged - short position)`);
        }

        const ticketId = generateTicketId();

        // Update database using Promise-based operations (sequentially to ensure order)
        await dbRun(
            "UPDATE portfolio SET balance_usd = ?, holdings = ?",
            [balance, JSON.stringify(holdings)]
        );
        
        // Prepare additional fields for trailing stop and partial close
        const trailingStopEnabled = options.trailing_stop_enabled ? 1 : 0;
        const trailingStopDistance = options.trailing_stop_distance_pct || 0;
        const tp1Enabled = options.partial_close_enabled && options.take_profit_1_pct ? 1 : 0;
        const takeProfit1 = tp1Enabled ? entryPrice * (1 + (type === 'buy' ? options.take_profit_1_pct : -options.take_profit_1_pct) / 100) : null;
        const takeProfit2 = tp1Enabled && options.take_profit_2_pct ? entryPrice * (1 + (type === 'buy' ? options.take_profit_2_pct : -options.take_profit_2_pct) / 100) : null;

        await dbRun(
            `INSERT INTO open_positions 
            (ticket_id, symbol, type, volume, entry_price, current_price, stop_loss, take_profit, strategy, status,
             trailing_stop_enabled, trailing_stop_distance_pct, highest_price,
             take_profit_1, take_profit_2)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
            [ticketId, symbol, type, volume, entryPrice, entryPrice, stopLoss, takeProfit, strategy || 'Bot',
             trailingStopEnabled, trailingStopDistance, entryPrice, takeProfit1, takeProfit2]
        );

        await dbRun(
            "INSERT INTO trades (symbol, type, amount, price, strategy) VALUES (?, ?, ?, ?, ?)",
            [symbol, type, volume, entryPrice, strategy || 'Bot Open']
        );

        // Emit real-time notification
        emitCryptoEvent('crypto:position-opened', {
            ticket_id: ticketId,
            symbol,
            type,
            volume,
            entry_price: entryPrice,
            stop_loss: stopLoss,
            take_profit: takeProfit,
            strategy: strategy || 'Bot',
            timestamp: new Date().toISOString()
        });

        console.log(`✅ POSITION OPENED: ${ticketId} | ${type.toUpperCase()} ${volume.toFixed(8)} ${symbol} @ €${entryPrice.toFixed(2)} | SL: €${stopLoss?.toFixed(2) || 'N/A'} | TP: €${takeProfit?.toFixed(2) || 'N/A'}`);
        
        return ticketId;
    } catch (err) {
        console.error('Error in openPosition:', err.message);
        throw err;
    }
};

// Helper to execute trade internally (legacy - now uses positions)
const executeTrade = async (symbol, type, amount, price, strategy, realizedPnl = null, botParams = null) => {
    // If it's a buy, open a position
    if (type === 'buy') {
        try {
            // Use bot parameters if available, otherwise defaults
            const params = botParams || DEFAULT_PARAMS;
            const STOP_LOSS_PCT = params.stop_loss_pct / 100;
            const TAKE_PROFIT_PCT = params.take_profit_pct / 100;
            const stopLoss = price * (1 - STOP_LOSS_PCT);
            const takeProfit = price * (1 + TAKE_PROFIT_PCT);
            
            // Prepare options for trailing stop and partial close
            const options = {
                trailing_stop_enabled: params.trailing_stop_enabled || false,
                trailing_stop_distance_pct: params.trailing_stop_distance_pct || 1.0,
                partial_close_enabled: params.partial_close_enabled || false,
                take_profit_1_pct: params.take_profit_1_pct || 1.5,
                take_profit_2_pct: params.take_profit_2_pct || 3.0
            };
            
            await openPosition(symbol, type, amount, price, strategy, stopLoss, takeProfit, options);
            console.log(`✅ Position opened: ${type.toUpperCase()} ${amount} ${symbol} @ ${price} | TS: ${options.trailing_stop_enabled ? 'ON' : 'OFF'} | PC: ${options.partial_close_enabled ? 'ON' : 'OFF'}`);
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
                let remainingVolume = pos.volume - (pos.volume_closed || 0);

                if (pos.type === 'buy') {
                    // Long position: profit when price goes up
                    pnl = (currentPrice - pos.entry_price) * remainingVolume;
                    pnlPct = ((currentPrice - pos.entry_price) / pos.entry_price) * 100;
                } else {
                    // Short position: profit when price goes down
                    pnl = (pos.entry_price - currentPrice) * remainingVolume;
                    pnlPct = ((pos.entry_price - currentPrice) / pos.entry_price) * 100;
                }

                // Track highest price for trailing stop loss
                let highestPrice = pos.highest_price || pos.entry_price;
                let stopLoss = pos.stop_loss;
                let shouldUpdateStopLoss = false;

                // Update highest price for long positions (buy)
                if (pos.type === 'buy' && currentPrice > highestPrice) {
                    highestPrice = currentPrice;
                    shouldUpdateStopLoss = true;
                }
                // Update lowest price for short positions (sell) - for trailing stop
                // NOTE: We use highest_price column to track lowest price for SHORT (database limitation)
                // For SHORT: profit when price goes DOWN, so we track the LOWEST price reached
                else if (pos.type === 'sell') {
                    // For SHORT, highest_price actually stores the LOWEST price (confusing but works)
                    const currentLowest = pos.highest_price || pos.entry_price;
                    if (currentPrice < currentLowest) {
                        highestPrice = currentPrice; // Track new lowest price for SHORT
                        shouldUpdateStopLoss = true;
                    }
                }

                // Trailing Stop Loss Logic
                if (pos.trailing_stop_enabled && pos.trailing_stop_distance_pct > 0) {
                    if (pos.type === 'buy') {
                        // For long positions, trailing stop moves up as price increases
                        if (currentPrice > highestPrice) {
                            // Calculate new trailing stop loss
                            const trailingStopPrice = highestPrice * (1 - pos.trailing_stop_distance_pct / 100);
                            // Only update if new stop loss is higher than current
                            if (!stopLoss || trailingStopPrice > stopLoss) {
                                stopLoss = trailingStopPrice;
                                shouldUpdateStopLoss = true;
                            }
                        }
                    } else {
                        // For short positions, trailing stop moves down as price decreases
                        // highest_price actually stores the LOWEST price for SHORT positions
                        const lowestPrice = highestPrice || pos.entry_price;
                        if (currentPrice < lowestPrice) {
                            // Trailing stop for SHORT: SL = lowest_price * (1 + distance%)
                            // This moves the SL DOWN as price goes DOWN (protecting profit)
                            const trailingStopPrice = currentPrice * (1 + pos.trailing_stop_distance_pct / 100);
                            // Only update if new stop loss is LOWER than current (for SHORT, lower SL = better)
                            if (!stopLoss || trailingStopPrice < stopLoss) {
                                stopLoss = trailingStopPrice;
                                shouldUpdateStopLoss = true;
                                console.log(`📈 TRAILING STOP UPDATE (SHORT): ${pos.ticket_id} | Lowest: €${currentPrice.toFixed(2)} | New SL: €${trailingStopPrice.toFixed(2)}`);
                            }
                        }
                    }
                }

                // Update position with current price, P&L, and potentially new stop loss/highest price
                const updateFields = ['current_price = ?', 'profit_loss = ?', 'profit_loss_pct = ?'];
                const updateValues = [currentPrice, pnl, pnlPct];

                if (shouldUpdateStopLoss) {
                    updateFields.push('highest_price = ?', 'stop_loss = ?');
                    updateValues.push(highestPrice, stopLoss);
                }

                updateValues.push(pos.ticket_id);
                db.run(
                    `UPDATE open_positions SET ${updateFields.join(', ')} WHERE ticket_id = ?`,
                    updateValues
                );

                // Partial Close: Check TP1 (if configured)
                if (pos.take_profit_1 && !pos.tp1_hit && remainingVolume > 0) {
                    let tp1Hit = false;
                    if (pos.type === 'buy' && currentPrice >= pos.take_profit_1) {
                        tp1Hit = true;
                    } else if (pos.type === 'sell' && currentPrice <= pos.take_profit_1) {
                        tp1Hit = true;
                    }

                    if (tp1Hit) {
                        // Close 50% of remaining position at TP1
                        const volumeToClose = remainingVolume * 0.5;
                        console.log(`📊 PARTIAL CLOSE TP1: ${pos.ticket_id} | Closing 50% (${volumeToClose.toFixed(8)}) at €${currentPrice.toFixed(2)}`);
                        await partialClosePosition(pos.ticket_id, volumeToClose, currentPrice, 'TP1');
                        // Mark TP1 as hit (partialClosePosition already updates volume_closed, so we only mark the flag)
                        await dbRun(
                            "UPDATE open_positions SET tp1_hit = 1 WHERE ticket_id = ?",
                            [pos.ticket_id]
                        );
                        console.log(`✅ PARTIAL CLOSE TP1 COMPLETE: ${pos.ticket_id}`);
                    }
                }

                // Re-fetch position to get updated values after partial close
                const updatedPos = await dbGet("SELECT * FROM open_positions WHERE ticket_id = ?", [pos.ticket_id]);
                if (!updatedPos || updatedPos.status !== 'open') continue; // Skip if closed

                const finalRemainingVolume = updatedPos.volume - (updatedPos.volume_closed || 0);
                if (finalRemainingVolume <= 0.0001) {
                    // Position fully closed by partial close, mark as closed
                    await dbRun(
                        "UPDATE open_positions SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE ticket_id = ?",
                        [pos.ticket_id]
                    );
                    continue;
                }

                // Check stop loss and take profit (TP2 if TP1 was hit, otherwise original TP)
                const activeTakeProfit = (updatedPos.tp1_hit && updatedPos.take_profit_2) ? updatedPos.take_profit_2 : updatedPos.take_profit;
                const activeStopLoss = updatedPos.stop_loss;

                if (activeStopLoss || activeTakeProfit) {
                    let shouldClose = false;
                    let closeReason = '';

                    if (updatedPos.type === 'buy') {
                        // Long position
                        if (activeStopLoss && currentPrice <= activeStopLoss) {
                            shouldClose = true;
                            closeReason = 'stopped';
                            console.log(`🛑 STOP LOSS TRIGGERED: ${updatedPos.ticket_id} | LONG | Price: €${currentPrice.toFixed(2)} <= SL: €${activeStopLoss.toFixed(2)}`);
                        } else if (activeTakeProfit && currentPrice >= activeTakeProfit) {
                            shouldClose = true;
                            closeReason = updatedPos.tp1_hit ? 'taken (TP2)' : 'taken';
                            console.log(`🎯 TAKE PROFIT TRIGGERED: ${updatedPos.ticket_id} | LONG | Price: €${currentPrice.toFixed(2)} >= TP: €${activeTakeProfit.toFixed(2)}`);
                        }
                    } else {
                        // Short position
                        if (activeStopLoss && currentPrice >= activeStopLoss) {
                            shouldClose = true;
                            closeReason = 'stopped';
                            console.log(`🛑 STOP LOSS TRIGGERED: ${updatedPos.ticket_id} | SHORT | Price: €${currentPrice.toFixed(2)} >= SL: €${activeStopLoss.toFixed(2)}`);
                        } else if (activeTakeProfit && currentPrice <= activeTakeProfit) {
                            shouldClose = true;
                            closeReason = updatedPos.tp1_hit ? 'taken (TP2)' : 'taken';
                            console.log(`🎯 TAKE PROFIT TRIGGERED: ${updatedPos.ticket_id} | SHORT | Price: €${currentPrice.toFixed(2)} <= TP: €${activeTakeProfit.toFixed(2)}`);
                        }
                    }

                    if (shouldClose) {
                        // Close remaining position automatically
                        console.log(`⚡ AUTO-CLOSING POSITION: ${updatedPos.ticket_id} | Reason: ${closeReason}`);
                        await closePosition(updatedPos.ticket_id, currentPrice, closeReason);
                    }
                }
            }

            resolve(positions.length);
        });
    });
};

// Helper to partially close a position (for partial close strategy)
const partialClosePosition = async (ticketId, volumeToClose, closePrice, reason = 'TP1') => {
    try {
        const pos = await dbGet(
            "SELECT * FROM open_positions WHERE ticket_id = ? AND status = 'open'",
            [ticketId]
        );

        if (!pos) {
            throw new Error('Position not found or already closed');
        }

        const remainingVolume = pos.volume - (pos.volume_closed || 0);
        let actualVolumeToClose = volumeToClose;
        if (actualVolumeToClose > remainingVolume) {
            actualVolumeToClose = remainingVolume; // Close all remaining if more requested
        }

        console.log(`📊 PARTIAL CLOSE: ${ticketId} | ${pos.type.toUpperCase()} | Closing ${actualVolumeToClose.toFixed(8)}/${remainingVolume.toFixed(8)} @ €${closePrice.toFixed(2)} | Reason: ${reason}`);

        // Calculate P&L for this partial close
        let partialPnl = 0;
        if (pos.type === 'buy') {
            partialPnl = (closePrice - pos.entry_price) * actualVolumeToClose;
        } else {
            partialPnl = (pos.entry_price - closePrice) * actualVolumeToClose;
        }

        console.log(`💰 PARTIAL CLOSE P&L: ${pos.type.toUpperCase()} | (${closePrice} - ${pos.entry_price}) * ${actualVolumeToClose} = €${partialPnl.toFixed(2)}`);

        // Update portfolio
        const portfolio = await getPortfolio();
        let balance = portfolio.balance_usd;
        let holdings = JSON.parse(portfolio.holdings || '{}');

        const balanceBefore = balance;

        if (pos.type === 'buy') {
            // Selling: add money, remove crypto
            balance += closePrice * actualVolumeToClose;
            holdings[pos.symbol] = (holdings[pos.symbol] || 0) - actualVolumeToClose;
            console.log(`💵 PARTIAL CLOSE (LONG): Balance ${balanceBefore.toFixed(2)} → ${balance.toFixed(2)} (+€${(closePrice * actualVolumeToClose).toFixed(2)})`);
        } else {
            // Closing short: subtract money, add crypto back
            balance -= closePrice * actualVolumeToClose;
            holdings[pos.symbol] = (holdings[pos.symbol] || 0) + actualVolumeToClose;
            console.log(`💵 PARTIAL CLOSE (SHORT): Balance ${balanceBefore.toFixed(2)} → ${balance.toFixed(2)} (-€${(closePrice * actualVolumeToClose).toFixed(2)})`);
        }

        // Update database
        await dbRun(
            "UPDATE portfolio SET balance_usd = ?, holdings = ?",
            [balance, JSON.stringify(holdings)]
        );

        // Update position (don't close it, just mark partial close)
        await dbRun(
            "UPDATE open_positions SET volume_closed = volume_closed + ?, current_price = ? WHERE ticket_id = ?",
            [actualVolumeToClose, closePrice, ticketId]
        );

        // Record partial close in trades history
        await dbRun(
            "INSERT INTO trades (symbol, type, amount, price, strategy, profit_loss) VALUES (?, ?, ?, ?, ?, ?)",
            [pos.symbol, pos.type === 'buy' ? 'sell' : 'buy', actualVolumeToClose, closePrice, `${pos.strategy || 'Bot'} - ${reason}`, partialPnl]
        );

        // Emit real-time notification
        emitCryptoEvent('crypto:position-partial-close', {
            ticket_id: ticketId,
            symbol: pos.symbol,
            volume_closed: actualVolumeToClose,
            remaining_volume: remainingVolume - actualVolumeToClose,
            close_price: closePrice,
            profit_loss: partialPnl,
            reason,
            timestamp: new Date().toISOString()
        });

        console.log(`✅ PARTIAL CLOSE COMPLETE: ${ticketId} | P&L: €${partialPnl.toFixed(2)} | Remaining: ${(remainingVolume - actualVolumeToClose).toFixed(8)}`);

        return { success: true, pnl: partialPnl, volume_closed: actualVolumeToClose };
    } catch (err) {
        console.error('Error in partialClosePosition:', err.message);
        throw err;
    }
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

        // ✅ FIX CRITICO: Calcola volume rimanente (considera partial closes)
        const remainingVolume = pos.volume - (pos.volume_closed || 0);
        
        if (remainingVolume <= 0.0001) {
            console.log(`⚠️ closePosition: Position ${ticketId} already fully closed (volume_closed: ${pos.volume_closed || 0})`);
            // Mark as closed if not already
            await dbRun(
                "UPDATE open_positions SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE ticket_id = ?",
                [ticketId]
            );
            return { success: true, pnl: 0, message: 'Position already fully closed' };
        }

        console.log(`🔒 CLOSING POSITION: ${ticketId} | Type: ${pos.type} | Entry: €${pos.entry_price} | Close: €${closePrice} | Volume: ${remainingVolume.toFixed(8)}/${pos.volume.toFixed(8)} | Reason: ${reason}`);

        // Calculate final P&L on REMAINING volume only
        let finalPnl = 0;
        if (pos.type === 'buy') {
            finalPnl = (closePrice - pos.entry_price) * remainingVolume;
        } else {
            finalPnl = (pos.entry_price - closePrice) * remainingVolume;
        }

        console.log(`💰 P&L CALCULATION: ${pos.type.toUpperCase()} | (${closePrice} - ${pos.entry_price}) * ${remainingVolume} = €${finalPnl.toFixed(2)}`);

        // Update portfolio
        const portfolio = await getPortfolio();
        let balance = portfolio.balance_usd;
        let holdings = JSON.parse(portfolio.holdings || '{}');

        const balanceBefore = balance;

        if (pos.type === 'buy') {
            // Selling: add money, remove crypto (only remaining volume)
            balance += closePrice * remainingVolume;
            holdings[pos.symbol] = (holdings[pos.symbol] || 0) - remainingVolume;
            console.log(`💵 LONG CLOSE: Balance ${balanceBefore.toFixed(2)} → ${balance.toFixed(2)} (+€${(closePrice * remainingVolume).toFixed(2)})`);
        } else {
            // Closing short: subtract money, add crypto back (only remaining volume)
            balance -= closePrice * remainingVolume;
            holdings[pos.symbol] = (holdings[pos.symbol] || 0) + remainingVolume;
            console.log(`💵 SHORT CLOSE: Balance ${balanceBefore.toFixed(2)} → ${balance.toFixed(2)} (-€${(closePrice * remainingVolume).toFixed(2)})`);
        }

        // Update database using Promise-based operations (sequentially to ensure order)
        await dbRun(
            "UPDATE portfolio SET balance_usd = ?, holdings = ?",
            [balance, JSON.stringify(holdings)]
        );

        // Map reason to valid status (database constraint only allows: 'open', 'closed', 'stopped', 'taken')
        let status = 'closed'; // Default
        if (reason === 'taken' || reason.startsWith('taken')) {
            // 'taken', 'taken (TP2)', etc. → 'taken'
            status = 'taken';
        } else if (reason === 'stopped' || reason.startsWith('stopped')) {
            // 'stopped', 'stopped (SL)', etc. → 'stopped'
            status = 'stopped';
        } else {
            // 'manual', 'TP1', 'TP2', 'SL', etc. → 'closed'
            status = 'closed';
        }

        await dbRun(
            "UPDATE open_positions SET status = ?, closed_at = CURRENT_TIMESTAMP, current_price = ?, profit_loss = ? WHERE ticket_id = ?",
            [status, closePrice, finalPnl, ticketId]
        );

        // Record in trades history (use remaining volume, not full volume)
        await dbRun(
            "INSERT INTO trades (symbol, type, amount, price, strategy, profit_loss) VALUES (?, ?, ?, ?, ?, ?)",
            [pos.symbol, pos.type === 'buy' ? 'sell' : 'buy', remainingVolume, closePrice, pos.strategy || 'Manual Close', finalPnl]
        );
        
        console.log(`✅ POSITION CLOSED: ${ticketId} | P&L: €${finalPnl.toFixed(2)} | Status: ${status} | Reason: ${reason}`);

        // Emit real-time notification
        emitCryptoEvent('crypto:position-closed', {
            ticket_id: ticketId,
            symbol: pos.symbol,
            type: pos.type,
            volume: pos.volume,
            entry_price: pos.entry_price,
            close_price: closePrice,
            profit_loss: finalPnl,
            reason,
            strategy: pos.strategy || 'Bot',
            timestamp: new Date().toISOString()
        });

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
    const { close_price, symbol } = req.body;

    try {
        // Get current price if not provided
        let finalPrice = close_price;
        if (!finalPrice) {
            try {
                // Determine symbol - default to bitcoin
                const tradingPair = (symbol === 'bitcoin' || !symbol) ? 'BTCEUR' : 'SOLEUR';
                const priceData = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=${tradingPair}`);
                finalPrice = parseFloat(priceData.price);
                
                if (!finalPrice || isNaN(finalPrice)) {
                    throw new Error('Invalid price received from Binance');
                }
            } catch (e) {
                console.error('Error fetching price for close position:', e.message);
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

// ==========================================
// BOT CONFIGURATION ENDPOINTS
// ==========================================

// POST /api/crypto/bot/toggle - Toggle bot on/off
router.post('/bot/toggle', async (req, res) => {
    try {
        const { strategy_name, is_active } = req.body;
        
        if (!strategy_name) {
            return res.status(400).json({ error: 'strategy_name is required' });
        }

        const activeValue = is_active ? 1 : 0;
        await dbRun(
            "UPDATE bot_settings SET is_active = ? WHERE strategy_name = ?",
            [activeValue, strategy_name]
        );

        res.json({
            success: true,
            strategy_name,
            is_active: activeValue === 1,
            message: `Bot ${activeValue === 1 ? 'attivato' : 'disattivato'}`
        });
    } catch (error) {
        console.error('Error toggling bot:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/crypto/bot/parameters - Get bot strategy parameters
router.get('/bot/parameters', async (req, res) => {
    try {
        const params = await getBotParameters();
        res.json({
            success: true,
            parameters: params
        });
    } catch (error) {
        console.error('Error getting bot parameters:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/crypto/bot/parameters - Update bot strategy parameters
router.put('/bot/parameters', async (req, res) => {
    try {
        const { parameters } = req.body;

        if (!parameters) {
            return res.status(400).json({ error: 'parameters object is required' });
        }

        // Validate parameters
        const validParams = {
            rsi_period: Math.max(5, Math.min(30, parseInt(parameters.rsi_period) || DEFAULT_PARAMS.rsi_period)),
            rsi_oversold: Math.max(0, Math.min(50, parseFloat(parameters.rsi_oversold) || DEFAULT_PARAMS.rsi_oversold)),
            rsi_overbought: Math.max(50, Math.min(100, parseFloat(parameters.rsi_overbought) || DEFAULT_PARAMS.rsi_overbought)),
            stop_loss_pct: Math.max(0.1, Math.min(10, parseFloat(parameters.stop_loss_pct) || DEFAULT_PARAMS.stop_loss_pct)),
            take_profit_pct: Math.max(0.1, Math.min(20, parseFloat(parameters.take_profit_pct) || DEFAULT_PARAMS.take_profit_pct)),
            trade_size_eur: Math.max(10, Math.min(1000, parseFloat(parameters.trade_size_eur) || DEFAULT_PARAMS.trade_size_eur)),
            trailing_stop_enabled: parameters.trailing_stop_enabled === true || parameters.trailing_stop_enabled === 'true' || parameters.trailing_stop_enabled === 1 || DEFAULT_PARAMS.trailing_stop_enabled,
            trailing_stop_distance_pct: Math.max(0.1, Math.min(5, parseFloat(parameters.trailing_stop_distance_pct) || DEFAULT_PARAMS.trailing_stop_distance_pct)),
            partial_close_enabled: parameters.partial_close_enabled === true || parameters.partial_close_enabled === 'true' || parameters.partial_close_enabled === 1 || DEFAULT_PARAMS.partial_close_enabled,
            take_profit_1_pct: Math.max(0.1, Math.min(5, parseFloat(parameters.take_profit_1_pct) || DEFAULT_PARAMS.take_profit_1_pct)),
            take_profit_2_pct: Math.max(0.1, Math.min(10, parseFloat(parameters.take_profit_2_pct) || DEFAULT_PARAMS.take_profit_2_pct))
        };

        // Ensure oversold < overbought
        if (validParams.rsi_oversold >= validParams.rsi_overbought) {
            return res.status(400).json({ 
                error: 'rsi_oversold must be less than rsi_overbought' 
            });
        }

        // Ensure TP1 < TP2 when partial close is enabled
        if (validParams.partial_close_enabled && validParams.take_profit_1_pct >= validParams.take_profit_2_pct) {
            return res.status(400).json({ 
                error: 'take_profit_1_pct must be less than take_profit_2_pct when partial close is enabled' 
            });
        }

        // Update database
        await dbRun(
            "UPDATE bot_settings SET parameters = ? WHERE strategy_name = 'RSI_Strategy'",
            [JSON.stringify(validParams)]
        );

        res.json({
            success: true,
            parameters: validParams,
            message: 'Parametri aggiornati con successo'
        });
    } catch (error) {
        console.error('Error updating bot parameters:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// ADVANCED STATISTICS ENDPOINT
// ==========================================

// GET /api/crypto/statistics - Get advanced trading statistics
router.get('/statistics', async (req, res) => {
    try {
        const portfolio = await getPortfolio();
        const allTrades = await dbAll("SELECT * FROM trades ORDER BY timestamp ASC");
        const closedPositions = await dbAll("SELECT * FROM open_positions WHERE status != 'open' ORDER BY closed_at ASC");
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC");
        
        // Initial portfolio value (assumed starting balance)
        const initialBalance = 262.5; // Default starting balance in EUR
        
        // Calculate current total balance
        let currentPrice = 0;
        try {
            const priceData = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=BTCEUR`);
            if (priceData && priceData.price) {
                currentPrice = parseFloat(priceData.price);
            }
        } catch (e) {
            console.warn('Could not fetch current price for statistics:', e.message);
        }
        
        const holdings = JSON.parse(portfolio.holdings || '{}');
        const bitcoinHoldings = holdings['bitcoin'] || 0;
        const currentBalance = portfolio.balance_usd;
        const cryptoValue = bitcoinHoldings * currentPrice;
        const totalBalance = currentBalance + cryptoValue;
        
        // 1. Total P&L - Include both closed and open positions
        let totalPnL = 0;
        let totalProfit = 0;
        let totalLoss = 0;
        let winningTrades = 0;
        let losingTrades = 0;
        let totalVolume = 0;
        
        // Calculate from closed positions (realized P&L)
        closedPositions.forEach(pos => {
            const pnl = pos.profit_loss || 0;
            totalPnL += pnl;
            if (pnl > 0) {
                totalProfit += pnl;
                winningTrades++;
            } else if (pnl < 0) {
                totalLoss += Math.abs(pnl);
                losingTrades++;
            }
            totalVolume += (pos.volume || 0) * (pos.entry_price || 0);
        });
        
        // Calculate unrealized P&L from open positions
        openPositions.forEach(pos => {
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const volume = parseFloat(pos.volume) || 0;
            const unrealizedPnL = (currentPrice - entryPrice) * volume * (pos.type === 'buy' ? 1 : -1);
            totalPnL += unrealizedPnL;
            if (unrealizedPnL > 0) {
                totalProfit += unrealizedPnL;
            } else if (unrealizedPnL < 0) {
                totalLoss += Math.abs(unrealizedPnL);
            }
            totalVolume += volume * entryPrice;
        });
        
        // Also include trades with profit_loss (from manual trades) - but avoid double counting
        const processedTicketIds = new Set();
        closedPositions.forEach(pos => {
            if (pos.ticket_id) processedTicketIds.add(pos.ticket_id);
        });
        openPositions.forEach(pos => {
            if (pos.ticket_id) processedTicketIds.add(pos.ticket_id);
        });
        
        allTrades.forEach(trade => {
            // Only count trades that are not part of a position (manual trades)
            if (trade.profit_loss !== null && trade.profit_loss !== undefined && !processedTicketIds.has(trade.ticket_id)) {
                const pnl = parseFloat(trade.profit_loss) || 0;
                if (Math.abs(pnl) > 0.01) {
                    totalPnL += pnl;
                    if (pnl > 0) {
                        totalProfit += pnl;
                        winningTrades++;
                    } else if (pnl < 0) {
                        totalLoss += Math.abs(pnl);
                        losingTrades++;
                    }
                }
            }
            // Count volume for all BUY trades
            if (trade.type === 'buy') {
                totalVolume += (trade.amount || 0) * (trade.price || 0);
            }
        });
        
        // Total trades = posizioni chiuse (con P&L realizzato) per win rate
        const closedTradesForWinRate = winningTrades + losingTrades;
        const winRate = closedTradesForWinRate > 0 ? (winningTrades / closedTradesForWinRate) * 100 : 0;
        
        // Total trades = tutti i trades (per display)
        const totalTrades = allTrades.length;
        const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? Infinity : 0);
        
        // ROI calculation
        const roi = initialBalance > 0 ? ((totalBalance - initialBalance) / initialBalance) * 100 : 0;
        
        // P&L Percent
        const pnlPercent = initialBalance > 0 ? ((totalBalance - initialBalance) / initialBalance) * 100 : 0;
        
        // Trade statistics by period - Count ALL trades by timestamp (non solo quelli chiusi)
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        
        let tradesToday = 0;
        let tradesThisWeek = 0;
        let tradesThisMonth = 0;
        
        // Count ALL trades by timestamp (per il conteggio operazioni)
        allTrades.forEach(trade => {
            if (trade.timestamp) {
                const tradeDate = new Date(trade.timestamp);
                if (tradeDate >= today) tradesToday++;
                if (tradeDate >= weekAgo) tradesThisWeek++;
                if (tradeDate >= monthAgo) tradesThisMonth++;
            }
        });
        
        // Average profit per winning trade
        const avgWin = winningTrades > 0 ? totalProfit / winningTrades : 0;
        const avgLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;
        
        res.json({
            success: true,
            statistics: {
                // Portfolio
                initial_balance: initialBalance,
                current_balance: totalBalance,
                pnl_total: totalPnL,
                pnl_percent: pnlPercent,
                roi: roi,
                
                // Trade Performance
                total_trades: totalTrades,
                winning_trades: winningTrades,
                losing_trades: losingTrades,
                win_rate: winRate,
                profit_factor: profitFactor === Infinity ? null : profitFactor,
                
                // Profit/Loss Breakdown
                total_profit: totalProfit,
                total_loss: totalLoss,
                avg_win: avgWin,
                avg_loss: avgLoss,
                
                // Volume
                total_volume_eur: totalVolume,
                
                // Period Stats
                trades_today: tradesToday,
                trades_this_week: tradesThisWeek,
                trades_this_month: tradesThisMonth,
                
                // Current Holdings
                bitcoin_holdings: bitcoinHoldings,
                current_bitcoin_price: currentPrice,
                crypto_value: cryptoValue,
                cash_balance: currentBalance
            }
        });
    } catch (error) {
        console.error('Error calculating statistics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export router and setSocketIO function
// ==========================================
// WEBSOCKET ROOM MANAGEMENT
// ==========================================

// POST /api/crypto/websocket/join - Join crypto dashboard room (called from frontend)
router.post('/websocket/join', (req, res) => {
    // This endpoint is just for documentation/logging
    // Actual room join happens via Socket.io client connection
    res.json({ 
        success: true, 
        message: 'Join crypto:dashboard room via Socket.io client',
        room: 'crypto:dashboard'
    });
});

// ==========================================
// BACKTESTING SYSTEM
// ==========================================

// Backtesting simulation function
const runBacktest = async (params, startDate, endDate, initialBalance = 10000) => {
    try {
        // Load historical prices from database or Binance
        let historicalPrices = [];
        
        // Try to load from database first
        const dbPrices = await dbAll(
            "SELECT price, timestamp FROM price_history WHERE symbol = 'bitcoin' AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC",
            [startDate, endDate]
        );

        if (dbPrices && dbPrices.length > 0) {
            historicalPrices = dbPrices.map(p => ({
                price: parseFloat(p.price),
                timestamp: new Date(p.timestamp)
            }));
            console.log(`📊 Backtest: Loaded ${historicalPrices.length} prices from database`);
        } else {
            // Load from Binance if DB doesn't have enough data
            console.log('📊 Backtest: Loading historical data from Binance...');
            const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=BTCEUR&interval=15m&startTime=${new Date(startDate).getTime()}&endTime=${new Date(endDate).getTime()}&limit=1000`;
            
            try {
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

                historicalPrices = binanceData.map(kline => ({
                    price: parseFloat(kline[4]), // Close price
                    timestamp: new Date(kline[0])
                }));
                console.log(`📊 Backtest: Loaded ${historicalPrices.length} prices from Binance`);
            } catch (err) {
                console.error('❌ Error loading from Binance:', err.message);
                throw new Error('Could not load historical data for backtesting');
            }
        }

        if (historicalPrices.length < params.rsi_period + 10) {
            throw new Error(`Insufficient historical data. Need at least ${params.rsi_period + 10} data points, got ${historicalPrices.length}`);
        }

        // Initialize simulation state
        let balance = initialBalance;
        let holdings = 0; // BTC holdings
        let trades = [];
        let openPositions = [];
        let priceHistoryWindow = [];
        let lastBuyPrice = 0;
        let peakBalance = initialBalance;
        let maxDrawdown = 0;
        let equityCurve = [];

        const RSI_PERIOD = params.rsi_period || 14;
        const RSI_OVERSOLD = params.rsi_oversold || 30;
        const RSI_OVERBOUGHT = params.rsi_overbought || 70;
        const STOP_LOSS_PCT = (params.stop_loss_pct || 2.0) / 100;
        const TAKE_PROFIT_PCT = (params.take_profit_pct || 3.0) / 100;
        const TRADE_SIZE_EUR = params.trade_size_eur || 50;

        // Simulate each price point
        for (let i = 0; i < historicalPrices.length; i++) {
            const { price, timestamp } = historicalPrices[i];
            priceHistoryWindow.push(price);
            
            // Keep only last 50 prices for RSI calculation
            if (priceHistoryWindow.length > 50) {
                priceHistoryWindow.shift();
            }

            // Calculate RSI
            const rsi = calculateRSI(priceHistoryWindow, RSI_PERIOD);
            if (!rsi) continue; // Not enough data yet

            const currentBalance = balance + (holdings * price);
            equityCurve.push({
                timestamp,
                balance: currentBalance,
                price,
                rsi
            });

            // Update peak and drawdown
            if (currentBalance > peakBalance) {
                peakBalance = currentBalance;
            }
            const drawdown = (peakBalance - currentBalance) / peakBalance;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }

            // Check open positions for stop loss / take profit
            const positionsToClose = [];
            openPositions.forEach((pos, idx) => {
                if (pos.type === 'buy') {
                    const pnlPct = (price - pos.entryPrice) / pos.entryPrice;
                    if (price <= pos.stopLoss) {
                        positionsToClose.push({ idx, reason: 'stop_loss', price });
                    } else if (price >= pos.takeProfit) {
                        positionsToClose.push({ idx, reason: 'take_profit', price });
                    }
                }
            });

            // Close positions that hit SL/TP
            positionsToClose.reverse().forEach(({ idx, reason, price: closePrice }) => {
                const pos = openPositions[idx];
                const pnl = (closePrice - pos.entryPrice) * pos.volume;
                balance += closePrice * pos.volume;
                holdings -= pos.volume;
                
                trades.push({
                    type: 'sell',
                    price: closePrice,
                    volume: pos.volume,
                    timestamp,
                    strategy: reason === 'stop_loss' ? 'Stop Loss' : 'Take Profit',
                    profit_loss: pnl
                });

                openPositions.splice(idx, 1);
                if (holdings > 0.001) {
                    // Recalculate average buy price
                    const remainingTrades = trades.filter(t => t.type === 'buy' && t.timestamp <= timestamp).slice(-10);
                    let totalCost = 0;
                    let totalQty = 0;
                    let remaining = holdings;
                    for (let t of remainingTrades.reverse()) {
                        const qty = Math.min(t.volume, remaining);
                        totalCost += qty * t.price;
                        totalQty += qty;
                        remaining -= qty;
                        if (remaining <= 0.0001) break;
                    }
                    if (totalQty > 0) {
                        lastBuyPrice = totalCost / totalQty;
                    }
                } else {
                    lastBuyPrice = 0;
                }
            });

            // Trading logic (same as bot)
            if (rsi < RSI_OVERSOLD && balance >= TRADE_SIZE_EUR && holdings < 0.001) {
                // Buy signal
                const amountToBuy = TRADE_SIZE_EUR / price;
                balance -= TRADE_SIZE_EUR;
                holdings += amountToBuy;
                lastBuyPrice = price;

                const stopLoss = price * (1 - STOP_LOSS_PCT);
                const takeProfit = price * (1 + TAKE_PROFIT_PCT);

                openPositions.push({
                    type: 'buy',
                    entryPrice: price,
                    volume: amountToBuy,
                    stopLoss,
                    takeProfit,
                    timestamp
                });

                trades.push({
                    type: 'buy',
                    price,
                    volume: amountToBuy,
                    timestamp,
                    strategy: `RSI Oversold (${rsi.toFixed(2)})`,
                    profit_loss: null
                });
            } else if (holdings > 0.01 && rsi > RSI_OVERBOUGHT) {
                // Sell signal (close all positions)
                const pnl = (price - lastBuyPrice) * holdings;
                balance += price * holdings;
                
                trades.push({
                    type: 'sell',
                    price,
                    volume: holdings,
                    timestamp,
                    strategy: `RSI Overbought (${rsi.toFixed(2)})`,
                    profit_loss: pnl
                });

                holdings = 0;
                openPositions = [];
                lastBuyPrice = 0;
            } else if (holdings > 0.01 && lastBuyPrice > 0) {
                const pnlPercent = (price - lastBuyPrice) / lastBuyPrice;
                
                if (pnlPercent >= TAKE_PROFIT_PCT) {
                    const pnl = (price - lastBuyPrice) * holdings;
                    balance += price * holdings;
                    
                    trades.push({
                        type: 'sell',
                        price,
                        volume: holdings,
                        timestamp,
                        strategy: `Take Profit (+${(pnlPercent * 100).toFixed(2)}%)`,
                        profit_loss: pnl
                    });

                    holdings = 0;
                    openPositions = [];
                    lastBuyPrice = 0;
                } else if (pnlPercent <= -STOP_LOSS_PCT) {
                    const pnl = (price - lastBuyPrice) * holdings;
                    balance += price * holdings;
                    
                    trades.push({
                        type: 'sell',
                        price,
                        volume: holdings,
                        timestamp,
                        strategy: `Stop Loss (${(pnlPercent * 100).toFixed(2)}%)`,
                        profit_loss: pnl
                    });

                    holdings = 0;
                    openPositions = [];
                    lastBuyPrice = 0;
                }
            }
        }

        // Close any remaining open positions at final price
        const finalPrice = historicalPrices[historicalPrices.length - 1].price;
        if (holdings > 0.001) {
            const pnl = (finalPrice - lastBuyPrice) * holdings;
            balance += finalPrice * holdings;
            trades.push({
                type: 'sell',
                price: finalPrice,
                volume: holdings,
                timestamp: historicalPrices[historicalPrices.length - 1].timestamp,
                strategy: 'End of backtest',
                profit_loss: pnl
            });
        }

        // Calculate statistics
        const finalBalance = balance;
        const totalPnl = finalBalance - initialBalance;
        const totalPnlPct = (totalPnl / initialBalance) * 100;
        
        const completedTrades = trades.filter(t => t.profit_loss !== null);
        const winningTrades = completedTrades.filter(t => t.profit_loss > 0);
        const losingTrades = completedTrades.filter(t => t.profit_loss < 0);
        
        const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;
        
        const totalWinning = winningTrades.reduce((sum, t) => sum + t.profit_loss, 0);
        const totalLosing = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit_loss, 0));
        const profitFactor = totalLosing > 0 ? totalWinning / totalLosing : (totalWinning > 0 ? Infinity : 0);

        // Calculate Sharpe Ratio (simplified)
        let sharpeRatio = 0;
        if (equityCurve.length > 1) {
            const returns = [];
            for (let i = 1; i < equityCurve.length; i++) {
                const ret = (equityCurve[i].balance - equityCurve[i-1].balance) / equityCurve[i-1].balance;
                returns.push(ret);
            }
            const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
            const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
            const stdDev = Math.sqrt(variance);
            sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
        }

        return {
            initialBalance,
            finalBalance,
            totalTrades: completedTrades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            totalPnl,
            totalPnlPct,
            winRate,
            profitFactor,
            maxDrawdown,
            maxDrawdownPct: maxDrawdown * 100,
            sharpeRatio,
            trades,
            equityCurve
        };
    } catch (err) {
        console.error('❌ Backtest error:', err);
        throw err;
    }
};

// POST /api/crypto/backtest/run - Run a backtest
router.post('/backtest/run', async (req, res) => {
    try {
        const { params, startDate, endDate, initialBalance, testName } = req.body;

        if (!params || !startDate || !endDate) {
            return res.status(400).json({ error: 'Missing required fields: params, startDate, endDate' });
        }

        // Validate date range
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start >= end) {
            return res.status(400).json({ error: 'startDate must be before endDate' });
        }

        // Limit date range to prevent excessive computation
        const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
        if (daysDiff > 365) {
            return res.status(400).json({ error: 'Date range cannot exceed 365 days' });
        }

        console.log(`🔄 Starting backtest: ${testName || 'Unnamed'} from ${startDate} to ${endDate}`);

        const result = await runBacktest(
            params,
            startDate,
            endDate,
            initialBalance || 10000
        );

        // Save results to database
        const resultsData = JSON.stringify({
            trades: result.trades,
            equityCurve: result.equityCurve
        });

        await dbRun(
            `INSERT INTO backtest_results 
            (test_name, strategy_params, start_date, end_date, initial_balance, final_balance,
             total_trades, winning_trades, losing_trades, total_pnl, total_pnl_pct,
             win_rate, profit_factor, max_drawdown, max_drawdown_pct, sharpe_ratio, results_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                testName || 'Backtest',
                JSON.stringify(params),
                startDate,
                endDate,
                result.initialBalance,
                result.finalBalance,
                result.totalTrades,
                result.winningTrades,
                result.losingTrades,
                result.totalPnl,
                result.totalPnlPct,
                result.winRate,
                result.profitFactor,
                result.maxDrawdown,
                result.maxDrawdownPct,
                result.sharpeRatio,
                resultsData
            ]
        );

        // Return summary (without full trades/equity curve for performance)
        res.json({
            success: true,
            results: {
                initialBalance: result.initialBalance,
                finalBalance: result.finalBalance,
                totalTrades: result.totalTrades,
                winningTrades: result.winningTrades,
                losingTrades: result.losingTrades,
                totalPnl: result.totalPnl,
                totalPnlPct: result.totalPnlPct,
                winRate: result.winRate,
                profitFactor: result.profitFactor,
                maxDrawdown: result.maxDrawdown,
                maxDrawdownPct: result.maxDrawdownPct,
                sharpeRatio: result.sharpeRatio
            },
            message: 'Backtest completed successfully'
        });
    } catch (error) {
        console.error('❌ Backtest run error:', error);
        res.status(500).json({ error: error.message || 'Error running backtest' });
    }
});

// GET /api/crypto/backtest/results - Get all backtest results
router.get('/backtest/results', async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const results = await dbAll(
            `SELECT id, test_name, start_date, end_date, initial_balance, final_balance,
             total_trades, winning_trades, losing_trades, total_pnl, total_pnl_pct,
             win_rate, profit_factor, max_drawdown_pct, sharpe_ratio, created_at
             FROM backtest_results 
             ORDER BY created_at DESC 
             LIMIT ?`,
            [parseInt(limit)]
        );

        res.json({ success: true, results });
    } catch (error) {
        console.error('❌ Error fetching backtest results:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/crypto/backtest/results/:id - Get detailed backtest result
router.get('/backtest/results/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await dbGet(
            `SELECT * FROM backtest_results WHERE id = ?`,
            [id]
        );

        if (!result) {
            return res.status(404).json({ error: 'Backtest result not found' });
        }

        const resultsData = result.results_data ? JSON.parse(result.results_data) : null;

        res.json({
            success: true,
            result: {
                ...result,
                strategy_params: result.strategy_params ? JSON.parse(result.strategy_params) : null,
                results_data: resultsData
            }
        });
    } catch (error) {
        console.error('❌ Error fetching backtest detail:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/crypto/backtest/results/:id - Delete a backtest result
router.delete('/backtest/results/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await dbRun('DELETE FROM backtest_results WHERE id = ?', [id]);
        res.json({ success: true, message: 'Backtest result deleted' });
    } catch (error) {
        console.error('❌ Error deleting backtest result:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
module.exports.setSocketIO = setSocketIO;