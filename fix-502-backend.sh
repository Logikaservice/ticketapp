#!/bin/bash

# Script per diagnosticare e fixare errori 502 Bad Gateway

echo "🔍 Diagnostica 502 Bad Gateway"
echo "==============================="
echo ""

cd /var/www/ticketapp || exit 1

# 1. Verifica stato backend PM2
echo "1️⃣  Verifica stato backend PM2..."
echo "----------------------------------"
pm2 status ticketapp-backend

BACKEND_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="ticketapp-backend") | .pm2_env.status' 2>/dev/null || echo "unknown")

if [ "$BACKEND_STATUS" != "online" ]; then
    echo ""
    echo "   ❌ Backend NON è online!"
    echo "   Stato: $BACKEND_STATUS"
    echo ""
    echo "   🔧 Tentativo riavvio..."
    pm2 restart ticketapp-backend
    sleep 3
    pm2 status ticketapp-backend
else
    echo "   ✅ Backend è online (ma potrebbe non rispondere)"
fi

# 2. Test connessione backend direttamente
echo ""
echo "2️⃣  Test connessione backend (localhost:3001)..."
echo "------------------------------------------------"
if curl -s --max-time 5 http://localhost:3001/api/health > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s --max-time 5 http://localhost:3001/api/health)
    echo "   ✅ Backend risponde su localhost:3001"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo "   ❌ Backend NON risponde su localhost:3001!"
    echo ""
    echo "   Possibili cause:"
    echo "   - Backend è crashato"
    echo "   - Backend è in crash loop"
    echo "   - Porta 3001 non è in ascolto"
    echo ""
    
    # Verifica se la porta è in ascolto
    if lsof -i :3001 2>/dev/null | grep -q LISTEN; then
        echo "   ⚠️  Porta 3001 è in ascolto, ma non risponde"
        echo "   Processo:"
        lsof -i :3001
    else
        echo "   ❌ Porta 3001 NON è in ascolto!"
        echo "   Il backend non è partito correttamente"
    fi
fi

# 3. Verifica log backend
echo ""
echo "3️⃣  Ultimi errori nel backend..."
echo "---------------------------------"
echo "   (Ultimi 30 log di errore)"
pm2 logs ticketapp-backend --lines 30 --nostream --err 2>/dev/null | tail -30 || echo "   ⚠️  Impossibile leggere log"

# 4. Verifica configurazione Nginx
echo ""
echo "4️⃣  Verifica configurazione Nginx..."
echo "-------------------------------------"
NGINX_CONFIG="/etc/nginx/sites-available/ticketapp"
if [ ! -f "$NGINX_CONFIG" ]; then
    NGINX_CONFIG="/etc/nginx/sites-available/default"
fi

if [ -f "$NGINX_CONFIG" ]; then
    echo "   Config file: $NGINX_CONFIG"
    
    if grep -q "proxy_pass.*127.0.0.1:3001\|proxy_pass.*localhost:3001" "$NGINX_CONFIG"; then
        echo "   ✅ Proxy configurato per localhost:3001"
        grep "proxy_pass.*3001" "$NGINX_CONFIG" | head -1
    else
        echo "   ❌ Proxy NON configurato per porta 3001!"
    fi
else
    echo "   ⚠️  File configurazione Nginx non trovato"
fi

# 5. Test tramite Nginx
echo ""
echo "5️⃣  Test tramite Nginx (proxy)..."
echo "----------------------------------"
if curl -s --max-time 5 http://localhost/api/health > /dev/null 2>&1; then
    PROXY_RESPONSE=$(curl -s --max-time 5 http://localhost/api/health)
    echo "   ✅ Proxy Nginx funziona"
    echo "   Response: $PROXY_RESPONSE"
else
    PROXY_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost/api/health)
    echo "   ❌ Proxy Nginx NON funziona!"
    echo "   HTTP Code: $PROXY_HTTP_CODE"
    
    if [ "$PROXY_HTTP_CODE" = "502" ]; then
        echo ""
        echo "   🔴 ERRORE 502: Nginx non riesce a raggiungere il backend"
        echo "   → Il backend non risponde su localhost:3001"
    fi
fi

# 6. Verifica database (se backend è il problema)
echo ""
echo "6️⃣  Verifica connessione database..."
echo "-------------------------------------"
cd backend || exit 1
if [ -f .env ]; then
    source .env 2>/dev/null || true
    if [ -n "$DATABASE_URL" ]; then
        node -e "
            require('dotenv').config();
            const { Pool } = require('pg');
            const pool = new Pool({ connectionString: process.env.DATABASE_URL });
            pool.query('SELECT current_database()')
                .then(r => {
                    console.log('   ✅ Database raggiungibile');
                    pool.end();
                    process.exit(0);
                })
                .catch(e => {
                    console.error('   ❌ Database NON raggiungibile:', e.message);
                    pool.end();
                    process.exit(1);
                });
        " 2>&1 || echo "   ❌ Errore test database"
    fi
fi

# 7. Suggerimenti
echo ""
echo "💡 PROSSIMI PASSI:"
echo "------------------"
if [ "$BACKEND_STATUS" != "online" ]; then
    echo "   1. Riavvia backend: pm2 restart ticketapp-backend"
    echo "   2. Monitora log: pm2 logs ticketapp-backend"
fi

if ! curl -s --max-time 5 http://localhost:3001/api/health > /dev/null 2>&1; then
    echo ""
    echo "   🔴 BACKEND NON RISponde - Azioni immediate:"
    echo ""
    echo "   1. Verifica log backend:"
    echo "      pm2 logs ticketapp-backend --lines 100"
    echo ""
    echo "   2. Verifica errori specifici:"
    echo "      pm2 logs ticketapp-backend --lines 500 | grep -i error"
    echo ""
    echo "   3. Riavvia backend:"
    echo "      pm2 restart ticketapp-backend"
    echo ""
    echo "   4. Se continua a crashare, verifica:"
    echo "      - DATABASE_URL corretto in backend/.env"
    echo "      - Dipendenze installate: cd backend && npm install"
    echo "      - Permessi file: chmod 644 backend/index.js"
fi

echo ""

