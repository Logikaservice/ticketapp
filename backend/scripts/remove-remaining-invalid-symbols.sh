#!/bin/bash
# Script per eliminare i simboli non validi rimasti manualmente

echo "🗑️  RIMOZIONE SIMBOLI NON VALIDI RIMASTI"
echo "========================================="
echo ""

# Lista simboli non validi da eliminare (quelli rimasti)
INVALID_SYMBOLS=('ar' 'atom_eur' 'litecoin' 'litecoin_usdt' 'near_eur' 'sui_eur')

echo "📊 Simboli da eliminare: ${#INVALID_SYMBOLS[@]}"
for symbol in "${INVALID_SYMBOLS[@]}"; do
    echo "   - $symbol"
done
echo ""

read -p "⚠️  Eliminare questi simboli da TUTTE le tabelle? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "⏭️  Operazione annullata"
    exit 0
fi

echo ""
echo "🔄 Eliminazione in corso..."

# Crea lista SQL
SYMBOLS_SQL=$(printf "'%s'," "${INVALID_SYMBOLS[@]}" | sed 's/,$//')

# Elimina da tutte le tabelle
echo "   • Eliminazione da bot_settings..."
DELETED1=$(sudo -u postgres psql -d crypto_db -t -c "
DELETE FROM bot_settings 
WHERE symbol IN ($SYMBOLS_SQL);
SELECT COUNT(*) FROM bot_settings WHERE symbol IN ($SYMBOLS_SQL);
" 2>&1 | head -1 | xargs)
echo "      ✅ Completato"

echo "   • Eliminazione klines..."
DELETED2=$(sudo -u postgres psql -d crypto_db -t -c "
DELETE FROM klines 
WHERE symbol IN ($SYMBOLS_SQL);
" 2>&1 | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")
echo "      ✅ Eliminati $DELETED2 record"

echo "   • Eliminazione open_positions..."
DELETED3=$(sudo -u postgres psql -d crypto_db -t -c "
DELETE FROM open_positions 
WHERE symbol IN ($SYMBOLS_SQL);
" 2>&1 | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")
echo "      ✅ Eliminati $DELETED3 record"

echo "   • Eliminazione trades..."
DELETED4=$(sudo -u postgres psql -d crypto_db -t -c "
DELETE FROM trades 
WHERE symbol IN ($SYMBOLS_SQL);
" 2>&1 | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")
echo "      ✅ Eliminati $DELETED4 record"

echo "   • Eliminazione price_history..."
DELETED5=$(sudo -u postgres psql -d crypto_db -t -c "
DELETE FROM price_history 
WHERE symbol IN ($SYMBOLS_SQL);
" 2>&1 | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")
echo "      ✅ Eliminati $DELETED5 record"

echo "   • Eliminazione symbol_volumes_24h..."
DELETED6=$(sudo -u postgres psql -d crypto_db -t -c "
DELETE FROM symbol_volumes_24h 
WHERE symbol IN ($SYMBOLS_SQL);
" 2>&1 | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")
echo "      ✅ Eliminati $DELETED6 record"

echo ""
echo "✅ Eliminazione completata!"
echo ""

# Verifica finale
echo "📊 Verifica finale:"
REMAINING=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM klines
WHERE symbol IN ($SYMBOLS_SQL);
" | xargs)

if [ "$REMAINING" -eq 0 ]; then
    echo "   ✅ Tutti i simboli sono stati eliminati"
else
    echo "   ⚠️  Ancora presenti $REMAINING simboli"
    sudo -u postgres psql -d crypto_db -t -c "
    SELECT DISTINCT symbol
    FROM klines
    WHERE symbol IN ($SYMBOLS_SQL);
    " | sed 's/^/      - /'
fi

echo ""
echo "✅ Script completato"
