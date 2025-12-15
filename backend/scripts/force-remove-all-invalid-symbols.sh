#!/bin/bash
# Script per forzare l'eliminazione di TUTTI i simboli non validi
# Trova e elimina direttamente tutti i simboli non presenti nella lista valida

echo "🗑️  FORZATURA RIMOZIONE TUTTI I SIMBOLI NON VALIDI"
echo "===================================================="
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

# Trova TUTTI i simboli non validi da tutte le tabelle
echo "📊 Identificazione simboli non validi da tutte le tabelle..."
echo ""

# Ottieni lista completa di simboli non validi
ALL_INVALID=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT DISTINCT symbol
FROM (
    SELECT symbol FROM klines
    UNION
    SELECT symbol FROM price_history
    UNION
    SELECT symbol FROM symbol_volumes_24h
    UNION
    SELECT symbol FROM bot_settings
    UNION
    SELECT symbol FROM open_positions
    UNION
    SELECT symbol FROM trades
) AS all_symbols
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
ORDER BY symbol;
" | sed 's/^[[:space:]]*//' | sed '/^$/d')

if [ -z "$ALL_INVALID" ]; then
    echo "   ✅ Nessun simbolo non valido trovato!"
    exit 0
fi

INVALID_COUNT=$(echo "$ALL_INVALID" | wc -l)
echo "   ⚠️  Trovati $INVALID_COUNT simboli non validi:"
echo "$ALL_INVALID" | head -20
if [ "$INVALID_COUNT" -gt 20 ]; then
    echo "   ... e altri $((INVALID_COUNT - 20)) simboli"
fi
echo ""

read -p "⚠️  Eliminare TUTTI questi $INVALID_COUNT simboli da TUTTE le tabelle? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "⏭️  Operazione annullata"
    exit 0
fi

echo ""
echo "🔄 Eliminazione in corso..."

# Crea lista SQL per i simboli non validi
INVALID_SQL=$(echo "$ALL_INVALID" | sed "s/^/'/" | sed "s/$/',/" | tr -d '\n' | sed 's/,$//')

# Elimina da tutte le tabelle
echo "   • Eliminazione da bot_settings..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM bot_settings 
WHERE symbol IN ($INVALID_SQL);
" > /dev/null 2>&1
echo "      ✅ Completato"

echo "   • Eliminazione klines..."
DELETED2=$(sudo -u postgres psql -d crypto_db -c "
DELETE FROM klines 
WHERE symbol IN ($INVALID_SQL);
" 2>&1 | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")
echo "      ✅ Eliminati $DELETED2 record"

echo "   • Eliminazione open_positions..."
DELETED3=$(sudo -u postgres psql -d crypto_db -c "
DELETE FROM open_positions 
WHERE symbol IN ($INVALID_SQL);
" 2>&1 | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")
echo "      ✅ Eliminati $DELETED3 record"

echo "   • Eliminazione trades..."
DELETED4=$(sudo -u postgres psql -d crypto_db -c "
DELETE FROM trades 
WHERE symbol IN ($INVALID_SQL);
" 2>&1 | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")
echo "      ✅ Eliminati $DELETED4 record"

echo "   • Eliminazione price_history..."
DELETED5=$(sudo -u postgres psql -d crypto_db -c "
DELETE FROM price_history 
WHERE symbol IN ($INVALID_SQL);
" 2>&1 | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")
echo "      ✅ Eliminati $DELETED5 record"

echo "   • Eliminazione symbol_volumes_24h..."
DELETED6=$(sudo -u postgres psql -d crypto_db -c "
DELETE FROM symbol_volumes_24h 
WHERE symbol IN ($INVALID_SQL);
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
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)

REMAINING_VALID=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM klines
WHERE symbol IN ($VALID_SYMBOLS_JSON);
" | xargs)

if [ "$REMAINING" -eq 0 ]; then
    echo "   ✅ Tutti i simboli non validi sono stati eliminati"
    echo "   ✅ Simboli validi rimasti: $REMAINING_VALID"
else
    echo "   ⚠️  Ancora presenti $REMAINING simboli non validi"
    echo "   ✅ Simboli validi rimasti: $REMAINING_VALID"
fi

echo ""
echo "✅ Script completato"
