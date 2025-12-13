#!/bin/bash
# Script completo per fix errori 502 - Da eseguire sulla VPS

set -e

echo "🔧 FIX ERRORI 502 - BACKEND NON RAGGIUNGIBILE"
echo "=============================================="
echo ""

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKEND_DIR="/var/www/ticketapp/backend"

# 1. Verifica directory
echo "1️⃣ Verifica directory backend..."
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Directory backend non trovata: $BACKEND_DIR${NC}"
    exit 1
fi
cd "$BACKEND_DIR"
echo -e "${GREEN}✅ Directory: $BACKEND_DIR${NC}"
echo ""

# 2. Verifica file .env
echo "2️⃣ Verifica file .env..."
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  File .env non trovato!${NC}"
    echo "Creo file .env base..."
    echo "NODE_ENV=production" > .env
    echo "PORT=3001" >> .env
    echo -e "${GREEN}✅ File .env creato${NC}"
else
    echo -e "${GREEN}✅ File .env trovato${NC}"
fi
echo ""

# 3. Ferma processi esistenti
echo "3️⃣ Fermo processi esistenti..."
# Ferma PM2
pm2 delete ticketapp-backend 2>/dev/null || pm2 delete backend 2>/dev/null || echo "Nessun processo PM2 da fermare"
# Ferma processi Node sulla porta 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
sleep 2
echo -e "${GREEN}✅ Processi fermati${NC}"
echo ""

# 4. Verifica dipendenze
echo "4️⃣ Verifica dipendenze..."
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules non trovato, installo dipendenze...${NC}"
    npm install
fi
echo -e "${GREEN}✅ Dipendenze verificate${NC}"
echo ""

# 5. Avvia backend con PM2
echo "5️⃣ Avvio backend con PM2..."
pm2 start index.js \
    --name ticketapp-backend \
    --cwd "$BACKEND_DIR" \
    --interpreter node \
    --env production \
    --log-date-format "YYYY-MM-DD HH:mm:ss Z" \
    --merge-logs \
    --max-memory-restart 500M \
    --error /var/log/pm2/ticketapp-backend-error.log \
    --output /var/log/pm2/ticketapp-backend-out.log

pm2 save
echo -e "${GREEN}✅ Backend avviato${NC}"
echo ""

# 6. Attendi avvio
echo "6️⃣ Attendo avvio backend (5 secondi)..."
sleep 5
echo ""

# 7. Verifica stato
echo "7️⃣ Verifica stato..."
pm2 status
echo ""

# 8. Verifica porta 3001
echo "8️⃣ Verifica porta 3001..."
if netstat -tuln | grep -q ":3001 " || ss -tuln | grep -q ":3001 "; then
    echo -e "${GREEN}✅ Porta 3001 in ascolto${NC}"
else
    echo -e "${RED}❌ Porta 3001 NON in ascolto!${NC}"
    echo "Verifica log per errori:"
    pm2 logs ticketapp-backend --lines 30 --nostream
    exit 1
fi
echo ""

# 9. Test endpoint
echo "9️⃣ Test endpoint backend..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3001/api/health 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ Health check: HTTP $HEALTH${NC}"
else
    echo -e "${YELLOW}⚠️  Health check: HTTP $HEALTH${NC}"
fi

CRYPTO=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3001/api/crypto/dashboard 2>/dev/null || echo "000")
if [ "$CRYPTO" = "200" ] || [ "$CRYPTO" = "401" ] || [ "$CRYPTO" = "403" ]; then
    echo -e "${GREEN}✅ Crypto dashboard: HTTP $CRYPTO${NC}"
else
    echo -e "${YELLOW}⚠️  Crypto dashboard: HTTP $CRYPTO${NC}"
fi
echo ""

# 10. Mostra log recenti
echo "🔟 Ultimi log backend:"
pm2 logs ticketapp-backend --lines 20 --nostream
echo ""

# 11. Riepilogo
echo "=============================================="
echo "📋 RIEPILOGO"
echo "=============================================="
if netstat -tuln | grep -q ":3001 " || ss -tuln | grep -q ":3001 "; then
    echo -e "${GREEN}✅ Backend avviato correttamente${NC}"
    echo ""
    echo "Prossimi passi:"
    echo "1. Ricarica il dashboard nel browser (Ctrl+Shift+R)"
    echo "2. Verifica che non ci siano più errori 502"
    echo "3. Se persistono errori, controlla i log:"
    echo "   pm2 logs ticketapp-backend --lines 100"
else
    echo -e "${RED}❌ Backend NON avviato correttamente${NC}"
    echo ""
    echo "Verifica errori:"
    echo "  pm2 logs ticketapp-backend --err --lines 50"
    echo "  tail -50 /var/log/pm2/ticketapp-backend-error.log"
    echo ""
    echo "Prova ad avviare manualmente per vedere errori:"
    echo "  cd $BACKEND_DIR"
    echo "  node index.js"
fi
echo ""

