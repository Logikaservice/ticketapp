# Configurazione Monitor PackVision - Guida Completa

## 📋 Panoramica

PackVision supporta fino a 4 monitor separati, ognuno dei quali può visualizzare messaggi diversi. Ogni monitor è identificato da un numero (1, 2, 3, 4) e può essere configurato su un PC separato che apre il browser a tutto schermo.

## 🖥️ Configurazione PC per Monitor

### Opzione 1: Browser a Tutto Schermo (Kiosk Mode) - Windows

#### Metodo A: Chrome/Edge Kiosk Mode (Consigliato)

1. **Crea uno script di avvio automatico:**

   Crea un file `start-packvision.bat` sul desktop o nella cartella di avvio:

   ```batch
   @echo off
   start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --app=https://packvision.logikaservice.it/?mode=display&monitor=1
   ```

   **Per ogni monitor, cambia il parametro `monitor=1` con il numero corretto (1, 2, 3, o 4).**

2. **Aggiungi allo startup di Windows:**

   - Premi `Win + R`
   - Digita `shell:startup` e premi Invio
   - Copia il file `.bat` nella cartella che si apre
   - Il browser si aprirà automaticamente all'avvio del PC

#### Metodo B: Edge Kiosk Mode

```batch
@echo off
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk --app=https://packvision.logikaservice.it/?mode=display&monitor=1
```

#### Metodo C: Firefox Kiosk Mode

```batch
@echo off
start "" "C:\Program Files\Mozilla Firefox\firefox.exe" -kiosk https://packvision.logikaservice.it/?mode=display&monitor=1
```

### Opzione 2: Browser a Tutto Schermo - Linux

#### Metodo A: Chrome/Chromium Kiosk Mode

1. **Installa Chrome/Chromium** (se non già installato):
   ```bash
   sudo apt-get update
   sudo apt-get install chromium-browser
   ```

2. **Crea uno script di avvio:**

   Crea `/home/utente/start-packvision.sh`:
   ```bash
   #!/bin/bash
   chromium-browser --kiosk --app=https://packvision.logikaservice.it/?mode=display&monitor=1
   ```

3. **Rendi eseguibile:**
   ```bash
   chmod +x /home/utente/start-packvision.sh
   ```

4. **Aggiungi all'avvio automatico:**

   Per **GNOME** (Ubuntu Desktop):
   - Apri "Avvio Applicazioni" (Startup Applications)
   - Aggiungi nuovo comando: `/home/utente/start-packvision.sh`

   Per **systemd** (server senza desktop):
   Crea `/etc/systemd/system/packvision-monitor1.service`:
   ```ini
   [Unit]
   Description=PackVision Monitor 1
   After=graphical.target

   [Service]
   Type=simple
   User=utente
   Environment=DISPLAY=:0
   ExecStart=/usr/bin/chromium-browser --kiosk --app=https://packvision.logikaservice.it/?mode=display&monitor=1
   Restart=always

   [Install]
   WantedBy=graphical.target
   ```

   Poi abilita il servizio:
   ```bash
   sudo systemctl enable packvision-monitor1.service
   sudo systemctl start packvision-monitor1.service
   ```

### Opzione 3: Browser a Tutto Schermo - macOS

1. **Crea uno script di avvio:**

   Crea `~/start-packvision.command`:
   ```bash
   #!/bin/bash
   open -a "Google Chrome" --args --kiosk --app=https://packvision.logikaservice.it/?mode=display&monitor=1
   ```

2. **Rendi eseguibile:**
   ```bash
   chmod +x ~/start-packvision.command
   ```

3. **Aggiungi all'avvio automatico:**

   - Vai su "Preferenze di Sistema" > "Utenti e Gruppi" > "Elementi di accesso"
   - Aggiungi `~/start-packvision.command`

## 🔧 Configurazione URL per Monitor Specifici

Ogni monitor deve aprire un URL con il parametro `monitor` specifico:

- **Monitor 1**: `https://packvision.logikaservice.it/?mode=display&monitor=1`
- **Monitor 2**: `https://packvision.logikaservice.it/?mode=display&monitor=2`
- **Monitor 3**: `https://packvision.logikaservice.it/?mode=display&monitor=3`
- **Monitor 4**: `https://packvision.logikaservice.it/?mode=display&monitor=4`

## 🎯 Funzionalità Monitor

### Selezione Monitor nell'Interfaccia

Quando crei o modifichi un messaggio in PackVision Control:

1. **Sezione "Monitor di Destinazione"**: 4 pulsanti rappresentano i monitor
2. **Selezione multipla**: Puoi selezionare più monitor contemporaneamente
3. **Indicatore visivo**: I monitor selezionati mostrano un checkmark blu
4. **Default**: Tutti i monitor sono selezionati di default

### Visualizzazione Messaggi

- Ogni monitor visualizza **solo i messaggi assegnati a quel monitor**
- I messaggi urgenti hanno sempre priorità
- I messaggi possono essere assegnati a monitor specifici o a tutti

### Indicatori nei Messaggi Attivi

Nella sezione "Messaggi Attivi", ogni messaggio mostra:
- **Icone numerate** (1, 2, 3, 4) che indicano su quali monitor è pubblicato
- **Tooltip** al passaggio del mouse per vedere il numero del monitor

## 🛠️ Troubleshooting

### Il browser non si apre a tutto schermo

**Windows:**
- Verifica che il percorso del browser sia corretto
- Prova con `--start-fullscreen` invece di `--kiosk`
- Aggiungi `--disable-infobars` per nascondere le barre informative

**Linux:**
- Assicurati che il display sia configurato correttamente
- Per server senza desktop, installa un window manager minimale (es. `openbox`)

### Il monitor non mostra i messaggi corretti

1. **Verifica il parametro URL**: Controlla che `monitor=X` sia corretto nell'URL
2. **Verifica la selezione**: Controlla che il messaggio sia assegnato a quel monitor nell'interfaccia
3. **Ricarica la pagina**: Premi `F5` o `Ctrl+R` per ricaricare

### Il browser si chiude automaticamente

- Aggiungi `--no-first-run` e `--disable-default-apps` ai parametri
- Per Windows, crea un task scheduler invece di startup folder

## 📝 Esempi Script Completi

### Windows - Monitor 1 (Chrome)

```batch
@echo off
REM Attendi 10 secondi per il caricamento completo del sistema
timeout /t 10 /nobreak

REM Avvia Chrome in modalità kiosk
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --kiosk ^
  --app=https://packvision.logikaservice.it/?mode=display&monitor=1 ^
  --disable-infobars ^
  --no-first-run ^
  --disable-default-apps

REM Mantieni lo script in esecuzione
:loop
timeout /t 60 /nobreak
tasklist /FI "IMAGENAME eq chrome.exe" 2>NUL | find /I /N "chrome.exe">NUL
if "%ERRORLEVEL%"=="0" goto loop

REM Se Chrome si chiude, riavvialo
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --kiosk ^
  --app=https://packvision.logikaservice.it/?mode=display&monitor=1
goto loop
```

### Linux - Monitor 1 (Chromium)

```bash
#!/bin/bash

# Attendi il caricamento completo
sleep 10

# Avvia Chromium in modalità kiosk
chromium-browser \
  --kiosk \
  --app=https://packvision.logikaservice.it/?mode=display&monitor=1 \
  --disable-infobars \
  --no-first-run \
  --disable-default-apps \
  --autoplay-policy=no-user-gesture-required &

# Mantieni lo script in esecuzione e riavvia se necessario
while true; do
  sleep 60
  if ! pgrep -x chromium-browser > /dev/null; then
    chromium-browser \
      --kiosk \
      --app=https://packvision.logikaservice.it/?mode=display&monitor=1 &
  fi
done
```

## 🔐 Sicurezza e Best Practices

1. **Disabilita aggiornamenti automatici del browser** per evitare interruzioni
2. **Configura firewall** per permettere solo il traffico necessario
3. **Usa account utente limitato** (non amministratore) sul PC del monitor
4. **Disabilita screen saver** e impostazioni di risparmio energetico
5. **Configura monitor per non spegnersi** mai

## 📞 Supporto

Per problemi o domande:
- Verifica i log del browser (Console F12)
- Controlla la connessione di rete
- Verifica che il server PackVision sia raggiungibile

