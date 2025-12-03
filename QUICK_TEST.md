# ⚡ Quick Test - Fase 1

## 🎯 Test Rapido (5 minuti)

### Step 1: Apri Dashboard
1. Vai su **Crypto Dashboard**
2. Apri **Console Browser** (F12 → Console)

### Step 2: Verifica Bot Attivo
- Nel dashboard vedi: **Bot: Attivo** ✅
- Se non attivo: clicca il toggle per attivarlo

### Step 3: Osserva Log (30 secondi)
Ogni 30 secondi vedrai nei log:
```
🤖 BOT: BTC/EUR=€XX.XX | RSI=XX.XX | Active=true
✅ RISK MANAGER: OK - Max Position: €X.XX
📡 SIGNAL: [LONG/SHORT/NEUTRAL] | Strength: X/100
```

### Step 4: Cosa Aspettare

**Se RSI < 30:**
- 📡 Segnale LONG generato
- ✅ Posizione LONG aperta (se rischio OK)
- 🟢 Marker verde sul grafico

**Se RSI > 70:**
- 📡 Segnale SHORT generato
- ✅ Posizione SHORT aperta (se rischio OK)
- 🔴 Marker rosso sul grafico

**Se RSI 30-70:**
- 📡 Segnale NEUTRAL
- ➡️ Nessuna azione (normale)

---

## ✅ Verifica Rapida

- [ ] Log appaiono ogni 30 secondi
- [ ] Risk Manager mostra "OK"
- [ ] Segnali vengono generati
- [ ] Grafico mostra marker quando si apre una posizione

**Se tutto OK → Sistema Funziona! 🎉**

---

## ❓ Problemi?

**Bot non fa nulla:**
- Verifica che sia attivo
- Aspetta condizioni di mercato (RSI < 30 o > 70)

**Nessun log:**
- Ricarica pagina
- Verifica console browser

**Errori:**
- Controlla log server
- Verifica connessione database

