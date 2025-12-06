#!/bin/bash
# Script di verifica post-deploy VPS

echo "🔍 ========== VERIFICA DEPLOY =========="
echo ""

# 1. Verifica directory
echo "1️⃣ Verifica directory..."
cd /var/www/ticketapp || exit 1
echo "✅ Directory: $(pwd)"
echo ""

# 2. Verifica ultimo commit
echo "2️⃣ Ultimo commit su VPS:"
git log --oneline -1
echo ""

# 3. Verifica PM2
echo "3️⃣ Stato PM2:"
pm2 status
echo ""

# 4. Verifica log recenti
echo "4️⃣ Ultimi log backend (ultime 20 righe):"
pm2 logs ticketapp-backend --lines 20 --nostream
echo ""

# 5. Test endpoint backend
echo "5️⃣ Test backend (localhost:3001):"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3001/api/crypto/dashboard || echo "❌ Backend non risponde"
echo ""

# 6. Verifica file modificato
echo "6️⃣ Verifica file cryptoRoutes.js:"
if [ -f "backend/routes/cryptoRoutes.js" ]; then
    echo "✅ File cryptoRoutes.js presente"
    echo "📝 Ultima modifica: $(stat -c %y backend/routes/cryptoRoutes.js | cut -d'.' -f1)"
else
    echo "❌ File cryptoRoutes.js non trovato"
fi
echo ""

echo "✅ ========== VERIFICA COMPLETATA =========="
