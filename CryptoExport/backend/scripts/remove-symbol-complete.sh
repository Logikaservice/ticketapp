#!/bin/bash
# Script per eliminare completamente un simbolo (o lista di simboli) dal database
# Uso: ./remove-symbol-complete.sh symbol1 [symbol2 ...]
# Esempio: ./remove-symbol-complete.sh uniswap_eur bitcoin_usdt

if [ $# -eq 0 ]; then
    echo "❌ Errore: Specifica almeno un simbolo da eliminare"
    echo "Uso: $0 symbol1 [symbol2 ...]"
    echo "Esempio: $0 uniswap_eur bitcoin_usdt"
    exit 1
fi

SYMBOLS=("$@")

echo "🗑️  RIMOZIONE COMPLETA SIMBOLI"
echo "==============================="
echo ""
echo "📋 Simboli da eliminare: ${SYMBOLS[*]}"
echo ""

# Mostra situazione prima della rimozione
echo "📊 Situazione attuale:"
for SYMBOL in "${SYMBOLS[@]}"; do
    echo ""
    echo "   🔍 $SYMBOL:"
    
    BOT_SETTINGS=$(sudo -u postgres psql -d crypto_db -t -c "SELECT COUNT(*) FROM bot_settings WHERE symbol = '$SYMBOL';" | xargs)
    KLINES=$(sudo -u postgres psql -d crypto_db -t -c "SELECT COUNT(*) FROM klines WHERE symbol = '$SYMBOL';" | xargs)
    OPEN_POS=$(sudo -u postgres psql -d crypto_db -t -c "SELECT COUNT(*) FROM open_positions WHERE symbol = '$SYMBOL';" | xargs)
    TRADES=$(sudo -u postgres psql -d crypto_db -t -c "SELECT COUNT(*) FROM trades WHERE symbol = '$SYMBOL';" | xargs)
    PRICE_HIST=$(sudo -u postgres psql -d crypto_db -t -c "SELECT COUNT(*) FROM price_history WHERE symbol = '$SYMBOL';" | xargs)
    VOLUMES=$(sudo -u postgres psql -d crypto_db -t -c "SELECT COUNT(*) FROM symbol_volumes_24h WHERE symbol = '$SYMBOL';" | xargs)
    
    TOTAL=$((BOT_SETTINGS + KLINES + OPEN_POS + TRADES + PRICE_HIST + VOLUMES))
    
    echo "      • bot_settings: $BOT_SETTINGS"
    echo "      • klines: $KLINES"
    echo "      • open_positions: $OPEN_POS"
    echo "      • trades: $TRADES"
    echo "      • price_history: $PRICE_HIST"
    echo "      • symbol_volumes_24h: $VOLUMES"
    echo "      • TOTALE: $TOTAL record"
done

echo ""
TOTAL_ALL=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT 
    (SELECT COUNT(*) FROM bot_settings WHERE symbol = ANY(ARRAY[$(printf "'%s'," "${SYMBOLS[@]}" | sed 's/,$//')])) +
    (SELECT COUNT(*) FROM klines WHERE symbol = ANY(ARRAY[$(printf "'%s'," "${SYMBOLS[@]}" | sed 's/,$//')])) +
    (SELECT COUNT(*) FROM open_positions WHERE symbol = ANY(ARRAY[$(printf "'%s'," "${SYMBOLS[@]}" | sed 's/,$//')])) +
    (SELECT COUNT(*) FROM trades WHERE symbol = ANY(ARRAY[$(printf "'%s'," "${SYMBOLS[@]}" | sed 's/,$//')])) +
    (SELECT COUNT(*) FROM price_history WHERE symbol = ANY(ARRAY[$(printf "'%s'," "${SYMBOLS[@]}" | sed 's/,$//')])) +
    (SELECT COUNT(*) FROM symbol_volumes_24h WHERE symbol = ANY(ARRAY[$(printf "'%s'," "${SYMBOLS[@]}" | sed 's/,$//')]));
" | xargs)

echo "📊 TOTALE RECORD DA ELIMINARE: $TOTAL_ALL"
echo ""

read -p "⚠️  Eliminare TUTTI i dati dei simboli indicati? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "⏭️  Operazione annullata"
    exit 0
fi

echo ""
echo "🔄 Eliminazione in corso..."

# Crea array SQL per IN clause
SYMBOLS_SQL=$(printf "'%s'," "${SYMBOLS[@]}" | sed 's/,$//')

# Elimina da tutte le tabelle
echo "   • Eliminazione da bot_settings..."
sudo -u postgres psql -d crypto_db -c "DELETE FROM bot_settings WHERE symbol = ANY(ARRAY[$SYMBOLS_SQL]);" > /dev/null 2>&1

echo "   • Eliminazione klines (tutti gli intervalli)..."
sudo -u postgres psql -d crypto_db -c "DELETE FROM klines WHERE symbol = ANY(ARRAY[$SYMBOLS_SQL]);" > /dev/null 2>&1

echo "   • Eliminazione open_positions..."
sudo -u postgres psql -d crypto_db -c "DELETE FROM open_positions WHERE symbol = ANY(ARRAY[$SYMBOLS_SQL]);" > /dev/null 2>&1

echo "   • Eliminazione trades..."
sudo -u postgres psql -d crypto_db -c "DELETE FROM trades WHERE symbol = ANY(ARRAY[$SYMBOLS_SQL]);" > /dev/null 2>&1

echo "   • Eliminazione price_history..."
sudo -u postgres psql -d crypto_db -c "DELETE FROM price_history WHERE symbol = ANY(ARRAY[$SYMBOLS_SQL]);" > /dev/null 2>&1

echo "   • Eliminazione symbol_volumes_24h..."
sudo -u postgres psql -d crypto_db -c "DELETE FROM symbol_volumes_24h WHERE symbol = ANY(ARRAY[$SYMBOLS_SQL]);" > /dev/null 2>&1

echo ""
echo "✅ Eliminazione completata!"
echo ""

# Verifica finale
echo "📊 Verifica finale:"
REMAINING=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT 
    (SELECT COUNT(*) FROM bot_settings WHERE symbol = ANY(ARRAY[$SYMBOLS_SQL])) +
    (SELECT COUNT(*) FROM klines WHERE symbol = ANY(ARRAY[$SYMBOLS_SQL])) +
    (SELECT COUNT(*) FROM open_positions WHERE symbol = ANY(ARRAY[$SYMBOLS_SQL])) +
    (SELECT COUNT(*) FROM trades WHERE symbol = ANY(ARRAY[$SYMBOLS_SQL])) +
    (SELECT COUNT(*) FROM price_history WHERE symbol = ANY(ARRAY[$SYMBOLS_SQL])) +
    (SELECT COUNT(*) FROM symbol_volumes_24h WHERE symbol = ANY(ARRAY[$SYMBOLS_SQL]));
" | xargs)

if [ "$REMAINING" -eq 0 ]; then
    echo "   ✅ Tutti i simboli completamente rimossi dal database"
else
    echo "   ⚠️  Ancora presenti $REMAINING record (verifica manuale necessaria)"
fi

echo ""
echo "✅ Script completato"
