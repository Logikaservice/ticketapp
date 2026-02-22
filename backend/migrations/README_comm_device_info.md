# Tabella comm_device_info (Dispositivi aziendali)

Se la pagina **Dispositivi aziendali** restituisce errore 500 o "nessun dato", la tabella `comm_device_info` potrebbe non esistere nel database. In quel caso puoi crearla con lo script di migrazione.

---

## Passaggi per avviare lo script dalla root

### 1. Aprire il terminale

- **In locale (Windows):** PowerShell o Prompt dei comandi.
- **Sul server (VPS):** connettiti via SSH e apri una sessione nella cartella del progetto.

### 2. Andare nella root del progetto

La **root** è la cartella principale che contiene:

- la cartella `backend`
- la cartella `frontend`
- il file `.env` (dove di solito c’è `DATABASE_URL`)
- eventualmente `package.json` in root

**Esempi:**

- Windows (sostituisci con il tuo percorso):
  ```bash
  cd c:\TicketApp
  ```

- Sul server Linux (sostituisci con il percorso reale):
  ```bash
  cd /home/tuoutente/TicketApp
  ```

**Verifica di essere in root:** dalla stessa cartella devono esistere `backend` e `.env`:

- Windows (PowerShell): `dir backend` e `dir .env`
- Linux/Mac: `ls backend` e `ls .env`

### 3. Eseguire lo script di migrazione

Sempre **dalla root** (non entrare in `backend`), lancia:

```bash
node backend/migrations/create_comm_device_info.js
```

- Il percorso `backend/migrations/create_comm_device_info.js` è **relativo alla root**, quindi va usato così.
- Lo script legge `DATABASE_URL` dal file `.env` nella root (o dalle variabili d’ambiente).

### 4. Controllare l’esito

- **"✅ Tabella comm_device_info creata con successo"** (o "esiste già"): tutto ok.
- **"❌ DATABASE_URL non configurato"**: lo script non trova un file `.env` con `DATABASE_URL`. Vedi sotto "Se manca DATABASE_URL".
- Errore di connessione al database: verifica che `DATABASE_URL` nel `.env` sia corretto (host, porta, utente, password, nome database).

### 5. Riavviare il backend

Dopo una migrazione andata a buon fine, riavvia il backend (es. con PM2: `pm2 restart all` o il nome del processo) e riprova la pagina **Dispositivi aziendali**.

---

## Riepilogo comandi (dalla root)

```bash
# 1. Vai nella root del progetto (esempio Windows)
cd c:\TicketApp

# 2. Esegui la migrazione
node backend/migrations/create_comm_device_info.js
```

Lo script usa `DATABASE_URL` dal file `.env` (database principale). Crea la tabella e gli indici; se la tabella esiste già, non fa nulla.

---

## Se manca DATABASE_URL

Sul server lo script cerca `.env` in: root progetto (`/var/www/ticketapp/.env`), poi `backend/.env`, poi la cartella corrente.

**Opzione A – File .env in root**  
Crea (o verifica) il file `/var/www/ticketapp/.env` e aggiungi una riga tipo:
```bash
DATABASE_URL=postgresql://utente:password@localhost:5432/nome_database
```
Poi riesegui: `node backend/migrations/create_comm_device_info.js`

**Opzione B – Stesso .env usato dal backend**  
Se il backend (PM2) prende le variabili da un altro percorso (es. `backend/.env` o un file caricato da systemd), assicurati che in quella stessa cartella ci sia un `.env` con `DATABASE_URL`, oppure copia quel file nella root del progetto come `.env`.

**Opzione C – Passare la variabile a mano**  
Se conosci già la stringa di connessione (come in PM2 o in un altro .env), puoi eseguire:
```bash
cd /var/www/ticketapp
DATABASE_URL="postgresql://utente:password@host:5432/nome_db" node backend/migrations/create_comm_device_info.js
```
Sostituisci con la tua connection string reale (stessa che usa l’app backend).
