// Migration script to add missing column to open_positions table
const { Pool } = require('pg');

const DATABASE_URL_CRYPTO = process.env.DATABASE_URL_CRYPTO || 'postgresql://postgres:TicketApp2025!Secure@localhost:5432/crypto_db';

const pool = new Pool({
    connectionString: DATABASE_URL_CRYPTO,
    ssl: false
});

async function addCloseReasonColumn() {
    const client = await pool.connect();

    try {
        console.log('\n🔧 MIGRAZIONE DATABASE: Aggiunta colonna close_reason\n');

        // Check if column already exists
        const checkResult = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'open_positions' 
            AND column_name = 'close_reason'
        `);

        if (checkResult.rows.length > 0) {
            console.log('✅ La colonna close_reason esiste già. Nessuna azione necessaria.\n');
            return;
        }

        // Add the column
        console.log('📝 Aggiunta colonna close_reason alla tabella open_positions...');
        await client.query(`
            ALTER TABLE open_positions 
            ADD COLUMN close_reason TEXT
        `);

        console.log('✅ Colonna close_reason aggiunta con successo!\n');
        console.log('📊 Verifica struttura tabella:\n');

        // Show table structure
        const columnsResult = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'open_positions'
            ORDER BY ordinal_position
        `);

        console.log('Colonne della tabella open_positions:');
        columnsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });

        console.log('\n✅ MIGRAZIONE COMPLETATA CON SUCCESSO!\n');

    } catch (error) {
        console.error('\n❌ ERRORE DURANTE LA MIGRAZIONE:', error.message);
        console.error('Stack:', error.stack);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Execute migration
addCloseReasonColumn().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
