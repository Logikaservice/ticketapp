# 🚀 Istruzioni Push da Windows

## ⚠️ IMPORTANTE: Dove Eseguire i Comandi

I comandi Git devono essere eseguiti sul **TUO COMPUTER WINDOWS**, NON sul server Linux!

## 📍 Percorsi Corretti

- **Windows (tuo PC):** `c:\TicketApp`
- **Server Linux:** `/var/www/ticketapp` (qui fai solo `git pull`)

## 🔧 Procedura Corretta

### Step 1: Sul TUO Computer Windows

1. Apri **PowerShell** o **Git Bash** sul tuo PC
2. Vai nella directory del progetto:
   ```powershell
   cd c:\TicketApp
   ```

3. Verifica lo stato:
   ```bash
   git status
   ```

4. Aggiungi i file modificati:
   ```bash
   git add -A
   ```

5. Fai il commit:
   ```bash
   git commit -m "PackVision: configurazione sottodominio packvision.logikaservice.it"
   ```

6. Push su GitHub:
   ```bash
   git push origin main
   ```

### Step 2: Sul Server Linux (OPZIONALE)

**DOPO** aver fatto il push da Windows, se vuoi aggiornare il server:

```bash
cd /var/www/ticketapp
git pull origin main
```

## ✅ Verifica

1. Controlla su GitHub che i file siano presenti:
   - https://github.com/Logikaservice/ticketapp
   - Verifica che ci sia `deploy/nginx/packvision.logikaservice.it.conf`

2. Se i file ci sono su GitHub, il push è riuscito!

## 🔍 Perché l'Errore sul Server?

Sul server Linux:
- Il percorso `c:\TicketApp` non esiste (è un percorso Windows)
- La directory corretta è `/var/www/ticketapp`
- Ma comunque il push va fatto dal tuo PC Windows, non dal server

## 📝 File da Pushare

1. `deploy/nginx/packvision.logikaservice.it.conf`
2. `PACKVISION_SETUP.md`
3. `frontend/src/App.jsx` (modificato)
4. `frontend/src/components/PackVision.jsx` (modificato)

