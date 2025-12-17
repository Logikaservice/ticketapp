/**
 * Script per diagnosticare perché uniswap_eur ha solo 290 klines
 */

const { dbAll, dbGet } = require('../crypto_db');
const https = require('https');

const SYMBOL = 'uniswap_eur';
const BINANCE_SYMBOL = 'UNIEUR';
const INTERVAL = '15m';

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

async function diagnoseUniswapEur() {
    console.log('🔍 DIAGNOSTICA UNISWAP_EUR');
    console.log('='.repeat(70));
    console.log(`Simbolo: ${SYMBOL} (${BINANCE_SYMBOL})\n`);

    try {
        // 1. Verifica klines nel database
        console.log('📊 1. Klines nel database:');
        const klinesCount = await dbGet(
            `SELECT COUNT(*) as count 
             FROM klines 
             WHERE symbol = $1 AND interval = $2`,
            [SYMBOL, INTERVAL]
        );
        const count = parseInt(klinesCount?.count || 0);
        console.log(`   ✅ Totale klines: ${count}\n`);

        // 2. Range temporale
        console.log('📅 2. Range temporale klines esistenti:');
        const range = await dbGet(
            `SELECT 
                MIN(open_time) as first_time,
                MAX(open_time) as last_time
             FROM klines 
             WHERE symbol = $1 AND interval = $2`,
            [SYMBOL, INTERVAL]
        );
        
        if (range.first_time && range.last_time) {
            const first = new Date(Number(range.first_time));
            const last = new Date(Number(range.last_time));
            const days = (Number(range.last_time) - Number(range.first_time)) / (1000 * 60 * 60 * 24);
            console.log(`   Prima kline: ${first.toISOString()}`);
            console.log(`   Ultima kline: ${last.toISOString()}`);
            console.log(`   Giorni coperti: ${days.toFixed(1)}\n`);
        } else {
            console.log(`   ⚠️  Nessuna kline trovata\n`);
        }

        // 3. Test disponibilità su Binance
        console.log('📡 3. Test disponibilità su Binance:');
        try {
            const testUrl = `https://api.binance.com/api/v3/klines?symbol=${BINANCE_SYMBOL}&interval=${INTERVAL}&limit=1`;
            const testResult = await httpsGet(testUrl);
            console.log(`   ✅ Simbolo disponibile su Binance\n`);
        } catch (error) {
            console.log(`   ❌ Errore: ${error.message}\n`);
            console.log('💡 POSSIBILE CAUSA: Il trading pair UNIEUR potrebbe non esistere su Binance');
            console.log('   Verifica su: https://www.binance.com/en/trade/UNI_EUR\n');
            process.exit(0);
        }

        // 4. Test download ultimi 1000 klines
        console.log('📥 4. Test download ultimi 1000 klines da Binance:');
        try {
            const testUrl = `https://api.binance.com/api/v3/klines?symbol=${BINANCE_SYMBOL}&interval=${INTERVAL}&limit=1000`;
            const klines = await httpsGet(testUrl);
            
            if (klines.length === 0) {
                console.log(`   ⚠️  Binance non restituisce dati per ${BINANCE_SYMBOL}\n`);
            } else {
                const oldest = new Date(Number(klines[0][0]));
                const newest = new Date(Number(klines[klines.length - 1][0]));
                const daysAvailable = (Number(klines[klines.length - 1][0]) - Number(klines[0][0])) / (1000 * 60 * 60 * 24);
                
                console.log(`   ✅ Disponibili ${klines.length} klines su Binance`);
                console.log(`   Range Binance: ${oldest.toISOString()} → ${newest.toISOString()}`);
                console.log(`   Giorni disponibili: ${daysAvailable.toFixed(1)}`);
                console.log(`   Klines teoriche per 60 giorni: ~${Math.floor(60 * 24 * 4)} (4 klines/ora × 24h × 60 giorni)\n`);
            }
        } catch (error) {
            console.log(`   ❌ Errore download: ${error.message}\n`);
        }

        // 5. Test download storico (ultimi 60 giorni)
        console.log('📥 5. Test download storico (ultimi 60 giorni):');
        const now = Date.now();
        const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);
        
        try {
            const historicalUrl = `https://api.binance.com/api/v3/klines?symbol=${BINANCE_SYMBOL}&interval=${INTERVAL}&startTime=${sixtyDaysAgo}&limit=1000`;
            const historicalKlines = await httpsGet(historicalUrl);
            
            if (historicalKlines.length > 0) {
                console.log(`   ✅ Disponibili ${historicalKlines.length} klines per ultimi 60 giorni`);
                const oldest = new Date(Number(historicalKlines[0][0]));
                const newest = new Date(Number(historicalKlines[historicalKlines.length - 1][0]));
                console.log(`   Range: ${oldest.toISOString()} → ${newest.toISOString()}\n`);
            } else {
                console.log(`   ⚠️  Nessuna kline disponibile per ultimi 60 giorni\n`);
            }
        } catch (error) {
            console.log(`   ❌ Errore: ${error.message}\n`);
        }

        // 6. Verifica gap nelle klines esistenti
        if (count > 0) {
            console.log('🔍 6. Verifica gap nelle klines esistenti:');
            const gaps = await dbAll(
                `WITH klines_ordered AS (
                    SELECT open_time, 
                           LAG(open_time) OVER (ORDER BY open_time) as prev_time
                    FROM klines 
                    WHERE symbol = $1 AND interval = $2
                    ORDER BY open_time
                )
                SELECT prev_time, open_time as gap_start,
                       (open_time - prev_time) / (15 * 60 * 1000) as gap_size_klines
                FROM klines_ordered
                WHERE prev_time IS NOT NULL 
                  AND open_time - prev_time > (15 * 60 * 1000) * 1.5
                ORDER BY gap_start`,
                [SYMBOL, INTERVAL]
            );
            
            if (gaps.length > 0) {
                console.log(`   ⚠️  Trovati ${gaps.length} gap:`);
                gaps.forEach(g => {
                    const gapSize = Math.floor(Number(g.gap_size_klines));
                    console.log(`      - Gap di ${gapSize} klines tra ${new Date(Number(g.prev_time)).toISOString()} e ${new Date(Number(g.gap_start)).toISOString()}`);
                });
            } else {
                console.log(`   ✅ Nessun gap trovato (klines consecutive)\n`);
            }
        }

        // 7. Conclusioni
        console.log('\n' + '='.repeat(70));
        console.log('📋 CONCLUSIONI');
        console.log('='.repeat(70));
        
        if (count < 2000) {
            console.log(`\n⚠️  ${SYMBOL} ha solo ${count} klines (minimo: 2000, target: 5000)`);
            console.log('\n💡 POSSIBILI CAUSE:');
            console.log('   1. Trading pair UNIEUR potrebbe non essere disponibile su Binance');
            console.log('   2. Trading pair potrebbe essere stato aggiunto di recente (poca storia)');
            console.log('   3. Potrebbero esserci stati errori durante il download');
            console.log('   4. Rate limiting potrebbe aver interrotto il download');
            console.log('\n🔧 SOLUZIONI:');
            console.log('   1. Verifica su Binance se UNIEUR esiste: https://www.binance.com/en/trade/UNI_EUR');
            console.log('   2. Se non esiste, usa UNIUSDT invece di UNIEUR');
            console.log('   3. Esegui di nuovo lo script di download');
            console.log('   4. Verifica log per errori specifici');
        } else {
            console.log(`\n✅ ${SYMBOL} ha ${count} klines (sopra il minimo di 2000)`);
        }
        console.log('');

    } catch (error) {
        console.error('\n❌ ERRORE:', error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

diagnoseUniswapEur().then(() => {
    console.log('✅ Diagnostica completata');
    process.exit(0);
}).catch(err => {
    console.error('❌ Errore fatale:', err);
    process.exit(1);
});
