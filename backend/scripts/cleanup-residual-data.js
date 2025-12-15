/**
 * 🧹 PULIZIA DATI RESIDUI POST-RESET
 * 
 * Rimuove dati residui rimasti dopo un reset incompleto:
 * - Chiude e cancella posizioni aperte
 * - Cancella trade history
 * - Verifica che tutto sia pulito
 */

const { dbAll, dbGet, dbRun } = require('../crypto_db');

async function cleanupResidualData() {
    console.log('🧹 PULIZIA DATI RESIDUI POST-RESET');
    console.log('='.repeat(60));
    
    try {
        // 1. Verifica cosa c'è da pulire
        console.log('\n📊 1. Verifica dati residui...');
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        const allPositions = await dbAll("SELECT COUNT(*) as count FROM open_positions");
        const trades = await dbAll("SELECT COUNT(*) as count FROM trades");
        
        console.log(`   Posizioni aperte: ${openPositions.length}`);
        console.log(`   Posizioni totali: ${allPositions[0]?.count || 0}`);
        console.log(`   Trade history: ${trades[0]?.count || 0}`);
        
        if (openPositions.length === 0 && allPositions[0]?.count === 0 && trades[0]?.count === 0) {
            console.log('\n✅ Nessun dato residuo da pulire!');
            process.exit(0);
        }
        
        // 2. Chiudi tutte le posizioni aperte (se ce ne sono)
        if (openPositions.length > 0) {
            console.log(`\n🛑 2. Chiusura ${openPositions.length} posizioni aperte...`);
            
            for (const pos of openPositions) {
                try {
                    const currentPrice = parseFloat(pos.current_price) || parseFloat(pos.entry_price) || 0;
                    
                    await dbRun(
                        `UPDATE open_positions 
                         SET status = 'closed',
                             closed_at = NOW(),
                             close_price = $1,
                             profit_loss = $2,
                             close_reason = 'Cleanup Post-Reset'
                         WHERE ticket_id = $3`,
                        [
                            currentPrice,
                            pos.type === 'buy' 
                                ? (currentPrice - parseFloat(pos.entry_price)) * parseFloat(pos.volume)
                                : (parseFloat(pos.entry_price) - currentPrice) * parseFloat(pos.volume),
                            pos.ticket_id
                        ]
                    );
                    
                    console.log(`   ✅ Chiusa ${pos.ticket_id} (${pos.symbol}, ${pos.type})`);
                } catch (error) {
                    console.error(`   ❌ Errore chiusura ${pos.ticket_id}:`, error.message);
                }
            }
        }
        
        // 3. Cancella TUTTE le posizioni
        console.log('\n🗑️  3. Cancellazione tutte le posizioni...');
        const positionsDeleted = await dbRun("DELETE FROM open_positions");
        console.log(`   ✅ Cancellate tutte le posizioni`);
        
        // 4. Cancella TUTTI i trade
        console.log('\n🗑️  4. Cancellazione trade history...');
        const tradesDeleted = await dbRun("DELETE FROM trades");
        console.log(`   ✅ Cancellati tutti i trade`);
        
        // 5. Verifica risultato
        console.log('\n✅ 5. Verifica risultato...');
        const finalOpenPositions = await dbAll("SELECT COUNT(*) as count FROM open_positions WHERE status = 'open'");
        const finalAllPositions = await dbAll("SELECT COUNT(*) as count FROM open_positions");
        const finalTrades = await dbAll("SELECT COUNT(*) as count FROM trades");
        
        console.log(`   Posizioni aperte: ${finalOpenPositions[0]?.count || 0}`);
        console.log(`   Posizioni totali: ${finalAllPositions[0]?.count || 0}`);
        console.log(`   Trade history: ${finalTrades[0]?.count || 0}`);
        
        if (finalAllPositions[0]?.count === 0 && finalTrades[0]?.count === 0) {
            console.log('\n' + '='.repeat(60));
            console.log('✅ PULIZIA COMPLETATA CON SUCCESSO!');
            console.log('='.repeat(60) + '\n');
        } else {
            console.log('\n⚠️  Alcuni dati potrebbero essere rimasti. Esegui di nuovo lo script se necessario.\n');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERRORE durante pulizia:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

cleanupResidualData();

