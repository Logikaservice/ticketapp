# 📊 Comandi per Analisi Volumi Trading

## 🚀 Esecuzione sul VPS

### 1. Connettiti al VPS via SSH
```bash
ssh utente@ticket.logikaservice.it
```

### 2. Vai nella directory del progetto
```bash
cd /var/www/ticketapp/backend
```

### 3. Esegui l'analisi volumi
```bash
node analyze_volumes.js
```

## 📋 Interpretazione Risultati

### Categorie di Volume

| Emoji | Categoria | Volume | Raccomandazione |
|-------|-----------|--------|-----------------|
| 🟢 | EXCELLENT | >10M USDT | ✅✅✅ TRADARE - Ideale |
| 🟢 | GOOD | 5-10M USDT | ✅✅ TRADARE - Consigliato |
| 🟡 | ACCEPTABLE | 1-5M USDT | ✅ TRADARE - Con cautela |
| 🟠 | LOW | 500K-1M USDT | ⚠️ EVITARE - Slippage alto |
| 🔴 | VERY_LOW | 100K-500K USDT | ❌ EVITARE - Rischio alto |
| 🔴 | CRITICAL | <100K USDT | ❌❌ NON TRADARE - Critico |

### Come Configurare le Impostazioni

#### 1. Vai in "Configurazione Strategia RSI"

#### 2. Imposta "Min Volume 24h" in base ai risultati:

**Opzione CONSERVATIVA (Raccomandata per posizioni $80-100):**
- **Min Volume 24h**: `1,000,000` USDT
- ✅ Blocca automaticamente simboli con volume < 1M USDT
- ✅ Riduce rischio slippage per posizioni $80-100

**Opzione MODERATA:**
- **Min Volume 24h**: `500,000` USDT (default attuale)
- ⚠️ Permette simboli con volumi bassi (rischio slippage moderato)

**Opzione AGGRESSIVA (Solo per simboli molto liquidi):**
- **Min Volume 24h**: `5,000,000` USDT
- ✅✅ Solo simboli con liquidità eccellente
- ✅✅ Slippage minimo

#### 3. Disattiva Manualmente Simboli Critici

Dopo l'analisi, disattiva manualmente i simboli in categoria:
- 🔴 **CRITICAL** (<100K USDT)
- 🔴 **VERY_LOW** (100K-500K USDT) - se vuoi essere conservativo

## 📊 Esempio Output

```
🟢 EXCELLENT (5 simboli):
   bitcoin                   1,234,567,890 USDT | ✅ ECCELLENTE - Trading consigliato
   ethereum                    567,890,123 USDT | ✅ ECCELLENTE - Trading consigliato
   ...
   Rischio Slippage: Molto Basso (<0.2%) | Posizione $80 = 0.0000% del volume

🟡 ACCEPTABLE (3 simboli):
   sand                        2,345,678 USDT | ⚠️ ACCETTABILE - Trading possibile con cautela
   ...
   Rischio Slippage: Moderato (0.5-1%) | Posizione $80 = 0.0034% del volume

🔴 CRITICAL (2 simboli):
   shib_eur                       45,678 USDT | ❌ CRITICO - NON TRADARE
   pepe_eur                       32,456 USDT | ❌ CRITICO - NON TRADARE
   ...
   Rischio Slippage: Molto Alto (2-5%) | Posizione $80 = 0.1752% del volume
```

## 🎯 Azioni Consigliate

### Dopo l'Analisi:

1. **Aumenta MIN_VOLUME_24H a 1,000,000 USDT**
   - Vai in "Configurazione Strategia RSI"
   - Imposta "Min Volume 24h": `1000000`
   - Salva

2. **Disattiva Simboli Critici**
   - Vai in "Gestione Bot"
   - Disattiva tutti i simboli in categoria CRITICAL e VERY_LOW
   - (O lascia che il filtro MIN_VOLUME li blocchi automaticamente)

3. **Preferisci Simboli USDT invece di EUR**
   - I simboli EUR spesso hanno volumi molto più bassi
   - Esempio: SHIB/USDT (50M USDT) vs SHIB/EUR (50K USDT)

4. **Monitora Periodicamente**
   - Esegui l'analisi ogni settimana/mese
   - I volumi possono cambiare nel tempo
   - Aggiorna le configurazioni di conseguenza

## 💡 Note Importanti

- **Posizione $80-100**: Richiede volume ≥ 1M USDT per minimizzare slippage
- **Slippage**: Perdita immediata all'apertura/chiusura posizione
- **Spread**: Differenza bid/ask (più alto con volumi bassi)
- **Liquidità**: Capacità di eseguire ordini senza muovere il prezzo

## 🔄 Aggiornamento Automatico

Il sistema controlla automaticamente il volume prima di aprire ogni posizione.
Se il volume è < MIN_VOLUME_24H configurato, il bot **non aprirà** la posizione.

