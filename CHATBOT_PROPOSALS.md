# 🤖 Proposte Chatbot Assistente Virtuale

## 📋 Obiettivo
Creare un assistente virtuale/chatbot che:
- Risponda a domande comuni
- Guidi nella creazione del ticket
- Sia facilmente accessibile e intuitivo

---

## 🎨 PROPOSTA 1: Widget Fluttuante (Consigliata)

### Posizione
- **Pulsante fisso** in basso a destra della schermata
- **Sempre visibile** ma non invasivo
- Si espande in una finestra chat quando cliccato

### Vantaggi
- ✅ Non occupa spazio nella dashboard
- ✅ Accessibile da qualsiasi pagina
- ✅ Design moderno e familiare (come molti chatbot)
- ✅ Può essere minimizzato/massimizzato

### Preview Struttura
```
┌─────────────────────────────────────┐
│  Dashboard / Lista Ticket          │
│                                     │
│  [Contenuto principale]            │
│                                     │
│                          ┌────────┐ │
│                          │  💬   │ │ ← Pulsante fisso
│                          └────────┘ │
└─────────────────────────────────────┘

Quando cliccato:
┌─────────────────────────────────────┐
│  Dashboard                          │
│                          ┌──────────┐│
│                          │ 🤖 Assistente│
│                          │ ──────────││
│                          │ Ciao!    ││
│                          │ Come posso││
│                          │ aiutarti?││
│                          │          ││
│                          │ [Input]  ││
│                          └──────────┘│
└─────────────────────────────────────┘
```

### File da creare
- `frontend/src/components/ChatbotWidget.jsx` - Componente principale
- `frontend/src/components/ChatbotWindow.jsx` - Finestra chat
- `frontend/src/utils/chatbotLogic.js` - Logica risposte e guida ticket

### Integrazione
- Aggiunto in `App.jsx` come componente globale
- Visibile su tutte le pagine

---

## 🎨 PROPOSTA 2: Integrato nel Dashboard

### Posizione
- **Sezione dedicata** nel Dashboard
- Sotto gli "Avvisi Importanti" o in una colonna laterale

### Vantaggi
- ✅ Visibile immediatamente nella dashboard
- ✅ Integrato nel flusso principale
- ✅ Può mostrare suggerimenti contestuali

### Preview Struttura
```
┌─────────────────────────────────────┐
│  Dashboard                          │
│  ┌─────────────┬──────────────────┐ │
│  │ Avvisi      │ 🤖 Assistente   │ │
│  │ Importanti  │ ────────────────│ │
│  │             │ Ciao! Come posso│ │
│  │             │ aiutarti?       │ │
│  │             │ [Input]         │ │
│  └─────────────┴──────────────────┘ │
└─────────────────────────────────────┘
```

### File da creare
- `frontend/src/components/ChatbotPanel.jsx` - Pannello integrato
- `frontend/src/utils/chatbotLogic.js` - Logica

### Integrazione
- Aggiunto in `Dashboard.jsx` come nuovo pannello

---

## 🎨 PROPOSTA 3: Integrato nel NewTicketModal

### Posizione
- **All'interno del modal** di creazione ticket
- Come assistente che guida passo-passo

### Vantaggi
- ✅ Guida contestuale durante la creazione
- ✅ Aiuta a compilare i campi correttamente
- ✅ Suggerimenti in tempo reale

### Preview Struttura
```
┌─────────────────────────────────────┐
│  Crea Nuovo Ticket          [X]    │
│  ┌────────────────────────────────┐│
│  │ Titolo: [________]             ││
│  │ Descrizione: [________]        ││
│  │                                ││
│  │ ┌────────────────────────────┐││
│  │ │ 🤖 Assistente              │││
│  │ │ Ti aiuto a creare il ticket│││
│  │ │ [Input]                    │││
│  │ └────────────────────────────┘││
│  └────────────────────────────────┘│
└─────────────────────────────────────┘
```

### File da creare
- `frontend/src/components/ChatbotTicketGuide.jsx` - Guida nel modal
- `frontend/src/utils/chatbotLogic.js` - Logica

### Integrazione
- Aggiunto in `NewTicketModal.jsx`

---

## 🎨 PROPOSTA 4: Modal Standalone

### Posizione
- **Pulsante nell'Header** (accanto ad Analytics, Settings, ecc.)
- Si apre come modal full-screen o sidebar

### Vantaggi
- ✅ Accessibile da header (sempre visibile)
- ✅ Non interferisce con il contenuto
- ✅ Può essere grande e dettagliato

### Preview Struttura
```
┌─────────────────────────────────────┐
│ [Header] [💬 Assistente] [Settings] │
│                                     │
│  Quando cliccato:                   │
│  ┌─────────────────────────────────┐│
│  │ 🤖 Assistente Virtuale      [X] ││
│  │ ────────────────────────────────││
│  │ Ciao! Come posso aiutarti?      ││
│  │                                 ││
│  │ [Input]                         ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### File da creare
- `frontend/src/components/Modals/ChatbotModal.jsx` - Modal principale
- `frontend/src/utils/chatbotLogic.js` - Logica

### Integrazione
- Aggiunto in `Header.jsx` come pulsante
- Gestito in `AllModals.jsx`

---

## 🧠 Logica del Chatbot

### Funzionalità Base
1. **Risposte a domande comuni:**
   - "Come creo un ticket?"
   - "Come vedo i miei ticket?"
   - "Quali sono le priorità disponibili?"
   - "Come contatto il supporto?"

2. **Guida nella creazione ticket:**
   - Suggerisce categoria in base alla descrizione
   - Suggerisce priorità
   - Aiuta a formulare titolo e descrizione
   - Può pre-compilare alcuni campi

3. **Suggerimenti contestuali:**
   - In base al ruolo utente (cliente/tecnico)
   - In base allo stato dei ticket
   - In base alle FAQ più comuni

### Struttura Dati
```javascript
// chatbotLogic.js
const chatbotResponses = {
  greetings: ["Ciao!", "Salve!", "Buongiorno!"],
  faq: {
    "come creo un ticket": {
      response: "Per creare un ticket, clicca sul pulsante 'Nuovo Ticket'...",
      action: "openNewTicket"
    },
    // ...
  },
  ticketGuidance: {
    categories: {
      "stampante": "assistenza",
      "installazione": "installazione",
      // ...
    }
  }
}
```

---

## 🎯 Raccomandazione

**PROPOSTA 1 (Widget Fluttuante)** è la migliore perché:
- ✅ Non invasiva
- ✅ Accessibile ovunque
- ✅ Design moderno e familiare
- ✅ Può essere combinata con PROPOSTA 3 (guida nel modal)

**Combinazione ideale:**
- Widget fluttuante per domande generali
- Guida integrata nel NewTicketModal per la creazione ticket

---

## 📝 Prossimi Passi

1. Scegli la proposta preferita
2. Creo i componenti base
3. Implemento la logica base
4. Aggiungo le risposte FAQ
5. Integro la guida per la creazione ticket
6. Test e raffinamenti

Quale proposta preferisci? Posso anche combinare più proposte!

