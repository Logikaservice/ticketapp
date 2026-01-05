# Guida Passo-Passo: Configurazione Google Calendar

## 🔍 Dove sei ora?

Sei nella pagina di dettaglio del Service Account `ticketapp-calendar-sync`.
Vedi due tab in alto: **"Dettagli"** (selezionato) e **"Keys"** (non selezionato).

---

## 📝 STEP 1: Vai al tab "Chiavi"

**Clicca sul tab "Chiavi"** (terzo tab da sinistra, dopo "Dettagli" e "Autorizzazioni")

⚠️ **NOTA**: In italiano il tab si chiama **"Chiavi"**, non "Keys"!

Dopo aver cliccato, vedrai una lista delle chiavi esistenti (se ce ne sono) o una schermata vuota.

---

## 🔑 STEP 2: Crea una nuova chiave JSON

1. **Clicca sul pulsante blu "ADD KEY"** (in alto a sinistra)
2. Nel menu a tendina che appare, **seleziona "Create new key"**
3. Si aprirà una finestra popup con due opzioni:
   - **JSON** ← Seleziona questa!
   - P12
4. **Clicca su "Create"**

Il file JSON verrà **scaricato automaticamente** nel tuo browser (di solito nella cartella Downloads).

---

## 📄 STEP 3: Apri il file JSON scaricato

Apri il file JSON appena scaricato con un editor di testo (Notepad++, VS Code, o anche Notepad).

Il file dovrebbe contenere qualcosa come:

```json
{
  "type": "service_account",
  "project_id": "ticketapp-b2a2a",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "ticketapp-calendar-sync@ticketapp-b2a2a.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/ticketapp-calendar-sync%40ticketapp-b2a2a.iam.gserviceaccount.com"
}
```

**Prendi nota di questi valori** (li useremo dopo):
- `client_email` → questo è il `GOOGLE_CLIENT_EMAIL`
- `private_key` → questo è il `GOOGLE_PRIVATE_KEY` (copialo TUTTO, compresi i `\n`)
- `project_id` → questo è il `GOOGLE_PROJECT_ID`

---

## 🖥️ STEP 4: Connettiti al server VPS

Apri il terminale (PowerShell su Windows) e connettiti al server:

```bash
ssh root@159.69.121.162
```

(Inserisci la password quando richiesta)

---

## 📝 STEP 5: Modifica il file .env

Una volta connesso al server, esegui questi comandi:

```bash
cd /var/www/ticketapp/backend
nano .env
```

Il file `.env` si aprirà nell'editor nano.

---

## ✏️ STEP 6: Aggiungi le credenziali

Scorri fino in fondo al file `.env` e aggiungi queste righe:

```env
# Google Calendar Service Account
GOOGLE_CLIENT_EMAIL=ticketapp-calendar-sync@ticketapp-b2a2a.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n[QUI INCOLLA LA CHIAVE PRIVATA COMPLETA DAL JSON]\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=ticketapp-b2a2a
```

**⚠️ ATTENZIONE IMPORTANTE per GOOGLE_PRIVATE_KEY:**

1. **Copia l'intero valore** di `private_key` dal file JSON (dalla riga `"private_key": "` fino alla fine, incluso `\n-----END PRIVATE KEY-----\n"`)

2. **Sostituisci** `[QUI INCOLLA LA CHIAVE PRIVATA COMPLETA DAL JSON]` con il valore copiato

3. **Mantieni le virgolette doppie** all'inizio e alla fine

4. **Esempio completo** (con valori di esempio):
   ```env
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj...\n-----END PRIVATE KEY-----\n"
   ```

**Come copiare correttamente la private_key:**
- Apri il file JSON
- Trova la riga con `"private_key":`
- Copia TUTTO il valore tra le virgolette (inclusi i caratteri `\n`)
- Incolla nel file .env, sostituendo la parte `[QUI INCOLLA...]`

---

## 💾 STEP 7: Salva e esci da nano

Dopo aver aggiunto le righe:

1. **Premi** `Ctrl + O` per salvare (Save)
2. **Premi** `Invio` per confermare
3. **Premi** `Ctrl + X` per uscire

---

## 🔄 STEP 8: Riavvia il backend

```bash
cd /var/www/ticketapp
pm2 restart ticketapp-backend
```

Attendi qualche secondo che il backend si riavvii.

---

## 🧪 STEP 9: Testa la configurazione

Esegui lo script di sincronizzazione per verificare che tutto funzioni:

```bash
cd /var/www/ticketapp/backend
node scripts/sync-missing-interventi-direct.js
```

Se vedi messaggi come:
- ✅ `Google Auth inizializzato correttamente`
- ✅ `Sincronizzazione completata`

Allora tutto è configurato correttamente! 🎉

---

## 📅 STEP 10 (OPZIONALE): Condividi il calendario Google

⚠️ **IMPORTANTE**: Il Service Account deve avere accesso al calendario!

1. Vai su [Google Calendar](https://calendar.google.com/)
2. Nel menu laterale, trova il calendario che vuoi usare
3. Clicca sui **tre puntini** (...) accanto al calendario
4. Seleziona **"Settings and sharing"**
5. Scorri fino a **"Share with specific people"**
6. Clicca su **"Add people"**
7. Inserisci: `ticketapp-calendar-sync@ticketapp-b2a2a.iam.gserviceaccount.com`
8. Seleziona il permesso **"Make changes to events"**
9. Clicca **"Send"**

---

## ❓ Problemi comuni

### Errore: "Google Service Account non configurato"
- Verifica di aver salvato il file `.env` (Ctrl+O in nano)
- Verifica che le righe non abbiano spazi prima di `GOOGLE_`
- Riavvia il backend: `pm2 restart ticketapp-backend`

### Errore: "Invalid credentials"
- Verifica che `GOOGLE_PRIVATE_KEY` sia tra virgolette doppie `"`
- Verifica che la chiave privata contenga i caratteri `\n` (non solo a capo)
- Verifica che non ci siano spazi extra o caratteri mancanti

### Errore: "Calendar not found"
- Verifica di aver condiviso il calendario con l'email del Service Account (STEP 10)

---

## 🎯 Prossimi passi

Una volta completati tutti gli step, potrai:
- ✅ Sincronizzare automaticamente i ticket su Google Calendar
- ✅ Sincronizzare gli interventi (timelogs) su Google Calendar
- ✅ Eseguire lo script di sincronizzazione forzata per eventi mancanti






