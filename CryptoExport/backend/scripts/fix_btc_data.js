/**
 * 🔧 Script per risolvere il problema dei dati mancanti per BTC
 * Forza il download di 30 giorni di dati storici da Binance
 */

const { dbRun, dbGet, dbAll } = require('../crypto_db');
const https = require('https');

const SYMBOL = 'bitcoin_usdt';
const TRADING_PAIR = 'BTCUSDT';
const KLINE_INTERVAL = '15m';
const LOOKBACK_DAYS = 30;

function httpsGet(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            if (res.statusCode !== 200) {
                let errorData = '';
                res.on('data', (chunk) => errorData += chunk);
                res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${errorData.substring(0, 200)}`)));
                return;
            }
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
        req.on('error', (err) => reject(err));
        req.setTimeout(timeout, () => { req.destroy(); reject(new Error(`Request timeout after ${timeout}ms`)); });
        req.end();
    });
}

async function fixBTCData() {
    console.log('🔧 FIX DATI BTC\n');
    console.log('=' .repeat(80));
    
    try {
        // 1. Verifica stato attuale
        console.log('\n📊 Stato attuale:');
        const klinesCount = await dbGet(
            `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2`,
            [SYMBOL, KLINE_INTERVAL]
        );
        const priceCount = await dbGet(
            `SELECT COUNT(*) as count FROM price_history WHERE symbol = $1`,
            [SYMBOL]
        );
        
        console.log(`   Klines (15m): ${klinesCount?.count || 0}`);
        console.log(`   Price history: ${priceCount?.count || 0}`);
        
        // 2. Download da Binance
        console.log(`\n📥 Download da Binance:`);
        console.log(`   Simbolo: ${TRADING_PAIR}`);
        console.log(`   Intervallo: ${KLINE_INTERVAL}`);
        console.log(`   Periodo: ultimi ${LOOKBACK_DAYS} giorni`);
        
        const endTime = Date.now();
        const startTime = endTime - (LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
        
        console.log(`   Da: ${new Date(startTime).toISOString()}`);
        console.log(`   A: ${new Date(endTime).toISOString()}`);
        
        let allKlines = [];
        let currentStartTime = startTime;
        const limit = 1000;
        let batchNum = 0;
        
        while (currentStartTime < endTime && allKlines.length < limit * 30) {
            batchNum++;
            const url = `https://api.binance.com/api/v3/klines?symbol=${TRADING_PAIR}&interval=${KLINE_INTERVAL}&startTime=${currentStartTime}&limit=${limit}`;
            
            try {
                console.log(`   Batch ${batchNum}: Scaricamento...`);
                const klines = await httpsGet(url, 20000);
                
                if (!Array.isArray(klines) || klines.length === 0) {
                    console.log(`   ✅ Nessun altro dato disponibile`);
                    break;
                }
                
                // Filtra e valida klines
                const validKlines = klines.filter(k => {
                    const open = parseFloat(k[1]);
                    const high = parseFloat(k[2]);
                    const low = parseFloat(k[3]);
                    const close = parseFloat(k[4]);
                    
                    // Valida range prezzi (BTC: $0.01 - $1,000,000)
                    if (open > 1000000 || open < 0.01 ||
                        high > 1000000 || high < 0.01 ||
                        low > 1000000 || low < 0.01 ||
                        close > 1000000 || close < 0.01) {
                        return false;
                    }
                    
                    // Valida logica OHLC
                    if (high < low || close > high || close < low) {
                        return false;
                    }
                    
                    return true;
                });
                
                allKlines.push(...validKlines);
                console.log(`   ✅ Scaricate ${validKlines.length} klines (totale: ${allKlines.length})`);
                
                // Prossimo batch
                currentStartTime = parseInt(klines[klines.length - 1][0]) + 1;
                
                // Evita rate limit Binance (max 1200 req/min, ~20 req/sec)
                await new Promise(resolve => setTimeout(resolve, 150));
                
            } catch (error) {
                console.error(`   ⚠️  Errore batch ${batchNum}: ${error.message}`);
                if (allKlines.length > 0) {
                    console.log(`   ℹ️  Continuo con ${allKlines.length} klines già scaricate`);
                    break;
                } else {
                    throw error;
                }
            }
        }
        
        if (allKlines.length === 0) {
            throw new Error('Nessuna kline scaricata da Binance');
        }
        
        console.log(`\n✅ Download completato: ${allKlines.length} klines`);
        
        // 3. Salva nel database (upsert)
        console.log(`\n💾 Salvataggio nel database:`);
        let saved = 0;
        let updated = 0;
        let errors = 0;
        
        for (let i = 0; i < allKlines.length; i++) {
            const kline = allKlines[i];
            
            try {
                // Verifica se esiste già
                const exists = await dbGet(
                    `SELECT 1 FROM klines WHERE symbol = $1 AND interval = $2 AND open_time = $3`,
                    [SYMBOL, KLINE_INTERVAL, parseInt(kline[0])]
                );
                
                await dbRun(
                    `INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     ON CONFLICT (symbol, interval, open_time) 
                     DO UPDATE SET 
                         open_price = EXCLUDED.open_price,
                         high_price = EXCLUDED.high_price,
                         low_price = EXCLUDED.low_price,
                         close_price = EXCLUDED.close_price,
                         volume = EXCLUDED.volume,
                         close_time = EXCLUDED.close_time`,
                    [
                        SYMBOL,
                        KLINE_INTERVAL,
                        parseInt(kline[0]),
                        parseFloat(kline[1]),
                        parseFloat(kline[2]),
                        parseFloat(kline[3]),
                        parseFloat(kline[4]),
                        parseFloat(kline[5]),
                        parseInt(kline[6])
                    ]
                );
                
                if (exists) {
                    updated++;
                } else {
                    saved++;
                }
                
                // Progress bar
                if ((i + 1) % 100 === 0 || i === allKlines.length - 1) {
                    const progress = ((i + 1) / allKlines.length * 100).toFixed(1);
                    process.stdout.write(`\r   Progress: ${progress}% (${i + 1}/${allKlines.length}) - Nuovi: ${saved}, Aggiornati: ${updated}, Errori: ${errors}`);
                }
                
            } catch (error) {
                errors++;
                // Non bloccare per errori singoli
            }
        }
        
        console.log(`\n✅ Klines salvate: ${saved} nuove, ${updated} aggiornate, ${errors} errori`);
        
        // 4. Sincronizza price_history
        console.log(`\n🔄 Sincronizzazione price_history:`);
        const recentKlines = await dbAll(
            `SELECT open_time, close_price FROM klines 
             WHERE symbol = $1 AND interval = $2 
             ORDER BY open_time DESC LIMIT 200`,
            [SYMBOL, KLINE_INTERVAL]
        );
        
        let synced = 0;
        for (const kline of recentKlines) {
            try {
                await dbRun(
                    `INSERT INTO price_history (symbol, price, timestamp)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (symbol, timestamp) 
                     DO UPDATE SET price = EXCLUDED.price`,
                    [
                        SYMBOL,
                        parseFloat(kline.close_price),
                        new Date(parseInt(kline.open_time)).toISOString()
                    ]
                );
                synced++;
            } catch (error) {
                // Ignora errori singoli
            }
        }
        
        console.log(`   ✅ Sincronizzati ${synced} price_history`);
        
        // 5. Verifica finale
        console.log(`\n🔍 Verifica finale:`);
        const finalKlinesCount = await dbGet(
            `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2`,
            [SYMBOL, KLINE_INTERVAL]
        );
        const finalPriceCount = await dbGet(
            `SELECT COUNT(*) as count FROM price_history WHERE symbol = $1`,
            [SYMBOL]
        );
        
        const kCount = parseInt(finalKlinesCount?.count || 0);
        const pCount = parseInt(finalPriceCount?.count || 0);
        
        console.log(`   Klines (15m): ${kCount} ${kCount >= 50 ? '✅' : '❌'}`);
        console.log(`   Price history: ${pCount} ${pCount >= 50 ? '✅' : '❌'}`);
        
        if (kCount >= 50 && pCount >= 50) {
            console.log(`\n✅ SUCCESS! BTC ora ha dati sufficienti per il trading`);
        } else {
            console.log(`\n⚠️  ATTENZIONE: Dati ancora insufficienti`);
            if (kCount < 50) console.log(`   - Mancano ${50 - kCount} klines`);
            if (pCount < 50) console.log(`   - Mancano ${50 - pCount} price_history`);
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('✅ Fix completato\n');
        process.exit(0);
        
    } catch (error) {
        console.error(`\n❌ ERRORE: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

fixBTCData();



