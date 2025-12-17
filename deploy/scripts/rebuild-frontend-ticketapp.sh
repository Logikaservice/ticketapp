#!/bin/bash

# Script per ricostruire e deployare il frontend TicketApp sulla VPS
# Esegui questo script SULLA VPS via SSH

echo "🚀 REBUILD FRONTEND TICKETAPP"
echo "=========================================="
echo ""

# Colori per output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Rileva automaticamente la directory del progetto
# Prova diverse posizioni comuni
if [ -d "/root/TicketApp" ]; then
    PROJECT_DIR="/root/TicketApp"
elif [ -d "/var/www/ticketapp" ]; then
    PROJECT_DIR="/var/www/ticketapp"
elif [ -d "$(pwd)/.." ] && [ -f "$(pwd)/../package.json" ]; then
    # Se siamo in una sottodirectory del progetto
    PROJECT_DIR="$(cd .. && pwd)"
else
    # Prova la directory corrente se contiene frontend/
    if [ -d "frontend" ]; then
        PROJECT_DIR="$(pwd)"
    else
        echo -e "${RED}❌ Directory del progetto non trovata!${NC}"
        echo "Cerca in: /root/TicketApp, /var/www/ticketapp o nella directory corrente"
        exit 1
    fi
fi

echo -e "${GREEN}📁 Directory progetto: $PROJECT_DIR${NC}"
cd $PROJECT_DIR

# 1. Pull delle modifiche da GitHub
echo -e "${YELLOW}📥 1. Pull da GitHub...${NC}"
echo "----------------------------------------"
git pull origin main
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Errore durante git pull!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Codice aggiornato!${NC}"
echo ""

# 2. Installa dipendenze frontend (se necessario)
echo -e "${YELLOW}📦 2. Installazione dipendenze frontend...${NC}"
echo "----------------------------------------"
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Errore durante npm install!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Dipendenze installate!${NC}"
echo ""

# 3. Build del frontend
echo -e "${YELLOW}🔨 3. Build frontend...${NC}"
echo "----------------------------------------"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Errore durante il build!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build completato!${NC}"
echo ""

# 4. Copia il build nella directory nginx
echo -e "${YELLOW}📋 4. Copia build in /var/www/ticketapp/frontend/build...${NC}"
echo "----------------------------------------"
# Siamo ancora in frontend/, quindi build/ è qui
BUILD_DIR="$(pwd)/build"
if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}❌ Directory build non trovata in $(pwd)!${NC}"
    echo "Contenuto directory corrente:"
    ls -la
    exit 1
fi

echo "Directory build trovata: $BUILD_DIR"
echo "Contenuto build:"
ls -la "$BUILD_DIR" | head -10

# Rimuovi la directory di destinazione e ricreala
sudo rm -rf /var/www/ticketapp/frontend/build
sudo mkdir -p /var/www/ticketapp/frontend

# Copia il contenuto della directory build
sudo cp -r "$BUILD_DIR" /var/www/ticketapp/frontend/
sudo chown -R www-data:www-data /var/www/ticketapp/frontend/build

# Verifica che i file siano stati copiati
if [ -f "/var/www/ticketapp/frontend/build/index.html" ]; then
    echo -e "${GREEN}✅ Build copiato correttamente!${NC}"
    echo "File index.html presente in /var/www/ticketapp/frontend/build/"
else
    echo -e "${RED}❌ Errore: index.html non trovato dopo la copia!${NC}"
    echo "Contenuto /var/www/ticketapp/frontend/build/:"
    sudo ls -la /var/www/ticketapp/frontend/build/ | head -10
    exit 1
fi
echo ""

# Torna alla directory del progetto
cd $PROJECT_DIR

# 5. Aggiorna configurazione nginx
echo -e "${YELLOW}🔧 5. Aggiornamento configurazione nginx...${NC}"
echo "----------------------------------------"
if [ -f "$PROJECT_DIR/deploy/nginx/ticketapp.conf" ]; then
    sudo cp $PROJECT_DIR/deploy/nginx/ticketapp.conf /etc/nginx/sites-available/ticketapp.conf
    sudo ln -sf /etc/nginx/sites-available/ticketapp.conf /etc/nginx/sites-enabled/ticketapp.conf
    sudo nginx -t
    if [ $? -eq 0 ]; then
        sudo systemctl reload nginx
        echo -e "${GREEN}✅ Nginx ricaricato!${NC}"
    else
        echo -e "${RED}❌ Errore nella configurazione nginx!${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  File nginx config non trovato, salto aggiornamento${NC}"
fi
echo ""

# 6. Pulisci cache browser (header nginx)
echo -e "${YELLOW}🧹 6. Configurazione cache headers...${NC}"
echo "----------------------------------------"
# Aggiungi header per evitare cache del frontend
if ! grep -q "add_header Cache-Control" /etc/nginx/sites-available/ticketapp.conf; then
    echo -e "${YELLOW}⚠️  Considera di aggiungere header Cache-Control nella configurazione nginx${NC}"
fi
echo ""

echo -e "${GREEN}✅✅✅ FRONTEND AGGIORNATO CON SUCCESSO! ✅✅✅${NC}"
echo ""
echo "Il frontend è ora disponibile su:"
echo "  - http://159.69.121.162"
echo "  - https://ticket.logikaservice.it"
echo ""
echo "Se vedi ancora la versione vecchia, svuota la cache del browser:"
echo "  - Chrome/Edge: Ctrl+Shift+R (Windows) o Cmd+Shift+R (Mac)"
echo "  - Firefox: Ctrl+F5 (Windows) o Cmd+Shift+R (Mac)"
echo ""

