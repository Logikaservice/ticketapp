# Fix: Colonna deleted_at Mancante

## Problema
Errore: `column "deleted_at" does not exist` nella tabella `network_agents`.

## Causa
Le tabelle sono state create con una versione vecchia dello schema, prima che la colonna `deleted_at` fosse aggiunta.

## Soluzione

### Opzione 1: Usa Node.js (Consigliato)

```bash
cd /var/www/ticketapp/backend

node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
pool.query('ALTER TABLE network_agents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP').then(() => {
  console.log('✅ Colonna deleted_at aggiunta con successo!');
  process.exit(0);
}).catch(e => { 
  console.error('❌ Errore:', e.message); 
  process.exit(1); 
});
"
```

### Opzione 2: Usa SQL Diretto

```bash
cd /var/www/ticketapp/backend

# Usa psql (sostituisci con le tue credenziali)
psql $DATABASE_URL -c "ALTER TABLE network_agents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;"

# Oppure esegui lo script SQL
psql $DATABASE_URL -f backend/scripts/add-deleted-at-column.sql
```

### Opzione 3: Verifica e Aggiungi Manualmente

```bash
cd /var/www/ticketapp/backend

# Verifica colonne esistenti
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
pool.query(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'network_agents' ORDER BY column_name\").then(r => {
  console.log('Colonne network_agents:');
  r.rows.forEach(c => console.log('  -', c.column_name));
  const hasDeletedAt = r.rows.some(c => c.column_name === 'deleted_at');
  if (!hasDeletedAt) {
    console.log('\\n❌ Colonna deleted_at NON trovata - deve essere aggiunta');
  } else {
    console.log('\\n✅ Colonna deleted_at presente');
  }
  process.exit(0);
}).catch(e => { console.error('Errore:', e.message); process.exit(1); });
"
```

## Dopo il Fix: Verifica Agent

Dopo aver aggiunto la colonna, verifica gli agent:

```bash
cd /var/www/ticketapp/backend

node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
pool.query('SELECT id, agent_name, api_key, enabled, deleted_at FROM network_agents').then(r => {
  console.log('Agent nel database:');
  if (r.rows.length === 0) {
    console.log('  ❌ NESSUN AGENT TROVATO!');
    console.log('  Crea l\'agent dalla dashboard web: Monitoraggio Rete → Crea Agent');
  } else {
    r.rows.forEach(a => {
      console.log('  ID:', a.id);
      console.log('  Nome:', a.agent_name);
      console.log('  API Key:', a.api_key);
      console.log('  Abilitato:', a.enabled);
      console.log('  Eliminato:', a.deleted_at ? 'SÌ' : 'NO');
      console.log('  ---');
    });
  }
  process.exit(0);
}).catch(e => { 
  console.error('❌ Errore:', e.message); 
  process.exit(1); 
});
"
```
