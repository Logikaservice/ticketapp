# ⚙️ INTEGRAZIONE GENERAL SETTINGS - ISTRUZIONI

## ✅ COMPONENTE CREATO

**File**: `frontend/src/components/CryptoDashboard/GeneralSettings.jsx`

**Funzionalità**:
- ✅ Toggle Email Notifications
- ✅ Toggle Suoni (con slider volume + test)
- ✅ Toggle Avvisi Market Scanner
- ✅ Gestione Portfolio (Aggiungi Fondi + Reset)
- ✅ Auto-Refresh Interval (5-60 secondi)
- ✅ Salvataggio automatico in localStorage

---

## 🔧 INTEGRAZIONE NEL DASHBOARD

### Step 1: Import già aggiunto ✅
```jsx
import GeneralSettings from './GeneralSettings';
```

### Step 2: Sostituire il vecchio dropdown portfolio

**Trova** (circa linea 518-629):
```jsx
{/* Portfolio Management Dropdown */}
<div id="portfolio-menu-container" style={{ position: 'relative' }}>
    <button id="portfolio-menu-button" ...>
        <Wallet size={18} />
        <ChevronDown size={14} />
    </button>
    {/* ... tutto il dropdown menu ... */}
</div>
```

**Sostituisci con**:
```jsx
{/* General Settings */}
<GeneralSettings
    onResetPortfolio={handleResetPortfolio}
    onAddFunds={() => setShowAddFundsModal(true)}
    showPortfolioMenu={showPortfolioMenu}
    setShowPortfolioMenu={setShowPortfolioMenu}
/>
```

---

## 📋 CODICE COMPLETO DA SOSTITUIRE

**Rimuovi** dalle linee 518-629 (tutto il blocco portfolio dropdown)

**Aggiungi** al suo posto:
```jsx
                        {/* General Settings */}
                        <GeneralSettings
                            onResetPortfolio={handleResetPortfolio}
                            onAddFunds={() => setShowAddFundsModal(true)}
                            showPortfolioMenu={showPortfolioMenu}
                            setShowPortfolioMenu={setShowPortfolioMenu}
                        />
                    </div>
                </div>
            </div>
```

---

## 🎨 RISULTATO FINALE

### Prima (4 pulsanti separati):
```
[⚙️ Settings] [📊 Backtest] [🔍 Analisi] [💼 Portfolio ▼]
```

### Dopo (3 pulsanti + Impostazioni):
```
[⚙️ Settings] [📊 Backtest] [🔍 Analisi] [⚙️ Impostazioni]
```

### Pannello Impostazioni include:
```
┌─────────────────────────────────┐
│ ⚙️ Impostazioni Generali        │
├─────────────────────────────────┤
│ 📧 Notifiche Email      [ON/OFF]│
│ 🔊 Suoni Notifiche      [ON/OFF]│
│    Volume: 30% [━━━━━━━━━━]     │
│    [🔊 Test Suono]              │
│ 🔔 Avvisi Market Scanner [ON/OFF]│
│ ─────────────────────────────── │
│ 💼 Gestione Portfolio           │
│    [💰 Aggiungi Fondi]          │
│    [🔄 Reset Portfolio]         │
│ ─────────────────────────────── │
│ 🔄 Auto-Refresh                 │
│    Ogni 10s [━━━━━━━━━━]        │
└─────────────────────────────────┘
```

---

## 🔧 FUNZIONALITÀ EXTRA

### Email Notifications
- Quando **OFF**: Non invia email (ma continua a salvare nel DB)
- Quando **ON**: Invia email a info@logikaservice.it

### Sound Notifications
- Quando **OFF**: Nessun suono
- Quando **ON**: Suoni diversi per ogni evento
- **Volume**: Regolabile 0-100%
- **Test**: Pulsante per testare il suono

### Market Scanner Alerts
- Quando **ON**: Mostra badge quando rileva opportunità (strength > 70)
- Quando **OFF**: Nessun badge

### Auto-Refresh
- **Range**: 5-60 secondi
- **Default**: 10 secondi
- Controlla frequenza aggiornamento dashboard

---

## 💾 SALVATAGGIO PREFERENZE

Tutte le impostazioni vengono salvate automaticamente in:
```javascript
localStorage.getItem('crypto_general_settings')
```

**Struttura**:
```json
{
  "emailNotifications": true,
  "soundEnabled": true,
  "soundVolume": 30,
  "marketScannerAlerts": true,
  "darkMode": false,
  "autoRefreshInterval": 10
}
```

---

## 🚀 PROSSIMI PASSI

1. **Sostituisci** il codice come indicato sopra
2. **Ricarica** il dashboard (Ctrl+Shift+R)
3. **Clicca** su "Impostazioni" in alto a destra
4. **Configura** le tue preferenze
5. **Testa** i suoni con il pulsante "Test Suono"

---

## ✅ COMMIT COMPLETATO

```
Commit: 7043101
Message: "⚙️ Created GeneralSettings component..."
Status: ✅ Pushed to GitHub
```

---

**Il componente è pronto! Basta sostituire il vecchio dropdown con il nuovo componente.** 🎉
