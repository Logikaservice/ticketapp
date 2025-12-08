const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'crypto.db');

// ✅ FIX: Verifica esistenza directory prima di creare database
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    try {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log('✅ Created database directory:', dbDir);
    } catch (mkdirErr) {
        console.error('❌ Error creating database directory:', mkdirErr.message);
    }
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening crypto database:', err.message);
        console.error('❌ Database path:', dbPath);
        // ✅ FIX: Non crashare il backend, solo logga l'errore
        // Il database verrà creato automaticamente alla prima query
    } else {
        console.log('✅ Connected to the crypto SQLite database:', dbPath);
        try {
            initDb();
        } catch (initErr) {
            console.error('❌ Error initializing crypto database:', initErr.message);
            console.error('❌ Stack:', initErr.stack);
            // ✅ FIX: Non crashare, continua comunque
        }
    }
});

// ✅ FIX: Gestione errori migliorata per evitare crash
db.on('error', (err) => {
    console.error('❌ SQLite database error:', err.message);
    // Non crashare il backend per errori del database
});

function initDb() {
    db.serialize(() => {
        // Portfolio table: tracks USD balance and crypto holdings
        db.run(`CREATE TABLE IF NOT EXISTS portfolio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      balance_usd REAL DEFAULT 10000.0,
      holdings TEXT DEFAULT '{}'
    )`);

        // Ensure a default user exists
        db.get("SELECT count(*) as count FROM portfolio", (err, row) => {
            if (row.count === 0) {
                db.run("INSERT INTO portfolio (balance_usd, holdings) VALUES (10000.0, '{}')");
                console.log("Initialized demo portfolio with $10,000");
            }
        });

        // Trades history
        db.run(`CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT,
      type TEXT,
      amount REAL,
      price REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      strategy TEXT,
      profit_loss REAL,
      ticket_id TEXT
    )`);

        // ✅ FIX: Aggiungi colonna ticket_id se non esiste (migrazione)
        db.all("PRAGMA table_info(trades)", (err, columns) => {
            if (!err && columns && columns.length > 0) {
                const columnNames = columns.map(c => c.name);
                if (!columnNames.includes('ticket_id')) {
                    db.run(`ALTER TABLE trades ADD COLUMN ticket_id TEXT`, (alterErr) => {
                        if (alterErr) {
                            console.error('Error adding ticket_id column to trades:', alterErr.message);
                        } else {
                            console.log('✅ Added ticket_id column to trades');
                        }
                    });
                }
            }
        });

        // Bot settings - Supporta multi-simbolo
        db.run(`CREATE TABLE IF NOT EXISTS bot_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_name TEXT NOT NULL,
      symbol TEXT NOT NULL DEFAULT 'bitcoin',
      is_active INTEGER DEFAULT 0,
      parameters TEXT,
      UNIQUE(strategy_name, symbol)
    )`);

        // Migrate existing bot_settings: add symbol column and fix UNIQUE constraint
        db.all("PRAGMA table_info(bot_settings)", (err, columns) => {
            if (!err && columns && columns.length > 0) {
                const columnNames = columns.map(c => c.name);
                const hasSymbolColumn = columnNames.includes('symbol');

                // Check if we need to migrate (either missing symbol column or old UNIQUE constraint)
                db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='bot_settings'", (sqlErr, tableInfo) => {
                    if (!sqlErr && tableInfo && tableInfo.length > 0) {
                        const createSql = tableInfo[0].sql;
                        const hasOldUnique = createSql.includes('strategy_name TEXT UNIQUE') ||
                            (createSql.includes('UNIQUE(strategy_name)') && !createSql.includes('UNIQUE(strategy_name, symbol)'));

                        if (!hasSymbolColumn || hasOldUnique) {
                            console.log('🔄 Migrating bot_settings table to support multi-symbol...');

                            // Step 1: Create temporary table with correct schema
                            db.run(`CREATE TABLE IF NOT EXISTS bot_settings_new (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                strategy_name TEXT NOT NULL,
                                symbol TEXT NOT NULL DEFAULT 'bitcoin',
                                is_active INTEGER DEFAULT 0,
                                parameters TEXT,
                                UNIQUE(strategy_name, symbol)
                            )`, (createErr) => {
                                if (createErr) {
                                    console.error('Error creating new bot_settings table:', createErr.message);
                                } else {
                                    // Step 2: Copy existing data, defaulting symbol to 'bitcoin' if missing
                                    // Check if symbol column exists in old table first
                                    db.all("PRAGMA table_info(bot_settings)", (colErr, oldColumns) => {
                                        if (colErr) {
                                            console.error('Error checking old table columns:', colErr.message);
                                            return;
                                        }
                                        const hasSymbolInOld = oldColumns.some(c => c.name === 'symbol');

                                        let copyQuery;
                                        if (hasSymbolInOld) {
                                            // Old table has symbol column, use it
                                            copyQuery = `INSERT INTO bot_settings_new (id, strategy_name, symbol, is_active, parameters)
                                                SELECT 
                                                    id,
                                                    strategy_name,
                                                    COALESCE(symbol, 'bitcoin') as symbol,
                                                    is_active,
                                                    parameters
                                                FROM bot_settings`;
                                        } else {
                                            // Old table doesn't have symbol column, default to 'bitcoin'
                                            copyQuery = `INSERT INTO bot_settings_new (id, strategy_name, symbol, is_active, parameters)
                                                SELECT 
                                                    id,
                                                    strategy_name,
                                                    'bitcoin' as symbol,
                                                    is_active,
                                                    parameters
                                                FROM bot_settings`;
                                        }

                                        db.run(copyQuery, (copyErr) => {
                                            if (copyErr) {
                                                console.error('Error copying data to new bot_settings table:', copyErr.message);
                                            } else {
                                                // Step 3: Drop old table
                                                db.run(`DROP TABLE bot_settings`, (dropErr) => {
                                                    if (dropErr) {
                                                        console.error('Error dropping old bot_settings table:', dropErr.message);
                                                    } else {
                                                        // Step 4: Rename new table
                                                        db.run(`ALTER TABLE bot_settings_new RENAME TO bot_settings`, (renameErr) => {
                                                            if (renameErr) {
                                                                console.error('Error renaming bot_settings table:', renameErr.message);
                                                            } else {
                                                                console.log('✅ Successfully migrated bot_settings table to support multi-symbol');
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    });
                                }
                            });
                        } else {
                            console.log('✅ bot_settings table already has correct schema');
                        }
                    }
                });
            }
        });

        // Insert default strategy for bitcoin if not exists with all configurable parameters
        db.run(`INSERT OR IGNORE INTO bot_settings (strategy_name, symbol, is_active, parameters) 
            VALUES ('RSI_Strategy', 'bitcoin', 0, '{
                "rsi_period": 14,
                "rsi_oversold": 30,
                "rsi_overbought": 70,
                "stop_loss_pct": 2.0,
                "take_profit_pct": 3.0,
                "trade_size_eur": 50,
                "trailing_stop_enabled": false,
                "trailing_stop_distance_pct": 1.0,
                "partial_close_enabled": false,
                "take_profit_1_pct": 1.5,
                "take_profit_2_pct": 3.0
            }')`);

        // Price History (New Table for Persistence)
        db.run(`CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT,
            price REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Klines OHLC complete per candele stabili (come TradingView)
        db.run(`CREATE TABLE IF NOT EXISTS klines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            interval TEXT NOT NULL DEFAULT '15m',
            open_time INTEGER NOT NULL,
            open_price REAL NOT NULL,
            high_price REAL NOT NULL,
            low_price REAL NOT NULL,
            close_price REAL NOT NULL,
            volume REAL DEFAULT 0,
            close_time INTEGER NOT NULL,
            UNIQUE(symbol, interval, open_time)
        )`);

        // Indice per performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_klines_lookup ON klines(symbol, interval, open_time DESC)`);

        // Klines OHLC complete (per candele stabili come TradingView)
        db.run(`CREATE TABLE IF NOT EXISTS klines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            interval TEXT NOT NULL DEFAULT '15m',
            open_time INTEGER NOT NULL,
            open_price REAL NOT NULL,
            high_price REAL NOT NULL,
            low_price REAL NOT NULL,
            close_price REAL NOT NULL,
            volume REAL DEFAULT 0,
            close_time INTEGER NOT NULL,
            UNIQUE(symbol, interval, open_time)
        )`);

        // Indici per performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_klines_symbol_interval_time ON klines(symbol, interval, open_time)`);

        // Open Positions (MetaTrader 5 style)
        db.run(`CREATE TABLE IF NOT EXISTS open_positions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT UNIQUE NOT NULL,
            symbol TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
            volume REAL NOT NULL,
            entry_price REAL NOT NULL,
            current_price REAL DEFAULT 0,
            stop_loss REAL,
            take_profit REAL,
            swap REAL DEFAULT 0,
            commission REAL DEFAULT 0,
            profit_loss REAL DEFAULT 0,
            profit_loss_pct REAL DEFAULT 0,
            opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME,
            strategy TEXT,
            status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'stopped', 'taken')),
            -- Trailing Stop Loss fields
            trailing_stop_enabled INTEGER DEFAULT 0,
            trailing_stop_distance_pct REAL DEFAULT 0,
            highest_price REAL DEFAULT 0,
            -- Partial Close fields
            volume_closed REAL DEFAULT 0,
            take_profit_1 REAL,
            take_profit_2 REAL,
            tp1_hit INTEGER DEFAULT 0
        )`);

        // Migrate existing table: add new columns if they don't exist
        // SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we check first
        db.all("PRAGMA table_info(open_positions)", (err, columns) => {
            if (!err && columns && columns.length > 0) {
                const columnNames = columns.map(c => c.name);

                const columnsToAdd = [
                    { name: 'trailing_stop_enabled', sql: 'INTEGER DEFAULT 0' },
                    { name: 'trailing_stop_distance_pct', sql: 'REAL DEFAULT 0' },
                    { name: 'highest_price', sql: 'REAL DEFAULT 0' },
                    { name: 'volume_closed', sql: 'REAL DEFAULT 0' },
                    { name: 'take_profit_1', sql: 'REAL' },
                    { name: 'take_profit_2', sql: 'REAL' },
                    { name: 'tp1_hit', sql: 'INTEGER DEFAULT 0' },
                    { name: 'signal_details', sql: 'TEXT' } // ✅ FIX: Salva dettagli segnale per analisi
                ];

                columnsToAdd.forEach(col => {
                    if (!columnNames.includes(col.name)) {
                        db.run(`ALTER TABLE open_positions ADD COLUMN ${col.name} ${col.sql}`, (alterErr) => {
                            if (alterErr) {
                                console.error(`Error adding column ${col.name}:`, alterErr.message);
                            } else {
                                console.log(`✅ Added column ${col.name} to open_positions`);
                            }
                        });
                    }
                });
            }
        });

        // Create index for faster queries
        db.run(`CREATE INDEX IF NOT EXISTS idx_open_positions_status ON open_positions(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_open_positions_symbol ON open_positions(symbol)`);

        // Backtesting Results Table
        db.run(`CREATE TABLE IF NOT EXISTS backtest_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_name TEXT,
            strategy_params TEXT,
            start_date DATETIME,
            end_date DATETIME,
            initial_balance REAL,
            final_balance REAL,
            total_trades INTEGER,
            winning_trades INTEGER,
            losing_trades INTEGER,
            total_pnl REAL,
            total_pnl_pct REAL,
            win_rate REAL,
            profit_factor REAL,
            max_drawdown REAL,
            max_drawdown_pct REAL,
            sharpe_ratio REAL,
            results_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Migrate existing table: add new columns if they don't exist
        db.all("PRAGMA table_info(backtest_results)", (err, columns) => {
            if (!err && columns && columns.length > 0) {
                const columnNames = columns.map(c => c.name);

                const columnsToAdd = [
                    { name: 'test_name', sql: 'TEXT' },
                    { name: 'strategy_params', sql: 'TEXT' },
                    { name: 'start_date', sql: 'DATETIME' },
                    { name: 'end_date', sql: 'DATETIME' },
                    { name: 'initial_balance', sql: 'REAL' },
                    { name: 'final_balance', sql: 'REAL' },
                    { name: 'total_trades', sql: 'INTEGER' },
                    { name: 'winning_trades', sql: 'INTEGER' },
                    { name: 'losing_trades', sql: 'INTEGER' },
                    { name: 'total_pnl', sql: 'REAL' },
                    { name: 'total_pnl_pct', sql: 'REAL' },
                    { name: 'win_rate', sql: 'REAL' },
                    { name: 'profit_factor', sql: 'REAL' },
                    { name: 'max_drawdown', sql: 'REAL' },
                    { name: 'max_drawdown_pct', sql: 'REAL' },
                    { name: 'sharpe_ratio', sql: 'REAL' },
                    { name: 'results_data', sql: 'TEXT' },
                    { name: 'created_at', sql: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
                ];

                columnsToAdd.forEach(col => {
                    if (!columnNames.includes(col.name)) {
                        db.run(`ALTER TABLE backtest_results ADD COLUMN ${col.name} ${col.sql}`, (alterErr) => {
                            if (alterErr) {
                                console.error(`Error adding column ${col.name}:`, alterErr.message);
                            } else {
                                console.log(`✅ Added column ${col.name} to backtest_results`);
                            }
                        });
                    }
                });
            }
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_backtest_results_created ON backtest_results(created_at DESC)`);

        // Performance Statistics Table for Kelly Criterion
        db.run(`CREATE TABLE IF NOT EXISTS performance_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            total_trades INTEGER DEFAULT 0,
            winning_trades INTEGER DEFAULT 0,
            losing_trades INTEGER DEFAULT 0,
            total_profit REAL DEFAULT 0,
            total_loss REAL DEFAULT 0,
            avg_win REAL DEFAULT 0,
            avg_loss REAL DEFAULT 0,
            win_rate REAL DEFAULT 0,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Initialize performance stats if not exists
        db.get("SELECT count(*) as count FROM performance_stats", (err, row) => {
            if (!err && row.count === 0) {
                // ✅ FIX: Inserisci record con id=1 esplicito e tutti i campi inizializzati
                db.run("INSERT INTO performance_stats (id, total_trades, winning_trades, losing_trades, total_profit, total_loss, avg_win, avg_loss, win_rate) VALUES (1, 0, 0, 0, 0, 0, 0, 0, 0)");
                console.log("✅ Initialized performance_stats table with id=1");
            } else if (!err && row.count > 0) {
                // ✅ FIX: Verifica che esista un record con id=1, altrimenti crealo
                db.get("SELECT id FROM performance_stats WHERE id = 1", (err2, row2) => {
                    if (err2 || !row2) {
                        // Non esiste record con id=1, crealo
                        db.run("INSERT OR IGNORE INTO performance_stats (id, total_trades, winning_trades, losing_trades, total_profit, total_loss, avg_win, avg_loss, win_rate) VALUES (1, 0, 0, 0, 0, 0, 0, 0, 0)");
                        console.log("✅ Created performance_stats record with id=1");
                    }
                });
            }
        });
    });
}

module.exports = db;
