/**
 * Crypto Database Module - PostgreSQL Only
 * 
 * Questo modulo gestisce il database PostgreSQL per il sistema crypto.
 * PostgreSQL nativo - nessuna conversione o compatibilità con altri database.
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Configurazione PostgreSQL
// ✅ ISOLAMENTO COMPLETO: Usa DATABASE_URL_CRYPTO se configurato (database separato)
// Altrimenti crea automaticamente un database separato basato su DATABASE_URL
// Questo garantisce che i dati crypto siano completamente isolati dagli altri progetti
let cryptoDbUrl = process.env.DATABASE_URL_CRYPTO;

if (!cryptoDbUrl && process.env.DATABASE_URL) {
    // Crea URL per database separato (come fanno Vivaldi e PackVision)
    cryptoDbUrl = process.env.DATABASE_URL.replace(/\/[^\/]+$/, '/crypto_db');
    console.log(`📊 Crypto database: usando database separato (${cryptoDbUrl.replace(/:[^:@]+@/, ':****@')})`);
} else if (cryptoDbUrl) {
    console.log(`📊 Crypto database: usando DATABASE_URL_CRYPTO configurato`);
} else {
    // Fallback: stesso database (non consigliato per isolamento)
    cryptoDbUrl = process.env.DATABASE_URL;
    console.warn(`⚠️  Crypto database: usando stesso database degli altri progetti (non isolato)`);
}

if (!cryptoDbUrl) {
    console.error('❌ DATABASE_URL o DATABASE_URL_CRYPTO non configurato!');
    process.exit(1);
}

// Disabilita SSL per localhost
const isLocalhost = cryptoDbUrl.includes('localhost') || cryptoDbUrl.includes('127.0.0.1');
const pool = new Pool({
    connectionString: cryptoDbUrl,
    ssl: isLocalhost ? false : {
        rejectUnauthorized: false
    },
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Gestione errori pool
pool.on('error', (err, client) => {
    console.error('❌ PostgreSQL pool error:', err.message);
    // Non crashare il backend per errori del database
});

// Helper per eseguire query multiple rows
const dbAll = async (query, params = []) => {
    try {
        const result = await pool.query(query, params);
        return result.rows || [];
    } catch (err) {
        console.error('❌ Database query error:', err.message);
        console.error('❌ Query:', query.substring(0, 200));
        throw err;
    }
};

// Helper per eseguire query single row
const dbGet = async (query, params = []) => {
    try {
        const result = await pool.query(query, params);
        return result.rows[0] || null;
    } catch (err) {
        console.error('❌ Database query error:', err.message);
        console.error('❌ Query:', query.substring(0, 200));
        throw err;
    }
};

// Helper per eseguire INSERT/UPDATE/DELETE
const dbRun = async (query, params = []) => {
    try {
        const result = await pool.query(query, params);
        return {
            lastID: result.rows[0]?.id || null, // PostgreSQL restituisce id in RETURNING
            changes: result.rowCount || 0
        };
    } catch (err) {
        console.error('❌ Database query error:', err.message);
        console.error('❌ Query:', query.substring(0, 200));
        throw err;
    }
};

// Inizializza database (crea tabelle se non esistono)
async function initDb() {
    const client = await pool.connect();
    try {
        console.log('🔄 Inizializzazione tabelle crypto PostgreSQL...');

        // Portfolio table
        await client.query(`
            CREATE TABLE IF NOT EXISTS portfolio (
                id SERIAL PRIMARY KEY,
                balance_usd DOUBLE PRECISION DEFAULT 10000.0,
                holdings TEXT DEFAULT '{}'
            )
        `);

        // Inserisci record default se non esiste
        await client.query(`
            INSERT INTO portfolio (id, balance_usd, holdings)
            VALUES (1, 10000.0, '{}')
            ON CONFLICT (id) DO NOTHING
        `);

        // Trades history
        await client.query(`
            CREATE TABLE IF NOT EXISTS trades (
                id SERIAL PRIMARY KEY,
                symbol TEXT,
                type TEXT,
                amount DOUBLE PRECISION,
                price DOUBLE PRECISION,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                strategy TEXT,
                profit_loss DOUBLE PRECISION,
                ticket_id TEXT
            )
        `);

        // Bot settings
        await client.query(`
            CREATE TABLE IF NOT EXISTS bot_settings (
                id SERIAL PRIMARY KEY,
                strategy_name TEXT NOT NULL,
                symbol TEXT NOT NULL DEFAULT 'bitcoin',
                is_active INTEGER DEFAULT 1,
                parameters TEXT,
                UNIQUE(strategy_name, symbol)
            )
        `);

        // Insert default strategy
        await client.query(`
            INSERT INTO bot_settings (strategy_name, symbol, is_active, parameters)
            VALUES (
                'RSI_Strategy',
                'bitcoin',
                0,
                '{
                    "rsi_period": 14,
                    "rsi_oversold": 30,
                    "rsi_overbought": 70,
                    "stop_loss_pct": 2.0,
                    "take_profit_pct": 3.0,
                    "trade_size_usdt": 50,
                    "trailing_stop_enabled": false,
                    "trailing_stop_distance_pct": 1.0,
                    "partial_close_enabled": false,
                    "take_profit_1_pct": 1.5,
                    "take_profit_2_pct": 3.0
                }'
            )
            ON CONFLICT (strategy_name, symbol) DO NOTHING
        `);

        // Price History
        await client.query(`
            CREATE TABLE IF NOT EXISTS price_history (
                id SERIAL PRIMARY KEY,
                symbol TEXT,
                price DOUBLE PRECISION,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Klines
        await client.query(`
            CREATE TABLE IF NOT EXISTS klines (
                id SERIAL PRIMARY KEY,
                symbol TEXT NOT NULL,
                interval TEXT NOT NULL DEFAULT '15m',
                open_time BIGINT NOT NULL,
                open_price DOUBLE PRECISION NOT NULL,
                high_price DOUBLE PRECISION NOT NULL,
                low_price DOUBLE PRECISION NOT NULL,
                close_price DOUBLE PRECISION NOT NULL,
                volume DOUBLE PRECISION DEFAULT 0,
                close_time BIGINT NOT NULL,
                UNIQUE(symbol, interval, open_time)
            )
        `);

        // Indici klines
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_klines_lookup ON klines(symbol, interval, open_time DESC)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_klines_symbol_interval_time ON klines(symbol, interval, open_time)
        `);

        // Open Positions
        await client.query(`
            CREATE TABLE IF NOT EXISTS open_positions (
                id SERIAL PRIMARY KEY,
                ticket_id TEXT UNIQUE NOT NULL,
                symbol TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
                volume DOUBLE PRECISION NOT NULL,
                entry_price DOUBLE PRECISION NOT NULL,
                current_price DOUBLE PRECISION DEFAULT 0,
                stop_loss DOUBLE PRECISION,
                take_profit DOUBLE PRECISION,
                swap DOUBLE PRECISION DEFAULT 0,
                commission DOUBLE PRECISION DEFAULT 0,
                profit_loss DOUBLE PRECISION DEFAULT 0,
                profit_loss_pct DOUBLE PRECISION DEFAULT 0,
                opened_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                closed_at TIMESTAMPTZ,
                strategy TEXT,
                status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'stopped', 'taken')),
                trailing_stop_enabled INTEGER DEFAULT 0,
                trailing_stop_distance_pct DOUBLE PRECISION DEFAULT 0,
                highest_price DOUBLE PRECISION DEFAULT 0,
                volume_closed DOUBLE PRECISION DEFAULT 0,
                take_profit_1 DOUBLE PRECISION,
                take_profit_2 DOUBLE PRECISION,
                tp1_hit INTEGER DEFAULT 0,
                signal_details TEXT
            )
        `);

        // Indici open_positions
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_open_positions_status ON open_positions(status)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_open_positions_symbol ON open_positions(symbol)
        `);

        // Backtest Results
        await client.query(`
            CREATE TABLE IF NOT EXISTS backtest_results (
                id SERIAL PRIMARY KEY,
                test_name TEXT,
                strategy_params TEXT,
                start_date TIMESTAMPTZ,
                end_date TIMESTAMPTZ,
                initial_balance DOUBLE PRECISION,
                final_balance DOUBLE PRECISION,
                total_trades INTEGER,
                winning_trades INTEGER,
                losing_trades INTEGER,
                total_pnl DOUBLE PRECISION,
                total_pnl_pct DOUBLE PRECISION,
                win_rate DOUBLE PRECISION,
                profit_factor DOUBLE PRECISION,
                max_drawdown DOUBLE PRECISION,
                max_drawdown_pct DOUBLE PRECISION,
                sharpe_ratio DOUBLE PRECISION,
                results_data TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_backtest_results_created ON backtest_results(created_at DESC)
        `);

        // Performance Stats
        await client.query(`
            CREATE TABLE IF NOT EXISTS performance_stats (
                id INTEGER PRIMARY KEY DEFAULT 1,
                total_trades INTEGER DEFAULT 0,
                winning_trades INTEGER DEFAULT 0,
                losing_trades INTEGER DEFAULT 0,
                total_profit DOUBLE PRECISION DEFAULT 0,
                total_loss DOUBLE PRECISION DEFAULT 0,
                avg_win DOUBLE PRECISION DEFAULT 0,
                avg_loss DOUBLE PRECISION DEFAULT 0,
                win_rate DOUBLE PRECISION DEFAULT 0,
                last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Initialize performance stats
        await client.query(`
            INSERT INTO performance_stats (id, total_trades, winning_trades, losing_trades, total_profit, total_loss, avg_win, avg_loss, win_rate)
            VALUES (1, 0, 0, 0, 0, 0, 0, 0, 0)
            ON CONFLICT (id) DO NOTHING
        `);

        // Bot Parameters (per configurazione personalizzata per simbolo)
        await client.query(`
            CREATE TABLE IF NOT EXISTS bot_parameters (
                id SERIAL PRIMARY KEY,
                symbol TEXT NOT NULL UNIQUE,
                min_signal_strength INTEGER DEFAULT 60,
                min_confirmations_long INTEGER DEFAULT 3,
                min_confirmations_short INTEGER DEFAULT 4,
                market_scanner_min_strength INTEGER DEFAULT 30,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Market Data (per volume 24h e dati di mercato)
        await client.query(`
            CREATE TABLE IF NOT EXISTS market_data (
                id SERIAL PRIMARY KEY,
                symbol TEXT NOT NULL,
                volume_24h DOUBLE PRECISION DEFAULT 0,
                price_usd DOUBLE PRECISION DEFAULT 0,
                price_change_24h DOUBLE PRECISION DEFAULT 0,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(symbol, timestamp)
            )
        `);

        // Indici market_data
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_market_data_symbol_timestamp ON market_data(symbol, timestamp DESC)
        `);

        // ✅ Tabella per salvare volumi 24h (fallback quando IP è bannato)
        await client.query(`
            CREATE TABLE IF NOT EXISTS symbol_volumes_24h (
                symbol TEXT PRIMARY KEY,
                volume_24h DOUBLE PRECISION NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_symbol_volumes_symbol ON symbol_volumes_24h(symbol)
        `);

        console.log('✅ Tabelle crypto PostgreSQL inizializzate correttamente');
    } catch (err) {
        console.error('❌ Errore inizializzazione database:', err.message);
        console.error('❌ Stack:', err.stack);
        throw err;
    } finally {
        client.release();
    }
}

// Inizializza al caricamento
initDb().catch(err => {
    console.error('❌ Errore inizializzazione crypto database:', err.message);
    // Non bloccare l'avvio del backend
});

// Export helpers e pool
module.exports = {
    dbAll,
    dbGet,
    dbRun,
    pool,
    initDb
};

// Export anche come default per compatibilità con codice esistente
module.exports.default = {
    dbAll,
    dbGet,
    dbRun,
    pool
};

