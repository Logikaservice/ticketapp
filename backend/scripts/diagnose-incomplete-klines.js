/**
 * Script per diagnosticare perché alcuni simboli non raggiungono 5000 klines
 */

const { dbAll, dbGet } = require('../crypto_db');
const https = require('https');

const INTERVAL = '15m';
const TARGET_KLINES = 5000;

// Mappa simboli (da download-5000-klines-all-symbols.js)
const SYMBOL_TO_PAIR = {
    'bitcoin': 'BTCEUR', 'btc': 'BTCEUR', 'bitcoin_usdt': 'BTCUSDT', 'btcusdt': 'BTCUSDT',
    'ethereum': 'ETHEUR', 'eth': 'ETHUSDT', 'ethereum_usdt': 'ETHUSDT', 'ethusdt': 'ETHUSDT',
    'solana': 'SOLEUR', 'sol': 'SOLUSDT', 'solana_eur': 'SOLEUR', 'solana_usdt': 'SOLUSDT', 'solusdt': 'SOLUSDT',
    'cardano': 'ADAEUR', 'ada': 'ADAUSDT', 'cardano_usdt': 'ADAUSDT', 'adausdt': 'ADAUSDT',
    'ripple': 'XRPEUR', 'xrp': 'XRPUSDT', 'ripple_eur': 'XRPEUR', 'ripple_usdt': 'XRPUSDT', 'xrpusdt': 'XRPUSDT',
    'polkadot': 'DOTEUR', 'dot': 'DOTUSDT', 'polkadot_usdt': 'DOTUSDT', 'dotusdt': 'DOTUSDT',
    'dogecoin': 'DOGEEUR', 'doge': 'DOGEUSDT', 'dogeusdt': 'DOGEUSDT',
    'shiba_inu': 'SHIBEUR', 'shib': 'SHIBUSDT', 'shibusdt': 'SHIBUSDT',
    'avalanche': 'AVAXEUR', 'avax': 'AVAXUSDT', 'avalanche_eur': 'AVAXEUR', 'avax_usdt': 'AVAXUSDT', 'avaxusdt': 'AVAXUSDT',
    'binance_coin': 'BNBEUR', 'bnb': 'BNBUSDT', 'binance_coin_eur': 'BNBEUR', 'bnbusdt': 'BNBUSDT',
    'chainlink': 'LINKEUR', 'link': 'LINKUSDT', 'chainlink_usdt': 'LINKUSDT', 'linkusdt': 'LINKUSDT',
    'polygon': 'POLEUR', 'matic': 'MATICEUR', 'pol': 'POLUSDT', 'pol_polygon': 'POLUSDT', 'pol_polygon_eur': 'POLEUR', 'maticusdt': 'POLUSDT', 'polusdt': 'POLUSDT',
    'uniswap': 'UNIEUR', 'uni': 'UNIUSDT', 'uniswap_eur': 'UNIEUR', 'uniusdt': 'UNIUSDT',
    'aave': 'AAVEUSDT', 'aaveusdt': 'AAVEUSDT',
    'curve': 'CRVUSDT', 'crv': 'CRVUSDT', 'crvusdt': 'CRVUSDT',
    'the_sandbox': 'SANDUSDT', 'sand': 'SANDUSDT', 'sandusdt': 'SANDUSDT', 'thesandbox': 'SANDUSDT',
    'axie_infinity': 'AXSUSDT', 'axs': 'AXSUSDT', 'axsusdt': 'AXSUSDT', 'axieinfinity': 'AXSUSDT',
    'decentraland': 'MANAUSDT', 'mana': 'MANAUSDT', 'manausdt': 'MANAUSDT',
    'gala': 'GALAEUR', 'galausdt': 'GALAUSDT',
    'immutable': 'IMXUSDT', 'imx': 'IMXUSDT', 'imxusdt': 'IMXUSDT',
    'enjin': 'ENJEUR', 'enj': 'ENJUSDT', 'enjusdt': 'ENJUSDT',
    'render': 'RENDERUSDT', 'renderusdt': 'RENDERUSDT', 'rndr': 'RENDERUSDT',
    'theta_network': 'THETAUSDT', 'theta': 'THETAUSDT', 'thetausdt': 'THETAUSDT', 'thetanetwork': 'THETAUSDT',
    'near': 'NEAREUR', 'nearusdt': 'NEARUSDT',
    'optimism': 'OPEUR', 'op': 'OPUSDT', 'opusdt': 'OPUSDT',
    'sei': 'SEIUSDT', 'seiusdt': 'SEIUSDT',
    'filecoin': 'FILUSDT', 'fil': 'FILUSDT', 'filusdt': 'FILUSDT',
    'bonk': 'BONKUSDT', 'bonkusdt': 'BONKUSDT',
    'floki': 'FLOKIUSDT', 'flokiusdt': 'FLOKIUSDT',
    'ton': 'TONUSDT', 'toncoin': 'TONUSDT', 'tonusdt': 'TONUSDT',
    'tron': 'TRXEUR', 'trx': 'TRXUSDT', 'trxusdt': 'TRXUSDT',
    'stellar': 'XLMEUR', 'xlm': 'XLMUSDT', 'xlmusdt': 'XLMUSDT',
    'ripple_xrp': 'XRPUSDT', 'xrp_eur': 'XRPEUR',
    'cosmos': 'ATOMEUR', 'atom': 'ATOMUSDT', 'atomusdt': 'ATOMUSDT',
    'icp': 'ICPUSDT', 'icpusdt': 'ICPUSDT',
    'flow': 'FLOWUSDT', 'flowusdt': 'FLOWUSDT',
    'pepe': 'PEPEEUR', 'pepeusdt': 'PEPEUSDT',
    'sui': 'SUIEUR', 'suiusdt': 'SUIEUR',
    'arbitrum': 'ARBEUR', 'arb': 'ARBUSDT', 'arbusdt': 'ARBUSDT',
    'litecoin': 'LTCEUR', 'ltc': 'LTCUSDT', 'ltcusdt': 'LTCUSDT'
};

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
                        reject(new Error(`Binance API returned HTML instead of JSON`));
                        return;
                    }
                    const parsed = JSON.parse(data);
                    if (parsed.code && parsed.msg) {
                        reject(new Error(`Binance API Error ${parsed.code}: ${parsed.msg}`));
                        return;
                    }
                    resolve(parsed);
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

async function testBinanceSymbol(binanceSymbol) {
    try {
        // Test con una richiesta piccola per vedere se il simbolo esiste
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${INTERVAL}&limit=1`;
        const result = await httpsGet(url);
        return { available: true, error: null };
    } catch (error) {
        return { available: false, error: error.message };
    }
}

async function getKlinesRange(symbol) {
    const result = await dbGet(
        `SELECT 
            MIN(open_time) as first_time,
            MAX(open_time) as last_time,
            COUNT(*) as count
         FROM klines 
         WHERE symbol = $1 AND interval = $2`,
        [symbol, INTERVAL]
    );
    return {
        first: result?.first_time ? Number(result.first_time) : null,
        last: result?.last_time ? Number(result.last_time) : null,
        count: parseInt(result?.count || 0)
    };
}

async function diagnoseIncompleteSymbols() {
    console.log('🔍 DIAGNOSTICA SIMBOLI INCOMPLETI');
    console.log('='.repeat(70));
    console.log(`Target: ${TARGET_KLINES} klines per simbolo\n`);

    try {
        // 1. Ottieni simboli incompleti
        const incompleteSymbols = await dbAll(
            `SELECT symbol, COUNT(*) as count
             FROM klines 
             WHERE interval = $1
             GROUP BY symbol 
             HAVING COUNT(*) < $2
             ORDER BY count ASC`,
            [INTERVAL, TARGET_KLINES]
        );

        console.log(`📊 Trovati ${incompleteSymbols.length} simboli incompleti\n`);

        if (incompleteSymbols.length === 0) {
            console.log('✅ Tutti i simboli hanno almeno 5000 klines!');
            process.exit(0);
        }

        // 2. Per ogni simbolo incompleto, diagnostica
        const diagnostics = [];
        
        for (const { symbol, count } of incompleteSymbols) {
            const currentCount = parseInt(count);
            const needed = TARGET_KLINES - currentCount;
            const binanceSymbol = SYMBOL_TO_PAIR[symbol];
            
            console.log(`\n🔍 Analizzando: ${symbol} (${currentCount}/${TARGET_KLINES} klines)`);
            
            if (!binanceSymbol) {
                diagnostics.push({
                    symbol,
                    issue: 'NO_MAPPING',
                    message: `Nessun mapping Binance trovato per ${symbol}`
                });
                console.log(`   ❌ Nessun mapping Binance`);
                continue;
            }

            // Test disponibilità su Binance
            console.log(`   📡 Test disponibilità su Binance (${binanceSymbol})...`);
            const binanceTest = await testBinanceSymbol(binanceSymbol);
            
            if (!binanceTest.available) {
                diagnostics.push({
                    symbol,
                    binanceSymbol,
                    issue: 'NOT_AVAILABLE',
                    message: `Simbolo non disponibile su Binance: ${binanceTest.error}`
                });
                console.log(`   ❌ Non disponibile: ${binanceTest.error}`);
                continue;
            }

            // Verifica range temporale
            const range = await getKlinesRange(symbol);
            const now = Date.now();
            const daysNeeded = Math.ceil((needed * 15) / (60 * 24));
            
            let startTime;
            if (range.last) {
                startTime = range.last - (needed * 15 * 60 * 1000);
            } else {
                startTime = now - (daysNeeded * 24 * 60 * 60 * 1000);
            }

            // Test download di un piccolo batch
            console.log(`   📥 Test download (ultimi 100 klines)...`);
            try {
                const testUrl = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${INTERVAL}&limit=100`;
                const testKlines = await httpsGet(testUrl);
                
                if (testKlines.length === 0) {
                    diagnostics.push({
                        symbol,
                        binanceSymbol,
                        issue: 'NO_DATA',
                        message: `Binance non restituisce dati per ${binanceSymbol}`
                    });
                    console.log(`   ⚠️  Nessun dato disponibile`);
                } else {
                    const oldestKline = testKlines[0][0];
                    const newestKline = testKlines[testKlines.length - 1][0];
                    const oldestDate = new Date(Number(oldestKline));
                    const newestDate = new Date(Number(newestKline));
                    
                    diagnostics.push({
                        symbol,
                        binanceSymbol,
                        issue: 'INCOMPLETE',
                        message: `Disponibile ma incompleto. Range Binance: ${oldestDate.toISOString()} → ${newestDate.toISOString()}`,
                        currentCount,
                        needed,
                        range: {
                            first: range.first ? new Date(range.first).toISOString() : null,
                            last: range.last ? new Date(range.last).toISOString() : null
                        }
                    });
                    console.log(`   ✅ Disponibile, ma mancano ${needed} klines`);
                    console.log(`      Range Binance: ${oldestDate.toISOString()} → ${newestDate.toISOString()}`);
                }
            } catch (error) {
                diagnostics.push({
                    symbol,
                    binanceSymbol,
                    issue: 'DOWNLOAD_ERROR',
                    message: `Errore download: ${error.message}`
                });
                console.log(`   ❌ Errore download: ${error.message}`);
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // 3. Report finale
        console.log('\n' + '='.repeat(70));
        console.log('📋 REPORT DIAGNOSTICA');
        console.log('='.repeat(70));

        const byIssue = {};
        diagnostics.forEach(d => {
            if (!byIssue[d.issue]) byIssue[d.issue] = [];
            byIssue[d.issue].push(d);
        });

        console.log('\n❌ Simboli non disponibili su Binance:');
        (byIssue.NOT_AVAILABLE || []).forEach(d => {
            console.log(`   - ${d.symbol} (${d.binanceSymbol}): ${d.message}`);
        });

        console.log('\n⚠️  Simboli senza mapping:');
        (byIssue.NO_MAPPING || []).forEach(d => {
            console.log(`   - ${d.symbol}: ${d.message}`);
        });

        console.log('\n📊 Simboli disponibili ma incompleti:');
        (byIssue.INCOMPLETE || []).forEach(d => {
            console.log(`   - ${d.symbol} (${d.binanceSymbol}): ${d.currentCount}/${TARGET_KLINES} klines`);
            console.log(`     Mancano: ${d.needed} klines`);
            if (d.range.first) {
                console.log(`     Range DB: ${d.range.first} → ${d.range.last}`);
            }
        });

        console.log('\n💡 SOLUZIONI:');
        console.log('   1. Per simboli non disponibili: verifica se il trading pair esiste su Binance');
        console.log('   2. Per simboli incompleti: esegui di nuovo lo script (potrebbe essere rate limiting)');
        console.log('   3. Per simboli con pochi dati (<100 klines): potrebbero non avere storia sufficiente');
        console.log('');

    } catch (error) {
        console.error('\n❌ ERRORE:', error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    }
}

diagnoseIncompleteSymbols().then(() => {
    console.log('✅ Diagnostica completata');
    process.exit(0);
}).catch(err => {
    console.error('❌ Errore fatale:', err);
    process.exit(1);
});
