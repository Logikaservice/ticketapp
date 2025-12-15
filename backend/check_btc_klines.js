/**
 * Script per verificare quanti klines ha BTC/EUR per ogni timeframe
 */

const { dbAll } = require('./crypto_db');

async function checkBTCKlines() {
    try {
        console.log('🔍 VERIFICA KLINES BTC/EUR\n');

        // 1. Trova tutti i simboli BTC
        console.log('=== STEP 1: Ricerca simboli BTC ===');
        const symbols = await dbAll(`
            SELECT DISTINCT symbol 
            FROM klines 
            WHERE LOWER(symbol) LIKE '%btc%' 
               OR LOWER(symbol) LIKE '%bitcoin%'
            ORDER BY symbol
        `);

        console.log(`Trovati ${symbols.length} simboli BTC:`);
        symbols.forEach(s => console.log(`  - ${s.symbol}`));
        console.log('');

        // 2. Per ogni simbolo, conta klines per timeframe
        const intervals = ['15m', '1h', '4h'];

        for (const { symbol } of symbols) {
            console.log(`\n📊 ${symbol.toUpperCase()}`);
            console.log('─'.repeat(60));

            for (const interval of intervals) {
                // Conta totale
                const countResult = await dbAll(`
                    SELECT COUNT(*) as count 
                    FROM klines 
                    WHERE symbol = $1 AND interval = $2
                `, [symbol, interval]);

                const count = parseInt(countResult[0]?.count || 0);

                // Ottieni range temporale
                const rangeResult = await dbAll(`
                    SELECT 
                        MIN(open_time) as first_kline,
                        MAX(open_time) as last_kline
                    FROM klines 
                    WHERE symbol = $1 AND interval = $2
                `, [symbol, interval]);

                const firstKline = rangeResult[0]?.first_kline;
                const lastKline = rangeResult[0]?.last_kline;

                // Calcola giorni coperti
                let daysCovered = 0;
                if (firstKline && lastKline) {
                    const first = new Date(parseInt(firstKline));
                    const last = new Date(parseInt(lastKline));
                    daysCovered = Math.round((last - first) / (1000 * 60 * 60 * 24));
                }

                // Status emoji
                let status = '❌';
                if (interval === '15m' && count >= 1000) status = '✅';
                else if (interval === '1h' && count >= 500) status = '✅';
                else if (interval === '4h' && count >= 500) status = '✅';
                else if (count >= 100) status = '⚠️';

                console.log(`${status} ${interval.padEnd(4)} | ${String(count).padStart(6)} klines | ~${daysCovered} giorni`);

                if (firstKline && lastKline) {
                    const first = new Date(parseInt(firstKline)).toISOString().split('T')[0];
                    const last = new Date(parseInt(lastKline)).toISOString().split('T')[0];
                    console.log(`         Range: ${first} → ${last}`);
                }
            }
        }

        // 3. Raccomandazioni
        console.log('\n\n📋 RACCOMANDAZIONI');
        console.log('─'.repeat(60));
        console.log('✅ OTTIMALE:  15m ≥ 1000 | 1h ≥ 500 | 4h ≥ 500');
        console.log('⚠️  MINIMO:   15m ≥ 100  | 1h ≥ 100 | 4h ≥ 100');
        console.log('❌ BASSO:     Sotto il minimo\n');

    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

checkBTCKlines();
