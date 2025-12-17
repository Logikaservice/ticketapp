/**
 * Script per aggiornare il volume minimo a 600,000 USDT come salvato dall'utente
 */

const { dbGet, dbRun } = require('../crypto_db');

async function aggiornaVolumeMinimo() {
    const client = await require('../crypto_db').pool.connect();
    try {
        console.log('🔄 Aggiornamento volume minimo a 600,000 USDT...\n');

        // 1. Leggi i parametri attuali
        const result = await client.query(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );

        if (!result.rows || result.rows.length === 0) {
            console.error('❌ Nessun parametro trovato in bot_settings');
            return;
        }

        const params = typeof result.rows[0].parameters === 'string' 
            ? JSON.parse(result.rows[0].parameters) 
            : result.rows[0].parameters;

        console.log('📊 Volume minimo attuale:', params.min_volume_24h);

        // 2. Aggiorna il valore
        params.min_volume_24h = 600000;

        console.log('📝 Nuovo valore da salvare:', params.min_volume_24h);

        // 3. Salva nel database
        const parametersJson = JSON.stringify(params);
        const updateResult = await client.query(
            "UPDATE bot_settings SET parameters = $1::text WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'",
            [parametersJson]
        );

        console.log('✅ UPDATE eseguito, righe modificate:', updateResult.rowCount);

        // 4. Verifica immediatamente
        const verifyResult = await client.query(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );
        
        if (verifyResult.rows && verifyResult.rows.length > 0) {
            const verifiedParams = typeof verifyResult.rows[0].parameters === 'string' 
                ? JSON.parse(verifyResult.rows[0].parameters) 
                : verifyResult.rows[0].parameters;

            console.log('\n✅ Verifica: Volume minimo nel DB:', verifiedParams.min_volume_24h);
            
            if (verifiedParams.min_volume_24h === 600000) {
                console.log('✅ Volume minimo aggiornato correttamente a 600,000 USDT!\n');
            } else {
                console.error('❌ ERRORE: Il valore non è stato aggiornato correttamente!');
                console.error('   Valore atteso: 600000');
                console.error('   Valore trovato:', verifiedParams.min_volume_24h);
            }
        }

    } catch (error) {
        console.error('❌ Errore durante l\'aggiornamento:', error);
        console.error(error.stack);
    } finally {
        client.release();
    }
}

aggiornaVolumeMinimo()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Errore fatale:', err);
        process.exit(1);
    });
