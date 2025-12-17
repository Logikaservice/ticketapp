// Script di backup database PostgreSQL/Supabase
// Utilizza pg_dump per creare un dump completo del database

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Leggi DATABASE_URL dalle variabili d'ambiente
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ ERRORE: DATABASE_URL non trovato nelle variabili d\'ambiente');
  console.error('Assicurati di avere DATABASE_URL impostato');
  process.exit(1);
}

// Parsing della connection string
// Formato: postgresql://username:password@host:port/database
const urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

if (!urlMatch) {
  console.error('❌ ERRORE: Formato DATABASE_URL non valido');
  console.error('Formato atteso: postgresql://username:password@host:port/database');
  process.exit(1);
}

const [, username, password, host, port, database] = urlMatch;

// Crea la directory per i backup se non esiste
const backupDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Nome del file di backup con timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                  new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
const backupFileName = `backup_${database}_${timestamp}.sql`;
const backupFilePath = path.join(backupDir, backupFileName);

// Comando pg_dump
// Nota: pg_dump deve essere installato sul sistema
const dumpCommand = `pg_dump -h ${host} -p ${port} -U ${username} -d ${database} -F p -f "${backupFilePath}"`;

// Imposta la password come variabile d'ambiente per pg_dump
process.env.PGPASSWORD = password;

console.log('🔄 Inizio backup database...');
console.log(`📁 Host: ${host}`);
console.log(`📊 Database: ${database}`);
console.log(`💾 File di backup: ${backupFilePath}`);
console.log('');

exec(dumpCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ ERRORE durante il backup:');
    console.error(error.message);
    
    // Verifica se pg_dump è installato
    if (error.message.includes('pg_dump') || error.message.includes('not found')) {
      console.error('\n⚠️  pg_dump non trovato sul sistema.');
      console.error('Per installare pg_dump:');
      console.error('  - Windows: Installa PostgreSQL da https://www.postgresql.org/download/windows/');
      console.error('  - Mac: brew install postgresql');
      console.error('  - Linux: sudo apt-get install postgresql-client');
      console.error('\n💡 Alternativa: Usa la dashboard di Supabase per fare il backup:');
      console.error('   1. Vai su https://supabase.com/dashboard');
      console.error('   2. Seleziona il tuo progetto');
      console.error('   3. Vai su Database > Backups');
      console.error('   4. Crea un nuovo backup o scarica un backup esistente');
    }
    
    process.exit(1);
  }

  if (stderr && !stderr.includes('WARNING')) {
    console.error('⚠️  Avvisi durante il backup:');
    console.error(stderr);
  }

  // Verifica che il file sia stato creato
  if (fs.existsSync(backupFilePath)) {
    const stats = fs.statSync(backupFilePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('✅ Backup completato con successo!');
    console.log(`📁 File: ${backupFilePath}`);
    console.log(`📊 Dimensione: ${fileSizeMB} MB`);
    console.log('');
    console.log('💡 Per ripristinare il backup:');
    console.log(`   psql -h ${host} -p ${port} -U ${username} -d ${database} < "${backupFilePath}"`);
    console.log('');
    console.log('💡 Per creare un backup compresso, usa:');
    console.log(`   pg_dump -h ${host} -p ${port} -U ${username} -d ${database} -F c -f "${backupFilePath.replace('.sql', '.backup')}"`);
  } else {
    console.error('❌ ERRORE: File di backup non creato');
    process.exit(1);
  }
  
  // Rimuovi la password dalla memoria
  delete process.env.PGPASSWORD;
});

