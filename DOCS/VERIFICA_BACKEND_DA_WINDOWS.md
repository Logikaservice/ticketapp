# 🔍 Come Verificare lo Stato del Backend da Windows

Ci sono **due modi** per verificare lo stato del backend dalla tua macchina Windows:

---

## Metodo 1: Verifica Remota via HTTP (Senza SSH) ✅

Questo metodo **non richiede configurazione SSH** e funziona immediatamente.

### Come Funziona

Lo script PowerShell fa una richiesta HTTP al dominio pubblico `https://ticket.logikaservice.it/api/health` per verificare se il backend risponde.

### Esegui lo Script

```powershell
.\scripts\Diagnose-502Error.ps1
```

### Cosa Fa

1. **Test locale** (se hai il backend in esecuzione su Windows):
   - Verifica `http://localhost:3001/api/health`
   
2. **Test remoto** (sul server VPS):
   - Verifica `https://ticket.logikaservice.it/api/health`
   - Se risponde → Backend OK ✅
   - Se errore 502 → Backend non risponde ❌

### Vantaggi

- ✅ Funziona immediatamente, senza configurazione
- ✅ Non richiede accesso SSH
- ✅ Veloce e semplice

### Limitazioni

- ❌ Può solo **verificare** se il backend risponde
- ❌ **Non può** riavviare il backend automaticamente
- ❌ **Non può** vedere i log o lo stato PM2

---

## Metodo 2: Connessione SSH Automatica (Con PowerShell) 🚀

Questo metodo ti permette di **controllare e gestire** il backend direttamente dalla VPS.

### Prerequisiti

1. **OpenSSH Client installato** (incluso in Windows 10/11)
2. **Chiave SSH configurata** per accedere alla VPS

### Setup Iniziale (Solo la Prima Volta)

#### Passo 1: Verifica SSH

```powershell
# Verifica se SSH è disponibile
ssh
```

Se non funziona, installa OpenSSH Client:
- Settings → Apps → Optional Features → OpenSSH Client

#### Passo 2: Configura Chiave SSH

```powershell
# Test connessione VPS
.\scripts\Test-VpsConnection.ps1
```

Se la chiave non è configurata, segui:
```powershell
.\CONFIGURA_CHIAVE_SSH.ps1
```

### Usa VpsHelper (Dopo Setup)

```powershell
# Carica le funzioni helper
. .\scripts\VpsHelper.ps1

# Verifica stato backend
Get-VpsStatus

# Riavvia backend
Restart-VpsBackend

# Vedi log backend
Get-VpsBackendLogs -Lines 50

# Verifica porta 3001
Test-VpsBackendPort

# Test database
Test-VpsDatabase
```

### Vantaggi

- ✅ Può **riavviare** il backend automaticamente
- ✅ Può vedere **log** e stato PM2
- ✅ Può eseguire **qualsiasi comando** sulla VPS
- ✅ Controllo completo del server

### Limitazioni

- ❌ Richiede configurazione SSH iniziale
- ❌ Richiede chiave SSH valida

---

## Confronto Rapido

| Funzionalità | Metodo 1 (HTTP) | Metodo 2 (SSH) |
|-------------|----------------|---------------|
| Verifica stato | ✅ | ✅ |
| Riavvia backend | ❌ | ✅ |
| Vedi log | ❌ | ✅ |
| Setup richiesto | ❌ | ✅ |
| Velocità | ⚡ Veloce | 🐢 Più lento |

---

## Esempio Pratico: Risolvere Errori 502

### Scenario: Vedi errori 502 nel browser

#### Opzione A: Solo Verifica (Metodo 1)

```powershell
.\scripts\Diagnose-502Error.ps1
```

Lo script ti dirà:
- ✅ Backend risponde → Problema potrebbe essere cache browser
- ❌ Backend non risponde → Devi connetterti alla VPS manualmente

#### Opzione B: Verifica + Riavvio Automatico (Metodo 2)

```powershell
# Carica helper
. .\scripts\VpsHelper.ps1

# Verifica stato
Get-VpsStatus

# Riavvia backend
Restart-VpsBackend

# Verifica che funzioni
Get-VpsBackendLogs -Lines 20
```

---

## Comandi SSH Manuali (Alternativa)

Se preferisci connetterti manualmente:

```powershell
# Connettiti alla VPS
ssh root@159.69.121.162

# Una volta connesso, esegui:
pm2 status
pm2 logs ticketapp-backend --lines 50
pm2 restart ticketapp-backend
curl http://localhost:3001/api/health
```

---

## Troubleshooting

### "SSH non trovato"
- Installa OpenSSH Client da Windows Settings

### "Chiave SSH non trovata"
- Esegui: `.\CONFIGURA_CHIAVE_SSH.ps1`
- Oppure copia manualmente la chiave in `~/.ssh/vps_key`

### "Permission denied"
- Verifica che la chiave SSH sia corretta
- Controlla i permessi del file chiave

### Script non funziona
- Verifica PowerShell ExecutionPolicy: `Get-ExecutionPolicy`
- Se necessario: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

---

## Raccomandazione

**Per uso quotidiano**: Usa **Metodo 1** (HTTP) per verifiche rapide.

**Per risolvere problemi**: Usa **Metodo 2** (SSH) per controllo completo.
