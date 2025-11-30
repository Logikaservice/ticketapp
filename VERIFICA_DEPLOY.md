# 🔍 Verifica Deploy GitHub Actions

## ✅ Workflow Configurato

Il workflow GitHub Actions è presente in `.github/workflows/deploy.yml` e dovrebbe partire automaticamente quando fai push su `main`.

## 🔍 Come Verificare

### 1. Verifica Push su GitHub

Vai su GitHub e controlla:
- **URL**: https://github.com/Logikaservice/ticketapp
- Verifica che l'ultimo commit sia presente:
  - "PackVision: fix visualizzazione messaggi non urgenti nella parte inferiore quando schermo diviso"

### 2. Verifica GitHub Actions

1. Vai su: https://github.com/Logikaservice/ticketapp/actions
2. Controlla se c'è un workflow in esecuzione o completato
3. Dovresti vedere "Deploy to VPS" nella lista

### 3. Se il Workflow Non è Partito

**Opzione A: Trigger Manuale**

1. Vai su: https://github.com/Logikaservice/ticketapp/actions
2. Clicca su "Deploy to VPS" nella lista a sinistra
3. Clicca su "Run workflow" (in alto a destra)
4. Seleziona il branch `main`
5. Clicca "Run workflow"

**Opzione B: Verifica Push**

Se il push non è andato a buon fine, esegui manualmente:

```bash
cd c:\TicketApp
git status
git log --oneline -3
git push origin main
```

### 4. Verifica Configurazione Secrets

Il workflow richiede questi secrets configurati:
- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_PORT` (opzionale)

Verifica su: https://github.com/Logikaservice/ticketapp/settings/secrets/actions

## 🚀 Deploy Manuale (Alternativa)

Se GitHub Actions non funziona, puoi fare deploy manualmente sul server:

```bash
# Sul server Linux
cd /var/www/ticketapp
git pull origin main
cd frontend
npm install
npm run build
sudo systemctl restart ticketapp-backend
sudo systemctl restart nginx
```

## 📝 Log Workflow

Se il workflow è partito ma fallisce, controlla i log:
1. Vai su: https://github.com/Logikaservice/ticketapp/actions
2. Clicca sul workflow in esecuzione/completato
3. Espandi i job per vedere i dettagli
4. Controlla eventuali errori

