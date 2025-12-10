/**
 * Script per resettare completamente il portfolio e cancellare tutte le posizioni aperte
 * ATTENZIONE: Questo script cancella TUTTE le posizioni aperte e resetta il portfolio!
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cryptoDb = require('./crypto_db');
const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;
const dbRun = cryptoDb.dbRun;

async function resetPortfolio() {
    try {
        console.log('⚠️  RESET COMPLETO PORTFOLIO E POSIZIONI\n');
        console.log('Questo script cancellerà:');
        console.log('  - Tutte le posizioni aperte');
        console.log('  - Reset del portfolio (balance e holdings)\n');

        // 1. Verifica posizioni aperte prima della cancellazione
        const openPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        console.log(`📊 Posizioni aperte trovate: ${openPositions.length}`);
        if (openPositions.length > 0) {
            openPositions.forEach((pos, idx) => {
                console.log(`   ${idx + 1}. ${pos.symbol} - ${pos.type} - Ticket: ${pos.ticket_id}`);
            });
        }

        // 2. Verifica portfolio attuale
        const portfolio = await dbGet("SELECT * FROM portfolio LIMIT 1");
        if (portfolio) {
            console.log(`\n💰 Portfolio attuale:`);
            console.log(`   Balance: $${portfolio.balance_usd} USDT`);
            console.log(`   Holdings: ${portfolio.holdings || '{}'}`);
        }

        // 3. Conferma (in produzione sarebbe meglio chiedere conferma)
        console.log('\n🗑️  Procedo con la cancellazione...\n');

        // 4. Cancella tutte le posizioni aperte
        const deletedPositions = await dbRun(
            "DELETE FROM open_positions WHERE status = 'open'"
        );
        console.log(`✅ Cancellate ${deletedPositions.changes} posizioni aperte`);

        // 5. Reset portfolio
        const DEFAULT_BALANCE = 10000.0; // 10000 USDT di default
        await dbRun(
            "UPDATE portfolio SET balance_usd = $1, holdings = $2 WHERE id = 1",
            [DEFAULT_BALANCE, '{}']
        );
        console.log(`✅ Portfolio resettato:`);
        console.log(`   Balance: $${DEFAULT_BALANCE} USDT`);
        console.log(`   Holdings: {} (vuoto)`);

        // 6. Verifica finale
        const finalPositions = await dbAll("SELECT * FROM open_positions WHERE status = 'open'");
        const finalPortfolio = await dbGet("SELECT * FROM portfolio LIMIT 1");

        console.log('\n📋 Verifica finale:');
        console.log(`   Posizioni aperte: ${finalPositions.length} (dovrebbe essere 0)`);
        if (finalPortfolio) {
            console.log(`   Balance: $${finalPortfolio.balance_usd} USDT`);
            console.log(`   Holdings: ${finalPortfolio.holdings || '{}'}`);
        }

        if (finalPositions.length === 0 && finalPortfolio && finalPortfolio.balance_usd === DEFAULT_BALANCE) {
            console.log('\n✅ Reset completato con successo!');
            console.log('   Ora puoi riaprire le posizioni.');
        } else {
            console.log('\n⚠️  Reset completato ma verifica manuale consigliata');
        }

    } catch (error) {
        console.error('❌ Errore durante il reset:', error.message);
        console.error(error.stack);
        throw error;
    }
}

resetPortfolio().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

