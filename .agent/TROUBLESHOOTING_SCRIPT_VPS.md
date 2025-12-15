# 🔧 TROUBLESHOOTING: Script sul VPS

## ❓ Cosa Hai Visto?

Se hai eseguito gli script sul VPS e hai riscontrato problemi, condividi:

1. **Output completo** dello script
2. **Messaggio di errore** (se presente)
3. **Comando esatto** che hai eseguito

## 🔍 Problemi Comuni

### 1. Errore: "Cannot find module 'pg'"
**Causa**: Dipendenze non installate
**Soluzione**:
```bash
cd /var/www/ticketapp/backend
npm install
```

### 2. Errore: "DATABASE_URL non configurato"
**Causa**: File `.env` mancante o variabile non configurata
**Soluzione**:
```bash
cd /var/www/ticketapp/backend
# Verifica che .env esista
ls -la .env

# Verifica contenuto
cat .env | grep DATABASE_URL
```

### 3. Errore: "Impossibile trovare SYMBOL_TO_PAIR"
**Causa**: File `cryptoRoutes.js` non trovato o formato errato
**Soluzione**:
```bash
cd /var/www/ticketapp/backend
# Verifica che il file esista
ls -la routes/cryptoRoutes.js

# Verifica che contenga SYMBOL_TO_PAIR
grep "const SYMBOL_TO_PAIR" routes/cryptoRoutes.js
```

### 4. Errore di connessione database
**Causa**: PostgreSQL non raggiungibile o credenziali errate
**Soluzione**:
```bash
# Verifica che PostgreSQL sia in esecuzione
sudo systemctl status postgresql

# Prova connessione manuale
psql -U postgres -d crypto_db -c "SELECT 1;"
```

### 5. Script si blocca o non termina
**Causa**: Database molto grande o query lente
**Soluzione**: 
- Attendi qualche minuto
- Se si blocca, interrompi con `Ctrl+C` e verifica lo stato del database

## 📊 Output Atteso

### `analizza-simboli-non-validi.js` - Output Normale
```
✅ SYMBOL_TO_PAIR caricato: 130 simboli
🔍 ANALISI APPROFONDITA: Simboli Non Validi nel Database
================================================================================

📊 1. RACCOLTA SIMBOLI DA TUTTE LE TABELLE...
...
```

### `pulisci-bot-settings-non-validi.js` - Output Normale
```
✅ SYMBOL_TO_PAIR caricato: 130 simboli
🔍 Verifica bot_settings per simboli non validi...
...
```

## 🚨 Se Vedi Errori

Condividi:
- **Messaggio di errore completo**
- **Stack trace** (se presente)
- **Ultime righe dell'output** prima dell'errore

Così posso identificare il problema specifico e risolverlo.
