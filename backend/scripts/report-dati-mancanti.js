/**
 * 📊 REPORT CONCISO DATI MANCANTI
 * 
 * Report semplificato che mostra solo i problemi principali
 */

const { dbAll, dbGet } = require('../crypto_db');

const KLINE_INTERVAL = '15m';
const MIN_KLINES_REQUIRED = 50;

async function main() {
    try {
        console.log('\n' + '='.repeat(70));
        console.log('📊 REPORT DATI MANCANTI NEL DATABASE');
        console.log('='.repeat(70) + '\n');

        // 1. Simboli attivi
        const activeSymbols = await dbAll(`SELECT symbol FROM bot_settings WHERE is_active = 1`);
        console.log(`🔴 SIMBOLI ATTIVI (${activeSymbols.length}):`);
        for (const { symbol } of activeSymbols) {
            const klinesCount = await dbGet(
                `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2`,
                [symbol, KLINE_INTERVAL]
            );
            const count = parseInt(klinesCount?.count || 0);
            const status = count >= MIN_KLINES_REQUIRED ? '✅' : '❌';
            console.log(`   ${status} ${symbol}: ${count} klines`);
        }

        // 2. Simboli con pochi dati (< 50 klines)
        const lowDataSymbols = await dbAll(
            `SELECT symbol, COUNT(*) as count 
             FROM klines 
             WHERE interval = $1 
             GROUP BY symbol 
             HAVING COUNT(*) < $2 
             ORDER BY COUNT(*) ASC`,
            [KLINE_INTERVAL, MIN_KLINES_REQUIRED]
        );
        
        if (lowDataSymbols.length > 0) {
            console.log(`\n⚠️  SIMBOLI CON POCHI DATI (${lowDataSymbols.length}):`);
            lowDataSymbols.slice(0, 20).forEach(s => {
                console.log(`   • ${s.symbol}: ${parseInt(s.count)} klines`);
            });
            if (lowDataSymbols.length > 20) {
                console.log(`   ... e altri ${lowDataSymbols.length - 20} simboli`);
            }
        }

        // 3. Gap recenti (ultimi 7 giorni)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const symbolsWithRecentData = await dbAll(
            `SELECT DISTINCT symbol FROM klines WHERE interval = $1 AND open_time >= $2`,
            [KLINE_INTERVAL, sevenDaysAgo]
        );
        
        const allSymbols = await dbAll(`SELECT DISTINCT symbol FROM klines WHERE interval = $1`, [KLINE_INTERVAL]);
        const symbolsWithoutRecentData = allSymbols.filter(s => 
            !symbolsWithRecentData.some(rs => rs.symbol === s.symbol)
        );

        if (symbolsWithoutRecentData.length > 0) {
            console.log(`\n⚠️  SIMBOLI SENZA DATI RECENTI (ultimi 7 giorni) (${symbolsWithoutRecentData.length}):`);
            symbolsWithoutRecentData.slice(0, 15).forEach(s => {
                console.log(`   • ${s.symbol}`);
            });
            if (symbolsWithoutRecentData.length > 15) {
                console.log(`   ... e altri ${symbolsWithoutRecentData.length - 15} simboli`);
            }
        }

        // 4. Simboli principali con gap
        const mainSymbols = ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 'chainlink'];
        console.log(`\n📈 SIMBOLI PRINCIPALI - STATO DATI:`);
        for (const symbol of mainSymbols) {
            const klinesCount = await dbGet(
                `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2`,
                [symbol, KLINE_INTERVAL]
            );
            const count = parseInt(klinesCount?.count || 0);
            
            const recentCount = await dbGet(
                `SELECT COUNT(*) as count FROM klines 
                 WHERE symbol = $1 AND interval = $2 AND open_time >= $3`,
                [symbol, KLINE_INTERVAL, sevenDaysAgo]
            );
            const recent = parseInt(recentCount?.count || 0);
            const expectedRecent = 7 * 24 * 4; // 7 giorni * 24 ore * 4 candele/ora
            const coverage = (recent / expectedRecent * 100).toFixed(1);
            
            const lastKline = await dbGet(
                `SELECT open_time FROM klines 
                 WHERE symbol = $1 AND interval = $2 
                 ORDER BY open_time DESC LIMIT 1`,
                [symbol, KLINE_INTERVAL]
            );
            
            let lastDate = 'N/A';
            if (lastKline) {
                const lastTime = parseInt(lastKline.open_time);
                const hoursAgo = (Date.now() - lastTime) / (1000 * 60 * 60);
                lastDate = `${hoursAgo.toFixed(1)} ore fa`;
            }
            
            const status = count >= MIN_KLINES_REQUIRED && parseFloat(coverage) > 80 ? '✅' : '⚠️';
            console.log(`   ${status} ${symbol}: ${count.toLocaleString()} klines | Ultimi 7g: ${recent}/${expectedRecent} (${coverage}%) | Ultimo: ${lastDate}`);
        }

        // 5. Klines anomale
        const anomalousCount = await dbGet(
            `SELECT COUNT(*) as count FROM klines 
             WHERE interval = $1 
             AND (open_price > 100000 OR open_price < 0.000001 
                  OR high_price > 100000 OR high_price < 0.000001
                  OR low_price > 100000 OR low_price < 0.000001
                  OR close_price > 100000 OR close_price < 0.000001
                  OR high_price < low_price OR close_price > high_price OR close_price < low_price)`,
            [KLINE_INTERVAL]
        );
        const anomalous = parseInt(anomalousCount?.count || 0);
        
        if (anomalous > 0) {
            console.log(`\n⚠️  KLINES ANOMALE TROVATE: ${anomalous.toLocaleString()}`);
            console.log(`   Esegui: node backend/scripts/clean-anomalous-prices.js`);
        }

        // 6. Raccomandazioni
        console.log(`\n💡 RACCOMANDAZIONI:`);
        
        const activeWithoutData = activeSymbols.filter(async s => {
            const count = await dbGet(
                `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2`,
                [s.symbol, KLINE_INTERVAL]
            );
            return parseInt(count?.count || 0) < MIN_KLINES_REQUIRED;
        });
        
        if (activeSymbols.length > 0 && parseInt((await dbGet(
            `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2`,
            [activeSymbols[0].symbol, KLINE_INTERVAL]
        ))?.count || 0) < MIN_KLINES_REQUIRED) {
            console.log(`   1. ⚠️  Il simbolo attivo "${activeSymbols[0].symbol}" non ha dati!`);
            console.log(`      → Attiva un simbolo con dati (es. bitcoin, ethereum)`);
        }
        
        if (anomalous > 0) {
            console.log(`   2. Pulisci klines anomale: node backend/scripts/clean-anomalous-prices.js`);
        }
        
        if (symbolsWithoutRecentData.length > 0) {
            console.log(`   3. Scarica dati recenti mancanti per ${symbolsWithoutRecentData.length} simboli`);
            console.log(`      → Usa: backend/scripts/repopulate-from-websocket.js`);
            console.log(`      → Oppure: backend/klines_recovery_daemon.js`);
        }

        console.log('\n' + '='.repeat(70) + '\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    }
}

main();


