const { dbAll, dbGet } = require('../crypto_db');

// Script veloce per controllare valori chiave del database
async function quickCheck() {
    try {
        console.log('🔍 QUICK DATABASE CHECK\n');

        // 1. Total Balance
        try {
            const totalBalance = await dbGet("SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance'");
            console.log(`💰 Total Balance: $${parseFloat(totalBalance?.setting_value || 0).toFixed(2)}`);
        } catch (e) {
            console.log('💰 Total Balance: ❌ Tabella non esiste o errore');
        }

        // 2. Portfolio
        const portfolio = await dbGet("SELECT balance_usd FROM portfolio WHERE id = 1");
        console.log(`💵 Cash (balance_usd): $${parseFloat(portfolio?.balance_usd || 0).toFixed(2)}`);

        // 3. Posizioni aperte
        const openCount = await dbGet("SELECT COUNT(*) as count FROM open_positions WHERE status = 'open'");
        console.log(`📊 Posizioni aperte: ${openCount?.count || 0}`);

        // 4. P&L totale posizioni aperte
        const totalPnL = await dbGet(`
            SELECT COALESCE(SUM(profit_loss), 0) as total_pnl 
            FROM open_positions 
            WHERE status = 'open'
        `);
        console.log(`📈 P&L Totale (aperte): $${parseFloat(totalPnL?.total_pnl || 0).toFixed(2)}`);

        // 5. Ultime 3 posizioni aperte
        const recentPositions = await dbAll(`
            SELECT ticket_id, symbol, type, entry_price, profit_loss 
            FROM open_positions 
            WHERE status = 'open' 
            ORDER BY opened_at DESC 
            LIMIT 3
        `);
        if (recentPositions.length > 0) {
            console.log(`\n📋 Ultime 3 posizioni:`);
            recentPositions.forEach(p => {
                console.log(`   - ${p.symbol} ${p.type} @ $${parseFloat(p.entry_price || 0).toFixed(2)} (P&L: $${parseFloat(p.profit_loss || 0).toFixed(2)})`);
            });
        }

    } catch (error) {
        console.error('❌ Errore:', error.message);
    } finally {
        process.exit(0);
    }
}

if (require.main === module) {
    quickCheck();
}

module.exports = { quickCheck };

