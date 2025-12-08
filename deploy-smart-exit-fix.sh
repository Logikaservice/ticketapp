#!/bin/bash
# Script per deploy manuale del fix Smart Exit

echo "🚀 Deploy Fix Smart Exit..."
echo ""

cd /var/www/ticketapp || {
    echo "❌ Directory /var/www/ticketapp non trovata"
    exit 1
}

# 1. Pull delle modifiche
echo "1. Aggiornamento codice da GitHub..."
git pull origin main || {
    echo "⚠️  Errore git pull, provo reset..."
    git fetch origin
    git reset --hard origin/main
}
echo ""

# 2. Verifica che il fix sia presente
echo "2. Verifica fix Smart Exit..."
if grep -q "MIN_ABSOLUTE_PROFIT_TO_CLOSE" backend/services/SmartExit.js; then
    echo "✅ Fix Smart Exit presente"
else
    echo "❌ Fix NON trovato!"
    exit 1
fi

if grep -q "require.*SmartExit" backend/routes/cryptoRoutes.js; then
    echo "✅ SmartExit importato in cryptoRoutes"
else
    echo "❌ SmartExit NON importato!"
    exit 1
fi
echo ""

# 3. Riavvia backend
echo "3. Riavvio backend..."
pm2 restart ticketapp-backend
sleep 5
echo ""

# 4. Verifica stato
echo "4. Verifica stato backend..."
pm2 status
echo ""

# 5. Verifica log Smart Exit
echo "5. Verifica log Smart Exit (ultimi 20)..."
pm2 logs ticketapp-backend --lines 50 --nostream | grep -i "smart exit" | tail -20 || echo "Nessun log Smart Exit trovato (potrebbe essere normale se non ci sono posizioni aperte)"
echo ""

# 6. Test endpoint
echo "6. Test endpoint..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000")
echo "   Health check: HTTP $HEALTH"
echo ""

if [ "$HEALTH" = "200" ]; then
    echo "✅ Deploy completato con successo!"
    echo ""
    echo "📋 Verifica Smart Exit:"
    echo "   pm2 logs ticketapp-backend | grep 'SMART EXIT'"
    echo ""
    echo "   Dovresti vedere:"
    echo "   - 🎯 [SMART EXIT] Started"
    echo "   - 📊 [SMART EXIT] ... MANTENERE (se posizioni < soglie)"
else
    echo "⚠️  Backend potrebbe avere problemi"
    echo "   Controlla: pm2 logs ticketapp-backend --lines 50"
fi
