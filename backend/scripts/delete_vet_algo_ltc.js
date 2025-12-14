/**
 * 🗑️ ELIMINAZIONE DEFINITIVA VET, ALGO, LTC - PostgreSQL VPS
 * 
 * Questo script elimina DEFINITIVAMENTE i simboli VET, ALGO e LTC da tutto il database.
 * ATTENZIONE: Questa operazione è IRREVERSIBILE!
 * 
 * Simboli eliminati:
 * - VET (vechain, vet, vechain_usdt, vet_usdt)
 * - ALGO (algorand, algo, algorand_usdt, algo_usdt)
 * - LTC (litecoin, litecoin_usdt, litecoin_eur, ltc, ltc_usdt)
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

// Lista completa di tutti i simboli da eliminare (varianti incluse)
const SYMBOLS_TO_DELETE = [
    // VET (VeChain)
    'vechain',
    'vet',
    'vechain_usdt',
    'vet_usdt',
    // ALGO (Algorand)
    'algorand',
    'algo',
    'algorand_usdt',
    'algo_usdt',
    // LTC (Litecoin)
    'litecoin',
    'litecoin_usdt',
    'litecoin_eur',
    'ltc',
    'ltc_usdt'
];

async function deleteVetAlgoLtc() {
    const client = await pool.connect();

    try {
        console.log('🗑️  ELIMINAZIONE DEFINITIVA VET, ALGO, LTC - PostgreSQL VPS\n');
        console.log('='.repeat(80));
        console.log('⚠️  ATTENZIONE: Questa operazione è IRREVERSIBILE!\n');

        // Test connessione
        console.log('📡 Test connessione database VPS...');
        const testResult = await client.query('SELECT NOW()');
        console.log(`✅ Connesso a PostgreSQL VPS: ${testResult.rows[0].now}\n`);

        // STEP 1: Verifica simboli nel database
        console.log('🔍 STEP 1: Verifica simboli nel database...\n');
        const dbSymbols = await client.query(
            `SELECT symbol, is_active 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' 
             AND symbol != 'global'
             AND symbol = ANY($1::text[])
             ORDER BY symbol`,
            [SYMBOLS_TO_DELETE]
        );

        console.log(`📊 Simboli trovati nel database: ${dbSymbols.rows.length}`);

        if (dbSymbols.rows.length > 0) {
            console.log('\n📝 Dettagli simboli da eliminare:');
            dbSymbols.rows.forEach(row => {
                const isActive = row.is_active === 1 || row.is_active === true;
                const status = isActive ? '⚠️  ATTIVO' : '✅ Disattivato';
                console.log(`   ${row.symbol.padEnd(25)} - ${status}`);
            });
        } else {
            console.log('✅ Nessun simbolo trovato nel database (già eliminati o non esistevano).\n');
        }

        // STEP 2: Verifica e chiudi posizioni aperte
        console.log('\n\n🔍 STEP 2: Verifica e chiusura posizioni aperte...\n');
        
        const openPositionsList = await client.query(
            `SELECT ticket_id, symbol, type, volume, entry_price, current_price, opened_at
             FROM open_positions 
             WHERE symbol = ANY($1::text[])
             AND status = 'open'
             ORDER BY symbol, opened_at`,
            [SYMBOLS_TO_DELETE]
        );

        if (openPositionsList.rows.length > 0) {
            console.log(`⚠️  Trovate ${openPositionsList.rows.length} posizioni aperte per questi simboli:`);
            openPositionsList.rows.forEach(pos => {
                console.log(`   - ${pos.symbol.padEnd(25)} | ${pos.type.toUpperCase().padEnd(4)} | Volume: ${parseFloat(pos.volume).toFixed(8)} | Entry: $${parseFloat(pos.entry_price).toFixed(6)}`);
            });
            
            console.log('\n🔧 Chiusura automatica posizioni aperte...\n');
            
            let closedCount = 0;
            let closedErrors = 0;
            
            for (const pos of openPositionsList.rows) {
                try {
                    // Usa current_price se disponibile, altrimenti entry_price
                    const closePrice = pos.current_price && parseFloat(pos.current_price) > 0 
                        ? parseFloat(pos.current_price) 
                        : parseFloat(pos.entry_price);
                    
                    const entryPrice = parseFloat(pos.entry_price);
                    const volume = parseFloat(pos.volume);
                    
                    // Calcola P&L
                    let profitLoss = 0;
                    if (pos.type === 'buy') {
                        profitLoss = (closePrice - entryPrice) * volume;
                    } else {
                        profitLoss = (entryPrice - closePrice) * volume;
                    }
                    
                    const profitLossPct = entryPrice > 0 ? ((closePrice - entryPrice) / entryPrice) * 100 : 0;
                    const adjustedPct = pos.type === 'sell' ? -profitLossPct : profitLossPct;
                    
                    // Aggiorna portfolio
                    const portfolioResult = await client.query('SELECT * FROM portfolio LIMIT 1');
                    const portfolio = portfolioResult.rows[0];
                    let balance = parseFloat(portfolio.balance_usd) || 0;
                    let holdings = JSON.parse(portfolio.holdings || '{}');
                    
                    if (pos.type === 'buy') {
                        balance += closePrice * volume;
                        holdings[pos.symbol] = (holdings[pos.symbol] || 0) - volume;
                        if (holdings[pos.symbol] < 0) holdings[pos.symbol] = 0;
                    } else {
                        balance -= closePrice * volume;
                        holdings[pos.symbol] = (holdings[pos.symbol] || 0) + volume;
                    }
                    
                    // Aggiorna portfolio nel database
                    await client.query(
                        'UPDATE portfolio SET balance_usd = $1, holdings = $2',
                        [balance, JSON.stringify(holdings)]
                    );
                    
                    // Chiudi posizione nel database
                    await client.query(
                        `UPDATE open_positions 
                         SET status = 'closed', 
                             closed_at = CURRENT_TIMESTAMP, 
                             current_price = $1, 
                             profit_loss = $2, 
                             profit_loss_pct = $3 
                         WHERE ticket_id = $4`,
                        [closePrice, profitLoss, adjustedPct, pos.ticket_id]
                    );
                    
                    closedCount++;
                    console.log(`   ✅ Chiusa: ${pos.symbol.padEnd(25)} | P&L: $${profitLoss.toFixed(2)} (${adjustedPct >= 0 ? '+' : ''}${adjustedPct.toFixed(2)}%)`);
                } catch (err) {
                    closedErrors++;
                    console.log(`   ❌ Errore chiusura ${pos.symbol} (${pos.ticket_id}): ${err.message}`);
                }
            }
            
            console.log(`\n📊 Risultato chiusura posizioni:`);
            console.log(`   ✅ Chiuse: ${closedCount}/${openPositionsList.rows.length}`);
            if (closedErrors > 0) {
                console.log(`   ❌ Errori: ${closedErrors}`);
            }
            
            if (closedErrors > 0) {
                console.log('\n⚠️  Alcune posizioni non sono state chiuse. Verifica manualmente prima di procedere.');
                return;
            }
            
            console.log('\n✅ Tutte le posizioni aperte sono state chiuse con successo!\n');
        } else {
            console.log('✅ Nessuna posizione aperta trovata per questi simboli\n');
        }

        // STEP 3: Elimina trades storici
        console.log('\n\n🗑️  STEP 3: Eliminazione trades storici...\n');
        
        const tradesResult = await client.query(
            `DELETE FROM trades 
             WHERE symbol = ANY($1::text[])
             RETURNING id, symbol, type, amount, price, timestamp`,
            [SYMBOLS_TO_DELETE]
        );
        
        const deletedTrades = tradesResult.rowCount;
        console.log(`✅ Eliminati ${deletedTrades} trades storici per questi simboli`);

        // STEP 4: Elimina posizioni chiuse
        console.log('\n\n🗑️  STEP 4: Eliminazione posizioni chiuse...\n');
        
        const closedPositionsResult = await client.query(
            `DELETE FROM open_positions 
             WHERE symbol = ANY($1::text[])
             RETURNING ticket_id, symbol, status`,
            [SYMBOLS_TO_DELETE]
        );
        
        const deletedPositions = closedPositionsResult.rowCount;
        console.log(`✅ Eliminate ${deletedPositions} posizioni (aperte e chiuse) per questi simboli`);

        // STEP 5: Elimina configurazioni bot
        console.log('\n\n🗑️  STEP 5: Eliminazione configurazioni bot...\n');
        
        let deleted = 0;
        let errors = 0;

        for (const symbol of SYMBOLS_TO_DELETE) {
            try {
                const result = await client.query(
                    `DELETE FROM bot_settings 
                     WHERE strategy_name = 'RSI_Strategy' 
                     AND symbol = $1`,
                    [symbol]
                );

                if (result.rowCount > 0) {
                    deleted++;
                    console.log(`   ✅ Eliminato definitivamente: ${symbol}`);
                }
            } catch (err) {
                errors++;
                console.log(`   ❌ Errore eliminando ${symbol}: ${err.message}`);
            }
        }

        console.log(`\n📊 Risultato eliminazione configurazioni:`);
        console.log(`   ✅ Eliminati: ${deleted}/${SYMBOLS_TO_DELETE.length} simboli`);
        if (errors > 0) {
            console.log(`   ❌ Errori: ${errors}`);
        }

        // STEP 6: Verifica finale
        console.log('\n\n🔍 STEP 6: Verifica finale...\n');

        const finalCheck = await client.query(
            `SELECT COUNT(*) as count 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' 
             AND symbol != 'global'
             AND symbol = ANY($1::text[])`,
            [SYMBOLS_TO_DELETE]
        );

        const remainingCount = parseInt(finalCheck.rows[0]?.count || 0);

        if (remainingCount === 0) {
            console.log('✅ PERFETTO! Tutti i simboli VET, ALGO, LTC sono stati eliminati definitivamente!');
        } else {
            console.log(`⚠️  ATTENZIONE: ${remainingCount} simboli sono ancora presenti nel database!`);
        }

        // Verifica posizioni e trades rimanenti
        const remainingPositions = await client.query(
            `SELECT COUNT(*) as count 
             FROM open_positions 
             WHERE symbol = ANY($1::text[])`,
            [SYMBOLS_TO_DELETE]
        );
        
        const remainingTrades = await client.query(
            `SELECT COUNT(*) as count 
             FROM trades 
             WHERE symbol = ANY($1::text[])`,
            [SYMBOLS_TO_DELETE]
        );

        console.log(`\n📊 Verifica finale:`);
        console.log(`   📊 Configurazioni bot rimanenti: ${remainingCount}`);
        console.log(`   📊 Posizioni rimanenti: ${remainingPositions.rows[0].count}`);
        console.log(`   📊 Trades rimanenti: ${remainingTrades.rows[0].count}`);

        // Conta simboli attivi finali
        const activeSymbols = await client.query(
            `SELECT COUNT(*) as count 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' 
             AND symbol != 'global'
             AND is_active = 1`
        );

        console.log(`\n📊 Simboli ATTIVI rimanenti nel database: ${activeSymbols.rows[0].count}`);

        console.log('\n' + '='.repeat(80));
        console.log('✅ ELIMINAZIONE DEFINITIVA COMPLETATA!\n');

        console.log('📝 Riepilogo eliminazioni:');
        console.log(`   🗑️  Configurazioni bot eliminate: ${deleted}`);
        console.log(`   🗑️  Posizioni eliminate: ${deletedPositions}`);
        console.log(`   🗑️  Trades eliminati: ${deletedTrades}`);

        console.log('\n📝 PROSSIMO STEP:');
        console.log('   Riavvia il bot: pm2 restart all');
        console.log('');

    } catch (error) {
        console.error('\n❌ ERRORE:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Esegui eliminazione
deleteVetAlgoLtc().catch(console.error);
