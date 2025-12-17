#!/bin/bash

# Script per fermare DEFINITIVAMENTE tutti i processi backend
echo "🛑 FERMA BACKEND DEFINITIVO"
echo "=========================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Ferma e rimuovi TUTTO da PM2
echo -e "${YELLOW}📋 1. Pulisco PM2 completamente...${NC}"
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true
sleep 2
echo ""

# 2. Rimuovi dump PM2
echo -e "${YELLOW}📋 2. Rimuovo dump PM2...${NC}"
rm -f /root/.pm2/dump.pm2 2>/dev/null || true
echo -e "${GREEN}✅ Dump PM2 rimosso!${NC}"
echo ""

# 3. Ferma TUTTI i processi node
echo -e "${YELLOW}📋 3. Fermo TUTTI i processi node...${NC}"
pkill -9 node 2>/dev/null || true
sleep 2

# Forza terminazione di qualsiasi processo node rimasto
PIDS=$(pgrep node 2>/dev/null || echo "")
if [ -n "$PIDS" ]; then
    echo -e "${YELLOW}⚠️  Processi node ancora attivi, forzo terminazione...${NC}"
    for PID in $PIDS; do
        kill -9 $PID 2>/dev/null || true
    done
    sleep 1
fi
echo -e "${GREEN}✅ Tutti i processi node fermati!${NC}"
echo ""

# 4. Verifica che la porta 3001 sia libera
echo -e "${YELLOW}📋 4. Verifica porta 3001...${NC}"
PID_3001=$(lsof -ti:3001 2>/dev/null || fuser 3001/tcp 2>/dev/null | awk '{print $1}' || echo "")
if [ -n "$PID_3001" ]; then
    echo -e "${RED}❌ Porta 3001 ancora in uso da PID: $PID_3001${NC}"
    kill -9 $PID_3001 2>/dev/null || true
    sleep 1
fi

if netstat -tuln | grep -q ":3001 "; then
    echo -e "${RED}❌ Porta 3001 ancora in uso!${NC}"
    netstat -tuln | grep ":3001 "
    # Forza liberazione
    fuser -k 3001/tcp 2>/dev/null || true
    sleep 1
else
    echo -e "${GREEN}✅ Porta 3001 libera!${NC}"
fi
echo ""

# 5. Verifica processi rimanenti
echo -e "${YELLOW}📋 5. Verifica processi rimanenti...${NC}"
REMAINING=$(ps aux | grep -E "node" | grep -v grep | grep -v "grep" | wc -l)
if [ "$REMAINING" -eq 0 ]; then
    echo -e "${GREEN}✅ Nessun processo node trovato!${NC}"
else
    echo -e "${YELLOW}⚠️  Ancora $REMAINING processi node trovati:${NC}"
    ps aux | grep -E "node" | grep -v grep
fi
echo ""

# 6. Verifica script di avvio automatico
echo -e "${YELLOW}📋 6. Verifica script di avvio automatico...${NC}"

# Verifica systemd
if systemctl list-units --type=service --all | grep -i ticketapp; then
    echo -e "${YELLOW}⚠️  Trovato servizio systemd ticketapp${NC}"
    systemctl list-units --type=service --all | grep -i ticketapp
    echo "Disabilita con: systemctl disable <nome-servizio>"
else
    echo -e "${GREEN}✅ Nessun servizio systemd ticketapp trovato${NC}"
fi

# Verifica cron (root e altri utenti)
echo ""
echo "Cron root:"
if crontab -l 2>/dev/null | grep -qE "backend|index.js|node.*3001"; then
    echo -e "${YELLOW}⚠️  Trovato job cron per backend${NC}"
    crontab -l | grep -E "backend|index.js|node.*3001"
else
    echo -e "${GREEN}✅ Nessun job cron per backend trovato${NC}"
fi

# Verifica rc.local
if [ -f "/etc/rc.local" ] && grep -qE "backend|index.js|node.*3001" /etc/rc.local; then
    echo -e "${YELLOW}⚠️  Trovato script in /etc/rc.local${NC}"
    grep -E "backend|index.js|node.*3001" /etc/rc.local
fi

# Verifica script in /etc/init.d
if ls /etc/init.d/*ticket* 2>/dev/null || ls /etc/init.d/*backend* 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Trovati script in /etc/init.d${NC}"
    ls -la /etc/init.d/*ticket* /etc/init.d/*backend* 2>/dev/null
fi

echo ""

# 7. Attendi un po' per vedere se si riavviano
echo -e "${YELLOW}📋 7. Attendo 5 secondi per verificare auto-riavvio...${NC}"
sleep 5

REMAINING_AFTER=$(ps aux | grep -E "node.*backend|node.*index.js" | grep -v grep | grep -v "grep" | wc -l)
if [ "$REMAINING_AFTER" -eq 0 ]; then
    echo -e "${GREEN}✅ Nessun processo si è riavviato automaticamente!${NC}"
else
    echo -e "${RED}❌ Processi si sono riavviati automaticamente ($REMAINING_AFTER processi)!${NC}"
    ps aux | grep -E "node.*backend|node.*index.js" | grep -v grep
    echo ""
    echo -e "${YELLOW}⚠️  C'è qualcosa che riavvia automaticamente i processi!${NC}"
    echo "Verifica:"
    echo "  - Processi padre: ps auxf | grep node"
    echo "  - Script di monitoraggio: find /var/www -name '*.sh' -exec grep -l 'node.*backend' {} \\;"
    echo "  - PM2 ecosystem: cat /var/www/ticketapp/ecosystem.config.js 2>/dev/null"
fi
echo ""

# 8. Avvia solo con PM2 (se non si sono riavviati)
if [ "$REMAINING_AFTER" -eq 0 ]; then
    echo -e "${YELLOW}🚀 8. Avvio backend con PM2...${NC}"
    cd /var/www/ticketapp/backend

    if [ ! -f "index.js" ]; then
        echo -e "${RED}❌ File index.js non trovato in /var/www/ticketapp/backend!${NC}"
        exit 1
    fi

    pm2 start index.js --name ticketapp-backend
    pm2 save
    
    echo -e "${GREEN}✅ Backend avviato con PM2!${NC}"
    echo ""
    
    # Attendi e verifica
    sleep 5
    HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health 2>/dev/null || echo "000")
    if [ "$HTTP_RESPONSE" = "200" ] || [ "$HTTP_RESPONSE" = "401" ] || [ "$HTTP_RESPONSE" = "404" ]; then
        echo -e "${GREEN}✅ Backend risponde (HTTP $HTTP_RESPONSE)${NC}"
    else
        echo -e "${RED}❌ Backend NON risponde (HTTP $HTTP_RESPONSE)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Non avvio PM2 perché i processi si riavviano automaticamente${NC}"
    echo "Risolvi prima il problema dell'auto-riavvio!"
fi

echo ""
echo -e "${GREEN}✅✅✅ PULIZIA COMPLETA! ✅✅✅${NC}"
echo ""

