# 🚨 RISOLVI PROBLEMI CRITICI

## Problemi Identificati

Dai log del server vedo **2 problemi critici**:

1. **`EADDRINUSE: address already in use :::3001`**
   - La porta 3001 è occupata, il backend non può partire
   - Soluzione: Liberare la porta e riavviare

2. **`relation "symbol_volumes_24h" does not exist`**
   - La tabella per i volumi 24h non esiste nel database
   - Soluzione: Creare la tabella manualmente

## Soluzione Rapida

### Esegui lo script sul VPS:

```bash
cd /var/www/ticketapp
chmod +x fix-porta-e-tabella.sh
./fix-porta-e-tabella.sh
```

Lo script:
1. ✅ Ferma PM2 backend
2. ✅ Libera la porta 3001 (kill processi)
3. ✅ Aggiorna codice da Git
4. ✅ Crea tabella `symbol_volumes_24h` se non esiste
5. ✅ Riavvia backend con PM2
6. ✅ Verifica che tutto funzioni

## Verifica Manuale (se lo script fallisce)

### 1. Libera porta 3001
```bash
sudo lsof -ti:3001 | xargs sudo kill -9
# oppure
sudo fuser -k 3001/tcp
```

### 2. Crea tabella manualmente
```bash
cd /var/www/ticketapp/backend
# Carica .env
export $(cat .env | grep -v '^#' | xargs)

# Estrai info database
DB_URL="$DATABASE_URL_CRYPTO"  # o DATABASE_URL se non configurato
DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' || echo "5432")
DB_PASS=$(echo "$DB_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

# Crea tabella
export PGPASSWORD="$DB_PASS"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
CREATE TABLE IF NOT EXISTS symbol_volumes_24h (
    symbol TEXT PRIMARY KEY,
    volume_24h DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_symbol_volumes_symbol ON symbol_volumes_24h(symbol);
EOF
unset PGPASSWORD
```

### 3. Riavvia backend
```bash
cd /var/www/ticketapp/backend
pm2 restart ticketapp-backend
# oppure
pm2 delete ticketapp-backend
pm2 start index.js --name ticketapp-backend --update-env
pm2 save
```

### 4. Verifica
```bash
pm2 status ticketapp-backend
curl http://localhost:3001/api/health
pm2 logs ticketapp-backend --lines 50
```

## Dopo il Fix

Dovresti vedere:
- ✅ Backend online (PM2 status: `online`)
- ✅ Health check: HTTP 200
- ✅ Nessun errore `symbol_volumes_24h does not exist`
- ✅ Nessun errore `EADDRINUSE`

## Se i Problemi Persistono

1. **Verifica log PM2:**
   ```bash
   pm2 logs ticketapp-backend --lines 100
   ```

2. **Verifica porta:**
   ```bash
   sudo lsof -i:3001
   ```

3. **Verifica tabella:**
   ```bash
   psql -h <HOST> -U <USER> -d <DB> -c "\d symbol_volumes_24h"
   ```

4. **Verifica database URL:**
   ```bash
   cd /var/www/ticketapp/backend
   cat .env | grep DATABASE_URL
   ```

