# Guida Configurazione SMTP Relay Esterno

## Problema
Il provider VPS blocca le porte SMTP (587, 465, 25) a livello di rete per prevenire spam. Questo impedisce l'invio diretto di email tramite Aruba o altri provider SMTP.

## Soluzione
Configurare un **relay SMTP esterno** che non è bloccato dal provider VPS.

---

## Opzione 1: Usare Aruba tramite Relay SMTP (Consigliato)

Se hai accesso a un altro server che non ha restrizioni SMTP, puoi configurare Aruba come relay:

### Configurazione nel `.env` del backend:

```bash
# Relay SMTP Aruba (usa un server che non ha restrizioni)
SMTP_RELAY_HOST=smtp.aruba.it
SMTP_RELAY_PORT=587
SMTP_RELAY_SECURE=false
SMTP_RELAY_USER=info@logikaservice.it
SMTP_RELAY_PASSWORD=LaTuaPasswordAruba
```

**Nota:** Se anche questo non funziona (perché il provider VPS blocca comunque), usa una delle opzioni seguenti.

---

## Opzione 2: SendGrid (Gratuito fino a 100 email/giorno)

1. **Registrati su SendGrid:** https://sendgrid.com
2. **Crea un API Key:**
   - Dashboard → Settings → API Keys
   - Crea una nuova API Key con permessi "Mail Send"
3. **Configurazione nel `.env`:**

```bash
SMTP_RELAY_HOST=smtp.sendgrid.net
SMTP_RELAY_PORT=587
SMTP_RELAY_SECURE=false
SMTP_RELAY_USER=apikey
SMTP_RELAY_PASSWORD=SG.xxxxxxxxxxxxx  # La tua API Key di SendGrid
```

**Vantaggi:**
- Gratuito fino a 100 email/giorno
- Affidabile e veloce
- Non richiede verifica dominio per piani base

---

## Opzione 3: Mailgun (Gratuito fino a 5.000 email/mese)

1. **Registrati su Mailgun:** https://www.mailgun.com
2. **Ottieni le credenziali SMTP:**
   - Dashboard → Sending → Domain Settings → SMTP credentials
3. **Configurazione nel `.env`:**

```bash
SMTP_RELAY_HOST=smtp.mailgun.org
SMTP_RELAY_PORT=587
SMTP_RELAY_SECURE=false
SMTP_RELAY_USER=postmaster@your-domain.mailgun.org
SMTP_RELAY_PASSWORD=LaTuaPasswordMailgun
```

**Vantaggi:**
- Gratuito fino a 5.000 email/mese
- Molto affidabile
- API e SMTP disponibili

---

## Opzione 4: AWS SES (Pay-as-you-go, molto economico)

1. **Configura AWS SES:**
   - Verifica il dominio o l'email mittente
   - Ottieni le credenziali SMTP
2. **Configurazione nel `.env`:**

```bash
SMTP_RELAY_HOST=email-smtp.eu-central-1.amazonaws.com  # Regione EU
SMTP_RELAY_PORT=587
SMTP_RELAY_SECURE=false
SMTP_RELAY_USER=AKIAIOSFODNN7EXAMPLE  # SMTP Username
SMTP_RELAY_PASSWORD=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY  # SMTP Password
```

**Vantaggi:**
- Molto economico ($0.10 per 1.000 email)
- Scalabile
- Affidabile

---

## Opzione 5: Gmail SMTP (se hai un account Gmail)

```bash
SMTP_RELAY_HOST=smtp.gmail.com
SMTP_RELAY_PORT=587
SMTP_RELAY_SECURE=false
SMTP_RELAY_USER=tua-email@gmail.com
SMTP_RELAY_PASSWORD=LaTuaAppPasswordGmail  # App Password, non password normale
```

**Nota:** Gmail richiede una "App Password" (non la password normale). Generala da: Google Account → Security → 2-Step Verification → App passwords

---

## Come Applicare la Configurazione

1. **Modifica il file `.env` del backend sulla VPS:**

```bash
cd /var/www/ticketapp/backend
nano .env
```

2. **Aggiungi le variabili SMTP_RELAY_* (scegli una delle opzioni sopra)**

3. **Riavvia il backend:**

```bash
pm2 restart ticketapp-backend
```

4. **Testa la configurazione:**

```bash
cd /var/www/ticketapp/backend
node scripts/test-email-smtp.js
```

---

## Verifica Funzionamento

Dopo aver configurato il relay SMTP:

1. **Controlla i log del backend:**
   ```bash
   pm2 logs ticketapp-backend --lines 50
   ```
   
   Dovresti vedere:
   - `📧 Configurazione SMTP Relay esterno (provider VPS blocca porte SMTP)`
   - `✅ Transporter SMTP Relay creato con successo`

2. **Crea un ticket di test** e verifica che l'email venga inviata.

---

## Troubleshooting

### Il relay SMTP non funziona

1. **Verifica le credenziali** nel `.env`
2. **Controlla i log** del backend per errori specifici
3. **Testa la connessione** al relay SMTP:
   ```bash
   telnet smtp.sendgrid.net 587  # Sostituisci con il tuo relay
   ```

### Email non arrivano

1. **Controlla la cartella spam**
2. **Verifica che il mittente sia configurato correttamente** (deve essere un email valido)
3. **Controlla i log** per errori di autenticazione o invio

---

## Raccomandazione

Per un sistema di produzione, consiglio **SendGrid** o **Mailgun** per:
- Affidabilità
- Facile configurazione
- Piani gratuiti generosi
- Buona deliverability




