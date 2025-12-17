const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('🔍 VERIFICA CONFIGURAZIONE DATABASE\n');
console.log('='.repeat(70));

// 1. Verifica variabili d'ambiente
console.log('\n📋 VARIABILI D\'AMBIENTE:');
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Configurato' : '❌ NON configurato'}`);
console.log(`   DATABASE_URL_CRYPTO: ${process.env.DATABASE_URL_CRYPTO ? '✅ Configurato' : '❌ NON configurato'}`);

if (process.env.DATABASE_URL) {
    // Nascondi password
    const maskedUrl = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
    console.log(`   DATABASE_URL (masked): ${maskedUrl}`);
}

if (process.env.DATABASE_URL_CRYPTO) {
    const maskedUrl = process.env.DATABASE_URL_CRYPTO.replace(/:[^:@]+@/, ':****@');
    console.log(`   DATABASE_URL_CRYPTO (masked): ${maskedUrl}`);
}

// 2. Verifica quale database sta usando crypto_db.js
console.log('\n🗄️  DATABASE CRYPTO:');
const { pool } = require('../crypto_db');

// Estrai info dalla connection string
let cryptoDbUrl = process.env.DATABASE_URL_CRYPTO;
if (!cryptoDbUrl && process.env.DATABASE_URL) {
    cryptoDbUrl = process.env.DATABASE_URL.replace(/\/[^\/]+$/, '/crypto_db');
    console.log('   Usando database separato derivato da DATABASE_URL');
} else if (cryptoDbUrl) {
    console.log('   Usando DATABASE_URL_CRYPTO configurato');
} else {
    cryptoDbUrl = process.env.DATABASE_URL;
    console.log('   ⚠️ Usando stesso database (non isolato)');
}

if (cryptoDbUrl) {
    const maskedUrl = cryptoDbUrl.replace(/:[^:@]+@/, ':****@');
    console.log(`   URL: ${maskedUrl}`);

    // Estrai host e database
    const match = cryptoDbUrl.match(/postgresql:\/\/[^@]+@([^:\/]+)(?::(\d+))?\/(.+?)(?:\?|$)/);
    if (match) {
        console.log(`   Host: ${match[1]}`);
        console.log(`   Port: ${match[2] || '5432'}`);
        console.log(`   Database: ${match[3]}`);

        // Verifica se è localhost o VPS
        if (match[1].includes('localhost') || match[1].includes('127.0.0.1')) {
            console.log('   🏠 LOCALE (backup)');
        } else {
            console.log('   🌐 VPS (produzione)');
        }
    }
}

// 3. Test connessione
console.log('\n🔌 TEST CONNESSIONE:');
pool.query('SELECT NOW() as current_time, current_database() as db_name', (err, result) => {
    if (err) {
        console.error('   ❌ Errore connessione:', err.message);
    } else {
        console.log(`   ✅ Connesso con successo!`);
        console.log(`   Database: ${result.rows[0].db_name}`);
        console.log(`   Server time: ${result.rows[0].current_time}`);
    }

    // 4. Verifica tabelle
    console.log('\n📊 TABELLE PRESENTI:');
    pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    `, (err, result) => {
        if (err) {
            console.error('   ❌ Errore:', err.message);
        } else {
            console.log(`   Trovate ${result.rows.length} tabelle:`);
            result.rows.forEach(row => {
                console.log(`     - ${row.table_name}`);
            });
        }

        // 5. Conta record in open_positions
        console.log('\n📈 DATI IN open_positions:');
        pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'open') as open_count,
                COUNT(*) FILTER (WHERE status IN ('closed', 'stopped', 'taken')) as closed_count,
                COUNT(*) as total_count
            FROM open_positions
        `, (err, result) => {
            if (err) {
                console.error('   ❌ Errore:', err.message);
            } else {
                const row = result.rows[0];
                console.log(`   Posizioni aperte: ${row.open_count}`);
                console.log(`   Posizioni chiuse: ${row.closed_count}`);
                console.log(`   Totale: ${row.total_count}`);
            }

            console.log('\n' + '='.repeat(70));
            console.log('✅ Verifica completata\n');
            pool.end();
        });
    });
});
