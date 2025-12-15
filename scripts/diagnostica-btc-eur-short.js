/**
 * 🔍 Script di Diagnostica: Perché il Bot Non Ha Aperto SHORT su Bitcoin/EUR
 * 
 * Questo script verifica tutti i possibili blocchi che impediscono l'apertura
 * di posizioni SHORT su bitcoin_eur.
 * 
 * Database: PostgreSQL
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Configurazione PostgreSQL
let cryptoDbUrl = process.env.DATABASE_URL_CRYPTO;

if (!cryptoDbUrl && process.env.DATABASE_URL) {
    cryptoDbUrl = process.env.DATABASE_URL.replace(/\/[^\/]+$/, '/crypto_db');
} else if (!cryptoDbUrl) {
    console.error('❌ DATABASE_URL o DATABASE_URL_CRYPTO non configurato!');
    process.exit(1);
}

const pool = new Pool({
    connectionString: cryptoDbUrl,
    ssl: cryptoDbUrl.includes('localhost') || cryptoDbUrl.includes('127.0.0.1') ? false : {
        rejectUnauthorized: false
    },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

async function diagnosticaBtcEurShort() {
    console.log('🔍 DIAGNOSTICA: Perché il Bot Non Ha Aperto SHORT su Bitcoin/EUR\n');
    console.log('='.repeat(80));
    console.log('');

    const dbGet = async (query, params = []) => {
        const client = await pool.connect();
        try {
            const result = await client.query(query, params);
            return result.rows[0] || null;
        } finally {
            client.release();
        }
    };

    const dbAll = async (query, params = []) => {
        const client = await pool.connect();
        try {
            const result = await client.query(query, params);
            return result.rows || [];
        } finally {
            client.release();
        }
    };

    try {
        // 1. VERIFICA CONFIGURAZIONE SIMBOLO
        console.log('📋 1. VERIFICA CONFIGURAZIONE SIMBOLO');
        console.log('-'.repeat(80));
        
        const symbolConfig = await dbGet(
            "SELECT * FROM bot_settings WHERE symbol = 'bitcoin_eur'"
        );

        if (!symbolConfig) {
            console.log('❌ PROBLEMA: bitcoin_eur NON è configurato in bot_settings');
            console.log('   → Il bot non sa come gestire questo simbolo');
            console.log('   → SOLUZIONE: Aggiungere entry in bot_settings');
        } else {
            console.log('✅ bitcoin_eur è configurato:');
            console.log(`   - is_active: ${symbolConfig.is_active}`);
            console.log(`   - min_signal_strength: ${symbolConfig.min_signal_strength || 'N/A'}`);
            console.log(`   - min_confirmations_short: ${symbolConfig.min_confirmations_short || 'N/A'}`);
            console.log(`   - trade_size_usdt: ${symbolConfig.trade_size_usdt || 'N/A'}`);
            console.log(`   - trade_size_eur: ${symbolConfig.trade_size_eur || 'N/A'}`);
            
            if (symbolConfig.is_active === 0) {
                console.log('   ⚠️  ATTENZIONE: Bot è DISATTIVATO per bitcoin_eur');
            }
        }
        console.log('');

        // 2. VERIFICA POSIZIONI APERTE
        console.log('📊 2. VERIFICA POSIZIONI APERTE');
        console.log('-'.repeat(80));
        
        const allOpenPositions = await dbAll(
            "SELECT * FROM open_positions WHERE status = 'open'"
        );
        
        const btcEurPositions = await dbAll(
            "SELECT * FROM open_positions WHERE symbol = 'bitcoin_eur' AND status = 'open'"
        );
        
        const shortPositions = allOpenPositions.filter(p => p.type === 'sell');
        const btcEurShortPositions = btcEurPositions.filter(p => p.type === 'sell');

        console.log(`   - Posizioni totali aperte: ${allOpenPositions.length}`);
        console.log(`   - Posizioni SHORT totali: ${shortPositions.length}`);
        console.log(`   - Posizioni bitcoin_eur aperte: ${btcEurPositions.length}`);
        console.log(`   - Posizioni SHORT bitcoin_eur: ${btcEurShortPositions.length}`);

        if (allOpenPositions.length >= 10) {
            console.log('   ⚠️  ATTENZIONE: Limite posizioni potrebbe essere raggiunto');
        }
        console.log('');

        // 3. VERIFICA CASH DISPONIBILE
        console.log('💰 3. VERIFICA CASH DISPONIBILE');
        console.log('-'.repeat(80));
        
        const portfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");
        const cashBalance = parseFloat(portfolio?.balance_usd || 0);
        const tradeSize = symbolConfig?.trade_size_usdt || symbolConfig?.trade_size_eur || 100;

        console.log(`   - Cash disponibile: $${cashBalance.toFixed(2)} USDT`);
        console.log(`   - Trade size configurato: $${tradeSize} USDT`);

        if (cashBalance < tradeSize) {
            console.log(`   ❌ PROBLEMA: Cash insufficiente per aprire posizione`);
            console.log(`      → Serve almeno $${tradeSize} USDT, disponibile solo $${cashBalance.toFixed(2)} USDT`);
        } else {
            console.log(`   ✅ Cash sufficiente`);
        }
        console.log('');

        // 4. VERIFICA KLINES (Dati Storici)
        console.log('📈 4. VERIFICA KLINES (Dati Storici)');
        console.log('-'.repeat(80));
        
        const klinesCount = await dbGet(
            "SELECT COUNT(*) as count FROM klines WHERE symbol = 'bitcoin_eur'"
        );
        
        const recentKlines = await dbAll(
            "SELECT * FROM klines WHERE symbol = 'bitcoin_eur' ORDER BY timestamp DESC LIMIT 5"
        );

        console.log(`   - Totale klines bitcoin_eur: ${klinesCount?.count || 0}`);

        if ((klinesCount?.count || 0) < 100) {
            console.log('   ⚠️  ATTENZIONE: Klines insufficienti (< 100)');
            console.log('      → Il bot potrebbe non avere abbastanza dati per generare segnali');
        } else {
            console.log('   ✅ Klines sufficienti');
        }

        if (recentKlines.length > 0) {
            console.log('   - Ultime 5 klines:');
            recentKlines.forEach((k, i) => {
                const date = new Date(parseInt(k.timestamp)).toISOString();
                console.log(`     ${i + 1}. ${date} - Interval: ${k.interval}`);
            });
        }
        console.log('');

        // 5. VERIFICA PREZZI RECENTI
        console.log('💵 5. VERIFICA PREZZI RECENTI');
        console.log('-'.repeat(80));
        
        const recentPrices = await dbAll(
            "SELECT * FROM price_history WHERE symbol = 'bitcoin_eur' ORDER BY timestamp DESC LIMIT 10"
        );

        if (recentPrices.length === 0) {
            console.log('   ❌ PROBLEMA: Nessun prezzo recente per bitcoin_eur');
            console.log('      → Il bot potrebbe non riuscire a ottenere il prezzo');
        } else {
            console.log(`   ✅ Prezzi recenti disponibili: ${recentPrices.length}`);
            const latestPrice = recentPrices[0];
            const date = new Date(parseInt(latestPrice.timestamp)).toISOString();
            console.log(`   - Ultimo prezzo: $${parseFloat(latestPrice.price).toFixed(2)} USDT (${date})`);
        }
        console.log('');

        // 6. VERIFICA SEGNALI RECENTI (se disponibili)
        console.log('📡 6. VERIFICA SEGNALI RECENTI');
        console.log('-'.repeat(80));
        
        // Cerca nelle posizioni chiuse se ci sono stati segnali SHORT
        const closedShortPositions = await dbAll(
            "SELECT * FROM open_positions WHERE symbol = 'bitcoin_eur' AND type = 'sell' AND status = 'closed' ORDER BY closed_at DESC LIMIT 5"
        );

        if (closedShortPositions.length > 0) {
            console.log(`   ✅ Trovate ${closedShortPositions.length} posizioni SHORT chiuse in passato`);
            closedShortPositions.forEach((pos, i) => {
                console.log(`   ${i + 1}. Ticket: ${pos.ticket_id} | Aperta: ${pos.opened_at} | Chiusa: ${pos.closed_at}`);
            });
        } else {
            console.log('   ⚠️  Nessuna posizione SHORT chiusa trovata per bitcoin_eur');
            console.log('      → Potrebbe significare che il bot non ha mai aperto SHORT su questo simbolo');
        }
        console.log('');

        // 7. RACCOMANDAZIONI
        console.log('💡 7. RACCOMANDAZIONI');
        console.log('-'.repeat(80));
        
        const problemi = [];
        
        if (!symbolConfig) {
            problemi.push('❌ bitcoin_eur non configurato in bot_settings');
        }
        
        if (symbolConfig && symbolConfig.is_active === 0) {
            problemi.push('❌ Bot disattivato per bitcoin_eur');
        }
        
        if (cashBalance < tradeSize) {
            problemi.push('❌ Cash insufficiente');
        }
        
        if ((klinesCount?.count || 0) < 100) {
            problemi.push('⚠️  Klines insufficienti');
        }
        
        if (recentPrices.length === 0) {
            problemi.push('❌ Nessun prezzo recente disponibile');
        }

        if (problemi.length === 0) {
            console.log('✅ Nessun problema critico rilevato nella configurazione');
            console.log('');
            console.log('🔍 PROSSIMI PASSI:');
            console.log('   1. Verificare i log del bot per identificare quale filtro ha bloccato');
            console.log('   2. Controllare variabili ambiente (BINANCE_MODE, BINANCE_SUPPORTS_SHORT)');
            console.log('   3. Verificare che bitcoin_eur sia nella mappa SYMBOL_TO_PAIR nel codice');
            console.log('   4. Controllare i filtri professionali e MTF nel codice');
        } else {
            console.log('❌ PROBLEMI RILEVATI:');
            problemi.forEach((p, i) => {
                console.log(`   ${i + 1}. ${p}`);
            });
            console.log('');
            console.log('🔧 AZIONI CONSIGLIATE:');
            
            if (!symbolConfig) {
                console.log('   1. Aggiungere entry in bot_settings:');
                console.log('      INSERT INTO bot_settings (symbol, strategy_name, is_active, min_signal_strength, min_confirmations_short, trade_size_usdt)');
                console.log('      VALUES (\'bitcoin_eur\', \'RSI_Strategy\', 1, 70, 4, 100);');
            }
            
            if (cashBalance < tradeSize) {
                console.log('   2. Aumentare cash disponibile o ridurre trade_size');
            }
            
            if ((klinesCount?.count || 0) < 100) {
                console.log('   3. Scaricare più klines storiche per bitcoin_eur');
            }
            
            if (recentPrices.length === 0) {
                console.log('   4. Verificare che il bot stia aggiornando i prezzi per bitcoin_eur');
            }
        }
        console.log('');

        // 8. VERIFICA MAPPA SYMBOL_TO_PAIR (nel codice)
        console.log('🗺️  8. VERIFICA MAPPA SYMBOL_TO_PAIR (nel codice)');
        console.log('-'.repeat(80));
        console.log('   ⚠️  IMPORTANTE: Verifica manualmente nel file backend/routes/cryptoRoutes.js');
        console.log('      che la mappa SYMBOL_TO_PAIR contenga:');
        console.log('      \'bitcoin_eur\': \'BTCEUR\'');
        console.log('');
        console.log('   Se manca, aggiungere alla mappa (linea ~1299):');
        console.log('   \'bitcoin_eur\': \'BTCEUR\',');
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante diagnostica:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }

    console.log('='.repeat(80));
    console.log('✅ Diagnostica completata');
}

// Esegui diagnostica
diagnosticaBtcEurShort().catch(console.error);
