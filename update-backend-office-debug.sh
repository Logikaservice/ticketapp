#!/bin/bash
# Script per aggiornare il backend e riavviarlo per debug Office

echo "🔍 AGGIORNAMENTO BACKEND PER DEBUG OFFICE"
echo "=========================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Vai nella directory
echo -e "${BLUE}1️⃣ Navigazione directory...${NC}"
cd /var/www/ticketapp || {
  echo -e "${RED}❌ Directory /var/www/ticketapp non trovata!${NC}"
  exit 1
}
echo -e "${GREEN}✅ Directory: $(pwd)${NC}"
echo ""

# 2. Pull codice
echo -e "${BLUE}2️⃣ Aggiornamento codice da GitHub...${NC}"
git fetch origin main
git pull origin main || {
  echo -e "${YELLOW}⚠️ Git pull fallito, eseguo reset forzato...${NC}"
  git reset --hard origin/main
}
echo -e "${GREEN}✅ Codice aggiornato${NC}"
echo "Ultimo commit:"
git log --oneline -1
echo ""

# 3. Verifica che i file modificati siano presenti
echo -e "${BLUE}3️⃣ Verifica file modificati...${NC}"
if grep -q "RICHIESTA OFFICE RICEVUTA" backend/routes/keepass.js; then
  echo -e "${GREEN}✅ File keepass.js contiene logging Office${NC}"
else
  echo -e "${RED}❌ File keepass.js NON contiene logging Office!${NC}"
  exit 1
fi

if grep -q "MIDDLEWARE AUTHENTICATE - RICHIESTA OFFICE" backend/middleware/authMiddleware.js; then
  echo -e "${GREEN}✅ File authMiddleware.js contiene logging Office${NC}"
else
  echo -e "${RED}❌ File authMiddleware.js NON contiene logging Office!${NC}"
  exit 1
fi

if grep -q "📥.*GET.*api" backend/index.js; then
  echo -e "${GREEN}✅ File index.js contiene logging generale${NC}"
else
  echo -e "${YELLOW}⚠️ File index.js potrebbe non contenere logging generale${NC}"
fi
echo ""

# 4. Riavvia backend
echo -e "${BLUE}4️⃣ Riavvio backend...${NC}"
pm2 restart backend || pm2 restart ticketapp-backend || {
  echo -e "${YELLOW}⚠️ PM2 restart fallito, provo start...${NC}"
  pm2 start backend/index.js --name backend || pm2 start backend/index.js --name ticketapp-backend
}
sleep 2
pm2 status
echo ""

# 5. Verifica log
echo -e "${BLUE}5️⃣ Verifica log backend (ultimi 20)...${NC}"
pm2 logs backend --lines 20 --nostream || pm2 logs ticketapp-backend --lines 20 --nostream
echo ""

echo -e "${GREEN}✅ Aggiornamento completato!${NC}"
echo ""
echo -e "${YELLOW}📋 PROSSIMI PASSI:${NC}"
echo "1. Prova a caricare la pagina Office nel browser"
echo "2. Controlla i log con: pm2 logs backend --lines 0"
echo "3. Cerca i log con: pm2 logs backend --lines 200 --nostream | grep -iE '(🔍|📥|⚠️|Office|keepass)'"
