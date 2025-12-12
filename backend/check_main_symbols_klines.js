/**
 * 🔍 Riepilogo Klines per Simboli Principali
 */

const { dbAll } = require('./crypto_db');

async function checkMainSymbols() {
    console.log(`\n📊 RIEPILOGO KLINES SIMBOLI PRINCIPALI`);
    console.log('='.repeat(70));
    
    try {
        // Simboli con più di 1000 klines (quelli attivamente monitorati)
        const mainSymbols = await dbAll(
            `SELECT symbol, COUNT(*) as klines_count,
                    MIN(open_time) as first_kline,
                    MAX(open_time) as last_kline
             FROM klines 
             WHERE interval = '15m'
             GROUP BY symbol
             HAVING COUNT(*) > 1000
             ORDER BY klines_count DESC`
        );
        
        console.log(`\n✅ Simboli con >1000 klines (attivi):`);
        mainSymbols.forEach(row => {
            const first = new Date(parseInt(row.first_kline));
            const last = new Date(parseInt(row.last_kline));
            const daysOfData = Math.floor((last - first) / (1000 * 60 * 60 * 24));
            console.log(`   ${row.symbol.padEnd(20)}: ${row.klines_count.toString().padStart(5)} klines (~${daysOfData} giorni di dati)`);
        });
        
        // Verifica se esiste chainlink vs LINKUSDT
        const chainlinkVariants = await dbAll(
            `SELECT symbol, COUNT(*) as count
             FROM klines 
             WHERE symbol LIKE '%link%' OR symbol LIKE '%LINK%'
             GROUP BY symbol`
        );
        
        if (chainlinkVariants.length > 0) {
            console.log(`\n🔗 Varianti LINK nel database:`);
            chainlinkVariants.forEach(row => {
                console.log(`   ${row.symbol}: ${row.count} klines`);
            });
        }
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
    }
}

checkMainSymbols().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
