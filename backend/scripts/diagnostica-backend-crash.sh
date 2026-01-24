#!/bin/bash
# Script per diagnosticare crash del backend

echo "🔍 DIAGNOSTICA BACKEND - VERIFICA CRASH"
echo "========================================"
echo ""

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Verifica stato PM2
echo "1️⃣  STATO PM2:"
echo "---------------"
if command -v pm2 &> /dev/null; then
    pm2 list
    echo ""
    
    if pm2 list | grep -q "ticketapp-backend\|backend"; then
        echo -e "${GREEN}✅ Backend trovato in PM2${NC}"
        
        # Verifica se è online
        if pm2 list | grep -q "online"; then
            echo -e "${GREEN}✅ Backend risulta ONLINE${NC}"
        else
            echo -e "${RED}❌ Backend NON è online!${NC}"
        fi
    else
        echo -e "${RED}❌ Backend NON trovato in PM2!${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 non installato${NC}"
fi
echo ""

# 2. Verifica log errori recenti
echo "2️⃣  LOG ERRORI RECENTI (ultimi 50):"
echo "-------------------------------------"
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "ticketapp-backend\|backend"; then
        echo -e "${BLUE}Log errori backend:${NC}"
        pm2 logs ticketapp-backend --err --lines 50 --nostream 2>/dev/null || \
        pm2 logs backend --err --lines 50 --nostream 2>/dev/null || \
        echo -e "${YELLOW}⚠️  Nessun log errore trovato${NC}"
    fi
fi
echo ""

# 3. Verifica log output recenti
echo "3️⃣  LOG OUTPUT RECENTI (ultimi 50):"
echo "-------------------------------------"
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "ticketapp-backend\|backend"; then
        echo -e "${BLUE}Log output backend:${NC}"
        pm2 logs ticketapp-backend --lines 50 --nostream 2>/dev/null || \
        pm2 logs backend --lines 50 --nostream 2>/dev/null || \
        echo -e "${YELLOW}⚠️  Nessun log output trovato${NC}"
        echo -e "${BLUE}Cerca: 'Connessione al database riuscita!' e 'in ascolto sulla porta 3001'. Se manca il secondo: blocco in init. Se vedi 'EADDRINUSE' o 'address already in use :::3001': porta 3001 occupata (fuser -k 3001/tcp, pm2 delete eventuale duplicato).${NC}"
    fi
fi
echo ""

# 4. Verifica porta 3001 (prima del curl: se non in ascolto, curl darà Connection refused)
echo "4️⃣  VERIFICA PORTA 3001:"
echo "------------------------"
PORT_CHECK=""
if command -v ss &> /dev/null; then
    PORT_CHECK=$(ss -tlnp 2>/dev/null | grep ":3001")
elif command -v netstat &> /dev/null; then
    PORT_CHECK=$(netstat -tlnp 2>/dev/null | grep ":3001")
fi
if [ -n "$PORT_CHECK" ]; then
    echo -e "${GREEN}✅ Porta 3001 in ascolto${NC}"
    echo "$PORT_CHECK"
else
    echo -e "${RED}❌ Porta 3001 NON in ascolto (server.listen non ancora eseguito o backend non avviato)${NC}"
fi
echo ""

# 5. Test connessione backend (con -v per distinguere Connection refused / timeout)
echo "5️⃣  TEST CONNESSIONE BACKEND:"
echo "------------------------------"
echo -e "${BLUE}Test endpoint /api/health (curl -s):${NC}"
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" --connect-timeout 5 http://127.0.0.1:3001/api/health 2>&1)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$HEALTH_RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Backend risponde correttamente (HTTP $HTTP_CODE)${NC}"
    echo "Risposta: $BODY"
else
    echo -e "${RED}❌ Backend NON risponde (HTTP: ${HTTP_CODE:-nessuna})${NC}"
    echo "Risposta: $HEALTH_RESPONSE"
    echo -e "${BLUE}Test con curl -v (per vedere Connection refused vs timeout):${NC}"
    curl -v --connect-timeout 5 http://127.0.0.1:3001/api/health 2>&1 | head -20
fi
echo ""

# 6. Verifica sintassi file backend
echo "6️⃣  VERIFICA SINTASSI BACKEND:"
echo "------------------------------"
if [ -f "/var/www/ticketapp/backend/index.js" ]; then
    echo -e "${BLUE}Controllo sintassi index.js...${NC}"
    cd /var/www/ticketapp/backend
    if command -v node &> /dev/null; then
        SYNTAX_CHECK=$(node -c index.js 2>&1)
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Sintassi index.js corretta${NC}"
        else
            echo -e "${RED}❌ Errore sintassi in index.js:${NC}"
            echo "$SYNTAX_CHECK"
        fi
    else
        echo -e "${YELLOW}⚠️  Node.js non trovato${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  File index.js non trovato${NC}"
fi
echo ""

# 7. Riepilogo e suggerimenti
echo "📊 RIEPILOGO:"
echo "-------------"
echo -e "${BLUE}Comandi utili:${NC}"
echo "  pm2 restart ticketapp-backend  # Riavvia backend"
echo "  pm2 logs ticketapp-backend --lines 100 --nostream  # Vedi tutti i log"
echo "  ss -tlnp | grep 3001  # Porta in ascolto?"
echo "  curl -v --connect-timeout 5 http://127.0.0.1:3001/api/health  # Connection refused vs timeout"
echo "  pm2 delete ticketapp-backend && pm2 start index.js --name ticketapp-backend  # Reinstall"
echo -e "${BLUE}Se PM2 e' online ma curl non risponde: DOCS/DIAGNOSTICA_502_ERROR.md (sez. PM2 online / curl senza risposta)${NC}"
echo ""
echo -e "${GREEN}✅ Diagnostica completata!${NC}"

