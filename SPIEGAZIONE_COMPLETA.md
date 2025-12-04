# 📊 Spiegazione Completa: Linee Grafico e Posizioni Aperte

## 🔵 LINEA BLU TRATTEGGIATA
**Cosa indica**: **Prezzo Corrente** di Bitcoin in tempo reale  
**Esempio**: Se vedi "€80.020,75", significa che 1 BTC vale attualmente €80.020,75  
**Aggiornamento**: Si aggiorna automaticamente ogni volta che il prezzo cambia

## 🟢 CANDELE VERDI
**Cosa indica**: Il prezzo è **SALITO** rispetto alla candela precedente  
**Significato**: Momento di forza rialzista

## 🔴 CANDELE ROSSE  
**Cosa indica**: Il prezzo è **SCESO** rispetto alla candela precedente  
**Significato**: Momento di forza ribassista

---

## ❓ PERCHÉ VEDO UN TRADE BUY CON P&L "Unrealized" MA NON VEDO LA POSIZIONE APERTA?

Questo è un problema di sincronizzazione:

1. **Il trade BUY viene creato** quando apri una posizione
2. **Il trade rimane nella storia** anche dopo che la posizione è chiusa
3. **Il frontend mostrava sempre "Unrealized"** per tutti i BUY, anche se la posizione non esiste più

**SOLUZIONE IMPLEMENTATA**: Ora il sistema verifica se esiste una posizione aperta corrispondente prima di mostrare "Unrealized". Se la posizione non esiste, il trade viene mostrato come "Chiusa".

**Differenza importante**:
- **"Recent Trades History"**: Mostra tutti i trade (STORIA - aperti e chiusi)
- **"Posizioni Aperte"**: Mostra solo le posizioni ancora ATTIVE (status = 'open')

Se vedi "Unrealized" ma non appare in "Posizioni Aperte", significa che la posizione è già stata chiusa.

