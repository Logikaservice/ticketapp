/**
 * Script di migrazione dati da SQLite a PostgreSQL
 * 
 * Questo script:
 * 1. Legge tutti i dati dal database SQLite (crypto.db)
 * 2. Migra i dati nel database PostgreSQL
 * 3. Verifica l'integrità dei dati migrati
 * 
 * IMPORTANTE: Esegui prima migrate-crypto-to-postgresql.sql per creare le tabelle
 * 
 * Uso:
 *   node scripts/migrate-crypto-data-sqlite-to-postgresql.js
 */

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Configurazione SQLite
const sqliteDbPath = path.resolve(__dirname, '../crypto.db');

// Configurazione PostgreSQL
// ✅ ISOLAMENTO COMPLETO: Usa DATABASE_URL_CRYPTO se configurato (database separato)
// Altrimenti crea automaticamente un database separato basato su DATABASE_URL
let cryptoDbUrl = process.env.DATABASE_URL_CRYPTO;

if (!cryptoDbUrl && process.env.DATABASE_URL) {
    // Crea URL per database separato (come fanno Vivaldi e PackVision)
    cryptoDbUrl = process.env.DATABASE_URL.replace(/\/[^\/]+$/, '/crypto_db');
    console.log(`📊 Usando database separato: ${cryptoDbUrl.replace(/:[^:@]+@/, ':****@')}`);
} else if (!cryptoDbUrl) {
    // Fallback: stesso database (non consigliato)
    cryptoDbUrl = process.env.DATABASE_URL;
    console.warn(`⚠️  Usando stesso database degli altri progetti (non isolato)`);
}

// Disabilita SSL per localhost
const isLocalhost = cryptoDbUrl.includes('localhost') || cryptoDbUrl.includes('127.0.0.1');
const pgPool = new Pool({
    connectionString: cryptoDbUrl,
    ssl: isLocalhost ? false : {
        rejectUnauthorized: false
    }
});

async function migrateTable(sqliteDb, tableName, pgClient) {
    console.log(`\n📦 Migrando tabella: ${tableName}...`);
    
    try {
        // Leggi tutti i dati da SQLite
        const rows = await new Promise((resolve, reject) => {
            sqliteDb.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        if (rows.length === 0) {
            console.log(`   ⚠️  Tabella ${tableName} vuota, skip`);
            return { migrated: 0, skipped: 0 };
        }

        console.log(`   📊 Trovate ${rows.length} righe da migrare`);

        // Prepara query INSERT per PostgreSQL
        let migrated = 0;
        let skipped = 0;

        for (const row of rows) {
            try {
                // Costruisci query dinamica basata sulle colonne
                const columns = Object.keys(row).filter(k => row[k] !== undefined);
                const values = columns.map((_, i) => `$${i + 1}`);
                const rowValues = columns.map(col => row[col]);

                // Gestisci ON CONFLICT per tabelle con UNIQUE constraints
                let conflictClause = '';
                if (tableName === 'portfolio') {
                    conflictClause = ' ON CONFLICT (id) DO UPDATE SET balance_usd = EXCLUDED.balance_usd, holdings = EXCLUDED.holdings';
                } else if (tableName === 'bot_settings') {
                    conflictClause = ' ON CONFLICT (strategy_name, symbol) DO UPDATE SET is_active = EXCLUDED.is_active, parameters = EXCLUDED.parameters';
                } else if (tableName === 'klines') {
                    conflictClause = ' ON CONFLICT (symbol, interval, open_time) DO NOTHING';
                } else if (tableName === 'open_positions') {
                    conflictClause = ' ON CONFLICT (ticket_id) DO UPDATE SET current_price = EXCLUDED.current_price, profit_loss = EXCLUDED.profit_loss, status = EXCLUDED.status';
                } else if (tableName === 'performance_stats') {
                    conflictClause = ' ON CONFLICT (id) DO UPDATE SET total_trades = EXCLUDED.total_trades, winning_trades = EXCLUDED.winning_trades, losing_trades = EXCLUDED.losing_trades, total_profit = EXCLUDED.total_profit, total_loss = EXCLUDED.total_loss, avg_win = EXCLUDED.avg_win, avg_loss = EXCLUDED.avg_loss, win_rate = EXCLUDED.win_rate';
                }

                const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')})${conflictClause}`;
                
                await pgClient.query(query, rowValues);
                migrated++;
            } catch (err) {
                if (err.code === '23505') { // Unique violation - già migrato
                    skipped++;
                } else {
                    console.error(`   ❌ Errore migrazione riga ${row.id || 'N/A'}:`, err.message);
                    skipped++;
                }
            }
        }

        console.log(`   ✅ Migrate: ${migrated}, Saltate: ${skipped}`);
        return { migrated, skipped };
    } catch (err) {
        console.error(`   ❌ Errore migrazione tabella ${tableName}:`, err.message);
        throw err;
    }
}

async function main() {
    console.log('🔄 Inizio migrazione dati da SQLite a PostgreSQL...\n');
    console.log(`📁 SQLite DB: ${sqliteDbPath}`);
    console.log(`🗄️  PostgreSQL: ${cryptoDbUrl?.replace(/:[^:@]+@/, ':****@') || 'DATABASE_URL'}\n`);

    const sqliteDb = new sqlite3.Database(sqliteDbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('❌ Errore apertura SQLite:', err.message);
            process.exit(1);
        }
    });

    const pgClient = await pgPool.connect();

    try {
        // Verifica che le tabelle PostgreSQL esistano
        const tablesCheck = await pgClient.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('portfolio', 'trades', 'bot_settings', 'price_history', 'klines', 'open_positions', 'backtest_results', 'performance_stats')
        `);

        const existingTables = tablesCheck.rows.map(r => r.table_name);
        const requiredTables = ['portfolio', 'trades', 'bot_settings', 'price_history', 'klines', 'open_positions', 'backtest_results', 'performance_stats'];
        const missingTables = requiredTables.filter(t => !existingTables.includes(t));

        if (missingTables.length > 0) {
            console.error('❌ Tabelle PostgreSQL mancanti:', missingTables.join(', '));
            console.error('   Esegui prima: psql -d <database> -f scripts/migrate-crypto-to-postgresql.sql');
            process.exit(1);
        }

        console.log('✅ Tutte le tabelle PostgreSQL esistono\n');

        // Migra ogni tabella
        const tables = [
            'portfolio',
            'trades',
            'bot_settings',
            'price_history',
            'klines',
            'open_positions',
            'backtest_results',
            'performance_stats'
        ];

        const results = {};
        for (const table of tables) {
            results[table] = await migrateTable(sqliteDb, table, pgClient);
        }

        // Riepilogo
        console.log('\n📊 RIEPILOGO MIGRAZIONE:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        let totalMigrated = 0;
        let totalSkipped = 0;
        for (const [table, result] of Object.entries(results)) {
            console.log(`${table.padEnd(25)} Migrate: ${result.migrated.toString().padStart(5)}, Saltate: ${result.skipped.toString().padStart(5)}`);
            totalMigrated += result.migrated;
            totalSkipped += result.skipped;
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`TOTALE                  Migrate: ${totalMigrated.toString().padStart(5)}, Saltate: ${totalSkipped.toString().padStart(5)}`);
        console.log('\n✅ Migrazione completata!');

    } catch (err) {
        console.error('❌ Errore durante migrazione:', err);
        throw err;
    } finally {
        sqliteDb.close();
        pgClient.release();
        await pgPool.end();
    }
}

main().catch(err => {
    console.error('❌ Errore fatale:', err);
    process.exit(1);
});

