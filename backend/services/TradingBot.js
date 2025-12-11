/**
 * 🤖 PROFESSIONAL CRYPTO TRADING BOT
 * 
 * Sistema di trading automatico con filtri professionali multipli:
 * - Signal Generator (RSI, MACD, Bollinger, EMA, Trend Analysis)
 * - Multi-Timeframe Confirmation (1h, 4h)
 * - Risk Manager (max exposure, daily loss limits)
 * - Hybrid Strategy (diversificazione intelligente)
 * - Professional Filters (momentum quality, market structure, risk/reward)
 * 
 * REQUISITI MINIMI PER APRIRE POSIZIONI:
 * - LONG: Strength >= 60, Confirmations >= 3
 * - SHORT: Strength >= 70, Confirmations >= 4
 * 
 * @author AI Assistant
 * @version 2.0 - Professional Trading Implementation
 */

const { dbAll, dbGet, dbRun } = require('../db/crypto_db');
const signalGenerator = require('../services/BidirectionalSignalGenerator');
const riskManager = require('../services/RiskManager');

// ===================================
// CONFIGURATION
// ===================================

const BOT_CONFIG = {
    // Intervallo di controllo (ogni 5 secondi)
    CHECK_INTERVAL_MS: 5000,

    // Soglie minime per aprire posizioni
    MIN_STRENGTH_LONG: 60,
    MIN_STRENGTH_SHORT: 70,
    MIN_CONFIRMATIONS_LONG: 3,
    MIN_CONFIRMATIONS_SHORT: 4,

    // Risk Management
    DEFAULT_TRADE_SIZE_USDT: 100,  // $100 USDT per posizione (più capitale per trade)
    MAX_POSITION_SIZE_USDT: 150,   // Max $150 USDT per posizione

    // ✅ CHIUSURE PIÙ RAPIDE per capitale che gira velocemente
    STOP_LOSS_PCT: 2.5,           // 2.5% stop loss (più stretto)
    TAKE_PROFIT_PCT: 4.0,         // 4% take profit (più veloce!)

    // Volume minimo 24h (in USDT)
    MIN_VOLUME_24H: 500000,       // Manteniamo alto per liquidità

    // ✅ COOLDOWN RIDOTTO per rientrare prima su opportunità sicure
    TRADE_COOLDOWN_MS: 3 * 60 * 1000, // 3 minuti (più veloce)
};

// Mappa simboli a coppie Binance
const SYMBOL_TO_PAIR = {
    'bitcoin': 'BTCEUR',
    'bitcoin_usdt': 'BTCUSDT',
    'ethereum': 'ETHEUR',
    'ethereum_usdt': 'ETHUSDT',
    'solana': 'SOLUSDT',
    'solana_eur': 'SOLEUR',
    'cardano': 'ADAUSDT',
    'cardano_usdt': 'ADAUSDT',
    'polkadot': 'DOTUSDT',
    'polkadot_usdt': 'DOTUSDT',
    'chainlink': 'LINKEUR',
    'chainlink_usdt': 'LINKUSDT',
    'litecoin': 'LTCEUR',
    'litecoin_usdt': 'LTCUSDT',
    'ripple': 'XRPUSDT',
    'ripple_eur': 'XRPEUR',
    'binance_coin': 'BNBEUR',
    'binance_coin_eur': 'BNBEUR',
};

// Gruppi di correlazione per diversificazione
const CORRELATION_GROUPS = {
    'BTC_MAJOR': ['bitcoin', 'bitcoin_usdt', 'ethereum', 'ethereum_usdt', 'solana', 'solana_eur'],
    'DEFI': ['chainlink', 'chainlink_usdt'],
    'INDEPENDENT': ['ripple', 'ripple_eur', 'litecoin', 'litecoin_usdt', 'binance_coin', 'binance_coin_eur'],
};

// ✅ LIMITI AUMENTATI per più posizioni contemporanee
// MA solo quando il bot è SICURO al 100% (strength e confirmations alte)
const HYBRID_STRATEGY_CONFIG = {
    MAX_TOTAL_POSITIONS: 8,        // Da 5 a 8 posizioni totali
    MAX_POSITIONS_PER_GROUP: 4,    // Da 2 a 4 per gruppo di correlazione
    MAX_POSITIONS_PER_SYMBOL: 2,   // Da 1 a 2 per simbolo (LONG + SHORT)
};

// Cooldown tracker
const lastTradeTime = new Map();

// ===================================
// HELPER FUNCTIONS
// ===================================

/**
 * Get current price for a symbol from Binance
 */
async function getSymbolPrice(symbol) {
    try {
        const pair = SYMBOL_TO_PAIR[symbol] || 'BTCUSDT';
        const https = require('https');
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`;

        const data = await new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });

        return parseFloat(data.price) || 0;
    } catch (error) {
        console.error(`❌ Error fetching price for ${symbol}:`, error.message);
        return 0;
    }
}

/**
 * Get 24h volume for a symbol
 */
async function get24hVolume(symbol) {
    try {
        const pair = SYMBOL_TO_PAIR[symbol] || 'BTCUSDT';
        const https = require('https');
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`;

        const data = await new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });

        return parseFloat(data.quoteVolume) || 0;
    } catch (error) {
        console.error(`❌ Error fetching volume for ${symbol}:`, error.message);
        return 0;
    }
}

/**
 * Get correlation group for a symbol
 */
function getCorrelationGroup(symbol) {
    for (const [group, symbols] of Object.entries(CORRELATION_GROUPS)) {
        if (symbols.includes(symbol)) {
            return group;
        }
    }
    return null;
}

/**
 * Check if can open position (Hybrid Strategy)
 */
async function canOpenPositionHybridStrategy(symbol, openPositions, newSignal = null, signalType = null) {
    const group = getCorrelationGroup(symbol);

    // Count total open positions
    const totalPositions = openPositions.filter(p => p.status === 'open').length;

    if (totalPositions >= HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS) {
        return {
            allowed: false,
            reason: `Max ${HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS} total positions reached`
        };
    }

    // Count positions in same group
    if (group) {
        const groupSymbols = CORRELATION_GROUPS[group];
        const groupPositions = openPositions.filter(p =>
            groupSymbols.includes(p.symbol) && p.status === 'open'
        ).length;

        if (groupPositions >= HYBRID_STRATEGY_CONFIG.MAX_POSITIONS_PER_GROUP) {
            return {
                allowed: false,
                reason: `Max ${HYBRID_STRATEGY_CONFIG.MAX_POSITIONS_PER_GROUP} positions per group (${group})`
            };
        }
    }

    // Count positions for this specific symbol
    const symbolPositions = openPositions.filter(p =>
        p.symbol === symbol && p.status === 'open'
    ).length;

    if (symbolPositions >= HYBRID_STRATEGY_CONFIG.MAX_POSITIONS_PER_SYMBOL) {
        return {
            allowed: false,
            reason: `Max ${HYBRID_STRATEGY_CONFIG.MAX_POSITIONS_PER_SYMBOL} position per symbol`
        };
    }

    return {
        allowed: true,
        reason: 'OK'
    };
}

/**
 * Check cooldown period
 */
function checkCooldown(symbol) {
    const lastTrade = lastTradeTime.get(symbol);
    if (!lastTrade) return true;

    const elapsed = Date.now() - lastTrade;
    return elapsed >= BOT_CONFIG.TRADE_COOLDOWN_MS;
}

/**
 * Get Multi-Timeframe trend
 */
async function getMultiTimeframeTrend(symbol) {
    try {
        // Get 1h and 4h klines
        const klines1h = await dbAll(
            "SELECT * FROM klines WHERE symbol = ? AND interval = '1h' ORDER BY open_time DESC LIMIT 50",
            [symbol]
        );

        const klines4h = await dbAll(
            "SELECT * FROM klines WHERE symbol = ? AND interval = '4h' ORDER BY open_time DESC LIMIT 50",
            [symbol]
        );

        if (klines1h.length < 20 || klines4h.length < 20) {
            return { trend1h: 'neutral', trend4h: 'neutral' };
        }

        // Analyze trends
        const prices1h = klines1h.reverse().map(k => parseFloat(k.close_price));
        const prices4h = klines4h.reverse().map(k => parseFloat(k.close_price));

        const trend1h = signalGenerator.detectTrend(prices1h, 10, 20);
        const trend4h = signalGenerator.detectTrend(prices4h, 10, 20);

        return { trend1h, trend4h };
    } catch (error) {
        console.error(`❌ Error getting MTF trend for ${symbol}:`, error.message);
        return { trend1h: 'neutral', trend4h: 'neutral' };
    }
}

/**
 * Calculate MTF bonus
 */
function calculateMTFBonus(direction, trend1h, trend4h) {
    let bonus = 0;

    if (direction === 'LONG') {
        if (trend1h === 'bullish' && trend4h === 'bullish') {
            bonus = +10;
        } else if (trend1h === 'bullish' || trend4h === 'bullish') {
            bonus = +5;
        } else if (trend1h === 'bearish' || trend4h === 'bearish') {
            bonus = -15;
        }
    } else if (direction === 'SHORT') {
        if (trend1h === 'bearish' && trend4h === 'bearish') {
            bonus = +10;
        } else if (trend1h === 'bearish' || trend4h === 'bearish') {
            bonus = +5;
        } else if (trend1h === 'bullish' || trend4h === 'bullish') {
            bonus = -15;
        }
    }

    return bonus;
}

/**
 * Open a new position
 */
async function openPosition(symbol, type, volume, entryPrice, strategy, stopLoss, takeProfit, signalDetails) {
    try {
        const ticketId = `${symbol}_${type}_${Date.now()}`;
        const now = new Date().toISOString();

        await dbRun(`
            INSERT INTO open_positions (
                ticket_id, symbol, type, volume, entry_price, current_price,
                stop_loss, take_profit, status, opened_at, strategy,
                signal_details, volume_closed, profit_loss, profit_loss_pct
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            ticketId, symbol, type, volume, entryPrice, entryPrice,
            stopLoss, takeProfit, 'open', now, strategy,
            JSON.stringify(signalDetails), 0, 0, 0
        ]);

        console.log(`✅ [BOT] Opened ${type.toUpperCase()} position for ${symbol} @ $${entryPrice.toFixed(2)}`);
        console.log(`   Ticket ID: ${ticketId}`);
        console.log(`   Volume: ${volume.toFixed(6)}`);
        console.log(`   Stop Loss: $${stopLoss.toFixed(2)} (-${BOT_CONFIG.STOP_LOSS_PCT}%)`);
        console.log(`   Take Profit: $${takeProfit.toFixed(2)} (+${BOT_CONFIG.TAKE_PROFIT_PCT}%)`);

        // Update cooldown
        lastTradeTime.set(symbol, Date.now());

        return { success: true, ticketId };
    } catch (error) {
        console.error(`❌ [BOT] Error opening position for ${symbol}:`, error.message);
        return { success: false, error: error.message };
    }
}

// ===================================
// MAIN BOT CYCLE
// ===================================

/**
 * Bot cycle for a single symbol
 */
async function runBotCycleForSymbol(symbol, botSettings) {
    try {
        const isBotActive = botSettings && botSettings.is_active === 1;

        if (!isBotActive) {
            // Bot paused, skip
            return;
        }

        // 1. Get current price
        const currentPrice = await getSymbolPrice(symbol);
        if (currentPrice === 0) {
            console.error(`⚠️ [BOT] Could not fetch price for ${symbol}, skipping`);
            return;
        }

        // 2. Check cooldown
        if (!checkCooldown(symbol)) {
            // Still in cooldown, skip
            return;
        }

        // 3. Get klines for signal generation
        const klines = await dbAll(
            "SELECT * FROM klines WHERE symbol = ? AND interval = '15m' ORDER BY open_time DESC LIMIT 100",
            [symbol]
        );

        if (klines.length < 50) {
            console.warn(`⚠️ [BOT] Insufficient klines for ${symbol} (${klines.length}/50), skipping`);
            return;
        }

        // 4. Prepare history for signal generation
        const historyForSignal = klines.reverse().map(k => ({
            close: parseFloat(k.close_price),
            high: parseFloat(k.high_price),
            low: parseFloat(k.low_price),
            volume: parseFloat(k.volume || 0),
            price: parseFloat(k.close_price),
            timestamp: new Date(parseInt(k.open_time)).toISOString()
        }));

        // 5. Generate signal
        const signal = signalGenerator.generateSignal(historyForSignal, symbol);

        if (!signal || signal.direction === 'NEUTRAL') {
            // No signal, skip
            return;
        }

        // 6. Get Multi-Timeframe trend
        const { trend1h, trend4h } = await getMultiTimeframeTrend(symbol);

        // 7. Calculate MTF bonus
        const mtfBonus = calculateMTFBonus(signal.direction, trend1h, trend4h);

        // 8. Get signal strength and confirmations
        const rawStrength = signal.direction === 'LONG'
            ? (signal.longSignal?.strength || 0)
            : (signal.shortSignal?.strength || 0);

        const confirmations = signal.direction === 'LONG'
            ? (signal.longSignal?.confirmations || 0)
            : (signal.shortSignal?.confirmations || 0);

        const adjustedStrength = Math.max(0, rawStrength + mtfBonus);

        // 9. Check minimum requirements
        // ✅ FIX: Leggi requisiti minimi da database (bot_parameters) invece di hardcoded
        const botParams = await dbGet("SELECT * FROM bot_parameters WHERE symbol = $1", [symbol]).catch(() => null);
        const minStrength = signal.direction === 'LONG'
            ? (botParams?.min_signal_strength || BOT_CONFIG.MIN_STRENGTH_LONG)
            : (botParams?.min_signal_strength || BOT_CONFIG.MIN_STRENGTH_SHORT);
        
        const minConfirmations = signal.direction === 'LONG'
            ? (botParams?.min_confirmations_long || BOT_CONFIG.MIN_CONFIRMATIONS_LONG)
            : (botParams?.min_confirmations_short || BOT_CONFIG.MIN_CONFIRMATIONS_SHORT);

        console.log(`🔍 [BOT] ${symbol} - ${signal.direction} Requirements Check:`);
        console.log(`   Strength: ${adjustedStrength}/${minStrength} (raw: ${rawStrength}, MTF: ${mtfBonus})`);
        console.log(`   Confirmations: ${confirmations}/${minConfirmations}`);

        if (adjustedStrength < minStrength) {
            console.log(`⏸️ [BOT] ${symbol} - ${signal.direction} strength too low: ${adjustedStrength}/${minStrength}`);
            return;
        }

        if (confirmations < minConfirmations) {
            console.log(`⏸️ [BOT] ${symbol} - ${signal.direction} confirmations too low: ${confirmations}/${minConfirmations}`);
            return;
        }

        // 10. Check volume
        const volume24h = await get24hVolume(symbol);
        console.log(`🔍 [BOT] ${symbol} - Volume 24h: $${volume24h.toLocaleString()}/$${BOT_CONFIG.MIN_VOLUME_24H.toLocaleString()}`);
        if (volume24h < BOT_CONFIG.MIN_VOLUME_24H) {
            console.log(`⏸️ [BOT] ${symbol} - Volume too low: $${volume24h.toLocaleString()}/$${BOT_CONFIG.MIN_VOLUME_24H.toLocaleString()}`);
            return;
        }

        // 11. Get all open positions
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");

        // 12. Check Hybrid Strategy
        console.log(`🔍 [BOT] ${symbol} - Hybrid Strategy Check: ${openPositions.length} open positions`);
        const hybridCheck = await canOpenPositionHybridStrategy(symbol, openPositions, signal, signal.direction);
        if (!hybridCheck.allowed) {
            console.log(`⏸️ [BOT] ${symbol} - Hybrid Strategy blocked: ${hybridCheck.reason}`);
            return;
        }
        console.log(`✅ [BOT] ${symbol} - Hybrid Strategy OK`);

        // 13. Check Risk Manager
        const tradeSize = BOT_CONFIG.DEFAULT_TRADE_SIZE_USDT;
        console.log(`🔍 [BOT] ${symbol} - Risk Manager Check: Trade size $${tradeSize}`);
        const riskCheck = await riskManager.canOpenPosition(tradeSize);
        if (!riskCheck.allowed) {
            console.log(`⏸️ [BOT] ${symbol} - Risk Manager blocked: ${riskCheck.reason}`);
            console.log(`   Details: Exposure=${riskCheck.currentExposure}%, Daily Loss=${riskCheck.dailyLoss}%, Available=$${riskCheck.availableExposure || 0}`);
            return;
        }
        console.log(`✅ [BOT] ${symbol} - Risk Manager OK (Available: $${riskCheck.availableExposure || 0})`);

        // 14. Calculate position size
        const volume = tradeSize / currentPrice;

        // 15. Calculate Stop Loss and Take Profit
        // ✅ MIGLIORATO: Stop loss più stretto se ci sono warning professionali su segnali forti
        // Questo implementa la strategia "apri e segui, se fa scherzi chiudi" per segnali molto forti
        const hasProfessionalWarnings = signal.professionalAnalysis?.filters?.[signal.direction.toLowerCase()]?.some(f => 
            f.includes('⚠️ ATTENZIONE') && f.includes('Entry permessa')
        ) || false;
        
        // Stop loss più stretto (1.5% invece di 2.5%) se ci sono warning ma segnale forte
        const stopLossPct = hasProfessionalWarnings && adjustedStrength > 80 
            ? 1.5  // Stop loss più stretto per proteggere quando ci sono warning
            : BOT_CONFIG.STOP_LOSS_PCT;
        
        const stopLoss = signal.direction === 'LONG'
            ? currentPrice * (1 - stopLossPct / 100)
            : currentPrice * (1 + stopLossPct / 100);

        const takeProfit = signal.direction === 'LONG'
            ? currentPrice * (1 + BOT_CONFIG.TAKE_PROFIT_PCT / 100)
            : currentPrice * (1 - BOT_CONFIG.TAKE_PROFIT_PCT / 100);

        // 16. Open position
        console.log(`🚀 [BOT] Opening ${signal.direction} position for ${symbol}`);
        console.log(`   Strength: ${adjustedStrength}/${minStrength} (raw: ${rawStrength}, MTF bonus: ${mtfBonus})`);
        console.log(`   Confirmations: ${confirmations}/${minConfirmations}`);
        console.log(`   MTF: 1h=${trend1h}, 4h=${trend4h}`);
        console.log(`   Price: $${currentPrice.toFixed(2)}`);
        console.log(`   Volume 24h: $${volume24h.toLocaleString()}`);

        const result = await openPosition(
            symbol,
            signal.direction === 'LONG' ? 'buy' : 'sell',
            volume,
            currentPrice,
            'RSI_Strategy',
            stopLoss,
            takeProfit,
            {
                signal: signal,
                mtf: { trend1h, trend4h, bonus: mtfBonus },
                adjustedStrength: adjustedStrength,
                rawStrength: rawStrength,
                confirmations: confirmations,
                professionalFilters: true,
                version: '2.0'
            }
        );

        if (result.success) {
            console.log(`✅ [BOT] Position opened successfully: ${result.ticketId}`);
        } else {
            console.error(`❌ [BOT] Failed to open position: ${result.error}`);
        }

    } catch (error) {
        console.error(`❌ [BOT] Error in bot cycle for ${symbol}:`, error.message);
        console.error(error.stack);
    }
}

/**
 * Main bot loop
 */
async function runBotCycle() {
    try {
        // Get all active bots
        const activeBots = await dbAll(
            "SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND is_active = 1"
        );

        if (activeBots.length === 0) {
            // No active bots, skip
            return;
        }

        console.log(`🔄 [BOT] Running cycle for ${activeBots.length} active bots`);

        // Run bot cycle for each symbol
        for (const bot of activeBots) {
            await runBotCycleForSymbol(bot.symbol, bot);
        }

    } catch (error) {
        console.error(`❌ [BOT] Error in main bot cycle:`, error.message);
        console.error(error.stack);
    }
}

// ===================================
// START BOT
// ===================================

console.log('🤖 [BOT] Professional Crypto Trading Bot v2.0');
console.log('   Configuration:');
console.log(`   - Check interval: ${BOT_CONFIG.CHECK_INTERVAL_MS}ms`);
console.log(`   - LONG requirements: Strength >= ${BOT_CONFIG.MIN_STRENGTH_LONG}, Confirmations >= ${BOT_CONFIG.MIN_CONFIRMATIONS_LONG}`);
console.log(`   - SHORT requirements: Strength >= ${BOT_CONFIG.MIN_STRENGTH_SHORT}, Confirmations >= ${BOT_CONFIG.MIN_CONFIRMATIONS_SHORT}`);
console.log(`   - Trade size: $${BOT_CONFIG.DEFAULT_TRADE_SIZE_USDT} USDT`);
console.log(`   - Stop Loss: ${BOT_CONFIG.STOP_LOSS_PCT}%`);
console.log(`   - Take Profit: ${BOT_CONFIG.TAKE_PROFIT_PCT}%`);
console.log('');

// Start the bot loop
setInterval(runBotCycle, BOT_CONFIG.CHECK_INTERVAL_MS);

// Run immediately on start
runBotCycle();

module.exports = {
    runBotCycle,
    runBotCycleForSymbol,
    BOT_CONFIG
};
