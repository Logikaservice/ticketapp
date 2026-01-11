# Fix Download Pacchetto Agent - VPS

## Problema
Errore "Errore interno del server" quando si scarica il pacchetto ZIP.

## Soluzione

### 1. Riavvia il backend sulla VPS

```bash
cd /var/www/ticketapp/backend
pm2 restart backend
```

Oppure:
```bash
cd /var/www/ticketapp
pm2 restart backend
```

### 2. Installa dipendenza archiver (se mancante)

Il modulo `archiver` è necessario per creare i file ZIP. Verifica se è installato:

```bash
cd /var/www/ticketapp/backend
npm list archiver
```

Se non è installato, installalo:

```bash
cd /var/www/ticketapp/backend
npm install archiver --save
pm2 restart backend
```

### 3. Verifica che i file esistano

```bash
cd /var/www/ticketapp
ls -la agent/NetworkMonitor.ps1
ls -la agent/InstallerCompleto.ps1
```

Entrambi devono esistere.

### 4. Prova di nuovo a scaricare

Dopo aver riavviato il backend e verificato i file, prova di nuovo a scaricare il pacchetto dalla dashboard.

### 5. Controlla i log se ancora non funziona

```bash
pm2 logs backend --nostream --lines 200 | grep -i "download\|pacchetto\|agent\|📦\|❌"
```

Oppure tutti i log recenti:
```bash
pm2 logs backend --nostream --lines 100
```

## Ordine di esecuzione consigliato

1. **Verifica file esistono**: `ls -la agent/`
2. **Installa archiver** (se necessario): `npm install archiver --save`
3. **Riavvia backend**: `pm2 restart backend`
4. **Prova download** dalla dashboard
5. **Controlla log** se ancora non funziona
