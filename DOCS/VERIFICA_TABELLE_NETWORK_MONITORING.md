# Verifica e Creazione Tabelle Network Monitoring

## Problema
Le tabelle `network_agents`, `network_devices`, `network_changes` potrebbero non esistere nel database.

## Soluzione 1: Verifica File .env (Backend)

Il file `.env` si trova in `/var/www/ticketapp/backend`, non nella root:

```bash
# Sulla VPS
cd /var/www/ticketapp/backend
cat .env | grep DATABASE_URL
```

## Soluzione 2: Test Endpoint per Creare Tabelle Automaticamente

Il backend crea automaticamente le tabelle al primo accesso. Testa l'endpoint:

```bash
# Sulla VPS
# Test endpoint network monitoring (questo creerà le tabelle se non esistono)
curl -X GET http://localhost:3001/api/network-monitoring/agents \
  -H "Authorization: Bearer YOUR_TOKEN"

# Oppure testa un endpoint che non richiede autenticazione (se esiste)
# Altrimenti, testa dall'interfaccia web
```

## Soluzione 3: Usa Node.js per Verificare/Creare Tabelle

Crea uno script temporaneo:

```bash
# Sulla VPS
cd /var/www/ticketapp/backend

# Crea script di test
cat > test-network-tables.js << 'EOF'
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkTables() {
  try {
    // Verifica se le tabelle esistono
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'network_%'
      ORDER BY table_name;
    `);
    
    console.log('Tabelle network_* esistenti:');
    if (result.rows.length === 0) {
      console.log('  ❌ Nessuna tabella network_* trovata');
      console.log('  Le tabelle devono essere create!');
    } else {
      result.rows.forEach(row => {
        console.log(`  ✅ ${row.table_name}`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Errore:', err.message);
    process.exit(1);
  }
}

checkTables();
EOF

# Esegui lo script
node test-network-tables.js

# Rimuovi lo script dopo
rm test-network-tables.js
```

## Soluzione 4: Crea Tabelle Manualmente (Se Non Esistono)

Se le tabelle non esistono, puoi crearle eseguendo il codice SQL direttamente. 

### Opzione A: Usa lo Script SQL (se esiste)

```bash
cd /var/www/ticketapp
# Verifica se lo script esiste
ls -la backend/scripts/init-network-monitoring.sql

# Se esiste, esegui (sostituisci con le tue credenziali)
psql $DATABASE_URL -f backend/scripts/init-network-monitoring.sql
```

### Opzione B: Crea Manualmente con Node.js

```bash
cd /var/www/ticketapp/backend

# Crea script per inizializzare tabelle
cat > init-network-tables.js << 'EOF'
require('dotenv').config();
const { Pool } = require('pg');
const networkMonitoringRoutes = require('./routes/networkMonitoring');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Simula l'inizializzazione chiamando ensureTables
// (questo è un workaround, il modo migliore è chiamare l'endpoint)
console.log('⚠️  Questo script non può chiamare direttamente ensureTables.');
console.log('    Il modo migliore è testare un endpoint API che la chiama.');
console.log('');
console.log('    Esegui invece:');
console.log('    curl -X GET http://localhost:3001/api/network-monitoring/agents \\');
console.log('      -H "Authorization: Bearer YOUR_TOKEN"');
console.log('');
console.log('    Oppure accedi alla dashboard web e vai su "Monitoraggio Rete"');
console.log('    Questo triggererà la creazione automatica delle tabelle.');

process.exit(0);
EOF

node init-network-tables.js
rm init-network-tables.js
```

## Soluzione 5: Verifica dalla Dashboard Web

Il modo più semplice è accedere alla dashboard web:

1. Vai su `https://ticket.logikaservice.it`
2. Fai login come tecnico/admin
3. Vai su "Monitoraggio Rete"
4. Il backend creerà automaticamente le tabelle al primo accesso

## Soluzione 6: Riavvia Backend e Controlla Log

A volte basta riavviare il backend e controllare i log:

```bash
# Sulla VPS
cd /var/www/ticketapp/backend

# Riavvia backend
pm2 restart backend
# oppure
pm2 restart ticketapp-backend

# Attendi 5 secondi, poi controlla i log
sleep 5
pm2 logs backend --lines 50 | grep -i "network\|table"
```

## Verifica Finale

Dopo aver creato le tabelle, verifica:

```bash
# Con Node.js (metodo più semplice)
cd /var/www/ticketapp/backend
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
pool.query(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'network_%'\").then(r => {
  console.log('Tabelle:', r.rows.map(x => x.table_name).join(', ') || 'NESSUNA');
  process.exit(0);
}).catch(e => { console.error('Errore:', e.message); process.exit(1); });
"
```
