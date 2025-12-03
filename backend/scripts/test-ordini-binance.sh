#!/bin/bash
# Script Bash per testare ordini Binance Testnet sul VPS
# Esegui: bash backend/scripts/test-ordini-binance.sh

BASE_URL="https://ticket.logikaservice.it/api/crypto/binance"

echo "════════════════════════════════════════"
echo "  TEST ORDINI BINANCE TESTNET"
echo "════════════════════════════════════════"
echo ""

# Test 1: Verifica Modalità
echo "1️⃣  VERIFICA MODALITÀ"
echo "────────────────────────────────────────"
echo "🧪 Modalità Binance"
echo "   URL: $BASE_URL/mode"
response=$(curl -s "$BASE_URL/mode")
if [ $? -eq 0 ]; then
    echo "   ✅ SUCCESS"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
else
    echo "   ❌ ERROR"
fi
echo ""

# Test 2: Verifica Prezzo SOLEUR
echo "2️⃣  VERIFICA PREZZO SOLEUR"
echo "────────────────────────────────────────"
echo "🧪 Prezzo SOLEUR"
echo "   URL: $BASE_URL/price/SOLEUR"
response=$(curl -s "$BASE_URL/price/SOLEUR")
if [ $? -eq 0 ]; then
    echo "   ✅ SUCCESS"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    price=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('price', 'N/A'))" 2>/dev/null)
else
    echo "   ❌ ERROR"
    price="N/A"
fi
echo ""

# Test 3: Verifica Saldo
echo "3️⃣  VERIFICA SALDO"
echo "────────────────────────────────────────"
echo "🧪 Saldo Account"
echo "   URL: $BASE_URL/balance"
response=$(curl -s "$BASE_URL/balance")
if [ $? -eq 0 ]; then
    echo "   ✅ SUCCESS"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
else
    echo "   ❌ ERROR"
fi
echo ""

# Test 4: Verifica Simboli Disponibili
echo "4️⃣  VERIFICA SIMBOLI DISPONIBILI"
echo "────────────────────────────────────────"
echo "🧪 Simboli Disponibili"
echo "   URL: $BASE_URL/symbols"
response=$(curl -s "$BASE_URL/symbols")
if [ $? -eq 0 ]; then
    echo "   ✅ SUCCESS"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
else
    echo "   ❌ ERROR"
fi
echo ""

# Test 5: Test Ordine
echo "════════════════════════════════════════"
echo "  TEST ORDINE A MERCATO"
echo "════════════════════════════════════════"
echo ""
echo "Vuoi fare un ordine di test?"
echo "Questo ordine userà denaro VIRTUALE (Testnet)"
echo ""
echo "Prezzo attuale SOLEUR: €${price:-N/A}"
echo ""

read -p "Vuoi procedere con un ordine BUY di 0.1 SOLUSDT? (s/n): " conferma

if [ "$conferma" = "s" ] || [ "$conferma" = "S" ] || [ "$conferma" = "si" ] || [ "$conferma" = "SI" ]; then
    echo ""
    echo "5️⃣  ORDINE A MERCATO (BUY 0.1 SOLUSDT)"
    echo "────────────────────────────────────────"
    echo "🧪 Market Order BUY"
    echo "   URL: $BASE_URL/order/market"
    
    # Crea il JSON body
    body='{"symbol":"SOLUSDT","side":"BUY","quantity":"0.1"}'
    
    response=$(curl -s -X POST "$BASE_URL/order/market" \
        -H "Content-Type: application/json" \
        -d "$body")
    
    if [ $? -eq 0 ]; then
        echo "   ✅ SUCCESS"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        echo "   ❌ ERROR"
        echo "$response"
    fi
else
    echo ""
    echo "⏭️  Test ordine saltato"
fi

echo ""
echo "════════════════════════════════════════"
echo "  TEST COMPLETATI"
echo "════════════════════════════════════════"
echo ""

