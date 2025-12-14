#!/bin/bash

# 🚀 Script per deployare il fix di trade_size_usdt sulla VPS
# Questo script fa il pull delle modifiche e riavvia il backend

echo "🚀 Deploy Fix trade_size_usdt sulla VPS"
echo "========================================"
echo ""

# 1. Vai nella directory del progetto
echo "📂 1. Navigazione nella directory del progetto..."
cd /root/TicketApp || { echo "❌ Errore: directory non trovata"; exit 1; }
echo "✅ Directory: $(pwd)"
echo ""

# 2. Verifica branch corrente
echo "🔍 2. Verifica branch corrente..."
git branch --show-current
echo ""

# 3. Pull delle modifiche da GitHub
echo "📥 3. Pull delle modifiche da GitHub..."
git pull origin main
echo ""

# 4. Verifica che il file sia stato aggiornato
echo "🔍 4. Verifica ultima modifica del file..."
ls -lh backend/routes/cryptoRoutes.js | awk '{print "   Dimensione:", $5, "- Ultima modifica:", $6, $7, $8}'
echo ""

# 5. Riavvia il backend con PM2
echo "🔄 5. Riavvio del backend..."
pm2 restart crypto-backend
echo ""

# 6. Verifica status PM2
echo "📊 6. Status PM2..."
pm2 list | grep crypto-backend
echo ""

# 7. Mostra ultimi log per verificare il riavvio
echo "📋 7. Ultimi log del backend (ultimi 20 righe)..."
pm2 logs crypto-backend --lines 20 --nostream
echo ""

echo "✅ Deploy completato!"
echo ""
echo "🔍 Per verificare che il fix funzioni:"
echo "   1. Apri le impostazioni del bot nel browser"
echo "   2. Guarda la console del browser (F12)"
echo "   3. Cerca il log: '📥 [BOT-PARAMS-GET] Parametri finali restituiti al frontend'"
echo "   4. Verifica che trade_size_usdt sia presente e abbia il valore corretto (70)"
echo ""
