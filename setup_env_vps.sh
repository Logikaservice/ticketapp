#!/bin/bash

# Script per configurare il file .env sulla VPS
# Esegui questo script SULLA VPS

echo "🔧 CONFIGURAZIONE FILE .ENV SU VPS"
echo "=========================================="
echo ""

PROJECT_DIR="/var/www/ticketapp/TicketApp/backend"

cd $PROJECT_DIR

# Copia il file .env.production come .env
if [ -f ".env.production" ]; then
    echo "✅ File .env.production trovato"
    cp .env.production .env
    echo "✅ Copiato in .env"
else
    echo "❌ File .env.production non trovato!"
    echo "Creazione manuale del file .env..."
    
    cat > .env << 'EOF'
# Database principale
DATABASE_URL=postgresql://postgres:TicketApp2025!Secure@localhost:5432/ticketapp

# Database crypto (isolato)
DATABASE_URL_CRYPTO=postgresql://postgres:TicketApp2025!Secure@localhost:5432/crypto_db

# Database Vivaldi (opzionale)
DATABASE_URL_VIVALDI=postgresql://postgres:TicketApp2025!Secure@localhost:5432/vivaldi_db

# Binance API
BINANCE_API_KEY=PzOk2ocCOqwjHqRGgCOBOvVPtMPZmWKKBqKhWbvwJhiJRLmQlVbFqcyqCOCvmODc
BINANCE_API_SECRET=cLAoKBP5lxVMfVbVEqYQCnWdlZbPPMhqLBxQOZlqCOCvmODcOqwjHqRGgCOB

# Modalità Binance
BINANCE_MODE=testnet

# Porta backend
PORT=3001

# Node environment
NODE_ENV=production

# JWT Secret
JWT_SECRET=TicketApp2025SecureJWTSecret!RandomString123

# CORS Origins
ALLOWED_ORIGINS=https://ticket.logikaservice.it,https://logikaservice.it
EOF
    
    echo "✅ File .env creato manualmente"
fi

echo ""
echo "📋 Verifica configurazione:"
echo "----------------------------------------"
cat .env | grep -v "SECRET\|PASSWORD" | grep "="

echo ""
echo "🔄 Riavvio backend..."
pm2 restart backend

echo ""
echo "📊 Stato backend:"
pm2 list | grep backend

echo ""
echo "✅ Configurazione completata!"
echo ""
echo "📋 Verifica log con:"
echo "   pm2 logs backend"
