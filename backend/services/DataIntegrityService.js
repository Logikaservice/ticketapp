/**
 * 🔍 DATA INTEGRITY SERVICE
 * 
 * Verifica e rigenera automaticamente i dati storici (klines, price_history)
 * necessari per le analisi del bot. Garantisce che i dati siano:
 * - Completi (no gap temporali)
 * - Allineati (klines e price_history sincronizzati)
 * - Validati (no prezzi anomali)
 * 
 * Questo servizio viene chiamato PRIMA di ogni analisi per garantire
 * che il bot non faccia analisi su dati incompleti o corrotti.
 */

const { dbGet, dbAll, dbRun } = require('../crypto_db');
const https = require('https');
// ✅ FIX: Carica SYMBOL_TO_PAIR da TradingBot.js (fonte di verità) invece di cryptoRoutes.js
const TradingBot = require('./TradingBot');
const SYMBOL_TO_PAIR = TradingBot.SYMBOL_TO_PAIR || {};

// Helper per HTTPS requests (simile a PriceService)
function httpsGet(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            if (res.statusCode !== 200) {
                let errorData = '';
                res.on('data', (chunk) => errorData += chunk);
                res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${errorData.substring(0, 200)}`)));
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`));
                }
            });
        });
        req.on('error', (err) => reject(err));
        req.setTimeout(timeout, () => { req.destroy(); reject(new Error(`Request timeout after ${timeout}ms`)); });
        req.end();
    });
}

// ===== CONFIGURAZIONE =====
const MIN_KLINES_REQUIRED = 50; // Minimo klines richieste per analisi
const MIN_PRICE_HISTORY_REQUIRED = 50; // Minimo price_history richieste
const KLINE_INTERVAL = '15m'; // Timeframe principale
const LOOKBACK_DAYS = 30; // Giorni di storico da mantenere
const KLINE_INTERVAL_MS = 15 * 60 * 1000; // 15 minuti in millisecondi
const MAX_PRICE = 100000;
const MIN_PRICE = 0.000001;

// ===== LOGGER =====
const log = {
    info: (msg) => console.log(`[DATA-INTEGRITY] ℹ️  ${msg}`),
    success: (msg) => console.log(`[DATA-INTEGRITY] ✅ ${msg}`),
    warn: (msg) => console.warn(`[DATA-INTEGRITY] ⚠️  ${msg}`),
    error: (msg) => console.error(`[DATA-INTEGRITY] ❌ ${msg}`),
    recovery: (msg) => console.log(`[DATA-INTEGRITY] 🔄 ${msg}`)
};

class DataIntegrityService {
    /**
     * Verifica e rigenera i dati per un simbolo
     * @param {string} symbol - Simbolo da verificare (es. 'bitcoin')
     * @returns {Promise<{valid: boolean, klinesCount: number, priceHistoryCount: number, gaps: number, regenerated: boolean}>}
     */
    async verifyAndRegenerate(symbol) {
        try {
            // ✅ FIX: Salta simboli non validi (non in SYMBOL_TO_PAIR)
            if (!SYMBOL_TO_PAIR || !SYMBOL_TO_PAIR[symbol]) {
                log.warn(`${symbol}: Simbolo non valido (non trovato in SYMBOL_TO_PAIR) - skip verifica`);
                return {
                    valid: false,
                    klinesCount: 0,
                    priceHistoryCount: 0,
                    gaps: 0,
                    regenerated: false,
                    issues: [`Simbolo ${symbol} non valido (non in SYMBOL_TO_PAIR)`]
                };
            }
            
            log.info(`Verifica integrità dati per ${symbol}...`);
            
            // 1. Verifica klines
            const klinesCheck = await this.verifyKlines(symbol);
            
            // 2. Verifica price_history
            const priceHistoryCheck = await this.verifyPriceHistory(symbol);
            
            // 3. Verifica allineamento
            const alignmentCheck = await this.verifyAlignment(symbol);
            
            // 4. Se ci sono problemi, rigenera
            let regenerated = false;
            if (!klinesCheck.valid || !priceHistoryCheck.valid || !alignmentCheck.aligned) {
                log.warn(`${symbol}: Dati incompleti o non allineati. Rigenerazione in corso...`);
                regenerated = await this.regenerateData(symbol);
            }
            
            // 5. Verifica finale
            const finalCheck = await this.finalVerification(symbol);
            
            return {
                valid: finalCheck.valid,
                klinesCount: finalCheck.klinesCount,
                priceHistoryCount: finalCheck.priceHistoryCount,
                gaps: finalCheck.gaps,
                regenerated: regenerated,
                issues: finalCheck.issues
            };
            
        } catch (error) {
            log.error(`Errore verifica ${symbol}: ${error.message}`);
            return {
                valid: false,
                klinesCount: 0,
                priceHistoryCount: 0,
                gaps: 0,
                regenerated: false,
                issues: [error.message]
            };
        }
    }
    
    /**
     * Verifica integrità klines
     */
    async verifyKlines(symbol) {
        try {
            // Conta klines totali
            const countResult = await dbGet(
                `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2`,
                [symbol, KLINE_INTERVAL]
            );
            const count = parseInt(countResult?.count || 0);
            
            if (count < MIN_KLINES_REQUIRED) {
                return {
                    valid: false,
                    count: count,
                    required: MIN_KLINES_REQUIRED,
                    issue: `Klines insufficienti: ${count}/${MIN_KLINES_REQUIRED}`
                };
            }
            
            // Verifica gap temporali
            const gaps = await this.findKlinesGaps(symbol);
            
            if (gaps.length > 0) {
                return {
                    valid: false,
                    count: count,
                    gaps: gaps.length,
                    issue: `Trovati ${gaps.length} gap temporali nelle klines`
                };
            }
            
            // Verifica prezzi anomali
            const anomalous = await this.findAnomalousKlines(symbol);
            
            if (anomalous.length > 0) {
                return {
                    valid: false,
                    count: count,
                    anomalous: anomalous.length,
                    issue: `Trovate ${anomalous.length} klines con prezzi anomali`
                };
            }
            
            return {
                valid: true,
                count: count,
                gaps: 0,
                anomalous: 0
            };
            
        } catch (error) {
            log.error(`Errore verifica klines ${symbol}: ${error.message}`);
            return {
                valid: false,
                count: 0,
                issue: error.message
            };
        }
    }
    
    /**
     * Verifica integrità price_history
     */
    async verifyPriceHistory(symbol) {
        try {
            // Conta price_history totali
            const countResult = await dbGet(
                `SELECT COUNT(*) as count FROM price_history WHERE symbol = $1`,
                [symbol]
            );
            const count = parseInt(countResult?.count || 0);
            
            if (count < MIN_PRICE_HISTORY_REQUIRED) {
                return {
                    valid: false,
                    count: count,
                    required: MIN_PRICE_HISTORY_REQUIRED,
                    issue: `Price history insufficiente: ${count}/${MIN_PRICE_HISTORY_REQUIRED}`
                };
            }
            
            // Verifica prezzi anomali
            const anomalous = await this.findAnomalousPrices(symbol);
            
            if (anomalous.length > 0) {
                return {
                    valid: false,
                    count: count,
                    anomalous: anomalous.length,
                    issue: `Trovati ${anomalous.length} prezzi anomali in price_history`
                };
            }
            
            return {
                valid: true,
                count: count,
                anomalous: 0
            };
            
        } catch (error) {
            log.error(`Errore verifica price_history ${symbol}: ${error.message}`);
            return {
                valid: false,
                count: 0,
                issue: error.message
            };
        }
    }
    
    /**
     * Verifica allineamento tra klines e price_history
     */
    async verifyAlignment(symbol) {
        try {
            // Ottieni ultime klines
            const klines = await dbAll(
                `SELECT open_time, close_price FROM klines 
                 WHERE symbol = $1 AND interval = $2 
                 ORDER BY open_time DESC LIMIT 10`,
                [symbol, KLINE_INTERVAL]
            );
            
            // Ottieni ultimi price_history
            const priceHistory = await dbAll(
                `SELECT timestamp, price FROM price_history 
                 WHERE symbol = $1 
                 ORDER BY timestamp DESC LIMIT 10`,
                [symbol]
            );
            
            if (klines.length === 0 || priceHistory.length === 0) {
                return {
                    aligned: false,
                    issue: 'Dati insufficienti per verifica allineamento'
                };
            }
            
            // Verifica che i prezzi siano simili (max 5% differenza)
            const lastKline = klines[0];
            const lastPrice = priceHistory[0];
            
            const klinePrice = parseFloat(lastKline.close_price);
            const historyPrice = parseFloat(lastPrice.price);
            
            if (klinePrice === 0 || historyPrice === 0) {
                return {
                    aligned: false,
                    issue: 'Prezzi zero rilevati'
                };
            }
            
            const diffPct = Math.abs((klinePrice - historyPrice) / klinePrice) * 100;
            
            if (diffPct > 5) {
                return {
                    aligned: false,
                    issue: `Prezzi non allineati: kline=${klinePrice}, history=${historyPrice} (diff: ${diffPct.toFixed(2)}%)`
                };
            }
            
            return {
                aligned: true,
                diffPct: diffPct
            };
            
        } catch (error) {
            log.error(`Errore verifica allineamento ${symbol}: ${error.message}`);
            return {
                aligned: false,
                issue: error.message
            };
        }
    }
    
    /**
     * Trova gap temporali nelle klines
     */
    async findKlinesGaps(symbol) {
        try {
            const klines = await dbAll(
                `SELECT open_time FROM klines 
                 WHERE symbol = $1 AND interval = $2 
                 ORDER BY open_time ASC`,
                [symbol, KLINE_INTERVAL]
            );
            
            if (klines.length < 2) {
                return [];
            }
            
            const gaps = [];
            for (let i = 1; i < klines.length; i++) {
                const prevTime = parseInt(klines[i - 1].open_time);
                const currTime = parseInt(klines[i].open_time);
                const expectedTime = prevTime + KLINE_INTERVAL_MS;
                
                // Gap se differenza > 1.5x l'intervallo (tolleranza per ritardi)
                if (currTime - expectedTime > KLINE_INTERVAL_MS * 1.5) {
                    gaps.push({
                        from: prevTime,
                        to: currTime,
                        missing: Math.floor((currTime - expectedTime) / KLINE_INTERVAL_MS)
                    });
                }
            }
            
            return gaps;
            
        } catch (error) {
            log.error(`Errore ricerca gap klines ${symbol}: ${error.message}`);
            return [];
        }
    }
    
    /**
     * Trova klines con prezzi anomali
     */
    async findAnomalousKlines(symbol) {
        try {
            const klines = await dbAll(
                `SELECT open_time, open_price, high_price, low_price, close_price 
                 FROM klines 
                 WHERE symbol = $1 AND interval = $2`,
                [symbol, KLINE_INTERVAL]
            );
            
            const anomalous = [];
            
            for (const kline of klines) {
                const open = parseFloat(kline.open_price);
                const high = parseFloat(kline.high_price);
                const low = parseFloat(kline.low_price);
                const close = parseFloat(kline.close_price);
                
                // Verifica range prezzi
                if (open > MAX_PRICE || open < MIN_PRICE ||
                    high > MAX_PRICE || high < MIN_PRICE ||
                    low > MAX_PRICE || low < MIN_PRICE ||
                    close > MAX_PRICE || close < MIN_PRICE) {
                    anomalous.push({
                        open_time: kline.open_time,
                        reason: 'Prezzo fuori range'
                    });
                    continue;
                }
                
                // Verifica che high >= low e close nel range
                if (high < low || close > high || close < low) {
                    anomalous.push({
                        open_time: kline.open_time,
                        reason: 'Range invalido (high < low o close fuori range)'
                    });
                }
            }
            
            return anomalous;
            
        } catch (error) {
            log.error(`Errore ricerca klines anomale ${symbol}: ${error.message}`);
            return [];
        }
    }
    
    /**
     * Trova prezzi anomali in price_history
     */
    async findAnomalousPrices(symbol) {
        try {
            const prices = await dbAll(
                `SELECT timestamp, price FROM price_history WHERE symbol = $1 ORDER BY timestamp ASC`,
                [symbol]
            );
            
            const anomalous = [];
            
            for (const price of prices) {
                const priceValue = parseFloat(price.price);
                
                if (!Number.isFinite(priceValue) || priceValue <= 0 || 
                    priceValue > MAX_PRICE || priceValue < MIN_PRICE) {
                    anomalous.push({
                        timestamp: price.timestamp,
                        price: priceValue,
                        reason: 'Prezzo invalido o fuori range'
                    });
                }
            }
            
            return anomalous;
            
        } catch (error) {
            log.error(`Errore ricerca prezzi anomali ${symbol}: ${error.message}`);
            return [];
        }
    }
    
    /**
     * Rigenera i dati per un simbolo
     */
    async regenerateData(symbol) {
        try {
            log.recovery(`Rigenerazione dati per ${symbol}...`);
            
            const tradingPair = SYMBOL_TO_PAIR[symbol];
            if (!tradingPair) {
                throw new Error(`Simbolo ${symbol} non trovato in SYMBOL_TO_PAIR`);
            }
            
            // 1. Scarica klines da Binance
            const klinesDownloaded = await this.downloadKlinesFromBinance(symbol, tradingPair);
            
            // 2. Sincronizza price_history con klines
            await this.syncPriceHistoryFromKlines(symbol);
            
            // 3. Rimuovi dati vecchi (oltre LOOKBACK_DAYS)
            await this.cleanOldData(symbol);
            
            log.success(`${symbol}: Dati rigenerati - ${klinesDownloaded} klines scaricate`);
            
            return true;
            
        } catch (error) {
            log.error(`Errore rigenerazione ${symbol}: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Scarica klines da Binance
     */
    async downloadKlinesFromBinance(symbol, tradingPair) {
        try {
            const endTime = Date.now();
            const startTime = endTime - (LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
            
            let allKlines = [];
            let currentStartTime = startTime;
            const limit = 1000; // Max per richiesta Binance
            
            log.recovery(`Scaricando klines per ${symbol} (${tradingPair}) da ${new Date(startTime).toISOString()} a ${new Date(endTime).toISOString()}...`);
            
            while (currentStartTime < endTime && allKlines.length < limit * 10) {
                const url = `https://api.binance.com/api/v3/klines?symbol=${tradingPair}&interval=${KLINE_INTERVAL}&startTime=${currentStartTime}&limit=${limit}`;
                
                try {
                    const klines = await httpsGet(url, 15000);
                    
                    if (!Array.isArray(klines) || klines.length === 0) {
                        break;
                    }
                    
                    // Filtra e valida klines
                    const validKlines = klines.filter(k => {
                        const open = parseFloat(k[1]);
                        const high = parseFloat(k[2]);
                        const low = parseFloat(k[3]);
                        const close = parseFloat(k[4]);
                        
                        // Valida range prezzi
                        if (open > MAX_PRICE || open < MIN_PRICE ||
                            high > MAX_PRICE || high < MIN_PRICE ||
                            low > MAX_PRICE || low < MIN_PRICE ||
                            close > MAX_PRICE || close < MIN_PRICE) {
                            return false;
                        }
                        
                        // Valida che high >= low e close nel range
                        if (high < low || close > high || close < low) {
                            return false;
                        }
                        
                        return true;
                    });
                    
                    allKlines.push(...validKlines);
                    
                    // Prossimo batch
                    currentStartTime = parseInt(klines[klines.length - 1][0]) + 1;
                    
                    // Evita rate limit
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error) {
                    log.warn(`Errore download batch ${symbol}: ${error.message}`);
                    break;
                }
            }
            
            if (allKlines.length === 0) {
                throw new Error('Nessuna kline scaricata da Binance');
            }
            
            // Salva nel database (upsert)
            let saved = 0;
            for (const kline of allKlines) {
                try {
                    await dbRun(
                        `INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                         ON CONFLICT (symbol, interval, open_time) 
                         DO UPDATE SET 
                             open_price = EXCLUDED.open_price,
                             high_price = EXCLUDED.high_price,
                             low_price = EXCLUDED.low_price,
                             close_price = EXCLUDED.close_price,
                             volume = EXCLUDED.volume,
                             close_time = EXCLUDED.close_time`,
                        [
                            symbol,
                            KLINE_INTERVAL,
                            parseInt(kline[0]),
                            parseFloat(kline[1]),
                            parseFloat(kline[2]),
                            parseFloat(kline[3]),
                            parseFloat(kline[4]),
                            parseFloat(kline[5]),
                            parseInt(kline[6])
                        ]
                    );
                    saved++;
                } catch (error) {
                    // Ignora errori di inserimento singolo
                }
            }
            
            log.success(`${symbol}: ${saved}/${allKlines.length} klines salvate nel database`);
            
            return saved;
            
        } catch (error) {
            log.error(`Errore download klines ${symbol}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Sincronizza price_history con klines
     */
    async syncPriceHistoryFromKlines(symbol) {
        try {
            // Ottieni ultime klines
            const klines = await dbAll(
                `SELECT open_time, close_price FROM klines 
                 WHERE symbol = $1 AND interval = $2 
                 ORDER BY open_time DESC LIMIT 100`,
                [symbol, KLINE_INTERVAL]
            );
            
            if (klines.length === 0) {
                return;
            }
            
            // Inserisci/aggiorna price_history con prezzi da klines
            let synced = 0;
            for (const kline of klines) {
                try {
                    await dbRun(
                        `INSERT INTO price_history (symbol, price, timestamp)
                         VALUES ($1, $2, $3)
                         ON CONFLICT (symbol, timestamp) 
                         DO UPDATE SET price = EXCLUDED.price`,
                        [
                            symbol,
                            parseFloat(kline.close_price),
                            new Date(parseInt(kline.open_time)).toISOString()
                        ]
                    );
                    synced++;
                } catch (error) {
                    // Ignora errori singoli
                }
            }
            
            log.success(`${symbol}: ${synced} price_history sincronizzati con klines`);
            
        } catch (error) {
            log.error(`Errore sincronizzazione price_history ${symbol}: ${error.message}`);
        }
    }
    
    /**
     * Rimuove dati vecchi oltre LOOKBACK_DAYS
     */
    async cleanOldData(symbol) {
        try {
            const cutoffTime = Date.now() - (LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
            
            // Rimuovi klines vecchie
            const klinesDeleted = await dbRun(
                `DELETE FROM klines WHERE symbol = $1 AND interval = $2 AND open_time < $3`,
                [symbol, KLINE_INTERVAL, cutoffTime]
            );
            
            // Rimuovi price_history vecchi
            const priceDeleted = await dbRun(
                `DELETE FROM price_history WHERE symbol = $1 AND timestamp < $2`,
                [symbol, new Date(cutoffTime).toISOString()]
            );
            
            if (klinesDeleted || priceDeleted) {
                log.info(`${symbol}: Dati vecchi rimossi (oltre ${LOOKBACK_DAYS} giorni)`);
            }
            
        } catch (error) {
            log.error(`Errore pulizia dati vecchi ${symbol}: ${error.message}`);
        }
    }
    
    /**
     * Verifica finale dopo rigenerazione
     */
    async finalVerification(symbol) {
        const klinesCheck = await this.verifyKlines(symbol);
        const priceHistoryCheck = await this.verifyPriceHistory(symbol);
        const alignmentCheck = await this.verifyAlignment(symbol);
        
        const issues = [];
        if (!klinesCheck.valid) issues.push(klinesCheck.issue);
        if (!priceHistoryCheck.valid) issues.push(priceHistoryCheck.issue);
        if (!alignmentCheck.aligned) issues.push(alignmentCheck.issue);
        
        return {
            valid: klinesCheck.valid && priceHistoryCheck.valid && alignmentCheck.aligned,
            klinesCount: klinesCheck.count || 0,
            priceHistoryCount: priceHistoryCheck.count || 0,
            gaps: klinesCheck.gaps || 0,
            issues: issues
        };
    }
}

module.exports = new DataIntegrityService();



