#!/bin/bash
# Script per eliminare completamente bitcoin_usdt dal database

echo "🗑️  RIMOZIONE COMPLETA BITCOIN_USDT"
echo "===================================="
echo ""

# Verifica situazione prima della rimozione
echo "📊 1. Verifica situazione attuale:"
sudo -u postgres psql -d crypto_db -c "
SELECT symbol, is_active,
       CASE WHEN is_active = 1 THEN '✅ ATTIVO' ELSE '❌ NON ATTIVO' END as stato
FROM bot_settings 
WHERE symbol IN ('bitcoin', 'bitcoin_usdt')
ORDER BY symbol;
"

echo ""
echo "📊 2. Verifica posizioni aperte per bitcoin_usdt:"
POSIZIONI=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) 
FROM open_positions 
WHERE symbol = 'bitcoin_usdt' AND status = 'open';
" | xargs)

if [ "$POSIZIONI" -gt 0 ]; then
    echo "   ⚠️  ATTENZIONE: Ci sono $POSIZIONI posizioni aperte per bitcoin_usdt!"
    echo "   Mostro dettagli:"
    sudo -u postgres psql -d crypto_db -c "
    SELECT ticket_id, symbol, type, volume, entry_price, status
    FROM open_positions 
    WHERE symbol = 'bitcoin_usdt' AND status = 'open';
    "
    echo ""
    read -p "Vuoi procedere comunque? Le posizioni rimarranno orfane. (s/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo "⏭️  Operazione annullata"
        exit 0
    fi
else
    echo "   ✅ Nessuna posizione aperta per bitcoin_usdt"
fi

echo ""
echo "📊 3. Verifica klines per bitcoin_usdt:"
KLINES=$(sudo -u postgres psql -d crypto_db -t -c "
SELECT COUNT(*) 
FROM klines 
WHERE symbol = 'bitcoin_usdt';
" | xargs)

if [ "$KLINES" -gt 0 ]; then
    echo "   ⚠️  Ci sono $KLINES klines per bitcoin_usdt"
    echo "   (Verranno eliminate insieme alla configurazione)"
else
    echo "   ✅ Nessuna kline per bitcoin_usdt"
fi

echo ""
read -p "⚠️  Sei sicuro di voler ELIMINARE completamente 'bitcoin_usdt'? (s/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo ""
    echo "🔄 Eliminazione in corso..."
    
    # 1. Elimina da bot_settings
    echo "   • Eliminazione da bot_settings..."
    sudo -u postgres psql -d crypto_db -c "
    DELETE FROM bot_settings 
    WHERE symbol = 'bitcoin_usdt' AND strategy_name = 'RSI_Strategy';
    "
    
    # 2. Elimina klines (se presenti)
    if [ "$KLINES" -gt 0 ]; then
        echo "   • Eliminazione klines..."
        sudo -u postgres psql -d crypto_db -c "
        DELETE FROM klines WHERE symbol = 'bitcoin_usdt';
        "
    fi
    
    # 3. Verifica che bitcoin sia attivo
    echo "   • Verifica che 'bitcoin' sia attivo..."
    sudo -u postgres psql -d crypto_db -c "
    UPDATE bot_settings 
    SET is_active = 1 
    WHERE symbol = 'bitcoin' AND strategy_name = 'RSI_Strategy';
    "
    
    echo ""
    echo "✅ Eliminazione completata!"
    echo ""
    echo "📊 Configurazione finale:"
    sudo -u postgres psql -d crypto_db -c "
    SELECT symbol, is_active,
           CASE WHEN is_active = 1 THEN '✅ ATTIVO' ELSE '❌ NON ATTIVO' END as stato
    FROM bot_settings 
    WHERE symbol IN ('bitcoin', 'bitcoin_usdt', 'bitcoin_eur')
    ORDER BY symbol;
    "
    
    echo ""
    echo "📊 Klines rimanenti per Bitcoin:"
    sudo -u postgres psql -d crypto_db -c "
    SELECT symbol, COUNT(*) as klines_count
    FROM klines 
    WHERE symbol IN ('bitcoin', 'bitcoin_usdt', 'bitcoin_eur')
    GROUP BY symbol
    ORDER BY symbol;
    "
else
    echo "⏭️  Operazione annullata"
fi

echo ""
echo "✅ Script completato"
