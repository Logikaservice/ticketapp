#!/bin/bash
# Script per analizzare i log del backend e identificare problemi con la route Office

echo "🔍 ANALISI LOG BACKEND - ROUTE OFFICE"
echo "======================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Verifica processo backend
echo -e "${BLUE}1️⃣ Verifica processo backend...${NC}"
BACKEND_PROCESS=$(pm2 list | grep -E "backend|ticketapp-backend" | awk '{print $2}' | head -1)
if [ -z "$BACKEND_PROCESS" ]; then
  echo -e "${RED}❌ Nessun processo backend trovato!${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Processo trovato: $BACKEND_PROCESS${NC}"
echo ""

# 2. Ultimi 100 log
echo -e "${BLUE}2️⃣ Ultimi 100 log backend...${NC}"
pm2 logs $BACKEND_PROCESS --lines 100 --nostream
echo ""

# 3. Cerca richieste Office
echo -e "${BLUE}3️⃣ Cerca richieste Office negli ultimi 200 log...${NC}"
pm2 logs $BACKEND_PROCESS --lines 200 --nostream | grep -iE "(office|keepass|/api/keepass)" || echo -e "${YELLOW}⚠️ Nessuna richiesta Office trovata negli ultimi 200 log${NC}"
echo ""

# 4. Cerca errori 404
echo -e "${BLUE}4️⃣ Cerca errori 404...${NC}"
pm2 logs $BACKEND_PROCESS --lines 200 --nostream | grep -iE "(404|not found|route.*non trovata)" || echo -e "${YELLOW}⚠️ Nessun errore 404 trovato${NC}"
echo ""

# 5. Cerca log di autenticazione
echo -e "${BLUE}5️⃣ Cerca log di autenticazione...${NC}"
pm2 logs $BACKEND_PROCESS --lines 200 --nostream | grep -iE "(authenticate|token|🔐|❌.*Token)" || echo -e "${YELLOW}⚠️ Nessun log di autenticazione trovato${NC}"
echo ""

# 6. Cerca tutte le richieste API
echo -e "${BLUE}6️⃣ Ultime 20 richieste API (se presenti)...${NC}"
pm2 logs $BACKEND_PROCESS --lines 200 --nostream | grep -E "(📥|GET|POST|PUT|DELETE).*\/api" | tail -20 || echo -e "${YELLOW}⚠️ Nessuna richiesta API trovata${NC}"
echo ""

# 7. Verifica che il codice contenga il logging
echo -e "${BLUE}7️⃣ Verifica codice backend...${NC}"
cd /var/www/ticketapp || cd /root/TicketApp || {
  echo -e "${RED}❌ Directory progetto non trovata!${NC}"
  exit 1
}

if grep -q "RICHIESTA OFFICE RICEVUTA" backend/routes/keepass.js 2>/dev/null; then
  echo -e "${GREEN}✅ File keepass.js contiene logging Office${NC}"
else
  echo -e "${RED}❌ File keepass.js NON contiene logging Office!${NC}"
  echo "Il codice non è aggiornato. Esegui: git pull origin main"
fi

if grep -q "MIDDLEWARE AUTHENTICATE.*OFFICE" backend/middleware/authMiddleware.js 2>/dev/null; then
  echo -e "${GREEN}✅ File authMiddleware.js contiene logging Office${NC}"
else
  echo -e "${RED}❌ File authMiddleware.js NON contiene logging Office!${NC}"
  echo "Il codice non è aggiornato. Esegui: git pull origin main"
fi

if grep -q "📥.*GET.*api" backend/index.js 2>/dev/null; then
  echo -e "${GREEN}✅ File index.js contiene logging generale${NC}"
else
  echo -e "${YELLOW}⚠️ File index.js potrebbe non contenere logging generale${NC}"
fi
echo ""

# 8. Verifica ultimo commit
echo -e "${BLUE}8️⃣ Ultimo commit...${NC}"
git log --oneline -1 2>/dev/null || echo -e "${YELLOW}⚠️ Non è una directory git${NC}"
echo ""

# 9. Test diretto della route (se possibile)
echo -e "${BLUE}9️⃣ Test connessione backend...${NC}"
if curl -s http://localhost:3001/api/keepalive > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Backend risponde su porta 3001${NC}"
else
  echo -e "${YELLOW}⚠️ Backend non risponde su localhost:3001${NC}"
fi
echo ""

echo -e "${GREEN}✅ Analisi completata!${NC}"
echo ""
echo -e "${YELLOW}💡 PROSSIMI PASSI:${NC}"
echo "1. Se il codice non è aggiornato, esegui: git pull origin main && pm2 restart $BACKEND_PROCESS"
echo "2. Prova a caricare la pagina Office nel browser"
echo "3. Controlla i log in tempo reale: pm2 logs $BACKEND_PROCESS --lines 0"
echo "4. Cerca specificamente: pm2 logs $BACKEND_PROCESS --lines 0 | grep -iE '(🔍|📥|Office|keepass)'"
