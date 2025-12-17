/**
 * Script per scaricare klines storiche per SAND/USDT
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cryptoDb = require('./crypto_db');
const dbRun = cryptoDb.dbRun;
const https = require('https');

const httpsGet = (url) => {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
};

async function downloadSandKlines() {
    try {
        console.log('📥 Scaricamento klines per SAND/USDT...\n');

        const symbol = 'SANDUSDT';
        const dbSymbol = 'sand';
        const interval = '15m';
        const days = 30; // Ultimi 30 giorni
        const limit = 1000;
        const endTime = Date.now();
        const startTime = endTime - (days * 24 * 60 * 60 * 1000);

        let allKlines = [];
        let currentStartTime = startTime;

        console.log(`📊 Parametri:`);
        console.log(`   Simbolo Binance: ${symbol}`);
        console.log(`   Simbolo DB: ${dbSymbol}`);
        console.log(`   Intervallo: ${interval}`);
        console.log(`   Periodo: ${days} giorni\n`);

        // Scarica a blocchi
        while (currentStartTime < endTime) {
            const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStartTime}&limit=${limit}`;

            try {
                console.log(`📡 Scaricamento blocco da ${new Date(currentStartTime).toISOString()}...`);
                const klines = await httpsGet(url);

                if (!klines || klines.length === 0) {
                    console.log('   Nessun dato disponibile, fine scaricamento');
                    break;
                }

                allKlines.push(...klines);
                currentStartTime = klines[klines.length - 1][0] + 1;
                console.log(`   ✅ ${klines.length} candele scaricate (totale: ${allKlines.length})`);

                // Pausa per non sovraccaricare API
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`   ❌ Errore: ${error.message}`);
                break;
            }
        }

        console.log(`\n✅ Totale candele scaricate: ${allKlines.length}`);
        console.log(`💾 Inserimento nel database...\n`);

        // Inserisci nel database
        let inserted = 0;
        let skipped = 0;
        for (const k of allKlines) {
            try {
                await dbRun(
                    `INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     ON CONFLICT (symbol, interval, open_time) DO NOTHING`,
                    [dbSymbol, interval, k[0], k[1], k[2], k[3], k[4], k[5], k[6]]
                );
                inserted++;
            } catch (error) {
                skipped++;
                // Ignora duplicati
            }
        }

        console.log(`✅ ${inserted} candele inserite`);
        if (skipped > 0) {
            console.log(`⚠️ ${skipped} candele già presenti (saltate)`);
        }

        console.log(`\n🎉 Klines per SAND scaricate con successo!`);
        console.log(`   Ora la posizione SAND dovrebbe essere visibile nel dashboard.`);

    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
    }
}

downloadSandKlines().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

