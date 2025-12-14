/**
 * 🧹 PULIZIA DUPLICATI - PostgreSQL VPS
 * 
 * Questo script disattiva i simboli duplicati nel database PostgreSQL.
 * Mantiene solo UNA versione per ogni trading pair.
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

// Lista simboli da RIMUOVERE (duplicati)
// Questi sono i simboli che mappano allo stesso trading pair di altri simboli
const SYMBOLS_TO_REMOVE = [
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

async function cleanupDatabase() {
    const client = await pool.connect();

    try {
        console.log('🧹 PULIZIA DUPLICATI - PostgreSQL VPS\n');
        console.log('='.repeat(80));

        // Test connessione
        console.log('\n📡 Test connessione database VPS...');
        const testResult = await client.query('SELECT NOW()');
        console.log(`✅ Connesso a PostgreSQL VPS: ${testResult.rows[0].now}`);

        // Verifica simboli nel database
        console.log('\n🔍 Verifica simboli nel database...\n');
        const dbSymbols = await client.query(
            `SELECT symbol, is_active 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' 
             AND symbol != 'global'
             ORDER BY symbol`
        );

        console.log(`📊 Simboli totali nel database: ${dbSymbols.rows.length}`);

        // Conta quanti duplicati sono nel DB
        const duplicatesInDb = dbSymbols.rows.filter(row => SYMBOLS_TO_REMOVE.includes(row.symbol));
        console.log(`   Di cui duplicati da rimuovere: ${duplicatesInDb.length}`);

        if (duplicatesInDb.length > 0) {
            console.log('\n📝 Duplicati trovati nel database:');
            duplicatesInDb.forEach(row => {
                const isActive = row.is_active === 1 || row.is_active === true;
                console.log(`   ${row.symbol.padEnd(20)} (${isActive ? 'ATTIVO' : 'inattivo'})`);
            });
        }

        // STEP 1: Disattiva duplicati
        console.log(`\n\n🔧 STEP 1: Disattivazione ${SYMBOLS_TO_REMOVE.length} simboli duplicati...\n`);

        let deactivated = 0;
        for (const symbol of SYMBOLS_TO_REMOVE) {
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

        console.log(`\n📊 Disattivati: ${deactivated}/${SYMBOLS_TO_REMOVE.length} simboli duplicati`);

        // STEP 2: Verifica simboli attivi finali
        console.log('\n\n🔧 STEP 2: Verifica simboli attivi...\n');

        const finalSymbols = await client.query(
            `SELECT symbol, is_active 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' 
             AND symbol != 'global'
             AND is_active = 1
             ORDER BY symbol`
        );

        console.log(`✅ Simboli ATTIVI nel database: ${finalSymbols.rows.length}`);

        // Verifica se ci sono ancora duplicati attivi
        const stillActive = finalSymbols.rows.filter(row => SYMBOLS_TO_REMOVE.includes(row.symbol));

        if (stillActive.length > 0) {
            console.log(`\n⚠️  ATTENZIONE: ${stillActive.length} duplicati ancora attivi!`);
            stillActive.forEach(row => {
                console.log(`   - ${row.symbol}`);
            });
        } else {
            console.log(`\n✅ PERFETTO! Nessun duplicato rimanente!`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ PULIZIA DATABASE COMPLETATA!\n');

        console.log('📝 PROSSIMO STEP:');
        console.log('   Riavvia il bot: pm2 restart all');
        console.log('');

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
