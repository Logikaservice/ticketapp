# 🚀 Comandi SSH Rapidi per Connettersi al VPS

## IP Server: 159.69.121.162

## Passo 1: Verifica Chiavi SSH Disponibili

### Su Windows (PowerShell):

```powershell
# Vedi tutte le chiavi SSH disponibili
ls ~/.ssh/

# Vedi la chiave pubblica (se esiste id_rsa)
cat ~/.ssh/id_rsa.pub

# Vedi tutte le chiavi pubbliche
Get-ChildItem ~/.ssh/*.pub
```

### Su Linux/Mac:

```bash
# Vedi tutte le chiavi SSH disponibili
ls -la ~/.ssh/

# Vedi la chiave pubblica
cat ~/.ssh/id_rsa.pub
```

---

## Passo 2: Connettiti al Server

### Comando Base (Prova Prima Questo):

```bash
ssh root@159.69.121.162
```

Se funziona, sei dentro! ✅

---

### Se Chiede Password o Non Funziona:

#### Opzione A: Specifica la Chiave Esplicitamente

```bash
# Se la chiave si chiama id_rsa (standard)
ssh -i ~/.ssh/id_rsa root@159.69.121.162

# Se la chiave ha un nome diverso (es. id_ed25519)
ssh -i ~/.ssh/id_ed25519 root@159.69.121.162

# Se la chiave è in un'altra posizione
ssh -i C:\Users\TuoNome\.ssh\nome_chiave root@159.69.121.162
```

#### Opzione B: Su Windows PowerShell

```powershell
# Comando base
ssh root@159.69.121.162

# Con chiave specifica
ssh -i $env:USERPROFILE\.ssh\id_rsa root@159.69.121.162
```

---

## Passo 3: Se Non Funziona - Verifica Chiave

### Verifica Quale Chiave Hai:

```powershell
# Su Windows PowerShell
Get-ChildItem ~/.ssh/*.pub | ForEach-Object { Write-Host $_.Name; Get-Content $_.FullName }
```

Questo ti mostrerà tutte le chiavi pubbliche disponibili.

---

## Passo 4: Comandi Dopo la Connessione

Una volta connesso, esegui questi comandi per riavviare il backend:

```bash
# Verifica stato backend
pm2 status

# Riavvia backend
pm2 restart ticketapp-backend

# Se non funziona, prova:
pm2 restart all

# Verifica che sia in esecuzione
pm2 status

# Verifica porta 3001
netstat -tlnp | grep 3001
```

---

## Troubleshooting

### Errore: "Permission denied (publickey)"

**Soluzione:** La chiave SSH non è configurata sul server. Devi:
1. Copiare la chiave pubblica: `cat ~/.ssh/id_rsa.pub`
2. Aggiungerla al server tramite console Hetzner (vedi GUIDA_ACCESSO_VPS.md)

### Errore: "Connection refused"

**Soluzione:** Il server potrebbe essere spento o la porta SSH bloccata.
- Verifica su console Hetzner che il server sia attivo

### Errore: "Host key verification failed"

**Soluzione:** Rimuovi la chiave vecchia:
```bash
ssh-keygen -R 159.69.121.162
```

---

## Comando Completo (Copia e Incolla)

```bash
ssh root@159.69.121.162
```

**Se non funziona, prova:**
```bash
ssh -i ~/.ssh/id_rsa root@159.69.121.162
```
