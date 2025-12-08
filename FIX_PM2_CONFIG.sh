#!/bin/bash
# Script per riconfigurare PM2 correttamente

echo "🔧 RICONFIGURAZIONE PM2"
echo "======================="
echo ""

cd /var/www/ticketapp/backend || {
    echo "❌ Directory /var/www/ticketapp/backend non trovata"
    exit 1
}

# 1. Ferma il processo PM2 esistente
echo "1. Fermo processo PM2 esistente..."
pm2 delete ticketapp-backend 2>/dev/null || pm2 delete backend 2>/dev/null || echo "Nessun processo da fermare"
echo ""

# 2. Verifica che il file .env esista
echo "2. Verifica file .env..."
if [ -f ".env" ]; then
    echo "✅ File .env trovato"
    echo "Variabili d'ambiente presenti:"
    cat .env | grep -E "^[A-Z_]+=" | cut -d'=' -f1 | head -10
else
    echo "⚠️  File .env non trovato!"
    echo "Creo file .env base..."
    echo "NODE_ENV=production" > .env
    echo "PORT=3001" >> .env
    echo "✅ File .env creato (configura le variabili necessarie)"
fi
echo ""

# 3. Verifica percorso assoluto
BACKEND_DIR=$(pwd)
echo "3. Directory backend: $BACKEND_DIR"
echo ""

# 4. Avvia PM2 con configurazione corretta
echo "4. Avvio PM2 con configurazione corretta..."
pm2 start index.js \
    --name ticketapp-backend \
    --cwd "$BACKEND_DIR" \
    --interpreter node \
    --env production \
    --log-date-format "YYYY-MM-DD HH:mm:ss Z" \
    --merge-logs \
    --error /var/log/pm2/ticketapp-backend-error.log \
    --output /var/log/pm2/ticketapp-backend-out.log

# 5. Salva configurazione PM2
echo ""
echo "5. Salvo configurazione PM2..."
pm2 save
echo ""

# 6. Attendi 3 secondi
sleep 3

# 7. Verifica stato
echo "6. Verifica stato..."
pm2 status
echo ""

# 8. Test endpoint
echo "7. Test endpoint..."
sleep 2
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000")
CRYPTO=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/crypto/dashboard || echo "000")

echo "   Health check: HTTP $HEALTH"
echo "   Crypto dashboard: HTTP $CRYPTO"
echo ""

if [ "$HEALTH" = "200" ]; then
    echo "✅ Backend funziona correttamente!"
else
    echo "⚠️  Backend potrebbe avere ancora problemi"
    echo "   Controlla i log: pm2 logs ticketapp-backend --lines 50"
fi

echo ""
echo "✅ Configurazione PM2 completata!"
echo ""
echo "📋 Comandi utili:"
echo "   pm2 status              - Verifica stato"
echo "   pm2 logs ticketapp-backend - Vedi log"
echo "   pm2 restart ticketapp-backend - Riavvia"
