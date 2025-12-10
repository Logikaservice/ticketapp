# Comandi completi per risolvere il problema sulla VPS

## Step 1: Aggiorna il codice dalla repository

```bash
# Connettiti alla VPS
ssh root@159.69.121.162

# Vai nella directory del progetto
cd /var/www/ticketapp

# Fai pull degli ultimi aggiornamenti (include gli script e il fix)
git pull origin main

# Vai nella directory backend
cd backend
```

## Step 2: Apri la posizione SAND

```bash
# Ora lo script dovrebbe essere disponibile
node open_sand_position.js

# Verifica che sia stata aperta
node verify_sand_position.js
```

## Step 3: Scarica klines mancanti

```bash
# Scarica klines per tutti i simboli con posizioni aperte
node download_klines.js all

# Verifica che siano state scaricate
node check_all_klines.js
```

## Step 4: Riavvia il backend

```bash
# Riavvia per applicare il fix analysisParams
pm2 restart ticketapp-backend

# Verifica i log (dovresti vedere meno errori)
pm2 logs ticketapp-backend --lines 30
```

## Step 5: Verifica nel dashboard

1. Ricarica la pagina del dashboard (F5)
2. Le posizioni dovrebbero ora essere visibili

## Se gli script ancora non ci sono

Se dopo `git pull` gli script non ci sono, verifica:

```bash
# Verifica se gli script esistono
ls -la backend/open_sand_position.js
ls -la backend/download_klines.js
ls -la backend/check_all_klines.js

# Se non ci sono, verifica lo stato git
git status
git log --oneline -5
```

