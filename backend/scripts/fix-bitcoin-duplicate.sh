#!/bin/bash
# Script per sistemare il duplicato Bitcoin

echo "🔧 SISTEMAZIONE DUPLICATO BITCOIN"
echo "=================================="
echo ""

echo "📊 Situazione attuale:"
sudo -u postgres psql -d crypto_db -c "
SELECT symbol, is_active,
       CASE WHEN is_active = 1 THEN '✅ ATTIVO' ELSE '❌ NON ATTIVO' END as stato
FROM bot_settings 
WHERE symbol IN ('bitcoin', 'bitcoin_usdt')
ORDER BY symbol;
"

echo ""
echo "📊 Klines disponibili:"
sudo -u postgres psql -d crypto_db -c "
SELECT symbol, COUNT(*) as klines_count
FROM klines 
WHERE symbol IN ('bitcoin', 'bitcoin_usdt')
GROUP BY symbol;
"

echo ""
read -p "Vuoi disattivare 'bitcoin_usdt' e usare solo 'bitcoin'? (s/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo "🔄 Disattivazione 'bitcoin_usdt'..."
    sudo -u postgres psql -d crypto_db -c "
    UPDATE bot_settings 
    SET is_active = 0 
    WHERE symbol = 'bitcoin_usdt' AND strategy_name = 'RSI_Strategy';
    "
    echo "✅ 'bitcoin_usdt' disattivato"
    echo ""
    echo "📊 Nuova configurazione:"
    sudo -u postgres psql -d crypto_db -c "
    SELECT symbol, is_active,
           CASE WHEN is_active = 1 THEN '✅ ATTIVO' ELSE '❌ NON ATTIVO' END as stato
    FROM bot_settings 
    WHERE symbol IN ('bitcoin', 'bitcoin_usdt')
    ORDER BY symbol;
    "
else
    echo "⏭️  Operazione annullata"
fi

echo ""
echo "✅ Script completato"

