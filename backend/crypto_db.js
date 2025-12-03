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
                "trade_size_eur": 50
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
            status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed', 'stopped', 'taken'))
        )`);

        // Create index for faster queries
        db.run(`CREATE INDEX IF NOT EXISTS idx_open_positions_status ON open_positions(status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_open_positions_symbol ON open_positions(symbol)`);
    });
}

module.exports = db;
