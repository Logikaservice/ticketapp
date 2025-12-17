#!/bin/bash
# Script per aprire posizione SAND sulla VPS e configurare tutto

echo "🚀 Setup posizione SAND sulla VPS"
echo "=================================="
echo ""

# Vai nella directory backend
cd /var/www/ticketapp/backend || exit 1

# 1. Aggiorna codice
echo "📥 Aggiornamento codice..."
git pull origin main

# 2. Apri posizione SAND
echo ""
echo "📊 Apertura posizione SAND..."
node open_sand_position.js

# 3. Verifica posizione
echo ""
echo "🔍 Verifica posizione..."
node verify_sand_position.js

# 4. Scarica klines
echo ""
echo "📥 Scaricamento klines..."
node download_klines.js all

# 5. Riavvia backend
echo ""
echo "🔄 Riavvio backend..."
pm2 restart ticketapp-backend

echo ""
echo "✅ Setup completato!"
echo "Ora ricarica la pagina del dashboard (F5)"

