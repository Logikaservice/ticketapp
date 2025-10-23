# 📧 Configurazione Sistema Email

## 🚀 Setup Email per Notifiche Clienti

### **1. 📋 Variabili Environment (Render)**

Aggiungi queste variabili nel tuo backend su Render:

```bash
EMAIL_USER=your-email@yourdomain.com
EMAIL_PASSWORD=your-password
```

### **2. 🔐 Configurazione Email**

#### **Opzione A: Gmail**

##### **Passo 1: Abilita 2-Factor Authentication**
1. Vai su [Google Account](https://myaccount.google.com/)
2. Sicurezza → Verifica in due passaggi → Attiva

##### **Passo 2: Genera Password App**
1. Sicurezza → Password delle app
2. Seleziona "Mail" e "Altro (nome personalizzato)"
3. Inserisci "TicketApp"
4. Copia la password generata (16 caratteri)

##### **Passo 3: Configura Render**
- `EMAIL_USER`: Il tuo indirizzo Gmail completo
- `EMAIL_PASSWORD`: La password app generata (16 caratteri)

#### **Opzione B: Aruba (logikaservice.it)**

##### **Passo 1: Configurazione Aruba**
1. Usa la tua email Aruba: `ticketapp@logikaservice.it`
2. Usa la tua password normale di Aruba
3. Il sistema rileverà automaticamente il dominio Aruba

##### **Passo 2: Configura Render**
- `EMAIL_USER`: ticketapp@logikaservice.it
- `EMAIL_PASSWORD`: la-tua-password-aruba-normale

### **3. 🎯 Funzionalità Implementate**

#### **✅ Notifiche Automatiche**
- **Nuovo Ticket**: Email al cliente quando viene assegnato un ticket
- **Aggiornamento Ticket**: Email quando il ticket viene modificato
- **Calendario Google**: Il ticket appare automaticamente nel "TicketApp Test Calendar" condiviso

#### **✅ Template Email Professionali**
- Design responsive e moderno
- Informazioni complete del ticket
- Link diretto al sistema
- Branding TicketApp

#### **✅ Calendario Clienti**
- I clienti possono vedere il calendario
- Visualizzano solo i loro ticket
- Click sui giorni per vedere i dettagli

### **4. 📅 Sistema Calendario Condiviso**

#### **Come Funziona**
- **Service Account**: Crea eventi nel "TicketApp Test Calendar"
- **Condivisione Automatica**: Il calendario viene condiviso con tutti i clienti
- **Accesso Clienti**: I clienti vedono il calendario nel loro Google Calendar
- **Permessi**: I clienti hanno accesso in lettura (non possono modificare)

#### **Calendario Condiviso**
- **Nome**: "TicketApp Test Calendar"
- **Visibilità**: Appare nella lista calendari di ogni cliente
- **Sincronizzazione**: Automatica con tutti i ticket creati
- **Aggiornamenti**: In tempo reale quando i ticket vengono modificati

### **5. 🧪 Test Sistema**

#### **Test Creazione Ticket**
1. Crea un nuovo ticket assegnato a un cliente
2. Verifica che il cliente riceva l'email
3. Controlla che il ticket appaia nel suo calendario Google

#### **Test Aggiornamento Ticket**
1. Modifica un ticket esistente
2. Verifica che il cliente riceva l'email di aggiornamento
3. Controlla che il calendario si aggiorni

### **5. 🔧 Troubleshooting**

#### **Email non inviate**
- Verifica le variabili environment su Render
- Controlla i log del backend per errori
- Assicurati che la password app sia corretta

#### **Calendario non visibile**
- I clienti ora possono vedere il calendario
- Vedono solo i loro ticket assegnati
- Il calendario si sincronizza con Google Calendar

### **6. 📊 Monitoraggio**

I log del backend mostrano:
```
✅ Email notifica inviata al cliente: client@example.com
✅ Email aggiornamento inviata al cliente: client@example.com
```

### **7. 🎉 Risultato Finale**

**Ogni cliente riceverà:**
1. 📧 **Email automatica** quando gli viene assegnato un ticket
2. 📅 **Evento nel calendario Google** con tutti i dettagli
3. 🔄 **Email di aggiornamento** quando il ticket viene modificato
4. 🖥️ **Accesso al calendario** nell'app per vedere i suoi ticket

**Il sistema è completamente automatico e professionale!** 🚀
