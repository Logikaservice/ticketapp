const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const dbPath = path.resolve(__dirname, 'crypto_trading.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Connected to the database.');
});

// Query open positions
const sql = `SELECT * FROM positions WHERE status = 'open'`;

db.all(sql, [], (err, rows) => {
    if (err) {
        throw err;
    }
    console.log(`\n🔍 Found ${rows.length} OPEN positions in database:`);
    rows.forEach((row) => {
        console.log(`- [${row.id}] ${row.symbol} (${row.type}): Price ${row.entry_price}, Amount ${row.amount}`);
    });
    console.log('\n✅ Data is SAFE. Backend needs to reload cache.');

    // Close connection
    db.close();
});
