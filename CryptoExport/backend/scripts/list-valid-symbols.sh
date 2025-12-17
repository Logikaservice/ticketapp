#!/bin/bash
# Script per vedere quali simboli sono considerati validi

echo "📊 SIMBOLI VALIDI DA BOT_SETTINGS"
echo "=================================="
echo ""

echo "Simboli in bot_settings:"
sudo -u postgres psql -d crypto_db -c "
SELECT symbol, is_active, COUNT(*) as count
FROM bot_settings 
GROUP BY symbol, is_active
ORDER BY symbol;
"

echo ""
echo "Totale simboli distinti in bot_settings:"
sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol) 
FROM bot_settings;
" | xargs

echo ""
echo "Simboli attivi:"
sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol) 
FROM bot_settings 
WHERE is_active = 1;
" | xargs
