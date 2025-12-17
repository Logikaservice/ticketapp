// Script per configurare .env con tunnel SSH
const fs = require('fs');
const path = require('path');

const LOCAL_PORT = '5433'; // Porta locale del tunnel SSH
const DB_USER = 'postgres';
const DB_PASSWORD = 'TicketApp2025!Secure';

const envPath = path.join(__dirname, '..', '.env');

console.log('🔧 Configurazione .env per tunnel SSH');
console.log('=====================================\n');

// Costruisci i nuovi URL (localhost con porta tunnel)
const newUrls = {
    'DATABASE_URL': `postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${LOCAL_PORT}/ticketapp`,
    'DATABASE_URL_CRYPTO': `postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${LOCAL_PORT}/crypto_db`,
    'DATABASE_URL_VIVALDI': `postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${LOCAL_PORT}/vivaldi_db`
};

console.log('📝 Configurazioni tunnel SSH:');
console.log(`   DATABASE_URL -> localhost:${LOCAL_PORT}/ticketapp`);
console.log(`   DATABASE_URL_CRYPTO -> localhost:${LOCAL_PORT}/crypto_db`);
console.log(`   DATABASE_URL_VIVALDI -> localhost:${LOCAL_PORT}/vivaldi_db\n`);

// Leggi .env esistente
let envContent = '';
if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
} else {
    console.log('❌ File .env non trovato\n');
    process.exit(1);
}

// Aggiorna le variabili
let lines = envContent.split('\n');

for (const [key, value] of Object.entries(newUrls)) {
    let found = false;
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(`${key}=`)) {
            lines[i] = `${key}=${value}`;
            found = true;
            console.log(`✏️  Aggiornato: ${key}`);
            break;
        }
    }
    
    if (!found) {
        lines.push(`${key}=${value}`);
        console.log(`➕ Aggiunto: ${key}`);
    }
}

// Salva il file
fs.writeFileSync(envPath, lines.join('\n'), 'utf8');

console.log('\n✅ File .env configurato per tunnel SSH!');
console.log('\n📋 Prossimi passi:');
console.log('   1. Avvia il tunnel: .\\scripts\\create-ssh-tunnel.ps1');
console.log('   2. Lascia il tunnel aperto');
console.log('   3. Riavvia il backend in un altro terminale');
console.log('   4. Il backend userà il database VPS tramite tunnel sicuro\n');
