/**
 * 🔧 Script per Risolvere Problemi Trovati dal Check
 * 
 * Azioni:
 * 1. Rimuove/corregge simbolo 'global' invalido
 * 2. Scarica klines per simboli con klines insufficienti
 * 3. Configura bot per simboli orfani (opzionale)
 */

const { dbAll, dbRun, dbGet } = require('./crypto_db');
const https = require('https');

// Mappa simboli database -> Binance
const SYMBOL_MAP = {
    'bitcoin': 'BTCUSDT',
    'ethereum': 'ETHUSDT',
    'solana': 'SOLUSDT',
    'cardano': 'ADAUSDT',
    'polkadot': 'DOTUSDT',
    'polkadot_usdt': 'DOTUSDT',
    'ripple': 'XRPUSDT',
    'chainlink': 'LINKUSDT',
    'litecoin': 'LTCUSDT',
    'binance_coin': 'BNBUSDT',
    'avax_usdt': 'AVAXUSDT',
    'sand': 'SANDUSDT',
    'the_sandbox': 'SANDUSDT',
    'uniswap': 'UNIUSDT',
    'aave': 'AAVEUSDT',
    'mana': 'MANAUSDT',
    'bonk': 'BONKUSDT',
    'axie_infinity': 'AXSUSDT',
    'axs': 'AXSUSDT',
    'matic': 'MATICUSDT',
    'dogecoin': 'DOGEUSDT',
    'shiba': 'SHIBUSDT',
    'tron': 'TRXUSDT',
    'stellar': 'XLMUSDT',
    'cosmos': 'ATOMUSDT',
    'internetcomputer': 'ICPUSDT',
    'sui': 'SUIUSDT',
    'near': 'NEARUSDT',
    'aptos': 'APTUSDT',
    'injective': 'INJUSDT',
    'algorand': 'ALGOUSDT',
    'vechain': 'VETUSDT',
    'arweave': 'ARUSDT',
    'optimism': 'OPUSDT',
    'pepe': 'PEPEUSDT',
    'floki': 'FLOKIUSDT',
    'maker': 'MKRUSDT',
    'compound': 'COMPUSDT',
    'curve': 'CRVUSDT',
    'fetchai': 'FETUSDT',
    'filecoin': 'FILUSDT',
    'graph': 'GRTUSDT',
    'immutablex': 'IMXUSDT',
    'lido': 'LDOUSDT',
    'sei': 'SEIUSDT',
    'synthetix': 'SNXUSDT',
    'toncoin': 'TONUSDT',
    'usdcoin': 'USDCUSDT',
    'arbitrum': 'ARBUSDT',
    'gala': 'GALAUSDT',
    'eos': 'EOSUSDT',
    'etc': 'ETCUSDT',
    'flow': 'FLOWUSDT',
    'render': 'RENDERUSDT',
    'polygon': 'MATICUSDT',
    'polpolygon': 'MATICUSDT', // ✅ FIX: POLPOLYGON = MATIC
    'pol_polygon': 'MATICUSDT', // ✅ FIX: Variante con underscore
    'pol_polygon_eur': 'POLEUR', // ✅ POL con EUR
    // ✅ Simboli EUR disponibili su Binance
    'bitcoin_eur': 'BTCEUR',
    'ethereum_eur': 'ETHEUR',
    'cardano_eur': 'ADAEUR',
    'polkadot_eur': 'DOTEUR',
    'chainlink_eur': 'LINKEUR',
    'litecoin_eur': 'LTCEUR',
    'ripple_eur': 'XRPEUR',
    'xrp_eur': 'XRPEUR',
    'binance_coin_eur': 'BNBEUR',
    'solana_eur': 'SOLEUR',
    'avax_eur': 'AVAXEUR',
    'avalanche_eur': 'AVAXEUR',
    'matic_eur': 'MATICEUR',
    'dogecoin_eur': 'DOGEEUR',
    'shiba_eur': 'SHIBEUR',
    'tron_eur': 'TRXEUR',
    'stellar_eur': 'XLMEUR',
    'cosmos_eur': 'ATOMEUR',
    'near_eur': 'NEAREUR',
    'sui_eur': 'SUIEUR',
    'arbitrum_eur': 'ARBEUR',
    'optimism_eur': 'OPEUR',
    'pepe_eur': 'PEPEEUR',
    'gala_eur': 'GALAEUR',
    'uniswap_eur': 'UNIEUR'
};

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    // ✅ FIX: Verifica se la risposta è HTML (errore Binance)
                    if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
                        reject(new Error(`Binance API returned HTML instead of JSON (symbol may not exist)`));
                        return;
                    }
                    
                    const parsed = JSON.parse(data);
                    
                    // ✅ FIX: Verifica se Binance ha restituito un errore
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

async function downloadKlines(symbol, binanceSymbol, days = 30) {
    console.log(`   📥 Download klines per ${symbol} (${binanceSymbol})...`);
    
    const interval = '15m';
    const limit = 1000;
    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);
    
    let allKlines = [];
    let currentStartTime = startTime;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (currentStartTime < endTime && attempts < maxAttempts) {
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&startTime=${currentStartTime}&limit=${limit}`;
        
        try {
            const klines = await httpsGet(url);
            
            // ✅ FIX: Verifica che klines sia un array
            if (!Array.isArray(klines)) {
                // Se Binance restituisce un errore (es. simbolo non esiste), klines potrebbe essere un oggetto
                if (klines && klines.code) {
                    console.error(`      ❌ Binance API Error: ${klines.msg || klines.code}`);
                } else {
                    console.error(`      ❌ Risposta non valida da Binance (non è un array)`);
                }
                break;
            }
            
            if (klines.length === 0) break;
            
            // ✅ FIX: Usa concat invece di spread per evitare errori
            allKlines = allKlines.concat(klines);
            currentStartTime = klines[klines.length - 1][0] + 1;
            attempts++;
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
            // ✅ FIX: Migliora gestione errori
            if (error.message.includes('Parse error') && error.message.includes('<!DOCTYPE')) {
                console.error(`      ❌ Simbolo ${binanceSymbol} non esiste su Binance (API restituisce HTML)`);
            } else {
                console.error(`      ❌ Errore: ${error.message}`);
            }
            break;
        }
    }
    
    if (allKlines.length === 0) {
        console.log(`      ⚠️ Nessuna kline scaricata`);
        return 0;
    }
    
    // Inserisci nel database
    let inserted = 0;
    for (const k of allKlines) {
        try {
            await dbRun(
                `INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (symbol, interval, open_time) DO NOTHING`,
                [symbol, interval, k[0], k[1], k[2], k[3], k[4], k[5], k[6]]
            );
            inserted++;
        } catch (error) {
            // Ignora duplicati
        }
    }
    
    console.log(`      ✅ ${inserted} nuove klines inserite`);
    return inserted;
}

async function fixStatusIssues() {
    console.log('🔧 RISOLUZIONE PROBLEMI TROVATI');
    console.log('='.repeat(80));
    console.log('');

    try {
        // 1. Rimuovi simbolo 'global' invalido
        console.log('1️⃣ Rimozione simbolo "global" invalido...');
        try {
            // Rimuovi da bot_settings
            const deletedBot = await dbRun(
                "DELETE FROM bot_settings WHERE symbol = $1",
                ['global']
            );
            
            // Rimuovi da bot_parameters se esiste
            await dbRun(
                "DELETE FROM bot_parameters WHERE symbol = $1",
                ['global']
            ).catch(() => {});
            
            // Rimuovi da market_data se esiste
            await dbRun(
                "DELETE FROM market_data WHERE symbol = $1",
                ['global']
            ).catch(() => {});
            
            console.log('   ✅ Simbolo "global" rimosso');
        } catch (error) {
            console.log(`   ⚠️ Errore rimozione global: ${error.message}`);
        }
        console.log('');

        // 2. Trova simboli con klines insufficienti (< 100)
        console.log('2️⃣ Verifica simboli con klines insufficienti...');
        const klinesCheck = await dbAll(
            `SELECT 
                symbol, 
                COUNT(*) as count
             FROM klines 
             WHERE interval = $1
             GROUP BY symbol
             HAVING COUNT(*) < 100
             ORDER BY symbol`,
            ['15m']
        );

        console.log(`   Trovati ${klinesCheck.length} simboli con klines < 100`);
        console.log('');

        // 3. Scarica klines per simboli insufficienti
        if (klinesCheck.length > 0) {
            console.log('3️⃣ Download klines per simboli insufficienti...');
            console.log('');
            
            for (const row of klinesCheck) {
                const symbol = row.symbol;
                const currentCount = parseInt(row.count);
                
                // ✅ FIX: Verifica se il simbolo EUR è disponibile su Binance
                const symbolLower = symbol.toLowerCase();
                const isEurSymbol = symbolLower.includes('_eur') || symbolLower.endsWith('eur');
                
                if (isEurSymbol) {
                    // Verifica se è nella mappa (disponibile su Binance)
                    const binanceEurSymbol = SYMBOL_MAP[symbolLower];
                    if (!binanceEurSymbol) {
                        console.log(`   ⏭️ ${symbol}: Saltato (simbolo EUR non disponibile su Binance)`);
                        console.log('');
                        continue;
                    }
                    // Se è disponibile, continua con il download usando il simbolo EUR
                }
                
                // Trova simbolo Binance corrispondente
                let binanceSymbol = SYMBOL_MAP[symbol.toLowerCase()];
                
                // Se non trovato, prova a costruirlo
                if (!binanceSymbol) {
                    // Rimuovi _usdt, _eur, ecc. e aggiungi USDT
                    const baseSymbol = symbol
                        .toUpperCase()
                        .replace(/_USDT$/, '')
                        .replace(/_EUR$/, '')
                        .replace(/_/, '');
                    binanceSymbol = `${baseSymbol}USDT`;
                }
                
                console.log(`   📊 ${symbol}: ${currentCount} klines -> target: 100+`);
                
                try {
                    const inserted = await downloadKlines(symbol, binanceSymbol, 30);
                    if (inserted > 0) {
                        // Verifica nuovo conteggio
                        const newCount = await dbGet(
                            "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = $2",
                            [symbol, '15m']
                        );
                        console.log(`      ✅ Nuovo totale: ${parseInt(newCount.count)} klines`);
                    }
                } catch (error) {
                    console.log(`      ❌ Errore download: ${error.message}`);
                }
                
                console.log('');
            }
        } else {
            console.log('   ✅ Tutti i simboli hanno klines sufficienti');
            console.log('');
        }

        // 4. Verifica simboli orfani (klines senza bot)
        console.log('4️⃣ Verifica simboli orfani (klines senza bot)...');
        const orphanSymbols = await dbAll(
            `SELECT DISTINCT k.symbol, COUNT(*) as klines_count
             FROM klines k
             LEFT JOIN bot_settings bs ON k.symbol = bs.symbol AND bs.strategy_name = $1
             WHERE bs.symbol IS NULL AND k.interval = $2
             GROUP BY k.symbol
             ORDER BY k.symbol`,
            ['RSI_Strategy', '15m']
        );

        if (orphanSymbols.length > 0) {
            console.log(`   ⚠️ Trovati ${orphanSymbols.length} simboli con klines ma senza bot:`);
            orphanSymbols.forEach(row => {
                console.log(`      - ${row.symbol} (${row.klines_count} klines)`);
            });
            console.log('');
            console.log('   💡 Questi simboli non verranno configurati automaticamente.');
            console.log('      Se vuoi attivarli, esegui: node setup_bot.js <symbol>');
            console.log('');
        } else {
            console.log('   ✅ Nessun simbolo orfano trovato');
            console.log('');
        }

        // 5. Report finale
        console.log('='.repeat(80));
        console.log('✅ RISOLUZIONE COMPLETATA');
        console.log('='.repeat(80));
        console.log('');
        console.log('💡 Esegui di nuovo: node complete_status_check.js per verificare');
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante risoluzione problemi:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

fixStatusIssues().catch(console.error);

