/**
 * BINANCE WEBSOCKET SERVICE - Real-time Price Updates
 * 
 * Connessione WebSocket persistente a Binance per ricevere aggiornamenti prezzi in tempo reale
 * Zero rate limit (WebSocket non conta come REST API)
 * 
 * Features:
 * - Sottoscrizione automatica a simboli con posizioni aperte
 * - Riconnessione automatica in caso di disconnessione
 * - Fallback a REST API se WebSocket non disponibile
 * - Aggiornamento cache prezzi in tempo reale
 */

const WebSocket = require('ws');
const https = require('https');

class BinanceWebSocketService {
    constructor(priceCacheCallback) {
        this.ws = null;
        this.subscribedSymbols = new Set();
        this.priceCacheCallback = priceCacheCallback; // Callback per aggiornare cache
        this.reconnectInterval = null;
        this.reconnectDelay = 5000; // 5 secondi
        this.isConnected = false;
        this.isConnecting = false;
        this.lastPing = Date.now();
        this.pingInterval = null;
        
        // Mappa simbolo -> trading pair (verrà passata da cryptoRoutes)
        this.symbolToPair = null;
    }

    /**
     * Imposta mappa simbolo -> trading pair
     */
    setSymbolToPairMap(symbolToPairMap) {
        this.symbolToPair = symbolToPairMap;
    }

    /**
     * Converte simbolo interno a trading pair Binance
     */
    getTradingPair(symbol) {
        if (!this.symbolToPair) {
            return null;
        }
        return this.symbolToPair[symbol] || null;
    }

    /**
     * Connette a Binance WebSocket
     */
    async connect() {
        if (this.isConnecting || this.isConnected) {
            return;
        }

        this.isConnecting = true;
        console.log('🔌 [WEBSOCKET] Connessione a Binance WebSocket...');

        try {
            // Binance WebSocket endpoint per ticker stream
            // Useremo stream combinato per multiple symbols
            this.ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');

            this.ws.on('open', () => {
                console.log('✅ [WEBSOCKET] Connesso a Binance WebSocket');
                this.isConnected = true;
                this.isConnecting = false;
                this.lastPing = Date.now();
                
                // Ping ogni 30 secondi per mantenere connessione viva
                this.pingInterval = setInterval(() => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.ping();
                        this.lastPing = Date.now();
                    }
                }, 30000);
            });

            this.ws.on('message', (data) => {
                try {
                    const tickers = JSON.parse(data.toString());
                    this.handleTickerUpdate(tickers);
                } catch (err) {
                    console.error('⚠️ [WEBSOCKET] Errore parsing messaggio:', err.message);
                }
            });

            this.ws.on('error', (error) => {
                console.error('❌ [WEBSOCKET] Errore:', error.message);
                this.isConnected = false;
                this.isConnecting = false;
            });

            this.ws.on('close', () => {
                console.log('🔌 [WEBSOCKET] Connessione chiusa, riconnessione in corso...');
                this.isConnected = false;
                this.isConnecting = false;
                
                if (this.pingInterval) {
                    clearInterval(this.pingInterval);
                    this.pingInterval = null;
                }
                
                // Riconnessione automatica
                this.scheduleReconnect();
            });

            this.ws.on('pong', () => {
                this.lastPing = Date.now();
            });

        } catch (error) {
            console.error('❌ [WEBSOCKET] Errore connessione:', error.message);
            this.isConnected = false;
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    /**
     * Gestisce aggiornamento ticker da Binance
     */
    handleTickerUpdate(tickers) {
        if (!Array.isArray(tickers)) {
            return;
        }

        // Tickers è un array di tutti i ticker disponibili
        // Filtriamo solo quelli che ci interessano (simboli con posizioni aperte)
        const relevantTickers = tickers.filter(ticker => {
            // Verifica se questo trading pair corrisponde a un simbolo sottoscritto
            return Array.from(this.subscribedSymbols).some(symbol => {
                const pair = this.getTradingPair(symbol);
                return pair && ticker.s === pair;
            });
        });

        // Aggiorna cache per ogni ticker rilevante
        if (!this.symbolToPair) {
            return; // Mappa non ancora impostata
        }
        
        relevantTickers.forEach(ticker => {
            // Trova simbolo corrispondente
            for (const [symbol, pair] of Object.entries(this.symbolToPair)) {
                if (ticker.s === pair) {
                    const price = parseFloat(ticker.c); // 'c' = last price
                    
                    // ✅ FIX CRITICO: Tutti i prezzi sono già in USDT, nessuna conversione necessaria
                    // Tutte le coppie sono USDT pairs (es. BTCUSDT, DOTUSDT, etc.)
                    this.updatePriceCache(symbol, price);
                    break;
                }
            }
        });
    }

    // ✅ RIMOSSO: Funzioni convertUSDTtoEUR e getUSDTtoEURRate - non più necessarie, tutto è già in USDT

    /**
     * Aggiorna cache prezzi tramite callback
     */
    updatePriceCache(symbol, price) {
        if (this.priceCacheCallback) {
            this.priceCacheCallback(symbol, price);
        }
    }

    /**
     * Sottoscrive a simboli (aggiunge alla lista di monitoraggio)
     */
    subscribeToSymbols(symbols) {
        symbols.forEach(symbol => {
            const pair = this.getTradingPair(symbol);
            if (pair) {
                this.subscribedSymbols.add(symbol);
                console.log(`📡 [WEBSOCKET] Sottoscritto a ${symbol} (${pair})`);
            }
        });
    }

    /**
     * Rimuove sottoscrizione a simboli
     */
    unsubscribeFromSymbols(symbols) {
        symbols.forEach(symbol => {
            this.subscribedSymbols.delete(symbol);
            console.log(`📡 [WEBSOCKET] Rimosso sottoscrizione ${symbol}`);
        });
    }

    /**
     * Pianifica riconnessione
     */
    scheduleReconnect() {
        if (this.reconnectInterval) {
            return; // Già programmata
        }

        this.reconnectInterval = setTimeout(() => {
            this.reconnectInterval = null;
            console.log('🔄 [WEBSOCKET] Tentativo riconnessione...');
            this.connect();
        }, this.reconnectDelay);
    }

    /**
     * Disconnette WebSocket
     */
    disconnect() {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
            this.reconnectInterval = null;
        }
        
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
        this.isConnecting = false;
        console.log('🔌 [WEBSOCKET] Disconnesso');
    }

    /**
     * Verifica se connesso
     */
    isWebSocketConnected() {
        return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    /**
     * Ottiene l'ultimo prezzo da cache (se disponibile)
     * Nota: La cache è gestita dal callback, questo metodo è solo per compatibilità
     */
    getLatestPrice(symbol) {
        // La cache è gestita dal callback in cryptoRoutes.js
        // Questo metodo è qui per compatibilità con il codice che lo chiama
        // Il prezzo reale viene recuperato dalla priceCache in cryptoRoutes.js
        return null; // Ritorna null, la cache è gestita altrove
    }
}

module.exports = BinanceWebSocketService;
