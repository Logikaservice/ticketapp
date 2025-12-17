#!/bin/bash

# Script per risolvere il problema dei PM2 duplicati
echo "🔧 FIX PM2 DUPLICATI"
echo "=========================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Ferma TUTTI i daemon PM2
echo -e "${YELLOW}📋 1. Fermo tutti i daemon PM2...${NC}"
pm2 kill 2>/dev/null || true
sleep 2

# Verifica che siano tutti fermati
PM2_PIDS=$(pgrep -f "PM2.*God Daemon" || echo "")
if [ -n "$PM2_PIDS" ]; then
    echo -e "${YELLOW}⚠️  Alcuni daemon PM2 ancora attivi, forzo terminazione...${NC}"
    for PID in $PM2_PIDS; do
        kill -9 $PID 2>/dev/null || true
    done
    sleep 1
fi

echo -e "${GREEN}✅ Tutti i daemon PM2 fermati!${NC}"
echo ""

# 2. Ferma tutti i processi node backend
echo -e "${YELLOW}📋 2. Fermo tutti i processi node backend...${NC}"
pkill -9 -f "node.*backend" 2>/dev/null || true
pkill -9 -f "node.*index.js" 2>/dev/null || true
sleep 2
echo -e "${GREEN}✅ Tutti i processi node backend fermati!${NC}"
echo ""

# 3. Rimuovi dump PM2
echo -e "${YELLOW}📋 3. Rimuovo dump PM2...${NC}"
rm -f /root/.pm2/dump.pm2 2>/dev/null || true
echo -e "${GREEN}✅ Dump PM2 rimosso!${NC}"
echo ""

# 4. Backup e rimuovi ecosystem.config.json
echo -e "${YELLOW}📋 4. Gestione ecosystem.config.json...${NC}"
if [ -f "/var/www/ticketapp/ecosystem.config.json" ]; then
    echo "File trovato: /var/www/ticketapp/ecosystem.config.json"
    echo "Creo backup..."
    cp /var/www/ticketapp/ecosystem.config.json /var/www/ticketapp/ecosystem.config.json.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${YELLOW}⚠️  Rimuovo ecosystem.config.json per evitare auto-riavvio...${NC}"
    mv /var/www/ticketapp/ecosystem.config.json /var/www/ticketapp/ecosystem.config.json.disabled
    echo -e "${GREEN}✅ ecosystem.config.json disabilitato (backup creato)${NC}"
else
    echo -e "${GREEN}✅ Nessun ecosystem.config.json trovato${NC}"
fi
echo ""

# 5. Verifica che la porta 3001 sia libera
echo -e "${YELLOW}📋 5. Verifica porta 3001...${NC}"
PID_3001=$(lsof -ti:3001 2>/dev/null || echo "")
if [ -n "$PID_3001" ]; then
    echo -e "${RED}❌ Porta 3001 ancora in uso da PID: $PID_3001${NC}"
    kill -9 $PID_3001 2>/dev/null || true
    sleep 1
fi

if netstat -tuln | grep -q ":3001 "; then
    echo -e "${RED}❌ Porta 3001 ancora in uso!${NC}"
    fuser -k 3001/tcp 2>/dev/null || true
    sleep 1
else
    echo -e "${GREEN}✅ Porta 3001 libera!${NC}"
fi
echo ""

# 6. Attendi per verificare che non si riavviino
echo -e "${YELLOW}📋 6. Attendo 5 secondi per verificare che non si riavviino...${NC}"
sleep 5

REMAINING=$(ps aux | grep -E "node.*backend|node.*index.js" | grep -v grep | grep -v "grep" | wc -l)
if [ "$REMAINING" -eq 0 ]; then
    echo -e "${GREEN}✅ Nessun processo si è riavviato automaticamente!${NC}"
else
    echo -e "${RED}❌ Processi si sono ancora riavviati ($REMAINING processi)!${NC}"
    ps aux | grep -E "node.*backend|node.*index.js" | grep -v grep
    echo ""
    echo -e "${YELLOW}⚠️  C'è ancora qualcosa che riavvia i processi!${NC}"
    exit 1
fi
echo ""

# 7. Avvia un solo daemon PM2
echo -e "${YELLOW}🚀 7. Avvio un solo daemon PM2...${NC}"
cd /var/www/ticketapp/backend

if [ ! -f "index.js" ]; then
    echo -e "${RED}❌ File index.js non trovato in /var/www/ticketapp/backend!${NC}"
    exit 1
fi

# Avvia PM2 daemon
pm2 start index.js --name ticketapp-backend
pm2 save

echo -e "${GREEN}✅ Backend avviato con PM2!${NC}"
echo ""

# 8. Verifica
echo -e "${YELLOW}🔍 8. Verifica finale...${NC}"
sleep 3

# Verifica daemon PM2 (dovrebbe esserci solo uno)
PM2_DAEMONS=$(pgrep -f "PM2.*God Daemon" | wc -l)
if [ "$PM2_DAEMONS" -eq 1 ]; then
    echo -e "${GREEN}✅ Un solo daemon PM2 in esecuzione!${NC}"
else
    echo -e "${YELLOW}⚠️  $PM2_DAEMONS daemon PM2 trovati (dovrebbe essere 1)${NC}"
fi

# Verifica processi PM2
pm2 list
echo ""

# Verifica processi node
REMAINING=$(ps aux | grep -E "node.*backend|node.*index.js" | grep -v grep | grep -v "grep" | wc -l)
if [ "$REMAINING" -eq 1 ]; then
    echo -e "${GREEN}✅ Solo un processo backend in esecuzione!${NC}"
else
    echo -e "${YELLOW}⚠️  $REMAINING processi backend trovati (dovrebbe essere 1)${NC}"
    ps aux | grep -E "node.*backend|node.*index.js" | grep -v grep
fi

# Verifica risposta HTTP
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health 2>/dev/null || echo "000")
if [ "$HTTP_RESPONSE" = "200" ] || [ "$HTTP_RESPONSE" = "401" ] || [ "$HTTP_RESPONSE" = "404" ]; then
    echo -e "${GREEN}✅ Backend risponde (HTTP $HTTP_RESPONSE)${NC}"
else
    echo -e "${RED}❌ Backend NON risponde (HTTP $HTTP_RESPONSE)${NC}"
fi

echo ""
echo -e "${GREEN}✅✅✅ FIX COMPLETATO! ✅✅✅${NC}"
echo ""
echo "Se vuoi riabilitare ecosystem.config.json in futuro:"
echo "  mv /var/www/ticketapp/ecosystem.config.json.disabled /var/www/ticketapp/ecosystem.config.json"
echo "  pm2 start ecosystem.config.json"
echo ""

