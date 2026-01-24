# 🔍 Diagnostica Errori 502 Bad Gateway

## Problema
Gli errori **502 Bad Gateway** indicano che nginx non riesce a raggiungere il backend Node.js su `http://127.0.0.1:3001`.

## Cause Possibili

1. **Backend non in esecuzione** - Il processo Node.js è crashato o non è stato avviato
2. **Backend non in ascolto sulla porta 3001** - Il backend potrebbe essere su una porta diversa
3. **Deploy non completato** - Le modifiche non sono state deployate sul server VPS
4. **Errore nel codice** - Il backend crashato all'avvio a causa di un errore

## Soluzione: Verifica e Riavvio Backend

### 1. Connettiti al Server VPS

```bash
ssh root@159.69.121.162
# oppure
ssh tuo-utente@159.69.121.162
```

### 2. Verifica Stato Backend

```bash
# Verifica se PM2 è in esecuzione
pm2 status

# Verifica se il backend è in ascolto sulla porta 3001
netstat -tlnp | grep 3001

# Verifica log backend
pm2 logs ticketapp-backend --lines 50
```

### 3. Verifica Processi Node.js

```bash
# Verifica tutti i processi Node.js
ps aux | grep node

# Verifica se c'è un processo sulla porta 3001
lsof -i :3001
```

### 4. Test Backend Locale

```bash
# Prova a connetterti al backend direttamente
curl http://localhost:3001/api/tickets

# Se non risponde, il backend non è in esecuzione
```

### 5. Riavvio Backend

```bash
cd /var/www/ticketapp

# Se usi PM2
pm2 restart ticketapp-backend
# oppure
pm2 restart all

# Se usi systemd
sudo systemctl restart ticketapp-backend
# oppure
sudo systemctl restart ticketapp
```

### 6. Verifica Deploy

```bash
cd /var/www/ticketapp

# Verifica che il codice sia aggiornato
git log -1

# Se non è aggiornato, fai pull
git pull origin main

# Reinstalla dipendenze backend
cd backend
npm install --production

# Riavvia backend
pm2 restart ticketapp-backend
```

### 7. Verifica Nginx

```bash
# Verifica configurazione nginx
sudo nginx -t

# Verifica log nginx per errori
sudo tail -50 /var/log/nginx/error.log

# Riavvia nginx
sudo systemctl restart nginx
```

## Script Automatico di Diagnostica

Esegui lo script di verifica:

```bash
cd /var/www/ticketapp
bash verifica-backend.sh
```

## Deploy Manuale Completo

Se il backend non risponde, fai un deploy completo:

```bash
cd /var/www/ticketapp

# 1. Aggiorna codice
git pull origin main

# 2. Installa dipendenze backend
cd backend
npm install --production

# 3. Riavvia backend con PM2
pm2 restart ticketapp-backend || pm2 start backend/index.js --name ticketapp-backend

# 4. Verifica che sia in esecuzione
pm2 status
netstat -tlnp | grep 3001

# 5. Riavvia nginx
sudo systemctl restart nginx
```

## Verifica Finale

Dopo il riavvio, verifica:

1. **Backend risponde localmente:**
   ```bash
   curl http://localhost:3001/api/tickets
   ```

2. **Backend risponde tramite nginx:**
   ```bash
   curl http://localhost/api/tickets
   ```

3. **Verifica da browser:**
   - Vai su: https://ticket.logikaservice.it
   - Apri console browser (F12)
   - Verifica che non ci siano più errori 502

## Se il Problema Persiste

1. **Controlla log backend:**
   ```bash
   pm2 logs ticketapp-backend --lines 100
   ```

2. **Controlla errori nel codice:**
   - Verifica che tutte le dipendenze siano installate
   - Verifica che le variabili d'ambiente siano configurate
   - Verifica che il database sia raggiungibile

3. **Riavvia tutto:**
   ```bash
   pm2 restart all
   sudo systemctl restart nginx
   ```

## Caso: `EADDRINUSE: address already in use :::3001`

Nei log vedi `listen EADDRINUSE: address already in use :::3001`. La porta 3001 è occupata: il backend non riesce a fare `server.listen` e PM2 lo riavvia in loop.

1. **Duplicati PM2:** `pm2 list` → se esistono sia `backend` che `ticketapp-backend`, elimina uno: `pm2 delete backend`.
2. **Libera la porta:** `pm2 stop ticketapp-backend` → `lsof -i :3001` o `fuser -k 3001/tcp` → `pm2 start ticketapp-backend`.

Vedi anche **COMANDI_DIAGNOSTICA_502_VPS.md** sezione "Port 3001 already in use".

---

## Caso: `column "unifi_config" does not exist`

La tabella `network_agents` in produzione non ha la colonna `unifi_config`. Dopo il deploy, la migrazione la aggiunge al primo utilizzo delle API di network monitoring. Se l’errore compare comunque:

1. Verificare che il codice aggiornato (con la migrazione in `ensureTables` / `initTables`) sia sul server.
2. Riavviare il backend: `pm2 restart ticketapp-backend`.
3. In alternativa, migrazione manuale:  
   `psql -U ... -d ... -c "ALTER TABLE network_agents ADD COLUMN IF NOT EXISTS unifi_config JSONB;"`

---

## Caso: PM2 "online" ma `curl` non risponde / nessuna porta 3001

Se `pm2 list` mostra `ticketapp-backend` **online** ma `curl -s http://127.0.0.1:3001/api/health` non dà output (o timeout / Connection refused), il processo è vivo ma **non ha mai messo in ascolto la porta 3001**. In `index.js`, `server.listen(PORT)` viene chiamato solo **dopo** connessione DB e una lunga inizializzazione (tabelle, Vivaldi, Network Monitoring). Se una di queste operazioni **si blocca**, il listen non viene mai eseguito.

### 1. Verificare se qualcosa ascolta sulla 3001

```bash
ss -tlnp | grep 3001
# oppure
netstat -tlnp | grep 3001
```

- **Nessun risultato** → il backend non è arrivato a `server.listen` (blocco in avvio).
- **Risultato presente** → il backend ascolta; se `curl` non risponde, può essere firewall o un altro problema.

### 2. Capire da `curl` se è “rifiutato” o “timeout”

```bash
curl -v --connect-timeout 5 http://127.0.0.1:3001/api/health
```

- **Connection refused** → nessun processo in ascolto sulla 3001 (coerente con blocco in avvio).
- **Timeout** → qualcosa ascolta ma non risponde, o blocco di rete.

### 3. Cercare nei log dove si ferma l’avvio

```bash
pm2 logs ticketapp-backend --lines 150 --nostream
```

Cerca **in ordine**:

| Messaggio | Significato |
|-----------|-------------|
| `Connessione al database riuscita!` | DB OK; se dopo non c’è “in ascolto”, il blocco è nella fase di init (tabelle, Vivaldi, ecc.). |
| `Server backend OTTIMIZZATO in ascolto sulla porta 3001` | `server.listen` eseguito; il backend **dovrebbe** rispondere. Se `curl` fallisce uguale, controllare nginx o firewalls. |
| `DATABASE_URL non trovato` / `Impossibile connettersi al database` | File `backend/.env` mancante o `DATABASE_URL` errato; `pool.connect()` fallisce e il processo può uscire (PM2 lo riavvia, quindi restarts > 0). |

Se vedi “Connessione al database riuscita!” ma **non** “in ascolto sulla porta 3001”, è probabile che un `pool.query` di inizializzazione (tabelle, Vivaldi, PackVision, Network Monitoring) sia lento o bloccato (lock DB, DB remoto lento, ecc.).

### 4. Verificare che `backend/.env` esista

Il deploy (GitHub Actions) **non** crea né copia `.env`; deve essere presente sul server.

```bash
# Controlla che .env esista e che DATABASE_URL e PORT siano impostati (non mostrare i valori in chiaro)
test -f /var/www/ticketapp/backend/.env && grep -q '^DATABASE_URL=' /var/www/ticketapp/backend/.env && echo "DATABASE_URL presente" || echo "DATABASE_URL mancante"
grep -q '^PORT=' /var/www/ticketapp/backend/.env 2>/dev/null && echo "PORT presente" || echo "PORT assente (verrà usato 3001)"
```

### 5. Avvio manuale per vedere dove si blocca

Ferma PM2 su quel processo, poi avvia a mano con timeout:

```bash
cd /var/www/ticketapp/backend
pm2 stop ticketapp-backend
timeout 90 node index.js
```

- Se vedi “in ascolto sulla porta 3001” → l’avvio in sé è OK; il problema potrebbe essere come PM2 avvia (cwd, env, `.env`).
- Se si blocca prima di quel messaggio → l’ultima riga stampata indica dove si ferma (DB, init tabelle, Vivaldi, ecc.).

Dopo il test: `pm2 start ticketapp-backend` (o `pm2 start index.js --name ticketapp-backend`).

### 6. Riepilogo comandi rapidi per questo caso

```bash
ss -tlnp | grep 3001
curl -v --connect-timeout 5 http://127.0.0.1:3001/api/health
pm2 logs ticketapp-backend --lines 150 --nostream
# Cercare: "Connessione al database riuscita!" e "in ascolto sulla porta 3001"
```

---

## Note Importanti

- Gli errori **502** sono diversi dagli errori **500** che abbiamo fixato
- **502** = Backend non raggiungibile (nginx non può connettersi)
- **500** = Backend raggiungibile ma errore interno del server
- Il fix che abbiamo fatto (errori 500 su `/api/crypto/statistics`) è corretto, ma il backend deve essere in esecuzione per funzionare
