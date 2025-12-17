/**
 * Script di normalizzazione: Converti tutte le klines e price_history da EUR a USDT
 * 
 * Questo script:
 * 1. Converte tutti i prezzi nelle tabelle klines (open_price, high_price, low_price, close_price)
 * 2. Converte tutti i prezzi nella tabella price_history
 * 
 * IMPORTANTE: Esegui questo script DOPO migrate-eur-to-usdt.js
 * 
 * Tasso di conversione: 1 EUR = 1.08 USDT (o 1 USDT = 0.92 EUR)
 */

const db = require('../crypto_db');
const https = require('https');

// Tasso di conversione EUR → USDT
const EUR_TO_USDT_RATE = 1.08;

// Helper per ottenere tasso di cambio reale da Binance
const getUSDTtoEURRate = async () => {
    try {
        const eurUsdData = await new Promise((resolve, reject) => {
            const req = https.get('https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT', (res) => {
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
                reject(new Error('Timeout'));
            });
        });

        if (eurUsdData && eurUsdData.price) {
            const rate = 1 / parseFloat(eurUsdData.price); // 1 USDT = X EUR
            return 1 / rate; // 1 EUR = X USDT
        }
    } catch (e) {
        console.warn('⚠️ Impossibile ottenere tasso da Binance, uso fallback:', e.message);
    }
    return EUR_TO_USDT_RATE; // Fallback
};

// Helper per eseguire query SQL
const dbRun = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

async function normalize() {
    try {
        console.log('🔄 [NORMALIZZAZIONE] Inizio normalizzazione klines e price_history da EUR a USDT...\n');

        // 1. Ottieni tasso di conversione reale
        console.log('📊 [NORMALIZZAZIONE] Recupero tasso di conversione EUR/USDT...');
        const conversionRate = await getUSDTtoEURRate();
        console.log(`✅ [NORMALIZZAZIONE] Tasso di conversione: 1 EUR = ${conversionRate.toFixed(4)} USDT\n`);

        // 2. Normalizza klines
        console.log('📈 [NORMALIZZAZIONE] Normalizzazione klines...');
        const klines = await dbAll("SELECT DISTINCT symbol FROM klines");
        let klineCount = 0;
        
        for (const row of klines) {
            const symbol = row.symbol;
            const symbolKlines = await dbAll("SELECT * FROM klines WHERE symbol = ?", [symbol]);
            
            for (const kline of symbolKlines) {
                await dbRun(
                    `UPDATE klines SET 
                        open_price = ?,
                        high_price = ?,
                        low_price = ?,
                        close_price = ?
                    WHERE id = ?`,
                    [
                        parseFloat(kline.open_price) * conversionRate,
                        parseFloat(kline.high_price) * conversionRate,
                        parseFloat(kline.low_price) * conversionRate,
                        parseFloat(kline.close_price) * conversionRate,
                        kline.id
                    ]
                );
                klineCount++;
            }
            console.log(`   ✅ ${symbol}: ${symbolKlines.length} klines normalizzate`);
        }
        console.log(`\n   📊 Totale klines normalizzate: ${klineCount}`);

        // 3. Normalizza price_history
        console.log('\n📉 [NORMALIZZAZIONE] Normalizzazione price_history...');
        const priceHistory = await dbAll("SELECT DISTINCT symbol FROM price_history");
        let priceHistoryCount = 0;
        
        for (const row of priceHistory) {
            const symbol = row.symbol;
            const symbolPrices = await dbAll("SELECT * FROM price_history WHERE symbol = ?", [symbol]);
            
            for (const price of symbolPrices) {
                await dbRun(
                    `UPDATE price_history SET 
                        price = ?
                    WHERE id = ?`,
                    [
                        parseFloat(price.price) * conversionRate,
                        price.id
                    ]
                );
                priceHistoryCount++;
            }
            console.log(`   ✅ ${symbol}: ${symbolPrices.length} prezzi normalizzati`);
        }
        console.log(`\n   📊 Totale price_history normalizzati: ${priceHistoryCount}`);

        // 4. Riepilogo
        console.log('\n✅ [NORMALIZZAZIONE] Normalizzazione completata con successo!');
        console.log(`\n📊 Riepilogo:`);
        console.log(`   - Tasso di conversione: 1 EUR = ${conversionRate.toFixed(4)} USDT`);
        console.log(`   - Klines normalizzate: ${klineCount}`);
        console.log(`   - Price_history normalizzati: ${priceHistoryCount}`);
        console.log('\n🎉 Tutti i dati storici sono stati normalizzati a USDT!');

        // Chiudi connessione database
        db.close((err) => {
            if (err) {
                console.error('❌ Errore chiusura database:', err.message);
            } else {
                console.log('\n✅ Database chiuso correttamente');
            }
            process.exit(0);
        });

    } catch (error) {
        console.error('\n❌ [NORMALIZZAZIONE] Errore durante la normalizzazione:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Esegui normalizzazione
normalize();
