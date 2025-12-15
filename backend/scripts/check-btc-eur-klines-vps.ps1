# Script PowerShell per verificare le klines di BTC/EUR sul VPS via SSH

$VPS_HOST = "159.69.121.162"
$SSH_USER = "root"

Write-Host "🔍 Verifica klines BTC/EUR sul VPS" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Comandi SQL da eseguire sul VPS
$sqlCommands = @"
-- Totale klines
SELECT COUNT(*) as totale_klines 
FROM klines 
WHERE symbol = 'bitcoin_eur';

-- Klines per intervallo
SELECT 
    interval,
    COUNT(*) as count
FROM klines 
WHERE symbol = 'bitcoin_eur'
GROUP BY interval
ORDER BY interval;

-- Range temporale
SELECT 
    COUNT(*) as total,
    TO_TIMESTAMP(MIN(open_time) / 1000) as prima_kline,
    TO_TIMESTAMP(MAX(open_time) / 1000) as ultima_kline,
    EXTRACT(EPOCH FROM (TO_TIMESTAMP(MAX(open_time) / 1000) - TO_TIMESTAMP(MIN(open_time) / 1000))) / 86400 as giorni_coperti
FROM klines 
WHERE symbol = 'bitcoin_eur';
"@

Write-Host "📊 Esecuzione query sul VPS..." -ForegroundColor Yellow
Write-Host ""

# Esegui i comandi SQL sul VPS (usa sudo -u postgres per evitare peer authentication)
ssh "${SSH_USER}@${VPS_HOST}" "sudo -u postgres psql -d crypto_db -c \"
SELECT COUNT(*) as totale_klines 
FROM klines 
WHERE symbol = 'bitcoin_eur';
\""

Write-Host ""
Write-Host "📈 Klines per intervallo:" -ForegroundColor Yellow

ssh "${SSH_USER}@${VPS_HOST}" "sudo -u postgres psql -d crypto_db -c \"
SELECT 
    interval,
    COUNT(*) as count
FROM klines 
WHERE symbol = 'bitcoin_eur'
GROUP BY interval
ORDER BY interval;
\""

Write-Host ""
Write-Host "📅 Range temporale:" -ForegroundColor Yellow

ssh "${SSH_USER}@${VPS_HOST}" "sudo -u postgres psql -d crypto_db -c \"
SELECT 
    COUNT(*) as total,
    TO_TIMESTAMP(MIN(open_time) / 1000) as prima_kline,
    TO_TIMESTAMP(MAX(open_time) / 1000) as ultima_kline,
    EXTRACT(EPOCH FROM (TO_TIMESTAMP(MAX(open_time) / 1000) - TO_TIMESTAMP(MIN(open_time) / 1000))) / 86400 as giorni_coperti
FROM klines 
WHERE symbol = 'bitcoin_eur';
\""

Write-Host ""
Write-Host "✅ Verifica completata" -ForegroundColor Green
