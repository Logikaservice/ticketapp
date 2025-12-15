#!/bin/bash
# Script per eliminare tutti i simboli con meno di N klines 15m
# Uso: ./remove-low-klines-symbols.sh [threshold]
# Default: elimina simboli con < 2000 klines 15m

THRESHOLD=${1:-2000}

echo "🗑️  RIMOZIONE SIMBOLI CON < $THRESHOLD KLINES 15M"
echo "=================================================="
echo ""

# Trova simboli con meno klines
echo "📊 Simboli con < $THRESHOLD klines 15m:"
SYMBOLS_TO_REMOVE=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT symbol
FROM klines 
WHERE interval = '15m'
GROUP BY symbol
HAVING COUNT(*) < $THRESHOLD
ORDER BY COUNT(*) ASC;
" | xargs)

if [ -z "$SYMBOLS_TO_REMOVE" ]; then
    echo "   ✅ Nessun simbolo da eliminare"
    exit 0
fi

# Converti in array
read -ra SYMBOL_ARRAY <<< "$SYMBOLS_TO_REMOVE"

echo "   Trovati ${#SYMBOL_ARRAY[@]} simboli:"
for SYMBOL in "${SYMBOL_ARRAY[@]}"; do
    COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
    SELECT COUNT(*) 
    FROM klines 
    WHERE symbol = '$SYMBOL' AND interval = '15m';
    " | xargs)
    echo "      • $SYMBOL: $COUNT klines"
done

echo ""
read -p "⚠️  Eliminare TUTTI questi simboli? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "⏭️  Operazione annullata"
    exit 0
fi

echo ""
echo "🔄 Eliminazione in corso..."

# Elimina ogni simbolo
for SYMBOL in "${SYMBOL_ARRAY[@]}"; do
    echo "   • Eliminazione $SYMBOL..."
    
    sudo -u postgres psql -d crypto_db -c "DELETE FROM bot_settings WHERE symbol = '$SYMBOL';" > /dev/null 2>&1
    sudo -u postgres psql -d crypto_db -c "DELETE FROM klines WHERE symbol = '$SYMBOL';" > /dev/null 2>&1
    sudo -u postgres psql -d crypto_db -c "DELETE FROM open_positions WHERE symbol = '$SYMBOL';" > /dev/null 2>&1
    sudo -u postgres psql -d crypto_db -c "DELETE FROM trades WHERE symbol = '$SYMBOL';" > /dev/null 2>&1
    sudo -u postgres psql -d crypto_db -c "DELETE FROM price_history WHERE symbol = '$SYMBOL';" > /dev/null 2>&1
    sudo -u postgres psql -d crypto_db -c "DELETE FROM symbol_volumes_24h WHERE symbol = '$SYMBOL';" > /dev/null 2>&1
done

echo ""
echo "✅ Eliminazione completata!"
echo "   Eliminati ${#SYMBOL_ARRAY[@]} simboli"
echo ""
echo "✅ Script completato"
