#!/bin/bash
# Script per trovare TUTTI i riferimenti a Render.com

echo "🔍 RICERCA COMPLETA RIFERIMENTI A RENDER.COM"
echo "============================================="
echo ""

cd /var/www/ticketapp

# 1. Cerca nel codice sorgente
echo "1️⃣ Ricerca nel codice sorgente..."
grep -r "ticketapp.*onrender\|4eqb\|onrender\.com" . --exclude-dir=node_modules --exclude-dir=build --exclude-dir=.git 2>/dev/null | head -20 || echo "   Nessun riferimento trovato nel codice"
echo ""

# 2. Cerca nei file .env
echo "2️⃣ Ricerca nei file .env..."
find . -name ".env*" -type f ! -path "./node_modules/*" ! -path "./build/*" 2>/dev/null | while read envfile; do
    echo "   File: $envfile"
    if grep -q "REACT_APP_API_URL\|onrender\|4eqb" "$envfile" 2>/dev/null; then
        echo "   ⚠️  TROVATO:"
        grep "REACT_APP_API_URL\|onrender\|4eqb" "$envfile" | sed 's/.*/      &/'
    else
        echo "   ✅ Nessun riferimento trovato"
    fi
done
echo ""

# 3. Cerca nel build frontend
echo "3️⃣ Ricerca nel build frontend..."
if [ -d "frontend/build" ]; then
    if grep -r "ticketapp.*onrender\|4eqb" frontend/build/ 2>/dev/null | head -5; then
        echo "   ❌ TROVATI riferimenti a Render.com nel build!"
    else
        echo "   ✅ Nessun riferimento trovato nel build"
    fi
else
    echo "   ⚠️  Directory build non trovata"
fi
echo ""

# 4. Cerca variabili d'ambiente di sistema
echo "4️⃣ Variabili d'ambiente di sistema..."
if env | grep -q "REACT_APP_API_URL\|onrender\|4eqb"; then
    echo "   ⚠️  TROVATE:"
    env | grep "REACT_APP_API_URL\|onrender\|4eqb" | sed 's/.*/      &/'
else
    echo "   ✅ Nessuna variabile trovata"
fi
echo ""

# 5. Cerca nei file di configurazione nginx
echo "5️⃣ Ricerca configurazione nginx..."
if [ -d "/etc/nginx" ]; then
    if grep -r "ticketapp.*onrender\|4eqb\|onrender\.com" /etc/nginx/ 2>/dev/null | head -5; then
        echo "   ⚠️  TROVATI riferimenti in nginx"
    else
        echo "   ✅ Nessun riferimento trovato in nginx"
    fi
else
    echo "   ⚠️  Directory /etc/nginx non accessibile"
fi
echo ""

# 6. Cerca nei file di sistema (bashrc, profile, ecc.)
echo "6️⃣ Ricerca file di configurazione shell..."
if [ -f "/root/.bashrc" ]; then
    if grep -q "REACT_APP_API_URL\|onrender\|4eqb" /root/.bashrc 2>/dev/null; then
        echo "   ⚠️  TROVATO in /root/.bashrc:"
        grep "REACT_APP_API_URL\|onrender\|4eqb" /root/.bashrc | sed 's/.*/      &/'
    fi
fi
if [ -f "/root/.bash_profile" ]; then
    if grep -q "REACT_APP_API_URL\|onrender\|4eqb" /root/.bash_profile 2>/dev/null; then
        echo "   ⚠️  TROVATO in /root/.bash_profile:"
        grep "REACT_APP_API_URL\|onrender\|4eqb" /root/.bash_profile | sed 's/.*/      &/'
    fi
fi
if [ -f "/root/.profile" ]; then
    if grep -q "REACT_APP_API_URL\|onrender\|4eqb" /root/.profile 2>/dev/null; then
        echo "   ⚠️  TROVATO in /root/.profile:"
        grep "REACT_APP_API_URL\|onrender\|4eqb" /root/.profile | sed 's/.*/      &/'
    fi
fi
echo "   ✅ Verifica completata"
echo ""

echo "============================================="
echo "📋 RIEPILOGO"
echo "============================================="
echo ""
echo "Se vedi ancora errori CORS verso Render.com nel browser,"
echo "il problema è probabilmente:"
echo "1. Cache del browser (pulisci con Ctrl+Shift+R o Ctrl+Shift+Delete)"
echo "2. Build vecchio ancora servito da nginx (verifica con: ls -lh frontend/build/static/js/main.*.js)"
echo "3. Service Worker o cache del Service Worker (Disabilita Service Workers in DevTools)"

