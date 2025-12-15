#!/bin/bash
# Script per eliminare tutti i simboli NON presenti nella lista valida
# Mantiene solo i simboli definiti in SYMBOL_TO_PAIR

echo "🗑️  RIMOZIONE SIMBOLI NON VALIDI"
echo "=================================="
echo ""

# Lista simboli VALIDI (estratti da SYMBOL_TO_PAIR in TradingBot.js)
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
)

# Crea lista SQL per IN clause
VALID_SYMBOLS_SQL=$(printf "'%s'," "${VALID_SYMBOLS[@]}" | sed 's/,$//')

echo "📊 Simboli validi: ${#VALID_SYMBOLS[@]}"
echo ""

# Trova tutti i simboli nel database
echo "📊 Identificazione simboli nel database..."
echo ""

echo "   • Simboli in klines:"
sudo -u postgres psql -d crypto_db -c "
SELECT COUNT(DISTINCT symbol) as total_symbols
FROM klines;
"

echo ""
echo "   • Simboli NON validi in klines (da eliminare):"
sudo -u postgres psql -d crypto_db -c "
SELECT DISTINCT symbol
FROM klines
WHERE symbol NOT IN ($VALID_SYMBOLS_SQL)
ORDER BY symbol;
"

INVALID_COUNT=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM klines
WHERE symbol NOT IN ($VALID_SYMBOLS_SQL);
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
WHERE symbol NOT IN ($VALID_SYMBOLS_SQL);
" > /dev/null 2>&1

echo "   • Eliminazione klines (tutti gli intervalli)..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM klines 
WHERE symbol NOT IN ($VALID_SYMBOLS_SQL);
" > /dev/null 2>&1

echo "   • Eliminazione open_positions..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM open_positions 
WHERE symbol NOT IN ($VALID_SYMBOLS_SQL);
" > /dev/null 2>&1

echo "   • Eliminazione trades..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM trades 
WHERE symbol NOT IN ($VALID_SYMBOLS_SQL);
" > /dev/null 2>&1

echo "   • Eliminazione price_history..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM price_history 
WHERE symbol NOT IN ($VALID_SYMBOLS_SQL);
" > /dev/null 2>&1

echo "   • Eliminazione symbol_volumes_24h..."
sudo -u postgres psql -d crypto_db -c "
DELETE FROM symbol_volumes_24h 
WHERE symbol NOT IN ($VALID_SYMBOLS_SQL);
" > /dev/null 2>&1

echo ""
echo "✅ Eliminazione completata!"
echo ""

# Verifica finale
echo "📊 Verifica finale - simboli rimasti:"
REMAINING_INVALID=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(DISTINCT symbol)
FROM klines
WHERE symbol NOT IN ($VALID_SYMBOLS_SQL);
" | xargs)

if [ "$REMAINING_INVALID" -eq 0 ]; then
    echo "   ✅ Tutti i simboli non validi sono stati eliminati"
    echo ""
    echo "   📊 Simboli validi rimasti in klines:"
    sudo -u postgres psql -d crypto_db -c "
    SELECT COUNT(DISTINCT symbol) as valid_symbols_count
    FROM klines
    WHERE symbol IN ($VALID_SYMBOLS_SQL);
    "
else
    echo "   ⚠️  Ancora presenti $REMAINING_INVALID simboli non validi (verifica manuale necessaria)"
fi

echo ""
echo "✅ Script completato"
