# 🗑️ Comandi per Rimuovere Simboli con Volumi Bassi

## ⚠️ ATTENZIONE

Questo script rimuove **completamente** dal database tutti i simboli con volume < 1M USDT.

**Cosa viene rimosso:**
- ✅ Simboli da `bot_settings`
- ✅ Simboli da `bot_parameters`
- ✅ Tutte le klines storiche
- ✅ Dati di market_data
- ✅ Posizioni aperte (vengono chiuse automaticamente)
- ✅ Posizioni chiuse (rimosse per pulizia)

**Cosa viene MANTENUTO:**
- ✅ 22 simboli con volume ≥ 1M USDT:
  - bitcoin, ethereum, solana, binance_coin, cardano, avax_usdt
  - pepe, litecoin, sei, polkadot, uniswap, aave, bonk
  - ripple, chainlink_usdt, floki, gala, sand, mana, imx, matic, pol_polygon

## 🚀 Esecuzione sul VPS

### 1. Connettiti al VPS
```bash
ssh utente@ticket.logikaservice.it
```

### 2. Vai nella directory backend
```bash
cd /var/www/ticketapp/backend
```

### 3. Esegui lo script di rimozione
```bash
node remove_low_volume_symbols.js
```

## 📊 Cosa fa lo script

1. **Identifica simboli da rimuovere:**
   - Tutti i simboli NON nella lista `SYMBOLS_TO_KEEP`
   - Circa 54 simboli verranno rimossi

2. **Chiude posizioni aperte:**
   - Se ci sono posizioni aperte, le chiude automaticamente
   - Calcola P&L finale usando il prezzo corrente (o entry_price se non disponibile)
   - Marca come "Symbol removed - low volume"

3. **Rimuove da tutte le tabelle:**
   - `bot_settings`: Rimuove configurazioni bot
   - `bot_parameters`: Rimuove parametri personalizzati
   - `klines`: Rimuove tutte le candele storiche
   - `market_data`: Rimuove dati di mercato
   - `open_positions`: Rimuove tutte le posizioni (aperte e chiuse)

4. **Mostra report finale:**
   - Numero di simboli rimossi
   - Record rimossi per tabella
   - Lista simboli mantenuti

## ✅ Dopo l'esecuzione

1. **Verifica risultato:**
   - Lo script mostrerà un riepilogo completo
   - Dovresti avere ~22 simboli attivi

2. **Configura MIN_VOLUME_24H:**
   - Vai in "Configurazione Strategia RSI"
   - Imposta "Min Volume 24h": `1,000,000` USDT
   - Questo previene l'aggiunta futura di simboli con volumi bassi

3. **Riavvia il bot (opzionale):**
   ```bash
   pm2 restart crypto-backend
   ```

## 🔄 Rollback (se necessario)

**ATTENZIONE:** Non c'è rollback automatico. Se vuoi ripristinare i simboli, devi:
1. Aggiungerli manualmente tramite interfaccia
2. O ripristinare da backup database

## 📝 Esempio Output

```
🗑️  RIMOZIONE SIMBOLI CON VOLUMI BASSI

================================================================================
Soglia minima volume: 1.0M USDT
Simboli da mantenere: 22
================================================================================

🔍 Recupero tutti i simboli dal database...

📋 Trovati 76 simboli totali

✅ Simboli da MANTENERE: 22
   bitcoin, ethereum, solana, ...

🗑️  Simboli da RIMUOVERE: 54
   algo, apt, ar, arb, ...

⚠️  ATTENZIONE: Questo script rimuoverà completamente i simboli da:
   - bot_settings
   - bot_parameters
   - klines
   - market_data
   - open_positions (posizioni aperte verranno chiuse)

🚀 Inizio rimozione...

   Rimuovendo algo... ✅
   Rimuovendo apt... ✅
   ...

================================================================================
📊 RIEPILOGO RIMOZIONE

✅ Simboli rimossi: 54
📊 Dettagli:
   - bot_settings: 54 record
   - bot_parameters: 45 record
   - klines: 1234 record
   - market_data: 54 record
   - open_positions: 2 record (chiuse/rimosse)

✅ Rimozione completata!

💡 Ora hai 22 simboli attivi con volume ≥ 1M USDT
```

