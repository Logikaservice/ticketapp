#!/bin/bash
# Script per testare la ricerca MAC in KeePass sulla VPS
# Legge automaticamente la password dal file .env o dalla variabile d'ambiente
# Uso: bash test-keepass-vps.sh [mac_address]

MAC_ADDRESS=${1:-"90:09:D0:39:DC:35"}

# Prova a leggere la password dal .env
if [ -f "backend/.env" ]; then
    PASSWORD=$(grep "^KEEPASS_PASSWORD=" backend/.env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [ -n "$PASSWORD" ]; then
        echo "✅ Password letta dal file .env"
    fi
fi

# Se non trovata nel .env, prova dalla variabile d'ambiente
if [ -z "$PASSWORD" ] && [ -n "$KEEPASS_PASSWORD" ]; then
    PASSWORD="$KEEPASS_PASSWORD"
    echo "✅ Password letta dalla variabile d'ambiente KEEPASS_PASSWORD"
fi

# Se ancora non trovata, chiedi come parametro
if [ -z "$PASSWORD" ]; then
    echo "❌ Password KeePass non trovata!"
    echo ""
    echo "Opzioni:"
    echo "  1. Assicurati che KEEPASS_PASSWORD sia nel file backend/.env"
    echo "  2. O esporta la variabile: export KEEPASS_PASSWORD='tua-password'"
    echo "  3. O passa come parametro (non sicuro):"
    echo "     bash test-keepass-vps.sh 'tua-password' [mac_address]"
    echo ""
    if [ -n "$1" ] && [[ ! "$1" =~ ^[0-9A-Fa-f:]{17}$ ]]; then
        # Se il primo parametro non sembra un MAC, assume sia la password
        PASSWORD="$1"
        MAC_ADDRESS=${2:-"90:09:D0:39:DC:35"}
        echo "🔓 Usando password dal parametro..."
    else
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

# Esegui test dalla cartella backend (così usa le node_modules corrette)
cd backend
node ../test-keepass-mac-search.js "$PASSWORD" "$MAC_ADDRESS"
