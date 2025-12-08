# Verifica GitHub Actions - Deploy Automatico

## ✅ Stato Attuale

### 1. Workflow Configurato
✅ **File workflow presente**: `.github/workflows/deploy.yml`
✅ **Trigger automatico**: Si attiva su ogni `push` al branch `main`
✅ **Trigger manuale**: Disponibile tramite "Run workflow" su GitHub

### 2. Ultimo Commit
L'ultimo commit pushato dovrebbe essere:
```
Fix: Aggiunti controlli null/undefined per prevenire errori toFixed() su valori NaN o undefined
```

### 3. Secrets Richiesti
Il workflow richiede questi secrets (verifica su GitHub):

1. **VPS_HOST** - Indirizzo IP o dominio del VPS
   - Esempio: `159.69.121.162` o `ticket.logikaservice.it`

2. **VPS_USER** - Utente SSH per il VPS
   - Esempio: `root` o `ubuntu`

3. **VPS_SSH_KEY** - Chiave SSH privata completa

4. **VPS_PORT** (opzionale) - Porta SSH (default: 22)

## 🔍 Come Verificare su GitHub

### Passo 1: Verifica Secrets
1. Vai su: **https://github.com/Logikaservice/ticketapp**
2. Clicca su **Settings** (in alto)
3. Nel menu sinistra: **Secrets and variables** → **Actions**
4. Verifica che ci siano:
   - ✅ VPS_HOST
   - ✅ VPS_USER
   - ✅ VPS_SSH_KEY
   - (Opzionale) VPS_PORT

### Passo 2: Verifica Workflow Eseguito
1. Vai su: **https://github.com/Logikaservice/ticketapp/actions**
2. Cerca il workflow **"Deploy to VPS"**
3. Controlla l'ultima esecuzione:
   - 🟢 **Verde** = Deploy completato con successo
   - 🟡 **Giallo** = In corso
   - 🔴 **Rosso** = Errore (controlla i log)

### Passo 3: Se Non Vedi Esecuzioni Recenti
**Opzione A: Attiva Manualmente**
1. Vai su **Actions**
2. Seleziona **"Deploy to VPS"** a sinistra
3. Clicca su **"Run workflow"**
4. Seleziona branch `main`
5. Clicca su **"Run workflow"**

**Opzione B: Nuovo Push (se il workflow non si è attivato)**
Il workflow si attiva automaticamente solo su push a `main`. Se non vedi esecuzioni, potrebbe essere che:
- Il push non è andato a buon fine
- Il workflow è stato disabilitato
- I secrets non sono configurati (il workflow fallisce subito)

## 🐛 Troubleshooting

### Se il Workflow Fallisce Subito
**Errore: "VPS_HOST secret non configurato"**
- ✅ Verifica che i secrets siano configurati correttamente
- ✅ I nomi dei secrets devono essere esatti (case-sensitive)

### Se il Workflow Fallisce durante SSH
**Errore: "Permission denied (publickey)"**
- ✅ Verifica che la chiave SSH privata sia completa (include `-----BEGIN ... -----END`)
- ✅ Verifica che la chiave pubblica sia in `~/.ssh/authorized_keys` sul VPS
- ✅ Verifica i permessi sul VPS: `chmod 600 ~/.ssh/authorized_keys`

**Errore: "Connection refused"**
- ✅ Verifica che l'IP/dominio sia corretto
- ✅ Verifica che la porta SSH sia aperta
- ✅ Verifica che SSH sia attivo: `sudo systemctl status ssh`

### Se il Workflow Fallisce durante il Build
**Errore: "Errore build frontend"**
- ✅ Controlla i log completi su GitHub Actions
- ✅ Verifica che le dipendenze siano installabili
- ✅ Potrebbe essere un problema di memoria sul VPS

## ✅ Verifica Finale Deploy

Dopo che il workflow è completato con successo:

1. **Verifica sul VPS** (SSH):
```bash
ssh root@159.69.121.162
cd /var/www/ticketapp
git log -1  # Verifica l'ultimo commit
ls -la frontend/build  # Verifica che il build esista
```

2. **Verifica sul Browser**:
   - Vai su `https://ticket.logikaservice.it`
   - Fai **Hard Refresh**: `Ctrl + Shift + R` (Windows) o `Cmd + Shift + R` (Mac)
   - Verifica che l'errore `toFixed()` non appaia più nella console

## 📝 Nota

Se GitHub Actions non funziona o preferisci il deploy manuale, puoi usare:
- Script SSH diretto: `deploy-vps-manual.sh`
- Oppure connettiti al VPS e esegui manualmente i comandi

