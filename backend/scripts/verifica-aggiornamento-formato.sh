#!/bin/bash
# Script per verificare i log dell'aggiornamento formato eventi intervento

echo "🔍 VERIFICA AGGIORNAMENTO FORMATO EVENTI INTERVENTO"
echo "===================================================="
echo ""

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Cerca nei log PM2
echo "1️⃣  LOG PM2 (ultimi 100 righe):"
echo "-------------------------------"
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "ticketapp-backend\|backend"; then
        echo -e "${BLUE}Cercando log 'UPDATE-FORMAT' e 'AGGIORNAMENTO FORMATO'...${NC}"
        echo ""
        
        # Cerca nei log PM2
        pm2 logs ticketapp-backend --lines 100 --nostream 2>/dev/null | grep -iE "(UPDATE-FORMAT|AGGIORNAMENTO FORMATO|update-interventi-format)" || \
        pm2 logs backend --lines 100 --nostream 2>/dev/null | grep -iE "(UPDATE-FORMAT|AGGIORNAMENTO FORMATO|update-interventi-format)" || \
        echo -e "${YELLOW}⚠️  Nessun log trovato nei PM2 logs${NC}"
        
        echo ""
        echo -e "${BLUE}Ultimi 50 log backend (tutti):${NC}"
        pm2 logs ticketapp-backend --lines 50 --nostream 2>/dev/null || pm2 logs backend --lines 50 --nostream 2>/dev/null
    else
        echo -e "${RED}❌ Backend NON in esecuzione!${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 non installato${NC}"
fi
echo ""

# Cerca nei log di sistema
echo "2️⃣  LOG SISTEMA (journalctl):"
echo "------------------------------"
echo -e "${BLUE}Cercando log 'UPDATE-FORMAT' e 'AGGIORNAMENTO FORMATO'...${NC}"
journalctl -u ticketapp-backend -n 100 --no-pager 2>/dev/null | grep -iE "(UPDATE-FORMAT|AGGIORNAMENTO FORMATO|update-interventi-format)" || \
journalctl -u ticketapp -n 100 --no-pager 2>/dev/null | grep -iE "(UPDATE-FORMAT|AGGIORNAMENTO FORMATO|update-interventi-format)" || \
echo -e "${YELLOW}⚠️  Nessun log trovato nei log di sistema${NC}"
echo ""

# Cerca nei file di log dell'applicazione
echo "3️⃣  LOG FILE APPLICAZIONE:"
echo "---------------------------"
if [ -f "/var/www/ticketapp/backend/logs/error.log" ]; then
    echo -e "${BLUE}Cercando in /var/www/ticketapp/backend/logs/error.log...${NC}"
    tail -n 100 /var/www/ticketapp/backend/logs/error.log | grep -iE "(UPDATE-FORMAT|AGGIORNAMENTO FORMATO|update-interventi-format)" || \
    echo -e "${YELLOW}⚠️  Nessun log trovato${NC}"
else
    echo -e "${YELLOW}⚠️  File log non trovato${NC}"
fi
echo ""

# Riepilogo
echo "📊 RIEPILOGO:"
echo "-------------"
echo -e "${BLUE}Per vedere i log in tempo reale:${NC}"
echo "   pm2 logs ticketapp-backend"
echo ""
echo -e "${BLUE}Per cercare specificamente i log dell'aggiornamento:${NC}"
echo "   pm2 logs ticketapp-backend --lines 200 --nostream | grep -i 'UPDATE-FORMAT'"
echo ""
echo -e "${GREEN}✅ Verifica completata!${NC}"

