# Comandi Deploy VPS

## Deploy completo sulla VPS

Connettiti alla VPS via SSH e esegui questi comandi:

```bash
# 1. Connettiti alla VPS (sostituisci con i tuoi dati)
# ssh utente@indirizzo-vps

# 2. Vai nella directory dell'applicazione
cd /var/www/ticketapp

# 3. Esegui lo script di deploy
bash deploy-manuale-vps.sh
```

## Oppure comandi manuali passo-passo:

```bash
# 1. Vai nella directory
cd /var/www/ticketapp

# 2. Aggiorna codice da GitHub
git fetch origin
git pull origin main

# 3. Backend - Installa dipendenze
cd backend
npm install --production
cd ..

# 4. Frontend - Build (con pulizia cache)
cd frontend
rm -rf build node_modules/.cache .cache .eslintcache
npm install
npm run build
cd ..

# 5. Riavvia PM2
pm2 restart all

# 6. Riavvia Nginx
sudo systemctl restart nginx

# 7. Verifica status
pm2 status
pm2 logs --lines 50
```

## Verifica del deploy

Dopo il deploy, controlla:
- ✅ PM2 è in esecuzione: `pm2 status`
- ✅ Log backend: `pm2 logs --lines 50`
- ✅ Il frontend mostra i nuovi segnali nel Market Scanner
- ✅ Svuota cache browser (Ctrl+Shift+R)

## Note importanti

- Lo script esegue una pulizia completa della cache del frontend
- Il build frontend potrebbe richiedere 2-3 minuti
- Assicurati che il backend risponda su `http://localhost:3001`
