# Analisi Sentiment Analysis: Fattibilità e Utilità

## Proposta
Implementare analisi del sentiment dai social media per:
- Bloccare trade se sentiment negativo
- Migliorare win rate del 5-8%

## Opzioni disponibili

### 1. **LunarCrush** ✅ RACCOMANDATO
- **Costo**: $24/mese (Individual) o $240/mese (Builder)
- **API**: 10 req/min (Individual) o 100 req/min (Builder)
- **Vantaggi**:
  - ✅ Già specializzato in crypto
  - ✅ Dati già processati (sentiment score, social metrics)
  - ✅ Supporta molte criptovalute
  - ✅ API ben documentata
- **Svantaggi**:
  - Costo mensile
  - Limiti di API (potrebbero non bastare per tutti i simboli)

### 2. **CryptoTwitter (Twitter API)**
- **Costo**: $100/mese (Basic tier) + sviluppo sentiment
- **Vantaggi**:
  - Dati diretti da Twitter
  - Controllo totale
- **Svantaggi**:
  - ❌ Costo alto
  - ❌ Richiede sviluppo custom per sentiment analysis
  - ❌ Complessità maggiore
  - ❌ Twitter API instabile

### 3. **Alternative gratuite/alternative**
- **Reddit API** (gratis ma limitato)
- **Telegram channels** (parsing manuale)
- **News APIs** (CoinDesk, CryptoCompare)

## Analisi Fattibilità

### ✅ FATTIBILE ma con considerazioni:

1. **Costo/Beneficio**:
   - Costo: $24-240/mese
   - Beneficio stimato: +5-8% win rate
   - Per un portfolio piccolo (€250-500): potrebbe non essere conveniente
   - Per portfolio più grandi: ROI positivo

2. **Utilità Reale**:
   - **PRO**: Il sentiment può anticipare movimenti
   - **CONTRO**: Il sentiment spesso segue il prezzo, non lo precede
   - **CONTRO**: Falsi positivi (FOMO, pump groups)
   - **CONTRO**: Delay nei dati (non real-time)

3. **Complessità Implementazione**:
   - **Tempo**: 1-2 giorni (stima corretta)
   - Integrazione API: 4-6 ore
   - Logica di blocco: 2-4 ore
   - Testing: 4-6 ore

## Raccomandazione

### ✅ IMPLEMENTARE ma con approccio graduale:

**FASE 1 - MVP (Minimal Viable Product)**:
1. Integrare LunarCrush API (piano $24/mese)
2. Aggiungere sentiment score come **informazione** (non blocker)
3. Mostrare sentiment nella "Deep Analysis"
4. Raccogliere dati per 1-2 settimane

**FASE 2 - Analisi Dati**:
1. Analizzare correlazione sentiment → performance trade
2. Verificare se sentiment negativo realmente previene perdite
3. Calcolare impatto reale sul win rate

**FASE 3 - Blocco Trade** (solo se FASE 2 positiva):
1. Implementare blocco trade se sentiment < soglia
2. Soglia configurabile (es. sentiment < 30 = blocco)
3. Override manuale disponibile

## Implementazione Consigliata

### Blocco Condizionale (Non Totale):
```javascript
// Non bloccare sempre, ma aggiungere penalità
if (sentiment < 30) {
    signal.strength -= 20; // Riduce strength, non blocca
    signal.reasons.push('Sentiment negativo (-20 strength)');
}
```

### Mostrare come Info:
- Aggiungere card "Sentiment" nella Deep Analysis
- Mostrare score 0-100 con colore (verde/rosso)
- Mostrare trend (miglioramento/peggioramento)

## Conclusione

✅ **FATTIBILE**: Sì, 1-2 giorni di sviluppo
✅ **UTILE**: Forse, ma da testare
⚠️ **COSTO**: $24/mese (accettabile per test)
📊 **IMPATTO**: Da verificare con dati reali (non garantito +5-8%)

**Prossimi Passi**:
1. Testare con piano LunarCrush Individual ($24/mese)
2. Implementare come "info" prima, non come blocker
3. Raccogliere dati per 2 settimane
4. Analizzare se aggiunge valore
5. Solo poi implementare logica di blocco
