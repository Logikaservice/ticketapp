#!/bin/bash
# Script di diagnostica completa per capire perché il backend non funziona

echo "🔍 DIAGNOSTICA COMPLETA BACKEND"
echo "================================"
echo ""

# 1. Verifica stato PM2
echo "1. STATO PM2:"
echo "-------------"
pm2 status
echo ""

# 2. Verifica log recenti
echo "2. ULTIMI 50 LOG (cerca errori):"
echo "---------------------------------"
pm2 logs ticketapp-backend --lines 50 --nostream | tail -50
echo ""

# 3. Verifica se il processo è in esecuzione
echo "3. PROCESSO IN ESECUZIONE:"
echo "--------------------------"
ps aux | grep "node.*index.js" | grep -v grep || echo "❌ Nessun processo Node.js trovato"
echo ""

# 4. Verifica porta 3001
echo "4. PORTA 3001:"
echo "--------------"
netstat -tlnp | grep 3001 || echo "❌ Porta 3001 non in ascolto"
echo ""

# 5. Test endpoint locale
echo "5. TEST ENDPOINT LOCALI:"
echo "------------------------"
echo -n "Health check: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000"
echo ""

echo -n "Crypto dashboard: "
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/crypto/dashboard || echo "000"
echo ""

# 6. Verifica fix Vivaldi
echo "6. VERIFICA FIX VIVALDI:"
echo "------------------------"
cd /var/www/ticketapp/backend
if grep -q "if (vivaldiRoutes)" index.js; then
    echo "✅ Fix Vivaldi presente"
    grep -n "if (vivaldiRoutes)" index.js
else
    echo "❌ Fix Vivaldi NON presente!"
fi
echo ""

# 7. Verifica database crypto
echo "7. VERIFICA DATABASE CRYPTO:"
echo "----------------------------"
if [ -f "/var/www/ticketapp/backend/crypto.db" ]; then
    echo "✅ Database crypto.db esiste"
    ls -lh /var/www/ticketapp/backend/crypto.db
else
    echo "⚠️  Database crypto.db non esiste (verrà creato automaticamente)"
fi
echo ""

# 8. Verifica ultimo commit
echo "8. ULTIMO COMMIT:"
echo "-----------------"
cd /var/www/ticketapp
git log --oneline -1
echo ""

# 9. Verifica modifiche non committate
echo "9. MODIFICHE NON COMMITTATE:"
echo "----------------------------"
git status --short
echo ""

# 10. Verifica errori comuni nei log
echo "10. ERRORI COMUNI NEI LOG:"
echo "--------------------------"
pm2 logs ticketapp-backend --lines 100 --nostream | grep -i "error\|crash\|fail\|exception" | tail -10 || echo "Nessun errore trovato"
echo ""

echo "================================"
echo "✅ Diagnostica completata!"
echo ""
echo "📋 PROSSIMI PASSI:"
echo "   1. Se vedi 'errored' o 'stopped' in PM2, il backend è crashato"
echo "   2. Controlla gli errori nella sezione 10"
echo "   3. Se il fix Vivaldi non è presente, esegui: git pull origin main"
echo "   4. Se il backend è crashato, riavvia: pm2 restart ticketapp-backend"
