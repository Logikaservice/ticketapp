# 🔐 Recupero/Reset Password Root

## Metodo 1: Cambia Password (Se Sei Già Connesso)

Sei già connesso al server come root. Puoi cambiare la password direttamente:

### Sul Server (dove sei già connesso):

```bash
# Cambia la password di root
passwd root
```

Ti chiederà:
1. **New password:** Inserisci la nuova password
2. **Retype new password:** Reinserisci la stessa password

**IMPORTANTE:** La password non verrà mostrata mentre la digiti (è normale per sicurezza).

---

## Metodo 2: Reset Password Tramite Hetzner Console

Se non ricordi la password attuale:

### Passi:

1. **Vai alla Console Hetzner:**
   - https://console.hetzner.cloud/
   - Accedi con le tue credenziali Hetzner

2. **Trova il Server:**
   - Vai su "Servers" nel menu
   - Cerca il server con IP `159.69.121.162`
   - Clicca sul server

3. **Reset Password:**
   - Clicca su **"Reset Root Password"** (o "Reset Password")
   - Hetzner genererà una nuova password
   - **IMPORTANTE:** Salva immediatamente la password mostrata!
   - Riavvia il server se richiesto

4. **Usa la Nuova Password:**
   ```bash
   ssh root@159.69.121.162
   # Inserisci la nuova password quando richiesto
   ```

---

## Metodo 3: Console NoVNC (Accesso Diretto)

Se non riesci con SSH:

1. **Vai alla Console Hetzner:**
   - https://console.hetzner.cloud/
   - Seleziona il server `159.69.121.162`

2. **Apri Console:**
   - Clicca su **"Console"** → **"Launch Console"**
   - Si aprirà una finestra browser con accesso diretto al server

3. **Login e Cambia Password:**
   - Fai login come `root` (potrebbe non chiedere password o usare quella attuale)
   - Poi esegui: `passwd root` per cambiare la password

---

## Metodo 4: Verifica Password Attuale (Non Possibile)

**IMPORTANTE:** Non è possibile "vedere" o "recuperare" una password esistente. Le password sono criptate e non possono essere decriptate.

Puoi solo:
- **Cambiarla** se conosci quella attuale (`passwd root`)
- **Resettarla** tramite console provider (Hetzner)

---

## Comando Rapido (Se Sei Già Connesso)

Sul server, esegui semplicemente:

```bash
passwd root
```

Inserisci la nuova password due volte quando richiesto.

---

## Dopo Aver Cambiato la Password

Puoi usare la nuova password per connetterti:

```bash
ssh root@159.69.121.162
# Inserisci la nuova password quando richiesto
```

---

## Note Importanti

- **Le password non possono essere recuperate** - solo cambiate o resettate
- **Salva la password in un posto sicuro** (password manager)
- **Usa una password forte** (almeno 12 caratteri, maiuscole, minuscole, numeri, simboli)
- **Considera di usare chiavi SSH invece di password** (più sicuro)

---

## Se Non Riesci ad Accedere

1. Usa la Console Hetzner (Metodo 3) per accesso diretto
2. Oppure resetta la password tramite Hetzner (Metodo 2)
3. Contatta supporto Hetzner se necessario
