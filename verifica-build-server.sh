#!/bin/bash

# Script per verificare quale build è servito dal server

echo "🔍 Verifica Build sul Server"
echo "============================"
echo ""

cd /var/www/ticketapp/frontend || exit 1

# 1. Verifica file JS nel build
echo "📦 1. File JavaScript nel build:"
echo "--------------------------------"
if [ -d build/static/js ]; then
    JS_FILES=$(find build/static/js -name "main.*.js" -type f)
    if [ -n "$JS_FILES" ]; then
        for file in $JS_FILES; do
            filename=$(basename "$file")
            size=$(du -h "$file" | cut -f1)
            date=$(stat -c "%y" "$file" | cut -d'.' -f1)
            echo "   📄 $filename"
            echo "      Dimensione: $size"
            echo "      Data: $date"
            
            # Verifica se contiene Render.com
            if grep -q "ticketapp.*onrender.com" "$file" 2>/dev/null; then
                echo "      ❌ CONTIENE Render.com!"
                echo "      Primi riferimenti trovati:"
                grep -o "ticketapp[^\"' ]*onrender[^\"' ]*" "$file" | head -3
            else
                echo "      ✅ NON contiene Render.com"
            fi
            echo ""
        done
    else
        echo "   ❌ Nessun file main.*.js trovato in build/static/js/"
    fi
else
    echo "   ❌ Directory build/static/js/ non esiste!"
fi

# 2. Verifica quale file viene servito da Nginx
echo "🌐 2. Test chiamata al server:"
echo "-------------------------------"
# Prova a ottenere il file index.html e vedere quale JS viene referenziato
if curl -s http://localhost/static/js/main.abc72181.js > /dev/null 2>&1; then
    echo "   ⚠️  Il vecchio file main.abc72181.js è ancora accessibile!"
    echo "   Questo significa che Nginx sta servendo file vecchi"
fi

if curl -s http://localhost/index.html 2>/dev/null | grep -q "main\.[a-f0-9]*\.js"; then
    REFERENCED_JS=$(curl -s http://localhost/index.html 2>/dev/null | grep -o "main\.[a-f0-9]*\.js" | head -1)
    echo "   📄 index.html referenzia: $REFERENCED_JS"
    
    # Verifica se questo file esiste nel build
    if [ -f "build/static/js/$REFERENCED_JS" ]; then
        echo "   ✅ File presente nel build attuale"
        
        # Verifica se contiene Render.com
        if grep -q "ticketapp.*onrender.com" "build/static/js/$REFERENCED_JS" 2>/dev/null; then
            echo "   ❌ CONTIENE Render.com!"
        else
            echo "   ✅ NON contiene Render.com"
        fi
    else
        echo "   ❌ File NON presente nel build attuale!"
        echo "   → Il server sta servendo un build VECCHIO"
    fi
else
    echo "   ⚠️  Impossibile ottenere index.html da localhost"
fi

# 3. Verifica timestamp build
echo ""
echo "📅 3. Timestamp build:"
echo "---------------------"
if [ -d build ]; then
    BUILD_DATE=$(stat -c "%y" build | cut -d'.' -f1)
    echo "   Data build: $BUILD_DATE"
    
    # Calcola età del build
    BUILD_EPOCH=$(stat -c "%Y" build)
    NOW_EPOCH=$(date +%s)
    AGE_SECONDS=$((NOW_EPOCH - BUILD_EPOCH))
    AGE_MINUTES=$((AGE_SECONDS / 60))
    
    if [ $AGE_MINUTES -lt 5 ]; then
        echo "   ✅ Build recente (meno di 5 minuti fa)"
    elif [ $AGE_MINUTES -lt 60 ]; then
        echo "   ⚠️  Build di $AGE_MINUTES minuti fa"
    else
        AGE_HOURS=$((AGE_MINUTES / 60))
        echo "   ⚠️  Build vecchio ($AGE_HOURS ore fa)"
    fi
else
    echo "   ❌ Directory build/ non esiste!"
fi

# 4. Verifica configurazione Nginx
echo ""
echo "⚙️  4. Configurazione Nginx:"
echo "---------------------------"
NGINX_ROOT=$(grep -r "root.*ticketapp.*frontend" /etc/nginx/sites-available/ 2>/dev/null | head -1 | awk '{print $2}' | tr -d ';')
if [ -n "$NGINX_ROOT" ]; then
    echo "   Root directory: $NGINX_ROOT"
    
    # Verifica se punta al build corretto
    if [ "$NGINX_ROOT" = "/var/www/ticketapp/frontend/build" ] || [ "$NGINX_ROOT" = "/var/www/ticketapp/frontend/build/" ]; then
        echo "   ✅ Nginx punta alla directory build corretta"
    else
        echo "   ⚠️  Nginx potrebbe non puntare alla directory build corretta"
        echo "   Atteso: /var/www/ticketapp/frontend/build"
        echo "   Trovato: $NGINX_ROOT"
    fi
else
    echo "   ⚠️  Impossibile trovare configurazione root in Nginx"
fi

# 5. Suggerimenti
echo ""
echo "💡 PROSSIMI PASSI:"
echo "------------------"
if grep -q "ticketapp.*onrender.com" build/static/js/main.*.js 2>/dev/null; then
    echo "   1. ❌ Il build CONTIENE ancora Render.com"
    echo "   2. Esegui: ./rebuild-frontend-server.sh"
    echo "   3. Verifica che REACT_APP_API_URL sia vuoto in .env"
else
    echo "   1. ✅ Il build è corretto (nessun Render.com)"
    echo "   2. Se il browser carica ancora vecchi file:"
    echo "      - Verifica che Nginx serva i file corretti"
    echo "      - Pulisci cache browser (Ctrl+Shift+Delete)"
    echo "      - Disabilita Service Worker (vedi FIX_SERVICE_WORKER.md)"
    echo "      - Prova in modalità incognito"
fi

echo ""

