#!/bin/bash
# Script per verificare e sistemare la configurazione Bitcoin

echo "🔍 VERIFICA E SISTEMAZIONE SIMBOLO BITCOIN"
echo "=========================================="
echo ""

echo "📊 Situazione attuale:"
sudo -u postgres psql -d crypto_db -c "
SELECT symbol, is_active,
       CASE WHEN is_active = 1 THEN '✅ ATTIVO' ELSE '❌ NON ATTIVO' END as stato
FROM bot_settings 
WHERE symbol IN ('bitcoin', 'bitcoin_usdt', 'bitcoin_eur')
ORDER BY symbol;
"

echo ""
echo "📊 Klines disponibili per simboli Bitcoin:"
sudo -u postgres psql -d crypto_db -c "
SELECT symbol, COUNT(*) as klines_count
FROM klines 
WHERE symbol IN ('bitcoin', 'bitcoin_usdt', 'bitcoin_eur')
GROUP BY symbol
ORDER BY klines_count DESC;
"

echo ""
echo "💡 OPZIONI:"
echo ""
echo "1. Se vuoi usare le klines esistenti ('bitcoin'):"
echo "   sudo -u postgres psql -d crypto_db -c \"UPDATE bot_settings SET is_active = 1 WHERE symbol = 'bitcoin' AND strategy_name = 'RSI_Strategy';\""
echo ""
echo "2. Se vuoi disattivare 'bitcoin' e usare solo 'bitcoin_usdt':"
echo "   sudo -u postgres psql -d crypto_db -c \"UPDATE bot_settings SET is_active = 0 WHERE symbol = 'bitcoin' AND strategy_name = 'RSI_Strategy';\""
echo ""
echo "3. Se vuoi attivare entrambi:"
echo "   sudo -u postgres psql -d crypto_db -c \"UPDATE bot_settings SET is_active = 1 WHERE symbol IN ('bitcoin', 'bitcoin_usdt') AND strategy_name = 'RSI_Strategy';\""
echo ""
