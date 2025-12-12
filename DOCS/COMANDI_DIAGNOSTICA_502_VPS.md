# 🔧 Comandi Diagnostica 502 - Da Eseguire sulla VPS

## ✅ Comandi da Eseguire (Copia e Incolla)

Sei già connesso alla VPS come root. Esegui questi comandi in ordine:

### 1. Verifica se il backend è in ascolto sulla porta 3001

```bash
netstat -tuln | grep 3001
```

**Risultato atteso:**
- Se vedi `:3001` → Backend è attivo ✅
- Se non vedi nulla → Backend NON è attivo ❌

### 2. Verifica processi PM2

```bash
pm2 list
```

**Cosa cercare:**
- Cerca un processo chiamato `ticketapp-backend` o simile
- Verifica lo stato: deve essere `online` (non `errored` o `stopped`)

### 3. Se il processo esiste ma è in errore, riavvialo

```bash
# Riavvia il backend (usa il nome esatto che vedi in pm2 list)
pm2 restart ticketapp-backend
# oppure prova:
pm2 restart all
```

### 4. Se il processo NON esiste, avvialo

```bash
cd /var/www/ticketapp/backend
pm2 start index.js --name ticketapp-backend --cwd /var/www/ticketapp/backend
pm2 save
```

### 5. Verifica i log per vedere se ci sono errori

```bash
pm2 logs ticketapp-backend --lines 50 --nostream
```

**Cosa cercare:**
- ✅ `Server backend in ascolto sulla porta 3001` → OK
- ❌ Errori di connessione database → Problema DB
- ❌ `Cannot find module` → Problema dipendenze
- ❌ `Port 3001 already in use` → Porta occupata

### 6. Test se il backend risponde localmente

```bash
curl http://localhost:3001/api/health
```

**Risultato atteso:**
- HTTP 200 o 404 → Backend risponde ✅
- `Connection refused` → Backend NON risponde ❌

### 7. Se il backend non risponde, prova ad avviarlo manualmente per vedere l'errore

```bash
cd /var/www/ticketapp/backend
node index.js
```

**Questo mostrerà l'errore esatto.** Premi `Ctrl+C` per fermarlo dopo aver visto l'errore.

---

## 🔄 Soluzione Rapida Completa

Se vuoi fare tutto in una volta, esegui questo blocco di comandi:

```bash
# Vai nella directory backend
cd /var/www/ticketapp/backend

# Verifica se PM2 ha il processo
pm2 list | grep -i ticket

# Se esiste, riavvialo
pm2 restart ticketapp-backend 2>/dev/null || pm2 restart all

# Se non esiste, avvialo
if ! pm2 list | grep -q "ticketapp-backend"; then
    pm2 start index.js --name ticketapp-backend --cwd /var/www/ticketapp/backend
    pm2 save
fi

# Attendi 3 secondi
sleep 3

# Verifica stato
pm2 status

# Test endpoint
curl -s -o /dev/null -w "Health: %{http_code}\n" http://localhost:3001/api/health
curl -s -o /dev/null -w "Crypto: %{http_code}\n" http://localhost:3001/api/crypto/dashboard

# Mostra ultimi log
pm2 logs ticketapp-backend --lines 20 --nostream
```

---

## 🆘 Se il Backend Continua a Crashare

Se vedi errori nei log, ecco le soluzioni comuni:

### Errore: "Cannot connect to database"

```bash
# Verifica che PostgreSQL sia attivo
systemctl status postgresql

# Se non è attivo, avvialo
systemctl start postgresql

# Verifica le variabili d'ambiente
cd /var/www/ticketapp/backend
cat .env | grep DATABASE_URL
```

### Errore: "Cannot find module"

```bash
cd /var/www/ticketapp/backend
npm install
```

### Errore: "Port 3001 already in use"

```bash
# Trova quale processo usa la porta
lsof -i :3001
# oppure
fuser -k 3001/tcp

# Poi riavvia PM2
pm2 restart ticketapp-backend
```

---

## ✅ Verifica Finale

Dopo aver riavviato il backend:

1. **Verifica che sia online:**
   ```bash
   pm2 list
   ```
   Deve mostrare `online` (verde)

2. **Test endpoint:**
   ```bash
   curl http://localhost:3001/api/health
   ```

3. **Apri il browser e prova:**
   - Vai su `https://ticket.logikaservice.it/?domain=crypto`
   - Gli errori 502 dovrebbero essere spariti

---

## 📋 Checklist

- [ ] Porta 3001 è in ascolto (`netstat -tuln | grep 3001`)
- [ ] PM2 mostra processo `online` (`pm2 list`)
- [ ] Backend risponde localmente (`curl http://localhost:3001/api/health`)
- [ ] Nessun errore nei log (`pm2 logs ticketapp-backend`)
- [ ] Il sito web funziona senza errori 502



