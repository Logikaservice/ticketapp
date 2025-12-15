/**
 * 🔧 Crea tabella system_status per salvare stati sistema
 * Necessaria per il servizio di backup e health check
 */

const { dbRun, dbGet } = require('../crypto_db');

async function createSystemStatusTable() {
    console.log('🔧 Creazione tabella system_status...\n');

    try {
        // Verifica se la tabella esiste già
        const tableExists = await dbGet(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'system_status'
            ) as exists
        `);

        if (tableExists.exists) {
            console.log('✅ Tabella system_status già esistente');
            return;
        }

        // Crea tabella
        await dbRun(`
            CREATE TABLE IF NOT EXISTS system_status (
                key VARCHAR(255) PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Tabella system_status creata con successo!');
        console.log('   Colonne:');
        console.log('   - key: chiave univoca (PRIMARY KEY)');
        console.log('   - value: valore JSON/testo');
        console.log('   - updated_at: timestamp ultimo aggiornamento');
        console.log('\n💡 Questa tabella sarà usata da:');
        console.log('   • BackupService: per salvare info ultimo backup');
        console.log('   • HealthCheckService: per salvare log stato sistema');

    } catch (error) {
        console.error('❌ Errore creazione tabella:', error.message);
        process.exit(1);
    }
}

createSystemStatusTable()
    .then(() => {
        console.log('\n✅ Setup completato!');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Errore:', err);
        process.exit(1);
    });



