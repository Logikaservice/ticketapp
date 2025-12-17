/**
 * 🔍 VERIFICA STATO DUPLICATI - PostgreSQL VPS
 * 
 * Questo script verifica lo stato attuale dei simboli duplicati nel database.
 * Mostra se sono ancora presenti (disattivati) o se sono stati eliminati definitivamente.
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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

// Lista simboli duplicati da verificare
const SYMBOLS_TO_CHECK = [
    'bitcoin',          // duplicato di bitcoin_usdt (BTCUSDT)
    'ethereum',         // duplicato di ethereum_usdt (ETHUSDT)
    'solana',           // duplicato di solana_eur (SOLUSDT)
    'cardano',          // duplicato di cardano_usdt (ADAUSDT)
    'polkadot',         // duplicato di polkadot_usdt (DOTUSDT)
    'litecoin',         // duplicato di litecoin_usdt (LTCUSDT)
    'ripple',           // duplicato di ripple_eur (XRPUSDT)
    'binance_coin',     // duplicato di binance_coin_eur (BNBUSDT)
    'pol_polygon',      // duplicato di pol_polygon_eur (POLUSDT)
    'avalanche',        // duplicato di avalanche_eur (AVAXUSDT)
    'uniswap',          // duplicato di uniswap_eur (UNIUSDT)
    'dogecoin',         // duplicato di dogecoin_eur (DOGEUSDT)
    'shiba',            // duplicato di shiba_eur (SHIBUSDT)
    'near',             // duplicato di near_eur (NEARUSDT)
    'atom',             // duplicato di atom_eur (ATOMUSDT)
    'trx',              // duplicato di trx_eur (TRXUSDT)
    'xlm',              // duplicato di xlm_eur (XLMUSDT)
    'arb',              // duplicato di arb_eur (ARBUSDT)
    'op',               // duplicato di op_eur (OPUSDT)
    'matic',            // duplicato di matic_eur (MATICUSDT)
    'sui',              // duplicato di sui_eur (SUIUSDT)
    'enj',              // duplicato di enj_eur (ENJUSDT)
    'pepe'              // duplicato di pepe_eur (PEPEUSDT)
];

async function verifyDuplicatesStatus() {
    const client = await pool.connect();

    try {
        console.log('🔍 VERIFICA STATO DUPLICATI - PostgreSQL VPS\n');
        console.log('='.repeat(80));

        // Test connessione
        console.log('\n📡 Test connessione database VPS...');
        const testResult = await client.query('SELECT NOW()');
        console.log(`✅ Connesso a PostgreSQL VPS: ${testResult.rows[0].now}\n`);

        // Verifica simboli nel database
        console.log('🔍 Verifica simboli duplicati nel database...\n');
        const dbSymbols = await client.query(
            `SELECT symbol, is_active 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' 
             AND symbol != 'global'
             AND symbol = ANY($1::text[])
             ORDER BY symbol`,
            [SYMBOLS_TO_CHECK]
        );

        console.log(`📊 Simboli duplicati da verificare: ${SYMBOLS_TO_CHECK.length}`);
        console.log(`📊 Simboli trovati nel database: ${dbSymbols.rows.length}\n`);

        if (dbSymbols.rows.length === 0) {
            console.log('✅ PERFETTO! Tutti i simboli duplicati sono stati ELIMINATI DEFINITIVAMENTE dal database!\n');
        } else {
            console.log('⚠️  ATTENZIONE: Alcuni simboli duplicati sono ancora presenti nel database!\n');
            console.log('📝 Dettagli simboli trovati:');
            
            const activeSymbols = [];
            const inactiveSymbols = [];

            dbSymbols.rows.forEach(row => {
                const isActive = row.is_active === 1 || row.is_active === true;
                if (isActive) {
                    activeSymbols.push(row.symbol);
                    console.log(`   ⚠️  ${row.symbol.padEnd(20)} - ATTIVO (dovrebbe essere eliminato!)`);
                } else {
                    inactiveSymbols.push(row.symbol);
                    console.log(`   ⚠️  ${row.symbol.padEnd(20)} - DISATTIVATO (ma ancora presente nel DB)`);
                }
            });

            console.log(`\n📊 Riepilogo:`);
            console.log(`   ⚠️  Simboli ATTIVI ancora presenti: ${activeSymbols.length}`);
            console.log(`   ⚠️  Simboli DISATTIVATI ancora presenti: ${inactiveSymbols.length}`);
            console.log(`   ✅ Simboli ELIMINATI definitivamente: ${SYMBOLS_TO_CHECK.length - dbSymbols.rows.length}`);

            if (activeSymbols.length > 0) {
                console.log(`\n❌ PROBLEMA CRITICO: ${activeSymbols.length} simboli duplicati sono ancora ATTIVI!`);
                console.log('   Esegui prima: node cleanup_duplicates.js');
            }

            if (inactiveSymbols.length > 0) {
                console.log(`\n💡 Per eliminare definitivamente i simboli disattivati, esegui:`);
                console.log('   node scripts/delete_duplicates_permanently.js');
            }
        }

        // Verifica simboli attivi totali
        console.log('\n' + '='.repeat(80));
        const allActiveSymbols = await client.query(
            `SELECT COUNT(*) as count 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' 
             AND symbol != 'global'
             AND is_active = 1`
        );

        const allSymbols = await client.query(
            `SELECT COUNT(*) as count 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' 
             AND symbol != 'global'`
        );

        console.log('\n📊 Statistiche database:');
        console.log(`   📊 Simboli totali (escluso 'global'): ${allSymbols.rows[0].count}`);
        console.log(`   ✅ Simboli ATTIVI: ${allActiveSymbols.rows[0].count}`);
        console.log(`   ⚠️  Simboli DISATTIVATI: ${allSymbols.rows[0].count - allActiveSymbols.rows[0].count}`);

        console.log('\n' + '='.repeat(80));
        console.log('✅ Verifica completata!\n');

    } catch (error) {
        console.error('\n❌ ERRORE:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Esegui verifica
verifyDuplicatesStatus().catch(console.error);

