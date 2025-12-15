/**
 * Script di diagnostica per KlinesAggregatorService
 * Verifica: simboli in price_history, validazione, caricamento isValidSymbol
 */

const { dbAll, pool } = require('../crypto_db');

async function diagnostica() {
    const client = await pool.connect();
    try {
        console.log('🔍 DIAGNOSTICA KLINES AGGREGATOR\n');
        console.log('='.repeat(60));

        // 1. Verifica connessione
        await client.query('SELECT 1');
        console.log('✅ Connessione database OK\n');

        // 2. Verifica caricamento isValidSymbol
        console.log('📦 Test caricamento isValidSymbol...');
        let isValidSymbol = null;
        try {
            const cryptoRoutes = require('../routes/cryptoRoutes');
            if (cryptoRoutes.isValidSymbol && typeof cryptoRoutes.isValidSymbol === 'function') {
                isValidSymbol = cryptoRoutes.isValidSymbol;
                console.log('✅ isValidSymbol caricato correttamente da cryptoRoutes');
            } else {
                console.log('❌ isValidSymbol NON trovato in cryptoRoutes');
            }
        } catch (error) {
            console.log(`❌ Errore caricamento isValidSymbol: ${error.message}`);
        }

        // 3. Verifica SYMBOL_TO_PAIR
        console.log('\n📋 Verifica SYMBOL_TO_PAIR...');
        try {
            const cryptoRoutes = require('../routes/cryptoRoutes');
            const SYMBOL_TO_PAIR = cryptoRoutes.SYMBOL_TO_PAIR || {};
            const symbolCount = Object.keys(SYMBOL_TO_PAIR).length;
            console.log(`✅ SYMBOL_TO_PAIR contiene ${symbolCount} simboli`);
            
            // Mostra alcuni esempi
            const examples = Object.keys(SYMBOL_TO_PAIR).slice(0, 10);
            console.log(`   Esempi: ${examples.join(', ')}`);
        } catch (error) {
            console.log(`❌ Errore accesso SYMBOL_TO_PAIR: ${error.message}`);
        }

        // 4. Verifica simboli in price_history (ultimi 30 minuti)
        console.log('\n📊 Simboli in price_history (ultimi 30 minuti)...');
        const recentSymbols = await client.query(
            `SELECT DISTINCT symbol, COUNT(*) as count, 
                    MIN(timestamp) as first_price, 
                    MAX(timestamp) as last_price
             FROM price_history 
             WHERE timestamp > NOW() - INTERVAL '30 minutes'
             GROUP BY symbol 
             ORDER BY count DESC 
             LIMIT 20`
        );

        if (recentSymbols.rows.length === 0) {
            console.log('⚠️  NESSUN simbolo con dati negli ultimi 30 minuti!');
            console.log('   Questo spiega perché l\'aggregatore trova 0 simboli.');
        } else {
            console.log(`✅ Trovati ${recentSymbols.rows.length} simboli con dati recenti:\n`);
            
            let validCount = 0;
            let invalidCount = 0;
            
            for (const row of recentSymbols.rows) {
                const symbol = row.symbol;
                const isValid = isValidSymbol ? isValidSymbol(symbol) : false;
                const status = isValid ? '✅' : '❌';
                
                if (isValid) validCount++;
                else invalidCount++;
                
                console.log(`   ${status} ${symbol.padEnd(20)} | ${row.count.toString().padStart(6)} prezzi | Valid: ${isValid}`);
            }
            
            console.log(`\n📈 Riepilogo:`);
            console.log(`   • Simboli validi: ${validCount}`);
            console.log(`   • Simboli non validi: ${invalidCount}`);
            console.log(`   • Totale: ${recentSymbols.rows.length}`);
        }

        // 5. Verifica simboli in price_history (tutti)
        console.log('\n📊 Tutti i simboli in price_history...');
        const allSymbols = await client.query(
            `SELECT DISTINCT symbol, COUNT(*) as count
             FROM price_history 
             GROUP BY symbol 
             ORDER BY count DESC 
             LIMIT 30`
        );

        if (allSymbols.rows.length > 0) {
            console.log(`✅ Trovati ${allSymbols.rows.length} simboli totali nel database:\n`);
            
            let validCount = 0;
            let invalidCount = 0;
            const invalidSymbols = [];
            
            for (const row of allSymbols.rows) {
                const symbol = row.symbol;
                const isValid = isValidSymbol ? isValidSymbol(symbol) : false;
                
                if (isValid) validCount++;
                else {
                    invalidCount++;
                    invalidSymbols.push(symbol);
                }
            }
            
            console.log(`   • Simboli validi: ${validCount}`);
            console.log(`   • Simboli non validi: ${invalidCount}`);
            
            if (invalidSymbols.length > 0 && invalidSymbols.length <= 20) {
                console.log(`\n   Simboli non validi trovati: ${invalidSymbols.join(', ')}`);
            }
        }

        // 6. Test validazione su alcuni simboli comuni
        console.log('\n🧪 Test validazione simboli comuni...');
        const testSymbols = ['bitcoin', 'bitcoin_eur', 'ethereum', 'ethereum_eur', 'solana_eur', 'xlm_eur', 'sui_eur', 'shiba_eur', 'litecoin', 'trx_eur', 'vet', 'algo'];
        
        for (const symbol of testSymbols) {
            const isValid = isValidSymbol ? isValidSymbol(symbol) : false;
            const status = isValid ? '✅' : '❌';
            console.log(`   ${status} ${symbol.padEnd(20)} -> ${isValid}`);
        }

        // 7. Verifica klines esistenti
        console.log('\n📈 Klines esistenti nel database...');
        const klinesCount = await client.query(
            `SELECT COUNT(*) as count, 
                    COUNT(DISTINCT symbol) as symbols,
                    MIN(open_time) as first_kline,
                    MAX(open_time) as last_kline
             FROM klines`
        );
        
        const klines = klinesCount.rows[0];
        if (klines.count > 0) {
            console.log(`✅ Trovate ${klines.count} klines per ${klines.symbols} simboli`);
            if (klines.first_kline && klines.last_kline) {
                const firstDate = new Date(Number(klines.first_kline));
                const lastDate = new Date(Number(klines.last_kline));
                console.log(`   Prima kline: ${firstDate.toISOString()}`);
                console.log(`   Ultima kline: ${lastDate.toISOString()}`);
            }
        } else {
            console.log('⚠️  Nessuna kline nel database');
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Diagnostica completata\n');

        client.release();
        process.exit(0);
    } catch (error) {
        if (client) client.release();
        console.error('❌ Errore:', error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

diagnostica();
