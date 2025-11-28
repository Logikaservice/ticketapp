#!/bin/bash

# Script per configurare manualmente HTTPS per vivaldi.logikaservice.it
# Eseguire con: sudo bash deploy/scripts/configura-https-vivaldi-manuale.sh

echo "=========================================="
echo "🔒 CONFIGURAZIONE MANUALE HTTPS VIVALDI"
echo "=========================================="
echo ""

CONF_FILE="/etc/nginx/sites-available/vivaldi.logikaservice.it.conf"
ENABLED_FILE="/etc/nginx/sites-enabled/vivaldi.logikaservice.it.conf"

# Verifica certificato
if [ ! -f "/etc/letsencrypt/live/vivaldi.logikaservice.it/fullchain.pem" ]; then
    echo "❌ Certificato non trovato!"
    exit 1
fi
echo "✅ Certificato trovato"

# Verifica file configurazione
if [ ! -f "$CONF_FILE" ]; then
    echo "❌ File configurazione non trovato: $CONF_FILE"
    exit 1
fi
echo "✅ File configurazione trovato"

# Backup
sudo cp "$CONF_FILE" "${CONF_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup creato"
echo ""

# Verifica se HTTPS è già configurato
if grep -q "listen 443" "$CONF_FILE"; then
    echo "⚠️  Blocco HTTPS già presente"
    echo "   Verifico i percorsi dei certificati..."
    
    if grep -q "/etc/letsencrypt/live/vivaldi.logikaservice.it/fullchain.pem" "$CONF_FILE"; then
        echo "✅ Percorsi certificati corretti"
    else
        echo "⚠️  Percorsi certificati potrebbero essere errati"
        echo "   Correggo..."
        sudo sed -i 's|ssl_certificate.*|ssl_certificate /etc/letsencrypt/live/vivaldi.logikaservice.it/fullchain.pem;|' "$CONF_FILE"
        sudo sed -i 's|ssl_certificate_key.*|ssl_certificate_key /etc/letsencrypt/live/vivaldi.logikaservice.it/privkey.pem;|' "$CONF_FILE"
        echo "✅ Percorsi corretti"
    fi
else
    echo "📝 Aggiungo blocco HTTPS..."
    
    # Crea blocco HTTPS completo
    HTTPS_CONFIG=$(cat <<'EOF'

# Blocco HTTPS - Configurato manualmente
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
    
    # Aggiungi alla fine del file
    echo "$HTTPS_CONFIG" | sudo tee -a "$CONF_FILE" > /dev/null
    echo "✅ Blocco HTTPS aggiunto"
fi

# Modifica blocco HTTP per redirect
echo ""
echo "🔄 Configuro redirect HTTP → HTTPS..."

# Rimuovi commento dal redirect se presente
sudo sed -i 's/# Redirect HTTP to HTTPS/return 301 https:\/\/$server_name$request_uri;/' "$CONF_FILE" 2>/dev/null || true

# Se non c'è redirect, aggiungilo dopo server_name
if ! grep -q "return 301 https" "$CONF_FILE"; then
    # Trova la riga con server_name e aggiungi redirect dopo
    sudo sed -i '/server_name vivaldi.logikaservice.it;/a\    return 301 https://$server_name$request_uri;' "$CONF_FILE"
    
    # Commenta le location esistenti nel blocco HTTP (tranne acme-challenge)
    sudo sed -i '/listen 80;/,/^}/ {
        /location \/ {/,/^    }/ {
            /location \/ {/ s/^/#/
            /try_files/ s/^/#/
            /^    }/ s/^/#/
        }
        /location \/api {/,/^    }/ {
            /location \/api {/ s/^/#/
            /proxy_pass/ s/^/#/
            /^    }/ s/^/#/
        }
        /location \/socket.io {/,/^    }/ {
            /location \/socket.io {/ s/^/#/
            /proxy_pass/ s/^/#/
            /^    }/ s/^/#/
        }
    }' "$CONF_FILE" 2>/dev/null || true
fi

echo "✅ Redirect configurato"
echo ""

# Verifica configurazione
echo "🔍 Verifica configurazione Nginx..."
if sudo nginx -t 2>&1 | grep -q "test is successful"; then
    echo "✅ Configurazione valida!"
    echo ""
    echo "🔄 Riavvio Nginx..."
    sudo systemctl reload nginx
    if [ $? -eq 0 ]; then
        echo "✅ Nginx riavviato con successo"
        echo ""
        echo "=========================================="
        echo "✅ HTTPS CONFIGURATO!"
        echo "=========================================="
        echo ""
        echo "Testa HTTPS:"
        echo "  curl -I https://vivaldi.logikaservice.it"
        echo ""
        echo "Apri nel browser:"
        echo "  https://vivaldi.logikaservice.it"
        echo ""
        echo "Dovresti vedere il lucchetto verde! 🔒"
    else
        echo "❌ Errore nel riavvio di Nginx"
        echo "Controlla i log: sudo tail -f /var/log/nginx/error.log"
        exit 1
    fi
else
    echo "❌ Errore nella configurazione!"
    sudo nginx -t
    exit 1
fi

