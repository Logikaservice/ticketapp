#!/bin/bash
# Script per eliminare completamente uniswap_eur dal database
# Eseguibile direttamente via SSH

SYMBOL="uniswap_eur"

echo "🗑️  RIMOZIONE COMPLETA $SYMBOL"
echo "==================================="
echo ""

# Mostra situazione prima della rimozione
echo "📊 Situazione attuale:"
echo "   • bot_settings:"
sudo -u postgres psql -d crypto_db -t -c "SELECT COUNT(*) FROM bot_settings WHERE symbol = '$SYMBOL';" | xargs -I {} echo "      {} record"
echo "   • klines:"
sudo -u postgres psql -d crypto_db -t -c "SELECT COUNT(*) FROM klines WHERE symbol = '$SYMBOL';" | xargs -I {} echo "      {} record"
echo "   • open_positions:"
sudo -u postgres psql -d crypto_db -t -c "SELECT COUNT(*) FROM open_positions WHERE symbol = '$SYMBOL';" | xargs -I {} echo "      {} record"
echo "   • trades:"
sudo -u postgres psql -d crypto_db -t -c "SELECT COUNT(*) FROM trades WHERE symbol = '$SYMBOL';" | xargs -I {} echo "      {} record"
echo "   • price_history:"
sudo -u postgres psql -d crypto_db -t -c "SELECT COUNT(*) FROM price_history WHERE symbol = '$SYMBOL';" | xargs -I {} echo "      {} record"
echo "   • symbol_volumes_24h:"
sudo -u postgres psql -d crypto_db -t -c "SELECT COUNT(*) FROM symbol_volumes_24h WHERE symbol = '$SYMBOL';" | xargs -I {} echo "      {} record"

echo ""
read -p "⚠️  Eliminare TUTTI i dati di $SYMBOL? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "⏭️  Operazione annullata"
    exit 0
fi

echo ""
echo "🔄 Eliminazione in corso..."

# Elimina da tutte le tabelle
echo "   • Eliminazione da bot_settings..."
sudo -u postgres psql -d crypto_db -c "DELETE FROM bot_settings WHERE symbol = '$SYMBOL';" > /dev/null 2>&1

echo "   • Eliminazione klines (tutti gli intervalli)..."
sudo -u postgres psql -d crypto_db -c "DELETE FROM klines WHERE symbol = '$SYMBOL';" > /dev/null 2>&1

echo "   • Eliminazione open_positions..."
sudo -u postgres psql -d crypto_db -c "DELETE FROM open_positions WHERE symbol = '$SYMBOL';" > /dev/null 2>&1

echo "   • Eliminazione trades..."
sudo -u postgres psql -d crypto_db -c "DELETE FROM trades WHERE symbol = '$SYMBOL';" > /dev/null 2>&1

echo "   • Eliminazione price_history..."
sudo -u postgres psql -d crypto_db -c "DELETE FROM price_history WHERE symbol = '$SYMBOL';" > /dev/null 2>&1

echo "   • Eliminazione symbol_volumes_24h..."
sudo -u postgres psql -d crypto_db -c "DELETE FROM symbol_volumes_24h WHERE symbol = '$SYMBOL';" > /dev/null 2>&1

# Attiva uniswap se esiste
echo "   • Verifica 'uniswap' (senza _eur)..."
UNISWAP_EXISTS=$(sudo -u postgres psql -d crypto_db -t -c "SELECT COUNT(*) FROM bot_settings WHERE symbol = 'uniswap' AND strategy_name = 'RSI_Strategy';" | xargs)

if [ "$UNISWAP_EXISTS" -gt 0 ]; then
    sudo -u postgres psql -d crypto_db -c "UPDATE bot_settings SET is_active = 1 WHERE symbol = 'uniswap' AND strategy_name = 'RSI_Strategy';" > /dev/null 2>&1
    echo "      ✅ 'uniswap' attivato"
else
    echo "      ⚠️  'uniswap' non trovato"
fi

echo ""
echo "✅ Eliminazione completata!"
echo ""

# Verifica finale
echo "📊 Verifica finale:"
TOTAL=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT 
    (SELECT COUNT(*) FROM bot_settings WHERE symbol = '$SYMBOL') +
    (SELECT COUNT(*) FROM klines WHERE symbol = '$SYMBOL') +
    (SELECT COUNT(*) FROM open_positions WHERE symbol = '$SYMBOL') +
    (SELECT COUNT(*) FROM trades WHERE symbol = '$SYMBOL') +
    (SELECT COUNT(*) FROM price_history WHERE symbol = '$SYMBOL') +
    (SELECT COUNT(*) FROM symbol_volumes_24h WHERE symbol = '$SYMBOL');
" | xargs)

if [ "$TOTAL" -eq 0 ]; then
    echo "   ✅ $SYMBOL completamente rimosso dal database"
else
    echo "   ⚠️  Ancora presenti $TOTAL record (verifica manuale necessaria)"
fi

echo ""
echo "✅ Script completato"
