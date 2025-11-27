#!/bin/bash
# Script per configurare DATABASE_URL_VIVALDI nel file .env del backend

set -e

echo "🔧 Configurazione DATABASE_URL_VIVALDI per Vivaldi..."

BACKEND_DIR="/var/www/ticketapp/backend"
ENV_FILE="$BACKEND_DIR/.env"

# Verifica che la directory esista
if [ ! -d "$BACKEND_DIR" ]; then
  echo "❌ Directory $BACKEND_DIR non trovata"
  exit 1
fi

# Crea il file .env se non esiste
if [ ! -f "$ENV_FILE" ]; then
  echo "📝 Creazione file .env..."
  touch "$ENV_FILE"
fi

# DATABASE_URL_VIVALDI per VPS (PostgreSQL locale)
DATABASE_URL_VIVALDI="postgresql://postgres:TicketApp2025!Secure@localhost:5432/vivaldi_db"

# Aggiungi o aggiorna DATABASE_URL_VIVALDI
if grep -q "DATABASE_URL_VIVALDI=" "$ENV_FILE"; then
  echo "🔄 Aggiornamento DATABASE_URL_VIVALDI esistente..."
  # Usa sed per sostituire la riga esistente
  sed -i "s|^DATABASE_URL_VIVALDI=.*|DATABASE_URL_VIVALDI=$DATABASE_URL_VIVALDI|" "$ENV_FILE"
else
  echo "➕ Aggiunta DATABASE_URL_VIVALDI..."
  echo "DATABASE_URL_VIVALDI=$DATABASE_URL_VIVALDI" >> "$ENV_FILE"
fi

echo "✅ DATABASE_URL_VIVALDI configurato:"
grep "DATABASE_URL_VIVALDI" "$ENV_FILE" | sed 's/\(.*\)=\(.*\)/\1=***HIDDEN***/'

echo ""
echo "✅ Configurazione completata!"
echo "🔄 Riavvia il backend per applicare le modifiche:"
echo "   pm2 restart ticketapp-backend"
echo "   # oppure"
echo "   sudo systemctl restart ticketapp-backend"

