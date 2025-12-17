const { dbAll, dbGet } = require('../crypto_db');

async function checkBalanceDiscrepancy() {
    console.log('🔍 VERIFICA DISCREPANZA BALANCE');
    console.log('='.repeat(60));

    try {
        // 1. Ottieni portfolio attuale
        const portfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");
        const currentBalance = parseFloat(portfolio?.balance_usd || 0);
        console.log(`\n💰 Balance attuale nel database: $${currentBalance.toFixed(2)}`);

        // 2. Calcola totale investito dalle posizioni aperte
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        let totalInvested = 0;
        
        openPositions.forEach(pos => {
            const volume = parseFloat(pos.volume) || 0;
            const volumeClosed = parseFloat(pos.volume_closed) || 0;
            const remainingVolume = volume - volumeClosed;
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const invested = remainingVolume * entryPrice;
            totalInvested += invested;
        });

        console.log(`\n📊 Posizioni aperte: ${openPositions.length}`);
        console.log(`   Totale investito: $${totalInvested.toFixed(2)}`);

        // 3. Calcola totale da posizioni chiuse (perdite/guadagni)
        const closedPositions = await dbAll("SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken')");
        let totalPnLFromClosed = 0;
        let totalInvestedInClosed = 0;

        closedPositions.forEach(pos => {
            const profitLoss = parseFloat(pos.profit_loss) || 0;
            const volume = parseFloat(pos.volume) || 0;
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const invested = volume * entryPrice;
            
            totalPnLFromClosed += profitLoss;
            totalInvestedInClosed += invested;
        });

        console.log(`\n📉 Posizioni chiuse: ${closedPositions.length}`);
        console.log(`   Totale investito in posizioni chiuse: $${totalInvestedInClosed.toFixed(2)}`);
        console.log(`   P&L totale da posizioni chiuse: $${totalPnLFromClosed.toFixed(2)}`);

        // 4. Calcola balance atteso
        const initialBalance = 1000; // Assumendo $1000 iniziali
        const expectedBalance = initialBalance - totalInvested + totalPnLFromClosed;
        
        console.log(`\n📈 Calcolo atteso:`);
        console.log(`   Balance iniziale: $${initialBalance.toFixed(2)}`);
        console.log(`   - Investito in posizioni aperte: $${totalInvested.toFixed(2)}`);
        console.log(`   + P&L da posizioni chiuse: $${totalPnLFromClosed.toFixed(2)}`);
        console.log(`   = Balance atteso: $${expectedBalance.toFixed(2)}`);
        console.log(`   Balance attuale: $${currentBalance.toFixed(2)}`);
        
        const discrepancy = currentBalance - expectedBalance;
        console.log(`\n🔍 Discrepanza: $${discrepancy.toFixed(2)}`);

        if (Math.abs(discrepancy) > 1) {
            console.log(`\n⚠️  ATTENZIONE: Discrepanza significativa trovata!`);
            console.log(`   Possibili cause:`);
            console.log(`   1. Posizioni SHORT chiuse in perdita`);
            console.log(`   2. Altre operazioni che hanno modificato il balance`);
            console.log(`   3. Balance iniziale diverso da $1000`);
            
            // Verifica posizioni SHORT chiuse
            const closedShorts = closedPositions.filter(p => p.type === 'sell');
            if (closedShorts.length > 0) {
                console.log(`\n📊 Posizioni SHORT chiuse: ${closedShorts.length}`);
                closedShorts.forEach(pos => {
                    const profitLoss = parseFloat(pos.profit_loss) || 0;
                    console.log(`   - ${pos.ticket_id} (${pos.symbol}): P&L = $${profitLoss.toFixed(2)}`);
                });
            }
        } else {
            console.log(`\n✅ Balance coerente!`);
        }

        // 5. Calcola Total Balance (Equity)
        const totalLongValue = openPositions
            .filter(p => p.type === 'buy')
            .reduce((sum, pos) => {
                const volume = parseFloat(pos.volume) || 0;
                const volumeClosed = parseFloat(pos.volume_closed) || 0;
                const remainingVolume = volume - volumeClosed;
                const entryPrice = parseFloat(pos.entry_price) || 0;
                const profitLoss = parseFloat(pos.profit_loss) || 0;
                return sum + (remainingVolume * entryPrice + profitLoss);
            }, 0);

        const totalShortLiability = openPositions
            .filter(p => p.type === 'sell')
            .reduce((sum, pos) => {
                const volume = parseFloat(pos.volume) || 0;
                const volumeClosed = parseFloat(pos.volume_closed) || 0;
                const remainingVolume = volume - volumeClosed;
                const entryPrice = parseFloat(pos.entry_price) || 0;
                const profitLoss = parseFloat(pos.profit_loss) || 0;
                return sum + (remainingVolume * entryPrice - profitLoss);
            }, 0);

        const totalBalance = currentBalance + totalLongValue - totalShortLiability;

        console.log(`\n💰 Total Balance (Equity):`);
        console.log(`   Cash: $${currentBalance.toFixed(2)}`);
        console.log(`   + Long Value: $${totalLongValue.toFixed(2)}`);
        console.log(`   - Short Liability: $${totalShortLiability.toFixed(2)}`);
        console.log(`   = Total Balance: $${totalBalance.toFixed(2)}`);

    } catch (error) {
        console.error('❌ Errore durante la verifica:', error.message);
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

if (require.main === module) {
    checkBalanceDiscrepancy();
}

module.exports = { checkBalanceDiscrepancy };

