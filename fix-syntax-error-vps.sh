#!/bin/bash

# 🔧 Script per fare un hard reset del file cryptoRoutes.js sulla VPS
# Questo risolverà eventuali problemi di corruzione o encoding

echo "🔧 Hard Reset cryptoRoutes.js sulla VPS"
echo "========================================"
echo ""

cd /root/TicketApp || exit 1

# 1. Backup del file corrente (per sicurezza)
echo "📦 1. Backup del file corrente..."
cp backend/routes/cryptoRoutes.js backend/routes/cryptoRoutes.js.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup creato"
echo ""

# 2. Reset hard del file da GitHub
echo "🔄 2. Reset hard del file da GitHub..."
git checkout HEAD -- backend/routes/cryptoRoutes.js
echo "✅ File resettato"
echo ""

# 3. Pull delle modifiche
echo "📥 3. Pull delle modifiche da GitHub..."
git pull origin main
echo "✅ Pull completato"
echo ""

# 4. Verifica che il file non abbia errori di sintassi
echo "🔍 4. Verifica sintassi JavaScript..."
node -c backend/routes/cryptoRoutes.js
if [ $? -eq 0 ]; then
    echo "✅ Sintassi corretta"
else
    echo "❌ ERRORE: Sintassi non valida!"
    echo "   Ripristino backup..."
    cp backend/routes/cryptoRoutes.js.backup.* backend/routes/cryptoRoutes.js
    exit 1
fi
echo ""

# 5. Riavvia il backend
echo "🔄 5. Riavvio del backend..."
pm2 restart ticketapp-backend
echo "✅ Backend riavviato"
echo ""

# 6. Attendi 3 secondi e verifica status
echo "⏳ Attendo 3 secondi..."
sleep 3
echo ""

echo "📊 6. Status PM2..."
pm2 list | grep ticketapp-backend
echo ""

# 7. Mostra ultimi log
echo "📋 7. Ultimi log (20 righe)..."
pm2 logs ticketapp-backend --lines 20 --nostream
echo ""

echo "✅ Reset completato!"
echo ""
echo "🔍 Se vedi ancora errori, esegui:"
echo "   pm2 logs ticketapp-backend --err --lines 50"
echo ""
