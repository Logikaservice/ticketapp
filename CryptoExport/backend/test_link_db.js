/**
 * Query diretta per verificare simboli con 'link'
 */
const { dbAll } = require('./crypto_db');

async function checkLink() {
    try {
        const result = await dbAll(
            `SELECT symbol, COUNT(*) as count 
             FROM klines 
             WHERE LOWER(symbol) LIKE '%link%'
             GROUP BY symbol
             ORDER BY count DESC`
        );
        
        console.log('\n🔗 Simboli LINK trovati:');
        result.forEach(r => {
            console.log(`   ${r.symbol}: ${r.count} klines`);
        });
        
        // Test anche chainlink_usdt
        const chainlinkUsdt = await dbAll(
            `SELECT COUNT(*) as count FROM klines WHERE symbol = 'chainlink_usdt' AND interval = '15m'`
        );
        console.log(`\n📊 chainlink_usdt specifico: ${chainlinkUsdt[0].count} klines`);
        
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkLink().then(() => process.exit(0));
