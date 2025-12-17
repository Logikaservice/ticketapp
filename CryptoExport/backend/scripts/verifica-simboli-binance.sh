#!/bin/bash
# Script per verificare quali simboli sono disponibili su Binance Testnet

echo "🔍 Verifica simboli disponibili su Binance Testnet..."
echo ""

# Test connessione
echo "1️⃣ Test connessione Binance Testnet:"
curl -s "https://testnet.binance.vision/api/v3/ping"
echo ""
echo ""

# Lista simboli disponibili
echo "2️⃣ Simboli disponibili su Binance Testnet:"
curl -s "https://testnet.binance.vision/api/v3/exchangeInfo" | python3 -c "
import sys, json
data = json.load(sys.stdin)
symbols = [s['symbol'] for s in data['symbols'] if s['status'] == 'TRADING']
sol_symbols = [s for s in symbols if 'SOL' in s]
eur_symbols = [s for s in symbols if 'EUR' in s]

print(f'Total symbols: {len(symbols)}')
print(f'\nSymbols with SOL: {len(sol_symbols)}')
for s in sorted(sol_symbols):
    print(f'  - {s}')

print(f'\nSymbols with EUR: {len(eur_symbols)}')
for s in sorted(eur_symbols):
    print(f'  - {s}')
" 2>/dev/null || echo "Python non disponibile, usa: curl -s 'https://testnet.binance.vision/api/v3/exchangeInfo' | grep SOL"

echo ""
echo ""

# Test prezzo SOLEUR
echo "3️⃣ Test prezzo SOLEUR:"
curl -s "https://testnet.binance.vision/api/v3/ticker/price?symbol=SOLEUR"
echo ""
echo ""

echo "✅ Verifica completata"

