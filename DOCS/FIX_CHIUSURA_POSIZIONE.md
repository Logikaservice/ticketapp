# 🐛 Fix: Errore Chiusura Posizione

## ❌ Problema

Quando provavi a chiudere una posizione, vedevi questo errore:
```
SQLITE_CONSTRAINT: CHECK constraint failed: status IN ('open', 'closed', 'stopped', 'taken')
```

## 🔍 Causa

Il database ha un constraint che permette solo questi status:
- `'open'`
- `'closed'`
- `'stopped'`
- `'taken'`

Ma quando chiudevi manualmente una posizione, il sistema passava `'manual'` come status, che **non è valido**!

## ✅ Soluzione

Ho aggiunto un **mapping automatico** del motivo di chiusura agli status validi:

```javascript
// Mapping corretto:
'modal' → 'closed'
'taken' → 'taken'
'taken (TP2)' → 'taken'
'stopped' → 'stopped'
'stopped (SL)' → 'stopped'
```

## 🧪 Test

Ora puoi:
1. ✅ Chiudere posizioni manualmente (click su X)
2. ✅ Posizioni si chiudono automaticamente a SL/TP
3. ✅ Nessun errore SQLITE_CONSTRAINT

## 🚀 Deploy

Fix deployato su GitHub! ✅

---

**Prova ora a chiudere una posizione - dovrebbe funzionare! 🎉**

