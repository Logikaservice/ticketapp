const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./crypto.db');

// Funzione calculateRSI (copia dal codice)
function calculateRSI(prices, period = 14) {
    if (!prices || prices.length < period + 1) {
        return null;
    }

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain/loss
    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Calculate RSI for subsequent periods
    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) {
            avgGain = (avgGain * (period - 1) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
        }
    }

    if (avgLoss === 0) {
        return 100;
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
}

console.log('🔍 Test calcolo RSI Deep per BTC...\n');

// Prendi dati BTC
db.all(`
    SELECT close_price, open_time
    FROM klines 
    WHERE symbol = 'bitcoin' 
    AND interval = '15m' 
    ORDER BY open_time DESC 
    LIMIT 100
`, (err, klines) => {
    if (err) {
        console.error('❌ Errore:', err);
        db.close();
        return;
    }

    if (klines.length === 0) {
        console.log('❌ Nessun dato trovato per bitcoin');
        db.close();
        return;
    }

    console.log(`✅ Trovate ${klines.length} candele per bitcoin`);

    const prices = klines.reverse().map(k => parseFloat(k.close_price));
    console.log(`   Primi 5 prezzi: ${prices.slice(0, 5).map(p => p.toFixed(2)).join(', ')}`);
    console.log(`   Ultimi 5 prezzi: ${prices.slice(-5).map(p => p.toFixed(2)).join(', ')}`);

    const rsi = calculateRSI(prices, 14);

    console.log(`\n📊 RSI Calcolato: ${rsi !== null ? rsi.toFixed(2) : 'NULL'}`);

    if (rsi === null) {
        console.log('❌ RSI è NULL - Dati insufficienti?');
        console.log(`   Lunghezza prices: ${prices.length}`);
        console.log(`   Periodo richiesto: 15 (14 + 1)`);
    } else {
        console.log('✅ RSI calcolato correttamente!');

        // Verifica range
        if (rsi < 0 || rsi > 100) {
            console.log(`⚠️ RSI fuori range: ${rsi.toFixed(2)}`);
        } else if (rsi < 30) {
            console.log(`   → Oversold (< 30)`);
        } else if (rsi > 70) {
            console.log(`   → Overbought (> 70)`);
        } else {
            console.log(`   → Neutro (30-70)`);
        }
    }

    db.close();
});
