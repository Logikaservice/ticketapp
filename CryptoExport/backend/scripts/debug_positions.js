const cryptoDb = require('../crypto_db');
const dbAll = cryptoDb.dbAll;

async function checkStatuses() {
    try {
        console.log('🔍 Checking position statuses...');
        const rows = await dbAll("SELECT status, COUNT(*) as count FROM open_positions GROUP BY status");
        console.table(rows);

        const openRows = await dbAll("SELECT * FROM open_positions LIMIT 5");
        console.log('Sample positions:', openRows);
    } catch (e) {
        console.error(e);
    }
}
checkStatuses();
