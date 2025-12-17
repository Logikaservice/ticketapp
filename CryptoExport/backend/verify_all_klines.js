/**
 * 🔍 Verifica Completa Klines per Tutti i Simboli
 * 
 * Verifica:
 * 1. Numero klines per ogni simbolo
 * 2. Range temporale (prima/ultima kline)
 * 3. Gap temporali
 * 4. Freschezza dati (ultima kline recente)
 * 5. Simboli senza klines
 */

const { dbAll, dbGet } = require('./crypto_db');

async function verifyAllKlines() {
    console.log('🔍 VERIFICA COMPLETA KLINES PER TUTTI I SIMBOLI');
    console.log('='.repeat(80));
    console.log('');

    try {
        // 1. Recupera tutti i simboli configurati
        console.log('📊 Recupero simboli configurati...');
        const allBotSymbols = await dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE strategy_name = $1 ORDER BY symbol",
            ['RSI_Strategy']
        );

        console.log(`   ✅ Trovati ${allBotSymbols.length} simboli configurati`);
        console.log('');

        // 2. Recupera statistiche klines per ogni simbolo
        console.log('📈 Analisi klines per simbolo...');
        console.log('');

        const klinesStats = await dbAll(
            `SELECT 
                symbol,
                COUNT(*) as count,
                MIN(open_time) as first_time,
                MAX(open_time) as last_time
             FROM klines 
             WHERE interval = $1
             GROUP BY symbol
             ORDER BY symbol`,
            ['15m']
        );

        const klinesMap = new Map();
        klinesStats.forEach(row => {
            klinesMap.set(row.symbol.toLowerCase(), {
                count: parseInt(row.count),
                firstTime: parseInt(row.first_time),
                lastTime: parseInt(row.last_time)
            });
        });

        // 3. Verifica ogni simbolo
        const now = Date.now();
        const fifteenMinutesAgo = now - (15 * 60 * 1000);
        const oneHourAgo = now - (60 * 60 * 1000);
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        const results = {
            total: allBotSymbols.length,
            withKlines: 0,
            withoutKlines: [],
            insufficient: [], // < 50 klines
            low: [], // 50-99 klines
            good: [], // 100-500 klines
            excellent: [], // > 500 klines
            stale: [], // ultima kline > 1 ora fa
            veryStale: [] // ultima kline > 1 giorno fa
        };

        console.log('📋 REPORT DETTAGLIATO PER SIMBOLO:');
        console.log('='.repeat(80));
        console.log('');

        for (const botRow of allBotSymbols) {
            const symbol = botRow.symbol;
            const symbolLower = symbol.toLowerCase();
            const stats = klinesMap.get(symbolLower);

            if (!stats) {
                console.log(`❌ ${symbol.toUpperCase()}: NESSUNA KLINE`);
                results.withoutKlines.push(symbol);
                continue;
            }

            const count = stats.count;
            const firstTime = stats.firstTime;
            const lastTime = stats.lastTime;
            const firstDate = new Date(firstTime);
            const lastDate = new Date(lastTime);
            const age = now - lastTime;
            const ageHours = age / (60 * 60 * 1000);
            const ageMinutes = age / (60 * 1000);

            // Classifica per quantità
            let statusIcon = '✅';
            let statusText = '';
            if (count < 50) {
                statusIcon = '❌';
                statusText = 'INSUFFICIENTI';
                results.insufficient.push(symbol);
            } else if (count < 100) {
                statusIcon = '⚠️';
                statusText = 'LIMITATE';
                results.low.push(symbol);
            } else if (count < 500) {
                statusIcon = '✅';
                statusText = 'SUFFICIENTI';
                results.good.push(symbol);
            } else {
                statusIcon = '✅';
                statusText = 'ECCELLENTI';
                results.excellent.push(symbol);
            }

            // Verifica freschezza
            let freshnessIcon = '';
            let freshnessText = '';
            if (age > oneDayAgo) {
                freshnessIcon = '🔴';
                freshnessText = 'MOLTO VECCHIE';
                results.veryStale.push(symbol);
            } else if (age > oneHourAgo) {
                freshnessIcon = '🟡';
                freshnessText = 'VECCHIE';
                results.stale.push(symbol);
            } else {
                freshnessIcon = '🟢';
                freshnessText = 'FRESCHE';
            }

            results.withKlines++;

            // Calcola giorni coperti
            const daysCovered = (lastTime - firstTime) / (24 * 60 * 60 * 1000);

            console.log(`${statusIcon} ${symbol.toUpperCase()}:`);
            console.log(`   Klines: ${count.toLocaleString()} ${statusText}`);
            console.log(`   Range: ${firstDate.toLocaleDateString('it-IT')} → ${lastDate.toLocaleDateString('it-IT')} (${daysCovered.toFixed(1)} giorni)`);
            console.log(`   Ultima kline: ${freshnessIcon} ${ageMinutes < 60 ? ageMinutes.toFixed(0) + ' minuti fa' : ageHours.toFixed(1) + ' ore fa'} (${freshnessText})`);
            
            // Verifica gap (controlla se ci sono buchi temporali significativi)
            if (count > 0) {
                const expectedKlines = Math.floor(daysCovered * 24 * 4); // 4 klines/ora per 15m
                const coverage = (count / expectedKlines) * 100;
                if (coverage < 90) {
                    console.log(`   ⚠️ Possibili gap: copertura ${coverage.toFixed(1)}% (attese ~${expectedKlines.toLocaleString()}, trovate ${count.toLocaleString()})`);
                }
            }
            
            console.log('');
        }

        // 4. Report riepilogativo
        console.log('='.repeat(80));
        console.log('📊 REPORT RIEPILOGATIVO');
        console.log('='.repeat(80));
        console.log('');
        console.log(`📈 Simboli totali: ${results.total}`);
        console.log(`✅ Con klines: ${results.withKlines}`);
        console.log(`❌ Senza klines: ${results.withoutKlines.length}`);
        console.log('');
        console.log(`📊 Classificazione per quantità:`);
        console.log(`   ❌ Insufficienti (< 50): ${results.insufficient.length}`);
        console.log(`   ⚠️ Limitati (50-99): ${results.low.length}`);
        console.log(`   ✅ Sufficienti (100-500): ${results.good.length}`);
        console.log(`   ✅ Eccellenti (> 500): ${results.excellent.length}`);
        console.log('');
        console.log(`🕐 Classificazione per freschezza:`);
        console.log(`   🟢 Fresche (< 1h): ${results.total - results.stale.length - results.veryStale.length}`);
        console.log(`   🟡 Vecchie (1h-24h): ${results.stale.length}`);
        console.log(`   🔴 Molto vecchie (> 24h): ${results.veryStale.length}`);
        console.log('');

        // 5. Problemi critici
        if (results.withoutKlines.length > 0) {
            console.log('❌ SIMBOLI SENZA KLINES:');
            results.withoutKlines.forEach(symbol => {
                console.log(`   - ${symbol}`);
            });
            console.log('');
        }

        if (results.insufficient.length > 0) {
            console.log('❌ SIMBOLI CON KLINES INSUFFICIENTI (< 50):');
            results.insufficient.forEach(symbol => {
                console.log(`   - ${symbol}`);
            });
            console.log('');
        }

        if (results.veryStale.length > 0) {
            console.log('🔴 SIMBOLI CON KLINES MOLTO VECCHIE (> 24h):');
            results.veryStale.forEach(symbol => {
                console.log(`   - ${symbol}`);
            });
            console.log('');
        }

        // 6. Statistiche top
        if (klinesStats.length > 0) {
            console.log('📈 TOP 10 SIMBOLI PER NUMERO DI KLINES:');
            klinesStats
                .sort((a, b) => parseInt(b.count) - parseInt(a.count))
                .slice(0, 10)
                .forEach((row, idx) => {
                    const count = parseInt(row.count);
                    const lastTime = parseInt(row.last_time);
                    const age = now - lastTime;
                    const ageHours = age / (60 * 60 * 1000);
                    const freshness = ageHours < 1 ? '🟢' : ageHours < 24 ? '🟡' : '🔴';
                    console.log(`   ${idx + 1}. ${row.symbol}: ${count.toLocaleString()} klines ${freshness}`);
                });
            console.log('');
        }

        // 7. Suggerimenti
        console.log('💡 SUGGERIMENTI:');
        if (results.withoutKlines.length > 0) {
            console.log(`1. Scarica klines per simboli senza dati: node download_klines.js <symbol>`);
            console.log(`   Simboli: ${results.withoutKlines.join(', ')}`);
        }
        if (results.insufficient.length > 0) {
            console.log(`2. Scarica klines aggiuntive per simboli insufficienti: node download_klines.js <symbol>`);
            console.log(`   Simboli: ${results.insufficient.join(', ')}`);
        }
        if (results.veryStale.length > 0) {
            console.log(`3. Aggiorna klines vecchie: Il bot dovrebbe aggiornarle automaticamente, ma verifica i log`);
            console.log(`   Simboli: ${results.veryStale.join(', ')}`);
        }
        if (results.withoutKlines.length === 0 && results.insufficient.length === 0 && results.veryStale.length === 0) {
            console.log('✅ Tutti i simboli hanno klines sufficienti e aggiornate!');
        }
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante verifica klines:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

verifyAllKlines().catch(console.error);

