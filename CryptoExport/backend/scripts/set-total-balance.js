require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const cryptoDb = require('../crypto_db_postgresql');

async function setTotalBalance(value) {
    try {
        await cryptoDb.initDb();
        
        const result = await cryptoDb.dbRun(
            `INSERT INTO general_settings (setting_key, setting_value, updated_at)
             VALUES ('total_balance', $1, NOW())
             ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()`,
            [value.toString()]
        );
        
        // Verify
        const verify = await cryptoDb.dbGet("SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance'");
        console.log(`✅ Total Balance salvato: $${parseFloat(verify?.setting_value || 0).toFixed(2)}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error.message);
        process.exit(1);
    }
}

const value = process.argv[2] || '5000';
setTotalBalance(value);

