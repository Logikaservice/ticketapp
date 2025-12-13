/**
 * 🔄 RECUPERA GAP IMMEDIATO
 * 
 * Recupera i gap recenti trovati nel database
 * Esegue il recovery per i simboli principali
 */

const { dbAll, dbGet, dbRun } = require('../crypto_db');
const https = require('https');
const SYMBOL_TO_PAIR = require('../routes/cryptoRoutes').SYMBOL_TO_PAIR || {};

async function checkBinanceBan() {
    try {
        // Test rapido per vedere se c'è ban
        const testUrl = 'https://api.binance.com/api/v3/ping';
        const result = await httpsGet(testUrl, 5000);
        return { banned: false };
    } catch (error) {
        if (error.message && (error.message.includes('418') || error.message.includes('IP banned'))) {
            return { banned: true, reason: 'HTTP 418' };
        }
        // Altri errori non sono necessariamente ban
        return { banned: false, error: error.message };
    }
}

const KLINE_INTERVAL = '15m';
const KLINE_INTERVAL_MS = 15 * 60 * 1000;
const MAX_PRICE = 100000;
const MIN_PRICE = 0.000001;

const log = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    warn: (msg) => console.warn(`⚠️  ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    recovery: (msg) => console.log(`🔄 ${msg}`)
};

function httpsGet(url, timeout = 15000) {
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

async function findGaps(symbol) {
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
            
            if (currTime - expectedTime > KLINE_INTERVAL_MS * 1.5) {
                const missingCount = Math.floor((currTime - expectedTime) / KLINE_INTERVAL_MS);
                gaps.push({
                    from: prevTime,
                    to: currTime,
                    missing: missingCount
                });
            }
        }

        return gaps;
    } catch (error) {
        log.error(`Errore ricerca gap ${symbol}: ${error.message}`);
        return [];
    }
}

async function downloadKlinesForGap(symbol, tradingPair, gap) {
    try {
        // Verifica ban prima di scaricare
        const banCheck = await checkBinanceBan();
        if (banCheck.banned) {
            log.warn(`${symbol}: IP bannato - non posso scaricare klines da Binance`);
            log.info(`${symbol}: Usa WebSocket o dati esistenti per recuperare gap`);
            return 0;
        }

        log.recovery(`Recuperando ${gap.missing} klines per ${symbol} da ${new Date(gap.from).toISOString()} a ${new Date(gap.to).toISOString()}`);

        const startTime = gap.from + KLINE_INTERVAL_MS;
        const endTime = gap.to - KLINE_INTERVAL_MS;
        const limit = 1000;

        let allKlines = [];
        let currentStartTime = startTime;

        while (currentStartTime < endTime && allKlines.length < limit * 10) {
            const url = `https://api.binance.com/api/v3/klines?symbol=${tradingPair}&interval=${KLINE_INTERVAL}&startTime=${currentStartTime}&limit=${limit}`;
            
            try {
                const klines = await httpsGet(url, 15000);
                
                // Verifica se abbiamo ricevuto un ban durante il download
                if (klines && !Array.isArray(klines) && klines.code === -1022) {
                    log.error(`${symbol}: Ban rilevato durante download - interrompo`);
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
            log.warn(`Nessuna kline scaricata per ${symbol}`);
            return 0;
        }

        // Salva nel database
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
                // Ignora errori singoli
            }
        }

        log.success(`${symbol}: ${saved}/${allKlines.length} klines salvate`);
        return saved;
    } catch (error) {
        log.error(`Errore download klines ${symbol}: ${error.message}`);
        return 0;
    }
}

async function recoverSymbol(symbol) {
    try {
        const tradingPair = SYMBOL_TO_PAIR[symbol];
        if (!tradingPair) {
            log.warn(`${symbol}: Trading pair non trovato, skip`);
            return { recovered: false, reason: 'Trading pair not found' };
        }

        log.info(`Recupero gap per ${symbol} (${tradingPair})...`);

        // Trova gap recenti (ultimi 7 giorni)
        const allGaps = await findGaps(symbol);
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const recentGaps = allGaps.filter(g => g.to > sevenDaysAgo);

        if (recentGaps.length === 0) {
            log.success(`${symbol}: Nessun gap recente trovato`);
            return { recovered: true, gaps: 0 };
        }

        log.warn(`${symbol}: Trovati ${recentGaps.length} gap recenti`);

        let totalRecovered = 0;
        for (const gap of recentGaps) {
            const recovered = await downloadKlinesForGap(symbol, tradingPair, gap);
            totalRecovered += recovered;
        }

        return {
            recovered: true,
            gaps: recentGaps.length,
            klinesRecovered: totalRecovered
        };
    } catch (error) {
        log.error(`Errore recovery ${symbol}: ${error.message}`);
        return { recovered: false, error: error.message };
    }
}

async function main() {
    try {
        console.log('\n' + '='.repeat(80));
        console.log('🔄 RECUPERO GAP IMMEDIATO');
        console.log('='.repeat(80) + '\n');

        // Simboli principali da recuperare
        const mainSymbols = ['bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 'chainlink'];

        log.info(`Recupero gap per ${mainSymbols.length} simboli principali...\n`);

        const results = [];
        for (const symbol of mainSymbols) {
            const result = await recoverSymbol(symbol);
            results.push({ symbol, ...result });
            console.log(''); // Spazio tra simboli
        }

        // Report finale
        console.log('\n' + '='.repeat(80));
        console.log('📊 REPORT RECOVERY');
        console.log('='.repeat(80) + '\n');

        const successful = results.filter(r => r.recovered && r.gaps > 0);
        const failed = results.filter(r => !r.recovered);

        if (successful.length > 0) {
            console.log('✅ SIMBOLI RECUPERATI:');
            successful.forEach(r => {
                console.log(`   • ${r.symbol}: ${r.klinesRecovered || 0} klines recuperate da ${r.gaps} gap`);
            });
        }

        if (failed.length > 0) {
            console.log('\n❌ SIMBOLI CON ERRORI:');
            failed.forEach(r => {
                console.log(`   • ${r.symbol}: ${r.reason || r.error}`);
            });
        }

        const noGaps = results.filter(r => r.recovered && r.gaps === 0);
        if (noGaps.length > 0) {
            console.log('\n✅ SIMBOLI SENZA GAP:');
            noGaps.forEach(r => {
                console.log(`   • ${r.symbol}: Nessun gap da recuperare`);
            });
        }

        const totalKlines = results.reduce((sum, r) => sum + (r.klinesRecovered || 0), 0);
        console.log(`\n📊 TOTALE: ${totalKlines} klines recuperate`);

        console.log('\n' + '='.repeat(80) + '\n');
        process.exit(0);
    } catch (error) {
        log.error(`Errore generale: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
