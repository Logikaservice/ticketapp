#!/bin/bash
# Script FORZATO per eliminare TUTTI i simboli non validi - versione finale

echo "🗑️  RIMOZIONE FORZATA TUTTI SIMBOLI NON VALIDI"
echo "==============================================="
echo ""

# Estrai simboli validi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALID_SYMBOLS_JSON=$(node "$SCRIPT_DIR/extract-valid-symbols.js" 2>/dev/null | tail -1)

if [ -z "$VALID_SYMBOLS_JSON" ]; then
    echo "❌ Errore: Impossibile estrarre simboli validi"
    exit 1
fi

echo "📊 Simboli validi: $(echo "$VALID_SYMBOLS_JSON" | tr ',' '\n' | wc -l)"
echo ""

# Trova TUTTI i simboli non validi da TUTTE le tabelle
echo "🔍 Identificazione simboli non validi..."
ALL_INVALID=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT DISTINCT symbol
FROM (
    SELECT symbol FROM klines WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM price_history WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM symbol_volumes_24h WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM bot_settings WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM open_positions WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM trades WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
) AS all_symbols
ORDER BY symbol;
" | sed 's/^[[:space:]]*//' | sed '/^$/d')

if [ -z "$ALL_INVALID" ]; then
    echo "   ✅ Nessun simbolo non valido trovato!"
    exit 0
fi

INVALID_COUNT=$(echo "$ALL_INVALID" | wc -l)
echo "   ⚠️  Trovati $INVALID_COUNT simboli non validi:"
echo "$ALL_INVALID" | sed 's/^/      - /'
echo ""

# Mostra conteggi dettagliati
echo "📊 Conteggi per tabella PRIMA della rimozione:"
for table in klines price_history symbol_volumes_24h bot_settings open_positions trades; do
    COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
    SELECT COUNT(DISTINCT symbol)
    FROM $table
    WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
    " | xargs)
    echo "   • $table: $COUNT simboli non validi"
done
echo ""

read -p "⚠️  ELIMINARE DEFINITIVAMENTE questi simboli? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "⏭️  Operazione annullata"
    exit 0
fi

echo ""
echo "🔄 Eliminazione in corso..."

# Crea lista SQL
INVALID_SQL=$(echo "$ALL_INVALID" | sed "s/^/'/" | sed "s/$/',/" | tr -d '\n' | sed 's/,$//')

# Elimina da tutte le tabelle in ordine
TOTAL_DELETED=0

for table in bot_settings klines open_positions trades price_history symbol_volumes_24h; do
    echo "   • Eliminazione da $table..."
    DELETED=$(sudo -u postgres psql -d crypto_db -c "
    DELETE FROM $table 
    WHERE symbol IN ($INVALID_SQL);
    " 2>&1 | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")
    echo "      ✅ Eliminati $DELETED record"
    TOTAL_DELETED=$((TOTAL_DELETED + DELETED))
done

echo ""
echo "✅ Eliminazione completata! Totale record eliminati: $TOTAL_DELETED"
echo ""

# Verifica finale
echo "📊 Verifica finale:"
FINAL_INVALID=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM (
    SELECT symbol FROM klines WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM price_history WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM symbol_volumes_24h WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM bot_settings WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM open_positions WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM trades WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
) AS all_symbols;
" | xargs)

if [ "$FINAL_INVALID" -eq 0 ]; then
    echo "   ✅ TUTTI I SIMBOLI NON VALIDI SONO STATI ELIMINATI!"
else
    echo "   ⚠️  Ancora presenti $FINAL_INVALID simboli non validi"
    echo ""
    echo "   Simboli non validi rimasti:"
    sudo -u postgres psql -d crypto_db -t -c "
    SELECT DISTINCT symbol
    FROM (
        SELECT symbol FROM klines WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
        UNION
        SELECT symbol FROM price_history WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
        UNION
        SELECT symbol FROM symbol_volumes_24h WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
        UNION
        SELECT symbol FROM bot_settings WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
        UNION
        SELECT symbol FROM open_positions WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
        UNION
        SELECT symbol FROM trades WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    ) AS all_symbols
    ORDER BY symbol;
    " | sed 's/^/      - /'
fi

echo ""
echo "✅ Script completato"
