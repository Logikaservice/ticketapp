# 📚 Spiegazione PM2 Mode: Fork vs Cluster vs Main

## Differenza tra "fork" e "main"

### ❌ Confusione Comune

- **"main"** = Branch Git (es. `git branch main`)
- **"fork"** = Modo di esecuzione PM2 (fork mode)

Sono due cose completamente diverse!

---

## PM2 Modes (Modi di Esecuzione)

PM2 ha diversi modi per eseguire applicazioni:

### 1. **Fork Mode** (Default - Quello che vedi)

```bash
pm2 start app.js --name myapp
# Mode: fork
```

**Caratteristiche:**
- ✅ Un solo processo Node.js
- ✅ Semplice e veloce
- ✅ Perfetto per la maggior parte delle applicazioni
- ✅ Usa meno memoria
- ✅ **È quello che hai tu e va bene così!**

**Quando usarlo:**
- Applicazioni standard
- Backend API
- La tua applicazione TicketApp

---

### 2. **Cluster Mode** (Multi-processo)

```bash
pm2 start app.js --name myapp -i 4
# Mode: cluster
# -i 4 = 4 istanze
```

**Caratteristiche:**
- 🔄 Più processi Node.js (istanze multiple)
- 🔄 Condivide il carico tra processi
- 🔄 Più memoria utilizzata
- 🔄 Utile per alta concorrenza

**Quando usarlo:**
- Applicazioni con molto traffico
- Quando serve scalabilità orizzontale
- Server con molte richieste simultanee

---

### 3. **Main** (Non è un modo PM2!)

"Main" si riferisce a:
- **Branch Git:** `git branch main` (il branch principale)
- **File principale:** `index.js` o `main.js` (il file che avvia l'app)

**NON è un modo PM2!**

---

## Il Tuo Caso

```
Name: ticketapp-backend
Mode: fork  ← Questo è CORRETTO e NORMALE!
```

**Perché "fork"?**
- PM2 esegue il processo in "fork mode" (default)
- È il modo standard per applicazioni Node.js
- Non c'è nulla di sbagliato!

---

## Verifica Configurazione PM2

### Vedi Configurazione Attuale:

```bash
# Vedi configurazione PM2
pm2 show ticketapp-backend

# Vedi file di configurazione PM2
cat ~/.pm2/dump.pm2
```

### Cambiare Mode (Se Necessario):

```bash
# Se volessi usare cluster mode (non necessario per te)
pm2 delete ticketapp-backend
pm2 start backend/index.js --name ticketapp-backend -i 2
# -i 2 = 2 istanze in cluster mode
```

**Ma non è necessario!** Fork mode va benissimo per la tua applicazione.

---

## Il Problema Reale

Il problema **NON è il mode "fork"** - è normale!

Il problema è:
- ❌ **Status: errored** (il backend crasha)
- ❌ **Restarts: 3091** (continua a riavviarsi)

Questo significa che c'è un **errore nel codice** che causa il crash.

---

## Cosa Controllare

### 1. Vedi l'Errore:

```bash
pm2 logs ticketapp-backend --lines 50 --nostream
```

### 2. Test Manuale:

```bash
cd /var/www/ticketapp/backend
node index.js
```

Questo ti mostrerà l'errore esatto che causa il crash.

---

## Conclusione

- ✅ **"fork" mode è CORRETTO** - è il modo standard PM2
- ✅ **"main" è il branch Git** - non c'entra con PM2 mode
- ❌ **Il problema è lo status "errored"** - dobbiamo vedere l'errore nei log

---

## Prossimi Passi

1. **Esegui:** `pm2 logs ticketapp-backend --lines 50 --nostream`
2. **Esegui:** `cd /var/www/ticketapp/backend && node index.js`
3. **Copia l'errore** e condividilo
4. **Fisso il problema** (non il mode, ma l'errore che causa il crash)

Il mode "fork" va bene, il problema è altrove! 🔍
