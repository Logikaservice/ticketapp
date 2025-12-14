/**
 * 🔍 VERIFICA DATI STORICI E KLINES
 * 
 * Script per verificare se nel database mancano klines o dati storici.
 * Controlla:
 * - Quantità di klines per simbolo
 * - Gap temporali nelle klines
 * - Dati price_history
 * - Allineamento tra klines e price_history
 */

const { dbAll, dbGet } = require('../crypto_db');

const KLINE_INTERVAL = '15m';
const KLINE_INTERVAL_MS = 15 * 60 * 1000; // 15 minuti in millisecondi
const MIN_KLINES_REQUIRED = 50; // Minimo klines richieste
const LOOKBACK_DAYS = 30; // Giorni da verificare
const MAX_PRICE = 100000;
const MIN_PRICE = 0.000001;

// ===== LOGGER =====
const log = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    warn: (msg) => console.warn(`⚠️  ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    section: (msg) => console.log(`\n${'='.repeat(60)}\n📊 ${msg}\n${'='.repeat(60)}`)
};

/**
 * Trova gap temporali nelle klines
 */
async function findKlinesGaps(symbol) {
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
                const missingCount = Math.floor((currTime - expectedTime) / KLINE_INTERVAL_MS);
                gaps.push({
                    from: prevTime,
                    to: currTime,
                    missing: missingCount,
                    fromDate: new Date(prevTime).toISOString(),
                    toDate: new Date(currTime).toISOString()
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
async function findAnomalousKlines(symbol) {
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
                    reason: 'Prezzo fuori range',
                    prices: { open, high, low, close }
                });
                continue;
            }
            
            // Verifica che high >= low e close nel range
            if (high < low || close > high || close < low) {
                anomalous.push({
                    open_time: kline.open_time,
                    reason: 'Range invalido (high < low o close fuori range)',
                    prices: { open, high, low, close }
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
 * Verifica un simbolo
 */
async function verifySymbol(symbol) {
    try {
        // 1. Conta klines
        const klinesCount = await dbGet(
            `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2`,
            [symbol, KLINE_INTERVAL]
        );
        const count = parseInt(klinesCount?.count || 0);

        // 2. Range temporale
        const timeRange = await dbGet(
            `SELECT 
                MIN(open_time) as first_time,
                MAX(open_time) as last_time
             FROM klines 
             WHERE symbol = $1 AND interval = $2`,
            [symbol, KLINE_INTERVAL]
        );

        const firstTime = timeRange?.first_time ? parseInt(timeRange.first_time) : null;
        const lastTime = timeRange?.last_time ? parseInt(timeRange.last_time) : null;
        const firstDate = firstTime ? new Date(firstTime).toISOString() : null;
        const lastDate = lastTime ? new Date(lastTime).toISOString() : null;
        const daysSpan = firstTime && lastTime 
            ? (lastTime - firstTime) / (1000 * 60 * 60 * 24) 
            : 0;

        // 3. Verifica gap
        const gaps = await findKlinesGaps(symbol);

        // 4. Verifica prezzi anomali
        const anomalous = await findAnomalousKlines(symbol);

        // 5. Conta price_history
        const priceHistoryCount = await dbGet(
            `SELECT COUNT(*) as count FROM price_history WHERE symbol = $1`,
            [symbol]
        );
        const phCount = parseInt(priceHistoryCount?.count || 0);

        // 6. Ultimo prezzo da price_history
        const lastPrice = await dbGet(
            `SELECT price, timestamp FROM price_history 
             WHERE symbol = $1 
             ORDER BY timestamp DESC LIMIT 1`,
            [symbol]
        );

        // 7. Ultima kline
        const lastKline = await dbGet(
            `SELECT close_price, open_time FROM klines 
             WHERE symbol = $1 AND interval = $2 
             ORDER BY open_time DESC LIMIT 1`,
            [symbol, KLINE_INTERVAL]
        );

        // 8. Verifica allineamento prezzi
        let alignment = null;
        if (lastPrice && lastKline) {
            const klinePrice = parseFloat(lastKline.close_price);
            const historyPrice = parseFloat(lastPrice.price);
            if (klinePrice > 0 && historyPrice > 0) {
                const diffPct = Math.abs((klinePrice - historyPrice) / klinePrice) * 100;
                alignment = {
                    klinePrice,
                    historyPrice,
                    diffPct: diffPct.toFixed(2)
                };
            }
        }

        // 9. Verifica dati recenti (ultimi 7 giorni)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const recentKlines = await dbGet(
            `SELECT COUNT(*) as count FROM klines 
             WHERE symbol = $1 AND interval = $2 AND open_time >= $3`,
            [symbol, KLINE_INTERVAL, sevenDaysAgo]
        );
        const recentCount = parseInt(recentKlines?.count || 0);
        const expectedRecent = 7 * 24 * 4; // 7 giorni * 24 ore * 4 candele/ora (15m)
        const recentCoverage = recentCount / expectedRecent * 100;

        return {
            symbol,
            klinesCount: count,
            firstDate,
            lastDate,
            daysSpan: daysSpan.toFixed(1),
            gaps: gaps.length,
            gapsDetails: gaps,
            anomalous: anomalous.length,
            anomalousDetails: anomalous,
            priceHistoryCount: phCount,
            lastPrice: lastPrice ? parseFloat(lastPrice.price) : null,
            lastPriceTime: lastPrice ? lastPrice.timestamp : null,
            lastKlinePrice: lastKline ? parseFloat(lastKline.close_price) : null,
            lastKlineTime: lastKline ? new Date(parseInt(lastKline.open_time)).toISOString() : null,
            alignment,
            recentKlines: recentCount,
            recentCoverage: recentCoverage.toFixed(1),
            valid: count >= MIN_KLINES_REQUIRED && gaps.length === 0 && anomalous.length === 0
        };
    } catch (error) {
        log.error(`Errore verifica ${symbol}: ${error.message}`);
        return {
            symbol,
            error: error.message,
            valid: false
        };
    }
}

/**
 * Main function
 */
async function main() {
    try {
        log.section('VERIFICA DATI STORICI E KLINES');

        // 1. Ottieni simboli da verificare
        log.info('Recupero simboli da verificare...');
        
        // Prima prova a recuperare simboli attivi
        const activeSymbolsFromSettings = await dbAll(
            `SELECT DISTINCT symbol FROM bot_settings WHERE is_active = 1`
        );
        
        // Poi recupera tutti i simboli che hanno klines
        const allSymbolsFromKlines = await dbAll(`SELECT DISTINCT symbol FROM klines ORDER BY symbol`);
        
        // Combina e rimuovi duplicati
        const symbolSet = new Set();
        activeSymbolsFromSettings.forEach(s => symbolSet.add(s.symbol));
        allSymbolsFromKlines.forEach(s => symbolSet.add(s.symbol));
        
        const symbolsToCheck = Array.from(symbolSet).map(s => ({ symbol: s }));
        
        if (symbolsToCheck.length === 0) {
            log.error('Nessun simbolo trovato nel database');
            process.exit(1);
        }

        log.info(`Trovati ${activeSymbolsFromSettings.length} simboli attivi in bot_settings`);
        log.info(`Trovati ${allSymbolsFromKlines.length} simboli con klines nel database`);
        log.success(`Verificando ${symbolsToCheck.length} simboli totali (attivi + con dati)`);

        // 2. Verifica ogni simbolo
        const results = [];
        for (const { symbol } of symbolsToCheck) {
            // Verifica se è attivo
            const isActive = activeSymbolsFromSettings.some(s => s.symbol === symbol);
            log.info(`Verificando ${symbol}${isActive ? ' (ATTIVO)' : ''}...`);
            const result = await verifySymbol(symbol);
            result.isActive = isActive;
            results.push(result);
        }

        // 3. Report completo
        log.section('REPORT COMPLETO');

        // Statistiche generali
        const totalKlines = results.reduce((sum, r) => sum + (r.klinesCount || 0), 0);
        const totalGaps = results.reduce((sum, r) => sum + (r.gaps || 0), 0);
        const totalAnomalous = results.reduce((sum, r) => sum + (r.anomalous || 0), 0);
        const validSymbols = results.filter(r => r.valid).length;

        console.log(`\n📊 STATISTICHE GENERALI:`);
        console.log(`   • Simboli verificati: ${results.length}`);
        console.log(`   • Simboli validi: ${validSymbols}/${results.length}`);
        console.log(`   • Totale klines: ${totalKlines.toLocaleString()}`);
        console.log(`   • Totale gap trovati: ${totalGaps}`);
        console.log(`   • Totale klines anomale: ${totalAnomalous}`);

        // Dettaglio per simbolo
        console.log(`\n📋 DETTAGLIO PER SIMBOLO:\n`);
        
        for (const result of results) {
            if (result.error) {
                console.log(`❌ ${result.symbol}${result.isActive ? ' (ATTIVO)' : ''}: ERRORE - ${result.error}`);
                continue;
            }

            const status = result.valid ? '✅' : '⚠️';
            const activeLabel = result.isActive ? ' [ATTIVO]' : '';
            console.log(`${status} ${result.symbol}${activeLabel}:`);
            console.log(`   • Klines: ${result.klinesCount.toLocaleString()} (min richiesto: ${MIN_KLINES_REQUIRED})`);
            
            if (result.firstDate && result.lastDate) {
                console.log(`   • Periodo: ${result.firstDate} → ${result.lastDate}`);
                console.log(`   • Copertura: ${result.daysSpan} giorni`);
            } else {
                console.log(`   • Periodo: NESSUN DATO`);
            }

            console.log(`   • Klines ultimi 7 giorni: ${result.recentKlines} (${result.recentCoverage}% copertura)`);
            
            if (result.gaps > 0) {
                console.log(`   ⚠️  Gap trovati: ${result.gaps}`);
                if (result.gapsDetails && result.gapsDetails.length > 0) {
                    const firstGap = result.gapsDetails[0];
                    console.log(`      Esempio gap: ${firstGap.fromDate} → ${firstGap.toDate} (mancano ~${firstGap.missing} candele)`);
                }
            } else {
                console.log(`   ✅ Nessun gap rilevato`);
            }

            if (result.anomalous > 0) {
                console.log(`   ⚠️  Klines anomale: ${result.anomalous}`);
            } else {
                console.log(`   ✅ Nessuna kline anomala`);
            }

            console.log(`   • Price history: ${result.priceHistoryCount.toLocaleString()} record`);
            
            if (result.lastKlinePrice && result.lastPrice) {
                console.log(`   • Ultimo prezzo kline: $${result.lastKlinePrice.toFixed(2)} (${result.lastKlineTime})`);
                console.log(`   • Ultimo prezzo history: $${result.lastPrice.toFixed(2)} (${result.lastPriceTime})`);
                
                if (result.alignment) {
                    if (parseFloat(result.alignment.diffPct) > 5) {
                        console.log(`   ⚠️  Prezzi non allineati: differenza ${result.alignment.diffPct}%`);
                    } else {
                        console.log(`   ✅ Prezzi allineati: differenza ${result.alignment.diffPct}%`);
                    }
                }
            } else {
                console.log(`   ⚠️  Dati prezzi mancanti`);
            }

            console.log('');
        }

        // 4. Simboli con problemi
        const problematicSymbols = results.filter(r => !r.valid && !r.error);
        if (problematicSymbols.length > 0) {
            log.section('SIMBOLI CON PROBLEMI');
            for (const result of problematicSymbols) {
                console.log(`\n⚠️  ${result.symbol}:`);
                if (result.klinesCount < MIN_KLINES_REQUIRED) {
                    console.log(`   • Klines insufficienti: ${result.klinesCount}/${MIN_KLINES_REQUIRED}`);
                }
                if (result.gaps > 0) {
                    console.log(`   • Gap temporali: ${result.gaps}`);
                }
                if (result.anomalous > 0) {
                    console.log(`   • Klines anomale: ${result.anomalous}`);
                }
            }
        } else {
            log.success('Tutti i simboli hanno dati completi!');
        }

        // 5. Raccomandazioni
        log.section('RACCOMANDAZIONI');
        
        if (totalGaps > 0) {
            console.log(`⚠️  Trovati ${totalGaps} gap temporali.`);
            console.log(`   Esegui il recovery automatico o scarica manualmente i dati mancanti.`);
            console.log(`   Script disponibili:`);
            console.log(`   - backend/scripts/repopulate-from-websocket.js`);
            console.log(`   - backend/klines_recovery_daemon.js (se configurato)`);
        }

        if (totalAnomalous > 0) {
            console.log(`⚠️  Trovate ${totalAnomalous} klines con prezzi anomali.`);
            console.log(`   Esegui: node backend/scripts/clean-anomalous-prices.js`);
        }

        if (validSymbols < results.length) {
            console.log(`⚠️  ${results.length - validSymbols} simboli hanno dati insufficienti.`);
            console.log(`   Considera di scaricare dati storici per questi simboli.`);
        }

        if (totalGaps === 0 && totalAnomalous === 0 && validSymbols === results.length) {
            console.log(`✅ Tutti i simboli hanno dati completi e validi!`);
        }

        process.exit(0);
    } catch (error) {
        log.error(`Errore generale: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

// Esegui
main();

