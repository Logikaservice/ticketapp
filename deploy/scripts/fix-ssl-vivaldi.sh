#!/bin/bash

# Script per configurare manualmente SSL per vivaldi.logikaservice.it
# Eseguire con: sudo bash deploy/scripts/fix-ssl-vivaldi.sh

echo "=========================================="
echo "🔧 CONFIGURAZIONE MANUALE SSL VIVALDI"
echo "=========================================="
echo ""

# Verifica che il certificato esista
if [ ! -f "/etc/letsencrypt/live/vivaldi.logikaservice.it/fullchain.pem" ]; then
    echo "❌ Certificato non trovato!"
    echo "Ottieni prima il certificato con:"
    echo "  sudo certbot --nginx -d vivaldi.logikaservice.it"
    exit 1
fi

echo "✅ Certificato trovato"
echo ""

# Verifica che la configurazione Nginx esista
CONF_FILE="/etc/nginx/sites-available/vivaldi.logikaservice.it.conf"
ENABLED_FILE="/etc/nginx/sites-enabled/vivaldi.logikaservice.it.conf"

if [ ! -f "$CONF_FILE" ]; then
    echo "❌ File di configurazione non trovato: $CONF_FILE"
    echo ""
    echo "Copia il file dal repository:"
    echo "  sudo cp /path/to/TicketApp/deploy/nginx/vivaldi.logikaservice.it.conf $CONF_FILE"
    exit 1
fi

echo "✅ File di configurazione trovato"
echo ""

# Verifica che sia abilitato
if [ ! -L "$ENABLED_FILE" ]; then
    echo "📌 Abilitazione configurazione Nginx..."
    sudo ln -s "$CONF_FILE" "$ENABLED_FILE"
    echo "✅ Configurazione abilitata"
else
    echo "✅ Configurazione già abilitata"
fi
echo ""

# Backup della configurazione
echo "💾 Backup configurazione..."
sudo cp "$CONF_FILE" "${CONF_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup creato"
echo ""

# Verifica se esiste già un blocco HTTPS
if grep -q "listen 443" "$CONF_FILE"; then
    echo "⚠️  Blocco HTTPS già presente nella configurazione"
    echo "   Verifica manualmente che i percorsi dei certificati siano corretti"
    echo ""
    echo "Percorsi corretti dovrebbero essere:"
    echo "  ssl_certificate /etc/letsencrypt/live/vivaldi.logikaservice.it/fullchain.pem;"
    echo "  ssl_certificate_key /etc/letsencrypt/live/vivaldi.logikaservice.it/privkey.pem;"
    echo ""
    read -p "Vuoi comunque procedere con l'installazione automatica? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 0
    fi
fi

# Prova a installare il certificato con certbot install
echo "🔧 Installazione certificato con Certbot..."
sudo certbot install --cert-name vivaldi.logikaservice.it --nginx

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Certificato installato con successo!"
else
    echo ""
    echo "⚠️  Certbot install non è riuscito, configuriamo manualmente..."
    echo ""
    
    # Crea configurazione HTTPS manualmente
    echo "📝 Creazione configurazione HTTPS manuale..."
    
    # Leggi il contenuto attuale
    HTTP_BLOCK=$(grep -A 100 "server {" "$CONF_FILE" | grep -B 100 "^}" | head -n -1)
    
    # Crea il blocco HTTPS
    HTTPS_BLOCK=$(cat <<'EOF'
# Blocco HTTPS - Configurato da Certbot
server {
    listen 443 ssl http2;
    server_name vivaldi.logikaservice.it;
    
    ssl_certificate /etc/letsencrypt/live/vivaldi.logikaservice.it/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vivaldi.logikaservice.it/privkey.pem;
    
    # Configurazione SSL ottimizzata
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    root /var/www/ticketapp/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket per Socket.IO
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Log files
    access_log /var/log/nginx/vivaldi-access.log;
    error_log /var/log/nginx/vivaldi-error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
}
EOF
)
    
    # Aggiungi il blocco HTTPS al file
    echo "$HTTPS_BLOCK" | sudo tee -a "$CONF_FILE" > /dev/null
    
    # Modifica il blocco HTTP per fare redirect
    sudo sed -i 's/# Redirect HTTP to HTTPS/return 301 https:\/\/$server_name$request_uri;/' "$CONF_FILE" 2>/dev/null || true
    
    # Se non c'è il redirect, aggiungilo
    if ! grep -q "return 301 https" "$CONF_FILE"; then
        # Aggiungi redirect dopo server_name nel blocco HTTP
        sudo sed -i '/server_name vivaldi.logikaservice.it;/a\    return 301 https://$server_name$request_uri;' "$CONF_FILE"
    fi
    
    echo "✅ Configurazione HTTPS aggiunta"
fi

echo ""
echo "🔍 Verifica configurazione Nginx..."
if sudo nginx -t; then
    echo ""
    echo "✅ Configurazione valida!"
    echo ""
    echo "🔄 Riavvio Nginx..."
    sudo systemctl reload nginx
    echo ""
    echo "=========================================="
    echo "✅ CONFIGURAZIONE COMPLETATA!"
    echo "=========================================="
    echo ""
    echo "Testa HTTPS:"
    echo "  curl -I https://vivaldi.logikaservice.it"
    echo ""
    echo "Apri nel browser:"
    echo "  https://vivaldi.logikaservice.it"
else
    echo ""
    echo "❌ Errore nella configurazione Nginx!"
    echo "Controlla il file: $CONF_FILE"
    exit 1
fi

