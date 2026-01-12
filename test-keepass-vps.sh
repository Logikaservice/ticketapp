#!/bin/bash
# Script per testare la ricerca MAC in KeePass sulla VPS
# Esegui sulla VPS: bash test-keepass-vps.sh <password> <mac_address>

PASSWORD=$1
MAC_ADDRESS=${2:-"90:09:D0:39:DC:35"}

if [ -z "$PASSWORD" ]; then
    echo "❌ Password KeePass richiesta!"
    echo "Uso: bash test-keepass-vps.sh <password> [mac_address]"
    echo "Esempio: bash test-keepass-vps.sh miapassword 90:09:D0:39:DC:35"
    exit 1
fi

echo "🔍 Test ricerca MAC in KeePass sulla VPS"
echo "=========================================="
echo ""
echo "MAC da cercare: $MAC_ADDRESS"
echo ""

cd /var/www/ticketapp/backend

# Test se node_modules esiste
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules non trovato, installo dipendenze..."
    npm install
fi

# Esegui test
node ../../test-keepass-mac-search.js "$PASSWORD" "$MAC_ADDRESS"
