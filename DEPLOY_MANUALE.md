# 🚀 Deploy Manuale - Istruzioni

## ⚠️ Problema: Deploy Non Parte Automaticamente

Se il deploy GitHub Actions non parte automaticamente dopo il push, prova queste soluzioni:

## ✅ Soluzione 1: Verifica Push

Esegui questi comandi in PowerShell:

```powershell
cd c:\TicketApp

# Verifica se ci sono commit da pushare
git log origin/main..HEAD --oneline

# Se ci sono commit, fai push
git push origin main

# Verifica che il push sia andato a buon fine
git log origin/main..HEAD --oneline
```

Se il comando `git log origin/main..HEAD --oneline` non mostra nulla, significa che tutto è già pushato.

## ✅ Soluzione 2: Trigger Manuale GitHub Actions

1. Vai su: https://github.com/Logikaservice/ticketapp/actions
2. Clicca sul workflow "Deploy to VPS"
3. Clicca su "Run workflow" (in alto a destra)
4. Seleziona branch "main"
5. Clicca "Run workflow"

Questo attiverà manualmente il deploy.

## ✅ Soluzione 3: Push Forzato (Solo se necessario)

**⚠️ ATTENZIONE: Usa solo se sai cosa stai facendo!**

```powershell
cd c:\TicketApp
git push origin main --force
```

## ✅ Soluzione 4: Verifica Workflow File

Il workflow dovrebbe essere in: `.github/workflows/deploy.yml`

Verifica che ci sia:
```yaml
on:
  push:
    branches:
      - main
```

## 🔍 Debug

### Verifica Ultimo Commit

```powershell
git log --oneline -1
```

Dovresti vedere: "PackVision: fix schermo diviso con log debug"

### Verifica Remote

```powershell
git remote -v
```

Dovresti vedere: `origin  https://github.com/Logikaservice/ticketapp.git`

### Verifica Branch

```powershell
git branch -vv
```

Dovresti essere su `main` e vedere `[origin/main]`

## 📝 Se Nulla Funziona

1. Vai su: https://github.com/Logikaservice/ticketapp
2. Verifica l'ultimo commit nella sezione "Latest commit"
3. Se non vedi le modifiche recenti, il push non è andato a buon fine
4. Esegui manualmente i comandi git in PowerShell locale

