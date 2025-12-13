#!/bin/bash

# Script per correggere configurazione VPS - Rimozione Render.com
# Eseguire sul server VPS Hetzner

set -e

echo "🔧 Fix Configurazione VPS Hetzner - Rimozione Render.com"
echo "========================================================="
echo ""

cd /var/www/ticketapp || exit 1

# 1. Fix Frontend .env.production
echo "📝 1. Correzione .env.production frontend..."
cd frontend

# Rimuovi .env.production se esiste e contiene Render.com
if [ -f .env.production ]; then
    if grep -q "ticketapp.*onrender.com" .env.production 2>/dev/null; then
        echo "   ⚠️  .env.production contiene Render.com - RIMOSSO"
        rm -f .env.production
    else
        echo "   ✅ .env.production OK"
    fi
else
    echo "   ✅ .env.production non esiste (OK)"
fi

# Verifica/Crea .env corretto
if [ ! -f .env ] || grep -q "REACT_APP_API_URL=.*onrender.com" .env 2>/dev/null; then
    echo "   🔧 Correzione .env..."
    cat > .env <<EOF
REACT_APP_API_URL=
GENERATE_SOURCEMAP=false
EOF
    echo "   ✅ .env corretto"
else
    echo "   ✅ .env già corretto"
fi

# 2. Verifica Backend .env
echo ""
echo "📝 2. Verifica configurazione backend..."
cd ../backend

# Verifica FRONTEND_URL
if ! grep -q "^FRONTEND_URL=" .env 2>/dev/null; then
    echo "   ➕ Aggiungo FRONTEND_URL..."
    echo "FRONTEND_URL=https://ticket.logikaservice.it" >> .env
elif grep -q "^FRONTEND_URL=.*onrender.com" .env 2>/dev/null; then
    echo "   🔧 Correggo FRONTEND_URL (rimuovo Render.com)..."
    sed -i 's|^FRONTEND_URL=.*|FRONTEND_URL=https://ticket.logikaservice.it|' .env
fi

echo "   ✅ FRONTEND_URL: $(grep "^FRONTEND_URL=" .env | cut -d'=' -f2-)"

# Verifica DATABASE_URL punta a VPS (non Render)
if grep -q "^DATABASE_URL=.*onrender.com" .env 2>/dev/null; then
    echo "   ⚠️  ATTENZIONE: DATABASE_URL punta a Render.com!"
    echo "   ❌ Devi configurarlo per puntare al database VPS Hetzner"
    echo "   💡 Esempio: DATABASE_URL=postgresql://postgres:password@localhost:5432/ticketapp"
    exit 1
elif grep -q "^DATABASE_URL=" .env 2>/dev/null; then
    DB_HOST=$(grep "^DATABASE_URL=" .env | sed -n 's|.*@\([^:]*\):.*|\1|p')
    if [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
        echo "   ✅ DATABASE_URL punta a database locale VPS"
    else
        echo "   ✅ DATABASE_URL: postgresql://...@$DB_HOST:..."
    fi
else
    echo "   ⚠️  DATABASE_URL non trovato in .env"
fi

# 3. Rebuild Frontend
echo ""
echo "🔨 3. Rebuild frontend..."
cd ../frontend

# Rimuovi build vecchio
if [ -d build ]; then
    echo "   🗑️  Rimozione build vecchio..."
    rm -rf build
fi

# Rebuild con REACT_APP_API_URL vuoto
echo "   🔨 Build in corso..."
unset REACT_APP_API_URL
export REACT_APP_API_URL=""
npm run build

# Verifica che non contenga Render.com
echo ""
echo "🔍 4. Verifica build..."
if grep -r "ticketapp.*onrender.com" build/ 2>/dev/null; then
    echo "   ❌ ERRORE: Build contiene ancora Render.com!"
    exit 1
else
    echo "   ✅ Build corretto (nessun riferimento a Render.com)"
fi

# 5. Riavvia servizi
echo ""
echo "🔄 5. Riavvio servizi..."
cd ..

# Riavvia backend
if command -v pm2 &> /dev/null; then
    echo "   🔄 Riavvio backend (PM2)..."
    pm2 restart ticketapp-backend || echo "   ⚠️  PM2 restart fallito, prova: sudo systemctl restart ticketapp-backend"
else
    echo "   🔄 Riavvio backend (systemd)..."
    sudo systemctl restart ticketapp-backend || echo "   ⚠️  Restart fallito"
fi

# Ricarica Nginx
echo "   🔄 Ricarica Nginx..."
sudo nginx -t && sudo systemctl reload nginx || echo "   ⚠️  Nginx reload fallito"

# 6. Verifica finale
echo ""
echo "✅ Verifica finale..."
echo ""

# Verifica backend risponde
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "   ✅ Backend risponde"
else
    echo "   ⚠️  Backend non risponde su localhost:3001"
fi

# Verifica che non ci siano più riferimenti a Render.com
echo ""
echo "📋 Riepilogo:"
echo "   - .env.production: $(if [ -f frontend/.env.production ]; then echo '⚠️  ESISTE'; else echo '✅ RIMOSSO/NON ESISTE'; fi)"
echo "   - FRONTEND_URL: $(grep "^FRONTEND_URL=" backend/.env 2>/dev/null | cut -d'=' -f2- || echo 'non configurato')"
echo "   - Build contiene Render.com: $(if grep -qr "ticketapp.*onrender.com" frontend/build/ 2>/dev/null; then echo '❌ SÌ'; else echo '✅ NO'; fi)"
echo ""
echo "🎉 Fix completato!"
echo ""
echo "📌 PROSSIMI PASSI:"
echo "   1. Pulisci cache browser (Ctrl+Shift+Delete)"
echo "   2. Hard reload pagina (Ctrl+Shift+R)"
echo "   3. Verifica che le chiamate API vadano a ticket.logikaservice.it/api/..."
echo ""

