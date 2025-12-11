/**
 * 💾 Backup Database PostgreSQL
 * 
 * Crea un backup completo del database crypto prima di operazioni di pulizia.
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');

// Leggi DATABASE_URL_CRYPTO
function getDatabaseUrl() {
    // Prova a leggere da .env o variabili d'ambiente
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    return process.env.DATABASE_URL_CRYPTO || process.env.DATABASE_URL;
}

function parseDatabaseUrl(url) {
    // Formato: postgresql://user:password@host:port/database
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) {
        throw new Error('Formato DATABASE_URL_CRYPTO non valido');
    }
    return {
        user: match[1],
        password: match[2],
        host: match[3],
        port: match[4],
        database: match[5]
    };
}

async function createBackup() {
    console.log('💾 BACKUP DATABASE POSTGRESQL\n');
    console.log('='.repeat(80));
    
    try {
        const dbUrl = getDatabaseUrl();
        if (!dbUrl) {
            throw new Error('DATABASE_URL_CRYPTO non configurato');
        }
        
        console.log('📊 Connessione al database...');
        const dbConfig = parseDatabaseUrl(dbUrl);
        console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
        console.log(`   Database: ${dbConfig.database}`);
        console.log(`   User: ${dbConfig.user}\n`);
        
        // Crea directory backup se non esiste
        const backupDir = path.join(__dirname, '../backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
            console.log(`📁 Creata directory backup: ${backupDir}\n`);
        }
        
        // Nome file backup con timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                         new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
        const backupFile = path.join(backupDir, `crypto_db_backup_${timestamp}.sql`);
        const backupFileGz = `${backupFile}.gz`;
        
        console.log('💾 Creazione backup...\n');
        
        // Comando pg_dump
        // Usa PGPASSWORD per evitare prompt password
        const pgDumpCmd = `PGPASSWORD='${dbConfig.password}' pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -F c -f ${backupFileGz}`;
        
        console.log('   Esecuzione pg_dump...');
        try {
            await execPromise(pgDumpCmd);
            console.log(`   ✅ Backup creato: ${backupFileGz}\n`);
        } catch (error) {
            // Se pg_dump non è disponibile, prova con formato SQL plain
            console.log('   ⚠️  pg_dump non disponibile, uso formato SQL plain...');
            const pgDumpSqlCmd = `PGPASSWORD='${dbConfig.password}' pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -F p -f ${backupFile}`;
            await execPromise(pgDumpSqlCmd);
            console.log(`   ✅ Backup creato: ${backupFile}\n`);
        }
        
        // Verifica dimensione file
        const backupFileFinal = fs.existsSync(backupFileGz) ? backupFileGz : backupFile;
        const stats = fs.statSync(backupFileFinal);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log('='.repeat(80));
        console.log('📊 RIEPILOGO BACKUP\n');
        console.log(`✅ Backup completato con successo!`);
        console.log(`📁 File: ${backupFileFinal}`);
        console.log(`📦 Dimensione: ${sizeMB} MB`);
        console.log(`🕐 Timestamp: ${timestamp}`);
        console.log(`\n💡 Per ripristinare il backup:`);
        console.log(`   pg_restore -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} ${backupFileFinal}`);
        console.log(`\n   Oppure (se formato SQL):`);
        console.log(`   psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} < ${backupFileFinal}`);
        
    } catch (error) {
        console.error('\n❌ Errore durante il backup:', error.message);
        console.error('\n💡 Soluzioni alternative:');
        console.log('   1. Esegui manualmente sul VPS:');
        console.log(`      pg_dump -h HOST -p PORT -U USER -d DATABASE > backup.sql`);
        console.log('   2. O usa pgAdmin per esportare il database');
        console.log('   3. O usa un tool GUI come DBeaver');
        process.exit(1);
    }
}

createBackup().catch(console.error);

