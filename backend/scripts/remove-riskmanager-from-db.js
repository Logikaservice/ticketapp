/**
 * Script per rimuovere completamente RiskManager dal database
 * Rimuove max_exposure_pct e max_daily_loss_pct da tutti i record bot_settings
 */

const { dbGet, dbAll, dbRun } = require('../crypto_db');

async function removeRiskManagerFromDB() {
    try {
        console.log('🧹 Rimozione RiskManager dal database...\n');

        // 1. Ottieni tutti i record bot_settings
        const allSettings = await dbAll(
            "SELECT id, symbol, strategy_name, parameters FROM bot_settings WHERE parameters IS NOT NULL"
        );

        console.log(`📊 Trovati ${allSettings.length} record da controllare\n`);

        let updated = 0;
        let skipped = 0;

        for (const setting of allSettings) {
            try {
                let params = typeof setting.parameters === 'string' 
                    ? JSON.parse(setting.parameters) 
                    : setting.parameters;

                if (!params || typeof params !== 'object') {
                    skipped++;
                    continue;
                }

                let needsUpdate = false;

                // Rimuovi max_exposure_pct
                if ('max_exposure_pct' in params) {
                    delete params.max_exposure_pct;
                    needsUpdate = true;
                    console.log(`  ✅ Rimosso max_exposure_pct da ${setting.symbol || 'global'}`);
                }

                // Rimuovi max_daily_loss_pct
                if ('max_daily_loss_pct' in params) {
                    delete params.max_daily_loss_pct;
                    needsUpdate = true;
                    console.log(`  ✅ Rimosso max_daily_loss_pct da ${setting.symbol || 'global'}`);
                }

                if (needsUpdate) {
                    await dbRun(
                        "UPDATE bot_settings SET parameters = $1::text WHERE id = $2",
                        [JSON.stringify(params), setting.id]
                    );
                    updated++;
                } else {
                    skipped++;
                }
            } catch (err) {
                console.error(`  ❌ Errore aggiornamento ${setting.symbol || 'global'}:`, err.message);
                skipped++;
            }
        }

        console.log(`\n✅ Completato!`);
        console.log(`   - Aggiornati: ${updated} record`);
        console.log(`   - Saltati: ${skipped} record`);
        console.log(`\n🧹 RiskManager completamente rimosso dal database!`);

    } catch (error) {
        console.error('❌ Errore durante rimozione RiskManager:', error);
        throw error;
    }
}

// Esegui se chiamato direttamente
if (require.main === module) {
    removeRiskManagerFromDB()
        .then(() => {
            console.log('\n✅ Script completato con successo');
            process.exit(0);
        })
        .catch((err) => {
            console.error('\n❌ Errore durante esecuzione script:', err);
            process.exit(1);
        });
}

module.exports = { removeRiskManagerFromDB };
