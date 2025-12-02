# 🚀 GUIDA PASSO-PASSO: Configurazione Binance Testnet

Questa guida ti accompagna passo-passo nella configurazione di Binance Testnet per il tuo progetto crypto trading.

---

## 📋 PREREQUISITI

- Account email (per registrazione Binance Testnet)
- Editor di testo (Notepad++, Visual Studio Code, o anche Notepad)
- Il progetto TicketApp funzionante

---

## 🎯 PASSO 1: Creare Account Binance Testnet

### 1.1 Apri il sito Binance Testnet

1. Apri il browser (Chrome, Firefox, Edge)
2. Vai su: **https://testnet.binance.vision/**
3. Dovresti vedere la pagina con la sezione **F.A.Q.** (domande frequenti)

### 1.2 Accedi con GitHub

1. **Nella sezione "Authenticate"** (in alto a sinistra o nel menu)
2. **Clicca su "Log in with GitHub"**
   - Ti verrà chiesto di autorizzare Binance ad accedere al tuo account GitHub
   - Clicca "Authorize" se sei d'accordo
3. Dopo il login, verrai reindirizzato alla dashboard di Binance Testnet

### 1.3 Genera le API Keys

1. **Dopo il login, cerca e clicca su "Generate HMAC-SHA-256 key"**
   - Potrebbe essere un link nel menu o nella pagina principale
   - Ti porterà alla pagina di generazione

2. **Compila il form che vedi:**

   **a) Campo "Description":**
   - Inserisci un nome per identificare questa chiave
   - Esempi: `TicketApp-Trading`, `CryptoBot-Test`, `Testnet-Key-2025`
   - Deve contenere tra 1 e 20 caratteri (lettere, numeri, trattini o underscore)
   - ⚠️ Non può essere vuoto!

   **b) Sezione "Key permissions":**
   - **TRADE** ✅ - Deve essere selezionato (per aprire/chiudere ordini)
   - **USER_DATA** ✅ - Deve essere selezionato (per vedere saldo e ordini)
   - **USER_STREAM** ✅ - Può essere selezionato (per stream in tempo reale)
   - **FIX_API** ❌ - Non necessario per ora, lascia deselezionato
   - **FIX_API_READ_ONLY** ❌ - Non necessario per ora, lascia deselezionato

   **c) Clicca il pulsante giallo "Generate"**
   - In basso nella pagina vedrai un pulsante giallo grande

3. **PAGINA IMPORTANTE - COPIA LE CHIAVI SUBITO!**

   Dopo aver cliccato "Generate", si aprirà una nuova pagina con:
   ```
   API Key: [una stringa lunga tipo: abc123def456...]
   Secret Key: [una stringa ancora più lunga]
   ```

   ⚠️ **ATTENZIONE CRITICA**: La Secret Key viene mostrata **SOLO UNA VOLTA**!
   - Se chiudi la pagina senza copiarla, dovrai rigenerare tutto
   - **NON chiudere** la pagina finché non hai copiato entrambe le chiavi!

4. **Come salvare le chiavi:**

   **Opzione A - File di testo (consigliato):**
   - Apri un nuovo file Notepad o Blocco Note
   - Incolla:
     ```
     BINANCE_API_KEY=incolla_qui_la_api_key
     BINANCE_API_SECRET=incolla_qui_il_secret
     ```
   - Salva sul Desktop come "Binance_Keys.txt"

   **Opzione B - Screenshot:**
   - Fai uno screenshot della pagina (tasto Stamp)
   - Salvalo sul Desktop

   **Opzione C - Copia temporanea:**
   - Copia entrambe in un file di testo sul Desktop
   - Dovrai usarle subito dopo nel file .env

### 📝 Nota Importante

- Se non vedi subito il pulsante per generare le API keys dopo il login, cerca nella pagina o nel menu
- Potrebbe essere necessario navigare nella sezione "API Keys" o "Settings"
- Alcune volte le API keys vengono generate automaticamente al primo login

---

## 🎯 PASSO 2: Trovare il File .env

### 2.1 Apri la cartella del progetto

1. Apri **File Explorer** (Windows)
2. Vai alla cartella: `C:\TicketApp\backend\`
3. Dovresti vedere una cartella con vari file

### 2.2 Verifica se esiste il file .env

1. **Cerca il file `.env`**
   - Potrebbe non essere visibile se Windows nasconde i file che iniziano con "."
   - In File Explorer, vai su: **Visualizza** → **Mostra** → **File nascosti**

2. **Se NON esiste il file `.env`:**
   - Clicca destro nella cartella `backend`
   - Seleziona **Nuovo** → **Documento di testo**
   - Rinomina in: `.env` (senza estensione .txt)
   - Windows chiederà conferma: clicca **Sì**

3. **Se ESISTE già il file `.env`:**
   - Apri con editor di testo (Notepad++, VS Code, o Notepad)
   - ⚠️ **NON cancellare** il contenuto esistente!

---

## 🎯 PASSO 3: Aggiungere le Configurazioni Binance

### 3.1 Apri il file .env

1. Clicca destro su `.env`
2. Seleziona **Apri con** → scegli un editor (Notepad++, VS Code, o Notepad)

### 3.2 Aggiungi le righe alla fine del file

1. **Vai alla fine del file** (premi `Ctrl + End`)
2. **Aggiungi una riga vuota** (premi `Invio`)
3. **Copia e incolla questo blocco:**

```env

# ==========================================
# BINANCE TESTNET CONFIGURATION
# ==========================================
BINANCE_MODE=testnet
BINANCE_API_KEY=INCOLLA_QUI_LA_TUA_API_KEY
BINANCE_API_SECRET=INCOLLA_QUI_IL_TUO_SECRET_KEY
```

### 3.3 Sostituisci i valori placeholder

1. **Trova la riga:**
   ```
   BINANCE_API_KEY=INCOLLA_QUI_LA_TUA_API_KEY
   ```

2. **Sostituisci `INCOLLA_QUI_LA_TUA_API_KEY`** con la tua API Key copiata prima
   - Esempio:
   ```env
   BINANCE_API_KEY=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
   ```

3. **Trova la riga:**
   ```
   BINANCE_API_SECRET=INCOLLA_QUI_IL_TUO_SECRET_KEY
   ```

4. **Sostituisci `INCOLLA_QUI_IL_TUO_SECRET_KEY`** con il tuo Secret Key
   - Esempio:
   ```env
   BINANCE_API_SECRET=ABCD1234EFGH5678IJKL9012MNOP3456QRST7890UVWX1234YZAB5678CDEF9012
   ```

### 3.4 Risultato finale

Il tuo file `.env` dovrebbe contenere qualcosa tipo:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
PORT=3001

# ==========================================
# BINANCE TESTNET CONFIGURATION
# ==========================================
BINANCE_MODE=testnet
BINANCE_API_KEY=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
BINANCE_API_SECRET=ABCD1234EFGH5678IJKL9012MNOP3456QRST7890UVWX1234YZAB5678CDEF9012
```

### 3.5 Salva il file

1. Premi **Ctrl + S** per salvare
2. Chiudi l'editor

---

## 🎯 PASSO 4: Verificare il File .env

### 4.1 Controlla che sia corretto

Apri nuovamente il file `.env` e verifica:

✅ **BINANCE_MODE=testnet** (deve essere scritto esattamente così, minuscolo)  
✅ **BINANCE_API_KEY=** seguito dalla tua API Key (senza spazi)  
✅ **BINANCE_API_SECRET=** seguito dal tuo Secret Key (senza spazi)  
✅ **Nessuno spazio** prima o dopo il simbolo `=`  
✅ **Nessun commento** sulla stessa riga delle keys

### 4.2 Esempio CORRETTO:
```env
BINANCE_MODE=testnet
BINANCE_API_KEY=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
BINANCE_API_SECRET=ABCD1234EFGH5678IJKL9012MNOP3456QRST7890UVWX1234YZAB5678CDEF9012
```

### 4.3 Esempio SBAGLIATO:
```env
BINANCE_MODE = testnet  ❌ (spazi intorno a =)
BINANCE_API_KEY= abc123...  ❌ (spazio dopo =)
BINANCE_API_KEY=abc123... # mia chiave  ❌ (commento sulla stessa riga)
```

---

## 🎯 PASSO 5: Riavviare il Backend

### 5.1 Se il backend è in esecuzione

Il backend deve essere riavviato per caricare le nuove variabili d'ambiente.

**Opzione A: Riavvio manuale (se eseguito da terminale)**
1. Vai nel terminale dove è in esecuzione il backend
2. Premi **Ctrl + C** per fermarlo
3. Rilancia: `npm start` o `node index.js`

**Opzione B: Se usi PM2 (sul server)**
1. Apri PowerShell o Terminal
2. Esegui:
   ```powershell
   pm2 restart ticketapp-backend
   ```

**Opzione C: Se usi systemd (sul server Linux)**
```bash
sudo systemctl restart ticketapp-backend
```

**Opzione D: Sviluppo locale (Windows)**
1. Se stai testando in locale, ferma e riavvia il backend normalmente

---

## 🎯 PASSO 6: Verificare la Configurazione

### 6.1 Test tramite Browser

1. Apri il browser
2. Vai su: `http://localhost:3001/api/crypto/binance/mode`
   - Se il backend è su un server: `https://ticket.logikaservice.it/api/crypto/binance/mode`

3. **Dovresti vedere:**
```json
{
  "mode": "testnet",
  "available": true,
  "message": "Modalità attiva: TESTNET"
}
```

### 6.2 Test tramite PowerShell

Apri PowerShell e esegui:

```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/crypto/binance/mode" | Select-Object -ExpandProperty Content
```

Oppure con curl (se installato):
```powershell
curl http://localhost:3001/api/crypto/binance/mode
```

### 6.3 Se vedi errore o modalità DEMO

Se invece vedi:
```json
{
  "mode": "demo",
  "available": false,
  "message": "Modalità DEMO: usando simulazione locale"
}
```

**Controlla:**
- ✅ Il file `.env` è stato salvato correttamente?
- ✅ Il backend è stato riavviato dopo aver modificato `.env`?
- ✅ Le variabili d'ambiente sono scritte correttamente (senza spazi, senza virgolette)?
- ✅ `BINANCE_MODE=testnet` (minuscolo, non TESTNET o Testnet)

---

## 🎯 PASSO 7: Test Completo

### 7.1 Verifica Saldo (se disponibile)

Nel browser, prova:
```
http://localhost:3001/api/crypto/binance/balance
```

Se funziona, vedrai i saldi del tuo account Testnet.

### 7.2 Verifica Prezzo

Nel browser:
```
http://localhost:3001/api/crypto/binance/price/SOLEUR
```

Dovresti vedere il prezzo corrente di SOL/EUR da Binance Testnet.

---

## ⚠️ PROBLEMI COMUNI E SOLUZIONI

### ❌ Problema: "Modalità DEMO" anche dopo configurazione

**Soluzione:**
1. Verifica che il file `.env` sia nella cartella corretta: `C:\TicketApp\backend\.env`
2. Verifica che le righe siano esattamente:
   ```env
   BINANCE_MODE=testnet
   BINANCE_API_KEY=la_tua_key
   BINANCE_API_SECRET=il_tuo_secret
   ```
3. **Riavvia il backend** (molto importante!)
4. Verifica che non ci siano spazi prima o dopo i valori

### ❌ Problema: "API Key o Secret mancanti"

**Soluzione:**
1. Controlla che entrambe le righe siano presenti nel `.env`
2. Verifica che non ci siano caratteri strani o spazi
3. Riavvia il backend

### ❌ Problema: "Invalid API-key"

**Soluzione:**
1. Verifica di aver copiato correttamente le keys (senza spazi)
2. Le keys devono essere su righe separate
3. Se il problema persiste, genera nuove keys su https://testnet.binance.vision/

### ❌ Problema: File .env non trovato

**Soluzione:**
1. Assicurati di essere nella cartella corretta: `C:\TicketApp\backend\`
2. Mostra i file nascosti in File Explorer
3. Crea il file `.env` se non esiste

### ❌ Problema: Backend non si riavvia

**Soluzione:**
1. Chiudi completamente tutte le finestre terminal/PowerShell
2. Apri un nuovo terminale
3. Vai in `C:\TicketApp\backend`
4. Esegui: `npm start`

---

## ✅ CHECKLIST FINALE

Prima di considerare la configurazione completa, verifica:

- [ ] API Key e Secret Key generate su https://testnet.binance.vision/
- [ ] File `.env` creato/modificato in `C:\TicketApp\backend\.env`
- [ ] Aggiunte le 3 righe (BINANCE_MODE, BINANCE_API_KEY, BINANCE_API_SECRET)
- [ ] Valori corretti (senza spazi, senza virgolette)
- [ ] File salvato
- [ ] Backend riavviato
- [ ] Test `/api/crypto/binance/mode` restituisce `"mode": "testnet"`

---

## 🔐 SICUREZZA

⚠️ **IMPORTANTE:**

1. **NON condividere** mai le tue API keys
2. **NON committare** il file `.env` su Git (è già nel .gitignore)
3. Le keys del **Testnet** sono per test (denaro virtuale)
4. Le keys del **Mainnet** (produzione) sono denaro reale - usale solo quando sei sicuro!

---

## 📞 SUPPORTO

Se hai problemi:
1. Controlla la sezione "Problemi Comuni" qui sopra
2. Verifica i log del backend per errori specifici
3. Assicurati di aver seguito tutti i passi

---

## 🎉 COMPLIMENTI!

Se tutto funziona, hai configurato con successo Binance Testnet! 

Ora puoi:
- ✅ Testare ordini reali (con denaro virtuale)
- ✅ Vedere saldi e prezzi da Binance
- ✅ Sviluppare e testare strategie di trading in sicurezza

Buon trading! 🚀

