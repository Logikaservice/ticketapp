#!/bin/bash
# Script per verificare lo stato di tutti i simboli Bitcoin

echo "🔍 VERIFICA STATO SIMBOLI BITCOIN"
echo "================================="
echo ""

echo "📊 Tutti i simboli Bitcoin in bot_settings:"
sudo -u postgres psql -d crypto_db -c "
SELECT symbol, 
       is_active,
       CASE WHEN is_active = 1 THEN '✅ ATTIVO' ELSE '❌ NON ATTIVO' END as stato
FROM bot_settings 
WHERE symbol ILIKE '%bitcoin%' OR symbol ILIKE '%btc%'
ORDER BY symbol;
"

echo ""
echo "📊 Simboli Bitcoin con klines nel database:"
sudo -u postgres psql -d crypto_db -c "
SELECT symbol, 
       COUNT(*) as klines_count,
       COUNT(DISTINCT interval) as intervalli
FROM klines 
WHERE symbol ILIKE '%bitcoin%' OR symbol ILIKE '%btc%'
GROUP BY symbol
ORDER BY klines_count DESC;
"

echo ""
echo "💡 Nota: Se 'bitcoin' è disattivo ma 'bitcoin_usdt' o 'bitcoin_eur' sono attivi,"
echo "   potrebbe essere una configurazione intenzionale."
echo ""
