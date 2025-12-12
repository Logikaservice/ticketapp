# Soluzione: Discrepanza Entry Price vs Grafico

## Problema
- **Entry Price**: €2681.19 (in EUR)
- **Grafico**: ETH/USDT mostra prezzi in USDT (~$2900-3100)
- Sembra che il prezzo entry non corrisponda al grafico

## Spiegazione

### Il sistema converte tutto in EUR
1. Binance fornisce prezzi in USDT: ETH = ~$2913 USDT
2. Il sistema converte in EUR: $2913 × 0.92 = €2681.19
3. L'entry price viene salvato in EUR nel database

### Il grafico mostra USDT
- TradingView mostra ETH/USDT con prezzi in USDT ($2900-3100)
- Questo è normale: il grafico mostra la coppia originale

## Soluzione Implementata

**Aggiungere indicazione valuta nei prezzi:**
- Mostrare chiaramente "EUR" accanto ai prezzi convertiti
- Aggiungere tooltip che spiega: "Prezzo convertito da USDT a EUR (tasso: ~0.92)"

## Verifica

Il prezzo è **CORRETTO**:
- Se ETH era $2913 USDT al momento dell'apertura
- Convertito: $2913 × 0.92 = €2681.19 ✅

Il "problema" è solo visivo: grafico in USDT, entry in EUR.

## Opzioni

1. ✅ **Aggiungere indicazione valuta** (raccomandato)
2. Mostrare grafico in EUR (ETHEUR) invece di USDT
3. Mostrare entry price anche in USDT accanto a EUR
