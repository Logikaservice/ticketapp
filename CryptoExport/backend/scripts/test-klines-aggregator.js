/**
 * 🧪 TEST KLINES AGGREGATOR
 * 
 * Testa il servizio di aggregazione klines dal WebSocket
 */

const KlinesAggregatorService = require('../services/KlinesAggregatorService');
const { dbAll, dbGet } = require('../crypto_db');

const log = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    warn: (msg) => console.warn(`⚠️  ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    section: (msg) => console.log(`\n${'='.repeat(80)}\n📊 ${msg}\n${'='.repeat(80)}`)
};

async function testAggregation() {
    try {
        log.section('TEST AGGREGAZIONE KLINES DA WEBSOCKET');

        // 1. Verifica price_history
        log.info('Verifica price_history disponibili...');
        const symbols = await dbAll(
            `SELECT DISTINCT symbol, COUNT(*) as count 
             FROM price_history 
             GROUP BY symbol 
             ORDER BY count DESC 
             LIMIT 10`
        );

        console.log(`\n📊 Simboli con price_history (top 10):`);
        symbols.forEach(s => {
            console.log(`   • ${s.symbol}: ${parseInt(s.count)} record`);
        });

        if (symbols.length === 0) {
            log.error('Nessun price_history trovato');
            log.warn('Il WebSocket deve essere attivo per avere dati da aggregare');
            return;
        }

        // 2. Test aggregazione manuale per primo simbolo
        const testSymbol = symbols[0].symbol;
        log.section(`TEST AGGREGAZIONE MANUALE PER ${testSymbol}`);

        // Calcola ultima finestra temporale completata
        const now = Date.now();
        const currentKlineStart = Math.floor(now / (15 * 60 * 1000)) * (15 * 60 * 1000);
        const previousKlineStart = currentKlineStart - (15 * 60 * 1000);
        const previousKlineEnd = currentKlineStart;

        log.info(`Periodo: ${new Date(previousKlineStart).toISOString()} → ${new Date(previousKlineEnd).toISOString()}`);

        const result = await KlinesAggregatorService.aggregateManual(
            testSymbol,
            previousKlineStart,
            previousKlineEnd
        );

        if (result) {
            log.success('Aggregazione riuscita!');
            console.log(`\n   Kline aggregata da ${result.dataPoints} prezzi:`);
            console.log(`   • Open:  $${result.open.toFixed(2)}`);
            console.log(`   • High:  $${result.high.toFixed(2)}`);
            console.log(`   • Low:   $${result.low.toFixed(2)}`);
            console.log(`   • Close: $${result.close.toFixed(2)}`);
        } else {
            log.warn('Nessun dato disponibile per aggregazione');
        }

        // 3. Verifica klines esistenti
        log.section('KLINES ESISTENTI NEL DATABASE');
        const klinesCount = await dbGet(
            `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = '15m'`,
            [testSymbol]
        );
        console.log(`   • ${testSymbol}: ${klinesCount?.count || 0} klines`);

        // 4. Test aggregazione completa
        log.section('TEST AGGREGAZIONE COMPLETA');
        log.info('Avvio aggregazione per tutti i simboli...');
        await KlinesAggregatorService.aggregateAllSymbols();

        // 5. Verifica risultati
        log.section('VERIFICA RISULTATI');
        const newKlinesCount = await dbGet(
            `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = '15m'`,
            [testSymbol]
        );
        const newCount = parseInt(newKlinesCount?.count || 0);
        const oldCount = parseInt(klinesCount?.count || 0);
        const added = newCount - oldCount;

        if (added > 0) {
            log.success(`Aggiunte ${added} nuove klines per ${testSymbol}`);
        } else if (added === 0) {
            log.info('Nessuna nuova kline aggiunta (normale se già esistente)');
        } else {
            log.warn(`Count diminuito? Old: ${oldCount}, New: ${newCount}`);
        }

        // 6. Status servizio
        log.section('STATUS SERVIZIO');
        const status = KlinesAggregatorService.getStatus();
        console.log(`   • In esecuzione: ${status.isRunning}`);
        console.log(`   • Intervallo: ${status.interval}`);
        console.log(`   • Millisecondi: ${status.intervalMs}`);

        log.success('Test completato!');
        console.log('\n' + '='.repeat(80) + '\n');
        process.exit(0);
    } catch (error) {
        log.error(`Errore test: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

testAggregation();





