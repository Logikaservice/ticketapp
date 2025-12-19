
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { dbGet } = require('./crypto_db_postgresql');

const checkBalance = async () => {
    try {
        console.log('🔍 Checking Portfolio Balance...');
        const portfolio = await dbGet("SELECT * FROM portfolio WHERE id = 1");

        if (portfolio) {
            console.log('✅ Portfolio Found:');
            console.log(`   - Balance USD: $${portfolio.balance_usd}`);
            console.log(`   - Balance EUR: €${portfolio.balance_eur}`);
            console.log(`   - Total Equity: $${portfolio.total_equity || 'N/A'}`);
            console.log(`   - Updated At: ${portfolio.updated_at}`);
        } else {
            console.log('❌ Portfolio record not found (id=1).');
        }
    } catch (error) {
        console.error('❌ Error checking balance:', error.message);
    } finally {
        process.exit();
    }
};

checkBalance();
