#!/bin/bash
# Script per contare i simboli sul VPS

echo "🔍 CONTEGGIO SIMBOLI NEL SISTEMA"
echo "================================="
echo ""

echo "📊 1. Simboli in bot_settings:"
sudo -u postgres psql -d crypto_db -c "
SELECT COUNT(DISTINCT symbol) as totale, 
       COUNT(DISTINCT CASE WHEN is_active = 1 THEN symbol END) as attivi
FROM bot_settings 
WHERE symbol != 'global';
"

echo ""
echo "📊 2. Simboli NON attivi (is_active = 0):"
sudo -u postgres psql -d crypto_db -c "
SELECT symbol, is_active 
FROM bot_settings 
WHERE symbol != 'global' AND is_active = 0
ORDER BY symbol;
"

echo ""
echo "📊 3. Lista completa simboli in bot_settings:"
sudo -u postgres psql -d crypto_db -c "
SELECT symbol, 
       CASE WHEN is_active = 1 THEN '✅ ATTIVO' ELSE '❌ NON ATTIVO' END as stato
FROM bot_settings 
WHERE symbol != 'global' 
ORDER BY is_active DESC, symbol;
"

echo ""
echo "📊 4. Simboli con klines nel database:"
sudo -u postgres psql -d crypto_db -c "
SELECT COUNT(DISTINCT symbol) as totale
FROM klines;
"

echo ""
echo "📊 5. Simboli con almeno 5000 klines (15m):"
sudo -u postgres psql -d crypto_db -c "
SELECT symbol, COUNT(*) as count 
FROM klines 
WHERE interval = '15m'
GROUP BY symbol 
HAVING COUNT(*) >= 5000
ORDER BY count DESC;
"

echo ""
echo "✅ Verifica completata"

