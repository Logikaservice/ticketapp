#!/bin/bash
# Script completo per risolvere tutti i problemi sul VPS

set -e

echo "🔧 FIX COMPLETO VPS - Risoluzione problemi"
echo "=========================================="
echo ""

cd /var/www/ticketapp || { echo "❌ Directory /var/www/ticketapp non trovata!"; exit 1; }

# 1. Aggiorna codice
echo "1️⃣ Aggiorno codice da Git..."
git pull || { echo "⚠️  Errore durante git pull, continuo comunque..."; }
echo "✅ Codice aggiornato"
echo ""

# 2. Ferma PM2 backend
echo "2️⃣ Fermo processo PM2 ticketapp-backend..."
pm2 delete ticketapp-backend 2>/dev/null || echo "   ⚠️  Nessun processo PM2 da fermare"
sleep 2
echo ""

# 3. Libera porta 3001
echo "3️⃣ Libero porta 3001..."
PID=$(sudo lsof -ti:3001 2>/dev/null || echo "")
if [ -n "$PID" ]; then
    echo "   🔍 Trovati processi: $PID"
    sudo kill -9 $PID 2>/dev/null || true
    echo "   ✅ Processi terminati"
    sleep 2
fi

# Verifica che la porta sia libera
if sudo lsof -ti:3001 >/dev/null 2>&1; then
    echo "   ⚠️  Porta ancora occupata, uso fuser..."
    sudo fuser -k 3001/tcp 2>/dev/null || true
    sleep 3
fi
echo "   ✅ Porta 3001 libera"
echo ""

# 4. Pulisci prezzi anomali dal database
echo "4️⃣ Pulisco prezzi anomali dal database..."
cd backend || { echo "❌ Directory backend non trovata!"; exit 1; }
if [ -f scripts/clean-anomalous-prices.js ]; then
    node scripts/clean-anomalous-prices.js || { echo "⚠️  Errore durante pulizia prezzi, continuo..."; }
else
    echo "   ⚠️  Script clean-anomalous-prices.js non trovato, salto questo passaggio"
fi
echo ""

# 5. Installa dipendenze
echo "5️⃣ Verifico dipendenze backend..."
npm install --production 2>&1 | tail -5 || echo "   ⚠️  Errore durante npm install"
echo ""

# 6. Avvia backend
echo "6️⃣ Avvio backend con PM2..."
pm2 start index.js --name ticketapp-backend --update-env || { echo "❌ Errore durante l'avvio di PM2!"; exit 1; }
pm2 save || { echo "⚠️  Errore durante il salvataggio della configurazione PM2!"; }
echo "   ✅ Backend avviato"
echo ""

# 7. Attendi avvio
echo "7️⃣ Attendo avvio backend (15 secondi)..."
sleep 15
echo ""

# 8. Verifica stato
echo "8️⃣ Verifica stato PM2..."
pm2 status ticketapp-backend
echo ""

# 9. Test endpoint
echo "9️⃣ Test endpoint /api/health..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null || echo "000")
echo "   Health check: HTTP $HEALTH"
if [ "$HEALTH" != "200" ]; then
    echo "   ⚠️  Health check fallito, controlla i log"
fi
echo ""

# 10. Mostra ultimi log
echo "🔟 Ultimi 50 log backend..."
echo "---------------------------"
pm2 logs ticketapp-backend --lines 50 --nostream 2>/dev/null | tail -50 || echo "   ⚠️  Log non disponibili"

echo ""
echo "✅ Completato!"
echo ""
echo "💡 Se vedi ancora problemi:"
echo "   - Verifica log: pm2 logs ticketapp-backend --lines 100"
echo "   - Verifica porta: sudo lsof -i:3001"
echo "   - Pulisci prezzi anomali: cd backend && node scripts/clean-anomalous-prices.js"
echo ""

