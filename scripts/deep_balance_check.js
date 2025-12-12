const db = require('./backend/crypto_db');

console.log('🔍 Checking database modification history...\n');

// Check if there's an audit log or history
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
        console.error('Error:', err);
        return;
    }

    console.log('📋 Available Tables:');
    console.log('='.repeat(80));
    tables.forEach(t => console.log(`  - ${t.name}`));

    // Check portfolio table schema
    db.all("PRAGMA table_info(portfolio)", (err, schema) => {
        if (err) {
            console.error('Error:', err);
            return;
        }

        console.log('\n📊 Portfolio Table Schema:');
        console.log('='.repeat(80));
        schema.forEach(col => {
            console.log(`  - ${col.name} (${col.type})`);
        });

        // Get all portfolio records (in case there are multiple)
        db.all("SELECT * FROM portfolio", (err, rows) => {
            if (err) {
                console.error('Error:', err);
                return;
            }

            console.log('\n💰 All Portfolio Records:');
            console.log('='.repeat(80));
            rows.forEach((row, i) => {
                console.log(`\nRecord ${i + 1}:`);
                console.log(`  ID: ${row.id}`);
                console.log(`  Balance: €${row.balance_usd}`);
                console.log(`  Holdings: ${row.holdings}`);
                console.log(`  Updated: ${row.updated_at || 'N/A'}`);
            });

            // Check if there's a bot_activity or log table
            db.all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%log%' OR name LIKE '%activity%' OR name LIKE '%history%'", (err, logTables) => {
                if (err) {
                    console.error('Error:', err);
                    db.close();
                    return;
                }

                if (logTables.length > 0) {
                    console.log('\n📝 Log/History Tables Found:');
                    console.log('='.repeat(80));
                    logTables.forEach(t => console.log(`  - ${t.name}`));

                    // Check each log table
                    let processed = 0;
                    logTables.forEach(table => {
                        db.all(`SELECT * FROM ${table.name} ORDER BY timestamp DESC LIMIT 20`, (err, logs) => {
                            if (!err && logs.length > 0) {
                                console.log(`\n📋 ${table.name}:`);
                                console.log('='.repeat(80));
                                logs.forEach(log => console.log(JSON.stringify(log, null, 2)));
                            }
                            processed++;
                            if (processed === logTables.length) {
                                checkConclusion();
                            }
                        });
                    });
                } else {
                    checkConclusion();
                }

                function checkConclusion() {
                    console.log('\n' + '='.repeat(80));
                    console.log('🎯 ANALYSIS:');
                    console.log('='.repeat(80));
                    console.log('Balance: €262.50 (expected €250.00)');
                    console.log('Difference: +€12.50');
                    console.log('');
                    console.log('Possible explanations:');
                    console.log('1. ✅ Bot executed trades that were later deleted from DB');
                    console.log('2. ✅ Manual database update (someone set balance to 262.50)');
                    console.log('3. ✅ Reset function bug (didn\'t reset to exactly 250)');
                    console.log('4. ✅ Previous session profit that wasn\'t cleared');
                    console.log('');
                    console.log('💡 RECOMMENDATION:');
                    console.log('If you want to reset to exactly €250.00, run:');
                    console.log('   POST /api/crypto/reset');
                    console.log('Or manually update:');
                    console.log('   UPDATE portfolio SET balance_usd = 250 WHERE id = 1;');

                    db.close();
                }
            });
        });
    });
});
