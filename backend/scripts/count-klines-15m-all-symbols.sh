#!/bin/bash
# Script per contare i klines 15m per ogni simbolo

echo "📊 KLINES 15M PER SIMBOLO"
echo "=========================="
echo ""

echo "📈 Conteggio klines 15m per simbolo:"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    symbol,
    COUNT(*) as klines_15m,
    MIN(open_time) as first_time,
    MAX(open_time) as last_time,
    CASE 
        WHEN COUNT(*) >= 5000 THEN '✅ OK (>=5000)'
        WHEN COUNT(*) >= 2000 THEN '⚠️  MINIMO (>=2000)'
        ELSE '❌ INCOMPLETO (<2000)'
    END as stato
FROM klines 
WHERE interval = '15m'
GROUP BY symbol
ORDER BY klines_15m DESC;
"

echo ""
echo "📊 Riepilogo:"
TOTAL_SYMBOLS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol) 
FROM klines 
WHERE interval = '15m';
" | xargs)

OK_SYMBOLS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol) 
FROM klines 
WHERE interval = '15m'
GROUP BY symbol
HAVING COUNT(*) >= 5000;
" | wc -l | xargs)

MIN_SYMBOLS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol) 
FROM klines 
WHERE interval = '15m'
GROUP BY symbol
HAVING COUNT(*) >= 2000 AND COUNT(*) < 5000;
" | wc -l | xargs)

INCOMPLETE_SYMBOLS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol) 
FROM klines 
WHERE interval = '15m'
GROUP BY symbol
HAVING COUNT(*) < 2000;
" | wc -l | xargs)

echo "   • Totale simboli con klines 15m: $TOTAL_SYMBOLS"
echo "   • ✅ OK (>=5000 klines): $OK_SYMBOLS"
echo "   • ⚠️  MINIMO (2000-4999 klines): $MIN_SYMBOLS"
echo "   • ❌ INCOMPLETI (<2000 klines): $INCOMPLETE_SYMBOLS"

echo ""
echo "📊 Simboli incompleti (<2000 klines):"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    symbol,
    COUNT(*) as klines_15m
FROM klines 
WHERE interval = '15m'
GROUP BY symbol
HAVING COUNT(*) < 2000
ORDER BY klines_15m ASC;
"

echo ""
echo "✅ Script completato"
