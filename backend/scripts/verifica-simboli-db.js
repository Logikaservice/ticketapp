/**
 * Script rapido per vedere quali simboli ci sono nel database
 */

const { dbAll, dbGet } = require('../crypto_db');

async function main() {
    try {
        console.log('🔍 Verifica simboli nel database...\n');

        // Simboli in bot_settings
        const botSettings = await dbAll(`SELECT symbol, is_active FROM bot_settings ORDER BY symbol`);
        console.log(`📊 Simboli in bot_settings: ${botSettings.length}`);
        botSettings.forEach(s => {
            console.log(`   ${s.is_active ? '✅' : '⏸️ '} ${s.symbol} (attivo: ${s.is_active})`);
        });

        // Simboli in klines
        const klinesSymbols = await dbAll(`SELECT DISTINCT symbol, COUNT(*) as count FROM klines GROUP BY symbol ORDER BY count DESC`);
        console.log(`\n📊 Simboli in klines: ${klinesSymbols.length}`);
        klinesSymbols.forEach(s => {
            console.log(`   • ${s.symbol}: ${parseInt(s.count).toLocaleString()} klines`);
        });

        // Simboli in price_history
        const priceHistorySymbols = await dbAll(`SELECT DISTINCT symbol, COUNT(*) as count FROM price_history GROUP BY symbol ORDER BY count DESC`);
        console.log(`\n📊 Simboli in price_history: ${priceHistorySymbols.length}`);
        priceHistorySymbols.forEach(s => {
            console.log(`   • ${s.symbol}: ${parseInt(s.count).toLocaleString()} record`);
        });

        // Totale klines
        const totalKlines = await dbGet(`SELECT COUNT(*) as count FROM klines`);
        console.log(`\n📊 Totale klines nel database: ${totalKlines?.count || 0}`);

        // Totale price_history
        const totalPriceHistory = await dbGet(`SELECT COUNT(*) as count FROM price_history`);
        console.log(`📊 Totale price_history nel database: ${totalPriceHistory?.count || 0}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    }
}

main();

