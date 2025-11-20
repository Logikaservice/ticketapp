#!/bin/bash
# Script per configurare le variabili d'ambiente del backend sulla VPS

set -e

echo "🔧 Configurazione variabili d'ambiente backend VPS..."

BACKEND_DIR="/var/www/ticketapp/backend"
ENV_FILE="$BACKEND_DIR/.env"

# DATABASE_URL per VPS (PostgreSQL locale)
DATABASE_URL="postgresql://postgres:TicketApp2025!Secure@localhost:5432/ticketapp"

# Crea il file .env se non esiste
if [ ! -f "$ENV_FILE" ]; then
  echo "📝 Creazione file .env..."
  touch "$ENV_FILE"
fi

# Aggiungi o aggiorna DATABASE_URL
if grep -q "DATABASE_URL=" "$ENV_FILE"; then
  echo "🔄 Aggiornamento DATABASE_URL esistente..."
  # Usa sed per sostituire la riga esistente
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" "$ENV_FILE"
else
  echo "➕ Aggiunta DATABASE_URL..."
  echo "DATABASE_URL=$DATABASE_URL" >> "$ENV_FILE"
fi

# Aggiungi altre variabili d'ambiente se non esistono
if ! grep -q "NODE_ENV=" "$ENV_FILE"; then
  echo "NODE_ENV=production" >> "$ENV_FILE"
fi

if ! grep -q "PORT=" "$ENV_FILE"; then
  echo "PORT=3001" >> "$ENV_FILE"
fi

# Genera JWT_SECRET se non esiste
if ! grep -q "JWT_SECRET=" "$ENV_FILE"; then
  echo "🔐 Generazione JWT_SECRET..."
  JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
  echo "JWT_SECRET=$JWT_SECRET" >> "$ENV_FILE"
  echo "✅ JWT_SECRET generato"
fi

echo "✅ File .env configurato:"
echo "📋 Contenuto:"
cat "$ENV_FILE" | grep -v "JWT_SECRET" # Mostra tutto tranne JWT_SECRET per sicurezza
echo "🔐 JWT_SECRET: [NASCOSTO]"

echo ""
echo "✅ Configurazione completata!"
echo "🔄 Riavvia il backend per applicare le modifiche:"
echo "   pm2 restart ticketapp-backend"
echo "   # oppure"
echo "   sudo systemctl restart ticketapp-backend"







