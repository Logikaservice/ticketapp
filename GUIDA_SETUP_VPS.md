# Guida Setup VPS - TicketApp

## 🎯 Obiettivo
Configurare il server VPS Hetzner per ospitare TicketApp in modo sicuro e passo-passo.

---

## 📋 Prerequisiti

- ✅ Server VPS creato su Hetzner
- ✅ Accesso SSH al server (password cambiata)
- ✅ IP del server: `159.69.121.162`

---

## 🚀 PASSO 1: Trasferire lo Script sul Server

### Opzione A: Creare lo script direttamente sul server (CONSIGLIATO)

1. **Collegati al server:**
   ```bash
   ssh root@159.69.121.162
   ```

2. **Crea il file script:**
   ```bash
   nano setup-vps.sh
   ```

3. **Copia e incolla il contenuto dello script** (ti darò il contenuto completo)

4. **Salva e esci:**
   - Premi `Ctrl + O` (salva)
   - Premi `Invio` (conferma)
   - Premi `Ctrl + X` (esci)

5. **Rendi lo script eseguibile:**
   ```bash
   chmod +x setup-vps.sh
   ```

### Opzione B: Trasferire il file via SCP

Se hai lo script sul tuo computer:
```bash
scp setup-vps.sh root@159.69.121.162:/root/
```

---

## 🚀 PASSO 2: Eseguire lo Script

1. **Assicurati di essere sul server:**
   ```bash
   ssh root@159.69.121.162
   ```

2. **Esegui lo script:**
   ```bash
   bash setup-vps.sh
   ```

3. **Segui le istruzioni:**
   - Lo script ti chiederà conferma ad ogni passo
   - Rispondi `s` (sì) o `n` (no) quando richiesto
   - Leggi attentamente ogni messaggio

---

## 📝 Cosa Fa lo Script (Passo-Passo)

### ✅ PASSO 1: Aggiornamento Sistema
- Aggiorna la lista dei pacchetti
- Aggiorna i pacchetti installati
- **Sicuro**: Non modifica configurazioni esistenti

### ✅ PASSO 2: Dipendenze Base
- Installa: `curl`, `wget`, `git`, `build-essential`
- Necessarie per installare altri software

### ✅ PASSO 3: Node.js
- Installa Node.js 18.x (LTS)
- Verifica se già installato (non sovrascrive se presente)
- Installa anche `npm`

### ✅ PASSO 4: PM2
- Installa PM2 globalmente
- Configura PM2 per avvio automatico al riavvio
- PM2 gestirà il processo Node.js del backend

### ✅ PASSO 5: Nginx
- Installa Nginx (web server)
- Avvia e abilita Nginx
- Nginx servirà il frontend e farà da reverse proxy per il backend

### ✅ PASSO 6: Certbot
- Installa Certbot per certificati SSL
- Necessario per HTTPS (Let's Encrypt)

### ✅ PASSO 7: Firewall
- Installa e configura UFW (firewall)
- Apre solo porte necessarie: 22 (SSH), 80 (HTTP), 443 (HTTPS)
- **Sicuro**: Blocca tutto il resto

### ✅ PASSO 8: Directory App
- Crea directory `/var/www/ticketapp`
- Crea sottocartelle: `backend`, `frontend`, `logs`
- Imposta permessi corretti

---

## ⚠️ Sicurezza dello Script

✅ **Non distruttivo:**
- Verifica se software è già installato
- Chiede conferma prima di modificare
- Non sovrascrive configurazioni esistenti senza chiedere

✅ **Gestione errori:**
- Si ferma se c'è un errore critico
- Mostra messaggi chiari
- Non continua se qualcosa va storto

✅ **Rollback:**
- Puoi interrompere lo script in qualsiasi momento (Ctrl+C)
- Le modifiche fatte fino a quel punto sono sicure
- Puoi rieseguire lo script (rileva cosa è già installato)

---

## 🔍 Verifica Installazione

Dopo lo script, verifica che tutto sia installato:

```bash
# Verifica Node.js
node -v
# Dovrebbe mostrare: v18.x.x

# Verifica npm
npm -v
# Dovrebbe mostrare: 9.x.x o 10.x.x

# Verifica PM2
pm2 -v
# Dovrebbe mostrare: 5.x.x

# Verifica Nginx
nginx -v
# Dovrebbe mostrare: nginx version: 1.x.x

# Verifica Certbot
certbot --version
# Dovrebbe mostrare: certbot 2.x.x

# Verifica Firewall
ufw status
# Dovrebbe mostrare le porte aperte
```

---

## 🐛 Risoluzione Problemi

### Problema: "Permission denied"
**Soluzione:** Esegui come root:
```bash
sudo bash setup-vps.sh
```

### Problema: "Command not found" dopo installazione
**Soluzione:** Riavvia la sessione SSH o esegui:
```bash
source ~/.bashrc
```

### Problema: Nginx non si avvia
**Soluzione:** Controlla i log:
```bash
systemctl status nginx
journalctl -u nginx
```

### Problema: Firewall blocca tutto
**Soluzione:** Verifica regole:
```bash
ufw status verbose
```

---

## 📞 Supporto

Se qualcosa non funziona:
1. Controlla i messaggi di errore nello script
2. Verifica i log del sistema
3. Assicurati di essere root
4. Controlla la connessione internet del server

---

## ✅ Prossimi Passi (Dopo lo Script)

1. **Clonare il repository:**
   ```bash
   cd /var/www/ticketapp
   git clone https://github.com/tuo-username/ticketapp.git .
   ```

2. **Configurare variabili d'ambiente:**
   ```bash
   cd /var/www/ticketapp/backend
   nano .env
   ```

3. **Installare dipendenze:**
   ```bash
   cd /var/www/ticketapp/backend
   npm install
   
   cd /var/www/ticketapp/frontend
   npm install
   ```

4. **Configurare Nginx** (il workflow copia automaticamente `deploy/nginx/ticketapp.conf` su `/etc/nginx/sites-available/ticketapp.conf`)

5. **Generare certificato SSL:**
   ```bash
   certbot --nginx -d ticket.logikaservice.it
   ```

6. **Avviare l'app con PM2:**
   ```bash
   cd /var/www/ticketapp/backend
   pm2 start index.js --name ticketapp-backend
   pm2 save
   ```

---

## 🎉 Fine Setup Base

Una volta completato lo script, il server sarà pronto per ospitare TicketApp!


