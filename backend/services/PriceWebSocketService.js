/**
 * 📡 PRICE WEBSOCKET SERVICE
 * 
 * Emette prezzi real-time via WebSocket invece di polling HTTP.
 * 
 * Come funziona:
 * 1. Legge prezzi da price_history (aggiornati dal WebSocket Binance)
 * 2. Emette i prezzi via Socket.io nella room 'crypto:dashboard'
 * 3. Frontend ascolta e aggiorna UI in tempo reale
 * 
 * Vantaggi:
 * - ✅ Zero polling HTTP dal frontend
 * - ✅ Prestazioni browser molto migliori
 * - ✅ Aggiornamenti real-time fluidi
 * - ✅ Il bot continua a leggere dal DB (nessun cambio)
 */

const { dbAll } = require('../crypto_db');

class PriceWebSocketService {
    constructor() {
        this.io = null;
        this.updateInterval = null;
        this.isRunning = false;
        this.UPDATE_INTERVAL_MS = 2000; // Ogni 2 secondi (ottimale per UI)
    }

    /**
     * Imposta l'istanza Socket.io
     */
    setSocketIO(io) {
        this.io = io;
        console.log('✅ [PRICE-WS] Socket.io instance configured');
    }

    /**
     * Avvia il servizio di broadcasting prezzi
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  [PRICE-WS] Already running');
            return;
        }

        if (!this.io) {
            console.error('❌ [PRICE-WS] Socket.io not configured! Call setSocketIO() first');
            return;
        }

        this.isRunning = true;
        console.log(`🚀 [PRICE-WS] Starting price broadcast service (every ${this.UPDATE_INTERVAL_MS}ms)`);

        // Broadcast immediato
        this.broadcastPrices().catch(err => {
            console.error('❌ [PRICE-WS] Initial broadcast error:', err.message);
        });

        // Poi ogni X secondi
        this.updateInterval = setInterval(() => {
            this.broadcastPrices().catch(err => {
                console.error('❌ [PRICE-WS] Broadcast error:', err.message);
            });
        }, this.UPDATE_INTERVAL_MS);

        console.log('✅ [PRICE-WS] Price broadcast service started');
    }

    /**
     * Ferma il servizio
     */
    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.isRunning = false;
        console.log('🛑 [PRICE-WS] Price broadcast service stopped');
    }

    /**
     * Broadcast dei prezzi più recenti via WebSocket
     */
    async broadcastPrices() {
        try {
            // Ottieni prezzi più recenti per ogni simbolo (ultimi 10 secondi)
            const prices = await dbAll(`
                SELECT DISTINCT ON (symbol) 
                    symbol, 
                    price, 
                    timestamp
                FROM price_history
                WHERE timestamp > NOW() - INTERVAL '10 seconds'
                  AND price > 0
                ORDER BY symbol, timestamp DESC
            `);

            if (prices.length === 0) {
                // Nessun prezzo recente, skip silenzioso
                return;
            }

            // Costruisci mappa simbolo -> prezzo
            const priceMap = {};
            for (const { symbol, price, timestamp } of prices) {
                priceMap[symbol] = {
                    price: parseFloat(price),
                    timestamp: timestamp
                };
            }

            // Emetti evento WebSocket nella room crypto:dashboard
            this.io.to('crypto:dashboard').emit('crypto:prices-update', {
                prices: priceMap,
                timestamp: new Date().toISOString()
            });

            // Log solo ogni 30 secondi per non intasare (1 log ogni 15 broadcast)
            if (Math.random() < 0.033) { // ~3.3% = 1 ogni 30 secondi
                console.log(`📡 [PRICE-WS] Broadcasted ${prices.length} prices to clients`);
            }
        } catch (error) {
            console.error('❌ [PRICE-WS] Error broadcasting prices:', error.message);
        }
    }

    /**
     * Ottieni prezzo singolo per un simbolo (utility)
     */
    async getPriceForSymbol(symbol) {
        try {
            const { dbGet } = require('../crypto_db');
            const result = await dbGet(
                `SELECT price, timestamp 
                 FROM price_history 
                 WHERE symbol = $1 
                   AND timestamp > NOW() - INTERVAL '30 seconds'
                   AND price > 0
                 ORDER BY timestamp DESC 
                 LIMIT 1`,
                [symbol]
            );

            if (result) {
                return {
                    symbol,
                    price: parseFloat(result.price),
                    timestamp: result.timestamp
                };
            }

            return null;
        } catch (error) {
            console.error(`❌ [PRICE-WS] Error getting price for ${symbol}:`, error.message);
            return null;
        }
    }
}

// Singleton instance
const priceWebSocketService = new PriceWebSocketService();

module.exports = priceWebSocketService;
