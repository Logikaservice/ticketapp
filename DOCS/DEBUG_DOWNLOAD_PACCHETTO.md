# Debug Download Pacchetto Agent

## Problema
Errore "Errore interno del server" quando si scarica il pacchetto ZIP dell'agent.

## Verifica file sulla VPS

I file devono essere presenti nella cartella `agent/`:
```bash
cd /var/www/ticketapp
ls -la agent/
```

Dovresti vedere:
- `NetworkMonitor.ps1`
- `InstallerCompleto.ps1`

## Controllo log backend

### Opzione 1: PM2 logs (consigliato)
```bash
pm2 logs backend
```
Oppure solo ultimi 100 righe:
```bash
pm2 logs backend --lines 100
```

### Opzione 2: PM2 logs senza scroll
```bash
pm2 logs backend --nostream --lines 200
```

### Opzione 3: Cerca nei log per errore download
```bash
pm2 logs backend --nostream | grep -i "download\|pacchetto\|agent"
```

## Cosa verificare nei log

Quando provi a scaricare il pacchetto, nei log dovresti vedere:

```
📦 Download pacchetto agent - Path ricerca file:
  __dirname: /var/www/ticketapp/backend/routes
  process.cwd(): /var/www/ticketapp
  Project root: /var/www/ticketapp
  Agent dir: /var/www/ticketapp/agent
  NetworkMonitor.ps1: /var/www/ticketapp/agent/NetworkMonitor.ps1
    exists: true/false
  InstallerCompleto.ps1: /var/www/ticketapp/agent/InstallerCompleto.ps1
    exists: true/false
```

Se `exists: false`, il path non è corretto.

## Test rapido path

Puoi testare manualmente quale path funziona:
```bash
cd /var/www/ticketapp
node -e "const path = require('path'); const fs = require('fs'); console.log('process.cwd():', process.cwd()); console.log('agent dir:', path.join(process.cwd(), 'agent')); console.log('exists:', fs.existsSync(path.join(process.cwd(), 'agent', 'NetworkMonitor.ps1')));"
```

## Soluzione temporanea

Se i file non vengono trovati, puoi creare un link simbolico:
```bash
cd /var/www/ticketapp
# Verifica dove si trova effettivamente la cartella agent
find . -name "NetworkMonitor.ps1" -type f
```

## Ripristino backend dopo verifica

Dopo aver verificato i log:
```bash
cd /var/www/ticketapp
pm2 restart backend
```
