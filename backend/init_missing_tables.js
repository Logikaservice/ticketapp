/**
 * 🔧 Script per Inizializzare Tabelle Mancanti
 * 
 * Crea le tabelle bot_parameters e market_data se non esistono
 */

const { dbRun } = require('./crypto_db');

async function initMissingTables() {
    console.log('🔄 Inizializzazione tabelle mancanti...');
    console.log('');

    try {
        // 1. Crea tabella bot_parameters
        console.log('📊 Creazione tabella bot_parameters...');
        await dbRun(`
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
        console.log('✅ Tabella bot_parameters creata/verificata');

        // 2. Crea tabella market_data
        console.log('📊 Creazione tabella market_data...');
        await dbRun(`
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
        console.log('✅ Tabella market_data creata/verificata');

        // 3. Crea indice per market_data
        console.log('📊 Creazione indice per market_data...');
        await dbRun(`
            CREATE INDEX IF NOT EXISTS idx_market_data_symbol_timestamp ON market_data(symbol, timestamp DESC)
        `);
        console.log('✅ Indice market_data creato/verificato');

        console.log('');
        console.log('✅ Tutte le tabelle sono state inizializzate correttamente!');
        console.log('');
        console.log('📋 PROSSIMI PASSI:');
        console.log('1. Esegui di nuovo: node check_bot_status.js ethereum');
        console.log('2. Esegui: node diagnose_bot_issues.js ethereum');
        console.log('');

    } catch (error) {
        console.error('❌ Errore durante inizializzazione:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

initMissingTables().catch(console.error);

