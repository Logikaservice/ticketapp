// Script per aggiornare .env con credenziali VPS
const fs = require('fs');
const path = require('path');

const VPS_IP = '159.69.121.162';
const DB_USER = 'postgres';
const DB_PASSWORD = 'TicketApp2025!Secure';
const DB_PORT = '5432';

const envPath = path.join(__dirname, '..', '.env');

console.log('🔧 Aggiornamento .env per database VPS');
console.log('======================================\n');

// Costruisci i nuovi URL
const newUrls = {
    'DATABASE_URL': `postgresql://${DB_USER}:${DB_PASSWORD}@${VPS_IP}:${DB_PORT}/ticketapp`,
    'DATABASE_URL_CRYPTO': `postgresql://${DB_USER}:${DB_PASSWORD}@${VPS_IP}:${DB_PORT}/crypto_db`,
    'DATABASE_URL_VIVALDI': `postgresql://${DB_USER}:${DB_PASSWORD}@${VPS_IP}:${DB_PORT}/vivaldi_db`
};

console.log('📝 Nuove configurazioni:');
console.log(`   DATABASE_URL -> ${VPS_IP}/ticketapp`);
console.log(`   DATABASE_URL_CRYPTO -> ${VPS_IP}/crypto_db`);
console.log(`   DATABASE_URL_VIVALDI -> ${VPS_IP}/vivaldi_db\n`);

// Leggi .env esistente
let envContent = '';
if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    console.log('✅ File .env esistente trovato\n');
} else {
    console.log('⚠️  File .env non trovato, ne creo uno nuovo\n');
}

// Aggiorna o aggiungi le variabili
let lines = envContent.split('\n');
let updated = false;

for (const [key, value] of Object.entries(newUrls)) {
    let found = false;
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(`${key}=`)) {
            lines[i] = `${key}=${value}`;
            found = true;
            updated = true;
            console.log(`✏️  Aggiornato: ${key}`);
            break;
        }
    }
    
    if (!found) {
        lines.push(`${key}=${value}`);
        updated = true;
        console.log(`➕ Aggiunto: ${key}`);
    }
}

// Salva il file
if (updated) {
    fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
    console.log('\n✅ File .env aggiornato con successo!');
    console.log(`📁 Percorso: ${envPath}\n`);
    console.log('🔄 Riavvia il backend per applicare le modifiche');
} else {
    console.log('\nℹ️  Nessuna modifica necessaria');
}
