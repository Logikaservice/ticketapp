# ⚡ Soluzione Rapida per Errori 502

## Problema Immediato
Il backend non risponde → Errori 502 Bad Gateway

## Soluzione Rapida (5 minuti)

### Opzione 1: Riavvio Backend via SSH (Raccomandato)

Connettiti al server VPS e riavvia il backend:

```bash
# Connettiti al server
ssh root@159.69.121.162

# Riavvia backend con PM2
pm2 restart ticketapp-backend

# Se PM2 non funziona, prova:
pm2 restart all

# Verifica che sia in esecuzione
pm2 status
```

### Opzione 2: Deploy Manuale Completo

Se il riavvio non funziona, fai un deploy completo:

```bash
ssh root@159.69.121.162

cd /var/www/ticketapp

# Aggiorna codice
git pull origin main

# Installa dipendenze backend
cd backend
npm install --production

# Riavvia backend
pm2 restart ticketapp-backend || pm2 start backend/index.js --name ticketapp-backend

# Verifica
pm2 status
curl http://localhost:3001/api/tickets
```

### Opzione 3: Verifica GitHub Actions

1. Vai su: https://github.com/Logikaservice/ticketapp/actions
2. Verifica se il workflow "Deploy to VPS" è partito dopo il push
3. Se non è partito, clicca "Run workflow" → seleziona `main` → "Run workflow"

## Verifica Rapida

Dopo il riavvio, verifica che funzioni:

1. **Backend locale:**
   ```bash
   curl http://localhost:3001/api/tickets
   ```

2. **Tramite nginx:**
   ```bash
   curl http://localhost/api/tickets
   ```

3. **Da browser:**
   - Vai su: https://ticket.logikaservice.it
   - Apri console (F12)
   - Verifica che non ci siano più errori 502

## Se Nulla Funziona

Esegui lo script di diagnostica completo:

```bash
cd /var/www/ticketapp
bash verifica-backend.sh
```

Questo ti dirà esattamente cosa non funziona.
