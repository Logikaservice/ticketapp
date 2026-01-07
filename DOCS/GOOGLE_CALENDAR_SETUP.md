# Configurazione Google Calendar Service Account

Questa guida spiega come configurare le credenziali Google Service Account per sincronizzare ticket e interventi con Google Calendar.

## Prerequisiti

- Un account Google
- Accesso a Google Cloud Console

## Passo 1: Crea un progetto su Google Cloud Console

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Seleziona un progetto esistente o creane uno nuovo
3. Assicurati di avere la fatturazione abilitata (necessaria per alcune API, anche se spesso c'è un tier gratuito)

## Passo 2: Abilita Google Calendar API

1. Vai su **"API & Services"** > **"Library"** nel menu laterale
2. Cerca **"Google Calendar API"**
3. Clicca su **"Enable"** per abilitare l'API

## Passo 3: Crea un Service Account

1. Vai su **"API & Services"** > **"Credentials"**
2. Clicca su **"Create Credentials"** > **"Service Account"**
3. Inserisci:
   - **Service account name**: `ticketapp-calendar` (o un nome a tua scelta)
   - **Service account ID**: viene generato automaticamente
   - **Description**: (opzionale) "Service Account per TicketApp Google Calendar"
4. Clicca **"Create and Continue"**
5. **Skip** la sezione "Grant this service account access to project" (non necessaria per questo caso d'uso)
6. Clicca **"Done"**

## Passo 4: Genera le credenziali JSON

1. Nella lista dei Service Account, clicca sul Service Account appena creato
2. Vai sul tab **"Keys"**
3. Clicca su **"Add Key"** > **"Create new key"**
4. Seleziona il formato **"JSON"**
5. Clicca **"Create"**
6. Il file JSON verrà scaricato automaticamente

⚠️ **IMPORTANTE**: Conserva questo file in un luogo sicuro! Contiene le credenziali sensibili.

## Passo 5: Estrai le credenziali dal file JSON

Apri il file JSON scaricato. Dovrebbe contenere qualcosa come:

```json
{
  "type": "service_account",
  "project_id": "ticketapp-b2a2a",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "ticketapp-calendar@ticketapp-b2a2a.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

Dovrai estrarre i seguenti valori:

- `client_email` → `GOOGLE_CLIENT_EMAIL`
- `private_key` → `GOOGLE_PRIVATE_KEY` (mantieni i `\n` nel valore)
- `project_id` → `GOOGLE_PROJECT_ID` (opzionale, ha un default)
- `private_key_id` → `GOOGLE_PRIVATE_KEY_ID` (opzionale)
- `client_id` → `GOOGLE_CLIENT_ID` (opzionale)
- `client_x509_cert_url` → `GOOGLE_CLIENT_X509_CERT_URL` (opzionale)

## Passo 6: Configura le credenziali sul server

### Sul server VPS (produzione)

1. Connettiti al server:
   ```bash
   ssh root@159.69.121.162
   ```

2. Modifica il file `.env`:
   ```bash
   cd /var/www/ticketapp/backend
   nano .env
   ```

3. Aggiungi le seguenti righe (sostituisci con i tuoi valori):
   ```env
   GOOGLE_CLIENT_EMAIL=ticketapp-calendar@ticketapp-b2a2a.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
   GOOGLE_PROJECT_ID=ticketapp-b2a2a
   ```

⚠️ **NOTA**: Il valore di `GOOGLE_PRIVATE_KEY` deve essere tra virgolette e contenere i caratteri `\n` letterali. Il file JSON contiene già i `\n` correttamente formattati.

### Esempio completo di configurazione .env

```env
# Google Calendar Service Account
GOOGLE_CLIENT_EMAIL=ticketapp-calendar@ticketapp-b2a2a.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=ticketapp-b2a2a
GOOGLE_PRIVATE_KEY_ID=abc123def456...
GOOGLE_CLIENT_ID=123456789...
GOOGLE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/ticketapp-calendar%40ticketapp-b2a2a.iam.gserviceaccount.com
```

## Passo 7: Condividi il calendario con il Service Account

⚠️ **IMPORTANTE**: Il Service Account deve avere accesso al calendario!

1. Vai su [Google Calendar](https://calendar.google.com/)
2. Nel menu laterale, trova il calendario che vuoi usare (o creane uno nuovo)
3. Clicca sui **tre puntini** accanto al calendario > **"Settings and sharing"**
4. Scorri fino a **"Share with specific people"**
5. Clicca su **"Add people"**
6. Inserisci l'email del Service Account (`client_email` dal JSON, es: `ticketapp-calendar@ticketapp-b2a2a.iam.gserviceaccount.com`)
7. Seleziona il permesso **"Make changes to events"** (o "See all event details" + "Make changes")
8. Clicca **"Send"**

**Alternativa**: Se vuoi usare il calendario principale, condividi il calendario principale con il Service Account.

## Passo 8: Riavvia il backend

Dopo aver aggiunto le credenziali, riavvia il backend:

```bash
cd /var/www/ticketapp
pm2 restart ticketapp-backend
```

## Verifica della configurazione

Per verificare che tutto funzioni:

1. **Test dello script di sincronizzazione:**
   ```bash
   cd /var/www/ticketapp/backend
   node scripts/sync-missing-interventi-direct.js
   ```

2. **Verifica nei log:**
   ```bash
   pm2 logs ticketapp-backend --lines 50 | grep -i google
   ```

   Dovresti vedere messaggi come:
   - `✅ Google Auth inizializzato correttamente`
   - `✅ Trovato calendario: ...`

## Troubleshooting

### Errore: "Google Service Account non configurato"
- Verifica che le variabili siano nel file `.env` in `backend/.env`
- Verifica che il file `.env` non abbia errori di sintassi
- Riavvia il backend dopo aver modificato `.env`

### Errore: "Calendar not found" o "Forbidden"
- Verifica di aver condiviso il calendario con l'email del Service Account
- Verifica che il Service Account abbia i permessi corretti ("Make changes to events")

### Errore: "Invalid credentials"
- Verifica che il `GOOGLE_PRIVATE_KEY` sia tra virgolette e contenga i `\n`
- Verifica che l'email del Service Account (`GOOGLE_CLIENT_EMAIL`) sia corretta
- Verifica che la chiave privata non sia scaduta o revocata

## Sicurezza

⚠️ **IMPORTANTE**: 
- Non committare mai il file JSON delle credenziali nel repository Git
- Non condividere le credenziali pubblicamente
- Usa variabili d'ambiente invece di hardcodare le credenziali nel codice
- Mantieni le credenziali aggiornate e revoca quelle vecchie se necessario







