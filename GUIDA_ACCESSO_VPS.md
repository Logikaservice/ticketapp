# 🔐 Guida Accesso al Server VPS

## IP Server: 159.69.121.162

## Metodi di Accesso

### Metodo 1: Chiave SSH (Raccomandato - Più Sicuro)

Se hai già una chiave SSH configurata:

```bash
# Prova a connetterti con la chiave SSH
ssh root@159.69.121.162

# Se la chiave è in una posizione diversa
ssh -i ~/.ssh/nome_chiave root@159.69.121.162
```

**Se non hai una chiave SSH:**
1. Genera una nuova chiave SSH sul tuo computer:
   ```bash
   ssh-keygen -t rsa -b 4096 -C "tuo-email@example.com"
   ```
2. Copia la chiave pubblica:
   ```bash
   cat ~/.ssh/id_rsa.pub
   ```
3. Aggiungi la chiave al server tramite il provider (vedi Metodo 3)

---

### Metodo 2: Password SSH (Se Configurata)

Se il server accetta password:

```bash
ssh root@159.69.121.162
# Ti chiederà la password
```

**Se non ricordi la password:**
- Vedi Metodo 3 per resettarla tramite il provider

---

### Metodo 3: Accesso Tramite Provider (Hetzner Cloud Console)

L'IP `159.69.121.162` sembra essere un server **Hetzner**.

#### Passi per Accedere:

1. **Vai alla Console Hetzner:**
   - https://console.hetzner.cloud/
   - Accedi con le tue credenziali Hetzner

2. **Trova il Server:**
   - Vai su "Servers" nel menu
   - Cerca il server con IP `159.69.121.162`
   - Clicca sul server

3. **Opzioni Disponibili:**

   **A) Console (NoVNC) - Accesso Diretto:**
   - Clicca su "Console" nel menu del server
   - Ti permette di accedere direttamente al server senza SSH
   - Puoi resettare la password da qui

   **B) Reset Password Root:**
   - Clicca su "Reset Root Password"
   - Hetzner genererà una nuova password
   - **IMPORTANTE:** Salva la password in un posto sicuro!
   - Riavvia il server se necessario

   **C) Aggiungi Chiave SSH:**
   - Vai su "SSH Keys" nel menu del server
   - Aggiungi la tua chiave pubblica SSH
   - Poi puoi accedere senza password

4. **Accesso via Console NoVNC:**
   - Clicca su "Console" → "Launch Console"
   - Si aprirà una finestra browser con accesso diretto
   - Puoi fare login come root e cambiare password

---

### Metodo 4: Reset Password via Provider

#### Per Hetzner:

1. Vai su: https://console.hetzner.cloud/
2. Seleziona il server `159.69.121.162`
3. Clicca su **"Reset Root Password"**
4. Salva la nuova password generata
5. Riavvia il server se richiesto
6. Connettiti con:
   ```bash
   ssh root@159.69.121.162
   # Usa la nuova password
   ```

---

### Metodo 5: Verifica Chiavi SSH Esistenti

Se pensi di avere già una chiave SSH configurata:

```bash
# Su Windows (PowerShell)
# Verifica chiavi SSH esistenti
ls ~/.ssh/

# Prova a connetterti
ssh root@159.69.121.162

# Se chiede password, prova a vedere se c'è una chiave configurata
cat ~/.ssh/id_rsa.pub
```

---

## Verifica Accesso

Dopo aver ottenuto l'accesso, verifica:

```bash
# Connettiti
ssh root@159.69.121.162

# Verifica che sei connesso
whoami  # Dovrebbe mostrare "root"

# Verifica stato backend
pm2 status

# Verifica porta 3001
netstat -tlnp | grep 3001
```

---

## Se Non Riesci ad Accedere

### Opzione A: Contatta Supporto Provider

Se è un server Hetzner:
- Vai su: https://console.hetzner.cloud/
- Apri un ticket di supporto
- Richiedi assistenza per accesso al server

### Opzione B: Verifica Credenziali GitHub Actions

Se GitHub Actions funziona, significa che c'è una chiave SSH configurata:

1. Vai su: https://github.com/Logikaservice/ticketapp/settings/secrets/actions
2. Verifica il secret `VPS_SSH_KEY`
3. Questa è la chiave privata SSH che funziona
4. Puoi usarla per accedere manualmente (salvala come file e usa `ssh -i file root@159.69.121.162`)

**⚠️ ATTENZIONE:** Non condividere mai la chiave privata pubblicamente!

---

## Configurazione Chiave SSH Permanente

Dopo aver ottenuto l'accesso, configura una chiave SSH per accesso futuro:

```bash
# Sul tuo computer locale, genera chiave se non ce l'hai
ssh-keygen -t rsa -b 4096

# Copia la chiave pubblica
cat ~/.ssh/id_rsa.pub

# Sul server VPS, aggiungi la chiave
ssh root@159.69.121.162
mkdir -p ~/.ssh
echo "TUA_CHIAVE_PUBBLICA_QUI" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

Ora puoi accedere senza password!

---

## Troubleshooting

### Errore: "Permission denied (publickey)"
- La chiave SSH non è configurata
- Usa Metodo 3 per accedere tramite console provider

### Errore: "Connection refused"
- Il server potrebbe essere spento
- Verifica su console provider che il server sia attivo

### Errore: "Host key verification failed"
- Rimuovi la chiave vecchia:
  ```bash
  ssh-keygen -R 159.69.121.162
  ```

---

## Note Importanti

- **Non condividere mai password o chiavi SSH pubblicamente**
- **Usa sempre chiavi SSH invece di password quando possibile**
- **Salva le password in un password manager sicuro**
- **Abilita 2FA sul provider (Hetzner) per maggiore sicurezza**
