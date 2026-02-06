#!/bin/bash
# Script per diagnosticare il problema 404 della route Office

echo "🔍 DIAGNOSTICA 404 ROUTE OFFICE"
echo "================================"
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Verifica backend attivo
echo -e "${BLUE}1️⃣ Verifica backend attivo...${NC}"
BACKEND_PROCESS=$(pm2 list | grep -E "backend|ticketapp-backend" | awk '{print $2}' | head -1)
if [ -z "$BACKEND_PROCESS" ]; then
  echo -e "${RED}❌ Nessun processo backend trovato!${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Processo: $BACKEND_PROCESS${NC}"
pm2 status | grep -E "backend|ticketapp-backend"
echo ""

# 2. Verifica backend in ascolto sulla porta 3001
echo -e "${BLUE}2️⃣ Verifica backend in ascolto su porta 3001...${NC}"
if netstat -tlnp 2>/dev/null | grep -q ":3001" || ss -tlnp 2>/dev/null | grep -q ":3001"; then
  echo -e "${GREEN}✅ Backend in ascolto su porta 3001${NC}"
  netstat -tlnp 2>/dev/null | grep ":3001" || ss -tlnp 2>/dev/null | grep ":3001"
else
  echo -e "${RED}❌ Backend NON in ascolto su porta 3001!${NC}"
fi
echo ""

# 3. Test connessione diretta al backend
echo -e "${BLUE}3️⃣ Test connessione diretta al backend...${NC}"
if curl -s http://localhost:3001/api/keepalive > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Backend risponde su localhost:3001${NC}"
  curl -s http://localhost:3001/api/keepalive | head -3
else
  echo -e "${RED}❌ Backend NON risponde su localhost:3001!${NC}"
  echo "Errore:"
  curl -v http://localhost:3001/api/keepalive 2>&1 | head -10
fi
echo ""

# 4. Test route Office direttamente
echo -e "${BLUE}4️⃣ Test route Office direttamente (con token di test)...${NC}"
# Nota: questo fallirà per autenticazione, ma dovremmo vedere se arriva al backend
TEST_URL="http://localhost:3001/api/keepass/office/Smil%20Service"
echo "URL test: $TEST_URL"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_URL" 2>&1)
echo "Status code: $RESPONSE"
if [ "$RESPONSE" = "401" ] || [ "$RESPONSE" = "403" ]; then
  echo -e "${GREEN}✅ La richiesta arriva al backend (401/403 = autenticazione richiesta)${NC}"
elif [ "$RESPONSE" = "404" ]; then
  echo -e "${RED}❌ La richiesta NON arriva al backend (404 = route non trovata)${NC}"
else
  echo -e "${YELLOW}⚠️ Status code inaspettato: $RESPONSE${NC}"
fi
echo ""

# 5. Verifica configurazione nginx
echo -e "${BLUE}5️⃣ Verifica configurazione nginx...${NC}"
NGINX_CONF="/etc/nginx/sites-enabled/ticketapp.conf"
if [ ! -f "$NGINX_CONF" ]; then
  NGINX_CONF="/etc/nginx/sites-enabled/default"
fi
if [ -f "$NGINX_CONF" ]; then
  echo -e "${GREEN}✅ File nginx trovato: $NGINX_CONF${NC}"
  echo "Configurazione location /api/:"
  grep -A 10 "location /api" "$NGINX_CONF" | head -15
else
  echo -e "${YELLOW}⚠️ File nginx non trovato${NC}"
fi
echo ""

# 6. Test attraverso nginx
echo -e "${BLUE}6️⃣ Test attraverso nginx (localhost)...${NC}"
NGINX_TEST="http://localhost/api/keepass/office/Smil%20Service"
echo "URL test: $NGINX_TEST"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$NGINX_TEST" 2>&1)
echo "Status code: $RESPONSE"
if [ "$RESPONSE" = "401" ] || [ "$RESPONSE" = "403" ]; then
  echo -e "${GREEN}✅ La richiesta passa attraverso nginx e arriva al backend${NC}"
elif [ "$RESPONSE" = "404" ]; then
  echo -e "${RED}❌ Nginx restituisce 404 (problema di routing)${NC}"
else
  echo -e "${YELLOW}⚠️ Status code: $RESPONSE${NC}"
fi
echo ""

# 7. Verifica log nginx
echo -e "${BLUE}7️⃣ Ultime 10 richieste API nei log nginx...${NC}"
if [ -f "/var/log/nginx/access.log" ]; then
  tail -20 /var/log/nginx/access.log | grep "/api" | tail -10 || echo "Nessuna richiesta API trovata"
else
  echo -e "${YELLOW}⚠️ File log nginx non trovato${NC}"
fi
echo ""

# 8. Verifica errori nginx
echo -e "${BLUE}8️⃣ Ultimi errori nginx...${NC}"
if [ -f "/var/log/nginx/error.log" ]; then
  tail -20 /var/log/nginx/error.log | grep -iE "(error|404|proxy)" | tail -10 || echo "Nessun errore trovato"
else
  echo -e "${YELLOW}⚠️ File error log nginx non trovato${NC}"
fi
echo ""

# 9. Verifica codice backend
echo -e "${BLUE}9️⃣ Verifica codice backend...${NC}"
cd /var/www/ticketapp 2>/dev/null || cd /root/TicketApp 2>/dev/null || {
  echo -e "${YELLOW}⚠️ Directory progetto non trovata${NC}"
  exit 0
}

if grep -q "router.get('/office/:aziendaName'" backend/routes/keepass.js 2>/dev/null; then
  echo -e "${GREEN}✅ Route Office definita nel codice${NC}"
else
  echo -e "${RED}❌ Route Office NON trovata nel codice!${NC}"
fi

if grep -q "RICHIESTA OFFICE RICEVUTA" backend/routes/keepass.js 2>/dev/null; then
  echo -e "${GREEN}✅ Logging presente nel codice${NC}"
else
  echo -e "${RED}❌ Logging NON presente nel codice!${NC}"
  echo "Esegui: git pull origin main"
fi
echo ""

# 10. Riepilogo
echo -e "${BLUE}🔟 RIEPILOGO${NC}"
echo "=========="
echo "Se vedi 404 ma nessun log nel backend, il problema è probabilmente:"
echo "1. Nginx non fa proxy_pass correttamente"
echo "2. Il backend non è in ascolto sulla porta 3001"
echo "3. C'è un problema con la configurazione nginx"
echo ""
echo -e "${YELLOW}💡 PROSSIMI PASSI:${NC}"
echo "1. Verifica che il backend sia attivo: pm2 status"
echo "2. Verifica che il backend risponda: curl http://localhost:3001/api/keepalive"
echo "3. Riavvia nginx: sudo systemctl reload nginx"
echo "4. Controlla i log nginx: sudo tail -f /var/log/nginx/error.log"
