/**
 * Script per aggiornare il volume minimo a 1,000,000 USDT
 */

const { dbGet, dbRun } = require('../crypto_db');

async function aggiornaVolumeMinimo() {
    try {
        console.log('🔄 Aggiornamento volume minimo a 1,000,000 USDT...\n');

        // 1. Leggi i parametri attuali
        const botSettings = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );

        if (!botSettings || !botSettings.parameters) {
            console.error('❌ Nessun parametro trovato in bot_settings');
            return;
        }

        const params = typeof botSettings.parameters === 'string' 
            ? JSON.parse(botSettings.parameters) 
            : botSettings.parameters;

        console.log('📊 Volume minimo attuale:', params.min_volume_24h);

        // 2. Aggiorna il valore
        params.min_volume_24h = 1000000;

        // 3. Salva nel database
        const parametersJson = JSON.stringify(params);
        await dbRun(
            "UPDATE bot_settings SET parameters = $1::text WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global'",
            [parametersJson]
        );

        // 4. Verifica
        const verification = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );
        const verifiedParams = typeof verification.parameters === 'string' 
            ? JSON.parse(verification.parameters) 
            : verification.parameters;

        console.log('\n✅ Volume minimo aggiornato a:', verifiedParams.min_volume_24h);
        console.log('✅ Verifica completata!\n');

    } catch (error) {
        console.error('❌ Errore durante l\'aggiornamento:', error);
        console.error(error.stack);
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
