#!/bin/bash

# Script di diagnostica per problemi SSL vivaldi
# Eseguire con: sudo bash deploy/scripts/diagnostica-ssl-vivaldi.sh

echo "=========================================="
echo "🔍 DIAGNOSTICA SSL VIVALDI"
echo "=========================================="
echo ""

# 1. Verifica certificato
echo "1️⃣ Verifica certificato SSL..."
if [ -f "/etc/letsencrypt/live/vivaldi.logikaservice.it/fullchain.pem" ]; then
    echo "✅ Certificato trovato"
    ls -la /etc/letsencrypt/live/vivaldi.logikaservice.it/
    
    # Verifica permessi
    PERMS=$(stat -c "%a %U:%G" /etc/letsencrypt/live/vivaldi.logikaservice.it/fullchain.pem 2>/dev/null)
    echo "   Permessi: $PERMS"
else
    echo "❌ Certificato NON trovato!"
fi
echo ""

# 2. Verifica file configurazione
echo "2️⃣ Verifica configurazione Nginx..."
CONF_FILE="/etc/nginx/sites-available/vivaldi.logikaservice.it.conf"
ENABLED_FILE="/etc/nginx/sites-enabled/vivaldi.logikaservice.it.conf"

if [ -f "$CONF_FILE" ]; then
    echo "✅ File configurazione trovato: $CONF_FILE"
    
    if [ -L "$ENABLED_FILE" ] || [ -f "$ENABLED_FILE" ]; then
        echo "✅ File abilitato: $ENABLED_FILE"
    else
        echo "❌ File NON abilitato! Crea il symlink:"
        echo "   sudo ln -s $CONF_FILE $ENABLED_FILE"
    fi
    
    echo ""
    echo "📄 Contenuto file configurazione:"
    echo "----------------------------------------"
    cat "$CONF_FILE"
    echo "----------------------------------------"
else
    echo "❌ File configurazione NON trovato: $CONF_FILE"
fi
echo ""

# 3. Verifica se HTTPS è configurato
echo "3️⃣ Verifica configurazione HTTPS..."
if grep -q "listen 443" "$CONF_FILE" 2>/dev/null; then
    echo "✅ Blocco HTTPS presente"
    
    if grep -q "ssl_certificate.*vivaldi" "$CONF_FILE" 2>/dev/null; then
        echo "✅ Percorso certificato configurato"
        grep "ssl_certificate" "$CONF_FILE" | grep vivaldi
    else
        echo "❌ Percorso certificato NON configurato correttamente!"
    fi
else
    echo "❌ Blocco HTTPS NON presente!"
fi
echo ""

# 4. Test configurazione Nginx
echo "4️⃣ Test configurazione Nginx..."
sudo nginx -t 2>&1
NGINX_TEST=$?
echo ""

# 5. Verifica stato Nginx
echo "5️⃣ Stato Nginx..."
sudo systemctl status nginx --no-pager -l | head -10
echo ""

# 6. Verifica porte in ascolto
echo "6️⃣ Porte in ascolto..."
echo "Porta 80 (HTTP):"
sudo netstat -tlnp | grep :80 || ss -tlnp | grep :80
echo ""
echo "Porta 443 (HTTPS):"
sudo netstat -tlnp | grep :443 || ss -tlnp | grep :443
echo ""

# 7. Verifica firewall
echo "7️⃣ Verifica firewall..."
if command -v ufw &> /dev/null; then
    echo "UFW Status:"
    sudo ufw status | grep -E "(80|443|Status)"
elif command -v firewall-cmd &> /dev/null; then
    echo "Firewalld Status:"
    sudo firewall-cmd --list-ports 2>/dev/null | grep -E "(80|443)" || echo "Porte non trovate"
else
    echo "⚠️  Nessun firewall rilevato (iptables potrebbe essere attivo)"
fi
echo ""

# 8. Test connessione HTTPS
echo "8️⃣ Test connessione HTTPS..."
echo "Test locale:"
curl -k -I https://localhost 2>&1 | head -5 || echo "Errore connessione locale"
echo ""
echo "Test dominio:"
curl -k -I https://vivaldi.logikaservice.it 2>&1 | head -10 || echo "Errore connessione dominio"
echo ""

# 9. Verifica log errori
echo "9️⃣ Ultimi errori Nginx..."
echo "Ultime 20 righe di error.log:"
sudo tail -20 /var/log/nginx/error.log 2>/dev/null || echo "Log non trovato"
echo ""

# 10. Verifica tutte le configurazioni Nginx
echo "🔟 Configurazioni Nginx abilitate..."
echo "File in sites-enabled:"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null | grep vivaldi || echo "Nessun file vivaldi trovato"
echo ""

# 11. Verifica conflitti server_name
echo "1️⃣1️⃣ Verifica conflitti server_name..."
echo "Cerca altri server con stesso server_name:"
sudo grep -r "server_name.*vivaldi" /etc/nginx/sites-enabled/ 2>/dev/null
echo ""

# 12. Verifica DNS
echo "1️⃣2️⃣ Verifica DNS..."
DNS_IP=$(dig +short vivaldi.logikaservice.it | head -1)
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "DNS vivaldi.logikaservice.it -> $DNS_IP"
echo "IP Server -> $SERVER_IP"
if [ "$DNS_IP" = "$SERVER_IP" ] || [ -n "$DNS_IP" ]; then
    echo "✅ DNS configurato"
else
    echo "⚠️  DNS potrebbe non puntare al server corretto"
fi
echo ""

# Riepilogo
echo "=========================================="
echo "📊 RIEPILOGO"
echo "=========================================="
echo ""

if [ $NGINX_TEST -eq 0 ]; then
    echo "✅ Configurazione Nginx valida"
else
    echo "❌ Errore nella configurazione Nginx!"
    echo "   Correggi gli errori sopra e riprova"
fi

if [ -f "$CONF_FILE" ] && [ -L "$ENABLED_FILE" ]; then
    echo "✅ File configurazione presente e abilitato"
else
    echo "❌ Problema con file configurazione!"
fi

if grep -q "listen 443" "$CONF_FILE" 2>/dev/null; then
    echo "✅ Blocco HTTPS presente"
else
    echo "❌ Blocco HTTPS mancante!"
fi

if sudo netstat -tlnp 2>/dev/null | grep -q ":443" || ss -tlnp 2>/dev/null | grep -q ":443"; then
    echo "✅ Porta 443 in ascolto"
else
    echo "❌ Porta 443 NON in ascolto!"
    echo "   Nginx potrebbe non aver caricato la configurazione HTTPS"
fi

echo ""
echo "🔧 PROSSIMI PASSI:"
echo "1. Se ci sono errori Nginx, correggili"
echo "2. Se il file non è abilitato: sudo ln -s $CONF_FILE $ENABLED_FILE"
echo "3. Se HTTPS non è configurato, aggiungi il blocco server per porta 443"
echo "4. Riavvia Nginx: sudo systemctl reload nginx"
echo "5. Verifica: curl -I https://vivaldi.logikaservice.it"

