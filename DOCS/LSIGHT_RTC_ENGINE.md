# L-Sight RTC Engine (WebRTC) — modulo sperimentale

Questo documento descrive il **modulo isolato** introdotto nel branch `feature/lsight-webrtc`.

## Obiettivo

Costruire il “motore” per connessioni remote **senza VPN** (approccio ZTNA / tunnel inverso), con control-plane integrato in TicketApp/L‑Sight.

In questa fase il modulo fornisce solo:

- Creazione/lettura/chiusura di **sessioni** lato server (control-plane)
- Permessi basati su:
  - tecnico: accesso pieno
  - cliente: solo PC assegnati via `lsight_assignments`

## Feature flag

Il modulo è **disattivato di default**.

Per abilitarlo:

- imposta `LSIGHT_RTC_ENABLED=1` nelle variabili d’ambiente del backend
- riavvia il backend

Quando è abilitato, viene montato su:

- `/api/lsight-rtc`

## Endpoint disponibili

Tutti gli endpoint richiedono autenticazione JWT (header `Authorization: Bearer <token>`).

### 1) Crea sessione

`POST /api/lsight-rtc/sessions`

Body JSON:

- `agent_id` (obbligatorio)
- `ttl_minutes` (opzionale, default 10, min 5, max 60)

Risposta:

- `session.id`
- `session.session_token`
- `expires_at`

### 2) Leggi sessione

`GET /api/lsight-rtc/sessions/:id`

Nota: se scaduta, viene marcata `expired` automaticamente (soft expire).

### 3) Chiudi sessione

`POST /api/lsight-rtc/sessions/:id/close`

### 4) Debug

`GET /api/lsight-rtc/debug/state`

## Tabelle create

- `lsight_rtc_sessions`

## Note importanti

- Questo modulo è volutamente **separato** da `backend/routes/lsight.js` e non impatta la UI finché non viene integrato.
- Se non piace, si può eliminare facilmente cancellando il branch o revertando i commit relativi.

