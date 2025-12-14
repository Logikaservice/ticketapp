/**
 * 🧹 PULIZIA DUPLICATI - PostgreSQL VPS
 * 
 * Questo script:
 * 1. Identifica tutti i simboli duplicati (stesso trading pair)
 * 2. Disattiva i duplicati nel database VPS
 * 3. Mantiene solo UNA versione per ogni trading pair
 * 4. Preserva i dati storici (klines, trades, ecc.)
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Configurazione PostgreSQL (stessa logica di crypto_db.js)
let cryptoDbUrl = process.env.DATABASE_URL_CRYPTO;

if (!cryptoDbUrl && process.env.DATABASE_URL) {
    cryptoDbUrl = process.env.DATABASE_URL.replace(/\/[^\/]+$/, '/crypto_db');
    console.log(`📊 Usando database separato: crypto_db`);
} else if (cryptoDbUrl) {
    console.log(`📊 Usando DATABASE_URL_CRYPTO configurato`);
} else {
    cryptoDbUrl = process.env.DATABASE_URL;
}

if (!cryptoDbUrl) {
    console.error('❌ DATABASE_URL o DATABASE_URL_CRYPTO non configurato!');
    process.exit(1);
}

// Disabilita SSL per localhost
const isLocalhost = cryptoDbUrl.includes('localhost') || cryptoDbUrl.includes('127.0.0.1');
const pool = new Pool({
    connectionString: cryptoDbUrl,
    ssl: isLocalhost ? false : { rejectUnauthorized: false }
});

// Mappa simboli -> trading pair (dal tuo codice)
const SYMBOL_TO_PAIR = {
    'bitcoin': 'BTCUSDT',
    'bitcoin_usdt': 'BTCUSDT',
    'solana': 'SOLUSDT',
    'solana_eur': 'SOLUSDT',
    'ethereum': 'ETHUSDT',
    'ethereum_usdt': 'ETHUSDT',
    'cardano': 'ADAUSDT',
    'cardano_usdt': 'ADAUSDT',
    'polkadot': 'DOTUSDT',
    'polkadot_usdt': 'DOTUSDT',
    'chainlink': 'LINKEUR',
    'chainlink_usdt': 'LINKUSDT',
    'litecoin': 'LTCUSDT',
    'litecoin_usdt': 'LTCUSDT',
    'ripple': 'XRPUSDT',
    'ripple_eur': 'XRPUSDT',
    'binance_coin': 'BNBUSDT',
    'binance_coin_eur': 'BNBUSDT',
    'pol_polygon': 'POLUSDT',
    'pol_polygon_eur': 'POLUSDT',
    'avalanche': 'AVAXUSDT',
    'avalanche_eur': 'AVAXUSDT',
    'uniswap': 'UNIUSDT',
    'uniswap_eur': 'UNIUSDT',
    'dogecoin': 'DOGEUSDT',
    'dogecoin_eur': 'DOGEUSDT',
    'shiba': 'SHIBUSDT',
    'shiba_eur': 'SHIBUSDT',
    'near': 'NEARUSDT',
    'near_eur': 'NEARUSDT',
    'atom': 'ATOMUSDT',
    'atom_eur': 'ATOMUSDT',
    'aave': 'AAVEUSDT',
    'sand': 'SANDUSDT',
    'fil': 'FILUSDT',
    'trx': 'TRXUSDT',
    'trx_eur': 'TRXUSDT',
    'xlm': 'XLMUSDT',
    'xlm_eur': 'XLMUSDT',
    'arb': 'ARBUSDT',
    'arb_eur': 'ARBUSDT',
    'op': 'OPUSDT',
    'op_eur': 'OPUSDT',
    'matic': 'MATICUSDT',
    'matic_eur': 'MATICUSDT',
    'crv': 'CRVUSDT',
    'ldo': 'LDOUSDT',
    'mana': 'MANAUSDT',
    'axs': 'AXSUSDT',
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

// Identifica duplicati e scegli quale tenere
function identifyDuplicates() {
    const pairToSymbols = {};

    // Raggruppa simboli per trading pair
    Object.entries(SYMBOL_TO_PAIR).forEach(([symbol, pair]) => {
        if (!pairToSymbols[pair]) {
            pairToSymbols[pair] = [];
        }
        pairToSymbols[pair].push(symbol);
    });

    const duplicates = {};
    const toKeep = {};
    const toRemove = [];

    // Per ogni trading pair con duplicati, scegli quale tenere
    Object.entries(pairToSymbols).forEach(([pair, symbols]) => {
        if (symbols.length > 1) {
            // Priorità: _usdt > _eur > nome base
            const sorted = symbols.sort((a, b) => {
                if (a.endsWith('_usdt')) return -1;
                if (b.endsWith('_usdt')) return 1;
                if (a.endsWith('_eur')) return -1;
                if (b.endsWith('_eur')) return 1;
                return a.localeCompare(b);
            });

            duplicates[pair] = {
                keep: sorted[0],
                remove: sorted.slice(1)
            };

            toKeep[pair] = sorted[0];
            toRemove.push(...sorted.slice(1));
        } else {
            toKeep[pair] = symbols[0];
        }
    });

    return { duplicates, toKeep, toRemove, pairToSymbols };
}

async function cleanupDatabase() {
    const client = await pool.connect();

    try {
        console.log('🧹 PULIZIA DUPLICATI - PostgreSQL VPS\n');
        console.log('='.repeat(80));

        // Test connessione
        console.log('\n📡 Test connessione database VPS...');
        const testResult = await client.query('SELECT NOW()');
        console.log(`✅ Connesso a PostgreSQL VPS: ${testResult.rows[0].now}`);

        // Identifica duplicati
        console.log('\n🔍 Identificazione duplicati...\n');
        const { duplicates, toKeep, toRemove, pairToSymbols } = identifyDuplicates();

        console.log(`📊 Statistiche:`);
        console.log(`   Trading pairs totali: ${Object.keys(pairToSymbols).length}`);
        console.log(`   Trading pairs con duplicati: ${Object.keys(duplicates).length}`);
        console.log(`   Simboli da mantenere: ${Object.keys(toKeep).length}`);
        console.log(`   Simboli da rimuovere: ${toRemove.length}`);

        // Mostra duplicati
        console.log('\n📋 DUPLICATI IDENTIFICATI:\n');
        Object.entries(duplicates).forEach(([pair, info]) => {
            console.log(`${pair}:`);
            console.log(`   ✅ MANTIENI: ${info.keep}`);
            console.log(`   ❌ RIMUOVI:  ${info.remove.join(', ')}`);
        });

        // Verifica simboli nel database
        console.log('\n\n🔍 Verifica simboli nel database VPS...\n');
        const dbSymbols = await client.query(
            `SELECT symbol, is_active, parameters 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' 
             AND symbol != 'global'
             ORDER BY symbol`
        );

        console.log(`📊 Simboli trovati nel database: ${dbSymbols.rows.length}`);

        // Conta quanti duplicati sono nel DB
        const duplicatesInDb = dbSymbols.rows.filter(row => toRemove.includes(row.symbol));
        console.log(`   Di cui duplicati da rimuovere: ${duplicatesInDb.length}`);

        if (duplicatesInDb.length > 0) {
            console.log('\n📝 Duplicati trovati nel database:');
            duplicatesInDb.forEach(row => {
                const pair = SYMBOL_TO_PAIR[row.symbol];
                const isActive = row.is_active === 1 || row.is_active === true;
                console.log(`   ${row.symbol.padEnd(20)} → ${pair.padEnd(12)} (${isActive ? 'ATTIVO' : 'inattivo'})`);
            });
        }

        // STEP 1: Disattiva duplicati nel database
        console.log('\n\n🔧 STEP 1: Disattivazione duplicati nel database...\n');

        let deactivated = 0;
        for (const symbol of toRemove) {
            try {
                const result = await client.query(
                    `UPDATE bot_settings 
                     SET is_active = 0 
                     WHERE strategy_name = 'RSI_Strategy' 
                     AND symbol = $1`,
                    [symbol]
                );

                if (result.rowCount > 0) {
                    deactivated++;
                    console.log(`   ✅ Disattivato: ${symbol}`);
                }
            } catch (err) {
                console.log(`   ⚠️  ${symbol}: ${err.message}`);
            }
        }

        console.log(`\n📊 Disattivati: ${deactivated}/${toRemove.length} simboli duplicati`);

        // STEP 2: Verifica simboli da mantenere sono attivi
        console.log('\n\n🔧 STEP 2: Verifica simboli da mantenere...\n');

        let activated = 0;
        let alreadyActive = 0;

        for (const [pair, symbol] of Object.entries(toKeep)) {
            try {
                // Verifica se esiste
                const existing = await client.query(
                    `SELECT is_active FROM bot_settings 
                     WHERE strategy_name = 'RSI_Strategy' AND symbol = $1`,
                    [symbol]
                );

                if (existing.rows.length === 0) {
                    // Crea se non esiste
                    await client.query(
                        `INSERT INTO bot_settings (strategy_name, symbol, is_active, parameters)
                         VALUES ('RSI_Strategy', $1, 1, '{}')`,
                        [symbol]
                    );
                    activated++;
                    console.log(`   ✅ Creato e attivato: ${symbol} (${pair})`);
                } else {
                    const isActive = existing.rows[0].is_active === 1 || existing.rows[0].is_active === true;
                    if (!isActive) {
                        // Attiva se disattivo
                        await client.query(
                            `UPDATE bot_settings 
                             SET is_active = 1 
                             WHERE strategy_name = 'RSI_Strategy' AND symbol = $1`,
                            [symbol]
                        );
                        activated++;
                        console.log(`   ✅ Attivato: ${symbol} (${pair})`);
                    } else {
                        alreadyActive++;
                    }
                }
            } catch (err) {
                console.log(`   ⚠️  ${symbol}: ${err.message}`);
            }
        }

        console.log(`\n📊 Simboli da mantenere:`);
        console.log(`   ✅ Attivati: ${activated}`);
        console.log(`   ⏭️  Già attivi: ${alreadyActive}`);

        // STEP 3: Riepilogo finale
        console.log('\n\n📊 RIEPILOGO FINALE:\n');
        console.log('='.repeat(80));

        const finalSymbols = await client.query(
            `SELECT symbol, is_active 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' 
             AND symbol != 'global'
             AND is_active = 1
             ORDER BY symbol`
        );

        console.log(`\n✅ Simboli ATTIVI nel database: ${finalSymbols.rows.length}`);
        console.log(`\n📋 Lista simboli attivi (senza duplicati):\n`);

        const activeByPair = {};
        finalSymbols.rows.forEach(row => {
            const pair = SYMBOL_TO_PAIR[row.symbol] || 'UNKNOWN';
            if (!activeByPair[pair]) {
                activeByPair[pair] = [];
            }
            activeByPair[pair].push(row.symbol);
        });

        Object.entries(activeByPair).sort().forEach(([pair, symbols]) => {
            if (symbols.length > 1) {
                console.log(`   ⚠️  ${pair}: ${symbols.join(', ')} (ANCORA DUPLICATI!)`);
            } else {
                console.log(`   ✅ ${pair.padEnd(12)} → ${symbols[0]}`);
            }
        });

        // Verifica duplicati rimanenti
        const remainingDuplicates = Object.entries(activeByPair).filter(([pair, symbols]) => symbols.length > 1);

        if (remainingDuplicates.length > 0) {
            console.log(`\n⚠️  ATTENZIONE: ${remainingDuplicates.length} trading pairs hanno ancora duplicati attivi!`);
        } else {
            console.log(`\n✅ PERFETTO! Nessun duplicato rimanente!`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ PULIZIA DATABASE COMPLETATA!\n');

        // Genera lista per aggiornare il codice
        console.log('\n📝 PROSSIMO STEP: Aggiornare SYMBOL_TO_PAIR in cryptoRoutes.js\n');
        console.log('Simboli da rimuovere dal codice:');
        toRemove.forEach(sym => {
            console.log(`   - '${sym}'`);
        });

    } catch (error) {
        console.error('\n❌ ERRORE:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

// Esegui pulizia
cleanupDatabase().catch(console.error);
