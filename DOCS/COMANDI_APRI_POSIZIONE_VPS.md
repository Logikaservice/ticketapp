# Comandi per aprire posizione SAND sulla VPS

## Problema
Le posizioni sono state aperte solo localmente, non sulla VPS. Il dashboard sulla VPS non vede le posizioni perché non sono nel database della VPS.

## Soluzione: Aprire la posizione direttamente sulla VPS

```bash
# 1. Connettiti alla VPS
ssh root@159.69.121.162

# 2. Vai nella directory backend
cd /var/www/ticketapp/backend

# 3. Apri la posizione SAND
node open_sand_position.js

# 4. Verifica che sia stata aperta
node verify_sand_position.js

# 5. Scarica klines se mancanti
node download_klines.js all

# 6. Riavvia il backend per applicare il fix analysisParams
pm2 restart ticketapp-backend

# 7. Verifica i log
pm2 logs ticketapp-backend --lines 20
```

## Dopo questi passaggi
1. Ricarica la pagina del dashboard (F5)
2. La posizione SAND dovrebbe essere visibile

## Nota
Se vuoi aprire posizioni per altri simboli, puoi modificare `open_sand_position.js` o creare script simili per altri simboli.

