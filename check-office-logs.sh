#!/bin/bash
# Script per controllare i log relativi a Office nel backend

echo "🔍 CONTROLLO LOG OFFICE"
echo "======================="
echo ""

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Controlla log PM2 per Office
echo "1️⃣  LOG PM2 - OFFICE (ultimi 200 righe):"
echo "----------------------------------------"
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "ticketapp-backend\|backend"; then
        echo -e "${BLUE}Cercando log 'Office', 'office', 'getOfficeData'...${NC}"
        echo ""
        
        # Cerca nei log PM2
        pm2 logs ticketapp-backend --lines 200 --nostream 2>/dev/null | grep -iE "(Office|office|getOfficeData|azienda|Smil|🔍|✅|❌)" || \
        pm2 logs backend --lines 200 --nostream 2>/dev/null | grep -iE "(Office|office|getOfficeData|azienda|Smil|🔍|✅|❌)" || \
        echo -e "${YELLOW}⚠️  Nessun log trovato nei PM2 logs${NC}"
        
        echo ""
        echo -e "${BLUE}Ultimi 100 log backend (tutti - per vedere contesto completo):${NC}"
        pm2 logs ticketapp-backend --lines 100 --nostream 2>/dev/null || pm2 logs backend --lines 100 --nostream 2>/dev/null
    else
        echo -e "${RED}❌ Backend NON in esecuzione!${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 non installato${NC}"
fi
echo ""

# 2. Cerca nei file di log se esistono
echo "2️⃣  CERCA NEI FILE DI LOG:"
echo "---------------------------"
if [ -d "/var/log/pm2" ]; then
    echo -e "${BLUE}Cercando nei file di log PM2...${NC}"
    if [ -f "/var/log/pm2/backend-out.log" ]; then
        echo -e "${GREEN}✅ Trovato backend-out.log${NC}"
        echo "Ultime 50 righe con 'Office':"
        grep -i "Office\|office\|getOfficeData" /var/log/pm2/backend-out.log | tail -50 || echo "Nessun risultato"
    fi
    if [ -f "/var/log/pm2/backend-error.log" ]; then
        echo -e "${GREEN}✅ Trovato backend-error.log${NC}"
        echo "Ultime 50 righe con 'Office':"
        grep -i "Office\|office\|getOfficeData" /var/log/pm2/backend-error.log | tail -50 || echo "Nessun risultato"
    fi
else
    echo -e "${YELLOW}⚠️  Directory /var/log/pm2 non trovata${NC}"
fi
echo ""

# 3. Verifica configurazione PM2
echo "3️⃣  CONFIGURAZIONE PM2:"
echo "----------------------"
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "ticketapp-backend\|backend"; then
        echo -e "${BLUE}Informazioni processo backend:${NC}"
        pm2 show ticketapp-backend 2>/dev/null || pm2 show backend 2>/dev/null || echo "Processo non trovato"
    fi
fi
echo ""

echo "✅ Controllo completato"
echo ""
echo "💡 Per vedere i log in tempo reale, usa:"
echo "   pm2 logs backend --lines 0"
