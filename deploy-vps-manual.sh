#!/bin/bash
# Script di deploy manuale per VPS

set -e

echo "🚀 Deploy manuale su VPS..."

cd /var/www/ticketapp || {
  echo "❌ Directory /var/www/ticketapp non trovata"
  exit 1
}

echo "📥 Aggiornamento codice da GitHub..."
git pull origin main || {
  echo "⚠️ Errore git pull, provo a resettare..."
  git fetch origin
  git reset --hard origin/main
}

echo "📦 Installazione dipendenze backend..."
cd backend
npm install --production || npm install

echo "📦 Installazione dipendenze frontend..."
cd ../frontend
npm install

echo "🔧 Configurazione variabili d'ambiente..."
# Se nginx fa proxy per /api/, usa URL vuoto (chiamate relative)
# Altrimenti usa l'URL diretto del backend
echo "REACT_APP_API_URL=" > .env

echo "🔨 Build frontend..."
npm run build || {
  echo "❌ Errore build frontend"
  exit 1
}

echo "🔄 Riavvio servizi..."
# Prova a riavviare il backend
sudo systemctl restart ticketapp-backend 2>/dev/null || \
sudo systemctl restart ticketapp 2>/dev/null || \
sudo systemctl restart node 2>/dev/null || \
echo "⚠️ Servizio backend non trovato, continua..."

# Riavvia nginx
sudo systemctl restart nginx || {
  echo "⚠️ Errore riavvio nginx, provo reload..."
  sudo systemctl reload nginx || echo "⚠️ Impossibile riavviare nginx"
}

echo "✅ Deploy completato!"

