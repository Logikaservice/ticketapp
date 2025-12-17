#!/bin/bash
# Script per verificare tutti i simboli presenti nel database

echo "🔍 Verifica simboli nel database"
echo "================================="
echo ""

echo "📊 Tutti i simboli con conteggio klines:"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    symbol,
    COUNT(*) as totale_klines,
    COUNT(DISTINCT interval) as intervalli
FROM klines 
GROUP BY symbol
ORDER BY totale_klines DESC;
"

echo ""
echo "🔍 Cerca simboli che contengono 'bitcoin' o 'btc':"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    symbol,
    COUNT(*) as totale_klines
FROM klines 
WHERE symbol ILIKE '%bitcoin%' OR symbol ILIKE '%btc%'
GROUP BY symbol
ORDER BY symbol;
"

echo ""
echo "✅ Verifica completata"
