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

        // Insert default strategy if not exists
        db.run(`INSERT OR IGNORE INTO bot_settings (strategy_name, is_active, parameters) 
            VALUES ('RSI_Strategy', 0, '{"period": 14, "buy_threshold": 30, "sell_threshold": 70}')`);

        // Price History (New Table for Persistence)
        db.run(`CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT,
            price REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    });
}

module.exports = db;
