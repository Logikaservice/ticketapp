/**
 * Script di debug per capire perché il bot non genera conferme SHORT
 * anche quando vedi candele che scendono nel grafico
 */

const { dbAll, dbGet } = require('./crypto_db');
const BidirectionalSignalGenerator = require('./services/BidirectionalSignalGenerator');

async function debugShortConfirmations(symbol = 'bitcoin') {
    console.log(`\n🔍 DEBUG CONFERME SHORT per ${symbol.toUpperCase()}\n`);

    try {
        // 1. Carica klines recenti
        const klines = await dbAll(
            "SELECT * FROM klines WHERE symbol = $1 AND interval = '15m' ORDER BY open_time DESC LIMIT 100",
            [symbol]
        );

        if (klines.length < 20) {
            console.log(`❌ Candele insufficienti: ${klines.length} < 20`);
            return;
        }

        // Inverti per avere ordine cronologico (più vecchie prima)
        klines.reverse();

        // 2. Prepara dati per signal generator
        const priceHistory = klines.map(k => ({
            price: parseFloat(k.close || k.close_price),
            high: parseFloat(k.high || k.close),
            low: parseFloat(k.low || k.close),
            close: parseFloat(k.close || k.close_price),
            volume: parseFloat(k.volume || 0),
            timestamp: new Date(k.open_time).getTime()
        }));

        // 3. Calcola variazioni prezzo
        const prices = priceHistory.map(h => h.price);
        const currentPrice = prices[prices.length - 1];
        const priceChange = prices.length >= 3
            ? (prices[prices.length - 1] - prices[prices.length - 3]) / prices[prices.length - 3] * 100
            : 0;
        const priceChange5 = prices.length >= 5
            ? (prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5] * 100
            : 0;
        const priceChange10 = prices.length >= 10
            ? (prices[prices.length - 1] - prices[prices.length - 10]) / prices[prices.length - 10] * 100
            : 0;

        console.log('📊 VARIAZIONI PREZZO:');
        console.log(`   Ultimo prezzo: $${currentPrice.toFixed(2)}`);
        console.log(`   Variazione 3 periodi (45min): ${priceChange.toFixed(2)}%`);
        console.log(`   Variazione 5 periodi (75min): ${priceChange5.toFixed(2)}%`);
        console.log(`   Variazione 10 periodi (150min): ${priceChange10.toFixed(2)}%`);
        console.log('');

        // 4. Verifica condizioni per SHORT (NUOVE SOGLIE PIÙ FLESSIBILI)
        const isPriceRising = priceChange > 0.15;
        const isPriceNeutral = (priceChange > -0.2 && priceChange < 0.2) &&
            (priceChange5 > -0.3 && priceChange5 < 0.3) &&
            (priceChange10 > -0.5 && priceChange10 < 0.5);
        const isPriceActivelyFalling = (priceChange < -0.2 && priceChange5 < -0.2) ||
            (priceChange < -0.3) ||
            (priceChange5 < -0.4) ||
            (priceChange10 < -0.5);

        console.log('🔍 CONDIZIONI SHORT:');
        console.log(`   ❌ Prezzo in salita (>0.1%): ${isPriceRising} ${isPriceRising ? '⚠️ BLOCCA SHORT' : ''}`);
        console.log(`   ❌ Mercato neutrale: ${isPriceNeutral} ${isPriceNeutral ? '⚠️ BLOCCA SHORT' : ''}`);
        console.log(`   ✅ Prezzo scende attivamente: ${isPriceActivelyFalling} ${isPriceActivelyFalling ? '✅ OK' : '⚠️ BLOCCA CONFERME'}`);
        console.log('');

        if (isPriceNeutral || isPriceRising) {
            const reason = isPriceNeutral
                ? `Mercato neutrale/laterale (Var: ${priceChange.toFixed(2)}%, Var5: ${priceChange5.toFixed(2)}%, Var10: ${priceChange10.toFixed(2)}%)`
                : `Prezzo ancora in salita (+${priceChange.toFixed(2)}%) - in attesa di inversione`;
            console.log(`🚫 SHORT COMPLETAMENTE BLOCCATO: ${reason}`);
            console.log(`   Il segnale SHORT viene azzerato PRIMA di calcolare le conferme!\n`);
            console.log('💡 SPIEGAZIONE:');
            if (isPriceNeutral) {
                console.log('   Il prezzo non varia abbastanza su TUTTI i timeframe considerati:');
                console.log('   - Su 3 periodi (45min) deve variare >0.3% (attuale: ' + priceChange.toFixed(2) + '%)');
                console.log('   - Su 5 periodi (75min) deve variare >0.5% (attuale: ' + priceChange5.toFixed(2) + '%)');
                console.log('   - Su 10 periodi (150min) deve variare >0.8% (attuale: ' + priceChange10.toFixed(2) + '%)');
            } else {
                console.log('   Il prezzo sta ancora salendo leggermente (variazione >0.1%)');
                console.log('   Il bot attende che il prezzo inizi a scendere prima di considerare SHORT');
            }
            return;
        }

        if (!isPriceActivelyFalling) {
            console.log(`⚠️ PREZZO SCENDE MA NON "ATTIVAMENTE"`);
            console.log(`   Il prezzo sta scendendo, ma non abbastanza velocemente per generare conferme.\n`);
            console.log('📋 SOGLIE RICHIESTE per "Prezzo scende attivamente" (NUOVE - PIÙ FLESSIBILI):');
            console.log('   Deve soddisfare ALMENO UNA di queste condizioni:');
            console.log(`   1. Var 3 periodi < -0.2% E Var 5 periodi < -0.2% (attuale: ${priceChange.toFixed(2)}% e ${priceChange5.toFixed(2)}%)`);
            console.log(`   2. Var 3 periodi < -0.3% (attuale: ${priceChange.toFixed(2)}%)`);
            console.log(`   3. Var 5 periodi < -0.4% (attuale: ${priceChange5.toFixed(2)}%)`);
            console.log(`   4. Var 10 periodi < -0.5% (attuale: ${priceChange10.toFixed(2)}%)\n`);
            console.log('💡 PROBLEMA:');
            console.log('   Anche se vedi candele che scendono nel grafico,');
            console.log('   il bot considera solo gli ULTIMI 3-10 periodi (45-150 minuti).');
            console.log('   Se la discesa è graduale, potrebbe non superare queste soglie.\n');
            console.log('🔧 SOLUZIONE POSSIBILE:');
            console.log('   - Ridurre le soglie per "isPriceActivelyFalling"');
            console.log('   - Oppure permettere alcune conferme anche se prezzo scende meno velocemente');
        }

        // 5. Genera segnale per vedere indicatori
        const signalGenerator = require('./services/BidirectionalSignalGenerator');
        const params = await getBotParameters(symbol);
        const signal = signalGenerator.generateSignal(priceHistory, symbol, params);

        console.log('\n📈 INDICATORI CALCOLATI:');
        console.log(`   Direction: ${signal.direction}`);
        console.log(`   SHORT Strength: ${signal.shortSignal?.strength || 0}/100`);
        console.log(`   SHORT Confirmations: ${signal.shortSignal?.confirmations || 0}/${params.min_confirmations_short || 4}`);
        console.log('');

        if (signal.shortSignal && signal.shortSignal.reasons.length > 0) {
            console.log('📋 MOTIVI SHORT:');
            signal.shortSignal.reasons.forEach((reason, idx) => {
                console.log(`   ${idx + 1}. ${reason}`);
            });
        } else {
            console.log('❌ NESSUNA CONFERMA SHORT generata');
        }

        // 6. Mostra ultime candele per contesto
        console.log('\n📊 ULTIME 10 CANDLE (più recenti in fondo):');
        const last10 = priceHistory.slice(-10);
        last10.forEach((candle, idx) => {
            const idxFull = priceHistory.length - 10 + idx;
            const prevPrice = idx > 0 ? last10[idx - 1].price : (idxFull > 0 ? priceHistory[idxFull - 1].price : candle.price);
            const change = ((candle.price - prevPrice) / prevPrice * 100).toFixed(2);
            const color = change >= 0 ? '📈' : '📉';
            console.log(`   ${idxFull + 1}. $${candle.price.toFixed(2)} (${change >= 0 ? '+' : ''}${change}%) ${color}`);
        });

    } catch (error) {
        console.error('❌ ERRORE:', error.message);
        console.error(error.stack);
    }
}

async function getBotParameters(symbol = 'bitcoin') {
    try {
        let bot = await dbGet("SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = $1", [symbol]);
        if (!bot) {
            bot = await dbGet("SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'", []);
        }
        if (bot && bot.parameters) {
            const params = typeof bot.parameters === 'string' ? JSON.parse(bot.parameters) : bot.parameters;
            return params;
        }
    } catch (err) {
        console.error(`Error loading bot parameters:`, err.message);
    }
    return {
        rsi_period: 14,
        rsi_oversold: 30,
        rsi_overbought: 70,
        min_signal_strength: 70,
        min_confirmations_long: 3,
        min_confirmations_short: 4
    };
}

// Esegui
const symbol = process.argv[2] || 'bitcoin';
debugShortConfirmations(symbol).then(() => {
    process.exit(0);
}).catch(err => {
    console.error('❌ ERRORE FATALE:', err);
    process.exit(1);
});

