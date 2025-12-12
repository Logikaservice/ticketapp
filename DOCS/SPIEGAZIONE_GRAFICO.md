# 📊 Spiegazione Linee e Posizioni sul Grafico Crypto

## 🔵 Linea Blu Tratteggiata
**Nome**: Prezzo Corrente  
**Cosa indica**: Il prezzo attuale di Bitcoin in tempo reale  
**Aggiornamento**: Si aggiorna automaticamente ogni volta che il prezzo cambia  
**Esempio**: Se vedi "€80.020,75", significa che 1 BTC vale attualmente €80.020,75

## 🟢 Candele Verdi
**Cosa indica**: Il prezzo è SALITO rispetto alla candela precedente  
**Significato**: Momento di forza rialzista

## 🔴 Candele Rosse  
**Cosa indica**: Il prezzo è SCESO rispetto alla candela precedente  
**Significato**: Momento di forza ribassista

---

## ❓ Perché vedo un trade BUY con P&L "Unrealized" ma non vedo la posizione aperta?

Questo succede quando:

1. **La posizione è già stata chiusa**: Quando chiudi una posizione (vendendo), il trade BUY rimane nella storia `trades`, ma la posizione viene rimossa da `open_positions`. Il sistema mostrava sempre "Unrealized" per tutti i BUY, anche se la posizione non esiste più.

2. **Sincronizzazione**: A volte c'è un ritardo tra quando viene creato il trade e quando viene aggiornata la posizione.

**Soluzione implementata**: Il sistema ora verifica se esiste una posizione aperta corrispondente prima di mostrare "Unrealized". Se la posizione non esiste, il trade viene mostrato come "Chiusa".

---

## 🔄 Come funziona?

- **"Recent Trades History"**: Mostra tutti i trade (aperti e chiusi) - questa è la STORIA
- **"Posizioni Aperte"**: Mostra solo le posizioni ancora ATTIVE (status = 'open')

Se vedi un BUY con "Unrealized" ma non appare in "Posizioni Aperte", significa che la posizione è già stata chiusa.

