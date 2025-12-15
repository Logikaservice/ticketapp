/**
 * 🔧 API Endpoint to fix wrong volumes in open positions
 * 
 * This endpoint can be called directly from the dashboard to fix volumes
 * without needing SSH access to the server.
 */

const db = require('../crypto_db');

async function fixWrongVolumes() {
    const results = {
        total: 0,
        fixed: 0,
        skipped: 0,
        errors: 0,
        details: []
    };
    
    try {
        // Get all open positions
        const positions = await db.dbAll(
            `SELECT ticket_id, symbol, type, volume, entry_price, current_price, 
                    trade_size_usdt, profit_loss, profit_loss_pct, opened_at
             FROM open_positions 
             WHERE status = 'open'
             ORDER BY opened_at DESC`
        );
        
        results.total = positions.length;
        
        if (positions.length === 0) {
            return results;
        }
        
        for (const pos of positions) {
            const tradeSize = parseFloat(pos.trade_size_usdt) || 0;
            const entryPrice = parseFloat(pos.entry_price) || 0;
            const currentVolume = parseFloat(pos.volume) || 0;
            const currentPrice = parseFloat(pos.current_price) || entryPrice;
            
            // Skip if missing data
            if (tradeSize === 0 || entryPrice === 0) {
                results.skipped++;
                continue;
            }
            
            // Calculate correct volume
            const correctVolume = tradeSize / entryPrice;
            
            // Calculate difference percentage
            const volumeDiffPct = ((currentVolume - correctVolume) / correctVolume) * 100;
            
            // If difference > 5%, needs fixing
            if (Math.abs(volumeDiffPct) > 5) {
                // Calculate correct P&L
                let correctPnL = 0;
                let correctPnLPct = 0;
                
                if (pos.type === 'buy') {
                    correctPnL = (currentPrice - entryPrice) * correctVolume;
                    correctPnLPct = ((currentPrice - entryPrice) / entryPrice) * 100;
                } else {
                    correctPnL = (entryPrice - currentPrice) * correctVolume;
                    correctPnLPct = ((entryPrice - currentPrice) / entryPrice) * 100;
                }
                
                try {
                    // Update in database
                    await db.dbRun(
                        `UPDATE open_positions 
                         SET volume = $1, 
                             profit_loss = $2, 
                             profit_loss_pct = $3,
                             current_price = $4
                         WHERE ticket_id = $5`,
                        [correctVolume, correctPnL, correctPnLPct, currentPrice, pos.ticket_id]
                    );
                    
                    results.fixed++;
                    results.details.push({
                        symbol: pos.symbol,
                        type: pos.type,
                        ticket_id: pos.ticket_id,
                        oldVolume: currentVolume,
                        newVolume: correctVolume,
                        diffPct: volumeDiffPct,
                        oldPnL: parseFloat(pos.profit_loss) || 0,
                        newPnL: correctPnL,
                        status: 'fixed'
                    });
                    
                } catch (updateError) {
                    results.errors++;
                    results.details.push({
                        symbol: pos.symbol,
                        type: pos.type,
                        ticket_id: pos.ticket_id,
                        status: 'error',
                        error: updateError.message
                    });
                }
                
            } else {
                results.skipped++;
            }
        }
        
    } catch (error) {
        throw new Error(`Database error: ${error.message}`);
    }
    
    return results;
}

module.exports = { fixWrongVolumes };
