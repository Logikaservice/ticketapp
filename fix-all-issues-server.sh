#!/bin/bash

# Script completo per fixare tutti i problemi sul server

set -e

echo "🔧 Fix Completo Server VPS"
echo "==========================="
echo ""

cd /var/www/ticketapp || exit 1

# 1. Fix permessi script
echo "1️⃣  Fix permessi script..."
chmod +x rebuild-frontend-server.sh
chmod +x verifica-build-server.sh
chmod +x fix-config-vps.sh
chmod +x debug-backend-crash.sh
chmod +x verifica-backend-status.sh
echo "   ✅ Permessi script corretti"

# 2. Verifica e correggi .env frontend
echo ""
echo "2️⃣  Verifica/correzione .env frontend..."
cd frontend

# Rimuovi .env.production se esiste
if [ -f .env.production ]; then
    if grep -q "ticketapp.*onrender.com\|REACT_APP_API_URL=.*http" .env.production 2>/dev/null; then
        echo "   ⚠️  .env.production contiene URL esterni - RIMOSSO"
        rm -f .env.production
    fi
fi

# Crea/corregge .env
cat > .env <<EOF
REACT_APP_API_URL=
GENERATE_SOURCEMAP=false
EOF
echo "   ✅ .env configurato (REACT_APP_API_URL vuoto)"

# Verifica che sia vuoto
if grep -q "REACT_APP_API_URL=.*http" .env 2>/dev/null; then
    echo "   ❌ ERRORE: .env contiene ancora URL!"
    exit 1
fi

# 3. Rimuovi build vecchio
echo ""
echo "3️⃣  Rimozione build vecchio..."
cd ..
cd frontend
rm -rf build 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true
echo "   ✅ Build vecchio rimosso"

# 4. Rebuild frontend con variabili d'ambiente corrette
echo ""
echo "4️⃣  Rebuild frontend..."
echo "   Questo richiederà alcuni minuti..."
unset REACT_APP_API_URL
export REACT_APP_API_URL=""
npm run build

# 5. Verifica build
echo ""
echo "5️⃣  Verifica build..."
JS_FILE=$(find build/static/js -name "main.*.js" | head -1)
if [ -z "$JS_FILE" ]; then
    echo "   ❌ ERRORE: Nessun file JS trovato nel build!"
    exit 1
fi

if grep -q "ticketapp.*onrender.com" "$JS_FILE" 2>/dev/null; then
    echo "   ❌ ERRORE: Build contiene ancora Render.com!"
    echo "   File: $(basename $JS_FILE)"
    echo "   Riferimenti trovati:"
    grep -o "ticketapp[^\"' ]*onrender[^\"' ]*" "$JS_FILE" | head -3
    exit 1
else
    echo "   ✅ Build corretto (nessun Render.com)"
    echo "   File: $(basename $JS_FILE)"
fi

# 6. Verifica/correggi configurazione Nginx
echo ""
echo "6️⃣  Verifica configurazione Nginx..."
NGINX_CONFIG="/etc/nginx/sites-available/default"
if [ ! -f "$NGINX_CONFIG" ]; then
    NGINX_CONFIG="/etc/nginx/sites-available/ticketapp"
fi

if [ -f "$NGINX_CONFIG" ]; then
    echo "   Config file: $NGINX_CONFIG"
    
    # Verifica root directory
    CURRENT_ROOT=$(grep -E "^[[:space:]]*root[[:space:]]" "$NGINX_CONFIG" | head -1 | awk '{print $2}' | tr -d ';' || echo "")
    
    EXPECTED_ROOT="/var/www/ticketapp/frontend/build"
    
    if [ "$CURRENT_ROOT" != "$EXPECTED_ROOT" ]; then
        echo "   ⚠️  Root directory errata:"
        echo "      Attuale: $CURRENT_ROOT"
        echo "      Atteso:  $EXPECTED_ROOT"
        echo ""
        echo "   📝 Devi correggere manualmente la configurazione Nginx"
        echo "   Modifica $NGINX_CONFIG e cambia:"
        echo "      root $CURRENT_ROOT;"
        echo "   in:"
        echo "      root $EXPECTED_ROOT;"
        echo ""
        echo "   Poi esegui: sudo nginx -t && sudo systemctl reload nginx"
    else
        echo "   ✅ Root directory corretta: $CURRENT_ROOT"
    fi
else
    echo "   ⚠️  File configurazione Nginx non trovato"
fi

# 7. Test Nginx
echo ""
echo "7️⃣  Test configurazione Nginx..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Configurazione Nginx valida"
else
    echo "   ❌ ERRORE nella configurazione Nginx:"
    sudo nginx -t
    exit 1
fi

echo ""
echo "✅ Fix completato!"
echo ""
echo "📌 PROSSIMI PASSI:"
echo "   1. Se la root directory Nginx era errata, correggila manualmente"
echo "   2. Ricarica Nginx: sudo systemctl reload nginx"
echo "   3. Verifica build: ./verifica-build-server.sh"
echo "   4. Pulisci cache browser (Ctrl+Shift+Delete)"
echo "   5. Disabilita Service Worker (vedi FIX_SERVICE_WORKER.md)"
echo ""

