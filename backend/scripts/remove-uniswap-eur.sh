#!/bin/bash
# Script per eliminare completamente uniswap_eur dal database

echo "🗑️  RIMOZIONE COMPLETA UNISWAP_EUR"
echo "==================================="
echo ""

# Verifica situazione prima della rimozione
echo "📊 1. Verifica situazione attuale:"
sudo -u postgres psql -d crypto_db -c "
SELECT symbol, is_active,
       CASE WHEN is_active = 1 THEN '✅ ATTIVO' ELSE '❌ NON ATTIVO' END as stato
FROM bot_settings 
WHERE symbol = 'uniswap_eur';
"

echo ""
echo "📊 2. Verifica posizioni aperte per uniswap_eur:"
POSIZIONI=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) 
FROM open_positions 
WHERE symbol = 'uniswap_eur' AND status = 'open';
" | xargs)

if [ "$POSIZIONI" -gt 0 ]; then
    echo "   ⚠️  ATTENZIONE: Ci sono $POSIZIONI posizioni aperte per uniswap_eur!"
    echo "   Mostro dettagli:"
    sudo -u postgres psql -d crypto_db -c "
    SELECT ticket_id, symbol, type, volume, entry_price, status
    FROM open_positions 
    WHERE symbol = 'uniswap_eur' AND status = 'open';
    "
    echo ""
    read -p "Vuoi procedere comunque? Le posizioni rimarranno orfane. (s/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo "⏭️  Operazione annullata"
        exit 0
    fi
else
    echo "   ✅ Nessuna posizione aperta per uniswap_eur"
fi

echo ""
echo "📊 3. Verifica klines per uniswap_eur:"
KLINES=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) 
FROM klines 
WHERE symbol = 'uniswap_eur';
" | xargs)

if [ "$KLINES" -gt 0 ]; then
    echo "   ⚠️  Ci sono $KLINES klines per uniswap_eur"
    echo "   (Verranno eliminate insieme alla configurazione)"
else
    echo "   ✅ Nessuna kline per uniswap_eur"
fi

echo ""
echo "📊 4. Verifica altri dati per uniswap_eur:"
TRADES=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) 
FROM trades 
WHERE symbol = 'uniswap_eur';
" | xargs)

PRICE_HISTORY=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) 
FROM price_history 
WHERE symbol = 'uniswap_eur';
" | xargs)

VOLUMES=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) 
FROM symbol_volumes_24h 
WHERE symbol = 'uniswap_eur';
" | xargs)

echo "   • Trades: $TRADES"
echo "   • Price history: $PRICE_HISTORY"
echo "   • Volumes 24h: $VOLUMES"

echo ""
read -p "⚠️  Sei sicuro di voler ELIMINARE completamente 'uniswap_eur'? (s/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo ""
    echo "🔄 Eliminazione in corso..."
    
    # 1. Elimina da bot_settings
    echo "   • Eliminazione da bot_settings..."
    sudo -u postgres psql -d crypto_db -c "
    DELETE FROM bot_settings 
    WHERE symbol = 'uniswap_eur' AND strategy_name = 'RSI_Strategy';
    "
    
    # 2. Elimina klines (se presenti)
    if [ "$KLINES" -gt 0 ]; then
        echo "   • Eliminazione klines..."
        sudo -u postgres psql -d crypto_db -c "
        DELETE FROM klines WHERE symbol = 'uniswap_eur';
        "
    fi
    
    # 3. Elimina trades (se presenti)
    if [ "$TRADES" -gt 0 ]; then
        echo "   • Eliminazione trades..."
        sudo -u postgres psql -d crypto_db -c "
        DELETE FROM trades WHERE symbol = 'uniswap_eur';
        "
    fi
    
    # 4. Elimina price_history (se presente)
    if [ "$PRICE_HISTORY" -gt 0 ]; then
        echo "   • Eliminazione price_history..."
        sudo -u postgres psql -d crypto_db -c "
        DELETE FROM price_history WHERE symbol = 'uniswap_eur';
        "
    fi
    
    # 5. Elimina symbol_volumes_24h (se presente)
    if [ "$VOLUMES" -gt 0 ]; then
        echo "   • Eliminazione symbol_volumes_24h..."
        sudo -u postgres psql -d crypto_db -c "
        DELETE FROM symbol_volumes_24h WHERE symbol = 'uniswap_eur';
        "
    fi
    
    # 6. Verifica che uniswap (senza _eur) sia attivo
    
    echo "   • Verifica che 'uniswap' (senza _eur) sia attivo..."
    UNISWAP_EXISTS=$(sudo -u postgres psql -d crypto_db -t -c "
    SELECT COUNT(*) FROM bot_settings WHERE symbol = 'uniswap' AND strategy_name = 'RSI_Strategy';
    " | xargs)
    
    if [ "$UNISWAP_EXISTS" -gt 0 ]; then
        sudo -u postgres psql -d crypto_db -c "
        UPDATE bot_settings 
        SET is_active = 1 
        WHERE symbol = 'uniswap' AND strategy_name = 'RSI_Strategy';
        "
        echo "   ✅ 'uniswap' attivato"
    else
        echo "   ⚠️  'uniswap' non trovato in bot_settings"
    fi
    
    echo ""
    echo "✅ Eliminazione completata!"
    echo ""
    echo "📊 Configurazione finale simboli Uniswap:"
    sudo -u postgres psql -d crypto_db -c "
    SELECT symbol, is_active,
           CASE WHEN is_active = 1 THEN '✅ ATTIVO' ELSE '❌ NON ATTIVO' END as stato
    FROM bot_settings 
    WHERE symbol LIKE '%uniswap%' OR symbol LIKE '%uni%'
    ORDER BY symbol;
    "
    
    echo ""
    echo "📊 Klines rimanenti per Uniswap:"
    sudo -u postgres psql -d crypto_db -c "
    SELECT symbol, COUNT(*) as klines_count
    FROM klines 
    WHERE symbol LIKE '%uniswap%' OR symbol LIKE '%uni%'
    GROUP BY symbol
    ORDER BY symbol;
    "
else
    echo "⏭️  Operazione annullata"
fi

echo ""
echo "✅ Script completato"
