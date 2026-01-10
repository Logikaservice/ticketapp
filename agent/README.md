# Network Monitor Agent - PowerShell

Agent PowerShell per monitoraggio rete che invia dati al sistema TicketApp.

## Installazione

1. **Copia i file agent sul server Windows cliente:**
   - `NetworkMonitor.ps1`
   - `config.json` (crea da `config.example.json`)

2. **Configurazione:**
   - Modifica `config.json` con:
     - `server_url`: URL del server TicketApp (es: `https://ticket.logikaservice.it`)
     - `api_key`: API Key ottenuta dal sistema TicketApp (vedi sezione "Ottenere API Key")
     - `network_ranges`: Array di range IP da monitorare (es: `["192.168.1.0/24"]`)
     - `scan_interval_minutes`: Intervallo scansione in minuti (default: 15)

3. **Primo test:**
   ```powershell
   .\NetworkMonitor.ps1 -TestMode
   ```
   
   Verifica che:
   - Lo script riesca a scansionare la rete
   - I dati vengano inviati correttamente al server
   - Non ci siano errori

4. **Esecuzione automatica:**
   
   Crea un Scheduled Task Windows per eseguire lo script periodicamente:
   
   ```powershell
   $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\Path\To\NetworkMonitor.ps1"
   $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15)
   Register-ScheduledTask -TaskName "NetworkMonitor" -Action $action -Trigger $trigger -RunLevel Highest
   ```

   Oppure esegui manualmente ogni X minuti:
   ```powershell
   .\NetworkMonitor.ps1
   ```

## Ottenere API Key

L'API Key deve essere generata dal sistema TicketApp:

1. Accedi come tecnico/admin al sistema TicketApp
2. Vai alla sezione "Monitoraggio Rete" (dashboard)
3. Seleziona l'azienda cliente
4. Clicca "Registra Nuovo Agent"
5. Inserisci:
   - Nome agent (es: "Agent Server Principale")
   - Range di rete da monitorare
   - Intervallo scansione
6. Copia l'API Key generata e inseriscila in `config.json`

## Configurazione Reti Multiple

Puoi monitorare più reti contemporaneamente aggiungendo più range in `network_ranges`:

```json
{
  "network_ranges": [
    "192.168.1.0/24",  // LAN principale
    "192.168.2.0/24",  // Rete telefoni
    "10.0.0.0/24"      // Rete WiFi
  ]
}
```

## Requisiti

- Windows PowerShell 5.1 o superiore
- Permessi amministratore (per scansione rete completa)
- Connessione internet verso il server TicketApp

## Troubleshooting

**Errore "API Key non valida":**
- Verifica che l'API Key sia corretta in `config.json`
- Assicurati che l'agent sia registrato nel sistema TicketApp

**Nessun dispositivo trovato:**
- Verifica che i range IP siano corretti
- Controlla che il server sia sulla rete da scansionare
- Prova a fare un ping manuale ai dispositivi

**Errore connessione al server:**
- Verifica che `server_url` sia corretto
- Controlla firewall/rete che permetta connessioni HTTPS uscenti
- Verifica che il server TicketApp sia raggiungibile

## Log

Gli output vengono mostrati nella console. Per salvare i log in un file, modifica la funzione `Write-Log` in `NetworkMonitor.ps1`.
