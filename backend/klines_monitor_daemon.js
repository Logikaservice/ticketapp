#!/usr/bin/env node

/**
 * 🔄 KLINES MONITOR DAEMON - Monitoraggio Continuo
 * 
 * Monitora continuamente i gap nelle klines e li recupera automaticamente.
 * Diverso dal recovery daemon notturno: questo verifica ogni X minuti.
 * 
 * Uso: node klines_monitor_daemon.js
 * PM2: pm2 start ecosystem-klines-monitor.config.js
 */

const cryptoDb = require('./crypto_db');
const https = require('https');
const SYMBOL_TO_PAIR = require('./routes/cryptoRoutes').SYMBOL_TO_PAIR || {};

// ===== CONFIGURAZIONE =====
const KLINE_INTERVAL = '15m';
const KLINE_INTERVAL_MS = 15 * 60 * 1000;
const CHECK_INTERVAL_MINUTES = 15; // Verifica ogni 15 minuti
const LOOKBACK_HOURS = 24; // Verifica ultime 24 ore
const MAX_PRICE = 100000;
const MIN_PRICE = 0.000001;
const BATCH_SIZE = 100;
const REQUEST_TIMEOUT = 15000;

// ===== LOGGER =====
const log = {
    info: (msg) => console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`),
    success: (msg) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
    warn: (msg) => console.warn(`[${new Date().toISOString()}] ⚠️  ${msg}`),
    error: (msg) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`),
    recovery: (msg) => console.log(`[${new Date().toISOString()}] 🔄 ${msg}`)
};

// ===== HELPER FUNCTIONS =====
function httpsGet(url, timeout = REQUEST_TIMEOUT) {
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

async function findRecentGaps(symbol) {
    try {
        const lookbackTime = Date.now() - (LOOKBACK_HOURS * 60 * 60 * 1000);
        
        const klines = await cryptoDb.dbAll(
            `SELECT open_time FROM klines 
             WHERE symbol = $1 AND interval = $2 AND open_time >= $3
             ORDER BY open_time ASC`,
            [symbol, KLINE_INTERVAL, lookbackTime]
        );

        if (klines.length < 2) {
            return [];
        }

        const gaps = [];
        for (let i = 1; i < klines.length; i++) {
            const prevTime = parseInt(klines[i - 1].open_time);
            const currTime = parseInt(klines[i].open_time);
            const expectedTime = prevTime + KLINE_INTERVAL_MS;
            
            if (currTime - expectedTime > KLINE_INTERVAL_MS * 1.5) {
                const missingCount = Math.floor((currTime - expectedTime) / KLINE_INTERVAL_MS);
                gaps.push({
                    from: prevTime,
                    to: currTime,
                    missing: missingCount
                });
            }
        }

        // Verifica anche gap finale (dall'ultima kline a ora)
        if (klines.length > 0) {
            const lastTime = parseInt(klines[klines.length - 1].open_time);
            const now = Date.now();
            const expectedNext = lastTime + KLINE_INTERVAL_MS;
            
            // Se mancano più di 2 candele dall'ultima (30 minuti), considera gap
            if (now - expectedNext > KLINE_INTERVAL_MS * 2) {
                gaps.push({
                    from: lastTime,
                    to: now,
                    missing: Math.floor((now - expectedNext) / KLINE_INTERVAL_MS),
                    isRecent: true
                });
            }
        }

        return gaps;
    } catch (error) {
        log.error(`Errore ricerca gap ${symbol}: ${error.message}`);
        return [];
    }
}

async function checkBinanceBan() {
    try {
        const testUrl = 'https://api.binance.com/api/v3/ping';
        const result = await httpsGet(testUrl, 5000);
        return { banned: false };
    } catch (error) {
        if (error.message && (error.message.includes('418') || error.message.includes('IP banned'))) {
            return { banned: true, reason: 'HTTP 418' };
        }
        return { banned: false, error: error.message };
    }
}

async function downloadKlinesForGap(symbol, tradingPair, gap) {
    try {
        // Verifica ban prima di scaricare
        const banCheck = await checkBinanceBan();
        if (banCheck.banned) {
            log.warn(`${symbol}: IP bannato - salto download klines`);
            return 0;
        }

        const startTime = gap.from + KLINE_INTERVAL_MS;
        const endTime = Math.min(gap.to - KLINE_INTERVAL_MS, Date.now() - KLINE_INTERVAL_MS); // Non scaricare futuro
        
        if (startTime >= endTime) {
            return 0;
        }

        let allKlines = [];
        let currentStartTime = startTime;

        while (currentStartTime < endTime && allKlines.length < BATCH_SIZE * 10) {
            const url = `https://api.binance.com/api/v3/klines?symbol=${tradingPair}&interval=${KLINE_INTERVAL}&startTime=${currentStartTime}&limit=${BATCH_SIZE}`;
            
            try {
                const klines = await httpsGet(url, REQUEST_TIMEOUT);
                
                // Verifica ban durante download
                if (klines && !Array.isArray(klines) && klines.code === -1022) {
                    log.error(`${symbol}: Ban rilevato - interrompo`);
                    break;
                }
                
                if (!Array.isArray(klines) || klines.length === 0) {
                    break;
                }
                
                // Filtra e valida klines
                const validKlines = klines.filter(k => {
                    const open = parseFloat(k[1]);
                    const high = parseFloat(k[2]);
                    const low = parseFloat(k[3]);
                    const close = parseFloat(k[4]);
                    
                    if (open > MAX_PRICE || open < MIN_PRICE ||
                        high > MAX_PRICE || high < MIN_PRICE ||
                        low > MAX_PRICE || low < MIN_PRICE ||
                        close > MAX_PRICE || close < MIN_PRICE) {
                        return false;
                    }
                    
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
            return 0;
        }

        // Salva nel database
        let saved = 0;
        for (const kline of allKlines) {
            try {
                await cryptoDb.dbRun(
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
                // Ignora errori singoli
            }
        }

        return saved;
    } catch (error) {
        log.error(`Errore download klines ${symbol}: ${error.message}`);
        return 0;
    }
}

async function checkAndRecoverSymbol(symbol) {
    try {
        const tradingPair = SYMBOL_TO_PAIR[symbol];
        if (!tradingPair) {
            return { checked: false, reason: 'Trading pair not found' };
        }

        // Trova gap recenti
        const gaps = await findRecentGaps(symbol);

        if (gaps.length === 0) {
            return { checked: true, gaps: 0, recovered: 0 };
        }

        log.warn(`${symbol}: Trovati ${gaps.length} gap recenti`);

        let totalRecovered = 0;
        for (const gap of gaps) {
            const recovered = await downloadKlinesForGap(symbol, tradingPair, gap);
            totalRecovered += recovered;
            if (recovered > 0) {
                log.success(`${symbol}: Recuperate ${recovered} klines`);
            }
        }

        return {
            checked: true,
            gaps: gaps.length,
            recovered: totalRecovered
        };
    } catch (error) {
        log.error(`Errore check/recovery ${symbol}: ${error.message}`);
        return { checked: false, error: error.message };
    }
}

async function getActiveSymbols() {
    try {
        // Ottieni simboli attivi
        const activeSymbols = await cryptoDb.dbAll(
            `SELECT DISTINCT symbol FROM bot_settings WHERE is_active = 1`
        );
        
        // Se nessuno attivo, usa simboli principali
        if (activeSymbols.length === 0) {
            return ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 'chainlink'];
        }
        
        return activeSymbols.map(s => s.symbol);
    } catch (error) {
        log.error(`Errore recupero simboli: ${error.message}`);
        return ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 'chainlink'];
    }
}

async function runCheck() {
    try {
        log.info('🔍 Inizio verifica gap...');

        const symbols = await getActiveSymbols();
        log.info(`Verificando ${symbols.length} simboli...`);

        const results = [];
        for (const symbol of symbols) {
            const result = await checkAndRecoverSymbol(symbol);
            results.push({ symbol, ...result });
        }

        // Report
        const withGaps = results.filter(r => r.checked && r.gaps > 0);
        const recovered = results.filter(r => r.checked && r.recovered > 0);
        const totalRecovered = results.reduce((sum, r) => sum + (r.recovered || 0), 0);

        if (withGaps.length > 0) {
            log.warn(`Trovati gap in ${withGaps.length} simboli`);
        }

        if (recovered.length > 0) {
            log.success(`Recuperate ${totalRecovered} klines totali`);
        }

        if (withGaps.length === 0 && recovered.length === 0) {
            log.success('✅ Nessun gap rilevato - tutto OK');
        }

        return results;
    } catch (error) {
        log.error(`Errore durante verifica: ${error.message}`);
        throw error;
    }
}

async function main() {
    log.info('🚀 Avvio Klines Monitor Daemon');
    log.info(`Verifica ogni ${CHECK_INTERVAL_MINUTES} minuti`);
    log.info(`Lookback: ultime ${LOOKBACK_HOURS} ore\n`);

    // Esegui prima verifica immediata
    await runCheck();

    // Poi verifica periodicamente
    const intervalMs = CHECK_INTERVAL_MINUTES * 60 * 1000;
    setInterval(async () => {
        try {
            await runCheck();
        } catch (error) {
            log.error(`Errore verifica periodica: ${error.message}`);
        }
    }, intervalMs);

    log.info(`Monitor attivo - prossima verifica tra ${CHECK_INTERVAL_MINUTES} minuti`);
}

// Gestione graceful shutdown
process.on('SIGINT', () => {
    log.info('🛑 Arresto monitor...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log.info('🛑 Arresto monitor...');
    process.exit(0);
});

main().catch(error => {
    log.error(`Errore fatale: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
});



