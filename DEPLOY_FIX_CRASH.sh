#!/bin/bash
# Script per deploy fix crash backend Vivaldi

echo "🔧 Deploy Fix Crash Backend..."
echo ""

# Vai nella directory del progetto
cd /var/www/ticketapp || exit 1

# Pull delle modifiche
echo "1. Aggiornamento codice da GitHub..."
git pull origin main

# Verifica che il file sia stato aggiornato
if grep -q "if (vivaldiRoutes)" backend/index.js; then
    echo "✅ Fix trovato nel codice"
else
    echo "❌ Fix NON trovato! Verifica che le modifiche siano state pushate su GitHub"
    exit 1
fi

# Riavvia backend
echo ""
echo "2. Riavvio backend..."
pm2 restart ticketapp-backend

# Attendi 3 secondi
sleep 3

# Verifica stato
echo ""
echo "3. Verifica stato backend..."
pm2 status

# Verifica log per errori
echo ""
echo "4. Ultimi log backend (cerca errori)..."
pm2 logs ticketapp-backend --lines 20 --nostream

# Test endpoint
echo ""
echo "5. Test endpoint crypto..."
curl -s http://localhost:3001/api/crypto/dashboard | head -c 200
echo ""

echo ""
echo "✅ Deploy completato!"
echo ""
echo "Se vedi ancora errori 502, controlla i log con:"
echo "  pm2 logs ticketapp-backend --lines 50"
