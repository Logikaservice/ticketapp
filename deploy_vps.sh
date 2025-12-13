#!/bin/bash

# Script di deploy automatico per VPS Hetzner
# Esegui questo script SULLA VPS via SSH

echo "🚀 DEPLOY TICKETAPP SU VPS HETZNER"
echo "=========================================="
echo ""

# Colori per output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Directory del progetto
PROJECT_DIR="/root/TicketApp"

# Verifica che la directory esista
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Directory $PROJECT_DIR non trovata!${NC}"
    echo "Clona prima il repository:"
    echo "cd /root && git clone https://github.com/Logikaservice/ticketapp.git TicketApp"
    exit 1
fi

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

# 2. Installa dipendenze backend (se necessario)
echo -e "${YELLOW}📦 2. Verifica dipendenze backend...${NC}"
echo "----------------------------------------"
cd backend
npm install --production
echo -e "${GREEN}✅ Dipendenze backend OK!${NC}"
echo ""

# 3. Riavvia backend con PM2
echo -e "${YELLOW}🔄 3. Riavvio backend...${NC}"
echo "----------------------------------------"
pm2 restart backend || pm2 start index.js --name backend
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Errore riavvio backend!${NC}"
    pm2 logs backend --lines 20
    exit 1
fi
echo -e "${GREEN}✅ Backend riavviato!${NC}"
pm2 list
echo ""

# 4. Build frontend
echo -e "${YELLOW}📦 4. Build frontend...${NC}"
echo "----------------------------------------"
cd ../frontend
npm install
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Errore durante build frontend!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Frontend compilato!${NC}"
echo ""

# 5. Copia build in directory Nginx
echo -e "${YELLOW}📤 5. Deploy frontend su Nginx...${NC}"
echo "----------------------------------------"
NGINX_DIR="/var/www/ticket"
if [ ! -d "$NGINX_DIR" ]; then
    echo "Creazione directory $NGINX_DIR..."
    sudo mkdir -p $NGINX_DIR
fi

sudo rm -rf $NGINX_DIR/*
sudo cp -r build/* $NGINX_DIR/
sudo chown -R www-data:www-data $NGINX_DIR
echo -e "${GREEN}✅ Frontend deployato!${NC}"
echo ""

# 6. Test configurazione Nginx
echo -e "${YELLOW}🔧 6. Test configurazione Nginx...${NC}"
echo "----------------------------------------"
sudo nginx -t
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Configurazione Nginx non valida!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Configurazione Nginx OK!${NC}"
echo ""

# 7. Riavvia Nginx
echo -e "${YELLOW}🔄 7. Riavvio Nginx...${NC}"
echo "----------------------------------------"
sudo systemctl restart nginx
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Errore riavvio Nginx!${NC}"
    sudo systemctl status nginx
    exit 1
fi
echo -e "${GREEN}✅ Nginx riavviato!${NC}"
echo ""

# 8. Verifica stato servizi
echo -e "${YELLOW}📊 8. Stato servizi...${NC}"
echo "----------------------------------------"
echo "Backend (PM2):"
pm2 list | grep backend
echo ""
echo "Nginx:"
sudo systemctl status nginx --no-pager | head -5
echo ""

# 9. Riepilogo finale
echo "=========================================="
echo -e "${GREEN}✅ DEPLOY COMPLETATO CON SUCCESSO!${NC}"
echo "=========================================="
echo ""
echo "🌐 URL: https://ticket.logikaservice.it"
echo ""
echo "📋 Comandi utili:"
echo "   - Logs backend: pm2 logs backend"
echo "   - Restart backend: pm2 restart backend"
echo "   - Logs Nginx: sudo tail -f /var/log/nginx/error.log"
echo "   - Restart Nginx: sudo systemctl restart nginx"
echo ""
echo "🔍 Test connessione:"
echo "   curl https://ticket.logikaservice.it/api"
echo ""
