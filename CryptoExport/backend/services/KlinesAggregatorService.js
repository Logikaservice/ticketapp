/**
 * 🔄 KLINES AGGREGATOR SERVICE
 * 
 * Costruisce klines dalle price_history salvate dal WebSocket.
 * Questo permette di avere klines senza usare REST API (evita ban).
 * 
 * Come funziona:
 * 1. WebSocket salva prezzi in price_history ogni secondo
 * 2. Ogni 15 minuti, questo servizio aggrega i prezzi in kline
 * 3. Salva la kline nella tabella klines
 * 
 * Vantaggi:
 * - ✅ Zero chiamate REST API
 * - ✅ Zero possibilità di ban
 * - ✅ Dati sempre aggiornati in tempo reale
 */

const { dbAll, dbGet, dbRun } = require('../crypto_db');

const KLINE_INTERVAL = '15m';
const KLINE_INTERVAL_MS = 15 * 60 * 1000; // 15 minuti

// Carica simboli validi da TradingBot.js
let VALID_SYMBOLS = [];
try {
    const TradingBot = require('./TradingBot');
    // Estrai SYMBOL_TO_PAIR dal file se non è esportato
    const fs = require('fs');
    const path = require('path');
    const tradingBotPath = path.join(__dirname, 'TradingBot.js');
    const content = fs.readFileSync(tradingBotPath, 'utf8');
    const symbolToPairMatch = content.match(/const SYMBOL_TO_PAIR = \{([\s\S]*?)\};/);
    if (symbolToPairMatch) {
        const symbolMatches = symbolToPairMatch[1].match(/'([^']+)':/g);
        if (symbolMatches) {
            VALID_SYMBOLS = symbolMatches.map(match => match.match(/'([^']+)':/)[1]);
            // Rimuovi uniswap_eur (non disponibile)
            VALID_SYMBOLS = VALID_SYMBOLS.filter(s => s !== 'uniswap_eur');
        }
    }
} catch (error) {
    console.error('⚠️  [KLINES-AGGREGATOR] Errore caricamento simboli validi:', error.message);
}

class KlinesAggregatorService {
    constructor() {
        this.aggregationInterval = null;
        this.isRunning = false;
    }

    /**
     * Avvia l'aggregatore (esegue ogni 15 minuti)
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  [KLINES-AGGREGATOR] Già in esecuzione');
            return;
        }

        this.isRunning = true;
        console.log('🚀 [KLINES-AGGREGATOR] Avvio aggregatore klines da WebSocket');
        console.log(`   • Intervallo: ${KLINE_INTERVAL} (${KLINE_INTERVAL_MS / 1000 / 60} minuti)`);

        // Esegui immediatamente
        this.aggregateAllSymbols().catch(err => {
            console.error('❌ [KLINES-AGGREGATOR] Errore prima aggregazione:', err.message);
        });

        // Poi ogni 15 minuti
        this.aggregationInterval = setInterval(() => {
            this.aggregateAllSymbols().catch(err => {
                console.error('❌ [KLINES-AGGREGATOR] Errore aggregazione periodica:', err.message);
            });
        }, KLINE_INTERVAL_MS);

        console.log('✅ [KLINES-AGGREGATOR] Aggregatore avviato');
    }

    /**
     * Ferma l'aggregatore
     */
    stop() {
        if (this.aggregationInterval) {
            clearInterval(this.aggregationInterval);
            this.aggregationInterval = null;
        }
        this.isRunning = false;
        console.log('🛑 [KLINES-AGGREGATOR] Aggregatore fermato');
    }

    /**
     * Aggrega klines per tutti i simboli attivi
     */
    async aggregateAllSymbols() {
        try {
            console.log(`[${new Date().toISOString()}] 🔄 [KLINES-AGGREGATOR] Inizio aggregazione...`);

            // ✅ FIX CRITICO: Carica sempre isValidSymbol da cryptoRoutes per validazione corretta
            let isValidSymbol = null;
            try {
                const cryptoRoutes = require('../routes/cryptoRoutes');
                if (cryptoRoutes.isValidSymbol && typeof cryptoRoutes.isValidSymbol === 'function') {
                    isValidSymbol = cryptoRoutes.isValidSymbol;
                }
            } catch (error) {
                console.error('⚠️  [KLINES-AGGREGATOR] Errore caricamento isValidSymbol:', error.message);
            }

            // ✅ FIX CRITICO: Se isValidSymbol non è stato caricato, riprova
            if (!isValidSymbol) {
                try {
                    const cryptoRoutes = require('../routes/cryptoRoutes');
                    if (cryptoRoutes.isValidSymbol && typeof cryptoRoutes.isValidSymbol === 'function') {
                        isValidSymbol = cryptoRoutes.isValidSymbol;
                        console.log('✅ [KLINES-AGGREGATOR] isValidSymbol caricato correttamente');
                    }
                } catch (error) {
                    console.error('❌ [KLINES-AGGREGATOR] Errore critico: isValidSymbol non disponibile:', error.message);
                }
            }

            // Filtra solo simboli validi - usa fallback se VALID_SYMBOLS è vuoto
            if (VALID_SYMBOLS.length === 0) {
                console.log('⚠️  [KLINES-AGGREGATOR] VALID_SYMBOLS vuoto - uso fallback con isValidSymbol da cryptoRoutes');
                const symbols = await dbAll(
                    `SELECT DISTINCT symbol 
                     FROM price_history 
                     WHERE timestamp > NOW() - INTERVAL '30 minutes'`
                );
                if (symbols.length === 0) {
                    console.log('⚠️  [KLINES-AGGREGATOR] Nessun simbolo con dati recenti');
                    return;
                }
                
                // ✅ FIX CRITICO: Se isValidSymbol è disponibile, filtra; altrimenti usa tutti i simboli (con warning)
                let validSymbols;
                if (isValidSymbol) {
                    console.log(`   • Filtro ${symbols.length} simboli con isValidSymbol...`);
                    const invalidSymbols = [];
                    validSymbols = symbols.filter(({ symbol }) => {
                        const isValid = isValidSymbol(symbol);
                        if (!isValid && invalidSymbols.length < 10) {
                            invalidSymbols.push(symbol);
                        }
                        return isValid;
                    });
                    console.log(`   • ${validSymbols.length} simboli validi (${symbols.length - validSymbols.length} filtrati)`);
                    if (invalidSymbols.length > 0) {
                        console.log(`   • Esempi simboli filtrati: ${invalidSymbols.slice(0, 5).join(', ')}`);
                    }
                } else {
                    console.warn('⚠️  [KLINES-AGGREGATOR] isValidSymbol non disponibile - uso TUTTI i simboli (rischio simboli non validi)');
                    validSymbols = symbols;
                }
                
                if (validSymbols.length === 0) {
                    console.warn('⚠️  [KLINES-AGGREGATOR] NESSUN simbolo valido dopo filtro - verifica formato simboli nel database');
                    return;
                }
                
                let aggregated = 0;
                let failed = 0;
                for (const { symbol } of validSymbols) {
                    try {
                        const success = await this.aggregateKlineForSymbol(symbol);
                        if (success) {
                            aggregated++;
                        } else {
                            failed++;
                            if (failed <= 3) {
                                console.log(`   ⚠️  [KLINES-AGG] Fallito aggregazione per ${symbol} (nessun dato nell'intervallo o simbolo non valido)`);
                            }
                        }
                    } catch (error) {
                        failed++;
                        if (failed <= 3) {
                            console.error(`   ❌ [KLINES-AGG] Errore aggregazione ${symbol}:`, error.message);
                        }
                    }
                }
                console.log(`✅ [KLINES-AGGREGATOR] Aggregazione completata: ${aggregated}/${validSymbols.length} simboli (${failed} falliti)`);
                return;
            }

            // ✅ FIX: isValidSymbol è già caricato all'inizio della funzione - usa quello per doppia validazione

            // Crea lista SQL per filtrare solo simboli validi
            const validSymbolsSQL = VALID_SYMBOLS.map(s => `'${s.replace(/'/g, "''")}'`).join(',');

            // Ottieni simboli che hanno price_history recente E sono validi
            const symbols = await dbAll(
                `SELECT DISTINCT symbol 
                 FROM price_history 
                 WHERE timestamp > NOW() - INTERVAL '30 minutes'
                   AND symbol IN (${validSymbolsSQL})`
            );

            if (symbols.length === 0) {
                console.log('⚠️  [KLINES-AGGREGATOR] Nessun simbolo valido con dati recenti');
                return;
            }

            // ✅ FIX: Doppia validazione usando isValidSymbol (più robusto)
            const validSymbols = isValidSymbol 
                ? symbols.filter(({ symbol }) => isValidSymbol(symbol))
                : symbols;

            if (validSymbols.length < symbols.length) {
                console.log(`   • Filtro ${symbols.length} simboli: ${validSymbols.length} validi, ${symbols.length - validSymbols.length} filtrati`);
            }

            console.log(`   • Aggregando ${validSymbols.length} simboli validi...`);

            let aggregated = 0;
            for (const { symbol } of validSymbols) {
                const success = await this.aggregateKlineForSymbol(symbol);
                if (success) {
                    aggregated++;
                }
            }

            console.log(`✅ [KLINES-AGGREGATOR] Aggregazione completata: ${aggregated}/${symbols.length} simboli`);
        } catch (error) {
            console.error('❌ [KLINES-AGGREGATOR] Errore aggregazione:', error.message);
        }
    }

    /**
     * Aggrega kline per un simbolo specifico
     */
    async aggregateKlineForSymbol(symbol) {
        try {
            // Calcola finestra temporale per l'ultima kline completata
            const now = Date.now();
            const currentKlineStart = Math.floor(now / KLINE_INTERVAL_MS) * KLINE_INTERVAL_MS;
            const previousKlineStart = currentKlineStart - KLINE_INTERVAL_MS;
            const previousKlineEnd = currentKlineStart;

            // Recupera prezzi nell'intervallo
            const prices = await dbAll(
                `SELECT price, timestamp 
                 FROM price_history 
                 WHERE symbol = $1 
                   AND timestamp >= $2 
                   AND timestamp < $3
                 ORDER BY timestamp ASC`,
                [
                    symbol,
                    new Date(previousKlineStart).toISOString(),
                    new Date(previousKlineEnd).toISOString()
                ]
            );

            if (prices.length === 0) {
                // Nessun dato nell'intervallo - normale per simboli poco attivi
                return false;
            }

            // Calcola OHLC
            const priceValues = prices.map(p => parseFloat(p.price));
            const kline = {
                symbol,
                interval: KLINE_INTERVAL,
                open_time: previousKlineStart,
                open_price: priceValues[0],
                high_price: Math.max(...priceValues),
                low_price: Math.min(...priceValues),
                close_price: priceValues[priceValues.length - 1],
                volume: 0, // Volume non disponibile da price_history
                close_time: previousKlineEnd
            };

            // Valida kline
            if (kline.high_price < kline.low_price ||
                kline.close_price > kline.high_price ||
                kline.close_price < kline.low_price) {
                console.warn(`⚠️  [KLINES-AGGREGATOR] Kline invalida per ${symbol} - skip`);
                return false;
            }

            // ✅ FIX CRITICO: Verifica che il simbolo sia valido PRIMA di inserire
            // Carica SYMBOL_TO_PAIR da cryptoRoutes
            let isValid = false;
            try {
                const cryptoRoutes = require('../routes/cryptoRoutes');
                if (cryptoRoutes.isValidSymbol && typeof cryptoRoutes.isValidSymbol === 'function') {
                    isValid = cryptoRoutes.isValidSymbol(kline.symbol);
                } else {
                    // Fallback: verifica direttamente nella mappa
                    const SYMBOL_TO_PAIR = cryptoRoutes.SYMBOL_TO_PAIR || {};
                    isValid = SYMBOL_TO_PAIR.hasOwnProperty(kline.symbol?.toLowerCase()?.trim());
                }
            } catch (error) {
                console.warn(`⚠️  [KLINES-AGG] Errore verifica simbolo ${kline.symbol}:`, error.message);
                isValid = false;
            }
            
            if (!isValid) {
                // ✅ DEBUG: Log solo occasionalmente per non spammare
                if (Math.random() < 0.1) {
                    console.warn(`🚫 [KLINES-AGG] Simbolo non valido BLOCCATO: ${kline.symbol} (non in SYMBOL_TO_PAIR) - NESSUNA kline verrà creata`);
                }
                return false;
            }
            
            // Salva nel database
            await dbRun(
                `INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (symbol, interval, open_time) 
                 DO UPDATE SET 
                     open_price = EXCLUDED.open_price,
                     high_price = EXCLUDED.high_price,
                     low_price = EXCLUDED.low_price,
                     close_price = EXCLUDED.close_price,
                     close_time = EXCLUDED.close_time`,
                [
                    kline.symbol,
                    kline.interval,
                    kline.open_time,
                    kline.open_price,
                    kline.high_price,
                    kline.low_price,
                    kline.close_price,
                    kline.volume,
                    kline.close_time
                ]
            );

            // Log solo occasionalmente per non spammare
            if (Math.random() < 0.1) {
                console.log(`💾 [KLINES-AGGREGATOR] Kline salvata: ${symbol} @ ${new Date(kline.open_time).toISOString()} (${prices.length} prezzi aggregati)`);
            }

            return true;
        } catch (error) {
            console.error(`❌ [KLINES-AGGREGATOR] Errore aggregazione ${symbol}:`, error.message);
            return false;
        }
    }

    /**
     * Aggrega manualmente kline per un simbolo e timeframe specifico
     */
    async aggregateManual(symbol, startTime, endTime) {
        try {
            const prices = await dbAll(
                `SELECT price, timestamp 
                 FROM price_history 
                 WHERE symbol = $1 
                   AND timestamp >= $2 
                   AND timestamp < $3
                 ORDER BY timestamp ASC`,
                [
                    symbol,
                    new Date(startTime).toISOString(),
                    new Date(endTime).toISOString()
                ]
            );

            if (prices.length === 0) {
                return null;
            }

            const priceValues = prices.map(p => parseFloat(p.price));
            return {
                open: priceValues[0],
                high: Math.max(...priceValues),
                low: Math.min(...priceValues),
                close: priceValues[priceValues.length - 1],
                dataPoints: prices.length
            };
        } catch (error) {
            console.error(`❌ [KLINES-AGGREGATOR] Errore aggregazione manuale:`, error.message);
            return null;
        }
    }

    /**
     * Verifica stato aggregatore
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            interval: KLINE_INTERVAL,
            intervalMs: KLINE_INTERVAL_MS
        };
    }
}

module.exports = new KlinesAggregatorService();


