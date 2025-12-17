#!/bin/bash
# Script per verificare simboli duplicati che puntano allo stesso trading pair

echo "🔍 VERIFICA SIMBOLI DUPLICATI"
echo "============================="
echo ""

echo "📊 Simboli Bitcoin e loro configurazione:"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    symbol,
    is_active,
    CASE WHEN is_active = 1 THEN '✅ ATTIVO' ELSE '❌ NON ATTIVO' END as stato,
    parameters
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
echo "📊 Posizioni aperte per simboli Bitcoin:"
sudo -u postgres psql -d crypto_db -c "
SELECT symbol, COUNT(*) as posizioni_aperte
FROM open_positions 
WHERE symbol IN ('bitcoin', 'bitcoin_usdt', 'bitcoin_eur') AND status = 'open'
GROUP BY symbol
ORDER BY symbol;
"

echo ""
echo "💡 RACCOMANDAZIONE:"
echo "   • 'bitcoin' e 'bitcoin_usdt' sono DUPLICATI (entrambi → BTCUSDT)"
echo "   • Le klines sono salvate come 'bitcoin'"
echo "   • Consiglio: disattivare 'bitcoin_usdt' e usare solo 'bitcoin'"
echo "   • Oppure: disattivare 'bitcoin' e copiare le klines a 'bitcoin_usdt'"
echo ""
