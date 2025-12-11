/**
 * 🔍 Script di Debug: Perché il Bot Non Apre Posizioni?
 * 
 * Analizza TUTTI i controlli che possono bloccare l'apertura di una posizione
 * per un simbolo specifico (default: bitcoin)
 */

const { dbAll, dbGet } = require('./crypto_db');
const signalGenerator = require('./services/BidirectionalSignalGenerator');
const riskManager = require('./services/RiskManager');
const { getSymbolPrice, get24hVolume } = require('./routes/cryptoRoutes');

// Importa funzioni helper
const { calculateAlignedCandleTime } = require('./routes/cryptoRoutes');
const CORRELATION_GROUPS = require('./routes/cryptoRoutes').CORRELATION_GROUPS || {};
const HYBRID_STRATEGY_CONFIG = require('./routes/cryptoRoutes').HYBRID_STRATEGY_CONFIG || {};

async function debugWhyNotOpening(symbol = 'bitcoin') {
    console.log(`🔍 DEBUG: Perché il bot non apre posizioni per ${symbol.toUpperCase()}?`);
    console.log('='.repeat(100));
    console.log('');

    try {
        // 1. Verifica bot attivo
        console.log('1️⃣ VERIFICA BOT ATTIVO');
        console.log('-'.repeat(100));
        const botSettings = await dbGet(
            "SELECT * FROM bot_settings WHERE symbol = $1 AND strategy_name = $2",
            [symbol, 'RSI_Strategy']
        );
        
        if (!botSettings) {
            console.log(`❌ Bot non configurato per ${symbol}`);
            return;
        }
        
        if (botSettings.is_active !== 1) {
            console.log(`❌ Bot DISATTIVATO per ${symbol}`);
            console.log(`   💡 Attiva il bot: UPDATE bot_settings SET is_active = 1 WHERE symbol = '${symbol}'`);
            return;
        }
        console.log(`✅ Bot ATTIVO per ${symbol}`);
        console.log('');

        // 2. Verifica klines
        console.log('2️⃣ VERIFICA KLINES');
        console.log('-'.repeat(100));
        const klines = await dbAll(
            "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = '15m'",
            [symbol]
        );
        const klinesCount = parseInt(klines[0]?.count || 0);
        
        if (klinesCount < 50) {
            console.log(`❌ Klines insufficienti: ${klinesCount} < 50`);
            console.log(`   💡 Scarica klines: node download_klines.js ${symbol}`);
            return;
        }
        console.log(`✅ Klines sufficienti: ${klinesCount}`);
        console.log('');

        // 3. Verifica prezzo
        console.log('3️⃣ VERIFICA PREZZO');
        console.log('-'.repeat(100));
        const currentPrice = await getSymbolPrice(symbol);
        if (currentPrice === 0) {
            console.log(`❌ Impossibile recuperare prezzo per ${symbol}`);
            return;
        }
        console.log(`✅ Prezzo corrente: $${currentPrice.toFixed(2)}`);
        console.log('');

        // 4. Verifica volume 24h
        console.log('4️⃣ VERIFICA VOLUME 24H');
        console.log('-'.repeat(100));
        const volume24h = await get24hVolume(symbol);
        const MIN_VOLUME = 500_000;
        
        if (volume24h < MIN_VOLUME) {
            console.log(`❌ Volume insufficiente: $${volume24h.toLocaleString()} < $${MIN_VOLUME.toLocaleString()}`);
            return;
        }
        console.log(`✅ Volume 24h: $${volume24h.toLocaleString()}`);
        console.log('');

        // 5. Genera segnale
        console.log('5️⃣ GENERAZIONE SEGNALE');
        console.log('-'.repeat(100));
        const klinesData = await dbAll(
            `SELECT open_time, open_price, high_price, low_price, close_price, volume 
             FROM klines 
             WHERE symbol = $1 AND interval = '15m' 
             ORDER BY open_time DESC 
             LIMIT 100`,
            [symbol]
        );

        if (klinesData.length < 20) {
            console.log(`❌ Klines insufficienti per generare segnale: ${klinesData.length} < 20`);
            return;
        }

        const historyForSignal = klinesData.reverse().map(k => ({
            close: parseFloat(k.close_price),
            high: parseFloat(k.high_price),
            low: parseFloat(k.low_price),
            volume: parseFloat(k.volume || 0),
            price: parseFloat(k.close_price),
            open: parseFloat(k.open_price),
            timestamp: k.open_time
        }));

        // Recupera parametri bot
        const botParams = await dbGet("SELECT * FROM bot_parameters WHERE symbol = $1", [symbol]) || {};
        const params = {
            rsi_period: botParams.rsi_period || 14,
            rsi_oversold: botParams.rsi_oversold || 30,
            rsi_overbought: botParams.rsi_overbought || 70,
            min_signal_strength: botParams.min_signal_strength || 70,
            min_confirmations_long: botParams.min_confirmations_long || 3,
            min_confirmations_short: botParams.min_confirmations_short || 4
        };

        const signal = signalGenerator.generateSignal(historyForSignal, symbol, params);
        
        if (!signal || signal.direction === 'NEUTRAL') {
            console.log(`❌ Nessun segnale generato o segnale NEUTRAL`);
            return;
        }

        console.log(`✅ Segnale generato: ${signal.direction}`);
        console.log(`   Strength: ${signal.strength}/100`);
        console.log(`   Confirmations: ${signal.confirmations || 0}`);
        console.log('');

        // 6. Verifica MTF (Multi-Timeframe)
        console.log('6️⃣ VERIFICA MULTI-TIMEFRAME');
        console.log('-'.repeat(100));
        // Calcola trend 1h e 4h (semplificato)
        const recentPrices = historyForSignal.slice(-20).map(h => h.close);
        const price1hAgo = recentPrices[recentPrices.length - 4] || recentPrices[0];
        const price4hAgo = recentPrices[recentPrices.length - 16] || recentPrices[0];
        const currentPriceForMTF = recentPrices[recentPrices.length - 1];
        
        const change1h = ((currentPriceForMTF - price1hAgo) / price1hAgo) * 100;
        const change4h = ((currentPriceForMTF - price4hAgo) / price4hAgo) * 100;
        
        const trend1h = change1h > 0.5 ? 'Bullish' : change1h < -0.5 ? 'Bearish' : 'Neutral';
        const trend4h = change4h > 1 ? 'Bullish' : change4h < -1 ? 'Bearish' : 'Neutral';
        
        console.log(`   Trend 1h: ${trend1h} (${change1h.toFixed(2)}%)`);
        console.log(`   Trend 4h: ${trend4h} (${change4h.toFixed(2)}%)`);
        
        // Calcola MTF bonus
        let mtfBonus = 0;
        if (signal.direction === 'LONG') {
            if (trend1h === 'Bullish' && trend4h === 'Bullish') mtfBonus = 10;
            else if (trend1h === 'Bullish' || trend4h === 'Bullish') mtfBonus = 5;
        } else if (signal.direction === 'SHORT') {
            if (trend1h === 'Bearish' && trend4h === 'Bearish') mtfBonus = 10;
            else if (trend1h === 'Bearish' || trend4h === 'Bearish') mtfBonus = 5;
        }
        
        const adjustedStrength = signal.strength + mtfBonus;
        console.log(`   MTF Bonus: +${mtfBonus}`);
        console.log(`   Adjusted Strength: ${adjustedStrength}/100`);
        console.log('');

        // 7. Verifica requisiti minimi
        console.log('7️⃣ VERIFICA REQUISITI MINIMI');
        console.log('-'.repeat(100));
        const MIN_STRENGTH = params.min_signal_strength || 70;
        const MIN_CONFIRMATIONS = signal.direction === 'LONG' 
            ? params.min_confirmations_long || 3
            : params.min_confirmations_short || 4;
        
        console.log(`   Strength richiesta: ${MIN_STRENGTH}`);
        console.log(`   Strength attuale: ${adjustedStrength}`);
        console.log(`   Conferme richieste: ${MIN_CONFIRMATIONS}`);
        console.log(`   Conferme attuali: ${signal.confirmations || 0}`);
        
        if (adjustedStrength < MIN_STRENGTH) {
            console.log(`❌ Strength insufficiente: ${adjustedStrength} < ${MIN_STRENGTH}`);
            console.log(`   Mancano ${MIN_STRENGTH - adjustedStrength} punti`);
            return;
        }
        
        if ((signal.confirmations || 0) < MIN_CONFIRMATIONS) {
            console.log(`❌ Conferme insufficienti: ${signal.confirmations || 0} < ${MIN_CONFIRMATIONS}`);
            console.log(`   Mancano ${MIN_CONFIRMATIONS - (signal.confirmations || 0)} conferme`);
            return;
        }
        
        console.log(`✅ Requisiti minimi soddisfatti`);
        console.log('');

        // 8. Verifica Professional Filters
        console.log('8️⃣ VERIFICA PROFESSIONAL FILTERS');
        console.log('-'.repeat(100));
        const professionalFilters = signal.professionalAnalysis?.filters?.[signal.direction.toLowerCase()] || [];
        const blockedByFilters = professionalFilters.some(f => f.includes('🚫 BLOCKED'));
        
        if (blockedByFilters) {
            const blockingFilters = professionalFilters.filter(f => f.includes('🚫 BLOCKED'));
            console.log(`❌ Bloccato da Professional Filters:`);
            blockingFilters.forEach(filter => {
                console.log(`   🚫 ${filter.replace('🚫 BLOCKED: ', '')}`);
            });
            return;
        }
        console.log(`✅ Professional Filters: OK`);
        console.log('');

        // 9. Verifica Hybrid Strategy
        console.log('9️⃣ VERIFICA HYBRID STRATEGY');
        console.log('-'.repeat(100));
        const allOpenPositions = await dbAll(
            "SELECT * FROM open_positions WHERE status = 'open'"
        );
        
        console.log(`   Posizioni aperte totali: ${allOpenPositions.length}`);
        
        // Verifica gruppo correlazione
        let group = null;
        for (const [groupName, symbols] of Object.entries(CORRELATION_GROUPS)) {
            if (symbols.includes(symbol)) {
                group = groupName;
                break;
            }
        }
        
        if (group) {
            console.log(`   Gruppo correlazione: ${group}`);
            const groupSymbols = CORRELATION_GROUPS[group];
            const groupPositions = allOpenPositions.filter(p =>
                groupSymbols.includes(p.symbol) && p.status === 'open'
            );
            console.log(`   Posizioni nel gruppo: ${groupPositions.length}`);
            
            const MAX_PER_GROUP = HYBRID_STRATEGY_CONFIG.MAX_POSITIONS_PER_GROUP || 10;
            if (groupPositions.length >= MAX_PER_GROUP) {
                console.log(`❌ Limite gruppo raggiunto: ${groupPositions.length} >= ${MAX_PER_GROUP}`);
                return;
            }
        } else {
            console.log(`   Simbolo non in nessun gruppo di correlazione`);
        }
        
        const MAX_TOTAL = HYBRID_STRATEGY_CONFIG.MAX_TOTAL_POSITIONS || 30;
        if (allOpenPositions.length >= MAX_TOTAL) {
            console.log(`❌ Limite totale posizioni raggiunto: ${allOpenPositions.length} >= ${MAX_TOTAL}`);
            return;
        }
        
        console.log(`✅ Hybrid Strategy: OK`);
        console.log('');

        // 10. Verifica Risk Manager
        console.log('🔟 VERIFICA RISK MANAGER');
        console.log('-'.repeat(100));
        const tradeSize = 100; // Default
        const riskCheck = await riskManager.canOpenPosition(tradeSize);
        
        if (!riskCheck.allowed) {
            console.log(`❌ Risk Manager blocca: ${riskCheck.reason}`);
            console.log(`   Exposure: ${riskCheck.currentExposure || 0}%`);
            console.log(`   Daily Loss: ${riskCheck.dailyLoss || 0}%`);
            return;
        }
        console.log(`✅ Risk Manager: OK`);
        console.log(`   Available Exposure: $${riskCheck.availableExposure || 0}`);
        console.log('');

        // 11. Verifica ATR
        console.log('1️⃣1️⃣ VERIFICA ATR (Volatilità)');
        console.log('-'.repeat(100));
        const highs = historyForSignal.map(k => k.high);
        const lows = historyForSignal.map(k => k.low);
        const closes = historyForSignal.map(k => k.close);
        const atr = signalGenerator.calculateATR(highs, lows, closes, 14);
        
        if (atr) {
            const atrPct = (atr / currentPrice) * 100;
            const MIN_ATR = params.min_atr_pct || 0.2;
            const MAX_ATR = params.max_atr_pct || 5.0;
            
            console.log(`   ATR: ${atrPct.toFixed(2)}%`);
            console.log(`   Range accettabile: ${MIN_ATR}% - ${MAX_ATR}%`);
            
            if (atrPct < MIN_ATR) {
                console.log(`❌ ATR troppo basso: ${atrPct.toFixed(2)}% < ${MIN_ATR}% (mercato troppo piatto)`);
                return;
            }
            if (atrPct > MAX_ATR) {
                console.log(`❌ ATR troppo alto: ${atrPct.toFixed(2)}% > ${MAX_ATR}% (possibile evento news)`);
                return;
            }
        }
        console.log(`✅ ATR: OK`);
        console.log('');

        // Se arriviamo qui, tutto è OK ma non apre comunque
        console.log('='.repeat(100));
        console.log('✅ TUTTI I CONTROLLI SUPERATI!');
        console.log('='.repeat(100));
        console.log('');
        console.log('🤔 Il bot dovrebbe aprire la posizione ma non lo fa.');
        console.log('💡 Possibili cause:');
        console.log('   1. Cooldown attivo (attendi qualche minuto)');
        console.log('   2. Errore durante apertura posizione (controlla logs backend)');
        console.log('   3. Portfolio drawdown protection attiva');
        console.log('   4. Market regime detection blocca (BTC trend)');
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante debug:', error.message);
        console.error(error.stack);
    }
}

// Esegui debug
const symbol = process.argv[2] || 'bitcoin';
debugWhyNotOpening(symbol).catch(console.error);

