# ✅ NUOVA LOGICA RISK MANAGER - Fixed Position Sizing

## 🎯 Obiettivo
Sistema aggressivo che **cresce con il portfolio** ma **mai scende sotto €80** per posizione.

## 📐 Formula

```javascript
FIXED_POSITION_PCT = 0.08  // 8% del portfolio
MIN_POSITION_SIZE = 80.0   // Minimo assoluto €80

// Calcolo
calculatedSize = totalEquity * 0.08
finalSize = Math.max(calculatedSize, 80.0)  // Mai meno di €80
finalSize = Math.min(finalSize, cashBalance) // Non più del cash disponibile
```

## 📊 Esempi Pratici

### Portfolio €1000
```
Calculated: €1000 * 8% = €80
Final: €80 (uguale al minimo)
Max posizioni: 10 (€800 / €80)
Exposure: 80%
```

### Portfolio €2000 (dopo guadagni)
```
Calculated: €2000 * 8% = €160
Final: €160 (sopra il minimo, cresce!)
Max posizioni: 10 (€1600 / €160)
Exposure: 80%
```

### Portfolio €5000 (dopo più guadagni)
```
Calculated: €5000 * 8% = €400
Final: €400 (continua a crescere!)
Max posizioni: 10 (€4000 / €400)
Exposure: 80%
```

### Portfolio €500 (dopo perdite)
```
Calculated: €500 * 8% = €40
Final: €80 (MINIMO APPLICATO - protegge da posizioni troppo piccole)
Max posizioni: 6 (€480 / €80)
Exposure: 96% (quasi tutto)
```

### Portfolio €100 (situazione critica)
```
Calculated: €100 * 8% = €8
Final: €80 (MINIMO APPLICATO)
Max posizioni: 1 (€80 / €80)
Exposure: 80%
Cash rimanente: €20
```

## ✅ Vantaggi

1. **Semplice**: Sempre 8% del portfolio o €80, il maggiore
2. **Prevedibile**: Sai sempre quanto investirai
3. **Cresce**: Posizioni più grandi quando portfolio cresce
4. **Protettivo**: Minimo €80 evita posizioni troppo piccole
5. **Consistente**: Tutte le posizioni stessa dimensione

## 🚀 Comportamento in Crescita

```
€1000  → €80/posizione  (10 posizioni)
€1500  → €120/posizione (10 posizioni)
€2000  → €160/posizione (10 posizioni)
€3000  → €240/posizione (10 posizioni)
€5000  → €400/posizione (10 posizioni)
€10000 → €800/posizione (10 posizioni)
```

**Sempre 10 posizioni massime, ma dimensioni crescenti!**

## 🛡️ Comportamento in Perdita

```
€1000 → €80/posizione (10 posizioni)
€800  → €80/posizione (10 posizioni) - MINIMO
€500  → €80/posizione (6 posizioni)  - MINIMO
€200  → €80/posizione (2 posizioni)  - MINIMO
€100  → €80/posizione (1 posizione)  - MINIMO
```

**Il minimo €80 protegge da posizioni insignificanti**

## ⚠️ Limiti di Sicurezza (Rimangono Attivi)

1. **Max Daily Loss**: 5% del portfolio
2. **Max Exposure**: 80% del portfolio (dinamico fino a 95% con win rate alto)
3. **Max Drawdown**: 10% dal picco
4. **Min Equity**: €50 (sotto questo, bot si ferma)

## 🔄 Differenze vs Kelly Criterion

| Aspetto | Kelly (Vecchio) | Fixed (Nuovo) |
|---------|----------------|---------------|
| **Dimensione** | Variabile (1-15%) | Fissa (8% o €80) |
| **Adattività** | Si adatta a win/loss | Cresce solo con portfolio |
| **Minimo** | Poteva scendere a €10 | Mai sotto €80 |
| **Complessità** | Alta (formule) | Bassa (semplice) |
| **Protezione perdite** | Riduceva size | Mantiene €80 |

## 🎯 Risultato Atteso

Con questa logica:
- ✅ **Nessuna posizione sotto €80**
- ✅ **Sempre 10 posizioni max** (80% portfolio)
- ✅ **Cresce con il portfolio** (€2000 → €160/pos)
- ✅ **Semplice e prevedibile**
- ✅ **Aggressivo ma controllato**

## 📝 Note Importanti

1. **Cash Disponibile**: Se hai €1000 ma 5 posizioni aperte (€400), hai €600 cash
   - Puoi aprire: 7 posizioni da €80 (€560)
   - Rimangono: €40 cash

2. **Exposure Dinamico**: Con win rate alto (>80%), il sistema può usare fino a 95% del portfolio
   - Portfolio €2000, win rate 85%
   - Max exposure: 95% = €1900
   - Position size: €160
   - Max posizioni: 11-12 invece di 10

3. **Protezione Capitale**: Se portfolio scende sotto €50, bot si ferma completamente
