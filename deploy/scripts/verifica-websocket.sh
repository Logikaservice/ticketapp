#!/bin/bash

# Script per verificare connessioni WebSocket
echo "🔍 VERIFICA WEBSOCKET"
echo "=========================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verifica backend
echo -e "${YELLOW}📋 1. Verifica backend...${NC}"
if pm2 list | grep -q "ticketapp-backend.*online"; then
    echo -e "${GREEN}✅ Backend in esecuzione!${NC}"
    pm2 list | grep ticketapp-backend
else
    echo -e "${RED}❌ Backend NON in esecuzione!${NC}"
    exit 1
fi
echo ""

# 2. Verifica porta 3001
echo -e "${YELLOW}📋 2. Verifica porta 3001...${NC}"
if netstat -tuln | grep -q ":3001 "; then
    echo -e "${GREEN}✅ Porta 3001 in ascolto!${NC}"
    netstat -tuln | grep ":3001 "
else
    echo -e "${RED}❌ Porta 3001 NON in ascolto!${NC}"
fi
echo ""

# 3. Test connessione backend
echo -e "${YELLOW}📋 3. Test connessione backend...${NC}"
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health 2>/dev/null || echo "000")
if [ "$HTTP_RESPONSE" = "200" ] || [ "$HTTP_RESPONSE" = "401" ] || [ "$HTTP_RESPONSE" = "404" ]; then
    echo -e "${GREEN}✅ Backend risponde (HTTP $HTTP_RESPONSE)${NC}"
else
    echo -e "${RED}❌ Backend NON risponde (HTTP $HTTP_RESPONSE)${NC}"
fi
echo ""

# 4. Verifica log backend per WebSocket
echo -e "${YELLOW}📋 4. Ultimi log backend (WebSocket)...${NC}"
pm2 logs ticketapp-backend --lines 30 --nostream | grep -E "WebSocket|socket|Socket" | tail -10
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Nessun log WebSocket trovato (potrebbe essere normale se non ci sono connessioni recenti)${NC}"
fi
echo ""

# 5. Verifica configurazione nginx per Socket.IO
echo -e "${YELLOW}📋 5. Verifica configurazione nginx Socket.IO...${NC}"
if grep -q "location /socket.io/" /etc/nginx/sites-available/ticketapp.conf; then
    echo -e "${GREEN}✅ Configurazione Socket.IO presente!${NC}"
    echo "Blocco Socket.IO:"
    grep -A 20 "location /socket.io/" /etc/nginx/sites-available/ticketapp.conf | head -20
else
    echo -e "${RED}❌ Configurazione Socket.IO NON trovata!${NC}"
fi
echo ""

# 6. Test connessione Socket.IO via HTTP
echo -e "${YELLOW}📋 6. Test connessione Socket.IO (HTTP)...${NC}"
SOCKETIO_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/socket.io/ 2>/dev/null || echo "000")
if [ "$SOCKETIO_RESPONSE" = "200" ] || [ "$SOCKETIO_RESPONSE" = "400" ] || [ "$SOCKETIO_RESPONSE" = "401" ]; then
    echo -e "${GREEN}✅ Socket.IO risponde (HTTP $SOCKETIO_RESPONSE)${NC}"
else
    echo -e "${YELLOW}⚠️  Socket.IO risponde con HTTP $SOCKETIO_RESPONSE (potrebbe essere normale)${NC}"
fi
echo ""

# 7. Verifica HTTPS
echo -e "${YELLOW}📋 7. Verifica HTTPS...${NC}"
HTTPS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://ticket.logikaservice.it 2>/dev/null || echo "000")
if [ "$HTTPS_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ HTTPS funziona (HTTP $HTTPS_RESPONSE)${NC}"
else
    echo -e "${RED}❌ HTTPS NON funziona (HTTP $HTTPS_RESPONSE)${NC}"
fi
echo ""

# 8. Verifica porta 443
echo -e "${YELLOW}📋 8. Verifica porta 443...${NC}"
if netstat -tuln | grep -q ":443 "; then
    echo -e "${GREEN}✅ Porta 443 in ascolto!${NC}"
    netstat -tuln | grep ":443 "
else
    echo -e "${RED}❌ Porta 443 NON in ascolto!${NC}"
fi
echo ""

echo -e "${GREEN}✅✅✅ VERIFICA COMPLETATA! ✅✅✅${NC}"
echo ""
echo "Per vedere i log WebSocket in tempo reale:"
echo "  pm2 logs ticketapp-backend"
echo ""
echo "Per testare WebSocket dal browser:"
echo "  1. Apri https://ticket.logikaservice.it"
echo "  2. Apri la console (F12)"
echo "  3. Verifica se ci sono errori WebSocket"
echo ""

