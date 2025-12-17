#!/bin/bash
# Script per verificare che nel database ci siano SOLO simboli validi

echo "🔍 VERIFICA SIMBOLI NEL DATABASE"
echo "================================="
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
echo "📊 Simboli validi definiti: $VALID_COUNT"
echo ""

# Verifica simboli nel database
echo "📊 Verifica simboli nel database..."
echo ""

# 1. Klines
echo "   • Klines:"
TOTAL_KLINES=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol) as total
FROM klines;
" | xargs)

INVALID_KLINES=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM klines
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)

VALID_KLINES=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM klines
WHERE symbol IN ($VALID_SYMBOLS_JSON);
" | xargs)

echo "      Totale: $TOTAL_KLINES simboli"
echo "      ✅ Valid: $VALID_KLINES"
if [ "$INVALID_KLINES" -gt 0 ]; then
    echo "      ❌ Invalid: $INVALID_KLINES"
    echo "      Simboli non validi:"
    sudo -u postgres psql -d crypto_db -t -c "
    SELECT DISTINCT symbol
    FROM klines
    WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    ORDER BY symbol;
    " | sed 's/^/         - /'
else
    echo "      ✅ Nessun simbolo non valido"
fi

echo ""

# 2. Bot settings
echo "   • Bot settings:"
TOTAL_SETTINGS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol) as total
FROM bot_settings;
" | xargs)

INVALID_SETTINGS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM bot_settings
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)

VALID_SETTINGS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM bot_settings
WHERE symbol IN ($VALID_SYMBOLS_JSON);
" | xargs)

echo "      Totale: $TOTAL_SETTINGS simboli"
echo "      ✅ Valid: $VALID_SETTINGS"
if [ "$INVALID_SETTINGS" -gt 0 ]; then
    echo "      ❌ Invalid: $INVALID_SETTINGS"
    echo "      Simboli non validi:"
    sudo -u postgres psql -d crypto_db -t -c "
    SELECT DISTINCT symbol
    FROM bot_settings
    WHERE symbol NOT IN ($VALID_SYMBOLS_JSON)
    ORDER BY symbol;
    " | sed 's/^/         - /'
else
    echo "      ✅ Nessun simbolo non valido"
fi

echo ""

# 3. Open positions
echo "   • Open positions:"
TOTAL_POSITIONS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol) as total
FROM open_positions;
" | xargs)

INVALID_POSITIONS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM open_positions
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)

if [ "$TOTAL_POSITIONS" -gt 0 ]; then
    echo "      Totale: $TOTAL_POSITIONS simboli"
    if [ "$INVALID_POSITIONS" -gt 0 ]; then
        echo "      ❌ Invalid: $INVALID_POSITIONS"
    else
        echo "      ✅ Nessun simbolo non valido"
    fi
else
    echo "      ✅ Nessuna posizione aperta"
fi

echo ""

# 4. Trades
echo "   • Trades:"
TOTAL_TRADES=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol) as total
FROM trades;
" | xargs)

INVALID_TRADES=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM trades
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)

if [ "$TOTAL_TRADES" -gt 0 ]; then
    echo "      Totale: $TOTAL_TRADES simboli"
    if [ "$INVALID_TRADES" -gt 0 ]; then
        echo "      ❌ Invalid: $INVALID_TRADES"
    else
        echo "      ✅ Nessun simbolo non valido"
    fi
else
    echo "      ✅ Nessun trade"
fi

echo ""

# 5. Price history
echo "   • Price history:"
TOTAL_PRICE=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol) as total
FROM price_history;
" | xargs)

INVALID_PRICE=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM price_history
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)

if [ "$TOTAL_PRICE" -gt 0 ]; then
    echo "      Totale: $TOTAL_PRICE simboli"
    if [ "$INVALID_PRICE" -gt 0 ]; then
        echo "      ❌ Invalid: $INVALID_PRICE"
    else
        echo "      ✅ Nessun simbolo non valido"
    fi
else
    echo "      ✅ Nessuna entry"
fi

echo ""

# 6. Symbol volumes
echo "   • Symbol volumes 24h:"
TOTAL_VOLUMES=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol) as total
FROM symbol_volumes_24h;
" | xargs)

INVALID_VOLUMES=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM symbol_volumes_24h
WHERE symbol NOT IN ($VALID_SYMBOLS_JSON);
" | xargs)

if [ "$TOTAL_VOLUMES" -gt 0 ]; then
    echo "      Totale: $TOTAL_VOLUMES simboli"
    if [ "$INVALID_VOLUMES" -gt 0 ]; then
        echo "      ❌ Invalid: $INVALID_VOLUMES"
    else
        echo "      ✅ Nessun simbolo non valido"
    fi
else
    echo "      ✅ Nessuna entry"
fi

echo ""

# Riepilogo finale
TOTAL_INVALID=$((INVALID_KLINES + INVALID_SETTINGS + INVALID_POSITIONS + INVALID_TRADES + INVALID_PRICE + INVALID_VOLUMES))

echo "================================="
if [ "$TOTAL_INVALID" -eq 0 ]; then
    echo "✅ TUTTI I SIMBOLI NEL DATABASE SONO VALIDI"
    echo ""
    echo "📊 Riepilogo:"
    echo "   • Simboli validi definiti: $VALID_COUNT"
    echo "   • Simboli validi in klines: $VALID_KLINES"
    echo "   • Simboli validi in bot_settings: $VALID_SETTINGS"
else
    echo "⚠️  ANCORA PRESENTI SIMBOLI NON VALIDI"
    echo ""
    echo "   Totale simboli non validi trovati: $TOTAL_INVALID"
fi
echo ""
