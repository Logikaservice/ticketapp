#!/bin/bash
# Deploy rapido - solo aggiornamento codice e restart

cd /var/www/ticketapp

echo "📥 Aggiornamento codice da GitHub..."
git pull origin main

echo "🔄 Riavvio backend..."
pm2 restart ticketapp-backend

echo "✅ Deploy completato!"
echo ""
echo "📊 Verifica status:"
pm2 status

echo ""
echo "📝 Ultimi log (ultime 30 righe):"
pm2 logs ticketapp-backend --lines 30 --nostream
