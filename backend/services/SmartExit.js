/**
 * SMART EXIT SYSTEM
 * Monitors open positions and closes them when trend reversal is detected
 * Prevents profit loss by exiting before stop loss is hit
 */

const db = require('../crypto_db');
const signalGenerator = require('../services/BidirectionalSignalGenerator');

// Promise-based database helpers
const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
};

const dbRun = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

/**
 * Smart Exit Configuration
 */
const SMART_EXIT_CONFIG = {
    ENABLED: true,
    CHECK_INTERVAL_MS: 10000, // Check every 10 seconds
    MIN_OPPOSITE_STRENGTH: 60, // Balanced: Close if opposite signal strength >= 60
    MIN_PROFIT_TO_PROTECT: 0.5, // Only activate if position has at least 0.5% profit
};

/**
 * Check if a position should be closed due to trend reversal
 * @param {Object} position - Open position
 * @param {Array} priceHistory - Price history for signal analysis
 * @returns {Object} { shouldClose, reason, oppositeStrength }
 */
async function shouldClosePosition(position, priceHistory) {
    try {
        // Generate signal for current market conditions
        const signal = signalGenerator.generateSignal(priceHistory, position.symbol);

        const isLongPosition = position.type === 'buy';
        const isShortPosition = position.type === 'sell';

        // Check for opposite signal
        const oppositeSignal = isLongPosition ? signal.shortSignal : signal.longSignal;
        const oppositeStrength = oppositeSignal?.strength || 0;

        // Only close if:
        // 1. Opposite signal is strong enough (>= 60)
        // 2. Position has some profit (optional, to avoid closing too early)
        const currentPnLPct = parseFloat(position.profit_loss_pct) || 0;
        const hasProfit = currentPnLPct >= SMART_EXIT_CONFIG.MIN_PROFIT_TO_PROTECT;

        if (oppositeStrength >= SMART_EXIT_CONFIG.MIN_OPPOSITE_STRENGTH) {
            // Strong opposite signal detected
            const reason = isLongPosition
                ? `SHORT signal detected (Strength: ${oppositeStrength}) - Closing LONG to protect profit`
                : `LONG signal detected (Strength: ${oppositeStrength}) - Closing SHORT to protect profit`;

            return {
                shouldClose: true,
                reason: reason,
                oppositeStrength: oppositeStrength,
                currentPnL: currentPnLPct
            };
        }

        return {
            shouldClose: false,
            reason: null,
            oppositeStrength: oppositeStrength,
            currentPnL: currentPnLPct
        };
    } catch (error) {
        console.error(`❌ Smart Exit error for ${position.symbol}:`, error.message);
        return { shouldClose: false, reason: null };
    }
}

/**
 * Main Smart Exit Loop
 * Checks all open positions and closes them if trend reversal is detected
 */
async function runSmartExit() {
    if (!SMART_EXIT_CONFIG.ENABLED) return;

    try {
        // Get all open positions
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");

        if (openPositions.length === 0) {
            return; // No positions to check
        }

        console.log(`🔍 [SMART EXIT] Checking ${openPositions.length} open positions...`);

        for (const position of openPositions) {
            try {
                // Load price history for this symbol (last 100 klines)
                const klines = await dbAll(
                    "SELECT * FROM klines WHERE symbol = ? AND interval = '15m' ORDER BY open_time DESC LIMIT 100",
                    [position.symbol]
                );

                if (klines.length < 20) {
                    console.log(`⚠️ [SMART EXIT] Insufficient data for ${position.symbol}, skipping`);
                    continue;
                }

                // Convert klines to price history format
                const priceHistory = klines.reverse().map(k => ({
                    price: k.close_price,
                    high: k.high_price,
                    low: k.low_price,
                    close: k.close_price,
                    timestamp: k.open_time
                }));

                // Check if position should be closed
                const exitDecision = await shouldClosePosition(position, priceHistory);

                if (exitDecision.shouldClose) {
                    console.log(`🚨 [SMART EXIT] ${position.ticket_id} | ${exitDecision.reason}`);
                    console.log(`   Current P&L: ${exitDecision.currentPnL.toFixed(2)}% | Opposite Signal: ${exitDecision.oppositeStrength}/100`);

                    // Close the position
                    const currentPrice = parseFloat(position.current_price);

                    // Update position status to closed
                    await dbRun(
                        "UPDATE open_positions SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE ticket_id = ?",
                        [position.ticket_id]
                    );

                    console.log(`✅ [SMART EXIT] Position ${position.ticket_id} closed at €${currentPrice.toFixed(2)} | P&L: ${exitDecision.currentPnL.toFixed(2)}%`);

                    // TODO: Emit WebSocket notification for position closed
                } else {
                    // Log monitoring status
                    console.log(`📊 [SMART EXIT] ${position.ticket_id} | P&L: ${exitDecision.currentPnL.toFixed(2)}% | Opposite: ${exitDecision.oppositeStrength}/100 - Holding`);
                }
            } catch (posError) {
                console.error(`❌ [SMART EXIT] Error processing position ${position.ticket_id}:`, posError.message);
            }
        }
    } catch (error) {
        console.error('❌ [SMART EXIT] Error in main loop:', error.message);
    }
}

// Start Smart Exit loop
if (SMART_EXIT_CONFIG.ENABLED) {
    console.log(`🎯 [SMART EXIT] Started (Check interval: ${SMART_EXIT_CONFIG.CHECK_INTERVAL_MS}ms, Min opposite strength: ${SMART_EXIT_CONFIG.MIN_OPPOSITE_STRENGTH})`);
    setInterval(runSmartExit, SMART_EXIT_CONFIG.CHECK_INTERVAL_MS);
}

module.exports = {
    runSmartExit,
    shouldClosePosition,
    SMART_EXIT_CONFIG
};
