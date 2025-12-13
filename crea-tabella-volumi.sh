#!/bin/bash
# Script per creare la tabella symbol_volumes_24h se non esiste

set -e

echo "🔧 CREA TABELLA symbol_volumes_24h"
echo "=================================="
echo ""

cd /var/www/ticketapp/backend || { echo "❌ Directory backend non trovata!"; exit 1; }

# Carica variabili d'ambiente
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Determina quale database URL usare
if [ -n "$DATABASE_URL_CRYPTO" ]; then
    DB_URL="$DATABASE_URL_CRYPTO"
    echo "📊 Usando DATABASE_URL_CRYPTO"
elif [ -n "$DATABASE_URL" ]; then
    DB_URL="$DATABASE_URL"
    echo "📊 Usando DATABASE_URL"
else
    echo "❌ DATABASE_URL non configurato!"
    exit 1
fi

# Estrai informazioni database
DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' || echo "5432")
DB_PASS=$(echo "$DB_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

echo "🔍 Database: $DB_NAME su $DB_HOST:$DB_PORT"
echo ""

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

-- Verifica che la tabella esista
SELECT 'Tabella symbol_volumes_24h creata/verificata con successo!' as status;
EOF

# Esegui SQL usando psql
if command -v psql &> /dev/null; then
    echo "🔧 Creo tabella usando psql..."
    export PGPASSWORD="$DB_PASS"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE" 2>&1
    unset PGPASSWORD
    echo ""
    echo "✅ Tabella creata/verificata!"
else
    echo "❌ psql non trovato. Installa PostgreSQL client."
    exit 1
fi

rm -f "$SQL_FILE"

echo ""
echo "✅ Completato!"
echo ""
echo "💡 Verifica manuale:"
echo "   psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c '\\d symbol_volumes_24h'"
echo ""

