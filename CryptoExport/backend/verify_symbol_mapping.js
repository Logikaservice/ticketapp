/**
 * Verifica mapping simboli Database <-> Market Scanner
 */

const { dbAll } = require('./crypto_db');

async function checkSymbolMapping() {
    console.log('\n🔍 VERIFICA MAPPING SIMBOLI DATABASE vs UI');
    console.log('='.repeat(70));
    
    try {
        // 1. Simboli con klines nel database
        const dbSymbols = await dbAll(
            `SELECT DISTINCT symbol FROM klines WHERE interval = '15m'`
        );
        
        console.log(`\n📊 Simboli nel DATABASE (${dbSymbols.length}):`);
        dbSymbols.forEach(row => {
            console.log(`   - ${row.symbol}`);
        });
        
        // 2. Simboli nel Market Scanner (quello che la UI cerca)
        const marketScannerSymbols = [
            'BTCUSDT',    // Bitcoin
            'ETHUSDT',    // Ethereum
            'SOLUSDT',    // Solana
            'ADAUSDT',    // Cardano
            'DOTUSDT',    // Polkadot
            'LINKUSDT',   // Chainlink
            'LTCUSDT',    // Litecoin
            'XRPUSDT',    // Ripple
            'DOGEUSDT',   // Dogecoin
            'ATOMUSDT',   // Cosmos
            'AVAXUSDT',   // Avalanche
            'FILUSDT',    // Filecoin
            'TRXUSDT',    // Tron
            'UNIUSDT',    // Uniswap
            'AAVEUSDT',   // Aave
        ];
        
        console.log(`\n🎯 Simboli che MARKET SCANNER cerca (${marketScannerSymbols.length}):`);
        marketScannerSymbols.forEach(symbol => {
            console.log(`   - ${symbol}`);
        });
        
        // 3. Verifica corrispondenze
        console.log(`\n🔄 MAPPING VERIFICATO:`);
        
        const mappingTable = {
            'BTCUSDT': ['bitcoin', 'bitcoin_usdt', 'btc'],
            'ETHUSDT': ['ethereum', 'ethereum_usdt', 'eth'],
            'SOLUSDT': ['solana', 'solana_usdt', 'sol'],
            'ADAUSDT': ['cardano', 'cardano_usdt', 'ada'],
            'DOTUSDT': ['polkadot', 'polkadot_usdt', 'dot'],
            'LINKUSDT': ['chainlink', 'chainlink_usdt', 'link'],
            'LTCUSDT': ['litecoin', 'litecoin_usdt', 'ltc'],
            'XRPUSDT': ['ripple', 'ripple_usdt', 'xrp'],
            'DOGEUSDT': ['dogecoin', 'dogecoin_usdt', 'doge'],
        };
        
        const dbSymbolsLower = dbSymbols.map(s => s.symbol.toLowerCase());
        
        for (const [uiSymbol, possibleDbNames] of Object.entries(mappingTable)) {
            const found = possibleDbNames.find(dbName => dbSymbolsLower.includes(dbName));
            if (found) {
                console.log(`   ✅ ${uiSymbol.padEnd(15)} → DB: ${found}`);
            } else {
                console.log(`   ❌ ${uiSymbol.padEnd(15)} → DB: NON TROVATO (cercava: ${possibleDbNames.join(', ')})`);
            }
        }
        
        // 4. Verifica quale simbolo ha effettivamente dati forti
        console.log(`\n\n📊 SIMBOLI CON PIÙ KLINES (top 10):`);
        const topSymbols = await dbAll(
            `SELECT symbol, COUNT(*) as count 
             FROM klines 
             WHERE interval = '15m' 
             GROUP BY symbol 
             ORDER BY count DESC 
             LIMIT 10`
        );
        
        topSymbols.forEach(row => {
            console.log(`   ${row.symbol.padEnd(25)}: ${row.count.toString().padStart(5)} klines`);
        });
        
        // 5. RACCOMANDAZIONE
        console.log(`\n\n💡 RACCOMANDAZIONE:`);
        console.log(`   Il Market Scanner dovrebbe cercare questi simboli DB:`);
        const topDbSymbols = topSymbols.slice(0, 10).map(s => s.symbol);
        topDbSymbols.forEach(symbol => {
            console.log(`   - ${symbol}`);
        });
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
    }
}

checkSymbolMapping().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
