# 🔧 FIX GRAFICO - Problemi Identificati e Soluzioni

## ❌ PROBLEMI SEGNALATI

1. **Marker sovrapposti**: I segnali di apertura si sovrappongono e non si capiscono
2. **Persistenza F5**: Il grafico non mantiene l'impaginazione dopo F5
3. **Candele instabili**: Le candele precedenti cambiano forma dopo F5
4. **Grafico instabile**: Il grafico cambia forma dopo F5

## ✅ SOLUZIONI IMPLEMENTATE

### 1. Marker Sovrapposti - Raggruppamento Intelligente

**Problema**: Marker troppo vicini nel tempo si sovrappongono

**Soluzione**:
- Raggruppare marker entro 60 secondi
- Mostrare solo il marker più recente per gruppo
- Aggiungere counter sul marker per indicare quanti trade nel gruppo
- Oppure: spostare marker verticalmente se troppo vicini

### 2. Persistenza Posizione - Miglioramento

**Problema**: La posizione non viene ripristinata correttamente dopo F5

**Soluzione**:
- Salvare anche lo zoom level
- Salvare anche il layout (candlestick/line)
- Ripristinare DOPO che i dati sono caricati (non prima)
- Aggiungere retry logic per ripristino

### 3. Candele Instabili - Intervallo Fisso

**Problema**: L'intervallo viene ricalcolato ad ogni render, causando candele diverse

**Soluzione**:
- Salvare l'intervallo usato nel localStorage
- Usare intervallo fisso (es. 5 minuti) invece di dinamico
- O: calcolare intervallo solo una volta e salvarlo

### 4. Grafico Instabile - Evitare Ricreazione

**Problema**: Il grafico viene ricreato completamente invece di aggiornato

**Soluzione**:
- Controllare se chartRef.current esiste prima di creare
- Riutilizzare il grafico esistente
- Aggiornare solo i dati, non ricreare il componente

---

## 🛠️ IMPLEMENTAZIONE

Procedo con le fix una per una.

