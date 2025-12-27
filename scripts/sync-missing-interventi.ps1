# Script PowerShell per sincronizzare forzatamente gli interventi mancanti su Google Calendar
# Uso: .\scripts\sync-missing-interventi.ps1 [baseUrl]

param(
    [string]$BaseUrl = "https://ticket.logikaservice.it"
)

Write-Host "`n🔄 Avvio sincronizzazione interventi mancanti..." -ForegroundColor Cyan
Write-Host "📍 URL: $BaseUrl/api/sync-missing-interventi`n" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/sync-missing-interventi" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{
            "User-Agent" = "TicketApp-SyncScript/1.0"
        }

    if ($response.success) {
        Write-Host "✅ Sincronizzazione completata con successo!`n" -ForegroundColor Green
        Write-Host "📊 Eventi creati: $($response.synced)" -ForegroundColor White
        Write-Host "❌ Errori: $($response.errors)`n" -ForegroundColor $(if ($response.errors -gt 0) { "Yellow" } else { "White" })
        
        if ($response.errorDetails -and $response.errorDetails.Count -gt 0) {
            Write-Host "⚠️ Dettagli errori:" -ForegroundColor Yellow
            $response.errorDetails | ForEach-Object {
                Write-Host "  - Ticket #$($_.numero): $($_.error)" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "❌ Sincronizzazione fallita:" -ForegroundColor Red
        Write-Host $response.message -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Errore durante la sincronizzazione:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
