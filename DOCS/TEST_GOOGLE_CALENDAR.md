# Test Configurazione Google Calendar

## ✅ Credenziali configurate

Ora testiamo che tutto funzioni correttamente.

---

## 🔄 STEP 1: Riavvia il backend

Se non sei ancora uscito da nano, salva e esci:
- `Ctrl+O` → `Invio` (salva)
- `Ctrl+X` (esci)

Poi riavvia il backend:

```bash
cd /var/www/ticketapp
pm2 restart ticketapp-backend
```

Attendi qualche secondo che si riavvii (vedrai un messaggio di conferma).

---

## 🧪 STEP 2: Testa la configurazione

Esegui lo script di sincronizzazione:

```bash
cd /var/www/ticketapp/backend
node scripts/sync-missing-interventi-direct.js
```

### ✅ Risultato atteso (SUCCESSO):

Se vedi messaggi come:
- `✅ Google Auth inizializzato correttamente`
- `🔄 Sincronizzazione interventi mancanti...`
- `✅ Trovato calendario: ...`
- `✅ Evento creato per ticket #...`
- `✅ Sincronizzazione completata! Eventi creati: X`

**Allora tutto funziona! 🎉**

### ❌ Possibili errori:

#### Errore: "Google Service Account non configurato"
- Verifica che le credenziali siano nel file `.env`
- Verifica di aver riavviato il backend dopo aver modificato `.env`

#### Errore: "Invalid credentials"
- Verifica che `GOOGLE_PRIVATE_KEY` sia tra virgolette doppie `"`
- Verifica che la chiave sia completa

#### Errore: "Calendar not found" o "Forbidden"
- Il calendario Google non è stato condiviso con il Service Account
- Vai su Google Calendar → Impostazioni calendario → Condividi con `ticketapp-calendar-sync@ticketapp-b2a2a.iam.gserviceaccount.com`
- Dà permesso "Make changes to events"

---

## 📅 STEP 3 (OPZIONALE): Condividi il calendario

Se non l'hai ancora fatto, condividi il calendario Google:

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

## 🎯 Prossimi passi

Una volta verificato che funziona:
- ✅ I ticket verranno sincronizzati automaticamente su Google Calendar
- ✅ Gli interventi (timelogs) verranno sincronizzati automaticamente
- ✅ Potrai eseguire lo script di sincronizzazione forzata quando necessario






