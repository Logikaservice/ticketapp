#!/bin/bash

# Script per scaricare klines mancanti sulla VPS
# Esegui sulla VPS con: bash download_missing_klines.sh

cd /var/www/ticketapp/backend

echo "🔍 Download klines mancanti per simboli problematici"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Simboli con price=0, no RSI, strength=0
SYMBOLS=(
    "bitcoin:BTCUSDT"
    "ethereum:ETHUSDT"
    "polkadot:DOTUSDT"
    "polygon:MATICUSDT"
    "chainlink:LINKUSDT"
    "litecoin:LTCUSDT"
    "stellar:XLMUSDT"
    "monero:XMRUSDT"
    "tron:TRXUSDT"
    "cosmos:ATOMUSDT"
    "near:NEARUSDT"
    "uniswap:UNIUSDT"
    "optimism:OPUSDT"
    "the_sandbox:SANDUSDT"
    "decentraland:MANAUSDT"
    "axie_infinity:AXSUSDT"
    "gala:GALAUSDT"
    "avalanche:AVAXUSDT"
    "binance_coin:BNBUSDT"
)

for entry in "${SYMBOLS[@]}"; do
    IFS=':' read -r db_symbol binance_symbol <<< "$entry"
    
    echo ""
    echo "📥 Scaricando $db_symbol ($binance_symbol)..."
    
    # Scarica 60 giorni di dati
    node download_klines.js "$db_symbol" "$binance_symbol" 60
    
    if [ $? -eq 0 ]; then
        echo "✅ $db_symbol completato"
    else
        echo "❌ Errore su $db_symbol"
    fi
    
    # Pausa per non sovraccaricare Binance API
    sleep 2
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Download completato!"
echo ""
echo "Verifica con:"
echo "node verify_klines_count.js"
