/**
 * 🔄 Script per Aggiornare Klines Vecchie
 * 
 * Trova e aggiorna klines vecchie (> 1 ora) per tutti i simboli
 */

const { dbAll, dbGet, dbRun } = require('./crypto_db');
const https = require('https');

// Mappa simboli database -> Binance
const SYMBOL_MAP = {
    'bitcoin': 'BTCUSDT',
    'ethereum': 'ETHUSDT',
    'solana': 'SOLUSDT',
    'cardano': 'ADAUSDT',
    'polkadot': 'DOTUSDT',
    'ripple': 'XRPUSDT',
    'chainlink': 'LINKUSDT',
    'litecoin': 'LTCUSDT',
    'binance_coin': 'BNBUSDT',
    'avax_usdt': 'AVAXUSDT',
    'sand': 'SANDUSDT',
    'uniswap': 'UNIUSDT',
    'aave': 'AAVEUSDT',
    'mana': 'MANAUSDT',
    'bonk': 'BONKUSDT',
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
    'polygon': 'MATICUSDT'
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

async function updateKlinesForSymbol(symbol, binanceSymbol) {
    console.log(`   📥 Aggiornamento klines per ${symbol} (${binanceSymbol})...`);
    
    const interval = '15m';
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    try {
        // Scarica ultime 24 ore di klines
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&startTime=${oneDayAgo}&limit=1000`;
        const klines = await httpsGet(url);
        
        if (!Array.isArray(klines) || klines.length === 0) {
            console.log(`      ⚠️ Nessuna kline ricevuta`);
            return 0;
        }
        
        // Inserisci/aggiorna nel database
        let inserted = 0;
        let updated = 0;
        
        for (const k of klines) {
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
                    [symbol, interval, k[0], k[1], k[2], k[3], k[4], k[5], k[6]]
                );
                
                // Verifica se era nuovo o aggiornato
                const existing = await dbGet(
                    "SELECT open_time FROM klines WHERE symbol = $1 AND interval = $2 AND open_time = $3",
                    [symbol, interval, k[0]]
                );
                
                if (existing) {
                    updated++;
                } else {
                    inserted++;
                }
            } catch (error) {
                // Ignora errori di inserimento
            }
        }
        
        console.log(`      ✅ ${inserted} nuove, ${updated} aggiornate`);
        return inserted + updated;
    } catch (error) {
        console.error(`      ❌ Errore: ${error.message}`);
        return 0;
    }
}

async function updateStaleKlines() {
    console.log('🔄 AGGIORNAMENTO KLINES VECCHIE');
    console.log('='.repeat(80));
    console.log('');

    try {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        // 1. Trova simboli con klines vecchie (> 1 ora)
        console.log('📊 Ricerca simboli con klines vecchie...');
        const staleKlines = await dbAll(
            `SELECT 
                symbol,
                MAX(open_time) as last_time,
                COUNT(*) as count
             FROM klines 
             WHERE interval = $1
             GROUP BY symbol
             HAVING MAX(open_time) < $2
             ORDER BY symbol`,
            ['15m', oneHourAgo]
        );

        console.log(`   Trovati ${staleKlines.length} simboli con klines vecchie (> 1 ora)`);
        console.log('');

        if (staleKlines.length === 0) {
            console.log('✅ Tutte le klines sono aggiornate!');
            console.log('');
            return;
        }

        // 2. Trova anche simboli con klines molto vecchie (> 1 giorno)
        const veryStaleKlines = staleKlines.filter(row => parseInt(row.last_time) < oneDayAgo);
        if (veryStaleKlines.length > 0) {
            console.log(`⚠️ ${veryStaleKlines.length} simboli con klines MOLTO vecchie (> 24h):`);
            veryStaleKlines.forEach(row => {
                const age = (now - parseInt(row.last_time)) / (24 * 60 * 60 * 1000);
                console.log(`   - ${row.symbol}: ${age.toFixed(1)} giorni fa`);
            });
            console.log('');
        }

        // 3. Aggiorna klines per ogni simbolo
        console.log('🔄 Aggiornamento klines...');
        console.log('');

        let totalUpdated = 0;
        let successCount = 0;
        let skipCount = 0;

        for (const row of staleKlines) {
            const symbol = row.symbol;
            const symbolLower = symbol.toLowerCase();
            
            // Salta simboli EUR (non supportati da Binance)
            if (symbolLower.includes('_eur') || symbolLower.endsWith('eur')) {
                console.log(`   ⏭️ ${symbol}: Saltato (simboli EUR non supportati da Binance)`);
                skipCount++;
                continue;
            }

            // Trova simbolo Binance
            let binanceSymbol = SYMBOL_MAP[symbolLower];
            if (!binanceSymbol) {
                const baseSymbol = symbol
                    .toUpperCase()
                    .replace(/_USDT$/, '')
                    .replace(/_EUR$/, '')
                    .replace(/_/, '');
                binanceSymbol = `${baseSymbol}USDT`;
            }

            const updated = await updateKlinesForSymbol(symbol, binanceSymbol);
            if (updated > 0) {
                totalUpdated += updated;
                successCount++;
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log('');
        console.log('='.repeat(80));
        console.log('✅ AGGIORNAMENTO COMPLETATO');
        console.log('='.repeat(80));
        console.log(`📊 Simboli aggiornati: ${successCount}`);
        console.log(`📊 Klines aggiornate: ${totalUpdated}`);
        console.log(`⏭️ Simboli saltati (EUR): ${skipCount}`);
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante aggiornamento:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

updateStaleKlines().catch(console.error);

