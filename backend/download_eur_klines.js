/**
 * 📥 Script per Scaricare Klines per Simboli EUR Disponibili su Binance
 * 
 * Scarica/aggiorna klines per tutti i 23 simboli EUR disponibili su Binance
 */

const { dbAll, dbGet, dbRun } = require('./crypto_db');
const https = require('https');

// Mappa simboli database -> Binance EUR
const EUR_SYMBOL_MAP = {
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
    'pol_polygon_eur': 'POLEUR',
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

async function downloadKlines(symbol, binanceSymbol, days = 30) {
    console.log(`   📥 Download klines per ${symbol} (${binanceSymbol})...`);
    
    const interval = '15m';
    const limit = 1000;
    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);
    
    let allKlines = [];
    let currentStartTime = startTime;
    let attempts = 0;
    const maxAttempts = 20;
    
    while (currentStartTime < endTime && attempts < maxAttempts) {
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&startTime=${currentStartTime}&limit=${limit}`;
        
        try {
            const klines = await httpsGet(url);
            
            if (!Array.isArray(klines)) {
                console.error(`      ❌ Risposta non valida da Binance (non è un array)`);
                break;
            }
            
            if (klines.length === 0) break;
            
            allKlines = allKlines.concat(klines);
            currentStartTime = klines[klines.length - 1][0] + 1;
            attempts++;
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
            console.error(`      ❌ Errore: ${error.message}`);
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
    
    console.log(`      ✅ ${inserted} nuove klines inserite (totale scaricate: ${allKlines.length})`);
    return inserted;
}

async function downloadEurKlines() {
    console.log('📥 DOWNLOAD KLINES PER SIMBOLI EUR DISPONIBILI SU BINANCE');
    console.log('='.repeat(80));
    console.log('');

    try {
        // 1. Trova simboli EUR nel database
        console.log('1️⃣ Ricerca simboli EUR nel database...');
        const eurSymbols = await dbAll(
            "SELECT DISTINCT symbol FROM bot_settings WHERE symbol LIKE '%_eur' OR symbol LIKE '%eur' ORDER BY symbol"
        );

        console.log(`   Trovati ${eurSymbols.length} simboli EUR nel database`);
        console.log('');

        // 2. Filtra solo quelli disponibili su Binance
        const symbolsToDownload = [];
        for (const row of eurSymbols) {
            const symbol = row.symbol.toLowerCase();
            const binanceSymbol = EUR_SYMBOL_MAP[symbol];
            
            if (binanceSymbol) {
                // Verifica klines esistenti
                const existing = await dbAll(
                    "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = '15m'",
                    [row.symbol]
                );
                const count = parseInt(existing[0]?.count || 0);
                
                symbolsToDownload.push({
                    dbSymbol: row.symbol,
                    binanceSymbol: binanceSymbol,
                    existingKlines: count
                });
            }
        }

        console.log(`2️⃣ Simboli EUR disponibili su Binance da aggiornare: ${symbolsToDownload.length}`);
        console.log('');

        if (symbolsToDownload.length === 0) {
            console.log('✅ Nessun simbolo EUR disponibile da scaricare');
            console.log('');
            return;
        }

        // 3. Scarica klines per ogni simbolo
        console.log('3️⃣ Download klines...');
        console.log('');

        let totalDownloaded = 0;
        let successCount = 0;
        let skipCount = 0;

        for (const { dbSymbol, binanceSymbol, existingKlines } of symbolsToDownload) {
            console.log(`📊 ${dbSymbol.toUpperCase()}:`);
            console.log(`   Klines esistenti: ${existingKlines}`);
            
            // Se ha già klines sufficienti (> 1000), salta o aggiorna solo le ultime 7 giorni
            const daysToDownload = existingKlines > 1000 ? 7 : 30;
            
            if (existingKlines > 1000) {
                console.log(`   ⏭️ Klines sufficienti, aggiorno solo ultimi 7 giorni...`);
            } else {
                console.log(`   📥 Scarico 30 giorni di klines...`);
            }

            try {
                const inserted = await downloadKlines(dbSymbol, binanceSymbol, daysToDownload);
                if (inserted > 0) {
                    totalDownloaded += inserted;
                    successCount++;
                } else {
                    skipCount++;
                }
            } catch (error) {
                console.error(`   ❌ Errore: ${error.message}`);
                skipCount++;
            }
            
            console.log('');
            
            // Rate limiting tra simboli
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 4. Report finale
        console.log('='.repeat(80));
        console.log('✅ DOWNLOAD COMPLETATO');
        console.log('='.repeat(80));
        console.log('');
        console.log(`📊 Simboli processati: ${symbolsToDownload.length}`);
        console.log(`✅ Download riusciti: ${successCount}`);
        console.log(`⏭️ Simboli saltati: ${skipCount}`);
        console.log(`📥 Totale klines scaricate: ${totalDownloaded}`);
        console.log('');
        console.log('💡 Verifica con: node verify_all_klines.js | grep -E "_EUR|_eur"');
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante download klines EUR:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

downloadEurKlines().catch(console.error);

