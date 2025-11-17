#!/bin/bash
# Script per importare il database da Supabase alla VPS

set -e

echo "🚀 Importazione database da Supabase alla VPS..."

# DATABASE_URL di Supabase
SUPABASE_URL="postgresql://postgres.gmpitbvkvlcmemrrzxae:Logika220679@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"

# DATABASE_URL della VPS
VPS_URL="postgresql://postgres:TicketApp2025!Secure@localhost:5432/ticketapp"

echo "📥 Esportazione da Supabase..."
pg_dump "$SUPABASE_URL" > /tmp/supabase-backup.sql

if [ ! -f /tmp/supabase-backup.sql ]; then
  echo "❌ Errore durante l'esportazione da Supabase"
  exit 1
fi

echo "✅ Backup creato: /tmp/supabase-backup.sql"
echo "📊 Dimensione backup:"
du -sh /tmp/supabase-backup.sql

echo ""
echo "⚠️ ATTENZIONE: Questo script sovrascriverà i dati esistenti sulla VPS!"
read -p "Vuoi continuare? (s/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
  echo "❌ Operazione annullata"
  rm -f /tmp/supabase-backup.sql
  exit 1
fi

echo "📤 Importazione sulla VPS..."
psql "$VPS_URL" < /tmp/supabase-backup.sql

echo "✅ Importazione completata!"
echo "🧹 Pulizia file temporaneo..."
rm /tmp/supabase-backup.sql

echo ""
echo "✅ Database importato con successo!"
echo ""
echo "📝 Prossimi passi:"
echo "1. Verifica i dati: node scripts/check-database.js"
echo "2. Riavvia il backend se necessario"
echo "3. Prova ad accedere all'applicazione"
