# Guida Verifica Sender Identity su SendGrid

## Problema
SendGrid rifiuta l'invio email con errore:
```
550 The from address does not match a verified Sender Identity
```

## Soluzione
Devi verificare il dominio o l'email mittente su SendGrid.

---

## Opzione 1: Verifica Singolo Indirizzo Email (Veloce per Test)

**Passaggi:**

1. **Vai su SendGrid Dashboard:**
   - https://app.sendgrid.com/
   - Settings → Sender Authentication → Single Sender Verification

2. **Clicca "Create a Sender":**

3. **Compila il form:**
   - **From Email Address:** `info@logikaservice.it`
   - **From Name:** `Logika Service` (o il nome che preferisci)
   - **Reply To:** `info@logikaservice.it`
   - **Company Address:** Il tuo indirizzo aziendale
   - **City, State, Zip, Country:** I tuoi dati

4. **Clicca "Create"**

5. **Verifica l'email:**
   - SendGrid invierà un'email di verifica a `info@logikaservice.it`
   - Apri l'email e clicca sul link di verifica
   - Oppure copia il codice e inseriscilo nel dashboard SendGrid

6. **Dopo la verifica:**
   - L'indirizzo `info@logikaservice.it` sarà verificato
   - Potrai inviare email da questo indirizzo

**Limiti:**
- Funziona solo per l'indirizzo verificato
- Se vuoi inviare da altri indirizzi, devi verificare anche quelli
- Per produzione, è meglio verificare il dominio intero

---

## Opzione 2: Verifica Dominio (Consigliato per Produzione)

**Passaggi:**

1. **Vai su SendGrid Dashboard:**
   - https://app.sendgrid.com/
   - Settings → Sender Authentication → Domain Authentication

2. **Clicca "Authenticate Your Domain":**

3. **Seleziona il provider DNS:**
   - Se Aruba è nella lista, selezionalo
   - Altrimenti seleziona "Other"

4. **Inserisci il dominio:**
   - Dominio: `logikaservice.it`
   - Subdomain (opzionale): lascia vuoto o inserisci `mail` se vuoi usare `mail.logikaservice.it`

5. **SendGrid ti darà dei record DNS da aggiungere:**
   - Esempio:
     ```
     Type: CNAME
     Host: s1._domainkey.logikaservice.it
     Value: s1.domainkey.u1234567.wl123.sendgrid.net
     
     Type: CNAME
     Host: s2._domainkey.logikaservice.it
     Value: s2.domainkey.u1234567.wl123.sendgrid.net
     
     Type: CNAME
     Host: em1234.logikaservice.it
     Value: u1234567.wl123.sendgrid.net
     ```

6. **Aggiungi i record DNS nel pannello Aruba:**
   - Accedi al pannello Aruba
   - Vai su DNS Management
   - Aggiungi i record CNAME forniti da SendGrid
   - Attendi la propagazione DNS (può richiedere fino a 24-48 ore, ma spesso funziona in pochi minuti)

7. **Verifica su SendGrid:**
   - Torna su SendGrid Dashboard
   - Clicca "Verify" accanto al dominio
   - SendGrid verificherà i record DNS
   - Se tutto è corretto, vedrai "Domain Verified ✅"

8. **Dopo la verifica:**
   - Potrai inviare email da qualsiasi indirizzo `@logikaservice.it`
   - Non devi verificare ogni singolo indirizzo

**Vantaggi:**
- Verifica tutto il dominio
- Puoi inviare da qualsiasi indirizzo `@logikaservice.it`
- Più professionale
- Migliore deliverability

---

## Dopo la Verifica

Una volta verificato il dominio o l'email:

1. **Riprova il test sulla VPS:**
   ```bash
   cd /var/www/ticketapp/backend
   node scripts/test-email-smtp.js
   ```

2. **Dovresti vedere:**
   - `✅ Email inviata con successo!`
   - `Message ID: ...`

3. **Controlla la casella email:**
   - L'email dovrebbe arrivare in pochi secondi
   - Controlla anche la cartella spam se non la vedi

---

## Troubleshooting

### L'email di verifica non arriva
- Controlla la cartella spam
- Verifica che l'indirizzo sia corretto
- Prova a richiedere una nuova email di verifica

### I record DNS non vengono verificati
- Attendi 24-48 ore per la propagazione DNS
- Verifica che i record siano esatti (copia-incolla da SendGrid)
- Controlla che non ci siano errori di sintassi nei record DNS

### SendGrid ancora rifiuta l'invio
- Verifica che il dominio/email sia effettivamente verificato nel dashboard
- Controlla che stai usando l'indirizzo corretto nel codice
- Verifica che l'API Key abbia i permessi corretti

---

## Raccomandazione

Per un sistema di produzione, **verifica il dominio intero** (Opzione 2) invece del singolo indirizzo. Questo ti permetterà di:
- Inviare da qualsiasi indirizzo `@logikaservice.it`
- Avere migliore deliverability
- Essere più flessibile per il futuro







