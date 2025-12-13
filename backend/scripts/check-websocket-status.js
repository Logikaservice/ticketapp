/**
 * Script per verificare lo stato del WebSocket e del database
 */

const cryptoDb = require('../crypto_db');
const { dbAll, dbGet } = cryptoDb;

async function checkWebSocketStatus() {
    console.log('🔍 VERIFICA STATO WEBSOCKET E DATABASE');
    console.log('=====================================');
    console.log('');
    
    try {
        await cryptoDb.initDb();
        console.log('✅ Database connesso');
        console.log('');
        
        // 1. Controlla prezzi nel database
        console.log('1️⃣ Controllo price_history...');
        const priceCount = await dbGet("SELECT COUNT(*) as count FROM price_history WHERE timestamp > NOW() - INTERVAL '1 hour'");
        console.log(`   📊 Prezzi nelle ultime 1 ora: ${priceCount?.count || 0}`);
        
        const recentPrices = await dbAll("SELECT symbol, price, timestamp FROM price_history ORDER BY timestamp DESC LIMIT 10");
        if (recentPrices.length > 0) {
            console.log('   ✅ Ultimi 10 prezzi salvati:');
            recentPrices.forEach(p => {
                console.log(`      ${p.symbol}: $${parseFloat(p.price).toFixed(6)} (${p.timestamp})`);
            });
        } else {
            console.log('   ⚠️  Nessun prezzo nelle ultime 1 ora');
        }
        console.log('');
        
        // 2. Controlla volumi nel database
        console.log('2️⃣ Controllo symbol_volumes_24h...');
        const volumeCount = await dbGet("SELECT COUNT(*) as count FROM symbol_volumes_24h WHERE updated_at > NOW() - INTERVAL '1 hour'");
        console.log(`   📊 Volumi aggiornati nelle ultime 1 ora: ${volumeCount?.count || 0}`);
        
        const recentVolumes = await dbAll("SELECT symbol, volume_24h, updated_at FROM symbol_volumes_24h ORDER BY updated_at DESC LIMIT 10");
        if (recentVolumes.length > 0) {
            console.log('   ✅ Ultimi 10 volumi salvati:');
            recentVolumes.forEach(v => {
                console.log(`      ${v.symbol}: $${parseFloat(v.volume_24h).toLocaleString('it-IT')} (${v.updated_at})`);
            });
        } else {
            console.log('   ⚠️  Nessun volume aggiornato nelle ultime 1 ora');
        }
        console.log('');
        
        // 3. Controlla klines
        console.log('3️⃣ Controllo klines...');
        const klinesCount = await dbGet("SELECT COUNT(*) as count FROM klines WHERE open_time > EXTRACT(EPOCH FROM NOW() - INTERVAL '1 hour') * 1000");
        console.log(`   📊 Klines nelle ultime 1 ora: ${klinesCount?.count || 0}`);
        
        const recentKlines = await dbAll(`
            SELECT symbol, close_price, open_time 
            FROM klines 
            WHERE open_time > EXTRACT(EPOCH FROM NOW() - INTERVAL '1 hour') * 1000
            ORDER BY open_time DESC 
            LIMIT 10
        `);
        if (recentKlines.length > 0) {
            console.log('   ✅ Ultime 10 klines:');
            recentKlines.forEach(k => {
                const date = new Date(parseInt(k.open_time));
                console.log(`      ${k.symbol}: $${parseFloat(k.close_price).toFixed(6)} (${date.toISOString()})`);
            });
        } else {
            console.log('   ⚠️  Nessuna kline nelle ultime 1 ora');
        }
        console.log('');
        
        // 4. Diagnostica
        console.log('4️⃣ DIAGNOSTICA:');
        if ((priceCount?.count || 0) === 0 && (volumeCount?.count || 0) === 0) {
            console.log('   ⚠️  PROBLEMA: WebSocket non sta salvando dati nel database');
            console.log('   💡 Possibili cause:');
            console.log('      - WebSocket non connesso');
            console.log('      - Errori nel salvataggio DB (verifica log backend)');
            console.log('      - Database non accessibile');
            console.log('   💡 Soluzione:');
            console.log('      - Verifica log: pm2 logs ticketapp-backend --lines 100 | grep WEBSOCKET');
            console.log('      - Riavvia backend: pm2 restart ticketapp-backend');
            console.log('      - Ripopola manualmente: node scripts/repopulate-from-websocket.js');
        } else {
            console.log('   ✅ WebSocket sta salvando dati nel database');
        }
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error('❌ Stack:', error.stack);
        process.exit(1);
    }
}

if (require.main === module) {
    checkWebSocketStatus()
        .then(() => {
            console.log('');
            console.log('✅ Verifica completata!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Errore:', error);
            process.exit(1);
        });
}

module.exports = checkWebSocketStatus;

