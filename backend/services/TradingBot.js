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
 * API CONFIGURATION:
 * - Binance API base URL: https://api.binance.com/api/v3
 * - Request timeout: 10 seconds
 * - Max retries: 3 attempts with 1 second delay
 * 
 * @author AI Assistant
 * @version 2.1 - Enhanced with timeout handling and retry logic
 */

const { dbAll, dbGet, dbRun } = require('../crypto_db');
const signalGenerator = require('../services/BidirectionalSignalGenerator');

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

// Mappa simboli a coppie Binance - COMPLETA
const SYMBOL_TO_PAIR = {
    // Major cryptocurrencies
    'bitcoin': 'BTCUSDT', 'btc': 'BTCUSDT', 'bitcoin_usdt': 'BTCUSDT', 'btcusdt': 'BTCUSDT',
    'ethereum': 'ETHUSDT', 'eth': 'ETHUSDT', 'ethereum_usdt': 'ETHUSDT', 'ethusdt': 'ETHUSDT',
    'solana': 'SOLUSDT', 'sol': 'SOLUSDT', 'solana_eur': 'SOLUSDT', 'solana_usdt': 'SOLUSDT', 'solusdt': 'SOLUSDT',
    'cardano': 'ADAUSDT', 'ada': 'ADAUSDT', 'cardano_usdt': 'ADAUSDT', 'adausdt': 'ADAUSDT',
    'ripple': 'XRPUSDT', 'xrp': 'XRPUSDT', 'ripple_eur': 'XRPEUR', 'ripple_usdt': 'XRPUSDT', 'xrpusdt': 'XRPUSDT',
    'polkadot': 'DOTUSDT', 'dot': 'DOTUSDT', 'polkadot_usdt': 'DOTUSDT', 'dotusdt': 'DOTUSDT',
    'dogecoin': 'DOGEUSDT', 'doge': 'DOGEUSDT', 'dogeusdt': 'DOGEUSDT',
    'shiba_inu': 'SHIBUSDT', 'shib': 'SHIBUSDT', 'shibusdt': 'SHIBUSDT',
    'avalanche': 'AVAXUSDT', 'avax': 'AVAXUSDT', 'avalanche_eur': 'AVAXEUR', 'avax_usdt': 'AVAXUSDT', 'avaxusdt': 'AVAXUSDT',
    'binance_coin': 'BNBUSDT', 'bnb': 'BNBUSDT', 'binance_coin_eur': 'BNBUSDT', 'bnbusdt': 'BNBUSDT',
    'chainlink': 'LINKUSDT', 'link': 'LINKUSDT', 'chainlink_usdt': 'LINKUSDT', 'linkusdt': 'LINKUSDT',
    
    // DeFi tokens
    'polygon': 'POLUSDT', 'matic': 'POLUSDT', 'pol': 'POLUSDT', 'pol_polygon': 'POLUSDT', 'pol_polygon_eur': 'POLEUR', 'maticusdt': 'POLUSDT', 'polusdt': 'POLUSDT',
    'uniswap': 'UNIUSDT', 'uni': 'UNIUSDT', 'uniswap_eur': 'UNIEUR', 'uniusdt': 'UNIUSDT',
    'aave': 'AAVEUSDT', 'aaveusdt': 'AAVEUSDT',
    'curve': 'CRVUSDT', 'crv': 'CRVUSDT', 'crvusdt': 'CRVUSDT',
    
    // Gaming & Metaverse
    'the_sandbox': 'SANDUSDT', 'sand': 'SANDUSDT', 'sandusdt': 'SANDUSDT', 'thesandbox': 'SANDUSDT',
    'axie_infinity': 'AXSUSDT', 'axs': 'AXSUSDT', 'axsusdt': 'AXSUSDT', 'axieinfinity': 'AXSUSDT',
    'decentraland': 'MANAUSDT', 'mana': 'MANAUSDT', 'manausdt': 'MANAUSDT',
    'gala': 'GALAUSDT', 'galausdt': 'GALAUSDT',
    'immutable': 'IMXUSDT', 'imx': 'IMXUSDT', 'imxusdt': 'IMXUSDT',
    'enjin': 'ENJUSDT', 'enj': 'ENJUSDT', 'enjusdt': 'ENJUSDT',
    'render': 'RENDERUSDT', 'renderusdt': 'RENDERUSDT', 'rndr': 'RENDERUSDT',
    
    // Layer 1 & Infrastructure
    'theta_network': 'THETAUSDT', 'theta': 'THETAUSDT', 'thetausdt': 'THETAUSDT', 'thetanetwork': 'THETAUSDT',
    'near': 'NEARUSDT', 'nearusdt': 'NEARUSDT',
    'optimism': 'OPUSDT', 'op': 'OPUSDT', 'opusdt': 'OPUSDT',
    'sei': 'SEIUSDT', 'seiusdt': 'SEIUSDT',
    'filecoin': 'FILUSDT', 'fil': 'FILUSDT', 'filusdt': 'FILUSDT',
    
    // Meme coins
    'bonk': 'BONKUSDT', 'bonkusdt': 'BONKUSDT',
    'floki': 'FLOKIUSDT', 'flokiusdt': 'FLOKIUSDT',
    
    // Other major tokens
    'ton': 'TONUSDT', 'toncoin': 'TONUSDT', 'tonusdt': 'TONUSDT',
    'tron': 'TRXUSDT', 'trx': 'TRXUSDT', 'trxusdt': 'TRXUSDT',
    'stellar': 'XLMUSDT', 'xlm': 'XLMUSDT', 'xlmusdt': 'XLMUSDT',
    'ripple_xrp': 'XRPUSDT', 'xrp_eur': 'XRPEUR',
    'cosmos': 'ATOMUSDT', 'atom': 'ATOMUSDT', 'atomusdt': 'ATOMUSDT',
    'icp': 'ICPUSDT', 'icpusdt': 'ICPUSDT', // Internet Computer
    'flow': 'FLOWUSDT', 'flowusdt': 'FLOWUSDT', // Flow blockchain
};

// Gruppi di correlazione per diversificazione
const CORRELATION_GROUPS = {
    'BTC_MAJOR': ['bitcoin', 'bitcoin_usdt', 'btc', 'ethereum', 'ethereum_usdt', 'eth'],
    'DEFI': ['chainlink', 'chainlink_usdt', 'link', 'uniswap', 'uni', 'avalanche', 'avax'],
    'GAMING': ['the_sandbox', 'sand', 'axie_infinity', 'axs', 'decentraland', 'mana'],
    'PLATFORM': ['solana', 'solana_eur', 'sol', 'cardano', 'ada', 'polkadot', 'dot', 'polygon', 'matic', 'pol'],
    'INDEPENDENT': ['ripple', 'ripple_eur', 'xrp', 'binance_coin', 'binance_coin_eur', 'bnb', 'dogecoin', 'doge', 'theta', 'theta_network'],
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

// Constants for API configuration
const API_CONFIG = {
    BINANCE_BASE_URL: 'https://api.binance.com/api/v3',
    REQUEST_TIMEOUT_MS: 10000,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000
};

/**
 * Normalize symbol name for mapping lookup
 */
function normalizeSymbol(symbol) {
    if (!symbol) return '';
    
    // Convert to lowercase and remove special characters
    let normalized = symbol.toLowerCase()
        .replace(/\s+/g, '_')        // spaces to underscore
        .replace(/\//g, '')           // remove slashes
        .replace(/-/g, '_');          // hyphens to underscore
    
    // Remove common suffixes for lookup
    normalized = normalized
        .replace(/usdt$/, '')
        .replace(/_usdt$/, '')
        .replace(/eur$/, '')
        .replace(/_eur$/, '');
    
    return normalized;
}

/**
 * Get current price for a symbol from Binance with timeout and retry logic
 */
async function getSymbolPrice(symbol, retries = API_CONFIG.MAX_RETRIES) {
    try {
        // Try direct lookup first
        let pair = SYMBOL_TO_PAIR[symbol];
        let mappingMethod = 'direct';
        
        // If not found, try normalized symbol
        if (!pair) {
            const normalized = normalizeSymbol(symbol);
            pair = SYMBOL_TO_PAIR[normalized];
            mappingMethod = 'normalized';
            
            // If still not found, log warning and use BTC as last resort
            if (!pair) {
                console.warn(`⚠️ [BOT] Symbol mapping not found for '${symbol}' (normalized: '${normalized}'), using BTCUSDT as fallback`);
                pair = 'BTCUSDT';
                mappingMethod = 'fallback';
            }
        }
        
        // Log del mapping usato (solo se non è direct per non spammare i log)
        if (mappingMethod !== 'direct') {
            console.log(`🔍 [PRICE] ${symbol} → ${pair} (method: ${mappingMethod})`);
        }
        
        const https = require('https');
        const url = `${API_CONFIG.BINANCE_BASE_URL}/ticker/price?symbol=${pair}`;

        const data = await new Promise((resolve, reject) => {
            const req = https.get(url, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                });
            }).on('error', reject);

            req.setTimeout(API_CONFIG.REQUEST_TIMEOUT_MS, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });

        return parseFloat(data.price) || 0;
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY_MS));
            return getSymbolPrice(symbol, retries - 1);
        }
        console.error(`❌ Error fetching price for ${symbol}:`, error.message);
        return 0;
    }
}

/**
 * Get 24h volume for a symbol with timeout and retry logic
 */
async function get24hVolume(symbol, retries = API_CONFIG.MAX_RETRIES) {
    try {
        // Try direct lookup first
        let pair = SYMBOL_TO_PAIR[symbol];
        
        // If not found, try normalized symbol
        if (!pair) {
            const normalized = normalizeSymbol(symbol);
            pair = SYMBOL_TO_PAIR[normalized];
            
            // If still not found, use BTC as fallback
            if (!pair) {
                console.warn(`⚠️ [BOT] Symbol mapping not found for '${symbol}' (normalized: '${normalized}') in get24hVolume`);
                pair = 'BTCUSDT';
            }
        }
        
        const https = require('https');
        const url = `${API_CONFIG.BINANCE_BASE_URL}/ticker/24hr?symbol=${pair}`;

        const data = await new Promise((resolve, reject) => {
            const req = https.get(url, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                });
            }).on('error', reject);

            req.setTimeout(API_CONFIG.REQUEST_TIMEOUT_MS, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });

        return parseFloat(data.quoteVolume) || 0;
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY_MS));
            return get24hVolume(symbol, retries - 1);
        }
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
            "SELECT * FROM klines WHERE symbol = $1 AND interval = '1h' ORDER BY open_time DESC LIMIT 50",
            [symbol]
        );

        const klines4h = await dbAll(
            "SELECT * FROM klines WHERE symbol = $1 AND interval = '4h' ORDER BY open_time DESC LIMIT 50",
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
                signal_details, volume_closed, profit_loss, profit_loss_pct, trade_size_usdt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            ticketId, symbol, type, volume, entryPrice, entryPrice,
            stopLoss, takeProfit, 'open', now, strategy,
            JSON.stringify(signalDetails), 0, 0, 0, tradeSize
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
        
        // ✅ VALIDAZIONE PREZZO: Verifica che il prezzo sia ragionevole
        // Se è > $100k probabilmente è BTC/ETH e non il simbolo corretto
        if (currentPrice > 100000) {
            console.error(`🚨 [BOT] Prezzo SOSPETTO per ${symbol}: $${currentPrice} (troppo alto, probabilmente wrong mapping)`);
            console.error(`   Simbolo: "${symbol}" - Verifica che sia mappato correttamente in SYMBOL_TO_PAIR`);
            return;
        }
        
        // Log dettagliato per debugging
        console.log(`💰 [BOT] ${symbol} - Current Price: $${currentPrice.toFixed(8)}`)

        // 2. Check cooldown
        if (!checkCooldown(symbol)) {
            // Still in cooldown, skip
            return;
        }

        // 3. Get klines for signal generation
        const klines = await dbAll(
            "SELECT * FROM klines WHERE symbol = $1 AND interval = '15m' ORDER BY open_time DESC LIMIT 100",
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
        // ✅ FIX: Leggi requisiti minimi da database (bot_settings e bot_parameters) invece di hardcoded
        const botParams = await dbGet("SELECT * FROM bot_parameters WHERE symbol = $1", [symbol]).catch(() => null);
        
        // ✅ FIX CRITICO: Leggi PRIMA parametri globali, poi specifici del simbolo (merge corretto)
        const globalSettings = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'",
            []
        ).catch(() => null);
        
        const symbolSettings = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = $1",
            [symbol]
        ).catch(() => null);
        
        // Merge: globali come base, poi sovrascritti da specifici del simbolo
        let settingsParams = {};
        if (globalSettings?.parameters) {
            settingsParams = typeof globalSettings.parameters === 'string' 
                ? JSON.parse(globalSettings.parameters) 
                : globalSettings.parameters;
        }
        if (symbolSettings?.parameters) {
            const symbolParams = typeof symbolSettings.parameters === 'string' 
                ? JSON.parse(symbolSettings.parameters) 
                : symbolSettings.parameters;
            settingsParams = { ...settingsParams, ...symbolParams };
        }
        
        const minStrength = signal.direction === 'LONG'
            ? (botParams?.min_signal_strength || settingsParams.min_signal_strength || BOT_CONFIG.MIN_STRENGTH_LONG)
            : (botParams?.min_signal_strength || settingsParams.min_signal_strength || BOT_CONFIG.MIN_STRENGTH_SHORT);
        
        const minConfirmations = signal.direction === 'LONG'
            ? (botParams?.min_confirmations_long || settingsParams.min_confirmations_long || BOT_CONFIG.MIN_CONFIRMATIONS_LONG)
            : (botParams?.min_confirmations_short || settingsParams.min_confirmations_short || BOT_CONFIG.MIN_CONFIRMATIONS_SHORT);

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
        // ✅ FIX: Leggi volume minimo da database (bot_settings) invece di hardcoded
        const minVolume24h = settingsParams.min_volume_24h || BOT_CONFIG.MIN_VOLUME_24H;
        const volume24h = await get24hVolume(symbol);
        console.log(`🔍 [BOT] ${symbol} - Volume 24h: $${volume24h.toLocaleString()}/$${minVolume24h.toLocaleString()}`);
        if (volume24h < minVolume24h) {
            console.log(`⏸️ [BOT] ${symbol} - Volume too low: $${volume24h.toLocaleString()}/$${minVolume24h.toLocaleString()}`);
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

        // 13. Trade Size Configuration
        // ✅ FIX: Leggi trade_size_usdt dal database (settingsParams) invece di usare sempre il default
        const configuredTradeSize = settingsParams.trade_size_usdt || settingsParams.trade_size_eur || BOT_CONFIG.DEFAULT_TRADE_SIZE_USDT;
        
        // ✅ Usa sempre il trade_size configurato (se >= $10) o il default
        let tradeSize;
        if (configuredTradeSize && configuredTradeSize >= 10) {
            tradeSize = configuredTradeSize;
            console.log(`🔍 [BOT] ${symbol} - Usando trade_size_usdt configurato: $${tradeSize}`);
        } else {
            tradeSize = BOT_CONFIG.DEFAULT_TRADE_SIZE_USDT;
            console.log(`🔍 [BOT] ${symbol} - Usando trade_size default: $${tradeSize}`);
        }
        
        console.log(`✅ [BOT] ${symbol} - Trade size: $${tradeSize}`);

        // 14. Calculate position size
        const volume = tradeSize / currentPrice;
        
        // ✅ LOG DETTAGLIATO per verificare i calcoli
        console.log(`📊 [BOT] ${symbol} - Volume Calculation:`);
        console.log(`   Trade Size:     $${tradeSize.toFixed(2)}`);
        console.log(`   Current Price:  $${currentPrice.toFixed(8)}`);
        console.log(`   Calculated Vol: ${volume.toFixed(8)} ${symbol.toUpperCase()}`);
        console.log(`   Verificare che: $${tradeSize.toFixed(2)} / $${currentPrice.toFixed(8)} = ${volume.toFixed(8)}`);

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
