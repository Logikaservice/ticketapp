#!/bin/bash
# Script per rimuovere riferimenti crypto dalla VPS

echo "🔧 Fix Riferimenti Crypto sulla VPS"
echo "===================================="
echo ""

# 1. Vai nella directory backend
cd /var/www/ticketapp/backend

# 2. Verifica se esiste ancora il riferimento a cryptoRoutes
echo "1️⃣ Verifica riferimenti cryptoRoutes in index.js..."
if grep -q "CryptoExport" index.js; then
    echo "   ⚠️  Trovato riferimento a CryptoExport!"
    echo "   📝 Rimuovendo riferimenti..."
    
    # Rimuovi le righe che contengono cryptoRoutes
    sed -i '/CryptoExport\/backend\/routes\/cryptoRoutes/d' index.js
    sed -i '/cryptoRoutes/d' index.js
    sed -i '/\/api\/crypto/d' index.js
    
    echo "   ✅ Riferimenti rimossi"
else
    echo "   ✅ Nessun riferimento trovato"
fi

# 3. Rimuovi cartella CryptoExport se esiste
echo ""
echo "2️⃣ Verifica cartella CryptoExport..."
if [ -d "/var/www/ticketapp/CryptoExport" ]; then
    echo "   ⚠️  Cartella CryptoExport trovata!"
    echo "   🗑️  Rimuovendo cartella..."
    rm -rf /var/www/ticketapp/CryptoExport
    echo "   ✅ Cartella rimossa"
else
    echo "   ✅ Cartella CryptoExport non esiste"
fi

# 4. Verifica sintassi
echo ""
echo "3️⃣ Verifica sintassi index.js..."
if node -c index.js 2>/dev/null; then
    echo "   ✅ Sintassi corretta"
else
    echo "   ❌ Errore di sintassi! Controlla manualmente"
    exit 1
fi

# 5. Riavvia backend
echo ""
echo "4️⃣ Riavvio backend..."
pm2 restart ticketapp-backend

# 6. Attendi 3 secondi
sleep 3

# 7. Verifica stato
echo ""
echo "5️⃣ Verifica stato backend..."
pm2 status

# 8. Test endpoint
echo ""
echo "6️⃣ Test endpoint health..."
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3001/api/health

echo ""
echo "✅ Fix completato!"
echo ""
echo "📋 Prossimi passi:"
echo "   1. Verifica che pm2 status mostri 'online'"
echo "   2. Controlla i log: pm2 logs ticketapp-backend --lines 20"
echo "   3. Testa il sito: https://ticket.logikaservice.it"
