#!/bin/bash

# Script per configurare HTTPS per ticket.logikaservice.it
echo "🔒 CONFIGURAZIONE HTTPS TICKETAPP"
echo "=========================================="
echo ""

# Colori
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verifica certificati SSL esistenti
echo -e "${YELLOW}📋 1. Verifica certificati SSL...${NC}"
CERT_PATH="/etc/letsencrypt/live/ticket.logikaservice.it"
if [ -f "$CERT_PATH/fullchain.pem" ] && [ -f "$CERT_PATH/privkey.pem" ]; then
    echo -e "${GREEN}✅ Certificati SSL trovati!${NC}"
    echo "Certificato: $CERT_PATH/fullchain.pem"
    echo "Chiave: $CERT_PATH/privkey.pem"
    CERT_EXISTS=true
else
    echo -e "${YELLOW}⚠️  Certificati SSL non trovati in $CERT_PATH${NC}"
    CERT_EXISTS=false
    
    # Verifica se esiste un certificato per un dominio simile
    if [ -d "/etc/letsencrypt/live" ]; then
        echo "Certificati disponibili:"
        ls -la /etc/letsencrypt/live/ 2>/dev/null | head -10
    fi
fi
echo ""

# 2. Se i certificati non esistono, prova a ottenerli con Certbot
if [ "$CERT_EXISTS" = false ]; then
    echo -e "${YELLOW}📋 2. Tentativo di ottenere certificati SSL con Certbot...${NC}"
    
    if command -v certbot &> /dev/null; then
        echo "Certbot installato!"
        echo "Eseguo: certbot certonly --nginx -d ticket.logikaservice.it"
        echo ""
        echo -e "${YELLOW}⚠️  Questo richiederà input interattivo.${NC}"
        echo "Premi INVIO per continuare o Ctrl+C per annullare..."
        read
        
        certbot certonly --nginx -d ticket.logikaservice.it
        
        if [ -f "$CERT_PATH/fullchain.pem" ] && [ -f "$CERT_PATH/privkey.pem" ]; then
            echo -e "${GREEN}✅ Certificati ottenuti con successo!${NC}"
            CERT_EXISTS=true
        else
            echo -e "${RED}❌ Impossibile ottenere certificati SSL${NC}"
            echo "Puoi:"
            echo "  1. Configurare manualmente con Certbot"
            echo "  2. Usare certificati self-signed (solo per test)"
            echo "  3. Commentare il blocco HTTPS in nginx"
        fi
    else
        echo -e "${RED}❌ Certbot non installato!${NC}"
        echo "Installa con: apt-get install certbot python3-certbot-nginx"
        echo ""
        echo "Oppure usa certificati self-signed per test:"
        echo "  mkdir -p /etc/nginx/ssl"
        echo "  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\"
        echo "    -keyout /etc/nginx/ssl/ticket.key \\"
        echo "    -out /etc/nginx/ssl/ticket.crt"
    fi
    echo ""
fi

# 3. Aggiorna configurazione nginx
echo -e "${YELLOW}📋 3. Aggiorna configurazione nginx...${NC}"
cd /var/www/ticketapp
git pull origin main

sudo cp deploy/nginx/ticketapp.conf /etc/nginx/sites-available/ticketapp.conf
sudo ln -sf /etc/nginx/sites-available/ticketapp.conf /etc/nginx/sites-enabled/ticketapp.conf

# Se i certificati non esistono, commenta le righe SSL nel file
if [ "$CERT_EXISTS" = false ]; then
    echo -e "${YELLOW}⚠️  Certificati non trovati, commento blocco HTTPS...${NC}"
    sudo sed -i 's/^    ssl_certificate /    # ssl_certificate /' /etc/nginx/sites-available/ticketapp.conf
    sudo sed -i 's/^    ssl_certificate_key /    # ssl_certificate_key /' /etc/nginx/sites-available/ticketapp.conf
    echo "Decommenta le righe quando avrai i certificati SSL"
fi

# 4. Test configurazione nginx
echo -e "${YELLOW}📋 4. Test configurazione nginx...${NC}"
if sudo nginx -t; then
    echo -e "${GREEN}✅ Configurazione nginx valida!${NC}"
else
    echo -e "${RED}❌ Errore nella configurazione nginx!${NC}"
    echo "Correggi gli errori prima di continuare"
    exit 1
fi
echo ""

# 5. Riavvia nginx
echo -e "${YELLOW}🔄 5. Riavvio nginx...${NC}"
sudo systemctl reload nginx
echo -e "${GREEN}✅ Nginx ricaricato!${NC}"
echo ""

# 6. Verifica
echo -e "${YELLOW}🔍 6. Verifica...${NC}"
echo "Test HTTP:"
curl -I http://ticket.logikaservice.it 2>&1 | head -3
echo ""
echo "Test HTTPS:"
curl -I https://ticket.logikaservice.it 2>&1 | head -3 || echo -e "${YELLOW}⚠️  HTTPS non disponibile (certificati mancanti)${NC}"
echo ""

echo -e "${GREEN}✅✅✅ CONFIGURAZIONE COMPLETATA! ✅✅✅${NC}"
echo ""
if [ "$CERT_EXISTS" = false ]; then
    echo -e "${YELLOW}⚠️  IMPORTANTE: Configura i certificati SSL per abilitare HTTPS/WSS${NC}"
    echo "Esegui: sudo certbot --nginx -d ticket.logikaservice.it"
    echo "Oppure decommenta le righe SSL in /etc/nginx/sites-available/ticketapp.conf"
fi
echo ""

