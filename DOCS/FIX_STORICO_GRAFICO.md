# 🔧 FIX - Storico Grafico Non Visualizzato

## 📊 PROBLEMA

Il grafico mostra solo:
- ❌ Linea blu (prezzo corrente) anche senza storico
- ❌ Poche candele a destra
- ❌ Non mostra storico completo

## 🔍 CAUSA

Il database `price_history` potrebbe essere vuoto o avere pochi dati.

## ✅ SOLUZIONE IMPLEMENTATA

1. **Caricamento automatico da Binance**: Se il database ha meno di 50 dati, carica automaticamente le ultime 96 candele (24 ore) da Binance
2. **Rimossa linea blu senza storico**: La linea del prezzo corrente viene mostrata solo se ci sono dati storici
3. **Migliorato caricamento dati**: I dati vengono caricati in ordine cronologico corretto

## 🧪 VERIFICA

Dopo il deploy, il grafico dovrebbe:
1. Caricare automaticamente lo storico da Binance
2. Mostrare il grafico completo con tutte le candele
3. La linea blu appare solo quando ci sono dati storici

## 🔄 PROSSIMI PASSI

1. Deploy sul VPS
2. Riavviare backend
3. Aprire il dashboard
4. Verificare che lo storico venga caricato automaticamente

