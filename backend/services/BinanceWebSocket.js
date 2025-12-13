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
    constructor(priceCacheCallback, volumeCacheCallback = null) {
        this.ws = null;
        this.subscribedSymbols = new Set();
        this.priceCacheCallback = priceCacheCallback; // Callback per aggiornare cache prezzi
        this.volumeCacheCallback = volumeCacheCallback; // Callback per aggiornare cache volumi (nuovo)
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
                    // ✅ DEBUG: Log primo ticker per verificare struttura dati
                    if (Math.random() < 0.001 && Array.isArray(tickers) && tickers.length > 0) {
                        const firstTicker = tickers[0];
                        console.log(`🔍 [WEBSOCKET-DEBUG] Primo ticker campione:`, {
                            symbol: firstTicker.s,
                            price: firstTicker.c,
                            quoteVolume: firstTicker.q,
                            quoteVolumeQ: firstTicker.Q,
                            volume: firstTicker.v,
                            allFields: Object.keys(firstTicker).slice(0, 10) // Prime 10 chiavi
                        });
                    }
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

        // ✅ FIX: Tickers è un array di TUTTI i ticker disponibili da Binance
        // Processiamo TUTTI i ticker per avere volumi anche per simboli non sottoscritti
        // (utile per Market Scanner che mostra molti simboli)
        
        if (!this.symbolToPair) {
            return; // Mappa non ancora impostata
        }
        
        // Crea mappa inversa: pair -> symbol per lookup veloce
        const pairToSymbol = {};
        for (const [symbol, pair] of Object.entries(this.symbolToPair)) {
            if (pair) {
                pairToSymbol[pair] = symbol;
            }
        }
        
        // Processa TUTTI i ticker (non solo quelli sottoscritti) per avere volumi completi
        tickers.forEach(ticker => {
            const symbol = pairToSymbol[ticker.s];
            if (!symbol) {
                return; // Simbolo non nella nostra mappa, salta
            }
            
            const price = parseFloat(ticker.c); // 'c' = last price
            
            // ✅ Prezzi: aggiorna solo per simboli sottoscritti (per non sprecare risorse)
            // Ma per volumi, aggiorniamo TUTTI i simboli nella mappa (per Market Scanner)
            const isSubscribed = this.subscribedSymbols.has(symbol);
            
            if (isSubscribed && price > 0) {
                // ✅ FIX CRITICO: Tutti i prezzi sono già in USDT, nessuna conversione necessaria
                // Tutte le coppie sono USDT pairs (es. BTCUSDT, DOTUSDT, etc.)
                this.updatePriceCache(symbol, price);
            }
            
            // ✅ NUOVO: Aggiorna volume 24h per TUTTI i simboli nella mappa (non solo sottoscritti)
            // Il ticker Binance include 'q' (quoteVolume) che è il volume 24h in quote currency (USDT)
            if (this.volumeCacheCallback) {
                // ✅ FIX: Prova sia 'q' (quoteVolume) che 'Q' (alcuni ticker usano maiuscola)
                const volume24h = parseFloat(ticker.q || ticker.Q || 0);
                if (volume24h > 0) {
                    this.updateVolumeCache(symbol, volume24h);
                    // Log solo occasionalmente per non spammare
                    if (Math.random() < 0.01) { // 1% delle volte
                        console.log(`📊 [WEBSOCKET-VOLUME] ${symbol} (${ticker.s}): $${volume24h.toLocaleString('it-IT')} USDT`);
                    }
                } else if (Math.random() < 0.01) {
                    // Debug: log quando volume è 0 o mancante
                    console.warn(`⚠️ [WEBSOCKET-VOLUME] Volume 0 o mancante per ${symbol} (${ticker.s}), ticker.q=${ticker.q}, ticker.Q=${ticker.Q}`);
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
     * Aggiorna cache volumi 24h tramite callback
     */
    updateVolumeCache(symbol, volume24h) {
        if (this.volumeCacheCallback) {
            this.volumeCacheCallback(symbol, volume24h);
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
