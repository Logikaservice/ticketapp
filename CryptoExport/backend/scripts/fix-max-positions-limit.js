/**
 * 🔧 Script per fixare il limite max_positions nel database PostgreSQL
 * 
 * PROBLEMA: Il database non aveva max_positions, max_positions_per_group, max_positions_per_symbol
 * nei parametri, quindi il bot usava valori indefiniti o fallback sbagliati.
 * 
 * SOLUZIONE: Aggiunge questi parametri a tutti i record esistenti in bot_settings.
 */

const { dbAll, dbRun, dbGet } = require('../crypto_db_postgresql');

async function fixMaxPositionsLimit() {
    try {
        console.log('🔧 Fix limite max_positions nel database PostgreSQL\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 1. Recupera tutti i bot_settings
        const allSettings = await dbAll(
            "SELECT id, strategy_name, symbol, parameters FROM bot_settings ORDER BY id"
        );

        if (allSettings.length === 0) {
            console.log('⚠️  Nessun record trovato in bot_settings');
            return;
        }

        console.log(`📊 Trovati ${allSettings.length} record in bot_settings\n`);

        let updated = 0;
        let skipped = 0;
        let errors = 0;

        for (const setting of allSettings) {
            try {
                // Parse parameters
                let params;
                try {
                    if (typeof setting.parameters === 'string') {
                        params = JSON.parse(setting.parameters);
                    } else {
                        params = setting.parameters;
                    }
                } catch (parseErr) {
                    console.log(`❌ [${setting.symbol}] Errore parsing parameters: ${parseErr.message}`);
                    errors++;
                    continue;
                }

                // Verifica se mancano i parametri
                const needsUpdate = 
                    params.max_positions === undefined ||
                    params.max_positions_per_group === undefined ||
                    params.max_positions_per_symbol === undefined;

                if (!needsUpdate) {
                    console.log(`⏭️  [${setting.symbol}] Già configurato (max_positions: ${params.max_positions})`);
                    skipped++;
                    continue;
                }

                // Aggiungi i parametri mancanti (mantieni eventuali valori esistenti)
                const updatedParams = {
                    ...params,
                    max_positions: params.max_positions !== undefined ? params.max_positions : 10,
                    max_positions_per_group: params.max_positions_per_group !== undefined ? params.max_positions_per_group : 6,
                    max_positions_per_symbol: params.max_positions_per_symbol !== undefined ? params.max_positions_per_symbol : 2
                };

                // Update nel database
                await dbRun(
                    "UPDATE bot_settings SET parameters = $1 WHERE id = $2",
                    [JSON.stringify(updatedParams), setting.id]
                );

                console.log(`✅ [${setting.symbol}] Aggiornato: max_positions=${updatedParams.max_positions}, per_group=${updatedParams.max_positions_per_group}, per_symbol=${updatedParams.max_positions_per_symbol}`);
                updated++;

            } catch (err) {
                console.log(`❌ [${setting.symbol}] Errore update: ${err.message}`);
                errors++;
            }
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 RIEPILOGO:');
        console.log(`   ✅ Aggiornati: ${updated}`);
        console.log(`   ⏭️  Già configurati: ${skipped}`);
        console.log(`   ❌ Errori: ${errors}`);
        console.log(`   📝 Totale: ${allSettings.length}\n`);

        if (updated > 0) {
            console.log('✅ Fix completato! Ora il bot rispetterà i limiti configurati.\n');
            console.log('💡 PROSSIMI PASSI:');
            console.log('   1. Riavvia il bot per applicare le modifiche');
            console.log('   2. Verifica nelle impostazioni che max_positions sia 10');
            console.log('   3. Controlla i log del bot per confermare\n');
        }

        // Verifica finale
        console.log('🔍 Verifica finale: Controlla parametri "global"...');
        const globalSettings = await dbGet(
            "SELECT parameters FROM bot_settings WHERE strategy_name = 'RSI_Strategy' AND symbol = 'global' LIMIT 1"
        );

        if (globalSettings) {
            const params = typeof globalSettings.parameters === 'string' 
                ? JSON.parse(globalSettings.parameters) 
                : globalSettings.parameters;
            
            console.log('   max_positions:', params.max_positions);
            console.log('   max_positions_per_group:', params.max_positions_per_group);
            console.log('   max_positions_per_symbol:', params.max_positions_per_symbol);
            console.log('');
        }

    } catch (err) {
        console.error('❌ Errore fatale:', err.message);
        console.error(err.stack);
        throw err;
    }
}

// Esegui lo script
if (require.main === module) {
    fixMaxPositionsLimit()
        .then(() => {
            console.log('✅ Script completato con successo');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Script fallito:', err.message);
            process.exit(1);
        });
}

module.exports = { fixMaxPositionsLimit };
