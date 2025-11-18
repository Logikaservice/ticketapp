#!/bin/bash
# Script per configurare SendGrid nel .env del backend

echo "📧 CONFIGURAZIONE SENDGRID PER SMTP"
echo "===================================="
echo ""

ENV_FILE="/var/www/ticketapp/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ File .env non trovato in $ENV_FILE"
  exit 1
fi

echo "📝 Inserisci le informazioni SendGrid:"
echo ""

# Chiedi API Key
read -p "🔑 SendGrid API Key (SG.xxxxx): " SENDGRID_API_KEY

if [ -z "$SENDGRID_API_KEY" ]; then
  echo "❌ API Key non può essere vuota"
  exit 1
fi

# Rimuovi eventuali configurazioni SMTP_RELAY esistenti
echo ""
echo "🧹 Rimozione configurazioni SMTP_RELAY esistenti..."
sed -i '/^SMTP_RELAY_/d' "$ENV_FILE"

# Aggiungi configurazione SendGrid
echo ""
echo "➕ Aggiunta configurazione SendGrid..."
cat >> "$ENV_FILE" << EOF

# SendGrid SMTP Relay (per bypassare blocchi provider VPS)
SMTP_RELAY_HOST=smtp.sendgrid.net
SMTP_RELAY_PORT=587
SMTP_RELAY_SECURE=false
SMTP_RELAY_USER=apikey
SMTP_RELAY_PASSWORD=$SENDGRID_API_KEY
EOF

echo ""
echo "✅ Configurazione SendGrid aggiunta al .env"
echo ""
echo "📋 Configurazione:"
echo "   Host: smtp.sendgrid.net"
echo "   Port: 587"
echo "   User: apikey"
echo "   Password: $SENDGRID_API_KEY"
echo ""
echo "🔄 Riavvia il backend:"
echo "   pm2 restart ticketapp-backend"
echo ""
echo "🧪 Testa la configurazione:"
echo "   cd /var/www/ticketapp/backend"
echo "   node scripts/test-email-smtp.js"

