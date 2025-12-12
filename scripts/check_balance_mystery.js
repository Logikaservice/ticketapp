const db = require('./backend/crypto_db');

console.log('🔍 Investigating balance mystery: €262.50 instead of €250.00');
console.log('Expected: €250.00');
console.log('Actual: €262.50');
console.log('Difference: +€12.50\n');
console.log('='.repeat(80));

// 1. Check portfolio
db.get('SELECT * FROM portfolio LIMIT 1', (err, portfolio) => {
    if (err) {
        console.error('Error reading portfolio:', err);
        return;
    }

    console.log('\n📊 PORTFOLIO STATUS:');
    console.log('='.repeat(80));
    console.log(`Balance: €${portfolio.balance_usd}`);
    console.log(`Holdings: ${portfolio.holdings}`);
    console.log(`Last Updated: ${portfolio.updated_at || 'N/A'}`);

    // 2. Check open positions
    db.all('SELECT * FROM open_positions ORDER BY opened_at DESC', (err, positions) => {
        if (err) {
            console.error('Error reading positions:', err);
            return;
        }

        console.log('\n📈 OPEN POSITIONS:');
        console.log('='.repeat(80));
        if (positions.length === 0) {
            console.log('❌ No open positions found');
        } else {
            positions.forEach((pos, i) => {
                console.log(`\n${i + 1}. Position #${pos.ticket_id}`);
                console.log(`   Symbol: ${pos.symbol}`);
                console.log(`   Type: ${pos.position_type}`);
                console.log(`   Status: ${pos.status}`);
                console.log(`   Entry: €${pos.entry_price}`);
                console.log(`   Amount: ${pos.amount}`);
                console.log(`   Opened: ${pos.opened_at}`);
                console.log(`   Closed: ${pos.closed_at || 'Still open'}`);
                console.log(`   P&L: €${pos.profit_loss || 'N/A'}`);
            });
        }

        // 3. Check recent trades
        db.all('SELECT * FROM trades ORDER BY timestamp DESC LIMIT 30', (err, trades) => {
            if (err) {
                console.error('Error reading trades:', err);
                return;
            }

            console.log('\n💰 RECENT TRADES (Last 30):');
            console.log('='.repeat(80));
            if (trades.length === 0) {
                console.log('❌ No trades found');
            } else {
                let totalProfit = 0;
                trades.forEach((trade, i) => {
                    const profit = trade.profit_loss || 0;
                    totalProfit += profit;

                    console.log(`\n${i + 1}. Trade #${trade.id} (Ticket: ${trade.ticket_id || 'N/A'})`);
                    console.log(`   Type: ${trade.type.toUpperCase()}`);
                    console.log(`   Symbol: ${trade.symbol}`);
                    console.log(`   Amount: ${trade.amount}`);
                    console.log(`   Price: €${trade.price}`);
                    console.log(`   Cost: €${(trade.amount * trade.price).toFixed(2)}`);
                    console.log(`   P&L: €${profit.toFixed(2)}`);
                    console.log(`   Time: ${trade.timestamp}`);
                    console.log(`   Strategy: ${trade.strategy || 'N/A'}`);
                });

                console.log('\n' + '='.repeat(80));
                console.log(`📊 TOTAL P&L FROM TRADES: €${totalProfit.toFixed(2)}`);
            }

            // 4. Calculate expected balance
            console.log('\n' + '='.repeat(80));
            console.log('🧮 BALANCE CALCULATION:');
            console.log('='.repeat(80));

            // Group trades by type
            const buyTrades = trades.filter(t => t.type === 'buy');
            const sellTrades = trades.filter(t => t.type === 'sell');

            let totalBuyCost = 0;
            let totalSellRevenue = 0;
            let totalProfitLoss = 0;

            buyTrades.forEach(t => {
                totalBuyCost += (t.amount * t.price);
            });

            sellTrades.forEach(t => {
                totalSellRevenue += (t.amount * t.price);
                totalProfitLoss += (t.profit_loss || 0);
            });

            console.log(`Starting Balance: €250.00`);
            console.log(`Total Buy Cost: -€${totalBuyCost.toFixed(2)}`);
            console.log(`Total Sell Revenue: +€${totalSellRevenue.toFixed(2)}`);
            console.log(`Total P&L: €${totalProfitLoss.toFixed(2)}`);
            console.log(`Expected Balance: €${(250 - totalBuyCost + totalSellRevenue).toFixed(2)}`);
            console.log(`Actual Balance: €${portfolio.balance_usd}`);
            console.log(`Difference: €${(portfolio.balance_usd - 250).toFixed(2)}`);

            // 5. Check for closed positions with profit
            db.all("SELECT * FROM open_positions WHERE status IN ('closed', 'stopped', 'taken') ORDER BY closed_at DESC LIMIT 10", (err, closedPos) => {
                if (err) {
                    console.error('Error reading closed positions:', err);
                    db.close();
                    return;
                }

                console.log('\n' + '='.repeat(80));
                console.log('🔒 CLOSED POSITIONS:');
                console.log('='.repeat(80));

                if (closedPos.length === 0) {
                    console.log('❌ No closed positions found');
                } else {
                    let totalClosedPL = 0;
                    closedPos.forEach((pos, i) => {
                        const pl = pos.profit_loss || 0;
                        totalClosedPL += pl;

                        console.log(`\n${i + 1}. Position #${pos.ticket_id}`);
                        console.log(`   Symbol: ${pos.symbol}`);
                        console.log(`   Type: ${pos.position_type}`);
                        console.log(`   Status: ${pos.status}`);
                        console.log(`   Entry: €${pos.entry_price}`);
                        console.log(`   Exit: €${pos.exit_price || 'N/A'}`);
                        console.log(`   Amount: ${pos.amount}`);
                        console.log(`   P&L: €${pl.toFixed(2)}`);
                        console.log(`   Opened: ${pos.opened_at}`);
                        console.log(`   Closed: ${pos.closed_at}`);
                    });

                    console.log('\n' + '='.repeat(80));
                    console.log(`📊 TOTAL P&L FROM CLOSED POSITIONS: €${totalClosedPL.toFixed(2)}`);
                }

                console.log('\n' + '='.repeat(80));
                console.log('🎯 CONCLUSION:');
                console.log('='.repeat(80));
                console.log(`Mystery amount: +€12.50`);
                console.log(`This could be from:`);
                console.log(`1. Closed positions with profit`);
                console.log(`2. Trades executed while you were away`);
                console.log(`3. Database inconsistency`);
                console.log(`4. Manual adjustment (if any)`);

                db.close();
            });
        });
    });
});
