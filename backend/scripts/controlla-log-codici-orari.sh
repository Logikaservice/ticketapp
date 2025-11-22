#!/bin/bash
# Script per controllare i log dei codici orari sul server VPS

echo "🔍 CONTROLLO LOG CODICI ORARI"
echo "=============================="
echo ""

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Controlla log PM2 per codici orari
echo "1️⃣  LOG PM2 - CODICI ORARI (ultimi 100 righe):"
echo "-----------------------------------------------"
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "ticketapp-backend\|backend"; then
        echo -e "${BLUE}Cercando log 'timeCodes', 'Codici orari', 'codici orari'...${NC}"
        echo ""
        
        # Cerca nei log PM2
        pm2 logs ticketapp-backend --lines 100 --nostream 2>/dev/null | grep -iE "(timeCodes|Codici orari|codici orari|timeCodesOrder)" || \
        pm2 logs backend --lines 100 --nostream 2>/dev/null | grep -iE "(timeCodes|Codici orari|codici orari|timeCodesOrder)" || \
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

# 2. Controlla database direttamente
echo "2️⃣  VERIFICA DATABASE - CODICI ORARI:"
echo "--------------------------------------"
if [ -f "/var/www/ticketapp/backend/.env" ]; then
    echo -e "${BLUE}Caricamento variabili ambiente...${NC}"
    source /var/www/ticketapp/backend/.env 2>/dev/null || true
    
    if [ -n "$DB_ORARI_HOST" ] && [ -n "$DB_ORARI_DATABASE" ]; then
        echo -e "${GREEN}✅ Connessione al database orari...${NC}"
        echo ""
        
        PGPASSWORD="$DB_ORARI_PASSWORD" psql -h "$DB_ORARI_HOST" -U "$DB_ORARI_USER" -d "$DB_ORARI_DATABASE" -c "
            SELECT 
                id,
                updated_at,
                data->'timeCodes' as timeCodes,
                data->'timeCodesOrder' as timeCodesOrder,
                jsonb_object_keys(data->'timeCodes') as codici_presenti
            FROM orari_data 
            ORDER BY id DESC 
            LIMIT 1;
        " 2>/dev/null || echo -e "${RED}❌ Errore connessione database${NC}"
        
        echo ""
        echo -e "${BLUE}Dettaglio completo record più recente:${NC}"
        PGPASSWORD="$DB_ORARI_PASSWORD" psql -h "$DB_ORARI_HOST" -U "$DB_ORARI_USER" -d "$DB_ORARI_DATABASE" -c "
            SELECT 
                id,
                updated_at,
                jsonb_pretty(data->'timeCodes') as timeCodes,
                jsonb_pretty(data->'timeCodesOrder') as timeCodesOrder
            FROM orari_data 
            ORDER BY id DESC 
            LIMIT 1;
        " 2>/dev/null || echo -e "${RED}❌ Errore query dettaglio${NC}"
    else
        echo -e "${YELLOW}⚠️  Variabili database non configurate${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  File .env non trovato${NC}"
fi
echo ""

# 3. Riepilogo
echo "📊 RIEPILOGO:"
echo "-------------"
echo -e "${BLUE}Per vedere i log in tempo reale:${NC}"
echo "   pm2 logs ticketapp-backend | grep -i 'timeCodes'"
echo ""
echo -e "${BLUE}Per vedere tutti i log recenti:${NC}"
echo "   pm2 logs ticketapp-backend --lines 200 --nostream"
echo ""
echo -e "${GREEN}✅ Verifica completata!${NC}"

