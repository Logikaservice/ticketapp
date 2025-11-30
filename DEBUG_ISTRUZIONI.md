# 🔍 Istruzioni Debug - Messaggi Non Urgenti

## ⚠️ PROBLEMA
I messaggi non urgenti non appaiono nella parte inferiore quando lo schermo è diviso.

## 📋 Cosa Fare DOPO il Deploy

### 1. Aspetta che il Deploy Finisca
- Vai su: https://github.com/Logikaservice/ticketapp/actions
- Attendi che il workflow #652 finisca (dovrebbe essere verde)

### 2. Ricarica la Pagina PackVision
- Ricarica la pagina completamente (Ctrl+F5 o Ctrl+Shift+R)

### 3. Apri la Console del Browser
- Premi **F12** (o Ctrl+Shift+I)
- Vai alla tab **"Console"**

### 4. Cerca i Log

Dovresti vedere log che iniziano con:
- `🔍 [PackVision] ====== STATO ATTUALE ======`
- `🔍 [PackVision] activeMessages:`
- `🔍 [PackVision] urgentMessages:`
- `🔍 [PackVision] nonUrgentMessages:`
- `🔍 [PackVision] Condizione schermo diviso:`

### 5. Condividi con me

Copia/incolla TUTTI i log che vedi, oppure fai uno screenshot della console.

## 📊 Cosa Verificare

Nei log, controlla:
1. **nonUrgentMessages.length** - deve essere > 0
2. **Condizione schermo diviso** - deve avere `shouldSplit: true`
3. **shouldKeepUrgentFullScreen** - deve essere `false` dopo 12 secondi

## 🔧 Se non vedi i log

- Il deploy potrebbe non essere completato
- La pagina potrebbe non essere stata ricaricata
- Prova a svuotare la cache del browser (Ctrl+Shift+Del)

## ⏱️ Timing

Dopo aver creato un messaggio urgente, aspetta **almeno 12 secondi** prima che lo schermo possa dividersi.

