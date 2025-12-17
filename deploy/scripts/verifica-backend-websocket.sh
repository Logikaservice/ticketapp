#!/bin/bash

# Script per verificare backend e WebSocket
echo "🔍 VERIFICA BACKEND E WEBSOCKET"
echo "=========================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verifica se il backend è in esecuzione
echo -e "${YELLOW}📋 1. Verifica backend...${NC}"
if pgrep -f "node.*backend.*index.js" > /dev/null || pgrep -f "node.*3001" > /dev/null; then
    echo -e "${GREEN}✅ Backend in esecuzione!${NC}"
    ps aux | grep -E "node.*backend|node.*3001" | grep -v grep
else
    echo -e "${RED}❌ Backend NON in esecuzione!${NC}"
    echo "Avvia il backend con:"
    echo "  cd /var/www/ticketapp/backend"
    echo "  pm2 start index.js --name ticketapp-backend"
    echo "  oppure"
    echo "  node index.js"
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

# 3. Test connessione HTTP al backend
echo -e "${YELLOW}📋 3. Test connessione HTTP backend...${NC}"
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health 2>/dev/null || echo "000")
if [ "$HTTP_RESPONSE" = "200" ] || [ "$HTTP_RESPONSE" = "401" ] || [ "$HTTP_RESPONSE" = "404" ]; then
    echo -e "${GREEN}✅ Backend risponde (HTTP $HTTP_RESPONSE)${NC}"
else
    echo -e "${RED}❌ Backend NON risponde (HTTP $HTTP_RESPONSE)${NC}"
fi
echo ""

# 4. Verifica configurazione nginx
echo -e "${YELLOW}📋 4. Verifica configurazione nginx...${NC}"
if nginx -t 2>&1 | grep -q "syntax is ok"; then
    echo -e "${GREEN}✅ Configurazione nginx valida!${NC}"
else
    echo -e "${RED}❌ Errore nella configurazione nginx!${NC}"
    nginx -t
fi
echo ""

# 5. Verifica se nginx è in esecuzione
echo -e "${YELLOW}📋 5. Verifica nginx...${NC}"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx in esecuzione!${NC}"
else
    echo -e "${RED}❌ Nginx NON in esecuzione!${NC}"
    echo "Avvia nginx con: sudo systemctl start nginx"
fi
echo ""

# 6. Verifica configurazione Socket.IO in nginx
echo -e "${YELLOW}📋 6. Verifica configurazione Socket.IO in nginx...${NC}"
if grep -q "location /socket.io/" /etc/nginx/sites-available/ticketapp.conf; then
    echo -e "${GREEN}✅ Configurazione Socket.IO presente in nginx!${NC}"
    echo "Configurazione:"
    grep -A 15 "location /socket.io/" /etc/nginx/sites-available/ticketapp.conf | head -15
else
    echo -e "${RED}❌ Configurazione Socket.IO NON trovata in nginx!${NC}"
fi
echo ""

echo -e "${YELLOW}💡 Se il backend non è in esecuzione, avvialo con:${NC}"
echo "  cd /var/www/ticketapp/backend"
echo "  pm2 start index.js --name ticketapp-backend"
echo "  oppure"
echo "  pm2 restart ticketapp-backend"
echo ""

