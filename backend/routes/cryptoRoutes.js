// GET /api/crypto/debug/db - Quick database check (for debugging)
router.get('/debug/db', async (req, res) => {
    try {
        const data = {};

        // Total Balance
        try {
            const totalBalance = await dbGet("SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance'");
            data.totalBalance = parseFloat(totalBalance?.setting_value || 0);
        } catch (e) {
            data.totalBalance = null;
            data.totalBalanceError = e.message;
        }

        // Portfolio
        const portfolio = await dbGet("SELECT balance_usd, holdings FROM portfolio WHERE id = 1");
        data.portfolio = {
            balance_usd: parseFloat(portfolio?.balance_usd || 0),
            holdings: portfolio?.holdings || '{}'
        };

        // Open Positions
        const openPositions = await dbAll("SELECT ticket_id, symbol, type, volume, entry_price, profit_loss FROM open_positions WHERE status = 'open'");
        data.openPositions = {
            count: openPositions.length,
            totalPnL: openPositions.reduce((sum, p) => sum + (parseFloat(p.profit_loss) || 0), 0),
            positions: openPositions.map(p => ({
                ticket_id: p.ticket_id,
                symbol: p.symbol,
                type: p.type,
                volume: parseFloat(p.volume || 0),
                entry_price: parseFloat(p.entry_price || 0),
                profit_loss: parseFloat(p.profit_loss || 0)
            }))
        };

        // Closed Positions (last 5)
        const closedPositions = await dbAll(`
            SELECT ticket_id, symbol, type, profit_loss, closed_at 
            FROM open_positions 
            WHERE status IN ('closed', 'stopped', 'taken') 
            ORDER BY closed_at DESC 
            LIMIT 5
        `);
        data.closedPositions = {
            count: closedPositions.length,
            recent: closedPositions.map(p => ({
                ticket_id: p.ticket_id,
                symbol: p.symbol,
                type: p.type,
                profit_loss: parseFloat(p.profit_loss || 0),
                closed_at: p.closed_at
            }))
        };

        res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('❌ Error in /debug/db:', err.message);
        res.status(500).json({ error: err.message });
    }
});
