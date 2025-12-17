#!/bin/bash

# Script completo per deploy frontend
# Esegui questo script dalla directory /var/www/ticketapp

echo "🚀 DEPLOY FRONTEND COMPLETO"
echo "=========================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Assicurati di essere nella directory corretta
PROJECT_DIR="/var/www/ticketapp"
cd "$PROJECT_DIR"

if [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Directory frontend non trovata!${NC}"
    exit 1
fi

# 1. Vai in frontend e verifica/ricostruisci il build
echo -e "${YELLOW}📋 1. Verifica e build frontend...${NC}"
cd frontend

# Verifica se il build esiste e è recente
if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
    echo -e "${YELLOW}⚠️  Build non trovato o incompleto, ricostruisco...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Errore durante il build!${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Build esistente trovato!${NC}"
fi

# Verifica che index.html esista
if [ ! -f "build/index.html" ]; then
    echo -e "${RED}❌ index.html non trovato dopo il build!${NC}"
    echo "Contenuto directory build:"
    ls -la build/ 2>/dev/null || echo "Directory build non esiste!"
    exit 1
fi

echo -e "${GREEN}✅ Build verificato!${NC}"
echo "Percorso build: $(pwd)/build"
echo ""

# 2. Salva il percorso assoluto del build
BUILD_SOURCE="$(pwd)/build"
echo "Sorgente build: $BUILD_SOURCE"

# 3. Torna alla directory principale
cd "$PROJECT_DIR"

# 4. Copia il build nella directory nginx
echo -e "${YELLOW}📤 2. Copia build in /var/www/ticketapp/frontend/build...${NC}"
BUILD_DEST="/var/www/ticketapp/frontend/build"

echo "Sorgente: $BUILD_SOURCE"
echo "Destinazione: $BUILD_DEST"

# Verifica che la sorgente esista
if [ ! -d "$BUILD_SOURCE" ]; then
    echo -e "${RED}❌ Directory build non trovata in $BUILD_SOURCE!${NC}"
    exit 1
fi

if [ ! -f "$BUILD_SOURCE/index.html" ]; then
    echo -e "${RED}❌ index.html non trovato in $BUILD_SOURCE!${NC}"
    exit 1
fi

# Rimuovi la destinazione e ricreala
echo "Rimozione directory destinazione esistente..."
sudo rm -rf "$BUILD_DEST"
sudo mkdir -p /var/www/ticketapp/frontend

# Copia il build
echo "Copia file..."
sudo cp -r "$BUILD_SOURCE" "$BUILD_DEST"

# 5. Imposta permessi
echo -e "${YELLOW}🔐 3. Impostazione permessi...${NC}"
sudo chown -R www-data:www-data "$BUILD_DEST"
sudo chmod -R 755 "$BUILD_DEST"
sudo find "$BUILD_DEST" -type f -exec chmod 644 {} \;
sudo find "$BUILD_DEST" -type d -exec chmod 755 {} \;

# 6. Verifica copia
echo -e "${YELLOW}🔍 4. Verifica copia...${NC}"
if [ -f "$BUILD_DEST/index.html" ]; then
    echo -e "${GREEN}✅ Build copiato correttamente!${NC}"
    echo "File index.html presente in $BUILD_DEST"
    ls -lh "$BUILD_DEST/index.html"
else
    echo -e "${RED}❌ Errore: index.html non trovato dopo la copia!${NC}"
    echo "Contenuto $BUILD_DEST:"
    sudo ls -la "$BUILD_DEST" 2>/dev/null || echo "Directory non esiste!"
    exit 1
fi

# 7. Verifica permessi nginx
echo -e "${YELLOW}🔍 5. Verifica permessi nginx...${NC}"
if sudo -u www-data test -r "$BUILD_DEST/index.html"; then
    echo -e "${GREEN}✅ Nginx può leggere index.html!${NC}"
else
    echo -e "${RED}❌ Nginx NON può leggere index.html!${NC}"
    exit 1
fi
echo ""

# 8. Riavvia nginx
echo -e "${YELLOW}🔄 6. Riavvio nginx...${NC}"
sudo nginx -t
if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    echo -e "${GREEN}✅ Nginx ricaricato!${NC}"
else
    echo -e "${RED}❌ Errore nella configurazione nginx!${NC}"
    exit 1
fi
echo ""

echo -e "${GREEN}✅✅✅ DEPLOY COMPLETATO CON SUCCESSO! ✅✅✅${NC}"
echo ""
echo "Il frontend è ora disponibile su:"
echo "  - http://159.69.121.162"
echo "  - https://ticket.logikaservice.it"
echo ""
echo "Se vedi ancora errori, svuota la cache del browser:"
echo "  - Chrome/Edge: Ctrl+Shift+R (Windows) o Cmd+Shift+R (Mac)"
echo "  - Firefox: Ctrl+F5 (Windows) o Cmd+Shift+R (Mac)"
echo ""

