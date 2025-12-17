#!/bin/bash
# Script per riavviare il backend - trova automaticamente il nome del processo PM2

echo "🔍 Cercando processi PM2..."

# Mostra tutti i processi PM2
pm2 list

echo ""
echo "🔄 Tentativo di riavvio..."

# Prova diversi nomi comuni per il backend
if pm2 restart ticketapp-backend 2>/dev/null; then
    echo "✅ Backend riavviato (ticketapp-backend)"
elif pm2 restart backend 2>/dev/null; then
    echo "✅ Backend riavviato (backend)"
elif pm2 restart all 2>/dev/null; then
    echo "✅ Tutti i processi PM2 riavviati"
else
    echo "❌ Nessun processo trovato. Esegui manualmente:"
    echo "   pm2 list"
    echo "   pm2 restart <nome-processo>"
fi

echo ""
echo "📋 Log del backend (ultimi 50):"
pm2 logs --lines 50 --nostream


