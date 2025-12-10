/**
 * 🔍 SCRIPT DI DIAGNOSTICA: Perché il bot non ha aperto una posizione SHORT?
 * 
 * Questo script replica TUTTI i controlli che il bot fa prima di aprire una posizione SHORT
 * e mostra esattamente quale controllo ha bloccato l'apertura.
 */

require('dotenv').config();
const { dbAll, dbGet } = require('./crypto_db');
const signalGenerator = require('./services/BidirectionalSignalGenerator');
const riskManager = require('./services/RiskManager');
const https = require('https');

// Replica funzioni da cryptoRoutes.js
const httpsGet = (url) => {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
};

const getSymbolPrice = async (symbol) => {
    try {
        const tradingPair = SYMBOL_TO_PAIR[symbol];
        if (!tradingPair) {
            console.warn(`⚠️ No trading pair found for ${symbol}`);
            return 0;
        }
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${tradingPair}`;
        const data = await httpsGet(url);
        return parseFloat(data.price) || 0;
    } catch (err) {
        console.error(`❌ Error fetching price for ${symbol}:`, err.message);
        return 0;
    }
};

const get24hVolume = async (symbol) => {
    try {
        const tradingPair = SYMBOL_TO_PAIR[symbol];
        if (!tradingPair) {
            return 0;
        }
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${tradingPair}`;
        const data = await httpsGet(url);
        return parseFloat(data.quoteVolume) || 0;
    } catch (err) {
        console.error(`❌ Error fetching 24h volume for ${symbol}:`, err.message);
        return 0;
    }
};

const detectTrendOnTimeframe = async (symbol, interval, limit = 50) => {
    try {
        const klines = await dbAll(
            `SELECT close_price FROM klines 
             WHERE symbol = $1 AND interval = $2 
             ORDER BY open_time DESC LIMIT $3`,
            [symbol, interval, limit]
        );
        if (!klines || klines.length < 20) {
            return 'neutral';
        }
        const prices = klines.reverse().map(k => parseFloat(k.close_price));
        const ema10 = signalGenerator.calculateEMA(prices, 10);
        const ema20 = signalGenerator.calculateEMA(prices, 20);
        if (!ema10 || !ema20) return 'neutral';
        if (ema10 > ema20 * 1.005) return 'bullish';
        if (ema10 < ema20 * 0.995) return 'bearish';
        return 'neutral';
    } catch (err) {
        return 'neutral';
    }
};

// Replica canOpenPositionHybridStrategy (semplificata)
const CORRELATION_GROUPS = {
    'Layer1': ['bitcoin', 'ethereum', 'cardano', 'solana', 'polkadot', 'avalanche'],
    'DeFi': ['chainlink', 'matic'],
    'Gaming': ['mana', 'sandbox', 'enjin']
};

const HYBRID_STRATEGY_CONFIG = {
    MAX_POSITIONS_PER_GROUP: 3,
    MAX_TOTAL_POSITIONS: 10,
    getMaxPositionsForWinRate: (winRate) => {
        if (winRate >= 0.6) return 12;
        if (winRate >= 0.5) return 10;
        if (winRate >= 0.4) return 8;
        return 5;
    }
};

const getCorrelationGroup = (symbol) => {
    for (const [groupName, symbols] of Object.entries(CORRELATION_GROUPS)) {
        if (symbols.includes(symbol)) {
            return groupName;
        }
    }
    return null;
};

const canOpenPositionHybridStrategy = async (symbol, openPositions, newSignal = null, signalType = null) => {
    const group = getCorrelationGroup(symbol);
    if (!group) {
        return { allowed: true, reason: 'Symbol not in correlation groups' };
    }
    const groupSymbols = CORRELATION_GROUPS[group];
    const groupPositions = openPositions.filter(p =>
        groupSymbols.includes(p.symbol) && p.status === 'open'
    );
    if (groupPositions.length >= HYBRID_STRATEGY_CONFIG.MAX_POSITIONS_PER_GROUP) {
        return {
            allowed: false,
            reason: `Max ${HYBRID_STRATEGY_CONFIG.MAX_POSITIONS_PER_GROUP} positions per group ${group} (current: ${groupPositions.length})`
        };
    }
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
    if (openPositions.length >= maxTotalPositions) {
        return {
            allowed: false,
            reason: `Max ${maxTotalPositions} total positions (current: ${openPositions.length})`
        };
    }
    return { allowed: true, reason: 'OK' };
};

const SYMBOL_TO_PAIR = {
    'bitcoin': 'BTCUSDT',
    'ethereum': 'ETHUSDT',
    'cardano': 'ADAUSDT',
    'solana': 'SOLUSDT',
    'xrp': 'XRPUSDT',
    'polkadot': 'DOTUSDT',
    'dogecoin': 'DOGEUSDT',
    'shiba': 'SHIBUSDT',
    'matic': 'MATICUSDT',
    'avalanche': 'AVAXUSDT',
    'chainlink': 'LINKUSDT',
    'mana': 'MANAUSDT',
    'sandbox': 'SANDUSDT',
    'enjin': 'ENJUSDT',
};

const DEFAULT_PARAMS = {
    rsi_period: 14,
    rsi_oversold: 30,
    rsi_overbought: 70,
    stop_loss_pct: 2.5,
    take_profit_pct: 4.0,
    trade_size_eur: 100,
    trailing_stop_enabled: false,
    trailing_stop_distance_pct: 1.0,
    partial_close_enabled: false,
    take_profit_1_pct: 1.5,
    take_profit_2_pct: 3.0,
    min_atr_pct: 0.2,
    max_atr_pct: 5.0,
    min_volume_24h: 500000,
    max_daily_loss_pct: 5.0,
    max_exposure_pct: 40.0,
    max_positions: 10,
    analysis_timeframe: '15m',
    min_signal_strength: 70,
    min_confirmations_long: 3,
    min_confirmations_short: 4,
    market_scanner_min_strength: 30
};

async function getBotParameters(symbol = 'bitcoin') {
    try {
        let bot = await dbGet("SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = $1", [symbol]);
        if (!bot) {
            bot = await dbGet("SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'", []);
        }
        if (bot && bot.parameters) {
            const params = typeof bot.parameters === 'string' ? JSON.parse(bot.parameters) : bot.parameters;
            return { ...DEFAULT_PARAMS, ...params };
        }
    } catch (err) {
        console.error(`Error loading bot parameters for ${symbol}:`, err.message);
    }
    return DEFAULT_PARAMS;
}

async function diagnoseWhyNoShort(symbol) {
    console.log(`\n🔍 DIAGNOSI: Perché il bot non ha aperto SHORT per ${symbol.toUpperCase()}?`);
    console.log('='.repeat(80));

    const results = {
        symbol,
        checks: [],
        blockedBy: [],
        canOpen: false,
        reasons: []
    };

    try {
        // 1. Carica parametri
        const params = await getBotParameters(symbol);
        const MIN_SIGNAL_STRENGTH = params.min_signal_strength || 70;
        const MIN_CONFIRMATIONS_SHORT = params.min_confirmations_short || 4;
        const MIN_VOLUME = params.min_volume_24h || 500000;
        const timeframe = params.analysis_timeframe || '15m';

        console.log(`\n📊 PARAMETRI:`);
        console.log(`   MIN_SIGNAL_STRENGTH: ${MIN_SIGNAL_STRENGTH}`);
        console.log(`   MIN_CONFIRMATIONS_SHORT: ${MIN_CONFIRMATIONS_SHORT}`);
        console.log(`   MIN_VOLUME_24H: ${MIN_VOLUME.toLocaleString('it-IT')}`);
        console.log(`   TIMEFRAME: ${timeframe}`);

        // 2. Verifica bot attivo
        const botSettings = await dbGet("SELECT is_active FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = $1", [symbol]);
        const isBotActive = botSettings ? (Number(botSettings.is_active) === 1) : true;
        results.checks.push({ name: 'Bot Attivo', passed: isBotActive });
        if (!isBotActive) {
            results.blockedBy.push('Bot disabilitato per questo simbolo');
            results.reasons.push('Il bot non è attivo su questa moneta. Attivalo dalla Dashboard.');
        }

        // 3. Verifica volume
        const volume24h = await get24hVolume(symbol).catch(() => 0);
        const volumeOK = volume24h >= MIN_VOLUME;
        results.checks.push({ name: 'Volume 24h', passed: volumeOK, value: volume24h, required: MIN_VOLUME });
        if (!volumeOK) {
            results.blockedBy.push(`Volume troppo basso: €${volume24h.toLocaleString('it-IT')} < €${MIN_VOLUME.toLocaleString('it-IT')}`);
        }

        // 4. Risk Manager globale
        const riskCheck = await riskManager.calculateMaxRisk();
        results.checks.push({ name: 'Risk Manager Globale', passed: riskCheck.canTrade, reason: riskCheck.reason });
        if (!riskCheck.canTrade) {
            results.blockedBy.push(`Risk Manager globale: ${riskCheck.reason}`);
        }

        // 5. Carica candele e genera segnale
        const klinesData = await dbAll(
            `SELECT open_time, open_price, high_price, low_price, close_price, volume 
             FROM klines 
             WHERE symbol = $1 AND interval = $2 
             ORDER BY open_time DESC 
             LIMIT 100`,
            [symbol, timeframe]
        );

        if (!klinesData || klinesData.length < 20) {
            results.blockedBy.push(`Candele insufficienti: ${klinesData?.length || 0} < 20`);
            console.log(`\n❌ BLOCCATO: Candele insufficienti (${klinesData?.length || 0} < 20)`);
            return results;
        }

        const currentPrice = await getSymbolPrice(symbol);
        const klinesChronological = klinesData.reverse();
        const historyForSignal = klinesChronological.map(row => ({
            timestamp: new Date(row.open_time).toISOString(),
            open: parseFloat(row.open_price) || 0,
            high: parseFloat(row.high_price) || 0,
            low: parseFloat(row.low_price) || 0,
            close: parseFloat(row.close_price) || 0,
            volume: parseFloat(row.volume) || 0
        }));

        const signal = signalGenerator.generateSignal(historyForSignal, symbol, {
            rsi_period: params.rsi_period || 14,
            rsi_oversold: params.rsi_oversold || 30,
            rsi_overbought: params.rsi_overbought || 70,
            min_signal_strength: MIN_SIGNAL_STRENGTH,
            min_confirmations_long: params.min_confirmations_long || 3,
            min_confirmations_short: MIN_CONFIRMATIONS_SHORT
        });

        console.log(`\n📡 SEGNALE:`);
        console.log(`   Direction: ${signal.direction}`);
        console.log(`   Strength: ${signal.strength}/100`);
        console.log(`   Confirmations: ${signal.confirmations || 0}`);
        console.log(`   Short Signal Strength: ${signal.shortSignal?.strength || 0}/100`);
        console.log(`   Reasons: ${signal.reasons.slice(0, 3).join(' | ')}`);

        // 6. Verifica segnale SHORT
        if (signal.direction !== 'SHORT') {
            results.blockedBy.push(`Segnale non SHORT: ${signal.direction}`);
            results.reasons.push(`Il segnale è ${signal.direction}, non SHORT`);
        }

        const signalStrengthOK = signal.strength >= MIN_SIGNAL_STRENGTH;
        results.checks.push({ name: 'Strength Segnale', passed: signalStrengthOK, value: signal.strength, required: MIN_SIGNAL_STRENGTH });
        if (!signalStrengthOK) {
            results.blockedBy.push(`Strength insufficiente: ${signal.strength} < ${MIN_SIGNAL_STRENGTH}`);
        }

        const confirmationsOK = (signal.confirmations || 0) >= MIN_CONFIRMATIONS_SHORT;
        results.checks.push({ name: 'Conferme', passed: confirmationsOK, value: signal.confirmations || 0, required: MIN_CONFIRMATIONS_SHORT });
        if (!confirmationsOK) {
            results.blockedBy.push(`Conferme insufficienti: ${signal.confirmations || 0} < ${MIN_CONFIRMATIONS_SHORT}`);
        }

        // 7. ATR Check
        const atr = calculateATR(historyForSignal.slice(-14));
        const currentPriceForATR = historyForSignal[historyForSignal.length - 1]?.close || currentPrice;
        let atrBlocked = false;
        if (atr && currentPriceForATR > 0) {
            const atrPct = (atr / currentPriceForATR) * 100;
            const MIN_ATR_FOR_STRONG_SIGNAL = params.min_atr_pct || 0.2;
            const MIN_ATR_FOR_NORMAL_SIGNAL = Math.max((params.min_atr_pct || 0.2), 0.3);
            const STRONG_SIGNAL_THRESHOLD = 90;
            const isStrongSignal = signal.strength >= STRONG_SIGNAL_THRESHOLD;
            const minAtrRequired = isStrongSignal ? MIN_ATR_FOR_STRONG_SIGNAL : MIN_ATR_FOR_NORMAL_SIGNAL;
            atrBlocked = atrPct < minAtrRequired || atrPct > (params.max_atr_pct || 5.0);
            results.checks.push({ name: 'ATR', passed: !atrBlocked, value: `${atrPct.toFixed(2)}%`, required: `${minAtrRequired}% - ${params.max_atr_pct || 5.0}%` });
            if (atrBlocked) {
                results.blockedBy.push(`ATR bloccato: ${atrPct.toFixed(2)}% (richiesto: ${minAtrRequired}% - ${params.max_atr_pct || 5.0}%)`);
            }
        }

        // 8. Portfolio Drawdown
        const portfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");
        let portfolioDrawdownBlock = false;
        if (portfolio) {
            const balance = parseFloat(portfolio.balance_usd || 10000);
            const initialBalance = 1000;
            const portfolioPnLPct = balance > 0 ? ((balance - initialBalance) / initialBalance) * 100 : -100;
            
            const allOpenPos = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
            let avgOpenPnL = 0;
            if (allOpenPos.length > 0) {
                const totalOpenPnL = allOpenPos.reduce((sum, p) => sum + (parseFloat(p.profit_loss_pct) || 0), 0);
                avgOpenPnL = totalOpenPnL / allOpenPos.length;
            }

            if (portfolioPnLPct < -5.0) {
                portfolioDrawdownBlock = true;
                results.blockedBy.push(`Portfolio drawdown: ${portfolioPnLPct.toFixed(2)}% < -5%`);
            } else if (avgOpenPnL < -2.0 && allOpenPos.length >= 5) {
                portfolioDrawdownBlock = true;
                results.blockedBy.push(`P&L medio posizioni: ${avgOpenPnL.toFixed(2)}% < -2%`);
            }
        }
        results.checks.push({ name: 'Portfolio Drawdown', passed: !portfolioDrawdownBlock });

        // 9. Market Regime (BTC Trend)
        let marketRegimeBlock = false;
        try {
            const btcPrice = await getSymbolPrice('bitcoin');
            if (btcPrice > 0) {
                const btcHistory = await dbAll("SELECT price FROM price_history WHERE symbol = 'bitcoin' ORDER BY timestamp DESC LIMIT 100");
                if (btcHistory.length >= 50) {
                    const btcPrice24hAgo = parseFloat(btcHistory[49].price);
                    const btcChange24h = ((btcPrice - btcPrice24hAgo) / btcPrice24hAgo) * 100;
                    if (signal.direction === 'SHORT' && btcChange24h > 3.0) {
                        marketRegimeBlock = true;
                        results.blockedBy.push(`BTC in uptrend forte: +${btcChange24h.toFixed(2)}% > +3%`);
                    }
                }
            }
        } catch (e) {
            console.warn('⚠️ Error checking market regime:', e.message);
        }
        results.checks.push({ name: 'Market Regime (BTC)', passed: !marketRegimeBlock });

        // 10. Filtri Professionali
        const shortProfessionalFilters = signal.professionalAnalysis?.filters?.short || [];
        const shortBlockedByFilters = shortProfessionalFilters.some(f => f.includes('🚫 BLOCKED'));
        results.checks.push({ name: 'Filtri Professionali', passed: !shortBlockedByFilters });
        if (shortBlockedByFilters) {
            const blockingFilters = shortProfessionalFilters.filter(f => f.includes('🚫 BLOCKED'));
            blockingFilters.forEach(filter => {
                results.blockedBy.push(`Filtro Professionale: ${filter.replace('🚫 BLOCKED: ', '')}`);
            });
        }

        // 11. Binance Short Support
        const binanceMode = process.env.BINANCE_MODE || 'demo';
        const supportsShort = binanceMode === 'demo' || process.env.BINANCE_SUPPORTS_SHORT === 'true';
        const isDemo = binanceMode === 'demo';
        results.checks.push({ name: 'SHORT Supportato', passed: supportsShort || isDemo });
        if (!isDemo && (binanceMode === 'live' || binanceMode === 'testnet') && !supportsShort) {
            results.blockedBy.push('Binance Spot non supporta SHORT. Configura BINANCE_SUPPORTS_SHORT=true per Futures.');
        }

        // 12. Multi-Timeframe
        if (!atrBlocked && !portfolioDrawdownBlock && !marketRegimeBlock && signal.direction === 'SHORT' && signal.strength >= MIN_SIGNAL_STRENGTH) {
            const trend1h = await detectTrendOnTimeframe(symbol, '1h', 50);
            const trend4h = await detectTrendOnTimeframe(symbol, '4h', 50);

            let mtfBonus = 0;
            if (trend1h === 'bearish' && trend4h === 'bearish') {
                mtfBonus = +10;
            } else if (trend1h === 'bearish' || trend4h === 'bearish') {
                mtfBonus = +5;
            } else if (trend1h === 'bullish' || trend4h === 'bullish') {
                mtfBonus = -15;
            }

            const adjustedStrength = signal.strength + mtfBonus;
            console.log(`\n📊 MULTI-TIMEFRAME:`);
            console.log(`   Trend 1h: ${trend1h}`);
            console.log(`   Trend 4h: ${trend4h}`);
            console.log(`   MTF Bonus: ${mtfBonus >= 0 ? '+' : ''}${mtfBonus}`);
            console.log(`   Strength Originale: ${signal.strength}`);
            console.log(`   Strength Aggiustata: ${adjustedStrength}`);

            const mtfOK = adjustedStrength >= MIN_SIGNAL_STRENGTH;
            results.checks.push({ name: 'Multi-Timeframe', passed: mtfOK, value: adjustedStrength, required: MIN_SIGNAL_STRENGTH });
            if (!mtfOK) {
                results.blockedBy.push(`MTF Strength insufficiente: ${adjustedStrength} < ${MIN_SIGNAL_STRENGTH} (original: ${signal.strength}, MTF: ${mtfBonus})`);
            }

            // 13. Hybrid Strategy
            const allOpenPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
            const hybridCheck = await canOpenPositionHybridStrategy(symbol, allOpenPositions, signal, 'sell');
            results.checks.push({ name: 'Strategia Ibrida', passed: hybridCheck.allowed, reason: hybridCheck.reason });
            if (!hybridCheck.allowed) {
                results.blockedBy.push(`Strategia Ibrida: ${hybridCheck.reason}`);
            }

            // 14. Risk Manager specifico
            const maxAvailableForNewPosition = Math.min(
                riskCheck.maxPositionSize,
                riskCheck.availableExposure
            );
            const canOpenCheck = await riskManager.canOpenPosition(maxAvailableForNewPosition);
            results.checks.push({ name: 'Risk Manager Specifico', passed: canOpenCheck.allowed, reason: canOpenCheck.reason });
            if (!canOpenCheck.allowed) {
                results.blockedBy.push(`Risk Manager: ${canOpenCheck.reason} (disponibile: €${maxAvailableForNewPosition.toFixed(2)})`);
            }

            results.canOpen = signalStrengthOK && confirmationsOK && !atrBlocked && !portfolioDrawdownBlock && 
                             !marketRegimeBlock && !shortBlockedByFilters && supportsShort && mtfOK && 
                             hybridCheck.allowed && canOpenCheck.allowed;
        }

    } catch (error) {
        console.error(`\n❌ ERRORE durante diagnosi:`, error.message);
        results.error = error.message;
        results.blockedBy.push(`Errore: ${error.message}`);
    }

    // Risultato finale
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 RISULTATO FINALE:`);
    console.log(`${'='.repeat(80)}`);
    
    if (results.blockedBy.length === 0) {
        console.log(`✅ TUTTI I CONTROLLI PASSATI - Il bot DOVREBBE aprire la posizione SHORT!`);
        console.log(`   Se non l'ha aperta, verifica i log del backend per dettagli.`);
    } else {
        console.log(`❌ BLOCCATO DA ${results.blockedBy.length} MOTIVO/I:`);
        results.blockedBy.forEach((reason, idx) => {
            console.log(`   ${idx + 1}. ${reason}`);
        });
    }

    console.log(`\n📊 RIEPILOGO CONTROLLI:`);
    results.checks.forEach(check => {
        const icon = check.passed ? '✅' : '❌';
        const value = check.value !== undefined ? ` (${check.value}` + (check.required ? ` / ${check.required})` : ')') : '';
        console.log(`   ${icon} ${check.name}${value}${check.reason ? ` - ${check.reason}` : ''}`);
    });

    return results;
}

function calculateATR(priceHistory) {
    if (!priceHistory || priceHistory.length < 14) return null;
    
    const trueRanges = [];
    for (let i = 1; i < priceHistory.length; i++) {
        const high = priceHistory[i].high;
        const low = priceHistory[i].low;
        const prevClose = priceHistory[i - 1].close;
        
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trueRanges.push(tr);
    }
    
    if (trueRanges.length === 0) return null;
    return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
}

// Esegui diagnostica
const symbol = process.argv[2] || 'bitcoin';
diagnoseWhyNoShort(symbol)
    .then(() => {
        console.log('\n✅ Diagnosi completata.');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Errore:', error);
        process.exit(1);
    });

