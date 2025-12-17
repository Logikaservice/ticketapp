/**
 * Test connessione alla VPS Hetzner
 * Verifica se PostgreSQL è raggiungibile dall'esterno
 */

const { Pool } = require('pg');
const net = require('net');

const VPS_IP = '159.69.121.162';
const VPS_PORT = 5432;

console.log('🔍 TEST CONNESSIONE VPS HETZNER\n');
console.log('='.repeat(80));
console.log(`IP VPS: ${VPS_IP}`);
console.log(`Porta PostgreSQL: ${VPS_PORT}\n`);

// Test 1: Verifica se la porta è aperta (TCP)
async function testTcpConnection() {
    console.log('📡 Test 1: Verifica porta TCP...');
    console.log('-'.repeat(80));

    return new Promise((resolve) => {
        const socket = new net.Socket();
        const timeout = 5000;

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            console.log('✅ Porta 5432 è APERTA e raggiungibile!');
            console.log('   └─ Il firewall permette connessioni sulla porta PostgreSQL');
            socket.destroy();
            resolve(true);
        });

        socket.on('timeout', () => {
            console.log('❌ TIMEOUT: La porta non risponde entro 5 secondi');
            console.log('   └─ Possibili cause:');
            console.log('      - Firewall Hetzner blocca la porta 5432');
            console.log('      - PostgreSQL non è in ascolto su 0.0.0.0');
            console.log('      - Firewall del server (ufw/iptables) blocca la porta');
            socket.destroy();
            resolve(false);
        });

        socket.on('error', (err) => {
            if (err.code === 'ECONNREFUSED') {
                console.log('❌ CONNESSIONE RIFIUTATA');
                console.log('   └─ La porta è raggiungibile ma nessun servizio è in ascolto');
                console.log('   └─ PostgreSQL potrebbe non essere avviato o ascolta solo su localhost');
            } else if (err.code === 'ETIMEDOUT') {
                console.log('❌ TIMEOUT: Impossibile raggiungere il server');
                console.log('   └─ Firewall blocca la connessione');
            } else if (err.code === 'EHOSTUNREACH') {
                console.log('❌ HOST NON RAGGIUNGIBILE');
                console.log('   └─ Verifica che l\'IP sia corretto: ' + VPS_IP);
            } else {
                console.log(`❌ ERRORE: ${err.code} - ${err.message}`);
            }
            resolve(false);
        });

        console.log(`   🔄 Tentativo connessione a ${VPS_IP}:${VPS_PORT}...`);
        socket.connect(VPS_PORT, VPS_IP);
    });
}

// Test 2: Prova connessione PostgreSQL (richiede credenziali)
async function testPostgresConnection() {
    console.log('\n📊 Test 2: Connessione PostgreSQL...');
    console.log('-'.repeat(80));
    console.log('⚠️  Questo test richiede le credenziali del database');
    console.log('   Se non le hai configurate, questo test fallirà (normale)');
    console.log('');

    // Prova con credenziali comuni (solo per test, non per produzione!)
    const commonCredentials = [
        { user: 'postgres', password: 'TicketApp2025!Secure', database: 'crypto_db' },
        { user: 'postgres', password: 'postgres', database: 'crypto_db' },
        { user: 'postgres', password: 'TicketApp2025!Secure', database: 'ticketapp' },
    ];

    for (const cred of commonCredentials) {
        try {
            console.log(`   🔄 Tentativo con user: ${cred.user}, database: ${cred.database}...`);

            const pool = new Pool({
                user: cred.user,
                password: cred.password,
                host: VPS_IP,
                port: VPS_PORT,
                database: cred.database,
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 5000
            });

            const client = await pool.connect();
            const result = await client.query('SELECT NOW() as current_time, version() as pg_version');

            console.log(`   ✅ CONNESSIONE RIUSCITA!`);
            console.log(`   └─ User: ${cred.user}`);
            console.log(`   └─ Database: ${cred.database}`);
            console.log(`   └─ Server time: ${result.rows[0].current_time}`);
            console.log(`   └─ PostgreSQL: ${result.rows[0].pg_version.split(',')[0]}`);

            // Verifica tabelle
            const tables = await client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name
            `);
            console.log(`   └─ Tabelle trovate: ${tables.rows.length}`);

            client.release();
            await pool.end();

            return { success: true, credentials: cred };
        } catch (error) {
            if (error.code === '28P01') {
                console.log(`   ❌ Autenticazione fallita (password errata)`);
            } else if (error.code === '3D000') {
                console.log(`   ❌ Database "${cred.database}" non esiste`);
            } else if (error.code === 'ECONNREFUSED') {
                console.log(`   ❌ Connessione rifiutata`);
            } else {
                console.log(`   ❌ Errore: ${error.code || error.message}`);
            }
        }
    }

    console.log('\n   ⚠️  Nessuna credenziale funzionante trovata');
    console.log('   └─ Dovrai fornire le credenziali corrette manualmente');
    return { success: false };
}

// Test 3: Verifica configurazione PostgreSQL remota
async function checkPostgresConfig() {
    console.log('\n⚙️  Test 3: Configurazione PostgreSQL...');
    console.log('-'.repeat(80));
    console.log('   Per permettere connessioni remote, PostgreSQL deve:');
    console.log('   1. Ascoltare su 0.0.0.0 (non solo localhost)');
    console.log('      File: /etc/postgresql/*/main/postgresql.conf');
    console.log('      Parametro: listen_addresses = \'*\'');
    console.log('');
    console.log('   2. Permettere connessioni da IP esterni');
    console.log('      File: /etc/postgresql/*/main/pg_hba.conf');
    console.log('      Riga: host all all 0.0.0.0/0 md5');
    console.log('');
    console.log('   ℹ️  Queste verifiche richiedono accesso SSH alla VPS');
}

async function runAllTests() {
    const tcpOpen = await testTcpConnection();

    if (tcpOpen) {
        const pgResult = await testPostgresConnection();

        if (pgResult.success) {
            console.log('\n' + '='.repeat(80));
            console.log('✅ SUCCESSO! La VPS è configurata correttamente!');
            console.log('='.repeat(80));
            console.log('\n📝 Credenziali funzionanti:');
            console.log(`   User: ${pgResult.credentials.user}`);
            console.log(`   Database: ${pgResult.credentials.database}`);
            console.log('\n💡 Prossimo passo:');
            console.log('   Aggiorna il file .env con queste credenziali:');
            console.log(`   DATABASE_URL=postgresql://${pgResult.credentials.user}:PASSWORD@${VPS_IP}:${VPS_PORT}/${pgResult.credentials.database}`);
        } else {
            console.log('\n' + '='.repeat(80));
            console.log('⚠️  PORTA APERTA ma autenticazione fallita');
            console.log('='.repeat(80));
            console.log('\n💡 Prossimi passi:');
            console.log('   1. Fornisci le credenziali corrette del database PostgreSQL sulla VPS');
            console.log('   2. Oppure accedi via SSH e crea un nuovo utente/database');
        }
    } else {
        await checkPostgresConfig();

        console.log('\n' + '='.repeat(80));
        console.log('❌ PORTA CHIUSA - Configurazione necessaria');
        console.log('='.repeat(80));
        console.log('\n💡 Prossimi passi:');
        console.log('   1. Accedi alla VPS via SSH');
        console.log('   2. Configura PostgreSQL per accettare connessioni remote');
        console.log('   3. Apri la porta 5432 nel firewall');
        console.log('\n📋 Comandi da eseguire sulla VPS:');
        console.log('   # Modifica postgresql.conf');
        console.log('   sudo nano /etc/postgresql/*/main/postgresql.conf');
        console.log('   # Cerca e modifica: listen_addresses = \'*\'');
        console.log('');
        console.log('   # Modifica pg_hba.conf');
        console.log('   sudo nano /etc/postgresql/*/main/pg_hba.conf');
        console.log('   # Aggiungi: host all all 0.0.0.0/0 md5');
        console.log('');
        console.log('   # Riavvia PostgreSQL');
        console.log('   sudo systemctl restart postgresql');
        console.log('');
        console.log('   # Apri porta nel firewall (se ufw è attivo)');
        console.log('   sudo ufw allow 5432/tcp');
        console.log('');
        console.log('   # Apri porta nel firewall Hetzner Cloud');
        console.log('   # Vai su: https://console.hetzner.cloud/');
        console.log('   # Firewall > Aggiungi regola > TCP > Porta 5432');
    }

    process.exit(0);
}

runAllTests().catch(err => {
    console.error('\n❌ ERRORE:', err.message);
    process.exit(1);
});
