/**
 * 🔍 Script per verificare problemi con posizioni e importi investiti
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Usa lo stesso sistema di connessione del progetto
const cryptoDb = require('../crypto_db');
const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;
const dbRun = cryptoDb.dbRun;

async function checkPositionIssues() {
    try {
        console.log('✅ Connesso al database\n');

        // 1. Verifica configurazione bot_settings
        console.log('📊 1. CONFIGURAZIONE BOT_SETTINGS:\n');
        const botSettings = await dbAll(
            "SELECT symbol, parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND (symbol = 'global' OR symbol LIKE '%_usdt' OR symbol LIKE '%_eur') ORDER BY symbol"
        );

        for (const row of botSettings) {
            const params = typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters;
            console.log(`   ${row.symbol}:`);
            console.log(`      - max_positions: ${params.max_positions || 'NON CONFIGURATO'}`);
            console.log(`      - trade_size_usdt: ${params.trade_size_usdt || 'NON CONFIGURATO'}`);
            console.log(`      - trade_size_eur: ${params.trade_size_eur || 'NON CONFIGURATO'}`);
            console.log('');
        }

        // 2. Verifica posizioni aperte
        console.log('📊 2. POSIZIONI APERTE:\n');
        const openPositions = await dbAll(
            "SELECT ticket_id, symbol, type, volume, entry_price, (volume * entry_price) as invested, opened_at FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC"
        );

        console.log(`   Totale posizioni aperte: ${openPositions.length}\n`);

        let totalInvested = 0;
        for (const pos of openPositions) {
            const invested = parseFloat(pos.invested) || 0;
            totalInvested += invested;
            console.log(`   ${pos.ticket_id}: ${pos.symbol} (${pos.type}) | Volume: ${parseFloat(pos.volume).toFixed(8)} | Entry: $${parseFloat(pos.entry_price).toFixed(2)} | Investito: $${invested.toFixed(2)} | Aperta: ${new Date(pos.opened_at).toLocaleString()}`);
        }

        console.log(`\n   💰 Totale investito: $${totalInvested.toFixed(2)}`);

        // 3. Verifica portfolio
        console.log('\n📊 3. PORTFOLIO:\n');
        const portfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");
        if (portfolio) {
            const port = portfolio;
            console.log(`   Balance USD: $${parseFloat(port.balance_usd || 0).toFixed(2)}`);
            console.log(`   Holdings: ${port.holdings || '{}'}`);
        }

        // 4. Analisi problemi
        console.log('\n🔍 4. ANALISI PROBLEMI:\n');

        const globalParams = botSettings.find(r => r.symbol === 'global');
        if (globalParams) {
            const params = typeof globalParams.parameters === 'string' ? JSON.parse(globalParams.parameters) : globalParams.parameters;
            const maxPositions = parseInt(params.max_positions) || 10;
            const tradeSize = parseFloat(params.trade_size_usdt || params.trade_size_eur) || 100;

            console.log(`   Configurazione attesa:`);
            console.log(`      - max_positions: ${maxPositions}`);
            console.log(`      - trade_size: $${tradeSize}\n`);

            // Problema 1: Troppe posizioni
            if (openPositions.length > maxPositions) {
                console.log(`   ❌ PROBLEMA 1: Troppe posizioni aperte!`);
                console.log(`      Attese: ${maxPositions}`);
                console.log(`      Attuali: ${openPositions.length}`);
                console.log(`      Eccesso: ${openPositions.length - maxPositions}`);
                console.log(`      Soluzione: Chiama /api/crypto/cleanup-positions per chiudere le posizioni in eccesso\n`);
            } else {
                console.log(`   ✅ Numero posizioni OK: ${openPositions.length}/${maxPositions}\n`);
            }

            // Problema 2: Importi investiti non corretti
            const positionsWithWrongSize = openPositions.filter(pos => {
                const invested = parseFloat(pos.invested) || 0;
                // Tolleranza: ±$5
                return Math.abs(invested - tradeSize) > 5;
            });

            if (positionsWithWrongSize.length > 0) {
                console.log(`   ❌ PROBLEMA 2: ${positionsWithWrongSize.length} posizioni con importo investito diverso da $${tradeSize}:`);
                for (const pos of positionsWithWrongSize) {
                    const invested = parseFloat(pos.invested) || 0;
                    console.log(`      - ${pos.ticket_id} (${pos.symbol}): $${invested.toFixed(2)} invece di $${tradeSize}`);
                }
                console.log(`      Possibili cause:`);
                console.log(`        1. Cash insufficiente quando è stata aperta la posizione`);
                console.log(`        2. trade_size_usdt non configurato correttamente`);
                console.log(`        3. Posizioni vecchie aperte prima della configurazione\n`);
            } else {
                console.log(`   ✅ Tutte le posizioni hanno importo investito corretto (~$${tradeSize})\n`);
            }
        }

        // 5. Raccomandazioni
        console.log('💡 5. RACCOMANDAZIONI:\n');
        console.log('   1. Verifica che trade_size_usdt sia configurato correttamente nel database');
        console.log('   2. Se ci sono troppe posizioni, chiama /api/crypto/cleanup-positions');
        console.log('   3. Se ci sono posizioni con importi sbagliati, considera di chiuderle e riaprirle');
        console.log('   4. Verifica che ci sia abbastanza cash disponibile per aprire posizioni da $100\n');

    } catch (err) {
        console.error('❌ Errore:', err.message);
        console.error(err.stack);
    }
}

checkPositionIssues();
