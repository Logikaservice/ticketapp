# 🚀 Completamento Deploy - Verifica e Fix

## Stato Attuale

- ✅ Backend riavviato: `pm2 restart ticketapp-backend` completato
- ✅ Codice aggiornato: `git pull origin main` completato
- ✅ Fix errori 500 su `/api/crypto/statistics` committato e pushato

## Verifica Backend Funzionante

### Sul Server (dove sei già connesso):

```bash
# 1. Verifica che PM2 sia in esecuzione
pm2 status

# 2. Verifica che il backend risponda sulla porta 3001
curl http://localhost:3001/api/tickets

# 3. Verifica che risponda tramite nginx
curl http://localhost/api/tickets

# 4. Verifica log backend per errori
pm2 logs ticketapp-backend --lines 30

# 5. Verifica porta 3001
netstat -tlnp | grep 3001
```

### Se il Backend Non Risponde:

```bash
# Riavvia backend
pm2 restart ticketapp-backend

# Se non funziona, riavvia tutto
pm2 restart all

# Verifica di nuovo
pm2 status
curl http://localhost:3001/api/tickets
```

---

## Verifica Fix Errori 500

### Test Endpoint Statistics:

```bash
# Test endpoint statistics (quello che abbiamo fixato)
curl http://localhost:3001/api/crypto/statistics

# Se restituisce JSON, funziona! ✅
# Se restituisce errore 500, c'è ancora un problema
```

### Se C'è Ancora Errore 500:

```bash
# Verifica log per vedere l'errore esatto
pm2 logs ticketapp-backend --lines 50 | grep -i error

# Verifica che il codice sia aggiornato
cd /var/www/ticketapp
git log -1
# Dovrebbe mostrare il commit "Fix: Risolto errore 500 su /api/crypto/statistics"

# Se non è aggiornato, fai pull
git pull origin main

# Riavvia backend
pm2 restart ticketapp-backend
```

---

## Verifica Frontend

### Controlla che il Build Sia Aggiornato:

```bash
cd /var/www/ticketapp/frontend

# Verifica che ci sia la directory build
ls -la build/

# Se non c'è o è vecchio, fai rebuild
npm install
npm run build

# Verifica che nginx serva i file corretti
ls -la /var/www/ticketapp/frontend/build/
```

---

## Riavvio Completo (Se Necessario)

```bash
cd /var/www/ticketapp

# 1. Aggiorna codice
git pull origin main

# 2. Backend - reinstalla dipendenze se necessario
cd backend
npm install --production

# 3. Riavvia backend
pm2 restart ticketapp-backend

# 4. Frontend - rebuild se necessario
cd ../frontend
npm install
npm run build

# 5. Riavvia nginx
sudo systemctl restart nginx

# 6. Verifica tutto
pm2 status
curl http://localhost:3001/api/tickets
curl http://localhost/api/tickets
```

---

## Test Finale dal Browser

1. **Vai su:** https://ticket.logikaservice.it
2. **Apri console browser** (F12)
3. **Verifica:**
   - ✅ Nessun errore 502
   - ✅ Nessun errore 500 su `/api/crypto/statistics`
   - ✅ Le statistiche si caricano correttamente
   - ✅ Le posizioni aperte si visualizzano (se ci sono)

---

## Se GitHub Actions Non Ha Fatto Deploy

Se il workflow GitHub Actions non è partito o è fallito:

1. **Vai su:** https://github.com/Logikaservice/ticketapp/actions
2. **Verifica ultimo workflow:**
   - Se è fallito, clicca e vedi l'errore
   - Se non è partito, clicca "Run workflow" → `main` → "Run workflow"
3. **Oppure fai deploy manuale** (vedi comandi sopra)

---

## Checklist Completa

- [ ] Backend in esecuzione (`pm2 status` mostra `online`)
- [ ] Backend risponde su porta 3001 (`curl http://localhost:3001/api/tickets`)
- [ ] Nginx funziona (`curl http://localhost/api/tickets`)
- [ ] Endpoint statistics funziona (`curl http://localhost:3001/api/crypto/statistics`)
- [ ] Frontend build aggiornato
- [ ] Nessun errore 502 nel browser
- [ ] Nessun errore 500 nel browser
- [ ] Dashboard crypto funziona correttamente

---

## Comandi Rapidi (Copia e Incolla)

```bash
# Verifica tutto in una volta
pm2 status && \
curl -s http://localhost:3001/api/tickets | head -20 && \
curl -s http://localhost/api/tickets | head -20 && \
curl -s http://localhost:3001/api/crypto/statistics | head -20
```

Se tutti i comandi restituiscono output (non errori), tutto funziona! ✅
