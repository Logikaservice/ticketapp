---
description: Commit e push delle modifiche al repository dopo ogni cambiamento al codice
---

// turbo-all

Dopo ogni modifica al codice, eseguire sempre commit e push con i seguenti passaggi:

1. Aggiungere i file modificati allo staging
```
git add <file1> <file2> ...
```

2. Creare un commit con messaggio descrittivo in inglese
```
git commit -m "Breve descrizione della modifica"
```

3. Fare push al repository remoto
```
git push
```

> **Regola**: Non aspettare che l'utente chieda il push. Farlo **sempre** subito dopo ogni modifica, come parte integrante del flusso di lavoro.
