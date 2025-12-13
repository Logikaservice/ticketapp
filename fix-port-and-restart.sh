#!/bin/bash
# Script per fermare tutti i processi sulla porta 3001 e riavviare il backend correttamente

echo "🔧 FIX PORTA 3001 E RIAVVIO BACKEND"
echo "===================================="
echo ""

# 1. Trova e uccidi tutti i processi sulla porta 3001
echo "1️⃣ Fermo tutti i processi sulla porta 3001..."
PID=$(sudo lsof -ti:3001 2>/dev/null)
if [ -z "$PID" ]; then
    echo "   ✅ Nessun processo trovato sulla porta 3001"
else
    echo "   🔍 Trovati processi: $PID"
    sudo kill -9 $PID 2>/dev/null
    echo "   ✅ Processi terminati"
    sleep 2
fi
echo ""

# 2. Ferma PM2 backend
echo "2️⃣ Fermo processo PM2 ticketapp-backend..."
pm2 delete ticketapp-backend 2>/dev/null || echo "   ⚠️  Nessun processo PM2 da fermare"
sleep 2
echo ""

# 3. Verifica che la porta sia libera
echo "3️⃣ Verifica porta 3001..."
if sudo lsof -ti:3001 >/dev/null 2>&1; then
    echo "   ❌ ERRORE: La porta 3001 è ancora occupata!"
    echo "   Eseguo kill forzato..."
    sudo fuser -k 3001/tcp 2>/dev/null
    sleep 3
fi
echo "   ✅ Porta 3001 libera"
echo ""

# 4. Aggiorna codice
echo "4️⃣ Aggiorno codice da Git..."
cd /var/www/ticketapp
git pull
echo ""

# 5. Avvia backend
echo "5️⃣ Avvio backend..."
cd backend
pm2 start index.js --name ticketapp-backend --update-env
pm2 save

# 6. Attendi avvio
echo ""
echo "6️⃣ Attendo avvio backend..."
sleep 5

# 7. Verifica stato
echo ""
echo "7️⃣ Verifica stato..."
pm2 status ticketapp-backend

# 8. Test endpoint
echo ""
echo "8️⃣ Test endpoint /api/health..."
sleep 2
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "000")
echo "   Health check: HTTP $HEALTH"

# 9. Mostra ultimi log
echo ""
echo "9️⃣ Ultimi 30 log backend..."
echo "---------------------------"
pm2 logs ticketapp-backend --lines 30 --nostream 2>/dev/null | tail -30 || echo "   ⚠️  Log non disponibili"

echo ""
echo "✅ Completato!"
echo ""
echo "💡 Se vedi ancora errori:"
echo "   - Verifica log: pm2 logs ticketapp-backend --lines 100"
echo "   - Verifica porta: sudo lsof -i:3001"
echo ""

