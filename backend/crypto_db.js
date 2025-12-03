const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'crypto.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening crypto database:', err.message);
    } else {
        console.log('Connected to the crypto SQLite database.');
        initDb();
    }
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
      profit_loss REAL
    )`);

        // Bot settings
        db.run(`CREATE TABLE IF NOT EXISTS bot_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_name TEXT UNIQUE,
      is_active INTEGER DEFAULT 0,
      parameters TEXT
    )`);

        // Insert default strategy if not exists with all configurable parameters
        db.run(`INSERT OR IGNORE INTO bot_settings (strategy_name, is_active, parameters) 
            VALUES ('RSI_Strategy', 0, '{
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
                    { name: 'tp1_hit', sql: 'INTEGER DEFAULT 0' }
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
    });
}

module.exports = db;
