# Recupero File Allegati Mancanti

## 🔍 Verifica Backup Disponibili

### 1. Cerca Backup sul Server

Esegui questo script per cercare backup:

```bash
cd /var/www/ticketapp
git pull
cd backend
node scripts/find-backup-files.js
```

### 2. Verifica Directory Backup Standard

```bash
# Verifica se ci sono backup nella directory standard
ls -la /var/backups/ticketapp/

# Se esistono, controlla il contenuto
find /var/backups/ticketapp -name "*upload*" -o -name "*photo*" 2>/dev/null
```

### 3. Cerca Snapshot del Filesystem

Se il tuo provider VPS (es. Hetzner, DigitalOcean, ecc.) offre snapshot:

- **Hetzner Cloud**: Controlla nella console web se ci sono snapshot
- **DigitalOcean**: Vai su "Snapshots" nella console
- **Altri provider**: Verifica nella dashboard se ci sono snapshot disponibili

### 4. Cerca Backup Completi del Server

```bash
# Cerca archivi tar che potrebbero contenere tutto /var/www
find /var/backups /root /home -name "*.tar.gz" -size +100M 2>/dev/null | head -10

# Cerca backup completi
find / -name "*full-backup*" -o -name "*server-backup*" 2>/dev/null | head -10
```

### 5. Verifica Backup Remoti

- Controlla se hai un servizio di backup remoto configurato (rsync, rclone, ecc.)
- Verifica cron jobs che potrebbero fare backup:
  ```bash
  crontab -l
  ls -la /etc/cron.d/
  ```

## ⚠️ Nota Importante

Lo script `backup-before-orari.sh` **esclude esplicitamente** la directory `uploads`:
```bash
--exclude='uploads'
```

Quindi i backup del codice **NON includono** i file di upload.

## 📋 Opzioni di Recupero

### Opzione 1: Snapshot Filesystem (Se Disponibile)

Se il provider offre snapshot:
1. Accedi alla console web del provider
2. Verifica se ci sono snapshot precedenti alla perdita dei file
3. Crea un volume temporaneo dallo snapshot
4. Monta il volume e copia i file

### Opzione 2: Backup Completo del Server

Se hai fatto backup completi del server (es. con tar, rsync, ecc.):
1. Identifica il backup più recente prima della perdita
2. Estrai solo la directory `/var/www/ticketapp/backend/uploads/`
3. Copia i file nella directory corrente

### Opzione 3: Backup Remoto

Se hai backup remoti configurati:
1. Verifica se includono la directory uploads
2. Ripristina solo i file necessari

### Opzione 4: Accettare la Perdita

Se non ci sono backup disponibili:
- I file sono persi definitivamente
- I nuovi upload funzioneranno correttamente ora che le directory sono state create
- Il frontend mostra un messaggio chiaro quando un file non è disponibile

## 🛠️ Script di Ripristino (Se Trovi un Backup)

Se trovi un backup con i file, usa questo script:

```bash
# Estrai i file da un archivio tar.gz
tar -tzf backup.tar.gz | grep "uploads/tickets/photos" | head -20

# Estrai solo la directory uploads
tar -xzf backup.tar.gz --strip-components=3 path/to/uploads -C /var/www/ticketapp/backend/

# Oppure se hai una directory backup
cp -r /path/to/backup/uploads/* /var/www/ticketapp/backend/uploads/
chown -R www-data:www-data /var/www/ticketapp/backend/uploads
chmod -R 755 /var/www/ticketapp/backend/uploads
```

## 🔒 Prevenzione Futura

Per evitare che questo problema si ripeta:

1. **Backup regolari della directory uploads**:
   ```bash
   # Aggiungi a crontab per backup giornaliero
   0 2 * * * tar -czf /var/backups/ticketapp/uploads-$(date +\%Y\%m\%d).tar.gz -C /var/www/ticketapp/backend uploads/
   ```

2. **Sistema di backup automatico** che includa anche i file di upload

3. **Monitoraggio** per verificare che i backup vengano eseguiti correttamente
