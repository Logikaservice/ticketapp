# 🎯 Spiegazione: Soglia Minima (Forza Minima Segnale)

## 📊 Cos'è la "Strength" (Forza) di un Segnale?

La **strength** (forza) è un **punteggio da 0 a 100** che indica **quanto è forte e affidabile** un segnale di trading.

### Come viene Calcolata?

Il bot analizza il mercato usando **molti indicatori tecnici** e assegna punti per ogni "conferma" trovata:

#### Esempio per Segnale LONG (Compra):
- ✅ **RSI oversold** (RSI < 30) + uptrend → **+25 punti**
- ✅ **RSI fortemente oversold** (RSI < 25) → **+20 punti**
- ✅ **RSI Bullish Divergence** → **+40 punti** (segnale molto forte!)
- ✅ **MACD bullish** (MACD > Signal) → **+30 punti**
- ✅ **Prezzo tocca lower Bollinger Band** → **+25 punti**
- ✅ **Prezzo sopra tutte le EMA** (10, 20, 50, 200) → **+20 punti**
- ✅ **Prezzo sopra EMA 10** → **+15 punti**
- ✅ **Prezzo stabile/sale** → **+10 punti**
- ✅ **Breakout sopra upper Bollinger** → **+20 punti**

**Totale**: Se tutti gli indicatori sono positivi, la strength può arrivare a **100/100**.

---

## 🎯 Cosa Fa la Soglia Minima?

La **soglia minima** (default: **70**) è il **valore minimo** che la strength deve avere per aprire una posizione.

### Esempio Pratico:

#### Scenario 1: Soglia = 70 (default)
```
Segnale Ethereum:
- Strength: 75/100 ✅
- Soglia richiesta: 70/100
- Risultato: ✅ APRE la posizione (75 >= 70)
```

#### Scenario 2: Soglia = 70, ma segnale debole
```
Segnale Ethereum:
- Strength: 65/100 ❌
- Soglia richiesta: 70/100
- Risultato: ❌ NON apre (65 < 70, mancano 5 punti)
- Il bot aspetta che il segnale si rafforzi
```

#### Scenario 3: Soglia = 85 (più selettiva)
```
Segnale Ethereum:
- Strength: 80/100 ❌
- Soglia richiesta: 85/100
- Risultato: ❌ NON apre (80 < 85, mancano 5 punti)
- Il bot è più conservativo, richiede segnali più forti
```

#### Scenario 4: Soglia = 50 (meno selettiva)
```
Segnale Ethereum:
- Strength: 55/100 ✅
- Soglia richiesta: 50/100
- Risultato: ✅ APRE la posizione (55 >= 50)
- Il bot è più aggressivo, apre anche con segnali più deboli
```

---

## 🔧 Come Funziona nel Codice?

```javascript
// Il bot calcola la strength del segnale
const signalStrength = 75; // Esempio: 75/100

// Legge la soglia minima dai parametri (default 70)
const MIN_SIGNAL_STRENGTH = params.min_signal_strength || 70;

// Confronta
if (signalStrength >= MIN_SIGNAL_STRENGTH) {
    // ✅ APRE la posizione
    console.log("✅ Segnale sufficiente, apro posizione");
} else {
    // ❌ NON apre, aspetta
    console.log("⏳ Strength insufficiente, aspetto segnale più forte");
}
```

---

## 📈 Valori Tipici e Significato

| Soglia | Significato | Comportamento |
|--------|-------------|---------------|
| **50-60** | Molto aggressivo | Apre anche con segnali deboli, più trade ma più rischioso |
| **70** | Bilanciato (default) | Apre solo con segnali buoni, buon compromesso |
| **80-85** | Conservativo | Apre solo con segnali fortissimi, meno trade ma più sicuro |
| **90-100** | Molto conservativo | Apre solo in condizioni eccezionali, pochissimi trade |

---

## 💡 Perché Usare una Soglia?

### ✅ Vantaggi:
1. **Riduce falsi segnali**: Evita di aprire posizioni su segnali deboli
2. **Migliora win rate**: Apre solo quando gli indicatori sono allineati
3. **Riduce perdite**: Meno posizioni negative

### ⚠️ Svantaggi:
1. **Meno trade**: Con soglia alta, perdi alcune opportunità
2. **Possibile "over-engineering"**: Se troppo alta, il bot non apre mai

---

## 🎯 Raccomandazione

**Soglia 70** è un buon bilanciamento:
- ✅ Non troppo aggressiva (evita segnali deboli)
- ✅ Non troppo conservativa (permette trade validi)
- ✅ Buon compromesso tra numero di trade e qualità

**Puoi modificarla** nella "Configurazione Strategia RSI" → "Forza Minima Segnale":
- Se vuoi **più trade**: abbassa a 60-65
- Se vuoi **meno trade ma più sicuri**: alza a 75-80

---

## 🔍 Esempio Reale

### Ethereum - Segnale LONG con Strength 95/100:
```
Indicatori che confermano:
✅ RSI oversold (25) + uptrend → +25 punti
✅ MACD bullish → +30 punti
✅ Prezzo sopra tutte le EMA → +20 punti
✅ Prezzo stabile/sale → +10 punti
✅ Breakout pattern → +20 punti
✅ Multi-Timeframe bonus (1h/4h bullish) → +10 punti

Totale: 95/100

Con soglia 70: ✅ APRE (95 >= 70)
Con soglia 85: ✅ APRE (95 >= 85)
Con soglia 100: ❌ NON apre (95 < 100)
```

---

## 📝 In Sintesi

**La soglia minima è come un "filtro di qualità"**:
- Se il segnale ha strength **>= soglia** → ✅ Apre posizione
- Se il segnale ha strength **< soglia** → ❌ Non apre, aspetta

**Più alta la soglia, più selettivo il bot** (meno trade ma più sicuri).

