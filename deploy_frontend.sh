#!/bin/bash

# Script per ricostruire e deployare il frontend sulla VPS
# Esegui questo script dalla directory principale del progetto

echo "🚀 DEPLOY FRONTEND SU VPS HETZNER"
echo "=========================================="
echo ""

# 1. Ricostruisci il frontend
echo "📦 1. Ricostruzione frontend..."
echo "----------------------------------------"
cd frontend
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Errore durante il build!"
    exit 1
fi
echo "✅ Build completato!"
echo ""

# 2. Comprimi il build
echo "📦 2. Compressione build..."
echo "----------------------------------------"
cd build
tar -czf frontend-build.tar.gz *
mv frontend-build.tar.gz ../../
cd ../..
echo "✅ Build compresso in frontend-build.tar.gz"
echo ""

# 3. Carica sulla VPS
echo "📤 3. Upload sulla VPS..."
echo "----------------------------------------"
echo "Esegui questo comando per caricare:"
echo ""
echo "scp frontend-build.tar.gz root@159.69.121.162:/root/TicketApp/"
echo ""
echo "Poi sulla VPS esegui:"
echo "ssh root@159.69.121.162"
echo "cd /root/TicketApp"
echo "tar -xzf frontend-build.tar.gz -C frontend/build/"
echo "sudo systemctl restart nginx"
echo ""
echo "✅ Frontend aggiornato!"
