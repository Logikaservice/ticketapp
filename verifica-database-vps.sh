#!/bin/bash
# Script per verificare configurazione database VPS
# Controlla simboli, parametri bot e configurazione

echo "🔍 VERIFICA CONFIGURAZIONE DATABASE VPS"
echo "========================================"
echo ""

# 1. Verifica simboli nel database
echo "📊 1. SIMBOLI NEL DATABASE (crypto_bot_params)"
echo "------------------------------------------------"
psql $DATABASE_URL -c "SELECT symbol, is_active, min_signal_strength, stop_loss_percent, take_profit_percent, trailing_stop_percent FROM crypto_bot_params ORDER BY symbol;"
echo ""

# 2. Conta simboli attivi
echo "📈 2. CONTEGGIO SIMBOLI ATTIVI"
echo "------------------------------"
psql $DATABASE_URL -c "SELECT COUNT(*) as total_symbols, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_symbols FROM crypto_bot_params;"
echo ""

# 3. Verifica simboli problematici (SHIBA, DOGE, MANA, EOS)
echo "⚠️  3. VERIFICA SIMBOLI PROBLEMATICI (dovrebbero essere 0)"
echo "-----------------------------------------------------------"
psql $DATABASE_URL -c "SELECT symbol, is_active FROM crypto_bot_params WHERE symbol IN ('shiba', 'dogecoin', 'mana', 'eos');"
echo ""

# 4. Verifica nuovi simboli (AVAX, MATIC)
echo "✅ 4. VERIFICA NUOVI SIMBOLI (AVAX, MATIC)"
echo "------------------------------------------"
psql $DATABASE_URL -c "SELECT symbol, is_active, min_signal_strength FROM crypto_bot_params WHERE symbol IN ('avalanche', 'matic');"
echo ""

# 5. Verifica parametri RSI
echo "🎯 5. PARAMETRI RSI (dovrebbero essere: oversold=30, overbought=70)"
echo "--------------------------------------------------------------------"
psql $DATABASE_URL -c "SELECT symbol, rsi_oversold, rsi_overbought, rsi_period FROM crypto_bot_params WHERE symbol = 'bitcoin';"
echo ""

# 6. Verifica parametri Stop Loss / Take Profit
echo "🛡️  6. PARAMETRI SL/TP (SL=3%, TP=15%, TS=4%)"
echo "----------------------------------------------"
psql $DATABASE_URL -c "SELECT symbol, stop_loss_percent, take_profit_percent, trailing_stop_percent FROM crypto_bot_params WHERE symbol = 'bitcoin';"
echo ""

# 7. Verifica volume minimo
echo "💰 7. VOLUME MINIMO 24H (dovrebbe essere >= 1000000)"
echo "-----------------------------------------------------"
psql $DATABASE_URL -c "SELECT symbol, min_volume_24h FROM crypto_bot_params WHERE symbol = 'bitcoin';"
echo ""

# 8. Lista completa simboli ordinati per volume
echo "📋 8. LISTA COMPLETA SIMBOLI (ordinati per min_volume_24h)"
echo "-----------------------------------------------------------"
psql $DATABASE_URL -c "SELECT symbol, is_active, min_volume_24h, min_signal_strength FROM crypto_bot_params ORDER BY min_volume_24h DESC NULLS LAST;"
echo ""

# 9. Verifica posizioni aperte su simboli problematici
echo "🚨 9. POSIZIONI APERTE SU SIMBOLI PROBLEMATICI"
echo "-----------------------------------------------"
psql $DATABASE_URL -c "SELECT ticket_id, symbol, type, volume, entry_price, current_price, profit_loss_pct, status FROM open_positions WHERE symbol IN ('shiba', 'dogecoin', 'mana', 'eos') AND status = 'open';"
echo ""

# 10. Riepilogo finale
echo "✅ 10. RIEPILOGO FINALE"
echo "----------------------"
echo "Se tutto è corretto, dovresti vedere:"
echo "  - 0 simboli problematici (shiba, dogecoin, mana, eos)"
echo "  - 11 simboli totali (bitcoin, ethereum, binance_coin, solana, cardano, ripple, polkadot, chainlink, litecoin, avalanche, matic)"
echo "  - RSI oversold = 30, overbought = 70"
echo "  - Stop Loss = 3%, Take Profit = 15%, Trailing Stop = 4%"
echo "  - Volume minimo 24h >= 1000000"
echo ""
echo "🎯 Verifica completata!"
