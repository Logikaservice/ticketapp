# 📖 Guida Deploy Manuale - Spiegazione Completa

## Cosa significa "Deploy Manuale"?

**Deploy manuale** = Connettersi al server VPS e applicare le modifiche **direttamente sul server**, invece di aspettare che GitHub Actions lo faccia automaticamente.

### Differenza tra Deploy Automatico e Manuale

| Deploy Automatico | Deploy Manuale |
|-------------------|----------------|
| ✅ Push su GitHub → GitHub Actions fa tutto | ✅ Ti connetti al server e fai tutto tu |
| ⏱️ Attendi 2-3 minuti | ⚡ Immediato |
| 🔄 Funziona solo se GitHub Actions è configurato | 🔧 Funziona sempre |

## Come Fare il Deploy Manuale - Passo per Passo

### Prerequisiti

1. **Accesso SSH al server VPS:**
   ```bash
   ssh root@159.69.121.162
   ```

2. **Conoscere il percorso del progetto sul server:**
   - Sul server Linux: `/var/www/ticketapp`
   - **NON** usare percorsi Windows come `c:\TicketApp` (quello è solo sul tuo PC!)

### Metodo 1: Deploy Manuale Semplice (Raccomandato)

```bash
# 1. Connettiti al server
ssh root@159.69.121.162

# 2. Vai nella directory del progetto
cd /var/www/ticketapp

# 3. Aggiorna il codice da GitHub
git pull origin main

# 4. Riavvia il backend
pm2 restart ticketapp-backend

# 5. Verifica che funzioni
pm2 status
pm2 logs ticketapp-backend --lines 20
```

### Metodo 2: Deploy Manuale con Script

Se lo script `deploy-fix-rapido.sh` è già sul server:

```bash
# 1. Connettiti al server
ssh root@159.69.121.162

# 2. Vai nella directory del progetto
cd /var/www/ticketapp

# 3. Esegui lo script
bash deploy-fix-rapido.sh
```

**⚠️ Se lo script non esiste sul server**, devi prima copiarlo o usare il Metodo 1.

### Metodo 3: Deploy Manuale Completo (Se git pull non funziona)

Se `git pull` fallisce (es. conflitti, autenticazione), puoi fare un reset completo:

```bash
# 1. Connettiti al server
ssh root@159.69.121.162

# 2. Vai nella directory del progetto
cd /var/www/ticketapp

# 3. Forza l'aggiornamento da GitHub (sovrascrive modifiche locali)
git fetch origin
git reset --hard origin/main

# 4. Riavvia il backend
pm2 restart ticketapp-backend

# 5. Verifica
pm2 status
```

## Problemi Comuni e Soluzioni

### Problema 1: "No such file or directory" per lo script

**Errore:**
```bash
bash: deploy-fix-rapido.sh: No such file or directory
```

**Soluzione:**
Lo script non è sul server. Usa il **Metodo 1** (deploy semplice) invece dello script.

### Problema 2: Percorsi Windows su server Linux

**Errore:**
```bash
-bash: cd: c:TicketApp: No such file or directory
```

**Causa:**
Stai usando un percorso Windows (`c:\TicketApp`) su un server Linux.

**Soluzione:**
Sul server Linux usa:
```bash
cd /var/www/ticketapp
```

**Ricorda:**
- Sul **tuo PC Windows**: `c:\TicketApp`
- Sul **server Linux**: `/var/www/ticketapp`

### Problema 3: Git "Author identity unknown"

**Errore:**
```
Author identity unknown
*** Please tell me who you are.
```

**Soluzione:**
Configura git sul server (solo la prima volta):
```bash
git config --global user.email "tuo-email@example.com"
git config --global user.name "Tuo Nome"
```

Poi riprova il commit (se necessario).

### Problema 4: Git chiede username/password per GitHub

**Errore:**
```
Username for 'https://github.com':
```

**Soluzione:**
- Se il repository è **pubblico**: non serve autenticazione per `git pull`
- Se il repository è **privato**: configura SSH keys o usa un token

**Per repository privati, usa SSH invece di HTTPS:**
```bash
# Verifica il remote
git remote -v

# Se usa HTTPS, cambia a SSH
git remote set-url origin git@github.com:TUO_USERNAME/TicketApp.git
```

### Problema 5: "Your branch is up to date" ma ci sono modifiche

**Situazione:**
```bash
git status
# Mostra: "Your branch is up to date with 'origin/main'"
# Ma anche: "Changes to be committed:" o "Untracked files:"
```

**Spiegazione:**
- "Up to date" = il tuo branch locale è allineato con GitHub
- Ma ci sono **modifiche locali** sul server che non sono state committate

**Soluzione:**
Se vuoi **scartare** le modifiche locali e usare solo quelle da GitHub:
```bash
git reset --hard origin/main
git clean -fd
```

Se vuoi **mantenere** le modifiche locali, committale prima:
```bash
git add .
git commit -m "Modifiche locali"
git push origin main
```

## Verifica Dopo il Deploy Manuale

Dopo aver fatto il deploy manuale, verifica che tutto funzioni:

```bash
# 1. Verifica che il backend sia online
pm2 status
# Dovrebbe mostrare "online" senza restart continui

# 2. Verifica i log
pm2 logs ticketapp-backend --lines 30
# Non dovrebbero esserci errori TypeError

# 3. Test endpoint crypto
curl http://localhost:3001/api/crypto/dashboard
# Dovrebbe restituire JSON (non 502)

# 4. Verifica che il fix sia presente
grep -n "if (vivaldiRoutes)" /var/www/ticketapp/backend/index.js
# Dovrebbe mostrare la riga con il fix
```

## Riepilogo: Cosa Fare ORA

Per applicare il fix **subito** sul server, esegui questi comandi:

```bash
# Connettiti al server
ssh root@159.69.121.162

# Vai nella directory corretta (Linux, non Windows!)
cd /var/www/ticketapp

# Aggiorna il codice
git pull origin main

# Riavvia il backend
pm2 restart ticketapp-backend

# Verifica
pm2 status
pm2 logs ticketapp-backend --lines 20
```

Poi ricarica il dashboard crypto nel browser (Ctrl+Shift+R) e verifica che gli errori 502 siano spariti!

## Quando Usare Deploy Manuale vs Automatico

**Usa Deploy Manuale se:**
- ✅ Vuoi applicare il fix **immediatamente**
- ✅ GitHub Actions non funziona o non è configurato
- ✅ Hai bisogno di controllare ogni passaggio
- ✅ Stai facendo modifiche direttamente sul server

**Usa Deploy Automatico se:**
- ✅ GitHub Actions è configurato correttamente
- ✅ Puoi aspettare 2-3 minuti
- ✅ Vuoi che tutto sia tracciato su GitHub
