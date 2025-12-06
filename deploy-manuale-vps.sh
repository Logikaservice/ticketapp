#!/bin/bash
# Script completo per deploy manuale VPS con diagnostica

set -e

echo "🚀 ========== DEPLOY MANUALE VPS =========="
echo ""

# 1. Verifica directory
echo "1️⃣ Verifica directory..."
cd /var/www/ticketapp || {
  echo "❌ Directory /var/www/ticketapp non trovata!"
  exit 1
}
echo "✅ Directory OK: $(pwd)"
echo ""

# 2. Verifica git
echo "2️⃣ Verifica git..."
git status
echo ""
echo "📥 Aggiornamento da GitHub..."
git fetch origin
git pull origin main || {
  echo "⚠️ Git pull fallito, eseguo reset forzato..."
  git reset --hard origin/main
}
echo "✅ Codice aggiornato"
echo "Ultimo commit:"
git log --oneline -1
echo ""

# 3. Backend - Installazione dipendenze
echo "3️⃣ Backend - Installazione dipendenze..."
cd /var/www/ticketapp/backend
npm install --production || npm install
echo "✅ Dipendenze backend installate"
echo ""

# 4. Frontend - Build
echo "4️⃣ Frontend - Build..."
cd /var/www/ticketapp/frontend
echo "Pulizia build vecchi e cache..."
# Pulisci TUTTO: build, cache, node_modules/.cache
rm -rf build
rm -rf node_modules/.cache
rm -rf .cache
rm -f .eslintcache
# Forza pulizia cache React
find . -name "*.map" -type f -delete 2>/dev/null || true
echo "Installazione dipendenze..."
npm install
echo "Build frontend (nuovo build completo)..."
npm run build
if [ ! -d "build" ]; then
  echo "❌ Build fallito - directory build non creata!"
  exit 1
fi
echo "✅ Frontend build completato"
echo ""

# 5. Riavvio PM2
echo "5️⃣ Riavvio backend (PM2)..."
cd /var/www/ticketapp
pm2 restart all || {
  echo "⚠️ PM2 restart fallito, provo start..."
  pm2 start backend/index.js --name ticketapp-backend || pm2 start backend/server.js --name ticketapp-backend
}
echo "✅ PM2 riavviato"
pm2 status
echo ""

# 6. Riavvio Nginx
echo "6️⃣ Riavvio Nginx..."
sudo systemctl restart nginx || sudo systemctl reload nginx
echo "✅ Nginx riavviato"
echo ""

# 7. Verifica finale
echo "7️⃣ Verifica finale..."
echo "PM2 Status:"
pm2 status
echo ""
echo "Nginx Status:"
sudo systemctl status nginx --no-pager | head -5
echo ""
echo "Test Backend (localhost:3001):"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3001/ || echo "❌ Backend non risponde"
echo ""

echo "✅ ========== DEPLOY COMPLETATO =========="
echo ""
echo "📝 IMPORTANTE:"
echo "- Svuota cache browser (Ctrl+Shift+R)"
echo "- Verifica che il nuovo BotAnalysisPage.jsx sia nel build"
echo "- Controlla i log: pm2 logs --lines 50"
