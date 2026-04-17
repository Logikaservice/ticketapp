## L-Sight RTC — TURN (coturn) setup

Per avere connessioni affidabili (NAT, reti aziendali, hotspot) è **necessario** un server TURN.

### 1) Installazione (Ubuntu)

```bash
sudo apt update
sudo apt install -y coturn
```

### 2) Configurazione base

Modifica `/etc/turnserver.conf` (esempio minimale):

```conf
listening-port=3478
tls-listening-port=5349

fingerprint
lt-cred-mech

realm=ticket.logikaservice.it

# TLS (se vuoi TURN su 5349)
cert=/etc/letsencrypt/live/ticket.logikaservice.it/fullchain.pem
pkey=/etc/letsencrypt/live/ticket.logikaservice.it/privkey.pem

# Utente statico (MVP)
user=lsight:CAMBIA_PASSWORD

# Logging
log-file=/var/log/turnserver/turn.log
simple-log
```

Abilita coturn:

```bash
sudo sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
sudo systemctl enable --now coturn
sudo systemctl restart coturn
```

Apri firewall per 3478/udp+tcp e (se usi TLS) 5349/tcp.

### 3) Variabili backend (TicketApp)

Nel `.env` del backend:

```env
LSIGHT_TURN_URLS=turn:ticket.logikaservice.it:3478?transport=udp,turn:ticket.logikaservice.it:3478?transport=tcp
LSIGHT_TURN_USERNAME=lsight
LSIGHT_TURN_PASSWORD=CAMBIA_PASSWORD
```

Poi:

```bash
pm2 restart ticketapp-backend
```

### 4) Nota sicurezza (miglioramento)

Questo file descrive un TURN con credenziali statiche (MVP).
La soluzione “best practice” è usare `use-auth-secret` e generare credenziali temporanee per sessione (REST API coturn).

