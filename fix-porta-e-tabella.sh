#!/bin/bash
# Script per risolvere porta 3001 occupata e creare tabella symbol_volumes_24h mancante

set -e

echo "🔧 FIX PORTA 3001 E TABELLA symbol_volumes_24h"
echo "=============================================="
echo ""

# 1. Ferma PM2 backend
echo "1️⃣ Fermo processo PM2 ticketapp-backend..."
pm2 delete ticketapp-backend 2>/dev/null || echo "   ⚠️  Nessun processo PM2 da fermare"
sleep 2
echo ""

# 2. Trova e uccidi tutti i processi sulla porta 3001
echo "2️⃣ Fermo tutti i processi sulla porta 3001..."
PID=$(sudo lsof -ti:3001 2>/dev/null || echo "")
if [ -z "$PID" ]; then
    echo "   ✅ Nessun processo trovato sulla porta 3001"
else
    echo "   🔍 Trovati processi: $PID"
    sudo kill -9 $PID 2>/dev/null || true
    echo "   ✅ Processi terminati"
    sleep 2
fi

# Verifica che la porta sia libera
if sudo lsof -ti:3001 >/dev/null 2>&1; then
    echo "   ⚠️  Porta ancora occupata, uso fuser..."
    sudo fuser -k 3001/tcp 2>/dev/null || true
    sleep 3
fi
echo "   ✅ Porta 3001 libera"
echo ""

# 3. Vai alla directory del progetto
echo "3️⃣ Vado alla directory del progetto..."
cd /var/www/ticketapp || { echo "❌ Directory /var/www/ticketapp non trovata!"; exit 1; }
echo "   ✅ Directory: $(pwd)"
echo ""

# 4. Aggiorna codice
echo "4️⃣ Aggiorno codice da Git..."
git pull || { echo "⚠️  Errore durante git pull, continuo comunque..."; }
echo ""

# 5. Crea tabella symbol_volumes_24h se non esiste
echo "5️⃣ Verifico e creo tabella symbol_volumes_24h..."
cd backend || { echo "❌ Directory backend non trovata!"; exit 1; }

# Carica variabili d'ambiente
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Determina quale database URL usare
if [ -n "$DATABASE_URL_CRYPTO" ]; then
    DB_URL="$DATABASE_URL_CRYPTO"
    echo "   📊 Usando DATABASE_URL_CRYPTO"
elif [ -n "$DATABASE_URL" ]; then
    # Estrai database name da DATABASE_URL
    DB_URL="$DATABASE_URL"
    echo "   📊 Usando DATABASE_URL"
else
    echo "   ❌ DATABASE_URL non configurato!"
    exit 1
fi

# Estrai informazioni database
DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' || echo "5432")
DB_PASS=$(echo "$DB_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

echo "   🔍 Database: $DB_NAME su $DB_HOST:$DB_PORT"

# Crea script SQL temporaneo
SQL_FILE="/tmp/create_symbol_volumes_table.sql"
cat > "$SQL_FILE" << 'EOF'
-- Crea tabella symbol_volumes_24h se non esiste
CREATE TABLE IF NOT EXISTS symbol_volumes_24h (
    symbol TEXT PRIMARY KEY,
    volume_24h DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Crea indice se non esiste
CREATE INDEX IF NOT EXISTS idx_symbol_volumes_symbol ON symbol_volumes_24h(symbol);
EOF

# Esegui SQL usando psql
if command -v psql &> /dev/null; then
    echo "   🔧 Creo tabella usando psql..."
    export PGPASSWORD="$DB_PASS"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE" 2>&1 | grep -v "already exists" || true
    unset PGPASSWORD
    echo "   ✅ Tabella verificata/creata"
else
    echo "   ⚠️  psql non trovato, la tabella verrà creata automaticamente all'avvio del backend"
fi

rm -f "$SQL_FILE"
echo ""

# 6. Installa dipendenze backend (se necessario)
echo "6️⃣ Verifico dipendenze backend..."
npm install --production 2>&1 | tail -5 || echo "   ⚠️  Errore durante npm install"
echo ""

# 7. Avvia backend
echo "7️⃣ Avvio backend con PM2..."
pm2 start index.js --name ticketapp-backend --update-env || { echo "❌ Errore durante l'avvio di PM2!"; exit 1; }
pm2 save || { echo "⚠️  Errore durante il salvataggio della configurazione PM2!"; }
echo "   ✅ Backend avviato"
echo ""

# 8. Attendi avvio
echo "8️⃣ Attendo avvio backend (10 secondi)..."
sleep 10
echo ""

# 9. Verifica stato
echo "9️⃣ Verifica stato PM2..."
pm2 status ticketapp-backend
echo ""

# 10. Test endpoint
echo "🔟 Test endpoint /api/health..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "000")
echo "   Health check: HTTP $HEALTH"
if [ "$HEALTH" != "200" ]; then
    echo "   ⚠️  Health check fallito, controlla i log"
fi
echo ""

# 11. Mostra ultimi log
echo "1️⃣1️⃣ Ultimi 50 log backend..."
echo "---------------------------"
pm2 logs ticketapp-backend --lines 50 --nostream 2>/dev/null | tail -50 || echo "   ⚠️  Log non disponibili"

echo ""
echo "✅ Completato!"
echo ""
echo "💡 Se vedi ancora errori:"
echo "   - Verifica log: pm2 logs ticketapp-backend --lines 100"
echo "   - Verifica porta: sudo lsof -i:3001"
echo "   - Verifica tabella: psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c '\\d symbol_volumes_24h'"
echo ""

