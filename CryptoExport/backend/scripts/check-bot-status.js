/**
 * Script per verificare lo stato del bot
 * Controlla se il bot è effettivamente attivo o in pausa
 */

const db = require('../crypto_db');

async function checkBotStatus() {
    try {
        console.log('🔍 Verifica stato bot...\n');
        
        // Controlla tutti i bot_settings
        const allBots = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM bot_settings WHERE strategy_name = 'RSI_Strategy'", (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        console.log(`📊 Bot trovati: ${allBots.length}`);
        
        if (allBots.length === 0) {
            console.log('⚠️  NESSUN BOT CONFIGURATO nel database!');
            console.log('   → Il bot non può funzionare senza entry in bot_settings');
            return;
        }
        
        const activeBots = allBots.filter(b => b.is_active === 1);
        const pausedBots = allBots.filter(b => b.is_active === 0);
        
        console.log(`\n✅ Bot ATTIVI: ${activeBots.length}`);
        activeBots.forEach(bot => {
            console.log(`   • ${bot.symbol}: ACTIVE (is_active = ${bot.is_active})`);
        });
        
        console.log(`\n⏸️  Bot IN PAUSA: ${pausedBots.length}`);
        pausedBots.forEach(bot => {
            console.log(`   • ${bot.symbol}: PAUSED (is_active = ${bot.is_active})`);
        });
        
        // Controlla posizioni aperte
        const openPositions = await new Promise((resolve, reject) => {
            db.all("SELECT COUNT(*) as count FROM open_positions WHERE status = 'open'", (err, row) => {
                if (err) reject(err);
                else resolve(row[0]?.count || 0);
            });
        });
        
        console.log(`\n📈 Posizioni aperte: ${openPositions}`);
        
        // Verifica se il bot può aprire nuove posizioni
        if (activeBots.length === 0) {
            console.log('\n🛑 STATO: Bot IN PAUSA');
            console.log('   → Il bot NON può aprire nuove posizioni');
            console.log('   → Il bot continua ad aggiornare dati (prezzi, klines) per monitoraggio');
            console.log('   → Le posizioni esistenti continuano ad essere aggiornate (P&L, SmartExit)');
        } else {
            console.log('\n✅ STATO: Bot ATTIVO');
            console.log('   → Il bot può aprire nuove posizioni');
            console.log('   → Il bot processa segnali e gestisce posizioni');
        }
        
        // Verifica se SmartExit è attivo (funziona sempre, anche se bot in pausa)
        console.log('\n🔍 SmartExit System:');
        console.log('   → Sempre ATTIVO (anche se bot in pausa)');
        console.log('   → Gestisce chiusura posizioni esistenti');
        console.log('   → Monitora trailing stop, take profit, etc.');
        
    } catch (err) {
        console.error('❌ Errore:', err.message);
    } finally {
        db.close();
    }
}

checkBotStatus();
