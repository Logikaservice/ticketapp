#!/bin/bash
# Script per eliminare price_history di simboli non validi
# Previene che KlinesAggregatorService ricrei klines per simboli non validi

echo "🧹 PULIZIA PRICE_HISTORY DA SIMBOLI NON VALIDI"
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

# Trova simboli non validi in price_history
echo "📊 Identificazione simboli non validi in price_history..."
echo ""

INVALID_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM price_history
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)

if [ "$INVALID_COUNT" -eq 0 ]; then
    echo "   ✅ Nessun simbolo non valido in price_history!"
    exit 0
fi

echo "   ⚠️  Trovati $INVALID_COUNT simboli non validi in price_history"
echo ""

# Mostra quanti record ci sono
RECORD_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*)
FROM price_history
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)

echo "   📊 Totale record da eliminare: $RECORD_COUNT"
echo ""

read -p "⚠️  Eliminare price_history per simboli non validi? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "⏭️  Operazione annullata"
    exit 0
fi

echo ""
echo "🔄 Eliminazione in corso..."

DELETED=$(sudo -u postgres psql -d crypto_db -c "
DELETE FROM price_history 
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" 2>&1 | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")

echo "   ✅ Eliminati $DELETED record da price_history"
echo ""

# Verifica finale
REMAINING=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM price_history
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)

if [ "$REMAINING" -eq 0 ]; then
    echo "   ✅ Tutti i simboli non validi rimossi da price_history"
    echo ""
    echo "   💡 Ora KlinesAggregatorService non ricreerà più klines per simboli non validi"
else
    echo "   ⚠️  Ancora presenti $REMAINING simboli non validi"
fi

echo ""
echo "✅ Script completato"
