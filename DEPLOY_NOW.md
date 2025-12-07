# Comandi Deploy VPS - Aggiornamento Bot

## Deploy rapido

```bash
cd /var/www/ticketapp
git pull origin main
pm2 restart ticketapp-backend
pm2 logs --lines 50
```

## Deploy completo (se necessario)

```bash
cd /var/www/ticketapp
bash deploy-manuale-vps.sh
```

## Verifica dopo deploy

```bash
# Controlla status
pm2 status

# Controlla log per errori
pm2 logs ticketapp-backend --lines 100

# Test endpoint
curl -I http://localhost:3001/api/crypto/dashboard
```
