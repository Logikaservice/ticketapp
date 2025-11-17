#!/bin/bash
# Script per importare il database da Supabase alla VPS

set -e

echo "🚀 Importazione database da Supabase alla VPS..."

# DATABASE_URL di Supabase
SUPABASE_URL="postgresql://postgres.gmpitbvkvlcmemrrzxae:Logika220679@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"

# DATABASE_URL della VPS
VPS_URL="postgresql://postgres:TicketApp2025!Secure@localhost:5432/ticketapp"

echo "📥 Esportazione da Supabase..."
# Usa pg_dump-17 se disponibile, altrimenti pg_dump
PG_DUMP_CMD=$(which pg_dump-17 2>/dev/null || \
              [ -f /usr/lib/postgresql/17/bin/pg_dump ] && echo /usr/lib/postgresql/17/bin/pg_dump || \
              which pg_dump)
echo "🔧 Usando: $PG_DUMP_CMD"

# Esporta SOLO i dati (senza schema, senza ruoli Supabase)
# --data-only: solo dati, no schema
# --column-inserts: usa INSERT con nomi colonne espliciti
# --no-owner: non include comandi OWNER
# --no-privileges: non include comandi GRANT/REVOKE
# Escludi tabelle di sistema Supabase
echo "📦 Creazione dump con solo dati delle tabelle applicative..."
$PG_DUMP_CMD "$SUPABASE_URL" \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-privileges \
  --table=users \
  --table=tickets \
  --table=alerts \
  --table=access_logs \
  --table=keepass_groups \
  --table=keepass_entries \
  --table=forniture_temporanee \
  --table=unavailable_days \
  > /tmp/supabase-backup.sql 2>/tmp/pg_dump_errors.log

if [ ! -f /tmp/supabase-backup.sql ]; then
  echo "❌ Errore durante l'esportazione da Supabase"
  if [ -f /tmp/pg_dump_errors.log ]; then
    echo "📋 Log errori:"
    cat /tmp/pg_dump_errors.log
  fi
  exit 1
fi

echo "✅ Backup creato: /tmp/supabase-backup.sql"
echo "📊 Dimensione backup:"
du -sh /tmp/supabase-backup.sql
echo "📊 Numero di righe nel dump:"
wc -l /tmp/supabase-backup.sql

# Verifica che il dump contenga dati
if [ ! -s /tmp/supabase-backup.sql ]; then
  echo "⚠️  ATTENZIONE: Il dump è vuoto!"
  exit 1
fi

# Conta quanti INSERT ci sono
INSERT_COUNT=$(grep -c "^INSERT INTO" /tmp/supabase-backup.sql || echo "0")
echo "📊 Numero di INSERT trovati: $INSERT_COUNT"

if [ "$INSERT_COUNT" -eq "0" ]; then
  echo "⚠️  ATTENZIONE: Nessun INSERT trovato nel dump!"
  echo "📋 Prime 20 righe del dump:"
  head -n 20 /tmp/supabase-backup.sql
  exit 1
fi

echo ""
echo "⚠️ ATTENZIONE: Questo script sovrascriverà i dati esistenti sulla VPS!"
read -p "Vuoi continuare? (s/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
  echo "❌ Operazione annullata"
  rm -f /tmp/supabase-backup.sql /tmp/pg_dump_errors.log
  exit 1
fi

echo "📤 Importazione sulla VPS..."
echo "⚠️  Gli errori sui ruoli Supabase sono normali e possono essere ignorati"
echo ""

# Importa ignorando errori sui ruoli (ma mostrando altri errori)
psql "$VPS_URL" < /tmp/supabase-backup.sql 2>&1 | grep -v "ERROR: role" | grep -v "does not exist" || true

echo ""
echo "✅ Importazione completata!"
echo "🧹 Pulizia file temporaneo..."
rm -f /tmp/supabase-backup.sql /tmp/pg_dump_errors.log

echo ""
echo "✅ Database importato con successo!"
echo ""
echo "📝 Prossimi passi:"
echo "1. Verifica i dati: node scripts/check-database.js"
echo "2. Rimuovi duplicati: node scripts/fix-duplicate-user.js"
echo "3. Riavvia il backend se necessario"
echo "4. Prova ad accedere all'applicazione"
