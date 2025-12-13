#!/bin/bash

# 🔄 REBUILD FRONTEND VPS - Script automatico
# Usa questo script sulla VPS per rebuildate il frontend dopo ogni git pull

set -e  # Exit on error

echo "🚀 Rebuild Frontend VPS"
echo "======================="

# Vai alla directory del progetto
cd /var/www/ticketapp/frontend

echo ""
echo "📍 Directory corrente: $(pwd)"

# 1. Verifica che il codice sorgente sia aggiornato
echo ""
echo "1️⃣ Verifica codice sorgente..."
if grep -q "system-health" src/components/CryptoDashboard/SystemHealthMonitor.jsx; then
    echo "   ✅ Sorgente aggiornato (contiene 'system-health')"
else
    echo "   ❌ Sorgente NON aggiornato!"
    echo "   Esegui prima: cd /var/www/ticketapp && git pull origin main"
    exit 1
fi

# 2. Pulisci build vecchia
echo ""
echo "2️⃣ Rimuovo build vecchia..."
if [ -d "build" ]; then
    rm -rf build/
    echo "   ✅ Build vecchia rimossa"
else
    echo "   ℹ️  Nessuna build da rimuovere"
fi

# 3. Pulisci cache
echo ""
echo "3️⃣ Pulisco cache..."
if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache/
    echo "   ✅ Cache pulita"
fi

# 4. Rebuild
echo ""
echo "4️⃣ Build frontend..."
echo "   (questo può richiedere 1-2 minuti...)"
npm run build

# 5. Verifica build
echo ""
echo "5️⃣ Verifica build..."
if grep -q "system-health" build/static/js/main.*.js 2>/dev/null; then
    echo "   ✅ Build contiene 'system-health' - OK!"
else
    echo "   ⚠️  Build potrebbe non contenere le ultime modifiche"
fi

# 6. Reload Nginx
echo ""
echo "6️⃣ Reload Nginx..."
sudo systemctl reload nginx
echo "   ✅ Nginx ricaricato"

echo ""
echo "✅ COMPLETATO!"
echo ""
echo "📌 Ora fai un HARD REFRESH nel browser:"
echo "   - Windows: Ctrl + Shift + R"
echo "   - Mac: Cmd + Shift + R"
echo ""
