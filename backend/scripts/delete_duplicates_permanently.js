/**
 * 🗑️ ELIMINAZIONE DEFINITIVA DUPLICATI - PostgreSQL VPS
 * 
 * Questo script elimina DEFINITIVAMENTE i simboli duplicati dal database PostgreSQL.
 * ATTENZIONE: Questa operazione è IRREVERSIBILE!
 * 
 * I simboli duplicati sono già stati disattivati da cleanup_duplicates.js,
 * questo script li rimuove completamente dal database.
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

// Lista simboli duplicati da ELIMINARE DEFINITIVAMENTE
// Questi sono i simboli che mappano allo stesso trading pair di altri simboli
const SYMBOLS_TO_DELETE = [
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

async function deleteDuplicatesPermanently() {
    const client = await pool.connect();

    try {
        console.log('🗑️  ELIMINAZIONE DEFINITIVA DUPLICATI - PostgreSQL VPS\n');
        console.log('='.repeat(80));
        console.log('⚠️  ATTENZIONE: Questa operazione è IRREVERSIBILE!\n');

        // Test connessione
        console.log('📡 Test connessione database VPS...');
        const testResult = await client.query('SELECT NOW()');
        console.log(`✅ Connesso a PostgreSQL VPS: ${testResult.rows[0].now}\n`);

        // STEP 1: Verifica simboli disattivati ancora presenti
        console.log('🔍 STEP 1: Verifica simboli disattivati nel database...\n');
        const dbSymbols = await client.query(
            `SELECT symbol, is_active 
             FROM bot_settings 
             WHERE strategy_name = 'RSI_Strategy' 
             AND symbol != 'global'
             AND symbol = ANY($1::text[])
             ORDER BY symbol`,
            [SYMBOLS_TO_DELETE]
        );

        console.log(`📊 Simboli duplicati trovati nel database: ${dbSymbols.rows.length}`);

        if (dbSymbols.rows.length === 0) {
            console.log('\n✅ Nessun simbolo duplicato trovato nel database!');
            console.log('   I simboli sono già stati eliminati o non esistevano.\n');
            return;
        }

        console.log('\n📝 Dettagli simboli da eliminare:');
        dbSymbols.rows.forEach(row => {
            const isActive = row.is_active === 1 || row.is_active === true;
            const status = isActive ? '⚠️  ATTIVO (dovrebbe essere disattivato!)' : '✅ Disattivato';
            console.log(`   ${row.symbol.padEnd(20)} - ${status}`);
        });

        // STEP 2: Verifica e chiudi posizioni aperte
        console.log('\n\n🔍 STEP 2: Verifica e chiusura posizioni aperte...\n');
        
        // Recupera tutte le posizioni aperte per questi simboli
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
                console.log(`   - ${pos.symbol.padEnd(20)} | ${pos.type.toUpperCase().padEnd(4)} | Volume: ${parseFloat(pos.volume).toFixed(8)} | Entry: $${parseFloat(pos.entry_price).toFixed(6)}`);
            });
            
            console.log('\n🔧 Chiusura automatica posizioni aperte...\n');
            
            // Funzione semplificata per ottenere prezzo simbolo (usa prezzo corrente se disponibile, altrimenti entry_price)
            const getCurrentPrice = async (symbol) => {
                try {
                    // Prova a usare il prezzo corrente dalla posizione se disponibile
                    const pos = openPositionsList.rows.find(p => p.symbol === symbol);
                    if (pos && pos.current_price && parseFloat(pos.current_price) > 0) {
                        return parseFloat(pos.current_price);
                    }
                    
                    // Fallback: usa entry_price (chiudiamo al prezzo di entrata, P&L = 0)
                    if (pos && pos.entry_price) {
                        return parseFloat(pos.entry_price);
                    }
                    
                    // Ultimo fallback: usa un prezzo di default (non dovrebbe mai arrivare qui)
                    console.warn(`⚠️  Impossibile determinare prezzo per ${symbol}, uso entry_price`);
                    return parseFloat(pos?.entry_price || 1);
                } catch (err) {
                    console.warn(`⚠️  Errore recupero prezzo per ${symbol}: ${err.message}`);
                    const pos = openPositionsList.rows.find(p => p.symbol === symbol);
                    return parseFloat(pos?.entry_price || 1);
                }
            };
            
            let closedCount = 0;
            let closedErrors = 0;
            
            for (const pos of openPositionsList.rows) {
                try {
                    const closePrice = await getCurrentPrice(pos.symbol);
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
                    console.log(`   ✅ Chiusa: ${pos.symbol.padEnd(20)} | P&L: $${profitLoss.toFixed(2)} (${adjustedPct >= 0 ? '+' : ''}${adjustedPct.toFixed(2)}%)`);
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

        // Verifica trades storici
        const historicalTrades = await client.query(
            `SELECT COUNT(*) as count 
             FROM trades 
             WHERE symbol = ANY($1::text[])`,
            [SYMBOLS_TO_DELETE]
        );
        const tradesCount = parseInt(historicalTrades.rows[0]?.count || 0);
        
        if (tradesCount > 0) {
            console.log(`ℹ️  Trovati ${tradesCount} trades storici per questi simboli`);
            console.log('   (I trades storici NON verranno eliminati, solo le configurazioni bot)\n');
        } else {
            console.log('✅ Nessun trade storico trovato per questi simboli\n');
        }

        // STEP 3: Eliminazione definitiva
        console.log('\n\n🗑️  STEP 3: Eliminazione definitiva simboli duplicati...\n');

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

        console.log(`\n📊 Risultato eliminazione:`);
        console.log(`   ✅ Eliminati: ${deleted}/${SYMBOLS_TO_DELETE.length} simboli`);
        if (errors > 0) {
            console.log(`   ❌ Errori: ${errors}`);
        }

        // STEP 4: Verifica finale
        console.log('\n\n🔍 STEP 4: Verifica finale...\n');

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
            console.log('✅ PERFETTO! Tutti i simboli duplicati sono stati eliminati definitivamente!');
        } else {
            console.log(`⚠️  ATTENZIONE: ${remainingCount} simboli duplicati sono ancora presenti nel database!`);
        }

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

        console.log('📝 PROSSIMO STEP:');
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
deleteDuplicatesPermanently().catch(console.error);
