# 🧠 Logica di Ragionamento Avanzata - Smart Exit System

## Panoramica

Il sistema Smart Exit è stato migliorato con una **logica di ragionamento avanzata** che valuta ogni posizione aperta considerando:

1. **Condizione del mercato** (statico, lento, volatile)
2. **Momentum del prezzo** (velocità di movimento)
3. **Guadagno attuale vs potenziale** ulteriore guadagno
4. **Rischio di perdere** il guadagno attuale
5. **Opportunity cost** (simboli più vantaggiosi disponibili)

## Criteri di Chiusura

### 1. Segnale Opposto Forte (Logica Originale)
- **Condizione**: Segnale opposto con strength >= 60
- **Quando**: Posizione ha almeno 0.5% di profitto
- **Ragione**: Proteggere profitto da inversione di trend

### 2. Mercato Statico con Guadagno Sufficiente
- **Condizione**: ATR < 0.3% (mercato statico) + guadagno >= 0.5%
- **Quando**: Momentum < 0.1% (nessun movimento significativo)
- **Ragione**: Mercato statico senza momentum = rischio di perdere il guadagno

### 3. Mercato Statico per Troppo Tempo
- **Condizione**: ATR < 0.3% per più di 1 ora
- **Quando**: Posizione ha guadagno positivo
- **Ragione**: Liberare capitale per opportunità migliori

### 4. Trend che Si Indebolisce (Mercato Lento)
- **Condizione**: Mercato lento (ATR 0.3-0.5%) + guadagno >= 0.5%
- **Quando**: Segnale nella stessa direzione < 50 + momentum < 0.05%
- **Ragione**: Trend che si indebolisce = chiusura preventiva

### 5. Opportunity Cost
- **Condizione**: Altri simboli hanno segnali significativamente migliori (>1% di differenza)
- **Quando**: Posizione ha almeno 0.5% di profitto
- **Ragione**: Riallocare capitale su opportunità migliori

### 6. Protezione Profitto dopo Alti e Bassi
- **Condizione**: Guadagno >= 0.5% dopo variazione di prezzo > 0.3%
- **Quando**: Mercato ora statico (ATR < 0.3%) senza momentum
- **Ragione**: Dopo alti e bassi, mercato statico = proteggere il guadagno

## Configurazione

```javascript
const SMART_EXIT_CONFIG = {
    ENABLED: true,
    CHECK_INTERVAL_MS: 10000, // Controlla ogni 10 secondi
    
    // Soglie Mercato
    STATIC_MARKET_ATR_THRESHOLD: 0.3,  // ATR < 0.3% = statico
    SLOW_MARKET_ATR_THRESHOLD: 0.5,    // ATR 0.3-0.5% = lento
    
    // Soglie Profitto
    SUFFICIENT_PROFIT_IN_STATIC: 0.5,  // 0.5% sufficiente in mercato statico
    MIN_PROFIT_TO_PROTECT: 0.5,         // Minimo 0.5% per attivare protezione
    
    // Momentum
    MIN_MOMENTUM_FOR_HOLD: 0.1,         // Momentum minimo per tenere posizione
    
    // Tempo
    MAX_TIME_IN_STATIC_MARKET: 3600000, // 1 ora in mercato statico
    
    // Opportunity Cost
    OPPORTUNITY_COST_THRESHOLD: 1.0,    // 1% di differenza per considerare chiusura
};
```

## Esempio di Ragionamento

### Scenario: SHIB/USDT - Mercato Statico

**Situazione:**
- Posizione LONG aperta
- Guadagno attuale: +0.52%
- ATR: 0.25% (mercato statico)
- Momentum: 0.03% (quasi nullo)
- Trend: leggermente rialzista ma molto lento

**Ragionamento del Bot:**
1. ✅ Mercato è **statico** (ATR 0.25% < 0.3%)
2. ✅ Guadagno è **sufficiente** (0.52% >= 0.5%)
3. ✅ Momentum è **basso** (0.03% < 0.1%)
4. ❌ Nessun segnale opposto forte
5. ❌ Nessuna opportunità migliore disponibile

**Decisione**: **CHIUDERE**
- **Motivo**: "Mercato statico (ATR: 0.25%) con guadagno sufficiente (0.52%) ma senza momentum - Chiusura per evitare perdita"
- **Fattore**: `static_market_no_momentum`

## Log Output

Il sistema logga dettagliatamente ogni decisione:

```
🔍 [SMART EXIT] Analizzando 26 posizioni aperte con ragionamento avanzato...
🚨 [SMART EXIT] DECISIONE: Chiudere posizione 12345
   📊 Motivo: Mercato statico (ATR: 0.25%) con guadagno sufficiente (0.52%) ma senza momentum - Chiusura per evitare perdita
   💰 P&L Attuale: 0.52%
   🎯 Fattore Decisione: static_market_no_momentum
   📈 Condizione Mercato: static
   ⚡ Momentum: 0.03%
✅ [SMART EXIT] Posizione 12345 chiusa a €0.00000849 | P&L: 0.52%
```

## Monitoraggio

Per ogni posizione che **non** viene chiusa, il sistema logga:

```
📊 [SMART EXIT] 12345 | P&L: 0.52% | Mercato: slow | Momentum: 0.15% | Segnale Opposto: 35/100 - MANTENERE
```

## Personalizzazione

Puoi modificare le soglie in `backend/services/SmartExit.js`:

- **STATIC_MARKET_ATR_THRESHOLD**: Soglia per considerare mercato statico
- **SUFFICIENT_PROFIT_IN_STATIC**: Guadagno minimo per chiudere in mercato statico
- **MIN_MOMENTUM_FOR_HOLD**: Momentum minimo per mantenere posizione
- **MAX_TIME_IN_STATIC_MARKET**: Tempo massimo in mercato statico prima di chiudere

## Benefici

1. ✅ **Protezione Profitti**: Chiude prima di perdere guadagni in mercati statici
2. ✅ **Ottimizzazione Capitale**: Libera capitale per opportunità migliori
3. ✅ **Riduzione Rischio**: Evita di tenere posizioni in mercati senza movimento
4. ✅ **Decisioni Intelligenti**: Valuta multiple condizioni, non solo stop loss/take profit
