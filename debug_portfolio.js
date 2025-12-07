const db = require('./backend/crypto_db');

db.get("SELECT * FROM portfolio", [], (err, row) => {
    if (err) {
        console.error(err);
    } else {
        console.log('Portfolio:', row);
        console.log('Holdings:', JSON.parse(row.holdings));
    }
});

db.all("SELECT * FROM open_positions", [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log('Open Positions:', rows.length);
        rows.forEach(r => console.log(`${r.symbol} ${r.type} ${r.volume} @ ${r.entry_price}`));
    }
});
