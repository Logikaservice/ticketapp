/**
 * 🔍 Verifica quali simboli hanno klines nel database
 */

const { dbAll } = require('./crypto_db');

async function checkSymbolsWithData() {
    console.log(`\n🔍 VERIFICA SIMBOLI CON DATI`);
    console.log('='.repeat(70));
    
    try {
        // Recupera simboli con klines
        const symbolsWithKlines = await dbAll(
            `SELECT symbol, COUNT(*) as klines_count, 
                    MAX(open_time) as last_kline,
                    MIN(open_time) as first_kline
             FROM klines 
             WHERE interval = '15m'
             GROUP BY symbol
             ORDER BY klines_count DESC`
        );
        
        console.log(`\n📊 Simboli con klines (15m):`);
        if (symbolsWithKlines.length === 0) {
            console.log(`   ⚠️ NESSUN SIMBOLO ha klines nel database!`);
            console.log(`\n💡 Il bot deve scaricare i dati storici first.`);
        } else {
            symbolsWithKlines.forEach(row => {
                const lastDate = new Date(row.last_kline).toLocaleString('it-IT');
                console.log(`   ${row.symbol.padEnd(20)}: ${row.klines_count.toString().padStart(5)} klines (ultimo: ${lastDate})`);
            });
        }
        
        // Verifica bot attivi
        const activeBots = await dbAll(
            "SELECT symbol, is_active FROM bot_settings WHERE strategy_name = 'RSI_Strategy'"
        );
        
        console.log(`\n🤖 Bot configurati:`);
        if (activeBots.length === 0) {
            console.log(`   ⚠️ Nessun bot configurato`);
        } else {
            activeBots.forEach(bot => {
                const hasData = symbolsWithKlines.find(s => s.symbol === bot.symbol);
                const status = bot.is_active === 1 ? '✅ ATTIVO' : '❌ DISATTIVO';
                const dataStatus = hasData ? `${hasData.klines_count} klines` : '⚠️ NO DATA';
                console.log(`   ${bot.symbol.padEnd(20)}: ${status.padEnd(12)} | ${dataStatus}`);
            });
        }
        
        // Verifica LINKUSDT specificamente
        console.log(`\n🔍 LINKUSDT Status:`);
        const linkBot = activeBots.find(b => b.symbol === 'LINKUSDT' || b.symbol === 'linkusdt');
        const linkData = symbolsWithKlines.find(s => s.symbol === 'LINKUSDT' || s.symbol === 'linkusdt');
        
        if (!linkBot) {
            console.log(`   ❌ LINKUSDT non è configurato in bot_settings`);
            console.log(`\n💡 Per attivare LINKUSDT:`);
            console.log(`   INSERT INTO bot_settings (symbol, strategy_name, is_active)`);
            console.log(`   VALUES ('LINKUSDT', 'RSI_Strategy', 1);`);
        } else {
            console.log(`   Bot: ${linkBot.is_active === 1 ? '✅ Attivo' : '❌ Disattivo'}`);
        }
        
        if (!linkData) {
            console.log(`   Dati: ❌ Nessun kline disponibile`);
            console.log(`\n💡 Il bot scaricherà i dati automaticamente al prossimo ciclo se è attivo`);
        } else {
            console.log(`   Dati: ✅ ${linkData.klines_count} klines disponibili`);
        }
        
    } catch (error) {
        console.error('❌ Errore:', error.message);
    }
}

checkSymbolsWithData().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
