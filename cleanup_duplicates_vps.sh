#!/bin/bash

# 🧹 Script per pulire i duplicati dal database PostgreSQL VPS
# Esegui questo script SULLA VPS

echo "🧹 PULIZIA DUPLICATI - Database PostgreSQL VPS"
echo "=============================================="
echo ""

# Vai nella directory del backend
cd /root/TicketApp/backend || { echo "❌ Directory backend non trovata"; exit 1; }

echo "📡 Esecuzione script pulizia duplicati..."
echo ""

# Esegui lo script Node.js
node cleanup_duplicates.js

echo ""
echo "✅ Pulizia completata!"
echo ""
echo "📝 PROSSIMI STEP:"
echo "   1. Verifica i risultati sopra"
echo "   2. Aggiorna il codice in cryptoRoutes.js (rimuovi duplicati)"
echo "   3. Riavvia il backend: pm2 restart crypto-bot"
echo ""
