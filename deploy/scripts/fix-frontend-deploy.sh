#!/bin/bash

# Script rapido per fixare il deploy del frontend
# Esegui questo script dalla directory /var/www/ticketapp

echo "🔧 FIX DEPLOY FRONTEND"
echo "=========================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Assicurati di essere nella directory corretta
if [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Directory frontend non trovata!${NC}"
    echo "Esegui questo script da /var/www/ticketapp"
    exit 1
fi

# 1. Vai in frontend e verifica il build
echo -e "${YELLOW}📋 1. Verifica build in frontend/build...${NC}"
cd frontend

if [ ! -d "build" ]; then
    echo -e "${YELLOW}⚠️  Build non trovato, ricostruisco...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Errore durante il build!${NC}"
        exit 1
    fi
fi

if [ ! -f "build/index.html" ]; then
    echo -e "${RED}❌ index.html non trovato in build/!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build trovato!${NC}"
echo ""

# 2. Torna alla directory principale
cd ..

# 3. Copia il build
echo -e "${YELLOW}📤 2. Copia build in /var/www/ticketapp/frontend/build...${NC}"
BUILD_SOURCE="$(pwd)/frontend/build"
BUILD_DEST="/var/www/ticketapp/frontend/build"

echo "Sorgente: $BUILD_SOURCE"
echo "Destinazione: $BUILD_DEST"

if [ ! -d "$BUILD_SOURCE" ]; then
    echo -e "${RED}❌ Directory build non trovata in $BUILD_SOURCE!${NC}"
    exit 1
fi

sudo rm -rf "$BUILD_DEST"
sudo mkdir -p /var/www/ticketapp/frontend
sudo cp -r "$BUILD_SOURCE" "$BUILD_DEST"
sudo chown -R www-data:www-data "$BUILD_DEST"

# 4. Verifica copia
if [ -f "$BUILD_DEST/index.html" ]; then
    echo -e "${GREEN}✅ Build copiato correttamente!${NC}"
    echo "File index.html presente in $BUILD_DEST"
else
    echo -e "${RED}❌ Errore: index.html non trovato dopo la copia!${NC}"
    exit 1
fi
echo ""

# 5. Riavvia nginx
echo -e "${YELLOW}🔄 3. Riavvio nginx...${NC}"
sudo systemctl reload nginx
echo -e "${GREEN}✅ Nginx ricaricato!${NC}"
echo ""

echo -e "${GREEN}✅✅✅ DEPLOY COMPLETATO! ✅✅✅${NC}"
echo ""
echo "Il frontend è ora disponibile su:"
echo "  - http://159.69.121.162"
echo "  - https://ticket.logikaservice.it"
echo ""

