// Test connessione database VPS
require('dotenv').config();
const { Client } = require('pg');

async function testConnection() {
    console.log('🔍 Test connessione database VPS');
    console.log('================================\n');
    
    const databases = [
        { name: 'ticketapp', url: process.env.DATABASE_URL },
        { name: 'crypto_db', url: process.env.DATABASE_URL_CRYPTO },
        { name: 'vivaldi_db', url: process.env.DATABASE_URL_VIVALDI }
    ];
    
    for (const db of databases) {
        console.log(`📊 Test ${db.name}...`);
        
        if (!db.url) {
            console.log(`   ❌ DATABASE_URL non configurato\n`);
            continue;
        }
        
        // Estrai host dall'URL (nasconde password)
        const urlMatch = db.url.match(/@([^:]+):/);
        const host = urlMatch ? urlMatch[1] : 'unknown';
        console.log(`   Host: ${host}`);
        
        const client = new Client({ connectionString: db.url });
        
        try {
            await client.connect();
            
            // Test query
            const result = await client.query('SELECT current_database(), version()');
            const dbName = result.rows[0].current_database;
            const version = result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1];
            
            console.log(`   ✅ Connesso a: ${dbName}`);
            console.log(`   📌 PostgreSQL: ${version}\n`);
            
            await client.end();
        } catch (error) {
            console.log(`   ❌ Errore: ${error.message}\n`);
        }
    }
}

testConnection().catch(console.error);
