# Come aggiungere le credenziali Google sul server VPS

## 📋 Credenziali pronte

Hai già il file JSON con le credenziali. Ora devi aggiungerle al file `.env` sul server.

---

## 🖥️ STEP 1: Connettiti al server VPS

Apri PowerShell (o terminale) e connettiti:

```bash
ssh root@159.69.121.162
```

(Inserisci la password quando richiesta)

---

## 📝 STEP 2: Vai alla cartella backend e apri il file .env

```bash
cd /var/www/ticketapp/backend
nano .env
```

Il file `.env` si aprirà nell'editor nano.

---

## ✏️ STEP 3: Aggiungi le credenziali

Scorri fino in fondo al file (usa le frecce o `Ctrl+V` per scorrere velocemente) e aggiungi queste righe:

```env
# Google Calendar Service Account
GOOGLE_CLIENT_EMAIL=ticketapp-calendar-sync@ticketapp-b2a2a.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC/zyUo7gaq+mGY\nJ0ZBsOm6f0OTziTX6MGWkTgR8LxEuxjX35YiQXOmbgsHXXVCEjVVT81Sx+jtSAq1\nUtgNtVPZhGALYr6joki2aLBVZSJBjVWluTGboIGZIEI7WeZ3XZkjcj5TsfH95ECY\nQ3yTjjQ4NiVS1gy+xyg0uiLRCUjzfW0r4CuigLVtIFCt6F9ribvunKbaKCS/odcX\nXjQpw6v5EbzXxAxOeTCtSYbPYkysNhCiwuzz+BsgEG5Lvaldzf5zqm2/Ec6j+gxB\ny87L4qHNdGjBAtTLfXmt4UItq23uiEYJMvVKn/r7ZEra3Jkbky0b90fHxzPYgBcw\nvHGjqsZ1AgMBAAECggEAANamBuk9GkZJ35hStzKlEN4GoSnURh6ubq3i9lKM9D3O\n4XSMHgEkHSDG/pcrtyd7BHXqaMHYcnzI04G7fDR4lrkqd8CiAhgjfZedqqPzE2/5\noE7VU0Wueh6ncTV9bFiERVinMd2YhxYwlEBhu9NKrDlCN27RY+gbiD7b2jTmDk3p\nNLGckbbuChUD7H+v68w4QL8zQLqp+IpvAlDdDU4rpF7k6wiC1bA2EuQtlmPt9BG7\npTQ/ulTAjxGD8L2Xl9px+d3+kJwYeA25Gg1yr3pvx7jCJ9XK+RRd/92WIaG7upBU\nwz5EYsDFg2NNAHCAmwR0RToZUISoDtuH+yS8OQiVIQKBgQD+fHZT3cvpVhq2KSTc\ngbWYUn00hzZYn/GFTWGwssHwBHkT87eT5Fh7AyPVMXQiHmsxpsAqZxkfdUtnTs7X\nUhzOeTgiSYIZzyRGpLkPAbqcDXOOHVsFKAJtTOeoCXeAQUiVgVYT13PB+z9uHGH8\nS2d3Y78XDlMkb3eszkQuRR8XjQKBgQDA8zyhftAZei8AP5hb2Yyy6Slp6NfI8Hiz\ndY25aP3os2967LcxpLJS+yWEnPbdFpWr5nP8KSPLsD+CTYVgmRKx0Y0myVuCqE4b\nO0ANTKXVIDw3EH1R2V1OYzlNHwfvbXP7VJqm2E4OMfv1j6djkmQ05K7ljCK7u7OC\nUihcdXLciQKBgEUmbMC9M/tjej6lT27bkAyj3YG4e/v4+hfOvwzUhf5COORDBU8a\nbTB/2ezEU1oyCc6kEPN0sE7sAGFB+NJpbYptReOLNd7tel33xJFfVuWwggXL1D/C\nb2Zjz07Jw78F/kMhsdISaVH8g2/YJof3tVWrtPD+43izEUHTipNIFPrBAoGAGypj\nz+z1yZB9S5Col83yVEIllYa10tGgfMvBL2iLzxZsTKdFR5UDklFPv/MFgq0qV3Bz\nxf3Yz1W6K1NUwvvqOOTi9aIF40hk7sqRww2Wj4IhWDNXIY3z6BRqPeRvjpMfcDRC\nLdloa/E3oyQdkhRLTXMg+KqZPUs5A9EjY5kZmdkCgYAg53SPkSMWr+pTPMHqeBah\ns5DG9RzQXUqk/WHI2N9cBKv6qzQZs667mFTR5BvShDY342vHcUXb+HguU57qsjpA\nsrTjViH97CpYYHST5a84qhvUeCoC6CRvmZN+seZr9K53XYE0wxXvxyLxwbXMRBnl\nuHxOaq6/ZbrXimzoVv/slw==\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=ticketapp-b2a2a
```

⚠️ **IMPORTANTE**: 
- La riga `GOOGLE_PRIVATE_KEY` deve essere **su una sola riga** (non andare a capo!)
- Le virgolette doppie `"` all'inizio e alla fine sono **obbligatorie**
- I caratteri `\n` devono rimanere **esattamente così** (non convertirli in a capo reali)

---

## 💾 STEP 4: Salva e esci

Dopo aver aggiunto le righe:

1. **Premi** `Ctrl + O` per salvare (vedrai "File Name to write: .env" in basso)
2. **Premi** `Invio` per confermare il salvataggio
3. **Premi** `Ctrl + X` per uscire da nano

---

## 🔄 STEP 5: Riavvia il backend

```bash
cd /var/www/ticketapp
pm2 restart ticketapp-backend
```

Attendi qualche secondo che il backend si riavvii.

---

## 🧪 STEP 6: Testa la configurazione

Verifica che tutto funzioni:

```bash
cd /var/www/ticketapp/backend
node scripts/sync-missing-interventi-direct.js
```

Se vedi messaggi come:
- ✅ `Google Auth inizializzato correttamente`
- ✅ `Sincronizzazione completata`

Allora tutto è configurato correttamente! 🎉

---

## ❓ Problemi comuni

### Se vedi errore: "Google Service Account non configurato"
- Verifica di aver salvato il file (Ctrl+O → Invio in nano)
- Verifica che non ci siano spazi prima di `GOOGLE_CLIENT_EMAIL`
- Verifica che le virgolette siano corrette

### Se vedi errore: "Invalid credentials"
- Verifica che `GOOGLE_PRIVATE_KEY` sia tra virgolette doppie `"`
- Verifica che la chiave sia su una sola riga (non andare a capo nel mezzo)
- Verifica che i caratteri `\n` siano presenti (non convertirli in a capo reali)







