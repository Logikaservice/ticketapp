#!/bin/bash
# Script per testare la ricerca MAC in KeePass sulla VPS
# IMPORTANTE: Sostituisci <PASSWORD> con la tua password KeePass effettiva
# Uso: bash test-keepass-direct-vps.sh

PASSWORD="${KEEPASS_PASSWORD}"
MAC_ADDRESS="${1:-90:09:D0:39:DC:35}"

if [ -z "$PASSWORD" ]; then
    echo "❌ KEEPASS_PASSWORD non trovata nelle variabili d'ambiente!"
    echo ""
    echo "Opzioni:"
    echo "  1. Imposta variabile d'ambiente: export KEEPASS_PASSWORD='tua-password'"
    echo "  2. O passa la password come secondo parametro (non sicuro):"
    echo "     bash test-keepass-direct-vps.sh 'tua-password'"
    echo ""
    if [ -n "$1" ]; then
        echo "🔓 Usando password dal parametro..."
        PASSWORD="$1"
        MAC_ADDRESS="${2:-90:09:D0:39:DC:35}"
    else
        echo "❌ Password non fornita!"
        exit 1
    fi
fi

echo "🔍 Test ricerca MAC in KeePass sulla VPS"
echo "=========================================="
echo ""
echo "MAC da cercare: $MAC_ADDRESS"
echo ""

cd /var/www/ticketapp

# Test se node_modules esiste
if [ ! -d "backend/node_modules" ]; then
    echo "⚠️  node_modules non trovato, installo dipendenze..."
    cd backend
    npm install
    cd ..
fi

# Esegui test
cd backend
node ../../test-keepass-mac-search.js "$PASSWORD" "$MAC_ADDRESS"
