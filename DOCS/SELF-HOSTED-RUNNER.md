# Runner self-hosted per GitHub Actions (deploy)

Se i workflow restano in **Queued** ("Waiting for a runner"), GitHub non assegna un runner al repo. Con un **runner self-hosted** sul VPS il job parte subito sul tuo server.

## Setup (una tantum sul VPS)

1. **Su GitHub:** repo **TicketApp** → **Settings** → **Actions** → **Runners** → **New self-hosted runner**.

2. **Sistema:** Linux | **Architettura:** x64 (o quella del tuo VPS).

3. **Sul VPS** (SSH), nella cartella che preferisci (es. `~/actions-runner`):

   ```bash
   mkdir -p ~/actions-runner && cd ~/actions-runner
   ```

   Poi esegui i comandi che GitHub ti mostra (Download, Extract, Configure). Quando chiede il nome del runner puoi usare ad es. `ticketapp-vps`.

4. **Configura come servizio** (opzionale ma consigliato):

   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   sudo ./svc.sh status
   ```

5. Su GitHub, in **Settings → Actions → Runners** dovresti vedere il runner **Online** (verde).

Dopo questo, i push su `main` faranno partire il job **Deploy to VPS** sul runner self-hosted invece che in coda sui runner di GitHub.
