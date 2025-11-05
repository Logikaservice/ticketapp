## TicketApp – Datasheet Utente

### Scopo
Guida rapida e schematica per usare TicketApp (tecnico e cliente), pronta per stampa/ PDF.

### Ruoli supportati
- Tecnico: crea/gestisce ticket, registro intervento, allegati, sincronizzazione calendario, report.
- Cliente: crea ticket, consulta stato, messaggi, report inviati.

### Dashboard e Navigazione
- Ricerca Avanzata: ricerca per numero, titolo, descrizione, richiedente, messaggi, registro intervento (descrizioni, materiali, offerte).
- Stati principali: Aperto, In lavorazione, Risolto, Inviato, Fatturato, Chiuso.
- Filtri cliente (al tecnico): selettore ad albero per azienda → clienti; icona corona indica amministratore; filtri Mese/Anno compatti.
- Calendario: mostra ticket per data apertura; clic su giorno → lista ticket; sincronizzazione con Google Calendar.

### Ticket – Creazione e gestione
1) Creazione rapida (Quick Request)
- Dati: Titolo, Descrizione, Nome/Cognome, Email, Telefono, Azienda.
- Foto opzionali: carica immagini dal telefono (multiplo).

2) Nuovo Ticket (tecnico/cliente autenticato)
- Dati: Cliente (se tecnico), Titolo, Descrizione, Categoria, Priorità, Richiedente, Data apertura.
- Foto: selezione multipla; i file sono memorizzati in `photos` (non compaiono nei report, stampabili separatamente dalla finestra Foto).

3) Modifica Ticket
- Modifica campi e Data apertura (calendario e sync rispettano la data aggiornata).
- Sync Google Calendar: avviene automaticamente al salvataggio.

4) Foto Ticket
- Stati abilitati: Aperto, In lavorazione, Risolto.
- Azioni: visualizza, carica, elimina, stampa separatamente.

### Chat e Notifiche
- Messaggi in ticket con evidenza “non letto”.
- Avvisi (Alert): contenuto selezionabile (Informazione, Avviso, Critico, Nuove funzionalità); destinatari con selettore ad albero; icone e colori coerenti.

### Registro Intervento (Time Logger)
- Sezioni
  - Modalità (testo), Data, Ora Inizio/Fine (o evento giornaliero).
  - Costo Manodopera: Ore, Costo Unit. (€/h), Sconto (%), Costo Scontato (auto), Totale (auto).
  - Materiali: Nome, Qta (default 0 se nome vuoto), Costo (€), Totale (Qta×Costo) auto.
  - Come da Offerta: Offerta n°, Data, Qta, Costo Unit. (€), Sconto (%), Totale (€) auto, Descrizione, Allegati documento (PDF/Immagini/Word/Excel) con rimozione.
- Calcoli
  - Costo scontato = costo unitario × (1 − sconto/100).
  - Totale manodopera = ore × costo scontato.
  - Totali materiali = somma riga (qta×costo).
  - Totali offerte = somma riga.
- Sincronizzazione Google Calendar
  - Alla conferma/salvataggio, l’evento viene aggiornato con: modalità, date/ore, descrizione, materiali (con quantità e subtotale), offerte (con totale) e totale riga.
  - Se l’evento non esiste ancora, viene creato automaticamente e collegato al ticket.

### Report
- Ticket singolo: sezione “Come da Offerta” in stampa con tabella (Offerta n°, Data, Qta, Costo Unit., Sconto %, Totale, Descrizione) e Totale Generale.
- Report “Inviato” (cliente) e “Fatturato” (tecnico): generazione lista/report da dashboard.

### Allegati
- Ticket Foto: immagini con anteprima; stampa separata.
- Offerta: PDF/immagini/Word/Excel (max ~15MB ciascuno); lista con link, peso, e rimozione; percorsi esposti dal backend.

### Sicurezza e Ruoli
- Autenticazione JWT; differenzia privilegi (tecnico/cliente).
- Le azioni di upload e sync rispettano i permessi di ruolo.

### Best practice d’uso
- Impostare sempre la Data apertura corretta in fase di creazione/modifica se si desidera un corretto posizionamento nel calendario.
- Caricare foto direttamente da mobile per documentare il contesto (non incluse nei report di intervento; stampa a parte).
- Usare il registro intervento per tracciare puntualmente materiali e offerte: i totali sono calcolati automaticamente.

### Risoluzione problemi
- Sync calendario non aggiorna: verificare
  - che il ticket abbia un `googlecalendareventid` (verrà creato se manca al prossimo update),
  - che la Data apertura sia nel formato corretto (YYYY-MM-DD o ISO),
  - credenziali Service Account configurate (GOOGLE_CLIENT_EMAIL/PRIVATE_KEY).
- Upload file rifiutato: controllare tipo (immagini/PDF/Word/Excel) e dimensione (15MB max per offerta, 10MB per foto).

### Note tecniche (riepilogo)
- Ticket: `photos` (JSONB), `timelogs` con `materials` e `offerte` normalizzati.
- Sync Calendar
  - Creazione/Update: parsing data robusto, timezone Europe/Rome.
  - Descrizione evento: dettaglio registro intervento con totali.
  - Gestione ID evento: supporto sia `googleCalendarEventId` che `googlecalendareventid`, fallback su DB.

### Esportazione in PDF (senza deploy)
Opzioni rapide su Windows:
- Browser (consigliato):
  1. Apri questo file (`DOCS/Datasheet_TicketApp.md`) nel browser (es. GitHub o un viewer Markdown).
  2. Stampa → Destinazione “Salva come PDF” → Salva.
- VS Code:
  1. Installa estensione “Markdown PDF”.
  2. Apri il file → Comando “Markdown PDF: Export (pdf)”.
- pandoc (se installato):
  - `pandoc DOCS/Datasheet_TicketApp.md -o DOCS/Datasheet_TicketApp.pdf`

Versione: 1.0 – Ultimo aggiornamento: {DATA}


