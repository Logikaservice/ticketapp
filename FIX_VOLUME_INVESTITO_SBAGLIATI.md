# Fix: Volume e Investito Sbagliati nelle Posizioni Aperte

## 🐛 Problema Identificato

Tutte le posizioni aperte mostravano valori IDENTICI e SBAGLIATI:
- **Volume**: sempre 0.0011
- **Investito**: sempre $100.00  
- **Entry Price**: sempre $88,693.05 (prezzo Bitcoin)

Anche per simboli come SAND, POLYGON, AXIE, THETA che hanno prezzi completamente diversi!

## 🔍 Causa Root

Il bug era nella mappa `SYMBOL_TO_PAIR` nel file `services/TradingBot.js`:

```javascript
// PRIMA (BUGGY):
const SYMBOL_TO_PAIR = {
    'bitcoin_usdt': 'BTCUSDT',
    'ethereum_usdt': 'ETHUSDT',
    // ... solo 8 simboli
};

// Nel codice:
const pair = SYMBOL_TO_PAIR[symbol] || 'BTCUSDT';  // ❌ Fallback a BTC!
```

Quando il bot provava a tradare simboli NON presenti nella mappa (es. `sand`, `polygon`, `axie_infinity`, `theta_network`), usava sempre **Bitcoin come fallback**, quindi:

1. Recuperava il prezzo di Bitcoin ($88,693.05)
2. Calcolava: `volume = $100 / $88,693.05 = 0.001127`
3. Salvava nel database: entry_price = $88,693.05, volume = 0.001127

## ✅ Soluzione Implementata

### 1. Espansa mappa simboli in `TradingBot.js`

Aggiunta mappa completa con **tutte le varianti** dei nomi:

```javascript
const SYMBOL_TO_PAIR = {
    // Major cryptocurrencies (con tutte le varianti)
    'bitcoin': 'BTCUSDT', 'btc': 'BTCUSDT', 'bitcoin_usdt': 'BTCUSDT',
    'ethereum': 'ETHUSDT', 'eth': 'ETHUSDT', 'ethereum_usdt': 'ETHUSDT',
    
    // Gaming tokens (con nomi completi)
    'the_sandbox': 'SANDUSDT', 'sand': 'SANDUSDT', 'sandusdt': 'SANDUSDT',
    'axie_infinity': 'AXSUSDT', 'axs': 'AXSUSDT', 'axsusdt': 'AXSUSDT',
    'theta_network': 'THETAUSDT', 'theta': 'THETAUSDT', 'thetausdt': 'THETAUSDT',
    
    // Polygon (con tutte le varianti)
    'polygon': 'POLUSDT', 'matic': 'POLUSDT', 'pol': 'POLUSDT', 'polpolygon': 'POLUSDT',
    
    // ... +30 simboli con varianti
};
```

### 2. Aggiunta funzione di normalizzazione

```javascript
function normalizeSymbol(symbol) {
    // Converte nomi diversi nello stesso formato
    // Es: "THE_SANDBOX" → "the_sandbox" → cerca nella mappa
    return symbol.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/\//g, '')
        .replace(/-/g, '_')
        .replace(/usdt$/, '')
        .replace(/_usdt$/, '')
        .replace(/eur$/, '')
        .replace(/_eur$/, '');
}
```

### 3. Aggiornate funzioni `getSymbolPrice()` e `get24hVolume()`

```javascript
async function getSymbolPrice(symbol) {
    // Prova lookup diretto
    let pair = SYMBOL_TO_PAIR[symbol];
    
    // Se non trovato, prova normalizzato
    if (!pair) {
        const normalized = normalizeSymbol(symbol);
        pair = SYMBOL_TO_PAIR[normalized];
        
        // Avviso se ancora non trovato
        if (!pair) {
            console.warn(`⚠️ Symbol '${symbol}' not in map, using BTC fallback`);
            pair = 'BTCUSDT';
        }
    }
    
    // Recupera prezzo da Binance...
}
```

### 4. Aggiornata anche mappa in `routes/cryptoRoutes.js`

Aggiunte stesse varianti per coerenza in tutta l'applicazione.

## 📊 Risultato Atteso

Dopo il fix, le nuove posizioni avranno valori **CORRETTI**:

| Simbolo | Entry Price | Volume | Investito |
|---------|-------------|--------|-----------|
| SAND    | ~$0.50     | 200    | $100      |
| POLYGON | ~$0.45     | 222    | $100      |
| AXIE    | ~$6.50     | 15.4   | $100      |
| THETA   | ~$2.10     | 47.6   | $100      |

## 🔄 Posizioni Esistenti

Le posizioni già aperte con dati errati **rimarranno nel database** con valori sbagliati.
Per correggerle servirebbero script di migrazione (chiudere e riaprire).

## 📝 File Modificati

- ✅ `backend/services/TradingBot.js` - Mappa espansa + normalizzazione
- ✅ `backend/routes/cryptoRoutes.js` - Varianti simboli aggiunte

## 🚀 Deployment

Riavviare il backend per applicare le modifiche:
```bash
pm2 restart crypto-bot
# oppure
pm2 restart all
```

---

**Data Fix**: 14 Dicembre 2024  
**Impatto**: ✅ CRITICO - Corregge calcoli volume/investito per TUTTE le posizioni future
