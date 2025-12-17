#!/bin/bash
# Script di test automatico per Binance Testnet sulla VPS
# Esegui dalla VPS: bash /var/www/ticketapp/backend/scripts/test-binance-vps.sh

echo "🧪 TEST BINANCE TESTNET SULLA VPS"
echo "=================================="
echo ""

# Colori per output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="https://ticket.logikaservice.it/api/crypto/binance"
LOCAL_URL="http://localhost:3001/api/crypto/binance"

# Funzione per testare endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local use_local=$3
    
    test_url=$url
    if [ "$use_local" = "true" ]; then
        test_url=$LOCAL_URL$url
    else
        test_url=$BASE_URL$url
    fi
    
    echo -e "${YELLOW}Testing: $name${NC}"
    echo "URL: $test_url"
    
    response=$(curl -s -w "\n%{http_code}" "$test_url")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ SUCCESS (HTTP $http_code)${NC}"
        echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
    else
        echo -e "${RED}❌ FAILED (HTTP $http_code)${NC}"
        echo "$body"
    fi
    echo ""
}

# Test 1: Verifica Modalità
echo "════════════════════════════════════════"
echo "1️⃣  TEST MODALITÀ BINANCE"
echo "════════════════════════════════════════"
test_endpoint "Modalità (Locale)" "/mode" "true"
test_endpoint "Modalità (Pubblica)" "/mode" "false"
echo ""

# Test 2: Verifica Prezzo
echo "════════════════════════════════════════"
echo "2️⃣  TEST PREZZO SOLEUR"
echo "════════════════════════════════════════"
test_endpoint "Prezzo SOLEUR (Locale)" "/price/SOLEUR" "true"
test_endpoint "Prezzo SOLEUR (Pubblica)" "/price/SOLEUR" "false"
echo ""

# Test 3: Verifica Saldo
echo "════════════════════════════════════════"
echo "3️⃣  TEST SALDO ACCOUNT"
echo "════════════════════════════════════════"
test_endpoint "Saldo (Locale)" "/balance" "true"
test_endpoint "Saldo (Pubblica)" "/balance" "false"
echo ""

# Test 4: Verifica configurazione .env
echo "════════════════════════════════════════"
echo "4️⃣  VERIFICA CONFIGURAZIONE .env"
echo "════════════════════════════════════════"
if [ -f "/var/www/ticketapp/backend/.env" ]; then
    echo -e "${GREEN}✅ File .env trovato${NC}"
    
    if grep -q "BINANCE_MODE=testnet" /var/www/ticketapp/backend/.env; then
        echo -e "${GREEN}✅ BINANCE_MODE=testnet configurato${NC}"
    else
        echo -e "${RED}❌ BINANCE_MODE non trovato o non configurato come testnet${NC}"
    fi
    
    if grep -q "BINANCE_API_KEY=" /var/www/ticketapp/backend/.env; then
        api_key=$(grep "BINANCE_API_KEY=" /var/www/ticketapp/backend/.env | cut -d'=' -f2)
        if [ -n "$api_key" ]; then
            echo -e "${GREEN}✅ BINANCE_API_KEY configurato${NC}"
            echo "   Key: ${api_key:0:15}..."
        else
            echo -e "${RED}❌ BINANCE_API_KEY vuoto${NC}"
        fi
    else
        echo -e "${RED}❌ BINANCE_API_KEY non trovato${NC}"
    fi
    
    if grep -q "BINANCE_API_SECRET=" /var/www/ticketapp/backend/.env; then
        api_secret=$(grep "BINANCE_API_SECRET=" /var/www/ticketapp/backend/.env | cut -d'=' -f2)
        if [ -n "$api_secret" ]; then
            echo -e "${GREEN}✅ BINANCE_API_SECRET configurato${NC}"
            echo "   Secret: ${api_secret:0:15}..."
        else
            echo -e "${RED}❌ BINANCE_API_SECRET vuoto${NC}"
        fi
    else
        echo -e "${RED}❌ BINANCE_API_SECRET non trovato${NC}"
    fi
else
    echo -e "${RED}❌ File .env non trovato in /var/www/ticketapp/backend/.env${NC}"
fi
echo ""

# Test 5: Verifica backend attivo
echo "════════════════════════════════════════"
echo "5️⃣  VERIFICA BACKEND"
echo "════════════════════════════════════════"
if pgrep -f "node.*index.js" > /dev/null || pgrep -f "pm2" > /dev/null; then
    echo -e "${GREEN}✅ Backend in esecuzione${NC}"
    pm2 status | grep ticketapp-backend || echo "   (Usa 'pm2 status' per dettagli)"
else
    echo -e "${RED}❌ Backend NON in esecuzione${NC}"
fi
echo ""

# Test 6: Verifica connessione Binance Testnet
echo "════════════════════════════════════════"
echo "6️⃣  VERIFICA CONNESSIONE BINANCE TESTNET"
echo "════════════════════════════════════════"
if ping -c 1 testnet.binance.vision &> /dev/null; then
    echo -e "${GREEN}✅ Binance Testnet raggiungibile${NC}"
else
    echo -e "${YELLOW}⚠️  Ping non disponibile, test connessione HTTP...${NC}"
    http_code=$(curl -s -o /dev/null -w "%{http_code}" https://testnet.binance.vision/api/v3/ping 2>/dev/null || echo "000")
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ Binance Testnet risponde (HTTP $http_code)${NC}"
    else
        echo -e "${RED}❌ Binance Testnet non raggiungibile (HTTP $http_code)${NC}"
    fi
fi
echo ""

echo "════════════════════════════════════════"
echo "✅ TEST COMPLETATI"
echo "════════════════════════════════════════"
echo ""
echo "Se alcuni test falliscono:"
echo "1. Verifica che il backend sia riavviato dopo aver modificato .env"
echo "2. Controlla i log: pm2 logs ticketapp-backend"
echo "3. Verifica la configurazione .env: cat /var/www/ticketapp/backend/.env | grep BINANCE"
echo ""

