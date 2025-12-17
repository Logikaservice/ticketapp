/**
 * Script per testare direttamente la query delle posizioni aperte
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const cryptoDb = require('./crypto_db');
const dbAll = cryptoDb.dbAll;
const dbGet = cryptoDb.dbGet;

async function testQuery() {
    try {
        console.log('🔍 Test query posizioni aperte...\n');

        // Test 1: Query semplice
        console.log('📊 Test 1: Query semplice con status = \'open\'');
        const result1 = await dbAll("SELECT * FROM open_positions WHERE status = 'open' ORDER BY opened_at DESC");
        console.log(`   Risultati: ${result1?.length || 0}`);
        if (result1 && result1.length > 0) {
            result1.forEach((pos, idx) => {
                console.log(`   ${idx + 1}. ${pos.symbol} - ${pos.type} - status: "${pos.status}" (tipo: ${typeof pos.status})`);
            });
        }

        // Test 2: Query senza filtro status
        console.log('\n📊 Test 2: Query senza filtro status');
        const result2 = await dbAll("SELECT ticket_id, symbol, type, status FROM open_positions ORDER BY opened_at DESC");
        console.log(`   Risultati: ${result2?.length || 0}`);
        if (result2 && result2.length > 0) {
            result2.forEach((pos, idx) => {
                console.log(`   ${idx + 1}. ${pos.symbol} - ${pos.type} - status: "${pos.status}" (tipo: ${typeof pos.status})`);
                // Verifica se status è esattamente 'open'
                const isOpen = pos.status === 'open';
                const statusTrimmed = String(pos.status).trim();
                const isOpenTrimmed = statusTrimmed === 'open';
                console.log(`      status === 'open': ${isOpen}, trimmed === 'open': ${isOpenTrimmed}`);
            });
        }

        // Test 3: Query con ILIKE (case insensitive)
        console.log('\n📊 Test 3: Query con ILIKE (case insensitive)');
        const result3 = await dbAll("SELECT ticket_id, symbol, type, status FROM open_positions WHERE status ILIKE 'open' ORDER BY opened_at DESC");
        console.log(`   Risultati: ${result3?.length || 0}`);
        if (result3 && result3.length > 0) {
            result3.forEach((pos, idx) => {
                console.log(`   ${idx + 1}. ${pos.symbol} - ${pos.type} - status: "${pos.status}"`);
            });
        }

        // Test 4: Verifica struttura tabella
        console.log('\n📊 Test 4: Verifica struttura tabella');
        const tableInfo = await dbAll(`
            SELECT column_name, data_type, character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'open_positions' AND column_name = 'status'
        `);
        if (tableInfo && tableInfo.length > 0) {
            tableInfo.forEach(col => {
                console.log(`   Colonna status: ${col.data_type} (max length: ${col.character_maximum_length || 'N/A'})`);
            });
        }

    } catch (error) {
        console.error('❌ Errore:', error.message);
        console.error('Stack:', error.stack);
    }
}

testQuery().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

