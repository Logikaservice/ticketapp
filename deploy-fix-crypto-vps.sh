#!/bin/bash
# Script per deploy fix crypto sulla VPS 159.69.121.162

echo "🚀 DEPLOY FIX CRYPTO SU VPS"
echo "============================"
echo ""

VPS_HOST="159.69.121.162"
VPS_USER="root"
VPS_PATH="/var/www/ticketapp"

echo "📋 Configurazione:"
echo "   VPS: ${VPS_USER}@${VPS_HOST}"
echo "   Path: ${VPS_PATH}"
echo ""

# Chiedi conferma
read -p "Vuoi procedere con il deploy? (s/n): " confirm
if [ "$confirm" != "s" ] && [ "$confirm" != "S" ]; then
    echo "Deploy annullato."
    exit 1
fi

echo ""
echo "1️⃣ Connessione alla VPS..."
echo ""

# Esegui comandi sulla VPS
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    set -e
    
    echo "✅ Connesso alla VPS"
    echo ""
    
    cd /var/www/ticketapp/backend
    
    echo "2️⃣ Backup index.js..."
    cp index.js index.js.backup.$(date +%Y%m%d_%H%M%S)
    echo "   ✅ Backup creato"
    echo ""
    
    echo "3️⃣ Rimozione riferimenti cryptoRoutes..."
    
    # Rimuovi le righe che contengono cryptoRoutes
    if grep -q "CryptoExport" index.js; then
        echo "   ⚠️  Trovato riferimento a CryptoExport!"
        
        # Rimuovi le righe specifiche
        sed -i '/CryptoExport\/backend\/routes\/cryptoRoutes/d' index.js
        sed -i '/\/\/ Crypto routes - Import from CryptoExport backend/d' index.js
        sed -i '/\/\/ Configure Socket.IO for crypto routes if needed/d' index.js
        sed -i '/if (cryptoRoutes\.setSocketIO && io) {/,/}/d' index.js
        sed -i '/\/\/ Crypto routes - Mount before other/d' index.js
        sed -i '/app\.use.*\/api\/crypto.*cryptoRoutes/d' index.js
        sed -i '/\/\/ ✅ FIX: Se è un errore da \/api\/crypto\/bot-analysis/,/^  }$/d' index.js
        
        echo "   ✅ Riferimenti rimossi"
    else
        echo "   ✅ Nessun riferimento trovato"
    fi
    echo ""
    
    echo "4️⃣ Rimozione cartella CryptoExport..."
    if [ -d "/var/www/ticketapp/CryptoExport" ]; then
        echo "   ⚠️  Cartella CryptoExport trovata!"
        rm -rf /var/www/ticketapp/CryptoExport
        echo "   ✅ Cartella rimossa"
    else
        echo "   ✅ Cartella CryptoExport non esiste"
    fi
    echo ""
    
    echo "5️⃣ Verifica sintassi..."
    if node -c index.js 2>/dev/null; then
        echo "   ✅ Sintassi corretta"
    else
        echo "   ❌ Errore di sintassi!"
        echo "   🔄 Ripristino backup..."
        cp index.js.backup.* index.js 2>/dev/null || true
        exit 1
    fi
    echo ""
    
    echo "6️⃣ Riavvio backend..."
    pm2 restart ticketapp-backend
    sleep 3
    echo ""
    
    echo "7️⃣ Verifica stato..."
    pm2 status
    echo ""
    
    echo "8️⃣ Test endpoint..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
        echo "   ✅ Backend risponde (HTTP $HTTP_CODE)"
    else
        echo "   ⚠️  Backend potrebbe non rispondere correttamente (HTTP $HTTP_CODE)"
        echo "   📋 Controlla i log: pm2 logs ticketapp-backend --lines 30"
    fi
    echo ""
    
    echo "✅ Deploy completato!"
    echo ""
    echo "📋 Prossimi passi:"
    echo "   1. Verifica log: pm2 logs ticketapp-backend --lines 30"
    echo "   2. Testa il sito: https://ticket.logikaservice.it"
    echo "   3. Se ci sono errori, ripristina: cp index.js.backup.* index.js"
ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deploy completato con successo!"
else
    echo ""
    echo "❌ Errore durante il deploy!"
    exit 1
fi
