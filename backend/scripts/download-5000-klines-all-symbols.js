/**
 * Script per scaricare 5000 klines per TUTTI i simboli
 * 
 * Funzionalità:
 * 1. Legge tutti i simboli da bot_settings o SYMBOL_TO_PAIR
 * 2. Per ogni simbolo, scarica 5000 klines (15m interval)
 * 3. Gestisce rate limiting Binance
 * 4. Mostra progresso dettagliato
 * 5. Gestisce errori senza bloccare tutto
 * 
 * Uso: node scripts/download-5000-klines-all-symbols.js
 */

const { dbAll, dbGet, dbRun } = require('../crypto_db');
const https = require('https');

const INTERVAL = '15m';
const TARGET_KLINES = 5000; // Target ideale
const MIN_KLINES = 2000; // Minimo accettabile
const KLINE_INTERVAL_MS = 15 * 60 * 1000; // 15 minuti
const RATE_LIMIT_DELAY = 300; // ms tra richieste (rispetta 20 req/sec)
const BATCH_SIZE = 1000; // Max klines per richiesta Binance

// Mappa simboli a coppie Binance (da TradingBot.js)
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

async function getAllSymbols() {
    // Prova prima da bot_settings
    try {
        const symbols = await dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE symbol != 'global' ORDER BY symbol"
        );
        if (symbols.length > 0) {
            return symbols.map(s => s.symbol);
        }
    } catch (err) {
        console.log('   ⚠️  Errore lettura bot_settings, uso SYMBOL_TO_PAIR');
    }
    
    // Fallback: usa tutte le chiavi di SYMBOL_TO_PAIR
    return Object.keys(SYMBOL_TO_PAIR).filter(s => !s.includes('_') || s.endsWith('_eur') || s.endsWith('_usdt'));
}

async function getCurrentKlinesCount(symbol) {
    const result = await dbGet(
        `SELECT COUNT(*) as count 
         FROM klines 
         WHERE symbol = $1 AND interval = $2`,
        [symbol, INTERVAL]
    );
    return parseInt(result?.count || 0);
}

async function getKlinesRange(symbol) {
    const result = await dbGet(
        `SELECT 
            MIN(open_time) as first_time,
            MAX(open_time) as last_time
         FROM klines 
         WHERE symbol = $1 AND interval = $2`,
        [symbol, INTERVAL]
    );
    return {
        first: result?.first_time ? Number(result.first_time) : null,
        last: result?.last_time ? Number(result.last_time) : null
    };
}

async function downloadKlinesFromBinance(binanceSymbol, startTime, endTime) {
    let allKlines = [];
    let currentStartTime = startTime;
    let attempts = 0;
    const maxAttempts = 100; // ✅ Aumentato: Max 100 richieste per simbolo (100k klines teorici)
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;
    
    while (currentStartTime < endTime && attempts < maxAttempts) {
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${INTERVAL}&startTime=${currentStartTime}&limit=${BATCH_SIZE}`;
        
        try {
            const klines = await httpsGet(url);
            
            if (!Array.isArray(klines)) {
                consecutiveErrors++;
                if (consecutiveErrors >= maxConsecutiveErrors) {
                    console.error(`      ⚠️ Troppi errori consecutivi, interrompo per ${binanceSymbol}`);
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa più lunga in caso di errore
                continue;
            }
            
            if (klines.length === 0) {
                // Nessun dato disponibile per questo periodo
                break;
            }
            
            allKlines = allKlines.concat(klines);
            currentStartTime = klines[klines.length - 1][0] + 1;
            attempts++;
            consecutiveErrors = 0; // Reset errori consecutivi
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        } catch (error) {
            consecutiveErrors++;
            
            if (error.message.includes('Invalid symbol')) {
                throw new Error(`Simbolo ${binanceSymbol} non disponibile su Binance`);
            }
            
            if (error.message.includes('429') || error.message.includes('rate limit')) {
                console.error(`      ⚠️ Rate limit raggiunto, attendo 5 secondi...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                consecutiveErrors = 0; // Reset dopo pausa rate limit
                continue;
            }
            
            if (consecutiveErrors >= maxConsecutiveErrors) {
                console.error(`      ⚠️ Troppi errori consecutivi: ${error.message}`);
                break;
            }
            
            // Pausa più lunga in caso di errore
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    return allKlines;
}

async function insertKlines(symbol, klines) {
    let inserted = 0;
    let skipped = 0;
    
    for (const k of klines) {
        try {
            await dbRun(
                `INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (symbol, interval, open_time) DO NOTHING`,
                [symbol, INTERVAL, k[0], k[1], k[2], k[3], k[4], k[5], k[6]]
            );
            inserted++;
        } catch (error) {
            skipped++;
        }
    }
    
    return { inserted, skipped };
}

async function downloadKlinesForSymbol(symbol, binanceSymbol) {
    try {
        // Verifica klines esistenti
        const currentCount = await getCurrentKlinesCount(symbol);
        
        // ✅ FIX: Accetta se ha almeno MIN_KLINES, ma target è TARGET_KLINES
        if (currentCount >= TARGET_KLINES) {
            return {
                success: true,
                symbol,
                action: 'skipped',
                current: currentCount,
                inserted: 0,
                message: `Già ha ${currentCount} klines (target: ${TARGET_KLINES}) ✅`
            };
        }
        
        if (currentCount >= MIN_KLINES) {
            // Ha il minimo, ma proviamo ad arrivare al target
            const needed = TARGET_KLINES - currentCount;
            // Continua per completare fino a 5000
        } else {
            // Sotto il minimo, deve scaricare
        }
        
        const needed = TARGET_KLINES - currentCount;
        const daysNeeded = Math.ceil((needed * 15) / (60 * 24));
        
        // Calcola range temporale - MIGLIORATO: va sempre più indietro nel tempo
        const range = await getKlinesRange(symbol);
        const now = Date.now();
        let startTime;
        
        // ✅ FIX: Calcola sempre partendo da OGGI e andando indietro per i giorni necessari
        // Questo garantisce di coprire tutto il periodo necessario
        const daysToGoBack = Math.max(daysNeeded, 60); // Almeno 60 giorni per sicurezza
        startTime = now - (daysToGoBack * 24 * 60 * 60 * 1000);
        
        // Se ci sono klines esistenti, estendi il range per coprire eventuali gap
        if (range.last) {
            // Vai ancora più indietro per essere sicuri di coprire tutto
            const existingDays = (now - range.last) / (24 * 60 * 60 * 1000);
            const totalDaysNeeded = daysNeeded + existingDays + 10; // +10 giorni di buffer
            startTime = now - (totalDaysNeeded * 24 * 60 * 60 * 1000);
        }
        
        const endTime = now; // ✅ FIX: Sempre fino a oggi per avere dati aggiornati
        
        // Download
        const klines = await downloadKlinesFromBinance(binanceSymbol, startTime, endTime);
        
        if (klines.length === 0) {
            return {
                success: false,
                symbol,
                action: 'error',
                message: 'Nessuna kline scaricata da Binance'
            };
        }
        
        // Inserisci
        const { inserted, skipped } = await insertKlines(symbol, klines);
        
        // Verifica finale
        const finalCount = await getCurrentKlinesCount(symbol);
        
        return {
            success: true,
            symbol,
            action: 'downloaded',
            current: currentCount,
            inserted,
            skipped,
            final: finalCount,
            message: `Scaricate ${inserted} nuove klines (totale: ${finalCount})`
        };
        
    } catch (error) {
        return {
            success: false,
            symbol,
            action: 'error',
            message: error.message
        };
    }
}

async function downloadAllSymbols() {
    console.log('🚀 DOWNLOAD 5000 KLINES PER TUTTI I SIMBOLI');
    console.log('='.repeat(70));
    console.log(`Intervallo: ${INTERVAL}`);
    console.log(`Target: ${TARGET_KLINES} klines per simbolo\n`);

    try {
        // 1. Ottieni tutti i simboli
        console.log('📊 1. Lettura simboli...');
        const symbols = await getAllSymbols();
        console.log(`   ✅ Trovati ${symbols.length} simboli\n`);

        if (symbols.length === 0) {
            console.log('❌ Nessun simbolo trovato!');
            process.exit(1);
        }

        // 2. Filtra simboli con mapping Binance valido
        const validSymbols = [];
        const invalidSymbols = [];
        
        for (const symbol of symbols) {
            const binanceSymbol = SYMBOL_TO_PAIR[symbol];
            if (binanceSymbol) {
                validSymbols.push({ symbol, binanceSymbol });
            } else {
                invalidSymbols.push(symbol);
            }
        }

        console.log(`📋 2. Simboli validi: ${validSymbols.length}`);
        if (invalidSymbols.length > 0) {
            console.log(`   ⚠️  Simboli senza mapping Binance: ${invalidSymbols.length}`);
            invalidSymbols.forEach(s => console.log(`      - ${s}`));
        }
        console.log('');

        // 3. Stima tempo totale
        const estimatedTime = (validSymbols.length * 5 * RATE_LIMIT_DELAY) / 1000 / 60; // minuti
        console.log(`⏱️  3. Tempo stimato: ~${estimatedTime.toFixed(1)} minuti\n`);

        // 4. Download per ogni simbolo
        console.log('📥 4. Download klines...\n');
        
        const results = [];
        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let totalInserted = 0;

        for (let i = 0; i < validSymbols.length; i++) {
            const { symbol, binanceSymbol } = validSymbols[i];
            const progress = `[${i + 1}/${validSymbols.length}]`;
            
            console.log(`${progress} ${symbol} (${binanceSymbol})...`);
            
            const result = await downloadKlinesForSymbol(symbol, binanceSymbol);
            results.push(result);
            
            if (result.success) {
                if (result.action === 'skipped') {
                    console.log(`   ✅ ${result.message}`);
                    skippedCount++;
                } else {
                    console.log(`   ✅ ${result.message}`);
                    successCount++;
                    totalInserted += result.inserted;
                }
            } else {
                console.log(`   ❌ Errore: ${result.message}`);
                errorCount++;
            }
            
            console.log('');
        }

        // 5. Report finale
        console.log('='.repeat(70));
        console.log('📊 REPORT FINALE');
        console.log('='.repeat(70));
        console.log(`Totale simboli: ${validSymbols.length}`);
        console.log(`✅ Scaricati: ${successCount}`);
        console.log(`⏭️  Saltati (già completi): ${skippedCount}`);
        console.log(`❌ Errori: ${errorCount}`);
        console.log(`📥 Totale klines inserite: ${totalInserted.toLocaleString()}\n`);

        // Simboli con errori
        if (errorCount > 0) {
            console.log('⚠️  Simboli con errori:');
            results.filter(r => !r.success).forEach(r => {
                console.log(`   - ${r.symbol}: ${r.message}`);
            });
            console.log('');
        }

        // Verifica simboli ancora incompleti
        console.log('🔍 Verifica simboli ancora incompleti...');
        const incomplete = [];
        const belowMinimum = [];
        
        for (const { symbol } of validSymbols) {
            const count = await getCurrentKlinesCount(symbol);
            if (count < TARGET_KLINES) {
                incomplete.push({ symbol, count });
                if (count < MIN_KLINES) {
                    belowMinimum.push({ symbol, count });
                }
            }
        }

        if (incomplete.length > 0) {
            // Separa simboli sotto minimo da quelli sopra minimo ma sotto target
            if (belowMinimum.length > 0) {
                console.log(`\n❌ ${belowMinimum.length} simboli SOTTO MINIMO (${MIN_KLINES} klines):`);
                belowMinimum.forEach(({ symbol, count }) => {
                    console.log(`   - ${symbol}: ${count}/${MIN_KLINES} klines (CRITICO)`);
                });
            }
            
            const aboveMinButBelowTarget = incomplete.filter(({ count }) => count >= MIN_KLINES);
            if (aboveMinButBelowTarget.length > 0) {
                console.log(`\n⚠️  ${aboveMinButBelowTarget.length} simboli sopra minimo ma sotto target:`);
                aboveMinButBelowTarget.forEach(({ symbol, count }) => {
                    console.log(`   - ${symbol}: ${count}/${TARGET_KLINES} klines (OK ma incompleto)`);
                });
            }
            
            console.log('\n💡 SOLUZIONI:');
            if (belowMinimum.length > 0) {
                console.log('   • Per simboli sotto minimo: verifica disponibilità su Binance');
                console.log('   • Usa: node scripts/diagnose-incomplete-klines.js per diagnostica');
            }
            console.log('   • Esegui di nuovo lo script per completare i simboli mancanti');
        } else {
            console.log('✅ Tutti i simboli hanno almeno 5000 klines!\n');
        }

    } catch (error) {
        console.error('\n❌ ERRORE FATALE:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

downloadAllSymbols().then(() => {
    console.log('✅ Script completato');
    process.exit(0);
}).catch(err => {
    console.error('❌ Errore fatale:', err);
    process.exit(1);
});
