/**
 * Script generico per scaricare klines storiche per qualsiasi simbolo
 * 
 * Uso: node download_klines.js <simbolo_db> <simbolo_binance>
 * Esempio: node download_klines.js binance_coin BNBUSDT
 *          node download_klines.js bonk BONKUSDT
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cryptoDb = require('./crypto_db');
const dbAll = cryptoDb.dbAll;
const dbRun = cryptoDb.dbRun;
const https = require('https');

const httpsGet = (url) => {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
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
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
};

// Mappa simboli DB -> Binance
const SYMBOL_MAP = {
    'bitcoin': 'BTCUSDT',
    'bitcoin_usdt': 'BTCUSDT',
    'ethereum': 'ETHUSDT',
    'ethereum_usdt': 'ETHUSDT',
    'solana': 'SOLUSDT',
    'cardano': 'ADAUSDT',
    'polkadot': 'DOTUSDT',
    'chainlink': 'LINKUSDT',
    'litecoin': 'LTCUSDT',
    'ripple': 'XRPUSDT',
    'binance_coin': 'BNBUSDT',
    'sand': 'SANDUSDT',
    'mana': 'MANAUSDT',
    'axs': 'AXSUSDT',
    'gala': 'GALAUSDT',
    'enj': 'ENJUSDT',
    'bonk': 'BONKUSDT',
    'shiba_inu': 'SHIBUSDT',
    'shib': 'SHIBUSDT',
    'avax_usdt': 'AVAXUSDT',
    'avalanche': 'AVAXUSDT',
    'avax': 'AVAXUSDT',
    'uniswap': 'UNIUSDT',
    'uni': 'UNIUSDT',
    'aave': 'AAVEUSDT',
    'global': null  // "global" non è un simbolo valido su Binance
};

async function downloadKlines(dbSymbol, binanceSymbol = null, days = 30) {
    try {
        // Determina simbolo Binance
        let symbol = binanceSymbol || SYMBOL_MAP[dbSymbol.toLowerCase()];
        
        // Se "global" o null, non è un simbolo valido
        if (dbSymbol.toLowerCase() === 'global' || symbol === null) {
            console.log(`❌ "global" non è un simbolo valido su Binance`);
            console.log(`   💡 Suggerimento: Usa un simbolo specifico (es. avax_usdt, ethereum, bitcoin)`);
            return { success: false, error: 'Simbolo non valido' };
        }
        
        // Se non trovato nella mappa, prova a normalizzare
        if (!symbol) {
            // Normalizza: rimuovi underscore, aggiungi USDT se mancante
            let normalized = dbSymbol.toLowerCase().replace(/_/g, '').replace(/usdt$/, '').replace(/eur$/, '');
            
            // Mapping speciali
            const specialMap = {
                'avax': 'AVAXUSDT',
                'avalanche': 'AVAXUSDT',
                'uni': 'UNIUSDT',
                'uniswap': 'UNIUSDT',
                'aave': 'AAVEUSDT',
                'sand': 'SANDUSDT',
                'mana': 'MANAUSDT',
                'bonk': 'BONKUSDT'
            };
            
            symbol = specialMap[normalized] || (normalized.toUpperCase() + 'USDT');
            console.log(`⚠️ Simbolo non standard, provo con ${symbol}`);
        }
        
        // Verifica formato simbolo Binance (solo lettere maiuscole, numeri, nessun underscore)
        if (!/^[A-Z0-9]{1,20}$/.test(symbol)) {
            console.log(`❌ Formato simbolo Binance non valido: ${symbol}`);
            console.log(`   💡 Il simbolo deve essere solo lettere maiuscole e numeri (es. AVAXUSDT, non avax_usdt)`);
            return { success: false, error: 'Formato simbolo non valido' };
        }

        console.log(`📥 Scaricamento klines per ${dbSymbol.toUpperCase()} (${symbol})...\n`);

        const interval = '15m';
        const limit = 1000;
        const endTime = Date.now();
        const startTime = endTime - (days * 24 * 60 * 60 * 1000);

        let allKlines = [];
        let currentStartTime = startTime;

        console.log(`📊 Parametri:`);
        console.log(`   Simbolo Binance: ${symbol}`);
        console.log(`   Simbolo DB: ${dbSymbol}`);
        console.log(`   Intervallo: ${interval}`);
        console.log(`   Periodo: ${days} giorni\n`);
        
        // Verifica formato simbolo Binance prima di procedere
        if (!/^[A-Z0-9]{1,20}$/.test(symbol)) {
            console.log(`❌ Formato simbolo Binance non valido: ${symbol}`);
            console.log(`   💡 Il simbolo deve essere solo lettere maiuscole e numeri (es. AVAXUSDT, non avax_usdt)`);
            return { success: false, error: 'Formato simbolo non valido' };
        }

        // Scarica a blocchi
        let blockCount = 0;
        while (currentStartTime < endTime) {
            const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStartTime}&limit=${limit}`;

            try {
                blockCount++;
                console.log(`📡 Blocco ${blockCount} da ${new Date(currentStartTime).toISOString()}...`);
                const klines = await httpsGet(url);

                if (!klines || klines.length === 0) {
                    console.log('   Nessun dato disponibile, fine scaricamento');
                    break;
                }

                // Verifica se è un errore di Binance
                if (klines.code) {
                    console.error(`   ❌ Errore Binance: ${klines.msg || 'Unknown error'}`);
                    break;
                }

                allKlines.push(...klines);
                currentStartTime = klines[klines.length - 1][0] + 1;
                console.log(`   ✅ ${klines.length} candele scaricate (totale: ${allKlines.length})`);

                // Pausa per non sovraccaricare API
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`   ❌ Errore: ${error.message}`);
                if (error.message.includes('404') || error.message.includes('Invalid symbol')) {
                    console.error(`   ⚠️ Simbolo ${symbol} non trovato su Binance. Verifica il nome del simbolo.`);
                }
                break;
            }
        }

        if (allKlines.length === 0) {
            console.error(`\n❌ Nessuna candela scaricata per ${symbol}`);
            console.error(`   Verifica che il simbolo sia corretto su Binance.`);
            return;
        }

        console.log(`\n✅ Totale candele scaricate: ${allKlines.length}`);
        console.log(`💾 Inserimento nel database...\n`);

        // Inserisci nel database
        let inserted = 0;
        let skipped = 0;
        for (const k of allKlines) {
            try {
                await dbRun(
                    `INSERT INTO klines (symbol, interval, open_time, open_price, high_price, low_price, close_price, volume, close_time)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     ON CONFLICT (symbol, interval, open_time) DO NOTHING`,
                    [dbSymbol, interval, k[0], k[1], k[2], k[3], k[4], k[5], k[6]]
                );
                inserted++;
            } catch (error) {
                skipped++;
                // Ignora duplicati
            }
        }

        console.log(`✅ ${inserted} candele inserite`);
        if (skipped > 0) {
            console.log(`⚠️ ${skipped} candele già presenti (saltate)`);
        }

        console.log(`\n🎉 Klines per ${dbSymbol.toUpperCase()} scaricate con successo!`);

    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
        throw error;
    }
}

async function downloadAllMissing() {
    try {
        console.log('📥 Scaricamento klines per tutti i simboli con posizioni aperte...\n');

        // Recupera tutte le posizioni aperte
        const openPositions = await dbAll("SELECT DISTINCT symbol FROM open_positions WHERE status = 'open'");
        
        if (openPositions.length === 0) {
            console.log('❌ Nessuna posizione aperta trovata');
            return;
        }

        console.log(`📊 Trovate ${openPositions.length} posizioni aperte\n`);

        for (const pos of openPositions) {
            const symbol = pos.symbol;
            
            // Conta klines per questo simbolo
            const klinesCount = await dbAll(
                "SELECT COUNT(*) as count FROM klines WHERE symbol = $1 AND interval = '15m'",
                [symbol]
            );

            const count = parseInt(klinesCount[0]?.count || 0);
            
            if (count < 20) {
                console.log(`\n${'='.repeat(60)}`);
                console.log(`📥 Scaricamento klines per ${symbol.toUpperCase()} (attuali: ${count})`);
                console.log(`${'='.repeat(60)}\n`);
                
                try {
                    await downloadKlines(symbol);
                } catch (error) {
                    console.error(`❌ Errore scaricamento ${symbol}:`, error.message);
                }
                
                // Pausa tra simboli
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log(`✅ ${symbol.toUpperCase()}: ${count} klines (sufficienti, skip)`);
            }
        }

        console.log(`\n🎉 Scaricamento completato!`);

    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error(error.stack);
    }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
    // Nessun argomento: scarica tutti i simboli con posizioni aperte
    downloadAllMissing().then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
} else if (args[0] === 'all') {
    // Scarica tutti i simboli con posizioni aperte
    downloadAllMissing().then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
} else {
    // Scarica un simbolo specifico
    const dbSymbol = args[0];
    const binanceSymbol = args[1] || null;
    const days = parseInt(args[2]) || 30;

    downloadKlines(dbSymbol, binanceSymbol, days).then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

