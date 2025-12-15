#!/bin/bash
# Script per eliminare tutti i simboli tranne quelli nella lista valida
# Lista esatta dei 45 simboli da conservare (da bot_settings attivi)

echo "🗑️  RIMOZIONE SIMBOLI - CONSERVA SOLO I 45 VALIDI"
echo "=================================================="
echo ""

# Lista ESATTA dei 45 simboli da conservare (da bot_settings attivi)
VALID_SYMBOLS=(
    'aave'
    'ada'
    'avalanche_eur'
    'avax_usdt'
    'axie_infinity'
    'axs'
    'binance_coin_eur'
    'bitcoin'
    'bnb'
    'bonk'
    'cardano_usdt'
    'chainlink'
    'chainlink_usdt'
    'cosmos'
    'crv'
    'decentraland'
    'doge'
    'dot'
    'enj'
    'ethereum_usdt'
    'fil'
    'floki'
    'gala'
    'global'
    'imx'
    'litecoin'
    'mana'
    'near'
    'op'
    'optimism'
    'polkadot_usdt'
    'pol_polygon_eur'
    'polygon'
    'render'
    'ripple_eur'
    'sand'
    'sei'
    'solana_eur'
    'stellar'
    'the_sandbox'
    'tron'
    'trx_eur'
    'xlm'
    'xlm_eur'
    'xrp'
)

echo "📋 Simboli da CONSERVARE: ${#VALID_SYMBOLS[@]}"
echo ""

# Trova tutti i simboli nel database
echo "📊 Recupero tutti i simboli dal database..."
ALL_DB_SYMBOLS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT DISTINCT symbol 
FROM (
    SELECT symbol FROM klines
    UNION
    SELECT symbol FROM bot_settings
    UNION
    SELECT symbol FROM trades
    UNION
    SELECT symbol FROM price_history
    UNION
    SELECT symbol FROM symbol_volumes_24h
    UNION
    SELECT symbol FROM open_positions
) AS all_symbols
WHERE symbol IS NOT NULL
ORDER BY symbol;
" | xargs)

# Trova simboli da eliminare (presenti nel DB ma non nella lista valida)
SYMBOLS_TO_REMOVE=()
for DB_SYMBOL in $ALL_DB_SYMBOLS; do
    if [[ ! " ${VALID_SYMBOLS[@]} " =~ " ${DB_SYMBOL} " ]]; then
        SYMBOLS_TO_REMOVE+=("$DB_SYMBOL")
    fi
done

if [ ${#SYMBOLS_TO_REMOVE[@]} -eq 0 ]; then
    echo "✅ Nessun simbolo da eliminare - tutti i simboli sono nella lista valida"
    exit 0
fi

echo "⚠️  Trovati ${#SYMBOLS_TO_REMOVE[@]} simboli da eliminare:"
for SYMBOL in "${SYMBOLS_TO_REMOVE[@]}"; do
    # Conta record per questo simbolo
    TOTAL=$(sudo -u postgres psql -d crypto_db -t -c "
    SELECT 
        (SELECT COUNT(*) FROM bot_settings WHERE symbol = '$SYMBOL') +
        (SELECT COUNT(*) FROM klines WHERE symbol = '$SYMBOL') +
        (SELECT COUNT(*) FROM open_positions WHERE symbol = '$SYMBOL') +
        (SELECT COUNT(*) FROM trades WHERE symbol = '$SYMBOL') +
        (SELECT COUNT(*) FROM price_history WHERE symbol = '$SYMBOL') +
        (SELECT COUNT(*) FROM symbol_volumes_24h WHERE symbol = '$SYMBOL');
    " | xargs)
    echo "   • $SYMBOL ($TOTAL record totali)"
done

echo ""
TOTAL_RECORDS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT 
    (SELECT COUNT(*) FROM bot_settings WHERE symbol = ANY(ARRAY[$(printf "'%s'," "${SYMBOLS_TO_REMOVE[@]}" | sed 's/,$//')])) +
    (SELECT COUNT(*) FROM klines WHERE symbol = ANY(ARRAY[$(printf "'%s'," "${SYMBOLS_TO_REMOVE[@]}" | sed 's/,$//')])) +
    (SELECT COUNT(*) FROM open_positions WHERE symbol = ANY(ARRAY[$(printf "'%s'," "${SYMBOLS_TO_REMOVE[@]}" | sed 's/,$//')])) +
    (SELECT COUNT(*) FROM trades WHERE symbol = ANY(ARRAY[$(printf "'%s'," "${SYMBOLS_TO_REMOVE[@]}" | sed 's/,$//')])) +
    (SELECT COUNT(*) FROM price_history WHERE symbol = ANY(ARRAY[$(printf "'%s'," "${SYMBOLS_TO_REMOVE[@]}" | sed 's/,$//')])) +
    (SELECT COUNT(*) FROM symbol_volumes_24h WHERE symbol = ANY(ARRAY[$(printf "'%s'," "${SYMBOLS_TO_REMOVE[@]}" | sed 's/,$//')]));
" | xargs)

echo "📊 TOTALE RECORD DA ELIMINARE: $TOTAL_RECORDS"
echo ""

read -p "⚠️  Eliminare TUTTI questi simboli? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "⏭️  Operazione annullata"
    exit 0
fi

echo ""
echo "🔄 Eliminazione in corso..."

# Crea array SQL per IN clause
SYMBOLS_SQL=$(printf "'%s'," "${SYMBOLS_TO_REMOVE[@]}" | sed 's/,$//')

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
echo "   Eliminati ${#SYMBOLS_TO_REMOVE[@]} simboli"
echo ""

# Verifica finale
echo "📊 Verifica finale - simboli rimanenti:"
REMAINING=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM (
    SELECT symbol FROM klines
    UNION
    SELECT symbol FROM bot_settings
) AS all_symbols;
" | xargs)

echo "   ✅ Simboli rimanenti nel database: $REMAINING"
echo "   ✅ Simboli attesi: ${#VALID_SYMBOLS[@]}"
echo ""

# Mostra simboli rimanenti
echo "📋 Simboli rimanenti:"
sudo -u postgres psql -d crypto_db -t -c "
SELECT DISTINCT symbol
FROM (
    SELECT symbol FROM klines
    UNION
    SELECT symbol FROM bot_settings
) AS all_symbols
ORDER BY symbol;
"

echo ""
echo "✅ Script completato"
