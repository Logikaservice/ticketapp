#!/bin/bash
# Script DEFINITIVO per eliminare TUTTI i simboli non validi da TUTTE le tabelle

echo "🗑️  RIMOZIONE COMPLETA SIMBOLI NON VALIDI"
echo "=========================================="
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
echo "🔍 Identificazione simboli non validi da TUTTE le tabelle..."
echo ""

# Unisci tutti i simboli non validi da tutte le tabelle
ALL_INVALID=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT DISTINCT symbol
FROM (
    SELECT symbol FROM klines WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM price_history WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM bot_settings WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM open_positions WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM trades WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    UNION
    SELECT symbol FROM symbol_volumes_24h WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
) AS all_symbols
ORDER BY symbol;
" | sed 's/^[[:space:]]*//' | sed '/^$/d')

if [ -z "$ALL_INVALID" ]; then
    echo "   ✅ Nessun simbolo non valido trovato in nessuna tabella!"
    exit 0
fi

INVALID_COUNT=$(echo "$ALL_INVALID" | wc -l)
echo "   ⚠️  Trovati $INVALID_COUNT simboli non validi:"
echo "$ALL_INVALID" | sed 's/^/      - /'
echo ""

# Mostra conteggi per tabella
echo "📊 Conteggi per tabella:"
echo "   • klines:"
KLINES_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM klines
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)
echo "      Invalid: $KLINES_COUNT"

echo "   • price_history:"
PRICE_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM price_history
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)
echo "      Invalid: $PRICE_COUNT"

echo "   • symbol_volumes_24h:"
VOLUME_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM symbol_volumes_24h
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)
echo "      Invalid: $VOLUME_COUNT"

echo "   • bot_settings:"
SETTINGS_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM bot_settings
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)
echo "      Invalid: $SETTINGS_COUNT"

echo "   • open_positions:"
POSITIONS_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM open_positions
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)
echo "      Invalid: $POSITIONS_COUNT"

echo "   • trades:"
TRADES_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM trades
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)
echo "      Invalid: $TRADES_COUNT"

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
INVALID_SQL=$(echo "$ALL_INVALID" | sed "s/^/'/" | sed "s/$/',/" | tr -d '\n' | sed 's/,$//')

# Elimina da tutte le tabelle
echo "   • Eliminazione da bot_settings..."
DELETED1=$(sudo -u postgres psql -d crypto_db -c "
DELETE FROM bot_settings 
WHERE symbol IN ($INVALID_SQL);
" 2>&1 | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")
echo "      ✅ Eliminati $DELETED1 record"

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

TOTAL_DELETED=$((DELETED1 + DELETED2 + DELETED3 + DELETED4 + DELETED5 + DELETED6))
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
