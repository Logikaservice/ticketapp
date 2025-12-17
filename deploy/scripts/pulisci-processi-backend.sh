#!/bin/bash

# Script per pulire tutti i processi backend e lasciare solo PM2
echo "🧹 PULIZIA PROCESSI BACKEND"
echo "=========================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Trova tutti i processi node che potrebbero usare la porta 3001
echo -e "${YELLOW}📋 1. Trova processi node...${NC}"
ps aux | grep -E "node.*backend|node.*3001|node.*index.js" | grep -v grep
echo ""

# 2. Trova quale processo sta usando la porta 3001
echo -e "${YELLOW}📋 2. Processo sulla porta 3001...${NC}"
PID_3001=$(lsof -ti:3001 2>/dev/null || fuser 3001/tcp 2>/dev/null | awk '{print $1}' || echo "")
if [ -n "$PID_3001" ]; then
    echo "PID sulla porta 3001: $PID_3001"
    ps -p $PID_3001 -o pid,cmd 2>/dev/null || echo "Processo non trovato"
else
    echo -e "${YELLOW}⚠️  Nessun processo trovato sulla porta 3001 (potrebbe essere già libera)${NC}"
fi
echo ""

# 3. Ferma tutti i processi node backend (tranne quelli gestiti da PM2)
echo -e "${YELLOW}🛑 3. Fermo processi node backend (non PM2)...${NC}"

# Ottieni i PID dei processi PM2
PM2_PIDS=$(pm2 jlist | jq -r '.[] | .pid' 2>/dev/null || echo "")

# Ferma tutti i processi node backend, ma salva quelli di PM2
pkill -f "node.*backend.*index.js" 2>/dev/null || true
pkill -f "node.*3001" 2>/dev/null || true

# Attendi un attimo
sleep 2

# Se c'è ancora un processo sulla porta 3001 e non è di PM2, forzalo
if [ -n "$PID_3001" ]; then
    CURRENT_PID=$(lsof -ti:3001 2>/dev/null || echo "")
    if [ -n "$CURRENT_PID" ]; then
        # Verifica se è un processo PM2
        IS_PM2=$(pm2 jlist | jq -r ".[] | select(.pid == $CURRENT_PID) | .name" 2>/dev/null || echo "")
        if [ -z "$IS_PM2" ]; then
            echo -e "${YELLOW}⚠️  Processo non-PM2 sulla porta 3001, forzo terminazione...${NC}"
            kill -9 $CURRENT_PID 2>/dev/null || true
            sleep 1
        fi
    fi
fi

echo -e "${GREEN}✅ Processi fermati!${NC}"
echo ""

# 4. Verifica stato PM2
echo -e "${YELLOW}📋 4. Stato PM2...${NC}"
pm2 list
echo ""

# 5. Riavvia backend con PM2 se necessario
echo -e "${YELLOW}🔄 5. Riavvio backend con PM2...${NC}"
cd /var/www/ticketapp/backend

if [ ! -f "index.js" ]; then
    echo -e "${RED}❌ File index.js non trovato!${NC}"
    exit 1
fi

pm2 restart ticketapp-backend
pm2 save

echo -e "${GREEN}✅ Backend riavviato!${NC}"
echo ""

# 6. Attendi e verifica
echo "Attendo 5 secondi per l'avvio..."
sleep 5

# 7. Verifica finale
echo -e "${YELLOW}🔍 6. Verifica finale...${NC}"
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health 2>/dev/null || echo "000")
if [ "$HTTP_RESPONSE" = "200" ] || [ "$HTTP_RESPONSE" = "401" ] || [ "$HTTP_RESPONSE" = "404" ]; then
    echo -e "${GREEN}✅ Backend risponde (HTTP $HTTP_RESPONSE)${NC}"
else
    echo -e "${RED}❌ Backend NON risponde (HTTP $HTTP_RESPONSE)${NC}"
fi

# Verifica porta
if netstat -tuln | grep -q ":3001 "; then
    echo -e "${GREEN}✅ Porta 3001 in ascolto!${NC}"
else
    echo -e "${RED}❌ Porta 3001 NON in ascolto!${NC}"
fi

# Verifica processi
REMAINING=$(ps aux | grep -E "node.*backend.*index.js" | grep -v grep | grep -v PM2 | wc -l)
if [ "$REMAINING" -eq 0 ]; then
    echo -e "${GREEN}✅ Nessun processo backend duplicato trovato!${NC}"
else
    echo -e "${YELLOW}⚠️  Ancora $REMAINING processi backend trovati${NC}"
    ps aux | grep -E "node.*backend.*index.js" | grep -v grep
fi

echo ""
echo -e "${GREEN}✅✅✅ PULIZIA COMPLETATA! ✅✅✅${NC}"
echo ""

