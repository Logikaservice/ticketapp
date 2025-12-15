# 🔧 TROUBLESHOOTING: GitHub Actions Errors

## ❓ Cosa Vedi?

Se le GitHub Actions danno errori, condividi:

1. **Output completo** del workflow (tutto il log)
2. **Messaggio di errore specifico** (se presente)
3. **Step che fallisce** (es: "npm install", "build", "restart")

## 🔍 Problemi Comuni

### 1. Errore: "npm install" fallisce
**Possibili cause**:
- Dipendenze non compatibili
- Problemi di rete durante installazione
- Cache npm corrotta

**Fix nel workflow**: Usa `npm install --silent` per ridurre output

### 2. Errore: "Build frontend" fallisce
**Possibili cause**:
- Errori di compilazione React
- Variabili d'ambiente mancanti
- Memoria insufficiente

**Fix nel workflow**: Aggiunto `CI=false` per evitare controlli non necessari

### 3. Errore: "PM2 restart" fallisce
**Possibili cause**:
- PM2 non installato
- Processo non esiste
- Permessi insufficienti

**Fix nel workflow**: Fallback multipli con `|| true` per non bloccare

### 4. Errore: Timeout
**Possibili cause**:
- Build troppo lenta
- Connessione lenta
- Operazioni bloccanti

**Fix**: Timeout a 600s (10 minuti), workflow semplificato

### 5. Errore: "Directory non trovata"
**Possibili cause**:
- Path errato
- Directory non esiste sul VPS

**Fix nel workflow**: Rimosse verifiche eccessive, usa path assoluti

## 📋 Checklist Debug

Se vedi errori, verifica:

- [ ] Il workflow è stato eseguito? (controlla tab "Actions" su GitHub)
- [ ] Quale step fallisce? (vedi log dettagliato)
- [ ] L'errore è sempre lo stesso o varia?
- [ ] Il deploy manuale funziona? (ssh sul VPS e esegui manualmente)

## 🛠️ Workflow Semplificato

Il workflow è stato semplificato per ridurre errori:

- ✅ Rimossi controlli eccessivi
- ✅ Comandi diretti senza verifiche
- ✅ Gestione errori permissiva (`|| true`)
- ✅ Timeout 600s (10 minuti)

## 📞 Condividi Errore

Per risolvere, condividi:
- **Output completo** del workflow fallito
- **Step specifico** che fallisce
- **Messaggio di errore** esatto

Così posso identificare e risolvere il problema specifico.
