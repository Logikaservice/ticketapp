/**
 * Script veloce per contare i simboli nel sistema
 */

const { dbAll, dbGet } = require('../crypto_db');

async function countSymbols() {
    try {
        console.log('🔍 CONTEGGIO SIMBOLI NEL SISTEMA\n');
        console.log('='.repeat(70));

        // 1. Simboli in bot_settings
        console.log('📊 1. Simboli in bot_settings:');
        const botSettingsSymbols = await dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE symbol != 'global' ORDER BY symbol"
        );
        console.log(`   ✅ Totale: ${botSettingsSymbols.length} simboli`);
        console.log(`   Simboli: ${botSettingsSymbols.map(s => s.symbol).join(', ')}\n`);

        // 2. Simboli con klines nel database
        console.log('📊 2. Simboli con klines nel database:');
        const klinesSymbols = await dbAll(
            "SELECT DISTINCT symbol, COUNT(*) as count FROM klines GROUP BY symbol ORDER BY symbol"
        );
        console.log(`   ✅ Totale: ${klinesSymbols.length} simboli`);
        if (klinesSymbols.length > 0) {
            console.log(`   Top 10 per numero di klines:`);
            klinesSymbols
                .sort((a, b) => parseInt(b.count) - parseInt(a.count))
                .slice(0, 10)
                .forEach(s => {
                    console.log(`      - ${s.symbol}: ${parseInt(s.count).toLocaleString()} klines`);
                });
        }
        console.log('');

        // 3. Simboli attivi (is_active = 1)
        console.log('📊 3. Simboli attivi nel bot:');
        const activeSymbols = await dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE symbol != 'global' AND is_active = 1 ORDER BY symbol"
        );
        console.log(`   ✅ Totale: ${activeSymbols.length} simboli attivi`);
        if (activeSymbols.length > 0 && activeSymbols.length <= 20) {
            console.log(`   Simboli: ${activeSymbols.map(s => s.symbol).join(', ')}`);
        }
        console.log('');

        // 4. Simboli con almeno 5000 klines
        console.log('📊 4. Simboli con almeno 5000 klines (15m):');
        const symbolsWith5000 = await dbAll(
            `SELECT symbol, COUNT(*) as count 
             FROM klines 
             WHERE interval = '15m'
             GROUP BY symbol 
             HAVING COUNT(*) >= 5000
             ORDER BY count DESC`
        );
        console.log(`   ✅ Totale: ${symbolsWith5000.length} simboli`);
        if (symbolsWith5000.length > 0) {
            symbolsWith5000.forEach(s => {
                console.log(`      - ${s.symbol}: ${parseInt(s.count).toLocaleString()} klines`);
            });
        }
        console.log('');

        // 5. Riepilogo
        console.log('='.repeat(70));
        console.log('📋 RIEPILOGO:');
        console.log(`   • Simboli in bot_settings: ${botSettingsSymbols.length}`);
        console.log(`   • Simboli con klines: ${klinesSymbols.length}`);
        console.log(`   • Simboli attivi: ${activeSymbols.length}`);
        console.log(`   • Simboli con ≥5000 klines: ${symbolsWith5000.length}`);
        console.log('');

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

countSymbols();

