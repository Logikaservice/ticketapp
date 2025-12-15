#!/bin/bash
# Script per verificare se uniswap_eur è presente nel database

echo "🔍 VERIFICA PRESENZA UNISWAP_EUR"
echo "================================="
echo ""

echo "📊 1. bot_settings:"
sudo -u postgres psql -d crypto_db -c "
SELECT symbol, is_active,
       CASE WHEN is_active = 1 THEN '✅ ATTIVO' ELSE '❌ NON ATTIVO' END as stato
FROM bot_settings 
WHERE symbol = 'uniswap_eur';
"

echo ""
echo "📊 2. klines:"
KLINES_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) 
FROM klines 
WHERE symbol = 'uniswap_eur';
" | xargs)

if [ "$KLINES_COUNT" -gt 0 ]; then
    echo "   ⚠️  Trovate $KLINES_COUNT klines"
    echo "   Dettaglio per intervallo:"
    sudo -u postgres psql -d crypto_db -c "
    SELECT interval, COUNT(*) as count
    FROM klines 
    WHERE symbol = 'uniswap_eur'
    GROUP BY interval
    ORDER BY interval;
    "
else
    echo "   ✅ Nessuna kline trovata"
fi

echo ""
echo "📊 3. open_positions:"
POSITIONS_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) 
FROM open_positions 
WHERE symbol = 'uniswap_eur';
" | xargs)

if [ "$POSITIONS_COUNT" -gt 0 ]; then
    echo "   ⚠️  Trovate $POSITIONS_COUNT posizioni"
    sudo -u postgres psql -d crypto_db -c "
    SELECT ticket_id, symbol, type, volume, entry_price, status
    FROM open_positions 
    WHERE symbol = 'uniswap_eur';
    "
else
    echo "   ✅ Nessuna posizione trovata"
fi

echo ""
echo "📊 4. trades:"
TRADES_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) 
FROM trades 
WHERE symbol = 'uniswap_eur';
" | xargs)

if [ "$TRADES_COUNT" -gt 0 ]; then
    echo "   ⚠️  Trovati $TRADES_COUNT trade"
else
    echo "   ✅ Nessun trade trovato"
fi

echo ""
echo "📊 5. price_history:"
PRICE_HISTORY_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) 
FROM price_history 
WHERE symbol = 'uniswap_eur';
" | xargs)

if [ "$PRICE_HISTORY_COUNT" -gt 0 ]; then
    echo "   ⚠️  Trovate $PRICE_HISTORY_COUNT entry in price_history"
else
    echo "   ✅ Nessuna entry in price_history"
fi

echo ""
echo "📊 6. symbol_volumes_24h:"
VOLUMES_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) 
FROM symbol_volumes_24h 
WHERE symbol = 'uniswap_eur';
" | xargs)

if [ "$VOLUMES_COUNT" -gt 0 ]; then
    echo "   ⚠️  Trovata entry in symbol_volumes_24h"
    sudo -u postgres psql -d crypto_db -c "
    SELECT symbol, volume_24h, price
    FROM symbol_volumes_24h 
    WHERE symbol = 'uniswap_eur';
    "
else
    echo "   ✅ Nessuna entry in symbol_volumes_24h"
fi

echo ""
echo "================================="
TOTAL=$((KLINES_COUNT + POSITIONS_COUNT + TRADES_COUNT + PRICE_HISTORY_COUNT + VOLUMES_COUNT))

if [ "$TOTAL" -eq 0 ]; then
    echo "✅ uniswap_eur NON è presente nel database"
else
    echo "⚠️  uniswap_eur è ancora presente in alcune tabelle"
    echo "   Totale record trovati: $TOTAL"
fi
echo ""
