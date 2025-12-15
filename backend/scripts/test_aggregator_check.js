/**
 * 🧪 Script di test per il controllo unificato Aggregatore Klines
 * Esegue il controllo e mostra i risultati dettagliati
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// ✅ Isola il controllo senza caricare altri servizi
const { dbGet, dbAll } = require('../crypto_db');

async function checkAggregator() {
    try {
        const SYMBOL_TO_PAIR = require('../routes/cryptoRoutes').SYMBOL_TO_PAIR || {};
        const MIN_KLINES_REQUIRED = 50;
        const KLINE_INTERVAL = '15m';
        const oneHourAgo = Date.now() - (60 * 60 * 1000);

        // 1. Verifica servizio aggregatore (tempo reale - ultima ora)
        let serviceWorking = false;
        let klinesLastHour = 0;
        try {
            const recentKlines = await dbGet(
                `SELECT COUNT(*) as count 
                 FROM klines 
                 WHERE interval = $1 
                   AND open_time > $2`,
                [KLINE_INTERVAL, oneHourAgo]
            );
            klinesLastHour = parseInt(recentKlines?.count || 0);
            const expected = 4; // ~4 klines per ora (15m interval)
            serviceWorking = klinesLastHour >= expected - 1;
        } catch (error) {
            console.log('   ⚠️  Errore verifica servizio:', error.message);
        }

        // 2. Verifica quantità klines per simbolo (dati storici)
        const symbols = Object.keys(SYMBOL_TO_PAIR);
        const symbolsWithIssues = [];
        let totalKlines = 0;
        let symbolsOK = 0;

        // ✅ OTTIMIZZAZIONE: Query unica per tutti i simboli invece di loop
        try {
            const allKlinesCount = await dbAll(
                `SELECT symbol, COUNT(*) as count 
                 FROM klines 
                 WHERE interval = $1 
                 GROUP BY symbol`,
                [KLINE_INTERVAL]
            );

            // Crea mappa per accesso rapido
            const klinesMap = {};
            allKlinesCount.forEach(row => {
                klinesMap[row.symbol] = parseInt(row.count || 0);
            });

            // Verifica ogni simbolo
            for (const symbol of symbols) {
                const count = klinesMap[symbol] || 0;
                totalKlines += count;

                if (count < MIN_KLINES_REQUIRED) {
                    symbolsWithIssues.push({
                        symbol,
                        count,
                        required: MIN_KLINES_REQUIRED,
                        missing: MIN_KLINES_REQUIRED - count
                    });
                } else {
                    symbolsOK++;
                }
            }
        } catch (error) {
            throw new Error(`Errore query aggregata: ${error.message}`);
        }

        // 3. Determina stato complessivo
        const hasDataIssues = symbolsWithIssues.length > 0;
        const isHealthy = serviceWorking && !hasDataIssues;
        const avgKlines = symbols.length > 0 ? Math.floor(totalKlines / symbols.length) : 0;

        // 4. Costruisci messaggio dettagliato
        let message = '';
        if (isHealthy) {
            message = `Servizio attivo (${klinesLastHour} klines/ora) - Dati OK (${symbolsOK}/${symbols.length} simboli, media: ${avgKlines} klines)`;
        } else {
            const parts = [];
            if (!serviceWorking) {
                parts.push(`Servizio inattivo (${klinesLastHour} klines/ora)`);
            }
            if (hasDataIssues) {
                parts.push(`${symbolsWithIssues.length} simboli con < ${MIN_KLINES_REQUIRED} klines`);
            }
            message = parts.join(' - ');
        }

        return {
            healthy: isHealthy,
            working: serviceWorking,
            klinesLastHour,
            minRequired: MIN_KLINES_REQUIRED,
            symbolsChecked: symbols.length,
            symbolsOK,
            symbolsWithIssues: symbolsWithIssues.length,
            avgKlinesPerSymbol: avgKlines,
            details: symbolsWithIssues.slice(0, 10), // Primi 10 per non appesantire
            message
        };
    } catch (error) {
        return {
            healthy: false,
            working: false,
            error: error.message,
            message: 'Errore verifica aggregatore e klines'
        };
    }
}

async function testAggregatorCheck() {
    console.log('🧪 TEST CONTROLLO AGGREGATORE KLINES UNIFICATO\n');
    console.log('='.repeat(80));
    console.log('\n⏳ Esecuzione controllo...\n');

    try {
        // Esegui il controllo
        const startTime = Date.now();
        const result = await checkAggregator();
        const duration = Date.now() - startTime;

        console.log('✅ Controllo completato in', duration, 'ms\n');
        console.log('='.repeat(80));
        console.log('\n📊 RISULTATI DETTAGLIATI:\n');
        console.log('-'.repeat(80));

        // Stato generale
        console.log('\n🎯 STATO GENERALE:');
        console.log(`   Healthy: ${result.healthy ? '✅ SI' : '❌ NO'}`);
        console.log(`   Working: ${result.working ? '✅ SI' : '❌ NO'}`);
        console.log(`   Message: ${result.message}`);

        // Servizio aggregatore (tempo reale)
        console.log('\n⚡ SERVIZIO AGGREGATORE (Tempo Reale):');
        console.log(`   Klines ultima ora: ${result.klinesLastHour || 0}`);
        console.log(`   Atteso: ~4 klines/ora (intervallo 15m)`);
        console.log(`   Status: ${result.working ? '✅ Servizio attivo' : '❌ Servizio inattivo'}`);

        // Dati storici (quantità klines)
        console.log('\n📈 DATI STORICI (Quantità Klines):');
        console.log(`   Simboli verificati: ${result.symbolsChecked || 0}`);
        console.log(`   Simboli OK: ${result.symbolsOK || 0}`);
        console.log(`   Simboli con problemi: ${result.symbolsWithIssues || 0}`);
        console.log(`   Minimo richiesto: ${result.minRequired || 50} klines per simbolo`);
        console.log(`   Media klines per simbolo: ${result.avgKlinesPerSymbol || 0}`);

        // Dettagli simboli con problemi
        if (result.details && result.details.length > 0) {
            console.log('\n⚠️  SIMBOLI CON PROBLEMI:');
            result.details.forEach((detail, idx) => {
                console.log(`\n   ${idx + 1}. ${detail.symbol}:`);
                if (detail.count !== undefined) {
                    console.log(`      - Klines attuali: ${detail.count}`);
                    console.log(`      - Richieste: ${detail.required}`);
                    console.log(`      - Mancanti: ${detail.missing}`);
                } else if (detail.error) {
                    console.log(`      - Errore: ${detail.error}`);
                }
            });
        } else {
            console.log('\n✅ Nessun simbolo con problemi!');
        }

        // Riepilogo
        console.log('\n' + '='.repeat(80));
        console.log('\n📋 RIEPILOGO:\n');
        
        const issues = [];
        if (!result.working) {
            issues.push('Servizio aggregatore non sta creando nuove klines');
        }
        if (result.symbolsWithIssues > 0) {
            issues.push(`${result.symbolsWithIssues} simboli hanno meno di ${result.minRequired} klines`);
        }

        if (issues.length === 0) {
            console.log('✅ TUTTO OK!');
            console.log('   • Servizio aggregatore funziona correttamente');
            console.log('   • Tutti i simboli hanno dati sufficienti');
        } else {
            console.log('❌ PROBLEMI RILEVATI:');
            issues.forEach((issue, idx) => {
                console.log(`   ${idx + 1}. ${issue}`);
            });
        }

        // Performance
        console.log('\n⚡ PERFORMANCE:');
        console.log(`   Tempo esecuzione: ${duration}ms`);
        console.log(`   Query database: ~2 query aggregate (ottimizzato)`);

        console.log('\n' + '='.repeat(80));
        console.log('\n✅ Test completato\n');

        // Chiudi connessioni database
        try {
            const { pool } = require('../crypto_db');
            if (pool && pool.end) {
                await pool.end();
            }
        } catch (e) {
            // Ignora errori di chiusura
        }

        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERRORE durante il test:');
        console.error('   Messaggio:', error.message);
        console.error('   Stack:', error.stack);
        process.exit(1);
    }
}

// Esegui il test
testAggregatorCheck();

