# Come inserire correttamente la chiave Google nel file .env

## 📝 Procedura passo-passo

### STEP 1: Apri il file .env

```bash
cd /var/www/ticketapp/backend
nano .env
```

### STEP 2: Trova la riga GOOGLE_PRIVATE_KEY incompleta

Scorri fino alla sezione Google Calendar (usa le frecce o `Ctrl+V` per scorrere velocemente).

Trova la riga che inizia con:
```
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
```

### STEP 3: Elimina la riga incompleta

1. **Posizionati all'inizio della riga** `GOOGLE_PRIVATE_KEY=`
2. **Premi `Ctrl+K` più volte** per eliminare tutta la riga fino alla fine (o usa `Ctrl+Shift+K` se disponibile)
   - Oppure: **Mantieni premuto `Ctrl+K`** finché non elimini tutta la riga

**IMPORTANTE**: Elimina TUTTA la riga, fino a quando non vedi la riga successiva (o una riga vuota).

### STEP 4: Inserisci la riga corretta

Ora inserisci questa riga **COMPLETA** (la devi incollare tutta in una volta):

```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC/zyUo7gaq+mGY\nJ0ZBsOm6f0OTziTX6MGWkTgR8LxEuxjX35YiQXOmbgsHXXVCEjVVT81Sx+jtSAq1\nUtgNtVPZhGALYr6joki2aLBVZSJBjVWluTGboIGZIEI7WeZ3XZkjcj5TsfH95ECY\nQ3yTjjQ4NiVS1gy+xyg0uiLRCUjzfW0r4CuigLVtIFCt6F9ribvunKbaKCS/odcX\nXjQpw6v5EbzXxAxOeTCtSYbPYkysNhCiwuzz+BsgEG5Lvaldzf5zqm2/Ec6j+gxB\ny87L4qHNdGjBAtTLfXmt4UItq23uiEYJMvVKn/r7ZEra3Jkbky0b90fHxzPYgBcw\nvHGjqsZ1AgMBAAECggEAANamBuk9GkZJ35hStzKlEN4GoSnURh6ubq3i9lKM9D3O\n4XSMHgEkHSDG/pcrtyd7BHXqaMHYcnzI04G7fDR4lrkqd8CiAhgjfZedqqPzE2/5\noE7VU0Wueh6ncTV9bFiERVinMd2YhxYwlEBhu9NKrDlCN27RY+gbiD7b2jTmDk3p\nNLGckbbuChUD7H+v68w4QL8zQLqp+IpvAlDdDU4rpF7k6wiC1bA2EuQtlmPt9BG7\npTQ/ulTAjxGD8L2Xl9px+d3+kJwYeA25Gg1yr3pvx7jCJ9XK+RRd/92WIaG7upBU\nwz5EYsDFg2NNAHCAmwR0RToZUISoDtuH+yS8OQiVIQKBgQD+fHZT3cvpVhq2KSTc\ngbWYUn00hzZYn/GFTWGwssHwBHkT87eT5Fh7AyPVMXQiHmsxpsAqZxkfdUtnTs7X\nUhzOeTgiSYIZzyRGpLkPAbqcDXOOHVsFKAJtTOeoCXeAQUiVgVYT13PB+z9uHGH8\nS2d3Y78XDlMkb3eszkQuRR8XjQKBgQDA8zyhftAZei8AP5hb2Yyy6Slp6NfI8Hiz\ndY25aP3os2967LcxpLJS+yWEnPbdFpWr5nP8KSPLsD+CTYVgmRKx0Y0myVuCqE4b\nO0ANTKXVIDw3EH1R2V1OYzlNHwfvbXP7VJqm2E4OMfv1j6djkmQ05K7ljCK7u7OC\nUihcdXLciQKBgEUmbMC9M/tjej6lT27bkAyj3YG4e/v4+hfOvwzUhf5COORDBU8a\nbTB/2ezEU1oyCc6kEPN0sE7sAGFB+NJpbYptReOLNd7tel33xJFfVuWwggXL1D/C\nb2Zjz07Jw78F/kMhsdISaVH8g2/YJof3tVWrtPD+43izEUHTipNIFPrBAoGAGypj\nz+z1yZB9S5Col83yVEIllYa10tGgfMvBL2iLzxZsTKdFR5UDklFPv/MFgq0qV3Bz\nxf3Yz1W6K1NUwvvqOOTi9aIF40hk7sqRww2Wj4IhWDNXIY3z6BRqPeRvjpMfcDRC\nLdloa/E3oyQdkhRLTXMg+KqZPUs5A9EjY5kZmdkCgYAg53SPkSMWr+pTPMHqeBah\ns5DG9RzQXUqk/WHI2N9cBKv6qzQZs667mFTR5BvShDY342vHcUXb+HguU57qsjpA\nsrTjViH97CpYYHST5a84qhvUeCoC6CRvmZN+seZr9K53XYE0wxXvxyLxwbXMRBnl\nuHxOaq6/ZbrXimzoVv/slw==\n-----END PRIVATE KEY-----\n"
```

**Come incollare:**
1. **Copia TUTTO** il testo sopra (dalla riga `GOOGLE_PRIVATE_KEY=` fino alla fine con `\n"`)
2. Nel terminale con nano aperto, **fai click con il tasto destro del mouse** (o premi `Shift+Insert`) per incollare
3. **IMPORTANTE**: La riga deve essere tutta su una singola riga logica (anche se nano la mostrerà "spezzata" visivamente, va bene così)

### STEP 5: Verifica che ci sia anche GOOGLE_PROJECT_ID

Dopo la riga `GOOGLE_PRIVATE_KEY`, assicurati che ci sia anche:

```env
GOOGLE_PROJECT_ID=ticketapp-b2a2a
```

Se manca, aggiungila.

### STEP 6: Salva e esci

1. **Premi `Ctrl+O`** per salvare
2. **Premi `Invio`** per confermare
3. **Premi `Ctrl+X`** per uscire

### STEP 7: Verifica

Esegui lo script di verifica:

```bash
cd /var/www/ticketapp/backend
node scripts/verify-google-env.js
```

Dovresti vedere tutti i ✅ verdi.

---

## ⚠️ TROUBLESHOOTING

### Se l'incollamento non funziona in nano

**Metodo alternativo**: Usa un editor diverso o trasferisci il file:

1. **Crea un file temporaneo** con la chiave corretta sul tuo PC locale
2. **Trasferiscilo sul server** con `scp`:
   ```bash
   # Sul tuo PC locale (PowerShell)
   scp CREDENZIALI_GOOGLE.env root@159.69.121.162:/tmp/google-creds.txt
   ```
3. **Sul server**, aggiungi le righe al .env:
   ```bash
   cat /tmp/google-creds.txt >> /var/www/ticketapp/backend/.env
   ```
4. **Rimuovi le righe duplicate** se necessario

### Se nano taglia l'incollamento

Prova a:
- **Disabilitare il word wrap** in nano: `Alt+W` (toggle word wrap)
- **Incollarne una parte alla volta** (ma devi essere sicuro di non spezzare la chiave)

### Usa vim invece di nano

Se nano continua a dare problemi, prova con vim:

```bash
cd /var/www/ticketapp/backend
vim .env
```

In vim:
- Premi `i` per entrare in modalità inserimento
- Incolla la chiave
- Premi `Esc` per uscire dalla modalità inserimento
- Digita `:wq` e premi `Invio` per salvare e uscire







