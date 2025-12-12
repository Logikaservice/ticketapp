#!/bin/bash

# Script per riavviare backend VPS dopo crash
echo "🔄 Riavvio backend VPS"
echo "======================"

# 1. Stop backend
echo "⏸️ Stop backend..."
pm2 stop backend

# 2. Verifica errori sintassi
echo "🔍 Verifica sintassi..."
cd /root/TicketApp/backend
node --check index.js

if [ $? -ne 0 ]; then
    echo "❌ ERRORE SINTASSI! Fix necessario prima di riavviare"
    exit 1
fi

# 3. Restart backend
echo "🚀 Restart backend..."
pm2 restart backend

# 4. Mostra log
echo "📋 Log backend:"
pm2 logs backend --lines 20 --nostream

echo "✅ Riavvio completato"
