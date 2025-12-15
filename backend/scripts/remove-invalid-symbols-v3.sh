#!/bin/bash
# Script per eliminare tutti i simboli NON presenti nella lista valida
# Versione migliorata con gestione errori e verifica

echo "🗑️  RIMOZIONE SIMBOLI NON VALIDI (V3)"
echo "======================================"
echo ""

# Estrai simboli validi dal file TradingBot.js
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALID_SYMBOLS_JSON=$(node "$SCRIPT_DIR/extract-valid-symbols.js" 2>/dev/null | tail -1)

if [ -z "$VALID_SYMBOLS_JSON" ]; then
    echo "❌ Errore: Impossibile estrarre simboli validi"
    exit 1
fi

# Conta simboli validi
VALID_COUNT=$(echo "$VALID_SYMBOLS_JSON" | tr ',' '\n' | wc -l)
echo "📊 Simboli validi estratti: $VALID_COUNT"
echo ""

# Trova tutti i simboli non validi
echo "📊 Identificazione simboli non validi..."
echo ""

INVALID_SYMBOLS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT DISTINCT symbol
FROM klines
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
ORDER BY symbol;
" | sed 's/^[[:space:]]*//' | sed '/^$/d')

if [ -z "$INVALID_SYMBOLS" ]; then
    echo "   ✅ Nessun simbolo non valido trovato!"
    exit 0
fi

INVALID_COUNT=$(echo "$INVALID_SYMBOLS" | wc -l)
echo "   ⚠️  Trovati $INVALID_COUNT simboli non validi:"
echo "$INVALID_SYMBOLS" | head -10
if [ "$INVALID_COUNT" -gt 10 ]; then
    echo "   ... e altri $((INVALID_COUNT - 10)) simboli"
fi
echo ""

read -p "⚠️  Eliminare TUTTI questi simboli da tutte le tabelle? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "⏭️  Operazione annullata"
    exit 0
fi

echo ""
echo "🔄 Eliminazione in corso..."

# Crea una tabella temporanea con i simboli validi per migliorare le performance
sudo -u postgres psql -d crypto_db -c "
CREATE TEMP TABLE valid_symbols_temp (symbol TEXT);
INSERT INTO valid_symbols_temp VALUES $VALID_SYMBOLS_JSON;
" > /dev/null 2>&1

# Elimina da tutte le tabelle usando la tabella temporanea
echo "   • Eliminazione da bot_settings..."
RESULT1=$(sudo -u postgres psql -d crypto_db -t -c "
DELETE FROM bot_settings 
WHERE symbol NOT IN (SELECT symbol FROM valid_symbols_temp);
SELECT ROW_COUNT();
" 2>&1)
if [ $? -ne 0 ]; then
    echo "      ⚠️  Errore: $RESULT1"
else
    echo "      ✅ Completato"
fi

echo "   • Eliminazione klines (tutti gli intervalli)..."
RESULT2=$(sudo -u postgres psql -d crypto_db -t -c "
DELETE FROM klines 
WHERE symbol NOT IN (SELECT symbol FROM valid_symbols_temp);
" 2>&1)
if [ $? -ne 0 ]; then
    echo "      ⚠️  Errore: $RESULT2"
else
    DELETED=$(echo "$RESULT2" | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")
    echo "      ✅ Eliminati $DELETED record"
fi

echo "   • Eliminazione open_positions..."
RESULT3=$(sudo -u postgres psql -d crypto_db -t -c "
DELETE FROM open_positions 
WHERE symbol NOT IN (SELECT symbol FROM valid_symbols_temp);
" 2>&1)
if [ $? -ne 0 ]; then
    echo "      ⚠️  Errore: $RESULT3"
else
    echo "      ✅ Completato"
fi

echo "   • Eliminazione trades..."
RESULT4=$(sudo -u postgres psql -d crypto_db -t -c "
DELETE FROM trades 
WHERE symbol NOT IN (SELECT symbol FROM valid_symbols_temp);
" 2>&1)
if [ $? -ne 0 ]; then
    echo "      ⚠️  Errore: $RESULT4"
else
    echo "      ✅ Completato"
fi

echo "   • Eliminazione price_history..."
RESULT5=$(sudo -u postgres psql -d crypto_db -t -c "
DELETE FROM price_history 
WHERE symbol NOT IN (SELECT symbol FROM valid_symbols_temp);
" 2>&1)
if [ $? -ne 0 ]; then
    echo "      ⚠️  Errore: $RESULT5"
else
    DELETED=$(echo "$RESULT5" | grep -o "DELETE [0-9]*" | grep -o "[0-9]*" || echo "0")
    echo "      ✅ Eliminati $DELETED record"
fi

echo "   • Eliminazione symbol_volumes_24h..."
RESULT6=$(sudo -u postgres psql -d crypto_db -t -c "
DELETE FROM symbol_volumes_24h 
WHERE symbol NOT IN (SELECT symbol FROM valid_symbols_temp);
" 2>&1)
if [ $? -ne 0 ]; then
    echo "      ⚠️  Errore: $RESULT6"
else
    echo "      ✅ Completato"
fi

# Rimuovi tabella temporanea
sudo -u postgres psql -d crypto_db -c "DROP TABLE IF EXISTS valid_symbols_temp;" > /dev/null 2>&1

echo ""
echo "✅ Eliminazione completata!"
echo ""

# Verifica finale
echo "📊 Verifica finale:"
REMAINING_INVALID=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM klines
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)

REMAINING_VALID=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM klines
WHERE symbol IN ($VALID_SYMBOLS_JSON);
" | xargs)

if [ "$REMAINING_INVALID" -eq 0 ]; then
    echo "   ✅ Tutti i simboli non validi sono stati eliminati"
    echo "   ✅ Simboli validi rimasti: $REMAINING_VALID"
else
    echo "   ⚠️  Ancora presenti $REMAINING_INVALID simboli non validi"
    echo "   ✅ Simboli validi rimasti: $REMAINING_VALID"
    echo ""
    echo "   Simboli non validi rimasti:"
    sudo -u postgres psql -d crypto_db -t -c "
    SELECT DISTINCT symbol
    FROM klines
    WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    ORDER BY symbol;
    " | sed 's/^/      - /'
fi

echo ""
echo "✅ Script completato"
