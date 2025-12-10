/**
 * Script per verificare tutte le posizioni in dettaglio
 */

const { dbGet, dbAll } = require('./backend/crypto_db');

async function verificaPosizioni() {
    console.log('🔍 VERIFICA DETTAGLIATA POSIZIONI\n');
    
    try {
        // Tutte le posizioni (non solo open)
        const allPositions = await dbAll(
            "SELECT * FROM open_positions ORDER BY opened_at DESC LIMIT 20"
        );
        
        console.log(`📊 Totale posizioni trovate: ${allPositions.length}\n`);
        
        const byStatus = {};
        allPositions.forEach(pos => {
            const status = pos.status || 'unknown';
            if (!byStatus[status]) byStatus[status] = [];
            byStatus[status].push(pos);
        });
        
        for (const [status, positions] of Object.entries(byStatus)) {
            console.log(`\n📌 Status: ${status.toUpperCase()} (${positions.length} posizioni)`);
            console.log('-'.repeat(80));
            
            positions.forEach((pos, idx) => {
                const entryPrice = parseFloat(pos.entry_price || 0);
                const volume = parseFloat(pos.volume || 0);
                const value = entryPrice * volume;
                const pnl = parseFloat(pos.profit_loss_pct || 0);
                
                console.log(`${idx + 1}. ${pos.symbol} | ${pos.type.toUpperCase()}`);
                console.log(`   Ticket: ${pos.ticket_id}`);
                console.log(`   Entry: $${entryPrice.toFixed(4)} | Volume: ${volume.toFixed(4)} | Valore: $${value.toFixed(2)}`);
                console.log(`   P&L: ${pnl.toFixed(2)}% | Aperta: ${pos.opened_at || 'N/A'}`);
                if (pos.closed_at) {
                    console.log(`   Chiusa: ${pos.closed_at}`);
                }
                console.log('');
            });
        }
        
        // Verifica balance
        console.log('\n💰 VERIFICA BALANCE');
        console.log('-'.repeat(80));
        const portfolio = await dbGet("SELECT * FROM portfolio LIMIT 1");
        if (portfolio) {
            console.log(`Balance USD: $${parseFloat(portfolio.balance_usd || 0).toFixed(2)}`);
            console.log(`Total Balance USD: $${parseFloat(portfolio.total_balance_usd || 0).toFixed(2)}`);
            console.log(`Holdings: ${portfolio.holdings || '{}'}`);
        }
        
        // Calcola exposure manualmente
        const openPositions = allPositions.filter(p => p.status === 'open');
        console.log(`\n📊 EXPOSURE CALCOLATA`);
        console.log('-'.repeat(80));
        let totalExposure = 0;
        openPositions.forEach(pos => {
            const entryPrice = parseFloat(pos.entry_price || 0);
            const volume = parseFloat(pos.volume || 0);
            const value = entryPrice * volume;
            totalExposure += value;
            console.log(`${pos.symbol}: $${value.toFixed(2)} (${entryPrice.toFixed(4)} × ${volume.toFixed(4)})`);
        });
        console.log(`\nTotale exposure: $${totalExposure.toFixed(2)}`);
        
        if (portfolio) {
            const totalBalance = parseFloat(portfolio.total_balance_usd || 0);
            if (totalBalance > 0) {
                const exposurePct = (totalExposure / totalBalance) * 100;
                console.log(`Total balance: $${totalBalance.toFixed(2)}`);
                console.log(`Exposure %: ${exposurePct.toFixed(2)}%`);
            }
        }
        
    } catch (error) {
        console.error('❌ Errore:', error);
        console.error(error.stack);
    }
}

verificaPosizioni().then(() => {
    console.log('\n✅ Verifica completata');
    process.exit(0);
}).catch(err => {
    console.error('❌ Errore:', err);
    process.exit(1);
});

