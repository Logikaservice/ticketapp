# 🔑 Recupero Chiave SSH Privata dal Server

## Situazione Attuale

Sei già connesso al server come `root`. Sul server hai trovato:
- `id_ed25519` (chiave privata)
- `id_ed25519.pub` (chiave pubblica)
- `github_actions` (altra chiave privata)
- `github_actions.pub` (chiave pubblica)

## Metodo 1: Copia la Chiave Privata (Raccomandato)

### Passo 1: Visualizza la Chiave Privata sul Server

Sul server (dove sei già connesso), esegui:

```bash
# Visualizza la chiave privata id_ed25519
cat ~/.ssh/id_ed25519

# Oppure visualizza la chiave github_actions
cat ~/.ssh/github_actions
```

### Passo 2: Copia l'Intero Contenuto

1. **Seleziona tutto l'output** del comando `cat` (dalla riga `-----BEGIN OPENSSH PRIVATE KEY-----` fino a `-----END OPENSSH PRIVATE KEY-----`)
2. **Copia** tutto il contenuto (Ctrl+C o tasto destro → Copy)

### Passo 3: Salva sul Tuo Computer Windows

Sul tuo computer Windows, crea un file con la chiave:

```powershell
# Crea la cartella .ssh se non esiste
New-Item -ItemType Directory -Force -Path ~/.ssh

# Crea il file con la chiave (incolla il contenuto quando richiesto)
notepad ~/.ssh/vps_key
# Oppure
code ~/.ssh/vps_key  # Se usi VS Code
```

**IMPORTANTE:** Incolla tutto il contenuto della chiave privata (inclusi `-----BEGIN` e `-----END`)

### Passo 4: Imposta Permessi Corretti (Su Windows)

```powershell
# Rimuovi permessi di lettura per altri utenti
icacls ~/.ssh/vps_key /inheritance:r
icacls ~/.ssh/vps_key /grant:r "$env:USERNAME:(R)"
```

### Passo 5: Usa la Chiave per Connettersi

```powershell
# Connettiti usando la chiave
ssh -i ~/.ssh/vps_key root@159.69.121.162
```

---

## Metodo 2: Usa SCP per Copiare la Chiave

### Dal Tuo Computer Windows (Nuovo Terminale)

Apri un **nuovo terminale PowerShell** sul tuo computer Windows e usa SCP:

```powershell
# Copia la chiave privata dal server al tuo computer
scp root@159.69.121.162:~/.ssh/id_ed25519 ~/.ssh/vps_key

# Se chiede password, inseriscila
# Poi imposta i permessi
icacls ~/.ssh/vps_key /inheritance:r
icacls ~/.ssh/vps_key /grant:r "$env:USERNAME:(R)"
```

**Nota:** Questo metodo richiede che tu abbia già accesso SSH (password o altra chiave).

---

## Metodo 3: Usa la Chiave GitHub Actions (Se Disponibile)

Se la chiave `github_actions` è quella usata da GitHub Actions, puoi recuperarla da GitHub:

1. Vai su: https://github.com/Logikaservice/ticketapp/settings/secrets/actions
2. Cerca il secret `VPS_SSH_KEY`
3. Copia il contenuto
4. Salvalo come `~/.ssh/vps_key` sul tuo computer
5. Usa: `ssh -i ~/.ssh/vps_key root@159.69.121.162`

---

## Metodo 4: Genera una Nuova Chiave e Aggiungila

### Sul Tuo Computer Windows:

```powershell
# Genera una nuova chiave SSH
ssh-keygen -t ed25519 -C "tuo-email@example.com" -f ~/.ssh/vps_key_new

# Visualizza la chiave pubblica
cat ~/.ssh/vps_key_new.pub
```

### Sul Server (dove sei già connesso):

```bash
# Aggiungi la nuova chiave pubblica al server
echo "INCOLLA_QUI_LA_CHIAVE_PUBBLICA" >> ~/.ssh/authorized_keys

# Verifica permessi
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### Poi Usa la Nuova Chiave:

```powershell
# Dal tuo computer Windows
ssh -i ~/.ssh/vps_key_new root@159.69.121.162
```

---

## Verifica Chiave Recuperata

Dopo aver salvato la chiave, verifica che funzioni:

```powershell
# Prova a connetterti
ssh -i ~/.ssh/vps_key root@159.69.121.162

# Se funziona, sei dentro! ✅
```

---

## Comandi Rapidi (Copia e Incolla)

### Sul Server (dove sei già connesso):

```bash
# Visualizza chiave privata id_ed25519
cat ~/.ssh/id_ed25519

# Oppure visualizza chiave github_actions
cat ~/.ssh/github_actions
```

### Sul Tuo Computer Windows:

```powershell
# Crea file e incolla la chiave
notepad ~/.ssh/vps_key

# Imposta permessi
icacls ~/.ssh/vps_key /inheritance:r
icacls ~/.ssh/vps_key /grant:r "$env:USERNAME:(R)"

# Connettiti
ssh -i ~/.ssh/vps_key root@159.69.121.162
```

---

## ⚠️ IMPORTANTE - Sicurezza

1. **NON condividere mai la chiave privata pubblicamente**
2. **NON committare mai la chiave privata su Git**
3. **Salva la chiave in un posto sicuro** (password manager o file criptato)
4. **Usa permessi corretti** (solo tu puoi leggere la chiave)

---

## Troubleshooting

### Errore: "Permissions are too open"

**Soluzione Windows:**
```powershell
icacls ~/.ssh/vps_key /inheritance:r
icacls ~/.ssh/vps_key /grant:r "$env:USERNAME:(R)"
```

### Errore: "Load key: invalid format"

**Soluzione:** Assicurati di aver copiato TUTTO il contenuto della chiave, inclusi:
- `-----BEGIN OPENSSH PRIVATE KEY-----`
- Tutto il contenuto in mezzo
- `-----END OPENSSH PRIVATE KEY-----`

### Errore: "Permission denied"

**Soluzione:** Verifica che la chiave pubblica corrispondente sia in `~/.ssh/authorized_keys` sul server.
