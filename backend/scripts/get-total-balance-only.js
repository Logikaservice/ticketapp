/**
 * Script per leggere SOLO total_balance dal database (output pulito per altri script)
 */

const { dbGet } = require('../crypto_db');

async function getTotalBalance() {
    try {
        const result = await dbGet(
            "SELECT setting_value FROM general_settings WHERE setting_key = 'total_balance'"
        );
        
        if (!result || !result.setting_value) {
            console.error('ERROR: total_balance not found');
            process.exit(1);
        }
        
        // Output solo il valore, senza altre informazioni
        console.log(result.setting_value.trim());
        process.exit(0);
    } catch (error) {
        console.error('ERROR:', error.message);
        process.exit(1);
    }
}

getTotalBalance();
