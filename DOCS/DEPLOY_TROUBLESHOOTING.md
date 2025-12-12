# 🐛 TROUBLESHOOTING DEPLOY ERROR

## ❌ ERRORE

```
Process completed with exit code 1
```

## ✅ BUILD LOCALE FUNZIONA

```bash
npm run build
# ✅ Compiled successfully
# ✅ Exit code: 0
```

## 🔍 POSSIBILI CAUSE

### 1. **Node.js Version Mismatch**
Il VPS potrebbe avere una versione diversa di Node.js.

**Soluzione**:
```bash
# Sul VPS, verifica versione Node
node --version
npm --version

# Dovrebbe essere >= 16.x
```

### 2. **Dipendenze Mancanti**
Il VPS potrebbe non aver installato tutte le dipendenze.

**Soluzione**:
```bash
# Sul VPS
cd /path/to/ticketapp/frontend
npm install
npm run build
```

### 3. **File CSS Non Trovato**
Il file `CryptoStandalone.css` potrebbe non essere stato pullato.

**Soluzione**:
```bash
# Sul VPS
cd /path/to/ticketapp
git pull origin main
ls frontend/src/components/CryptoDashboard/CryptoStandalone.css
```

### 4. **Cache Build**
La cache del build potrebbe essere corrotta.

**Soluzione**:
```bash
# Sul VPS
cd /path/to/ticketapp/frontend
rm -rf node_modules
rm -rf build
npm install
npm run build
```

### 5. **Memory Limit**
Il build potrebbe fallire per mancanza di memoria.

**Soluzione**:
```bash
# Sul VPS, aumenta memoria Node
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

---

## 🚀 DEPLOY MANUALE (WORKAROUND)

Se il deploy automatico continua a fallire:

### **Step 1**: Build Locale
```bash
# Sul tuo PC
cd c:\TicketApp\frontend
npm run build
```

### **Step 2**: Copia Build su VPS
```bash
# Comprimi la cartella build
tar -czf build.tar.gz build/

# Copia su VPS (via SCP o FTP)
scp build.tar.gz user@vps:/path/to/ticketapp/frontend/
```

### **Step 3**: Deploy su VPS
```bash
# Sul VPS
cd /path/to/ticketapp/frontend
tar -xzf build.tar.gz
# Riavvia il server
pm2 restart all
```

---

## 📋 CHECKLIST DEBUG

- [ ] Verifica versione Node.js sul VPS
- [ ] Verifica che `CryptoStandalone.css` esista sul VPS
- [ ] Pulisci cache (`rm -rf node_modules build`)
- [ ] Reinstalla dipendenze (`npm install`)
- [ ] Prova build manuale sul VPS
- [ ] Verifica log completi del deploy
- [ ] Aumenta memoria Node se necessario

---

## 🎯 FILE AGGIUNTI IN QUESTO COMMIT

```
frontend/src/components/CryptoDashboard/CryptoStandalone.css
frontend/src/components/CryptoDashboard/GeneralSettings.jsx
frontend/src/utils/cryptoSounds.js
backend/services/CryptoEmailNotifications.js
```

**Verifica che tutti questi file esistano sul VPS dopo il pull!**

---

## ✅ VERIFICA FINALE

```bash
# Sul VPS
cd /path/to/ticketapp
git log --oneline -5

# Dovresti vedere:
# 93ae314 - Crypto Standalone COMPLETE
# 2b3da00 - Bug fix: Removed unused imports
# 883249f - Crypto Standalone CSS
# ...
```

Se vedi questi commit, il codice è aggiornato. Il problema è nel build.
