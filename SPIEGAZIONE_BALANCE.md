# Spiegazione: Perché il Total Balance è €533.33 con €250 iniziali?

## Scenario
- **Balance iniziale**: €250
- **Total Balance attuale**: €533.33
- **1 posizione aperta**

## Come funziona il calcolo

### 1. Quando apri una posizione LONG:

**Esempio:** Compri crypto per €20
- `balance_usd` diventa: €250 - €20 = **€230**
- `holdings[crypto]` aumenta: +0.001 crypto (esempio)

### 2. Il Total Balance viene calcolato così:

```
Total Balance = balance_usd + (holdings × prezzo_corrente)
```

### 3. Se la tua crypto è salita di valore:

**Esempio:** La crypto che hai comprato per €20 ora vale €303.33
- `balance_usd` = €230
- `holdings × prezzo_corrente` = €303.33
- **Total Balance** = €230 + €303.33 = **€533.33** ✅

## Questo è CORRETTO!

Il Total Balance mostra il **valore totale del tuo portfolio**, inclusi:
- ✅ Il denaro che hai in conto (`balance_usd`)
- ✅ Il valore attuale delle crypto che possiedi (`holdings × prezzo`)

## Il profitto non è ancora realizzato

- Hai speso: €20
- Ora vale: €303.33
- **Profitto non realizzato**: €283.33
- Ma finché non chiudi la posizione, questo profitto è "virtuale"

## Quando realizzi il profitto

Quando chiudi la posizione:
- Vendendo la crypto, il `balance_usd` aumenterà del valore corrente
- Le `holdings` diminuiranno
- Il Total Balance rimarrà lo stesso, ma il profitto sarà "reale" nel balance

## Formula completa

```
Balance Iniziale: €250
- Costo posizione: €20
= Balance residuo: €230

+ Valore crypto attuale: €303.33
= Total Balance: €533.33

Profitto non realizzato: €533.33 - €250 = €283.33
```

