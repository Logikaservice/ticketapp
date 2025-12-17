#!/bin/bash

# Script per fixare i permessi del frontend
# Esegui questo script dalla directory /var/www/ticketapp

echo "🔧 FIX PERMESSI FRONTEND"
echo "=========================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verifica che la directory build esista
echo -e "${YELLOW}📋 1. Verifica directory build...${NC}"
BUILD_DIR="/var/www/ticketapp/frontend/build"

if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}❌ Directory $BUILD_DIR non trovata!${NC}"
    echo "Esegui prima lo script fix-frontend-deploy.sh"
    exit 1
fi

if [ ! -f "$BUILD_DIR/index.html" ]; then
    echo -e "${RED}❌ File index.html non trovato in $BUILD_DIR!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Directory build trovata!${NC}"
echo ""

# 2. Fix permessi
echo -e "${YELLOW}🔐 2. Impostazione permessi...${NC}"
sudo chown -R www-data:www-data /var/www/ticketapp/frontend/build
sudo chmod -R 755 /var/www/ticketapp/frontend/build
sudo find /var/www/ticketapp/frontend/build -type f -exec chmod 644 {} \;
sudo find /var/www/ticketapp/frontend/build -type d -exec chmod 755 {} \;

echo -e "${GREEN}✅ Permessi impostati!${NC}"
echo ""

# 3. Verifica permessi
echo -e "${YELLOW}🔍 3. Verifica permessi...${NC}"
ls -la /var/www/ticketapp/frontend/build/ | head -5
echo ""

# 4. Verifica che nginx possa leggere
echo -e "${YELLOW}🔍 4. Test lettura file...${NC}"
if sudo -u www-data test -r "$BUILD_DIR/index.html"; then
    echo -e "${GREEN}✅ Nginx può leggere index.html!${NC}"
else
    echo -e "${RED}❌ Nginx NON può leggere index.html!${NC}"
    exit 1
fi
echo ""

# 5. Riavvia nginx
echo -e "${YELLOW}🔄 5. Riavvio nginx...${NC}"
sudo systemctl reload nginx
echo -e "${GREEN}✅ Nginx ricaricato!${NC}"
echo ""

echo -e "${GREEN}✅✅✅ PERMESSI FIXATI! ✅✅✅${NC}"
echo ""
echo "Il frontend dovrebbe ora essere accessibile su:"
echo "  - http://159.69.121.162"
echo "  - https://ticket.logikaservice.it"
echo ""

