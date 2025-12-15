#!/bin/bash
# Script per vedere i dettagli completi delle klines di Bitcoin

echo "🔍 DETTAGLI KLINES BITCOIN"
echo "=========================="
echo ""

echo "📊 1. Totale klines:"
sudo -u postgres psql -d crypto_db -c "SELECT COUNT(*) as totale_klines FROM klines WHERE symbol = 'bitcoin';"

echo ""
echo "📈 2. Klines per intervallo:"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    interval,
    COUNT(*) as count,
    TO_TIMESTAMP(MIN(open_time) / 1000) as prima_kline,
    TO_TIMESTAMP(MAX(open_time) / 1000) as ultima_kline
FROM klines 
WHERE symbol = 'bitcoin'
GROUP BY interval
ORDER BY interval;
"

echo ""
echo "📅 3. Range temporale complessivo:"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    COUNT(*) as total,
    TO_TIMESTAMP(MIN(open_time) / 1000) as prima_kline,
    TO_TIMESTAMP(MAX(open_time) / 1000) as ultima_kline,
    ROUND(EXTRACT(EPOCH FROM (TO_TIMESTAMP(MAX(open_time) / 1000) - TO_TIMESTAMP(MIN(open_time) / 1000))) / 86400, 1) as giorni_coperti
FROM klines 
WHERE symbol = 'bitcoin';
"

echo ""
echo "📊 4. Ultime 5 klines (più recenti):"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    TO_TIMESTAMP(open_time / 1000) as data,
    interval,
    ROUND(open_price::numeric, 2) as open,
    ROUND(high_price::numeric, 2) as high,
    ROUND(low_price::numeric, 2) as low,
    ROUND(close_price::numeric, 2) as close,
    ROUND(volume::numeric, 2) as volume
FROM klines 
WHERE symbol = 'bitcoin' 
ORDER BY open_time DESC 
LIMIT 5;
"

echo ""
echo "📊 5. Statistiche per intervallo 15m (se presente):"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    COUNT(*) as count_15m,
    TO_TIMESTAMP(MIN(open_time) / 1000) as prima_15m,
    TO_TIMESTAMP(MAX(open_time) / 1000) as ultima_15m,
    ROUND(EXTRACT(EPOCH FROM (TO_TIMESTAMP(MAX(open_time) / 1000) - TO_TIMESTAMP(MIN(open_time) / 1000))) / 86400, 1) as giorni_15m
FROM klines 
WHERE symbol = 'bitcoin' AND interval = '15m';
"

echo ""
echo "✅ Verifica completata"
