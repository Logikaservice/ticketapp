# DECT Snom M700 – Prossimi passi

Hai già selezionato le celle DECT in mappa e impostato il modello "Snom M700". Per far leggere all’agent gli handset (cordless) associati e mostrarli in app, servono questi passi.

---

## 1. Scoprire come si accede alla M700 (test da PC in rete)

Su un **PC nella stessa rete** di una cella M700 (stesso sito dove hai le celle):

1. Apri PowerShell e vai nella cartella dell’agent (es. `C:\...\agent`).
2. Esegui lo script di test (sostituisci l’IP con quello di una tua M700):
   ```powershell
   .\Test-SnomM700.ps1 -BaseIp "192.168.1.XXX"
   ```
   Se la M700 usa HTTPS:
   ```powershell
   .\Test-SnomM700.ps1 -BaseIp "192.168.1.XXX" -UseHttps
   ```
   Se l’accesso è con utente/password diversi da `admin`/`admin` (es. da KeePass):
   ```powershell
   .\Test-SnomM700.ps1 -BaseIp "192.168.1.XXX" -Username "tuo_user" -Password "tua_pass"
   ```
3. Controlla l’output:
   - Se vedi `[OK] GET ... -> StatusCode: 200` e un po’ di HTML, l’accesso funziona.
   - Se vedi `401` o errore di login, prova con le credenziali corrette (in KeePass per quella M700 dovresti avere titolo/username/password per l’IP della base).

---

## 2. Trovare la pagina degli handset nel browser

1. Apri il browser e vai all’indirizzo della M700 (es. `http://192.168.1.XXX` o `https://...`).
2. Accedi con le stesse credenziali (admin/admin o quelle in KeePass).
3. Cerca la pagina che mostra l’elenco dei **cordless DECT registrati** (handset). Potrebbe chiamarsi ad esempio:
   - "Handsets", "Registered Handsets", "Telefoni", "Status", "Dispositivi DECT", ecc.
4. Quando l’hai trovata:
   - **Annota l’URL completo** (es. `http://192.168.1.XXX/#/handsets` o `http://192.168.1.XXX/status.html`).
   - Se puoi, **copia un pezzo di HTML** di quella pagina (tasto destro → Ispeziona → elemento che contiene la tabella/lista degli handset) e incollalo in chat, così adatto lo script per estrarre i dati.

---

## 3. Cosa faremo dopo (sul codice)

Quando avrò:
- la conferma che lo script `Test-SnomM700.ps1` si connette (e con quali credenziali),
- l’**URL esatto** della pagina handset (e, se possibile, un esempio di HTML),

potrò:
1. Far usare all’agent le **credenziali da KeePass** (come per il centralino) per ogni cella M700 configurata in mappa.
2. Aggiungere nel backend un **task tipo "dect-fetch"** (simile a router-wifi): l’agent, a richiesta, accede a ogni M700, legge la pagina handset e invia la lista (MAC/nome/numero interno, ecc.) al server.
3. Mostrare in **mappatura** gli handset sotto ogni cella DECT (come i telefoni sotto il centralino).

---

## Riepilogo – Cosa mi serve da te

1. **Esito** del comando `.\Test-SnomM700.ps1 -BaseIp "IP_M700"` (e eventualmente con `-UseHttps` o `-Username`/`-Password`).
2. **URL della pagina** dove la M700 mostra l’elenco dei cordless DECT.
3. (Opzionale) Un **ritaglio di HTML** di quella pagina (la tabella/lista handset) per capire la struttura e scrivere l’estrazione dati.

Quando mi invii questi elementi, procedo con l’integrazione agent + backend + mappa.
