#!/bin/bash

# Script per ricostruire frontend sul server VPS
# Rimuove vecchio build e ricostruisce con REACT_APP_API_URL vuoto

set -e

echo "🔨 Rebuild Frontend sul Server VPS"
echo "===================================="
echo ""

cd /var/www/ticketapp/frontend || exit 1

# 1. Rimuovi vecchio build
echo "🗑️  1. Rimozione vecchio build..."
if [ -d build ]; then
    rm -rf build
    echo "   ✅ Build vecchio rimosso"
else
    echo "   ℹ️  Build non esiste (OK)"
fi

# 2. Rimuovi cache npm/node_modules
echo ""
echo "🧹 2. Pulizia cache..."
if [ -d node_modules/.cache ]; then
    rm -rf node_modules/.cache
    echo "   ✅ Cache npm rimossa"
fi

# 3. Rimuovi .env.production se esiste
if [ -f .env.production ]; then
    echo "   ⚠️  Rimozione .env.production (potrebbe contenere Render.com)..."
    rm -f .env.production
    echo "   ✅ .env.production rimosso"
fi

# 4. Crea .env corretto
echo ""
echo "📝 3. Configurazione .env..."
cat > .env <<EOF
REACT_APP_API_URL=
GENERATE_SOURCEMAP=false
EOF
echo "   ✅ .env configurato (REACT_APP_API_URL vuoto)"

# 5. Verifica che non ci siano altre variabili d'ambiente
unset REACT_APP_API_URL
export REACT_APP_API_URL=""

# 6. Rebuild
echo ""
echo "🔨 4. Build frontend..."
echo "   Questo potrebbe richiedere alcuni minuti..."
npm run build

# 7. Verifica che non contenga Render.com
echo ""
echo "🔍 5. Verifica build..."
if grep -r "ticketapp.*onrender.com" build/ 2>/dev/null; then
    echo "   ❌ ERRORE: Build contiene ancora Render.com!"
    echo "   Verifica che .env sia corretto"
    exit 1
else
    echo "   ✅ Build corretto (nessun riferimento a Render.com)"
fi

# 8. Verifica hash file JS
echo ""
echo "📦 6. Informazioni build:"
JS_FILE=$(find build/static/js -name "main.*.js" | head -1)
if [ -n "$JS_FILE" ]; then
    echo "   File JS: $(basename $JS_FILE)"
    echo "   Dimensione: $(du -h $JS_FILE | cut -f1)"
    echo "   Data: $(stat -c %y $JS_FILE | cut -d' ' -f1,2 | cut -d'.' -f1)"
fi

# 9. Verifica che Nginx punti al build
echo ""
echo "🌐 7. Verifica configurazione Nginx..."
if [ -d /etc/nginx/sites-available ]; then
    if grep -q "/var/www/ticketapp/frontend/build" /etc/nginx/sites-available/* 2>/dev/null; then
        echo "   ✅ Nginx configurato correttamente"
    else
        echo "   ⚠️  Nginx potrebbe non puntare al build corretto"
    fi
fi

echo ""
echo "✅ Rebuild completato!"
echo ""
echo "📌 PROSSIMI PASSI:"
echo "   1. Ricarica Nginx: sudo systemctl reload nginx"
echo "   2. Pulisci cache browser (Ctrl+Shift+Delete)"
echo "   3. Hard reload pagina (Ctrl+Shift+R o F5 con DevTools aperto)"
echo ""
echo "💡 Per verificare che funzioni:"
echo "   - Apri Console (F12)"
echo "   - Verifica che NON ci siano errori verso ticketapp-4eqb.onrender.com"
echo "   - Le chiamate API devono essere a /api/... (relative) o ticket.logikaservice.it/api/..."
echo ""

