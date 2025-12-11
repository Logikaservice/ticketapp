#!/bin/bash
# Script di diagnostica per errori 502 - Backend non raggiungibile

echo "🔍 DIAGNOSTICA ERRORE 502 - BACKEND NON RAGGIUNGIBILE"
echo "======================================================"
echo ""

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verifica se il backend è in ascolto sulla porta 3001
echo "1️⃣ Verifica porta 3001..."
if netstat -tuln | grep -q ":3001 "; then
    echo -e "${GREEN}✅ Porta 3001 è in ascolto${NC}"
    netstat -tuln | grep ":3001 "
else
    echo -e "${RED}❌ Porta 3001 NON è in ascolto - Backend non attivo!${NC}"
fi
echo ""

# 2. Verifica processi PM2
echo "2️⃣ Verifica processi PM2..."
if command -v pm2 &> /dev/null; then
    echo "Processi PM2 attivi:"
    pm2 list
    echo ""
    
    # Cerca processi backend
    BACKEND_PROCESS=$(pm2 list | grep -E "ticketapp-backend|backend" | awk '{print $2}' | head -1)
    if [ -n "$BACKEND_PROCESS" ]; then
        echo -e "${GREEN}✅ Processo backend trovato: $BACKEND_PROCESS${NC}"
        echo ""
        echo "Stato dettagliato:"
        pm2 show $BACKEND_PROCESS | head -20
        echo ""
        echo "Ultimi log (20 righe):"
        pm2 logs $BACKEND_PROCESS --lines 20 --nostream
    else
        echo -e "${RED}❌ Nessun processo backend trovato in PM2!${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 non installato${NC}"
fi
echo ""

# 3. Verifica se Node.js è in esecuzione
echo "3️⃣ Verifica processi Node.js..."
NODE_PROCESSES=$(ps aux | grep "node.*index.js" | grep -v grep)
if [ -n "$NODE_PROCESSES" ]; then
    echo -e "${GREEN}✅ Processi Node.js trovati:${NC}"
    echo "$NODE_PROCESSES"
else
    echo -e "${RED}❌ Nessun processo Node.js trovato!${NC}"
fi
echo ""

# 4. Test connessione backend locale
echo "4️⃣ Test connessione backend (localhost:3001)..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3001/api/health 2>/dev/null || echo "000")
if [ "$HEALTH_RESPONSE" = "200" ] || [ "$HEALTH_RESPONSE" = "404" ]; then
    echo -e "${GREEN}✅ Backend risponde (HTTP $HEALTH_RESPONSE)${NC}"
else
    echo -e "${RED}❌ Backend NON risponde (HTTP $HEALTH_RESPONSE)${NC}"
fi

# Test endpoint crypto
CRYPTO_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3001/api/crypto/dashboard 2>/dev/null || echo "000")
if [ "$CRYPTO_RESPONSE" = "200" ] || [ "$CRYPTO_RESPONSE" = "401" ] || [ "$CRYPTO_RESPONSE" = "403" ]; then
    echo -e "${GREEN}✅ Endpoint crypto risponde (HTTP $CRYPTO_RESPONSE)${NC}"
else
    echo -e "${RED}❌ Endpoint crypto NON risponde (HTTP $CRYPTO_RESPONSE)${NC}"
fi
echo ""

# 5. Verifica file .env
echo "5️⃣ Verifica configurazione backend..."
BACKEND_DIR="/var/www/ticketapp/backend"
if [ -d "$BACKEND_DIR" ]; then
    echo "Directory backend: $BACKEND_DIR"
    if [ -f "$BACKEND_DIR/.env" ]; then
        echo -e "${GREEN}✅ File .env trovato${NC}"
        echo "Variabili d'ambiente presenti:"
        grep -E "^[A-Z_]+=" "$BACKEND_DIR/.env" | cut -d'=' -f1 | head -10
    else
        echo -e "${RED}❌ File .env NON trovato!${NC}"
    fi
else
    echo -e "${RED}❌ Directory backend non trovata: $BACKEND_DIR${NC}"
fi
echo ""

# 6. Verifica nginx
echo "6️⃣ Verifica configurazione nginx..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx è attivo${NC}"
    echo "Test configurazione nginx:"
    nginx -t 2>&1 | head -5
else
    echo -e "${RED}❌ Nginx NON è attivo!${NC}"
fi
echo ""

# 7. Riepilogo e soluzioni
echo "======================================================"
echo "📋 RIEPILOGO"
echo "======================================================"
echo ""

if ! netstat -tuln | grep -q ":3001 "; then
    echo -e "${RED}❌ PROBLEMA TROVATO: Backend non è in ascolto sulla porta 3001${NC}"
    echo ""
    echo "🔧 SOLUZIONE:"
    echo "1. Connettiti alla VPS:"
    echo "   ssh root@159.69.121.162"
    echo ""
    echo "2. Vai nella directory backend:"
    echo "   cd /var/www/ticketapp/backend"
    echo ""
    echo "3. Verifica se PM2 ha un processo:"
    echo "   pm2 list"
    echo ""
    echo "4. Se il processo esiste ma è in errore, riavvialo:"
    echo "   pm2 restart ticketapp-backend"
    echo "   # oppure"
    echo "   pm2 restart all"
    echo ""
    echo "5. Se il processo non esiste, avvialo:"
    echo "   pm2 start index.js --name ticketapp-backend"
    echo "   pm2 save"
    echo ""
    echo "6. Verifica i log per errori:"
    echo "   pm2 logs ticketapp-backend --lines 50"
    echo ""
    echo "7. Se ci sono errori nel codice, prova ad avviare manualmente:"
    echo "   cd /var/www/ticketapp/backend"
    echo "   node index.js"
    echo "   # (Questo mostrerà l'errore esatto)"
    echo ""
else
    echo -e "${GREEN}✅ Backend sembra essere in ascolto${NC}"
    echo "Se gli errori 502 persistono, potrebbe essere un problema di:"
    echo "- Timeout nginx troppo brevi"
    echo "- Backend che crasha durante le richieste"
    echo "- Problemi di connessione database"
    echo ""
    echo "Verifica i log:"
    echo "  pm2 logs ticketapp-backend --lines 100"
    echo "  tail -f /var/log/nginx/error.log"
fi

echo ""
echo "======================================================"



