const db = require('./db/crypto_db');

async function checkLTCPosition() {
    try {
        const positions = await db.dbAll(`
            SELECT * FROM crypto_positions 
            WHERE symbol = 'litecoin' 
            ORDER BY opened_at DESC 
            LIMIT 1
        `);

        console.log(JSON.stringify(positions, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkLTCPosition();
