#!/bin/bash
# Deploy manuale sul VPS (stessi passi del workflow GitHub Actions)
# Uso: connettiti in SSH al VPS, poi: cd /var/www/ticketapp && bash scripts/deploy-on-vps.sh

set -e

echo "🚀 Deploy TicketApp..."
cd /var/www/ticketapp

echo "📥 Git pull..."
git clean -fd || true
git fetch origin main
git reset --hard origin/main

echo "📦 Backend dependencies..."
cd /var/www/ticketapp/backend
npm install --production --silent || npm install --production
cd /var/www/ticketapp

echo "📦 Frontend dependencies..."
cd /var/www/ticketapp/frontend
rm -rf build || true
npm install --silent || npm install
echo "REACT_APP_API_URL=" > .env
echo "GENERATE_SOURCEMAP=false" >> .env
CI=false npm run build
cd /var/www/ticketapp

echo "🔄 Restart services..."
pm2 restart ticketapp-backend || pm2 restart all || pm2 start backend/index.js --name ticketapp-backend || true
sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload 2>/dev/null || true

echo "✅ Deploy completato!"
