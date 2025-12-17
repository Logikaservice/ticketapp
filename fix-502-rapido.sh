#!/bin/bash
# Script rapido per fix errori 502 - Riavvia backend

echo "🔧 FIX RAPIDO ERRORI 502"
echo "========================"
echo ""

# 1. Verifica PM2
echo "1️⃣ Verifica PM2..."
pm2 status
echo ""

# 2. Riavvia backend
echo "2️⃣ Riavvio backend..."
pm2 restart ticketapp-backend || pm2 restart all
echo ""

# 3. Attendi 3 secondi
echo "3️⃣ Attendo 3 secondi..."
sleep 3
echo ""

# 4. Verifica stato
echo "4️⃣ Verifica stato backend..."
pm2 status
echo ""

# 5. Verifica porta 3001
echo "5️⃣ Verifica porta 3001..."
if netstat -tlnp | grep -q ":3001 "; then
    echo "✅ Backend è in ascolto sulla porta 3001"
    netstat -tlnp | grep ":3001 "
else
    echo "❌ Backend NON è in ascolto sulla porta 3001"
    echo ""
    echo "Provo ad avviare manualmente..."
    cd /var/www/ticketapp/backend
    pm2 start index.js --name ticketapp-backend || node index.js
fi
echo ""

# 6. Test connessione
echo "6️⃣ Test connessione backend..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ] || [ "$HEALTH" = "404" ]; then
    echo "✅ Backend risponde (HTTP $HEALTH)"
else
    echo "❌ Backend NON risponde (HTTP $HEALTH)"
    echo ""
    echo "Verifica log per errori:"
    pm2 logs ticketapp-backend --lines 20 --nostream
fi
echo ""

echo "✅ Fix completato!"
echo ""
echo "Se il problema persiste, verifica i log:"
echo "  pm2 logs ticketapp-backend --lines 50"














