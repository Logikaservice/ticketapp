#!/bin/bash
# Script per applicare il fix crash backend direttamente sul server VPS
# Esegui questo script se il deploy automatico non funziona

set -e

echo "🔧 Applicazione Fix Crash Backend..."
echo ""

cd /var/www/ticketapp/backend || {
    echo "❌ Directory /var/www/ticketapp/backend non trovata"
    exit 1
}

# Backup del file originale
echo "1. Backup file originale..."
cp index.js index.js.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup creato"

# Verifica se il fix è già presente
if grep -q "if (vivaldiRoutes)" index.js; then
    echo "✅ Fix già presente nel codice!"
    echo "   Procedo con il riavvio del backend..."
else
    echo "⚠️  Fix non trovato nel codice"
    echo "   Eseguo git pull per aggiornare..."
    cd /var/www/ticketapp
    git pull origin main || {
        echo "⚠️  Errore git pull, continuo comunque..."
    }
    cd backend
fi

# Riavvia backend
echo ""
echo "2. Riavvio backend..."
pm2 restart ticketapp-backend || {
    echo "⚠️  PM2 restart fallito, provo a riavviare manualmente..."
    pm2 delete ticketapp-backend 2>/dev/null || true
    cd /var/www/ticketapp/backend
    pm2 start index.js --name ticketapp-backend || {
        echo "❌ Impossibile avviare backend con PM2"
        exit 1
    }
    pm2 save
}

# Attendi 5 secondi per l'avvio
sleep 5

# Verifica stato
echo ""
echo "3. Verifica stato backend..."
pm2 status

# Verifica log per errori
echo ""
echo "4. Ultimi log backend (cerca errori)..."
pm2 logs ticketapp-backend --lines 30 --nostream | tail -20

# Test endpoint crypto
echo ""
echo "5. Test endpoint crypto..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/crypto/dashboard || echo "000")
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "401" ] || [ "$RESPONSE" = "403" ]; then
    echo "✅ Endpoint crypto risponde (HTTP $RESPONSE)"
else
    echo "⚠️  Endpoint crypto risponde con HTTP $RESPONSE"
    echo "   Controlla i log per dettagli: pm2 logs ticketapp-backend --lines 50"
fi

echo ""
echo "✅ Fix applicato!"
echo ""
echo "📋 Prossimi passi:"
echo "   1. Ricarica la pagina del dashboard crypto nel browser"
echo "   2. Svuota la cache del browser (Ctrl+Shift+R)"
echo "   3. Se vedi ancora errori 502, controlla i log:"
echo "      pm2 logs ticketapp-backend --lines 50"
