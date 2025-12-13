#!/bin/bash

# Script per avviare il backend correttamente

set -e

echo "🚀 Avvio Backend"
echo "================"
echo ""

cd /var/www/ticketapp/backend || exit 1

# 1. Verifica dipendenze
echo "1️⃣  Verifica dipendenze..."
if [ ! -d node_modules ]; then
    echo "   ⚠️  node_modules non trovato - installo dipendenze..."
    npm install
else
    echo "   ✅ Dipendenze presenti"
fi

# 2. Verifica file .env
echo ""
echo "2️⃣  Verifica configurazione..."
if [ ! -f .env ]; then
    echo "   ❌ File .env non trovato!"
    echo "   Crea il file .env con le configurazioni necessarie"
    exit 1
else
    echo "   ✅ File .env presente"
    
    # Verifica variabili critiche
    if ! grep -q "^DATABASE_URL=" .env; then
        echo "   ⚠️  DATABASE_URL non trovato in .env"
    else
        echo "   ✅ DATABASE_URL configurato"
    fi
fi

# 3. Verifica sintassi index.js
echo ""
echo "3️⃣  Verifica sintassi..."
if node -c index.js 2>&1; then
    echo "   ✅ Sintassi corretta"
else
    echo "   ❌ Errore di sintassi in index.js!"
    exit 1
fi

# 4. Rimuovi processo esistente se presente
echo ""
echo "4️⃣  Pulizia processi esistenti..."
if pm2 list | grep -q "ticketapp-backend"; then
    echo "   Rimozione processo esistente..."
    pm2 delete ticketapp-backend 2>/dev/null || true
fi

# 5. Avvia backend con PM2
echo ""
echo "5️⃣  Avvio backend con PM2..."
cd /var/www/ticketapp
pm2 start backend/index.js --name ticketapp-backend --update-env

# 6. Attendi qualche secondo
echo ""
echo "6️⃣  Attesa avvio..."
sleep 5

# 7. Verifica stato
echo ""
echo "7️⃣  Verifica stato..."
pm2 status ticketapp-backend

# 8. Test connessione
echo ""
echo "8️⃣  Test connessione backend..."
sleep 2
if curl -s --max-time 5 http://localhost:3001/api/health > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s --max-time 5 http://localhost:3001/api/health)
    echo "   ✅ Backend risponde!"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo "   ⚠️  Backend ancora non risponde"
    echo "   Controlla i log: pm2 logs ticketapp-backend"
fi

# 9. Mostra log recenti
echo ""
echo "9️⃣  Ultimi log backend..."
echo "------------------------"
pm2 logs ticketapp-backend --lines 20 --nostream 2>/dev/null | tail -20 || echo "   ⚠️  Log non disponibili"

echo ""
echo "✅ Avvio completato!"
echo ""
echo "💡 Se il backend non risponde:"
echo "   - Verifica log: pm2 logs ticketapp-backend --lines 100"
echo "   - Verifica errori: pm2 logs ticketapp-backend --lines 500 | grep -i error"
echo "   - Verifica DATABASE_URL in backend/.env"
echo ""

