# Come Vedere i Log del Backend sulla VPS

## Problema
Il comando `pm2 logs backend` non funziona o non mostra output.

## Soluzione 1: Verifica Nome Processo PM2

Il processo potrebbe avere un nome diverso. Verifica:

```bash
# Sulla VPS
pm2 list
```

Cerca processi che potrebbero essere il backend:
- `backend`
- `ticketapp-backend`
- `ticketapp`
- Altri nomi

Una volta trovato il nome, usa:
```bash
# Esempio se si chiama "ticketapp-backend"
pm2 logs ticketapp-backend --lines 100
```

## Soluzione 2: Leggi i File di Log Direttamente

PM2 scrive i log in file. Leggili direttamente:

```bash
# Log standard output
tail -f /var/log/pm2/backend-out.log

# Log errori
tail -f /var/log/pm2/backend-error.log

# Ultime 100 righe
tail -n 100 /var/log/pm2/backend-out.log
tail -n 100 /var/log/pm2/backend-error.log

# Cerca errori specifici
grep -i "scan-results\|network-monitoring\|Errore\|ERROR" /var/log/pm2/backend-out.log
grep -i "scan-results\|network-monitoring\|Errore\|ERROR" /var/log/pm2/backend-error.log
```

## Soluzione 3: Se i File di Log Non Esistono

Se i file non esistono, verifica la configurazione PM2:

```bash
# Verifica configurazione PM2
pm2 show backend
# oppure
pm2 show ticketapp-backend
```

Vedrai dove sono configurati i log (campo "error log path" e "out log path").

## Soluzione 4: Test Diretto Backend (Vede Errori in Tempo Reale)

Se niente funziona, avvia il backend manualmente per vedere gli errori in tempo reale:

```bash
cd /var/www/ticketapp/backend
node index.js
```

**⚠️ ATTENZIONE:** Questo avvia il backend in modalità foreground. Vedrai tutti i log in tempo reale. Premi `Ctrl+C` per fermarlo dopo aver visto l'errore.

## Soluzione 5: Verifica Errori Recenti con journalctl (se usa systemd)

Se il backend usa systemd invece di PM2:

```bash
# Verifica servizio
systemctl status ticketapp-backend
# oppure
systemctl status backend

# Vedi log
journalctl -u ticketapp-backend -n 100
# oppure
journalctl -u backend -n 100
```

## Comando Rapido per Trovare Log Network Monitoring

Per trovare errori specifici del network monitoring:

```bash
# Combina tutti i log e cerca errori network monitoring
cat /var/log/pm2/*.log 2>/dev/null | grep -i "scan-results\|network-monitoring\|Errore.*scan\|ERROR.*scan" | tail -50

# Oppure se sai il nome del processo
pm2 logs ticketapp-backend --nostream --lines 200 | grep -i "scan-results\|network-monitoring"
```

## Verifica Backend Attivo

Prima di controllare i log, verifica che il backend sia attivo:

```bash
# Verifica processi PM2
pm2 status

# Verifica porta 3001
netstat -tuln | grep 3001
# oppure
ss -tuln | grep 3001

# Test endpoint
curl http://localhost:3001/api/health
```
