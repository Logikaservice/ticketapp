# 🚀 Istruzioni per Push Manuale su GitHub

## Problema
Il push automatico non mostra output. Esegui manualmente questi comandi.

## Comandi da Eseguire in PowerShell

Apri PowerShell (come amministratore) e esegui:

```powershell
cd c:\TicketApp

# 1. Verifica stato
git status

# 2. Aggiungi i file modificati
git add backend/routes/cryptoRoutes.js
git add frontend/src/components/CryptoDashboard/CryptoDashboard.jsx

# 3. Verifica cosa è stato aggiunto
git status

# 4. Crea commit
git commit -m "Fix: Risolto errore 500 su /api/crypto/statistics e migliorata gestione posizioni aperte

- Aggiunti controlli di sicurezza per gestire errori in getSymbolPrice()
- Validazione di openPositions, closedPositions e holdings prima dell'uso
- Migliorata gestione errori per evitare crash quando un simbolo fallisce
- Aggiunto logging per debug delle posizioni
- Rimosso codice duplicato nel frontend"

# 5. Push su GitHub
git push origin main
```

## Verifica Push

Dopo il push, verifica su GitHub:
- **Repository**: https://github.com/Logikaservice/ticketapp
- **Ultimo commit**: Dovresti vedere il commit "Fix: Risolto errore 500 su /api/crypto/statistics..."
- **Actions**: https://github.com/Logikaservice/ticketapp/actions

## Se il Push Richiede Autenticazione

Se GitHub chiede credenziali:
1. Usa un **Personal Access Token** (non la password)
2. Vai su: https://github.com/settings/tokens
3. Crea un nuovo token con permessi `repo`
4. Usa il token come password quando richiesto

## Se il Workflow Non Parte Automaticamente

1. Vai su: https://github.com/Logikaservice/ticketapp/actions
2. Clicca su "Deploy to VPS" (se presente)
3. Clicca "Run workflow" (in alto a destra)
4. Seleziona branch `main`
5. Clicca "Run workflow"

## File Modificati

I seguenti file sono stati modificati e devono essere committati:
- `backend/routes/cryptoRoutes.js` - Fix errore 500 e validazioni
- `frontend/src/components/CryptoDashboard/CryptoDashboard.jsx` - Rimozione codice duplicato
