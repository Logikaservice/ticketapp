# 🗑️ ISTRUZIONI: Eliminazione Definitiva Klines

## 🎯 Obiettivo

Eliminare **DEFINITIVAMENTE** tutte le klines per simboli che NON sono nei 67 trading pairs unici (130 simboli validi nella mappa `SYMBOL_TO_PAIR`).

## 📋 Script Creato

**File**: `backend/scripts/elimina-klines-simboli-non-validi.js`

## 🚀 Esecuzione sul VPS

### Step 1: Connettiti al VPS
```bash
ssh root@159.69.121.162
```

### Step 2: Vai nella directory del progetto
```bash
cd /var/www/ticketapp/backend
```

### Step 3: Verifica simboli non validi (DRY-RUN)
```bash
node scripts/elimina-klines-simboli-non-validi.js
```

Questo mostrerà:
- Quanti simboli non validi hanno klines
- Quante klines verranno eliminate
- Lista completa dei simboli da eliminare

### Step 4: Elimina klines (CONFERMA)
```bash
node scripts/elimina-klines-simboli-non-validi.js --confirm
```

Questo eliminerà **TUTTE** le klines per simboli non validi.

## ⚠️ ATTENZIONE

- ✅ Lo script elimina SOLO klines (non altre tabelle)
- ✅ Mantiene klines per i 130 simboli validi
- ✅ Operazione IRREVERSIBILE
- ✅ Richiede flag `--confirm` per sicurezza

## 📊 Cosa Fa lo Script

1. Legge la mappa `SYMBOL_TO_PAIR` dal codice
2. Identifica i 130 simboli validi
3. Trova tutti i simboli con klines nel database
4. Identifica simboli non validi (non nella mappa)
5. Elimina TUTTE le klines per quei simboli

## ✅ Risultato Atteso

Dopo l'esecuzione:
- ✅ Solo i 130 simboli validi avranno klines
- ✅ Simboli non validi avranno 0 klines
- ✅ Database pulito e ordinato

---

**Status**: ✅ Script pronto per esecuzione sul VPS
