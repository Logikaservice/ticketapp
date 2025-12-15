#!/bin/bash
# Script per eliminare tutti i simboli che NON sono nella lista valida
# I simboli validi sono quelli presenti in SYMBOL_TO_PAIR o in bot_settings attivi

echo "🗑️  RIMOZIONE SIMBOLI NON CONFIGURATI"
echo "======================================"
echo ""

# Lista simboli validi (estratti da SYMBOL_TO_PAIR in TradingBot.js)
# Questi sono i simboli che DOVREBBERO esistere nel sistema
VALID_SYMBOLS=(
    'bitcoin' 'btc' 'bitcoin_usdt' 'btcusdt'
    'ethereum' 'eth' 'ethereum_usdt' 'ethusdt'
    'solana' 'sol' 'solana_eur' 'solana_usdt' 'solusdt'
    'cardano' 'ada' 'cardano_usdt' 'adausdt'
    'ripple' 'xrp' 'ripple_eur' 'ripple_usdt' 'xrpusdt'
    'polkadot' 'dot' 'polkadot_usdt' 'dotusdt'
    'dogecoin' 'doge' 'dogeusdt'
    'shiba_inu' 'shib' 'shibusdt'
    'avalanche' 'avax' 'avalanche_eur' 'avax_usdt' 'avaxusdt'
    'binance_coin' 'bnb' 'binance_coin_eur' 'bnbusdt'
    'chainlink' 'link' 'chainlink_usdt' 'linkusdt'
    'polygon' 'matic' 'pol' 'pol_polygon' 'pol_polygon_eur' 'maticusdt' 'polusdt'
    'uniswap' 'uni' 'uniusdt'
    # NOTA: uniswap_eur rimosso - non disponibile su Binance
    'aave' 'aaveusdt'
    'curve' 'crv' 'crvusdt'
    'the_sandbox' 'sand' 'sandusdt' 'thesandbox'
    'axie_infinity' 'axs' 'axsusdt' 'axieinfinity'
    'decentraland' 'mana' 'manausdt'
    'gala' 'galausdt'
    'immutable' 'imx' 'imxusdt'
    'enjin' 'enj' 'enjusdt'
    'render' 'renderusdt' 'rndr'
    'theta_network' 'theta' 'thetausdt' 'thetanetwork'
    'near' 'nearusdt'
    'optimism' 'op' 'opusdt'
    'sei' 'seiusdt'
    'filecoin' 'fil' 'filusdt'
    'bonk' 'bonkusdt'
    'floki' 'flokiusdt'
    'ton' 'toncoin' 'tonusdt'
    'tron' 'trx' 'trxusdt'
    'stellar' 'xlm' 'xlmusdt'
    'ripple_xrp' 'xrp_eur'
    'cosmos' 'atom' 'atomusdt'
    'icp' 'icpusdt'
    'flow' 'flowusdt'
    'pepe' 'pepeusdt'
    'shiba' 'shiba_eur'
    'sui' 'sui_eur'
    'apt'
    'ldo'
    'snx'
    'fet'
    'usdc'
    'ltc'
)

# Aggiungi anche simboli presenti in bot_settings (potrebbero esserci altri validi)
echo "📊 Recupero simboli validi da bot_settings..."
BOT_SETTINGS_SYMBOLS=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT DISTINCT symbol 
FROM bot_settings 
WHERE symbol IS NOT NULL;
" | xargs)

# Combina le liste
ALL_VALID_SYMBOLS=("${VALID_SYMBOLS[@]}")
for SYMBOL in $BOT_SETTINGS_SYMBOLS; do
    # Aggiungi solo se non è già presente
    if [[ ! " ${ALL_VALID_SYMBOLS[@]} " =~ " ${SYMBOL} " ]]; then
        ALL_VALID_SYMBOLS+=("$SYMBOL")
    fi
done

echo "   ✅ Trovati ${#ALL_VALID_SYMBOLS[@]} simboli validi"
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
    if [[ ! " ${ALL_VALID_SYMBOLS[@]} " =~ " ${DB_SYMBOL} " ]]; then
        SYMBOLS_TO_REMOVE+=("$DB_SYMBOL")
    fi
done

if [ ${#SYMBOLS_TO_REMOVE[@]} -eq 0 ]; then
    echo "✅ Nessun simbolo da eliminare - tutti i simboli sono validi"
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
read -p "⚠️  Eliminare TUTTI questi simboli? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "⏭️  Operazione annullata"
    exit 0
fi

echo ""
echo "🔄 Eliminazione in corso..."

# Elimina ogni simbolo
for SYMBOL in "${SYMBOLS_TO_REMOVE[@]}"; do
    echo "   • Eliminazione $SYMBOL..."
    
    sudo -u postgres psql -d crypto_db -c "DELETE FROM bot_settings WHERE symbol = '$SYMBOL';" > /dev/null 2>&1
    sudo -u postgres psql -d crypto_db -c "DELETE FROM klines WHERE symbol = '$SYMBOL';" > /dev/null 2>&1
    sudo -u postgres psql -d crypto_db -c "DELETE FROM open_positions WHERE symbol = '$SYMBOL';" > /dev/null 2>&1
    sudo -u postgres psql -d crypto_db -c "DELETE FROM trades WHERE symbol = '$SYMBOL';" > /dev/null 2>&1
    sudo -u postgres psql -d crypto_db -c "DELETE FROM price_history WHERE symbol = '$SYMBOL';" > /dev/null 2>&1
    sudo -u postgres psql -d crypto_db -c "DELETE FROM symbol_volumes_24h WHERE symbol = '$SYMBOL';" > /dev/null 2>&1
done

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
echo ""
echo "✅ Script completato"
