#!/bin/bash
# Script per verificare trade_size_usdt sulla VPS
# Esegui con: bash check-trade-size-vps.sh

echo "🔍 Verifica trade_size_usdt nel database..."
echo ""

# Prova prima con crypto_db (database crypto)
echo "📊 Tentativo 1: Database 'crypto_db'"
sudo -u postgres psql crypto_db -c "SELECT strategy_name, symbol, parameters::json->>'trade_size_usdt' as trade_size_usdt, parameters::json->>'trade_size_eur' as trade_size_eur, parameters::json->>'max_exposure_pct' as max_exposure_pct FROM bot_settings WHERE parameters IS NOT NULL ORDER BY strategy_name, symbol;" 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database 'crypto_db' trovato!"
    echo ""
    echo "📌 Configurazione globale:"
    sudo -u postgres psql crypto_db -c "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global';" 2>&1
    exit 0
fi

echo ""
echo "📊 Tentativo 2: Database 'ticketapp'"
sudo -u postgres psql ticketapp -c "SELECT strategy_name, symbol, parameters::json->>'trade_size_usdt' as trade_size_usdt, parameters::json->>'trade_size_eur' as trade_size_eur, parameters::json->>'max_exposure_pct' as max_exposure_pct FROM bot_settings WHERE parameters IS NOT NULL ORDER BY strategy_name, symbol;" 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database 'ticketapp' trovato!"
    echo ""
    echo "📌 Configurazione globale:"
    sudo -u postgres psql ticketapp -c "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global';" 2>&1
    exit 0
fi

echo ""
echo "❌ Nessun database trovato. Elenco database disponibili:"
sudo -u postgres psql -l 2>&1 | grep -E "Name|----|ticketapp|crypto"
