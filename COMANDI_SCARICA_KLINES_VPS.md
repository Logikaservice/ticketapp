# Comandi per scaricare klines sulla VPS

## Problema
Le posizioni non appaiono nel dashboard perché mancano le klines storiche sulla VPS per calcolare il sentimento bot.

## Soluzione
Esegui questi comandi sulla VPS per scaricare le klines mancanti:

```bash
# 1. Connettiti alla VPS
ssh root@159.69.121.162

# 2. Vai nella directory backend
cd /var/www/ticketapp/backend

# 3. Scarica klines per tutti i simboli con posizioni aperte
node download_klines.js all

# 4. Verifica che siano state scaricate
node check_all_klines.js
```

## Alternativa: Scarica klines per un simbolo specifico

```bash
# Per SAND
node download_klines.js sand

# Per BINANCE_COIN
node download_klines.js binance_coin

# Per BONK
node download_klines.js bonk
```

## Dopo lo scaricamento
1. Ricarica la pagina del dashboard (F5)
2. Le posizioni dovrebbero ora essere visibili

