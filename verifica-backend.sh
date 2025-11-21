#!/bin/bash
# Script per verificare lo stato del backend e nginx

echo "🔍 Verifica stato backend e nginx..."
echo ""

echo "1️⃣ Verifica PM2:"
pm2 status
echo ""

echo "2️⃣ Verifica backend in ascolto sulla porta 3001:"
netstat -tlnp | grep 3001 || echo "❌ Backend NON in ascolto sulla porta 3001"
echo ""

echo "3️⃣ Test connessione backend locale:"
curl -s http://localhost:3001/api/tickets -H "Authorization: Bearer test" || echo "❌ Backend non risponde"
echo ""

echo "4️⃣ Verifica configurazione nginx:"
if [ -f /etc/nginx/sites-available/ticketapp.conf ]; then
  echo "✅ File nginx trovato: /etc/nginx/sites-available/ticketapp.conf"
  echo "Contenuto:"
  cat /etc/nginx/sites-available/ticketapp.conf
else
  echo "❌ File nginx NON trovato!"
  echo "Cerca file nginx:"
  ls -la /etc/nginx/sites-available/ | grep ticket
fi
echo ""

echo "5️⃣ Verifica nginx abilitato:"
if [ -L /etc/nginx/sites-enabled/ticketapp.conf ]; then
  echo "✅ Nginx config abilitato"
else
  echo "❌ Nginx config NON abilitato!"
fi
echo ""

echo "6️⃣ Verifica stato nginx:"
systemctl status nginx --no-pager | head -n 10
echo ""

echo "7️⃣ Ultimi log backend (PM2):"
pm2 logs ticketapp-backend --lines 20 --nostream
echo ""

echo "8️⃣ Test richiesta API tramite nginx:"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost/api/tickets -H "Authorization: Bearer test" || echo "❌ Nginx non risponde"
echo ""









