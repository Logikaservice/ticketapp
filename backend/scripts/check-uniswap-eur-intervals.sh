#!/bin/bash
# Script per verificare gli intervalli delle klines di uniswap_eur

echo "🔍 VERIFICA INTERVALLI KLINES PER UNISWAP_EUR"
echo "============================================="
echo ""

echo "📊 Klines per intervallo:"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    interval,
    COUNT(*) as klines_count,
    MIN(open_time) as first_time,
    MAX(open_time) as last_time
FROM klines 
WHERE symbol = 'uniswap_eur'
GROUP BY interval
ORDER BY interval;
"

echo ""
echo "📊 Totale klines (tutti gli intervalli):"
sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) as total
FROM klines 
WHERE symbol = 'uniswap_eur';
"

echo ""
echo "📊 Klines solo 15m (come nello script di diagnosi):"
sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) as count_15m
FROM klines 
WHERE symbol = 'uniswap_eur' AND interval = '15m';
"
