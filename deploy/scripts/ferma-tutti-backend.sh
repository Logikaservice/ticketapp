#!/bin/bash

# Script per fermare TUTTI i processi backend e lasciare solo PM2
echo "🛑 FERMA TUTTI I PROCESSI BACKEND"
echo "=========================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Ferma PM2
echo -e "${YELLOW}📋 1. Fermo PM2 backend...${NC}"
pm2 stop ticketapp-backend 2>/dev/null || true
pm2 delete ticketapp-backend 2>/dev/null || true
echo ""

# 2. Trova e ferma TUTTI i processi node backend
echo -e "${YELLOW}📋 2. Trova tutti i processi node backend...${NC}"
ps aux | grep -E "node.*backend|node.*index.js" | grep -v grep | grep -v "grep"
echo ""

echo -e "${YELLOW}🛑 3. Fermo TUTTI i processi node backend...${NC}"
# Ferma tutti i processi node che potrebbero essere backend
pkill -9 -f "node.*backend" 2>/dev/null || true
pkill -9 -f "node.*index.js" 2>/dev/null || true

# Attendi
sleep 2

# Forza terminazione se necessario
PIDS=$(pgrep -f "node.*backend" 2>/dev/null || pgrep -f "node.*index.js" 2>/dev/null || echo "")
if [ -n "$PIDS" ]; then
    echo -e "${YELLOW}⚠️  Processi ancora attivi, forzo terminazione...${NC}"
    for PID in $PIDS; do
        kill -9 $PID 2>/dev/null || true
    done
    sleep 1
fi

echo -e "${GREEN}✅ Tutti i processi fermati!${NC}"
echo ""

# 3. Verifica che la porta 3001 sia libera
echo -e "${YELLOW}📋 4. Verifica porta 3001...${NC}"
PID_3001=$(lsof -ti:3001 2>/dev/null || echo "")
if [ -n "$PID_3001" ]; then
    echo -e "${RED}❌ Porta 3001 ancora in uso da PID: $PID_3001${NC}"
    kill -9 $PID_3001 2>/dev/null || true
    sleep 1
else
    echo -e "${GREEN}✅ Porta 3001 libera!${NC}"
fi
echo ""

# 4. Verifica che non ci siano più processi
echo -e "${YELLOW}📋 5. Verifica processi rimanenti...${NC}"
REMAINING=$(ps aux | grep -E "node.*backend|node.*index.js" | grep -v grep | grep -v "grep" | wc -l)
if [ "$REMAINING" -eq 0 ]; then
    echo -e "${GREEN}✅ Nessun processo backend trovato!${NC}"
else
    echo -e "${RED}❌ Ancora $REMAINING processi trovati:${NC}"
    ps aux | grep -E "node.*backend|node.*index.js" | grep -v grep
    echo ""
    echo -e "${YELLOW}⚠️  Forzo terminazione...${NC}"
    pkill -9 -f "node.*backend" 2>/dev/null || true
    pkill -9 -f "node.*index.js" 2>/dev/null || true
    sleep 1
fi
echo ""

# 5. Verifica script di avvio automatico
echo -e "${YELLOW}📋 6. Verifica script di avvio automatico...${NC}"

# Verifica systemd
if systemctl list-units --type=service | grep -q "ticketapp"; then
    echo -e "${YELLOW}⚠️  Trovato servizio systemd ticketapp${NC}"
    systemctl list-units --type=service | grep ticketapp
else
    echo -e "${GREEN}✅ Nessun servizio systemd ticketapp trovato${NC}"
fi

# Verifica cron
if crontab -l 2>/dev/null | grep -q "backend\|index.js"; then
    echo -e "${YELLOW}⚠️  Trovato job cron per backend${NC}"
    crontab -l | grep -E "backend|index.js"
else
    echo -e "${GREEN}✅ Nessun job cron per backend trovato${NC}"
fi

# Verifica script di avvio
if [ -f "/etc/rc.local" ] && grep -q "backend\|index.js" /etc/rc.local; then
    echo -e "${YELLOW}⚠️  Trovato script in /etc/rc.local${NC}"
    grep -E "backend|index.js" /etc/rc.local
fi

echo ""

# 6. Avvia solo con PM2
echo -e "${YELLOW}🚀 7. Avvio backend con PM2...${NC}"
cd /var/www/ticketapp/backend

if [ ! -f "index.js" ]; then
    echo -e "${RED}❌ File index.js non trovato in /var/www/ticketapp/backend!${NC}"
    exit 1
fi

pm2 start index.js --name ticketapp-backend
pm2 save

echo -e "${GREEN}✅ Backend avviato con PM2!${NC}"
echo ""

# 7. Attendi e verifica
echo "Attendo 5 secondi per l'avvio..."
sleep 5

# 8. Verifica finale
echo -e "${YELLOW}🔍 8. Verifica finale...${NC}"
pm2 list
echo ""

HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health 2>/dev/null || echo "000")
if [ "$HTTP_RESPONSE" = "200" ] || [ "$HTTP_RESPONSE" = "401" ] || [ "$HTTP_RESPONSE" = "404" ]; then
    echo -e "${GREEN}✅ Backend risponde (HTTP $HTTP_RESPONSE)${NC}"
else
    echo -e "${RED}❌ Backend NON risponde (HTTP $HTTP_RESPONSE)${NC}"
fi

# Verifica processi
REMAINING=$(ps aux | grep -E "node.*backend|node.*index.js" | grep -v grep | grep -v PM2 | wc -l)
if [ "$REMAINING" -le 1 ]; then
    echo -e "${GREEN}✅ Solo il processo PM2 è in esecuzione!${NC}"
else
    echo -e "${YELLOW}⚠️  Ancora $REMAINING processi backend trovati${NC}"
    ps aux | grep -E "node.*backend|node.*index.js" | grep -v grep
fi

echo ""
echo -e "${GREEN}✅✅✅ PULIZIA COMPLETA! ✅✅✅${NC}"
echo ""
echo "Se vedi ancora processi duplicati, potrebbe esserci uno script di avvio automatico."
echo "Verifica con:"
echo "  systemctl list-units --type=service | grep ticketapp"
echo "  crontab -l"
echo "  cat /etc/rc.local"
echo ""

