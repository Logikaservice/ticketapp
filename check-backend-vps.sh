#!/bin/bash

# Script per verificare stato backend VPS e vedere errori
echo "🔍 Verifica stato backend VPS"
echo "=============================="

# 1. Verifica se backend è attivo
echo -e "\n📊 Processi backend attivi:"
pm2 list

# 2. Ultimi 50 log del backend
echo -e "\n📋 Ultimi 50 log backend:"
pm2 logs backend --lines 50 --nostream

# 3. Verifica errori recenti
echo -e "\n❌ Errori recenti:"
pm2 logs backend --err --lines 30 --nostream

# 4. Verifica stato memoria
echo -e "\n💾 Memoria:"
free -h

echo -e "\n✅ Verifica completata"
