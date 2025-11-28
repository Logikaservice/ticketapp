#!/bin/bash

# Script per ottenere il certificato SSL per vivaldi.logikaservice.it
# Eseguire con: sudo bash deploy/scripts/ottieni-ssl-vivaldi.sh

echo "=========================================="
echo "🔒 OTTENIMENTO CERTIFICATO SSL PER VIVALDI"
echo "=========================================="
echo ""

# Verifica che Certbot sia installato
if ! command -v certbot &> /dev/null; then
    echo "❌ Certbot non è installato!"
    echo "Installa con: sudo apt install certbot python3-certbot-nginx -y"
    exit 1
fi

echo "✅ Certbot trovato: $(certbot --version)"
echo ""

# Verifica che la configurazione Nginx esista
if [ ! -f "/etc/nginx/sites-available/vivaldi.logikaservice.it.conf" ]; then
    echo "⚠️  Configurazione Nginx non trovata!"
    echo "Assicurati che il file esista: /etc/nginx/sites-available/vivaldi.logikaservice.it.conf"
    echo ""
    echo "Se non esiste, copialo dal repository:"
    echo "  sudo cp /path/to/TicketApp/deploy/nginx/vivaldi.logikaservice.it.conf /etc/nginx/sites-available/"
    echo "  sudo ln -s /etc/nginx/sites-available/vivaldi.logikaservice.it.conf /etc/nginx/sites-enabled/"
    exit 1
fi

echo "✅ Configurazione Nginx trovata"
echo ""

# Verifica che Nginx sia configurato correttamente
echo "🔍 Verifica configurazione Nginx..."
if sudo nginx -t 2>&1 | grep -q "test is successful"; then
    echo "✅ Configurazione Nginx valida"
else
    echo "❌ Errore nella configurazione Nginx!"
    sudo nginx -t
    exit 1
fi
echo ""

# Verifica che la directory certbot esista
if [ ! -d "/var/www/certbot" ]; then
    echo "📁 Creazione directory /var/www/certbot..."
    sudo mkdir -p /var/www/certbot
    sudo chown -R www-data:www-data /var/www/certbot
    sudo chmod -R 755 /var/www/certbot
    echo "✅ Directory creata"
else
    echo "✅ Directory /var/www/certbot esiste"
fi
echo ""

# Verifica che il dominio risponda
echo "🌐 Verifica DNS..."
if dig +short vivaldi.logikaservice.it | grep -q "^[0-9]"; then
    IP=$(dig +short vivaldi.logikaservice.it | head -1)
    echo "✅ DNS configurato: vivaldi.logikaservice.it -> $IP"
else
    echo "⚠️  Attenzione: DNS potrebbe non essere configurato correttamente"
    echo "   Verifica che vivaldi.logikaservice.it punti all'IP del server"
fi
echo ""

# Verifica se il certificato esiste già
if [ -d "/etc/letsencrypt/live/vivaldi.logikaservice.it" ]; then
    echo "⚠️  Certificato SSL per vivaldi.logikaservice.it esiste già!"
    echo ""
    echo "Per rinnovarlo:"
    echo "  sudo certbot renew --cert-name vivaldi.logikaservice.it"
    echo ""
    echo "Per forzare il rinnovo:"
    echo "  sudo certbot renew --cert-name vivaldi.logikaservice.it --force-renewal"
    echo ""
    read -p "Vuoi comunque procedere? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 0
    fi
fi

echo "🚀 Avvio ottenimento certificato SSL..."
echo ""
echo "Certbot ti chiederà:"
echo "  1. Email per notifiche (usa la stessa degli altri certificati)"
echo "  2. Accettazione termini (A)"
echo "  3. Condivisione email EFF (opzionale, N)"
echo "  4. Redirect HTTP a HTTPS (scegli 2 - Redirect)"
echo ""

# Ottieni il certificato
sudo certbot --nginx -d vivaldi.logikaservice.it

# Verifica il risultato
if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ CERTIFICATO SSL OTTENUTO CON SUCCESSO!"
    echo "=========================================="
    echo ""
    echo "Verifica che il certificato sia stato creato:"
    echo "  sudo ls -la /etc/letsencrypt/live/vivaldi.logikaservice.it/"
    echo ""
    echo "Testa HTTPS:"
    echo "  curl -I https://vivaldi.logikaservice.it"
    echo ""
    echo "Apri nel browser:"
    echo "  https://vivaldi.logikaservice.it"
    echo ""
    echo "Il certificato verrà rinnovato automaticamente ogni 90 giorni."
else
    echo ""
    echo "=========================================="
    echo "❌ ERRORE DURANTE L'OTTENIMENTO DEL CERTIFICATO"
    echo "=========================================="
    echo ""
    echo "Controlla i log:"
    echo "  sudo tail -f /var/log/letsencrypt/letsencrypt.log"
    echo ""
    echo "Verifica:"
    echo "  - DNS configurato correttamente"
    echo "  - Porta 80 accessibile"
    echo "  - Nginx in esecuzione"
    echo "  - Configurazione Nginx valida"
fi

