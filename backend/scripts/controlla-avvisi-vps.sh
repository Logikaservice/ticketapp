#!/bin/bash
# Script per controllare avvisi, errori e stato del sistema sulla VPS

echo "🔍 CONTROLLO AVVISI E STATO SISTEMA VPS"
echo "========================================"
echo ""

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verifica stato servizi
echo "1️⃣  STATO SERVIZI:"
echo "-------------------"
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✅ PM2 installato${NC}"
    echo "Processi PM2:"
    pm2 list
    echo ""
    
    # Verifica se il backend è in esecuzione
    if pm2 list | grep -q "ticketapp-backend\|backend"; then
        echo -e "${GREEN}✅ Backend in esecuzione${NC}"
        echo "Ultimi 30 log backend:"
        pm2 logs ticketapp-backend --lines 30 --nostream 2>/dev/null || pm2 logs backend --lines 30 --nostream 2>/dev/null
    else
        echo -e "${RED}❌ Backend NON in esecuzione!${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 non installato${NC}"
fi
echo ""

# Verifica systemctl
if systemctl is-active --quiet ticketapp-backend 2>/dev/null; then
    echo -e "${GREEN}✅ Servizio ticketapp-backend attivo (systemctl)${NC}"
elif systemctl is-active --quiet ticketapp 2>/dev/null; then
    echo -e "${GREEN}✅ Servizio ticketapp attivo (systemctl)${NC}"
else
    echo -e "${YELLOW}⚠️  Nessun servizio systemctl trovato${NC}"
fi
echo ""

# 2. Verifica nginx
echo "2️⃣  STATO NGINX:"
echo "----------------"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx attivo${NC}"
    systemctl status nginx --no-pager | head -n 10
else
    echo -e "${RED}❌ Nginx NON attivo!${NC}"
fi
echo ""

# 3. Verifica errori recenti nei log di sistema
echo "3️⃣  ERRORI RECENTI LOG SISTEMA:"
echo "--------------------------------"
echo "Ultimi errori journalctl (ultimi 50):"
journalctl -p err -n 50 --no-pager 2>/dev/null | grep -iE "(error|fail|critical)" | tail -n 20 || echo "Nessun errore recente trovato"
echo ""

# 4. Verifica log nginx errori
echo "4️⃣  ERRORI NGINX:"
echo "-----------------"
if [ -f /var/log/nginx/error.log ]; then
    echo "Ultimi 20 errori nginx:"
    tail -n 20 /var/log/nginx/error.log | grep -iE "(error|warn|crit)" || echo "Nessun errore recente"
else
    echo -e "${YELLOW}⚠️  File log nginx non trovato${NC}"
fi
echo ""

# 5. Verifica spazio disco
echo "5️⃣  SPAZIO DISCO:"
echo "-----------------"
df -h / | tail -n 1
USAGE=$(df / | tail -n 1 | awk '{print $5}' | sed 's/%//')
if [ "$USAGE" -gt 90 ]; then
    echo -e "${RED}❌ Spazio disco critico: ${USAGE}% utilizzato${NC}"
elif [ "$USAGE" -gt 80 ]; then
    echo -e "${YELLOW}⚠️  Spazio disco basso: ${USAGE}% utilizzato${NC}"
else
    echo -e "${GREEN}✅ Spazio disco OK: ${USAGE}% utilizzato${NC}"
fi
echo ""

# 6. Verifica memoria
echo "6️⃣  MEMORIA:"
echo "-------------"
free -h
echo ""

# 7. Verifica connessione database
echo "7️⃣  VERIFICA DATABASE:"
echo "----------------------"
if command -v psql &> /dev/null; then
    if psql -h localhost -U postgres -d ticketapp -c "SELECT 1;" &>/dev/null; then
        echo -e "${GREEN}✅ Database raggiungibile${NC}"
        
        # Conta ticket, utenti, errori
        echo "Statistiche database:"
        psql -h localhost -U postgres -d ticketapp -t -c "SELECT COUNT(*) FROM tickets;" 2>/dev/null | xargs echo "  - Ticket:"
        psql -h localhost -U postgres -d ticketapp -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs echo "  - Utenti:"
        psql -h localhost -U postgres -d ticketapp -t -c "SELECT COUNT(*) FROM alerts WHERE expires_at > NOW();" 2>/dev/null | xargs echo "  - Avvisi attivi:"
    else
        echo -e "${RED}❌ Database NON raggiungibile!${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  psql non installato${NC}"
fi
echo ""

# 8. Verifica porta backend
echo "8️⃣  VERIFICA PORTA BACKEND:"
echo "---------------------------"
if netstat -tlnp 2>/dev/null | grep -q ":3001"; then
    echo -e "${GREEN}✅ Backend in ascolto sulla porta 3001${NC}"
    netstat -tlnp 2>/dev/null | grep ":3001"
else
    echo -e "${RED}❌ Backend NON in ascolto sulla porta 3001!${NC}"
fi
echo ""

# 9. Test connessione backend
echo "9️⃣  TEST CONNESSIONE BACKEND:"
echo "-----------------------------"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Backend risponde (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ Backend NON risponde (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# 10. Verifica file importanti
echo "🔟 VERIFICA FILE IMPORTANTI:"
echo "----------------------------"
if [ -d "/var/www/ticketapp" ]; then
    echo -e "${GREEN}✅ Directory applicazione trovata${NC}"
    
    if [ -f "/var/www/ticketapp/backend/.env" ]; then
        echo -e "${GREEN}✅ File .env backend trovato${NC}"
    else
        echo -e "${YELLOW}⚠️  File .env backend NON trovato${NC}"
    fi
    
    if [ -d "/var/www/ticketapp/frontend/build" ]; then
        echo -e "${GREEN}✅ Build frontend trovato${NC}"
        du -sh /var/www/ticketapp/frontend/build
    else
        echo -e "${RED}❌ Build frontend NON trovato!${NC}"
    fi
else
    echo -e "${RED}❌ Directory applicazione NON trovata!${NC}"
fi
echo ""

# 11. Verifica errori recenti applicazione
echo "1️⃣1️⃣ ERRORI RECENTI APPLICAZIONE:"
echo "----------------------------------"
if [ -f "/var/www/ticketapp/backend/logs/error.log" ]; then
    echo "Ultimi 20 errori applicazione:"
    tail -n 20 /var/www/ticketapp/backend/logs/error.log | grep -iE "(error|fail|exception)" || echo "Nessun errore recente"
else
    echo "Cercando log errori in altri percorsi..."
    find /var/www/ticketapp -name "*.log" -type f -mtime -1 2>/dev/null | head -n 5 | while read logfile; do
        echo "File: $logfile"
        tail -n 10 "$logfile" | grep -iE "(error|fail|exception)" || echo "  Nessun errore"
    done
fi
echo ""

# 12. Riepilogo
echo "📊 RIEPILOGO:"
echo "-------------"
ISSUES=0

if ! pm2 list | grep -q "ticketapp-backend\|backend"; then
    echo -e "${RED}❌ Backend non in esecuzione${NC}"
    ISSUES=$((ISSUES + 1))
fi

if ! systemctl is-active --quiet nginx; then
    echo -e "${RED}❌ Nginx non attivo${NC}"
    ISSUES=$((ISSUES + 1))
fi

if [ "$USAGE" -gt 90 ]; then
    echo -e "${RED}❌ Spazio disco critico${NC}"
    ISSUES=$((ISSUES + 1))
fi

if [ "$ISSUES" -eq 0 ]; then
    echo -e "${GREEN}✅ Nessun problema critico rilevato${NC}"
else
    echo -e "${RED}⚠️  Trovati $ISSUES problemi critici${NC}"
fi

echo ""
echo "✅ Controllo completato!"
echo ""
echo "💡 Per vedere i log in tempo reale:"
echo "   pm2 logs ticketapp-backend"
echo "   tail -f /var/log/nginx/error.log"



