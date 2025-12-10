# Comandi per aprire posizione SAND sulla VPS

## Opzione 1: Script automatico (consigliato)

```bash
ssh root@159.69.121.162
cd /var/www/ticketapp/backend
chmod +x setup_sand_position_vps.sh
./setup_sand_position_vps.sh
```

## Opzione 2: Comandi manuali

```bash
# 1. Connettiti alla VPS
ssh root@159.69.121.162

# 2. Vai nella directory backend
cd /var/www/ticketapp/backend

# 3. Aggiorna codice
git pull origin main

# 4. Apri posizione SAND
node open_sand_position.js

# 5. Verifica
node verify_sand_position.js

# 6. Scarica klines
node download_klines.js all

# 7. Riavvia backend
pm2 restart ticketapp-backend
```

## Dopo l'esecuzione

1. Ricarica la pagina del dashboard (F5)
2. La posizione SAND dovrebbe essere visibile

