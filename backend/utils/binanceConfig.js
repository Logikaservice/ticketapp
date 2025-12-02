/**
 * Configurazione Binance
 * Gestisce le modalità DEMO, TESTNET e LIVE
 */

const BinanceClient = require('./binanceClient');

// Singleton instance
let binanceClientInstance = null;

/**
 * Get Binance client instance
 */
function getBinanceClient() {
    if (!binanceClientInstance) {
        const mode = process.env.BINANCE_MODE || 'demo';
        
        binanceClientInstance = new BinanceClient({
            mode: mode,
            apiKey: process.env.BINANCE_API_KEY,
            apiSecret: process.env.BINANCE_API_SECRET
        });
        
        console.log(`🔧 Binance Client inizializzato in modalità: ${mode.toUpperCase()}`);
    }
    
    return binanceClientInstance;
}

/**
 * Check if Binance is available (not in demo mode)
 */
function isBinanceAvailable() {
    const mode = process.env.BINANCE_MODE || 'demo';
    return mode !== 'demo';
}

/**
 * Get current mode
 */
function getMode() {
    return process.env.BINANCE_MODE || 'demo';
}

module.exports = {
    getBinanceClient,
    isBinanceAvailable,
    getMode
};

