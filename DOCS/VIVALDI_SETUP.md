# Guida Setup Progetto Vivaldi

## Panoramica

Vivaldi è un sistema di annunci vocali per punti vendita che sostituisce il dispositivo VIVALDI GRM2. Il sistema integra:
- **SpeechGen.io** per la generazione audio da testo
- **Google Gemini AI** per il parsing di comandi vocali/testuali
- **Schedulazione automatica** con priorità e ripetizioni

## Prerequisiti

1. PostgreSQL installato e configurato
2. Node.js e npm installati
3. Accesso al database PostgreSQL con privilegi di creazione database
4. API Key SpeechGen.io
5. API Key Google Gemini (opzionale, per chat AI)

## Step 1: Creazione Database

### Opzione A: Script Automatico (Consigliato)

```bash
cd backend
node scripts/init-vivaldi-db.js
```

Lo script:
- Crea il database `vivaldi_db` se non esiste
- Crea tutte le tabelle necessarie
- Crea gli indici per le performance
- Inserisce la configurazione default

### Opzione B: Manuale

```sql
-- Connettiti a PostgreSQL come superuser
CREATE DATABASE vivaldi_db;

-- Connettiti al database vivaldi_db
\c vivaldi_db

-- Esegui lo script SQL (vedi backend/scripts/init-vivaldi-db.js per le query)
```

## Step 2: Configurazione Backend

### 2.1 Configura DATABASE_URL_VIVALDI

Aggiungi nel file `backend/.env`:

```env
# Database Vivaldi (separato da TicketApp)
DATABASE_URL_VIVALDI=postgresql://username:password@host:port/vivaldi_db
```

**Esempio per VPS locale:**
```env
DATABASE_URL_VIVALDI=postgresql://postgres:TicketApp2025!Secure@localhost:5432/vivaldi_db
```

**Esempio per Supabase:**
```env
DATABASE_URL_VIVALDI=postgresql://postgres.xxxxx:password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
```

### 2.2 Configura API Keys (Opzionale - può essere fatto anche dal frontend)

Aggiungi nel file `backend/.env` (opzionale, possono essere configurate anche dal frontend):

```env
# SpeechGen.io
SPEECHGEN_API_KEY=f1d5e882-e8ab-49c0-ac47-2df3a6a30090
SPEECHGEN_EMAIL=logikaserivce@gmail.com

# Google Gemini (opzionale)
GEMINI_API_KEY=your_gemini_api_key_here
```

## Step 3: Installazione Dipendenze

```bash
cd backend
npm install
```

Le nuove dipendenze verranno installate automaticamente:
- `@google/generative-ai` - Google Gemini SDK
- `node-cron` - Schedulazione cron job

## Step 4: Configurazione Frontend

Il frontend è già configurato. Assicurati che il build sia aggiornato:

```bash
cd frontend
npm install
npm run build
```

## Step 5: Configurazione Nginx (per vivaldi.logikaservice.it)

Crea il file `/etc/nginx/sites-available/vivaldi.logikaservice.it.conf`:

```nginx
server {
    listen 80;
    server_name vivaldi.logikaservice.it;

    location / {
        root /var/www/ticketapp/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Abilita il sito:

```bash
sudo ln -s /etc/nginx/sites-available/vivaldi.logikaservice.it.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 6: Configurazione API Keys dal Frontend

1. Accedi a Vivaldi (via `vivaldi.logikaservice.it` o `/?domain=vivaldi`)
2. Clicca sull'icona ⚙️ (ingranaggio) in alto a destra
3. Inserisci:
   - **SpeechGen API Key**: `f1d5e882-e8ab-49c0-ac47-2df3a6a30090`
   - **SpeechGen Email**: `logikaserivce@gmail.com`
   - **Gemini API Key**: (opzionale, se vuoi usare la chat AI)
4. Clicca "Salva"

## Step 7: Riavvio Backend

```bash
# Se usi PM2
pm2 restart ticketapp-backend

# Oppure se usi systemd
sudo systemctl restart ticketapp-backend
```

## Verifica Installazione

1. **Verifica Database:**
   ```bash
   psql -U postgres -d vivaldi_db -c "\dt"
   ```
   Dovresti vedere le tabelle: `annunci`, `annunci_schedule`, `annunci_queue`, `annunci_history`, `vivaldi_config`

2. **Verifica Backend:**
   - Controlla i log: `pm2 logs ticketapp-backend`
   - Dovresti vedere: `✅ Connessione al database Vivaldi riuscita!`
   - Dovresti vedere: `✅ Vivaldi Scheduler avviato`

3. **Verifica Frontend:**
   - Accedi a `vivaldi.logikaservice.it` o `/?domain=vivaldi`
   - Dovresti vedere l'interfaccia Vivaldi

## Struttura Database

### Tabelle Principali

- **vivaldi_config**: Configurazione API keys e settings
- **annunci**: Annunci vocali creati
- **annunci_schedule**: Schedulazioni degli annunci
- **annunci_queue**: Coda di esecuzione (gestita automaticamente dal cron)
- **annunci_history**: Storico delle esecuzioni

## Funzionalità

### Priorità e Ripetizioni

- **Urgente**: Ripetizione ogni 7 minuti
- **Alta**: Ripetizione ogni 10 minuti
- **Media**: Ripetizione ogni 15 minuti
- **Bassa**: Ripetizione ogni 30 minuti

### Modalità di Creazione Annunci

1. **Editor Testuale**: Crea annuncio manualmente con testo, speaker, velocità, tono
2. **Assistente AI (Gemini)**: Parla o scrivi in linguaggio naturale, l'AI crea l'annuncio automaticamente

### Schedulazione

- Tutti gli annunci sono schedulati (nessuna modalità "immediata")
- Il cron job processa le schedulazioni ogni minuto
- La coda viene eseguita ogni 10 secondi

## Troubleshooting

### Database non si connette

- Verifica `DATABASE_URL_VIVALDI` nel `.env`
- Verifica che il database `vivaldi_db` esista
- Verifica permessi utente PostgreSQL

### API SpeechGen non funziona

- Verifica API key nel frontend (⚙️ > Configurazione)
- Verifica che l'email sia corretta
- Controlla i log del backend per errori API

### Cron job non esegue annunci

- Verifica i log: `pm2 logs ticketapp-backend`
- Cerca messaggi "Vivaldi Scheduler"
- Verifica che le schedulazioni siano in stato "attivo"

### Frontend non carica

- Verifica build frontend: `cd frontend && npm run build`
- Verifica nginx: `sudo nginx -t`
- Verifica permessi file: `sudo chown -R www-data:www-data /var/www/ticketapp/frontend/build`

## Supporto

Per problemi o domande, controlla i log:
- Backend: `pm2 logs ticketapp-backend`
- Nginx: `sudo tail -f /var/log/nginx/error.log`

