#!/bin/bash
# Script per fix frontend build con URL corretto

set -e

echo "🔧 FIX FRONTEND BUILD - RIMOZIONE REACT_APP_API_URL"
echo "==================================================="
echo ""

FRONTEND_DIR="/var/www/ticketapp/frontend"

# 1. Verifica directory
echo "1️⃣ Verifica directory frontend..."
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ Directory frontend non trovata: $FRONTEND_DIR"
    exit 1
fi
cd "$FRONTEND_DIR"
echo "✅ Directory: $FRONTEND_DIR"
echo ""

# 2. Verifica file .env
echo "2️⃣ Verifica file .env..."
if [ -f ".env" ]; then
    echo "📄 File .env trovato"
    if grep -q "^REACT_APP_API_URL" .env; then
        echo "⚠️  REACT_APP_API_URL trovata in .env"
        echo "   Contenuto attuale:"
        grep "^REACT_APP_API_URL" .env || true
        echo ""
        echo "🗑️  Rimuovo REACT_APP_API_URL da .env..."
        sed -i '/^REACT_APP_API_URL/d' .env
        echo "✅ REACT_APP_API_URL rimossa"
    else
        echo "✅ REACT_APP_API_URL non presente in .env"
    fi
else
    echo "ℹ️  Nessun file .env trovato (va bene)"
fi
echo ""

# 3. Assicurati che REACT_APP_API_URL non sia impostata
echo "3️⃣ Verifica variabili d'ambiente..."
if [ -n "$REACT_APP_API_URL" ]; then
    echo "⚠️  REACT_APP_API_URL è impostata nel sistema: $REACT_APP_API_URL"
    echo "   La disimposto per questo build..."
    unset REACT_APP_API_URL
fi
export REACT_APP_API_URL=""
echo "✅ REACT_APP_API_URL non impostata (userà URL relativi)"
echo ""

# 4. Installa dipendenze se necessario
echo "4️⃣ Verifica dipendenze..."
if [ ! -d "node_modules" ]; then
    echo "📦 Installo dipendenze..."
    npm install
else
    echo "✅ Dipendenze già installate"
fi
echo ""

# 5. Build frontend
echo "5️⃣ Build frontend (SENZA REACT_APP_API_URL)..."
npm run build
echo "✅ Build completato"
echo ""

# 6. Verifica build
echo "6️⃣ Verifica build..."
if grep -r "ticketapp-4eqb.onrender.com" build/ > /dev/null 2>&1; then
    echo "❌ ERRORE: Trovati riferimenti a Render.com nel build!"
    echo "   Questo significa che la variabile è ancora impostata da qualche parte"
    echo "   Verifica con: env | grep REACT_APP_API_URL"
    exit 1
else
    echo "✅ Build corretto - nessun riferimento a Render.com"
fi
echo ""

# 7. Verifica che nginx serva il nuovo build
echo "7️⃣ Verifica configurazione nginx..."
if [ -d "/etc/nginx/sites-available" ]; then
    NGINX_ROOT=$(grep -r "root.*frontend.*build" /etc/nginx/sites-available/ 2>/dev/null | head -1 | awk '{print $2}' | tr -d ';' || echo "")
    if [ -n "$NGINX_ROOT" ]; then
        echo "📁 Nginx root: $NGINX_ROOT"
        if [ "$NGINX_ROOT" = "$FRONTEND_DIR/build" ] || [ "$NGINX_ROOT" = "/var/www/ticketapp/frontend/build" ]; then
            echo "✅ Nginx configurato correttamente"
        else
            echo "⚠️  Nginx root diverso: $NGINX_ROOT"
        fi
    else
        echo "⚠️  Impossibile determinare nginx root"
    fi
fi
echo ""

# 8. Riavvia nginx
echo "8️⃣ Ricarica nginx..."
if sudo systemctl reload nginx 2>/dev/null; then
    echo "✅ Nginx ricaricato"
else
    echo "⚠️  Impossibile ricaricare nginx (potrebbe non essere necessario)"
fi
echo ""

echo "==================================================="
echo "📋 RIEPILOGO"
echo "==================================================="
echo "✅ Frontend rebuild completato"
echo ""
echo "Prossimi passi:"
echo "1. Ricarica il dashboard nel browser (Ctrl+Shift+R)"
echo "2. Verifica nella console che non ci siano più errori CORS"
echo "3. Verifica che le chiamate API vadano a ticket.logikaservice.it/api/..."
echo ""

