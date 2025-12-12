const db = require('./backend/crypto_db');

console.log('🔄 Resetting portfolio to €250.00...\n');

db.run("UPDATE portfolio SET balance_usd = 250, holdings = '{}' WHERE id = 1", function (err) {
    if (err) {
        console.error('❌ Error resetting portfolio:', err);
        db.close();
        return;
    }

    console.log('✅ Portfolio reset successful!');
    console.log(`   Rows updated: ${this.changes}`);

    // Verify the update
    db.get('SELECT * FROM portfolio WHERE id = 1', (err, row) => {
        if (err) {
            console.error('Error verifying:', err);
        } else {
            console.log('\n📊 New Portfolio Status:');
            console.log('='.repeat(50));
            console.log(`   Balance: €${row.balance_usd}`);
            console.log(`   Holdings: ${row.holdings}`);
            console.log('='.repeat(50));

            if (row.balance_usd === 250) {
                console.log('\n🎉 SUCCESS! Balance is now exactly €250.00');
            } else {
                console.log(`\n⚠️  WARNING: Balance is €${row.balance_usd}, not €250.00`);
            }
        }

        db.close();
    });
});
