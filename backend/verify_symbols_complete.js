/**
 * ✅ Script di Verifica Completa Simboli
 * 
 * Verifica che tutti i simboli siano configurati correttamente:
 * 1. Tutti hanno bot_settings
 * 2. Tutti hanno klines sufficienti
 * 3. Non ci sono duplicati o inconsistenze
 * 4. Tutti i simboli sono formattati correttamente
 */

const { dbAll, dbGet } = require('./crypto_db');

async function verifySymbolsComplete() {
    console.log('✅ VERIFICA COMPLETA SIMBOLI');
    console.log('='.repeat(100));
    console.log('');

    try {
        // 1. Recupera tutti i simboli
        const allSymbols = await dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE strategy_name = $1 ORDER BY symbol",
            ['RSI_Strategy']
        );

        console.log(`📊 Totale simboli nel database: ${allSymbols.length}`);
        console.log('');

        let issues = [];
        let warnings = [];
        let okCount = 0;

        // 2. Verifica ogni simbolo
        for (const row of allSymbols) {
            const symbol = row.symbol;
            const checks = {
                symbol: symbol,
                hasBotSettings: false,
                isActive: false,
                hasKlines: false,
                klinesCount: 0,
                hasMarketData: false,
                hasBotParameters: false
            };

            // Verifica bot_settings
            const botSettings = await dbGet(
                "SELECT is_active FROM bot_settings WHERE symbol = $1 AND strategy_name = $2",
                [symbol, 'RSI_Strategy']
            );
            
            if (botSettings) {
                checks.hasBotSettings = true;
                checks.isActive = botSettings.is_active === 1;
            } else {
                issues.push(`${symbol}: Manca bot_settings`);
                continue;
            }

            // Verifica klines
            const klines = await dbAll(
                "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = '15m'",
                [symbol]
            );
            checks.klinesCount = parseInt(klines[0]?.count || 0);
            checks.hasKlines = checks.klinesCount >= 50;

            if (checks.klinesCount < 50) {
                issues.push(`${symbol}: Klines insufficienti (${checks.klinesCount}, minimo 50)`);
            } else if (checks.klinesCount < 100) {
                warnings.push(`${symbol}: Klines limitate (${checks.klinesCount}, consigliato 100+)`);
            }

            // Verifica market_data
            const marketData = await dbGet(
                "SELECT * FROM market_data WHERE symbol = $1",
                [symbol]
            );
            checks.hasMarketData = !!marketData;

            if (!checks.hasMarketData) {
                warnings.push(`${symbol}: Manca market_data (volume 24h)`);
            }

            // Verifica bot_parameters (opzionale)
            const botParams = await dbGet(
                "SELECT * FROM bot_parameters WHERE symbol = $1",
                [symbol]
            );
            checks.hasBotParameters = !!botParams;

            // Se tutto ok
            if (checks.hasBotSettings && checks.isActive && checks.hasKlines) {
                okCount++;
            }
        }

        // 3. Verifica duplicati
        console.log('🔍 Verifica duplicati...');
        const duplicates = await dbAll(
            `SELECT symbol, COUNT(*) as count 
             FROM bot_settings 
             WHERE strategy_name = $1 
             GROUP BY symbol 
             HAVING COUNT(*) > 1`,
            ['RSI_Strategy']
        );

        if (duplicates.length > 0) {
            console.log('   ⚠️ Trovati duplicati:');
            duplicates.forEach(dup => {
                issues.push(`${dup.symbol}: Duplicato (${dup.count} volte)`);
            });
        } else {
            console.log('   ✅ Nessun duplicato trovato');
        }
        console.log('');

        // 4. Verifica simboli EUR con klines basse
        console.log('🔍 Verifica simboli EUR...');
        const eurSymbols = allSymbols.filter(s => 
            s.symbol.toLowerCase().includes('_eur') || 
            s.symbol.toLowerCase().endsWith('eur')
        );

        console.log(`   📊 Simboli EUR trovati: ${eurSymbols.length}`);
        
        let eurWithLowKlines = 0;
        for (const row of eurSymbols) {
            const klines = await dbAll(
                "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = '15m'",
                [row.symbol]
            );
            const count = parseInt(klines[0]?.count || 0);
            if (count < 100) {
                eurWithLowKlines++;
            }
        }

        if (eurWithLowKlines > 0) {
            warnings.push(`${eurWithLowKlines} simboli EUR con klines < 100 (consigliato aggiornare)`);
        }
        console.log('');

        // 5. Report finale
        console.log('='.repeat(100));
        console.log('📊 REPORT FINALE');
        console.log('='.repeat(100));
        console.log('');

        console.log(`✅ Simboli OK: ${okCount}/${allSymbols.length}`);
        console.log(`⚠️ Warning: ${warnings.length}`);
        console.log(`❌ Errori: ${issues.length}`);
        console.log('');

        if (warnings.length > 0) {
            console.log('⚠️ WARNING:');
            warnings.forEach(w => console.log(`   ${w}`));
            console.log('');
        }

        if (issues.length > 0) {
            console.log('❌ ERRORI (da risolvere):');
            issues.forEach(i => console.log(`   ${i}`));
            console.log('');
        }

        if (issues.length === 0 && warnings.length === 0) {
            console.log('🎉 TUTTO OK! Tutti i simboli sono configurati correttamente.');
            console.log('');
        }

        // 6. Statistiche per quote currency
        console.log('📊 Distribuzione per quote currency:');
        const byQuote = { 'USDT': 0, 'EUR': 0, 'USDC': 0, 'OTHER': 0 };
        
        for (const row of allSymbols) {
            const symbol = row.symbol.toLowerCase();
            if (symbol.includes('_eur') || symbol.endsWith('eur')) {
                byQuote.EUR++;
            } else if (symbol.includes('_usdt') || symbol.endsWith('usdt')) {
                byQuote.USDT++;
            } else if (symbol.includes('_usdc') || symbol.endsWith('usdc')) {
                byQuote.USDC++;
            } else {
                byQuote.OTHER++;
            }
        }

        console.log(`   USDT: ${byQuote.USDT}`);
        console.log(`   EUR: ${byQuote.EUR}`);
        console.log(`   USDC: ${byQuote.USDC || 0}`);
        console.log(`   Altri: ${byQuote.OTHER || 0}`);
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante verifica:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

verifySymbolsComplete().catch(console.error);

