#!/bin/bash

# Script per verificare se Certbot è installato e quali certificati SSL esistono
# Eseguire con: bash deploy/scripts/verifica-certbot.sh

echo "=========================================="
echo "🔍 VERIFICA INSTALLAZIONE CERTBOT E SSL"
echo "=========================================="
echo ""

# 1. Verifica se Certbot è installato
echo "1️⃣ Verifica installazione Certbot..."
if command -v certbot &> /dev/null; then
    CERTBOT_VERSION=$(certbot --version)
    echo "✅ Certbot è installato: $CERTBOT_VERSION"
else
    echo "❌ Certbot NON è installato"
    echo ""
    echo "Per installarlo su Ubuntu/Debian:"
    echo "  sudo apt update && sudo apt install certbot python3-certbot-nginx -y"
    exit 1
fi
echo ""

# 2. Verifica se la directory Let's Encrypt esiste
echo "2️⃣ Verifica directory Let's Encrypt..."
if [ -d "/etc/letsencrypt" ]; then
    echo "✅ Directory /etc/letsencrypt esiste"
    
    # Conta i certificati
    CERT_COUNT=$(ls -d /etc/letsencrypt/live/*/ 2>/dev/null | wc -l)
    echo "   Certificati trovati: $CERT_COUNT"
    
    if [ "$CERT_COUNT" -gt 0 ]; then
        echo ""
        echo "📜 Certificati SSL esistenti:"
        echo "----------------------------------------"
        for cert_dir in /etc/letsencrypt/live/*/; do
            if [ -d "$cert_dir" ]; then
                DOMAIN=$(basename "$cert_dir")
                CERT_FILE="$cert_dir/fullchain.pem"
                KEY_FILE="$cert_dir/privkey.pem"
                
                if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
                    # Verifica la data di scadenza
                    EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2)
                    EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y" "$EXPIRY_DATE" +%s 2>/dev/null)
                    NOW_EPOCH=$(date +%s)
                    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))
                    
                    if [ "$DAYS_LEFT" -gt 0 ]; then
                        echo "   ✅ $DOMAIN - Scade tra $DAYS_LEFT giorni ($EXPIRY_DATE)"
                    else
                        echo "   ⚠️  $DOMAIN - SCADUTO il $EXPIRY_DATE"
                    fi
                fi
            fi
        done
    else
        echo "   ℹ️  Nessun certificato trovato"
    fi
else
    echo "❌ Directory /etc/letsencrypt non esiste"
    echo "   Certbot non è mai stato eseguito"
fi
echo ""

# 3. Verifica configurazioni Nginx con SSL
echo "3️⃣ Verifica configurazioni Nginx con SSL..."
NGINX_CONF_DIR="/etc/nginx/sites-enabled"
if [ -d "$NGINX_CONF_DIR" ]; then
    SSL_CONFIGS=$(grep -r "ssl_certificate" "$NGINX_CONF_DIR" 2>/dev/null | wc -l)
    if [ "$SSL_CONFIGS" -gt 0 ]; then
        echo "✅ Trovate $SSL_CONFIGS configurazione/i Nginx con SSL"
        echo ""
        echo "📋 Domini configurati con SSL:"
        echo "----------------------------------------"
        grep -r "ssl_certificate" "$NGINX_CONF_DIR" 2>/dev/null | while read line; do
            FILE=$(echo "$line" | cut -d: -f1)
            DOMAIN=$(grep "server_name" "$FILE" 2>/dev/null | head -1 | awk '{print $2}' | sed 's/;//')
            CERT_PATH=$(echo "$line" | awk '{print $2}' | sed 's/;//')
            if [ -n "$DOMAIN" ]; then
                echo "   ✅ $DOMAIN"
                echo "      Certificato: $CERT_PATH"
            fi
        done
    else
        echo "ℹ️  Nessuna configurazione SSL trovata in Nginx"
        echo "   (I certificati potrebbero esistere ma non essere configurati)"
    fi
else
    echo "⚠️  Directory $NGINX_CONF_DIR non trovata"
fi
echo ""

# 4. Verifica domini specifici
echo "4️⃣ Verifica certificati per domini specifici..."
DOMAINS=("ticket.logikaservice.it" "orari.logikaservice.it" "vivaldi.logikaservice.it")
for domain in "${DOMAINS[@]}"; do
    CERT_DIR="/etc/letsencrypt/live/$domain"
    if [ -d "$CERT_DIR" ]; then
        if [ -f "$CERT_DIR/fullchain.pem" ]; then
            echo "   ✅ $domain - Certificato presente"
        else
            echo "   ⚠️  $domain - Directory esiste ma certificato mancante"
        fi
    else
        echo "   ❌ $domain - Nessun certificato"
    fi
done
echo ""

# 5. Verifica stato del timer di rinnovo
echo "5️⃣ Verifica auto-rinnovo certificati..."
if systemctl is-active --quiet certbot.timer; then
    echo "✅ Timer di rinnovo Certbot è ATTIVO"
    NEXT_RUN=$(systemctl list-timers certbot.timer --no-pager 2>/dev/null | grep certbot | awk '{print $1, $2}')
    if [ -n "$NEXT_RUN" ]; then
        echo "   Prossimo rinnovo: $NEXT_RUN"
    fi
else
    echo "⚠️  Timer di rinnovo Certbot NON è attivo"
    echo "   Per abilitarlo: sudo systemctl enable certbot.timer"
fi
echo ""

# 6. Verifica directory certbot per challenge
echo "6️⃣ Verifica directory Certbot per challenge..."
if [ -d "/var/www/certbot" ]; then
    echo "✅ Directory /var/www/certbot esiste"
    PERMISSIONS=$(stat -c "%a %U:%G" /var/www/certbot 2>/dev/null || stat -f "%OLp %Su:%Sg" /var/www/certbot 2>/dev/null)
    echo "   Permessi: $PERMISSIONS"
else
    echo "⚠️  Directory /var/www/certbot non esiste"
    echo "   Creala con: sudo mkdir -p /var/www/certbot && sudo chown www-data:www-data /var/www/certbot"
fi
echo ""

# Riepilogo
echo "=========================================="
echo "📊 RIEPILOGO"
echo "=========================================="
echo ""
if command -v certbot &> /dev/null && [ -d "/etc/letsencrypt" ]; then
    echo "✅ Certbot è installato e configurato"
    echo ""
    echo "Per ottenere un certificato per vivaldi.logikaservice.it:"
    echo "  sudo certbot --nginx -d vivaldi.logikaservice.it"
    echo ""
    echo "Per rinnovare tutti i certificati:"
    echo "  sudo certbot renew"
    echo ""
    echo "Per testare il rinnovo automatico:"
    echo "  sudo certbot renew --dry-run"
else
    echo "❌ Certbot non è completamente configurato"
    echo ""
    echo "Installa Certbot:"
    echo "  sudo apt update && sudo apt install certbot python3-certbot-nginx -y"
fi
echo ""

