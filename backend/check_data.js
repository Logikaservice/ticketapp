/**
 * Script per verificare i dati disponibili nel database
 */

const { dbAll, dbGet } = require('./crypto_db');

async function checkData() {
    try {
        console.log('🔍 Verifica dati disponibili nel database...\n');

        // Conta totale candele
        const totalCount = await dbGet('SELECT COUNT(*) as count FROM klines');
        console.log(`📊 Totale candele nel DB: ${totalCount.count}`);

        // Simboli disponibili
        const symbols = await dbAll('SELECT DISTINCT symbol FROM klines');
        console.log(`\n💎 Simboli disponibili: ${symbols.length}`);
        symbols.forEach(s => console.log(`   - ${s.symbol}`));

        // Per ogni simbolo, mostra range temporale e conteggio
        console.log('\n📅 Range temporale per simbolo:');
        for (const sym of symbols) {
            const stats = await dbGet(
                `SELECT 
                    COUNT(*) as count,
                    MIN(open_time) as first_candle,
                    MAX(open_time) as last_candle
                 FROM klines 
                 WHERE symbol = ?`,
                [sym.symbol]
            );

            const firstDate = new Date(Number(stats.first_candle));
            const lastDate = new Date(Number(stats.last_candle));
            const daysSpan = (Number(stats.last_candle) - Number(stats.first_candle)) / (1000 * 60 * 60 * 24);

            console.log(`\n   ${sym.symbol}:`);
            console.log(`      Candele: ${stats.count}`);
            console.log(`      Prima: ${firstDate.toISOString()}`);
            console.log(`      Ultima: ${lastDate.toISOString()}`);
            console.log(`      Giorni coperti: ${daysSpan.toFixed(1)}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    }
}

checkData();
