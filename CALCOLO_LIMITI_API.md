# 📊 Calcolo Limiti API e Numero Bot Sicuro

## Limiti API

### Binance REST API
- **Weight limit**: 1200 requests/minuto (per IP)
- **Weight per chiamata**: `/api/v3/ticker/price` = 1 weight
- **Limite pratico**: ~1200 chiamate/minuto = ~20 chiamate/secondo

### CoinGecko API
- **Free tier**: 10-50 chiamate/minuto (molto limitato)
- **Pro tier**: 500 chiamate/minuto
- **Attuale**: Free tier (molto restrittivo)

## Configurazione Attuale Sistema

- **CHECK_INTERVAL_MS**: 10 secondi (ciclo bot ogni 10 secondi)
- **PRICE_CACHE_TTL**: 60 secondi (cache valida per 60 secondi)
- **WebSocket**: Attivo (aggiorna cache automaticamente, zero rate limit)

## Calcolo Chiamate API

### Scenario 1: Senza Cache (peggiore caso)
- 62 bot attivi
- Ciclo ogni 10 secondi
- Ogni bot fa 1 chiamata per prezzo
- **Risultato**: 62 chiamate ogni 10 secondi = 6.2 chiamate/secondo = **372 chiamate/minuto**

### Scenario 2: Con Cache 60 secondi (caso reale)
- 62 bot attivi
- Cache TTL: 60 secondi
- Ogni prezzo viene richiesto solo 1 volta ogni 60 secondi
- Ciclo ogni 10 secondi = 6 cicli per refresh cache
- **Risultato**: 62 bot / 6 cicli = ~10 chiamate ogni 10 secondi = **60 chiamate/minuto**

### Scenario 3: Con WebSocket Attivo (caso ottimale)
- WebSocket aggiorna cache automaticamente per tutti i simboli
- Chiamate REST API solo per simboli non coperti da WebSocket
- **Risultato**: ~0-10 chiamate/minuto (solo fallback)

## Numero Bot Sicuro

### Con Cache 60s + WebSocket (configurazione attuale)
- **Binance**: 1200 chiamate/minuto disponibili
- **Utilizzo attuale**: ~60 chiamate/minuto (con 62 bot)
- **Capacità teorica**: 1200 / (60/10) = **200 bot** (teorico)
- **Con margine sicurezza 50%**: **~100 bot** (sicuro)
- **Con WebSocket attivo**: **150-200 bot** (molto sicuro)

### Con Solo Cache 60s (senza WebSocket)
- **Capacità teorica**: 1200 / 6 = **200 bot**
- **Con margine sicurezza 50%**: **~100 bot** (sicuro)

### Limitazione CoinGecko (fallback)
- **Free tier**: 10-50 chiamate/minuto
- **Con 62 bot**: Se Binance fallisce, CoinGecko viene usato come fallback
- **Problema**: CoinGecko free tier è troppo limitato
- **Soluzione**: Usa principalmente WebSocket (zero rate limit) + cache

## Raccomandazione

### Configurazione Ottimale
1. **WebSocket attivo** ✅ (già implementato)
2. **Cache TTL 60 secondi** ✅ (già implementato)
3. **Numero bot sicuro**: **80-100 bot attivi** (con margine sicurezza)

### Se Vuoi Essere Più Conservativo
- **50-70 bot attivi**: Molto sicuro, lascia spazio per picchi
- **100-120 bot attivi**: Sicuro con WebSocket attivo
- **150+ bot attivi**: Possibile ma rischioso se WebSocket si disconnette

## Calcolo Pratico

```
Chiamate/minuto = (Numero Bot) / (Cache TTL / Check Interval)
                 = (Numero Bot) / (60 / 10)
                 = (Numero Bot) / 6

Esempi:
- 30 bot: 30/6 = 5 chiamate/minuto ✅ Molto sicuro
- 60 bot: 60/6 = 10 chiamate/minuto ✅ Sicuro
- 100 bot: 100/6 = ~17 chiamate/minuto ✅ Sicuro con WebSocket
- 120 bot: 120/6 = 20 chiamate/minuto ⚠️ Vicino al limite
- 200 bot: 200/6 = ~33 chiamate/minuto ❌ Troppo (senza WebSocket)
```

## Conclusione

**Per il tuo progetto, con WebSocket attivo e cache 60s:**
- **Sicuro**: 80-100 bot attivi
- **Conservativo**: 50-70 bot attivi
- **Massimo teorico**: 150 bot (se WebSocket sempre attivo)

**Raccomandazione**: Mantieni **60-80 bot attivi** per avere un buon equilibrio tra funzionalità e sicurezza.

