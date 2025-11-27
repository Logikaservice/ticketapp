#!/bin/bash
# Script per controllare i log di Vivaldi e SpeechGen speakers sul server VPS

echo "🔍 CONTROLLO LOG VIVALDI - SPEAKER SPEECHGEN"
echo "============================================="
echo ""

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Controlla log PM2 per Vivaldi/SpeechGen
echo "1️⃣  LOG PM2 - VIVALDI/SPEECHGEN (ultimi 200 righe):"
echo "---------------------------------------------------"
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "ticketapp-backend\|backend"; then
        echo -e "${BLUE}Cercando log 'SpeechGen', 'speaker', 'Vivaldi', 'speakers'...${NC}"
        echo ""
        
        # Cerca nei log PM2
        pm2 logs ticketapp-backend --lines 200 --nostream 2>/dev/null | grep -iE "(SpeechGen|speaker|Vivaldi|speakers|📢|✅|❌|⚠️)" || \
        pm2 logs backend --lines 200 --nostream 2>/dev/null | grep -iE "(SpeechGen|speaker|Vivaldi|speakers|📢|✅|❌|⚠️)" || \
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

# 2. Controlla configurazione Vivaldi nel database
echo "2️⃣  VERIFICA CONFIGURAZIONE VIVALDI (Database):"
echo "-----------------------------------------------"
if [ -f "/var/www/ticketapp/backend/.env" ]; then
    echo -e "${BLUE}Caricamento variabili ambiente...${NC}"
    source /var/www/ticketapp/backend/.env 2>/dev/null || true
    
    # Prova con DATABASE_URL_VIVALDI o fallback a DATABASE_URL
    if [ -n "$DATABASE_URL_VIVALDI" ]; then
        DB_URL="$DATABASE_URL_VIVALDI"
        echo -e "${GREEN}✅ Usando DATABASE_URL_VIVALDI${NC}"
    elif [ -n "$DATABASE_URL" ]; then
        DB_URL="$DATABASE_URL"
        echo -e "${YELLOW}⚠️  Usando DATABASE_URL (fallback)${NC}"
    else
        echo -e "${RED}❌ Nessuna variabile DATABASE_URL trovata${NC}"
        DB_URL=""
    fi
    
    if [ -n "$DB_URL" ]; then
        echo -e "${BLUE}Verifica configurazione SpeechGen API Key...${NC}"
        echo ""
        
        # Estrai parametri dal DATABASE_URL
        # Formato: postgresql://user:password@host:port/database
        DB_USER=$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        DB_PASS=$(echo "$DB_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
        DB_HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo "$DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
        
        if [ -n "$DB_USER" ] && [ -n "$DB_NAME" ]; then
            echo -e "${GREEN}✅ Connessione al database vivaldi_db...${NC}"
            echo ""
            
            PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -c "
                SELECT 
                    chiave,
                    CASE 
                        WHEN chiave = 'speechgen_api_key' THEN 
                            CASE 
                                WHEN LENGTH(valore) > 0 THEN SUBSTRING(valore, 1, 10) || '...' || SUBSTRING(valore, LENGTH(valore)-5)
                                ELSE '(vuoto)'
                            END
                        ELSE valore
                    END as valore_masked,
                    descrizione
                FROM vivaldi_config 
                WHERE chiave IN ('speechgen_api_key', 'speechgen_email', 'gemini_api_key')
                ORDER BY chiave;
            " 2>/dev/null || echo -e "${RED}❌ Errore connessione database${NC}"
        else
            echo -e "${YELLOW}⚠️  Impossibile estrarre parametri da DATABASE_URL${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  DATABASE_URL non configurato${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  File .env non trovato${NC}"
fi
echo ""

# 3. Test API SpeechGen (se possibile)
echo "3️⃣  TEST API SPEECHGEN (se API key configurata):"
echo "-----------------------------------------------"
if [ -f "/var/www/ticketapp/backend/.env" ]; then
    source /var/www/ticketapp/backend/.env 2>/dev/null || true
    
    if [ -n "$DATABASE_URL_VIVALDI" ] || [ -n "$DATABASE_URL" ]; then
        DB_URL="${DATABASE_URL_VIVALDI:-$DATABASE_URL}"
        DB_USER=$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        DB_PASS=$(echo "$DB_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
        DB_HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo "$DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
        
        if [ -n "$DB_USER" ] && [ -n "$DB_NAME" ]; then
            API_KEY=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT valore FROM vivaldi_config WHERE chiave = 'speechgen_api_key';" 2>/dev/null | xargs)
            
            if [ -n "$API_KEY" ] && [ "$API_KEY" != "" ]; then
                echo -e "${GREEN}✅ API Key trovata, test chiamata API...${NC}"
                echo ""
                
                # Test chiamata API
                RESPONSE=$(curl -s -X GET "https://api.speechgen.io/api/voices" \
                    -H "X-API-Key: $API_KEY" \
                    -H "Content-Type: application/json" 2>&1)
                
                if [ $? -eq 0 ]; then
                    echo -e "${BLUE}Risposta API:${NC}"
                    echo "$RESPONSE" | head -n 50
                    echo ""
                    
                    # Conta speaker
                    SPEAKER_COUNT=$(echo "$RESPONSE" | grep -o '"name"' | wc -l || echo "0")
                    echo -e "${GREEN}✅ Trovati ~$SPEAKER_COUNT speaker nella risposta${NC}"
                else
                    echo -e "${RED}❌ Errore chiamata API SpeechGen${NC}"
                    echo "$RESPONSE"
                fi
            else
                echo -e "${YELLOW}⚠️  API Key SpeechGen non configurata nel database${NC}"
            fi
        fi
    fi
fi
echo ""

# 4. Riepilogo
echo "📊 RIEPILOGO:"
echo "-------------"
echo -e "${BLUE}Per vedere i log in tempo reale:${NC}"
echo "   pm2 logs ticketapp-backend | grep -iE '(SpeechGen|speaker|Vivaldi)'"
echo ""
echo -e "${BLUE}Per vedere tutti i log recenti:${NC}"
echo "   pm2 logs ticketapp-backend --lines 500 --nostream"
echo ""
echo -e "${BLUE}Per vedere solo i log di Vivaldi:${NC}"
echo "   pm2 logs ticketapp-backend --lines 500 --nostream | grep -i vivaldi"
echo ""
echo -e "${GREEN}✅ Verifica completata!${NC}"

