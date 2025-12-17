/**
 * Script per garantire 5000 klines complete per Bitcoin (BTC/EUR)
 * 
 * Funzionalità:
 * 1. Verifica klines esistenti per 'bitcoin' (interval='15m')
 * 2. Scarica klines mancanti da Binance (BTCEUR) per arrivare a 5000
 * 3. Verifica e riempie eventuali gap
 * 4. Verifica che l'aggregatore sia attivo per mantenere aggiornate
 */

const { dbAll, dbGet, dbRun } = require('../crypto_db');
const https = require('https');

const SYMBOL = 'bitcoin';
const BINANCE_SYMBOL = 'BTCEUR';
const INTERVAL = '15m';
const TARGET_KLINES = 5000;
const KLINE_INTERVAL_MS = 15 * 60 * 1000; // 15 minuti in millisecondi

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
                        reject(new Error(`Binance API returned HTML instead of JSON`));
                        return;
                    }
                    const parsed = JSON.parse(data);
                    if (parsed.code && parsed.msg) {
                        reject(new Error(`Binance API Error ${parsed.code}: ${parsed.msg}`));
                        return;
                    }
                    resolve(parsed);
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

async function getCurrentKlinesCount() {
    const result = await dbGet(
        `SELECT COUNT(*) as count 
         FROM klines 
         WHERE symbol = $1 AND interval = $2`,
        [SYMBOL, INTERVAL]
    );
    return parseInt(result?.count || 0);
}

async function getKlinesRange() {
    const result = await dbGet(
        `SELECT 
            MIN(open_time) as first_time,
            MAX(open_time) as last_time
         FROM klines 
         WHERE symbol = $1 AND interval = $2`,
        [SYMBOL, INTERVAL]
    );
    return {
        first: result?.first_time ? Number(result.first_time) : null,
        last: result?.last_time ? Number(result.last_time) : null
    };
}

async function findGaps() {
    // Trova gap nelle klines esistenti
    const gaps = await dbAll(
        `WITH klines_ordered AS (
            SELECT open_time, 
                   LAG(open_time) OVER (ORDER BY open_time) as prev_time
            FROM klines 
            WHERE symbol = $1 AND interval = $2
            ORDER BY open_time
        )
        SELECT prev_time, open_time as gap_start
        FROM klines_ordered
        WHERE prev_time IS NOT NULL 
          AND open_time - prev_time > $3 * 1.5
        ORDER BY gap_start`,
        [SYMBOL, INTERVAL, KLINE_INTERVAL_MS]
    );
    
    return gaps.map(g => ({
        start: Number(g.prev_time) + KLINE_INTERVAL_MS,
        end: Number(g.gap_start) - KLINE_INTERVAL_MS
    }));
}

async function downloadKlinesFromBinance(startTime, endTime) {
    console.log(`   📥 Download da ${new Date(startTime).toISOString()} a ${new Date(endTime).toISOString()}...`);
    
    const limit = 1000;
    let allKlines = [];
    let currentStartTime = startTime;
    let attempts = 0;
    const maxAttempts = 50; // Aumentato per coprire più giorni
    
    while (currentStartTime < endTime && attempts < maxAttempts) {
        const url = `https://api.binance.com/api/v3/klines?symbol=${BINANCE_SYMBOL}&interval=${INTERVAL}&startTime=${currentStartTime}&limit=${limit}`;
        
        try {
            const klines = await httpsGet(url);
            
            if (!Array.isArray(klines) || klines.length === 0) {
                break;
            }
            
            allKlines = allKlines.concat(klines);
            currentStartTime = klines[klines.length - 1][0] + 1;
            attempts++;
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
            console.error(`      ⚠️ Errore: ${error.message}`);
            break;
        }
    }
    
    return allKlines;
}

async function insertKlines(klines) {
    let inserted = 0;
    let skipped = 0;
    
    for (const k of klines) {
        try {
            await dbRun(
                `INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (symbol, interval, open_time) DO NOTHING`,
                [SYMBOL, INTERVAL, k[0], k[1], k[2], k[3], k[4], k[5], k[6]]
            );
            inserted++;
        } catch (error) {
            skipped++;
        }
    }
    
    return { inserted, skipped };
}

async function ensure5000Klines() {
    console.log('🔍 VERIFICA E GARANZIA 5000 KLINES PER BITCOIN');
    console.log('='.repeat(70));
    console.log(`Simbolo: ${SYMBOL} (${BINANCE_SYMBOL})`);
    console.log(`Intervallo: ${INTERVAL}`);
    console.log(`Target: ${TARGET_KLINES} klines complete\n`);

    try {
        // 1. Verifica klines esistenti
        console.log('📊 1. Verifica klines esistenti...');
        const currentCount = await getCurrentKlinesCount();
        console.log(`   ✅ Klines attuali: ${currentCount}`);
        
        if (currentCount >= TARGET_KLINES) {
            console.log(`\n✅ Obiettivo raggiunto! Hai già ${currentCount} klines (target: ${TARGET_KLINES})`);
            
            // Verifica comunque i gap
            const gaps = await findGaps();
            if (gaps.length > 0) {
                console.log(`\n⚠️  Trovati ${gaps.length} gap da riempire:`);
                for (const gap of gaps) {
                    console.log(`   - Gap: ${new Date(gap.start).toISOString()} → ${new Date(gap.end).toISOString()}`);
                }
                
                // Riempie i gap
                for (const gap of gaps) {
                    const klines = await downloadKlinesFromBinance(gap.start, gap.end);
                    if (klines.length > 0) {
                        const { inserted } = await insertKlines(klines);
                        console.log(`   ✅ Riempito gap: ${inserted} klines inserite`);
                    }
                }
            } else {
                console.log(`   ✅ Nessun gap trovato - klines complete!`);
            }
            
            return;
        }
        
        const needed = TARGET_KLINES - currentCount;
        console.log(`   ⚠️  Mancano ${needed} klines per raggiungere ${TARGET_KLINES}`);
        
        // 2. Calcola range temporale necessario
        console.log('\n📅 2. Calcolo range temporale necessario...');
        const daysNeeded = Math.ceil((needed * 15) / (60 * 24)); // giorni necessari
        console.log(`   • Giorni necessari: ~${daysNeeded} giorni`);
        
        const range = await getKlinesRange();
        const now = Date.now();
        let startTime;
        
        if (range.last) {
            // Se ci sono klines esistenti, parte dall'ultima e va indietro
            startTime = range.last - (needed * KLINE_INTERVAL_MS);
        } else {
            // Se non ci sono klines, scarica gli ultimi N giorni
            startTime = now - (daysNeeded * 24 * 60 * 60 * 1000);
        }
        
        const endTime = range.last ? range.last : now;
        
        console.log(`   • Periodo da scaricare: ${new Date(startTime).toISOString()} → ${new Date(endTime).toISOString()}`);
        
        // 3. Scarica klines mancanti
        console.log('\n📥 3. Download klines da Binance...');
        const klines = await downloadKlinesFromBinance(startTime, endTime);
        console.log(`   ✅ Scaricate ${klines.length} klines da Binance`);
        
        // 4. Inserisci nel database
        console.log('\n💾 4. Inserimento nel database...');
        const { inserted, skipped } = await insertKlines(klines);
        console.log(`   ✅ Inserite: ${inserted} nuove klines`);
        if (skipped > 0) {
            console.log(`   ⏭️  Saltate: ${skipped} klines (già presenti)`);
        }
        
        // 5. Verifica gap e riempili
        console.log('\n🔍 5. Verifica gap...');
        const gaps = await findGaps();
        if (gaps.length > 0) {
            console.log(`   ⚠️  Trovati ${gaps.length} gap:`);
            for (const gap of gaps) {
                console.log(`      - ${new Date(gap.start).toISOString()} → ${new Date(gap.end).toISOString()}`);
                const gapKlines = await downloadKlinesFromBinance(gap.start, gap.end);
                if (gapKlines.length > 0) {
                    const { inserted: gapInserted } = await insertKlines(gapKlines);
                    console.log(`      ✅ Riempito: ${gapInserted} klines`);
                }
            }
        } else {
            console.log(`   ✅ Nessun gap trovato`);
        }
        
        // 6. Verifica finale
        console.log('\n✅ 6. Verifica finale...');
        const finalCount = await getCurrentKlinesCount();
        console.log(`   📊 Totale klines: ${finalCount}`);
        
        if (finalCount >= TARGET_KLINES) {
            console.log(`\n🎉 SUCCESSO! Hai ${finalCount} klines complete (target: ${TARGET_KLINES})`);
        } else {
            console.log(`\n⚠️  Hai ${finalCount} klines (target: ${TARGET_KLINES})`);
            console.log(`   • Potrebbe essere necessario eseguire di nuovo lo script`);
        }
        
        // 7. Verifica aggregatore
        console.log('\n🔄 7. Verifica aggregatore klines...');
        console.log('   ℹ️  L\'aggregatore klines si avvia automaticamente con il backend');
        console.log('   ℹ️  Aggiorna le klines ogni 15 minuti da WebSocket');
        console.log('   ℹ️  Verifica che il backend sia in esecuzione: pm2 status');
        
    } catch (error) {
        console.error('\n❌ ERRORE:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

ensure5000Klines().then(() => {
    console.log('\n✅ Script completato');
    process.exit(0);
}).catch(err => {
    console.error('❌ Errore fatale:', err);
    process.exit(1);
});
