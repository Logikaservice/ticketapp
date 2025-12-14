/**
 * 🔍 VERIFICA TRADES STORICI - PostgreSQL VPS
 * 
 * Questo script mostra i trades storici per i simboli duplicati.
 * Questi trades NON vengono eliminati perché sono dati storici importanti.
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

// Lista simboli duplicati (stessa lista dello script di eliminazione)
const DUPLICATE_SYMBOLS = [
    'bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 'litecoin',
    'ripple', 'binance_coin', 'pol_polygon', 'avalanche', 'uniswap',
    'dogecoin', 'shiba', 'near', 'atom', 'trx', 'xlm', 'arb', 'op',
    'matic', 'sui', 'enj', 'pepe'
];

async function checkHistoricalTrades() {
    const client = await pool.connect();

    try {
        console.log('🔍 VERIFICA TRADES STORICI - Simboli Duplicati\n');
        console.log('='.repeat(80));

        // Test connessione
        console.log('\n📡 Test connessione database VPS...');
        const testResult = await client.query('SELECT NOW()');
        console.log(`✅ Connesso a PostgreSQL VPS: ${testResult.rows[0].now}\n`);

        // Verifica trades storici
        console.log('🔍 Ricerca trades storici per simboli duplicati...\n');
        const trades = await client.query(
            `SELECT 
                id,
                symbol,
                type,
                amount,
                price,
                timestamp,
                strategy,
                profit_loss,
                ticket_id
             FROM trades 
             WHERE symbol = ANY($1::text[])
             ORDER BY timestamp DESC`,
            [DUPLICATE_SYMBOLS]
        );

        const tradesCount = trades.rows.length;
        console.log(`📊 Trovati ${tradesCount} trades storici per simboli duplicati\n`);

        // Verifica anche il totale di tutti i trades nel database
        const allTradesResult = await client.query('SELECT COUNT(*) as count FROM trades');
        const allTradesCount = parseInt(allTradesResult.rows[0]?.count || 0);
        console.log(`📊 TOTALE trades nel database: ${allTradesCount}\n`);

        if (tradesCount === 0) {
            if (allTradesCount === 0) {
                console.log('✅ Nessun trade storico trovato nel database.');
                console.log('   Il reset ha cancellato tutti i trades (come previsto).\n');
            } else {
                console.log('✅ Nessun trade storico trovato per i simboli duplicati.');
                console.log(`   Ci sono ${allTradesCount} trades nel database, ma non per simboli duplicati.\n`);
            }
            return;
        }

        // Raggruppa per simbolo
        const tradesBySymbol = {};
        trades.rows.forEach(trade => {
            if (!tradesBySymbol[trade.symbol]) {
                tradesBySymbol[trade.symbol] = [];
            }
            tradesBySymbol[trade.symbol].push(trade);
        });

        console.log('📝 Dettagli trades storici:\n');
        console.log('='.repeat(80));

        Object.keys(tradesBySymbol).sort().forEach(symbol => {
            const symbolTrades = tradesBySymbol[symbol];
            console.log(`\n📊 ${symbol.toUpperCase()} - ${symbolTrades.length} trade(s):`);
            console.log('-'.repeat(80));

            symbolTrades.forEach((trade, index) => {
                const date = new Date(trade.timestamp).toLocaleString('it-IT');
                const type = trade.type === 'buy' ? 'ACQUISTO' : 'VENDITA';
                const amount = parseFloat(trade.amount || 0).toFixed(8);
                const price = parseFloat(trade.price || 0).toFixed(6);
                const profitLoss = trade.profit_loss ? parseFloat(trade.profit_loss).toFixed(2) : 'N/A';
                const strategy = trade.strategy || 'N/A';
                const ticketId = trade.ticket_id || 'N/A';

                console.log(`\n   Trade #${index + 1}:`);
                console.log(`   ├─ ID: ${trade.id}`);
                console.log(`   ├─ Tipo: ${type}`);
                console.log(`   ├─ Quantità: ${amount}`);
                console.log(`   ├─ Prezzo: $${price}`);
                console.log(`   ├─ Data/Ora: ${date}`);
                console.log(`   ├─ Strategia: ${strategy}`);
                console.log(`   ├─ Profit/Loss: $${profitLoss}`);
                console.log(`   └─ Ticket ID: ${ticketId}`);
            });
        });

        // Statistiche
        console.log('\n' + '='.repeat(80));
        console.log('\n📊 Statistiche:\n');

        const totalBuy = trades.rows.filter(t => t.type === 'buy').length;
        const totalSell = trades.rows.filter(t => t.type === 'sell').length;
        const totalProfit = trades.rows.reduce((sum, t) => {
            return sum + (parseFloat(t.profit_loss || 0));
        }, 0);

        console.log(`   📈 Acquisti: ${totalBuy}`);
        console.log(`   📉 Vendite: ${totalSell}`);
        console.log(`   💰 Profit/Loss Totale: $${totalProfit.toFixed(2)}`);

        // Simboli coinvolti
        console.log(`\n   📋 Simboli coinvolti: ${Object.keys(tradesBySymbol).join(', ')}`);

        console.log('\n' + '='.repeat(80));
        console.log('\n💡 NOTA:');
        console.log('   Questi trades storici NON vengono eliminati perché:');
        console.log('   - Sono dati storici importanti per statistiche e analisi');
        console.log('   - Servono per calcolare performance passate');
        console.log('   - Fanno parte della cronologia completa del trading');
        console.log('   - Solo le configurazioni bot (bot_settings) vengono eliminate\n');

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
checkHistoricalTrades().catch(console.error);
