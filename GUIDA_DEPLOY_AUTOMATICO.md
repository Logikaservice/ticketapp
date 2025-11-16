# Guida Deploy Automatico con GitHub Actions

## 🎯 Come Funziona

Quando fai una modifica e chiedi il deploy:
1. **Io modifico i file locali** nel tuo workspace
2. **Faccio commit e push su GitHub** automaticamente
3. **GitHub Actions si attiva** e rileva il push
4. **GitHub Actions si collega al server VPS** via SSH
5. **Esegue automaticamente:**
   - `git pull` (aggiorna il codice)
   - `npm install` (backend e frontend)
   - `npm run build` (frontend)
   - `pm2 restart` (riavvia il backend)
6. **App aggiornata automaticamente!** 🎉

---

## 🔧 Setup Iniziale (Una Volta)

### Passo 1: Genera SSH Key sul Server

Collegati al server e genera una chiave SSH dedicata per GitHub Actions:

```bash
ssh root@159.69.121.162

# Genera chiave SSH
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""

# Mostra la chiave pubblica (la copierai su GitHub)
cat ~/.ssh/github_actions.pub
```

**Copia la chiave pubblica** (inizia con `ssh-ed25519...`)

### Passo 2: Aggiungi Chiave Pubblica al Server

Aggiungi la chiave pubblica al file `authorized_keys`:

```bash
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Passo 3: Configura GitHub Secrets

1. Vai su GitHub: https://github.com/Logikaservice/ticketapp
2. Vai su **Settings** → **Secrets and variables** → **Actions**
3. Clicca **New repository secret**
4. Aggiungi questi 3 secrets:

#### Secret 1: `VPS_HOST`
- **Name:** `VPS_HOST`
- **Value:** `159.69.121.162`

#### Secret 2: `VPS_USER`
- **Name:** `VPS_USER`
- **Value:** `root`

#### Secret 3: `VPS_SSH_KEY`
- **Name:** `VPS_SSH_KEY`
- **Value:** La chiave **PRIVATA** (non quella pubblica!)
  - Sul server esegui: `cat ~/.ssh/github_actions`
  - Copia tutto il contenuto (inizia con `-----BEGIN OPENSSH PRIVATE KEY-----`)

---

## ✅ Verifica Setup

Dopo aver configurato i secrets, fai un test:

1. Fai una piccola modifica (es: commento in un file)
2. Chiedi a me di fare il deploy
3. Io farò commit e push
4. Vai su GitHub → **Actions** tab
5. Dovresti vedere il workflow in esecuzione
6. Se tutto ok, vedrai "✅ Deploy completato con successo!"

---

## 🚀 Workflow Normale

### Quando chiedi una modifica:

**Tu:** "Modifica X e fai il deploy"

**Io:**
1. Modifico i file locali
2. Faccio commit: `git commit -m "Descrizione modifica"`
3. Faccio push: `git push origin main`
4. GitHub Actions si attiva automaticamente
5. Il server si aggiorna automaticamente

**Tu:** Non devi fare nulla! 🎉

---

## 🔍 Monitoraggio

### Vedere lo stato del deploy:

1. Vai su GitHub → **Actions** tab
2. Vedi tutti i deploy passati
3. Clicca su un deploy per vedere i log dettagliati

### Vedere i log sul server:

```bash
# Log PM2
pm2 logs ticketapp-backend

# Log Nginx
sudo tail -f /var/log/nginx/ticketapp-access.log
sudo tail -f /var/log/nginx/ticketapp-error.log
```

---

## ⚠️ Troubleshooting

### Deploy fallisce?

1. Controlla i log su GitHub Actions
2. Verifica che i secrets siano corretti
3. Verifica che la chiave SSH funzioni:
   ```bash
   ssh -i ~/.ssh/github_actions root@159.69.121.162
   ```

### Server non si aggiorna?

1. Verifica che il repository sia aggiornato:
   ```bash
   cd /var/www/ticketapp
   git status
   ```

2. Riavvia manualmente se necessario:
   ```bash
   cd /var/www/ticketapp
   git pull
   cd backend && npm install
   cd ../frontend && npm install && npm run build
   pm2 restart ticketapp-backend
   ```

---

## 📝 Note Importanti

- ✅ Il deploy è automatico dopo ogni push su `main`
- ✅ Puoi anche eseguire manualmente da GitHub Actions
- ✅ I file `.env` NON vengono committati (sono nel `.gitignore`)
- ✅ Le variabili d'ambiente rimangono sul server
- ✅ PM2 gestisce automaticamente i riavvii

---

## 🎉 Fine Setup

Una volta configurato, ogni modifica sarà deployata automaticamente!

