#!/bin/bash

# Script per verificare completamente HTTPS vivaldi
# Eseguire con: sudo bash deploy/scripts/verifica-https-vivaldi.sh

echo "=========================================="
echo "🔍 VERIFICA COMPLETA HTTPS VIVALDI"
echo "=========================================="
echo ""

DOMAIN="vivaldi.logikaservice.it"

# 1. Test HTTP (dovrebbe fare redirect)
echo "1️⃣ Test HTTP (dovrebbe fare redirect a HTTPS)..."
HTTP_RESPONSE=$(curl -I http://$DOMAIN 2>&1 | head -5)
echo "$HTTP_RESPONSE"
if echo "$HTTP_RESPONSE" | grep -q "301\|302\|Location.*https"; then
    echo "✅ Redirect HTTP → HTTPS funziona"
else
    echo "❌ Redirect HTTP → HTTPS NON funziona!"
    echo "   Il browser potrebbe accedere via HTTP invece di HTTPS"
fi
echo ""

# 2. Test HTTPS
echo "2️⃣ Test HTTPS..."
HTTPS_RESPONSE=$(curl -I https://$DOMAIN 2>&1 | head -10)
echo "$HTTPS_RESPONSE"
if echo "$HTTPS_RESPONSE" | grep -q "HTTP/2 200\|HTTP/1.1 200"; then
    echo "✅ HTTPS funziona correttamente"
else
    echo "❌ HTTPS non funziona!"
fi
echo ""

# 3. Verifica certificato SSL
echo "3️⃣ Verifica certificato SSL..."
CERT_INFO=$(openssl s_client -connect $DOMAIN:443 -servername $DOMAIN < /dev/null 2>/dev/null | openssl x509 -noout -dates -issuer -subject 2>/dev/null)
if [ -n "$CERT_INFO" ]; then
    echo "$CERT_INFO"
    echo ""
    if echo "$CERT_INFO" | grep -q "Let's Encrypt"; then
        echo "✅ Certificato Let's Encrypt valido"
    fi
    
    # Verifica scadenza
    EXPIRY=$(echo "$CERT_INFO" | grep "notAfter" | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y" "$EXPIRY" +%s 2>/dev/null)
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))
    echo "   Scade tra: $DAYS_LEFT giorni"
else
    echo "❌ Impossibile verificare certificato"
fi
echo ""

# 4. Verifica configurazione Nginx
echo "4️⃣ Verifica configurazione Nginx..."
CONF_FILE="/etc/nginx/sites-available/vivaldi.logikaservice.it.conf"

if [ -f "$CONF_FILE" ]; then
    echo "✅ File configurazione trovato"
    
    # Verifica redirect HTTP
    if grep -q "return 301 https" "$CONF_FILE"; then
        echo "✅ Redirect HTTP → HTTPS configurato"
        grep "return 301 https" "$CONF_FILE"
    else
        echo "❌ Redirect HTTP → HTTPS NON configurato!"
        echo "   Aggiungi nel blocco HTTP: return 301 https://\$server_name\$request_uri;"
    fi
    
    # Verifica HTTPS
    if grep -q "listen 443" "$CONF_FILE"; then
        echo "✅ Blocco HTTPS presente"
    else
        echo "❌ Blocco HTTPS mancante!"
    fi
    
    # Verifica certificati
    if grep -q "ssl_certificate.*vivaldi" "$CONF_FILE"; then
        echo "✅ Percorsi certificati configurati"
        grep "ssl_certificate" "$CONF_FILE" | grep vivaldi
    else
        echo "❌ Percorsi certificati non configurati!"
    fi
else
    echo "❌ File configurazione non trovato!"
fi
echo ""

# 5. Test connessione diretta
echo "5️⃣ Test connessione diretta porta 443..."
if timeout 3 bash -c "echo > /dev/tcp/$DOMAIN/443" 2>/dev/null; then
    echo "✅ Porta 443 accessibile"
else
    echo "❌ Porta 443 non accessibile!"
fi
echo ""

# 6. Verifica HSTS header
echo "6️⃣ Verifica HSTS header..."
HSTS=$(curl -I https://$DOMAIN 2>&1 | grep -i "strict-transport-security")
if [ -n "$HSTS" ]; then
    echo "✅ HSTS configurato: $HSTS"
else
    echo "⚠️  HSTS non trovato (opzionale ma consigliato)"
fi
echo ""

# Riepilogo
echo "=========================================="
echo "📊 RIEPILOGO"
echo "=========================================="
echo ""
echo "🔗 URL da usare nel browser:"
echo "   https://$DOMAIN"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - Assicurati di usare https:// (non http://)"
echo "   - Se vedi ancora 'Non sicuro', prova:"
echo "     1. Cancella cache del browser (Ctrl+Shift+Delete)"
echo "     2. Apri in modalità incognito (Ctrl+Shift+N)"
echo "     3. Verifica che l'URL inizi con https://"
echo ""
echo "🔍 Verifica nel browser:"
echo "   - Clicca sul lucchetto nella barra degli indirizzi"
echo "   - Dovresti vedere 'Il certificato è valido'"
echo "   - Il certificato dovrebbe essere di 'Let's Encrypt'"

