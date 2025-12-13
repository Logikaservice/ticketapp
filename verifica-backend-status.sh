#!/bin/bash

# Script per verificare stato backend

echo "🔍 Verifica Stato Backend"
echo "========================"
echo ""

# 1. Status PM2
echo "📊 1. Status PM2:"
echo "----------------"
pm2 status ticketapp-backend

echo ""
echo "📋 2. Ultimi log (errori):"
echo "--------------------------"
pm2 logs ticketapp-backend --lines 20 --nostream --err | tail -20

echo ""
echo "🔍 3. Verifica errori 'global' symbol:"
echo "--------------------------------------"
pm2 logs ticketapp-backend --lines 50 --nostream | grep -i "global" | tail -10 || echo "   ✅ Nessun errore 'global' trovato"

echo ""
echo "🌐 4. Test endpoint health:"
echo "---------------------------"
curl -s http://localhost:3001/api/health && echo "" || echo "   ❌ Backend non risponde"

echo ""
echo "✅ Verifica completata!"

