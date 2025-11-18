#!/bin/bash
# Script di diagnostica completa per problemi SMTP sulla VPS

echo "🔍 DIAGNOSTICA COMPLETA RETE SMTP"
echo "=================================="
echo ""

# 1. Verifica UFW
echo "1️⃣  VERIFICA FIREWALL UFW:"
echo "----------------------------"
sudo ufw status verbose | head -n 20
echo ""

# 2. Verifica iptables (potrebbe bloccare anche se UFW è configurato)
echo "2️⃣  VERIFICA IPTABLES (potrebbe bloccare anche con UFW):"
echo "----------------------------------------------------------"
echo "Regole OUTPUT iptables:"
sudo iptables -L OUTPUT -n -v | head -n 20
echo ""
echo "Regole OUTPUT iptables (numerate):"
sudo iptables -L OUTPUT -n --line-numbers | head -n 20
echo ""

# 3. Verifica se ci sono regole che bloccano SMTP
echo "3️⃣  RICERCA REGOLE CHE BLOCCANO SMTP:"
echo "--------------------------------------"
echo "Regole OUTPUT che potrebbero bloccare SMTP:"
sudo iptables -L OUTPUT -n | grep -E "(587|465|25|REJECT|DROP)" || echo "Nessuna regola esplicita trovata"
echo ""

# 4. Test connessione TCP base (senza TLS)
echo "4️⃣  TEST CONNESSIONE TCP BASE:"
echo "-------------------------------"
echo "Test 1: smtp.aruba.it:587 (timeout 10s)"
timeout 10 bash -c 'echo > /dev/tcp/smtp.aruba.it/587' 2>&1 && echo "✅ Connessione TCP riuscita" || echo "❌ Connessione TCP fallita"
echo ""

echo "Test 2: smtps.aruba.it:465 (timeout 10s)"
timeout 10 bash -c 'echo > /dev/tcp/smtps.aruba.it/465' 2>&1 && echo "✅ Connessione TCP riuscita" || echo "❌ Connessione TCP fallita"
echo ""

# 5. Test con nc (netcat)
echo "5️⃣  TEST CON NETCAT:"
echo "--------------------"
echo "Test smtp.aruba.it:587"
timeout 5 nc -zv smtp.aruba.it 587 2>&1
echo ""

echo "Test smtps.aruba.it:465"
timeout 5 nc -zv smtps.aruba.it 465 2>&1
echo ""

# 6. Test con telnet
echo "6️⃣  TEST CON TELNET:"
echo "--------------------"
echo "Test smtp.aruba.it:587 (timeout 5s)"
timeout 5 telnet smtp.aruba.it 587 2>&1 | head -n 5 || echo "❌ Timeout o errore"
echo ""

# 7. Verifica routing
echo "7️⃣  VERIFICA ROUTING:"
echo "---------------------"
echo "Traceroute verso smtp.aruba.it (primi 5 hop):"
timeout 10 traceroute -m 5 smtp.aruba.it 2>&1 | head -n 10 || echo "❌ Traceroute fallito o non disponibile"
echo ""

# 8. Verifica DNS
echo "8️⃣  VERIFICA DNS:"
echo "-----------------"
echo "Risoluzione DNS smtp.aruba.it:"
dig +short smtp.aruba.it || nslookup smtp.aruba.it 2>&1 | head -n 5
echo ""

# 9. Verifica se il provider VPS blocca SMTP
echo "9️⃣  VERIFICA RESTRIZIONI PROVIDER VPS:"
echo "---------------------------------------"
echo "Provider VPS:"
if [ -f /etc/os-release ]; then
  cat /etc/os-release | grep -E "(PRETTY_NAME|NAME)" | head -n 2
fi
echo ""
echo "IP pubblico VPS:"
curl -s ifconfig.me || curl -s icanhazip.com || echo "Non rilevabile"
echo ""

# 10. Verifica se ci sono proxy o NAT che potrebbero interferire
echo "🔟 VERIFICA CONFIGURAZIONE RETE:"
echo "--------------------------------"
echo "Interfacce di rete:"
ip addr show | grep -E "^[0-9]+:|inet " | head -n 10
echo ""

echo "Tabella routing:"
ip route | head -n 5
echo ""

# 11. Test con curl (se disponibile)
echo "1️⃣1️⃣  TEST CON CURL (se disponibile):"
echo "-------------------------------------"
if command -v curl &> /dev/null; then
  echo "Test connessione HTTPS (per verificare connessioni in uscita):"
  timeout 5 curl -I https://www.google.com 2>&1 | head -n 3 || echo "❌ Curl fallito"
else
  echo "Curl non disponibile"
fi
echo ""

# 12. Verifica se Node.js può fare connessioni in uscita
echo "1️⃣2️⃣  TEST CONNESSIONE NODE.JS:"
echo "--------------------------------"
echo "Test connessione HTTP in uscita con Node.js:"
node -e "const http = require('http'); const req = http.get('http://www.google.com', (res) => { console.log('✅ Node.js può fare connessioni HTTP in uscita'); process.exit(0); }); req.on('error', (e) => { console.log('❌ Node.js non può fare connessioni:', e.message); process.exit(1); }); setTimeout(() => { console.log('❌ Timeout'); process.exit(1); }, 5000);" 2>&1
echo ""

echo "=================================="
echo "✅ DIAGNOSTICA COMPLETATA"
echo ""
echo "📝 PROSSIMI PASSI:"
echo "1. Controlla se iptables ha regole che bloccano SMTP"
echo "2. Se il provider VPS blocca SMTP, contattali"
echo "3. Verifica se serve configurare un relay SMTP"
echo "4. Controlla i log del sistema: journalctl -u ufw | tail -n 50"





