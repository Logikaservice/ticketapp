/**
 * 🔍 Diagnosi Segnale LINK/USDT
 * Verifica perché Strength e Confirmations sono 0
 */

const { dbAll, dbGet } = require('./crypto_db');
const signalGenerator = require('./services/BidirectionalSignalGenerator');

async function diagnoseLink() {
    try {
        // Prova entrambe le varianti del simbolo (lowercase per PostgreSQL)
        let symbol = 'chainlink_usdt';
        let klinesCount = await dbGet(
            "SELECT COUNT(*) as count FROM klines WHERE LOWER(symbol) = LOWER($1) AND interval = $2",
            [symbol, '15m']
        );
        
        if (klinesCount.count === 0) {
            symbol = 'chainlink';
            klinesCount = await dbGet(
                "SELECT COUNT(*) as count FROM klines WHERE LOWER(symbol) = LOWER($1) AND interval = $2",
                [symbol, '15m']
            );
        }
        
        console.log(`\n🔍 DIAGNOSI SEGNALE ${symbol.toUpperCase()}`);
        console.log('='.repeat(70));
        
        console.log(`\n📊 Klines disponibili (15m): ${klinesCount.count}`);
        if (klinesCount.count < 50) {
            console.log(`   ⚠️ INSUFFICIENTI! Servono almeno 50 klines per calcolare indicatori`);
            console.log(`   ℹ️ Il bot probabilmente non ha ancora scaricato abbastanza dati`);
            return;
        }
        
        // 2. Recupera ultime 100 klines
        const klinesData = await dbAll(
            `SELECT * FROM klines 
             WHERE symbol = $1 AND interval = $2 
             ORDER BY open_time DESC 
             LIMIT 100`,
            [symbol, '15m']
        );
        
        console.log(`   ✅ Recuperate ${klinesData.length} klines`);
        
        // 3. Formatta per signalGenerator
        const klinesChronological = klinesData.reverse();
        const historyForSignal = klinesChronological.map(kline => ({
            close: parseFloat(kline.close_price),
            high: parseFloat(kline.high_price),
            low: parseFloat(kline.low_price),
            volume: parseFloat(kline.volume || 0),
            price: parseFloat(kline.close_price),
            open: parseFloat(kline.open_price),
            timestamp: kline.open_time
        }));
        
        // 4. Mostra ultimi 5 prezzi
        console.log(`\n📈 Ultimi 5 prezzi:`);
        historyForSignal.slice(-5).forEach((k, idx) => {
            const change = idx > 0 ? ((k.close - historyForSignal[historyForSignal.length - 5 + idx - 1].close) / historyForSignal[historyForSignal.length - 5 + idx - 1].close * 100) : 0;
            console.log(`   ${idx + 1}. $${k.close.toFixed(4)} (${change > 0 ? '+' : ''}${change.toFixed(2)}%)`);
        });
        
        // 5. Genera segnale
        const params = await dbGet(
            "SELECT * FROM bot_parameters WHERE symbol = $1",
            [symbol]
        ).catch(() => null);
        
        const botParams = {
            rsi_period: params?.rsi_period || 14,
            rsi_oversold: params?.rsi_oversold || 30,
            rsi_overbought: params?.rsi_overbought || 70,
            min_signal_strength: params?.min_signal_strength || 65,
            min_confirmations_long: params?.min_confirmations_long || 3,
            min_confirmations_short: params?.min_confirmations_short || 4
        };
        
        console.log(`\n🔧 Parametri Bot:`);
        console.log(`   Min Strength: ${botParams.min_signal_strength}`);
        console.log(`   Min Confirmations LONG: ${botParams.min_confirmations_long}`);
        console.log(`   Min Confirmations SHORT: ${botParams.min_confirmations_short}`);
        
        console.log(`\n🔮 Generazione segnale...`);
        const signal = signalGenerator.generateSignal(historyForSignal, symbol, botParams);
        
        // 6. Mostra risultato segnale
        console.log(`\n📡 SEGNALE RISULTANTE:`);
        console.log(`   Direction: ${signal.direction}`);
        console.log(`   Strength: ${signal.strength}/100`);
        console.log(`   Confirmations: ${signal.confirmations || 0}`);
        
        // 7. Mostra segnali LONG e SHORT separati
        if (signal.longSignal) {
            console.log(`\n📈 LONG Signal Details:`);
            console.log(`   Strength: ${signal.longSignal.strength}/100`);
            console.log(`   Confirmations: ${signal.longSignal.confirmations}/${botParams.min_confirmations_long}`);
            if (signal.longSignal.reasons.length > 0) {
                console.log(`   Motivi:`);
                signal.longSignal.reasons.forEach(r => console.log(`     - ${r}`));
            } else {
                console.log(`   ⚠️ Nessun motivo LONG rilevato`);
            }
            
            if (signal.longSignal.strengthContributions && signal.longSignal.strengthContributions.length > 0) {
                console.log(`   Contributi Strength:`);
                signal.longSignal.strengthContributions.forEach(c => {
                    console.log(`     - ${c.indicator}: +${c.points} (${c.reason})`);
                });
            }
        }
        
        if (signal.shortSignal) {
            console.log(`\n📉 SHORT Signal Details:`);
            console.log(`   Strength: ${signal.shortSignal.strength}/100`);
            console.log(`   Confirmations: ${signal.shortSignal.confirmations}/${botParams.min_confirmations_short}`);
            if (signal.shortSignal.reasons.length > 0) {
                console.log(`   Motivi:`);
                signal.shortSignal.reasons.forEach(r => console.log(`     - ${r}`));
            } else {
                console.log(`   ⚠️ Nessun motivo SHORT rilevato`);
            }
            
            if (signal.shortSignal.strengthContributions && signal.shortSignal.strengthContributions.length > 0) {
                console.log(`   Contributi Strength:`);
                signal.shortSignal.strengthContributions.forEach(c => {
                    console.log(`     - ${c.indicator}: +${c.points} (${c.reason})`);
                });
            }
        }
        
        // 8. Mostra indicatori calcolati
        if (signal.indicators) {
            console.log(`\n🔧 INDICATORI CALCOLATI:`);
            console.log(`   RSI: ${signal.indicators.rsi?.toFixed(2) || 'N/A'}`);
            console.log(`   Trend: ${signal.indicators.trend || 'N/A'}`);
            console.log(`   Major Trend: ${signal.indicators.majorTrend || 'N/A'}`);
            
            if (signal.indicators.macd) {
                const macd = signal.indicators.macd;
                console.log(`   MACD:`);
                console.log(`     Line: ${macd.macdLine?.toFixed(4) || 'N/A'}`);
                console.log(`     Signal: ${macd.signalLine?.toFixed(4) || 'N/A'}`);
                console.log(`     Histogram: ${macd.histogram?.toFixed(4) || 'N/A'}`);
                console.log(`     Above Signal: ${macd.macdAboveSignal ? '✅' : '❌'}`);
                console.log(`     Above Zero: ${macd.macdAboveZero ? '✅' : '❌'}`);
                console.log(`     Histogram Growing: ${macd.histogramGrowing ? '✅' : '❌'}`);
            }
            
            if (signal.indicators.ema10 && signal.indicators.ema20) {
                console.log(`   EMA 10: $${signal.indicators.ema10.toFixed(4)}`);
                console.log(`   EMA 20: $${signal.indicators.ema20.toFixed(4)}`);
                console.log(`   EMA 50: $${signal.indicators.ema50?.toFixed(4) || 'N/A'}`);
            }
            
            if (signal.indicators.volume) {
                console.log(`   Volume High: ${signal.indicators.volume.isHigh ? '✅' : '❌'}`);
                console.log(`   Volume Ratio: ${signal.indicators.volume.ratio?.toFixed(2) || 'N/A'}`);
            }
        }
        
        // 9. Diagnosi problema
        console.log(`\n\n🔍 DIAGNOSI:`);
        if (signal.strength === 0 && signal.confirmations === 0) {
            console.log(`\n❌ PROBLEMA: Nessun indicatore sta dando segnale`);
            console.log(`\nPossibili cause:`);
            console.log(`   1. Prezzo in consolidamento (nessun trend chiaro)`);
            console.log(`   2. Indicatori non allineati (RSI neutrale, MACD in zona morta)`);
            console.log(`   3. Volume insufficiente`);
            console.log(`   4. Movimento troppo piccolo per generare conferme`);
            console.log(`\n💡 SOLUZIONE:`);
            console.log(`   - Questo è NORMALE in mercati laterali/neutri`);
            console.log(`   - Il bot aspetta un segnale CHIARO prima di aprire`);
            console.log(`   - Se vuoi più segnali, abbassa min_signal_strength da 65 a 50-55`);
        } else {
            console.log(`\n✅ Il segnale è in formazione ma non abbastanza forte ancora`);
        }
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
    }
}

// Esegui diagnosi
diagnoseLink().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
