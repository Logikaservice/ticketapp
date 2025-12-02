# Script PowerShell per testare ordini Binance Testnet
# Esegui: .\backend\scripts\test-ordini-binance.ps1

$baseUrl = "https://ticket.logikaservice.it/api/crypto/binance"

Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  TEST ORDINI BINANCE TESTNET" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Funzione per testare endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null
    )
    
    Write-Host "🧪 $Name" -ForegroundColor Yellow
    Write-Host "   URL: $Url" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            ContentType = "application/json"
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Compress)
        }
        
        $response = Invoke-WebRequest @params
        $jsonResponse = $response.Content | ConvertFrom-Json
        
        Write-Host "   ✅ SUCCESS" -ForegroundColor Green
        $jsonResponse | ConvertTo-Json -Depth 10 | Write-Host
        Write-Host ""
        
        return $jsonResponse
    }
    catch {
        Write-Host "   ❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "   Response: $responseBody" -ForegroundColor Red
        }
        Write-Host ""
        return $null
    }
}

# Test 1: Verifica Modalità
Write-Host "1️⃣  VERIFICA MODALITÀ" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Gray
Test-Endpoint -Name "Modalità Binance" -Url "$baseUrl/mode"
Write-Host ""

# Test 2: Verifica Prezzo
Write-Host "2️⃣  VERIFICA PREZZO SOLEUR" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Gray
$priceResponse = Test-Endpoint -Name "Prezzo SOLEUR" -Url "$baseUrl/price/SOLEUR"
Write-Host ""

# Test 3: Verifica Saldo
Write-Host "3️⃣  VERIFICA SALDO" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Gray
$balanceResponse = Test-Endpoint -Name "Saldo Account" -Url "$baseUrl/balance"
Write-Host ""

# Test 4: Storico Ordini
Write-Host "4️⃣  STORICO ORDINI" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Gray
Test-Endpoint -Name "Storico Ordini" -Url "$baseUrl/orders/history?symbol=SOLEUR&limit=10"
Write-Host ""

# Test 5: Chiedi conferma per ordine
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  TEST ORDINE A MERCATO" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Vuoi fare un ordine di test?" -ForegroundColor Yellow
Write-Host "Questo ordine userà denaro VIRTUALE (Testnet)" -ForegroundColor Yellow
Write-Host ""
$prezzoAttuale = if ($priceResponse) { $priceResponse.price } else { "~119" }
Write-Host "Prezzo attuale SOLEUR: €$prezzoAttuale" -ForegroundColor White
Write-Host ""

$confirma = Read-Host "Vuoi procedere con un ordine BUY di 0.01 SOL? (s/n)"

if ($confirma -eq "s" -or $confirma -eq "S" -or $confirma -eq "si" -or $confirma -eq "SI") {
    Write-Host ""
    Write-Host "5️⃣  ORDINE A MERCATO (BUY 0.01 SOL)" -ForegroundColor Cyan
    Write-Host "────────────────────────────────────────" -ForegroundColor Gray
    
    $orderBody = @{
        symbol = "SOLEUR"
        side = "BUY"
        quantity = "0.01"
    }
    
    $orderResponse = Test-Endpoint -Name "Market Order BUY" -Url "$baseUrl/order/market" -Method "POST" -Body $orderBody
    
    if ($orderResponse -and $orderResponse.success) {
        Write-Host ""
        Write-Host "✅ ORDINE ESEGUITO CON SUCCESSO!" -ForegroundColor Green
        Write-Host "   Order ID: $($orderResponse.order.orderId)" -ForegroundColor White
        Write-Host "   Quantità: $($orderResponse.order.quantity) SOL" -ForegroundColor White
        Write-Host "   Prezzo: €$($orderResponse.order.price)" -ForegroundColor White
        Write-Host "   Status: $($orderResponse.order.status)" -ForegroundColor White
        Write-Host ""
        
        # Test 6: Verifica saldo dopo ordine
        Write-Host "6️⃣  VERIFICA SALDO DOPO ORDINE" -ForegroundColor Cyan
        Write-Host "────────────────────────────────────────" -ForegroundColor Gray
        Start-Sleep -Seconds 2  # Attendi un attimo
        Test-Endpoint -Name "Saldo Aggiornato" -Url "$baseUrl/balance"
        
        # Test 7: Verifica storico dopo ordine
        Write-Host "7️⃣  VERIFICA STORICO DOPO ORDINE" -ForegroundColor Cyan
        Write-Host "────────────────────────────────────────" -ForegroundColor Gray
        Test-Endpoint -Name "Storico Aggiornato" -Url "$baseUrl/orders/history?symbol=SOLEUR&limit=5"
    }
} else {
    Write-Host ""
    Write-Host "⏭️  Test ordine saltato" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  TEST COMPLETATI" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Per testare ordini limite o stop-loss:" -ForegroundColor Yellow
Write-Host "Vedi: TEST_ORDINI_BINANCE.md" -ForegroundColor White
Write-Host ""

