/**
 * 🔄 RESET COMPLETO SISTEMA TRADING
 * 
 * Resetta completamente il sistema di trading:
 * - Chiude tutte le posizioni aperte
 * - Cancella tutti i trade history
 * - Resetta portfolio a valore iniziale
 * - Mantiene bot settings e klines (dati storici)
 * 
 * Uso: node backend/scripts/reset-trading-system.js [balance]
 * Esempio: node backend/scripts/reset-trading-system.js 10000
 */

const { dbAll, dbGet, dbRun } = require('../crypto_db');

const DEFAULT_BALANCE = 10000; // Default $10,000 USDT

async function resetTradingSystem(customBalance = null) {
    console.log('🔄 RESET COMPLETO SISTEMA TRADING');
    console.log('='.repeat(60));
    
    try {
        const targetBalance = customBalance || DEFAULT_BALANCE;
        
        // 1. Verifica stato attuale
        console.log('\n📊 1. Verifica stato attuale...');
        const portfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");
        const openPositions = await dbAll("SELECT COUNT(*) as count FROM open_positions WHERE status = 'open'");
        const closedPositions = await dbAll("SELECT COUNT(*) as count FROM open_positions WHERE status IN ('closed', 'stopped', 'taken')");
        const trades = await dbAll("SELECT COUNT(*) as count FROM trades");
        
        console.log(`   Portfolio balance attuale: $${parseFloat(portfolio?.balance_usd || 0).toFixed(2)} USDT`);
        console.log(`   Posizioni aperte: ${openPositions[0]?.count || 0}`);
        console.log(`   Posizioni chiuse: ${closedPositions[0]?.count || 0}`);
        console.log(`   Trade totali: ${trades[0]?.count || 0}`);
        
        // 2. Chiudi tutte le posizioni aperte
        console.log('\n🛑 2. Chiusura posizioni aperte...');
        const positionsToClose = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        
        if (positionsToClose.length > 0) {
            console.log(`   Trovate ${positionsToClose.length} posizioni da chiudere`);
            
            for (const pos of positionsToClose) {
                try {
                    // Chiudi posizione con prezzo corrente
                    const currentPrice = parseFloat(pos.current_price) || parseFloat(pos.entry_price) || 0;
                    
                    await dbRun(
                        `UPDATE open_positions 
                         SET status = 'closed',
                             closed_at = NOW(),
                             close_price = $1,
                             profit_loss = $2,
                             close_reason = 'System Reset'
                         WHERE ticket_id = $3`,
                        [
                            currentPrice,
                            pos.type === 'buy' 
                                ? (currentPrice - parseFloat(pos.entry_price)) * parseFloat(pos.volume)
                                : (parseFloat(pos.entry_price) - currentPrice) * parseFloat(pos.volume),
                            pos.ticket_id
                        ]
                    );
                    
                    console.log(`   ✅ Chiusa posizione ${pos.ticket_id} (${pos.symbol}, ${pos.type})`);
                } catch (error) {
                    console.error(`   ❌ Errore chiusura posizione ${pos.ticket_id}:`, error.message);
                }
            }
        } else {
            console.log('   ✅ Nessuna posizione aperta da chiudere');
        }
        
        // 3. Cancella tutti i trade history
        console.log('\n🗑️  3. Cancellazione trade history...');
        const tradesDeleted = await dbRun("DELETE FROM trades");
        console.log(`   ✅ Cancellati tutti i trade history`);
        
        // 4. Cancella tutte le posizioni (aperte e chiuse)
        console.log('\n🗑️  4. Cancellazione posizioni...');
        const positionsDeleted = await dbRun("DELETE FROM open_positions");
        console.log(`   ✅ Cancellate tutte le posizioni`);
        
        // 5. Reset portfolio
        console.log('\n💰 5. Reset portfolio...');
        await dbRun(
            "UPDATE portfolio SET balance_usd = $1, holdings = '{}' WHERE id = 1",
            [targetBalance]
        );
        console.log(`   ✅ Portfolio resettato a $${targetBalance.toFixed(2)} USDT`);
        console.log(`   ✅ Holdings azzerate`);
        
        // 6. Verifica risultato finale
        console.log('\n✅ 6. Verifica risultato finale...');
        const finalPortfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");
        const finalOpenPositions = await dbAll("SELECT COUNT(*) as count FROM open_positions WHERE status = 'open'");
        const finalTrades = await dbAll("SELECT COUNT(*) as count FROM trades");
        
        console.log(`   Portfolio balance finale: $${parseFloat(finalPortfolio?.balance_usd || 0).toFixed(2)} USDT`);
        console.log(`   Posizioni aperte: ${finalOpenPositions[0]?.count || 0}`);
        console.log(`   Trade totali: ${finalTrades[0]?.count || 0}`);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ RESET COMPLETATO CON SUCCESSO!');
        console.log('='.repeat(60));
        console.log('\n📝 Note:');
        console.log('   - Bot settings e klines sono stati mantenuti');
        console.log('   - Il sistema è pronto per nuovi trade');
        console.log(`   - Balance iniziale: $${targetBalance.toFixed(2)} USDT\n`);
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERRORE durante reset:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Esegui reset
const customBalance = process.argv[2] ? parseFloat(process.argv[2]) : null;
resetTradingSystem(customBalance);

