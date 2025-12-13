#!/bin/bash

# Script per diagnosticare crash backend
# Eseguire sul server VPS

echo "🔍 Diagnostica Backend Crash Loop"
echo "=================================="
echo ""

cd /var/www/ticketapp || exit 1

# 1. Verifica log PM2
echo "📋 1. Ultimi log PM2 (errori):"
echo "--------------------------------"
pm2 logs ticketapp-backend --lines 50 --nostream --err | tail -50

echo ""
echo "📋 2. Ultimi log PM2 (output generale):"
echo "----------------------------------------"
pm2 logs ticketapp-backend --lines 30 --nostream | tail -30

echo ""
echo "📋 3. Status PM2 dettagliato:"
echo "-----------------------------"
pm2 describe ticketapp-backend

echo ""
echo "📋 4. Verifica file .env backend:"
echo "----------------------------------"
cd backend
if [ -f .env ]; then
    echo "✅ .env esiste"
    echo ""
    echo "Variabili critiche:"
    echo "  - DATABASE_URL: $(grep "^DATABASE_URL=" .env | cut -d'=' -f2- | cut -c1-50)..."
    echo "  - PORT: $(grep "^PORT=" .env | cut -d'=' -f2- || echo 'non impostato (default 3001)')"
    echo "  - NODE_ENV: $(grep "^NODE_ENV=" .env | cut -d'=' -f2- || echo 'non impostato')"
    echo ""
    echo "Verifica sintassi .env (righe problematiche):"
    grep -n "=" .env | grep -v "^#" | head -20
else
    echo "❌ .env NON ESISTE!"
fi

echo ""
echo "📋 5. Verifica dipendenze backend:"
echo "-----------------------------------"
if [ -d node_modules ]; then
    echo "✅ node_modules esiste"
    if [ -f package.json ]; then
        echo "✅ package.json esiste"
    else
        echo "❌ package.json NON ESISTE!"
    fi
else
    echo "❌ node_modules NON ESISTE - esegui: npm install"
fi

echo ""
echo "📋 6. Verifica sintassi JavaScript:"
echo "------------------------------------"
if command -v node &> /dev/null; then
    echo "Verifica sintassi index.js..."
    if node -c index.js 2>&1; then
        echo "✅ Sintassi index.js OK"
    else
        echo "❌ Errore sintassi in index.js"
    fi
else
    echo "⚠️  Node.js non trovato nel PATH"
fi

echo ""
echo "📋 7. Verifica porta 3001:"
echo "--------------------------"
if lsof -i :3001 2>/dev/null | grep -q LISTEN; then
    echo "✅ Porta 3001 è in uso"
    lsof -i :3001
else
    echo "❌ Porta 3001 NON è in uso (backend non sta ascoltando)"
fi

echo ""
echo "📋 8. Test connessione database:"
echo "---------------------------------"
if [ -f .env ]; then
    source .env 2>/dev/null || true
    if [ -n "$DATABASE_URL" ]; then
        echo "Tentativo di connessione al database..."
        node -e "
            require('dotenv').config();
            const { Pool } = require('pg');
            const pool = new Pool({ connectionString: process.env.DATABASE_URL });
            pool.query('SELECT current_database(), version()')
                .then(r => {
                    console.log('✅ Database OK:', r.rows[0].current_database);
                    pool.end();
                    process.exit(0);
                })
                .catch(e => {
                    console.error('❌ Database ERR:', e.message);
                    pool.end();
                    process.exit(1);
                });
        " 2>&1 || echo "❌ Errore connessione database"
    else
        echo "⚠️  DATABASE_URL non configurato"
    fi
fi

echo ""
echo "📋 9. Verifica permessi file:"
echo "------------------------------"
ls -la index.js package.json .env 2>/dev/null | head -5

echo ""
echo "✅ Diagnostica completata!"
echo ""
echo "💡 PROSSIMI PASSI:"
echo "   1. Controlla gli errori nei log PM2 sopra"
echo "   2. Se DATABASE_URL è errato, correggilo in backend/.env"
echo "   3. Se node_modules manca, esegui: cd backend && npm install"
echo "   4. Se ci sono errori di sintassi, correggili"
echo "   5. Prova riavvio manuale: pm2 restart ticketapp-backend"
echo ""

