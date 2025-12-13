#!/bin/bash
# Script per verificare che il build frontend sia corretto

echo "🔍 Verifica Build Frontend"
echo "=========================="
echo ""

cd /var/www/ticketapp/frontend

# 1. Verifica che REACT_APP_API_URL sia vuota
echo "1️⃣ Verifica REACT_APP_API_URL..."
if env | grep -q "^REACT_APP_API_URL=$"; then
    echo "✅ REACT_APP_API_URL è vuota (corretto)"
else
    if env | grep -q "REACT_APP_API_URL"; then
        echo "⚠️  REACT_APP_API_URL ha un valore:"
        env | grep REACT_APP_API_URL
    else
        echo "✅ REACT_APP_API_URL non è impostata (corretto)"
    fi
fi
echo ""

# 2. Verifica che il build esista
echo "2️⃣ Verifica directory build..."
if [ -d "build" ]; then
    echo "✅ Directory build esiste"
    echo "   Data ultima modifica:"
    ls -lh build/static/js/main.*.js 2>/dev/null | head -1 || echo "   Nessun file main.*.js trovato"
else
    echo "❌ Directory build non trovata!"
    echo "   Esegui: npm run build"
    exit 1
fi
echo ""

# 3. Verifica riferimenti a Render.com nel build
echo "3️⃣ Verifica riferimenti a Render.com nel build..."
if grep -r "ticketapp.*onrender.com" build/ 2>/dev/null | head -5; then
    echo ""
    echo "❌ ERRORE: Trovati riferimenti a Render.com nel build!"
    echo "   Il build è vecchio o REACT_APP_API_URL è stata impostata durante il build"
    echo ""
    echo "🔧 Soluzione:"
    echo "   1. rm -rf build"
    echo "   2. unset REACT_APP_API_URL"
    echo "   3. export REACT_APP_API_URL=\"\""
    echo "   4. npm run build"
    exit 1
else
    echo "✅ Nessun riferimento a Render.com trovato nel build"
fi
echo ""

# 4. Verifica file hash nel build
echo "4️⃣ File bundle nel build:"
ls -lh build/static/js/main.*.js 2>/dev/null | head -3
echo ""

# 5. Verifica che nginx serva il build corretto
echo "5️⃣ Verifica configurazione nginx..."
NGINX_ROOT=$(grep -r "root.*frontend.*build" /etc/nginx/sites-available/ 2>/dev/null | head -1 | awk '{print $2}' | tr -d ';')
if [ -n "$NGINX_ROOT" ]; then
    echo "   Nginx root: $NGINX_ROOT"
    if [ "$NGINX_ROOT" = "/var/www/ticketapp/frontend/build" ] || [ "$NGINX_ROOT" = "$(pwd)/build" ]; then
        echo "✅ Nginx configurato correttamente"
    else
        echo "⚠️  Nginx root diverso: $NGINX_ROOT"
    fi
else
    echo "⚠️  Impossibile determinare nginx root"
fi
echo ""

# 6. Verifica che il bundle nel browser corrisponda
echo "6️⃣ Verifica bundle..."
BUNDLE_FILES=$(ls build/static/js/main.*.js 2>/dev/null | head -1)
if [ -n "$BUNDLE_FILES" ]; then
    BUNDLE_NAME=$(basename "$BUNDLE_FILES")
    echo "   Bundle attuale: $BUNDLE_NAME"
    echo "   Se nel browser vedi un bundle diverso (es. main.abc72181.js),"
    echo "   significa che stai caricando una versione vecchia dalla cache."
    echo ""
    echo "   Controlla nel browser (DevTools → Network → main.*.js):"
    echo "   - Il nome del file deve essere: $BUNDLE_NAME"
    echo "   - Se è diverso, pulisci la cache del browser (Ctrl+Shift+R)"
fi
echo ""

echo "✅ Verifica completata!"
echo ""
echo "📝 Prossimi passi se vedi ancora errori CORS:"
echo "   1. Pulisci cache del browser (Ctrl+Shift+Delete)"
echo "   2. Hard reload (Ctrl+Shift+R)"
echo "   3. Verifica che il bundle nel Network tab corrisponda a $BUNDLE_NAME"

