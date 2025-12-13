#!/bin/bash

# Script per configurare Nginx con reverse proxy per il backend
# Esegui questo script SULLA VPS

echo "🔧 CONFIGURAZIONE NGINX REVERSE PROXY"
echo "=========================================="
echo ""

# Backup della configurazione attuale
echo "📋 1. Backup configurazione attuale..."
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup creato"
echo ""

# Crea il file di configurazione per ticketapp
echo "📝 2. Creazione configurazione Nginx..."

sudo tee /etc/nginx/sites-available/ticketapp.conf > /dev/null << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name ticket.logikaservice.it ticketapp.logikaservice.it;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ticket.logikaservice.it ticketapp.logikaservice.it;

    # SSL configuration (usa i certificati esistenti)
    ssl_certificate /etc/letsencrypt/live/logikaservice.it/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/logikaservice.it/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Frontend - Serve static files
    root /var/www/ticketapp;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Frontend - Try files first, then index.html (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy - Forward to Node.js backend
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

    # WebSocket Support
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Uploads directory
    location /uploads {
        alias /var/www/ticketapp/TicketApp/backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/ticketapp_access.log;
    error_log /var/log/nginx/ticketapp_error.log;
}
EOF

echo "✅ File di configurazione creato"
echo ""

# Abilita il sito
echo "🔗 3. Abilitazione configurazione..."
sudo ln -sf /etc/nginx/sites-available/ticketapp.conf /etc/nginx/sites-enabled/ticketapp.conf
echo "✅ Configurazione abilitata"
echo ""

# Test configurazione Nginx
echo "🧪 4. Test configurazione Nginx..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configurazione valida!"
    echo ""
    
    # Riavvia Nginx
    echo "🔄 5. Riavvio Nginx..."
    sudo systemctl reload nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx riavviato con successo!"
        echo ""
        echo "=========================================="
        echo "✅ CONFIGURAZIONE COMPLETATA!"
        echo "=========================================="
        echo ""
        echo "🌐 Il sito è ora accessibile su:"
        echo "   https://ticket.logikaservice.it"
        echo "   https://ticketapp.logikaservice.it"
        echo ""
        echo "📋 Verifica:"
        echo "   curl https://ticket.logikaservice.it/api"
        echo ""
        echo "📊 Log:"
        echo "   sudo tail -f /var/log/nginx/ticketapp_error.log"
        echo ""
    else
        echo "❌ Errore riavvio Nginx!"
        echo "Ripristino backup..."
        sudo cp /etc/nginx/sites-available/default.backup.* /etc/nginx/sites-available/default
        sudo systemctl reload nginx
    fi
else
    echo "❌ Configurazione non valida!"
    echo "Controlla gli errori sopra"
    exit 1
fi
