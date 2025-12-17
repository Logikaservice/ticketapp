#!/bin/bash

# Script per fermare istanze duplicate del backend e avviare una sola istanza con PM2
echo "🔧 FIX ISTANZE BACKEND"
echo "=========================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Trova tutte le istanze del backend
echo -e "${YELLOW}📋 1. Trova istanze backend...${NC}"
INSTANCES=$(pgrep -f "node.*backend.*index.js" || pgrep -f "node.*3001")
if [ -z "$INSTANCES" ]; then
    echo -e "${YELLOW}⚠️  Nessuna istanza backend trovata${NC}"
else
    echo "Istanze trovate:"
    ps aux | grep -E "node.*backend|node.*3001" | grep -v grep
    echo ""
fi

# 2. Ferma tutte le istanze
echo -e "${YELLOW}🛑 2. Fermo tutte le istanze backend...${NC}"
pkill -f "node.*backend.*index.js" || true
pkill -f "node.*3001" || true
sleep 2

# Verifica che siano state fermate
REMAINING=$(pgrep -f "node.*backend.*index.js" || pgrep -f "node.*3001" || echo "")
if [ -z "$REMAINING" ]; then
    echo -e "${GREEN}✅ Tutte le istanze fermate!${NC}"
else
    echo -e "${RED}❌ Alcune istanze sono ancora in esecuzione!${NC}"
    echo "Forza terminazione..."
    pkill -9 -f "node.*backend.*index.js" || true
    pkill -9 -f "node.*3001" || true
    sleep 1
fi
echo ""

# 3. Verifica PM2
echo -e "${YELLOW}📋 3. Verifica PM2...${NC}"
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✅ PM2 installato!${NC}"
    
    # Ferma e rimuovi eventuali processi PM2 esistenti (ticketapp-backend e backend generico)
    pm2 stop ticketapp-backend 2>/dev/null || true
    pm2 delete ticketapp-backend 2>/dev/null || true
    pm2 stop backend 2>/dev/null || true
    pm2 delete backend 2>/dev/null || true
    
    echo "PM2 status (dopo pulizia):"
    pm2 list
    echo ""
else
    echo -e "${YELLOW}⚠️  PM2 non installato${NC}"
    echo "Installa PM2 con: npm install -g pm2"
    echo ""
fi

# 4. Avvia backend con PM2
echo -e "${YELLOW}🚀 4. Avvio backend con PM2...${NC}"
cd /var/www/ticketapp/backend

if [ ! -f "index.js" ]; then
    echo -e "${RED}❌ File index.js non trovato in /var/www/ticketapp/backend!${NC}"
    exit 1
fi

if command -v pm2 &> /dev/null; then
    pm2 start index.js --name ticketapp-backend
    pm2 save
    echo -e "${GREEN}✅ Backend avviato con PM2!${NC}"
    echo ""
    pm2 list
    echo ""
    echo "Comandi utili:"
    echo "  pm2 logs ticketapp-backend    # Vedi i log"
    echo "  pm2 restart ticketapp-backend # Riavvia"
    echo "  pm2 stop ticketapp-backend    # Ferma"
else
    echo -e "${YELLOW}⚠️  PM2 non disponibile, avvio in background...${NC}"
    nohup node index.js > /var/log/ticketapp-backend.log 2>&1 &
    echo -e "${GREEN}✅ Backend avviato in background!${NC}"
    echo "Log in: /var/log/ticketapp-backend.log"
fi
echo ""

# 5. Verifica che il backend risponda
echo -e "${YELLOW}🔍 5. Verifica backend...${NC}"
sleep 3
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health 2>/dev/null || echo "000")
if [ "$HTTP_RESPONSE" = "200" ] || [ "$HTTP_RESPONSE" = "401" ] || [ "$HTTP_RESPONSE" = "404" ]; then
    echo -e "${GREEN}✅ Backend risponde (HTTP $HTTP_RESPONSE)${NC}"
else
    echo -e "${RED}❌ Backend NON risponde (HTTP $HTTP_RESPONSE)${NC}"
    echo "Attendi qualche secondo e verifica con: curl http://127.0.0.1:3001/api/health"
fi
echo ""

echo -e "${GREEN}✅✅✅ FIX COMPLETATO! ✅✅✅${NC}"
echo ""

