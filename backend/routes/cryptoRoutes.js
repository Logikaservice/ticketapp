/* C:\TicketApp\backend\routes\cryptoRoutes.js - FIXED VERSION */

const express = require('express');
const router = express.Router();
const db = require('../crypto_db');
const https = require('https');

// Import new services
const riskManager = require('../services/RiskManager');
const signalGenerator = require('../services/BidirectionalSignalGenerator');
const { sendCryptoEmail } = require('../services/CryptoEmailNotifications');

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
            // Check if response is JSON
            const contentType = res.headers['content-type'] || '';
            if (!contentType.includes('application/json') && !contentType.includes('text/json')) {
                // If not JSON, check if it's HTML (error page)
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
                        reject(new Error(`Received HTML instead of JSON. Status: ${res.statusCode}. Response starts with: ${data.substring(0, 100)}`));
                    } else {
                        reject(new Error(`Unexpected content-type: ${contentType}. Status: ${res.statusCode}`));
                    }
                });
                return;
            }

            // Handle non-200 status codes
            if (res.statusCode !== 200) {
                let errorData = '';
                res.on('data', (chunk) => errorData += chunk);
                res.on('end', () => {
                    reject(new Error(`HTTP ${res.statusCode}: ${errorData.substring(0, 200)}`));
                });
                return;
            }

            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}. Response: ${data.substring(0, 200)}`));
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
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
    // ✅ FIX: Aggiungi timeout totale di 30 secondi per l'intera richiesta
    const requestTimeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({ error: 'Request timeout: Historical data loading took too long' });
        }
    }, 30000); // 30 secondi

    try {
        // Get interval and symbol from query parameters
        const interval = req.query.interval || '15m'; // Support: 1m, 15m, 1h, 1d, etc.
        const symbol = req.query.symbol || 'bitcoin'; // Default to bitcoin for backward compatibility

        // Check if we have OHLC klines data first (preferred)
        const klinesCountRows = await dbAll(`SELECT COUNT(*) as count FROM klines WHERE symbol = ? AND interval = ?`, [symbol, interval]);
        const klinesCount = klinesCountRows && klinesCountRows.length > 0 ? klinesCountRows[0].count : 0;

        // Also check price_history for backward compatibility
        const countRows = await dbAll("SELECT COUNT(*) as count FROM price_history WHERE symbol = ?", [symbol]);
        const count = countRows && countRows.length > 0 ? countRows[0].count : 0;

        console.log(`📊 Klines count: ${klinesCount}, Price history count: ${count}`);

        // Determine limit based on interval - Aumentato per avere più dati storici
        let limit = 1000; // Aumentato da 500 a 1000 per avere più dati
        if (interval === '1m') {
            limit = 1440; // 1 day of 1-minute candles
        } else if (interval === '1d') {
            limit = 365; // 1 year of daily candles
        } else if (interval === '1h') {
            limit = 720; // 30 days of hourly candles
        } else if (interval === '15m') {
            limit = 2000; // ~20 giorni di candele 15m (circa 2000 candele)
        } else if (interval === '5m') {
            limit = 2000; // ~7 giorni di candele 5m
        } else if (interval === '30m') {
            limit = 1000; // ~20 giorni di candele 30m
        }

        // If we have less than required klines, try to load from Binance
        // ✅ FIX: Carica sempre almeno 24 ore di candele per copertura completa
        const minRequired = interval === '1m' ? 1000 : 200;
        const shouldLoadFromBinance = klinesCount < minRequired;

        // ✅ FIX: Calcola sempre almeno 7 giorni di candele per avere dati sufficienti per il grafico
        const candlesNeededFor7Days = interval === '15m' ? 672 : // 7 days (4 candles/hour * 24 * 7)
            interval === '1m' ? 10080 : // 7 days (60 candles/hour * 24 * 7)
                interval === '5m' ? 2016 : // 7 days (12 candles/hour * 24 * 7)
                    interval === '30m' ? 336 : // 7 days (2 candles/hour * 24 * 7)
                        interval === '1h' ? 168 : // 7 days
                            interval === '4h' ? 42 : // 7 days
                                interval === '1d' ? 30 : // 30 days
                                    672; // Default: 7 days

        // ✅ FIX: Usa sempre almeno 7 giorni, o il limite richiesto se maggiore
        const binanceLimit = Math.max(limit, candlesNeededFor7Days);

        // Carica sempre da Binance se abbiamo meno del minimo richiesto o se è un simbolo nuovo
        if (shouldLoadFromBinance || klinesCount < candlesNeededFor7Days) {
            console.log(`📥 Loading ${binanceLimit} klines from Binance for interval ${interval} (current count: ${klinesCount})...`);

            try {
                // Load klines from Binance with specified interval
                const https = require('https');
                const tradingPair = SYMBOL_TO_PAIR[symbol] || 'BTCEUR';
				const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${tradingPair}&interval=${interval}&limit=${binanceLimit}`;
                // ✅ FIX: Aggiungi timeout di 10 secondi per evitare 504 Gateway Timeout
                const TIMEOUT_MS = 10000; // 10 secondi

                const binanceData = await new Promise((resolve, reject) => {
                    const request = https.get(binanceUrl, (res) => {
                        // Verifica status code
                        if (res.statusCode !== 200) {
                            reject(new Error(`Binance API returned status ${res.statusCode}`));
                            return;
                        }

                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            try {
                                const parsed = JSON.parse(data);
                                // Verifica se Binance ha restituito un errore
                                if (parsed.code && parsed.msg) {
                                    reject(new Error(`Binance API error: ${parsed.msg}`));
                                    return;
                                }
                                resolve(parsed);
                            } catch (e) {
                                reject(new Error(`Failed to parse Binance response: ${e.message}`));
                            }
                        });
                    });

                    // ✅ FIX: Timeout per evitare richieste che si bloccano
                    request.setTimeout(TIMEOUT_MS, () => {
                        request.destroy();
                        reject(new Error(`Binance API request timeout after ${TIMEOUT_MS}ms`));
                    });

                    request.on('error', (err) => {
                        reject(new Error(`Binance API request failed: ${err.message}`));
                    });
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
                            [symbol, close, timestamp]
                        );
                        saved++;

                        // Save complete OHLC kline
                        await dbRun(
                            `INSERT OR IGNORE INTO klines 
                            (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [symbol, interval, openTime, open, high, low, close, volume, closeTime]
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
        // Calcola il timestamp minimo per le ultime N candele (aumentato per avere più dati)
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
        // Aumenta il periodo per avere più dati: 7 giorni invece di solo 24 ore
        const daysToLoad = interval === '1d' ? 30 : interval === '1h' ? 7 : interval === '15m' ? 7 : 7;
        const candlesForPeriod = interval === '15m' ? daysToLoad * 24 * 4 : // 4 candele/ora per 15m
            interval === '5m' ? daysToLoad * 24 * 12 : // 12 candele/ora per 5m
                interval === '30m' ? daysToLoad * 24 * 2 : // 2 candele/ora per 30m
                    interval === '1h' ? daysToLoad * 24 : // 24 candele/giorno per 1h
                        interval === '4h' ? daysToLoad * 6 : // 6 candele/giorno per 4h
                            interval === '1d' ? daysToLoad : // 1 candela/giorno
                                limit;
        const minTime = now - (candlesForPeriod * intervalDuration); // Timestamp minimo per le ultime N candele

        const klinesRows = await dbAll(
            `SELECT open_time, open_price, high_price, low_price, close_price, volume 
             FROM klines 
             WHERE symbol = ? AND interval = ? AND open_time >= ? 
             ORDER BY open_time ASC 
             LIMIT ?`,
            [symbol, interval, minTime, Math.max(limit, candlesForPeriod)]
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
                clearTimeout(requestTimeout);
                res.json(filledCandles);
            } else {
                const firstTime = candles[0] ? new Date(candles[0].time * 1000).toISOString() : 'N/A';
                const lastTime = candles[candles.length - 1] ? new Date(candles[candles.length - 1].time * 1000).toISOString() : 'N/A';
                console.log(`📊 Returning ${candles.length} OHLC candlesticks from klines table (interval: ${interval})`);
                console.log(`📊 Time range: ${firstTime} to ${lastTime}`);
                clearTimeout(requestTimeout);
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
            clearTimeout(requestTimeout);
            res.json(history);
        }
    } catch (error) {
        clearTimeout(requestTimeout);
        console.error('❌ Error fetching price history:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message || 'Internal server error' });
        }
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
        db.run(query, params, function (err) {
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
        const [trades, bots, openPositions, closedPositions] = await Promise.all([
            dbAll("SELECT * FROM trades ORDER BY timestamp DESC LIMIT 50"), // Increased limit for calculation
            dbAll("SELECT * FROM bot_settings"),
            dbAll("SELECT * FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC"),
            dbAll("SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken') ORDER BY closed_at DESC LIMIT 100") // ✅ FIX: Recupera anche posizioni chiuse per signal_details
        ]);

        // ✅ FIX: Log per debug
        console.log(`📊 Dashboard: ${openPositions?.length || 0} open positions, ${closedPositions?.length || 0} closed positions, ${trades?.length || 0} trades`);

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

        // ✅ FIX: Aggiungi signal_details e profit_loss ai trades dalla posizione corrispondente (aperta o chiusa)
        const allPositions = [...openPositions, ...closedPositions];
        const tradesWithDetails = trades.map(trade => {
            if (trade.ticket_id) {
                const position = allPositions.find(pos => pos.ticket_id === trade.ticket_id);
                if (position) {
                    // Aggiungi signal_details se presente
                    if (position.signal_details) {
                        trade = { ...trade, signal_details: position.signal_details };
                    }
                    // ✅ FIX CRITICO: Se il trade non ha profit_loss ma la posizione sì, aggiungilo
                    if ((trade.profit_loss === null || trade.profit_loss === undefined) && position.profit_loss !== null) {
                        trade = { ...trade, profit_loss: position.profit_loss };
                    }
                }
            }
            return trade;
        });

        res.json({
            portfolio: {
                balance_usd: portfolio.balance_usd,
                holdings: JSON.parse(portfolio.holdings || '{}'),
                avg_buy_price: avgBuyPrice // Send calculated avg price
            },
            recent_trades: tradesWithDetails.slice(0, 10), // Send only 10 to frontend list
            all_trades: tradesWithDetails, // Send more history for chart plotting
            active_bots: bots,
            open_positions: openPositions, // Include open positions
            closed_positions: closedPositions, // ✅ FIX: Include closed positions per P&L
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

// POST /api/crypto/add-funds (Add Funds to Portfolio - Simulation)
router.post('/add-funds', async (req, res) => {
    try {
        const { amount } = req.body;

        // Validate amount
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({ error: 'Importo non valido. Deve essere maggiore di 0.' });
        }

        const fundsToAdd = parseFloat(amount);

        // Get current portfolio
        const portfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");
        if (!portfolio) {
            return res.status(404).json({ error: 'Portfolio non trovato' });
        }

        const currentBalance = parseFloat(portfolio.balance_usd) || 0;
        const newBalance = currentBalance + fundsToAdd;

        // Update portfolio balance
        await dbRun("UPDATE portfolio SET balance_usd = ? WHERE id = 1", [newBalance]);

        console.log(`💰 Fondi aggiunti: €${fundsToAdd.toFixed(2)} | Saldo precedente: €${currentBalance.toFixed(2)} | Nuovo saldo: €${newBalance.toFixed(2)}`);

        res.json({
            success: true,
            message: `Fondi aggiunti con successo!`,
            added_amount: fundsToAdd,
            previous_balance: currentBalance,
            new_balance: newBalance
        });
    } catch (err) {
        console.error('Error adding funds:', err);
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

// Helper to get bot strategy parameters from database (supports multi-symbol)
const getBotParameters = async (symbol = 'bitcoin') => {
    try {
        const bot = await dbGet("SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = ?", [symbol]);
        if (bot && bot.parameters) {
            const params = JSON.parse(bot.parameters);
            // Merge with defaults to ensure all parameters exist
            return { ...DEFAULT_PARAMS, ...params };
        }
    } catch (err) {
        console.error(`Error loading bot parameters for ${symbol}:`, err.message);
    }
    // Return defaults if error or not found
    return DEFAULT_PARAMS;
};

// Symbol to Trading Pair mapping
const SYMBOL_TO_PAIR = {
    'bitcoin': 'BTCEUR',
    'bitcoin_usdt': 'BTCUSDT',
    'solana': 'SOLUSDT',
    'solana_eur': 'SOLEUR',
    'ethereum': 'ETHEUR',
    'ethereum_usdt': 'ETHUSDT',
    'cardano': 'ADAEUR',
    'cardano_usdt': 'ADAUSDT',
    'polkadot': 'DOTEUR',
    'polkadot_usdt': 'DOTUSDT',
    'chainlink': 'LINKEUR',
    'chainlink_usdt': 'LINKUSDT',
    'litecoin': 'LTCEUR',
    'litecoin_usdt': 'LTCUSDT',
    'ripple': 'XRPUSDT',
    'ripple_eur': 'XRPEUR',
    'binance_coin': 'BNBUSDT',
    'binance_coin_eur': 'BNBEUR',
    'pol_polygon': 'POLUSDT', // Replaces MATIC
    'pol_polygon_eur': 'POLEUR', // Replaces MATIC
    'avalanche': 'AVAXUSDT',
    'avalanche_eur': 'AVAXEUR',
    'uniswap': 'UNIUSDT',
    'uniswap_eur': 'UNIEUR',
    'dogecoin': 'DOGEUSDT',
    'dogecoin_eur': 'DOGEEUR',
    'shiba': 'SHIBUSDT',
    'shiba_eur': 'SHIBEUR',
    // Layer 1 Alternatives
    'near': 'NEARUSDT',
    'near_eur': 'NEAREUR',
    'atom': 'ATOMUSDT',
    'atom_eur': 'ATOMEUR',
    // DeFi Blue Chips
    'aave': 'AAVEUSDT',
    // ❌ 'aave_eur': 'AAVEEUR', // Non disponibile su Binance
    // Gaming/Metaverse
    'sand': 'SANDUSDT',
    // ❌ 'sand_eur': 'SANDEUR', // Non disponibile su Binance
    // Storage
    'fil': 'FILUSDT',
    // ❌ 'fil_eur': 'FILEUR', // Non disponibile su Binance
    // Layer 1 / Payments
    'trx': 'TRXUSDT',
    'trx_eur': 'TRXEUR',
    'xlm': 'XLMUSDT',
    'xlm_eur': 'XLMEUR',
    // ❌ 'eos': 'EOSUSDT', // Delisted from Binance
    // ❌ 'eos_eur': 'EOSEUR', // Not available on Binance
    // Layer 2 / Scaling
    'arb': 'ARBUSDT',
    'arb_eur': 'ARBEUR',
    'op': 'OPUSDT',
    'op_eur': 'OPEUR',
    'matic': 'MATICUSDT',
    'matic_eur': 'MATICEUR',
    // DeFi Blue Chips (solo USDT disponibile)
    'crv': 'CRVUSDT',
    // ❌ 'crv_eur': 'CRVEUR', // Non disponibile su Binance
    'ldo': 'LDOUSDT',
    // ❌ 'ldo_eur': 'LDOEUR', // Non disponibile su Binance
    // Gaming/Metaverse (solo USDT disponibile)
    'mana': 'MANAUSDT',
    // ❌ 'mana_eur': 'MANAEUR', // Non disponibile su Binance
    'axs': 'AXSUSDT',
    // ❌ 'axs_eur': 'AXSEUR', // Non disponibile su Binance

    // ✅ NEW ADDITIONS - Verified on Binance (Dec 2025)
    // Stablecoins
    'usdc': 'USDCUSDT', // Volume: €1343M/day

    // Layer 1 Emergenti (High Volume)
    'sui': 'SUIUSDT', // Volume: €81M/day
    'sui_eur': 'SUIEUR',
    'apt': 'APTUSDT', // Aptos - Volume: €18.88M/day
    'sei': 'SEIUSDT', // Volume: €8.92M/day
    'ton': 'TONUSDT', // Telegram Open Network - Volume: €7.60M/day
    'inj': 'INJUSDT', // Injective - Volume: €4.20M/day
    'algo': 'ALGOUSDT', // Algorand - Volume: €3.38M/day
    'vet': 'VETUSDT', // VeChain - Volume: €3.13M/day
    'icp': 'ICPUSDT', // Internet Computer - Volume: €14.43M/day

    // DeFi Blue Chips
    'mkr': 'MKRUSDT', // Maker - Volume: €0.44M/day
    'comp': 'COMPUSDT', // Compound - Volume: €3.94M/day
    'snx': 'SNXUSDT', // Synthetix - Volume: €2.58M/day

    // AI/Data Sector
    'fet': 'FETUSDT', // Fetch.ai - Volume: €13.15M/day
    'render': 'RENDERUSDT', // Render Network - Volume: €3.73M/day
    'grt': 'GRTUSDT', // The Graph - Volume: €2.44M/day

    // Gaming/Metaverse
    'imx': 'IMXUSDT', // Immutable X - Volume: €1.38M/day
    'gala': 'GALAUSDT', // Gala Games - Volume: €3.46M/day
    'enj': 'ENJUSDT', // Enjin Coin - Volume: €0.45M/day
    'enj_eur': 'ENJEUR',

    // Meme Coins (High Volume)
    'pepe': 'PEPEUSDT', // Volume: €32.29M/day
    'pepe_eur': 'PEPEEUR',
    'floki': 'FLOKIUSDT', // Volume: €5.71M/day
    'bonk': 'BONKUSDT', // Volume: €8.79M/day

    // Storage/Infrastructure
    'ar': 'ARUSDT' // Arweave - Volume: €3.52M/day
};

// ✅ CORRELATION GROUPS - Strategia Ibrida per Diversificazione Intelligente
// Raggruppa crypto correlate per evitare posizioni ridondanti durante crash
const CORRELATION_GROUPS = {
    'BTC_MAJOR': ['bitcoin', 'bitcoin_usdt', 'ethereum', 'ethereum_usdt', 'solana', 'solana_eur', 'cardano', 'cardano_usdt', 'polkadot', 'polkadot_usdt'],
    'DEFI': ['chainlink', 'chainlink_usdt', 'uniswap', 'uniswap_eur', 'avalanche', 'avalanche_eur', 'aave', 'crv', 'ldo', 'mkr', 'comp', 'snx'],
    'LAYER1_ALT': ['near', 'near_eur', 'atom', 'atom_eur', 'sui', 'sui_eur', 'apt', 'sei', 'ton', 'inj', 'algo', 'vet', 'icp'],
    'PAYMENTS': ['trx', 'trx_eur', 'xlm', 'xlm_eur'], // ❌ Removed 'eos', 'eos_eur' - Delisted from Binance
    'LAYER2': ['arb', 'arb_eur', 'op', 'op_eur', 'matic', 'matic_eur'],
    'GAMING': ['sand', 'mana', 'axs', 'imx', 'gala', 'enj', 'enj_eur'],
    'STORAGE': ['fil', 'ar'],
    'MEME': ['dogecoin', 'dogecoin_eur', 'shiba', 'shiba_eur', 'pepe', 'pepe_eur', 'floki', 'bonk'],
    'AI_DATA': ['fet', 'render', 'grt'],
    'STABLECOINS': ['usdc'],
    'INDEPENDENT': ['ripple', 'ripple_eur', 'litecoin', 'litecoin_usdt', 'binance_coin', 'binance_coin_eur', 'pol_polygon', 'pol_polygon_eur']
};

// Config Strategia Ibrida
const HYBRID_STRATEGY_CONFIG = {
    MAX_POSITIONS_PER_GROUP: 2, // Max 2 posizioni per gruppo correlato
    MAX_TOTAL_POSITIONS: 6, // Max 6 posizioni totali
    MAX_EXPOSURE_PER_GROUP_PCT: 0.25, // Max 25% del capitale per gruppo
};

// Symbol to CoinGecko ID mapping
const SYMBOL_TO_COINGECKO = {
    'bitcoin': 'bitcoin',
    'bitcoin_usdt': 'bitcoin',
    'solana': 'solana',
    'solana_eur': 'solana',
    'ethereum': 'ethereum',
    'ethereum_usdt': 'ethereum',
    'cardano': 'cardano',
    'cardano_usdt': 'cardano',
    'polkadot': 'polkadot',
    'polkadot_usdt': 'polkadot',
    'chainlink': 'chainlink',
    'chainlink_usdt': 'chainlink',
    'litecoin': 'litecoin',
    'litecoin_usdt': 'litecoin',
    'ripple': 'ripple',
    'ripple_eur': 'ripple',
    'binance_coin': 'binancecoin',
    'binance_coin_eur': 'binancecoin',
    'pol_polygon': 'polygon-ecosystem-token', // Replaces MATIC
    'pol_polygon_eur': 'polygon-ecosystem-token', // Replaces MATIC
    'avalanche': 'avalanche-2',
    'avalanche_eur': 'avalanche-2',
    'uniswap': 'uniswap',
    'uniswap_eur': 'uniswap',
    'dogecoin': 'dogecoin',
    'dogecoin_eur': 'dogecoin',
    'shiba': 'shiba-inu',
    'shiba_eur': 'shiba-inu',

    // ✅ NEW ADDITIONS - CoinGecko IDs
    'usdc': 'usd-coin',
    'sui': 'sui',
    'sui_eur': 'sui',
    'apt': 'aptos',
    'sei': 'sei-network',
    'ton': 'the-open-network',
    'inj': 'injective-protocol',
    'algo': 'algorand',
    'vet': 'vechain',
    'icp': 'internet-computer',
    'mkr': 'maker',
    'comp': 'compound-governance-token',
    'snx': 'synthetix-network-token',
    'fet': 'fetch-ai',
    'render': 'render-token',
    'grt': 'the-graph',
    'imx': 'immutable-x',
    'gala': 'gala',
    'enj': 'enjincoin',
    'enj_eur': 'enjincoin',
    'pepe': 'pepe',
    'pepe_eur': 'pepe',
    'floki': 'floki',
    'bonk': 'bonk',
    'ar': 'arweave'
};

// Helper to get price for a symbol
// ✅ FIX: Helper per ottenere tasso di cambio USDT/EUR
// Cache del tasso per evitare troppe chiamate API
let cachedUSDTtoEURRate = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minuti

const getUSDTtoEURRate = async () => {
    // ✅ FIX: Usa cache se disponibile e recente
    const now = Date.now();
    if (cachedUSDTtoEURRate && (now - cacheTimestamp) < CACHE_DURATION_MS) {
        return cachedUSDTtoEURRate;
    }

    try {
        // Prova a ottenere EUR/USDT da Binance (se disponibile) o usa tasso fisso
        // EURUSDT = quanti USDT per 1 EUR (es. 1.08 = 1 EUR = 1.08 USDT)
        // Quindi 1 USDT = 1 / EURUSDT EUR
		const eurUsdData = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT`);
        if (eurUsdData && eurUsdData.price) {
            const rate = 1 / parseFloat(eurUsdData.price);
            cachedUSDTtoEURRate = rate;
            cacheTimestamp = now;
            return rate;
        }
    } catch (e) {
        console.warn('⚠️ Could not fetch EUR/USDT rate from Binance');
        // ✅ FIX: Se abbiamo un valore in cache (anche vecchio), usalo invece del fallback fisso
        if (cachedUSDTtoEURRate) {
            console.log(`💾 Using cached USDT/EUR rate: ${cachedUSDTtoEURRate.toFixed(4)} (age: ${((now - cacheTimestamp) / 1000).toFixed(0)}s)`);
            return cachedUSDTtoEURRate;
        }
    }
    // Fallback: 1 USDT ≈ 0.92 EUR (approssimativo) - solo se non c'è cache
    const fallbackRate = 0.92;
    console.log('⚠️ Using fallback USDT/EUR rate: 0.92');
    cachedUSDTtoEURRate = fallbackRate;
    cacheTimestamp = now;
    return fallbackRate;
};


// ✅ CACHE AGGRESSIVA per evitare rate limit Binance
const priceCache = new Map();
const PRICE_CACHE_TTL = 60000; // 60 secondi - cache MOLTO aggressiva per evitare rate limit Binance

const getSymbolPrice = async (symbol) => {
    // ✅ Controlla cache prima di chiamare Binance
    const cached = priceCache.get(symbol);
    if (cached && (Date.now() - cached.timestamp) < PRICE_CACHE_TTL) {
        return cached.price;
    }

    const tradingPair = SYMBOL_TO_PAIR[symbol] || 'BTCEUR';
    const coingeckoId = SYMBOL_TO_COINGECKO[symbol] || 'bitcoin';

    // ✅ FIX: Verifica se la coppia è in USDT (serve conversione)
    const isUSDT = tradingPair.endsWith('USDT');

    try {
		const data = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=${tradingPair}`);
        if (data && data.price) {
            let price = parseFloat(data.price);

            // ✅ FIX CRITICO: Se la coppia è in USDT, converti in EUR
            if (isUSDT) {
                try {
                    const usdtToEurRate = await getUSDTtoEURRate();
                    price = price * usdtToEurRate;
                    // Log solo occasionalmente per non intasare i log
                    if (Math.random() < 0.1) {
                        console.log(`💱 [PRICE] ${tradingPair}: ${data.price} USDT → €${price.toFixed(2)} EUR (rate: ${usdtToEurRate.toFixed(4)})`);
                    }
                } catch (rateError) {
                    console.error(`⚠️ Error converting USDT to EUR for ${tradingPair}:`, rateError.message);
                    // Usa fallback rate se la conversione fallisce
                    price = price * 0.92;
                }
            }

            // ✅ Salva in cache
            priceCache.set(symbol, { price, timestamp: Date.now() });
            return price;
        }
        throw new Error("Invalid data from Binance");
    } catch (e) {
        console.error(`Error fetching ${symbol} price from Binance:`, e.message);
        try {
            // ✅ FIX: CoinGecko restituisce sempre in EUR, quindi è più affidabile per coppie USDT
			const geckoData = await httpsGet(`https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=eur`);
            if (geckoData && geckoData[coingeckoId] && geckoData[coingeckoId].eur) {
                const price = parseFloat(geckoData[coingeckoId].eur);
                console.log(`💱 [PRICE] ${symbol} from CoinGecko: €${price.toFixed(2)} EUR`);
                // ✅ Salva in cache anche per CoinGecko
                priceCache.set(symbol, { price, timestamp: Date.now() });
                return price;
            }
        } catch (e2) {
            console.error(`Error fetching ${symbol} price from CoinGecko:`, e2.message);
        }
    }

    // FIX: Fallback to old cache if available instead of 0
    if (cached) {
        console.log(`⚠️ Using expired cache for ${symbol} due to API failure: €${cached.price}`);
        return cached.price;
    }
    return 0;
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

/**
 * Rileva trend su un timeframe specifico per un simbolo
 * @param {string} symbol - Simbolo crypto (es. 'bitcoin')
 * @param {string} interval - Timeframe (es. '1h', '4h')
 * @param {number} limit - Numero di candele da analizzare (default 50)
 * @returns {Promise<string>} 'bullish', 'bearish', o 'neutral'
 */
const detectTrendOnTimeframe = async (symbol, interval, limit = 50) => {
    try {
        // Carica klines dal DB
        const klines = await dbAll(
            `SELECT close_price FROM klines 
             WHERE symbol = ? AND interval = ? 
             ORDER BY open_time DESC LIMIT ?`,
            [symbol, interval, limit]
        );

        if (!klines || klines.length < 20) {
            console.log(`⚠️ [MTF] Insufficient data for ${symbol} ${interval} (${klines?.length || 0} candles)`);
            return 'neutral'; // Fallback se non ci sono dati
        }

        // Reverse per ordine cronologico (più vecchio → più recente)
        const prices = klines.reverse().map(k => parseFloat(k.close_price));

        // Calcola EMA 10 e EMA 20 usando la funzione del signalGenerator
        const ema10 = signalGenerator.calculateEMA(prices, 10);
        const ema20 = signalGenerator.calculateEMA(prices, 20);

        if (!ema10 || !ema20) {
            return 'neutral';
        }

        // Determina trend
        if (ema10 > ema20 * 1.005) return 'bullish'; // EMA10 > EMA20 + 0.5%
        if (ema10 < ema20 * 0.995) return 'bearish'; // EMA10 < EMA20 - 0.5%
        return 'neutral';
    } catch (err) {
        console.error(`❌ [MTF] Error detecting trend for ${symbol} ${interval}:`, err.message);
        return 'neutral'; // Fallback in caso di errore
    }
};

/**
 * Ottiene il volume di trading 24h per un simbolo
 * @param {string} symbol - Simbolo crypto (es. 'bitcoin')
 * @returns {Promise<number>} Volume 24h in quote currency (EUR o USDT)
 */
const get24hVolume = async (symbol) => {
    try {
        const tradingPair = SYMBOL_TO_PAIR[symbol];
        if (!tradingPair) {
            console.warn(`⚠️ [VOLUME] No trading pair found for ${symbol}`);
            return 0;
        }

		const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${tradingPair}`;
        const data = await httpsGet(url);

        if (!data || !data.quoteVolume) {
            console.warn(`⚠️ [VOLUME] Invalid response for ${symbol}`);
            return 0;
        }

        // Volume in quote currency (EUR o USDT)
        const volumeQuote = parseFloat(data.quoteVolume);
        return volumeQuote;
    } catch (err) {
        console.error(`❌ [VOLUME] Error fetching 24h volume for ${symbol}:`, err.message);
        return 0;
    }
};

/**
 * Trova il gruppo di correlazione di un simbolo
 * @param {string} symbol - Simbolo crypto
 * @returns {string|null} Nome del gruppo o null se non trovato
 */
const getCorrelationGroup = (symbol) => {
    for (const [groupName, symbols] of Object.entries(CORRELATION_GROUPS)) {
        if (symbols.includes(symbol)) {
            return groupName;
        }
    }
    return null;
};

/**
 * Verifica se può aprire una posizione secondo la strategia ibrida
 * @param {string} symbol - Simbolo da aprire
 * @param {Array} openPositions - Posizioni già aperte
 * @returns {Object} { allowed: boolean, reason: string, groupPositions: number }
 */
const canOpenPositionHybridStrategy = async (symbol, openPositions) => {
    const group = getCorrelationGroup(symbol);

    if (!group) {
        // Simbolo non in nessun gruppo, permetti sempre
        return { allowed: true, reason: 'Symbol not in correlation groups', groupPositions: 0 };
    }

    // Conta posizioni nello stesso gruppo
    const groupSymbols = CORRELATION_GROUPS[group];
    const groupPositions = openPositions.filter(p =>
        groupSymbols.includes(p.symbol) && p.status === 'open'
    );

    // Verifica limite posizioni per gruppo
    if (groupPositions.length >= HYBRID_STRATEGY_CONFIG.MAX_POSITIONS_PER_GROUP) {
        return {
            allowed: false,
            reason: `Max ${HYBRID_STRATEGY_CONFIG.MAX_POSITIONS_PER_GROUP} positions per group ${group} (current: ${groupPositions.length})`,
            groupPositions: groupPositions.length
        };
    }

    // Verifica limite totale posizioni
    if (openPositions.length >= HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS) {
        return {
            allowed: false,
            reason: `Max ${HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS} total positions (current: ${openPositions.length})`,
            groupPositions: groupPositions.length
        };
    }

    return {
        allowed: true,
        reason: `OK - Group ${group}: ${groupPositions.length}/${HYBRID_STRATEGY_CONFIG.MAX_POSITIONS_PER_GROUP} positions`,
        groupPositions: groupPositions.length
    };
};

// Bot Loop Function for a single symbol
const runBotCycleForSymbol = async (symbol, botSettings) => {
    try {
        const isBotActive = botSettings && botSettings.is_active === 1;

        // Get current price for this symbol
        let currentPrice = await getSymbolPrice(symbol);

        if (currentPrice === 0) {
            console.error(`⚠️ Could not fetch price for ${symbol}, skipping cycle`);
            return;
        }

        // ✅ REFACTORING: Manteniamo price_history per backward compatibility (dashboard, RSI legacy)
        // ma non lo usiamo più per i segnali del bot
        await dbRun("INSERT INTO price_history (symbol, price) VALUES (?, ?)", [symbol, currentPrice]);

        // Carica price_history per RSI legacy (backward compatibility)
        const symbolPriceHistory = await dbAll(
            "SELECT price FROM price_history WHERE symbol = ? ORDER BY timestamp DESC LIMIT 50",
            [symbol]
        );
        const priceHistory = symbolPriceHistory.reverse().map(r => parseFloat(r.price));
        priceHistory.push(currentPrice);
        if (priceHistory.length > 50) priceHistory.shift();

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
                [symbol, primaryInterval, candleStartTime]
            );

            if (existingKline) {
                // Aggiorna candela esistente: aggiorna high, low, close
                const newHigh = Math.max(existingKline.high_price, currentPrice);
                const newLow = Math.min(existingKline.low_price, currentPrice);

                await dbRun(
                    "UPDATE klines SET high_price = ?, low_price = ?, close_price = ?, close_time = ? WHERE symbol = ? AND interval = ? AND open_time = ?",
                    [newHigh, newLow, currentPrice, now, symbol, primaryInterval, candleStartTime]
                );

                // Log solo ogni 10 aggiornamenti per non intasare i log
                if (Math.random() < 0.1) {
                    console.log(`📊 [${symbol.toUpperCase()}] Kline ${primaryInterval} aggiornata: ${new Date(candleStartTime).toISOString()} | Price: €${currentPrice.toFixed(2)} | High: €${newHigh.toFixed(2)} | Low: €${newLow.toFixed(2)}`);
                }
            } else {
                // Crea nuova candela
                await dbRun(
                    `INSERT INTO klines 
                    (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [symbol, primaryInterval, candleStartTime, currentPrice, currentPrice, currentPrice, currentPrice, 0, now]
                );
                console.log(`🆕 [${symbol.toUpperCase()}] Nuova candela ${primaryInterval} creata: ${new Date(candleStartTime).toISOString()} | Price: €${currentPrice.toFixed(2)}`);
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
                        [symbol, interval, candleStartTime]
                    );

                    if (existingKline) {
                        const newHigh = Math.max(existingKline.high_price, currentPrice);
                        const newLow = Math.min(existingKline.low_price, currentPrice);

                        await dbRun(
                            "UPDATE klines SET high_price = ?, low_price = ?, close_price = ?, close_time = ? WHERE symbol = ? AND interval = ? AND open_time = ?",
                            [newHigh, newLow, currentPrice, now, symbol, interval, candleStartTime]
                        );
                    } else {
                        await dbRun(
                            `INSERT INTO klines 
                            (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [symbol, interval, candleStartTime, currentPrice, currentPrice, currentPrice, currentPrice, 0, now]
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

        // 5. Get bot parameters for this symbol
        const params = await getBotParameters(symbol);
        const rsi = calculateRSI(priceHistory, params.rsi_period);

        // Update latest RSI for dashboard (only for bitcoin for backward compatibility)
        if (symbol === 'bitcoin') {
            latestRSI = rsi;
        }

        const tradingPair = SYMBOL_TO_PAIR[symbol] || symbol.toUpperCase();
        if (rsi) {
            console.log(`🤖 BOT [${symbol.toUpperCase()}]: ${tradingPair}=${currentPrice.toFixed(2)}€ | RSI=${rsi.toFixed(2)} | Active=${isBotActive}`);
        }

        if (!isBotActive || !rsi) return; // Stop here if bot is off

        // ✅ VOLUME FILTER - Evita coin illiquide (pump & dump, spread alti)
        const volume24h = await get24hVolume(symbol);
        const MIN_VOLUME = 500_000; // 500K EUR/USDT minimo (personalizzabile)

        if (volume24h < MIN_VOLUME) {
            console.log(`⚠️ [VOLUME-FILTER] ${symbol.toUpperCase()} skipped: Volume 24h €${volume24h.toLocaleString('it-IT', { maximumFractionDigits: 0 })} < €${MIN_VOLUME.toLocaleString('it-IT')}`);
            console.log(`   → Coin troppo illiquida. Rischio: spread alto, difficoltà chiusura posizioni, pump & dump.`);
            return; // Salta questo ciclo
        }

        console.log(`✅ [VOLUME-FILTER] ${symbol.toUpperCase()} OK: Volume 24h €${volume24h.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`);

        // 6. RISK CHECK - Protezione PRIMA di tutto
        const riskCheck = await riskManager.calculateMaxRisk();

        if (!riskCheck.canTrade) {
            console.log(`🛑 RISK MANAGER: Trading blocked - ${riskCheck.reason}`);
            console.log(`   Daily Loss: ${(riskCheck.dailyLoss * 100).toFixed(2)}% | Exposure: ${(riskCheck.currentExposure * 100).toFixed(2)}% | Drawdown: ${(riskCheck.drawdown * 100).toFixed(2)}%`);
            return; // STOP - Non tradare se rischio troppo alto
        }

        console.log(`✅ RISK MANAGER: OK - Max Position: €${riskCheck.maxPositionSize.toFixed(2)} | Available Exposure: ${(riskCheck.availableExposurePct * 100).toFixed(2)}%`);

        // ✅ REFACTORING: Usa candele reali (15m) invece di price_history per segnali affidabili
        // 7. Carica ultime 100 candele complete 15m per analisi trend reali
        // 7. Carica ultime 100 candele complete 15m per analisi trend reali
        const timeframe = '15m'; // Timeframe principale per analisi
        const klinesData = await dbAll(
            `SELECT open_time, open_price, high_price, low_price, close_price, volume 
             FROM klines 
             WHERE symbol = ? AND interval = ? 
             ORDER BY open_time DESC LIMIT 100`,
            [symbol, timeframe]
        );

        // Se non abbiamo abbastanza dati, usiamo priceHistory come fallback (meno preciso)
        let analysis;
        if (klinesData && klinesData.length >= 50) {
            // Converti per signalGenerator (dal più vecchio al più recente)
            const candles = klinesData.reverse().map(k => ({
                open: parseFloat(k.open_price),
                high: parseFloat(k.high_price),
                low: parseFloat(k.low_price),
                close: parseFloat(k.close_price),
                volume: parseFloat(k.volume)
            }));
            
            // Analisi completa con indicatori multipli (RSI, MACD, Bollinger, EMA)
            analysis = signalGenerator.analyzeTrend(candles);
        } else {
            // Fallback base su array prezzi
            analysis = {
                signal: 'NEUTRAL',
                trend: 'NEUTRAL',
                strength: 0,
                rsi: latestRSI || 50,
                price: currentPrice
            };
        }

        // 8. Logica di Trading (Apertura Posizioni)
        // Apri solo se il segnale è forte e abbiamo conferma multitimeframe
        if (analysis.signal !== 'NEUTRAL' && Math.abs(analysis.strength) >= 70) {
            
            // Verifica direzione trend su timeframe superiore (4h) per conferma
            const trend4h = await detectTrendOnTimeframe(symbol, '4h');
            const direction = analysis.signal === 'BUY' ? 'long' : 'short';
            const isTrendConfirmed = (direction === 'long' && trend4h === 'bullish') || 
                                     (direction === 'short' && trend4h === 'bearish');

            if (isTrendConfirmed) {
                // Verifica se abbiamo già posizioni aperte su questo symbol
                const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
                const symbolPosition = openPositions.find(p => p.symbol === symbol);

                if (!symbolPosition) {
                    // VERIFICA STRATEGIA IBRIDA
                    const hybridCheck = await canOpenPositionHybridStrategy(symbol, openPositions);
                    
                    if (hybridCheck.allowed) {
                        try {
                            // Calcola size basata sul rischio
                            const stopLossDist = direction === 'long' 
                                ? (analysis.price - analysis.support) / analysis.price 
                                : (analysis.resistance - analysis.price) / analysis.price;
                            
                            // Safety check su stop loss distance (min 0.5%, max 5%)
                            const safeSlDist = Math.max(0.005, Math.min(stopLossDist, 0.05));
                            
                            // Usa risk manager per calcolare size ideale
                            const positionSize = riskManager.calculatePositionSize(
                                portfolio.balance_usd, 
                                safeSlDist, 
                                symbol
                            );

                            // Esegui trade simulato
                            const amount = positionSize / currentPrice;
                            
                            // Parametri per TP/SL
                            const slPrice = direction === 'long' 
                                ? currentPrice * (1 - safeSlDist) 
                                : currentPrice * (1 + safeSlDist);
                                
                            const tpPrice = direction === 'long'
                                ? currentPrice * (1 + (safeSlDist * 1.5)) // Risk:Reward 1:1.5
                                : currentPrice * (1 - (safeSlDist * 1.5));

                            // Salva nel DB
                            await dbRun(
                                `INSERT INTO open_positions 
                                (symbol, type, entry_price, amount, status, stop_loss, take_profit, opened_at, signal_details) 
                                VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
                                [
                                    symbol, 
                                    direction, 
                                    currentPrice, 
                                    amount, 
                                    slPrice, 
                                    tpPrice, 
                                    new Date().toISOString(),
                                    JSON.stringify(analysis) // Salva dettagli analisi
                                ]
                            );

                            console.log(`🚀 [OPEN ${direction.toUpperCase()}] ${symbol} @ €${currentPrice.toFixed(4)} | Size: €${positionSize.toFixed(2)} | Reason: Hybrid Strategy OK`);
                            
                            // Notifica
                            sendCryptoEmail(
                                `🚀 APERTA Posizione ${direction.toUpperCase()} su ${symbol.toUpperCase()}`,
                                `Prezzo: €${currentPrice}\nSize: €${positionSize.toFixed(2)}\nSL: €${slPrice.toFixed(4)}\nTP: €${tpPrice.toFixed(4)}\n\nAnalisi: ${JSON.stringify(analysis, null, 2)}`
                            );

                        } catch (tradeErr) {
                            console.error(`❌ Error opening trade for ${symbol}:`, tradeErr.message);
                        }
                    } else {
                        console.log(`⏸️ [HYBRID SKIP] ${symbol}: ${hybridCheck.reason}`);
                    }
                }
            }
        }

    } catch (error) {
        console.error(`❌ Error in bot cycle for ${symbol}:`, error.message);
    }
};

// Update positions P&L and handle TP/SL
const updatePositionsPnL = async (currentPrice, symbol) => {
    try {
        const positions = await dbAll("SELECT * FROM open_positions WHERE status = 'open' AND symbol = ?", [symbol]);
        
        for (const pos of positions) {
            const isLong = pos.type === 'long';
            const entryPrice = pos.entry_price;
            
            // Calcola P&L
            let profitLossPct = 0;
            let profitLossUsd = 0;
            
            if (isLong) {
                profitLossPct = (currentPrice - entryPrice) / entryPrice;
                profitLossUsd = (currentPrice - entryPrice) * pos.amount;
            } else {
                profitLossPct = (entryPrice - currentPrice) / entryPrice;
                profitLossUsd = (entryPrice - currentPrice) * pos.amount;
            }
            
            // Aggiorna DB
            await dbRun(
                "UPDATE open_positions SET current_price = ?, profit_loss = ?, profit_loss_pct = ?, last_updated = ? WHERE id = ?",
                [currentPrice, profitLossUsd, profitLossPct * 100, new Date().toISOString(), pos.id]
            );
            
            // Check TP/SL
            let closeReason = null;
            
            if (isLong) {
                if (currentPrice <= pos.stop_loss) closeReason = 'stop_loss';
                else if (currentPrice >= pos.take_profit) closeReason = 'take_profit';
            } else {
                // Short
                if (currentPrice >= pos.stop_loss) closeReason = 'stop_loss';
                else if (currentPrice <= pos.take_profit) closeReason = 'take_profit';
            }

            // Panic Sell check (from frontend or logic)
            // ... implementare se necessario

            if (closeReason) {
                console.log(`🔔 Closing ${pos.symbol} (${pos.type}) - Reason: ${closeReason} | P&L: €${profitLossUsd.toFixed(2)}`);
                
                await dbRun(
                    "UPDATE open_positions SET status = ?, closed_at = ?, close_price = ? WHERE id = ?",
                    [closeReason === 'take_profit' ? 'closed' : 'stopped', new Date().toISOString(), currentPrice, pos.id]
                );
                
                // Registra trade nella history
                await dbRun(
                    "INSERT INTO trades (ticket_id, symbol, type, amount, price, profit_loss, strategy, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [pos.ticket_id || pos.id, pos.symbol, pos.type === 'long' ? 'sell' : 'buy', pos.amount, currentPrice, profitLossUsd, 'RSI_Strategy', new Date().toISOString()]
                );

                sendCryptoEmail(
                    `🔔 POSIZIONE CHIUSA: ${pos.symbol} (${closeReason})`,
                    `Profit/Loss: €${profitLossUsd.toFixed(2)} (${(profitLossPct*100).toFixed(2)}%)`
                );
            }
        }
    } catch (err) {
        console.error(`❌ Error updating P&L for ${symbol}:`, err.message);
    }
};

// Main Bot Loop
const runBotCycle = async () => {
    console.log(`🔄 Bot Cycle Starting... ${new Date().toISOString()}`);
    
    // 1. Get enabled symbols from DB or Config
    const botSettings = await dbAll("SELECT * FROM bot_settings WHERE is_active = 1");
    // Se non ci sono setting, usa lista default
    const activeSymbols = botSettings.length > 0 
        ? botSettings.map(b => b.symbol) 
        : ['bitcoin', 'ethereum', 'solana', 'dogecoin', 'pepe', 'binance_coin', 'ripple', 'cardano']; // Default list

    // Aggiungi unici dalla lista supportata se non presenti
    const uniqueSymbols = [...new Set([...activeSymbols])];

    console.log(`Checking ${uniqueSymbols.length} active symbols...`);

    // Esegui cicli in sequenza (non parallel) per evitare sovraccarico API
    for (const symbol of uniqueSymbols) {
        const settings = botSettings.find(b => b.symbol === symbol) || { is_active: 1 };
        await runBotCycleForSymbol(symbol, settings);
        
        // Pausa breve tra simboli per rate limit
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log("✅ Bot Cycle Finished.");
};

// Start the loop - FIX ANTI-BLOCK
let isBotRunning = false;
const startBotLoop = async () => {
    if (isBotRunning) {
        console.log("⚠️ Bot cycle still running, skipping new cycle...");
        return;
    }
    isBotRunning = true;
    try {
        await runBotCycle();
    } catch (error) {
        console.error("❌ Critical Error in Bot Loop:", error);
    } finally {
        isBotRunning = false;
        setTimeout(startBotLoop, CHECK_INTERVAL_MS);
    }
};
startBotLoop();

// ==========================================
// OPEN POSITIONS API
// ==========================================

// GET /api/crypto/positions
router.get('/positions', async (req, res) => {
    try {
        const positions = await dbAll("SELECT * FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC");
        res.json(positions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = {
    router,
    setSocketIO
};