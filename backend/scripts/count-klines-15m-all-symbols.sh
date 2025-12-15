#!/bin/bash
# Script per contare i klines 15m per ogni simbolo

echo "📊 KLINES 15M PER SIMBOLO"
echo "========================="
echo ""

echo "📈 Conteggio klines 15m per simbolo:"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    symbol,
    COUNT(*) as klines_15m,
    MIN(open_time) as first_time,
    MAX(open_time) as last_time,
    ROUND((MAX(open_time) - MIN(open_time)) / (1000.0 * 60 * 60 * 24), 1) as giorni_coperti
FROM klines 
WHERE interval = '15m'
GROUP BY symbol
ORDER BY klines_15m DESC;
"

echo ""
echo "📊 Statistiche riepilogative:"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    COUNT(DISTINCT symbol) as simboli_totali,
    SUM(CASE WHEN cnt >= 5000 THEN 1 ELSE 0 END) as simboli_con_5000_plus,
    SUM(CASE WHEN cnt >= 2000 AND cnt < 5000 THEN 1 ELSE 0 END) as simboli_con_2000_4999,
    SUM(CASE WHEN cnt < 2000 THEN 1 ELSE 0 END) as simboli_sotto_2000,
    AVG(cnt)::INTEGER as media_klines,
    MIN(cnt) as minimo_klines,
    MAX(cnt) as massimo_klines
FROM (
    SELECT symbol, COUNT(*) as cnt
    FROM klines 
    WHERE interval = '15m'
    GROUP BY symbol
) as stats;
"

echo ""
echo "📊 Simboli con meno di 2000 klines (da completare):"
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
echo "📊 Simboli con 2000-4999 klines (sotto il target):"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    symbol,
    COUNT(*) as klines_15m
FROM klines 
WHERE interval = '15m'
GROUP BY symbol
HAVING COUNT(*) >= 2000 AND COUNT(*) < 5000
ORDER BY klines_15m ASC;
"

echo ""
echo "📊 Simboli con 5000+ klines (completi):"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    symbol,
    COUNT(*) as klines_15m
FROM klines 
WHERE interval = '15m'
GROUP BY symbol
HAVING COUNT(*) >= 5000
ORDER BY klines_15m DESC;
"

echo ""
echo "✅ Report completato"
