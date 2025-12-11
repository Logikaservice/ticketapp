#!/bin/bash
# Script per pulire database VPS dai simboli a basso volume
# Disattiva SHIBA, DOGE, MANA, EOS e attiva AVAX, MATIC

echo "🧹 PULIZIA DATABASE VPS - Rimozione Simboli Basso Volume"
echo "=========================================================="
echo ""

# 1. Disattiva simboli problematici
echo "❌ 1. DISATTIVAZIONE SIMBOLI PROBLEMATICI"
echo "-----------------------------------------"
echo "Disattivando: shiba, dogecoin, mana, eos..."

psql $DATABASE_URL -c "UPDATE crypto_bot_params SET is_active = 0 WHERE symbol IN ('shiba', 'dogecoin', 'mana', 'eos');"

echo "✅ Simboli problematici disattivati"
echo ""

# 2. Verifica che siano disattivati
echo "🔍 2. VERIFICA DISATTIVAZIONE"
echo "-----------------------------"
psql $DATABASE_URL -c "SELECT symbol, is_active FROM crypto_bot_params WHERE symbol IN ('shiba', 'dogecoin', 'mana', 'eos');"
echo ""

# 3. Aggiungi/Attiva AVAX se non esiste
echo "✅ 3. CONFIGURAZIONE AVALANCHE (AVAX)"
echo "-------------------------------------"
psql $DATABASE_URL -c "
INSERT INTO crypto_bot_params (
    symbol, is_active, rsi_period, rsi_oversold, rsi_overbought,
    stop_loss_percent, take_profit_percent, trailing_stop_percent,
    min_signal_strength, min_confirmations_long, min_confirmations_short,
    min_volume_24h, min_atr_pct, max_atr_pct
) VALUES (
    'avalanche', 1, 14, 30, 70,
    3, 15, 4,
    65, 3, 4,
    1000000, 0.2, 5.0
) ON CONFLICT (symbol) DO UPDATE SET
    is_active = 1,
    rsi_oversold = 30,
    rsi_overbought = 70,
    stop_loss_percent = 3,
    take_profit_percent = 15,
    trailing_stop_percent = 4,
    min_signal_strength = 65,
    min_volume_24h = 1000000;
"
echo "✅ AVAX configurato"
echo ""

# 4. Aggiungi/Attiva MATIC se non esiste
echo "✅ 4. CONFIGURAZIONE MATIC"
echo "--------------------------"
psql $DATABASE_URL -c "
INSERT INTO crypto_bot_params (
    symbol, is_active, rsi_period, rsi_oversold, rsi_overbought,
    stop_loss_percent, take_profit_percent, trailing_stop_percent,
    min_signal_strength, min_confirmations_long, min_confirmations_short,
    min_volume_24h, min_atr_pct, max_atr_pct
) VALUES (
    'matic', 1, 14, 30, 70,
    3, 15, 4,
    65, 3, 4,
    1000000, 0.2, 5.0
) ON CONFLICT (symbol) DO UPDATE SET
    is_active = 1,
    rsi_oversold = 30,
    rsi_overbought = 70,
    stop_loss_percent = 3,
    take_profit_percent = 15,
    trailing_stop_percent = 4,
    min_signal_strength = 65,
    min_volume_24h = 1000000;
"
echo "✅ MATIC configurato"
echo ""

# 5. Aggiorna parametri per tutti i simboli attivi
echo "🔧 5. AGGIORNAMENTO PARAMETRI GLOBALI"
echo "--------------------------------------"
echo "Aggiornando RSI oversold a 30 per tutti i simboli attivi..."

psql $DATABASE_URL -c "
UPDATE crypto_bot_params 
SET rsi_oversold = 30,
    rsi_overbought = 70,
    stop_loss_percent = 3,
    take_profit_percent = 15,
    trailing_stop_percent = 4,
    min_signal_strength = 65,
    min_volume_24h = GREATEST(COALESCE(min_volume_24h, 0), 1000000)
WHERE is_active = 1 
  AND symbol NOT IN ('shiba', 'dogecoin', 'mana', 'eos');
"
echo "✅ Parametri aggiornati per tutti i simboli attivi"
echo ""

# 6. Chiudi eventuali posizioni aperte su simboli problematici
echo "🚨 6. CHIUSURA POSIZIONI SU SIMBOLI PROBLEMATICI"
echo "-------------------------------------------------"
echo "Verificando posizioni aperte su shiba, dogecoin, mana, eos..."

OPEN_POSITIONS=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM open_positions WHERE symbol IN ('shiba', 'dogecoin', 'mana', 'eos') AND status = 'open';")

if [ "$OPEN_POSITIONS" -gt 0 ]; then
    echo "⚠️  Trovate $OPEN_POSITIONS posizioni aperte su simboli problematici"
    echo "Chiudendole automaticamente..."
    
    psql $DATABASE_URL -c "
    UPDATE open_positions 
    SET status = 'closed',
        closed_at = NOW(),
        close_reason = 'Simbolo rimosso (basso volume)'
    WHERE symbol IN ('shiba', 'dogecoin', 'mana', 'eos') 
      AND status = 'open';
    "
    echo "✅ Posizioni chiuse"
else
    echo "✅ Nessuna posizione aperta su simboli problematici"
fi
echo ""

# 7. Riepilogo finale
echo "📊 7. RIEPILOGO FINALE"
echo "----------------------"
echo ""
echo "Simboli attivi:"
psql $DATABASE_URL -c "SELECT symbol, min_signal_strength, stop_loss_percent, take_profit_percent, trailing_stop_percent FROM crypto_bot_params WHERE is_active = 1 ORDER BY symbol;"
echo ""

echo "Simboli disattivati:"
psql $DATABASE_URL -c "SELECT symbol FROM crypto_bot_params WHERE is_active = 0 ORDER BY symbol;"
echo ""

echo "✅ PULIZIA COMPLETATA!"
echo ""
echo "Prossimi passi:"
echo "1. Riavvia il backend: pm2 restart all"
echo "2. Verifica Market Scanner (dovrebbe mostrare solo 11 simboli)"
echo "3. Controlla che SHIBA, DOGE, MANA, EOS non appaiano più"
echo ""
