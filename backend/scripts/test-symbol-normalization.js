/**
 * Script per testare la normalizzazione dei simboli e verificare
 * se ci sono problemi con il recupero dei prezzi
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Usa la stessa logica di connessione del database crypto
let cryptoDbUrl = process.env.DATABASE_URL_CRYPTO;

if (!cryptoDbUrl && process.env.DATABASE_URL) {
    cryptoDbUrl = process.env.DATABASE_URL.replace(/\/[^\/]+$/, '/crypto_db');
} else if (!cryptoDbUrl) {
    cryptoDbUrl = process.env.DATABASE_URL;
}

// Disabilita SSL per localhost (come in crypto_db_postgresql.js)
const isLocalhost = cryptoDbUrl && (cryptoDbUrl.includes('localhost') || cryptoDbUrl.includes('127.0.0.1'));

// Simula la logica di normalizzazione dal codice
function normalizeSymbol(symbol) {
    return symbol.toLowerCase()
        .replace(/\//g, '') // Rimuovi tutti gli slash
        .replace(/_/g, '') // Rimuovi TUTTI gli underscore
        .replace(/usdt$/, '') // Rimuovi suffisso USDT
        .replace(/eur$/, ''); // Rimuovi suffisso EUR
}

// Mappa SYMBOL_TO_PAIR (copiata da cryptoRoutes.js)
const SYMBOL_TO_PAIR = {
    'bitcoin': 'BTCUSDT',
    'bitcoin_usdt': 'BTCUSDT',
    'ethereum': 'ETHUSDT',
    'ethereum_usdt': 'ETHUSDT',
    'solana': 'SOLUSDT',
    'solana_eur': 'SOLUSDT',
    'cardano': 'ADAUSDT',
    'cardano_usdt': 'ADAUSDT',
    'polkadot': 'DOTUSDT',
    'polkadot_usdt': 'DOTUSDT',
    'chainlink': 'LINKUSDT',
    'chainlink_usdt': 'LINKUSDT',
    'litecoin': 'LTCUSDT',
    'litecoin_usdt': 'LTCUSDT',
    'ripple': 'XRPUSDT',
    'ripple_eur': 'XRPUSDT',
    'binance_coin': 'BNBUSDT',
    'binance_coin_eur': 'BNBUSDT',
    'avalanche': 'AVAXUSDT',
    'avalanche_eur': 'AVAXUSDT',
    'uniswap': 'UNIUSDT',
    'uniswap_eur': 'UNIUSDT',
    'dogecoin': 'DOGEUSDT',
    'dogecoin_eur': 'DOGEUSDT',
    'shiba': 'SHIBUSDT',
    'shiba_eur': 'SHIBUSDT',
    'pol_polygon': 'POLUSDT',
    'pol_polygon_eur': 'POLUSDT',
    'near': 'NEARUSDT',
    'near_eur': 'NEARUSDT',
    'atom': 'ATOMUSDT',
    'atom_eur': 'ATOMUSDT',
    'arb': 'ARBUSDT',
    'arb_eur': 'ARBUSDT',
    'op': 'OPUSDT',
    'op_eur': 'OPUSDT',
    'matic': 'MATICUSDT',
    'matic_eur': 'MATICUSDT',
    'trx': 'TRXUSDT',
    'trx_eur': 'TRXUSDT',
    'xlm': 'XLMUSDT',
    'xlm_eur': 'XLMUSDT',
    'aave': 'AAVEUSDT',
    'crv': 'CRVUSDT',
    'ldo': 'LDOUSDT',
    'sand': 'SANDUSDT',
    'mana': 'MANAUSDT',
    'axs': 'AXSUSDT',
    'fil': 'FILUSDT',
    'usdc': 'USDCUSDT',
    'sui': 'SUIUSDT',
    'sui_eur': 'SUIUSDT',
    'apt': 'APTUSDT',
    'sei': 'SEIUSDT',
    'ton': 'TONUSDT',
    'inj': 'INJUSDT',
    'algo': 'ALGOUSDT',
    'vet': 'VETUSDT',
    'icp': 'ICPUSDT',
    'mkr': 'MKRUSDT',
    'comp': 'COMPUSDT',
    'snx': 'SNXUSDT',
    'fet': 'FETUSDT',
    'render': 'RENDERUSDT',
    'grt': 'GRTUSDT',
    'imx': 'IMXUSDT',
    'gala': 'GALAUSDT',
    'enj': 'ENJUSDT',
    'enj_eur': 'ENJUSDT',
    'pepe': 'PEPEUSDT',
    'pepe_eur': 'PEPEUSDT',
    'floki': 'FLOKIUSDT',
    'bonk': 'BONKUSDT',
    'ar': 'ARUSDT'
};

// Test di normalizzazione
function testNormalization(originalSymbol) {
    const normalized = normalizeSymbol(originalSymbol);
    const found = SYMBOL_TO_PAIR[normalized] !== undefined;
    
    // Prova varianti se non trovato
    let foundVariant = null;
    if (!found) {
        const variants = [
            originalSymbol.toLowerCase().replace(/_/g, '').replace(/\//g, ''),
            originalSymbol.toLowerCase().replace(/_/g, ''),
            originalSymbol.toLowerCase(),
            originalSymbol
        ];
        
        for (const variant of variants) {
            if (SYMBOL_TO_PAIR[variant]) {
                foundVariant = variant;
                break;
            }
        }
    }
    
    return {
        original: originalSymbol,
        normalized: normalized,
        found: found,
        tradingPair: found ? SYMBOL_TO_PAIR[normalized] : (foundVariant ? SYMBOL_TO_PAIR[foundVariant] : null),
        foundViaVariant: foundVariant !== null
    };
}

async function testPriceFetch(symbol) {
    try {
        const https = require('https');
        const normalized = normalizeSymbol(symbol);
        let tradingPair = SYMBOL_TO_PAIR[normalized];
        
        if (!tradingPair) {
            const variants = [
                symbol.toLowerCase().replace(/_/g, '').replace(/\//g, ''),
                symbol.toLowerCase().replace(/_/g, ''),
                symbol.toLowerCase(),
                symbol
            ];
            
            for (const variant of variants) {
                if (SYMBOL_TO_PAIR[variant]) {
                    tradingPair = SYMBOL_TO_PAIR[variant];
                    break;
                }
            }
        }
        
        if (!tradingPair) {
            return { success: false, error: 'Trading pair not found' };
        }
        
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${tradingPair}`;
        
        return new Promise((resolve) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.price) {
                            resolve({ success: true, price: parseFloat(json.price), tradingPair });
                        } else {
                            resolve({ success: false, error: 'No price in response', response: json });
                        }
                    } catch (e) {
                        resolve({ success: false, error: e.message, rawData: data });
                    }
                });
            }).on('error', (err) => {
                resolve({ success: false, error: err.message });
            });
        });
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function main() {
    if (!cryptoDbUrl) {
        console.error('❌ DATABASE_URL o DATABASE_URL_CRYPTO non configurato!');
        process.exit(1);
    }
    
    const pool = new Pool({
        connectionString: cryptoDbUrl,
        ssl: isLocalhost ? false : {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🔍 Test normalizzazione simboli e recupero prezzi\n');
        console.log('='.repeat(80));
        
        // Recupera tutte le posizioni aperte
        const result = await pool.query(`
            SELECT DISTINCT symbol, COUNT(*) as count
            FROM open_positions
            WHERE status = 'open'
            GROUP BY symbol
            ORDER BY symbol
        `);
        
        if (result.rows.length === 0) {
            console.log('⚠️  Nessuna posizione aperta trovata nel database');
            console.log('   Continuo con test di normalizzazione su simboli comuni...\n');
        }
        
        if (result.rows.length > 0) {
            console.log(`\n📊 Trovate ${result.rows.length} simboli unici con posizioni aperte:\n`);
        }
        
        const problems = [];
        const successes = [];
        
        for (const row of result.rows) {
            const symbol = row.symbol;
            const count = row.count;
            
            console.log(`\n${'─'.repeat(80)}`);
            console.log(`🔸 Simbolo: ${symbol} (${count} posizione/i)`);
            
            // Test normalizzazione
            const normTest = testNormalization(symbol);
            console.log(`   Normalizzato: "${normTest.normalized}"`);
            
            if (normTest.found) {
                console.log(`   ✅ Trovato in SYMBOL_TO_PAIR: ${normTest.tradingPair}`);
            } else if (normTest.foundViaVariant) {
                console.log(`   ⚠️  Trovato tramite variante: ${normTest.tradingPair}`);
            } else {
                console.log(`   ❌ NON TROVATO in SYMBOL_TO_PAIR!`);
                problems.push({
                    symbol,
                    issue: 'Symbol not found in SYMBOL_TO_PAIR',
                    normalized: normTest.normalized
                });
            }
            
            // Test recupero prezzo
            if (normTest.tradingPair) {
                console.log(`   🔄 Test recupero prezzo da Binance...`);
                const priceTest = await testPriceFetch(symbol);
                
                if (priceTest.success) {
                    console.log(`   ✅ Prezzo recuperato: $${priceTest.price.toFixed(6)} USDT (${priceTest.tradingPair})`);
                    successes.push({
                        symbol,
                        normalized: normTest.normalized,
                        tradingPair: priceTest.tradingPair,
                        price: priceTest.price
                    });
                } else {
                    console.log(`   ❌ Errore recupero prezzo: ${priceTest.error}`);
                    problems.push({
                        symbol,
                        issue: 'Price fetch failed',
                        error: priceTest.error,
                        tradingPair: normTest.tradingPair
                    });
                }
            }
            
            // Piccola pausa per non sovraccaricare Binance API
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`\n${'='.repeat(80)}`);
        console.log('\n📋 RIEPILOGO:\n');
        
        if (successes.length > 0) {
            console.log(`✅ Simboli funzionanti (${successes.length}):`);
            successes.forEach(s => {
                console.log(`   - ${s.symbol} → ${s.normalized} → ${s.tradingPair} ($${s.price.toFixed(6)})`);
            });
        }
        
        if (problems.length > 0) {
            console.log(`\n❌ Problemi trovati (${problems.length}):`);
            problems.forEach(p => {
                console.log(`   - ${p.symbol}: ${p.issue}`);
                if (p.error) console.log(`     Errore: ${p.error}`);
                if (p.normalized) console.log(`     Normalizzato come: "${p.normalized}"`);
            });
        } else {
            console.log('\n✅ Nessun problema trovato! Tutti i simboli funzionano correttamente.');
        }
        
        // Test anche alcuni simboli comuni che potrebbero essere nel database
        console.log(`\n${'='.repeat(80)}`);
        console.log('\n🧪 Test simboli comuni (anche se non presenti nel database):\n');
        
        const commonSymbols = [
            'ICP', 'ICPUSDT', 'icp_usdt', 'icp/usdt', 
            'BTC', 'BTCUSDT', 'btc_usdt',
            'ETH', 'ETHUSDT', 'eth_usdt',
            'SOL', 'SOLUSDT', 'sol_eur',
            'ADA', 'ADAUSDT', 'cardano',
            'XRP', 'XRPUSDT', 'ripple',
            'DOT', 'DOTUSDT', 'polkadot',
            'ATOM', 'ATOMUSDT', 'atom_eur',
            'SUI', 'SUIUSDT', 'sui_eur',
            'TON', 'TONUSDT', 'ton',
            'NEAR', 'NEARUSDT', 'near_eur'
        ];
        
        const testResults = [];
        for (const testSymbol of commonSymbols) {
            const normTest = testNormalization(testSymbol);
            const status = normTest.found || normTest.foundViaVariant ? '✅' : '❌';
            console.log(`   ${status} ${testSymbol.padEnd(20)} → "${normTest.normalized.padEnd(15)}" → ${normTest.tradingPair || 'NON TROVATO'}`);
            
            if (!normTest.found && !normTest.foundViaVariant) {
                testResults.push({
                    symbol: testSymbol,
                    normalized: normTest.normalized,
                    issue: 'Not found in SYMBOL_TO_PAIR'
                });
            }
        }
        
        if (testResults.length > 0) {
            console.log(`\n⚠️  ${testResults.length} simboli di test non trovati nella mappa:`);
            testResults.forEach(r => {
                console.log(`   - ${r.symbol} (normalized: "${r.normalized}")`);
            });
        }
        
        // Test recupero prezzi per alcuni simboli chiave
        console.log(`\n${'='.repeat(80)}`);
        console.log('\n💰 Test recupero prezzi da Binance (simboli chiave):\n');
        
        const keySymbols = ['ICP', 'BTC', 'ETH', 'SOL', 'ADA', 'XRP'];
        for (const testSymbol of keySymbols) {
            console.log(`   🔄 Testando ${testSymbol}...`);
            const priceTest = await testPriceFetch(testSymbol);
            if (priceTest.success) {
                console.log(`   ✅ ${testSymbol}: $${priceTest.price.toFixed(6)} USDT (${priceTest.tradingPair})`);
            } else {
                console.log(`   ❌ ${testSymbol}: Errore - ${priceTest.error}`);
            }
            await new Promise(resolve => setTimeout(resolve, 200)); // Pausa per non sovraccaricare API
        }
        
    } catch (err) {
        console.error('❌ Errore:', err);
    } finally {
        await pool.end();
    }
}

main().catch(console.error);

