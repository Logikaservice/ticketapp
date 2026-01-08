# Setup Rapido Google Calendar (Service Account Esistente)

Hai già il Service Account `ticketapp-calendar-sync@ticketapp-b2a2a.iam.gserviceaccount.com`.

## Passo 1: Genera la chiave JSON

1. Dalla pagina delle Credenziali, clicca su **"Gestisci service account"**
2. Clicca sul Service Account **`ticketapp-calendar-sync`**
3. Vai sul tab **"Keys"**
4. Clicca **"Add Key"** → **"Create new key"**
5. Seleziona formato **"JSON"**
6. Clicca **"Create"** → Il file JSON viene scaricato

## Passo 2: Estrai le credenziali dal JSON

Apri il file JSON scaricato e prendi nota di:

```json
{
  "client_email": "ticketapp-calendar-sync@ticketapp-b2a2a.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "project_id": "ticketapp-b2a2a"
}
```

## Passo 3: Configura sul server VPS

SSH sul server e modifica `.env`:

```bash
ssh root@159.69.121.162
cd /var/www/ticketapp/backend
nano .env
```

Aggiungi (sostituisci con i valori dal JSON):

```env
# Google Calendar Service Account
GOOGLE_CLIENT_EMAIL=ticketapp-calendar-sync@ticketapp-b2a2a.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n[INCOLLA QUI LA CHIAVE COMPLETA]\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=ticketapp-b2a2a
```

⚠️ **IMPORTANTE**: 
- Il `GOOGLE_PRIVATE_KEY` deve essere tra **virgolette doppie**
- Mantieni i caratteri `\n` esattamente come sono nel JSON
- La chiave deve essere su una sola riga con `\n` al suo interno

## Passo 4: Condividi il calendario

1. Vai su [Google Calendar](https://calendar.google.com/)
2. Impostazioni calendario → "Share with specific people"
3. Aggiungi: `ticketapp-calendar-sync@ticketapp-b2a2a.iam.gserviceaccount.com`
4. Permesso: **"Make changes to events"**

## Passo 5: Riavvia backend

```bash
pm2 restart ticketapp-backend
```

## Passo 6: Test

```bash
cd /var/www/ticketapp/backend
node scripts/sync-missing-interventi-direct.js
```









