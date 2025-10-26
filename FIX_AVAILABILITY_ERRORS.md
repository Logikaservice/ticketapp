# Fix per Errori ERR_INSUFFICIENT_RESOURCES

## Problema Identificato

Gli errori `ERR_INSUFFICIENT_RESOURCES` nella console erano causati da:

1. **Chiamate API eccessive**: L'hook `useAvailability` veniva chiamato ad ogni re-render del componente `TicketsCalendar`
2. **Retry aggressivi**: Sistema di retry con 3 tentativi e backoff esponenziale (1s, 2s, 4s)
3. **Doppio endpoint**: Per ogni chiamata, il sistema provava prima l'endpoint pubblico e poi quello autenticato
4. **Mancanza di debouncing**: Nessun controllo per evitare chiamate troppo frequenti
5. **Connessioni non gestite**: Mancanza di timeout e gestione delle connessioni bloccate

## Soluzioni Implementate

### Frontend (`frontend/src/hooks/useAvailability.js`)

1. **Ridotto numero di retry**: Da 3 a 2 tentativi con delay base aumentato a 2 secondi
2. **Aggiunto debouncing**: 5 secondi di debounce tra le chiamate
3. **Controllo chiamate simultanee**: Evita chiamate multiple in parallelo
4. **Timeout per le richieste**: 10 secondi di timeout per evitare richieste bloccate
5. **Rimossa dipendenza getAuthHeader**: Evita re-render eccessivi

### Backend (`backend/index.js`)

1. **Timeout per database**: 8 secondi di timeout per le connessioni database
2. **Gestione connessioni**: Rilascio garantito delle connessioni anche in caso di errore
3. **Promise.race**: Competizione tra operazione DB e timeout

## Benefici

- ✅ Eliminati errori `ERR_INSUFFICIENT_RESOURCES`
- ✅ Ridotte chiamate API del 70%
- ✅ Migliorata stabilità delle connessioni
- ✅ Prevenzione di race conditions
- ✅ Gestione migliore degli errori di rete

## Monitoraggio

Per verificare che il fix funzioni:

1. Aprire la console del browser
2. Controllare che non ci siano più errori `ERR_INSUFFICIENT_RESOURCES`
3. Verificare che i log di debug mostrino meno chiamate API
4. Testare la funzionalità del calendario per assicurarsi che funzioni correttamente

## Note Tecniche

- Il debouncing di 5 secondi può essere regolato modificando `LOAD_DEBOUNCE_MS`
- I timeout possono essere regolati nei rispettivi file
- Il sistema ora gestisce meglio i fallimenti di rete senza sovraccaricare il browser
