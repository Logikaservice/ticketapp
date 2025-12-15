/**
 * 🧹 PULIZIA DATI RESIDUI POST-RESET
 * 
 * Rimuove dati residui rimasti dopo un reset incompleto:
 * - Disattiva temporaneamente tutti i bot (per evitare nuove posizioni durante cleanup)
 * - Chiude e cancella posizioni aperte
 * - Cancella trade history
 * - Azzera holdings
 * - Verifica che tutto sia pulito
 * - Riattiva i bot (opzionale)
 */

const { dbAll, dbGet, dbRun } = require('../crypto_db');

async function cleanupResidualData() {
    console.log('🧹 PULIZIA DATI RESIDUI POST-RESET');
    console.log('='.repeat(60));
    
    try {
        // 0. Disattiva temporaneamente tutti i bot per evitare nuove posizioni durante cleanup
        console.log('\n🤖 0. Disattivazione temporanea bot...');
        const botsBefore = await dbAll("SELECT COUNT(*) as count FROM bot_settings WHERE is_active = 1");
        const activeBotsBefore = parseInt(botsBefore[0]?.count || 0);
        
        if (activeBotsBefore > 0) {
            await dbRun("UPDATE bot_settings SET is_active = 0 WHERE is_active = 1");
            console.log(`   ✅ Disattivati ${activeBotsBefore} bot attivi`);
            console.log('   ⚠️  I bot verranno riattivati manualmente dopo il cleanup');
        } else {
            console.log('   ✅ Nessun bot attivo da disattivare');
        }
        
        // 1. Verifica cosa c'è da pulire
        console.log('\n📊 1. Verifica dati residui...');
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        const allPositions = await dbAll("SELECT COUNT(*) as count FROM open_positions");
        const trades = await dbAll("SELECT COUNT(*) as count FROM trades");
        const portfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");
        const holdings = portfolio ? JSON.parse(portfolio.holdings || '{}') : {};
        const holdingsCount = Object.keys(holdings).filter(k => holdings[k] > 0).length;
        
        console.log(`   Posizioni aperte: ${openPositions.length}`);
        console.log(`   Posizioni totali: ${allPositions[0]?.count || 0}`);
        console.log(`   Trade history: ${trades[0]?.count || 0}`);
        console.log(`   Holdings non azzerate: ${holdingsCount}`);
        
        if (openPositions.length === 0 && allPositions[0]?.count === 0 && trades[0]?.count === 0 && holdingsCount === 0) {
            console.log('\n✅ Nessun dato residuo da pulire!');
            process.exit(0);
        }
        
        // 2. Chiudi tutte le posizioni aperte (se ce ne sono)
        if (openPositions.length > 0) {
            console.log(`\n🛑 2. Chiusura ${openPositions.length} posizioni aperte...`);
            
            for (const pos of openPositions) {
                try {
                    const currentPrice = parseFloat(pos.current_price) || parseFloat(pos.entry_price) || 0;
                    
                    const profitLoss = pos.type === 'buy' 
                        ? (currentPrice - parseFloat(pos.entry_price)) * parseFloat(pos.volume)
                        : (parseFloat(pos.entry_price) - currentPrice) * parseFloat(pos.volume);
                    const profitLossPct = parseFloat(pos.entry_price) > 0 
                        ? (profitLoss / (parseFloat(pos.entry_price) * parseFloat(pos.volume))) * 100 
                        : 0;
                    
                    await dbRun(
                        `UPDATE open_positions 
                         SET status = 'closed',
                             closed_at = NOW(),
                             current_price = $1,
                             profit_loss = $2,
                             profit_loss_pct = $3
                         WHERE ticket_id = $4`,
                        [currentPrice, profitLoss, profitLossPct, pos.ticket_id]
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
        
        // 5. Azzera holdings
        console.log('\n💰 5. Azzeramento holdings...');
        await dbRun("UPDATE portfolio SET holdings = '{}' WHERE id = 1");
        console.log(`   ✅ Holdings azzerate`);
        
        // 6. Verifica risultato
        console.log('\n✅ 6. Verifica risultato...');
        const finalOpenPositions = await dbAll("SELECT COUNT(*) as count FROM open_positions WHERE status = 'open'");
        const finalAllPositions = await dbAll("SELECT COUNT(*) as count FROM open_positions");
        const finalTrades = await dbAll("SELECT COUNT(*) as count FROM trades");
        const finalPortfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");
        const finalHoldings = finalPortfolio ? JSON.parse(finalPortfolio.holdings || '{}') : {};
        const finalHoldingsCount = Object.keys(finalHoldings).filter(k => finalHoldings[k] > 0).length;
        const finalBots = await dbAll("SELECT COUNT(*) as count FROM bot_settings WHERE is_active = 1");
        const finalActiveBots = parseInt(finalBots[0]?.count || 0);
        
        console.log(`   Posizioni aperte: ${finalOpenPositions[0]?.count || 0}`);
        console.log(`   Posizioni totali: ${finalAllPositions[0]?.count || 0}`);
        console.log(`   Trade history: ${finalTrades[0]?.count || 0}`);
        console.log(`   Holdings non azzerate: ${finalHoldingsCount}`);
        console.log(`   Bot attivi: ${finalActiveBots}`);
        
        if (finalAllPositions[0]?.count === 0 && finalTrades[0]?.count === 0 && finalHoldingsCount === 0) {
            console.log('\n' + '='.repeat(60));
            console.log('✅ PULIZIA COMPLETATA CON SUCCESSO!');
            console.log('='.repeat(60));
            console.log('   ✅ Tutte le posizioni cancellate');
            console.log('   ✅ Tutti i trade cancellati');
            console.log('   ✅ Holdings azzerate');
            if (finalActiveBots === 0) {
                console.log('   ⚠️  Bot disattivati - riattivali manualmente quando sei pronto');
            }
            console.log('   ✅ Sistema pronto per nuovi trade\n');
        } else {
            console.log('\n⚠️  Alcuni dati potrebbero essere rimasti:');
            if (finalAllPositions[0]?.count > 0) {
                console.log(`   - ${finalAllPositions[0].count} posizioni ancora presenti`);
            }
            if (finalTrades[0]?.count > 0) {
                console.log(`   - ${finalTrades[0].count} trade ancora presenti`);
            }
            if (finalHoldingsCount > 0) {
                console.log(`   - ${finalHoldingsCount} holdings non azzerate`);
            }
            console.log('   Esegui di nuovo lo script se necessario.\n');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERRORE durante pulizia:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

cleanupResidualData();

