/**
 * ✅ VERIFICA RESET COMPLETO
 * 
 * Verifica che il reset sia stato completato correttamente
 * e che non siano rimasti dati residui
 */

const { dbAll, dbGet } = require('../crypto_db');

async function verifyResetComplete() {
    console.log('🔍 VERIFICA RESET COMPLETO');
    console.log('='.repeat(60));
    
    try {
        // 1. Verifica Portfolio
        console.log('\n📊 1. VERIFICA PORTFOLIO...');
        const portfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");
        
        if (!portfolio) {
            console.error('   ❌ Portfolio non trovato!');
        } else {
            const balance = parseFloat(portfolio.balance_usd || 0);
            const holdings = JSON.parse(portfolio.holdings || '{}');
            const holdingsCount = Object.keys(holdings).filter(k => holdings[k] > 0).length;
            
            console.log(`   Balance: $${balance.toFixed(2)} USDT`);
            console.log(`   Holdings: ${holdingsCount} simboli con quantità > 0`);
            
            if (holdingsCount > 0) {
                console.log('   ⚠️  ATTENZIONE: Ci sono holdings non azzerate!');
                Object.entries(holdings).forEach(([symbol, amount]) => {
                    if (amount > 0) {
                        console.log(`      - ${symbol}: ${amount}`);
                    }
                });
            } else {
                console.log('   ✅ Holdings azzerate correttamente');
            }
        }
        
        // 2. Verifica Posizioni Aperte
        console.log('\n📈 2. VERIFICA POSIZIONI APERTE...');
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        
        if (openPositions.length > 0) {
            console.log(`   ❌ TROVATE ${openPositions.length} POSIZIONI APERTE!`);
            openPositions.forEach(pos => {
                console.log(`      - ${pos.ticket_id}: ${pos.symbol} ${pos.type} (volume: ${pos.volume})`);
            });
        } else {
            console.log('   ✅ Nessuna posizione aperta');
        }
        
        // 3. Verifica Posizioni Chiuse
        console.log('\n📉 3. VERIFICA POSIZIONI CHIUSE...');
        const closedPositions = await dbAll(
            "SELECT COUNT(*) as count FROM open_positions WHERE status IN ('closed', 'stopped', 'taken')"
        );
        const closedCount = parseInt(closedPositions[0]?.count || 0);
        
        if (closedCount > 0) {
            console.log(`   ⚠️  Trovate ${closedCount} posizioni chiuse (dovrebbero essere 0 dopo reset completo)`);
            
            // Mostra le prime 5
            const sampleClosed = await dbAll(
                "SELECT ticket_id, symbol, type, closed_at FROM open_positions WHERE status IN ('closed', 'stopped', 'taken') LIMIT 5"
            );
            sampleClosed.forEach(pos => {
                console.log(`      - ${pos.ticket_id}: ${pos.symbol} ${pos.type} (chiusa: ${pos.closed_at})`);
            });
        } else {
            console.log('   ✅ Nessuna posizione chiusa (reset completo)');
        }
        
        // 4. Verifica Tutte le Posizioni (qualsiasi status)
        console.log('\n🗂️  4. VERIFICA TUTTE LE POSIZIONI...');
        const allPositions = await dbAll("SELECT COUNT(*) as count FROM open_positions");
        const allCount = parseInt(allPositions[0]?.count || 0);
        
        if (allCount > 0) {
            console.log(`   ⚠️  Trovate ${allCount} posizioni totali nel database`);
            
            // Raggruppa per status
            const byStatus = await dbAll(
                "SELECT status, COUNT(*) as count FROM open_positions GROUP BY status"
            );
            byStatus.forEach(row => {
                console.log(`      - ${row.status}: ${row.count}`);
            });
        } else {
            console.log('   ✅ Nessuna posizione nel database (reset completo)');
        }
        
        // 5. Verifica Trade History
        console.log('\n📝 5. VERIFICA TRADE HISTORY...');
        const trades = await dbAll("SELECT COUNT(*) as count FROM trades");
        const tradesCount = parseInt(trades[0]?.count || 0);
        
        if (tradesCount > 0) {
            console.log(`   ⚠️  Trovati ${tradesCount} trade nel database (dovrebbero essere 0 dopo reset completo)`);
            
            // Mostra i più recenti
            const recentTrades = await dbAll(
                "SELECT * FROM trades ORDER BY id DESC LIMIT 5"
            );
            recentTrades.forEach(trade => {
                console.log(`      - ${trade.symbol} ${trade.type} ${trade.amount} @ $${trade.price} (${trade.created_at || 'N/A'})`);
            });
        } else {
            console.log('   ✅ Nessun trade nel database (reset completo)');
        }
        
        // 6. Verifica Performance Stats
        console.log('\n📊 6. VERIFICA PERFORMANCE STATS...');
        const perfStats = await dbAll("SELECT * FROM performance_stats");
        
        if (perfStats.length > 0) {
            const stats = perfStats[0];
            const totalTrades = parseInt(stats.total_trades || 0);
            const totalProfit = parseFloat(stats.total_profit || 0);
            const totalLoss = parseFloat(stats.total_loss || 0);
            
            console.log(`   Total Trades: ${totalTrades}`);
            console.log(`   Total Profit: $${totalProfit.toFixed(2)}`);
            console.log(`   Total Loss: $${totalLoss.toFixed(2)}`);
            
            if (totalTrades > 0 || totalProfit !== 0 || totalLoss !== 0) {
                console.log('   ⚠️  Performance stats non completamente resettate');
            } else {
                console.log('   ✅ Performance stats resettate correttamente');
            }
        } else {
            console.log('   ⚠️  Nessuna performance stat trovata (potrebbe essere normale se la tabella non esiste)');
        }
        
        // 7. Verifica Dati Anomali
        console.log('\n🔍 7. VERIFICA DATI ANOMALI...');
        
        // Verifica posizioni con status non standard
        const weirdStatus = await dbAll(
            "SELECT DISTINCT status FROM open_positions WHERE status NOT IN ('open', 'closed', 'stopped', 'taken')"
        );
        if (weirdStatus.length > 0) {
            console.log('   ⚠️  Trovati status non standard:');
            weirdStatus.forEach(row => {
                console.log(`      - ${row.status}`);
            });
        } else {
            console.log('   ✅ Nessuno status anomalo');
        }
        
        // Verifica posizioni senza ticket_id
        const noTicketId = await dbAll(
            "SELECT COUNT(*) as count FROM open_positions WHERE ticket_id IS NULL OR ticket_id = ''"
        );
        const noTicketCount = parseInt(noTicketId[0]?.count || 0);
        if (noTicketCount > 0) {
            console.log(`   ⚠️  Trovate ${noTicketCount} posizioni senza ticket_id`);
        } else {
            console.log('   ✅ Tutte le posizioni hanno ticket_id valido');
        }
        
        // 8. Riepilogo Finale
        console.log('\n' + '='.repeat(60));
        console.log('📋 RIEPILOGO FINALE');
        console.log('='.repeat(60));
        
        const issues = [];
        if (holdingsCount > 0) issues.push(`Holdings non azzerate (${holdingsCount} simboli)`);
        if (openPositions.length > 0) issues.push(`${openPositions.length} posizioni aperte`);
        if (closedCount > 0) issues.push(`${closedCount} posizioni chiuse`);
        if (tradesCount > 0) issues.push(`${tradesCount} trade history`);
        
        if (issues.length === 0) {
            console.log('✅ RESET COMPLETO: Nessun dato residuo trovato!');
            console.log(`   Portfolio balance: $${parseFloat(portfolio?.balance_usd || 0).toFixed(2)} USDT`);
        } else {
            console.log('⚠️  RESET INCOMPLETO: Trovati dati residui:');
            issues.forEach(issue => console.log(`   - ${issue}`));
        }
        
        console.log('='.repeat(60) + '\n');
        
        process.exit(issues.length === 0 ? 0 : 1);
    } catch (error) {
        console.error('\n❌ ERRORE durante verifica:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

verifyResetComplete();

