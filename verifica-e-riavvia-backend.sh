#!/bin/bash
set -e

echo "🔍 VERIFICA E RIAVVIO BACKEND"
echo "=============================="

# 1. Verifica se PM2 è installato
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 non trovato. Installa con: npm install -g pm2"
    exit 1
fi

# 2. Verifica stato backend
echo "1. Verifica stato backend..."
pm2 status ticketapp-backend || echo "⚠️  Backend non trovato in PM2"

# 3. Vai alla directory del progetto
cd /var/www/ticketapp || { echo "❌ Directory /var/www/ticketapp non trovata!"; exit 1; }

# 4. Pull ultimo codice
echo "2. Aggiorno codice da GitHub..."
git pull || { echo "❌ Errore durante git pull!"; exit 1; }
echo "✅ Codice aggiornato."

# 5. Installa dipendenze backend se necessario
echo "3. Verifica dipendenze backend..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "   Installo dipendenze..."
    npm install
fi

# 6. Verifica sintassi
echo "4. Verifica sintassi..."
node -c index.js || { echo "❌ Errore di sintassi in index.js!"; exit 1; }
node -c routes/cryptoRoutes.js || { echo "❌ Errore di sintassi in cryptoRoutes.js!"; exit 1; }
echo "✅ Sintassi OK."

# 7. Riavvia backend
echo "5. Riavvio backend..."
pm2 restart ticketapp-backend || pm2 start index.js --name ticketapp-backend --update-env
pm2 save
echo "✅ Backend riavviato."

# 8. Attendi avvio
echo "6. Attendo avvio backend (5 secondi)..."
sleep 5

# 9. Verifica stato
echo "7. Verifica stato finale..."
pm2 status ticketapp-backend
echo ""

# 10. Test health check
echo "8. Test Health Check..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000")
echo "   Health check: HTTP $HEALTH_STATUS"
if [ "$HEALTH_STATUS" -eq "200" ]; then
    echo "✅ Backend online!"
else
    echo "⚠️  Health check fallito. Controlla i log: pm2 logs ticketapp-backend --lines 50"
fi

echo ""
echo "✅ Completato!"
echo ""
echo "📋 Prossimi passi:"
echo "   - Controlla log: pm2 logs ticketapp-backend --lines 100"
echo "   - Test bot-analysis: curl http://localhost:3001/api/crypto/bot-analysis?symbol=aave"

