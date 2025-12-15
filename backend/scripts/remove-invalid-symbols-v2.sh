#!/bin/bash
# Script per eliminare tutti i simboli NON presenti nella lista valida
# Estrae automaticamente i simboli validi da TradingBot.js

echo "🗑️  RIMOZIONE SIMBOLI NON VALIDI"
echo "=================================="
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

# Trova tutti i simboli nel database
echo "📊 Identificazione simboli nel database..."
echo ""

echo "   • Simboli in klines:"
TOTAL_SYMBOLS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol) as total_symbols
FROM klines;
" | xargs)
echo "      Totale: $TOTAL_SYMBOLS simboli"

echo ""
echo "   • Simboli NON validi in klines (da eliminare):"
sudo -u postgres psql -d crypto_db -c "
SELECT DISTINCT symbol
FROM klines
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
ORDER BY symbol;
"

INVALID_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM klines
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)

if [ "$INVALID_COUNT" -eq 0 ]; then
    echo ""
    echo "   ✅ Nessun simbolo non valido trovato!"
    exit 0
fi

echo ""
echo "   ⚠️  Trovati $INVALID_COUNT simboli non validi da eliminare"
echo ""

read -p "⚠️  Eliminare TUTTI i simboli non validi da tutte le tabelle? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "⏭️  Operazione annullata"
    exit 0
fi

echo ""
echo "🔄 Eliminazione in corso..."

# Elimina da tutte le tabelle
echo "   • Eliminazione da bot_settings..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM bot_settings 
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" > /dev/null 2>&1

echo "   • Eliminazione klines (tutti gli intervalli)..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM klines 
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" > /dev/null 2>&1

echo "   • Eliminazione open_positions..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM open_positions 
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" > /dev/null 2>&1

echo "   • Eliminazione trades..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM trades 
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" > /dev/null 2>&1

echo "   • Eliminazione price_history..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM price_history 
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" > /dev/null 2>&1

echo "   • Eliminazione symbol_volumes_24h..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM symbol_volumes_24h 
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" > /dev/null 2>&1

echo ""
echo "✅ Eliminazione completata!"
echo ""

# Verifica finale
echo "📊 Verifica finale - simboli rimasti:"
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
    echo "   ⚠️  Ancora presenti $REMAINING_INVALID simboli non validi (verifica manuale necessaria)"
    echo "   ✅ Simboli validi rimasti: $REMAINING_VALID"
fi

echo ""
echo "✅ Script completato"
