#!/bin/bash
# Script per eliminare tutti i simboli che hanno solo 1 kline (probabilmente dati di test/errati)

echo "🗑️  RIMOZIONE SIMBOLI CON SOLO 1 KLINE"
echo "========================================"
echo ""

echo "📊 Identificazione simboli con solo 1 kline (15m):"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    symbol,
    COUNT(*) as klines_count,
    MIN(open_time) as timestamp
FROM klines 
WHERE interval = '15m'
GROUP BY symbol
HAVING COUNT(*) = 1
ORDER BY symbol;
"

echo ""
echo "📊 Totale simboli da eliminare:"
COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM klines 
WHERE interval = '15m'
GROUP BY symbol
HAVING COUNT(*) = 1;
" | xargs)

echo "   ⚠️  Trovati $COUNT simboli con solo 1 kline"

echo ""
read -p "⚠️  Eliminare TUTTI questi simboli da tutte le tabelle? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "⏭️  Operazione annullata"
    exit 0
fi

echo ""
echo "🔄 Eliminazione in corso..."

# Ottieni lista simboli da eliminare
SYMBOLS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT DISTINCT symbol
FROM klines 
WHERE interval = '15m'
GROUP BY symbol
HAVING COUNT(*) = 1;
" | tr '\n' ',' | sed 's/,$//' | sed "s/'/''/g")

if [ -z "$SYMBOLS" ]; then
    echo "   ✅ Nessun simbolo da eliminare"
    exit 0
fi

# Elimina da tutte le tabelle
echo "   • Eliminazione da bot_settings..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM bot_settings 
WHERE symbol IN (
    SELECT DISTINCT symbol
    FROM klines 
    WHERE interval = '15m'
    GROUP BY symbol
    HAVING COUNT(*) = 1
);
" > /dev/null 2>&1

echo "   • Eliminazione klines (tutti gli intervalli)..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM klines 
WHERE symbol IN (
    SELECT DISTINCT symbol
    FROM klines 
    WHERE interval = '15m'
    GROUP BY symbol
    HAVING COUNT(*) = 1
);
" > /dev/null 2>&1

echo "   • Eliminazione open_positions..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM open_positions 
WHERE symbol IN (
    SELECT DISTINCT symbol
    FROM klines 
    WHERE interval = '15m'
    GROUP BY symbol
    HAVING COUNT(*) = 1
);
" > /dev/null 2>&1

echo "   • Eliminazione trades..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM trades 
WHERE symbol IN (
    SELECT DISTINCT symbol
    FROM klines 
    WHERE interval = '15m'
    GROUP BY symbol
    HAVING COUNT(*) = 1
);
" > /dev/null 2>&1

echo "   • Eliminazione price_history..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM price_history 
WHERE symbol IN (
    SELECT DISTINCT symbol
    FROM klines 
    WHERE interval = '15m'
    GROUP BY symbol
    HAVING COUNT(*) = 1
);
" > /dev/null 2>&1

echo "   • Eliminazione symbol_volumes_24h..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM symbol_volumes_24h 
WHERE symbol IN (
    SELECT DISTINCT symbol
    FROM klines 
    WHERE interval = '15m'
    GROUP BY symbol
    HAVING COUNT(*) = 1
);
" > /dev/null 2>&1

echo ""
echo "✅ Eliminazione completata!"
echo ""

# Verifica finale
echo "📊 Verifica finale - simboli rimasti con 1 kline:"
REMAINING=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM klines 
WHERE interval = '15m'
GROUP BY symbol
HAVING COUNT(*) = 1;
" | xargs)

if [ "$REMAINING" -eq 0 ]; then
    echo "   ✅ Tutti i simboli con 1 kline sono stati eliminati"
else
    echo "   ⚠️  Ancora presenti $REMAINING simboli (verifica manuale necessaria)"
fi

echo ""
echo "✅ Script completato"
