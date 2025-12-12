# Guida Configurazione Secrets GitHub Actions

## Passo 1: Accedi a GitHub

1. Vai su: https://github.com/Logikaservice/ticketapp
2. Clicca su **Settings** (in alto nella barra del repository)
3. Nel menu a sinistra, clicca su **Secrets and variables** → **Actions**

## Passo 2: Aggiungi i Secrets

Clicca su **New repository secret** per ogni secret da aggiungere:

### Secret 1: VPS_HOST
- **Name:** `VPS_HOST`
- **Secret:** L'indirizzo IP o dominio del tuo VPS
  - Esempio: `159.69.121.162`
  - Oppure: `ticket.logikaservice.it` (se configurato)

### Secret 2: VPS_USER
- **Name:** `VPS_USER`
- **Secret:** Il nome utente SSH per accedere al VPS
  - Esempio: `root`
  - Oppure: `ubuntu` (dipende dalla configurazione del VPS)

### Secret 3: VPS_SSH_KEY
- **Name:** `VPS_SSH_KEY`
- **Secret:** La chiave SSH privata completa

#### Come ottenere la chiave SSH privata:

**Opzione A: Se hai già una chiave SSH sul tuo computer:**
```bash
# Su Windows (PowerShell)
cat ~/.ssh/id_rsa

# Oppure se la chiave ha un nome diverso
cat ~/.ssh/nome_chiave
```

**Opzione B: Se non hai una chiave SSH:**
1. Genera una nuova chiave SSH:
```bash
ssh-keygen -t rsa -b 4096 -C "github-actions@ticketapp"
```
2. Copia la chiave privata:
```bash
cat ~/.ssh/id_rsa
```
3. **IMPORTANTE:** Aggiungi la chiave pubblica al VPS:
```bash
# Copia la chiave pubblica
cat ~/.ssh/id_rsa.pub

# Poi sul VPS, aggiungila a authorized_keys:
ssh root@159.69.121.162
mkdir -p ~/.ssh
echo "TUA_CHIAVE_PUBBLICA_QUI" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

**Opzione C: Se usi una chiave SSH esistente sul VPS:**
1. Connettiti al VPS:
```bash
ssh root@159.69.121.162
```
2. Se hai già una chiave SSH configurata, puoi usare quella esistente
3. Altrimenti, genera una nuova chiave come sopra

### Secret 4: VPS_PORT (Opzionale)
- **Name:** `VPS_PORT`
- **Secret:** La porta SSH (default: `22`)
  - Se non configurato, userà la porta 22 di default

## Passo 3: Verifica i Secrets

Dopo aver aggiunto tutti i secrets, dovresti vedere:
- ✅ VPS_HOST
- ✅ VPS_USER
- ✅ VPS_SSH_KEY
- (Opzionale) VPS_PORT

## Passo 4: Test del Deploy

1. Vai su **Actions** nel repository
2. Fai un nuovo push o clicca su **Run workflow** manualmente
3. Controlla i log per verificare che la connessione funzioni

## Troubleshooting

### Errore: "Host key verification failed"
- Aggiungi il VPS ai known_hosts di GitHub Actions (non necessario se usi `strict_host_key_checking: false`)

### Errore: "Permission denied (publickey)"
- Verifica che la chiave SSH privata sia corretta
- Verifica che la chiave pubblica sia in `~/.ssh/authorized_keys` sul VPS
- Verifica i permessi: `chmod 600 ~/.ssh/authorized_keys`

### Errore: "Connection refused"
- Verifica che l'IP/dominio sia corretto
- Verifica che la porta SSH sia aperta (default: 22)
- Verifica che il servizio SSH sia attivo sul VPS: `sudo systemctl status ssh`

## Note Importanti

⚠️ **NON condividere mai i secrets pubblicamente!**
⚠️ **NON committare mai le chiavi SSH nel repository!**
✅ I secrets sono visibili solo a chi ha accesso amministrativo al repository
✅ I secrets sono criptati da GitHub

