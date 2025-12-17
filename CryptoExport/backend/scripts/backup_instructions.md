# Istruzioni per Backup Database Supabase

## Metodo 1: Dashboard Supabase (Consigliato - Più Semplice)

1. Vai su [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **Database** nel menu laterale
4. Clicca su **Backups**
5. Clicca su **Create new backup** o scarica un backup esistente
6. Il backup sarà disponibile per il download

## Metodo 2: Script Automatico (Richiede pg_dump)

### Prerequisiti
- `pg_dump` installato sul sistema
  - **Windows**: Installa PostgreSQL da https://www.postgresql.org/download/windows/
  - **Mac**: `brew install postgresql`
  - **Linux**: `sudo apt-get install postgresql-client`

### Esecuzione

1. Assicurati di avere `DATABASE_URL` nelle variabili d'ambiente:
   ```bash
   export DATABASE_URL="postgresql://username:password@host:port/database"
   ```

2. Esegui lo script:
   ```bash
   cd backend/scripts
   node backup_database.js
   ```

3. Il backup sarà salvato in `backend/backups/backup_YYYY-MM-DD_HH-MM-SS.sql`

### Ripristino Backup

```bash
psql -h HOST -p PORT -U USERNAME -d DATABASE < backup_file.sql
```

## Metodo 3: pg_dump Manuale

```bash
pg_dump -h YOUR_HOST -p 5432 -U YOUR_USERNAME -d YOUR_DATABASE -F p -f backup.sql
```

Poi inserisci la password quando richiesto.

## Metodo 4: Supabase CLI (Se installata)

```bash
# Installa Supabase CLI
npm install -g supabase

# Login
supabase login

# Backup del database
supabase db dump -f backup.sql
```

## Note Importanti

- ⚠️ I backup possono essere grandi se il database contiene molti dati
- 💾 I backup vengono salvati in `backend/backups/` (questa cartella è già nel `.gitignore`)
- 🔒 Non committare mai i file di backup nel repository Git
- 📅 È consigliato fare backup regolari (settimanali o mensili)
- 🔄 Per backup automatici, considera di impostare backup schedulati nella dashboard Supabase

