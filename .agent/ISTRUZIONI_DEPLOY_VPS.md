# 🚀 ISTRUZIONI DEPLOY BOT PROFESSIONALE SU VPS

## ✅ Codice Pushato su GitHub

Il nuovo Trading Bot Professionale v2.0 è stato pushato su GitHub:
- Commit: `4f9f264`
- Branch: `main`

## 📋 Passi per Deploy su VPS

### 1. Connettiti al VPS via SSH

```bash
ssh utente@tuo-vps-ip
```

### 2. Naviga nella Directory del Progetto

```bash
cd /path/to/TicketApp
# Esempio: cd /var/www/ticketapp
```

### 3. Pull del Nuovo Codice

```bash
git pull origin main
```

Dovresti vedere:
```
remote: Counting objects: 11, done.
remote: Compressing objects: 100% (11/11), done.
remote: Total 11 (delta 4), reused 0 (delta 0)
Unpacking objects: 100% (11/11), done.
From https://github.com/Logikaservice/ticketapp
   b671c10..4f9f264  main -> origin/main
Updating b671c10..4f9f264
Fast-forward
 .agent/ANALISI_PROBLEMA_LTC.md                | 78 ++++++++++++++++
 .agent/BOT_PROFESSIONALE_IMPLEMENTATO.md      | 234 +++++++++++++++++++++++++++++++++++++++++++++
 .agent/SCOPERTA_CRITICA_BOT_DISARMATO.md      | 156 ++++++++++++++++++++++++++++++
 backend/check-ltc.js                          | 19 ++++
 backend/index.js                              | 10 ++
 backend/services/TradingBot.js                | 488 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 6 files changed, 985 insertions(+)
```

### 4. Verifica i Nuovi File

```bash
ls -la backend/services/TradingBot.js
```

Dovresti vedere:
```
-rw-r--r-- 1 user user 24576 Dec  9 15:54 backend/services/TradingBot.js
```

### 5. Riavvia il Backend con PM2

```bash
cd backend
pm2 restart backend
```

O se il processo si chiama diversamente:
```bash
pm2 list  # Per vedere il nome del processo
pm2 restart <nome-processo>
```

### 6. Monitora i Log in Tempo Reale

```bash
pm2 logs backend --lines 100
```

Dovresti vedere:
```
🤖 [INIT] Starting Professional Crypto Trading Bot...
🤖 [BOT] Professional Crypto Trading Bot v2.0
   Configuration:
   - Check interval: 5000ms
   - LONG requirements: Strength >= 60, Confirmations >= 3
   - SHORT requirements: Strength >= 70, Confirmations >= 4
   - Trade size: €50
   - Stop Loss: 3%
   - Take Profit: 5%

✅ [INIT] Professional Trading Bot started successfully

🔄 [BOT] Running cycle for 3 active bots
⏸️ [BOT] litecoin - LONG strength too low: 45/60
⏸️ [BOT] ethereum - LONG confirmations too low: 2/3
```

### 7. Verifica che il Bot Funzioni Correttamente

Osserva i log per almeno 5-10 minuti. Dovresti vedere:

**✅ COMPORTAMENTO CORRETTO:**
- Molti messaggi `⏸️ [BOT] ... blocked` (il bot sta filtrando correttamente!)
- Pochi messaggi `🚀 [BOT] Opening ...` (solo quando TUTTI i requisiti sono soddisfatti)
- Ogni decisione loggata con dettagli (strength, confirmations, MTF)

**❌ COMPORTAMENTO ERRATO:**
- Nessun log del bot (il bot non si è avviato)
- Errori nel log (problema con il codice)

## 🔍 Troubleshooting

### Problema: Il Bot Non Si Avvia

**Sintomo:** Non vedi i log del bot

**Soluzione:**
```bash
# Controlla gli errori
pm2 logs backend --err

# Riavvia forzatamente
pm2 delete backend
pm2 start index.js --name backend
```

### Problema: Errore "Cannot find module './services/TradingBot'"

**Sintomo:** Errore nel log

**Soluzione:**
```bash
# Verifica che il file esista
ls -la backend/services/TradingBot.js

# Se non esiste, ri-pull
git pull origin main --force
```

### Problema: Il Bot Apre Troppe Posizioni

**Sintomo:** Vedi molti `🚀 [BOT] Opening ...`

**Soluzione:**
- Questo NON dovrebbe succedere con i nuovi filtri
- Controlla i log per vedere i valori di strength e confirmations
- Se succede, fermalo subito: `pm2 stop backend`
- Contattami per debug

## 📊 Come Verificare che Funzioni

### 1. Controlla il Database

```bash
# Connettiti al database
sqlite3 backend/crypto_trading.db

# Verifica le nuove posizioni
SELECT 
    ticket_id, 
    symbol, 
    type, 
    entry_price, 
    opened_at,
    json_extract(signal_details, '$.version') as bot_version,
    json_extract(signal_details, '$.adjustedStrength') as strength,
    json_extract(signal_details, '$.confirmations') as confirmations
FROM open_positions 
WHERE status = 'open' 
ORDER BY opened_at DESC 
LIMIT 5;
```

Le nuove posizioni dovrebbero avere:
- `bot_version = "2.0"`
- `strength >= 60` (LONG) o `>= 70` (SHORT)
- `confirmations >= 3` (LONG) o `>= 4` (SHORT)

### 2. Monitora per 1 Ora

Lascia girare il bot per almeno 1 ora e osserva:
- Quante posizioni apre (dovrebbero essere POCHE)
- Quante volte blocca (dovrebbero essere MOLTE)
- I valori di strength e confirmations quando apre

### 3. Verifica la Bot Analysis

Vai su `https://ticket.logikaservice.it/?domain=crypto&page=bot-analysis&symbol=litecoin_usdt`

Dovresti vedere:
- Strength aggiornata in tempo reale
- Confirmations aggiornate
- "PRONTO AD APRIRE LONG/SHORT" solo quando TUTTI i requisiti sono soddisfatti

## ⚠️ IMPORTANTE

**NON lasciare il bot in produzione senza monitoraggio!**

Per le prime 24 ore:
1. ✅ Monitora i log ogni ora
2. ✅ Verifica le posizioni aperte nel database
3. ✅ Controlla che NON apra posizioni con strength bassa
4. ✅ Se vedi comportamenti strani, fermalo subito: `pm2 stop backend`

## 📞 Supporto

Se hai problemi durante il deploy:
1. Copia i log: `pm2 logs backend --lines 200 > bot-logs.txt`
2. Inviameli per analisi
3. Nel frattempo, puoi fermare il bot: `pm2 stop backend`

---

**Versione Bot:** 2.0 - Professional Trading Implementation  
**Data Deploy:** 2025-12-09  
**Status:** ✅ Pronto per il deploy su VPS
