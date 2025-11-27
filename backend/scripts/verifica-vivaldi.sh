#!/bin/bash
# Script per verificare lo stato di Vivaldi

echo "🔍 Verifica stato Vivaldi"
echo "=========================="
echo ""

# 1. Verifica DATABASE_URL_VIVALDI nel .env
echo "1️⃣ Verifica DATABASE_URL_VIVALDI nel .env:"
cd /var/www/ticketapp/backend
if grep -q "DATABASE_URL_VIVALDI" .env; then
  echo "   ✅ DATABASE_URL_VIVALDI presente"
  grep "DATABASE_URL_VIVALDI" .env | sed 's/=.*/=***HIDDEN***/'
else
  echo "   ❌ DATABASE_URL_VIVALDI NON TROVATO"
fi
echo ""

# 2. Verifica tabelle nel database
echo "2️⃣ Verifica tabelle nel database vivaldi_db:"
if psql 'postgresql://postgres:TicketApp2025!Secure@localhost:5432/vivaldi_db' -c "\dt" 2>/dev/null | grep -q "annunci"; then
  echo "   ✅ Tabelle Vivaldi presenti"
  psql 'postgresql://postgres:TicketApp2025!Secure@localhost:5432/vivaldi_db' -c "\dt" 2>/dev/null | tail -n +4 | head -n -1
else
  echo "   ❌ Tabelle Vivaldi NON TROVATE"
  echo "   Esegui: node scripts/init-vivaldi-db.js"
fi
echo ""

# 3. Verifica log backend
echo "3️⃣ Verifica log backend (ultimi messaggi Vivaldi):"
pm2 logs ticketapp-backend --lines 100 --nostream 2>/dev/null | grep -i vivaldi | tail -5
echo ""

# 4. Verifica connessione database nel backend
echo "4️⃣ Verifica messaggi connessione database:"
pm2 logs ticketapp-backend --lines 200 --nostream 2>/dev/null | grep -E "(DATABASE_URL_VIVALDI|Connessione.*Vivaldi|Tabelle Vivaldi)" | tail -5
echo ""

echo "✅ Verifica completata"

