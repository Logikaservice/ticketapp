# 🚀 Istruzioni Push GitHub - PackVision

## Problema Rilevato
Il terminale in Cursor non mostra output dai comandi Git. I file sono stati creati/modificati localmente ma il push potrebbe non essere stato completato.

## File Modificati/Creati

1. ✅ `deploy/nginx/packvision.logikaservice.it.conf` - Configurazione Nginx
2. ✅ `PACKVISION_SETUP.md` - Guida setup
3. ✅ `frontend/src/App.jsx` - Rilevamento dominio packvision
4. ✅ `frontend/src/components/PackVision.jsx` - Modalità display automatica
5. ✅ `push-to-github.ps1` - Script PowerShell per push

## Soluzione: Esegui Manualmente

### Opzione 1: Usa lo Script PowerShell

Apri PowerShell nella directory del progetto e esegui:

```powershell
cd c:\TicketApp
.\push-to-github.ps1
```

### Opzione 2: Comandi Git Manuali

Apri un terminale (PowerShell, Git Bash, o CMD) e esegui:

```bash
cd c:\TicketApp

# Verifica lo stato
git status

# Aggiungi tutti i file modificati
git add -A

# Verifica cosa verrà committato
git status

# Fai il commit
git commit -m "PackVision: configurazione sottodominio packvision.logikaservice.it"

# Push su GitHub
git push origin main
```

### Opzione 3: Usa Git GUI

1. Apri **Git GUI** o **GitHub Desktop**
2. Seleziona i file modificati:
   - `deploy/nginx/packvision.logikaservice.it.conf`
   - `PACKVISION_SETUP.md`
   - `frontend/src/App.jsx`
   - `frontend/src/components/PackVision.jsx`
3. Fai commit con messaggio: `PackVision: configurazione sottodominio packvision.logikaservice.it`
4. Fai push su `origin/main`

## Verifica

Dopo il push, verifica su GitHub:
- Vai su: https://github.com/Logikaservice/ticketapp
- Controlla che i file siano presenti:
  - `deploy/nginx/packvision.logikaservice.it.conf`
  - `PACKVISION_SETUP.md`
  - Modifiche in `frontend/src/App.jsx`
  - Modifiche in `frontend/src/components/PackVision.jsx`

## Se il Push Fallisce

### Errore di Autenticazione
Se chiede credenziali:
- Usa un **Personal Access Token** GitHub invece della password
- Oppure configura SSH keys

### Verifica Remote
```bash
git remote -v
```
Dovrebbe mostrare: `https://github.com/Logikaservice/ticketapp.git`

### Verifica Branch
```bash
git branch
```
Dovresti essere su `main`

## Contatto
Se continua a non funzionare, verifica:
1. Connessione internet
2. Credenziali GitHub
3. Permessi sul repository

