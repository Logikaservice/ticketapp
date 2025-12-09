const express = require('express');
const router = express.Router();

// ✅ POSTGRESQL ONLY: Richiede esplicitamente PostgreSQL
// Il modulo crypto_db DEVE essere crypto_db_postgresql.js (rinominato a crypto_db.js)
const cryptoDb = require('../crypto_db');

// Verifica che il modulo esporti gli helper PostgreSQL
if (!cryptoDb.dbAll || !cryptoDb.dbGet || !cryptoDb.dbRun) {
    throw new Error('❌ CRITICAL: crypto_db must be PostgreSQL module. SQLite support removed.');
}

const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;
const dbRun = cryptoDb.dbRun;

console.log('✅ Using PostgreSQL crypto database');

const https = require('https');

// Import new services
const riskManager = require('../services/RiskManager');
const signalGenerator = require('../services/BidirectionalSignalGenerator');
const { sendCryptoEmail } = require('../services/CryptoEmailNotifications');
// ✅ IMPORTANTE: Carica SmartExit per attivare il sistema di ragionamento avanzato
require('../services/SmartExit');

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
        // Event emission logging removed - too verbose
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

// ✅ POSTGRESQL ONLY: dbAll, dbGet, dbRun sono già definiti sopra

// Helper to get portfolio
const getPortfolio = async () => {
    try {
        const row = await dbGet("SELECT * FROM portfolio LIMIT 1");

        if (!row) {
            // ✅ FIX: Se non esiste, ritorna default
            return { balance_usd: 10800.0, holdings: '{}' }; // Default: 10800 USDT
        }

        // ✅ FIX CRITICO: Valida balance_usd per evitare valori assurdi
        const rawBalance = parseFloat(row.balance_usd) || 0;
        const MAX_REASONABLE_BALANCE = 10000000; // 10 milioni USDT max
        const MIN_REASONABLE_BALANCE = -1000000; // -1 milione min

        // ✅ CAMBIATO: balance_usd ora è in USDT (non più EUR) per match con grafico TradingView
        // ✅ DEBUG: Log balance per tracciare calcoli
        // Balance check logging removed

        if (rawBalance > MAX_REASONABLE_BALANCE || rawBalance < MIN_REASONABLE_BALANCE) {
            console.error(`🚨 [PORTFOLIO] Valore anomale di balance_usd nel database: $${rawBalance.toLocaleString()} USDT. Correggendo automaticamente a $10800 USDT`);
            // ✅ FIX CRITICO: Aggiorna il database con valore valido (10800 USDT)
            try {
                await dbRun("UPDATE portfolio SET balance_usd = ? WHERE id = 1", [10800]);
                // Auto-fix balance logging removed
                row.balance_usd = 10800; // Usa valore valido per questa chiamata
            } catch (updateErr) {
                console.error('❌ Error fixing portfolio balance:', updateErr.message);
                // Anche se l'update fallisce, usa comunque il valore valido per questa chiamata
                row.balance_usd = 10800;
            }
        }

        // ✅ DEBUG: Log balance finale dopo validazione
        const finalBalance = parseFloat(row.balance_usd) || 0;
        // Balance validation logging removed

        return row;
    } catch (e) {
        console.error('❌ Exception getting portfolio:', e.message);
        // ✅ FIX: Ritorna default invece di crashare
        return { balance_usd: 10000.0, holdings: '{}' };
    }
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
                const tradingPair = SYMBOL_TO_PAIR[symbol] || 'BTCUSDT';
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

// ✅ POSTGRESQL ONLY: dbGet e dbRun sono già definiti sopra

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
        // Dashboard stats logging removed

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

        // ✅ NUOVO: Calcola sentimento bot per ogni posizione aperta
        const openPositionsWithSentiment = await Promise.all(openPositions.map(async (position) => {
            try {
                // Ottieni klines per calcolare segnale attuale
                const klinesData = await dbAll(
                    "SELECT * FROM klines WHERE symbol = ? AND interval = '15m' ORDER BY open_time DESC LIMIT 50",
                    [position.symbol]
                );

                if (klinesData && klinesData.length >= 20) {
                    const klinesChronological = klinesData.reverse();
                    // ✅ FIX CRITICO: Normalizza prezzi klines a USDT per evitare mismatch EUR/USDT
                    // Verifica se le klines sono in EUR o USDT confrontando con prezzo corrente Binance
                    const currentBinancePrice = await getSymbolPrice(position.symbol).catch(() => null); // USDT
                    const latestKlinePrice = parseFloat(klinesChronological[klinesChronological.length - 1]?.close_price || 0);

                    // Se il prezzo più recente è significativamente diverso dal prezzo Binance, potrebbe essere in EUR
                    // Tolleranza: se differenza > 10%, probabilmente è in EUR
                    let conversionRate = 1.0;
                    if (currentBinancePrice && latestKlinePrice > 0) {
                        const priceDiff = Math.abs((currentBinancePrice - latestKlinePrice) / latestKlinePrice);
                        const needsConversion = priceDiff > 0.10 && latestKlinePrice < currentBinancePrice * 0.9; // Se kline è ~10% più bassa, probabilmente EUR

                        if (needsConversion) {
                            try {
                                const usdtToEurRate = await getUSDTtoEURRate();
                                conversionRate = 1.0 / usdtToEurRate; // EUR → USDT
                                console.warn(`⚠️ [CURRENCY-FIX] ${position.symbol.toUpperCase()}: Klines sembrano in EUR (${latestKlinePrice.toFixed(4)} vs ${currentBinancePrice.toFixed(4)} USDT). Convertendo con rate ${conversionRate.toFixed(4)}`);
                            } catch (rateError) {
                                console.error(`⚠️ [CURRENCY-FIX] Errore conversione per ${position.symbol}:`, rateError.message);
                                conversionRate = 1.08; // Fallback: 1 EUR = 1.08 USDT
                            }
                        }
                    }

                    const historyForSignal = klinesChronological.map(kline => ({
                        close: parseFloat(kline.close_price) * conversionRate,  // ✅ Normalizza a USDT
                        high: parseFloat(kline.high_price) * conversionRate,     // ✅ Normalizza a USDT
                        low: parseFloat(kline.low_price) * conversionRate,        // ✅ Normalizza a USDT
                        volume: parseFloat(kline.volume || 0),
                        price: parseFloat(kline.close_price) * conversionRate,    // ✅ Normalizza a USDT
                        open: parseFloat(kline.open_price) * conversionRate,       // ✅ Normalizza a USDT
                        timestamp: kline.open_time
                    }));

                    // Genera segnale attuale
                    const currentSignal = signalGenerator.generateSignal(historyForSignal, position.symbol);

                    // Determina sentimento
                    let sentiment = 'NEUTRAL';
                    let sentimentStrength = 0;
                    let sentimentDirection = null;

                    if (currentSignal.direction === 'LONG') {
                        sentiment = 'BULLISH';
                        sentimentStrength = currentSignal.strength;
                        sentimentDirection = 'UP';
                    } else if (currentSignal.direction === 'SHORT') {
                        sentiment = 'BEARISH';
                        sentimentStrength = currentSignal.strength;
                        sentimentDirection = 'DOWN';
                    } else {
                        sentiment = 'NEUTRAL';
                        sentimentStrength = Math.max(
                            currentSignal.longSignal?.strength || 0,
                            currentSignal.shortSignal?.strength || 0
                        );
                    }

                    // Verifica se sentimento è contrario alla posizione (WARNING)
                    const isContrary = (position.type === 'buy' && sentiment === 'BEARISH') ||
                        (position.type === 'sell' && sentiment === 'BULLISH');

                    return {
                        ...position,
                        bot_sentiment: {
                            sentiment, // 'BULLISH', 'BEARISH', 'NEUTRAL'
                            direction: sentimentDirection, // 'UP', 'DOWN', null
                            strength: sentimentStrength, // 0-100
                            is_contrary: isContrary, // true se contrario alla posizione
                            signal_details: {
                                direction: currentSignal.direction,
                                strength: currentSignal.strength,
                                confirmations: currentSignal.confirmations,
                                reasons: currentSignal.reasons || []
                            }
                        }
                    };
                } else {
                    // Dati insufficienti - sentimento neutro
                    return {
                        ...position,
                        bot_sentiment: {
                            sentiment: 'NEUTRAL',
                            direction: null,
                            strength: 0,
                            is_contrary: false,
                            signal_details: null
                        }
                    };
                }
            } catch (err) {
                console.error(`⚠️ [SENTIMENT] Errore calcolo sentimento per ${position.symbol}:`, err.message);
                // In caso di errore, restituisci posizione senza sentimento
                return {
                    ...position,
                    bot_sentiment: {
                        sentiment: 'NEUTRAL',
                        direction: null,
                        strength: 0,
                        is_contrary: false,
                        signal_details: null,
                        error: err.message
                    }
                };
            }
        }));

        // ✅ FIX: Aggiungi signal_details e profit_loss ai trades dalla posizione corrispondente (aperta o chiusa)
        const allPositions = [...openPositionsWithSentiment, ...closedPositions];
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
                avg_buy_price: avgBuyPrice,
                // ✅ FIX: Calcola e invia equity totale dal backend per coerenza
                total_equity: (() => {
                    let equity = portfolio.balance_usd;
                    const holdings = JSON.parse(portfolio.holdings || '{}');
                    // Stima veloce valore holdings basata sui prezzi correnti delle posizioni aperte o ultimo trade
                    // Nota: il frontend farà un calcolo più preciso con i prezzi live, questo è un riferimento base
                    // Per ora inviamo balance, il frontend aggiunge valore crypto
                    return equity;
                })()
            },
            recent_trades: tradesWithDetails.slice(0, 10), // Send only 10 to frontend list
            all_trades: tradesWithDetails, // Send more history for chart plotting
            active_bots: bots,
            open_positions: openPositionsWithSentiment, // Include open positions with bot sentiment
            closed_positions: closedPositions, // ✅ FIX: Include closed positions per P&L
            rsi: latestRSI,
            // ✅ KELLY CRITERION: Performance statistics
            // ✅ FIX: Se non esiste record con id=1, crealo
            performance_stats: await (async () => {
                let stats = await dbGet("SELECT * FROM performance_stats WHERE id = 1");
                if (!stats) {
                    console.log('⚠️ [DASHBOARD] Record performance_stats con id=1 non trovato, creazione...');
                    // Crea record iniziale se non esiste
                    await dbRun("INSERT OR IGNORE INTO performance_stats (id, total_trades, winning_trades, losing_trades, total_profit, total_loss, avg_win, avg_loss, win_rate) VALUES (1, 0, 0, 0, 0, 0, 0, 0, 0)");
                    stats = await dbGet("SELECT * FROM performance_stats WHERE id = 1");
                    if (stats) {
                        console.log('✅ [DASHBOARD] Record performance_stats creato con successo');
                    } else {
                        console.error('❌ [DASHBOARD] Impossibile creare record performance_stats');
                    }
                }
                // ✅ DEBUG: Log per verificare che i dati siano corretti
                if (stats) {
                    // Performance stats logging removed
                }
                return stats || null;
            })()
        });
    } catch (error) {
        console.error("Dashboard Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/crypto/performance-analytics (Performance Analytics - Giorno/Settimana/Mese/Anno)
router.get('/performance-analytics', async (req, res) => {
    try {
        const portfolio = await getPortfolio();
        const currentBalance = parseFloat(portfolio.balance_usd) || 0;

        // Get all closed positions ordered by close time
        const closedPositions = await dbAll(
            `SELECT * FROM open_positions 
             WHERE status IN ('closed', 'stopped', 'taken') 
             AND closed_at IS NOT NULL 
             ORDER BY closed_at ASC`
        );

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

        // Helper to calculate stats for a period
        const calculatePeriodStats = (positions, startDate) => {
            const periodPositions = positions.filter(p => {
                const closedAt = new Date(p.closed_at);
                return closedAt >= startDate;
            });

            const totalTrades = periodPositions.length;
            const winningTrades = periodPositions.filter(p => parseFloat(p.profit_loss || 0) > 0).length;
            const losingTrades = periodPositions.filter(p => parseFloat(p.profit_loss || 0) < 0).length;

            const totalProfit = periodPositions.reduce((sum, p) => {
                const pl = parseFloat(p.profit_loss || 0);
                return sum + (pl > 0 ? pl : 0);
            }, 0);

            const totalLoss = periodPositions.reduce((sum, p) => {
                const pl = parseFloat(p.profit_loss || 0);
                return sum + (pl < 0 ? Math.abs(pl) : 0);
            }, 0);

            const netProfit = totalProfit - totalLoss;
            const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

            // Calculate ROI based on initial balance for this period
            // Estimate initial balance by subtracting net profit from current balance
            const estimatedInitialBalance = currentBalance - netProfit;
            const roi = estimatedInitialBalance > 0 ? (netProfit / estimatedInitialBalance) * 100 : 0;

            return {
                total_trades: totalTrades,
                winning_trades: winningTrades,
                losing_trades: losingTrades,
                win_rate: winRate,
                total_profit: totalProfit,
                total_loss: totalLoss,
                net_profit: netProfit,
                roi_percent: roi,
                avg_profit_per_trade: totalTrades > 0 ? netProfit / totalTrades : 0
            };
        };

        // Calculate stats for each period
        const dailyStats = calculatePeriodStats(closedPositions, oneDayAgo);
        const weeklyStats = calculatePeriodStats(closedPositions, oneWeekAgo);
        const monthlyStats = calculatePeriodStats(closedPositions, oneMonthAgo);
        const yearlyStats = calculatePeriodStats(closedPositions, oneYearAgo);
        const allTimeStats = calculatePeriodStats(closedPositions, new Date(0)); // All time

        res.json({
            current_balance: currentBalance,
            daily: dailyStats,
            weekly: weeklyStats,
            monthly: monthlyStats,
            yearly: yearlyStats,
            all_time: allTimeStats
        });
    } catch (error) {
        console.error("Performance Analytics Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/crypto/price/:symbol (Proxy to get real price)
router.get('/price/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { currency } = req.query; // 'usdt' or 'usd' (normalized to USDT)
    let price = 0;

    try {
        // 1. Try Binance (Best for USDT)
        try {
            const data = await httpsGet(`https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT`);
            if (data && data.price) {
                price = parseFloat(data.price);
            }
        } catch (e) {
            console.error('Binance API failed:', e.message);
        }

        // 2. Fallback to CoinGecko (for Bitcoin, not Solana!)
        if (!price) {
            try {
                const geckoData = await httpsGet('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
                if (geckoData && geckoData.bitcoin && geckoData.bitcoin.usd) {
                    price = parseFloat(geckoData.bitcoin.usd);
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

        // Return price in USDT (normalized from Binance)
        res.json({
            success: true,
            price: price, // USDT price from Binance
            currency: 'USDT',
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
        const { initial_balance } = req.body;

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

        // 4. Reset portfolio a valore custom (default 250 se non specificato o se reset normale)
        const newBalance = (initial_balance && !isNaN(parseFloat(initial_balance))) ? parseFloat(initial_balance) : 250;
        await dbRun("UPDATE portfolio SET balance_usd = ?, holdings = '{}' WHERE id = 1", [newBalance]);

        // 5. Reset Kelly Criterion Stats (Performance Stats)
        await dbRun("DELETE FROM performance_stats");
        await dbRun("INSERT INTO performance_stats (total_trades, winning_trades, losing_trades, total_profit, total_loss, avg_win, avg_loss, win_rate) VALUES (0, 0, 0, 0, 0, 0, 0, 0)");
        console.log(`🗑️ Resettate statistiche Kelly Criterion`);

        // 6. Invalida cache Risk Manager
        riskManager.invalidateCache();

        res.json({
            success: true,
            message: `Portfolio resettato completamente a $${newBalance.toFixed(2)} USDT. Cancellate ${positionCount} posizione/i, ${tradeCount} trade/i e resettate statistiche Kelly.`,
            deleted_positions: positionCount,
            deleted_trades: tradeCount,
            new_balance: newBalance
        });
    } catch (err) {
        console.error('Error resetting portfolio:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/crypto/cleanup-positions (Chiudi posizioni in eccesso oltre MAX_TOTAL_POSITIONS)
// ✅ LOGICA INTELLIGENTE: Usa SmartExit per decidere quali posizioni chiudere
router.post('/cleanup-positions', async (req, res) => {
    try {
        const { max_positions } = req.body;
        const targetMax = max_positions && !isNaN(parseInt(max_positions)) ? parseInt(max_positions) : HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS;

        // Recupera tutte le posizioni aperte
        const allOpenPositions = await dbAll(
            "SELECT * FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC"
        );

        const currentCount = allOpenPositions.length;

        if (currentCount <= targetMax) {
            return res.json({
                success: true,
                message: `Nessuna pulizia necessaria. Posizioni aperte: ${currentCount}/${targetMax}`,
                current_count: currentCount,
                target_max: targetMax,
                closed_count: 0
            });
        }

        const positionsToClose = currentCount - targetMax;

        // ✅ LOGICA INTELLIGENTE: Valuta ogni posizione con SmartExit per decidere quali chiudere
        const SmartExit = require('../services/SmartExit');
        const positionScores = [];

        for (const pos of allOpenPositions) {
            try {
                // Ottieni prezzo corrente e history
                // ✅ FIX: Gestisci null (errore) vs 0 (prezzo reale zero)
                const currentPrice = await getSymbolPrice(pos.symbol);
                if (currentPrice === null || currentPrice === undefined) {
                    console.warn(`⚠️ [UPDATE P&L] Impossibile ottenere prezzo per ${pos.symbol} (${pos.ticket_id}), salto`);
                    continue; // Skip se non possiamo ottenere il prezzo
                }
                const klines = await dbAll(
                    "SELECT * FROM klines WHERE symbol = ? AND interval = '15m' ORDER BY open_time DESC LIMIT 50",
                    [pos.symbol]
                );

                const priceHistory = klines.reverse().map(k => ({
                    open: k.open_price,
                    high: k.high_price,
                    low: k.low_price,
                    close: k.close_price,
                    timestamp: k.open_time
                }));

                // ✅ Usa SmartExit per valutare se questa posizione dovrebbe essere chiusa
                const shouldClose = await SmartExit.shouldClosePosition(pos, priceHistory);

                // Calcola score per prioritizzare chiusura:
                // - Score negativo = chiudere prima (perdite, segnali opposti, mercato statico)
                // - Score positivo = mantenere (profitti, trend valido)
                let score = 0;

                const pnlPct = parseFloat(pos.profit_loss_pct) || 0;

                // 1. Priorità a posizioni in perdita (score negativo)
                if (pnlPct < 0) {
                    score -= 100 + Math.abs(pnlPct) * 10; // Più in perdita = score più negativo
                }

                // 2. Priorità a posizioni con segnale opposto forte
                if (shouldClose.reason && shouldClose.reason.includes('opposto')) {
                    score -= 50;
                }

                // 3. Priorità a posizioni in mercato statico senza guadagno
                if (shouldClose.reason && shouldClose.reason.includes('statico')) {
                    score -= 30;
                }

                // 4. Priorità a posizioni vecchie senza guadagno significativo
                const openedAt = new Date(pos.opened_at);
                const hoursOpen = (Date.now() - openedAt.getTime()) / (1000 * 60 * 60);
                if (hoursOpen > 24 && pnlPct < 1.0) {
                    score -= 20; // Posizione vecchia (>24h) con poco guadagno
                }

                // 5. Mantieni posizioni con buon profitto (score positivo)
                if (pnlPct > 2.0) {
                    score += pnlPct * 10; // Più profitto = score più positivo
                }

                // 6. Mantieni posizioni con trend valido (da SmartExit)
                if (shouldClose.reason && shouldClose.reason.includes('MANTENERE')) {
                    score += 30;
                }

                positionScores.push({
                    position: pos,
                    score: score,
                    pnlPct: pnlPct,
                    shouldClose: shouldClose,
                    hoursOpen: hoursOpen
                });
            } catch (err) {
                console.error(`⚠️ Error evaluating position ${pos.ticket_id} for cleanup:`, err.message);
                // Se errore, metti score neutro (chiudi se necessario)
                positionScores.push({
                    position: pos,
                    score: 0,
                    pnlPct: parseFloat(pos.profit_loss_pct) || 0,
                    shouldClose: null,
                    hoursOpen: 0
                });
            }
        }

        // ✅ Ordina per score (score più negativo = chiudere prima)
        positionScores.sort((a, b) => a.score - b.score);

        // ✅ Prendi le prime N posizioni da chiudere (quelle con score più negativo)
        const positionsToCloseList = positionScores.slice(0, positionsToClose);

        let closedCount = 0;
        const closedPositions = [];

        for (const { position: pos, score, pnlPct, shouldClose } of positionsToCloseList) {
            try {
                // Ottieni prezzo corrente per chiudere
                // ✅ FIX: Gestisci null (errore) vs 0 (prezzo reale zero)
                const currentPrice = await getSymbolPrice(pos.symbol);
                if (currentPrice === null || currentPrice === undefined) {
                    console.warn(`⚠️ [CLEANUP] Impossibile ottenere prezzo per ${pos.symbol} (${pos.ticket_id}), salto`);
                    continue; // Skip se non possiamo ottenere il prezzo
                }

                if (currentPrice > 0) {
                    // Chiudi la posizione con motivo dettagliato
                    const reason = shouldClose?.reason || 'cleanup (troppe posizioni)';
                    await closePosition(pos.ticket_id, currentPrice, `cleanup (score: ${score.toFixed(2)}, P&L: ${pnlPct.toFixed(2)}%, ${reason})`);
                    closedCount++;
                    closedPositions.push({
                        ticket_id: pos.ticket_id,
                        symbol: pos.symbol,
                        score: score,
                        pnl_pct: pnlPct,
                        reason: reason
                    });
                }
            } catch (closeErr) {
                console.error(`⚠️ Error closing position ${pos.ticket_id} during cleanup:`, closeErr.message);
            }
        }

        console.log(`🧹 [CLEANUP INTELLIGENTE] Chiuse ${closedCount} posizioni in eccesso. Da ${currentCount} a ${currentCount - closedCount} posizioni.`);
        console.log(`📊 [CLEANUP] Posizioni chiuse (score medio: ${(positionScores.slice(0, closedCount).reduce((sum, p) => sum + p.score, 0) / closedCount).toFixed(2)})`);

        res.json({
            success: true,
            message: `Chiuse ${closedCount} posizioni in eccesso usando logica intelligente. Da ${currentCount} a ${currentCount - closedCount} posizioni.`,
            current_count: currentCount,
            target_max: targetMax,
            closed_count: closedCount,
            closed_positions: closedPositions,
            logic_used: 'SmartExit + P&L + Time-based scoring'
        });
    } catch (err) {
        console.error('Error cleaning up positions:', err);
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

        console.log(`💰 Fondi aggiunti: $${fundsToAdd.toFixed(2)} USDT | Saldo precedente: $${currentBalance.toFixed(2)} USDT | Nuovo saldo: $${newBalance.toFixed(2)} USDT`);

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
        // ✅ MIGRAZIONE POSTGRESQL: Usa dbRun invece di db.run
        await dbRun("UPDATE portfolio SET balance_usd = ?, holdings = ?", [balance, JSON.stringify(holdings)]);
        await dbRun("INSERT INTO trades (symbol, type, amount, price, strategy) VALUES (?, ?, ?, ?, ?)",
            [symbol, type, amount, price, strategy]);

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
const MAX_ATR_PCT = 5.0; // Maximum ATR percentage to block trading (volatility too high)


// Default strategy parameters (fallback if not configured)
const DEFAULT_PARAMS = {
    rsi_period: 14,
    rsi_oversold: 30,
    rsi_overbought: 70,
    stop_loss_pct: 2.0,
    take_profit_pct: 3.0,
    trade_size_usdt: 50,
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
    // ✅ FIX: Usa SOLO coppie USDT per evitare mismatch EUR/USDT
    'bitcoin': 'BTCUSDT',        // Era BTCEUR
    'bitcoin_usdt': 'BTCUSDT',
    'solana': 'SOLUSDT',
    'solana_eur': 'SOLUSDT',     // Era SOLEUR
    'ethereum': 'ETHUSDT',       // Era ETHEUR
    'ethereum_usdt': 'ETHUSDT',
    'cardano': 'ADAUSDT',        // Era ADAEUR - FIX PRINCIPALE
    'cardano_usdt': 'ADAUSDT',
    'polkadot': 'DOTUSDT',       // Era DOTEUR
    'polkadot_usdt': 'DOTUSDT',
    'chainlink': 'LINKUSDT',     // Era LINKEUR
    'chainlink_usdt': 'LINKUSDT',
    'litecoin': 'LTCUSDT',       // Era LTCEUR
    'litecoin_usdt': 'LTCUSDT',
    'ripple': 'XRPUSDT',
    'ripple_eur': 'XRPUSDT',     // Era XRPEUR
    'binance_coin': 'BNBUSDT',
    'binance_coin_eur': 'BNBUSDT', // Era BNBEUR
    'pol_polygon': 'POLUSDT',
    'pol_polygon_eur': 'POLUSDT',  // Era POLEUR
    'avalanche': 'AVAXUSDT',
    'avalanche_eur': 'AVAXUSDT', // Era AVAXEUR
    'uniswap': 'UNIUSDT',
    'uniswap_eur': 'UNIUSDT',    // Era UNIEUR
    'dogecoin': 'DOGEUSDT',
    'dogecoin_eur': 'DOGEUSDT',  // Era DOGEEUR
    'shiba': 'SHIBUSDT',
    'shiba_eur': 'SHIBUSDT',     // Era SHIBEUR
    // Layer 1 Alternatives
    'near': 'NEARUSDT',
    'near_eur': 'NEARUSDT',      // Era NEAREUR
    'atom': 'ATOMUSDT',
    'atom_eur': 'ATOMUSDT',      // Era ATOMEUR
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
    'trx_eur': 'TRXUSDT',        // Era TRXEUR
    'xlm': 'XLMUSDT',
    'xlm_eur': 'XLMUSDT',        // Era XLMEUR
    // ❌ 'eos': 'EOSUSDT', // Delisted from Binance
    // ❌ 'eos_eur': 'EOSEUR', // Not available on Binance
    // Layer 2 / Scaling
    'arb': 'ARBUSDT',
    'arb_eur': 'ARBUSDT',        // Era ARBEUR
    'op': 'OPUSDT',
    'op_eur': 'OPUSDT',          // Era OPEUR
    'matic': 'MATICUSDT',
    'matic_eur': 'MATICUSDT',    // Era MATICEUR
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

    // New Listings (High Volume)
    'sui': 'SUIUSDT', // Volume: €81M/day
    'sui_eur': 'SUIUSDT',        // Era SUIEUR
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
    'enj_eur': 'ENJUSDT',        // Era ENJEUR

    // Meme Coins (High Volume)
    'pepe': 'PEPEUSDT', // Volume: €32.29M/day
    'pepe_eur': 'PEPEUSDT',      // Era PEPEEUR
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
// ✅ LOGICA DINAMICA: Limiti aumentati se win rate è alto (>80%)
// Con win rate 90%, ha senso essere più aggressivi e aprire più posizioni
const HYBRID_STRATEGY_CONFIG = {
    MAX_POSITIONS_PER_GROUP: 10, // ✅ Aumentato: Permette più posizioni per simbolo se win rate alto
    MAX_TOTAL_POSITIONS: 30, // ✅ Aumentato: Con win rate 90%, 30 posizioni è ragionevole (€1000 / 30 = ~€33 per posizione)
    MAX_EXPOSURE_PER_GROUP_PCT: 1.0, // Rimosso limite esposizione per gruppo (gestito dal Risk Manager globale)

    // ✅ Limiti dinamici basati su win rate
    getMaxPositionsForWinRate: (winRate) => {
        if (winRate >= 0.90) return 30; // Win rate 90%+ → 30 posizioni
        if (winRate >= 0.80) return 25; // Win rate 80-89% → 25 posizioni
        if (winRate >= 0.70) return 20; // Win rate 70-79% → 20 posizioni
        return 15; // Win rate <70% → 15 posizioni (più conservativo)
    }
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


// ✅ CACHE OTTIMIZZATA per real-time senza rate limit
const priceCache = new Map();
const PRICE_CACHE_TTL = 3000; // 3 secondi - bilanciato tra real-time e rate limit (prima era 60s)
// Calcolo rate limit: max 20 chiamate/sec Binance, con cache 3s = max 6-7 chiamate/sec per simbolo = SICURO

// ✅ FIX CRITICO: Invalida completamente la cache per tutti i simboli EUR all'avvio
// Questo garantisce che i prezzi vengano sempre convertiti correttamente EUR→USDT
function invalidateEURCache() {
    const EURSymbols = Object.keys(SYMBOL_TO_PAIR).filter(s => {
        const pair = SYMBOL_TO_PAIR[s];
        return pair && pair.endsWith('EUR');
    });
    EURSymbols.forEach(symbol => {
        priceCache.delete(symbol);
    });
    if (EURSymbols.length > 0) {
        console.log(`🔄 [CACHE] Invalidata cache per ${EURSymbols.length} simboli EUR all'avvio`);
    }
}

// Invalida cache EUR all'avvio per garantire conversione corretta
// (SYMBOL_TO_PAIR è definito dopo, quindi chiamiamo dopo la definizione)

// ✅ FIX CRITICO: Invalida completamente la cache per tutti i simboli EUR all'avvio
// Questo garantisce che i prezzi vengano sempre convertiti correttamente EUR→USDT
function invalidateEURCache() {
    const EURSymbols = Object.keys(SYMBOL_TO_PAIR).filter(s => {
        const pair = SYMBOL_TO_PAIR[s];
        return pair && pair.endsWith('EUR');
    });
    EURSymbols.forEach(symbol => {
        priceCache.delete(symbol);
    });
    if (EURSymbols.length > 0) {
        console.log(`🔄 [CACHE] Invalidata cache per ${EURSymbols.length} simboli EUR all'avvio`);
    }
}

// ✅ WEBSOCKET SERVICE per aggiornamenti real-time (zero rate limit)
const BinanceWebSocketService = require('../services/BinanceWebSocket');
let wsService = null;

// Inizializza WebSocket service con callback per aggiornare cache
const initWebSocketService = () => {
    if (!wsService) {
        wsService = new BinanceWebSocketService((symbol, price) => {
            // Callback: aggiorna cache quando arriva prezzo da WebSocket
            priceCache.set(symbol, { price, timestamp: Date.now() });
            // Log solo occasionalmente
            if (Math.random() < 0.05) {
                console.log(`📡 [WEBSOCKET] Prezzo aggiornato ${symbol}: $${price.toFixed(2)} USDT`);
            }
        });

        // Imposta mappa simbolo -> trading pair
        wsService.setSymbolToPairMap(SYMBOL_TO_PAIR);

        // Connetti WebSocket
        wsService.connect().catch(err => {
            console.error('⚠️ [WEBSOCKET] Errore inizializzazione:', err.message);
            console.log('   → Fallback a REST API');
        });
    }
    return wsService;
};

// ✅ Inizializza WebSocket all'avvio
initWebSocketService();

const getSymbolPrice = async (symbol) => {
    // ✅ Controlla cache prima di chiamare Binance
    const cached = priceCache.get(symbol);
    const tradingPair = SYMBOL_TO_PAIR[symbol] || 'BTCUSDT';  // ✅ FIX: Default USDT invece di EUR

    console.log(`💱 [PRICE] Fetching price for symbol: ${symbol} → tradingPair: ${tradingPair}`);

    // ✅ Cache valida - usa prezzo cached
    if (cached && (Date.now() - cached.timestamp) < PRICE_CACHE_TTL) {
        console.log(`💾 [PRICE-CACHE] Using cached price for ${symbol}: $${cached.price.toFixed(6)}`);
        return cached.price;
    }

    // Cache scaduta o non presente - aggiorna prezzo da Binance
    // Log solo occasionalmente per non intasare (ogni ~10 chiamate)
    if (Math.random() < 0.1) {
        console.log(`🔄 [PRICE-UPDATE] Aggiornando prezzo ${symbol} da Binance (cache scaduta)`);
    }

    const coingeckoId = SYMBOL_TO_COINGECKO[symbol] || 'bitcoin';

    try {
        const binanceUrl = `https://api.binance.com/api/v3/ticker/price?symbol=${tradingPair}`;
        console.log(`🔍 [PRICE] Fetching from Binance: ${binanceUrl}`);

        const data = await httpsGet(binanceUrl);
        if (data && data.price) {
            const price = parseFloat(data.price);
            console.log(`✅ [PRICE] Got price from Binance for ${symbol} (${tradingPair}): $${price.toFixed(6)}`);

            // ✅ Salva in cache (sempre in USDT)
            priceCache.set(symbol, { price, timestamp: Date.now() });
            return price;
        }
        throw new Error("Invalid data from Binance");
    } catch (e) {
        console.error(`❌ [PRICE] Binance fetch failed for ${symbol} (${tradingPair}):`, e.message);
        try {
            // ✅ CAMBIATO: CoinGecko ora restituisce USDT direttamente
            const geckoData = await httpsGet(`https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&precision=18`);
            if (geckoData && geckoData[coingeckoId] && geckoData[coingeckoId].usd !== undefined) {
                let price = parseFloat(geckoData[coingeckoId].usd);

                // ✅ FIX: Verifica che il prezzo sia valido (anche se molto basso, es. 0.000007)
                if (price > 0 && !isNaN(price) && isFinite(price)) {
                    console.log(`💱 [PRICE] ${symbol} from CoinGecko: $${price.toFixed(8)} USDT`);
                    // ✅ Salva in cache anche per CoinGecko
                    priceCache.set(symbol, { price, timestamp: Date.now() });
                    return price;
                } else {
                    console.warn(`⚠️ [PRICE] ${symbol} prezzo da CoinGecko non valido: ${price}`);
                }
            } else {
                console.warn(`⚠️ [PRICE] ${symbol} dati CoinGecko non validi o mancanti per ${coingeckoId}`);
            }
        } catch (e2) {
            console.error(`Error fetching ${symbol} price from CoinGecko:`, e2.message);
        }

        // ✅ FIX: Se tutto fallisce, ritorna null invece di 0 per distinguere da prezzo reale zero
        console.error(`❌ [PRICE] Impossibile ottenere prezzo per ${symbol} (tradingPair: ${tradingPair}, coingeckoId: ${coingeckoId})`);
        return null;
    }
};

// Load history from DB on startup
const loadPriceHistory = async () => {
    try {
        const rows = await dbAll("SELECT price FROM price_history WHERE symbol = 'bitcoin' ORDER BY timestamp DESC LIMIT 300");
        if (rows && rows.length > 0) {
            // Reverse because SQL gives DESC (newest first), but we need chronological order for RSI
            priceHistory = rows.map(r => r.price).reverse();
            console.log(`📈 BOT: Loaded ${priceHistory.length} historical prices from DB.`);
        }
    } catch (err) {
        console.error('❌ Error loading price history:', err.message);
    }
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
 * @returns {Promise<number>} Volume 24h in quote currency (USDT)
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

        // Volume in quote currency (USDT)
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
// ✅ Helper: Calcola score qualità di un nuovo segnale
const calculateNewSignalQualityScore = (signal, symbol, signalType) => {
    if (!signal) return { score: 0 };

    let score = 0;

    // 1. Strength del segnale (0-100)
    score += signal.strength || 0;

    // 2. Bonus per conferme (max +30)
    score += Math.min((signal.confirmations || 0) * 10, 30);

    // 3. Bonus per MTF alignment (se presente)
    if (signal.mtf && signal.mtf.bonus) {
        score += signal.mtf.bonus;
    }

    // 4. Penalità se ATR blocked
    if (signal.atrBlocked) {
        score -= 50; // Penalità forte per mercato non adatto
    }

    return {
        score: score,
        strength: signal.strength || 0,
        confirmations: signal.confirmations || 0
    };
};

// ✅ Helper: Calcola score qualità di una posizione esistente
const calculatePositionQualityScore = async (position) => {
    if (!position) return { score: 0, pnlPct: 0, signalStrength: 0 };

    let score = 0;
    const pnlPct = parseFloat(position.profit_loss_pct) || 0;

    // 1. P&L percentuale (score principale)
    score += pnlPct * 10; // P&L positivo aumenta score, negativo lo diminuisce

    // 2. Penalità per posizioni vecchie senza guadagno
    const openedAt = new Date(position.opened_at);
    const hoursOpen = (Date.now() - openedAt.getTime()) / (1000 * 60 * 60);
    if (hoursOpen > 24 && pnlPct < 1.0) {
        score -= 20; // Posizione vecchia senza guadagno significativo
    }

    // 3. Bonus per posizioni con buon profitto
    if (pnlPct > 2.0) {
        score += 30; // Bonus per profitti solidi
    }

    // 4. Penalità forte per perdite significative
    if (pnlPct < -2.0) {
        score -= 50; // Penalità forte per perdite
    }

    // 5. Strength del segnale originale (se disponibile)
    let signalStrength = 0;
    try {
        if (position.signal_details) {
            const signalDetails = typeof position.signal_details === 'string'
                ? JSON.parse(position.signal_details)
                : position.signal_details;
            signalStrength = signalDetails.strength || signalDetails.mtf?.adjustedStrength || 0;
            score += signalStrength * 0.1; // Piccolo bonus per segnali forti
        }
    } catch (e) {
        // Ignora errori di parsing
    }

    return {
        score: score,
        pnlPct: pnlPct,
        signalStrength: signalStrength,
        hoursOpen: hoursOpen,
        position: position
    };
};

const canOpenPositionHybridStrategy = async (symbol, openPositions, newSignal = null, signalType = null) => {
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

    // ✅ LOGICA DINAMICA: Calcola limite max posizioni basato su win rate
    let maxTotalPositions = HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS;
    try {
        // ✅ MIGRAZIONE POSTGRESQL: Usa dbGet invece di db.get
        const stats = await dbGet("SELECT * FROM performance_stats WHERE id = 1");

        if (stats && stats.total_trades >= 10) {
            const winRate = stats.total_trades > 0 ? stats.winning_trades / stats.total_trades : 0.5;
            maxTotalPositions = HYBRID_STRATEGY_CONFIG.getMaxPositionsForWinRate(winRate);
            console.log(`📊 [DYNAMIC POSITIONS] Win rate ${(winRate * 100).toFixed(1)}% → Max positions: ${maxTotalPositions}`);
        }
    } catch (e) {
        // Usa default se errore
    }

    // ✅ LOGICA INTELLIGENTE: Se limite totale raggiunto, confronta nuovo segnale con posizioni esistenti
    if (openPositions.length >= maxTotalPositions) {
        // Se non abbiamo il nuovo segnale, non possiamo confrontare - blocca
        if (!newSignal || !signalType) {
            return {
                allowed: false,
                reason: `Max ${maxTotalPositions} total positions (current: ${openPositions.length}). Nuovo segnale non fornito per confronto.`,
                groupPositions: groupPositions.length
            };
        }

        // ✅ Calcola score del nuovo segnale
        const newSignalScore = calculateNewSignalQualityScore(newSignal, symbol, signalType);

        // ✅ Calcola score di tutte le posizioni esistenti
        const positionScores = [];
        for (const pos of openPositions) {
            const posScore = await calculatePositionQualityScore(pos);
            positionScores.push(posScore);
        }

        // ✅ Ordina per score (score più basso = posizione peggiore)
        positionScores.sort((a, b) => a.score - b.score);

        // ✅ Trova la posizione peggiore (score più basso)
        const worstPosition = positionScores[0];

        // ✅ Confronta: nuovo segnale deve essere MIGLIORE della posizione peggiore
        if (newSignalScore.score > worstPosition.score) {
            console.log(`✅ [SMART REPLACEMENT] Nuovo segnale ${symbol} (score: ${newSignalScore.score.toFixed(2)}) è MIGLIORE della posizione peggiore ${worstPosition.position.symbol} (score: ${worstPosition.score.toFixed(2)})`);
            console.log(`   → Chiuderò ${worstPosition.position.symbol} (P&L: ${worstPosition.pnlPct.toFixed(2)}%, Trend: ${worstPosition.signalStrength}/100) e aprirò ${symbol}`);

            return {
                allowed: true,
                reason: `Smart replacement: Nuovo segnale migliore della posizione peggiore (${worstPosition.position.symbol})`,
                groupPositions: groupPositions.length,
                positionToClose: worstPosition.position.ticket_id,
                positionToCloseDetails: {
                    ticket_id: worstPosition.position.ticket_id,
                    symbol: worstPosition.position.symbol,
                    score: worstPosition.score,
                    pnlPct: worstPosition.pnlPct,
                    signalStrength: worstPosition.signalStrength
                },
                newSignalScore: newSignalScore.score
            };
        } else {
            console.log(`🛑 [SMART REPLACEMENT] Nuovo segnale ${symbol} (score: ${newSignalScore.score.toFixed(2)}) NON è migliore della posizione peggiore ${worstPosition.position.symbol} (score: ${worstPosition.score.toFixed(2)})`);
            console.log(`   → Mantengo posizioni esistenti, non apro nuova posizione`);

            return {
                allowed: false,
                reason: `Max ${maxTotalPositions} total positions. Nuovo segnale (score: ${newSignalScore.score.toFixed(2)}) NON migliore della posizione peggiore (score: ${worstPosition.score.toFixed(2)})`,
                groupPositions: groupPositions.length,
                worstPositionScore: worstPosition.score,
                newSignalScore: newSignalScore.score
            };
        }
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
        // ✅ FIX: updatePositionsPnL ora aggiorna TUTTE le posizioni, recuperando i prezzi da Binance
        await updatePositionsPnL();

        // 5. Get bot parameters for this symbol
        const params = await getBotParameters(symbol);
        const rsi = calculateRSI(priceHistory, params.rsi_period);

        // Update latest RSI for dashboard (only for bitcoin for backward compatibility)
        if (symbol === 'bitcoin') {
            latestRSI = rsi;
        }

        const tradingPair = SYMBOL_TO_PAIR[symbol] || symbol.toUpperCase();
        if (rsi) {
            // Bot status logging removed - too verbose
        }

        // ✅ FIX: Se bot è disattivo, aggiorna comunque i dati (klines) ma non processa segnali
        // Questo garantisce che i dati siano sempre freschi per l'analisi
        if (!isBotActive) {
            // Bot inactive logging removed
            return; // Aggiorna klines ma non processa segnali
        }

        if (!rsi) return; // Stop here if no RSI data

        // ✅ VOLUME FILTER - Evita coin illiquide (pump & dump, spread alti)
        const volume24h = await get24hVolume(symbol);
        const MIN_VOLUME = 500_000; // 500K EUR/USDT minimo (personalizzabile)

        if (volume24h < MIN_VOLUME) {
            console.log(`⚠️ [VOLUME-FILTER] ${symbol.toUpperCase()} skipped: Volume 24h €${volume24h.toLocaleString('it-IT', { maximumFractionDigits: 0 })} < €${MIN_VOLUME.toLocaleString('it-IT')}`);
            console.log(`   → Coin troppo illiquida. Rischio: spread alto, difficoltà chiusura posizioni, pump & dump.`);
            return; // Salta questo ciclo
        }

        // Volume filter OK logging removed

        // 6. RISK CHECK - Protezione PRIMA di tutto
        const riskCheck = await riskManager.calculateMaxRisk();

        if (!riskCheck.canTrade) {
            console.log(`🛑 RISK MANAGER: Trading blocked - ${riskCheck.reason}`);
            console.log(`   Daily Loss: ${(riskCheck.dailyLoss * 100).toFixed(2)}% | Exposure: ${(riskCheck.currentExposure * 100).toFixed(2)}% | Drawdown: ${(riskCheck.drawdown * 100).toFixed(2)}%`);
            return; // STOP - Non tradare se rischio troppo alto
        }

        // Risk manager OK logging removed

        // ✅ REFACTORING: Usa candele reali (15m) invece di price_history per segnali affidabili
        // 7. Carica ultime 100 candele complete 15m per analisi trend reali
        const timeframe = '15m'; // Timeframe principale per analisi
        const klinesData = await dbAll(
            `SELECT open_time, open_price, high_price, low_price, close_price, volume, close_time 
             FROM klines 
             WHERE symbol = ? AND interval = ? 
             ORDER BY open_time DESC 
             LIMIT 100`,
            [symbol, timeframe]
        );

        // Verifica se abbiamo candele sufficienti
        let signal;
        if (!klinesData || klinesData.length < 20) {
            console.log(`⚠️ BOT [${symbol.toUpperCase()}]: Insufficient klines data (${klinesData?.length || 0} < 20). Using price_history fallback.`);
            // Fallback a price_history se non ci sono abbastanza candele
            const priceHistoryData = await dbAll(
                "SELECT price, timestamp FROM price_history WHERE symbol = ? ORDER BY timestamp DESC LIMIT 50",
                [symbol]
            );
            const historyForSignal = priceHistoryData.reverse().map(row => ({
                price: row.price,
                timestamp: row.timestamp
            }));
            signal = signalGenerator.generateSignal(historyForSignal);
        } else {
            // Reverse to chronological order (oldest first)
            const klinesChronological = klinesData.reverse();

            // ✅ FIX CRITICO: Normalizza prezzi klines a USDT per evitare mismatch EUR/USDT
            // Verifica se le klines sono in EUR o USDT confrontando con prezzo corrente Binance
            const currentBinancePrice = await getSymbolPrice(symbol); // USDT
            const latestKlinePrice = parseFloat(klinesChronological[klinesChronological.length - 1]?.close_price || 0);

            // Se il prezzo più recente è significativamente diverso dal prezzo Binance, potrebbe essere in EUR
            // Tolleranza: se differenza > 10%, probabilmente è in EUR
            const priceDiff = latestKlinePrice > 0 ? Math.abs((currentBinancePrice - latestKlinePrice) / latestKlinePrice) : 0;
            const needsConversion = priceDiff > 0.10 && latestKlinePrice < currentBinancePrice * 0.9; // Se kline è ~10% più bassa, probabilmente EUR

            let conversionRate = 1.0;
            if (needsConversion) {
                try {
                    const usdtToEurRate = await getUSDTtoEURRate();
                    conversionRate = 1.0 / usdtToEurRate; // EUR → USDT
                    console.warn(`⚠️ [CURRENCY-FIX] ${symbol.toUpperCase()}: Klines sembrano in EUR (${latestKlinePrice.toFixed(4)} vs ${currentBinancePrice.toFixed(4)} USDT). Convertendo con rate ${conversionRate.toFixed(4)}`);
                } catch (rateError) {
                    console.error(`⚠️ [CURRENCY-FIX] Errore conversione per ${symbol}:`, rateError.message);
                    conversionRate = 1.08; // Fallback: 1 EUR = 1.08 USDT
                }
            }

            // Formatta come array di oggetti { close, high, low, volume, price } per signalGenerator
            const historyForSignal = klinesChronological.map(kline => ({
                close: parseFloat(kline.close_price) * conversionRate,  // ✅ Normalizza a USDT
                high: parseFloat(kline.high_price) * conversionRate,     // ✅ Normalizza a USDT
                low: parseFloat(kline.low_price) * conversionRate,        // ✅ Normalizza a USDT
                volume: parseFloat(kline.volume || 0),
                price: parseFloat(kline.close_price) * conversionRate,    // ✅ Normalizza a USDT
                open: parseFloat(kline.open_price) * conversionRate,       // ✅ Normalizza a USDT
                timestamp: kline.open_time
            }));

            // ✅ FILTRO VOLATILITÀ: Calcola ATR e blocca trade se volatilità anomala
            const highs = historyForSignal.map(k => k.high);
            const lows = historyForSignal.map(k => k.low);
            const closes = historyForSignal.map(k => k.close);
            const atr = signalGenerator.calculateATR(highs, lows, closes, 14);

            if (atr) {
                const currentPrice = historyForSignal[historyForSignal.length - 1].close;
                const atrPct = (atr / currentPrice) * 100; // ATR come % del prezzo

                // Blocca trade se volatilità troppo bassa (mercato piatto) o troppo alta (news event)
                const MIN_ATR_PCT = 0.2; // Minimo 0.2% ATR (abbassato per permettere trading in mercati meno volatili)
                const MAX_ATR_PCT = 5.0; // Massimo 5% ATR (evento improvviso, troppo rischioso)

                if (atrPct < MIN_ATR_PCT) {
                    console.log(`⚠️ BOT [${symbol.toUpperCase()}]: Trading blocked - ATR too low (${atrPct.toFixed(2)}% < ${MIN_ATR_PCT}%) - Market too flat`);
                    // ✅ FIX: NON fare return - continua il ciclo per aggiornare posizioni esistenti e dati
                    // Non apriamo nuove posizioni ma continuiamo ad aggiornare
                } else if (atrPct > MAX_ATR_PCT) {
                    console.log(`⚠️ BOT [${symbol.toUpperCase()}]: Trading blocked - ATR too high (${atrPct.toFixed(2)}% > ${MAX_ATR_PCT}%) - Possible news event`);
                    // ✅ FIX: NON fare return - continua il ciclo per aggiornare posizioni esistenti e dati
                    // Non apriamo nuove posizioni ma continuiamo ad aggiornare
                } else {
                    // ATR OK logging removed
                }
            }

            // ✅ FIX CRITICO: SEMPRE ricalcola segnali per evitare analisi bloccate
            // Rimossa cache per garantire analisi sempre aggiornate in tempo reale
            console.log(`🆕 BOT [${symbol.toUpperCase()}]: Recalculating signal from ${klinesData.length} klines (cache disabled for real-time updates)`);
            signal = signalGenerator.generateSignal(historyForSignal);

            // ✅ Salva timestamp per logging ma non bloccare ricalcolo
            const lastProcessedCandleKey = `lastProcessedCandle_${symbol}_${timeframe}`;
            const currentCandleOpenTime = calculateAlignedCandleTime(now, timeframe);
            global[lastProcessedCandleKey] = currentCandleOpenTime;

            // ✅ FIX: Salva info ATR nel segnale per verificare se trading è bloccato
            const currentPriceForATR = historyForSignal[historyForSignal.length - 1]?.close || currentPrice;
            if (atr && currentPriceForATR > 0) {
                const atrPct = (atr / currentPriceForATR) * 100;

                // ✅ SMART ATR FILTERING: Soglia dinamica basata sulla forza del segnale
                // Segnali FORTI (90-100%) → ATR minimo 0.2% (più permissivo)
                // Segnali NORMALI (70-89%) → ATR minimo 0.3% (standard, più sicuro)
                const MIN_ATR_FOR_STRONG_SIGNAL = 0.2; // Per segnali 90-100%
                const MIN_ATR_FOR_NORMAL_SIGNAL = 0.3; // Per segnali 70-89%
                const STRONG_SIGNAL_THRESHOLD = 90;

                const isStrongSignal = signal.strength >= STRONG_SIGNAL_THRESHOLD;
                const minAtrRequired = isStrongSignal ? MIN_ATR_FOR_STRONG_SIGNAL : MIN_ATR_FOR_NORMAL_SIGNAL;

                signal.atrBlocked = atrPct < minAtrRequired || atrPct > MAX_ATR_PCT;
                signal.atrPct = atrPct;
                signal.minAtrRequired = minAtrRequired; // Per logging

                if (signal.atrBlocked && atrPct < minAtrRequired) {
                    console.log(`⚠️ BOT [${symbol.toUpperCase()}]: ATR ${atrPct.toFixed(2)}% < ${minAtrRequired}% (${isStrongSignal ? 'STRONG' : 'NORMAL'} signal threshold)`);
                }
            } else {
                signal.atrBlocked = false; // Se non c'è ATR, non bloccare
            }
        }

        // ✅ LOGGING DETTAGLIATO per debug (dopo generazione segnale, sia da klines che fallback)
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

        // 9. Get ALL open positions (Fix for Hybrid Strategy)
        const allOpenPositions = await dbAll(
            "SELECT * FROM open_positions WHERE status = 'open'"
        );
        // Filter for current symbol
        const openPositions = allOpenPositions.filter(p => p.symbol === symbol);

        const longPositions = openPositions.filter(p => p.type === 'buy');
        const shortPositions = openPositions.filter(p => p.type === 'sell');

        console.log(`📊 OPEN POSITIONS: LONG=${longPositions.length} | SHORT=${shortPositions.length}`);

        // ✅ NUOVO: ADVANCED PRE-FILTERS - Controlli intelligenti prima di aprire
        // ==========================================
        // 10.1. PORTFOLIO DRAWDOWN PROTECTION
        // ==========================================
        let portfolioDrawdownBlock = false;
        let portfolioDrawdownReason = '';
        try {
            const portfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");
            if (portfolio) {
                const totalPnL = parseFloat(portfolio.total_pnl || 0);
                const balance = parseFloat(portfolio.balance_usd || 10000);
                const initialBalance = 1000; // Bilancio iniziale
                const portfolioPnLPct = balance > 0 ? ((balance - initialBalance) / initialBalance) * 100 : -100;

                // Calcola P&L medio posizioni aperte
                let avgOpenPnL = 0;
                if (allOpenPositions.length > 0) {
                    const totalOpenPnL = allOpenPositions.reduce((sum, p) => sum + (parseFloat(p.profit_loss_pct) || 0), 0);
                    avgOpenPnL = totalOpenPnL / allOpenPositions.length;
                }

                // Blocca se portfolio in drawdown significativo
                if (portfolioPnLPct < -5.0) {
                    portfolioDrawdownBlock = true;
                    portfolioDrawdownReason = `Portfolio drawdown troppo alto: ${portfolioPnLPct.toFixed(2)}% (soglia: -5%)`;
                } else if (avgOpenPnL < -2.0 && allOpenPositions.length >= 5) {
                    portfolioDrawdownBlock = true;
                    portfolioDrawdownReason = `P&L medio posizioni aperte troppo negativo: ${avgOpenPnL.toFixed(2)}% (soglia: -2%)`;
                }

                console.log(`📊 [PORTFOLIO-CHECK] P&L Portfolio: ${portfolioPnLPct.toFixed(2)}% | P&L Medio Aperte: ${avgOpenPnL.toFixed(2)}% | Block: ${portfolioDrawdownBlock}`);
            }
        } catch (e) {
            console.error('⚠️ Error checking portfolio drawdown:', e.message);
        }

        // ==========================================
        // 10.2. CONSECUTIVE LOSSES PROTECTION
        // ==========================================
        let consecutiveLossesBlock = false;
        let consecutiveLossesReason = '';
        try {
            const recentClosed = await dbAll(
                "SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken') ORDER BY closed_at DESC LIMIT 5"
            );
            if (recentClosed.length >= 3) {
                const last3 = recentClosed.slice(0, 3);
                const allNegative = last3.every(p => (parseFloat(p.profit_loss || 0)) < 0);
                if (allNegative) {
                    consecutiveLossesBlock = true;
                    consecutiveLossesReason = `Ultime 3 posizioni chiuse sono tutte negative - Richiedere strength >= 80`;
                    console.log(`🛑 [CONSECUTIVE-LOSSES] Blocco parziale: ultime 3 posizioni negative`);
                }
            }
        } catch (e) {
            console.error('⚠️ Error checking consecutive losses:', e.message);
        }

        // ==========================================
        // 10.3. MARKET REGIME DETECTION (BTC Trend)
        // ==========================================
        let marketRegimeBlock = false;
        let marketRegimeReason = '';
        try {
            const btcPrice = await getSymbolPrice('bitcoin');
            if (btcPrice > 0) {
                // Ottieni prezzo BTC 24h fa (approssimativo: usa price_history)
                const btcHistory = await dbAll(
                    "SELECT price FROM price_history WHERE symbol = 'bitcoin' ORDER BY timestamp DESC LIMIT 100"
                );
                if (btcHistory.length >= 50) {
                    const btcPrice24hAgo = parseFloat(btcHistory[49].price);
                    const btcChange24h = ((btcPrice - btcPrice24hAgo) / btcPrice24hAgo) * 100;

                    // Se BTC in downtrend forte, blocca LONG
                    if (signal.direction === 'LONG' && btcChange24h < -3.0) {
                        marketRegimeBlock = true;
                        marketRegimeReason = `BTC in downtrend forte (-${Math.abs(btcChange24h).toFixed(2)}%) - Mercato ribassista, bloccare LONG`;
                    }
                    // Se BTC in uptrend forte, blocca SHORT
                    if (signal.direction === 'SHORT' && btcChange24h > 3.0) {
                        marketRegimeBlock = true;
                        marketRegimeReason = `BTC in uptrend forte (+${btcChange24h.toFixed(2)}%) - Mercato rialzista, bloccare SHORT`;
                    }

                    console.log(`📊 [MARKET-REGIME] BTC 24h change: ${btcChange24h.toFixed(2)}% | Block: ${marketRegimeBlock}`);
                }
            }
        } catch (e) {
            console.error('⚠️ Error checking market regime:', e.message);
        }

        // ==========================================
        // 10.4. WIN RATE FILTER PER SIMBOLO
        // ==========================================
        let symbolWinRateAdjustment = 0; // Aggiustamento soglia strength
        let symbolWinRateReason = '';
        try {
            const symbolClosed = await dbAll(
                "SELECT * FROM open_positions WHERE symbol = ? AND status IN ('closed', 'stopped', 'taken') ORDER BY closed_at DESC LIMIT 20",
                [symbol]
            );
            if (symbolClosed.length >= 10) {
                const winning = symbolClosed.filter(p => (parseFloat(p.profit_loss || 0)) > 0).length;
                const winRate = winning / symbolClosed.length;

                // Se win rate < 40%, richiedere strength più alta
                if (winRate < 0.40) {
                    symbolWinRateAdjustment = 15; // Aumenta soglia di 15 punti
                    symbolWinRateReason = `Win rate simbolo ${symbol}: ${(winRate * 100).toFixed(1)}% (soglia: 40%) - Richiedere strength +15`;
                    console.log(`⚠️ [SYMBOL-WIN-RATE] ${symbol}: ${(winRate * 100).toFixed(1)}% win rate - Aumentando soglia strength`);
                }
            }
        } catch (e) {
            console.error('⚠️ Error checking symbol win rate:', e.message);
        }

        // ==========================================
        // 10.5. MOMENTUM REVERSAL DETECTION (BILANCIATO)
        // ==========================================
        let momentumAdjustment = 0; // Invece di bloccare, aumenta soglia
        let momentumReason = '';
        try {
            if (klinesData && klinesData.length >= 3) {
                const recentKlines = klinesData.slice(-3).reverse(); // Ultime 3 candele (più recenti)
                const closes = recentKlines.map(k => parseFloat(k.close_price));

                if (closes.length >= 3) {
                    const change1 = ((closes[1] - closes[0]) / closes[0]) * 100; // Cambio candela 1->2
                    const change2 = ((closes[2] - closes[1]) / closes[1]) * 100; // Cambio candela 2->3

                    // Per LONG: prezzo deve essere salito almeno 0.2% nelle ultime 2 candele (soglia più permissiva)
                    if (signal.direction === 'LONG') {
                        const totalRise = ((closes[2] - closes[0]) / closes[0]) * 100;
                        if (totalRise < 0.2 || change2 < -0.1) { // Permettiamo piccole fluttuazioni
                            momentumAdjustment = 5; // Aumenta soglia di 5 punti invece di bloccare
                            momentumReason = `Momentum debole per LONG: prezzo non sta salendo chiaramente (${totalRise.toFixed(2)}% totale) - Richiedere strength +5`;
                        }
                    }
                    // Per SHORT: prezzo deve essere sceso almeno 0.2% nelle ultime 2 candele
                    if (signal.direction === 'SHORT') {
                        const totalFall = ((closes[0] - closes[2]) / closes[2]) * 100;
                        if (totalFall < 0.2 || change2 > 0.1) {
                            momentumAdjustment = 5; // Aumenta soglia di 5 punti invece di bloccare
                            momentumReason = `Momentum debole per SHORT: prezzo non sta scendendo chiaramente (${totalFall.toFixed(2)}% totale) - Richiedere strength +5`;
                        }
                    }

                    console.log(`📊 [MOMENTUM] ${signal.direction}: Change1=${change1.toFixed(2)}%, Change2=${change2.toFixed(2)}% | Adjustment: +${momentumAdjustment}`);
                }
            }
        } catch (e) {
            console.error('⚠️ Error checking momentum:', e.message);
        }

        // ==========================================
        // 10.6. SUPPORT/RESISTANCE LEVEL CHECK (NON BLOCCANTE)
        // ==========================================
        let supportResistanceAdjustment = 0;
        let supportResistanceReason = '';
        try {
            if (klinesData && klinesData.length >= 20) {
                const prices = klinesData.map(k => parseFloat(k.close_price));
                const ema200 = signalGenerator.calculateEMA(prices, 200);
                const currentPriceValue = parseFloat(currentPrice);

                if (ema200 && currentPriceValue > 0) {
                    const distanceToEMA200 = Math.abs((currentPriceValue - ema200) / ema200) * 100;

                    // Se LONG e prezzo è vicino a EMA200 (resistenza) o sopra EMA200 ma vicino
                    if (signal.direction === 'LONG') {
                        if (currentPriceValue < ema200 && distanceToEMA200 < 2.0) {
                            supportResistanceAdjustment = 10; // Aumenta soglia di 10 punti
                            supportResistanceReason = `LONG vicino a resistenza EMA200 (${distanceToEMA200.toFixed(2)}% distanza) - Richiedere strength +10`;
                        }
                    }
                    // Se SHORT e prezzo è vicino a EMA200 (supporto) o sotto EMA200 ma vicino
                    if (signal.direction === 'SHORT') {
                        if (currentPriceValue > ema200 && distanceToEMA200 < 2.0) {
                            supportResistanceAdjustment = 10; // Aumenta soglia di 10 punti
                            supportResistanceReason = `SHORT vicino a supporto EMA200 (${distanceToEMA200.toFixed(2)}% distanza) - Richiedere strength +10`;
                        }
                    }

                    if (supportResistanceAdjustment > 0) {
                        console.log(`⚠️ [SUPPORT/RESISTANCE] ${supportResistanceReason}`);
                    }
                }
            }
        } catch (e) {
            console.error('⚠️ Error checking support/resistance:', e.message);
        }

        // ==========================================
        // 10.7. TIME-OF-DAY FILTER (OPZIONALE, NON BLOCCANTE)
        // ==========================================
        let timeOfDayAdjustment = 0;
        try {
            const now = new Date();
            const hourUTC = now.getUTCHours();
            const dayOfWeek = now.getUTCDay(); // 0 = Domenica, 6 = Sabato

            // Durante orari notturni (00:00-08:00 UTC) o weekend, aumenta leggermente la soglia
            if ((hourUTC >= 0 && hourUTC < 8) || dayOfWeek === 0 || dayOfWeek === 6) {
                timeOfDayAdjustment = 3; // Piccolo aumento (3 punti) invece di bloccare
                console.log(`🌙 [TIME-OF-DAY] Orario notturno/weekend (UTC ${hourUTC}:00, giorno ${dayOfWeek}) - Richiedere strength +3`);
            }
        } catch (e) {
            console.error('⚠️ Error checking time of day:', e.message);
        }

        // ==========================================
        // 10. DECISION LOGIC - Solo se segnale FORTISSIMO (90% certezza)
        // ==========================================
        // ✅ STRATEGY: 1000 posizioni piccole su analisi giuste > 1 posizione ogni tanto
        // Permettiamo MULTIPLE posizioni se il segnale è forte e il risk manager lo permette

        // ✅ ADAPTIVE SIGNAL STRENGTH: Adatta soglia in base a condizioni (BILANCIATO)
        let MIN_SIGNAL_STRENGTH = 70; // Soglia base (non troppo alta per permettere aperture)
        if (consecutiveLossesBlock) {
            MIN_SIGNAL_STRENGTH = 80; // Se ultime 3 posizioni negative, richiedere strength più alta
        }
        MIN_SIGNAL_STRENGTH += symbolWinRateAdjustment; // Aggiungi aggiustamento win rate simbolo
        MIN_SIGNAL_STRENGTH += momentumAdjustment; // Aggiungi aggiustamento momentum
        MIN_SIGNAL_STRENGTH += supportResistanceAdjustment; // Aggiungi aggiustamento support/resistance
        MIN_SIGNAL_STRENGTH += timeOfDayAdjustment; // Aggiungi aggiustamento time of day

        // ✅ CAP: Massimo 85 punti (non bloccare completamente)
        MIN_SIGNAL_STRENGTH = Math.min(85, MIN_SIGNAL_STRENGTH);

        // ✅ LOG DETTAGLIATO: Mostra cosa il bot sta aspettando
        const baseStrength = 70;
        const adjustments = [];
        if (consecutiveLossesBlock) adjustments.push(`Consecutive Losses: +10 (base 70→80)`);
        if (symbolWinRateAdjustment > 0) adjustments.push(`Win Rate Simbolo: +${symbolWinRateAdjustment}`);
        if (momentumAdjustment > 0) adjustments.push(`Momentum Debole: +${momentumAdjustment}`);
        if (supportResistanceAdjustment > 0) adjustments.push(`Support/Resistance: +${supportResistanceAdjustment}`);
        if (timeOfDayAdjustment > 0) adjustments.push(`Time-of-Day: +${timeOfDayAdjustment}`);

        // Position analysis logging removed - too verbose
        console.log(`🎯 Segnale: ${signal.direction} | Strength Attuale: ${signal.strength}/100 | Strength Richiesta: ${MIN_SIGNAL_STRENGTH}/100`);

        // Mostra dettaglio aggiustamenti
        if (adjustments.length > 0) {
            console.log(`   ⚙️  Aggiustamenti Applicati:`);
            adjustments.forEach(adj => console.log(`      • ${adj}`));
            // Threshold calculation logging removed
        } else {
            // Base threshold logging removed
        }

        // Mostra stato filtri
        console.log(`   🔍 Stato Filtri:`);
        // Filter status logging removed - too verbose

        // Mostra cosa sta aspettando
        if (signal.strength < MIN_SIGNAL_STRENGTH && signal.direction !== 'NEUTRAL') {
            const missing = MIN_SIGNAL_STRENGTH - signal.strength;
            console.log(`\n   ⏳ BOT IN ATTESA:`);
            console.log(`      🔴 Strength insufficiente: ${signal.strength} < ${MIN_SIGNAL_STRENGTH}`);
            // Missing points logging removed
            console.log(`      💡 Il bot aspetta che il segnale si rafforzi a ${MIN_SIGNAL_STRENGTH}+ prima di aprire`);
            if (adjustments.length > 0) {
                console.log(`      📝 Motivo soglia alta: ${adjustments.join(', ')}`);
            }
        } else if (signal.direction === 'NEUTRAL') {
            console.log(`\n   ⏳ BOT IN ATTESA:`);
            console.log(`      🔴 Segnale NEUTRAL - Nessun segnale valido rilevato`);
            console.log(`      💡 Il bot aspetta un segnale ${signal.strength >= 50 ? 'più forte' : 'valido'} (min ${MIN_SIGNAL_STRENGTH})`);
        } else {
            // Conditions satisfied logging removed
            console.log(`      🚀 Procedendo con valutazione apertura...`);
        }
        // Analysis separator logging removed

        // ✅ FIX: Non aprire posizioni se ATR blocca il trading
        if (signal.atrBlocked) {
            console.log(`\n🛑 [BLOCCATO] ${symbol.toUpperCase()}: Trading bloccato da filtro ATR (${signal.atrPct?.toFixed(2)}%)`);
            console.log(`   💡 Il bot aspetta che la volatilità rientri in range accettabile\n`);
            // Continua il ciclo per aggiornare posizioni esistenti
        } else if (portfolioDrawdownBlock) {
            console.log(`\n🛑 [BLOCCATO] ${symbol.toUpperCase()}: Trading bloccato - ${portfolioDrawdownReason}`);
            console.log(`   💡 Il bot aspetta che il portfolio si riprenda prima di aprire nuove posizioni\n`);
        } else if (marketRegimeBlock) {
            console.log(`\n🛑 [BLOCCATO] ${symbol.toUpperCase()}: Trading bloccato - ${marketRegimeReason}`);
            console.log(`   💡 Il bot aspetta che il trend BTC si allinei prima di aprire\n`);
        } else if (signal.direction === 'LONG' && signal.strength >= MIN_SIGNAL_STRENGTH) {
            // LONG approved logging removed
            // ✅ MULTI-TIMEFRAME CONFIRMATION (con sistema a punteggio)
            const trend1h = await detectTrendOnTimeframe(symbol, '1h', 50);
            const trend4h = await detectTrendOnTimeframe(symbol, '4h', 50);

            let mtfBonus = 0;
            let mtfReason = '';

            // Sistema a punteggio: bonus se allineati, malus se contrari
            if (trend1h === 'bullish' && trend4h === 'bullish') {
                mtfBonus = +10;
                mtfReason = '✅ All timeframes bullish (+10 strength)';
            } else if (trend1h === 'bullish' || trend4h === 'bullish') {
                mtfBonus = +5;
                mtfReason = '✅ Partial alignment (+5 strength)';
            } else if (trend1h === 'bearish' || trend4h === 'bearish') {
                mtfBonus = -15;
                mtfReason = '⚠️ Higher timeframe bearish (-15 strength)';
            } else {
                mtfBonus = 0;
                mtfReason = '➡️ Neutral timeframes (no bonus/malus)';
            }

            const adjustedStrength = signal.strength + mtfBonus;

            console.log(`📊 [MTF] LONG Check for ${symbol}: 15m=LONG(${signal.strength}) | 1h=${trend1h} | 4h=${trend4h}`);
            console.log(`   ${mtfReason} → Adjusted Strength: ${adjustedStrength}`);

            // Verifica se la strength aggiustata è ancora sufficiente
            if (adjustedStrength < MIN_SIGNAL_STRENGTH) {
                console.log(`🛑 [MTF] LONG BLOCKED: Adjusted strength ${adjustedStrength} < ${MIN_SIGNAL_STRENGTH} (1h=${trend1h}, 4h=${trend4h})`);
                console.log(`   → Waiting for higher timeframes to align or signal to strengthen`);
                // ✅ FIX: NON fare return - continua il ciclo per aggiornare posizioni esistenti e dati
            } else {

                console.log(`✅ [MTF] LONG APPROVED: Adjusted strength ${adjustedStrength} >= ${MIN_SIGNAL_STRENGTH}`);

                // ✅ HYBRID STRATEGY - Verifica limiti correlazione con LOGICA INTELLIGENTE
                // ✅ Passa il segnale per confronto con posizioni esistenti
                const hybridCheck = await canOpenPositionHybridStrategy(symbol, allOpenPositions, signal, 'buy');

                if (!hybridCheck.allowed) {
                    console.log(`🛑 [HYBRID-STRATEGY] LONG BLOCKED: ${hybridCheck.reason}`);
                    if (hybridCheck.worstPositionScore !== undefined) {
                        console.log(`   → Nuovo segnale (score: ${hybridCheck.newSignalScore?.toFixed(2)}) NON migliore della posizione peggiore (score: ${hybridCheck.worstPositionScore.toFixed(2)})`);
                    } else {
                        console.log(`   → Diversification protection: avoiding over-exposure to correlated assets`);
                    }
                    // ✅ FIX: NON fare return - continua il ciclo per aggiornare posizioni esistenti
                } else {
                    console.log(`✅ [HYBRID-STRATEGY] LONG APPROVED: ${hybridCheck.reason}`);

                    // ✅ LOGICA INTELLIGENTE: Se c'è una posizione da chiudere, chiudila PRIMA di aprire la nuova
                    if (hybridCheck.positionToClose) {
                        try {
                            const positionToClose = hybridCheck.positionToCloseDetails;
                            console.log(`🔄 [SMART REPLACEMENT] Chiudendo posizione ${positionToClose.symbol} (${positionToClose.ticket_id}) per aprire ${symbol}`);

                            const currentPriceToClose = await getSymbolPrice(positionToClose.symbol);
                            if (currentPriceToClose > 0) {
                                await closePosition(
                                    positionToClose.ticket_id,
                                    currentPriceToClose,
                                    `smart replacement (nuovo segnale ${symbol} migliore: score ${hybridCheck.newSignalScore.toFixed(2)} vs ${positionToClose.score.toFixed(2)})`
                                );
                                console.log(`✅ [SMART REPLACEMENT] Posizione ${positionToClose.symbol} chiusa. Procedendo con apertura ${symbol}`);
                            }
                        } catch (closeErr) {
                            console.error(`❌ [SMART REPLACEMENT] Errore chiusura posizione per replacement:`, closeErr.message);
                            // Se fallisce la chiusura, non aprire la nuova (evita superare limite)
                            return;
                        }
                    }

                    // Verifica se possiamo aprire LONG
                    // ✅ LOGICA OTTIMALE: Calcola dimensione posizione basata su maxExposure / maxPositions
                    // Esempio: $1000 USDT, maxExposure 80% = $800 USDT, maxPositions 10 → $800/10 = $80 USDT per posizione
                    const portfolio = await dbGet("SELECT balance_usd FROM portfolio WHERE id = 1");
                    const cashBalance = parseFloat(portfolio?.balance_usd || 0);

                    // Calcola totalEquity (cash + valore posizioni aperte)
                    const allOpenPos = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
                    let currentExposureValue = 0;
                    for (const pos of allOpenPos) {
                        const vol = parseFloat(pos.volume) || 0;
                        const volClosed = parseFloat(pos.volume_closed) || 0;
                        const remaining = vol - volClosed;
                        const entry = parseFloat(pos.entry_price) || 0;
                        currentExposureValue += remaining * entry;
                    }
                    const totalEquity = cashBalance + currentExposureValue;

                    // Calcola maxExposure e maxPositions
                    const dynamicLimits = await riskManager.getDynamicLimits();
                    const maxExposure = totalEquity * dynamicLimits.maxExposurePct; // Es. $1000 USDT * 80% = $800 USDT

                    // Calcola maxPositions basato su win rate
                    let maxTotalPositions = HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS;
                    try {
                        const stats = await dbGet("SELECT * FROM performance_stats WHERE id = 1");
                        if (stats && stats.total_trades >= 10) {
                            const winRate = stats.total_trades > 0 ? stats.winning_trades / stats.total_trades : 0.5;
                            maxTotalPositions = HYBRID_STRATEGY_CONFIG.getMaxPositionsForWinRate(winRate);
                        }
                    } catch (e) {
                        // Usa default
                    }

                    // ✅ FIXED POSITION SIZING: Usa dimensione dal RiskManager (minimo $80 USDT)
                    // Il RiskManager già calcola la dimensione ottimale (8% portfolio o $80 USDT minimo)
                    // Limitiamo solo all'exposure disponibile per non superare i limiti
                    const maxAvailableForNewPosition = Math.min(
                        riskCheck.maxPositionSize,  // $80 USDT minimo (o più se portfolio cresce)
                        riskCheck.availableExposure // Exposure disponibile (non superare limiti)
                    );

                    console.log(`📊 [POSITION-SIZE] Total Equity: $${totalEquity.toFixed(2)} USDT | Risk Manager Size: $${riskCheck.maxPositionSize.toFixed(2)} USDT | Available Exposure: $${riskCheck.availableExposure.toFixed(2)} USDT | Final: $${maxAvailableForNewPosition.toFixed(2)} USDT`);
                    const canOpen = await riskManager.canOpenPosition(maxAvailableForNewPosition);

                    console.log(`🔍 LONG SIGNAL CHECK: Strength=${adjustedStrength} (original: ${signal.strength}, MTF: ${mtfBonus >= 0 ? '+' : ''}${mtfBonus}) | Confirmations=${signal.confirmations} | CanOpen=${canOpen.allowed} | LongPositions=${longPositions.length} | AvailableExposure=$${riskCheck.availableExposure.toFixed(2)} USDT`);

                    // ✅ FIX: Rimuovo controllo longPositions.length === 0 - permetto multiple posizioni
                    if (canOpen.allowed) {
                        console.log(`✅ [BOT-OPEN-LONG] Opening position for ${symbol} - Price: $${currentPrice.toFixed(2)} USDT, Size: $${maxAvailableForNewPosition.toFixed(2)} USDT`);
                        // Apri LONG position
                        const amount = maxAvailableForNewPosition / currentPrice;
                        const stopLoss = currentPrice * (1 - params.stop_loss_pct / 100);
                        const takeProfit = currentPrice * (1 + params.take_profit_pct / 100);

                        const options = {
                            trailing_stop_enabled: params.trailing_stop_enabled || false,
                            trailing_stop_distance_pct: params.trailing_stop_distance_pct || 1.0,
                            partial_close_enabled: params.partial_close_enabled || false,
                            take_profit_1_pct: params.take_profit_1_pct || 1.5,
                            take_profit_2_pct: params.take_profit_2_pct || 3.0
                        };

                        // ✅ FIX: Salva dettagli segnale per analisi successiva
                        const signalDetails = JSON.stringify({
                            mtf: {
                                trend1h,
                                trend4h,
                                bonus: mtfBonus,
                                adjustedStrength
                            },
                            direction: signal.direction,
                            strength: signal.strength,
                            confirmations: signal.confirmations,
                            reasons: signal.reasons,
                            longSignal: signal.longSignal,
                            shortSignal: signal.shortSignal,
                            indicators: {
                                rsi: signal.indicators?.rsi,
                                trend: signal.indicators?.trend,
                                macd: signal.indicators?.macd ? {
                                    macdLine: signal.indicators.macd.macdLine,
                                    signalLine: signal.indicators.macd.signalLine,
                                    histogram: signal.indicators.macd.histogram
                                } : null
                            }
                        });


                        await openPosition(symbol, 'buy', amount, currentPrice, `LONG Signal (${signal.strength}/100)`, stopLoss, takeProfit, {
                            ...options,
                            signal_details: signalDetails,
                            trailing_stop_enabled: true,
                            trailing_stop_distance_pct: 1.5 // Trailing stop a 1.5% dal massimo raggiunto
                        });
                        console.log(`✅ BOT LONG: Opened position #${longPositions.length + 1} @ $${currentPrice.toFixed(2)} USDT | Size: $${maxAvailableForNewPosition.toFixed(2)} USDT | Signal: ${signal.reasons.join(', ')}`);
                        riskManager.invalidateCache(); // Invalida cache dopo operazione
                    } else if (!canOpen.allowed) {
                        console.log(`⚠️ BOT LONG: Cannot open - ${canOpen.reason} | Current exposure: ${(riskCheck.currentExposure * 100).toFixed(2)}% | Available: $${riskCheck.availableExposure.toFixed(2)} USDT`);
                    }
                }
            }
        }
        else if (!signal.atrBlocked && !portfolioDrawdownBlock && !marketRegimeBlock && signal.direction === 'SHORT' && signal.strength >= MIN_SIGNAL_STRENGTH) {
            // SHORT approved logging removed
            console.log(`   📊 [SHORT-DEBUG] Symbol: ${symbol} | Signal Strength: ${signal.strength} | MIN_SIGNAL_STRENGTH: ${MIN_SIGNAL_STRENGTH}`);
            console.log(`   📊 [SHORT-DEBUG] ATR Blocked: ${signal.atrBlocked} | Portfolio Drawdown Block: ${portfolioDrawdownBlock} | Market Regime Block: ${marketRegimeBlock}`);
            console.log(`   📊 [SHORT-DEBUG] RSI: ${signal.indicators?.rsi?.toFixed(2) || 'N/A'} | Trend: ${signal.indicators?.trend || 'N/A'}`);
            // ✅ COMPATIBILITÀ BINANCE: Verifica se SHORT è supportato
            // Binance Spot NON supporta short - serve Futures o Margin
            const binanceMode = process.env.BINANCE_MODE || 'demo';
            const supportsShort = binanceMode === 'demo' || process.env.BINANCE_SUPPORTS_SHORT === 'true'; // ✅ FIX: Demo mode supporta sempre SHORT

            // ✅ FIX CRITICO: Se SHORT non è supportato, salta tutto il blocco SHORT ma continua il ciclo
            // In DEMO mode, simuliamo sempre che lo short sia supportato per testare la strategia
            const isDemo = binanceMode === 'demo';

            if (!isDemo && (binanceMode === 'live' || binanceMode === 'testnet') && !supportsShort) {
                console.log(`⚠️ SHORT signal ignorato per ${symbol}: Binance Spot non supporta short.`);
                console.log(`   Per usare SHORT, configura BINANCE_SUPPORTS_SHORT=true e usa Binance Futures.`);
                console.log(`   Oppure disabilita SHORT per usare solo LONG (raccomandato per principianti).`);
                // ✅ FIX: NON fare return - il ciclo continua per aggiornare posizioni esistenti e processare altri segnali
                // Il bot deve continuare a funzionare anche se SHORT non è supportato
            } else {
                // ✅ FIX: Solo se SHORT è supportato (DEMO o Futures), procedi con l'apertura SHORT

                // ✅ MULTI-TIMEFRAME CONFIRMATION (con sistema a punteggio)
                const trend1h = await detectTrendOnTimeframe(symbol, '1h', 50);
                const trend4h = await detectTrendOnTimeframe(symbol, '4h', 50);

                let mtfBonus = 0;
                let mtfReason = '';

                // Sistema a punteggio: bonus se allineati, malus se contrari
                if (trend1h === 'bearish' && trend4h === 'bearish') {
                    mtfBonus = +10;
                    mtfReason = '✅ All timeframes bearish (+10 strength)';
                } else if (trend1h === 'bearish' || trend4h === 'bearish') {
                    mtfBonus = +5;
                    mtfReason = '✅ Partial alignment (+5 strength)';
                } else if (trend1h === 'bullish' || trend4h === 'bullish') {
                    mtfBonus = -15;
                    mtfReason = '⚠️ Higher timeframe bullish (-15 strength)';
                } else {
                    mtfBonus = 0;
                    mtfReason = '➡️ Neutral timeframes (no bonus/malus)';
                }

                const adjustedStrength = signal.strength + mtfBonus;

                console.log(`📊 [MTF] SHORT Check for ${symbol}: 15m=SHORT(${signal.strength}) | 1h=${trend1h} | 4h=${trend4h}`);
                console.log(`   ${mtfReason} → Adjusted Strength: ${adjustedStrength}`);

                // Verifica se la strength aggiustata è ancora sufficiente
                if (adjustedStrength < MIN_SIGNAL_STRENGTH) {
                    console.log(`🛑 [MTF] SHORT BLOCKED: Adjusted strength ${adjustedStrength} < ${MIN_SIGNAL_STRENGTH} (1h=${trend1h}, 4h=${trend4h})`);
                    console.log(`   → Waiting for higher timeframes to align or signal to strengthen`);
                    console.log(`   📊 [SHORT-DEBUG] Original strength: ${signal.strength} | MTF bonus: ${mtfBonus} | Adjusted: ${adjustedStrength} | Required: ${MIN_SIGNAL_STRENGTH}`);
                    // ✅ FIX: NON fare return - continua il ciclo per aggiornare posizioni esistenti e dati
                } else {

                    console.log(`✅ [MTF] SHORT APPROVED: Adjusted strength ${adjustedStrength} >= ${MIN_SIGNAL_STRENGTH}`);

                    // ✅ HYBRID STRATEGY - Verifica limiti correlazione con LOGICA INTELLIGENTE
                    // ✅ Passa il segnale per confronto con posizioni esistenti
                    const hybridCheck = await canOpenPositionHybridStrategy(symbol, allOpenPositions, signal, 'sell');

                    if (!hybridCheck.allowed) {
                        console.log(`🛑 [HYBRID-STRATEGY] SHORT BLOCKED: ${hybridCheck.reason}`);
                        console.log(`   📊 [SHORT-DEBUG] Hybrid check failed for ${symbol}`);
                        if (hybridCheck.worstPositionScore !== undefined) {
                            console.log(`   → Nuovo segnale (score: ${hybridCheck.newSignalScore?.toFixed(2)}) NON migliore della posizione peggiore (score: ${hybridCheck.worstPositionScore.toFixed(2)})`);
                        } else {
                            console.log(`   → Diversification protection: avoiding over-exposure to correlated assets`);
                        }
                        // ✅ FIX: NON fare return - continua il ciclo per aggiornare posizioni esistenti
                    } else {
                        console.log(`✅ [HYBRID-STRATEGY] SHORT APPROVED: ${hybridCheck.reason}`);

                        // ✅ LOGICA INTELLIGENTE: Se c'è una posizione da chiudere, chiudila PRIMA di aprire la nuova
                        if (hybridCheck.positionToClose) {
                            try {
                                const positionToClose = hybridCheck.positionToCloseDetails;
                                console.log(`🔄 [SMART REPLACEMENT] Chiudendo posizione ${positionToClose.symbol} (${positionToClose.ticket_id}) per aprire ${symbol}`);

                                const currentPriceToClose = await getSymbolPrice(positionToClose.symbol);
                                if (currentPriceToClose > 0) {
                                    await closePosition(
                                        positionToClose.ticket_id,
                                        currentPriceToClose,
                                        `smart replacement (nuovo segnale ${symbol} migliore: score ${hybridCheck.newSignalScore.toFixed(2)} vs ${positionToClose.score.toFixed(2)})`
                                    );
                                    console.log(`✅ [SMART REPLACEMENT] Posizione ${positionToClose.symbol} chiusa. Procedendo con apertura ${symbol}`);
                                }
                            } catch (closeErr) {
                                console.error(`❌ [SMART REPLACEMENT] Errore chiusura posizione per replacement:`, closeErr.message);
                                // Se fallisce la chiusura, non aprire la nuova (evita superare limite)
                                return;
                            }
                        }

                        // Verifica se possiamo aprire SHORT
                        // ✅ FIX: Calcola position size considerando posizioni già aperte (per permettere multiple)
                        // ✅ LOGICA OTTIMALE: Calcola dimensione posizione basata su maxExposure / maxPositions
                        // Stessa logica di LONG: $1000 USDT, maxExposure 80% = $800 USDT, maxPositions 10 → $800/10 = $80 USDT
                        const portfolio = await dbGet("SELECT balance_usd FROM portfolio WHERE id = 1");
                        const cashBalance = parseFloat(portfolio?.balance_usd || 0);

                        // Calcola totalEquity (cash + valore posizioni aperte)
                        const allOpenPos = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
                        let currentExposureValue = 0;
                        for (const pos of allOpenPos) {
                            const vol = parseFloat(pos.volume) || 0;
                            const volClosed = parseFloat(pos.volume_closed) || 0;
                            const remaining = vol - volClosed;
                            const entry = parseFloat(pos.entry_price) || 0;
                            currentExposureValue += remaining * entry;
                        }
                        const totalEquity = cashBalance + currentExposureValue;

                        // Calcola maxExposure e maxPositions
                        const dynamicLimits = await riskManager.getDynamicLimits();
                        const maxExposure = totalEquity * dynamicLimits.maxExposurePct; // Es. $1000 USDT * 80% = $800 USDT

                        // Calcola maxPositions basato su win rate
                        let maxTotalPositions = HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS;
                        try {
                            const stats = await dbGet("SELECT * FROM performance_stats WHERE id = 1");
                            if (stats && stats.total_trades >= 10) {
                                const winRate = stats.total_trades > 0 ? stats.winning_trades / stats.total_trades : 0.5;
                                maxTotalPositions = HYBRID_STRATEGY_CONFIG.getMaxPositionsForWinRate(winRate);
                            }
                        } catch (e) {
                            // Usa default
                        }

                        // ✅ FIXED POSITION SIZING: Usa dimensione dal RiskManager (minimo $80 USDT)
                        // Il RiskManager già calcola la dimensione ottimale (8% portfolio o $80 USDT minimo)
                        // Limitiamo solo all'exposure disponibile per non superare i limiti
                        const maxAvailableForNewPosition = Math.min(
                            riskCheck.maxPositionSize,  // $80 USDT minimo (o più se portfolio cresce)
                            riskCheck.availableExposure // Exposure disponibile (non superare limiti)
                        );

                        console.log(`📊 [SHORT-POSITION-SIZE] Total Equity: $${totalEquity.toFixed(2)} USDT | Risk Manager Size: $${riskCheck.maxPositionSize.toFixed(2)} USDT | Available Exposure: $${riskCheck.availableExposure.toFixed(2)} USDT | Final: $${maxAvailableForNewPosition.toFixed(2)} USDT`);
                        const canOpen = await riskManager.canOpenPosition(maxAvailableForNewPosition);

                        console.log(`🔍 SHORT SIGNAL CHECK: Strength=${adjustedStrength} (original: ${signal.strength}, MTF: ${mtfBonus >= 0 ? '+' : ''}${mtfBonus}) | Confirmations=${signal.confirmations} | CanOpen=${canOpen.allowed} | ShortPositions=${shortPositions.length} | AvailableExposure=$${riskCheck.availableExposure.toFixed(2)} USDT`);

                        // ✅ FIX: Rimuovo controllo shortPositions.length === 0 - permetto multiple posizioni
                        if (canOpen.allowed) {
                            console.log(`✅ [BOT-OPEN-SHORT] Opening position for ${symbol} - Price: $${currentPrice.toFixed(2)} USDT, Size: $${maxAvailableForNewPosition.toFixed(2)} USDT`);
                            // Apri SHORT position
                            const amount = maxAvailableForNewPosition / currentPrice;
                            const stopLoss = currentPrice * (1 + params.stop_loss_pct / 100); // Per SHORT, SL è sopra
                            const takeProfit = currentPrice * (1 - params.take_profit_pct / 100); // Per SHORT, TP è sotto

                            const options = {
                                trailing_stop_enabled: params.trailing_stop_enabled || false,
                                trailing_stop_distance_pct: params.trailing_stop_distance_pct || 1.0,
                                partial_close_enabled: params.partial_close_enabled || false,
                                take_profit_1_pct: params.take_profit_1_pct || 1.5,
                                take_profit_2_pct: params.take_profit_2_pct || 3.0
                            };

                            // ✅ FIX: Salva dettagli segnale per analisi successiva
                            const signalDetails = JSON.stringify({
                                mtf: {
                                    trend1h,
                                    trend4h,
                                    bonus: mtfBonus,
                                    adjustedStrength
                                },
                                direction: signal.direction,
                                strength: signal.strength,
                                confirmations: signal.confirmations,
                                reasons: signal.reasons,
                                longSignal: signal.longSignal,
                                shortSignal: signal.shortSignal,
                                indicators: {
                                    rsi: signal.indicators?.rsi,
                                    trend: signal.indicators?.trend,
                                    macd: signal.indicators?.macd ? {
                                        macdLine: signal.indicators.macd.macdLine,
                                        signalLine: signal.indicators.macd.signalLine,
                                        histogram: signal.indicators.macd.histogram
                                    } : null
                                }
                            });


                            await openPosition(symbol, 'sell', amount, currentPrice, `SHORT Signal (${signal.strength}/100)`, stopLoss, takeProfit, {
                                ...options,
                                signal_details: signalDetails,
                                trailing_stop_enabled: true,
                                trailing_stop_distance_pct: 1.5 // Trailing stop a 1.5% dal minimo raggiunto
                            });
                            console.log(`✅ BOT SHORT: Opened position #${shortPositions.length + 1} @ $${currentPrice.toFixed(2)} USDT | Size: $${maxAvailableForNewPosition.toFixed(2)} USDT | Signal: ${signal.reasons.join(', ')}`);
                            riskManager.invalidateCache(); // Invalida cache dopo operazione
                        } else if (!canOpen.allowed) {
                            console.log(`⚠️ BOT SHORT: Cannot open - ${canOpen.reason} | Current exposure: ${(riskCheck.currentExposure * 100).toFixed(2)}% | Available: $${riskCheck.availableExposure.toFixed(2)} USDT`);
                            console.log(`   📊 [SHORT-DEBUG] Risk check failed for ${symbol}: ${canOpen.reason}`);
                            console.log(`   📊 [SHORT-DEBUG] Max available for new position: $${maxAvailableForNewPosition.toFixed(2)} USDT | Trade size: $${params.trade_size_usdt || params.trade_size_eur || 0} USDT | Max position size: $${riskCheck.maxPositionSize.toFixed(2)} USDT`);
                        }
                    }
                }
            } // ✅ FIX: Chiude il blocco else per SHORT supportato
        } // ✅ FIX: Chiude il blocco else if per SHORT
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
        console.error(`❌ Bot Cycle Error for ${symbol}:`, error.message);
        console.error(error.stack);
    }
};

// Main Bot Loop Function - Iterates over all active symbols
const runBotCycle = async () => {
    try {
        // Get all active bots
        const activeBots = await dbAll(
            "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND is_active = 1"
        );

        if (activeBots.length === 0) {
            // No active bots, but we still want to update prices for monitoring
            // Update price for bitcoin at least (for backward compatibility)
            const currentPrice = await getSymbolPrice('bitcoin');
            if (currentPrice > 0) {
                await dbRun("INSERT INTO price_history (symbol, price) VALUES (?, ?)", ['bitcoin', currentPrice]);
            }
            return;
        }

        // ✅ FIX: Aggiorna dati anche per simboli senza entry in bot_settings (per Market Scanner)
        // Questo garantisce che i dati siano sempre freschi anche se il bot non è attivo per quel simbolo
        const allScannedSymbols = new Set(activeBots.map(b => b.symbol));

        // Lista simboli comuni da scansionare (per aggiornare dati anche se bot non attivo)
        const commonSymbols = ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 'chainlink',
            'litecoin', 'ripple', 'binance_coin', 'dogecoin', 'shiba', 'mana', 'eos'];

        // Aggiungi simboli comuni che non sono già nella lista attiva
        for (const symbol of commonSymbols) {
            if (!allScannedSymbols.has(symbol)) {
                // Crea entry temporanea con bot disattivato solo per aggiornare dati
                const tempBotSettings = { symbol, is_active: 0 };
                // Aggiorna solo i dati (klines) senza processare segnali
                try {
                    const currentPrice = await getSymbolPrice(symbol);
                    if (currentPrice > 0) {
                        // Aggiorna solo klines, non processare segnali (bot disattivo)
                        await runBotCycleForSymbol(symbol, tempBotSettings);
                    }
                } catch (err) {
                    // Ignora errori per simboli non disponibili
                }
            }
        }

        // Run bot cycle for each active symbol (processa segnali solo per bot attivi)
        for (const bot of activeBots) {
            await runBotCycleForSymbol(bot.symbol, bot);
        }
    } catch (error) {
        console.error('❌ Main Bot Cycle Error:', error.message);
        console.error(error.stack);
    }
};

// Helper to open a position (used by bot)
// ✅ COMPATIBILE CON BINANCE REALE: Struttura pronta per integrazione
const openPosition = async (symbol, type, volume, entryPrice, strategy, stopLoss = null, takeProfit = null, options = {}) => {
    try {
        // ✅ FIX CRITICO: Se il simbolo termina con _eur, il prezzo passato potrebbe essere già in USDT (da getSymbolPrice)
        // Ma per sicurezza, verifichiamo se il prezzo sembra in EUR e convertiamo se necessario
        const tradingPair = SYMBOL_TO_PAIR[symbol] || 'BTCUSDT';
        const isEURPair = tradingPair.endsWith('EUR') || symbol.endsWith('_eur');
        const EUR_TO_USDT_RATE = 1.08; // Tasso approssimativo EUR → USDT

        if (isEURPair && entryPrice > 0) {
            // ✅ FIX: getSymbolPrice dovrebbe già restituire USDT (convertito), ma verifichiamo
            // Se entryPrice sembra troppo basso rispetto al prezzo attuale, potrebbe essere ancora in EUR
            try {
                const currentUSDTPrice = await getSymbolPrice(symbol); // Questo dovrebbe essere già in USDT
                if (currentUSDTPrice > 0) {
                    const priceRatio = entryPrice / currentUSDTPrice;
                    // Se entryPrice è molto più basso di currentUSDTPrice (>15% differenza), probabilmente è in EUR
                    if (priceRatio < 0.85) {
                        // Probabilmente entryPrice è in EUR, converti a USDT
                        const originalPrice = entryPrice;
                        entryPrice = entryPrice * EUR_TO_USDT_RATE;
                        console.log(`💱 [OPEN POSITION] ${symbol}: entryPrice sembra in EUR (${originalPrice.toFixed(6)}), convertito a USDT: $${entryPrice.toFixed(6)} (current: $${currentUSDTPrice.toFixed(6)})`);

                        // Converti anche stop loss e take profit se presenti
                        if (stopLoss) stopLoss = stopLoss * EUR_TO_USDT_RATE;
                        if (takeProfit) takeProfit = takeProfit * EUR_TO_USDT_RATE;
                    } else {
                        // entryPrice sembra già in USDT (è vicino a currentUSDTPrice)
                        console.log(`✅ [OPEN POSITION] ${symbol}: entryPrice già in USDT: $${entryPrice.toFixed(6)} (current: $${currentUSDTPrice.toFixed(6)})`);
                    }
                }
            } catch (priceError) {
                // Se non riesco a verificare, applico conversione per sicurezza se sembra EUR
                console.warn(`⚠️ [OPEN POSITION] ${symbol}: Impossibile verificare prezzo, applico conversione EUR→USDT per sicurezza`);
                const originalPrice = entryPrice;
                entryPrice = entryPrice * EUR_TO_USDT_RATE;
                console.log(`💱 [OPEN POSITION] ${symbol}: Convertito EUR → USDT: €${originalPrice.toFixed(6)} → $${entryPrice.toFixed(6)} USDT`);

                if (stopLoss) stopLoss = stopLoss * EUR_TO_USDT_RATE;
                if (takeProfit) takeProfit = takeProfit * EUR_TO_USDT_RATE;
            }
        }

        // ✅ FIX CRITICO: Verifica che entryPrice sia ragionevole (in USDT)
        // Se entryPrice sembra troppo alto (es. > 100000), potrebbe essere un errore
        const MAX_REASONABLE_ENTRY_PRICE = 100000; // 100k USDT max per qualsiasi crypto
        if (entryPrice > MAX_REASONABLE_ENTRY_PRICE) {
            console.error(`🚨 [OPEN POSITION] entryPrice anomale per ${symbol}: $${entryPrice.toLocaleString()} USDT`);
            console.error(`   → Verifico prezzo corretto...`);

            // Prova a recuperare il prezzo corretto
            try {
                const correctPrice = await getSymbolPrice(symbol);
                if (correctPrice > 0 && correctPrice <= MAX_REASONABLE_ENTRY_PRICE) {
                    console.log(`✅ [OPEN POSITION] Prezzo corretto recuperato: $${correctPrice.toFixed(6)} USDT (era $${entryPrice.toFixed(6)})`);
                    entryPrice = correctPrice;
                } else {
                    throw new Error(`Prezzo corretto non disponibile o ancora anomale ($${correctPrice} USDT)`);
                }
            } catch (priceError) {
                console.error(`❌ [OPEN POSITION] Errore recupero prezzo corretto:`, priceError.message);
                throw new Error(`Impossibile aprire posizione per ${symbol}: entryPrice anomale ($${entryPrice.toLocaleString()} USDT) e impossibile recuperare prezzo corretto`);
            }
        }

        // ✅ TODO BINANCE REALE: Quando si passa a Binance reale, aggiungere qui:
        // const { getBinanceClient, isBinanceAvailable } = require('../utils/binanceConfig');
        // if (isBinanceAvailable()) {
        //     const binanceClient = getBinanceClient();
        //     const tradingPair = SYMBOL_TO_PAIR[symbol] || 'BTCEUR';
        //     try {
        //         const order = await binanceClient.placeMarketOrder(
        //             tradingPair,
        //             type === 'buy' ? 'BUY' : 'SELL',
        //             volume
        //         );
        //         entryPrice = order.price; // Usa prezzo reale di esecuzione
        //         volume = order.quantity; // Usa quantità reale eseguita
        //         console.log(`✅ Ordine Binance eseguito: ${order.orderId} @ €${entryPrice.toFixed(2)}`);
        //     } catch (binanceError) {
        //         console.error(`❌ Errore ordine Binance:`, binanceError.message);
        //         throw new Error(`Ordine Binance fallito: ${binanceError.message}`);
        //     }
        // }

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
            console.log(`💵 LONG OPEN: Balance ${balanceBefore.toFixed(2)} → ${balance.toFixed(2)} (-$${cost.toFixed(2)} USDT) | Holdings: ${holdings[symbol].toFixed(8)}`);
            console.log(`   📊 [BALANCE LOGIC] Capitale investito: $${cost.toFixed(2)} USDT, Capitale disponibile ora: $${balance.toFixed(2)} USDT`);
        } else {
            // ✅ FIX CRITICO: Short position - ricevi denaro ma NON toccare holdings
            // In uno SHORT vendi allo scoperto (non possiedi la crypto), quindi holdings NON cambiano
            balance += cost;
            // holdings[symbol] NON DEVE CAMBIARE all'apertura di uno SHORT
            console.log(`💵 SHORT OPEN: Balance ${balanceBefore.toFixed(2)} → ${balance.toFixed(2)} (+$${cost.toFixed(2)} USDT) | Holdings: ${holdings[symbol] || 0} (unchanged - short position)`);
            console.log(`   📊 [BALANCE LOGIC] Capitale ricevuto da SHORT: $${cost.toFixed(2)} USDT, Capitale disponibile ora: $${balance.toFixed(2)} USDT`);
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

        // ✅ FIX: Estrai signal_details dalle options se presente
        const signalDetails = options.signal_details || null;

        await dbRun(
            `INSERT INTO open_positions 
            (ticket_id, symbol, type, volume, entry_price, current_price, stop_loss, take_profit, strategy, status,
             trailing_stop_enabled, trailing_stop_distance_pct, highest_price,
             take_profit_1, take_profit_2, signal_details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`,
            [ticketId, symbol, type, volume, entryPrice, entryPrice, stopLoss, takeProfit, strategy || 'Bot',
                trailingStopEnabled, trailingStopDistance, entryPrice, takeProfit1, takeProfit2, signalDetails]
        );

        await dbRun(
            "INSERT INTO trades (symbol, type, amount, price, strategy) VALUES (?, ?, ?, ?, ?)",
            [symbol, type, volume, entryPrice, strategy || 'Bot Open']
        );

        // ✅ TODO BINANCE REALE: Quando si passa a Binance reale, creare ordini stop-loss/take-profit reali:
        // if (isBinanceAvailable() && stopLoss) {
        //     const tradingPair = SYMBOL_TO_PAIR[symbol] || 'BTCEUR';
        //     try {
        //         await binanceClient.placeStopLossOrder(
        //             tradingPair,
        //             type === 'buy' ? 'SELL' : 'BUY',
        //             volume,
        //             stopLoss
        //         );
        //         console.log(`✅ Stop-Loss ordine creato su Binance: €${stopLoss.toFixed(2)}`);
        //     } catch (slError) {
        //         console.error(`⚠️ Errore creazione stop-loss su Binance:`, slError.message);
        //         // Continua comunque, il bot gestirà lo stop-loss
        //     }
        // }

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

        // Send email notification
        sendCryptoEmail('position_opened', {
            type,
            symbol,
            entry_price: entryPrice,
            volume,
            stop_loss: stopLoss,
            take_profit: takeProfit,
            timestamp: new Date().toISOString(),
            signal_details: signalDetails ? JSON.parse(signalDetails) : null
        }).catch(err => console.error('Email notification error:', err));

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

/**
 * Calculate Average True Range (ATR) for dynamic trailing stop
 * @param {Array} klines - Array of OHLC klines data
 * @param {number} period - ATR period (default 14)
 * @returns {number} ATR value
 */
const calculateATR = (klines, period = 14) => {
    if (!klines || klines.length < period + 1) {
        return 0;
    }

    let atrSum = 0;
    const startIndex = Math.max(0, klines.length - period - 1);

    for (let i = startIndex + 1; i < klines.length; i++) {
        const high = parseFloat(klines[i].high_price);
        const low = parseFloat(klines[i].low_price);
        const prevClose = parseFloat(klines[i - 1].close_price);

        // True Range = max(high-low, |high-prevClose|, |low-prevClose|)
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        atrSum += tr;
    }

    return atrSum / period;
};

/**
 * Calculate dynamic trailing stop distance based on ATR
 * @param {number} atr - Average True Range
 * @param {number} currentPrice - Current asset price
 * @param {number} multiplier - ATR multiplier (default 1.5)
 * @returns {number} Dynamic trailing stop distance percentage
 */
const calculateDynamicTrailingDistance = (atr, currentPrice, multiplier = 1.5) => {
    if (!atr || !currentPrice || currentPrice === 0) {
        return 1.5; // Fallback to default 1.5%
    }

    // Convert ATR to percentage of current price
    const atrPct = (atr / currentPrice) * 100;

    // Apply multiplier and clamp between 0.5% and 3%
    const dynamicDistance = Math.max(0.5, Math.min(3.0, atrPct * multiplier));

    return dynamicDistance;
};


// Helper to update P&L for all open positions
// ✅ FIX: updatePositionsPnL ora aggiorna P&L per TUTTE le posizioni aperte, recuperando il prezzo corrente per ciascuna
// ✅ FIX CRITICO: currentPrice è SEMPRE in USDT (da getSymbolPrice) per match con TradingView
// ✅ MIGRAZIONE POSTGRESQL: Convertito da db.all() a dbAll()
const updatePositionsPnL = async (currentPrice = null, symbol = null) => {
    try {
        // ✅ FIX CRITICO: Recupera TUTTE le posizioni aperte, non solo quelle del simbolo corrente
        const positions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");

        // ✅ FIX CRITICO: Valida che currentPrice sia ragionevole (in USDT)
        const MAX_REASONABLE_USDT_PRICE = 200000; // BTC può essere ~100k USDT, ma con margine

        for (const pos of positions) {
            // ✅ FIX CRITICO: Recupera il prezzo corrente per questa posizione da Binance
            let currentPrice = null;
            try {
                currentPrice = await getSymbolPrice(pos.symbol);
                if (!currentPrice || currentPrice <= 0) {
                    console.warn(`⚠️ [UPDATE P&L] Impossibile recuperare prezzo per ${pos.symbol}, uso prezzo dal database`);
                    currentPrice = parseFloat(pos.current_price) || 0;
                }
            } catch (priceError) {
                console.error(`❌ [UPDATE P&L] Errore recupero prezzo per ${pos.symbol}:`, priceError.message);
                // Usa il prezzo dal database come fallback
                currentPrice = parseFloat(pos.current_price) || 0;
            }

            // Valida che currentPrice sia ragionevole
            if (currentPrice > MAX_REASONABLE_USDT_PRICE && pos.symbol !== 'bitcoin') {
                console.error(`🚨 [UPDATE P&L] currentPrice ${currentPrice} seems too high for ${pos.symbol}, might be an error!`);
                // Usa il prezzo dal database come fallback
                currentPrice = parseFloat(pos.current_price) || 0;
            }

            if (currentPrice <= 0) {
                console.warn(`⚠️ [UPDATE P&L] Prezzo non valido per ${pos.symbol} (${currentPrice}), salto questa posizione`);
                continue; // Salta questa posizione se il prezzo non è valido
            }

            let entryPrice = parseFloat(pos.entry_price);

            // ✅ FIX CRITICO: Rileva e converte entry_price da EUR a USDT se necessario
            // Se entry_price è significativamente più basso di currentPrice (>15% differenza),
            // probabilmente è in EUR e va convertito
            const priceRatio = entryPrice > 0 ? currentPrice / entryPrice : 0;
            const EUR_TO_USDT_RATE = 1.08; // Tasso approssimativo

            if (priceRatio > 1.15 && entryPrice < currentPrice * 0.85) {
                // Probabilmente entry_price è in EUR, converti a USDT
                const convertedEntryPrice = entryPrice * EUR_TO_USDT_RATE;
                console.warn(`⚠️ [CURRENCY-FIX] ${pos.ticket_id} (${pos.symbol}): entry_price sembra in EUR (${entryPrice.toFixed(6)}), convertendo a USDT (${convertedEntryPrice.toFixed(6)})`);
                entryPrice = convertedEntryPrice;

                // ✅ AGGIORNA entry_price nel database per evitare riconversioni future
                await dbRun(
                    "UPDATE open_positions SET entry_price = ? WHERE ticket_id = ?",
                    [convertedEntryPrice, pos.ticket_id]
                );
            }

            let pnl = 0;
            let pnlPct = 0;
            let remainingVolume = pos.volume - (pos.volume_closed || 0);

            if (pos.type === 'buy') {
                // Long position: profit when price goes up
                pnl = (currentPrice - entryPrice) * remainingVolume;
                pnlPct = ((currentPrice - entryPrice) / entryPrice) * 100;
            } else {
                // Short position: profit when price goes down
                pnl = (entryPrice - currentPrice) * remainingVolume;
                pnlPct = ((entryPrice - currentPrice) / entryPrice) * 100;
            }

            // Track highest price for trailing stop loss
            let highestPrice = pos.highest_price || entryPrice;
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
                const currentLowest = pos.highest_price || entryPrice;
                if (currentPrice < currentLowest) {
                    highestPrice = currentPrice; // Track new lowest price for SHORT
                    shouldUpdateStopLoss = true;
                }
            }

            // Trailing Stop Loss Logic - ✅ DYNAMIC ATR-BASED
            if (pos.trailing_stop_enabled && pos.trailing_stop_distance_pct > 0) {
                // Load recent klines for ATR calculation
                let dynamicDistance = pos.trailing_stop_distance_pct; // Fallback to configured value

                try {
                    const recentKlines = await dbAll(
                        "SELECT * FROM klines WHERE symbol = ? AND interval = '15m' ORDER BY open_time DESC LIMIT 20",
                        [pos.symbol]
                    );

                    if (recentKlines && recentKlines.length >= 15) {
                        const atr = calculateATR(recentKlines.reverse(), 14);
                        dynamicDistance = calculateDynamicTrailingDistance(atr, currentPrice, 1.5);

                        console.log(`📊 [ATR-TRAILING] ${pos.ticket_id} | ATR: ${atr.toFixed(4)} | Dynamic Distance: ${dynamicDistance.toFixed(2)}% (was ${pos.trailing_stop_distance_pct.toFixed(2)}%)`);
                    }
                } catch (atrError) {
                    console.warn(`⚠️ ATR calculation failed for ${pos.symbol}, using fixed distance:`, atrError.message);
                }

                if (pos.type === 'buy') {
                    // For long positions, trailing stop moves up as price increases
                    if (currentPrice > highestPrice) {
                        // Calculate new trailing stop loss with dynamic distance
                        const trailingStopPrice = highestPrice * (1 - dynamicDistance / 100);
                        // Only update if new stop loss is higher than current
                        if (!stopLoss || trailingStopPrice > stopLoss) {
                            stopLoss = trailingStopPrice;
                            shouldUpdateStopLoss = true;
                            console.log(`📈 TRAILING STOP UPDATE (LONG): ${pos.ticket_id} | Highest: €${highestPrice.toFixed(2)} | New SL: €${trailingStopPrice.toFixed(2)} | Distance: ${dynamicDistance.toFixed(2)}%`);
                        }
                    }
                } else {
                    // For short positions, trailing stop moves down as price decreases
                    // highest_price actually stores the LOWEST price for SHORT positions
                    const lowestPrice = highestPrice || entryPrice;
                    if (currentPrice < lowestPrice) {
                        // Trailing stop for SHORT: SL = lowest_price * (1 + distance%)
                        // This moves the SL DOWN as price goes DOWN (protecting profit)
                        const trailingStopPrice = currentPrice * (1 + dynamicDistance / 100);
                        // Only update if new stop loss is LOWER than current (for SHORT, lower SL = better)
                        if (!stopLoss || trailingStopPrice < stopLoss) {
                            stopLoss = trailingStopPrice;
                            shouldUpdateStopLoss = true;
                            console.log(`📈 TRAILING STOP UPDATE (SHORT): ${pos.ticket_id} | Lowest: €${currentPrice.toFixed(2)} | New SL: €${trailingStopPrice.toFixed(2)} | Distance: ${dynamicDistance.toFixed(2)}%`);
                        }
                    }
                }
            }

            // Update position with current price, P&L, and potentially new stop loss/highest price
            const updateFields = ['current_price = ?', 'profit_loss = ?', 'profit_loss_pct = ?'];
            const updateValues = [currentPrice, pnl, pnlPct];

            // ✅ DEBUG: Log aggiornamento prezzo per verificare correttezza
            const oldCurrentPrice = parseFloat(pos.current_price) || 0;
            if (Math.abs(currentPrice - oldCurrentPrice) > oldCurrentPrice * 0.05) { // Se differenza > 5%
                console.log(`💰 [UPDATE P&L] ${pos.ticket_id} (${pos.symbol}): current_price aggiornato: $${oldCurrentPrice.toFixed(6)} → $${currentPrice.toFixed(6)} USDT`);
            }

            if (shouldUpdateStopLoss) {
                updateFields.push('highest_price = ?', 'stop_loss = ?');
                updateValues.push(highestPrice, stopLoss);
            }

            updateValues.push(pos.ticket_id);
            await dbRun(
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
                    // ✅ FIX CRITICO: currentPrice dovrebbe già essere in EUR (da getSymbolPrice chiamato in runBotCycle)
                    // Ma verifichiamo che sia ragionevole per sicurezza
                    let validatedClosePrice = currentPrice;
                    const tradingPair = SYMBOL_TO_PAIR[updatedPos.symbol] || 'BTCEUR';
                    const isUSDT = tradingPair.endsWith('USDT');

                    if (isUSDT && currentPrice > 200000 && updatedPos.symbol !== 'bitcoin') {
                        console.warn(`⚠️ [AUTO-CLOSE] currentPrice ${currentPrice} seems too high for ${updatedPos.symbol}, might need conversion`);
                        // Se sembra troppo alto, potrebbe essere in USDT - ma getSymbolPrice dovrebbe averlo già convertito
                        // Logga solo per debug
                    }

                    console.log(`⚡ AUTO-CLOSING POSITION: ${updatedPos.ticket_id} | Reason: ${closeReason} | Price: €${validatedClosePrice.toFixed(2)}`);
                    await closePosition(updatedPos.ticket_id, validatedClosePrice, closeReason);
                }
            }
        }

        return positions.length;
    } catch (err) {
        console.error('❌ Error in updatePositionsPnL:', err.message);
        throw err;
    }
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
// ✅ COMPATIBILE CON BINANCE REALE: Struttura pronta per integrazione
const closePosition = async (ticketId, closePrice, reason = 'manual') => {
    try {
        // ✅ TODO BINANCE REALE: Quando si passa a Binance reale, aggiungere qui:
        // const { getBinanceClient, isBinanceAvailable } = require('../utils/binanceConfig');
        // if (isBinanceAvailable()) {
        //     const binanceClient = getBinanceClient();
        //     const tradingPair = SYMBOL_TO_PAIR[pos.symbol] || 'BTCEUR';
        //     try {
        //         // Cancella ordini stop-loss/take-profit se esistono
        //         // await binanceClient.cancelAllOrders(tradingPair);
        //         
        //         // Esegui ordine di chiusura
        //         const order = await binanceClient.placeMarketOrder(
        //             tradingPair,
        //             pos.type === 'buy' ? 'SELL' : 'BUY',
        //             remainingVolume
        //         );
        //         closePrice = order.price; // Usa prezzo reale di esecuzione
        //         console.log(`✅ Ordine chiusura Binance eseguito: ${order.orderId} @ €${closePrice.toFixed(2)}`);
        //     } catch (binanceError) {
        //         console.error(`❌ Errore chiusura Binance:`, binanceError.message);
        //         throw new Error(`Chiusura Binance fallita: ${binanceError.message}`);
        //     }
        // }

        // Use Promise-based db.get to properly await the result
        const pos = await dbGet(
            "SELECT * FROM open_positions WHERE ticket_id = ? AND status = 'open'",
            [ticketId]
        );

        if (!pos) {
            throw new Error('Position not found or already closed');
        }

        // ✅ FIX CRITICO: Grace Period - Evita chiusure immediate (< 1 secondo)
        const openedAt = new Date(pos.opened_at || Date.now());
        const timeInPosition = Date.now() - openedAt.getTime();
        const MIN_GRACE_PERIOD_MS = 60000; // 60 secondi minimi
        const MIN_GRACE_PERIOD_FOR_LOSS_MS = 300000; // 5 minuti se in perdita

        if (timeInPosition < MIN_GRACE_PERIOD_MS) {
            const secondsOpen = Math.floor(timeInPosition / 1000);
            throw new Error(`Chiusura bloccata: Posizione aperta da ${secondsOpen} secondi (minimo ${MIN_GRACE_PERIOD_MS / 1000}s richiesti). Questo evita chiusure premature con perdite assurde.`);
        }

        // ✅ FIX CRITICO: Grace Period esteso per posizioni in perdita
        const currentPnLPct = parseFloat(pos.profit_loss_pct) || 0;
        if (currentPnLPct < 0 && timeInPosition < MIN_GRACE_PERIOD_FOR_LOSS_MS) {
            const minutesOpen = Math.floor(timeInPosition / 60000);
            const requiredMinutes = Math.floor(MIN_GRACE_PERIOD_FOR_LOSS_MS / 60000);
            throw new Error(`Chiusura bloccata: Posizione in perdita (${currentPnLPct.toFixed(2)}%) aperta da ${minutesOpen} minuti (minimo ${requiredMinutes} minuti richiesti). Questo evita perdite immediate.`);
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

        // ✅ FIX CRITICO: Valida che il prezzo di chiusura sia ragionevole
        const entryPrice = parseFloat(pos.entry_price) || 0;
        const MAX_REASONABLE_PRICE = 1000000; // 1 milione EUR max
        const MIN_REASONABLE_PRICE = 0.000001; // Minimo ragionevole

        // ✅ FIX: Calcola range ragionevole basato su entry_price (max 10x o min 0.1x)
        const reasonablePriceMax = entryPrice > 0 ? entryPrice * 10 : MAX_REASONABLE_PRICE;
        const reasonablePriceMin = entryPrice > 0 ? entryPrice * 0.1 : MIN_REASONABLE_PRICE;

        if (closePrice > MAX_REASONABLE_PRICE || closePrice < MIN_REASONABLE_PRICE) {
            console.error(`🚨 [CLOSE POSITION] Prezzo di chiusura anomale per ${pos.symbol}: €${closePrice.toLocaleString()}`);
            console.error(`   Entry price: €${entryPrice.toFixed(6)}, Close price: €${closePrice.toFixed(6)}`);
            console.error(`   Range ragionevole: €${reasonablePriceMin.toFixed(6)} - €${reasonablePriceMax.toFixed(6)}`);

            // ✅ FIX: Prova a recuperare il prezzo corretto
            try {
                const correctPrice = await getSymbolPrice(pos.symbol);
                if (correctPrice > 0 && correctPrice <= MAX_REASONABLE_PRICE && correctPrice >= MIN_REASONABLE_PRICE) {
                    console.log(`✅ [CLOSE POSITION] Prezzo corretto recuperato: €${correctPrice.toFixed(6)} (era €${closePrice.toFixed(6)})`);
                    closePrice = correctPrice;
                } else {
                    throw new Error(`Prezzo corretto non disponibile (€${correctPrice})`);
                }
            } catch (priceError) {
                console.error(`❌ [CLOSE POSITION] Errore recupero prezzo corretto:`, priceError.message);
                throw new Error(`Impossibile chiudere posizione ${ticketId}: prezzo anomale (€${closePrice.toLocaleString()}) e impossibile recuperare prezzo corretto`);
            }
        } else if (closePrice > reasonablePriceMax || closePrice < reasonablePriceMin) {
            // Prezzo fuori range ragionevole rispetto all'entry, ma non completamente assurdo
            console.warn(`⚠️ [CLOSE POSITION] Prezzo di chiusura sospetto per ${pos.symbol}: €${closePrice.toFixed(6)} (entry: €${entryPrice.toFixed(6)})`);
            console.warn(`   Range ragionevole: €${reasonablePriceMin.toFixed(6)} - €${reasonablePriceMax.toFixed(6)}`);
            console.warn(`   Verifico prezzo corretto...`);

            // ✅ FIX: Verifica con prezzo corrente
            try {
                const currentPrice = await getSymbolPrice(pos.symbol);
                if (currentPrice > 0 && currentPrice <= MAX_REASONABLE_PRICE && currentPrice >= MIN_REASONABLE_PRICE) {
                    const priceDiff = Math.abs(closePrice - currentPrice) / currentPrice;
                    if (priceDiff > 0.5) { // Se differenza > 50%, usa prezzo corrente
                        console.warn(`⚠️ [CLOSE POSITION] Prezzo passato (€${closePrice.toFixed(6)}) differisce >50% da prezzo corrente (€${currentPrice.toFixed(6)})`);
                        console.warn(`   → Uso prezzo corrente: €${currentPrice.toFixed(6)}`);
                        closePrice = currentPrice;
                    }
                }
            } catch (priceError) {
                console.warn(`⚠️ [CLOSE POSITION] Non posso verificare prezzo corrente:`, priceError.message);
                // Continua con il prezzo passato se non completamente assurdo
            }
        }

        // Calculate final P&L on REMAINING volume only
        let finalPnl = 0;
        if (pos.type === 'buy') {
            // LONG: profit quando prezzo sale
            finalPnl = (closePrice - entryPrice) * remainingVolume;
        } else {
            // SHORT: profit quando prezzo scende
            finalPnl = (entryPrice - closePrice) * remainingVolume;
        }

        // ✅ FIX CRITICO: Calcola profit_loss_pct CORRETTAMENTE per LONG e SHORT
        let profitLossPct = 0;
        if (entryPrice > 0) {
            if (pos.type === 'buy') {
                // LONG: % = (closePrice - entryPrice) / entryPrice * 100
                profitLossPct = ((closePrice - entryPrice) / entryPrice) * 100;
            } else {
                // SHORT: % = (entryPrice - closePrice) / entryPrice * 100
                profitLossPct = ((entryPrice - closePrice) / entryPrice) * 100;
            }
        }

        // ✅ FIX: Valida anche il P&L calcolato
        const MAX_REASONABLE_PNL = 1000000; // 1 milione EUR max
        if (Math.abs(finalPnl) > MAX_REASONABLE_PNL) {
            console.error(`🚨 [CLOSE POSITION] P&L calcolato anomale: €${finalPnl.toLocaleString()}`);
            console.error(`   Entry: €${entryPrice}, Close: €${closePrice}, Volume: ${remainingVolume}`);
            throw new Error(`P&L calcolato anomale (€${finalPnl.toLocaleString()}). Verifica prezzi e volume.`);
        }

        console.log(`💰 P&L CALCULATION: ${pos.type.toUpperCase()} | Entry: €${entryPrice.toFixed(6)} | Close: €${closePrice.toFixed(6)} | Volume: ${remainingVolume.toFixed(8)}`);
        console.log(`   P&L: €${finalPnl.toFixed(2)} | P&L%: ${profitLossPct >= 0 ? '+' : ''}${profitLossPct.toFixed(2)}%`);

        // Update portfolio
        const portfolio = await getPortfolio();
        let balance = portfolio.balance_usd;
        let holdings = JSON.parse(portfolio.holdings || '{}');

        const balanceBefore = balance;

        if (pos.type === 'buy') {
            // Selling: add money, remove crypto (only remaining volume)
            // ✅ LOGICA: Quando chiudi LONG, ricevi: closePrice * volume
            // Questo include: entryPrice * volume (capitale che torna) + P&L
            const capitalReturned = pos.entry_price * remainingVolume;
            const pnlFromClose = (closePrice - pos.entry_price) * remainingVolume;
            balance += closePrice * remainingVolume;
            holdings[pos.symbol] = (holdings[pos.symbol] || 0) - remainingVolume;
            console.log(`💵 LONG CLOSE: Balance ${balanceBefore.toFixed(2)} → ${balance.toFixed(2)} (+€${(closePrice * remainingVolume).toFixed(2)})`);
            console.log(`   📊 [BALANCE LOGIC] Capitale tornato: €${capitalReturned.toFixed(2)}, P&L: €${pnlFromClose.toFixed(2)}, Totale ricevuto: €${(closePrice * remainingVolume).toFixed(2)}`);
        } else {
            // Closing short: subtract money, add crypto back (only remaining volume)
            // ✅ LOGICA: Quando chiudi SHORT, restituisci: closePrice * volume
            // Questo include: entryPrice * volume (capitale da restituire) - P&L
            const capitalToReturn = pos.entry_price * remainingVolume;
            const pnlFromClose = (pos.entry_price - closePrice) * remainingVolume;
            balance -= closePrice * remainingVolume;
            holdings[pos.symbol] = (holdings[pos.symbol] || 0) + remainingVolume;
            console.log(`💵 SHORT CLOSE: Balance ${balanceBefore.toFixed(2)} → ${balance.toFixed(2)} (-€${(closePrice * remainingVolume).toFixed(2)})`);
            console.log(`   📊 [BALANCE LOGIC] Capitale da restituire: €${capitalToReturn.toFixed(2)}, P&L: €${pnlFromClose.toFixed(2)}, Totale da restituire: €${(closePrice * remainingVolume).toFixed(2)}`);
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

        // ✅ FIX CRITICO: Salva anche profit_loss_pct quando si chiude la posizione
        await dbRun(
            "UPDATE open_positions SET status = ?, closed_at = CURRENT_TIMESTAMP, current_price = ?, profit_loss = ?, profit_loss_pct = ? WHERE ticket_id = ?",
            [status, closePrice, finalPnl, profitLossPct, ticketId]
        );

        // Record in trades history (use remaining volume, not full volume)
        // ✅ FIX: Salva anche signal_details e ticket_id per tracciare la posizione originale
        await dbRun(
            "INSERT INTO trades (symbol, type, amount, price, strategy, profit_loss, ticket_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [pos.symbol, pos.type === 'buy' ? 'sell' : 'buy', remainingVolume, closePrice, pos.strategy || 'Manual Close', finalPnl, pos.ticket_id]
        );

        console.log(`✅ POSITION CLOSED: ${ticketId} | P&L: €${finalPnl.toFixed(2)} | Status: ${status} | Reason: ${reason}`);

        // ✅ UPDATE PERFORMANCE STATS for Kelly Criterion
        try {
            // ✅ FIX: Verifica che il record esista, altrimenti crealo
            let statsRecord = await dbGet("SELECT id FROM performance_stats WHERE id = 1");
            if (!statsRecord) {
                console.log('⚠️ [STATS] Record performance_stats con id=1 non trovato, creazione...');
                await dbRun("INSERT OR IGNORE INTO performance_stats (id, total_trades, winning_trades, losing_trades, total_profit, total_loss, avg_win, avg_loss, win_rate) VALUES (1, 0, 0, 0, 0, 0, 0, 0, 0)");
                statsRecord = await dbGet("SELECT id FROM performance_stats WHERE id = 1");
                if (!statsRecord) {
                    console.error('❌ [STATS] Impossibile creare record performance_stats con id=1');
                } else {
                    console.log('✅ [STATS] Record performance_stats creato con successo');
                }
            }

            if (finalPnl > 0) {
                // Winning trade
                const result = await dbRun(`
                    UPDATE performance_stats SET 
                        total_trades = total_trades + 1,
                        winning_trades = winning_trades + 1,
                        total_profit = total_profit + ?,
                        avg_win = total_profit / NULLIF(winning_trades, 0),
                        win_rate = CAST(winning_trades AS REAL) / NULLIF(total_trades, 0),
                        last_updated = CURRENT_TIMESTAMP
                    WHERE id = 1
                `, [finalPnl]);
                console.log(`📊 [STATS] Win recorded: +€${finalPnl.toFixed(2)} | Rows affected: ${result.changes || 'N/A'}`);
            } else {
                // Losing trade (include anche P&L = 0 come loss)
                const result = await dbRun(`
                    UPDATE performance_stats SET 
                        total_trades = total_trades + 1,
                        losing_trades = losing_trades + 1,
                        total_loss = total_loss + ?,
                        avg_loss = ABS(total_loss) / NULLIF(losing_trades, 0),
                        win_rate = CAST(winning_trades AS REAL) / NULLIF(total_trades, 0),
                        last_updated = CURRENT_TIMESTAMP
                    WHERE id = 1
                `, [finalPnl]);
                console.log(`📊 [STATS] Loss recorded: €${finalPnl.toFixed(2)} | Rows affected: ${result.changes || 'N/A'}`);
            }

            // ✅ DEBUG: Verifica stato aggiornato
            const updatedStats = await dbGet("SELECT * FROM performance_stats WHERE id = 1");
            if (updatedStats) {
                console.log(`📊 [STATS] Stato aggiornato: Total=${updatedStats.total_trades}, Wins=${updatedStats.winning_trades}, Losses=${updatedStats.losing_trades}, WinRate=${((updatedStats.win_rate || 0) * 100).toFixed(1)}%`);
            }
        } catch (statsError) {
            console.error('❌ [STATS] Failed to update performance stats:', statsError.message);
            console.error('   Stack:', statsError.stack);
        }


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

        // Calculate duration (reuse openedAt from grace period check above)
        const closedAtForEmail = new Date();
        const durationMs = closedAtForEmail.getTime() - openedAt.getTime();
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const duration = `${hours}h ${minutes}m`;

        // ✅ FIX: Calcola profit/loss percentage CORRETTAMENTE per LONG e SHORT
        // (Nota: profitLossPct è già stato calcolato sopra, ma lo ricalcoliamo qui per l'email)
        let profitLossPercent = 0;
        if (pos.entry_price > 0) {
            if (pos.type === 'buy') {
                // LONG: % = (closePrice - entryPrice) / entryPrice * 100
                profitLossPercent = ((closePrice - pos.entry_price) / pos.entry_price) * 100;
            } else {
                // SHORT: % = (entryPrice - closePrice) / entryPrice * 100
                profitLossPercent = ((pos.entry_price - closePrice) / pos.entry_price) * 100;
            }
        }

        // Send email notification
        sendCryptoEmail('position_closed', {
            symbol: pos.symbol,
            type: pos.type,
            entry_price: pos.entry_price,
            close_price: closePrice,
            volume: pos.volume,
            profit_loss: finalPnl,
            profit_loss_percent: profitLossPercent,
            close_time: closedAtForEmail.toISOString(),
            duration
        }).catch(err => console.error('Email notification error:', err));

        return { success: true, pnl: finalPnl };
    } catch (err) {
        console.error('Error in closePosition:', err.message);
        throw err;
    }
};

// GET /api/crypto/positions - Get all open positions
// ✅ MIGRAZIONE POSTGRESQL: Convertito da db.all() a dbAll()
router.get('/positions', async (req, res) => {
    try {
        const { status } = req.query;

        // ✅ FIX: Validazione STRICTA - se status è specificato, deve essere esattamente 'open'
        // Questo previene bug dove posizioni chiuse vengono mostrate come aperte
        let query;
        let params = [];

        if (status) {
            // ✅ FIX: Solo accetta 'open' come status valido per questo endpoint
            if (status === 'open') {
                query = "SELECT * FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC";
            } else {
                // Per altri status, usa query normale ma con validazione
                query = "SELECT * FROM open_positions WHERE status = ? ORDER BY opened_at DESC";
                params = [status];
            }
        } else {
            // Se non specificato, restituisci tutte le posizioni
            query = "SELECT * FROM open_positions ORDER BY opened_at DESC";
        }

        const rows = await dbAll(query, params);

        // ✅ FIX: Validazione aggiuntiva - filtra posizioni con dati invalidi
        const validPositions = (rows || []).filter(pos => {
            // Deve avere ticket_id
            if (!pos || !pos.ticket_id) {
                return false;
            }
            // Se status è 'open', verifica che sia effettivamente 'open'
            if (status === 'open' && pos.status !== 'open') {
                console.warn(`⚠️ [POSITIONS] Position ${pos.ticket_id} has status '${pos.status}' but was requested as 'open'`);
                return false;
            }
            return true;
        });

        res.json({ positions: validPositions });
    } catch (err) {
        console.error('❌ Error in /positions:', err.message);
        res.status(500).json({ error: err.message });
    }
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
        // ✅ MIGRAZIONE POSTGRESQL: Usa dbRun invece di db.serialize()/db.run()
        await dbRun(
            "UPDATE portfolio SET balance_usd = ?, holdings = ?",
            [balance, JSON.stringify(holdings)]
        );

        await dbRun(
            `INSERT INTO open_positions 
            (ticket_id, symbol, type, volume, entry_price, current_price, stop_loss, take_profit, strategy, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
            [ticketId, symbol, type, volume, entry_price, entry_price, stop_loss || null, take_profit || null, strategy || 'Manual', 'open']
        );

        // Record initial trade
        await dbRun(
            "INSERT INTO trades (symbol, type, amount, price, strategy) VALUES (?, ?, ?, ?, ?)",
            [symbol, type, volume, entry_price, strategy || 'Manual Open']
        );

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
        // ✅ FIX CRITICO: Get current price if not provided, usando getSymbolPrice per conversione USDT→EUR
        let finalPrice = close_price;
        if (!finalPrice) {
            try {
                // ✅ FIX: Usa getSymbolPrice che gestisce automaticamente conversione USDT→EUR
                const targetSymbol = symbol || 'bitcoin';
                finalPrice = await getSymbolPrice(targetSymbol);

                if (!finalPrice || isNaN(finalPrice) || finalPrice <= 0) {
                    throw new Error('Invalid price received from getSymbolPrice');
                }
                console.log(`💱 [CLOSE] Using price for ${targetSymbol}: €${finalPrice.toFixed(2)} EUR`);
            } catch (e) {
                console.error('Error fetching price for close position:', e.message);
                return res.status(500).json({ error: 'Could not fetch current price. Please provide close_price.' });
            }
        } else {
            // ✅ FIX CRITICO: Se close_price è fornito, verifica che sia in EUR
            // Se il simbolo è USDT, potrebbe essere necessario convertire
            const targetSymbol = symbol || 'bitcoin';
            const tradingPair = SYMBOL_TO_PAIR[targetSymbol] || 'BTCEUR';
            const isUSDT = tradingPair.endsWith('USDT');

            if (isUSDT) {
                // ✅ FIX: Se il prezzo fornito è in USDT, convertilo in EUR
                // Assumiamo che se close_price è molto grande (> 1000 per la maggior parte delle crypto),
                // potrebbe essere in USDT invece di EUR
                const MAX_REASONABLE_EUR_PRICE = 100000; // BTC può essere > 100k EUR, ma altre crypto no
                if (finalPrice > MAX_REASONABLE_EUR_PRICE && targetSymbol !== 'bitcoin') {
                    console.warn(`⚠️ [CLOSE] close_price ${finalPrice} seems too high for ${targetSymbol}, attempting USDT→EUR conversion`);
                    try {
                        const usdtToEurRate = await getUSDTtoEURRate();
                        finalPrice = finalPrice * usdtToEurRate;
                        console.log(`💱 [CLOSE] Converted USDT price to EUR: €${finalPrice.toFixed(2)}`);
                    } catch (convError) {
                        console.error(`⚠️ [CLOSE] Could not convert USDT to EUR, using price as-is:`, convError.message);
                    }
                }
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

        // ✅ FIX: updatePositionsPnL ora aggiorna TUTTE le posizioni, recuperando i prezzi da Binance
        const updatedCount = await updatePositionsPnL();
        res.json({ success: true, updated: updatedCount, current_price: currentPrice });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ FIX: Aggiorna P&L per TUTTE le posizioni aperte (tutti i simboli) ogni 3 secondi
// Funzione per aggiornare tutte le posizioni aperte
const updateAllPositionsPnL = async () => {
    try {
        // Ottieni tutti i simboli unici delle posizioni aperte
        const allOpenPositions = await dbAll("SELECT DISTINCT symbol FROM open_positions WHERE status = 'open'");

        if (allOpenPositions.length === 0) {
            // Nessuna posizione aperta - rimuovi tutte le sottoscrizioni WebSocket
            if (wsService && wsService.isWebSocketConnected()) {
                const currentSymbols = Array.from(wsService.subscribedSymbols || []);
                if (currentSymbols.length > 0) {
                    wsService.unsubscribeFromSymbols(currentSymbols);
                }
            }
            return;
        }

        // ✅ WEBSOCKET: Sottoscrivi a simboli con posizioni aperte
        if (wsService && wsService.isWebSocketConnected()) {
            const currentSymbols = Array.from(wsService.subscribedSymbols || []);
            const newSymbols = allOpenPositions.map(p => p.symbol);

            // Rimuovi simboli non più necessari
            const toUnsubscribe = currentSymbols.filter(s => !newSymbols.includes(s));
            if (toUnsubscribe.length > 0) {
                wsService.unsubscribeFromSymbols(toUnsubscribe);
            }

            // Aggiungi nuovi simboli
            const toSubscribe = newSymbols.filter(s => !currentSymbols.includes(s));
            if (toSubscribe.length > 0) {
                wsService.subscribeToSymbols(toSubscribe);
            }
        } else {
            // WebSocket non connesso - riprova connessione
            if (wsService && !wsService.isConnecting) {
                console.log('🔄 [WEBSOCKET] Tentativo riconnessione...');
                wsService.connect().catch(() => {
                    // Fallback a REST API se WebSocket fallisce
                });
            }
        }

        // ✅ FIX CRITICO: Aggiorna TUTTE le posizioni aperte, recuperando i prezzi da Binance per ciascuna
        // updatePositionsPnL ora gestisce internamente il recupero dei prezzi per ogni simbolo
        await updatePositionsPnL();
    } catch (err) {
        // Silent fail in background - non bloccare il processo
        if (Math.random() < 0.1) {
            console.warn(`⚠️ [UPDATE P&L] Errore generale:`, err.message);
        }
    }
};

// ✅ OTTIMIZZATO: Aggiorna TUTTE le posizioni ogni 2 secondi per real-time
// Usa cache prezzi (3s), quindi non fa chiamate API ogni volta - SICURO per rate limit
setInterval(updateAllPositionsPnL, 2000); // 2 secondi - usa cache quindi sicuro

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

// GET /api/crypto/bot/active - Get all active bots with their symbols
router.get('/bot/active', async (req, res) => {
    try {
        const activeBots = await dbAll(
            "SELECT * FROM bot_settings WHERE is_active = 1"
        );
        res.json({
            success: true,
            active_bots: activeBots.map(bot => ({
                strategy_name: bot.strategy_name,
                symbol: bot.symbol,
                is_active: Number(bot.is_active) === 1,
                parameters: bot.parameters ? JSON.parse(bot.parameters) : DEFAULT_PARAMS
            }))
        });
    } catch (error) {
        console.error('Error getting active bots:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/crypto/bot/status - Get detailed bot status (for diagnostics)
router.get('/bot/status', async (req, res) => {
    try {
        // Get all bots (active and paused)
        const allBots = await dbAll(
            "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy'"
        );

        const activeBots = allBots.filter(b => Number(b.is_active) === 1);
        const pausedBots = allBots.filter(b => Number(b.is_active) === 0);

        // Count open positions
        const openPositions = await dbAll(
            "SELECT COUNT(*) as count FROM open_positions WHERE status = 'open'"
        );
        const openPositionsCount = openPositions[0]?.count || 0;

        // Check if bot cycle is running (check last activity)
        const lastBotActivity = await dbAll(
            "SELECT MAX(timestamp) as last_update FROM price_history WHERE symbol IN (SELECT symbol FROM bot_settings WHERE strategy_name = 'RSI_Strategy') LIMIT 1"
        );
        const lastUpdate = lastBotActivity[0]?.last_update || null;
        const minutesSinceUpdate = lastUpdate ? Math.floor((Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60)) : null;

        res.json({
            status: activeBots.length > 0 ? 'ACTIVE' : 'PAUSED',
            total_bots: allBots.length,
            active_bots: activeBots.length,
            paused_bots: pausedBots.length,
            open_positions: openPositionsCount,
            bot_details: {
                active: activeBots.map(b => ({
                    symbol: b.symbol,
                    is_active: Number(b.is_active) === 1
                })),
                paused: pausedBots.map(b => ({
                    symbol: b.symbol,
                    is_active: Number(b.is_active) === 1
                }))
            },
            system_status: {
                bot_cycle_running: minutesSinceUpdate !== null && minutesSinceUpdate < 2, // Updated in last 2 minutes
                last_update: lastUpdate,
                minutes_since_update: minutesSinceUpdate,
                smart_exit_active: true, // SmartExit sempre attivo
                position_updates_active: true // Aggiornamento P&L sempre attivo
            },
            explanation: {
                paused_means: "Il bot NON può aprire nuove posizioni, ma continua ad aggiornare dati (prezzi, klines) e gestisce posizioni esistenti (P&L, SmartExit)",
                active_means: "Il bot può aprire nuove posizioni, processa segnali e gestisce tutte le operazioni"
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/crypto/symbols/available - Get list of available trading symbols
router.get('/symbols/available', async (req, res) => {
    try {
        // Common crypto symbols that can be traded - Aggiunti più simboli e coppie
        const availableSymbols = [
            // Bitcoin
            { symbol: 'bitcoin', name: 'Bitcoin', pair: 'BTCEUR', display: 'BTC/EUR' },
            { symbol: 'bitcoin_usdt', name: 'Bitcoin', pair: 'BTCUSDT', display: 'BTC/USDT' },
            // Solana
            { symbol: 'solana', name: 'Solana', pair: 'SOLUSDT', display: 'SOL/USDT' },
            { symbol: 'solana_eur', name: 'Solana', pair: 'SOLEUR', display: 'SOL/EUR' },
            // Ethereum
            { symbol: 'ethereum', name: 'Ethereum', pair: 'ETHEUR', display: 'ETH/EUR' },
            { symbol: 'ethereum_usdt', name: 'Ethereum', pair: 'ETHUSDT', display: 'ETH/USDT' },
            // Cardano
            { symbol: 'cardano', name: 'Cardano', pair: 'ADAEUR', display: 'ADA/EUR' },
            { symbol: 'cardano_usdt', name: 'Cardano', pair: 'ADAUSDT', display: 'ADA/USDT' },
            // Polkadot
            { symbol: 'polkadot', name: 'Polkadot', pair: 'DOTEUR', display: 'DOT/EUR' },
            { symbol: 'polkadot_usdt', name: 'Polkadot', pair: 'DOTUSDT', display: 'DOT/USDT' },
            // Chainlink
            { symbol: 'chainlink', name: 'Chainlink', pair: 'LINKEUR', display: 'LINK/EUR' },
            { symbol: 'chainlink_usdt', name: 'Chainlink', pair: 'LINKUSDT', display: 'LINK/USDT' },
            // Litecoin
            { symbol: 'litecoin', name: 'Litecoin', pair: 'LTCEUR', display: 'LTC/EUR' },
            { symbol: 'litecoin_usdt', name: 'Litecoin', pair: 'LTCUSDT', display: 'LTC/USDT' },
            // Ripple
            { symbol: 'ripple', name: 'Ripple', pair: 'XRPUSDT', display: 'XRP/USDT' },
            { symbol: 'ripple_eur', name: 'Ripple', pair: 'XRPEUR', display: 'XRP/EUR' },
            // Binance Coin
            { symbol: 'binance_coin', name: 'Binance Coin', pair: 'BNBUSDT', display: 'BNB/USDT' },
            { symbol: 'binance_coin_eur', name: 'Binance Coin', pair: 'BNBEUR', display: 'BNB/EUR' },
            // Polygon (POL) - Replaces MATIC
            { symbol: 'pol_polygon', name: 'Polygon', pair: 'POLUSDT', display: 'POL/USDT' },
            { symbol: 'pol_polygon_eur', name: 'Polygon', pair: 'POLEUR', display: 'POL/EUR' },
            // Avalanche
            { symbol: 'avalanche', name: 'Avalanche', pair: 'AVAXUSDT', display: 'AVAX/USDT' },
            { symbol: 'avalanche_eur', name: 'Avalanche', pair: 'AVAXEUR', display: 'AVAX/EUR' },
            // Uniswap
            { symbol: 'uniswap', name: 'Uniswap', pair: 'UNIUSDT', display: 'UNI/USDT' },
            { symbol: 'uniswap_eur', name: 'Uniswap', pair: 'UNIEUR', display: 'UNI/EUR' },
            // Dogecoin
            { symbol: 'dogecoin', name: 'Dogecoin', pair: 'DOGEUSDT', display: 'DOGE/USDT' },
            { symbol: 'dogecoin_eur', name: 'Dogecoin', pair: 'DOGEEUR', display: 'DOGE/EUR' },
            // Shiba Inu
            { symbol: 'shiba', name: 'Shiba Inu', pair: 'SHIBUSDT', display: 'SHIB/USDT' },
            { symbol: 'shiba_eur', name: 'Shiba Inu', pair: 'SHIBEUR', display: 'SHIB/EUR' }
        ];

        // Get active bots to show which symbols have bots running
        const activeBots = await dbAll(
            "SELECT symbol FROM bot_settings WHERE is_active = 1"
        );
        const activeSymbols = new Set(activeBots.map(b => b.symbol));

        res.json({
            success: true,
            symbols: availableSymbols.map(s => ({
                ...s,
                bot_active: activeSymbols.has(s.symbol)
            }))
        });
    } catch (error) {
        console.error('Error getting available symbols:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/crypto/bot/toggle - Toggle bot on/off (supports multi-symbol)
router.post('/bot/toggle', async (req, res) => {
    try {
        const { strategy_name, symbol, is_active } = req.body;

        console.log(`🤖 [BOT-TOGGLE] Request received:`, { strategy_name, symbol, is_active });

        if (!strategy_name) {
            return res.status(400).json({ error: 'strategy_name is required' });
        }

        const targetSymbol = symbol || 'bitcoin'; // Default to bitcoin for backward compatibility

        // Verify symbol is valid (check if trading pair exists)
        const tradingPair = SYMBOL_TO_PAIR[targetSymbol];
        if (!tradingPair && targetSymbol !== 'bitcoin') {
            console.error(`❌ [BOT-TOGGLE] Invalid symbol: ${targetSymbol}, no trading pair found`);
            return res.status(400).json({
                error: `Simbolo non valido: ${targetSymbol}. Trading pair non trovato nel mapping.`
            });
        }

        // Test if we can get price for this symbol (verify trading pair exists on Binance)
        if (tradingPair) {
            try {
                const testPrice = await getSymbolPrice(targetSymbol);
                if (testPrice === 0) {
                    console.warn(`⚠️ [BOT-TOGGLE] Could not fetch price for ${targetSymbol} (${tradingPair}), trading pair might not exist on Binance`);
                    // Non blocchiamo l'attivazione, ma avvisiamo che potrebbe non funzionare
                } else {
                    console.log(`✅ [BOT-TOGGLE] Verified price fetch for ${targetSymbol} (${tradingPair}): €${testPrice}`);
                }
            } catch (priceError) {
                console.error(`❌ [BOT-TOGGLE] Error testing price fetch for ${targetSymbol}:`, priceError.message);
                // Non blocchiamo, ma loggiamo l'errore
            }
        }

        const activeValue = is_active ? 1 : 0;

        console.log(`🤖 [BOT-TOGGLE] Toggling bot for ${targetSymbol} (${tradingPair || 'BTCEUR'}) to ${activeValue === 1 ? 'ACTIVE' : 'INACTIVE'}`);

        // Check if bot settings exist for this symbol, if not create them
        const existing = await dbGet(
            "SELECT * FROM bot_settings WHERE strategy_name = ? AND symbol = ?",
            [strategy_name, targetSymbol]
        );

        if (!existing) {
            console.log(`📝 [BOT-TOGGLE] Creating new bot settings for ${targetSymbol}`);
            // Create new bot settings with default parameters
            await dbRun(
                "INSERT INTO bot_settings (strategy_name, symbol, is_active, parameters) VALUES (?, ?, ?, ?)",
                [strategy_name, targetSymbol, activeValue, JSON.stringify(DEFAULT_PARAMS)]
            );
            console.log(`✅ [BOT-TOGGLE] Created bot settings for ${targetSymbol}`);
        } else {
            console.log(`📝 [BOT-TOGGLE] Updating existing bot settings for ${targetSymbol}`);
            // Update existing
            await dbRun(
                "UPDATE bot_settings SET is_active = ? WHERE strategy_name = ? AND symbol = ?",
                [activeValue, strategy_name, targetSymbol]
            );
            console.log(`✅ [BOT-TOGGLE] Updated bot settings for ${targetSymbol}`);
        }

        // Verify the bot was saved correctly
        const verify = await dbGet(
            "SELECT * FROM bot_settings WHERE strategy_name = ? AND symbol = ?",
            [strategy_name, targetSymbol]
        );

        if (!verify) {
            console.error(`❌ [BOT-TOGGLE] Failed to save bot settings for ${targetSymbol}`);
            return res.status(500).json({ error: 'Errore nel salvataggio delle impostazioni del bot' });
        }

        console.log(`✅ [BOT-TOGGLE] Bot ${activeValue === 1 ? 'attivato' : 'disattivato'} con successo per ${targetSymbol}`);

        res.json({
            success: true,
            strategy_name,
            symbol: targetSymbol,
            is_active: activeValue === 1,
            message: `Bot ${activeValue === 1 ? 'attivato' : 'disattivato'} per ${targetSymbol.toUpperCase()}`
        });
    } catch (error) {
        console.error('❌ [BOT-TOGGLE] Error toggling bot:', error);
        console.error('❌ [BOT-TOGGLE] Stack:', error.stack);
        res.status(500).json({ error: error.message || 'Errore sconosciuto nell\'attivazione del bot' });
    }
});

// POST /api/crypto/bot/toggle-all - Toggle all bots at once
router.post('/bot/toggle-all', async (req, res) => {
    try {
        const { is_active } = req.body;

        if (typeof is_active !== 'boolean') {
            return res.status(400).json({ error: 'is_active must be a boolean' });
        }

        const activeValue = is_active ? 1 : 0;

        console.log(`🤖 [BOT-TOGGLE-ALL] Toggling ALL bots to ${activeValue === 1 ? 'ACTIVE' : 'INACTIVE'}`);

        // Get all bot settings
        const allBots = await dbAll(
            "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy'"
        );

        if (allBots.length === 0) {
            // No bots exist, create default ones for main symbols
            const mainSymbols = ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 'chainlink'];
            for (const symbol of mainSymbols) {
                await dbRun(
                    "INSERT INTO bot_settings (strategy_name, symbol, is_active, parameters) VALUES (?, ?, ?, ?)",
                    ['RSI_Strategy', symbol, activeValue, JSON.stringify(DEFAULT_PARAMS)]
                );
            }
            console.log(`✅ [BOT-TOGGLE-ALL] Created ${mainSymbols.length} bot settings and set to ${activeValue === 1 ? 'ACTIVE' : 'INACTIVE'}`);
        } else {
            // Update all existing bots
            await dbRun(
                "UPDATE bot_settings SET is_active = ? WHERE strategy_name = 'RSI_Strategy'",
                [activeValue]
            );
            console.log(`✅ [BOT-TOGGLE-ALL] Updated ${allBots.length} bots to ${activeValue === 1 ? 'ACTIVE' : 'INACTIVE'}`);
        }

        // Verify
        const activeBots = await dbAll(
            "SELECT COUNT(*) as count FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND is_active = 1"
        );
        const activeCount = activeBots[0]?.count || 0;

        res.json({
            success: true,
            is_active: activeValue === 1,
            active_bots_count: activeCount,
            total_bots: allBots.length || 6,
            message: `Tutti i bot ${activeValue === 1 ? 'attivati' : 'disattivati'} con successo`
        });
    } catch (error) {
        console.error('❌ [BOT-TOGGLE-ALL] Error:', error);
        res.status(500).json({ error: error.message || 'Errore nel toggle di tutti i bot' });
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
    // ✅ FIX: Aggiungi timeout per evitare 502 Bad Gateway
    const requestTimeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({ error: 'Request timeout: Statistics calculation took too long' });
        }
    }, 25000); // 25 secondi timeout

    try {
        const portfolio = await getPortfolio();
        const allTrades = await dbAll("SELECT * FROM trades ORDER BY timestamp ASC");
        const closedPositions = await dbAll("SELECT * FROM open_positions WHERE status != 'open' ORDER BY closed_at ASC");
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC");

        // Initial portfolio value (assumed starting balance)
        const initialBalance = 262.5; // Default starting balance in USDT

        // ✅ FIX: Calculate current total balance considerando TUTTI i simboli, non solo Bitcoin
        const holdings = JSON.parse(portfolio.holdings || '{}');
        const currentBalance = portfolio.balance_usd;

        // Calcola valore totale di tutte le holdings (multi-symbol)
        let totalCryptoValue = 0;
        const symbolPrices = {}; // Cache prezzi per evitare chiamate duplicate

        // ✅ FIX: Valida che holdings sia un oggetto
        if (holdings && typeof holdings === 'object') {
            for (const symbol of Object.keys(holdings)) {
                // ✅ FIX: Valida il simbolo
                if (!symbol || typeof symbol !== 'string') {
                    console.warn(`⚠️ Skipping invalid symbol in holdings:`, symbol);
                    continue;
                }

                const amount = holdings[symbol] || 0;
                if (amount > 0.0001) { // Solo se ci sono holdings significative
                    try {
                        if (!symbolPrices[symbol]) {
                            // ✅ FIX: Timeout per chiamate prezzo per evitare blocchi
                            const pricePromise = getSymbolPrice(symbol);
                            const timeoutPromise = new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Price fetch timeout')), 3000)
                            );
                            const price = await Promise.race([pricePromise, timeoutPromise]);

                            if (price > 0) {
                                symbolPrices[symbol] = price;
                            } else {
                                console.warn(`⚠️ Invalid price (${price}) for ${symbol} in statistics, skipping`);
                                continue; // Salta questo simbolo se prezzo non valido
                            }
                        }
                        const price = symbolPrices[symbol] || 0;
                        if (price > 0) {
                            totalCryptoValue += amount * price;
                        }
                    } catch (err) {
                        console.warn(`⚠️ Could not fetch price for ${symbol} in statistics:`, err.message);
                        // Continua con altri simboli invece di bloccare tutto
                    }
                }
            }
        } else {
            console.warn(`⚠️ Holdings is not a valid object in statistics:`, typeof holdings);
        }

        const totalBalance = currentBalance + totalCryptoValue;

        // ✅ FIX: Usa prezzo Bitcoin solo come fallback per backward compatibility
        let currentPrice = 0;
        try {
            currentPrice = await getSymbolPrice('bitcoin');
        } catch (e) {
            console.warn('Could not fetch Bitcoin price for statistics:', e.message);
        }

        // 1. Total P&L - Include both closed and open positions
        let totalPnL = 0;
        let totalProfit = 0;
        let totalLoss = 0;
        let winningTrades = 0;
        let losingTrades = 0;
        let totalVolume = 0;

        // Calculate from closed positions (realized P&L)
        if (Array.isArray(closedPositions)) {
            closedPositions.forEach(pos => {
                if (!pos) return; // Salta posizioni null/undefined
                const pnl = parseFloat(pos.profit_loss) || 0;

                // ✅ FIX CRITICO: Valida valori anomali di profit_loss
                const MAX_REASONABLE_PNL = 1000000;
                if (Math.abs(pnl) > MAX_REASONABLE_PNL) {
                    console.warn(`⚠️ Skipping anomalous profit_loss for position ${pos.ticket_id}: $${pnl.toFixed(2)} USDT`);
                    return;
                }

                totalPnL += pnl;
                if (pnl > 0) {
                    totalProfit += pnl;
                    winningTrades++;
                } else if (pnl < 0) {
                    totalLoss += Math.abs(pnl);
                    losingTrades++;
                }

                // ✅ FIX: Aggiungi volume delle posizioni chiuse (volume totale scambiato)
                const entryPrice = parseFloat(pos.entry_price) || 0;
                const volume = parseFloat(pos.volume) || 0;
                if (volume > 0 && entryPrice > 0) {
                    totalVolume += volume * entryPrice;
                }
            });
        } else {
            console.warn(`⚠️ closedPositions is not an array in statistics:`, typeof closedPositions);
        }

        // ✅ FIX SEMPLIFICATO: Usa direttamente profit_loss già calcolato dal backend per posizioni aperte
        // Questo evita problemi con prezzi sbagliati o mancanti
        if (Array.isArray(openPositions)) {
            for (const pos of openPositions) {
                // ✅ FIX: Valida che la posizione abbia i campi necessari
                if (!pos || pos.status !== 'open') {
                    continue;
                }

                // ✅ FIX SEMPLIFICATO: Usa direttamente profit_loss già calcolato
                const unrealizedPnL = parseFloat(pos.profit_loss) || 0;

                // ✅ FIX CRITICO: Valida valori anomali di profit_loss
                const MAX_REASONABLE_PNL = 1000000;
                if (Math.abs(unrealizedPnL) > MAX_REASONABLE_PNL) {
                    console.warn(`⚠️ Skipping anomalous profit_loss for open position ${pos.ticket_id}: $${unrealizedPnL.toFixed(2)} USDT`);
                    continue;
                }

                totalPnL += unrealizedPnL;
                if (unrealizedPnL > 0) {
                    totalProfit += unrealizedPnL;
                } else if (unrealizedPnL < 0) {
                    totalLoss += Math.abs(unrealizedPnL);
                }

                // ✅ FIX: Volume = solo volume effettivamente investito (considera volume_closed per posizioni parzialmente chiuse)
                const entryPrice = parseFloat(pos.entry_price) || 0;
                const volume = parseFloat(pos.volume) || 0;
                const volumeClosed = parseFloat(pos.volume_closed) || 0;
                const remainingVolume = volume - volumeClosed;

                if (remainingVolume > 0 && entryPrice > 0) {
                    totalVolume += remainingVolume * entryPrice;
                }
            }
        } else {
            console.warn(`⚠️ openPositions is not an array in statistics:`, typeof openPositions);
        }

        // Also include trades with profit_loss (from manual trades) - but avoid double counting
        const processedTicketIds = new Set();
        closedPositions.forEach(pos => {
            if (pos.ticket_id) processedTicketIds.add(pos.ticket_id);
        });
        openPositions.forEach(pos => {
            if (pos.ticket_id) processedTicketIds.add(pos.ticket_id);
        });

        // ✅ FIX: Traccia ticket_ids già contati nel volume e P&L
        // Il volume delle posizioni chiuse e aperte è già stato contato sopra
        const volumeCountedTicketIds = new Set();
        const pnlCountedTicketIds = new Set();

        // ✅ FIX: Aggiungi ticket_ids delle posizioni chiuse e aperte per evitare doppi conteggi nei trades
        closedPositions.forEach(pos => {
            if (pos.ticket_id) {
                volumeCountedTicketIds.add(pos.ticket_id);
                pnlCountedTicketIds.add(pos.ticket_id);
            }
        });
        openPositions.forEach(pos => {
            if (pos.ticket_id) {
                volumeCountedTicketIds.add(pos.ticket_id);
                pnlCountedTicketIds.add(pos.ticket_id);
            }
        });

        allTrades.forEach(trade => {
            // ✅ FIX: Escludi partial closes dal conteggio trade (conta solo chiusure finali)
            // I partial closes (TP1) hanno strategy che contiene "TP1" o "partial"
            const isPartialClose = trade.strategy && (
                trade.strategy.includes('TP1') ||
                trade.strategy.includes('partial') ||
                trade.strategy.includes('Partial')
            );

            // Conta P&L dai trade manuali (non posizioni) - solo se non già contato E non è partial close
            if (trade.profit_loss !== null && trade.profit_loss !== undefined &&
                !pnlCountedTicketIds.has(trade.ticket_id) && !isPartialClose) {
                const pnl = parseFloat(trade.profit_loss) || 0;
                const MAX_REASONABLE_PNL = 1000000;
                if (Math.abs(pnl) <= MAX_REASONABLE_PNL && Math.abs(pnl) > 0.01) {
                    totalPnL += pnl;
                    if (pnl > 0) {
                        totalProfit += pnl;
                        winningTrades++;
                    } else if (pnl < 0) {
                        totalLoss += Math.abs(pnl);
                        losingTrades++;
                    }
                    pnlCountedTicketIds.add(trade.ticket_id);
                }
            }

            // ✅ FIX CRITICO: Conta volume SOLO per trades che non sono già in posizioni
            // Volume = amount * price per ogni trade (sia BUY che SELL contano come volume scambiato)
            if (trade.ticket_id && !volumeCountedTicketIds.has(trade.ticket_id)) {
                const tradeVolume = (parseFloat(trade.amount) || 0) * (parseFloat(trade.price) || 0);
                if (tradeVolume > 0.01 && tradeVolume < 1000000) {
                    totalVolume += tradeVolume;
                    volumeCountedTicketIds.add(trade.ticket_id);
                }
            }
        });

        // ✅ FIX: Win Rate basato solo su posizioni chiuse con P&L realizzato
        // Total trades con P&L realizzato (posizioni chiuse + trades manuali con P&L)
        const closedTradesForWinRate = winningTrades + losingTrades;
        const winRate = closedTradesForWinRate > 0 ? (winningTrades / closedTradesForWinRate) * 100 : 0;

        // ✅ FIX CRITICO: Total trades = solo trade con P&L (chiusure), NON tutti i trade
        // Ogni posizione genera 2 trade: apertura (senza P&L) + chiusura (con P&L)
        // Per le statistiche, contiamo solo i trade con P&L (chiusure) per essere coerenti con win rate
        // Se l'utente vuole vedere tutti i trade (aperture + chiusure), può guardare la tabella trades
        const totalTrades = closedTradesForWinRate; // Solo trade con P&L realizzato

        // ✅ FIX: Profit Factor - se totalLoss è 0 ma ci sono profitti, usa un valore molto alto invece di Infinity
        let profitFactor = 0;
        if (totalLoss > 0) {
            profitFactor = totalProfit / totalLoss;
        } else if (totalProfit > 0) {
            // Se non ci sono perdite ma ci sono profitti, profit factor è molto alto
            profitFactor = totalProfit > 0 ? 999999 : 0;
        }

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

        // ✅ FIX CRITICO: Sanitizzazione finale valori anomali
        const MAX_REASONABLE_BALANCE = 1000000;
        const MAX_REASONABLE_PNL = 1000000;

        const sanitizedTotalBalance = (Math.abs(totalBalance) > MAX_REASONABLE_BALANCE) ? initialBalance : totalBalance;
        const sanitizedTotalPnL = (Math.abs(totalPnL) > MAX_REASONABLE_PNL) ? 0 : totalPnL;
        const sanitizedPnLPercent = (Math.abs(pnlPercent) > 10000) ? 0 : pnlPercent;
        const sanitizedROI = (Math.abs(roi) > 10000) ? 0 : roi;

        if (totalBalance !== sanitizedTotalBalance) console.warn(`Sanitized Balance: ${totalBalance} -> ${sanitizedTotalBalance}`);

        res.json({
            success: true,
            statistics: {
                // Portfolio
                initial_balance: initialBalance,
                current_balance: sanitizedTotalBalance,
                pnl_total: sanitizedTotalPnL,
                pnl_percent: sanitizedPnLPercent,
                roi: sanitizedROI,

                // Trade Performance
                total_trades: totalTrades,
                winning_trades: winningTrades,
                losing_trades: losingTrades,
                win_rate: winRate,
                profit_factor: profitFactor > 0 ? (profitFactor > 999999 ? null : profitFactor) : 0,

                // Profit/Loss Breakdown
                total_profit: totalProfit,
                total_loss: totalLoss,
                avg_win: avgWin,
                avg_loss: avgLoss,

                // Volume
                total_volume_usdt: totalVolume,

                // Period Stats
                trades_today: tradesToday,
                trades_this_week: tradesThisWeek,
                trades_this_month: tradesThisMonth,

                // Current Holdings (multi-symbol)
                total_crypto_value: totalCryptoValue,
                cash_balance: currentBalance
            }
        });
        clearTimeout(requestTimeout);
    } catch (error) {
        clearTimeout(requestTimeout);
        console.error('❌ Error calculating statistics:', error);
        console.error('❌ Stack:', error.stack);
        if (!res.headersSent) {
            res.status(500).json({
                error: error.message || 'Errore nel calcolo delle statistiche',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
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
                const ret = (equityCurve[i].balance - equityCurve[i - 1].balance) / equityCurve[i - 1].balance;
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

// ✅ NUOVO ENDPOINT: Analisi bot in tempo reale - Mostra cosa sta valutando il bot
router.get('/bot-analysis', async (req, res) => {
    console.log('🔍 [BOT-ANALYSIS] ========== RICHIESTA RICEVUTA ==========');
    console.log('🔍 [BOT-ANALYSIS] Timestamp:', new Date().toISOString());

    try {
        // ✅ FIX: Verifica che le dipendenze siano disponibili
        console.log('🔍 [BOT-ANALYSIS] Verifica dipendenze...');
        console.log('🔍 [BOT-ANALYSIS] httpsGet:', typeof httpsGet);
        console.log('🔍 [BOT-ANALYSIS] dbGet:', typeof dbGet);
        console.log('🔍 [BOT-ANALYSIS] dbAll:', typeof dbAll);
        console.log('🔍 [BOT-ANALYSIS] signalGenerator:', typeof signalGenerator);
        console.log('🔍 [BOT-ANALYSIS] riskManager:', typeof riskManager);
        console.log('🔍 [BOT-ANALYSIS] getBotParameters:', typeof getBotParameters);

        if (typeof httpsGet === 'undefined') {
            console.error('❌ [BOT-ANALYSIS] httpsGet non definito');
            return res.status(500).json({ error: 'httpsGet non disponibile' });
        }
        if (typeof dbGet === 'undefined') {
            console.error('❌ [BOT-ANALYSIS] dbGet non definito');
            return res.status(500).json({ error: 'dbGet non disponibile' });
        }
        if (typeof dbAll === 'undefined') {
            console.error('❌ [BOT-ANALYSIS] dbAll non definito');
            return res.status(500).json({ error: 'dbAll non disponibile' });
        }
        if (typeof signalGenerator === 'undefined') {
            console.error('❌ [BOT-ANALYSIS] signalGenerator non definito');
            return res.status(500).json({ error: 'signalGenerator non disponibile' });
        }
        if (typeof riskManager === 'undefined') {
            console.error('❌ [BOT-ANALYSIS] riskManager non definito');
            return res.status(500).json({ error: 'riskManager non disponibile' });
        }
        if (typeof getBotParameters === 'undefined') {
            console.error('❌ [BOT-ANALYSIS] getBotParameters non definito');
            return res.status(500).json({ error: 'getBotParameters non disponibile' });
        }

        console.log('🔍 [BOT-ANALYSIS] Tutte le dipendenze verificate OK');

        // Get symbol from query parameter, default to bitcoin
        const symbol = req.query.symbol || 'bitcoin';
        console.log('🔍 [BOT-ANALYSIS] Symbol:', symbol);

        // Get current price from Binance
        // Get current price using the helper function that handles correct symbol mapping and USDT conversion
        let currentPrice = 0;
        console.log('🔍 [BOT-ANALYSIS] Fetching current price for', symbol);
        try {
            currentPrice = await getSymbolPrice(symbol);
        } catch (err) {
            console.error('Error fetching current price:', err);
            // Fallback: get last price from DB (PostgreSQL syntax)
            const lastPrice = await dbGet("SELECT price FROM price_history WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1", [symbol]);
            if (lastPrice) {
                currentPrice = parseFloat(lastPrice.price);
            }
        }

        console.log('🔍 [BOT-ANALYSIS] Current price:', currentPrice);

        if (!currentPrice || currentPrice === 0) {
            console.error('❌ [BOT-ANALYSIS] Prezzo corrente non disponibile');
            return res.status(500).json({ error: 'Impossibile ottenere prezzo corrente' });
        }

        // Get price history for analysis (usa klines per dati più accurati)
        console.log('🔍 [BOT-ANALYSIS] Fetching price history...');
        const priceHistoryData = await dbAll(
            "SELECT open_time, open_price, high_price, low_price, close_price FROM klines WHERE symbol = $1 AND interval = '15m' ORDER BY open_time DESC LIMIT 100",
            [symbol]
        );

        // Se non ci sono klines, usa price_history
        let historyForSignal = [];
        if (priceHistoryData && priceHistoryData.length > 0) {
            historyForSignal = priceHistoryData.reverse().map(row => {
                // ✅ FIX CRITICO: Gestisci correttamente open_time da PostgreSQL
                // PostgreSQL può restituire timestamp come numero (bigint) o come stringa
                let timestamp;
                try {
                    const openTime = row.open_time;
                    if (typeof openTime === 'number') {
                        // Se è un numero (timestamp in millisecondi o secondi)
                        timestamp = new Date(openTime > 1000000000000 ? openTime : openTime * 1000).toISOString();
                    } else if (typeof openTime === 'string') {
                        // Se è una stringa, prova a parsarla
                        timestamp = new Date(openTime).toISOString();
                    } else if (openTime instanceof Date) {
                        // Se è già un oggetto Date
                        timestamp = openTime.toISOString();
                    } else {
                        // Fallback: usa timestamp corrente
                        console.warn(`⚠️ [BOT-ANALYSIS] open_time non valido per riga:`, row);
                        timestamp = new Date().toISOString();
                    }
                } catch (e) {
                    console.error(`❌ [BOT-ANALYSIS] Errore conversione timestamp:`, e.message, 'open_time:', row.open_time);
                    timestamp = new Date().toISOString();
                }

                return {
                    price: parseFloat(row.close_price) || 0,
                    high: parseFloat(row.high_price) || 0,
                    low: parseFloat(row.low_price) || 0,
                    close: parseFloat(row.close_price) || 0,
                    timestamp: timestamp
                };
            });
        } else {
            const priceHistoryRows = await dbAll(
                "SELECT price, timestamp FROM price_history WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 100",
                [symbol]
            );
            historyForSignal = priceHistoryRows.reverse().map(row => {
                // ✅ FIX: Gestisci timestamp da price_history (potrebbe essere stringa o Date)
                let timestamp = row.timestamp;
                if (timestamp instanceof Date) {
                    timestamp = timestamp.toISOString();
                } else if (typeof timestamp === 'string') {
                    // Se è già una stringa ISO, usala direttamente
                    // Altrimenti prova a convertirla
                    try {
                        timestamp = new Date(timestamp).toISOString();
                    } catch (e) {
                        console.warn(`⚠️ [BOT-ANALYSIS] timestamp non valido:`, timestamp);
                        timestamp = new Date().toISOString();
                    }
                } else if (typeof timestamp === 'number') {
                    // Se è un numero (timestamp)
                    try {
                        timestamp = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000).toISOString();
                    } catch (e) {
                        console.warn(`⚠️ [BOT-ANALYSIS] timestamp numero non valido:`, timestamp);
                        timestamp = new Date().toISOString();
                    }
                } else {
                    // Fallback
                    console.warn(`⚠️ [BOT-ANALYSIS] timestamp tipo sconosciuto:`, typeof timestamp, timestamp);
                    timestamp = new Date().toISOString();
                }

                return {
                    price: parseFloat(row.price) || 0,
                    timestamp: timestamp
                };
            });
        }

        // ✅ FIX: Sempre aggiorna l'ultima candela con il prezzo corrente per analisi in tempo reale
        // Questo risolve il problema dei dati "bloccati" quando la candela 15m è ancora aperta
        if (historyForSignal.length > 0) {
            const lastCandle = historyForSignal[historyForSignal.length - 1];
            const lastCandleTime = new Date(lastCandle.timestamp);
            const now = new Date();
            const timeSinceLastCandle = now - lastCandleTime;

            // Se l'ultima candela è ancora aperta (< 15 minuti), aggiornala con il prezzo corrente
            if (timeSinceLastCandle < 15 * 60 * 1000) {
                console.log('🔍 [BOT-ANALYSIS] Aggiornamento ultima candela con prezzo corrente per analisi in tempo reale');
                // Aggiorna high, low, close con il prezzo corrente
                lastCandle.high = Math.max(lastCandle.high || lastCandle.close, currentPrice);
                lastCandle.low = Math.min(lastCandle.low || lastCandle.close, currentPrice);
                lastCandle.close = currentPrice;
                lastCandle.price = currentPrice; // Per backward compatibility
            }
        }

        // ✅ FALLBACK: Se DB non ha abbastanza dati O è obsoleto (> 15 min), scarica da Binance
        // Calcola staleness prima
        let isStale = false;
        if (historyForSignal.length > 0) {
            const lastTs = new Date(historyForSignal[historyForSignal.length - 1].timestamp).getTime();
            const lastClose = historyForSignal[historyForSignal.length - 1].close;
            isStale = (new Date().getTime() - lastTs) > 15 * 60 * 1000;

            // ✅ SANITY CHECK: Se DB disallineato > 10%, invalida e riscarica
            if (!isStale && currentPrice > 0 && lastClose > 0) {
                const diffPct = Math.abs(currentPrice - lastClose) / lastClose;
                if (diffPct > 0.10) { // 10%
                    console.log(`⚠️ [BOT-ANALYSIS] DB Corrotto rilevato (Diff: ${(diffPct * 100).toFixed(1)}%). Forzo refresh.`);
                    isStale = true;
                }
            }
        }

        if (!historyForSignal || historyForSignal.length < 20 || isStale) {
            console.log(`⚠️ [BOT-ANALYSIS] Data stale (${isStale}) or insufficient (${historyForSignal ? historyForSignal.length : 0}), downloading from Binance as fallback...`);
            try {
                const tradingPair = SYMBOL_TO_PAIR[symbol] || symbol.toUpperCase().replace('_', '');
                const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${tradingPair}&interval=15m&limit=100`;
                const klines = await httpsGet(binanceUrl);
                if (Array.isArray(klines) && klines.length > 0) {
                    historyForSignal = klines.map(k => ({
                        timestamp: new Date(k[0]).toISOString(),
                        open: parseFloat(k[1]),
                        high: parseFloat(k[2]),
                        low: parseFloat(k[3]),
                        close: parseFloat(k[4]),
                        price: parseFloat(k[4]),
                        volume: parseFloat(k[5])
                    }));
                    console.log(`✅ [BOT-ANALYSIS] Downloaded ${historyForSignal.length} candles from Binance`);

                    // ✅ FIX: Salva i dati freschi nel DB così lo Scanner li vede!
                    // Questo risolve la discrepanza tra Quick Analysis (fresco) e Scanner (vecchio/corrotto)
                    try {
                        // ✅ FIX: Salva SOLO le ultime 20 candele per non intasare il DB
                        const klinesToSave = klines.slice(-20);
                        const savePromises = klinesToSave.map(k => {
                            const openTime = parseInt(k[0]);
                            const open = parseFloat(k[1]);
                            const high = parseFloat(k[2]);
                            const low = parseFloat(k[3]);
                            const close = parseFloat(k[4]);
                            const volume = parseFloat(k[5]);
                            const closeTime = parseInt(k[6]);

                            // ✅ POSTGRESQL: Usa ON CONFLICT DO UPDATE invece di INSERT OR REPLACE
                            return dbRun(
                                `INSERT INTO klines 
                                (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time) 
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                                ON CONFLICT (symbol, interval, open_time) 
                                DO UPDATE SET 
                                    open_price = EXCLUDED.open_price,
                                    high_price = EXCLUDED.high_price,
                                    low_price = EXCLUDED.low_price,
                                    close_price = EXCLUDED.close_price,
                                    volume = EXCLUDED.volume,
                                    close_time = EXCLUDED.close_time`,
                                [symbol, '15m', openTime, open, high, low, close, volume, closeTime]
                            );
                        });

                        // Non bloccare la risposta, salva in background
                        Promise.all(savePromises)
                            .then(() => console.log(`💾 [BOT-ANALYSIS] Sincronizzate ${klines.length} klines nel DB per ${symbol}`))
                            .catch(err => console.error(`❌ [BOT-ANALYSIS] Errore salvataggio DB:`, err.message));

                    } catch (dbError) {
                        console.error(`❌ [BOT-ANALYSIS] Errore preparazione salvataggio:`, dbError.message);
                    }
                }
            } catch (binanceError) {
                console.error('❌ [BOT-ANALYSIS] Binance fallback failed:', binanceError.message);
            }
        }

        // ✅ FIX: Sempre aggiorna l'ultima candela con il prezzo corrente per analisi in tempo reale
        // Questo allinea la logica con il Market Scanner
        if (historyForSignal.length > 0) {
            const lastCandle = historyForSignal[historyForSignal.length - 1];
            // Aggiorna sempre close con currentPrice per RSI in tempo reale
            lastCandle.close = currentPrice;
            lastCandle.price = currentPrice;
            // Aggiorna high/low solo se ha senso (es. se siamo ancora nella stessa candela temporale)
            // o se la candela è stata appena aggiornata.
            // Per semplicità e coerenza RSI, forziamo high/low a includere currentPrice
            lastCandle.high = Math.max(lastCandle.high, currentPrice);
            lastCandle.low = Math.min(lastCandle.low, currentPrice);
        }

        // ❌ DISABILITATO: Scaricamento da Binance causa rate limit 503 per simboli USDT
        // Usa invece i dati dal DB che vengono aggiornati dal bot ogni 15 minuti
        console.log('🔍 [BOT-ANALYSIS] Uso dati dal DB (aggiornati dal bot ogni 15min) per evitare rate limit Binance');
        /* COMMENTATO PER EVITARE RATE LIMIT
        try {
            const tradingPair = SYMBOL_TO_PAIR[symbol] || symbol.toUpperCase().replace('_', '');
            const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${tradingPair}&interval=15m&limit=100`;
            console.log(`🔍 [BOT-ANALYSIS] Fetching klines from ${binanceUrl}`);
        
            const klines = await httpsGet(binanceUrl);
        
            if (Array.isArray(klines) && klines.length > 0) {
                historyForSignal = klines.map(k => ({
                    timestamp: new Date(k[0]).toISOString(),
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    price: parseFloat(k[4]), // compatibilità
                    volume: parseFloat(k[5])
                }));
                console.log(`✅ [BOT-ANALYSIS] Scaricate ${historyForSignal.length} candele FRESCHE da Binance`);
        
                // ✅ Aggiorna anche l'ultima candela scaricata da Binance con il prezzo corrente
                if (historyForSignal.length > 0) {
                    const lastBinanceCandle = historyForSignal[historyForSignal.length - 1];
                    const lastBinanceCandleTime = new Date(lastBinanceCandle.timestamp);
                    const timeSinceBinanceCandle = new Date() - lastBinanceCandleTime;
        
                    if (timeSinceBinanceCandle < 15 * 60 * 1000) {
                        console.log('🔍 [BOT-ANALYSIS] Aggiornamento ultima candela Binance con prezzo corrente');
                        lastBinanceCandle.high = Math.max(lastBinanceCandle.high, currentPrice);
                        lastBinanceCandle.low = Math.min(lastBinanceCandle.low, currentPrice);
                        lastBinanceCandle.close = currentPrice;
                        lastBinanceCandle.price = currentPrice;
                    }
                }
            }
        } catch (binanceError) {
            console.error('❌ [BOT-ANALYSIS] Errore scaricamento Binance:', binanceError.message);
            // Continua con i dati vecchi se fallisce
        }
        */  // FINE BLOCCO COMMENTATO

        // Generate signal with full details
        console.log('🔍 [BOT-ANALYSIS] History length:', historyForSignal ? historyForSignal.length : 0);
        if (!historyForSignal || historyForSignal.length === 0) {
            console.error('❌ [BOT-ANALYSIS] Nessun dato storico disponibile');
            return res.status(500).json({ error: 'Nessun dato storico disponibile per l\'analisi' });
        }

        console.log('🔍 [BOT-ANALYSIS] Generating signal...');
        let signal;
        try {
            signal = signalGenerator.generateSignal(historyForSignal);
            console.log('🔍 [BOT-ANALYSIS] Signal generated:', signal ? signal.direction : 'null');
        } catch (signalError) {
            console.error('❌ [BOT-ANALYSIS] Errore nella generazione del segnale:', signalError.message);
            console.error('❌ [BOT-ANALYSIS] Stack trace:', signalError.stack);
            return res.status(500).json({
                error: 'Errore nella generazione del segnale',
                details: signalError.message
            });
        }

        if (!signal || !signal.indicators) {
            console.error('❌ [BOT-ANALYSIS] Segnale generato ma incompleto:', signal);
            return res.status(500).json({ error: 'Errore nella generazione del segnale: dati incompleti' });
        }

        // ✅ FIX CRITICO: Calcola ATR e signal.atrBlocked anche nell'endpoint bot-analysis
        // Questo è necessario perché alcuni segnali potrebbero avere ATR che blocca il trading
        // e senza questo calcolo, signal.atrBlocked sarebbe undefined causando UI bloccata
        try {
            const highs = historyForSignal.map(k => k.high || k.price || 0);
            const lows = historyForSignal.map(k => k.low || k.price || 0);
            const closes = historyForSignal.map(k => k.close || k.price || 0);
            const atr = signalGenerator.calculateATR(highs, lows, closes, 14);

            if (atr && historyForSignal.length > 0) {
                const lastCandle = historyForSignal[historyForSignal.length - 1];
                const currentPriceForATR = lastCandle.close || lastCandle.price || currentPrice;
                if (currentPriceForATR > 0) {
                    const atrPct = (atr / currentPriceForATR) * 100;

                    // ✅ SMART ATR FILTERING: Stessa logica del bot reale
                    const MIN_ATR_FOR_STRONG_SIGNAL = 0.2;
                    const MIN_ATR_FOR_NORMAL_SIGNAL = 0.3;
                    const MAX_ATR_PCT = 5.0;
                    const STRONG_SIGNAL_THRESHOLD = 90;

                    const isStrongSignal = signal.strength >= STRONG_SIGNAL_THRESHOLD;
                    const minAtrRequired = isStrongSignal ? MIN_ATR_FOR_STRONG_SIGNAL : MIN_ATR_FOR_NORMAL_SIGNAL;

                    signal.atrBlocked = atrPct < minAtrRequired || atrPct > MAX_ATR_PCT;
                    signal.atrPct = atrPct;
                    signal.minAtrRequired = minAtrRequired;

                    console.log(`🔍 [BOT-ANALYSIS] ATR calculated: ${atrPct.toFixed(2)}%, Blocked: ${signal.atrBlocked}, Min required: ${minAtrRequired}%`);
                } else {
                    signal.atrBlocked = false;
                    signal.atrPct = 0;
                }
            } else {
                signal.atrBlocked = false;
                signal.atrPct = 0;
            }
        } catch (atrError) {
            console.error('❌ [BOT-ANALYSIS] Error calculating ATR:', atrError.message);
            signal.atrBlocked = false;
            signal.atrPct = 0;
        }

        console.log('🔍 [BOT-ANALYSIS] Getting indicators...');
        // ✅ FIX: Ricalcola RSI FRESH (stessa logica di Market Scanner) invece di usare cache
        // Questo garantisce che RSI sia identico tra Market Scanner e Bot Analysis
        const indicators = signal.indicators || {};

        // Ricalcola RSI con dati aggiornati
        let rsi = indicators.rsi; // Fallback
        try {
            const prices = historyForSignal.map(h => h.close || h.price);
            if (prices.length >= 15) {
                rsi = calculateRSI(prices, 14);
                console.log(`📊 [BOT-ANALYSIS] ${symbol}: RSI=${rsi?.toFixed(2)} | Prices: ${prices.length} | LastPrice: ${prices[prices.length - 1]?.toFixed(4)} | CurrentPrice: ${currentPrice?.toFixed(4)}`);
            } else {
                console.warn(`⚠️ [BOT-ANALYSIS] Dati insufficienti per RSI (${prices.length} candele), uso cache`);
            }
        } catch (rsiError) {
            console.error('❌ [BOT-ANALYSIS] Errore ricalcolo RSI:', rsiError.message);
            // Usa RSI dalla cache se ricalcolo fallisce
        }


        console.log('🔍 [BOT-ANALYSIS] Getting risk check...');
        // Get bot parameters (pass symbol for specific config)
        // ✅ FIX: Se il simbolo non ha bot_settings, crea entry di default con bot ATTIVO
        let params = await getBotParameters(symbol);

        // Verifica se esiste entry in bot_settings, se non c'è creala
        const botSettingsCheck = await dbGet("SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = ?", [symbol]);
        if (!botSettingsCheck) {
            console.log(`📝 [BOT-ANALYSIS] Creazione bot_settings per ${symbol} (default: ATTIVO)`);
            const DEFAULT_PARAMS = {
                rsi_period: 14,
                rsi_oversold: 30,
                rsi_overbought: 70,
                stop_loss_pct: 2.0,
                take_profit_pct: 3.0,
                trade_size_usdt: 50,
                trailing_stop_enabled: false,
                trailing_stop_distance_pct: 1.0,
                partial_close_enabled: false,
                take_profit_1_pct: 1.5,
                take_profit_2_pct: 3.0
            };
            await dbRun(
                "INSERT INTO bot_settings (strategy_name, symbol, is_active, parameters) VALUES (?, ?, ?, ?)",
                ['RSI_Strategy', symbol, 1, JSON.stringify(DEFAULT_PARAMS)] // Default: ATTIVO (1)
            );
            console.log(`✅ [BOT-ANALYSIS] Bot settings creati per ${symbol} (ATTIVO di default)`);
        }

        // Risk check
        const riskCheck = await riskManager.calculateMaxRisk();

        // Get ALL open positions to check global limits (Hybrid Strategy)
        const allOpenPositions = await dbAll(
            "SELECT * FROM open_positions WHERE status = 'open'"
        );
        console.log(`📊 [BOT-ANALYSIS] Global Open Positions: ${allOpenPositions.length}`);

        // Filter for current symbol stats
        const openPositions = allOpenPositions.filter(p => p.symbol === symbol);

        const longPositions = openPositions.filter(p => p.type === 'buy');
        const shortPositions = openPositions.filter(p => p.type === 'sell');

        // Calculate what's needed for LONG
        const LONG_MIN_CONFIRMATIONS = 3; // Abbassato da 4 per più opportunità
        const LONG_MIN_STRENGTH = 60; // Abbassato da 70 per più opportunità

        // ✅ FIX: Mostra SEMPRE i valori parziali di longSignal, indipendentemente da direction
        // Questo rende il Quick Analysis coerente con il Market Scanner
        let longCurrentStrength = signal.longSignal?.strength || 0;
        let longCurrentConfirmations = signal.longSignal?.confirmations || 0;

        const longNeedsConfirmations = Math.max(0, LONG_MIN_CONFIRMATIONS - longCurrentConfirmations);
        const longNeedsStrength = Math.max(0, LONG_MIN_STRENGTH - longCurrentStrength);
        // ✅ FIX: Calcola MTF PRIMA e poi verifica requirements con adjusted strength
        // (Questo viene ricalcolato più in basso dopo il calcolo MTF)
        const longMeetsRequirementsInitial = signal.direction === 'LONG' &&
            signal.strength >= LONG_MIN_STRENGTH &&
            signal.confirmations >= LONG_MIN_CONFIRMATIONS;

        // Calculate what's needed for SHORT
        const SHORT_MIN_CONFIRMATIONS = 4; // Abbassato da 5 per più opportunità
        const SHORT_MIN_STRENGTH = 60; // Abbassato da 70 per più opportunità

        // ✅ FIX: Mostra SEMPRE i valori parziali di shortSignal, indipendentemente da direction
        // Questo rende il Quick Analysis coerente con il Market Scanner
        let shortCurrentStrength = signal.shortSignal?.strength || 0;
        let shortCurrentConfirmations = signal.shortSignal?.confirmations || 0;

        const shortNeedsConfirmations = Math.max(0, SHORT_MIN_CONFIRMATIONS - shortCurrentConfirmations);
        const shortNeedsStrength = Math.max(0, SHORT_MIN_STRENGTH - shortCurrentStrength);
        // ✅ FIX: Calcola MTF PRIMA e poi verifica requirements con adjusted strength
        // (Questo viene spostato più in basso dopo il calcolo MTF)
        const shortMeetsRequirementsInitial = signal.direction === 'SHORT' &&
            signal.strength >= SHORT_MIN_STRENGTH &&
            signal.confirmations >= SHORT_MIN_CONFIRMATIONS;

        // ✅ MULTI-TIMEFRAME CONFIRMATION - Calcola trend e adjusted strength
        console.log('🔍 [BOT-ANALYSIS] Calculating MTF...');
        let trend1h = 'neutral';
        let trend4h = 'neutral';

        try {
            trend1h = await detectTrendOnTimeframe(symbol, '1h', 50);
            trend4h = await detectTrendOnTimeframe(symbol, '4h', 50);
            console.log('✅ [BOT-ANALYSIS] MTF calculated:', { trend1h, trend4h });
        } catch (mtfError) {
            console.error('❌ [BOT-ANALYSIS] MTF calculation failed, using neutral:', mtfError.message);
            // Fallback: usa neutral per non bloccare l'analisi
            trend1h = 'neutral';
            trend4h = 'neutral';
        }

        // ✅ Calcola MTF bonus per LONG
        let longMtfBonus = 0;
        let longMtfReason = '';
        if (signal.direction === 'LONG' || longCurrentStrength > 0) {
            if (trend1h === 'bullish' && trend4h === 'bullish') {
                longMtfBonus = +10;
                longMtfReason = '✅ All timeframes bullish (+10)';
            } else if (trend1h === 'bullish' || trend4h === 'bullish') {
                longMtfBonus = +5;
                longMtfReason = '✅ Partial alignment (+5)';
            } else if (trend1h === 'bearish' || trend4h === 'bearish') {
                longMtfBonus = -15;
                longMtfReason = '⚠️ Higher timeframe bearish (-15)';
            } else {
                longMtfBonus = 0;
                longMtfReason = '➡️ Neutral timeframes (0)';
            }
        }

        // ✅ Calcola MTF bonus per SHORT
        let shortMtfBonus = 0;
        let shortMtfReason = '';
        if (signal.direction === 'SHORT' || shortCurrentStrength > 0) {
            if (trend1h === 'bearish' && trend4h === 'bearish') {
                shortMtfBonus = +10;
                shortMtfReason = '✅ All timeframes bearish (+10)';
            } else if (trend1h === 'bearish' || trend4h === 'bearish') {
                shortMtfBonus = +5;
                shortMtfReason = '✅ Partial alignment (+5)';
            } else if (trend1h === 'bullish' || trend4h === 'bullish') {
                shortMtfBonus = -15;
                shortMtfReason = '⚠️ Higher timeframe bullish (-15)';
            } else {
                shortMtfBonus = 0;
                shortMtfReason = '➡️ Neutral timeframes (0)';
            }
        }

        // ✅ CHECK DATA FRESHNESS (Diagnostic Discrepancy)
        const last15m = await dbGet("SELECT MAX(open_time) as last FROM klines WHERE symbol = ? AND interval = '15m'", [symbol]);
        const last1h = await dbGet("SELECT MAX(open_time) as last FROM klines WHERE symbol = ? AND interval = '1h'", [symbol]);

        const now = Date.now();
        const freshnessBlockers = [];

        // Check if Bot is Active in DB
        // ✅ FIX: Se non c'è entry in bot_settings, considera il bot ATTIVO di default (per nuovi simboli)
        // Questo permette ai nuovi simboli di funzionare senza doverli attivare manualmente
        const botSettings = await dbGet("SELECT is_active FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = ?", [symbol]);
        console.log(`🔍 [BOT-DEBUG] Symbol: ${symbol}, Settings found: ${!!botSettings}, Active: ${botSettings ? botSettings.is_active : 'DEFAULT (1)'}`);
        const isBotActive = botSettings ? (Number(botSettings.is_active) === 1) : true; // Default: attivo se non esiste entry

        if (!isBotActive) {
            freshnessBlockers.push({
                type: 'Bot Disabilitato',
                reason: 'Il bot non è attivo su questa moneta. Attivalo dalla Dashboard.',
                severity: 'high'
            });
        } else {
            // Check 15m freshness (Cycle heartbeat)
            // ✅ FIX: Soglia più permissiva - il bot aggiorna ogni 15 minuti, quindi 60 minuti è accettabile
            // (considera che potrebbe esserci un ritardo o che il bot non è ancora partito per questo simbolo)
            if (last15m && last15m.last) {
                const ageMinutes = (now - last15m.last) / 1000 / 60;
                // ✅ Soglia aumentata a 90 minuti (6 candele) invece di 45
                // Questo evita falsi positivi quando il bot non ha ancora processato il simbolo
                if (ageMinutes > 90) {
                    freshnessBlockers.push({
                        type: 'Dati Obsoleti (15m)',
                        reason: `Il bot non aggiorna i dati da ${ageMinutes.toFixed(0)} minuti. Verifica che il bot sia attivo per questo simbolo.`,
                        severity: 'medium' // ✅ Cambiato da 'high' a 'medium' - non blocca, solo avvisa
                    });
                }
            } else {
                // ✅ Non è un blocker critico se non ci sono dati - potrebbe essere un nuovo simbolo
                freshnessBlockers.push({
                    type: 'Dati Mancanti',
                    reason: 'Nessun dato storico a 15m trovato. Il bot creerà i dati al prossimo ciclo.',
                    severity: 'medium' // ✅ Cambiato da 'high' a 'medium'
                });
            }

            // Check 1h freshness (Trend analysis)
            if (last1h && last1h.last) {
                const ageMinutes = (now - last1h.last) / 1000 / 60;
                if (ageMinutes > 150) { // > 2.5 hours
                    freshnessBlockers.push({
                        type: 'Dati Obsoleti (1h)',
                        reason: `Trend 1h basato su dati vecchi di ${ageMinutes.toFixed(0)} minuti. Analisi inaffidabile.`,
                        severity: 'medium'
                    });
                }
            }
        }

        // ✅ Check Volume
        const volume24h = await get24hVolume(symbol).catch(() => 0);
        const MIN_VOLUME = 500_000;
        const volumeBlocked = volume24h < MIN_VOLUME;

        // ✅ Check Hybrid Strategy (pass ALL positions)
        const hybridCheck = await canOpenPositionHybridStrategy(symbol, allOpenPositions);
        console.log(`📊 [BOT-ANALYSIS] Hybrid Check: ${hybridCheck.allowed ? 'OK' : 'BLOCKED'} (${hybridCheck.reason})`);

        const longAdjustedStrength = longCurrentStrength + longMtfBonus;
        const shortAdjustedStrength = shortCurrentStrength + shortMtfBonus;

        console.log(`📊 [MTF] LONG: ${longCurrentStrength} + ${longMtfBonus} = ${longAdjustedStrength} | SHORT: ${shortCurrentStrength} + ${shortMtfBonus} = ${shortAdjustedStrength}`);
        console.log(`📊 [MTF] Trends: 1h=${trend1h}, 4h=${trend4h}`);

        // ✅ FIX CRITICO: Ricalcola requirements con adjusted strength e controllo ATR (stessa logica del bot reale)
        const MIN_SIGNAL_STRENGTH = 70; // Stessa soglia del bot reale
        const longMeetsRequirements = signal.direction === 'LONG' &&
            longAdjustedStrength >= MIN_SIGNAL_STRENGTH &&
            signal.confirmations >= LONG_MIN_CONFIRMATIONS &&
            !(signal.atrBlocked || false);

        const shortMeetsRequirements = signal.direction === 'SHORT' &&
            shortAdjustedStrength >= MIN_SIGNAL_STRENGTH &&
            signal.confirmations >= SHORT_MIN_CONFIRMATIONS &&
            !(signal.atrBlocked || false);

        // Calculate max position size
        const maxAvailableForNewPosition = Math.min(
            params.trade_size_eur,
            riskCheck.maxPositionSize,
            riskCheck.availableExposure * 0.5 // ✅ FIX: Aumentato a 50% per sbloccare conti piccoli
        );

        const canOpenCheck = await riskManager.canOpenPosition(maxAvailableForNewPosition);

        // Determine why it can't open
        let longReason = '';
        let shortReason = '';

        if (signal.direction === 'LONG') {
            if (longMeetsRequirements && canOpenCheck.allowed) {
                longReason = '✅ PRONTO AD APRIRE LONG';
            } else if (!longMeetsRequirements) {
                if (longNeedsStrength > 0 && longNeedsConfirmations > 0) {
                    longReason = `Serve strength +${longNeedsStrength} e ${longNeedsConfirmations} conferme in più`;
                } else if (longNeedsStrength > 0) {
                    longReason = `Serve strength +${longNeedsStrength} punti`;
                } else if (longNeedsConfirmations > 0) {
                    longReason = `Serve ${longNeedsConfirmations} conferme in più`;
                } else {
                    longReason = signal.reasons[0] || 'Segnale non abbastanza forte';
                }
            } else {
                longReason = canOpenCheck.reason || 'Risk manager blocca';
            }
        } else if (signal.direction === 'SHORT') {
            // ✅ FIX: Verifica anche ATR blocking e MTF adjustment
            if (shortMeetsRequirements && canOpenCheck.allowed) {
                shortReason = '✅ PRONTO AD APRIRE SHORT';
            } else if (signal.atrBlocked) {
                shortReason = `ATR blocca trading (${signal.atrPct?.toFixed(2)}% ${signal.atrPct < signal.minAtrRequired ? '<' : '>'} ${signal.minAtrRequired}%)`;
            } else if (shortAdjustedStrength < MIN_SIGNAL_STRENGTH) {
                shortReason = `Strength aggiustata insufficiente: ${shortAdjustedStrength} < ${MIN_SIGNAL_STRENGTH} (original: ${shortCurrentStrength}, MTF: ${shortMtfBonus >= 0 ? '+' : ''}${shortMtfBonus})`;
            } else if (!shortMeetsRequirements) {
                if (shortNeedsStrength > 0 && shortNeedsConfirmations > 0) {
                    shortReason = `Serve strength +${shortNeedsStrength} e ${shortNeedsConfirmations} conferme in più`;
                } else if (shortNeedsStrength > 0) {
                    shortReason = `Serve strength +${shortNeedsStrength} punti`;
                } else if (shortNeedsConfirmations > 0) {
                    shortReason = `Serve ${shortNeedsConfirmations} conferme in più`;
                } else {
                    shortReason = signal.reasons[0] || 'Segnale non abbastanza forte';
                }
            } else {
                shortReason = canOpenCheck.reason || 'Risk manager blocca';
            }
        } else {
            longReason = 'Nessun segnale LONG attivo';
            shortReason = 'Nessun segnale SHORT attivo';
        }

        console.log('🔍 [BOT-ANALYSIS] Preparing response...');

        // Estrai le conferme ottenute (reasons) per LONG e SHORT
        const longConfirmationsList = signal.longSignal && signal.longSignal.reasons ? signal.longSignal.reasons : [];
        const shortConfirmationsList = signal.shortSignal && signal.shortSignal.reasons ? signal.shortSignal.reasons : [];

        // Estrai i contributi allo Strength per LONG e SHORT
        // ✅ FIX: Mostra contributi SOLO se longCurrentStrength > 0 (altrimenti sono fuorvianti)
        // Se longCurrentStrength è 0, non mostrare contributi anche se esistono in longSignal
        const longStrengthContributions = (longCurrentStrength > 0 && signal.longSignal && signal.longSignal.strengthContributions)
            ? signal.longSignal.strengthContributions
            : [];
        // ✅ FIX: Mostra contributi SOLO se shortCurrentStrength > 0 (altrimenti sono fuorvianti)
        const shortStrengthContributions = (shortCurrentStrength > 0 && signal.shortSignal && signal.shortSignal.strengthContributions)
            ? signal.shortSignal.strengthContributions
            : [];

        res.json({
            currentPrice,
            rsi: rsi || 0,
            signal: {
                direction: signal.direction,
                strength: signal.strength || 0,
                confirmations: signal.confirmations || 0,
                reasons: signal.reasons || [],
                indicators: signal.indicators || {}
            },
            requirements: {
                long: {
                    minStrength: LONG_MIN_STRENGTH,
                    minConfirmations: LONG_MIN_CONFIRMATIONS,
                    currentStrength: longAdjustedStrength, // ✅ FIX: Usa adjusted strength (con MTF bonus) invece di raw strength
                    currentConfirmations: longCurrentConfirmations,
                    needsStrength: longNeedsStrength,
                    needsConfirmations: longNeedsConfirmations,
                    canOpen: longMeetsRequirements && canOpenCheck.allowed,
                    reason: longReason,
                    confirmationsList: [], // Lista delle conferme ottenute - RIMOSSA
                    strengthContributions: longStrengthContributions // Lista dei contributi allo Strength con punti
                },
                short: {
                    minStrength: SHORT_MIN_STRENGTH,
                    minConfirmations: SHORT_MIN_CONFIRMATIONS,
                    currentStrength: shortAdjustedStrength, // ✅ FIX: Usa adjusted strength (con MTF bonus) invece di raw strength
                    currentConfirmations: shortCurrentConfirmations,
                    needsStrength: shortNeedsStrength,
                    needsConfirmations: shortNeedsConfirmations,
                    canOpen: shortMeetsRequirements && canOpenCheck.allowed,
                    reason: shortReason,
                    confirmationsList: [], // Lista delle conferme ottenute - RIMOSSA
                    strengthContributions: shortStrengthContributions // Lista dei contributi allo Strength con punti
                }
            },
            mtf: {
                trend1h,
                trend4h,
                long: {
                    bonus: longMtfBonus,
                    reason: longMtfReason,
                    adjustedStrength: longAdjustedStrength,
                    originalStrength: longCurrentStrength
                },
                short: {
                    bonus: shortMtfBonus,
                    reason: shortMtfReason,
                    adjustedStrength: shortAdjustedStrength,
                    originalStrength: shortCurrentStrength
                }
            },
            risk: {
                canTrade: riskCheck.canTrade,
                reason: riskCheck.reason || 'OK',
                dailyLoss: riskCheck.dailyLoss * 100,
                currentExposure: riskCheck.currentExposure * 100,
                availableExposure: riskCheck.availableExposure,
                maxPositionSize: riskCheck.maxPositionSize,
                maxAvailableForNewPosition
            },
            positions: {
                long: longPositions.length,
                short: shortPositions.length,
                total: openPositions.length
            },
            botParameters: {
                rsiPeriod: params.rsi_period,
                stopLossPct: params.stop_loss_pct,
                takeProfitPct: params.take_profit_pct,
                tradeSizeEur: params.trade_size_eur
            },
            // 🎯 READINESS ANALYSIS - Cosa vede il bot e perché (non) apre
            readiness: {
                long: (() => {
                    const analysis = {
                        canOpen: longMeetsRequirements && canOpenCheck.allowed,
                        status: 'not_ready', // 'ready', 'waiting', 'blocked'
                        positiveSignals: [], // Cosa è positivo
                        missingRequirements: [], // Cosa manca
                        professionalFilters: [], // Filtri professionali attivi
                        summary: ''
                    };

                    // 1. SEGNALI POSITIVI (cosa vede di buono)
                    if (longStrengthContributions.length > 0) {
                        longStrengthContributions.forEach(contrib => {
                            analysis.positiveSignals.push({
                                indicator: contrib.indicator,
                                points: contrib.points,
                                reason: contrib.reason,
                                emoji: '✅'
                            });
                        });
                    }

                    // 2. COSA MANCA (requirements non soddisfatti)
                    if (longNeedsStrength > 0) {
                        analysis.missingRequirements.push({
                            type: 'Strength',
                            current: longAdjustedStrength,
                            required: LONG_MIN_STRENGTH,
                            missing: longNeedsStrength,
                            message: `Serve +${longNeedsStrength} punti di strength (${longAdjustedStrength}/${LONG_MIN_STRENGTH})`,
                            emoji: '⏳'
                        });
                    }

                    if (longNeedsConfirmations > 0) {
                        analysis.missingRequirements.push({
                            type: 'Confirmations',
                            current: longCurrentConfirmations,
                            required: LONG_MIN_CONFIRMATIONS,
                            missing: longNeedsConfirmations,
                            message: `Serve ${longNeedsConfirmations} conferme in più (${longCurrentConfirmations}/${LONG_MIN_CONFIRMATIONS})`,
                            emoji: '⏳'
                        });
                    }

                    // 3. FILTRI PROFESSIONALI (da signal.professionalAnalysis se disponibile)
                    if (signal.professionalAnalysis) {
                        const prof = signal.professionalAnalysis;

                        // Momentum Quality
                        if (prof.momentumQuality) {
                            if (!prof.momentumQuality.isHealthy && longAdjustedStrength > 0) {
                                analysis.professionalFilters.push({
                                    type: 'Momentum Quality',
                                    status: 'warning',
                                    score: prof.momentumQuality.score,
                                    warnings: prof.momentumQuality.warnings,
                                    message: `Momentum quality: ${prof.momentumQuality.score}/100 - ${prof.momentumQuality.warnings.join(', ')}`,
                                    emoji: '⚠️'
                                });
                            } else if (prof.momentumQuality.isHealthy && longAdjustedStrength > 0) {
                                analysis.professionalFilters.push({
                                    type: 'Momentum Quality',
                                    status: 'ok',
                                    score: prof.momentumQuality.score,
                                    message: `Momentum quality: ${prof.momentumQuality.score}/100 - Healthy`,
                                    emoji: '✅'
                                });
                            }
                        }

                        // Reversal Risk
                        if (prof.reversalRisk) {
                            if (prof.reversalRisk.risk === 'high' || prof.reversalRisk.risk === 'medium') {
                                analysis.professionalFilters.push({
                                    type: 'Reversal Risk',
                                    status: 'warning',
                                    risk: prof.reversalRisk.risk,
                                    score: prof.reversalRisk.score,
                                    reasons: prof.reversalRisk.reasons,
                                    message: `Reversal risk: ${prof.reversalRisk.risk.toUpperCase()} (${prof.reversalRisk.score}/100) - ${prof.reversalRisk.reasons[0] || ''}`,
                                    emoji: '🚫'
                                });
                            } else if (prof.reversalRisk.risk === 'low') {
                                analysis.professionalFilters.push({
                                    type: 'Reversal Risk',
                                    status: 'ok',
                                    risk: prof.reversalRisk.risk,
                                    score: prof.reversalRisk.score,
                                    message: `Reversal risk: LOW (${prof.reversalRisk.score}/100)`,
                                    emoji: '✅'
                                });
                            }
                        }

                        // Market Structure
                        if (prof.marketStructure && prof.marketStructure.nearestResistance) {
                            const distancePct = (prof.marketStructure.nearestResistance.distance * 100).toFixed(2);
                            if (prof.marketStructure.nearestResistance.distance < 0.02) {
                                analysis.professionalFilters.push({
                                    type: 'Market Structure',
                                    status: 'warning',
                                    message: `Vicino a resistenza (${distancePct}% distanza) a €${prof.marketStructure.nearestResistance.price.toFixed(2)}`,
                                    emoji: '⚠️'
                                });
                            } else {
                                analysis.professionalFilters.push({
                                    type: 'Market Structure',
                                    status: 'ok',
                                    message: `Resistenza a ${distancePct}% distanza (€${prof.marketStructure.nearestResistance.price.toFixed(2)})`,
                                    emoji: '✅'
                                });
                            }
                        }

                        // Risk/Reward
                        if (prof.riskReward) {
                            if (!prof.riskReward.isAcceptable) {
                                analysis.professionalFilters.push({
                                    type: 'Risk/Reward',
                                    status: 'warning',
                                    ratio: prof.riskReward.ratio,
                                    message: `R/R ratio: 1:${prof.riskReward.ratio.toFixed(2)} (minimo 1:1.5 richiesto)`,
                                    emoji: '⚠️'
                                });
                            } else {
                                analysis.professionalFilters.push({
                                    type: 'Risk/Reward',
                                    status: 'ok',
                                    ratio: prof.riskReward.ratio,
                                    message: `R/R ratio: 1:${prof.riskReward.ratio.toFixed(2)} ✅`,
                                    emoji: '✅'
                                });
                            }
                        }
                    }

                    // 4. DETERMINA STATUS E SUMMARY
                    if (analysis.canOpen) {
                        analysis.status = 'ready';
                        analysis.summary = `✅ PRONTO AD APRIRE LONG - Tutti i requisiti soddisfatti (Strength: ${longAdjustedStrength}/${LONG_MIN_STRENGTH}, Confirmations: ${longCurrentConfirmations}/${LONG_MIN_CONFIRMATIONS})`;
                    } else if (analysis.missingRequirements.length > 0) {
                        analysis.status = 'waiting';
                        const missing = analysis.missingRequirements.map(m => m.message).join(', ');
                        analysis.summary = `⏳ IN ATTESA - ${missing}`;
                    } else if (analysis.professionalFilters.some(f => f.status === 'warning')) {
                        analysis.status = 'blocked';
                        const warnings = analysis.professionalFilters.filter(f => f.status === 'warning').map(f => f.message).join(', ');
                        analysis.summary = `🚫 BLOCCATO DA FILTRI PROFESSIONALI - ${warnings}`;
                    } else {
                        analysis.status = 'blocked';
                        analysis.summary = longReason;
                    }

                    return analysis;
                })(),
                short: (() => {
                    const analysis = {
                        canOpen: shortMeetsRequirements && canOpenCheck.allowed,
                        status: 'not_ready',
                        positiveSignals: [],
                        missingRequirements: [],
                        professionalFilters: [],
                        summary: ''
                    };

                    // 1. SEGNALI POSITIVI
                    if (shortStrengthContributions.length > 0) {
                        shortStrengthContributions.forEach(contrib => {
                            analysis.positiveSignals.push({
                                indicator: contrib.indicator,
                                points: contrib.points,
                                reason: contrib.reason,
                                emoji: '✅'
                            });
                        });
                    }

                    // 2. COSA MANCA
                    if (shortNeedsStrength > 0) {
                        analysis.missingRequirements.push({
                            type: 'Strength',
                            current: shortAdjustedStrength,
                            required: SHORT_MIN_STRENGTH,
                            missing: shortNeedsStrength,
                            message: `Serve +${shortNeedsStrength} punti di strength (${shortAdjustedStrength}/${SHORT_MIN_STRENGTH})`,
                            emoji: '⏳'
                        });
                    }

                    if (shortNeedsConfirmations > 0) {
                        analysis.missingRequirements.push({
                            type: 'Confirmations',
                            current: shortCurrentConfirmations,
                            required: SHORT_MIN_CONFIRMATIONS,
                            missing: shortNeedsConfirmations,
                            message: `Serve ${shortNeedsConfirmations} conferme in più (${shortCurrentConfirmations}/${SHORT_MIN_CONFIRMATIONS})`,
                            emoji: '⏳'
                        });
                    }

                    // 3. FILTRI PROFESSIONALI
                    if (signal.professionalAnalysis) {
                        const prof = signal.professionalAnalysis;

                        // Momentum Quality
                        if (prof.momentumQuality) {
                            if (!prof.momentumQuality.isHealthy && shortAdjustedStrength > 0) {
                                analysis.professionalFilters.push({
                                    type: 'Momentum Quality',
                                    status: 'warning',
                                    score: prof.momentumQuality.score,
                                    warnings: prof.momentumQuality.warnings,
                                    message: `Momentum quality: ${prof.momentumQuality.score}/100 - ${prof.momentumQuality.warnings.join(', ')}`,
                                    emoji: '⚠️'
                                });
                            } else if (prof.momentumQuality.isHealthy && shortAdjustedStrength > 0) {
                                analysis.professionalFilters.push({
                                    type: 'Momentum Quality',
                                    status: 'ok',
                                    score: prof.momentumQuality.score,
                                    message: `Momentum quality: ${prof.momentumQuality.score}/100 - Healthy`,
                                    emoji: '✅'
                                });
                            }
                        }

                        // Reversal Risk
                        if (prof.reversalRisk) {
                            if (prof.reversalRisk.risk === 'high' || prof.reversalRisk.risk === 'medium') {
                                analysis.professionalFilters.push({
                                    type: 'Reversal Risk',
                                    status: 'warning',
                                    risk: prof.reversalRisk.risk,
                                    score: prof.reversalRisk.score,
                                    reasons: prof.reversalRisk.reasons,
                                    message: `Reversal risk: ${prof.reversalRisk.risk.toUpperCase()} (${prof.reversalRisk.score}/100) - ${prof.reversalRisk.reasons[0] || ''}`,
                                    emoji: '🚫'
                                });
                            } else if (prof.reversalRisk.risk === 'low') {
                                analysis.professionalFilters.push({
                                    type: 'Reversal Risk',
                                    status: 'ok',
                                    risk: prof.reversalRisk.risk,
                                    score: prof.reversalRisk.score,
                                    message: `Reversal risk: LOW (${prof.reversalRisk.score}/100)`,
                                    emoji: '✅'
                                });
                            }
                        }

                        // Market Structure
                        if (prof.marketStructure && prof.marketStructure.nearestSupport) {
                            const distancePct = (prof.marketStructure.nearestSupport.distance * 100).toFixed(2);
                            if (prof.marketStructure.nearestSupport.distance < 0.02) {
                                analysis.professionalFilters.push({
                                    type: 'Market Structure',
                                    status: 'warning',
                                    message: `Vicino a supporto (${distancePct}% distanza) a €${prof.marketStructure.nearestSupport.price.toFixed(2)}`,
                                    emoji: '⚠️'
                                });
                            } else {
                                analysis.professionalFilters.push({
                                    type: 'Market Structure',
                                    status: 'ok',
                                    message: `Supporto a ${distancePct}% distanza (€${prof.marketStructure.nearestSupport.price.toFixed(2)})`,
                                    emoji: '✅'
                                });
                            }
                        }
                    }

                    // 4. DETERMINA STATUS E SUMMARY
                    if (analysis.canOpen) {
                        analysis.status = 'ready';
                        analysis.summary = `✅ PRONTO AD APRIRE SHORT - Tutti i requisiti soddisfatti (Strength: ${shortAdjustedStrength}/${SHORT_MIN_STRENGTH}, Confirmations: ${shortCurrentConfirmations}/${SHORT_MIN_CONFIRMATIONS})`;
                    } else if (analysis.missingRequirements.length > 0) {
                        analysis.status = 'waiting';
                        const missing = analysis.missingRequirements.map(m => m.message).join(', ');
                        analysis.summary = `⏳ IN ATTESA - ${missing}`;
                    } else if (analysis.professionalFilters.some(f => f.status === 'warning')) {
                        analysis.status = 'blocked';
                        const warnings = analysis.professionalFilters.filter(f => f.status === 'warning').map(f => f.message).join(', ');
                        analysis.summary = `🚫 BLOCCATO DA FILTRI PROFESSIONALI - ${warnings}`;
                    } else {
                        analysis.status = 'blocked';
                        analysis.summary = shortReason;
                    }

                    return analysis;
                })()
            },
            blockers: {
                long: (() => {
                    const blocks = [];
                    // Check if requirements are met
                    const meetsRequirements = longAdjustedStrength >= LONG_MIN_STRENGTH &&
                        longCurrentConfirmations >= LONG_MIN_CONFIRMATIONS;

                    // ✅ FIX CRITICO: Mostra blocker anche se requirements sono soddisfatti ma canOpen è false
                    // Questo permette di vedere PERCHÉ non apre anche quando segnale è READY
                    const canOpen = meetsRequirements && canOpenCheck.allowed && !signal.atrBlocked;

                    // Se requirements NON sono soddisfatti, non mostrare blocker (mostra solo nel "Top Reason")
                    if (!meetsRequirements) {
                        return []; // No blockers to show if requirements not met
                    }

                    // ✅ IMPORTANTE: Se requirements sono OK ma canOpen è false, mostra TUTTI i blocker
                    // Freshness Blockers
                    if (freshnessBlockers.length > 0) {
                        blocks.push(...freshnessBlockers);
                    }

                    // ATR block
                    if (signal.atrBlocked) {
                        blocks.push({
                            type: 'ATR',
                            reason: `Mercato troppo ${signal.atrPct < signal.minAtrRequired ? 'piatto' : 'volatile'} (ATR: ${signal.atrPct?.toFixed(2)}%, richiesto: ${signal.minAtrRequired}%)`,
                            severity: 'high'
                        });
                    }

                    // Risk Manager block (GLOBALE - blocca tutto il trading)
                    if (!riskCheck.canTrade) {
                        blocks.push({
                            type: 'Risk Manager (Globale)',
                            reason: riskCheck.reason || 'Esposizione massima raggiunta',
                            severity: 'high'
                        });
                    }

                    // ✅ FIX CRITICO: Risk Manager block per questa specifica posizione
                    // Questo è diverso da riskCheck.canTrade - controlla se può aprire questa specifica posizione
                    if (!canOpenCheck.allowed) {
                        blocks.push({
                            type: 'Risk Manager',
                            reason: canOpenCheck.reason || `Esposizione insufficiente o limite raggiunto (disponibile: €${maxAvailableForNewPosition.toFixed(2)})`,
                            severity: 'high'
                        });
                    }

                    // Existing positions
                    if (longPositions.length > 0) {
                        blocks.push({
                            type: 'Posizioni esistenti',
                            reason: `Già ${longPositions.length} posizione/i LONG aperta/e su ${symbol}`,
                            severity: 'medium'
                        });
                    }

                    // Balance check
                    if (maxAvailableForNewPosition < 10) {
                        blocks.push({
                            type: 'Balance insufficiente',
                            reason: `Solo €${maxAvailableForNewPosition.toFixed(2)} disponibili (minimo €10)`,
                            severity: 'high'
                        });
                    }

                    // Volume check
                    if (volumeBlocked) {
                        blocks.push({
                            type: 'Volume troppo basso',
                            reason: `Volume 24h €${volume24h.toLocaleString('it-IT', { maximumFractionDigits: 0 })} < €${MIN_VOLUME.toLocaleString('it-IT')}`,
                            severity: 'high'
                        });
                    }

                    // Hybrid Strategy check
                    if (!hybridCheck.allowed) {
                        blocks.push({
                            type: 'Strategia Ibrida',
                            reason: hybridCheck.reason,
                            severity: 'high'
                        });
                    }

                    // ✅ FIX: Se non ci sono blocker ma canOpen è false, aggiungi un blocker generico
                    // Questo garantisce che SEMPRE si veda perché non apre quando requirements sono OK
                    if (blocks.length === 0 && !canOpen) {
                        blocks.push({
                            type: 'Blocco sconosciuto',
                            reason: `Requirements soddisfatti ma posizione non può essere aperta. Verifica log backend per dettagli.`,
                            severity: 'medium'
                        });
                    }

                    return blocks;
                })(),
                short: (() => {
                    const blocks = [];
                    // Check if requirements are met
                    const meetsRequirements = shortAdjustedStrength >= SHORT_MIN_STRENGTH &&
                        shortCurrentConfirmations >= SHORT_MIN_CONFIRMATIONS;

                    // ✅ Binance Short Check
                    const binanceMode = process.env.BINANCE_MODE || 'demo';
                    // In DEMO mode, ignoriamo il controllo "supportsShort" per permettere testing
                    const supportsShort = binanceMode === 'demo' || process.env.BINANCE_SUPPORTS_SHORT === 'true';

                    if (binanceMode !== 'demo' && !supportsShort) {
                        blocks.push({
                            type: 'SHORT non supportato',
                            reason: 'Binance Spot non supporta vendite allo scoperto. Usa Futures o Demo per testare.',
                            severity: 'high'
                        });
                    }

                    // ✅ FIX CRITICO: Mostra blocker anche se requirements sono soddisfatti ma canOpen è false
                    const canOpen = meetsRequirements && canOpenCheck.allowed && !signal.atrBlocked && supportsShort;

                    if (!meetsRequirements) {
                        return []; // No blockers to show if requirements not met
                    }

                    // ATR block
                    if (signal.atrBlocked) {
                        blocks.push({
                            type: 'ATR',
                            reason: `Mercato troppo ${signal.atrPct < signal.minAtrRequired ? 'piatto' : 'volatile'} (ATR: ${signal.atrPct?.toFixed(2)}%, richiesto: ${signal.minAtrRequired}%)`,
                            severity: 'high'
                        });
                    }

                    // Risk Manager block
                    if (!riskCheck.canTrade) {
                        blocks.push({
                            type: 'Risk Manager',
                            reason: riskCheck.reason || 'Esposizione massima raggiunta',
                            severity: 'high'
                        });
                    }

                    // Existing positions
                    if (shortPositions.length > 0) {
                        blocks.push({
                            type: 'Posizioni esistenti',
                            reason: `Già ${shortPositions.length} posizione/i SHORT aperta/e su ${symbol}`,
                            severity: 'medium'
                        });
                    }

                    // Balance check
                    if (maxAvailableForNewPosition < 10) {
                        blocks.push({
                            type: 'Balance insufficiente',
                            reason: `Solo €${maxAvailableForNewPosition.toFixed(2)} disponibili (minimo €10)`,
                            severity: 'high'
                        });
                    }

                    // Volume check
                    if (volumeBlocked) {
                        blocks.push({
                            type: 'Volume troppo basso',
                            reason: `Volume 24h €${volume24h.toLocaleString('it-IT', { maximumFractionDigits: 0 })} < €${MIN_VOLUME.toLocaleString('it-IT')}`,
                            severity: 'high'
                        });
                    }

                    // Hybrid Strategy check
                    if (!hybridCheck.allowed) {
                        blocks.push({
                            type: 'Strategia Ibrida',
                            reason: hybridCheck.reason,
                            severity: 'high'
                        });
                    }

                    // ✅ FIX: Risk Manager block per questa specifica posizione SHORT
                    if (!canOpenCheck.allowed) {
                        blocks.push({
                            type: 'Risk Manager',
                            reason: canOpenCheck.reason || `Esposizione insufficiente o limite raggiunto (disponibile: €${maxAvailableForNewPosition.toFixed(2)})`,
                            severity: 'high'
                        });
                    }

                    // ✅ FIX: Se non ci sono blocker ma canOpen è false, aggiungi un blocker generico
                    if (blocks.length === 0 && !canOpen) {
                        blocks.push({
                            type: 'Blocco sconosciuto',
                            reason: `Requirements soddisfatti ma posizione SHORT non può essere aperta. Verifica log backend per dettagli.`,
                            severity: 'medium'
                        });
                    }

                    return blocks;
                })()
            }

        });
    } catch (error) {
        console.error('❌ [BOT-ANALYSIS] ========== ERRORE CRITICO ==========');
        console.error('❌ [BOT-ANALYSIS] Error message:', error.message);
        console.error('❌ [BOT-ANALYSIS] Error name:', error.name);
        console.error('❌ [BOT-ANALYSIS] Error code:', error.code);
        console.error('❌ [BOT-ANALYSIS] Error stack:', error.stack);
        console.error('❌ [BOT-ANALYSIS] ======================================');

        // Invia risposta di errore più dettagliata
        res.status(500).json({
            error: error.message || 'Internal Server Error',
            name: error.name,
            code: error.code,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// ✅ ENDPOINT DI TEST per verificare che il routing funzioni
router.get('/bot-analysis-test', (req, res) => {
    console.log('✅ [TEST] Endpoint bot-analysis-test chiamato');
    res.json({
        success: true,
        message: 'Endpoint funziona!',
        timestamp: new Date().toISOString()
    });
});

// GET /api/crypto/symbols/available - Get all available symbols for frontend
router.get('/symbols/available', async (req, res) => {
    try {
        // Return all symbols from SYMBOL_TO_PAIR
        const symbols = Object.keys(SYMBOL_TO_PAIR).map(symbol => ({
            symbol: symbol,
            pair: SYMBOL_TO_PAIR[symbol],
            display: SYMBOL_TO_PAIR[symbol].replace('USDT', '/USDT').replace('EUR', '/EUR'),
            bot_active: false // Will be updated by frontend based on activeBots
        }));

        res.json({ symbols });
    } catch (error) {
        console.error('Error fetching available symbols:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ FUNZIONE UNIFICATA per Analisi Deep (usata da Scanner e Bot Analysis)
// Questa funzione è l'UNICA fonte di verità per il calcolo dei segnali nello Scanner
const performUnifiedDeepAnalysis = async (symbol, currentPrice, explicitPair = null) => {
    try {
        // 1. Get History from DB (LIMIT 100)
        let deepAnalysisHistory = [];
        const deepAnalysisHistoryData = await dbAll(
            "SELECT open_time, open_price, high_price, low_price, close_price FROM klines WHERE symbol = $1 AND interval = '15m' ORDER BY open_time DESC LIMIT 100",
            [symbol]
        );

        if (deepAnalysisHistoryData && deepAnalysisHistoryData.length > 0) {
            deepAnalysisHistory = deepAnalysisHistoryData.reverse().map(row => {
                // ✅ FIX: Gestisci correttamente open_time da PostgreSQL (stesso fix di bot-analysis)
                let timestamp;
                try {
                    const openTime = row.open_time;
                    if (typeof openTime === 'number') {
                        timestamp = new Date(openTime > 1000000000000 ? openTime : openTime * 1000).toISOString();
                    } else if (typeof openTime === 'string') {
                        timestamp = new Date(openTime).toISOString();
                    } else if (openTime instanceof Date) {
                        timestamp = openTime.toISOString();
                    } else {
                        console.warn(`⚠️ [SCANNER] open_time non valido per ${symbol}:`, openTime);
                        timestamp = new Date().toISOString();
                    }
                } catch (e) {
                    console.error(`❌ [SCANNER] Errore conversione timestamp per ${symbol}:`, e.message);
                    timestamp = new Date().toISOString();
                }

                return {
                    timestamp: timestamp,
                    open: parseFloat(row.open_price) || 0,
                    high: parseFloat(row.high_price) || 0,
                    low: parseFloat(row.low_price) || 0,
                    close: parseFloat(row.close_price) || 0,
                    price: parseFloat(row.close_price) || 0,
                    volume: 0
                };
            });
        }

        // Check Stale & Fetch Fallback
        let isStale = false;
        if (deepAnalysisHistory.length > 0) {
            const lastTs = new Date(deepAnalysisHistory[deepAnalysisHistory.length - 1].timestamp).getTime();
            const lastClose = deepAnalysisHistory[deepAnalysisHistory.length - 1].close;

            isStale = (new Date().getTime() - lastTs) > 20 * 60 * 1000;

            // ✅ SANITY CHECK: Se il prezzo nel DB è troppo diverso dal prezzo attuale (>10%), è un dato corrotto/vecchio
            if (!isStale && currentPrice > 0 && lastClose > 0) {
                const priceDiffPct = Math.abs(currentPrice - lastClose) / lastClose;
                if (priceDiffPct > 0.10) { // 10% differenza
                    // console.log(`⚠️ [SCANNER] Dati DB corrotti/disallineati per ${symbol} (Diff: ${(priceDiffPct*100).toFixed(1)}%). Forzo riscaricamento.`);
                    isStale = true; // Forziamo riscaricamento
                }
            }
        }

        // Se dati mancanti o obsoleti, scarica da Binance
        if (deepAnalysisHistory.length < 20 || isStale) {
            try {
                const tradingPair = explicitPair || SYMBOL_TO_PAIR[symbol] || symbol.toUpperCase().replace('_', '');
                // Timeout 2.5s per non rallentare troppo lo scanner
                const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${tradingPair}&interval=15m&limit=100`;
                const klines = await httpsGet(binanceUrl, 2500);

                if (Array.isArray(klines) && klines.length > 0) {
                    deepAnalysisHistory = klines.map(k => ({
                        timestamp: new Date(k[0]).toISOString(),
                        open: parseFloat(k[1]),
                        high: parseFloat(k[2]),
                        low: parseFloat(k[3]),
                        close: parseFloat(k[4]),
                        price: parseFloat(k[4]),
                        volume: parseFloat(k[5])
                    }));
                }
            } catch (err) {
                // Se fallisce anche Binance, e i dati sono stale o vuoti, allora return null
                if (deepAnalysisHistory.length === 0) return null;
            }
        }

        if (deepAnalysisHistory.length === 0) return null;

        if (deepAnalysisHistory.length > 0) {
            // Logic to append/update last candle

            // Logic to append/update last candle
            const lastCandle = deepAnalysisHistory[deepAnalysisHistory.length - 1];
            const lastCandleTime = new Date(lastCandle.timestamp);
            const now = new Date();
            const currentIntervalStart = Math.floor(now.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000);
            const lastCandleIntervalStart = Math.floor(lastCandleTime.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000);

            if (currentIntervalStart > lastCandleIntervalStart) {
                // New candle
                deepAnalysisHistory.push({
                    timestamp: new Date(currentIntervalStart).toISOString(),
                    open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice, price: currentPrice,
                    volume: 0
                });
            } else {
                // Update existing
                lastCandle.close = currentPrice;
                lastCandle.price = currentPrice;
                lastCandle.high = Math.max(lastCandle.high || lastCandle.close, currentPrice);
                lastCandle.low = Math.min(lastCandle.low || lastCandle.close, currentPrice);
            }
        } else {
            return null; // No history
        }

        // Generate Signal
        const signal = signalGenerator.generateSignal(deepAnalysisHistory, symbol);

        // Calculate RSI Deep
        let rsiDeep = null;
        const prices = deepAnalysisHistory.map(h => h.close || h.price);
        if (prices.length >= 15) {
            rsiDeep = calculateRSI(prices, 14);
        }

        return { signal, rsi: rsiDeep };
    } catch (e) {
        // console.error(`Unified Analysis Error for ${symbol}:`, e.message);
        return null;
    }
};

// GET /api/crypto/scanner - Scan all symbols for opportunities
router.get('/scanner', async (req, res) => {
    console.log('🔍 [SCANNER] Starting market scan...');
    try {
        // List of symbols to scan (same as available)
        // List of symbols to scan (ALL available symbols)
        const symbolsToScan = [
            // Bitcoin
            { symbol: 'bitcoin', pair: 'BTCEUR', display: 'BTC/EUR' },
            { symbol: 'bitcoin_usdt', pair: 'BTCUSDT', display: 'BTC/USDT' },
            // Ethereum
            { symbol: 'ethereum', pair: 'ETHEUR', display: 'ETH/EUR' },
            { symbol: 'ethereum_usdt', pair: 'ETHUSDT', display: 'ETH/USDT' },
            // Solana
            { symbol: 'solana', pair: 'SOLUSDT', display: 'SOL/USDT' },
            { symbol: 'solana_eur', pair: 'SOLEUR', display: 'SOL/EUR' },
            // Cardano
            { symbol: 'cardano', pair: 'ADAEUR', display: 'ADA/EUR' },
            { symbol: 'cardano_usdt', pair: 'ADAUSDT', display: 'ADA/USDT' },
            // Polkadot
            { symbol: 'polkadot', pair: 'DOTEUR', display: 'DOT/EUR' },
            { symbol: 'polkadot_usdt', pair: 'DOTUSDT', display: 'DOT/USDT' },
            // Chainlink
            { symbol: 'chainlink', pair: 'LINKEUR', display: 'LINK/EUR' },
            { symbol: 'chainlink_usdt', pair: 'LINKUSDT', display: 'LINK/USDT' },
            // Litecoin
            { symbol: 'litecoin', pair: 'LTCEUR', display: 'LTC/EUR' },
            { symbol: 'litecoin_usdt', pair: 'LTCUSDT', display: 'LTC/USDT' },
            // Ripple
            { symbol: 'ripple', pair: 'XRPUSDT', display: 'XRP/USDT' },
            { symbol: 'ripple_eur', pair: 'XRPEUR', display: 'XRP/EUR' },
            // Binance Coin
            { symbol: 'binance_coin', pair: 'BNBUSDT', display: 'BNB/USDT' },
            { symbol: 'binance_coin_eur', pair: 'BNBEUR', display: 'BNB/EUR' },
            // Polygon (POL)
            { symbol: 'pol_polygon', pair: 'POLUSDT', display: 'POL/USDT' },
            { symbol: 'pol_polygon_eur', pair: 'POLEUR', display: 'POL/EUR' },
            // Avalanche
            { symbol: 'avalanche', pair: 'AVAXUSDT', display: 'AVAX/USDT' },
            { symbol: 'avalanche_eur', pair: 'AVAXEUR', display: 'AVAX/EUR' },
            // Uniswap
            { symbol: 'uniswap', pair: 'UNIUSDT', display: 'UNI/USDT' },
            // ❌ { symbol: 'uniswap_eur', pair: 'UNIEUR', display: 'UNI/EUR' }, // Non disponibile su Binance
            // Dogecoin
            { symbol: 'dogecoin', pair: 'DOGEUSDT', display: 'DOGE/USDT' },
            { symbol: 'dogecoin_eur', pair: 'DOGEEUR', display: 'DOGE/EUR' },
            // Shiba Inu
            { symbol: 'shiba', pair: 'SHIBUSDT', display: 'SHIB/USDT' },
            { symbol: 'shiba_eur', pair: 'SHIBEUR', display: 'SHIB/EUR' },
            // Near Protocol
            { symbol: 'near', pair: 'NEARUSDT', display: 'NEAR/USDT' },
            // ❌ { symbol: 'near_eur', pair: 'NEAREUR', display: 'NEAR/EUR' }, // Non disponibile su Binance
            // Cosmos
            { symbol: 'atom', pair: 'ATOMUSDT', display: 'ATOM/USDT' },
            // ❌ { symbol: 'atom_eur', pair: 'ATOMEUR', display: 'ATOM/EUR' }, // Non disponibile su Binance
            // Aave
            { symbol: 'aave', pair: 'AAVEUSDT', display: 'AAVE/USDT' },
            // ❌ { symbol: 'aave_eur', pair: 'AAVEEUR', display: 'AAVE/EUR' }, // Non disponibile su Binance
            // The Sandbox
            { symbol: 'sand', pair: 'SANDUSDT', display: 'SAND/USDT' },
            // ❌ { symbol: 'sand_eur', pair: 'SANDEUR', display: 'SAND/EUR' }, // Non disponibile su Binance
            // Filecoin
            { symbol: 'fil', pair: 'FILUSDT', display: 'FIL/USDT' },
            // ❌ { symbol: 'fil_eur', pair: 'FILEUR', display: 'FIL/EUR' }, // Non disponibile su Binance
            // Tron
            { symbol: 'trx', pair: 'TRXUSDT', display: 'TRX/USDT' },
            { symbol: 'trx_eur', pair: 'TRXEUR', display: 'TRX/EUR' },
            // Stellar
            { symbol: 'xlm', pair: 'XLMUSDT', display: 'XLM/USDT' },
            { symbol: 'xlm_eur', pair: 'XLMEUR', display: 'XLM/EUR' },
            // EOS - ❌ Delisted from Binance
            // ❌ { symbol: 'eos', pair: 'EOSUSDT', display: 'EOS/USDT' }, // Delisted from Binance
            // ❌ { symbol: 'eos_eur', pair: 'EOSEUR', display: 'EOS/EUR' }, // Non disponibile su Binance
            // Arbitrum
            { symbol: 'arb', pair: 'ARBUSDT', display: 'ARB/USDT' },
            // ❌ { symbol: 'arb_eur', pair: 'ARBEUR', display: 'ARB/EUR' }, // Non disponibile su Binance
            // Optimism
            { symbol: 'op', pair: 'OPUSDT', display: 'OP/USDT' },
            // ❌ { symbol: 'op_eur', pair: 'OPEUR', display: 'OP/EUR' }, // Non disponibile su Binance
            // Polygon (MATIC) - Deprecato, usa POL
            // ❌ { symbol: 'matic', pair: 'MATICUSDT', display: 'MATIC/USDT' }, // Deprecato, usa POL
            // ❌ { symbol: 'matic_eur', pair: 'MATICEUR', display: 'MATIC/EUR' }, // Non disponibile su Binance
            // DeFi Blue Chips (solo USDT disponibile)
            { symbol: 'crv', pair: 'CRVUSDT', display: 'CRV/USDT' },
            { symbol: 'ldo', pair: 'LDOUSDT', display: 'LDO/USDT' },
            // Gaming/Metaverse (solo USDT disponibile)
            { symbol: 'mana', pair: 'MANAUSDT', display: 'MANA/USDT' },
            { symbol: 'axs', pair: 'AXSUSDT', display: 'AXS/USDT' }
            // ❌ Simboli EUR non disponibili su Binance rimossi:
            // EOSEUR, ARBEUR, ATOMEUR, UNIEUR, NEAREUR, OPEUR, MATICEUR
            // FILEUR, SANDEUR, AAVEEUR, CRVEUR, LDOEUR, MANAEUR, AXSEUR
        ];

        // ✅ OTTIMIZZAZIONE: Scarica TUTTI i prezzi in una sola chiamata per evitare rate limits
        const allPricesMap = new Map();
        try {
            // console.log('🔍 [SCANNER] Fetching ALL live prices from Binance...');
            const allPrices = await httpsGet('https://api.binance.com/api/v3/ticker/price', 5000); // 5s timeout
            if (Array.isArray(allPrices)) {
                allPrices.forEach(p => {
                    allPricesMap.set(p.symbol, parseFloat(p.price));
                });
                // console.log(`✅ [SCANNER] Fetched ${allPrices.length} prices`);
            }
        } catch (err) {
            console.error('⚠️ [SCANNER] Bulk price fetch failed:', err.message);
        }

        const results = await Promise.all(symbolsToScan.map(async (s) => {
            try {
                // 1. Recupera Prezzo Corrente (da Bulk Map o Fallback)
                let currentPrice = 0;
                let priceFound = false;

                if (allPricesMap.has(s.pair)) {
                    currentPrice = allPricesMap.get(s.pair);
                    priceFound = currentPrice > 0;
                } else {
                    // Fallback fetch singolo
                    try {
                        const priceUrl = `https://api.binance.com/api/v3/ticker/price?symbol=${s.pair}`;
                        const priceData = await httpsGet(priceUrl, 1500).catch(() => null);
                        if (priceData && priceData.price) {
                            currentPrice = parseFloat(priceData.price);
                            priceFound = currentPrice > 0;
                        } else {
                            // Fallback DB
                            const lastPriceDb = await dbGet("SELECT price FROM price_history WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1", [s.symbol]);
                            if (lastPriceDb && lastPriceDb.price) {
                                currentPrice = parseFloat(lastPriceDb.price);
                                priceFound = currentPrice > 0;
                            }
                        }
                    } catch (e) {
                        console.warn(`⚠️ [SCANNER] Errore recupero prezzo per ${s.pair}:`, e.message);
                    }
                }

                // ✅ FIX: Se non troviamo il prezzo, salta questo simbolo (evita errori downstream)
                if (!priceFound || currentPrice <= 0) {
                    console.warn(`⚠️ [SCANNER] Prezzo non disponibile per ${s.symbol} (${s.pair}), skip`);
                    return null; // Skip questo simbolo
                }


                // ✅ ANALISI UNIFICATA: Usa la stessa logica di Bot Analysis
                // Passing s.pair is CRITICAL for correct Binance fetching
                let unifiedResult = null;
                try {
                    unifiedResult = await performUnifiedDeepAnalysis(s.symbol, currentPrice, s.pair);
                } catch (analysisError) {
                    console.warn(`⚠️ [SCANNER] Errore analisi per ${s.symbol}:`, analysisError.message);
                    unifiedResult = null;
                }

                let signal;
                let rsiDeepAnalysis = null;

                if (unifiedResult && unifiedResult.signal) {
                    signal = unifiedResult.signal;
                    rsiDeepAnalysis = unifiedResult.rsi;
                } else {
                    // Dati stale o mancanti -> Nessun segnale valido (Strength 0)
                    signal = {
                        direction: 'NEUTRAL',
                        strength: 0,
                        longSignal: { strength: 0 },
                        shortSignal: { strength: 0 },
                        reasons: ['Dati non disponibili'],
                        confirmations: 0,
                        indicators: { rsi: null }
                    };
                }

                // 3. Get 24h volume
                const volume24h = await get24hVolume(s.symbol).catch(() => 0);

                // ✅ CRITICAL FIX: Apply MTF (Multi-Timeframe) adjustment to match Bot Analysis

                // Calculate MTF trends (skip if no signal to save resources on failures)
                let trend1h = 'neutral';
                let trend4h = 'neutral';
                if (signal.strength > 0 || (signal.longSignal && signal.longSignal.strength > 0) || (signal.shortSignal && signal.shortSignal.strength > 0)) {
                    try {
                        trend1h = await detectTrendOnTimeframe(s.symbol, '1h', 50);
                        trend4h = await detectTrendOnTimeframe(s.symbol, '4h', 50);
                    } catch (mtfError) {
                        trend1h = 'neutral'; trend4h = 'neutral';
                    }
                }

                // ✅ STRENGTH UNIFICATO: Usa sempre i valori parziali (come Quick Analysis)
                const longStrength = signal.longSignal?.strength || 0;
                const shortStrength = signal.shortSignal?.strength || 0;

                // Determina direzione dominante
                let displayDirection = 'NEUTRAL';
                let rawStrength = 0;

                if (longStrength > shortStrength && longStrength >= 1) {
                    displayDirection = 'LONG';
                    rawStrength = longStrength;
                } else if (shortStrength > longStrength && shortStrength >= 1) {
                    displayDirection = 'SHORT';
                    rawStrength = shortStrength;
                } else if (longStrength > 0 || shortStrength > 0) {
                    displayDirection = longStrength >= shortStrength ? 'LONG' : 'SHORT';
                    rawStrength = Math.max(longStrength, shortStrength);
                } else {
                    displayDirection = 'NEUTRAL';
                    rawStrength = 0;
                }

                // Calculate MTF bonus/penalty (SAME logic as bot-analysis)
                let mtfBonus = 0;
                if (displayDirection === 'LONG') {
                    if (trend1h === 'bullish' && trend4h === 'bullish') {
                        mtfBonus = +10;
                    } else if (trend1h === 'bullish' || trend4h === 'bullish') {
                        mtfBonus = +5;
                    } else if (trend1h === 'bearish' || trend4h === 'bearish') {
                        mtfBonus = -15;
                    }
                } else if (displayDirection === 'SHORT') {
                    if (trend1h === 'bearish' && trend4h === 'bearish') {
                        mtfBonus = +10;
                    } else if (trend1h === 'bearish' || trend4h === 'bearish') {
                        mtfBonus = +5;
                    } else if (trend1h === 'bullish' || trend4h === 'bullish') {
                        mtfBonus = -15;
                    }
                }

                // Apply MTF adjustment to get FINAL strength (same as bot-analysis)
                const adjustedStrength = Math.max(0, rawStrength + mtfBonus);
                const displayStrength = Math.min(adjustedStrength, 100);

                // RSI Simple Fallback
                let rsiSimple = null;
                try {
                    // Se unifiedResult ha fallito, non abbiamo historyForSignal qui.
                    // Possiamo provare a recuperarlo o lasciare null.
                    // Per ora null se unified fallisce.
                    if (signal && signal.indicators && signal.indicators.rsi) {
                        rsiSimple = signal.indicators.rsi;
                    }
                } catch (e) { rsiSimple = null; }

                // Preparare oggetto finale



                // (Codice duplicato rimosso - scanner ora completamente unificato)

                // ✅ LOG per debug - DETAILED
                console.log(`[SCANNER] ${s.display}:`);
                console.log(`  - Signal direction: ${signal?.direction || 'null'}`);
                console.log(`  - Display direction: ${displayDirection}`);
                console.log(`  - Raw strength: ${rawStrength}`);
                console.log(`  - MTF (1h=${trend1h}, 4h=${trend4h}): bonus=${mtfBonus}`);
                console.log(`  - Adjusted strength: ${adjustedStrength}`);
                console.log(`  - Display strength (capped): ${displayStrength}`);
                console.log(`  - RSI Deep: ${rsiDeepAnalysis?.toFixed(2) || 'N/A'} | RSI Simple: ${rsiSimple?.toFixed(2) || 'N/A'}`);
                console.log(`  - Price: ${currentPrice.toFixed(4)}`);

                // ✅ IMPORTANTE: Restituisci SEMPRE il risultato, anche se NEUTRAL con strength 0
                // Questo permette di vedere TUTTI i simboli nel Market Scanner per debug
                return {
                    symbol: s.symbol,
                    display: s.display,
                    price: currentPrice, // Prezzo corrente aggiornato in tempo reale
                    volume24h: volume24h || 0, // Volume 24h in USDT
                    direction: displayDirection, // Usa direzione migliorata per display
                    strength: displayStrength, // MTF-adjusted strength (0-100) - Mantengo per sort
                    strength_long: longStrength, // ✅ Valore puro LONG (come in Deep Analysis)
                    strength_short: shortStrength, // ✅ Valore puro SHORT (come in Deep Analysis)
                    confirmations: signal?.confirmations || 0,
                    reasons: signal?.reasons || ['Nessun segnale'],
                    rsi: rsiDeepAnalysis !== null ? rsiDeepAnalysis : rsiSimple, // ✅ USA RSI DEEP, fallback a RSI Simple
                    rsi_deep_analysis: rsiDeepAnalysis !== null ? rsiDeepAnalysis : rsiSimple // ✅ Stesso valore
                };
            } catch (err) {
                console.error(`[SCANNER] Errore completo per ${s.symbol}:`, err.message);
                // ✅ FALLBACK: Restituisci almeno i dati base anche in caso di errore
                return {
                    symbol: s.symbol,
                    display: s.display,
                    price: 0,
                    volume24h: 0,
                    direction: 'NEUTRAL',
                    strength: 0,
                    strength_long: 0,
                    strength_short: 0,
                    confirmations: 0,
                    reasons: [`Errore: ${err.message}`],
                    rsi: null
                };
            }
        }));

        // ✅ FIX CRITICO: Filtra solo risultati validi con prezzo > 0
        // Mostra risultati anche NEUTRAL con strength 0, ma solo se hanno prezzo valido
        const validResults = results
            .filter(r => r !== null && r !== undefined && r.price > 0)
            .sort((a, b) => {
                // Prima ordina per direzione (LONG/SHORT prima di NEUTRAL), poi per strength
                if (a.direction !== 'NEUTRAL' && b.direction === 'NEUTRAL') return -1;
                if (a.direction === 'NEUTRAL' && b.direction !== 'NEUTRAL') return 1;
                return b.strength - a.strength;
            });

        const skippedCount = results.filter(r => r === null || r === undefined || (r && r.price <= 0)).length;
        console.log(`📊 [SCANNER] Totale simboli: ${results.length}, Validi: ${validResults.length}, Saltati (no prezzo): ${skippedCount}`);

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            scan_results: validResults
        });
    } catch (error) {
        console.error('❌ Scanner Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/crypto/debug/balance - Debug endpoint per verificare da dove viene il guadagno
router.get('/debug/balance', async (req, res) => {
    try {
        const portfolio = await getPortfolio();
        const holdings = JSON.parse(portfolio.holdings || '{}');

        // Get all closed positions with P&L
        const closedPositions = await dbAll(
            "SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken') ORDER BY closed_at DESC"
        );

        // Get all open positions
        const openPositions = await dbAll(
            "SELECT * FROM open_positions WHERE status = 'open'"
        );

        // Get all trades (with and without profit_loss)
        const allTrades = await dbAll(
            "SELECT * FROM trades ORDER BY timestamp DESC"
        );

        // Get trades with profit_loss
        const tradesWithPnL = allTrades.filter(t => t.profit_loss !== null && parseFloat(t.profit_loss) !== 0);

        // Calculate total P&L from closed positions
        let totalPnLFromPositions = 0;
        closedPositions.forEach(pos => {
            const pnl = parseFloat(pos.profit_loss) || 0;
            totalPnLFromPositions += pnl;
        });

        // Calculate total P&L from trades
        let totalPnLFromTrades = 0;
        tradesWithPnL.forEach(trade => {
            const pnl = parseFloat(trade.profit_loss) || 0;
            totalPnLFromTrades += pnl;
        });

        // Calculate total spent on buys (from all trades)
        let totalSpentOnBuys = 0;
        let totalReceivedFromSells = 0;
        allTrades.forEach(trade => {
            const cost = parseFloat(trade.amount) * parseFloat(trade.price);
            if (trade.type === 'buy') {
                totalSpentOnBuys += cost;
            } else if (trade.type === 'sell') {
                totalReceivedFromSells += cost;
            }
        });

        // Calculate current holdings value (approximate, using last known prices)
        let holdingsValue = 0;
        const holdingsDetails = {};
        for (const [symbol, amount] of Object.entries(holdings)) {
            if (amount > 0) {
                try {
                    const price = await getSymbolPrice(symbol);
                    const value = amount * price;
                    holdingsValue += value;
                    holdingsDetails[symbol] = {
                        amount: amount,
                        estimated_price: price,
                        estimated_value: value
                    };
                } catch (err) {
                    holdingsDetails[symbol] = {
                        amount: amount,
                        estimated_price: 'N/A',
                        estimated_value: 0
                    };
                }
            }
        }

        // Calculate expected balance (starting balance + total P&L from closed positions)
        const startingBalance = 250.0;
        const expectedBalanceFromPositions = startingBalance + totalPnLFromPositions;

        // Alternative calculation: starting balance - buys + sells
        const expectedBalanceFromTrades = startingBalance - totalSpentOnBuys + totalReceivedFromSells;

        const actualBalance = portfolio.balance_usd;
        const totalBalance = actualBalance + holdingsValue; // Balance + holdings value

        // Find trades without associated positions
        const tradesWithoutPositions = allTrades.filter(trade => {
            if (!trade.ticket_id) return true; // Trade senza ticket_id
            const hasPosition = [...closedPositions, ...openPositions].some(pos => pos.ticket_id === trade.ticket_id);
            return !hasPosition;
        });

        res.json({
            debug: {
                starting_balance: startingBalance,
                actual_balance: actualBalance,
                holdings_value: holdingsValue,
                total_balance_including_holdings: totalBalance,
                expected_balance_from_closed_positions: expectedBalanceFromPositions,
                expected_balance_from_trades: expectedBalanceFromTrades,
                difference_from_positions: actualBalance - expectedBalanceFromPositions,
                difference_from_trades: actualBalance - expectedBalanceFromTrades,
                total_pnl_from_closed_positions: totalPnLFromPositions,
                total_pnl_from_trades: totalPnLFromTrades,
                total_spent_on_buys: totalSpentOnBuys,
                total_received_from_sells: totalReceivedFromSells,
                closed_positions_count: closedPositions.length,
                open_positions_count: openPositions.length,
                trades_with_pnl_count: tradesWithPnL.length,
                total_trades_count: allTrades.length,
                trades_without_positions_count: tradesWithoutPositions.length
            },
            holdings: holdingsDetails,
            closed_positions: closedPositions.map(pos => ({
                ticket_id: pos.ticket_id,
                symbol: pos.symbol,
                type: pos.type,
                entry_price: pos.entry_price,
                closed_at: pos.closed_at,
                profit_loss: pos.profit_loss,
                status: pos.status,
                volume: pos.volume
            })),
            open_positions: openPositions.map(pos => ({
                ticket_id: pos.ticket_id,
                symbol: pos.symbol,
                type: pos.type,
                entry_price: pos.entry_price,
                volume: pos.volume,
                opened_at: pos.opened_at
            })),
            trades_with_pnl: tradesWithPnL.map(trade => ({
                id: trade.id,
                ticket_id: trade.ticket_id,
                symbol: trade.symbol,
                type: trade.type,
                amount: trade.amount,
                price: trade.price,
                profit_loss: trade.profit_loss,
                timestamp: trade.timestamp,
                strategy: trade.strategy
            })),
            trades_without_positions: tradesWithoutPositions.map(trade => ({
                id: trade.id,
                ticket_id: trade.ticket_id,
                symbol: trade.symbol,
                type: trade.type,
                amount: trade.amount,
                price: trade.price,
                profit_loss: trade.profit_loss,
                timestamp: trade.timestamp,
                strategy: trade.strategy
            }))
        });
    } catch (error) {
        console.error('❌ Debug balance error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ ENDPOINT: Corregge P&L anomali nelle posizioni chiuse
router.post('/fix-closed-positions-pnl', async (req, res) => {
    try {
        console.log('🔧 [FIX P&L] Inizio correzione P&L anomali nelle posizioni chiuse...');

        const closedPositions = await dbAll(
            "SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken')"
        );

        let fixedCount = 0;
        let errorCount = 0;
        const MAX_REASONABLE_PNL = 1000000; // 1 milione EUR max
        const MAX_REASONABLE_PRICE = 1000000; // 1 milione EUR max

        for (const pos of closedPositions) {
            try {
                const entryPrice = parseFloat(pos.entry_price) || 0;
                const closePrice = parseFloat(pos.current_price) || 0;
                const volume = parseFloat(pos.volume) || 0;
                const volumeClosed = parseFloat(pos.volume_closed) || 0;
                const remainingVolume = volume - volumeClosed;
                const currentPnL = parseFloat(pos.profit_loss) || 0;

                // Verifica se il P&L è anomale
                if (Math.abs(currentPnL) > MAX_REASONABLE_PNL ||
                    closePrice > MAX_REASONABLE_PRICE ||
                    entryPrice > MAX_REASONABLE_PRICE) {

                    console.log(`⚠️ [FIX P&L] Posizione ${pos.ticket_id} (${pos.symbol}) ha P&L/prezzo anomale:`);
                    console.log(`   Entry: €${entryPrice}, Close: €${closePrice}, Volume: ${remainingVolume}, P&L: €${currentPnL}`);

                    // Prova a recuperare il prezzo corretto
                    let correctedClosePrice = closePrice;
                    try {
                        const correctPrice = await getSymbolPrice(pos.symbol);
                        if (correctPrice > 0 && correctPrice <= MAX_REASONABLE_PRICE) {
                            correctedClosePrice = correctPrice;
                            console.log(`   → Prezzo corretto recuperato: €${correctPrice.toFixed(6)}`);
                        }
                    } catch (priceError) {
                        console.warn(`   ⚠️ Impossibile recuperare prezzo corretto per ${pos.symbol}`);
                    }

                    // Ricalcola P&L con prezzo corretto (se disponibile)
                    let correctedPnL = currentPnL;
                    let correctedPnLPct = parseFloat(pos.profit_loss_pct) || 0;

                    if (correctedClosePrice > 0 && correctedClosePrice <= MAX_REASONABLE_PRICE &&
                        entryPrice > 0 && entryPrice <= MAX_REASONABLE_PRICE &&
                        remainingVolume > 0) {

                        if (pos.type === 'buy') {
                            correctedPnL = (correctedClosePrice - entryPrice) * remainingVolume;
                            correctedPnLPct = entryPrice > 0 ? ((correctedClosePrice - entryPrice) / entryPrice) * 100 : 0;
                        } else {
                            correctedPnL = (entryPrice - correctedClosePrice) * remainingVolume;
                            correctedPnLPct = entryPrice > 0 ? ((entryPrice - correctedClosePrice) / entryPrice) * 100 : 0;
                        }

                        // Se il P&L corretto è ancora anomale, usa il prezzo corrente
                        if (Math.abs(correctedPnL) > MAX_REASONABLE_PNL) {
                            console.warn(`   ⚠️ P&L corretto ancora anomale (€${correctedPnL.toFixed(2)}), uso prezzo corrente`);
                            try {
                                const currentPrice = await getSymbolPrice(pos.symbol);
                                if (currentPrice > 0 && currentPrice <= MAX_REASONABLE_PRICE) {
                                    if (pos.type === 'buy') {
                                        correctedPnL = (currentPrice - entryPrice) * remainingVolume;
                                        correctedPnLPct = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;
                                    } else {
                                        correctedPnL = (entryPrice - currentPrice) * remainingVolume;
                                        correctedPnLPct = entryPrice > 0 ? ((entryPrice - currentPrice) / entryPrice) * 100 : 0;
                                    }
                                    correctedClosePrice = currentPrice;
                                }
                            } catch (e) {
                                console.error(`   ❌ Errore recupero prezzo corrente:`, e.message);
                            }
                        }

                        // Aggiorna nel database solo se il P&L corretto è ragionevole
                        if (Math.abs(correctedPnL) <= MAX_REASONABLE_PNL &&
                            correctedClosePrice > 0 && correctedClosePrice <= MAX_REASONABLE_PRICE) {

                            await dbRun(
                                "UPDATE open_positions SET current_price = ?, profit_loss = ?, profit_loss_pct = ? WHERE ticket_id = ?",
                                [correctedClosePrice, correctedPnL, correctedPnLPct, pos.ticket_id]
                            );

                            console.log(`✅ [FIX P&L] Posizione ${pos.ticket_id} corretta:`);
                            console.log(`   P&L: €${currentPnL.toFixed(2)} → €${correctedPnL.toFixed(2)}`);
                            console.log(`   Close Price: €${closePrice.toFixed(6)} → €${correctedClosePrice.toFixed(6)}`);
                            fixedCount++;
                        } else {
                            console.warn(`   ⚠️ P&L corretto ancora anomale, non aggiornato`);
                            errorCount++;
                        }
                    } else {
                        console.warn(`   ⚠️ Dati insufficienti per correggere (entry: ${entryPrice}, close: ${correctedClosePrice}, volume: ${remainingVolume})`);
                        errorCount++;
                    }
                }
            } catch (posError) {
                console.error(`❌ [FIX P&L] Errore correzione posizione ${pos.ticket_id}:`, posError.message);
                errorCount++;
            }
        }

        res.json({
            success: true,
            total_closed_positions: closedPositions.length,
            fixed_count: fixedCount,
            error_count: errorCount,
            message: `Corrette ${fixedCount} posizioni su ${closedPositions.length}`
        });
    } catch (error) {
        console.error('❌ Error fixing closed positions P&L:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ ENDPOINT: Ricalcola balance partendo da €1000 e considerando tutti i movimenti
router.post('/recalculate-balance', async (req, res) => {
    try {
        const { initial_balance } = req.body;
        const startingBalance = initial_balance && !isNaN(parseFloat(initial_balance)) ? parseFloat(initial_balance) : 1000;

        console.log(`💰 [RECALCULATE BALANCE] Ricalcolo balance partendo da €${startingBalance.toFixed(2)}`);

        // 1. Leggi tutte le posizioni (aperte e chiuse)
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        const closedPositions = await dbAll("SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken') ORDER BY opened_at ASC");

        // 2. Calcola balance teorico partendo da €1000
        let calculatedBalance = startingBalance;
        const operations = [];

        // Processa tutte le posizioni in ordine cronologico (aperte prima, poi chiuse)
        const allPositions = [...openPositions, ...closedPositions].sort((a, b) => {
            const dateA = new Date(a.opened_at || 0);
            const dateB = new Date(b.opened_at || 0);
            return dateA - dateB;
        });

        for (const pos of allPositions) {
            const volume = parseFloat(pos.volume) || 0;
            const volumeClosed = parseFloat(pos.volume_closed) || 0;
            const remainingVolume = volume - volumeClosed;
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const closePrice = parseFloat(pos.current_price) || 0;
            const isClosed = pos.status !== 'open';

            if (pos.type === 'buy') {
                // LONG: all'apertura sottrai, alla chiusura aggiungi
                const cost = volume * entryPrice;
                calculatedBalance -= cost;
                operations.push({
                    type: 'LONG_OPEN',
                    ticket_id: pos.ticket_id,
                    symbol: pos.symbol,
                    amount: -cost,
                    balance_after: calculatedBalance,
                    timestamp: pos.opened_at
                });

                if (isClosed && closePrice > 0) {
                    const returned = volume * closePrice;
                    calculatedBalance += returned;
                    operations.push({
                        type: 'LONG_CLOSE',
                        ticket_id: pos.ticket_id,
                        symbol: pos.symbol,
                        amount: +returned,
                        balance_after: calculatedBalance,
                        pnl: (closePrice - entryPrice) * volume,
                        timestamp: pos.closed_at
                    });
                } else if (remainingVolume > 0 && entryPrice > 0) {
                    // Posizione ancora aperta - il capitale è investito
                    operations.push({
                        type: 'LONG_OPEN_PARTIAL',
                        ticket_id: pos.ticket_id,
                        symbol: pos.symbol,
                        note: `Capitale investito: €${(remainingVolume * entryPrice).toFixed(2)} (non ancora tornato)`
                    });
                }
            } else {
                // SHORT: all'apertura aggiungi, alla chiusura sottrai
                const credit = volume * entryPrice;
                calculatedBalance += credit;
                operations.push({
                    type: 'SHORT_OPEN',
                    ticket_id: pos.ticket_id,
                    symbol: pos.symbol,
                    amount: +credit,
                    balance_after: calculatedBalance,
                    timestamp: pos.opened_at
                });

                if (isClosed && closePrice > 0) {
                    const toReturn = volume * closePrice;
                    calculatedBalance -= toReturn;
                    operations.push({
                        type: 'SHORT_CLOSE',
                        ticket_id: pos.ticket_id,
                        symbol: pos.symbol,
                        amount: -toReturn,
                        balance_after: calculatedBalance,
                        pnl: (entryPrice - closePrice) * volume,
                        timestamp: pos.closed_at
                    });
                } else if (remainingVolume > 0 && entryPrice > 0) {
                    // Posizione ancora aperta - devi restituire questo capitale
                    operations.push({
                        type: 'SHORT_OPEN_PARTIAL',
                        ticket_id: pos.ticket_id,
                        symbol: pos.symbol,
                        note: `Capitale da restituire: €${(remainingVolume * entryPrice).toFixed(2)} (non ancora restituito)`
                    });
                }
            }
        }

        // 3. Calcola capitale investito attualmente
        let currentInvested = 0;
        for (const pos of openPositions) {
            const vol = parseFloat(pos.volume) || 0;
            const volClosed = parseFloat(pos.volume_closed) || 0;
            const remaining = vol - volClosed;
            const entry = parseFloat(pos.entry_price) || 0;

            if (pos.type === 'buy') {
                currentInvested += remaining * entry;
            } else {
                // SHORT: devi restituire questo capitale
                currentInvested += remaining * entry;
            }
        }

        // 4. Balance disponibile = Balance calcolato - Capitale investito
        // Ma attenzione: per SHORT, il capitale "investito" è in realtà un debito
        let availableBalance = calculatedBalance;
        for (const pos of openPositions) {
            const vol = parseFloat(pos.volume) || 0;
            const volClosed = parseFloat(pos.volume_closed) || 0;
            const remaining = vol - volClosed;
            const entry = parseFloat(pos.entry_price) || 0;

            if (pos.type === 'buy') {
                // LONG: il capitale è investito, non disponibile
                availableBalance -= remaining * entry;
            }
            // SHORT: il capitale ricevuto è disponibile, ma devi restituirlo alla chiusura
            // Quindi non lo sottraiamo qui (è già nel balance)
        }

        // 5. Leggi balance attuale dal DB
        const portfolio = await getPortfolio();
        const currentBalanceDB = parseFloat(portfolio.balance_usd) || 0;

        // 6. Aggiorna balance nel DB con quello calcolato
        await dbRun("UPDATE portfolio SET balance_usd = ? WHERE id = 1", [calculatedBalance]);

        console.log(`✅ [RECALCULATE BALANCE] Balance ricalcolato: €${currentBalanceDB.toFixed(2)} → €${calculatedBalance.toFixed(2)}`);
        console.log(`   Capitale disponibile: €${availableBalance.toFixed(2)}`);
        console.log(`   Capitale investito: €${currentInvested.toFixed(2)}`);

        res.json({
            success: true,
            starting_balance: startingBalance,
            calculated_balance: calculatedBalance,
            current_balance_db: currentBalanceDB,
            available_balance: availableBalance,
            capital_invested: currentInvested,
            difference: calculatedBalance - currentBalanceDB,
            operations_count: operations.length,
            operations: operations.slice(-20), // Ultime 20 operazioni
            message: `Balance ricalcolato da €${currentBalanceDB.toFixed(2)} a €${calculatedBalance.toFixed(2)} partendo da €${startingBalance.toFixed(2)}`
        });
    } catch (error) {
        console.error('❌ Error recalculating balance:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ ENDPOINT: Resetta balance a valore specificato (default €1000)
router.post('/reset-balance', async (req, res) => {
    try {
        const { balance } = req.body;
        const newBalance = balance && !isNaN(parseFloat(balance)) ? parseFloat(balance) : 1000;

        // Valida che il balance sia ragionevole
        if (newBalance < 0 || newBalance > 1000000) {
            return res.status(400).json({
                error: 'Balance deve essere tra 0 e 1.000.000 EUR'
            });
        }

        // Leggi balance attuale
        const portfolio = await getPortfolio();
        const oldBalance = parseFloat(portfolio.balance_usd) || 0;

        // ✅ DEBUG: Analizza perché il balance è cambiato
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        const closedPositions = await dbAll("SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken')");

        let totalInvested = 0;
        let totalReturned = 0;
        let shortCredits = 0; // Denaro ricevuto da SHORT aperti

        // Analizza posizioni aperte
        for (const pos of openPositions) {
            const vol = parseFloat(pos.volume) || 0;
            const volClosed = parseFloat(pos.volume_closed) || 0;
            const remaining = vol - volClosed;
            const entry = parseFloat(pos.entry_price) || 0;

            if (pos.type === 'buy') {
                totalInvested += remaining * entry;
            } else {
                // SHORT: ricevi denaro all'apertura
                shortCredits += remaining * entry;
            }
        }

        // Analizza posizioni chiuse
        for (const pos of closedPositions) {
            const vol = parseFloat(pos.volume) || 0;
            const entry = parseFloat(pos.entry_price) || 0;
            const close = parseFloat(pos.current_price) || 0;

            if (pos.type === 'buy') {
                totalInvested += vol * entry; // Investito quando era aperta
                totalReturned += vol * close; // Tornato alla chiusura
            } else {
                // SHORT: ricevi denaro all'apertura, restituisci alla chiusura
                shortCredits += vol * entry; // Ricevuto all'apertura
                totalReturned += vol * close; // Restituito alla chiusura
            }
        }

        // Calcolo teorico: Balance = Initial - Invested + Returned + ShortCredits - ShortReturned
        // Ma ShortCredits e ShortReturned sono già in totalReturned per SHORT
        const theoreticalInitial = oldBalance + totalInvested - totalReturned;

        // Aggiorna balance
        await dbRun("UPDATE portfolio SET balance_usd = ? WHERE id = 1", [newBalance]);

        console.log(`💰 [RESET BALANCE] Balance aggiornato: €${oldBalance.toFixed(2)} → €${newBalance.toFixed(2)}`);
        console.log(`   Analisi: Invested: €${totalInvested.toFixed(2)}, Returned: €${totalReturned.toFixed(2)}, ShortCredits: €${shortCredits.toFixed(2)}`);
        console.log(`   Capitale iniziale teorico: €${theoreticalInitial.toFixed(2)}`);

        res.json({
            success: true,
            old_balance: oldBalance,
            new_balance: newBalance,
            analysis: {
                capital_invested: totalInvested,
                capital_returned: totalReturned,
                short_credits: shortCredits,
                theoretical_initial: theoreticalInitial,
                difference: oldBalance - (theoreticalInitial - totalInvested + totalReturned)
            },
            message: `Balance resettato da €${oldBalance.toFixed(2)} a €${newBalance.toFixed(2)}`
        });
    } catch (error) {
        console.error('❌ Error resetting balance:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ ENDPOINT ANALISI: Analizza posizioni chiuse per capire PERCHÉ sono state chiuse
router.get('/analyze-closed-positions', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const maxLimit = parseInt(limit) || 50;

        // Recupera posizioni chiuse
        const closedPositions = await dbAll(
            `SELECT 
                ticket_id,
                symbol,
                type,
                volume,
                entry_price,
                current_price,
                opened_at,
                closed_at,
                profit_loss,
                profit_loss_pct,
                COALESCE(close_reason, 'N/A') as close_reason,
                status,
                strategy
            FROM open_positions 
            WHERE status IN ('closed', 'stopped', 'taken')
            ORDER BY COALESCE(closed_at, opened_at) DESC 
            LIMIT ?`,
            [maxLimit]
        );

        if (closedPositions.length === 0) {
            return res.json({
                success: true,
                message: 'Nessuna posizione chiusa trovata',
                positions: [],
                statistics: {}
            });
        }

        // Analizza ogni posizione
        const analyzed = closedPositions.map(pos => {
            const openedAt = new Date(pos.opened_at);
            const closedAt = pos.closed_at ? new Date(pos.closed_at) : null;
            const durationMs = closedAt ? (closedAt.getTime() - openedAt.getTime()) : 0;
            const durationSeconds = Math.floor(durationMs / 1000);
            const durationMinutes = Math.floor(durationMs / 60000);

            const entryPrice = parseFloat(pos.entry_price) || 0;
            const closePrice = parseFloat(pos.current_price) || entryPrice;
            const pnl = parseFloat(pos.profit_loss) || 0;
            const pnlPct = parseFloat(pos.profit_loss_pct) || 0;
            const volume = parseFloat(pos.volume) || 0;

            // Determina motivo principale
            const closeReason = pos.close_reason || 'N/A';
            let mainReason = 'Sconosciuto';
            let isSmartExit = false;
            let isImmediate = durationSeconds < 5;
            let isVeryFast = durationSeconds < 60;

            if (closeReason.includes('SmartExit') || closeReason.includes('smart exit') || closeReason.includes('SMART EXIT')) {
                mainReason = 'SmartExit';
                isSmartExit = true;
            } else if (closeReason.includes('cleanup')) {
                mainReason = 'Cleanup (troppe posizioni)';
            } else if (closeReason.includes('replacement') || closeReason.includes('smart replacement')) {
                mainReason = 'Smart Replacement';
            } else if (closeReason.includes('manual')) {
                mainReason = 'Chiusura Manuale';
            } else if (closeReason.includes('stop') || closeReason.includes('Stop Loss')) {
                mainReason = 'Stop Loss';
            } else if (closeReason.includes('take') || closeReason.includes('Take Profit')) {
                mainReason = 'Take Profit';
            } else if (closeReason && closeReason !== 'N/A') {
                mainReason = closeReason.length > 50 ? closeReason.substring(0, 50) + '...' : closeReason;
            }

            // Calcola differenza prezzo
            const priceDiff = closePrice - entryPrice;
            const priceDiffPct = entryPrice > 0 ? ((priceDiff / entryPrice) * 100) : 0;

            return {
                ticket_id: pos.ticket_id,
                symbol: pos.symbol,
                type: pos.type,
                volume: volume,
                entry_price: entryPrice,
                close_price: closePrice,
                price_diff_pct: priceDiffPct,
                profit_loss: pnl,
                profit_loss_pct: pnlPct,
                opened_at: pos.opened_at,
                closed_at: pos.closed_at,
                duration_seconds: durationSeconds,
                duration_minutes: durationMinutes,
                duration_ms: durationMs,
                status: pos.status,
                strategy: pos.strategy || 'N/A',
                close_reason: closeReason,
                main_reason: mainReason,
                flags: {
                    is_immediate: isImmediate, // < 5 secondi
                    is_very_fast: isVeryFast, // < 60 secondi
                    is_smart_exit: isSmartExit,
                    is_loss: pnl < 0,
                    is_big_loss: pnl < -10,
                    price_anomaly: Math.abs(priceDiffPct) > 20
                }
            };
        });

        // Statistiche aggregate
        const immediateCloses = analyzed.filter(p => p.flags.is_immediate);
        const veryFastCloses = analyzed.filter(p => p.flags.is_very_fast);
        const smartExitCloses = analyzed.filter(p => p.flags.is_smart_exit);
        const losses = analyzed.filter(p => p.flags.is_loss);
        const bigLosses = analyzed.filter(p => p.flags.is_big_loss);
        const priceAnomalies = analyzed.filter(p => p.flags.price_anomaly);

        const avgDuration = analyzed.reduce((sum, p) => sum + p.duration_seconds, 0) / analyzed.length;
        const totalPnL = analyzed.reduce((sum, p) => sum + p.profit_loss, 0);

        res.json({
            success: true,
            total_analyzed: analyzed.length,
            positions: analyzed,
            statistics: {
                immediate_closes: immediateCloses.length,
                very_fast_closes: veryFastCloses.length,
                smart_exit_closes: smartExitCloses.length,
                losses: losses.length,
                big_losses: bigLosses.length,
                price_anomalies: priceAnomalies.length,
                avg_duration_seconds: Math.floor(avgDuration),
                total_pnl: totalPnL,
                win_rate: ((analyzed.length - losses.length) / analyzed.length * 100).toFixed(1) + '%'
            },
            immediate_closes_details: immediateCloses.slice(0, 10),
            big_losses_details: bigLosses.slice(0, 10)
        });
    } catch (error) {
        console.error('❌ Error analyzing closed positions:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ ENDPOINT DIAGNOSTICA: Mostra problema balance in modo semplice
router.get('/balance-problem', async (req, res) => {
    try {
        const portfolio = await getPortfolio();
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        const closedPositions = await dbAll("SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken') ORDER BY closed_at DESC LIMIT 100");

        const currentBalance = parseFloat(portfolio.balance_usd) || 0;

        // Calcola capitale investito e tornato
        let investedOpen = 0;
        let investedClosed = 0;
        let returnedClosed = 0;
        let pnlClosed = 0;

        const problems = [];

        // Analizza posizioni aperte
        for (const pos of openPositions) {
            const vol = parseFloat(pos.volume) || 0;
            const volClosed = parseFloat(pos.volume_closed) || 0;
            const remaining = vol - volClosed;
            const entry = parseFloat(pos.entry_price) || 0;
            investedOpen += remaining * entry;

            // Verifica anomalie
            if (entry > 100000) {
                problems.push({
                    type: 'open_anomalous_price',
                    ticket_id: pos.ticket_id,
                    symbol: pos.symbol,
                    issue: `entryPrice €${entry.toFixed(2)} sembra troppo alto (potrebbe essere USDT non convertito)`,
                    entry_price: entry
                });
            }
        }

        // Analizza posizioni chiuse
        for (const pos of closedPositions) {
            const vol = parseFloat(pos.volume) || 0;
            const entry = parseFloat(pos.entry_price) || 0;
            const close = parseFloat(pos.current_price) || 0;
            const pnl = parseFloat(pos.profit_loss) || 0;

            investedClosed += vol * entry;
            returnedClosed += vol * close;
            pnlClosed += pnl;

            // Verifica anomalie
            if (entry > 0 && close > 0) {
                const ratio = close / entry;
                if (ratio > 100 || ratio < 0.01) {
                    problems.push({
                        type: 'closed_price_mismatch',
                        ticket_id: pos.ticket_id,
                        symbol: pos.symbol,
                        issue: `entryPrice €${entry.toFixed(6)} vs closePrice €${close.toFixed(6)} - ratio ${ratio.toFixed(2)}x (probabile mismatch valuta)`,
                        entry_price: entry,
                        close_price: close,
                        ratio: ratio,
                        pnl: pnl
                    });
                }
            }
        }

        // Calcolo teorico
        const totalInvested = investedOpen + investedClosed;
        const expectedBalance = currentBalance + investedOpen - returnedClosed;
        const theoreticalInitial = expectedBalance;
        const difference = currentBalance - (theoreticalInitial - investedOpen + returnedClosed);

        res.json({
            summary: {
                current_balance: currentBalance,
                capital_invested_open: investedOpen,
                capital_invested_closed: investedClosed,
                capital_returned_closed: returnedClosed,
                pnl_closed: pnlClosed,
                theoretical_initial: theoreticalInitial,
                expected_balance: theoreticalInitial - investedOpen + returnedClosed,
                difference: difference,
                is_consistent: Math.abs(difference) < 0.01
            },
            problems: {
                count: problems.length,
                details: problems.slice(0, 20) // Prime 20
            },
            explanation: {
                formula: "Balance = Initial - Invested + Returned",
                current_balance: `€${currentBalance.toFixed(2)} (dal database)`,
                if_consistent: `Dovrebbe essere: Initial (€${theoreticalInitial.toFixed(2)}) - Invested Open (€${investedOpen.toFixed(2)}) + Returned Closed (€${returnedClosed.toFixed(2)}) = €${(theoreticalInitial - investedOpen + returnedClosed).toFixed(2)}`,
                difference_explained: difference > 0 ?
                    `Balance è €${difference.toFixed(2)} PIÙ ALTO del previsto (possibile doppio credito o conversione errata)` :
                    `Balance è €${Math.abs(difference).toFixed(2)} PIÙ BASSO del previsto (possibile doppio debito o conversione errata)`
            },
            recommendations: problems.length > 0 ? [
                `Trovate ${problems.length} anomalie nei prezzi`,
                'Possibile causa: entryPrice in USDT non convertito in EUR',
                'Soluzione: Usa endpoint POST /api/crypto/fix-closed-positions-pnl per correggere'
            ] : [
                'Nessuna anomalia nei prezzi trovata',
                'Se balance è ancora sbagliato, verifica se ci sono operazioni manuali o altri endpoint che modificano balance_usd'
            ]
        });
    } catch (error) {
        console.error('❌ Error in balance problem analysis:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ ENDPOINT DIAGNOSTICA: Verifica completa calcolo balance
router.get('/verify-balance-calculation', async (req, res) => {
    try {
        const portfolio = await getPortfolio();
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        const closedPositions = await dbAll("SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken') ORDER BY closed_at DESC");

        // Calcola balance teorico partendo da un capitale iniziale ipotetico
        // Formula: Balance finale = Capitale iniziale - Investimenti + Ritorni + P&L

        let totalInvested = 0; // Capitale investito in posizioni aperte
        let totalReturned = 0; // Capitale tornato da posizioni chiuse
        let totalPnL = 0; // P&L totale

        const openPositionsDetail = [];
        for (const pos of openPositions) {
            const volume = parseFloat(pos.volume) || 0;
            const volumeClosed = parseFloat(pos.volume_closed) || 0;
            const remainingVolume = volume - volumeClosed;
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const invested = remainingVolume * entryPrice;
            totalInvested += invested;

            // Verifica se entryPrice è ragionevole
            const currentPrice = await getSymbolPrice(pos.symbol).catch(() => null);
            const priceRatio = currentPrice && entryPrice > 0 ? entryPrice / currentPrice : null;
            const isEntryPriceAnomalous = priceRatio && (priceRatio > 10 || priceRatio < 0.1);

            openPositionsDetail.push({
                ticket_id: pos.ticket_id,
                symbol: pos.symbol,
                type: pos.type,
                entry_price: entryPrice,
                current_price: currentPrice,
                price_ratio: priceRatio,
                is_anomalous: isEntryPriceAnomalous,
                volume: remainingVolume,
                invested: invested
            });
        }

        const closedPositionsDetail = [];
        for (const pos of closedPositions) {
            const volume = parseFloat(pos.volume) || 0;
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const closePrice = parseFloat(pos.current_price) || 0;
            const pnl = parseFloat(pos.profit_loss) || 0;

            const invested = volume * entryPrice;
            const returned = volume * closePrice;

            totalInvested += invested; // Investito quando era aperta
            totalReturned += returned; // Tornato quando chiusa
            totalPnL += pnl;

            // Verifica anomalie
            const priceRatio = entryPrice > 0 && closePrice > 0 ? closePrice / entryPrice : null;
            const isAnomalous = priceRatio && (priceRatio > 100 || priceRatio < 0.01);

            closedPositionsDetail.push({
                ticket_id: pos.ticket_id,
                symbol: pos.symbol,
                type: pos.type,
                entry_price: entryPrice,
                close_price: closePrice,
                price_ratio: priceRatio,
                is_anomalous: isAnomalous,
                volume: volume,
                invested: invested,
                returned: returned,
                pnl: pnl,
                closed_at: pos.closed_at
            });
        }

        // Balance attuale dal DB
        const currentBalance = parseFloat(portfolio.balance_usd) || 0;

        // Calcolo teorico: Balance = Initial - Invested + Returned
        // Se assumiamo che Initial = Balance + Invested - Returned
        const theoreticalInitial = currentBalance + totalInvested - totalReturned;

        // Verifica coerenza
        const expectedBalance = theoreticalInitial - totalInvested + totalReturned;
        const difference = currentBalance - expectedBalance;

        res.json({
            current_balance_db: currentBalance,
            calculations: {
                total_invested_open: totalInvested,
                total_returned_closed: totalReturned,
                total_pnl: totalPnL,
                theoretical_initial_capital: theoreticalInitial,
                expected_balance: expectedBalance,
                difference: difference,
                is_consistent: Math.abs(difference) < 0.01
            },
            open_positions: {
                count: openPositions.length,
                detail: openPositionsDetail,
                total_invested: totalInvested
            },
            closed_positions: {
                count: closedPositions.length,
                detail: closedPositionsDetail.slice(0, 20), // Prime 20
                total_returned: totalReturned,
                total_pnl: totalPnL
            },
            anomalies: {
                anomalous_open_positions: openPositionsDetail.filter(p => p.is_anomalous),
                anomalous_closed_positions: closedPositionsDetail.filter(p => p.is_anomalous)
            }
        });
    } catch (error) {
        console.error('❌ Error verifying balance calculation:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ ENDPOINT DIAGNOSTICA: Analisi completa Total Balance
router.get('/total-balance-analysis', async (req, res) => {
    try {
        const portfolio = await getPortfolio();
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        const closedPositions = await dbAll("SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken') ORDER BY closed_at DESC LIMIT 10");

        // Calcola capitale investito in posizioni aperte
        let capitalInvested = 0;
        const positionsDetail = [];

        openPositions.forEach(pos => {
            const volume = parseFloat(pos.volume) || 0;
            const volumeClosed = parseFloat(pos.volume_closed) || 0;
            const remainingVolume = volume - volumeClosed;
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const invested = remainingVolume * entryPrice;
            capitalInvested += invested;

            positionsDetail.push({
                ticket_id: pos.ticket_id,
                symbol: pos.symbol,
                type: pos.type,
                entry_price: entryPrice,
                volume: remainingVolume,
                capital_invested: invested
            });
        });

        // Calcola P&L realizzato da posizioni chiuse
        let realizedPnL = 0;
        closedPositions.forEach(pos => {
            const pnl = parseFloat(pos.profit_loss) || 0;
            realizedPnL += pnl;
        });

        // Balance attuale dal DB
        const currentBalance = parseFloat(portfolio.balance_usd) || 0;

        // Calcolo teorico: Se parti con X, investi Y, chiudi con P&L Z
        // Balance finale = X - Y + (capitale tornato) + P&L
        // Ma non conosciamo X iniziale, quindi calcoliamo:
        // X teorico = Balance attuale + Capitale investito - P&L realizzato
        const theoreticalInitialCapital = currentBalance + capitalInvested - realizedPnL;

        // Equity totale (cash + valore posizioni)
        let totalEquity = currentBalance;
        for (const pos of openPositions) {
            if (pos.type === 'buy') {
                // LONG: valore attuale delle crypto
                try {
                    const price = await getSymbolPrice(pos.symbol);
                    const volume = parseFloat(pos.volume) || 0;
                    const volumeClosed = parseFloat(pos.volume_closed) || 0;
                    const remainingVolume = volume - volumeClosed;
                    totalEquity += remainingVolume * price;
                } catch (e) {
                    // Skip se errore
                }
            } else {
                // SHORT: debito fisso (entry_price * volume)
                const volume = parseFloat(pos.volume) || 0;
                const volumeClosed = parseFloat(pos.volume_closed) || 0;
                const remainingVolume = volume - volumeClosed;
                const entryPrice = parseFloat(pos.entry_price) || 0;
                totalEquity -= remainingVolume * entryPrice; // Debito da sottrarre
            }
        }

        res.json({
            current_balance_db: currentBalance,
            capital_invested_open_positions: capitalInvested,
            realized_pnl_closed_positions: realizedPnL,
            theoretical_initial_capital: theoreticalInitialCapital,
            total_equity: totalEquity,
            open_positions_count: openPositions.length,
            closed_positions_count: closedPositions.length,
            explanation: {
                total_balance_shows: "Capitale disponibile (cash) = balance_usd dal database",
                formula: "Total Balance = balance_usd (capitale disponibile, non include posizioni aperte)",
                equity_formula: "Equity Totale = balance_usd + valore posizioni LONG - debito posizioni SHORT",
                note: "Se parti con €1000 e investi €500, Total Balance mostra €500 (capitale disponibile)"
            },
            positions_detail: positionsDetail,
            recent_closed_positions: closedPositions.slice(0, 5).map(pos => ({
                ticket_id: pos.ticket_id,
                symbol: pos.symbol,
                type: pos.type,
                entry_price: pos.entry_price,
                close_price: pos.current_price,
                profit_loss: pos.profit_loss,
                closed_at: pos.closed_at
            }))
        });
    } catch (error) {
        console.error('❌ Error in total balance analysis:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ ENDPOINT DIAGNOSTICA: Verifica stato Kelly Criterion Stats
router.get('/kelly-stats-debug', async (req, res) => {
    try {
        // Verifica se la tabella esiste (PostgreSQL)
        const tableCheck = await dbAll("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'performance_stats'");
        const tableExists = tableCheck && tableCheck.length > 0;

        // Leggi tutti i record
        const allRecords = await dbAll("SELECT * FROM performance_stats");

        // Leggi record con id=1
        const record1 = await dbGet("SELECT * FROM performance_stats WHERE id = 1");

        // Conta posizioni chiuse con P&L
        const closedPositions = await dbAll("SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken')");
        const winningPositions = closedPositions.filter(p => (parseFloat(p.profit_loss) || 0) > 0);
        const losingPositions = closedPositions.filter(p => (parseFloat(p.profit_loss) || 0) <= 0);

        res.json({
            table_exists: tableExists,
            all_records: allRecords,
            record_id_1: record1,
            record_count: allRecords ? allRecords.length : 0,
            actual_closed_positions: {
                total: closedPositions.length,
                winning: winningPositions.length,
                losing: losingPositions.length,
                total_profit: winningPositions.reduce((sum, p) => sum + (parseFloat(p.profit_loss) || 0), 0),
                total_loss: losingPositions.reduce((sum, p) => sum + (parseFloat(p.profit_loss) || 0), 0)
            },
            recommendation: !record1 ?
                "Record con id=1 non esiste. Eseguire: INSERT INTO performance_stats (id, total_trades, winning_trades, losing_trades, total_profit, total_loss, avg_win, avg_loss, win_rate) VALUES (1, 0, 0, 0, 0, 0, 0, 0, 0);" :
                "Record esiste. Verificare che i dati siano aggiornati correttamente."
        });
    } catch (error) {
        console.error('❌ Error in kelly stats debug:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ ENDPOINT DIAGNOSTICA: Verifica calcolo balance
router.get('/balance-diagnostic', async (req, res) => {
    try {
        const portfolio = await getPortfolio();
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        const closedPositions = await dbAll("SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken')");

        // Calcola capitale investito in posizioni aperte
        let capitalInvested = 0;
        openPositions.forEach(pos => {
            const volume = parseFloat(pos.volume) || 0;
            const volumeClosed = parseFloat(pos.volume_closed) || 0;
            const remainingVolume = volume - volumeClosed;
            const entryPrice = parseFloat(pos.entry_price) || 0;
            capitalInvested += remainingVolume * entryPrice;
        });

        // Calcola P&L realizzato da posizioni chiuse
        let realizedPnL = 0;
        closedPositions.forEach(pos => {
            const pnl = parseFloat(pos.profit_loss) || 0;
            realizedPnL += pnl;
        });

        // Balance attuale dal DB
        const currentBalance = parseFloat(portfolio.balance_usd) || 0;

        // Calcolo teorico: Balance = Capitale iniziale - Capitale investito + P&L realizzato
        // Ma non conosciamo il capitale iniziale, quindi usiamo: Balance attuale + Capitale investito - P&L realizzato = Capitale iniziale teorico
        const theoreticalInitialCapital = currentBalance + capitalInvested - realizedPnL;

        res.json({
            current_balance_db: currentBalance,
            capital_invested_open_positions: capitalInvested,
            realized_pnl_closed_positions: realizedPnL,
            theoretical_initial_capital: theoreticalInitialCapital,
            open_positions_count: openPositions.length,
            closed_positions_count: closedPositions.length,
            calculation: {
                formula: 'Balance = Initial Capital - Capital Invested + Realized P&L',
                current_balance: currentBalance,
                should_be: theoreticalInitialCapital - capitalInvested + realizedPnL,
                difference: currentBalance - (theoreticalInitialCapital - capitalInvested + realizedPnL)
            },
            open_positions_detail: openPositions.map(pos => ({
                ticket_id: pos.ticket_id,
                symbol: pos.symbol,
                type: pos.type,
                volume: pos.volume,
                volume_closed: pos.volume_closed,
                entry_price: pos.entry_price,
                capital_invested: (parseFloat(pos.volume) - (parseFloat(pos.volume_closed) || 0)) * parseFloat(pos.entry_price)
            }))
        });
    } catch (error) {
        console.error('❌ Error in balance diagnostic:', error);
        res.status(500).json({ error: error.message });
    }
});

// 🔍 DEBUG: Verifica se i filtri professionali sono attivi
router.get('/debug-positions', async (req, res) => {
    try {
        console.log('🔍 [DEBUG-POSITIONS] Verifica filtri professionali...');

        const openPositions = await dbAll(`
            SELECT 
                ticket_id,
                symbol,
                type,
                entry_price,
                current_price,
                profit_loss,
                profit_loss_pct,
                opened_at,
                volume,
                signal_details
            FROM open_positions 
            WHERE status = 'open'
            ORDER BY opened_at DESC 
            LIMIT 10
        `);

        const closedPositions = await dbAll(`
            SELECT 
                ticket_id,
                symbol,
                type,
                entry_price,
                current_price,
                profit_loss,
                profit_loss_pct,
                opened_at,
                closed_at,
                volume,
                signal_details
            FROM open_positions 
            WHERE status IN ('closed', 'stopped', 'taken')
            ORDER BY closed_at DESC 
            LIMIT 10
        `);

        // Analizza posizioni aperte
        const openAnalysis = openPositions.map(pos => {
            let hasProfessionalFilters = false;
            let professionalData = null;
            let botVersion = 'UNKNOWN';

            if (pos.signal_details) {
                try {
                    const signal = typeof pos.signal_details === 'string'
                        ? JSON.parse(pos.signal_details)
                        : pos.signal_details;

                    if (signal.professionalAnalysis) {
                        hasProfessionalFilters = true;
                        botVersion = 'NEW (Professional)';
                        professionalData = {
                            momentumQuality: signal.professionalAnalysis.momentumQuality ? {
                                score: signal.professionalAnalysis.momentumQuality.score,
                                isHealthy: signal.professionalAnalysis.momentumQuality.isHealthy,
                                warnings: signal.professionalAnalysis.momentumQuality.warnings
                            } : null,
                            reversalRisk: signal.professionalAnalysis.reversalRisk ? {
                                risk: signal.professionalAnalysis.reversalRisk.risk,
                                score: signal.professionalAnalysis.reversalRisk.score,
                                reasons: signal.professionalAnalysis.reversalRisk.reasons
                            } : null,
                            marketStructure: signal.professionalAnalysis.marketStructure ? {
                                nearestResistance: signal.professionalAnalysis.marketStructure.nearestResistance,
                                nearestSupport: signal.professionalAnalysis.marketStructure.nearestSupport
                            } : null,
                            riskReward: signal.professionalAnalysis.riskReward
                        };
                    } else {
                        botVersion = 'OLD (No Professional Filters)';
                    }
                } catch (e) {
                    botVersion = 'ERROR (Cannot parse signal_details)';
                }
            } else {
                botVersion = 'VERY OLD (No signal_details)';
            }

            return {
                ticket_id: pos.ticket_id,
                symbol: pos.symbol,
                type: pos.type,
                entry_price: pos.entry_price,
                current_price: pos.current_price,
                profit_loss: pos.profit_loss,
                profit_loss_pct: pos.profit_loss_pct,
                opened_at: pos.opened_at,
                botVersion,
                hasProfessionalFilters,
                professionalData
            };
        });

        // Analizza posizioni chiuse
        const closedAnalysis = closedPositions.map(pos => {
            let hasProfessionalFilters = false;
            let botVersion = 'UNKNOWN';

            if (pos.signal_details) {
                try {
                    const signal = typeof pos.signal_details === 'string'
                        ? JSON.parse(pos.signal_details)
                        : pos.signal_details;

                    if (signal.professionalAnalysis) {
                        hasProfessionalFilters = true;
                        botVersion = 'NEW (Professional)';
                    } else {
                        botVersion = 'OLD (No Professional Filters)';
                    }
                } catch (e) {
                    botVersion = 'ERROR';
                }
            } else {
                botVersion = 'VERY OLD';
            }

            const duration = pos.closed_at && pos.opened_at
                ? Math.round((new Date(pos.closed_at) - new Date(pos.opened_at)) / 1000 / 60)
                : 0;

            return {
                ticket_id: pos.ticket_id,
                symbol: pos.symbol,
                type: pos.type,
                entry_price: pos.entry_price,
                exit_price: pos.current_price,
                profit_loss: pos.profit_loss,
                profit_loss_pct: pos.profit_loss_pct,
                opened_at: pos.opened_at,
                closed_at: pos.closed_at,
                duration_minutes: duration,
                botVersion,
                hasProfessionalFilters
            };
        });

        // Summary
        const summary = {
            openPositions: {
                total: openPositions.length,
                withProfessionalFilters: openAnalysis.filter(p => p.hasProfessionalFilters).length,
                withoutProfessionalFilters: openAnalysis.filter(p => !p.hasProfessionalFilters).length
            },
            closedPositions: {
                total: closedPositions.length,
                withProfessionalFilters: closedAnalysis.filter(p => p.hasProfessionalFilters).length,
                withoutProfessionalFilters: closedAnalysis.filter(p => !p.hasProfessionalFilters).length
            }
        };

        res.json({
            summary,
            openPositions: openAnalysis,
            closedPositions: closedAnalysis,
            message: summary.openPositions.withProfessionalFilters > 0
                ? '✅ Bot NUOVO attivo - Filtri professionali funzionanti'
                : summary.openPositions.total > 0
                    ? '⚠️ Bot VECCHIO - Posizioni aperte SENZA filtri professionali'
                    : '⚠️ Nessuna posizione aperta per verificare'
        });

    } catch (error) {
        console.error('❌ Error in debug-positions:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
module.exports.setSocketIO = setSocketIO;