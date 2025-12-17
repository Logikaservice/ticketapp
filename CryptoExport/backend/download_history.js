/**
 * Script per scaricare dati storici da Binance
 */

const https = require('https');
const { dbRun } = require('./crypto_db');

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
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
}

async function downloadHistoricalData(symbol = 'BTCUSDT', dbSymbol = 'bitcoin', days = 60) {
    console.log(`📥 Scaricamento dati storici per ${symbol} (ultimi ${days} giorni)...`);

    const interval = '15m';
    const limit = 1000; // Max per richiesta Binance
    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);

    let allKlines = [];
    let currentStartTime = startTime;

    // Scarica a blocchi (Binance limita a 1000 candele per richiesta)
    while (currentStartTime < endTime) {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStartTime}&limit=${limit}`;

        try {
            const klines = await httpsGet(url);

            if (!klines || klines.length === 0) break;

            console.log(`   Scaricate ${klines.length} candele da ${new Date(klines[0][0]).toISOString()}`);

            allKlines.push(...klines);

            // Prossimo blocco
            currentStartTime = klines[klines.length - 1][0] + 1;

            // Pausa per non sovraccaricare API
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`❌ Errore scaricamento: ${error.message}`);
            break;
        }
    }

    console.log(`\n✅ Totale candele scaricate: ${allKlines.length}`);
    console.log(`💾 Inserimento nel database...`);

    // Inserisci nel database
    let inserted = 0;
    for (const k of allKlines) {
        try {
            await dbRun(
                `INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (symbol, interval, open_time) DO NOTHING`,
                [
                    dbSymbol,
                    interval,
                    k[0],  // open_time
                    k[1],  // open
                    k[2],  // high
                    k[3],  // low
                    k[4],  // close
                    k[5],  // volume
                    k[6]   // close_time
                ]
            );
            inserted++;
        } catch (error) {
            // Ignora duplicati
        }
    }

    console.log(`✅ Inserite ${inserted} candele nel database`);
    return inserted;
}

async function main() {
    try {
        await downloadHistoricalData('BTCUSDT', 'bitcoin', 60);
        console.log('\n🎉 Download completato!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    }
}

main();
