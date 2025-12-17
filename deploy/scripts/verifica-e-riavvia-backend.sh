#!/bin/bash

# Script per verificare e riavviare il backend
echo "🔍 VERIFICA E RIAVVIA BACKEND"
echo "=========================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verifica stato PM2
echo -e "${YELLOW}📋 1. Stato PM2...${NC}"
pm2 list
echo ""

# 2. Verifica log del backend
echo -e "${YELLOW}📋 2. Ultimi log backend (ultime 20 righe)...${NC}"
pm2 logs ticketapp-backend --lines 20 --nostream
echo ""

# 3. Verifica porta 3001
echo -e "${YELLOW}📋 3. Verifica porta 3001...${NC}"
if netstat -tuln | grep -q ":3001 "; then
    echo -e "${GREEN}✅ Porta 3001 in ascolto!${NC}"
    netstat -tuln | grep ":3001 "
else
    echo -e "${RED}❌ Porta 3001 NON in ascolto!${NC}"
fi
echo ""

# 4. Test connessione
echo -e "${YELLOW}📋 4. Test connessione backend...${NC}"
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health 2>/dev/null || echo "000")
if [ "$HTTP_RESPONSE" = "200" ] || [ "$HTTP_RESPONSE" = "401" ] || [ "$HTTP_RESPONSE" = "404" ]; then
    echo -e "${GREEN}✅ Backend risponde (HTTP $HTTP_RESPONSE)${NC}"
else
    echo -e "${RED}❌ Backend NON risponde (HTTP $HTTP_RESPONSE)${NC}"
fi
echo ""

# 5. Riavvia backend se necessario
if [ "$HTTP_RESPONSE" = "000" ]; then
    echo -e "${YELLOW}🔄 5. Riavvio backend...${NC}"
    cd /var/www/ticketapp/backend
    
    # Verifica che il file esista
    if [ ! -f "index.js" ]; then
        echo -e "${RED}❌ File index.js non trovato in /var/www/ticketapp/backend!${NC}"
        exit 1
    fi
    
    # Ferma e riavvia
    pm2 stop ticketapp-backend 2>/dev/null || true
    pm2 delete ticketapp-backend 2>/dev/null || true
    sleep 2
    
    pm2 start index.js --name ticketapp-backend
    pm2 save
    
    echo -e "${GREEN}✅ Backend riavviato!${NC}"
    echo ""
    
    # Attendi che si avvii
    echo "Attendo 5 secondi per l'avvio..."
    sleep 5
    
    # Verifica di nuovo
    HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health 2>/dev/null || echo "000")
    if [ "$HTTP_RESPONSE" = "200" ] || [ "$HTTP_RESPONSE" = "401" ] || [ "$HTTP_RESPONSE" = "404" ]; then
        echo -e "${GREEN}✅ Backend ora risponde (HTTP $HTTP_RESPONSE)${NC}"
    else
        echo -e "${RED}❌ Backend ancora NON risponde (HTTP $HTTP_RESPONSE)${NC}"
        echo ""
        echo "Controlla i log con:"
        echo "  pm2 logs ticketapp-backend"
    fi
    echo ""
fi

echo -e "${GREEN}✅✅✅ VERIFICA COMPLETATA! ✅✅✅${NC}"
echo ""

