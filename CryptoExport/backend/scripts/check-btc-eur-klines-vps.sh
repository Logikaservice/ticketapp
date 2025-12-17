#!/bin/bash
# Script per verificare le klines di BTC/EUR sul VPS

echo "🔍 Verifica klines BTC/EUR sul VPS"
echo "=================================="
echo ""

# Connection string per database locale sul VPS
DB_URL="postgresql://postgres:TicketApp2025!Secure@localhost:5432/crypto_db"

echo "📊 Totale klines BTC/EUR:"
sudo -u postgres psql -d crypto_db -c "
SELECT COUNT(*) as totale_klines 
FROM klines 
WHERE symbol = 'bitcoin_eur';
"

echo ""
echo "📈 Klines per intervallo:"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    interval,
    COUNT(*) as count
FROM klines 
WHERE symbol = 'bitcoin_eur'
GROUP BY interval
ORDER BY interval;
"

echo ""
echo "📅 Range temporale:"
sudo -u postgres psql -d crypto_db -c "
SELECT 
    COUNT(*) as total,
    TO_TIMESTAMP(MIN(open_time) / 1000) as prima_kline,
    TO_TIMESTAMP(MAX(open_time) / 1000) as ultima_kline,
    EXTRACT(EPOCH FROM (TO_TIMESTAMP(MAX(open_time) / 1000) - TO_TIMESTAMP(MIN(open_time) / 1000))) / 86400 as giorni_coperti
FROM klines 
WHERE symbol = 'bitcoin_eur';
"

echo ""
echo "✅ Verifica completata"
