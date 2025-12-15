/**
 * 🔧 Script per verificare e risolvere problemi di dati per TUTTI i simboli
 * Mostra quali simboli hanno dati insufficienti e offre di fixarli
 */

const { dbGet, dbAll, dbRun } = require('../crypto_db');
const https = require('https');

// Mapping simboli -> trading pairs (copiato da cryptoRoutes.js)
const SYMBOL_TO_PAIR = {
    'bitcoin_usdt': 'BTCUSDT',
    'ethereum_usdt': 'ETHUSDT',
    'solana_eur': 'SOLUSDT',
    'ripple_eur': 'XRPUSDT',
    'binance_coin_eur': 'BNBUSDT',
    'cardano_usdt': 'ADAUSDT',
    'polkadot_usdt': 'DOTUSDT',
    'avalanche_eur': 'AVAXUSDT',
    'near_eur': 'NEARUSDT',
    'atom_eur': 'ATOMUSDT',
    'sui_eur': 'SUIUSDT',
    'apt': 'APTUSDT',
    'ton': 'TONUSDT',
    'icp': 'ICPUSDT',
    'aave': 'AAVEUSDT',
    'uniswap_eur': 'UNIUSDT',
    'chainlink_usdt': 'LINKUSDT',
    'crv': 'CRVUSDT',
    'ldo': 'LDOUSDT',
    'mkr': 'MKRUSDT',
    'comp': 'COMPUSDT',
    'snx': 'SNXUSDT',
    'arb_eur': 'ARBUSDT',
    'op_eur': 'OPUSDT',
    'matic_eur': 'MATICUSDT',
    'pol_polygon_eur': 'POLUSDT',
    'trx_eur': 'TRXUSDT',
    'xlm_eur': 'XLMUSDT',
    'fet': 'FETUSDT',
    'render': 'RENDERUSDT',
    'grt': 'GRTUSDT',
    'sand': 'SANDUSDT',
    'mana': 'MANAUSDT',
    'axs': 'AXSUSDT',
    'gala': 'GALAUSDT',
    'imx': 'IMXUSDT',
    'enj_eur': 'ENJUSDT',
    'pepe_eur': 'PEPEUSDT',
    'dogecoin_eur': 'DOGEUSDT',
    'shiba_eur': 'SHIBUSDT',
    'floki': 'FLOKIUSDT',
    'bonk': 'BONKUSDT',
    'fil': 'FILUSDT',
    'ar': 'ARUSDT',
    'sei': 'SEIUSDT',
    'inj': 'INJUSDT',
    'usdc': 'USDCUSDT'
};

const KLINE_INTERVAL = '15m';
const MIN_KLINES_REQUIRED = 50;
const MIN_PRICE_HISTORY_REQUIRED = 50;

function httpsGet(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            if (res.statusCode !== 200) {
                let errorData = '';
                res.on('data', (chunk) => errorData += chunk);
                res.on('end', () => reject(new Error(`HTTP ${res.statusCode}`)));
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        });
        req.on('error', (err) => reject(err));
        req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

async function checkAllSymbols() {
    console.log('🔍 VERIFICA DATI PER TUTTI I SIMBOLI\n');
    console.log('=' .repeat(90));
    
    const symbolsWithIssues = [];
    const symbolsOK = [];
    
    console.log(`\n📊 Analisi in corso (${Object.keys(SYMBOL_TO_PAIR).length} simboli)...\n`);
    console.log('Simbolo'.padEnd(20) + 'Klines'.padEnd(12) + 'Price H.'.padEnd(12) + 'Status');
    console.log('-'.repeat(90));
    
    for (const [symbol, tradingPair] of Object.entries(SYMBOL_TO_PAIR)) {
        try {
            // Conta klines
            const klinesCount = await dbGet(
                `SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2`,
                [symbol, KLINE_INTERVAL]
            );
            const kCount = parseInt(klinesCount?.count || 0);
            
            // Conta price_history
            const priceCount = await dbGet(
                `SELECT COUNT(*) as count FROM price_history WHERE symbol = $1`,
                [symbol]
            );
            const pCount = parseInt(priceCount?.count || 0);
            
            const hasIssues = kCount < MIN_KLINES_REQUIRED || pCount < MIN_PRICE_HISTORY_REQUIRED;
            
            const displaySymbol = symbol.padEnd(20);
            const displayKlines = `${kCount}`.padEnd(12);
            const displayPrice = `${pCount}`.padEnd(12);
            const displayStatus = hasIssues ? '❌ INSUFFICIENTE' : '✅ OK';
            
            console.log(displaySymbol + displayKlines + displayPrice + displayStatus);
            
            if (hasIssues) {
                symbolsWithIssues.push({
                    symbol,
                    tradingPair,
                    klinesCount: kCount,
                    priceCount: pCount,
                    missingKlines: Math.max(0, MIN_KLINES_REQUIRED - kCount),
                    missingPrice: Math.max(0, MIN_PRICE_HISTORY_REQUIRED - pCount)
                });
            } else {
                symbolsOK.push(symbol);
            }
            
        } catch (error) {
            console.log(`${symbol.padEnd(20)}ERROR: ${error.message}`);
        }
    }
    
    console.log('-'.repeat(90));
    console.log(`\n📈 Riepilogo:`);
    console.log(`   ✅ Simboli OK: ${symbolsOK.length}/${Object.keys(SYMBOL_TO_PAIR).length}`);
    console.log(`   ❌ Simboli con problemi: ${symbolsWithIssues.length}/${Object.keys(SYMBOL_TO_PAIR).length}`);
    
    if (symbolsWithIssues.length > 0) {
        console.log(`\n⚠️  Simboli che NON possono essere tradati:\n`);
        
        symbolsWithIssues
            .sort((a, b) => a.symbol.localeCompare(b.symbol))
            .forEach(s => {
                console.log(`   • ${s.symbol} (${s.tradingPair})`);
                if (s.klinesCount < MIN_KLINES_REQUIRED) {
                    console.log(`     - Mancano ${s.missingKlines} klines (ha ${s.klinesCount}/${MIN_KLINES_REQUIRED})`);
                }
                if (s.priceCount < MIN_PRICE_HISTORY_REQUIRED) {
                    console.log(`     - Mancano ${s.missingPrice} price_history (ha ${s.priceCount}/${MIN_PRICE_HISTORY_REQUIRED})`);
                }
            });
        
        console.log(`\n\n🔧 SOLUZIONE:`);
        console.log(`   Per fixare un simbolo specifico, esegui:`);
        console.log(`   node backend/scripts/fix_specific_symbol.js <symbol_name>`);
        console.log(`\n   Esempio per BTC:`);
        console.log(`   node backend/scripts/fix_specific_symbol.js bitcoin_usdt`);
        
        console.log(`\n   Per fixare TUTTI i simboli automaticamente:`);
        console.log(`   node backend/scripts/fix_all_symbols_data.js --fix-all`);
    } else {
        console.log(`\n✅ Tutti i simboli hanno dati sufficienti!`);
    }
    
    console.log('\n' + '='.repeat(90));
    
    // Se --fix-all è passato, fix automaticamente tutti i simboli
    if (process.argv.includes('--fix-all') && symbolsWithIssues.length > 0) {
        console.log(`\n🔧 Avvio fix automatico per ${symbolsWithIssues.length} simboli...\n`);
        
        for (let i = 0; i < symbolsWithIssues.length; i++) {
            const s = symbolsWithIssues[i];
            console.log(`\n[${i + 1}/${symbolsWithIssues.length}] Fixing ${s.symbol}...`);
            
            try {
                await fixSymbol(s.symbol, s.tradingPair);
                console.log(`   ✅ ${s.symbol} fixato con successo`);
            } catch (error) {
                console.error(`   ❌ Errore fixing ${s.symbol}: ${error.message}`);
            }
            
            // Pausa tra simboli per evitare rate limit
            if (i < symbolsWithIssues.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log(`\n✅ Fix completato per tutti i simboli`);
    }
    
    process.exit(0);
}

async function fixSymbol(symbol, tradingPair) {
    const LOOKBACK_DAYS = 30;
    const endTime = Date.now();
    const startTime = endTime - (LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    
    // Download klines
    let allKlines = [];
    let currentStartTime = startTime;
    const limit = 1000;
    
    while (currentStartTime < endTime && allKlines.length < limit * 30) {
        const url = `https://api.binance.com/api/v3/klines?symbol=${tradingPair}&interval=${KLINE_INTERVAL}&startTime=${currentStartTime}&limit=${limit}`;
        
        const klines = await httpsGet(url, 20000);
        
        if (!Array.isArray(klines) || klines.length === 0) break;
        
        const validKlines = klines.filter(k => {
            const open = parseFloat(k[1]);
            const high = parseFloat(k[2]);
            const low = parseFloat(k[3]);
            const close = parseFloat(k[4]);
            return open > 0 && high >= low && close >= low && close <= high;
        });
        
        allKlines.push(...validKlines);
        currentStartTime = parseInt(klines[klines.length - 1][0]) + 1;
        await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    // Salva klines
    for (const kline of allKlines) {
        try {
            await dbRun(
                `INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (symbol, interval, open_time) DO NOTHING`,
                [
                    symbol, KLINE_INTERVAL, parseInt(kline[0]),
                    parseFloat(kline[1]), parseFloat(kline[2]), parseFloat(kline[3]),
                    parseFloat(kline[4]), parseFloat(kline[5]), parseInt(kline[6])
                ]
            );
        } catch (e) { /* ignora */ }
    }
    
    // Sincronizza price_history
    const recentKlines = await dbAll(
        `SELECT open_time, close_price FROM klines 
         WHERE symbol = $1 AND interval = $2 
         ORDER BY open_time DESC LIMIT 200`,
        [symbol, KLINE_INTERVAL]
    );
    
    for (const kline of recentKlines) {
        try {
            await dbRun(
                `INSERT INTO price_history (symbol, price, timestamp)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (symbol, timestamp) DO NOTHING`,
                [symbol, parseFloat(kline.close_price), new Date(parseInt(kline.open_time)).toISOString()]
            );
        } catch (e) { /* ignora */ }
    }
}

checkAllSymbols();

