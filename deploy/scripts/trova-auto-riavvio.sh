#!/bin/bash

# Script per trovare cosa riavvia automaticamente i processi backend
echo "🔍 TROVA AUTO-RIAVVIO PROCESSI"
echo "=========================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verifica processi padre
echo -e "${YELLOW}📋 1. Processi padre (albero processi)...${NC}"
ps auxf | grep -A 5 -B 5 node | head -30
echo ""

# 2. Verifica processi che potrebbero monitorare
echo -e "${YELLOW}📋 2. Processi di monitoraggio/riavvio...${NC}"
ps aux | grep -E "watch|monitor|restart|supervisor|forever|nodemon|pm2" | grep -v grep
echo ""

# 3. Cerca script che avviano il backend
echo -e "${YELLOW}📋 3. Script che avviano backend...${NC}"
find /var/www -name '*.sh' -type f 2>/dev/null | while read file; do
    if grep -qE "node.*backend|node.*index.js|node.*3001" "$file" 2>/dev/null; then
        echo "Trovato: $file"
        grep -nE "node.*backend|node.*index.js|node.*3001" "$file" 2>/dev/null | head -5
        echo ""
    fi
done

# Cerca anche in /root, /home, /usr/local/bin
for dir in /root /home /usr/local/bin /opt; do
    if [ -d "$dir" ]; then
        find "$dir" -name '*.sh' -type f 2>/dev/null | while read file; do
            if grep -qE "node.*backend|node.*index.js|node.*3001" "$file" 2>/dev/null; then
                echo "Trovato: $file"
                grep -nE "node.*backend|node.*index.js|node.*3001" "$file" 2>/dev/null | head -5
                echo ""
            fi
        done
    fi
done
echo ""

# 4. Verifica PM2 ecosystem
echo -e "${YELLOW}📋 4. PM2 ecosystem config...${NC}"
if [ -f "/var/www/ticketapp/ecosystem.config.js" ]; then
    echo "File trovato: /var/www/ticketapp/ecosystem.config.js"
    cat /var/www/ticketapp/ecosystem.config.js
elif [ -f "/var/www/ticketapp/ecosystem.config.json" ]; then
    echo "File trovato: /var/www/ticketapp/ecosystem.config.json"
    cat /var/www/ticketapp/ecosystem.config.json
else
    echo -e "${GREEN}✅ Nessun file ecosystem.config trovato${NC}"
fi
echo ""

# 5. Verifica supervisor
echo -e "${YELLOW}📋 5. Supervisor config...${NC}"
if command -v supervisorctl &> /dev/null; then
    echo "Supervisor installato!"
    supervisorctl status 2>/dev/null || echo "Nessun processo supervisor"
    
    if [ -d "/etc/supervisor/conf.d" ]; then
        echo "Config supervisor:"
        ls -la /etc/supervisor/conf.d/*ticket* /etc/supervisor/conf.d/*backend* 2>/dev/null || echo "Nessun config trovato"
    fi
else
    echo -e "${GREEN}✅ Supervisor non installato${NC}"
fi
echo ""

# 6. Verifica systemd (più approfondito)
echo -e "${YELLOW}📋 6. Systemd services (tutti)...${NC}"
systemctl list-units --type=service --all | grep -E "node|backend|ticket|3001" || echo "Nessun servizio trovato"
echo ""

# Verifica anche i file di servizio
if [ -d "/etc/systemd/system" ]; then
    echo "File systemd:"
    ls -la /etc/systemd/system/*ticket* /etc/systemd/system/*backend* 2>/dev/null || echo "Nessun file trovato"
    if [ -n "$(ls -A /etc/systemd/system/*ticket* /etc/systemd/system/*backend* 2>/dev/null)" ]; then
        for file in /etc/systemd/system/*ticket* /etc/systemd/system/*backend*; do
            if [ -f "$file" ]; then
                echo "Contenuto di $file:"
                cat "$file"
                echo ""
            fi
        done
    fi
fi
echo ""

# 7. Verifica cron (tutti gli utenti)
echo -e "${YELLOW}📋 7. Cron jobs (tutti gli utenti)...${NC}"
for user in $(cut -f1 -d: /etc/passwd); do
    crontab -u "$user" -l 2>/dev/null | grep -qE "backend|index.js|node.*3001" && {
        echo "Cron per utente $user:"
        crontab -u "$user" -l 2>/dev/null | grep -E "backend|index.js|node.*3001"
        echo ""
    }
done
echo ""

# 8. Verifica processi in esecuzione ora
echo -e "${YELLOW}📋 8. Processi node attualmente in esecuzione...${NC}"
ps aux | grep -E "node.*backend|node.*index.js" | grep -v grep
echo ""

# 9. Verifica PID dei processi e loro padre
echo -e "${YELLOW}📋 9. PID e processi padre...${NC}"
ps aux | grep -E "node.*backend|node.*index.js" | grep -v grep | while read line; do
    PID=$(echo $line | awk '{print $2}')
    if [ -n "$PID" ]; then
        echo "Processo PID $PID:"
        echo "$line"
        echo "Processo padre (PPID):"
        ps -o ppid= -p $PID 2>/dev/null | xargs ps -p 2>/dev/null || echo "Non trovato"
        echo "Albero completo:"
        pstree -p $PID 2>/dev/null || ps -f -p $PID 2>/dev/null
        echo ""
    fi
done

echo -e "${GREEN}✅✅✅ VERIFICA COMPLETA! ✅✅✅${NC}"
echo ""

